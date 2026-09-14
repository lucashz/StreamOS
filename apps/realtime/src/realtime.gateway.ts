import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Prisma, PrismaClient } from '@streamos/database';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import type { Server, Socket } from 'socket.io';
import {
  acceptsPlaybackReceipt,
  PLAYBACK_SEQUENCE,
} from './playback-receipt.policy';
import { widgetAcceptsEvent } from './overlay-event-routing.policy';

type StreamEvent = {
  eventId: string;
  eventType: string;
  eventVersion: number;
  organizationId?: string;
  aggregateId: string;
  correlationId: string;
  causationId?: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
};

type AlertPresentationConfig = Prisma.AlertConfigGetPayload<{
  include: {
    variations: {
      include: { visualAsset: true; soundAsset: true };
    };
  };
}>;

@WebSocketGateway({
  cors: {
    origin: [
      process.env.APP_URL ?? 'http://localhost:3000',
      process.env.OVERLAY_URL ?? 'http://localhost:3003',
    ],
    credentials: true,
  },
})
@Injectable()
export class RealtimeGateway
  implements
    OnModuleInit,
    OnApplicationShutdown,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly subscriber = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );

  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async onModuleInit() {
    await this.subscriber.subscribe('streamos:events');
    this.subscriber.on('message', (_channel, message) => {
      void this.deliver(JSON.parse(message) as StreamEvent);
    });
  }

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth as Record<string, unknown>;
    if (auth.mode === 'admin') {
      await this.connectAdmin(client);
      return;
    }
    const token = auth.token;
    if (typeof token !== 'string' || token.length < 32) {
      client.emit('streamos:error', { code: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    const channel = await this.prisma.overlayChannel.findFirst({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        revokedAt: null,
      },
      include: { widget: true },
    });
    if (
      !channel ||
      (channel.widget &&
        (!channel.widget.enabled || channel.widget.deletedAt !== null))
    ) {
      client.emit('streamos:error', { code: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    const data = client.data as {
      overlayChannelId?: string;
      organizationId?: string;
      mode?: string;
    };
    data.overlayChannelId = channel.id;
    data.organizationId = channel.organizationId;
    data.mode = 'overlay';
    const now = new Date();
    await this.prisma.overlayChannel.update({
      where: { id: channel.id },
      data: {
        connectedAt: now,
        lastHeartbeatAt: now,
        disconnectedAt: null,
        connectionId: client.id,
        synchronizedAt: null,
      },
    });
    await client.join(this.room(channel.id));
    this.emitPresence(channel.organizationId);
    client.emit('streamos:sync-request', { connectionId: client.id });
  }

  @SubscribeMessage('streamos:sync-state')
  async synchronizeOverlay(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      overlayVersion?: string;
      attempts?: Array<{ playbackAttemptId?: string; status?: string }>;
    },
  ) {
    const data = client.data as {
      overlayChannelId?: string;
      organizationId?: string;
      mode?: string;
    };
    if (
      data.mode !== 'overlay' ||
      !data.overlayChannelId ||
      !data.organizationId
    )
      return { accepted: false };
    const attempts = Array.isArray(body.attempts)
      ? body.attempts.slice(-100)
      : [];
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.organizationId!}))`;
      for (const known of attempts) {
        if (!known.playbackAttemptId) continue;
        const attempt = await tx.playbackAttempt.findFirst({
          where: {
            id: known.playbackAttemptId,
            organizationId: data.organizationId!,
          },
        });
        if (!attempt) continue;
        if (known.status === 'COMPLETED') {
          await tx.playbackAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'COMPLETED',
              completedAt: attempt.completedAt ?? new Date(),
              nextAttemptAt: null,
            },
          });
          await tx.liveQueueItem.updateMany({
            where: {
              id: attempt.queueItemId,
              status: { in: ['DISPATCHING', 'PLAYING'] },
            },
            data: {
              status: 'COMPLETED',
              finishedAt: new Date(),
              playbackDeadline: null,
            },
          });
          await tx.overlayDelivery.updateMany({
            where: { playbackAttemptId: attempt.id, acknowledgedAt: null },
            data: { acknowledgedAt: new Date() },
          });
        } else if (known.status === 'STARTED') {
          await tx.playbackAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'NEEDS_REVIEW',
              nextAttemptAt: null,
              lastError: 'Reconexão após início sem conclusão confirmada',
            },
          });
          await tx.liveQueueItem.updateMany({
            where: {
              id: attempt.queueItemId,
              status: { in: ['DISPATCHING', 'PLAYING'] },
            },
            data: {
              status: 'NEEDS_REVIEW',
              playbackDeadline: null,
              failureReason: 'Reprodução ambígua após reconexão',
            },
          });
        }
      }
      await tx.overlayChannel.update({
        where: { id: data.overlayChannelId! },
        data: {
          synchronizedAt: new Date(),
          connectionId: client.id,
          overlayVersion: body.overlayVersion?.slice(0, 40) ?? 'unknown',
        },
      });
    });
    await this.replay(client, data.overlayChannelId);
    return { accepted: true, connectionId: client.id };
  }

  async handleDisconnect(client: Socket) {
    const data = client.data as {
      overlayChannelId?: string;
      organizationId?: string;
      mode?: string;
    };
    if (
      data.mode !== 'overlay' ||
      !data.overlayChannelId ||
      !data.organizationId
    )
      return;
    await this.prisma.overlayChannel.updateMany({
      where: { id: data.overlayChannelId, connectionId: client.id },
      data: {
        disconnectedAt: new Date(),
        synchronizedAt: null,
        connectionId: null,
      },
    });
    this.emitPresence(data.organizationId);
  }

  @SubscribeMessage('streamos:heartbeat')
  async heartbeat(@ConnectedSocket() client: Socket) {
    const data = client.data as {
      overlayChannelId?: string;
      organizationId?: string;
      mode?: string;
    };
    if (data.mode !== 'overlay' || !data.overlayChannelId)
      return { accepted: false };
    await this.prisma.overlayChannel.update({
      where: { id: data.overlayChannelId },
      data: { lastHeartbeatAt: new Date(), disconnectedAt: null },
    });
    if (data.organizationId) this.emitPresence(data.organizationId);
    return { accepted: true };
  }

  @SubscribeMessage('streamos:playback')
  async playback(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { eventId?: string; status?: string; reason?: string },
  ) {
    const data = client.data as {
      overlayChannelId?: string;
      organizationId?: string;
      mode?: string;
    };
    if (
      data.mode !== 'overlay' ||
      !data.overlayChannelId ||
      !data.organizationId ||
      !body.eventId
    )
      return { accepted: false };
    const sequence = body.status ? PLAYBACK_SEQUENCE[body.status] : undefined;
    if (!sequence) return { accepted: false };
    const delivery = await this.prisma.overlayDelivery.findFirst({
      where: { overlayChannelId: data.overlayChannelId, eventId: body.eventId },
    });
    if (!delivery) return { accepted: false };
    const now = new Date();
    const receiptResult = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${body.eventId!}))`;
      const existing = await tx.overlayPlaybackReceipt.findUnique({
        where: {
          overlayChannelId_eventId: {
            overlayChannelId: data.overlayChannelId!,
            eventId: body.eventId!,
          },
        },
      });
      if (
        existing &&
        !acceptsPlaybackReceipt(existing.lastSequence, body.status!)
      )
        return { receipt: existing, accepted: false };
      const updatedReceipt = await tx.overlayPlaybackReceipt.upsert({
        where: {
          overlayChannelId_eventId: {
            overlayChannelId: data.overlayChannelId!,
            eventId: body.eventId!,
          },
        },
        update: {
          playbackAttemptId: delivery.playbackAttemptId,
          connectionId: client.id,
          status: body.status!,
          lastSequence: sequence,
          ...(body.status === 'MEDIA_READY' ? { mediaReadyAt: now } : {}),
          ...(body.status === 'STARTED' ? { startedAt: now } : {}),
          ...(body.status === 'COMPLETED' ? { completedAt: now } : {}),
          ...(['MEDIA_FAILED', 'FAILED'].includes(body.status!)
            ? { failedAt: now, failureReason: body.reason?.slice(0, 300) }
            : {}),
        },
        create: {
          organizationId: data.organizationId!,
          overlayChannelId: data.overlayChannelId!,
          eventId: body.eventId!,
          playbackAttemptId: delivery.playbackAttemptId,
          connectionId: client.id,
          sequenceNumber: delivery.sequence,
          status: body.status!,
          lastSequence: sequence,
          ...(body.status === 'MEDIA_READY' ? { mediaReadyAt: now } : {}),
          ...(body.status === 'STARTED' ? { startedAt: now } : {}),
          ...(body.status === 'COMPLETED' ? { completedAt: now } : {}),
          ...(['MEDIA_FAILED', 'FAILED'].includes(body.status!)
            ? { failedAt: now, failureReason: body.reason?.slice(0, 300) }
            : {}),
        },
      });
      if (delivery.playbackAttemptId) {
        const attemptStatus =
          body.status === 'RECEIVED'
            ? 'RECEIVED'
            : body.status === 'STARTED'
              ? 'STARTED'
              : body.status === 'COMPLETED'
                ? 'COMPLETED'
                : ['MEDIA_FAILED', 'FAILED'].includes(body.status!)
                  ? 'FAILED'
                  : null;
        if (attemptStatus)
          await tx.playbackAttempt.updateMany({
            where: { id: delivery.playbackAttemptId },
            data: {
              status: attemptStatus,
              connectionId: client.id,
              ...(attemptStatus === 'RECEIVED'
                ? {
                    receivedAt: now,
                    nextAttemptAt: new Date(now.getTime() + 10_000),
                  }
                : {}),
              ...(attemptStatus === 'STARTED'
                ? { startedAt: now, nextAttemptAt: null }
                : {}),
              ...(attemptStatus === 'COMPLETED'
                ? { completedAt: now, nextAttemptAt: null }
                : {}),
              ...(attemptStatus === 'FAILED'
                ? {
                    failedAt: now,
                    nextAttemptAt: null,
                    lastError: body.reason?.slice(0, 300),
                  }
                : {}),
            },
          });
      }
      const sourceEvent = await tx.outboxEvent.findUnique({
        where: { id: body.eventId! },
        select: { aggregateId: true, eventType: true, payload: true },
      });
      if (sourceEvent?.eventType === 'song.started.v1') {
        const sourceStatus =
          body.status === 'COMPLETED'
            ? 'COMPLETED'
            : ['MEDIA_FAILED', 'FAILED'].includes(body.status!)
              ? 'UNAVAILABLE'
              : body.status === 'STARTED'
                ? 'PLAYING'
                : null;
        if (sourceStatus)
          await tx.songRequest.updateMany({
            where: { id: sourceEvent.aggregateId },
            data: { status: sourceStatus },
          });
      }
      if (sourceEvent?.eventType === 'video.started.v1') {
        const sourceStatus =
          body.status === 'COMPLETED'
            ? 'COMPLETED'
            : ['MEDIA_FAILED', 'FAILED'].includes(body.status!)
              ? 'UNAVAILABLE'
              : body.status === 'STARTED'
                ? 'PLAYING'
                : null;
        if (sourceStatus)
          await tx.videoRequest.updateMany({
            where: { id: sourceEvent.aggregateId },
            data: { status: sourceStatus },
          });
      }
      if (sourceEvent) {
        const queueStatus =
          body.status === 'COMPLETED'
            ? 'COMPLETED'
            : body.status === 'MEDIA_FAILED'
              ? 'MEDIA_FAILED'
              : body.status === 'FAILED'
                ? 'FAILED'
                : body.status === 'STARTED'
                  ? 'PLAYING'
                  : null;
        if (queueStatus) {
          const sourcePayload = sourceEvent.payload as Record<string, unknown>;
          const rawDuration = Number(sourcePayload.expectedDurationMs ?? 8000);
          const expectedDurationMs = Number.isFinite(rawDuration)
            ? Math.max(1000, rawDuration)
            : 8000;
          const queueItemId =
            typeof sourcePayload.queueItemId === 'string'
              ? sourcePayload.queueItemId
              : undefined;
          await tx.liveQueueItem.updateMany({
            where: {
              organizationId: data.organizationId!,
              OR: [
                { sourceId: sourceEvent.aggregateId },
                ...(queueItemId ? [{ id: queueItemId }] : []),
              ],
              ...(['COMPLETED', 'MEDIA_FAILED', 'FAILED'].includes(queueStatus)
                ? { status: { in: ['PLAYING', 'DISPATCHING'] } }
                : { status: 'DISPATCHING' }),
            },
            data: {
              status: queueStatus,
              ...(queueStatus === 'PLAYING'
                ? {
                    startedAt: now,
                    playbackDeadline: new Date(
                      now.getTime() + expectedDurationMs + 15_000,
                    ),
                  }
                : {
                    finishedAt: now,
                    playbackDeadline: null,
                    failureReason: body.reason?.slice(0, 300),
                  }),
            },
          });
        }
        // O worker centraliza o avanço da fila. Assim, idade, presença do
        // overlay e timeout seguem a mesma política para todos os itens.
      }
      return { receipt: updatedReceipt, accepted: true };
    });
    const receipt = receiptResult.receipt;
    this.server
      .to(this.adminRoom(data.organizationId))
      .emit('streamos:overlay-playback', {
        overlayChannelId: data.overlayChannelId,
        eventId: body.eventId,
        status: receipt.status,
        reason: receipt.failureReason,
        updatedAt: receipt.updatedAt.toISOString(),
      });
    return { accepted: receiptResult.accepted, status: receipt.status };
  }

  @SubscribeMessage('streamos:ack')
  async acknowledge(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { eventId?: string },
  ) {
    const data = client.data as { overlayChannelId?: string };
    const overlayChannelId = data.overlayChannelId;
    if (!overlayChannelId || !body.eventId) return { accepted: false };
    const result = await this.prisma.overlayDelivery.updateMany({
      where: {
        overlayChannelId,
        eventId: body.eventId,
        acknowledgedAt: null,
      },
      data: { acknowledgedAt: new Date() },
    });
    return { accepted: result.count === 1 };
  }

  private async deliver(event: StreamEvent) {
    if (!event.organizationId) return;
    this.server
      .to(this.adminRoom(event.organizationId))
      .emit('streamos:admin-event', event);
    if (event.eventType === 'live.queue.state.changed.v1') {
      const channels = await this.prisma.overlayChannel.findMany({
        where: { organizationId: event.organizationId, revokedAt: null },
        select: { id: true },
      });
      for (const channel of channels)
        this.server
          .to(this.room(channel.id))
          .emit('streamos:control', event.payload);
      return;
    }
    if (event.eventType === 'alert.configuration.updated.v1') {
      const [config, channels] = await Promise.all([
        this.prisma.alertConfig.findUnique({
          where: { organizationId: event.organizationId },
          include: {
            variations: {
              where: { enabled: true, deletedAt: null },
              include: { visualAsset: true, soundAsset: true },
            },
          },
        }),
        this.prisma.overlayChannel.findMany({
          where: { organizationId: event.organizationId, revokedAt: null },
          include: { widget: true },
        }),
      ]);
      const presentation = this.alertPresentation(config, event);
      for (const channel of channels) {
        if (channel.widget && channel.widget.type !== 'ALERT') continue;
        this.server.to(this.room(channel.id)).emit('streamos:alert-config', {
          ...presentation,
          widgetType: 'ALERT',
          config: channel.widget?.config ?? {},
        });
      }
      return;
    }
    if (
      [
        'payment.confirmed.v1',
        'song.requested.v1',
        'video.requested.v1',
        'subscription.created.v1',
        'campaign.contribution.confirmed.v1',
        'tts.queued.v1',
        'alert.test.v1',
        'alert.test.v2',
      ].includes(event.eventType)
    )
      return;
    const alertConfig = await this.prisma.alertConfig.findUnique({
      where: { organizationId: event.organizationId },
      include: {
        variations: {
          where: { enabled: true, deletedAt: null },
          include: { visualAsset: true, soundAsset: true },
        },
      },
    });
    if (event.eventType === 'payment.confirmed.v1' && alertConfig) {
      const rawAmount = event.payload.amountInCents;
      const amount =
        typeof rawAmount === 'string' || typeof rawAmount === 'number'
          ? BigInt(rawAmount)
          : 0n;
      if (!alertConfig.enabled || amount < alertConfig.minimumInCents) return;
      if (alertConfig.moderationEnabled && event.payload.message) return;
    }
    const presentation = this.alertPresentation(alertConfig, event);
    const channels = await this.prisma.overlayChannel.findMany({
      where: { organizationId: event.organizationId, revokedAt: null },
      include: { widget: true },
    });
    const organizationWidgets = await this.prisma.widget.findMany({
      where: {
        organizationId: event.organizationId,
        enabled: true,
        deletedAt: null,
      },
    });
    for (const channel of channels) {
      if (channel.widget && !this.accepts(channel.widget, event)) continue;
      let delivery: { sequence: bigint } | null;
      try {
        delivery = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.overlayDelivery.findUnique({
            where: {
              overlayChannelId_eventId: {
                overlayChannelId: channel.id,
                eventId: event.eventId,
              },
            },
          });
          if (existing) return null;
          const reserved = await tx.overlayChannel.update({
            where: { id: channel.id },
            data: { nextSequence: { increment: 1 } },
            select: { nextSequence: true },
          });
          return tx.overlayDelivery.create({
            data: {
              overlayChannelId: channel.id,
              eventId: event.eventId,
              playbackAttemptId:
                typeof event.payload.playbackAttemptId === 'string'
                  ? event.payload.playbackAttemptId
                  : null,
              sequence: reserved.nextSequence - 1n,
              deliveredAt: new Date(),
            },
          });
        });
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          continue;
        throw error;
      }
      if (!delivery) continue;
      const compositeWidget = channel.widget
        ? null
        : organizationWidgets.find(
            (widget) =>
              [
                'ALERT',
                'VIDEO_PIX',
                'SONG_PIX',
                'SUBSCRIPTION',
                'CAMPAIGN',
              ].includes(widget.type) &&
              (this.accepts(widget, event) ||
                (event.eventType === 'live.queue.item.playing.v1' &&
                  widget.type ===
                    ({
                      SONG_PIX: 'SONG_PIX',
                      VIDEO_PIX: 'VIDEO_PIX',
                      SUBSCRIPTION: 'SUBSCRIPTION',
                      CAMPAIGN: 'CAMPAIGN',
                      TTS: 'ALERT',
                      ALERT: 'ALERT',
                    }[String(event.payload.kind)] ?? 'ALERT'))),
          );
      const isGenericAlert = this.accepts(
        {
          id: 'unified-alert',
          type: 'ALERT',
          enabled: true,
          deletedAt: null,
        },
        event,
      );
      if (!channel.widget && !compositeWidget && !isGenericAlert) continue;
      const presentationWidget = channel.widget ?? compositeWidget;
      const widgetPresentation = presentationWidget
        ? presentationWidget.type === 'ALERT'
          ? {
              ...presentation,
              widgetType: presentationWidget.type,
              config: presentationWidget.config,
            }
          : {
              widgetType: presentationWidget.type,
              config: presentationWidget.config,
            }
        : presentation
          ? { ...presentation, widgetType: 'ALERT' }
          : { widgetType: 'ALERT', config: {} };
      this.server.to(this.room(channel.id)).emit('streamos:event', {
        ...event,
        presentation: widgetPresentation,
        sequence: delivery.sequence.toString(),
      });
    }
  }

  private async replay(client: Socket, overlayChannelId: string) {
    const channel = await this.prisma.overlayChannel.findUnique({
      where: { id: overlayChannelId },
      include: { widget: true },
    });
    const alertConfig = channel
      ? await this.prisma.alertConfig.findUnique({
          where: { organizationId: channel.organizationId },
          include: {
            variations: {
              where: { enabled: true, deletedAt: null },
              include: { visualAsset: true, soundAsset: true },
            },
          },
        })
      : null;
    const deliveries = await this.prisma.overlayDelivery.findMany({
      where: { overlayChannelId, acknowledgedAt: null },
      orderBy: { sequence: 'asc' },
    });
    for (const delivery of deliveries) {
      const event = await this.prisma.outboxEvent.findUnique({
        where: { id: delivery.eventId },
      });
      if (!event) continue;
      const streamEvent: StreamEvent = {
        eventId: event.id,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        organizationId: event.organizationId ?? undefined,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId,
        causationId: event.causationId,
        occurredAt: event.occurredAt.toISOString(),
        payload: event.payload as Record<string, unknown>,
      };
      if (channel?.widget && !this.accepts(channel.widget, streamEvent))
        continue;
      client.emit('streamos:event', {
        ...streamEvent,
        presentation: channel?.widget
          ? channel.widget.type === 'ALERT'
            ? {
                ...this.alertPresentation(alertConfig, streamEvent),
                widgetType: channel.widget.type,
                config: channel.widget.config,
              }
            : { widgetType: channel.widget.type, config: channel.widget.config }
          : this.alertPresentation(alertConfig, streamEvent),
        sequence: delivery.sequence.toString(),
        replayed: true,
      });
      await this.prisma.overlayDelivery.update({
        where: { id: delivery.id },
        data: { deliveredAt: new Date() },
      });
    }
  }

  private room(channelId: string) {
    return `overlay:${channelId}`;
  }

  private adminRoom(organizationId: string) {
    return `admin:${organizationId}`;
  }

  private async connectAdmin(client: Socket) {
    const cookie = client.handshake.headers.cookie ?? '';
    const token = cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('streamos_session='))
      ?.slice('streamos_session='.length);
    if (!token) {
      client.emit('streamos:error', { code: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: createHash('sha256')
          .update(decodeURIComponent(token))
          .digest('hex'),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: { memberships: true } } },
    });
    const membership = session?.user.memberships[0];
    if (!membership) {
      client.emit('streamos:error', { code: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    const data = client.data as {
      organizationId?: string;
      userId?: string;
      role?: string;
      mode?: string;
    };
    data.organizationId = membership.organizationId;
    data.userId = membership.userId;
    data.role = membership.role;
    data.mode = 'admin';
    await client.join(this.adminRoom(membership.organizationId));
    client.emit('streamos:admin-ready', {
      organizationId: membership.organizationId,
      role: membership.role,
    });
    await this.sendPresence(client, membership.organizationId);
  }

  private async sendPresence(client: Socket, organizationId: string) {
    const channels = await this.prisma.overlayChannel.findMany({
      where: { organizationId, revokedAt: null },
      select: {
        id: true,
        widgetId: true,
        connectedAt: true,
        lastHeartbeatAt: true,
        disconnectedAt: true,
      },
    });
    client.emit('streamos:overlay-presence', {
      channels,
      online: channels.filter(
        (channel) =>
          channel.lastHeartbeatAt &&
          (!channel.disconnectedAt ||
            channel.lastHeartbeatAt > channel.disconnectedAt) &&
          Date.now() - channel.lastHeartbeatAt.getTime() < 45_000,
      ).length,
    });
  }
  private emitPresence(organizationId: string) {
    void this.prisma.overlayChannel
      .findMany({
        where: { organizationId, revokedAt: null },
        select: {
          id: true,
          widgetId: true,
          connectedAt: true,
          lastHeartbeatAt: true,
          disconnectedAt: true,
        },
      })
      .then((channels) =>
        this.server
          .to(this.adminRoom(organizationId))
          .emit('streamos:overlay-presence', {
            channels,
            online: channels.filter(
              (channel) =>
                channel.lastHeartbeatAt &&
                (!channel.disconnectedAt ||
                  channel.lastHeartbeatAt > channel.disconnectedAt) &&
                Date.now() - channel.lastHeartbeatAt.getTime() < 45_000,
            ).length,
          }),
      );
  }

  private alertPresentation(
    config: AlertPresentationConfig | null,
    event: StreamEvent,
  ) {
    if (!config) return undefined;
    const rawAmount = event.payload.amountInCents;
    const amount =
      typeof rawAmount === 'string' || typeof rawAmount === 'number'
        ? BigInt(rawAmount)
        : 0n;
    const target =
      typeof event.payload.targetVariationId === 'string'
        ? event.payload.targetVariationId
        : undefined;
    const candidates = [...config.variations].filter(
      (variation) => variation.enabled,
    );
    const targeted = target
      ? candidates.find((variation) => variation.id === target)
      : undefined;
    const selected =
      targeted ??
      candidates
        .filter(
          (variation) =>
            !variation.isDefault &&
            (variation.minimumInCents === null ||
              amount >= variation.minimumInCents) &&
            (variation.maximumInCents === null ||
              amount <= variation.maximumInCents),
        )
        .sort(
          (left, right) =>
            right.priority - left.priority ||
            Number(
              (right.minimumInCents ?? 0n) - (left.minimumInCents ?? 0n),
            ) ||
            left.createdAt.getTime() - right.createdAt.getTime() ||
            left.id.localeCompare(right.id),
        )[0] ??
      candidates
        .filter((variation) => variation.isDefault)
        .sort(
          (left, right) =>
            right.priority - left.priority || left.id.localeCompare(right.id),
        )[0];
    return {
      durationMs: selected?.maximumDurationMs ?? config.durationMs,
      theme: config.theme,
      variation: selected
        ? {
            id: selected.id,
            name: selected.name,
            template: selected.template,
            accent: selected.accent,
            textColor: selected.textColor,
            fontFamily: selected.fontFamily,
            fontSize: selected.fontSize,
            textAlign: selected.textAlign,
            layout: selected.layout,
            minimumDurationMs: selected.minimumDurationMs,
            maximumDurationMs: selected.maximumDurationMs,
            soundVolume: selected.soundVolume,
            ttsEnabled: selected.ttsEnabled,
            ttsVoice: selected.ttsVoice,
            ttsRate: selected.ttsRate,
            ttsVolume: selected.ttsVolume,
            showSupporter: selected.showSupporter,
            showAmount: selected.showAmount,
            showMessage: selected.showMessage,
            visualAsset: selected.visualAsset,
            soundAsset: selected.soundAsset,
          }
        : undefined,
    };
  }

  private accepts(
    widget: {
      id: string;
      type: string;
      enabled: boolean;
      deletedAt: Date | null;
    },
    event: StreamEvent,
  ) {
    return widgetAcceptsEvent(widget, event);
  }

  async onApplicationShutdown() {
    this.subscriber.disconnect();
    await this.prisma.$disconnect();
  }
}
