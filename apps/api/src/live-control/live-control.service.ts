/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@streamos/database';
import { randomUUID } from 'node:crypto';
import {
  canOperateLiveQueue,
  canTransitionLiveQueue,
  LIVE_QUEUE_MODES,
  prioritizedQueue,
  TERMINAL_LIVE_STATUSES,
} from './live-control.policy';

const TERMINAL: readonly string[] = TERMINAL_LIVE_STATUSES;

type Actor = {
  organizationId: string;
  userId: string;
  role: string;
};

type Command = {
  action: string;
  itemId?: string;
  reason?: string;
  idempotencyKey: string;
  origin?: string;
  position?: number;
  value?: boolean;
  volume?: number;
  name?: string;
  mode?: string;
};

type HistoryQuery = {
  page?: string;
  limit?: string;
  sessionId?: string;
  status?: string;
  kind?: string;
  minAmount?: string;
  q?: string;
};

@Injectable()
export class LiveControlService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async snapshot(actor: Actor) {
    await this.recoverTimeout(actor.organizationId);
    const state = await this.ensureQueueState(actor.organizationId);
    const [
      activeItems,
      recentItems,
      history,
      activeSession,
      sessions,
      completedCount,
    ] = await Promise.all([
      this.prisma.liveQueueItem.findMany({
        where: {
          organizationId: actor.organizationId,
          status: { in: ['QUEUED', 'DISPATCHING', 'PLAYING'] },
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        take: 200,
      }),
      this.prisma.liveQueueItem.findMany({
        where: {
          organizationId: actor.organizationId,
          status: {
            in: ['COMPLETED', 'MEDIA_FAILED', 'SKIPPED', 'FAILED', 'EXPIRED'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.liveQueueAction.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.liveSession.findFirst({
        where: { organizationId: actor.organizationId, status: 'ACTIVE' },
      }),
      this.prisma.liveSession.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { startedAt: 'desc' },
        take: 20,
        include: { _count: { select: { queueItems: true } } },
      }),
      this.prisma.liveQueueItem.count({
        where: {
          organizationId: actor.organizationId,
          status: { in: [...TERMINAL] as any },
        },
      }),
    ]);
    const activeNow = activeItems.filter((item) => item.status !== 'QUEUED');
    const queued = prioritizedQueue(
      activeItems.filter((item) => item.status === 'QUEUED'),
      state.queueMode as (typeof LIVE_QUEUE_MODES)[number],
      completedCount,
      recentItems
        .slice(0, 3)
        .reverse()
        .map((item) => ({
          kind: item.kind,
          supporterName: item.supporterName,
        })),
    );
    return this.serialize({
      state,
      items: [...activeNow, ...queued, ...recentItems],
      history,
      activeSession,
      sessions,
      role: actor.role,
    });
  }

  private async ensureQueueState(organizationId: string) {
    const existing = await this.prisma.liveQueueState.findUnique({
      where: { organizationId },
    });
    if (existing) return existing;
    try {
      return await this.prisma.liveQueueState.create({
        data: { organizationId },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        return this.prisma.liveQueueState.findUniqueOrThrow({
          where: { organizationId },
        });
      throw error;
    }
  }

  async history(actor: Actor, query: HistoryQuery) {
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(query.limit ?? '50', 10) || 50),
    );
    const where = this.historyWhere(actor.organizationId, query);
    const [items, total] = await Promise.all([
      this.prisma.liveQueueItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.liveQueueItem.count({ where }),
    ]);
    return this.serialize({
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  }

  async historyCsv(actor: Actor, query: HistoryQuery) {
    const items = await this.prisma.liveQueueItem.findMany({
      where: this.historyWhere(actor.organizationId, query),
      orderBy: { createdAt: 'desc' },
      take: 5_000,
    });
    const rows = [
      ['data', 'apoiador', 'tipo', 'titulo', 'conteudo', 'valor', 'status'],
      ...items.map((item) => [
        item.createdAt.toISOString(),
        item.supporterName ?? '',
        item.kind,
        item.title ?? '',
        item.content ?? '',
        (Number(item.amountInCents ?? 0) / 100).toFixed(2),
        item.status,
      ]),
    ];
    return rows
      .map((row) => row.map((value) => this.csvCell(value)).join(';'))
      .join('\r\n');
  }

  private historyWhere(organizationId: string, query: HistoryQuery) {
    const terminalStatuses = [
      'COMPLETED',
      'MEDIA_FAILED',
      'SKIPPED',
      'FAILED',
      'EXPIRED',
    ];
    const status = terminalStatuses.includes(query.status ?? '')
      ? query.status
      : undefined;
    const term = query.q?.trim().slice(0, 120);
    const minimumInCents = Math.max(
      0,
      Math.round((Number.parseFloat(query.minAmount ?? '') || 0) * 100),
    );
    return {
      organizationId,
      status: status ? (status as any) : { in: terminalStatuses as any },
      ...(query.sessionId && query.sessionId !== 'ALL'
        ? { liveSessionId: query.sessionId }
        : {}),
      ...(query.kind && query.kind !== 'ALL' ? { kind: query.kind } : {}),
      ...(minimumInCents > 0
        ? { amountInCents: { gte: BigInt(minimumInCents) } }
        : {}),
      ...(term
        ? {
            OR: [
              {
                supporterName: { contains: term, mode: 'insensitive' as const },
              },
              { title: { contains: term, mode: 'insensitive' as const } },
              { content: { contains: term, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  private csvCell(value: unknown) {
    let text =
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint' ||
      typeof value === 'boolean'
        ? String(value)
        : '';
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  async command(actor: Actor, input: Command) {
    if (!canOperateLiveQueue(actor.role))
      throw new ForbiddenException(
        'Seu papel permite apenas acompanhar a fila',
      );
    if (!input.idempotencyKey?.trim() || input.idempotencyKey.length > 120)
      throw new BadRequestException('Chave de idempotência inválida');
    const existing = await this.prisma.liveQueueAction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.organizationId !== actor.organizationId)
        throw new ForbiddenException();
      return this.snapshot(actor);
    }
    await this.prisma.$transaction(
      async (tx) => {
        await tx.liveQueueState.upsert({
          where: { organizationId: actor.organizationId },
          update: {},
          create: { organizationId: actor.organizationId },
        });
        if (input.action === 'START_LIVE') {
          const active = await tx.liveSession.findFirst({
            where: { organizationId: actor.organizationId, status: 'ACTIVE' },
          });
          if (active) throw new BadRequestException('Já existe uma live ativa');
          const session = await tx.liveSession.create({
            data: {
              organizationId: actor.organizationId,
              name:
                input.name?.trim().slice(0, 80) ||
                `Live ${new Date().toLocaleDateString('pt-BR')}`,
            },
          });
          await tx.liveQueueItem.updateMany({
            where: {
              organizationId: actor.organizationId,
              liveSessionId: null,
              status: { in: ['QUEUED', 'DISPATCHING', 'PLAYING'] },
            },
            data: { liveSessionId: session.id },
          });
          await this.record(tx, actor, input, null, null, null, {
            liveSessionId: session.id,
          });
          return;
        }
        if (input.action === 'END_LIVE') {
          const active = await tx.liveSession.findFirst({
            where: { organizationId: actor.organizationId, status: 'ACTIVE' },
          });
          if (!active) throw new BadRequestException('Nenhuma live ativa');
          await tx.liveSession.update({
            where: { id: active.id },
            data: { status: 'ENDED', endedAt: new Date() },
          });
          await this.record(tx, actor, input, null, null, null, {
            liveSessionId: active.id,
          });
          return;
        }
        if (
          [
            'PAUSE_QUEUE',
            'RESUME_QUEUE',
            'SET_AUTO_ADVANCE',
            'SET_MASTER_VOLUME',
            'SET_QUEUE_MODE',
          ].includes(input.action)
        ) {
          await this.stateCommand(tx, actor, input);
          return;
        }
        if (input.action === 'CLEAR_PENDING') {
          const pending = await tx.liveQueueItem.findMany({
            where: {
              organizationId: actor.organizationId,
              status: {
                in: ['QUEUED', 'DISPATCHING'],
              },
            },
          });
          for (const item of pending) {
            await this.synchronizeSourceStatus(tx, item, 'SKIPPED');
            await this.event(
              tx,
              actor.organizationId,
              'live.queue.item.skipped.v1',
              item.id,
              { queueItemId: item.id, kind: item.kind, status: 'SKIPPED' },
            );
          }
          await tx.liveQueueItem.updateMany({
            where: { id: { in: pending.map((item) => item.id) } },
            data: { status: 'SKIPPED', finishedAt: new Date() },
          });
          await this.record(tx, actor, input, null, null, null, {
            affected: pending.length,
          });
          return;
        }
        if (input.action === 'PLAY_NEXT') {
          const current = await tx.liveQueueItem.findFirst({
            where: { organizationId: actor.organizationId, status: 'PLAYING' },
          });
          if (current) return;
          const next = await this.nextQueuedItem(tx, actor.organizationId);
          if (!next) return;
          await this.transition(tx, actor, input, next.id, 'PLAYING');
          return;
        }
        if (!input.itemId) throw new BadRequestException('Item obrigatório');
        if (input.action === 'FLAG' || input.action === 'UNFLAG') {
          const item = await this.owned(tx, actor.organizationId, input.itemId);
          const moderationStatus =
            input.action === 'FLAG' ? 'FLAGGED' : 'AUTOMATICALLY_ALLOWED';
          await tx.liveQueueItem.update({
            where: { id: item.id },
            data: { moderationStatus },
          });
          await this.record(tx, actor, input, item, item.status, item.status, {
            moderationStatus,
          });
          return;
        }
        if (input.action === 'MOVE') {
          if (!Number.isInteger(input.position) || (input.position ?? 0) < 1)
            throw new BadRequestException('Posição inválida');
          const item = await this.owned(tx, actor.organizationId, input.itemId);
          if (TERMINAL.includes(item.status) || item.status === 'PLAYING')
            throw new BadRequestException('Este item não pode ser reordenado');
          const pending = await tx.liveQueueItem.findMany({
            where: {
              organizationId: actor.organizationId,
              status: { in: ['QUEUED', 'DISPATCHING'] },
            },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          });
          const reordered = pending.filter((entry) => entry.id !== item.id);
          const targetIndex = Math.min(
            Math.max((input.position ?? 1) - 1, 0),
            reordered.length,
          );
          reordered.splice(targetIndex, 0, item);
          await Promise.all(
            reordered.map((entry, index) =>
              tx.liveQueueItem.update({
                where: { id: entry.id },
                data: {
                  position: index + 1,
                  metadata: this.queueMetadata(
                    entry.metadata,
                    entry.id === item.id ? input.position : undefined,
                  ),
                },
              }),
            ),
          );
          await this.record(tx, actor, input, item, item.status, item.status, {
            position: input.position,
          });
          return;
        }
        if (input.action === 'REPLAY') {
          const replayItem = await this.owned(
            tx,
            actor.organizationId,
            input.itemId,
          );
          const state = await tx.liveQueueState.findUniqueOrThrow({
            where: { organizationId: actor.organizationId },
          });
          if (TERMINAL.includes(replayItem.status) && state.paused)
            await this.stateCommand(tx, actor, {
              ...input,
              action: 'RESUME_QUEUE',
              itemId: undefined,
              idempotencyKey: `${input.idempotencyKey}:history-resume`,
            });
        }
        const target = this.targetStatus(input.action);
        await this.transition(tx, actor, input, input.itemId, target);
        if (input.action === 'BLOCK')
          await tx.liveQueueItem.update({
            where: { id: input.itemId },
            data: { moderationStatus: 'BLOCKED' },
          });
        if (TERMINAL.includes(target)) {
          const state = await tx.liveQueueState.findUniqueOrThrow({
            where: { organizationId: actor.organizationId },
          });
          const advanceAfterCompletion =
            input.action === 'COMPLETE_AND_NEXT' || state.autoAdvance;
          if (advanceAfterCompletion && !state.paused) {
            const next = await this.nextQueuedItem(tx, actor.organizationId);
            if (next)
              await this.transition(
                tx,
                actor,
                {
                  ...input,
                  action: 'AUTO_ADVANCE',
                  itemId: next.id,
                  idempotencyKey: `${input.idempotencyKey}:auto`,
                  origin: 'AUTOMATION',
                },
                next.id,
                'PLAYING',
              );
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.snapshot(actor);
  }

  private async stateCommand(
    tx: Prisma.TransactionClient,
    actor: Actor,
    input: Command,
  ) {
    if (
      input.action === 'SET_MASTER_VOLUME' &&
      (!Number.isInteger(input.volume) ||
        (input.volume ?? -1) < 0 ||
        (input.volume ?? 101) > 100)
    )
      throw new BadRequestException('Volume deve estar entre 0 e 100');
    if (
      input.action === 'SET_QUEUE_MODE' &&
      !LIVE_QUEUE_MODES.includes(
        input.mode as (typeof LIVE_QUEUE_MODES)[number],
      )
    )
      throw new BadRequestException('Modo de fila inválido');
    const paused =
      input.action === 'PAUSE_QUEUE'
        ? true
        : input.action === 'RESUME_QUEUE'
          ? false
          : undefined;
    const currentState = await tx.liveQueueState.findUniqueOrThrow({
      where: { organizationId: actor.organizationId },
    });
    if (input.action === 'RESUME_QUEUE' && currentState.paused) {
      const now = new Date();
      const pausedForMs = Math.max(
        0,
        now.getTime() - currentState.updatedAt.getTime(),
      );
      const playing = await tx.liveQueueItem.findFirst({
        where: { organizationId: actor.organizationId, status: 'PLAYING' },
      });
      if (playing)
        await tx.liveQueueItem.update({
          where: { id: playing.id },
          data: {
            startedAt: playing.startedAt
              ? new Date(playing.startedAt.getTime() + pausedForMs)
              : playing.startedAt,
            playbackDeadline: playing.playbackDeadline
              ? new Date(playing.playbackDeadline.getTime() + pausedForMs)
              : playing.playbackDeadline,
          },
        });
    }
    await tx.liveQueueState.update({
      where: { organizationId: actor.organizationId },
      data: {
        ...(paused === undefined ? {} : { paused }),
        ...(input.action === 'SET_AUTO_ADVANCE'
          ? { autoAdvance: Boolean(input.value) }
          : {}),
        ...(input.action === 'SET_MASTER_VOLUME'
          ? { masterVolume: input.volume }
          : {}),
        ...(input.action === 'SET_QUEUE_MODE' ? { queueMode: input.mode } : {}),
        version: { increment: 1 },
      },
    });
    await this.record(tx, actor, input, null, null, null);
    await this.event(
      tx,
      actor.organizationId,
      'live.queue.state.changed.v1',
      actor.organizationId,
      {
        action: input.action,
        paused,
        autoAdvance: input.value,
        masterVolume: input.volume,
        queueMode: input.mode,
      },
    );
  }

  private async nextQueuedItem(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ) {
    const [state, queued, completedCount, recent] = await Promise.all([
      tx.liveQueueState.findUniqueOrThrow({ where: { organizationId } }),
      tx.liveQueueItem.findMany({
        where: { organizationId, status: 'QUEUED' },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        take: 1000,
      }),
      tx.liveQueueItem.count({
        where: {
          organizationId,
          status: { in: [...TERMINAL] as any },
        },
      }),
      tx.liveQueueItem.findMany({
        where: {
          organizationId,
          status: { in: [...TERMINAL] as any },
        },
        orderBy: { finishedAt: 'desc' },
        take: 3,
        select: { kind: true, supporterName: true },
      }),
    ]);
    return prioritizedQueue(
      queued,
      state.queueMode as (typeof LIVE_QUEUE_MODES)[number],
      completedCount,
      recent.reverse(),
    )[0];
  }

  private queueMetadata(value: Prisma.JsonValue, manualPosition?: number) {
    const metadata =
      value && typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : {};
    delete (metadata as Record<string, unknown>).manualQueuePosition;
    if (manualPosition)
      (metadata as Record<string, unknown>).manualQueuePosition =
        manualPosition;
    return metadata as Prisma.InputJsonValue;
  }

  private async transition(
    tx: Prisma.TransactionClient,
    actor: Actor,
    input: Command,
    itemId: string,
    target: any,
  ) {
    const item = await this.owned(tx, actor.organizationId, itemId);
    if (item.status === target && input.action !== 'REPLAY') {
      await this.record(tx, actor, input, item, item.status, target);
      return;
    }
    if (
      input.action !== 'REPLAY' &&
      !canTransitionLiveQueue(item.status, target)
    )
      throw new BadRequestException(
        `Transição inválida: ${item.status} → ${target}`,
      );
    if (target === 'PLAYING') {
      const active = await tx.liveQueueItem.findFirst({
        where: {
          organizationId: actor.organizationId,
          status: 'PLAYING',
          id: { not: item.id },
        },
      });
      if (active)
        throw new BadRequestException('Já existe um incentivo em reprodução');
    }
    const state = await tx.liveQueueState.findUniqueOrThrow({
      where: { organizationId: actor.organizationId },
    });
    const now = new Date();
    const updated = await tx.liveQueueItem.update({
      where: { id: item.id },
      data: {
        status: target,
        ...(target === 'PLAYING'
          ? {
              startedAt: now,
              finishedAt: null,
              failureReason: null,
              playbackDeadline: new Date(
                now.getTime() + state.playbackTimeoutSeconds * 1000,
              ),
            }
          : {}),
        ...(TERMINAL.includes(target)
          ? {
              finishedAt: now,
              playbackDeadline: null,
              failureReason:
                target === 'FAILED' ? input.reason?.slice(0, 300) : null,
            }
          : {}),
      },
    });
    await this.synchronizeSourceStatus(tx, item, target);
    await this.record(tx, actor, input, item, item.status, target);
    let playbackMetadata = item.metadata as Record<string, unknown>;
    if (target === 'PLAYING' && item.kind === 'SONG_PIX') {
      const song = await tx.songRequest.findUnique({
        where: { id: item.sourceId },
        select: {
          id: true,
          externalId: true,
          provider: true,
          title: true,
          artist: true,
          durationSeconds: true,
          artworkUrl: true,
          playbackUrl: true,
          supporterName: true,
          session: { select: { volume: true } },
        },
      });
      if (song)
        playbackMetadata = {
          ...playbackMetadata,
          ...song,
          volume: song.session.volume,
        };
    }
    if (target === 'PLAYING' && ['SONG_PIX', 'VIDEO_PIX'].includes(item.kind)) {
      const mediaSeconds =
        item.kind === 'SONG_PIX'
          ? Number(playbackMetadata.durationSeconds ?? 0)
          : Number(playbackMetadata.selectedSeconds ?? 0);
      if (Number.isFinite(mediaSeconds) && mediaSeconds > 0)
        await tx.liveQueueItem.update({
          where: { id: item.id },
          data: {
            playbackDeadline: new Date(
              now.getTime() + mediaSeconds * 1000 + 15_000,
            ),
          },
        });
    }
    const mediaStarted =
      target === 'PLAYING' && ['SONG_PIX', 'VIDEO_PIX'].includes(item.kind);
    await this.event(
      tx,
      actor.organizationId,
      mediaStarted
        ? item.kind === 'SONG_PIX'
          ? 'song.started.v1'
          : 'video.started.v1'
        : `live.queue.item.${target.toLowerCase()}.v1`,
      mediaStarted ? item.sourceId : item.id,
      {
        ...playbackMetadata,
        queueItemId: item.id,
        kind: item.kind,
        supporterName: item.supporterName,
        title: item.title,
        content: item.content,
        status: target,
      },
    );
    return updated;
  }

  private async synchronizeSourceStatus(
    tx: Prisma.TransactionClient,
    item: { sourceType: string; sourceId: string },
    status: string,
  ) {
    const mapped =
      status === 'PLAYING'
        ? 'PLAYING'
        : status === 'COMPLETED'
          ? 'COMPLETED'
          : status === 'SKIPPED'
            ? 'SKIPPED'
            : status === 'FAILED'
              ? 'UNAVAILABLE'
              : status === 'QUEUED'
                ? 'QUEUED'
                : null;
    if (!mapped) return;
    if (item.sourceType === 'song.requested.v1')
      await tx.songRequest.updateMany({
        where: { id: item.sourceId },
        data: { status: mapped },
      });
    if (item.sourceType === 'video.requested.v1')
      await tx.videoRequest.updateMany({
        where: { id: item.sourceId },
        data: { status: mapped },
      });
    if (item.sourceType === 'tts.queued.v1')
      await tx.ttsJob.updateMany({
        where: { id: item.sourceId },
        data: { status: mapped },
      });
  }

  private targetStatus(action: string) {
    const map: Record<string, string> = {
      QUEUE: 'QUEUED',
      START: 'PLAYING',
      COMPLETE: 'COMPLETED',
      COMPLETE_AND_NEXT: 'COMPLETED',
      SKIP: 'SKIPPED',
      REPLAY: 'PLAYING',
      CANCEL: 'SKIPPED',
      BLOCK: 'SKIPPED',
      FAIL: 'FAILED',
    };
    const value = map[action];
    if (!value) throw new BadRequestException('Ação inválida');
    return value;
  }

  private async recoverTimeout(organizationId: string) {
    const state = await this.prisma.liveQueueState.findUnique({
      where: { organizationId },
      select: { paused: true },
    });
    if (state?.paused) return;
    const expired = await this.prisma.liveQueueItem.findMany({
      where: {
        organizationId,
        status: 'PLAYING',
        playbackDeadline: { lt: new Date() },
      },
    });
    for (const item of expired) {
      const key = `system:timeout:${item.id}:${item.startedAt?.toISOString() ?? 'unknown'}`;
      await this.command(
        { organizationId, userId: '', role: 'OWNER' },
        {
          action: 'FAIL',
          itemId: item.id,
          reason: 'Tempo de reprodução excedido',
          idempotencyKey: key,
          origin: 'SYSTEM',
        },
      );
    }
  }

  private async owned(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ) {
    const item = await tx.liveQueueItem.findFirst({
      where: { id, organizationId },
    });
    if (!item) throw new NotFoundException('Item da fila não encontrado');
    return item;
  }

  private async record(
    tx: Prisma.TransactionClient,
    actor: Actor,
    input: Command,
    item: any,
    previousStatus: any,
    nextStatus: any,
    metadata?: Record<string, unknown>,
  ) {
    await tx.liveQueueAction.create({
      data: {
        organizationId: actor.organizationId,
        queueItemId: item?.id,
        actorUserId: actor.userId || null,
        action: input.action,
        origin: (input.origin ?? 'PANEL').slice(0, 30),
        previousStatus,
        nextStatus,
        reason: input.reason?.trim().slice(0, 300),
        idempotencyKey: input.idempotencyKey,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.userId || null,
        action: `live_queue.${input.action.toLowerCase()}`,
        targetType: 'LiveQueueItem',
        targetId: item?.id,
        metadata: {
          previousStatus,
          nextStatus,
          reason: input.reason,
          origin: input.origin ?? 'PANEL',
          ...metadata,
        },
      },
    });
  }

  private event(
    tx: Prisma.TransactionClient,
    organizationId: string,
    eventType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ) {
    return tx.outboxEvent.create({
      data: {
        organizationId,
        eventType,
        eventVersion: 1,
        aggregateId,
        correlationId: randomUUID(),
        payload: payload as Prisma.InputJsonValue,
        occurredAt: new Date(),
      },
    });
  }

  private money(value: unknown) {
    if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
    if (typeof value === 'number' && Number.isSafeInteger(value))
      return BigInt(value);
    return null;
  }
  private text(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
  private serialize(value: any): any {
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.serialize(item)]),
      );
    return value;
  }
}
