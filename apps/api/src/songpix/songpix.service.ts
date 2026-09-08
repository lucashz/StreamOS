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
  createSongCatalogProvider,
  type SongCatalogProvider,
} from './song-provider';

@Injectable()
export class SongPixService {
  private readonly provider: SongCatalogProvider;
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {
    this.provider = createSongCatalogProvider();
  }

  async catalog(query = '') {
    if (/^https?:\/\//i.test(query.trim())) {
      try {
        return [await this.provider.metadata(query.trim())];
      } catch (error: unknown) {
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : 'Não foi possível validar o link da música',
        );
      }
    }
    return this.provider.search(query);
  }

  async sessions(organizationId: string) {
    const sessions = await this.prisma.songSession.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { requests: true } } },
    });
    return sessions.map((session) => this.serializeSession(session));
  }

  async createSession(
    organizationId: string,
    actorUserId: string,
    input: {
      name: string;
      theme: string;
      allowedGenres: string[];
      allowedArtists?: string[];
      blockedArtists?: string[];
      blockedTerms?: string[];
      provider?: string;
      volume?: number;
      automatic?: boolean;
      minimumContributionInCents: number;
      maximumDurationSeconds: number;
      maximumQueueSize: number;
      maximumRequestsPerSupporter: number;
    },
  ) {
    const data = this.sessionInput(input);
    const [session] = await this.prisma.$transaction([
      this.prisma.songSession.create({ data: { organizationId, ...data } }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'songpix.session.create',
          targetType: 'SongSession',
          metadata: { theme: data.theme },
        },
      }),
    ]);
    return this.serializeSession(session);
  }

  async updateSession(
    organizationId: string,
    actorUserId: string,
    sessionId: string,
    input: Parameters<SongPixService['createSession']>[2],
  ) {
    await this.ownedSession(organizationId, sessionId);
    const data = this.sessionInput(input);
    const [session] = await this.prisma.$transaction([
      this.prisma.songSession.update({ where: { id: sessionId }, data }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'songpix.session.update',
          targetType: 'SongSession',
          targetId: sessionId,
          metadata: { theme: data.theme },
        },
      }),
    ]);
    return this.serializeSession(session);
  }

  async activate(
    organizationId: string,
    actorUserId: string,
    sessionId: string,
  ) {
    await this.ownedSession(organizationId, sessionId);
    const [, session] = await this.prisma.$transaction([
      this.prisma.songSession.updateMany({
        where: { organizationId, status: 'OPEN' },
        data: { status: 'PAUSED' },
      }),
      this.prisma.songSession.update({
        where: { id: sessionId },
        data: { status: 'OPEN' },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'songpix.session.activate',
          targetType: 'SongSession',
          targetId: sessionId,
          metadata: {},
        },
      }),
    ]);
    return this.serializeSession(session);
  }

  async publicSession(slug: string) {
    this.assertEnabled();
    const session = await this.prisma.songSession.findFirst({
      where: {
        status: 'OPEN',
        organization: { creatorProfile: { slug, isPublished: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return session ? this.serializeSession(session) : null;
  }

  async createCheckoutRequest(
    sessionId: string,
    input: { songId: string; supporterName: string; amountInCents?: number },
  ) {
    this.assertEnabled();
    await this.expireAwaitingPayments(sessionId);
    const session = await this.prisma.songSession.findFirst({
      where: { id: sessionId, status: 'OPEN' },
    });
    if (!session) throw new NotFoundException('Sessão SongPix não encontrada');
    let song;
    try {
      song = await this.provider.metadata(input.songId);
    } catch (error: unknown) {
      throw new NotFoundException(
        error instanceof Error ? error.message : 'Música não encontrada',
      );
    }
    if (!song.available)
      throw new BadRequestException('Música indisponível no catálogo');
    if (
      this.provider.name !== 'MOCK' &&
      (song.restrictions?.playback !== 'DIRECT_STREAM' || !song.playbackUrl)
    )
      throw new BadRequestException(
        'Esta música não possui reprodução autorizada para a transmissão',
      );
    const supporterName = input.supporterName.trim().slice(0, 60);
    if (supporterName.length < 2)
      throw new BadRequestException('Informe seu apelido');
    const amountInCents =
      input.amountInCents ?? Number(session.minimumContributionInCents);
    if (
      !Number.isInteger(amountInCents) ||
      amountInCents < Number(session.minimumContributionInCents)
    )
      throw new BadRequestException(
        `O valor mínimo para esta música é ${Number(session.minimumContributionInCents)} centavos`,
      );
    const allowedGenres = session.allowedGenres
      .map((item) => this.normalizedGenre(item))
      .filter((item) => !['livre', 'todos', 'qualquer'].includes(item));
    const allowedArtists = session.allowedArtists.map((item) =>
      item.toLowerCase(),
    );
    const blockedArtists = session.blockedArtists.map((item) =>
      item.toLowerCase(),
    );
    const searchable = `${song.title} ${song.artist}`.toLowerCase();
    if (
      session.blockedTerms.some((term) =>
        searchable.includes(term.toLowerCase()),
      )
    )
      throw new BadRequestException('A música contém um termo bloqueado');
    if (
      allowedGenres.length &&
      !this.unknownGenre(song.genre) &&
      !allowedGenres.includes(this.normalizedGenre(song.genre))
    )
      throw new BadRequestException(
        `Esta música foi identificada como ${song.genre}. Hoje só valem: ${session.allowedGenres.join(', ')}`,
      );
    if (
      allowedArtists.length &&
      !allowedArtists.includes(song.artist.toLowerCase())
    )
      throw new BadRequestException('Artista fora da seleção desta sessão');
    if (blockedArtists.includes(song.artist.toLowerCase()))
      throw new BadRequestException('Artista bloqueado nesta sessão');
    if (song.durationSeconds > session.maximumDurationSeconds)
      throw new BadRequestException('Música excede a duração permitida');
    const activeStatuses = ['AWAITING_PAYMENT', 'QUEUED', 'PLAYING'];
    const [queueSize, supporterCount] = await Promise.all([
      this.prisma.songRequest.count({
        where: { songSessionId: sessionId, status: { in: activeStatuses } },
      }),
      this.prisma.songRequest.count({
        where: {
          songSessionId: sessionId,
          supporterName: { equals: supporterName, mode: 'insensitive' },
          status: { in: activeStatuses },
        },
      }),
    ]);
    if (queueSize >= session.maximumQueueSize)
      throw new BadRequestException('A fila está cheia');
    if (supporterCount >= session.maximumRequestsPerSupporter)
      throw new BadRequestException('Limite de pedidos por apoiador atingido');
    const request = await this.prisma.songRequest.create({
      data: {
        songSessionId: session.id,
        externalId: song.id,
        provider: song.provider ?? this.provider.name,
        title: song.title,
        artist: song.artist,
        genre: song.genre,
        durationSeconds: song.durationSeconds,
        artworkUrl: song.artworkUrl,
        playbackUrl: song.playbackUrl,
        playbackRestrictions: song.restrictions ?? {},
        supporterName,
        amountInCents: BigInt(amountInCents),
        checkoutExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return {
      ...request,
      amountInCents,
    };
  }

  private assertEnabled() {
    if ((process.env.SONGPIX_ENABLED ?? 'true').toLowerCase() !== 'true')
      throw new ServiceUnavailableException(
        'SongPix está temporariamente pausado',
      );
  }

  async queue(organizationId: string, sessionId: string) {
    await this.ownedSession(organizationId, sessionId);
    await this.expireAwaitingPayments(sessionId);
    const requests = await this.prisma.songRequest.findMany({
      where: { songSessionId: sessionId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return requests.map((request) => this.serializeRequest(request));
  }

  async action(
    organizationId: string,
    actorUserId: string,
    requestId: string,
    action: string,
  ) {
    const request = await this.prisma.songRequest.findFirst({
      where: { id: requestId, session: { organizationId } },
      include: { session: true },
    });
    if (!request) throw new NotFoundException('Pedido não encontrado');
    const transitions: Record<
      string,
      { allowed: string[]; status: string; eventType: string }
    > = {
      PLAY: {
        allowed: ['QUEUED'],
        status: 'PLAYING',
        eventType: 'song.started.v1',
      },
      SKIP: {
        allowed: ['QUEUED', 'PLAYING'],
        status: 'SKIPPED',
        eventType: 'song.skipped.v1',
      },
      COMPLETE: {
        allowed: ['PLAYING'],
        status: 'COMPLETED',
        eventType: 'song.completed.v1',
      },
    };
    const transition = transitions[action];
    if (!transition || !transition.allowed.includes(request.status))
      throw new BadRequestException('Ação inválida para o estado atual');
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      if (action === 'PLAY') {
        await tx.songRequest.updateMany({
          where: {
            songSessionId: request.songSessionId,
            status: 'PLAYING',
            id: { not: request.id },
          },
          data: { status: 'QUEUED' },
        });
      }
      const changed = await tx.songRequest.update({
        where: { id: request.id },
        data: { status: transition.status },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId,
          eventType: transition.eventType,
          eventVersion: 1,
          aggregateId: request.id,
          correlationId: randomUUID(),
          payload: {
            requestId: request.id,
            title: request.title,
            artist: request.artist,
            supporterName: request.supporterName,
            durationSeconds: request.durationSeconds,
            provider: request.provider,
            artworkUrl: request.artworkUrl,
            playbackUrl: request.playbackUrl,
            externalId: request.externalId,
            status: transition.status,
          },
          occurredAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: `songpix.request.${action.toLowerCase()}`,
          targetType: 'SongRequest',
          targetId: request.id,
          metadata: {},
        },
      });
      return changed;
    });
    return this.serializeRequest(updated);
  }

  private sessionInput(input: Parameters<SongPixService['createSession']>[2]) {
    const name = input.name.trim();
    const theme = input.theme.trim();
    if (
      name.length < 2 ||
      theme.length < 2 ||
      !input.allowedGenres.length ||
      !Number.isInteger(input.minimumContributionInCents) ||
      input.minimumContributionInCents < 100 ||
      !Number.isInteger(input.maximumDurationSeconds) ||
      input.maximumDurationSeconds < 60 ||
      input.maximumDurationSeconds > 900 ||
      !Number.isInteger(input.maximumQueueSize) ||
      input.maximumQueueSize < 1 ||
      input.maximumQueueSize > 100 ||
      !Number.isInteger(input.maximumRequestsPerSupporter) ||
      input.maximumRequestsPerSupporter < 1 ||
      input.maximumRequestsPerSupporter > 10
    )
      throw new BadRequestException('Configuração SongPix inválida');
    const list = (items: string[] = []) =>
      [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(
        0,
        30,
      );
    return {
      name,
      theme,
      allowedGenres: list(input.allowedGenres),
      allowedArtists: list(input.allowedArtists),
      blockedArtists: list(input.blockedArtists),
      blockedTerms: list(input.blockedTerms),
      provider: input.provider === 'YOUTUBE' ? 'YOUTUBE' : 'YOUTUBE',
      volume: Math.min(100, Math.max(0, Math.round(input.volume ?? 80))),
      automatic: input.automatic !== false,
      minimumContributionInCents: BigInt(input.minimumContributionInCents),
      maximumDurationSeconds: input.maximumDurationSeconds,
      maximumQueueSize: input.maximumQueueSize,
      maximumRequestsPerSupporter: input.maximumRequestsPerSupporter,
    };
  }

  private async ownedSession(organizationId: string, sessionId: string) {
    const session = await this.prisma.songSession.findFirst({
      where: { id: sessionId, organizationId },
    });
    if (!session) throw new NotFoundException('Sessão SongPix não encontrada');
    return session;
  }

  private async expireAwaitingPayments(sessionId: string) {
    await this.prisma.songRequest.updateMany({
      where: {
        songSessionId: sessionId,
        status: 'AWAITING_PAYMENT',
        checkoutExpiresAt: { lte: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
  }

  private normalizedGenre(value: string) {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (normalized.includes('sertanejo')) return 'sertanejo';
    if (normalized.includes('rock') || normalized.includes('metal'))
      return 'rock';
    if (normalized.includes('eletron')) return 'eletronica';
    if (normalized.includes('hip hop') || normalized.includes('trap'))
      return 'rap';
    return normalized;
  }

  private unknownGenre(value: string) {
    return ['nao identificado', 'link externo', ''].includes(
      this.normalizedGenre(value),
    );
  }

  private serializeSession<T extends { minimumContributionInCents: bigint }>(
    session: T,
  ) {
    return {
      ...session,
      minimumContributionInCents: Number(session.minimumContributionInCents),
    };
  }

  private serializeRequest<T extends { amountInCents: bigint }>(request: T) {
    return { ...request, amountInCents: Number(request.amountInCents) };
  }
}
