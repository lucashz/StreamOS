import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@streamos/database';
import Redis from 'ioredis';
import {
  createDecipheriv,
  createHash,
  createHmac,
  randomUUID,
} from 'node:crypto';
import {
  DEFAULT_ALERT_MAX_AGE_SECONDS,
  shouldExpireQueuedAlert,
} from './live-queue.policy';

@Injectable()
export class OutboxWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly eventStream = 'streamos:events:durable';
  private readonly deadLetterStream = 'streamos:events:dead-letter';
  private readonly consumerGroup = 'streamos:realtime-dispatch';
  private readonly consumerName = `worker-${process.pid}`;
  private readonly redis = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );
  private timer?: NodeJS.Timeout;
  private flushing = false;
  private readonly alertMaxAgeSeconds = Number(
    process.env.MAX_AUTOPLAY_ALERT_AGE_SECONDS ?? DEFAULT_ALERT_MAX_AGE_SECONDS,
  );

  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async onModuleInit() {
    await this.ensureConsumerGroup();
    this.timer = setInterval(() => {
      void this.runFlush();
    }, 500);
    void this.runFlush();
  }

  private async runFlush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      await this.flush();
    } catch (error: unknown) {
      this.logger.error(
        'Falha no ciclo do worker',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.flushing = false;
    }
  }

  private async flush() {
    const events = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { occurredAt: 'asc' },
      take: 50,
    });
    for (const event of events) {
      try {
        await this.materializeLiveQueueItem(event);
        const serialized = JSON.stringify({
          eventId: event.id,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          organizationId: event.organizationId,
          aggregateId: event.aggregateId,
          correlationId: event.correlationId,
          causationId: event.causationId,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
        });
        await this.redis.xadd(
          this.eventStream,
          'MAXLEN',
          '~',
          100_000,
          '*',
          'eventId',
          event.id,
          'body',
          serialized,
        );
        await this.prisma.outboxEvent.updateMany({
          where: { id: event.id, publishedAt: null },
          data: { publishedAt: new Date(), attempts: { increment: 1 } },
        });
        if (event.organizationId) {
          const endpoints = await this.prisma.webhookEndpoint.findMany({
            where: {
              organizationId: event.organizationId,
              enabled: true,
              events: { has: event.eventType },
            },
          });
          await Promise.all(
            endpoints.map((endpoint) =>
              this.prisma.webhookDelivery.upsert({
                where: {
                  endpointId_outboxEventId: {
                    endpointId: endpoint.id,
                    outboxEventId: event.id,
                  },
                },
                update: {},
                create: {
                  organizationId: event.organizationId!,
                  endpointId: endpoint.id,
                  outboxEventId: event.id,
                  eventType: event.eventType,
                },
              }),
            ),
          );
        }
      } catch (error: unknown) {
        this.logger.error(`Falha ao publicar evento ${event.id}`, error);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            lastError: error instanceof Error ? error.message : 'unknown',
          },
        });
      }
    }
    await this.recoverPendingStreamEntries();
    await this.dispatchStreamEntries();
    await this.recoverPlaybackAttempts();
    await this.recoverExpiredPlayback();
    await this.advanceUnifiedQueues();
    await this.deliverWebhooks();
  }

  private async recoverPlaybackAttempts() {
    const due = await this.prisma.playbackAttempt.findMany({
      where: {
        status: { in: ['DISPATCHED', 'RECEIVED'] },
        nextAttemptAt: { lte: new Date() },
      },
      include: { queueItem: true },
      orderBy: { nextAttemptAt: 'asc' },
      take: 100,
    });
    for (const attempt of due) {
      if (attempt.status === 'RECEIVED' || attempt.dispatchCount >= 4) {
        await this.prisma.$transaction(async (tx) => {
          const changed = await tx.playbackAttempt.updateMany({
            where: {
              id: attempt.id,
              status: attempt.status,
              nextAttemptAt: { lte: new Date() },
            },
            data: {
              status: 'NEEDS_REVIEW',
              nextAttemptAt: null,
              lastError:
                attempt.status === 'RECEIVED'
                  ? 'Overlay recebeu, mas não confirmou o início'
                  : 'Overlay não confirmou o recebimento',
            },
          });
          if (!changed.count) return;
          await tx.liveQueueItem.updateMany({
            where: { id: attempt.queueItemId, status: 'DISPATCHING' },
            data: {
              status: 'NEEDS_REVIEW',
              failureReason:
                attempt.status === 'RECEIVED'
                  ? 'Recebido pelo OBS sem confirmação de início'
                  : 'Entrega ao OBS sem confirmação',
            },
          });
        });
        continue;
      }
      if (!attempt.lastEventId) continue;
      const previous = await this.prisma.outboxEvent.findUnique({
        where: { id: attempt.lastEventId },
      });
      if (!previous) continue;
      const nextDispatchCount = attempt.dispatchCount + 1;
      const delaySeconds = [2, 5, 10, 30][nextDispatchCount - 1] ?? 30;
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.playbackAttempt.updateMany({
          where: {
            id: attempt.id,
            status: 'DISPATCHED',
            dispatchCount: attempt.dispatchCount,
            nextAttemptAt: { lte: new Date() },
          },
          data: {
            dispatchCount: nextDispatchCount,
            lastAttemptAt: new Date(),
            nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
          },
        });
        if (!claimed.count) return;
        const resent = await tx.outboxEvent.create({
          data: {
            organizationId: previous.organizationId,
            eventType: previous.eventType,
            eventVersion: previous.eventVersion,
            aggregateId: previous.aggregateId,
            correlationId: previous.correlationId,
            causationId: previous.id,
            payload: previous.payload as Prisma.InputJsonValue,
            occurredAt: new Date(),
          },
        });
        await tx.playbackAttempt.update({
          where: { id: attempt.id },
          data: { lastEventId: resent.id },
        });
      });
    }
  }

  private async recoverExpiredPlayback() {
    const expired = await this.prisma.liveQueueItem.findMany({
      where: {
        status: 'PLAYING',
        playbackDeadline: { lt: new Date() },
      },
      take: 100,
    });
    for (const item of expired) {
      await this.prisma.$transaction(async (tx) => {
        const recovered = await tx.liveQueueItem.updateMany({
          where: {
            id: item.id,
            status: 'PLAYING',
            playbackDeadline: { lt: new Date() },
          },
          data: {
            status: 'NEEDS_REVIEW',
            finishedAt: new Date(),
            playbackDeadline: null,
            failureReason: 'Reprodução iniciada sem confirmação de fim',
          },
        });
        if (!recovered.count) return;
        await tx.playbackAttempt.updateMany({
          where: { queueItemId: item.id, status: 'STARTED' },
          data: {
            status: 'NEEDS_REVIEW',
            nextAttemptAt: null,
            lastError: 'Reprodução iniciada sem confirmação de fim',
          },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: item.organizationId,
            eventType: 'live.queue.item.failed.v1',
            eventVersion: 1,
            aggregateId: item.sourceId,
            correlationId: randomUUID(),
            causationId: item.id,
            payload: {
              queueItemId: item.id,
              kind: item.kind,
              status: 'NEEDS_REVIEW',
              reason: 'PLAYBACK_TIMEOUT',
            },
            occurredAt: new Date(),
          },
        });
      });
    }
  }

  private async materializeLiveQueueItem(event: {
    id: string;
    organizationId: string | null;
    eventType: string;
    aggregateId: string;
    occurredAt: Date;
    payload: Prisma.JsonValue;
  }) {
    const accepted = [
      'payment.confirmed.v1',
      'song.requested.v1',
      'video.requested.v1',
      'subscription.created.v1',
      'campaign.contribution.confirmed.v1',
      'tts.queued.v1',
      'alert.test.v1',
      'alert.test.v2',
    ];
    if (!event.organizationId || !accepted.includes(event.eventType)) return;
    const payload = event.payload as Record<string, unknown>;
    const sourceId = event.eventType.startsWith('alert.test.')
      ? event.id
      : event.eventType === 'campaign.contribution.confirmed.v1' &&
          typeof payload.contributionId === 'string'
        ? payload.contributionId
        : event.aggregateId;
    if (
      event.eventType === 'payment.confirmed.v1' &&
      typeof payload.intentId === 'string'
    ) {
      const linkedMediaOrCampaign = await this.prisma.paymentIntent.findUnique({
        where: { id: payload.intentId },
        select: {
          songRequest: { select: { id: true } },
          videoRequest: { select: { id: true } },
          campaignContribution: { select: { id: true } },
        },
      });
      if (
        linkedMediaOrCampaign?.songRequest ||
        linkedMediaOrCampaign?.videoRequest ||
        linkedMediaOrCampaign?.campaignContribution
      )
        return;
    }
    const kind = event.eventType.startsWith('song.')
      ? 'SONG_PIX'
      : event.eventType.startsWith('video.')
        ? 'VIDEO_PIX'
        : event.eventType.startsWith('subscription.')
          ? 'SUBSCRIPTION'
          : event.eventType.startsWith('campaign.')
            ? 'CAMPAIGN'
            : event.eventType.startsWith('tts.')
              ? 'TTS'
              : event.eventType === 'payment.confirmed.v1' &&
                  payload.alertType === 'AUDIO'
                ? 'AUDIO'
                : 'ALERT';
    const expired = shouldExpireQueuedAlert(
      event.eventType,
      event.occurredAt,
      new Date(),
      this.alertMaxAgeSeconds,
    );
    const last = await this.prisma.liveQueueItem.aggregate({
      where: { organizationId: event.organizationId },
      _max: { position: true },
    });
    const activeSession = await this.prisma.liveSession.findFirst({
      where: { organizationId: event.organizationId, status: 'ACTIVE' },
      select: { id: true },
    });
    const sequence = await this.prisma.organization.update({
      where: { id: event.organizationId },
      data: { nextLiveQueueSequence: { increment: 1 } },
      select: { nextLiveQueueSequence: true },
    });
    await this.prisma.liveQueueItem.upsert({
      where: {
        organizationId_sourceType_sourceId: {
          organizationId: event.organizationId,
          sourceType: event.eventType,
          sourceId,
        },
      },
      update: {},
      create: {
        organizationId: event.organizationId,
        liveSessionId: activeSession?.id,
        sourceType: event.eventType,
        sourceId,
        paymentId:
          event.eventType === 'payment.confirmed.v1' ? event.aggregateId : null,
        sequenceNumber: sequence.nextLiveQueueSequence - 1n,
        kind,
        position: (last._max.position ?? 0) + 1,
        supporterName:
          typeof payload.supporterName === 'string'
            ? payload.supporterName
            : null,
        title:
          typeof payload.title === 'string'
            ? payload.title
            : kind === 'ALERT'
              ? 'Nova contribuição'
              : kind,
        content:
          typeof payload.message === 'string'
            ? payload.message
            : typeof payload.text === 'string'
              ? payload.text
              : null,
        amountInCents:
          typeof payload.amountInCents === 'string' ||
          typeof payload.amountInCents === 'number'
            ? BigInt(payload.amountInCents)
            : null,
        metadata: payload as Prisma.InputJsonValue,
        moderationStatus: 'AUTOMATICALLY_ALLOWED',
        status: expired ? 'EXPIRED' : 'QUEUED',
        finishedAt: expired ? new Date() : null,
        failureReason: expired ? 'Alerta expirado antes da reprodução' : null,
        createdAt: event.occurredAt,
      },
    });
  }

  private async advanceUnifiedQueues() {
    const now = new Date();
    await this.prisma.liveQueueItem.updateMany({
      where: {
        status: 'QUEUED',
        sourceType: { startsWith: 'alert.test.' },
        createdAt: {
          lt: new Date(now.getTime() - this.alertMaxAgeSeconds * 1_000),
        },
      },
      data: {
        status: 'EXPIRED',
        finishedAt: now,
        failureReason: 'Alerta expirado antes da reprodução',
      },
    });
    const candidates = await this.prisma.liveQueueItem.findMany({
      where: {
        status: 'QUEUED',
        organization: {
          overlayChannels: {
            some: {
              widgetId: null,
              revokedAt: null,
              synchronizedAt: { not: null },
              lastHeartbeatAt: { gte: new Date(now.getTime() - 45_000) },
            },
          },
        },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });
    const visited = new Set<string>();
    for (const candidate of candidates) {
      if (visited.has(candidate.organizationId)) continue;
      visited.add(candidate.organizationId);
      const lockKey = `streamos:live-queue-lock:${candidate.organizationId}`;
      const lockToken = randomUUID();
      const acquired = await this.redis.set(
        lockKey,
        lockToken,
        'PX',
        5_000,
        'NX',
      );
      if (!acquired) continue;
      try {
        const [overlay, state, active] = await Promise.all([
          this.prisma.overlayChannel.findFirst({
            where: {
              organizationId: candidate.organizationId,
              widgetId: null,
              revokedAt: null,
              synchronizedAt: { not: null },
              lastHeartbeatAt: { gte: new Date(Date.now() - 45_000) },
            },
          }),
          this.prisma.liveQueueState.findUnique({
            where: { organizationId: candidate.organizationId },
          }),
          this.prisma.liveQueueItem.count({
            where: {
              organizationId: candidate.organizationId,
              status: { in: ['DISPATCHING', 'PLAYING'] },
            },
          }),
        ]);
        if (!overlay || state?.paused || state?.autoAdvance === false || active)
          continue;

        if (candidate.kind === 'SONG_PIX') {
          const request = await this.prisma.songRequest.findFirst({
            where: {
              id: candidate.sourceId,
              session: { organizationId: candidate.organizationId },
            },
            include: { session: true },
          });
          if (request) {
            await this.startMediaCandidate({
              type: 'SONG_PIX',
              organizationId: candidate.organizationId,
              queueItem: candidate,
              request,
            });
            continue;
          }
        }
        if (candidate.kind === 'VIDEO_PIX') {
          const request = await this.prisma.videoRequest.findFirst({
            where: {
              id: candidate.sourceId,
              session: { organizationId: candidate.organizationId },
            },
            include: { session: true },
          });
          if (request) {
            await this.startMediaCandidate({
              type: 'VIDEO_PIX',
              organizationId: candidate.organizationId,
              queueItem: candidate,
              request,
            });
            continue;
          }
        }

        const playbackAttemptId = randomUUID();
        const dispatched = await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.liveQueueItem.updateMany({
            where: { id: candidate.id, status: 'QUEUED' },
            data: {
              status: 'DISPATCHING',
              startedAt: null,
              playbackDeadline: null,
            },
          });
          if (!claimed.count) return false;
          const previousAttempt = await tx.playbackAttempt.aggregate({
            where: { queueItemId: candidate.id },
            _max: { attemptNumber: true },
          });
          const event = await tx.outboxEvent.create({
            data: {
              organizationId: candidate.organizationId,
              eventType: 'live.queue.item.playing.v1',
              eventVersion: 1,
              aggregateId: candidate.sourceId,
              correlationId: randomUUID(),
              causationId: candidate.id,
              payload: {
                ...(candidate.metadata as Prisma.JsonObject),
                alertId: candidate.id,
                paymentId: candidate.paymentId,
                playbackAttemptId,
                sequenceNumber: candidate.sequenceNumber.toString(),
                queueItemId: candidate.id,
                kind: candidate.kind,
                title: candidate.title,
                content: candidate.content,
                supporterName: candidate.supporterName,
                expectedDurationMs:
                  candidate.kind === 'AUDIO'
                    ? Number(
                        (candidate.metadata as Prisma.JsonObject)
                          .audioDurationSeconds ?? 0,
                      ) * 1000
                    : Number(
                        (candidate.metadata as Prisma.JsonObject).durationMs ??
                          8000,
                      ),
              },
              occurredAt: new Date(),
            },
          });
          await tx.playbackAttempt.create({
            data: {
              id: playbackAttemptId,
              organizationId: candidate.organizationId,
              queueItemId: candidate.id,
              sequenceNumber: candidate.sequenceNumber,
              status: 'DISPATCHED',
              attemptNumber: (previousAttempt._max.attemptNumber ?? 0) + 1,
              dispatchedAt: new Date(),
              lastAttemptAt: new Date(),
              nextAttemptAt: new Date(Date.now() + 2_000),
              lastEventId: event.id,
            },
          });
          return true;
        });
        if (!dispatched) continue;
      } finally {
        await this.redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          lockToken,
        );
      }
    }
  }

  private async startMediaCandidate(
    candidate:
      | {
          type: 'SONG_PIX';
          organizationId: string;
          queueItem: {
            id: string;
            sequenceNumber: bigint;
            paymentId: string | null;
          };
          request: Prisma.SongRequestGetPayload<{ include: { session: true } }>;
        }
      | {
          type: 'VIDEO_PIX';
          organizationId: string;
          queueItem: {
            id: string;
            sequenceNumber: bigint;
            paymentId: string | null;
          };
          request: Prisma.VideoRequestGetPayload<{
            include: { session: true };
          }>;
        },
  ) {
    await this.prisma.$transaction(async (tx) => {
      const payment = candidate.request.paymentIntentId
        ? await tx.payment.findUnique({
            where: { paymentIntentId: candidate.request.paymentIntentId },
            select: { id: true },
          })
        : null;
      const playbackAttemptId = randomUUID();
      if (candidate.type === 'SONG_PIX') {
        const claimed = await tx.songRequest.updateMany({
          where: { id: candidate.request.id, status: 'QUEUED' },
          data: { status: 'DISPATCHING' },
        });
        if (!claimed.count) return;
        const queueClaimed = await tx.liveQueueItem.updateMany({
          where: {
            organizationId: candidate.organizationId,
            sourceId: candidate.request.id,
            status: 'QUEUED',
          },
          data: {
            paymentId: payment?.id,
            status: 'DISPATCHING',
            startedAt: null,
            playbackDeadline: null,
          },
        });
        if (!queueClaimed.count) return;
        const previousAttempt = await tx.playbackAttempt.aggregate({
          where: { queueItemId: candidate.queueItem.id },
          _max: { attemptNumber: true },
        });
        await tx.playbackAttempt.create({
          data: {
            id: playbackAttemptId,
            organizationId: candidate.organizationId,
            queueItemId: candidate.queueItem.id,
            sequenceNumber: candidate.queueItem.sequenceNumber,
            status: 'DISPATCHED',
            attemptNumber: (previousAttempt._max.attemptNumber ?? 0) + 1,
            dispatchedAt: new Date(),
            lastAttemptAt: new Date(),
            nextAttemptAt: new Date(Date.now() + 2_000),
          },
        });
        const event = await tx.outboxEvent.create({
          data: {
            organizationId: candidate.organizationId,
            eventType: 'song.started.v1',
            eventVersion: 1,
            aggregateId: candidate.request.id,
            correlationId: randomUUID(),
            payload: {
              alertId: candidate.queueItem.id,
              paymentId: payment?.id,
              playbackAttemptId,
              sequenceNumber: candidate.queueItem.sequenceNumber.toString(),
              queueItemId: candidate.queueItem.id,
              requestId: candidate.request.id,
              title: candidate.request.title,
              artist: candidate.request.artist,
              supporterName: candidate.request.supporterName,
              durationSeconds: candidate.request.durationSeconds,
              provider: candidate.request.provider,
              artworkUrl: candidate.request.artworkUrl,
              playbackUrl: candidate.request.playbackUrl,
              status: 'PLAYING',
              expectedDurationMs: candidate.request.durationSeconds * 1000,
            },
            occurredAt: new Date(),
          },
        });
        await tx.playbackAttempt.update({
          where: { id: playbackAttemptId },
          data: { lastEventId: event.id },
        });
      } else {
        const claimed = await tx.videoRequest.updateMany({
          where: { id: candidate.request.id, status: 'QUEUED' },
          data: { status: 'DISPATCHING' },
        });
        if (!claimed.count) return;
        const queueClaimed = await tx.liveQueueItem.updateMany({
          where: {
            organizationId: candidate.organizationId,
            sourceId: candidate.request.id,
            status: 'QUEUED',
          },
          data: {
            paymentId: payment?.id,
            status: 'DISPATCHING',
            startedAt: null,
            playbackDeadline: null,
          },
        });
        if (!queueClaimed.count) return;
        const previousAttempt = await tx.playbackAttempt.aggregate({
          where: { queueItemId: candidate.queueItem.id },
          _max: { attemptNumber: true },
        });
        await tx.playbackAttempt.create({
          data: {
            id: playbackAttemptId,
            organizationId: candidate.organizationId,
            queueItemId: candidate.queueItem.id,
            sequenceNumber: candidate.queueItem.sequenceNumber,
            status: 'DISPATCHED',
            attemptNumber: (previousAttempt._max.attemptNumber ?? 0) + 1,
            dispatchedAt: new Date(),
            lastAttemptAt: new Date(),
            nextAttemptAt: new Date(Date.now() + 2_000),
          },
        });
        const event = await tx.outboxEvent.create({
          data: {
            organizationId: candidate.organizationId,
            eventType: 'video.started.v1',
            eventVersion: 1,
            aggregateId: candidate.request.id,
            correlationId: randomUUID(),
            payload: {
              alertId: candidate.queueItem.id,
              paymentId: payment?.id,
              playbackAttemptId,
              sequenceNumber: candidate.queueItem.sequenceNumber.toString(),
              queueItemId: candidate.queueItem.id,
              requestId: candidate.request.id,
              title: candidate.request.title,
              channelTitle: candidate.request.channelTitle,
              externalId: candidate.request.externalId,
              provider: candidate.request.provider,
              startAtSeconds: candidate.request.startAtSeconds,
              selectedSeconds: candidate.request.selectedSeconds,
              supporterName: candidate.request.supporterName,
              status: 'PLAYING',
              expectedDurationMs: candidate.request.selectedSeconds * 1000,
            },
            occurredAt: new Date(),
          },
        });
        await tx.playbackAttempt.update({
          where: { id: playbackAttemptId },
          data: { lastEventId: event.id },
        });
      }
    });
  }

  private async ensureConsumerGroup() {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.eventStream,
        this.consumerGroup,
        '0',
        'MKSTREAM',
      );
    } catch (error: unknown) {
      if (!(error instanceof Error) || !error.message.includes('BUSYGROUP'))
        throw error;
    }
  }

  private async recoverPendingStreamEntries() {
    const result = await this.redis.call(
      'XAUTOCLAIM',
      this.eventStream,
      this.consumerGroup,
      this.consumerName,
      '30000',
      '0-0',
      'COUNT',
      '25',
    );
    if (!Array.isArray(result) || !Array.isArray(result[1])) return;
    await this.dispatchEntries(result[1] as Array<[string, string[]]>);
  }

  private async dispatchStreamEntries() {
    const result = (await this.redis.xreadgroup(
      'GROUP',
      this.consumerGroup,
      this.consumerName,
      'COUNT',
      50,
      'STREAMS',
      this.eventStream,
      '>',
    )) as unknown;
    if (!Array.isArray(result)) return;
    for (const stream of result as Array<[string, Array<[string, string[]]>]>)
      await this.dispatchEntries(stream[1]);
  }

  private async dispatchEntries(entries: Array<[string, string[]]>) {
    for (const [streamId, fields] of entries) {
      const bodyIndex = fields.indexOf('body');
      const eventIndex = fields.indexOf('eventId');
      const body = bodyIndex >= 0 ? fields[bodyIndex + 1] : undefined;
      const eventId =
        (eventIndex >= 0 ? fields[eventIndex + 1] : undefined) ?? streamId;
      if (!body) {
        await this.deadLetter(streamId, eventId, '', 'Mensagem sem corpo');
        continue;
      }
      try {
        JSON.parse(body);
        await this.redis.publish('streamos:events', body);
        await this.redis.xack(this.eventStream, this.consumerGroup, streamId);
        await this.redis.hdel('streamos:event-delivery-attempts', streamId);
      } catch (error: unknown) {
        const attempts = await this.redis.hincrby(
          'streamos:event-delivery-attempts',
          streamId,
          1,
        );
        if (attempts >= 5)
          await this.deadLetter(
            streamId,
            eventId,
            body,
            error instanceof Error ? error.message : 'unknown',
          );
      }
    }
  }

  private async deadLetter(
    streamId: string,
    eventId: string,
    body: string,
    reason: string,
  ) {
    await this.redis.xadd(
      this.deadLetterStream,
      'MAXLEN',
      '~',
      10_000,
      '*',
      'sourceId',
      streamId,
      'eventId',
      eventId,
      'body',
      body,
      'reason',
      reason.slice(0, 500),
      'failedAt',
      new Date().toISOString(),
    );
    await this.redis.xack(this.eventStream, this.consumerGroup, streamId);
    await this.redis.hdel('streamos:event-delivery-attempts', streamId);
  }

  private async deliverWebhooks() {
    await this.prisma.webhookDelivery.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: new Date(Date.now() - 60_000) },
      },
      data: {
        status: 'RETRYING',
        nextAttemptAt: new Date(),
        lastError: 'Entrega recuperada após interrupção do worker',
      },
    });
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: {
        status: { in: ['PENDING', 'RETRYING'] },
        nextAttemptAt: { lte: new Date() },
      },
      include: { endpoint: true },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });
    await Promise.all(
      deliveries.map(async (delivery) => {
        const claimed = await this.prisma.webhookDelivery.updateMany({
          where: {
            id: delivery.id,
            status: { in: ['PENDING', 'RETRYING'] },
            nextAttemptAt: { lte: new Date() },
          },
          data: { status: 'PROCESSING' },
        });
        if (claimed.count !== 1) return;
        const event = await this.prisma.outboxEvent.findUnique({
          where: { id: delivery.outboxEventId },
        });
        if (!event || !delivery.endpoint.enabled) {
          await this.prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'FAILED',
              lastError: event
                ? 'Endpoint desativado antes da entrega'
                : 'Evento da outbox não encontrado',
            },
          });
          return;
        }
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const webhookBody = {
          id: event.id,
          type: event.eventType,
          version: event.eventVersion,
          occurredAt: event.occurredAt.toISOString(),
          organizationId: event.organizationId,
          data: event.payload,
        } satisfies Prisma.InputJsonObject;
        const body = JSON.stringify(webhookBody);
        try {
          const secret = this.decrypt(delivery.endpoint.secretCiphertext);
          const signature = createHmac('sha256', secret)
            .update(`${timestamp}.${body}`)
            .digest('hex');
          const response = await fetch(delivery.endpoint.url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'user-agent': 'StreamOS-Webhooks/1.0',
              'x-streamos-event': event.eventType,
              'x-streamos-delivery': delivery.id,
              'x-streamos-timestamp': timestamp,
              'x-streamos-signature': `sha256=${signature}`,
            },
            body,
            signal: AbortSignal.timeout(8000),
          });
          const responseText = (await response.text()).slice(0, 1000);
          if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${responseText}`);
          await this.prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'DELIVERED',
              attempts: { increment: 1 },
              responseStatus: response.status,
              deliveredAt: new Date(),
              lastError: null,
              requestBody: webhookBody,
              responseBody: responseText,
            },
          });
        } catch (error: unknown) {
          const attempts = delivery.attempts + 1;
          await this.prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: attempts >= 5 ? 'FAILED' : 'RETRYING',
              attempts,
              nextAttemptAt: new Date(
                Date.now() + Math.min(60_000, 1000 * 2 ** attempts),
              ),
              lastError: (error instanceof Error
                ? error.message
                : 'unknown'
              ).slice(0, 500),
              requestBody: webhookBody,
            },
          });
          if (attempts >= 5) {
            const failures = await this.prisma.webhookDelivery.count({
              where: {
                endpointId: delivery.endpointId,
                status: 'FAILED',
                createdAt: { gte: new Date(Date.now() - 86_400_000) },
              },
            });
            if (failures >= 3)
              await this.prisma.webhookEndpoint.update({
                where: { id: delivery.endpointId },
                data: { enabled: false },
              });
          }
        }
      }),
    );
  }

  private decrypt(value: string) {
    const [iv, tag, encrypted] = value.split('.');
    if (!iv || !tag || !encrypted)
      throw new Error('Webhook secret unavailable');
    const key = createHash('sha256')
      .update(
        process.env.APP_ENCRYPTION_KEY ??
          'streamos-local-development-encryption-key',
      )
      .digest();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.prisma.$disconnect();
    this.redis.disconnect();
  }
}
