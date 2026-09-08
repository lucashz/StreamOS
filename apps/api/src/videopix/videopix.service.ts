import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaClient } from '@streamos/database';
import { randomUUID } from 'node:crypto';
import {
  createVideoProvider,
  type VideoMetadata,
  type VideoProvider,
} from './video-provider';

export type VideoSessionInput = {
  name: string;
  pricePerSecondInCents: number;
  minimumContributionInCents: number;
  maximumDurationSeconds?: number;
  minimumViews: number;
  minimumAgeDays: number;
  maximumQueueSize: number;
  blockMadeForKids?: boolean;
  blockLiveContent?: boolean;
  allowedChannelIds?: string[];
  blockedChannelIds?: string[];
  blockedTitleTerms?: string[];
  automatic?: boolean;
};

@Injectable()
export class VideoPixService {
  private readonly provider: VideoProvider;
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {
    this.provider = createVideoProvider();
  }
  async sessions(organizationId: string) {
    const values = await this.prisma.videoSession.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return values.map((value) => this.session(value));
  }
  async create(
    organizationId: string,
    actorUserId: string,
    input: VideoSessionInput,
  ) {
    const data = this.input(input);
    const [value] = await this.prisma.$transaction([
      this.prisma.videoSession.create({ data: { organizationId, ...data } }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'videopix.session.create',
          targetType: 'VideoSession',
          metadata: {},
        },
      }),
    ]);
    return this.session(value);
  }
  async update(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: VideoSessionInput,
  ) {
    await this.owned(organizationId, id);
    const value = await this.prisma.videoSession.update({
      where: { id },
      data: this.input(input),
    });
    await this.audit(
      organizationId,
      actorUserId,
      'videopix.session.update',
      id,
    );
    return this.session(value);
  }
  async activate(organizationId: string, actorUserId: string, id: string) {
    await this.owned(organizationId, id);
    const [, value] = await this.prisma.$transaction([
      this.prisma.videoSession.updateMany({
        where: { organizationId, status: 'OPEN' },
        data: { status: 'PAUSED' },
      }),
      this.prisma.videoSession.update({
        where: { id },
        data: { status: 'OPEN' },
      }),
    ]);
    await this.audit(
      organizationId,
      actorUserId,
      'videopix.session.activate',
      id,
    );
    return this.session(value);
  }
  async publicSession(slug: string) {
    this.assertEnabled();
    const value = await this.prisma.videoSession.findFirst({
      where: {
        status: 'OPEN',
        organization: { creatorProfile: { slug, isPublished: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return value ? this.session(value) : null;
  }
  async preview(
    sessionId: string,
    url: string,
    selectedSeconds?: number,
    startAtSeconds = 0,
  ) {
    this.assertEnabled();
    const session = await this.prisma.videoSession.findFirst({
      where: { id: sessionId, status: 'OPEN' },
    });
    if (!session) throw new NotFoundException('Sessão VideoPix não encontrada');
    let video;
    try {
      video = await this.provider.metadata(url);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Vídeo inválido',
      );
    }
    const seconds = selectedSeconds ?? video.durationSeconds;
    this.validate(session, video, seconds, startAtSeconds);
    return {
      ...video,
      selectedSeconds: seconds,
      startAtSeconds,
      amountInCents: Math.max(
        Number(session.minimumContributionInCents),
        seconds * Number(session.pricePerSecondInCents),
      ),
      validation: 'AUTOMATIC',
    };
  }
  private assertEnabled() {
    if ((process.env.VIDEOPIX_ENABLED ?? 'true').toLowerCase() !== 'true')
      throw new ServiceUnavailableException(
        'VideoPix está temporariamente pausado',
      );
  }
  async createCheckoutRequest(
    sessionId: string,
    input: {
      url: string;
      supporterName: string;
      amountInCents?: number;
      selectedSeconds?: number;
      startAtSeconds?: number;
    },
  ) {
    await this.expire(sessionId);
    const preview = await this.preview(
      sessionId,
      input.url,
      input.selectedSeconds,
      input.startAtSeconds,
    );
    const session = await this.prisma.videoSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Sessão VideoPix não encontrada');
    const amountInCents = input.amountInCents ?? preview.amountInCents;
    if (
      !Number.isInteger(amountInCents) ||
      amountInCents < preview.amountInCents
    )
      throw new BadRequestException(
        `O valor mínimo para este trecho é ${preview.amountInCents} centavos`,
      );
    const name = input.supporterName.trim().slice(0, 60);
    if (name.length < 2) throw new BadRequestException('Informe seu apelido');
    const active = ['AWAITING_PAYMENT', 'QUEUED', 'PLAYING'];
    const [size, duplicate] = await Promise.all([
      this.prisma.videoRequest.count({
        where: { videoSessionId: sessionId, status: { in: active } },
      }),
      this.prisma.videoRequest.findFirst({
        where: {
          videoSessionId: sessionId,
          externalId: preview.externalId,
          status: { in: active },
        },
      }),
    ]);
    if (size >= session.maximumQueueSize)
      throw new BadRequestException('A fila de vídeos está cheia');
    if (duplicate) throw new BadRequestException('Este vídeo já está na fila');
    const status = 'AWAITING_PAYMENT';
    const request = await this.prisma.videoRequest.create({
      data: {
        videoSessionId: sessionId,
        provider: preview.provider,
        externalId: preview.externalId,
        url: preview.url,
        title: preview.title,
        channelTitle: preview.channelTitle,
        channelId: preview.channelId,
        durationSeconds: preview.durationSeconds,
        selectedSeconds: preview.selectedSeconds,
        startAtSeconds: preview.startAtSeconds,
        views: preview.views,
        publishedAt: preview.publishedAt,
        thumbnailUrl: preview.thumbnailUrl,
        embeddable: preview.embeddable,
        madeForKids: preview.madeForKids,
        broadcastType: preview.broadcastType,
        supporterName: name,
        amountInCents: BigInt(amountInCents),
        status,
        checkoutExpiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return this.request(request);
  }
  async publicRequest(id: string) {
    const request = await this.prisma.videoRequest.findUnique({
      where: { id },
    });
    if (!request) throw new NotFoundException('Pedido de vídeo não encontrado');
    return {
      id: request.id,
      status: request.status,
      title: request.title,
      amountInCents: Number(request.amountInCents),
      checkoutExpiresAt: request.checkoutExpiresAt,
      moderationReason:
        request.status === 'REJECTED' ? request.moderationReason : null,
    };
  }

  async queue(organizationId: string, sessionId: string) {
    await this.owned(organizationId, sessionId);
    await this.expire(sessionId);
    const values = await this.prisma.videoRequest.findMany({
      where: { videoSessionId: sessionId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return values.map((value) => this.request(value));
  }
  async action(
    organizationId: string,
    actorUserId: string,
    id: string,
    action: string,
  ) {
    const request = await this.prisma.videoRequest.findFirst({
      where: { id, session: { organizationId } },
      include: { session: true },
    });
    if (!request) throw new NotFoundException('Pedido de vídeo não encontrado');
    const transitions: Record<string, [string[], string, string]> = {
      PLAY: [['QUEUED'], 'PLAYING', 'video.started.v1'],
      SKIP: [['QUEUED', 'PLAYING'], 'SKIPPED', 'video.skipped.v1'],
      COMPLETE: [['PLAYING'], 'COMPLETED', 'video.completed.v1'],
      UNAVAILABLE: [
        ['QUEUED', 'PLAYING'],
        'UNAVAILABLE',
        'video.unavailable.v1',
      ],
    };
    const transition = transitions[action];
    if (!transition || !transition[0].includes(request.status))
      throw new BadRequestException('Ação inválida para o estado atual');
    if (action === 'PLAY') {
      try {
        const current = await this.provider.metadata(request.url);
        this.validate(
          request.session,
          current,
          request.selectedSeconds,
          request.startAtSeconds,
        );
      } catch (error) {
        const unavailable = await this.prisma.$transaction(async (tx) => {
          const value = await tx.videoRequest.update({
            where: { id },
            data: {
              status: 'UNAVAILABLE',
              moderationReason:
                error instanceof Error
                  ? error.message.slice(0, 200)
                  : 'Vídeo indisponível',
            },
          });
          await tx.outboxEvent.create({
            data: {
              organizationId,
              eventType: 'video.unavailable.v1',
              eventVersion: 1,
              aggregateId: id,
              correlationId: randomUUID(),
              payload: {
                requestId: id,
                reason:
                  error instanceof Error ? error.message : 'Vídeo indisponível',
              },
              occurredAt: new Date(),
            },
          });
          return value;
        });
        return this.request(unavailable);
      }
    }
    const changed = await this.prisma.$transaction(async (tx) => {
      if (action === 'PLAY')
        await tx.videoRequest.updateMany({
          where: {
            videoSessionId: request.videoSessionId,
            status: 'PLAYING',
            id: { not: id },
          },
          data: { status: 'QUEUED' },
        });
      const value = await tx.videoRequest.update({
        where: { id },
        data: { status: transition[1] },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId,
          eventType: transition[2],
          eventVersion: 1,
          aggregateId: id,
          correlationId: randomUUID(),
          payload: {
            requestId: id,
            title: request.title,
            channelTitle: request.channelTitle,
            externalId: request.externalId,
            provider: request.provider,
            startAtSeconds: request.startAtSeconds,
            selectedSeconds: request.selectedSeconds,
            supporterName: request.supporterName,
            status: transition[1],
          },
          occurredAt: new Date(),
        },
      });
      return value;
    });
    await this.audit(
      organizationId,
      actorUserId,
      `videopix.request.${action.toLowerCase()}`,
      id,
    );
    return this.request(changed);
  }
  private validate(
    session: {
      maximumDurationSeconds: number;
      minimumViews: number;
      minimumAgeDays: number;
      blockMadeForKids: boolean;
      blockLiveContent: boolean;
      allowedChannelIds: string[];
      blockedChannelIds: string[];
      blockedTitleTerms: string[];
    },
    video: VideoMetadata,
    selectedSeconds: number,
    start: number,
  ) {
    if (video.availability !== 'PUBLIC')
      throw new BadRequestException(
        video.availability === 'PRIVATE'
          ? 'O vídeo é privado'
          : 'O vídeo foi removido',
      );
    if (!video.embeddable)
      throw new BadRequestException('O vídeo não permite incorporação');
    if (session.blockMadeForKids && video.madeForKids)
      throw new BadRequestException('Conteúdo infantil não é permitido');
    if (session.blockLiveContent && video.broadcastType !== 'NONE')
      throw new BadRequestException('Lives e estreias não são permitidas');
    if (session.blockedChannelIds.includes(video.channelId))
      throw new BadRequestException('Este canal está bloqueado');
    if (
      session.allowedChannelIds.length > 0 &&
      !session.allowedChannelIds.includes(video.channelId)
    )
      throw new BadRequestException('Este canal não está na lista permitida');
    const normalizedTitle = this.normalize(video.title);
    if (
      session.blockedTitleTerms.some((term) =>
        normalizedTitle.includes(this.normalize(term)),
      )
    )
      throw new BadRequestException('O título contém um termo proibido');
    if (
      !Number.isInteger(selectedSeconds) ||
      selectedSeconds < 1 ||
      start < 0 ||
      start + selectedSeconds > video.durationSeconds
    )
      throw new BadRequestException(
        'Escolha um trecho válido dentro da duração do vídeo',
      );
    if (video.views < session.minimumViews)
      throw new BadRequestException(
        `O vídeo precisa ter pelo menos ${session.minimumViews} visualizações`,
      );
    if (
      video.publishedAt >
      new Date(Date.now() - session.minimumAgeDays * 86_400_000)
    )
      throw new BadRequestException(
        `O vídeo precisa ter pelo menos ${session.minimumAgeDays} dias`,
      );
  }
  private input(input: VideoSessionInput) {
    if (
      input.name.trim().length < 2 ||
      !Number.isInteger(input.pricePerSecondInCents) ||
      input.pricePerSecondInCents < 1 ||
      input.pricePerSecondInCents > 1000 ||
      !Number.isInteger(input.minimumContributionInCents) ||
      input.minimumContributionInCents < 100 ||
      !Number.isInteger(input.minimumViews) ||
      input.minimumViews < 0 ||
      !Number.isInteger(input.minimumAgeDays) ||
      input.minimumAgeDays < 0 ||
      !Number.isInteger(input.maximumQueueSize) ||
      input.maximumQueueSize < 1 ||
      input.maximumQueueSize > 100
    )
      throw new BadRequestException('Configuração VideoPix inválida');
    return {
      name: input.name.trim(),
      // Coluna legada, preservada enquanto o schema é compatível com sessões
      // antigas. A validação usa apenas a duração real do vídeo.
      maximumDurationSeconds: 2_147_483_647,
      minimumViews: input.minimumViews,
      minimumAgeDays: input.minimumAgeDays,
      maximumQueueSize: input.maximumQueueSize,
      blockMadeForKids: input.blockMadeForKids !== false,
      blockLiveContent: input.blockLiveContent !== false,
      allowedChannelIds: this.stringList(input.allowedChannelIds),
      blockedChannelIds: this.stringList(input.blockedChannelIds),
      blockedTitleTerms: this.stringList(input.blockedTitleTerms),
      automatic: input.automatic !== false,
      pricePerSecondInCents: BigInt(input.pricePerSecondInCents),
      minimumContributionInCents: BigInt(input.minimumContributionInCents),
    };
  }
  private stringList(value?: string[]) {
    if (!value) return [];
    if (!Array.isArray(value) || value.length > 100)
      throw new BadRequestException('Lista de moderação inválida');
    return [
      ...new Set(value.map((item) => String(item).trim()).filter(Boolean)),
    ].slice(0, 100);
  }
  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  private async owned(organizationId: string, id: string) {
    const value = await this.prisma.videoSession.findFirst({
      where: { id, organizationId },
    });
    if (!value) throw new NotFoundException('Sessão VideoPix não encontrada');
    return value;
  }
  private async expire(sessionId: string) {
    await this.prisma.videoRequest.updateMany({
      where: {
        videoSessionId: sessionId,
        status: 'AWAITING_PAYMENT',
        checkoutExpiresAt: { lte: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
  }
  private session<
    T extends {
      pricePerSecondInCents: bigint;
      minimumContributionInCents: bigint;
    },
  >(value: T) {
    return {
      ...value,
      pricePerSecondInCents: Number(value.pricePerSecondInCents),
      minimumContributionInCents: Number(value.minimumContributionInCents),
    };
  }
  private request<T extends { amountInCents: bigint }>(value: T) {
    return { ...value, amountInCents: Number(value.amountInCents) };
  }
  private audit(
    organizationId: string,
    actorUserId: string,
    action: string,
    targetId: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action,
        targetType: 'VideoRequest',
        targetId,
        metadata: {},
      },
    });
  }
}
