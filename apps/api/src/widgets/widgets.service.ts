import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@streamos/database';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { youtubeVideoId } from '../videopix/video-provider';

const TYPES = [
  'ALERT',
  'QR_CODE',
  'GOAL',
  'RECENT_CONTRIBUTIONS',
  'RANKING',
  'SONG_PIX',
  'VIDEO_PIX',
  'CAMPAIGN',
  'SUBSCRIPTION',
  'POLL',
  'MARATHON',
  'SUPPORTERS_PANEL',
  'BANNER',
  'CUSTOM_TEXT',
] as const;

const UNIFIED_ALERT_TYPES = [
  'ALERT',
  'VIDEO_PIX',
  'SONG_PIX',
  'SUBSCRIPTION',
] as const;

type WidgetType = (typeof TYPES)[number];

const DEFAULTS: Record<WidgetType, Prisma.InputJsonObject> = {
  ALERT: {
    accent: '#a98cff',
    durationMs: 8000,
    minimumInCents: 100,
    showMessage: true,
  },
  QR_CODE: { accent: '#a98cff', label: 'Apoie a live' },
  GOAL: { accent: '#62d4a7', showTitle: true, showAmount: true },
  RECENT_CONTRIBUTIONS: { accent: '#64a8ff', limit: 5 },
  RANKING: { accent: '#f2ad5f', limit: 5, period: 'MONTH' },
  SONG_PIX: { accent: '#f472b6', limit: 5, showSupporter: true },
  VIDEO_PIX: { accent: '#ef4444', limit: 5, showSupporter: true },
  CAMPAIGN: { accent: '#62d4a7', showTitle: true, showAmount: true },
  SUBSCRIPTION: { accent: '#a98cff', limit: 5, showSupporter: true },
  POLL: { accent: '#5eead4', persistent: true },
  MARATHON: { accent: '#60a5fa', durationPerContribution: 60 },
  SUPPORTERS_PANEL: { accent: '#a98cff', limit: 5 },
  BANNER: {
    accent: '#a98cff',
    text: 'Acompanhe e apoie a transmissão',
    rotationSeconds: 15,
    persistent: true,
  },
  CUSTOM_TEXT: {
    accent: '#a98cff',
    text: 'Sua mensagem aparece aqui',
    fontSize: 32,
    persistent: true,
  },
};

@Injectable()
export class WidgetsService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  catalog() {
    return [
      {
        type: 'ALERT',
        name: 'Alerta',
        description: 'Exibe novos apoios na live.',
      },
      {
        type: 'QR_CODE',
        name: 'QR Code',
        description: 'Divulga a página pública do canal.',
      },
      {
        type: 'GOAL',
        name: 'Meta',
        description: 'Mostra o progresso da meta ativa.',
      },
      {
        type: 'RECENT_CONTRIBUTIONS',
        name: 'Últimos apoios',
        description: 'Lista as contribuições recentes.',
      },
      {
        type: 'RANKING',
        name: 'Ranking',
        description: 'Destaca os maiores apoiadores do período.',
      },
      {
        type: 'SONG_PIX',
        name: 'SongPix',
        description: 'Mostra a música atual e os próximos pedidos.',
      },
      {
        type: 'VIDEO_PIX',
        name: 'VideoPix',
        description: 'Reproduz automaticamente vídeos validados.',
      },
      {
        type: 'CAMPAIGN',
        name: 'Vaquinha',
        description: 'Mostra o progresso da vaquinha publicada.',
      },
      {
        type: 'SUBSCRIPTION',
        name: 'Nova assinatura',
        description: 'Exibe novas assinaturas e membros recentes.',
      },
      {
        type: 'POLL',
        name: 'Enquete',
        description: 'Mostra uma votação da comunidade.',
      },
      {
        type: 'MARATHON',
        name: 'Maratona',
        description: 'Acrescenta tempo a cada contribuição.',
      },
      {
        type: 'SUPPORTERS_PANEL',
        name: 'Painel de apoiadores',
        description: 'Destaca os principais apoiadores da live.',
      },
      {
        type: 'BANNER',
        name: 'Banner rotativo',
        description: 'Exibe avisos e chamadas durante a transmissão.',
      },
      {
        type: 'CUSTOM_TEXT',
        name: 'Texto personalizado',
        description: 'Mantém uma mensagem personalizada na cena.',
      },
    ];
  }

  async list(organizationId: string) {
    const widgets = await this.prisma.widget.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        channel: {
          select: {
            id: true,
            revokedAt: true,
            connectedAt: true,
            lastHeartbeatAt: true,
            disconnectedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return widgets.map((widget) => {
      const lastHeartbeatAt = widget.channel?.lastHeartbeatAt;
      return {
        ...widget,
        channelReady: Boolean(widget.channel && !widget.channel.revokedAt),
        obsConnected: Boolean(
          lastHeartbeatAt &&
          lastHeartbeatAt > new Date(Date.now() - 45_000) &&
          (!widget.channel?.disconnectedAt ||
            lastHeartbeatAt > widget.channel.disconnectedAt),
        ),
        lastHeartbeatAt,
      };
    });
  }

  async create(
    organizationId: string,
    actorUserId: string,
    input: { type: string; name?: string },
  ) {
    const type = this.widgetType(input.type);
    const name =
      input.name?.trim() ||
      this.catalog().find((item) => item.type === type)?.name ||
      type;
    if (name.length < 2 || name.length > 80)
      throw new BadRequestException('Nome do widget inválido');
    const token = randomBytes(32).toString('base64url');
    const widget = await this.prisma.$transaction(async (tx) => {
      const created = await tx.widget.create({
        data: { organizationId, type, name, config: DEFAULTS[type] },
      });
      await tx.overlayChannel.create({
        data: {
          organizationId,
          widgetId: created.id,
          tokenHash: this.digest(token),
        },
      });
      if (type === 'ALERT')
        await tx.alertConfig.updateMany({
          where: { organizationId },
          data: { enabled: true },
        });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'widget.create',
          targetType: 'Widget',
          targetId: created.id,
          metadata: { type },
        },
      });
      return created;
    });
    return { ...widget, ...this.access(token) };
  }

  async update(
    organizationId: string,
    actorUserId: string,
    widgetId: string,
    input: { name: string; enabled: boolean; config: Record<string, unknown> },
  ) {
    const current = await this.owned(organizationId, widgetId);
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80)
      throw new BadRequestException('Nome do widget inválido');
    const config = this.config(this.widgetType(current.type), input.config);
    const widget = await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'widget.update',
          targetType: 'Widget',
          targetId: widgetId,
          metadata: { configVersion: current.configVersion + 1 },
        },
      });
      const updated = await tx.widget.update({
        where: { id: widgetId },
        data: {
          name,
          enabled: input.enabled,
          config,
          configVersion: { increment: 1 },
        },
      });
      if (current.type === 'ALERT')
        await tx.alertConfig.updateMany({
          where: { organizationId },
          data: { enabled: input.enabled },
        });
      return updated;
    });
    return widget;
  }

  async duplicate(
    organizationId: string,
    actorUserId: string,
    widgetId: string,
  ) {
    const current = await this.owned(organizationId, widgetId);
    const created = await this.create(organizationId, actorUserId, {
      type: current.type,
      name: `${current.name} (cópia)`,
    });
    await this.prisma.widget.update({
      where: { id: created.id },
      data: { config: current.config as Prisma.InputJsonObject },
    });
    return created;
  }

  async rotateToken(
    organizationId: string,
    actorUserId: string,
    widgetId: string,
  ) {
    await this.owned(organizationId, widgetId);
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.overlayChannel.update({
        where: { widgetId },
        data: { tokenHash: this.digest(token), revokedAt: null },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'widget.rotate_token',
          targetType: 'Widget',
          targetId: widgetId,
          metadata: {},
        },
      }),
    ]);
    return this.access(token);
  }

  async remove(organizationId: string, actorUserId: string, widgetId: string) {
    await this.owned(organizationId, widgetId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.widget.update({
        where: { id: widgetId },
        data: { deletedAt: now, enabled: false },
      }),
      this.prisma.overlayChannel.update({
        where: { widgetId },
        data: { revokedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'widget.delete',
          targetType: 'Widget',
          targetId: widgetId,
          metadata: {},
        },
      }),
    ]);
    return { deleted: true };
  }

  async test(
    organizationId: string,
    widgetId: string,
    input: { videoUrl?: string; songPlaybackUrl?: string } = {},
  ) {
    const widget = await this.owned(organizationId, widgetId);
    if (!widget.enabled) throw new BadRequestException('Widget desativado');
    if (widget.type === 'QR_CODE') return { queued: false, static: true };
    const now = new Date();
    const eventType =
      widget.type === 'GOAL'
        ? 'goal.updated.v1'
        : widget.type === 'SONG_PIX'
          ? 'song.started.v1'
          : widget.type === 'VIDEO_PIX'
            ? 'video.started.v1'
            : widget.type === 'CAMPAIGN'
              ? 'campaign.contribution.confirmed.v1'
              : widget.type === 'SUBSCRIPTION'
                ? 'subscription.created.v1'
                : 'alert.test.v1';
    const videoUrl = input.videoUrl?.trim();
    const videoId =
      widget.type === 'VIDEO_PIX' && videoUrl
        ? youtubeVideoId(videoUrl)
        : undefined;
    const songPlaybackUrl = input.songPlaybackUrl?.trim();
    const songVideoId = songPlaybackUrl
      ? youtubeVideoId(songPlaybackUrl)
      : undefined;
    if (songPlaybackUrl) {
      let parsed: URL;
      try {
        parsed = new URL(songPlaybackUrl);
      } catch {
        throw new BadRequestException('URL de teste da música inválida');
      }
      if (parsed.protocol !== 'https:')
        throw new BadRequestException(
          'A URL de teste da música deve usar HTTPS',
        );
    }
    const payload =
      widget.type === 'GOAL'
        ? {
            targetWidgetId: widget.id,
            goalId: widget.id,
            title: 'Meta de teste',
            currentInCents: '65000',
            targetInCents: '100000',
          }
        : widget.type === 'SONG_PIX'
          ? {
              targetWidgetId: widget.id,
              requestId: widget.id,
              title: 'Noite na Estrada',
              artist: 'Duo Horizonte',
              supporterName: 'Teste StreamOS',
              status: 'PLAYING',
              provider: songVideoId ? 'YOUTUBE' : 'DIRECT_AUDIO',
              externalId: songVideoId ? `youtube:${songVideoId}` : undefined,
              playbackUrl: songVideoId
                ? `https://www.youtube-nocookie.com/embed/${songVideoId}?autoplay=1&controls=0`
                : songPlaybackUrl,
              durationSeconds: 30,
              isTest: !songPlaybackUrl,
            }
          : widget.type === 'VIDEO_PIX'
            ? {
                targetWidgetId: widget.id,
                requestId: widget.id,
                title: 'Melhores momentos da comunidade',
                channelTitle: 'Canal Verificado',
                externalId: videoId ?? 'video-ok',
                provider: videoId ? 'YOUTUBE' : 'MOCK_YOUTUBE',
                startAtSeconds: 0,
                selectedSeconds: 30,
                supporterName: 'Teste StreamOS',
                status: 'PLAYING',
                isTest: !videoId,
              }
            : widget.type === 'CAMPAIGN'
              ? {
                  targetWidgetId: widget.id,
                  campaignId: widget.id,
                  title: 'Vaquinha de teste',
                  currentInCents: '65000',
                  targetInCents: '100000',
                  amountInCents: '2000',
                  supporterName: 'Teste StreamOS',
                }
              : widget.type === 'SUBSCRIPTION'
                ? {
                    targetWidgetId: widget.id,
                    subscriptionId: widget.id,
                    planName: 'Clube StreamOS',
                    supporterName: 'Novo membro',
                    amountInCents: '1490',
                  }
                : {
                    targetWidgetId: widget.id,
                    amountInCents: '2000',
                    supporterName: 'Teste StreamOS',
                    message: 'Widget funcionando!',
                  };
    const event = await this.prisma.outboxEvent.create({
      data: {
        organizationId,
        eventType,
        eventVersion: 1,
        aggregateId: widget.id,
        correlationId: randomUUID(),
        payload,
        occurredAt: now,
      },
    });
    return { eventId: event.id, queued: true };
  }

  async publicConfig(token: string) {
    if (token.length < 32) throw new NotFoundException('Widget não encontrado');
    const channel = await this.prisma.overlayChannel.findFirst({
      where: {
        tokenHash: this.digest(token),
        revokedAt: null,
      },
      include: {
        widget: true,
        organization: {
          include: {
            creatorProfile: true,
            goals: { where: { active: true }, take: 1 },
          },
        },
      },
    });
    if (!channel) throw new NotFoundException('Widget não encontrado');
    if (!channel.widget) {
      const widgets = await this.prisma.widget.findMany({
        where: {
          organizationId: channel.organizationId,
          type: { in: [...UNIFIED_ALERT_TYPES] },
          enabled: true,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });
      return {
        id: channel.id,
        type: 'COMPOSITE',
        name: 'Overlay único',
        config: {},
        widgets: await Promise.all(
          widgets.map(async (widget) => ({
            id: widget.id,
            type: widget.type,
            name: widget.name,
            config: widget.config,
            initialData: await this.initialData(
              channel.organizationId,
              widget.type,
              channel.organization,
            ),
          })),
        ),
      };
    }
    if (channel.widget.deletedAt || !channel.widget.enabled)
      throw new NotFoundException('Widget não encontrado');
    return {
      id: channel.widget.id,
      type: channel.widget.type,
      name: channel.widget.name,
      config: channel.widget.config,
      initialData: await this.initialData(
        channel.organizationId,
        channel.widget.type,
        channel.organization,
      ),
    };
  }

  private async initialData(
    organizationId: string,
    type: string,
    organization: {
      creatorProfile: { slug: string } | null;
      goals: Array<{
        title: string;
        currentInCents: bigint;
        targetInCents: bigint;
      }>;
    },
  ) {
    if (type === 'QR_CODE')
      return {
        publicUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/${organization.creatorProfile?.slug ?? ''}`,
      };
    if (type === 'GOAL') {
      const goal = organization.goals[0];
      return goal
        ? {
            title: goal.title,
            currentInCents: Number(goal.currentInCents),
            targetInCents: Number(goal.targetInCents),
          }
        : null;
    }
    if (type === 'SONG_PIX') {
      const session = await this.prisma.songSession.findFirst({
        where: { organizationId, status: 'OPEN' },
        orderBy: { updatedAt: 'desc' },
        include: {
          requests: {
            where: { status: { in: ['PLAYING', 'QUEUED'] } },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
      return session
        ? {
            sessionName: session.name,
            theme: session.theme,
            current:
              session.requests.find(
                (request) => request.status === 'PLAYING',
              ) ?? null,
            queue: session.requests.filter(
              (request) => request.status === 'QUEUED',
            ),
          }
        : null;
    }
    if (type === 'VIDEO_PIX') {
      const session = await this.prisma.videoSession.findFirst({
        where: { organizationId, status: 'OPEN' },
        orderBy: { updatedAt: 'desc' },
        include: {
          requests: {
            where: { status: { in: ['PLAYING', 'QUEUED'] } },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
      return session
        ? {
            sessionName: session.name,
            current:
              session.requests.find(
                (request) => request.status === 'PLAYING',
              ) ?? null,
            queue: session.requests.filter(
              (request) => request.status === 'QUEUED',
            ),
          }
        : null;
    }
    if (type === 'CAMPAIGN') {
      const campaign = await this.prisma.fundraisingCampaign.findFirst({
        where: { organizationId, status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        include: { contributions: { where: { confirmedAt: { not: null } } } },
      });
      return campaign
        ? {
            title: campaign.title,
            currentInCents: campaign.contributions.reduce(
              (sum, item) => sum + Number(item.amountInCents),
              0,
            ),
            targetInCents: Number(campaign.targetInCents),
          }
        : null;
    }
    if (type === 'SUBSCRIPTION') {
      const subscriptions = await this.prisma.creatorSubscription.findMany({
        where: { organizationId, status: 'ACTIVE' },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      return subscriptions.map((item) => ({
        name: item.supporterName,
        amountInCents: Number(item.plan.priceInCents),
      }));
    }
    const intents = await this.prisma.paymentIntent.findMany({
      where: { organizationId, payment: { isNot: null } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (type === 'RECENT_CONTRIBUTIONS')
      return intents.slice(0, 10).map((item) => ({
        name: item.anonymous ? 'Anônimo' : item.supporterName,
        amountInCents: Number(item.amountInCents),
      }));
    if (type === 'RANKING' || type === 'SUPPORTERS_PANEL') {
      const totals = new Map<string, number>();
      for (const item of intents) {
        const name = item.anonymous
          ? 'Anônimo'
          : item.supporterName || 'Apoiador';
        totals.set(name, (totals.get(name) ?? 0) + Number(item.amountInCents));
      }
      return [...totals.entries()]
        .map(([name, amountInCents]) => ({ name, amountInCents }))
        .sort((a, b) => b.amountInCents - a.amountInCents)
        .slice(0, 10);
    }
    return null;
  }

  private async owned(organizationId: string, widgetId: string) {
    const widget = await this.prisma.widget.findFirst({
      where: { id: widgetId, organizationId, deletedAt: null },
    });
    if (!widget) throw new NotFoundException('Widget não encontrado');
    return widget;
  }

  private widgetType(value: string): WidgetType {
    if (!TYPES.includes(value as WidgetType))
      throw new BadRequestException('Tipo de widget inválido');
    return value as WidgetType;
  }

  private config(
    type: WidgetType,
    input: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    const accent: string =
      typeof input.accent === 'string' && /^#[0-9a-f]{6}$/i.test(input.accent)
        ? input.accent
        : typeof DEFAULTS[type].accent === 'string'
          ? DEFAULTS[type].accent
          : '#a98cff';
    if (type === 'ALERT')
      return {
        accent,
        durationMs: this.integer(input.durationMs, 2000, 30000, 8000),
        minimumInCents: this.integer(input.minimumInCents, 0, 1_000_000, 100),
        showMessage: input.showMessage !== false,
      };
    if (type === 'QR_CODE')
      return {
        accent,
        label:
          typeof input.label === 'string'
            ? input.label.trim().slice(0, 80)
            : 'Apoie a live',
        size: this.integer(input.size, 120, 640, 280),
        background: input.background === 'solid' ? 'solid' : 'transparent',
        displayMode:
          input.displayMode === 'interval' ? 'interval' : 'persistent',
      };
    if (type === 'GOAL' || type === 'CAMPAIGN')
      return {
        accent,
        title:
          typeof input.title === 'string'
            ? input.title.trim().slice(0, 100)
            : type === 'GOAL'
              ? 'Meta da comunidade'
              : 'Vaquinha',
        showTitle: input.showTitle !== false,
        showAmount: input.showAmount !== false,
        format: input.format === 'compact' ? 'compact' : 'horizontal',
        hideWhenComplete: input.hideWhenComplete === true,
      };
    if (type === 'RANKING')
      return {
        accent,
        limit: this.integer(input.limit, 1, 20, 5),
        period: ['DAY', 'WEEK', 'MONTH', 'YEAR', 'ALL'].includes(
          String(input.period),
        )
          ? String(input.period)
          : 'MONTH',
        orientation:
          input.orientation === 'horizontal' ? 'horizontal' : 'vertical',
        showAmount: input.showAmount !== false,
      };
    if (type === 'SUPPORTERS_PANEL' || type === 'RECENT_CONTRIBUTIONS')
      return {
        accent,
        limit: this.integer(input.limit, 1, 20, 5),
        period: ['DAY', 'WEEK', 'MONTH', 'YEAR', 'ALL'].includes(
          String(input.period),
        )
          ? String(input.period)
          : 'MONTH',
        orientation:
          input.orientation === 'horizontal' ? 'horizontal' : 'vertical',
        showAmount: input.showAmount !== false,
      };
    if (type === 'SONG_PIX')
      return {
        accent,
        limit: this.integer(input.limit, 1, 10, 5),
        showSupporter: input.showSupporter !== false,
      };
    if (type === 'VIDEO_PIX')
      return {
        accent,
        limit: this.integer(input.limit, 1, 10, 5),
        showSupporter: input.showSupporter !== false,
      };
    if (type === 'MARATHON')
      return {
        accent,
        initialMinutes: this.integer(input.initialMinutes, 0, 100_000, 60),
        durationPerContribution: this.integer(
          input.durationPerContribution,
          0,
          86_400,
          60,
        ),
        clockFormat: input.clockFormat === 'mm:ss' ? 'mm:ss' : 'HH:mm:ss',
        warningSound: input.warningSound !== false,
      };
    if (type === 'BANNER')
      return {
        accent,
        text:
          typeof input.text === 'string'
            ? input.text.trim().slice(0, 500)
            : 'Acompanhe e apoie a transmissão',
        rotationSeconds: this.integer(input.rotationSeconds, 3, 300, 15),
        persistent: true,
      };
    if (type === 'CUSTOM_TEXT')
      return {
        accent,
        text:
          typeof input.text === 'string'
            ? input.text.trim().slice(0, 500)
            : 'Sua mensagem aparece aqui',
        fontSize: this.integer(input.fontSize, 12, 96, 32),
        persistent: true,
      };
    return { accent, limit: this.integer(input.limit, 1, 10, 5) };
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max
      ? value
      : fallback;
  }

  private access(token: string) {
    return {
      token,
      browserSourceUrl: `${process.env.OVERLAY_URL ?? 'http://localhost:3003'}?token=${token}`,
    };
  }

  private digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
