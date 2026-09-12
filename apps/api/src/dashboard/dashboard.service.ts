import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@streamos/database';
import Redis from 'ioredis';
import {
  createCipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../payments/payment-provider';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  normalizeAndValidatePixKey,
  normalizeAndValidateTaxId,
} from './financial-identity.policy';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(Redis) private readonly redis: Redis,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async onboarding(organizationId: string) {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { organizationId },
      select: {
        displayName: true,
        slug: true,
        bio: true,
        isPublished: true,
        minimumContributionInCents: true,
        onboardingCompletedAt: true,
        organization: {
          select: {
            complianceProfile: { select: { status: true } },
            walletSettings: {
              select: {
                legalName: true,
                taxIdMasked: true,
                financialTermsAcceptedAt: true,
                providerSubaccountStatus: true,
                providerWithdrawBlocked: true,
              },
            },
          },
        },
      },
    });
    return profile
      ? {
          ...profile,
          minimumContributionInCents: Number(
            profile.minimumContributionInCents,
          ),
        }
      : null;
  }

  async updateOnboarding(
    organizationId: string,
    actorUserId: string,
    input: {
      displayName: string;
      slug: string;
      bio?: string;
      avatarUrl?: string | null;
      coverUrl?: string | null;
      minimumContributionInCents: number;
      isPublished: boolean;
      legalName?: string;
      taxId?: string;
      financialTermsAccepted?: boolean;
    },
  ) {
    const displayName = input.displayName.trim();
    const slug = input.slug.trim().toLowerCase();
    const reservedSlugs = new Set([
      'alertas',
      'assinaturas',
      'c',
      'cadastro',
      'carteira',
      'central-da-live',
      'conta',
      'contribuicoes',
      'entrar',
      'metas',
      'moderacao',
      'onboarding',
      'plataforma',
      'recuperar-senha',
      'redefinir-senha',
      'saude',
      'songpix',
      'vaquinhas',
      'videopix',
      'widgets',
    ]);
    if (
      displayName.length < 2 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      reservedSlugs.has(slug) ||
      !Number.isInteger(input.minimumContributionInCents) ||
      input.minimumContributionInCents < 100 ||
      input.minimumContributionInCents > 1_000_000
    )
      throw new BadRequestException('Configuração de perfil inválida');
    const duplicate = await this.prisma.creatorProfile.findFirst({
      where: { slug, organizationId: { not: organizationId } },
    });
    if (duplicate)
      throw new BadRequestException('Este endereço já está em uso');
    const completedAt = new Date();
    const legalName = input.legalName?.trim().slice(0, 160) || null;
    const submittedTaxId = input.taxId?.trim() ?? '';
    const taxId = submittedTaxId
      ? normalizeAndValidateTaxId(submittedTaxId)
      : null;
    if (submittedTaxId && !taxId)
      throw new BadRequestException('CPF ou CNPJ inválido');
    const walletUpdate = taxId
      ? {
          legalName,
          taxIdHash: createHash('sha256').update(taxId).digest('hex'),
          taxIdMasked:
            taxId.length === 11
              ? `***.***.***-${taxId.slice(-2)}`
              : `**.***.***/****-${taxId.slice(-2)}`,
          taxIdCiphertext: this.encryptSecret(taxId),
          ...(input.financialTermsAccepted
            ? { financialTermsAcceptedAt: completedAt }
            : {}),
        }
      : null;
    const [, profile] = await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: organizationId },
        data: { name: displayName },
      }),
      this.prisma.creatorProfile.update({
        where: { organizationId },
        data: {
          displayName,
          slug,
          bio: input.bio?.trim().slice(0, 500) || null,
          avatarUrl: input.avatarUrl?.trim() || null,
          coverUrl: input.coverUrl?.trim() || null,
          minimumContributionInCents: BigInt(input.minimumContributionInCents),
          isPublished: input.isPublished,
          onboardingCompletedAt: completedAt,
        },
      }),
      ...(walletUpdate
        ? [
            this.prisma.walletSettings.upsert({
              where: { organizationId },
              update: walletUpdate,
              create: { organizationId, ...walletUpdate },
            }),
          ]
        : []),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'creator.onboarding.complete',
          targetType: 'CreatorProfile',
          metadata: { slug, published: input.isPublished },
        },
      }),
    ]);
    return {
      ...profile,
      minimumContributionInCents: Number(profile.minimumContributionInCents),
    };
  }

  async rotateOverlayToken(organizationId: string, actorUserId: string) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.overlayChannel.updateMany({
        where: { organizationId, widgetId: null, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.overlayChannel.create({
        data: {
          organizationId,
          tokenHash: createHash('sha256').update(token).digest('hex'),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'creator.overlay.rotate_token',
          targetType: 'OverlayChannel',
          metadata: {},
        },
      }),
    ]);
    return {
      token,
      browserSourceUrl: `${process.env.OVERLAY_URL ?? 'http://localhost:3003'}?token=${token}`,
    };
  }

  async overlayStatus(organizationId: string) {
    const channel = await this.prisma.overlayChannel.findFirst({
      where: { organizationId, widgetId: null, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        connectedAt: true,
        lastHeartbeatAt: true,
        disconnectedAt: true,
        playbackReceipts: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            status: true,
            startedAt: true,
            completedAt: true,
            failedAt: true,
            failureReason: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!channel) {
      return {
        configured: false,
        connected: false,
        lastHeartbeatAt: null,
        lastPlayback: null,
      };
    }
    const connected = Boolean(
      channel.lastHeartbeatAt &&
      Date.now() - channel.lastHeartbeatAt.getTime() < 45_000 &&
      (!channel.disconnectedAt ||
        channel.lastHeartbeatAt > channel.disconnectedAt),
    );
    return {
      configured: true,
      connected,
      createdAt: channel.createdAt,
      connectedAt: channel.connectedAt,
      lastHeartbeatAt: channel.lastHeartbeatAt,
      lastPlayback: channel.playbackReceipts[0] ?? null,
    };
  }

  async summary(organizationId: string) {
    const performanceStart = new Date();
    performanceStart.setUTCHours(0, 0, 0, 0);
    performanceStart.setUTCDate(performanceStart.getUTCDate() - 29);
    const [payments, goal, recent, balanceAccounts, performancePayments] =
      await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            organizationId,
            status: { in: ['CONFIRMED', 'SETTLED', 'AVAILABLE'] },
          },
          _sum: { amountInCents: true },
          _avg: { amountInCents: true },
          _count: true,
        }),
        this.prisma.goal.findFirst({
          where: { organizationId, active: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.paymentIntent.findMany({
          where: { organizationId, payment: { isNot: null } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            supporterName: true,
            anonymous: true,
            amountInCents: true,
            createdAt: true,
            status: true,
          },
        }),
        this.prisma.ledgerAccount.findMany({
          where: {
            organizationId,
            code: {
              in: ['creator_pending', 'creator_available', 'creator_blocked'],
            },
          },
          include: { postings: true },
        }),
        this.prisma.payment.findMany({
          where: {
            organizationId,
            status: { in: ['CONFIRMED', 'SETTLED', 'AVAILABLE'] },
            createdAt: { gte: performanceStart },
          },
          select: { amountInCents: true, confirmedAt: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
    const balance = (code: string) =>
      balanceAccounts
        .filter((account) => account.code === code)
        .flatMap((account) => account.postings)
        .reduce(
          (sum, posting) =>
            sum +
            (posting.direction === 'CREDIT'
              ? posting.amountInCents
              : -posting.amountInCents),
          0n,
        );
    const performance = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(performanceStart);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const daily = performancePayments.filter(
        (payment) =>
          (payment.confirmedAt ?? payment.createdAt)
            .toISOString()
            .slice(0, 10) === key,
      );
      return {
        date: key,
        revenueInCents: daily.reduce(
          (total, payment) => total + Number(payment.amountInCents),
          0,
        ),
        contributions: daily.length,
      };
    });
    return {
      revenueInCents: Number(payments._sum.amountInCents ?? 0n),
      averageTicketInCents: Number(payments._avg.amountInCents ?? 0),
      contributions: payments._count,
      pendingInCents: Number(balance('creator_pending')),
      availableInCents: Number(balance('creator_available')),
      blockedInCents: Number(balance('creator_blocked')),
      performance,
      goal: goal
        ? {
            title: goal.title,
            currentInCents: Number(goal.currentInCents),
            targetInCents: Number(goal.targetInCents),
            active: goal.active,
            deadline: goal.deadline,
            color: goal.color,
            imageUrl: goal.imageUrl,
            completionMessage: goal.completionMessage,
          }
        : null,
      recent: recent.map((item) => ({
        ...item,
        supporterName: item.anonymous ? 'Anônimo' : item.supporterName,
        amountInCents: Number(item.amountInCents),
      })),
    };
  }

  async operations(organizationId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const [
      intents,
      payments,
      receipts,
      channel,
      pendingOutbox,
      failedWebhooks,
      durableQueueDepth,
      deadLetterEvents,
      streamPendingResult,
      journalEntries,
    ] = await Promise.all([
      this.prisma.paymentIntent.count({
        where: { organizationId, createdAt: { gte: since } },
      }),
      this.prisma.payment.findMany({
        where: { organizationId, confirmedAt: { gte: since } },
        include: { paymentIntent: { select: { createdAt: true } } },
      }),
      this.prisma.overlayPlaybackReceipt.findMany({
        where: { organizationId, updatedAt: { gte: since } },
        select: {
          eventId: true,
          status: true,
          createdAt: true,
          startedAt: true,
        },
      }),
      this.prisma.overlayChannel.findFirst({
        where: { organizationId, widgetId: null, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.outboxEvent.count({
        where: { organizationId, publishedAt: null },
      }),
      this.prisma.webhookDelivery.count({
        where: { organizationId, status: 'FAILED', updatedAt: { gte: since } },
      }),
      this.redis.xlen('streamos:events:durable'),
      this.redis.xlen('streamos:events:dead-letter'),
      this.redis
        .xpending('streamos:events:durable', 'streamos:realtime-dispatch')
        .catch(() => [0]),
      this.prisma.journalEntry.findMany({
        where: { organizationId, createdAt: { gte: since } },
        include: { postings: true },
      }),
    ]);
    const confirmationTimes = payments.flatMap((payment) =>
      payment.confirmedAt
        ? [
            payment.confirmedAt.getTime() -
              payment.paymentIntent.createdAt.getTime(),
          ]
        : [],
    );
    const playbackTotal = receipts.length;
    const playbackFailures = receipts.filter((item) =>
      ['FAILED', 'MEDIA_FAILED'].includes(item.status),
    ).length;
    const receiptEvents = await this.prisma.outboxEvent.findMany({
      where: { id: { in: receipts.map((receipt) => receipt.eventId) } },
      select: { id: true, occurredAt: true, payload: true },
    });
    const eventById = new Map(receiptEvents.map((event) => [event.id, event]));
    const queueItemIds = receiptEvents.flatMap((event) => {
      const payload = event.payload as Record<string, unknown>;
      return typeof payload.queueItemId === 'string'
        ? [payload.queueItemId]
        : [];
    });
    const queueItems = await this.prisma.liveQueueItem.findMany({
      where: { organizationId, id: { in: queueItemIds } },
      select: { id: true, createdAt: true },
    });
    const queueCreatedAt = new Map(
      queueItems.map((item) => [item.id, item.createdAt]),
    );
    const alertStartTimes = receipts.flatMap((receipt) => {
      const event = eventById.get(receipt.eventId);
      const payload = event?.payload as Record<string, unknown> | undefined;
      const queueItemId =
        typeof payload?.queueItemId === 'string' ? payload.queueItemId : null;
      const queuedAt = queueItemId ? queueCreatedAt.get(queueItemId) : null;
      return receipt.startedAt && queuedAt
        ? [receipt.startedAt.getTime() - queuedAt.getTime()]
        : [];
    });
    const overlayDeliveryTimes = receipts.flatMap((receipt) =>
      receipt.startedAt
        ? [
            receipt.startedAt.getTime() -
              (eventById.get(receipt.eventId)?.occurredAt.getTime() ??
                receipt.createdAt.getTime()),
          ]
        : [],
    );
    const playbackFailurePercent = playbackTotal
      ? Math.round((playbackFailures / playbackTotal) * 10_000) / 100
      : 0;
    const overlayConnected = channel?.lastHeartbeatAt
      ? Date.now() - channel.lastHeartbeatAt.getTime() < 45_000
      : false;
    const alertDeliveryMet =
      !overlayDeliveryTimes.length ||
      this.percentile(overlayDeliveryTimes, 95) <= 2_000;
    const paymentIds = new Set(payments.map((payment) => payment.id));
    const journalPaymentIds = new Set(
      journalEntries
        .filter((entry) => entry.type === 'payment_confirmed')
        .map((entry) => entry.referenceId),
    );
    const missingJournalEntries = [...paymentIds].filter(
      (id) => !journalPaymentIds.has(id),
    ).length;
    const unbalancedJournalEntries = journalEntries.filter((entry) => {
      const total = (direction: 'DEBIT' | 'CREDIT') =>
        entry.postings
          .filter((posting) => posting.direction === direction)
          .reduce((sum, posting) => sum + posting.amountInCents, 0n);
      return total('DEBIT') !== total('CREDIT');
    }).length;
    const reconciliationDivergences =
      missingJournalEntries + unbalancedJournalEntries;
    const platformRevenueInCents = Number(
      payments.reduce((sum, payment) => sum + payment.platformFeeInCents, 0n),
    );
    const providerFeesInCents = Number(
      payments.reduce((sum, payment) => sum + payment.providerFeeInCents, 0n),
    );
    // A tarifa do PSP é repassada no cálculo do líquido do criador. Não pode
    // ser abatida novamente da receita da plataforma.
    const netPlatformMarginInCents = platformRevenueInCents;
    const backup = await this.backupStatus();
    const gateReasons = [
      ...(!overlayConnected ? ['Overlay do OBS desconectado'] : []),
      ...(pendingOutbox > 0 ? [`${pendingOutbox} eventos pendentes`] : []),
      ...(failedWebhooks > 0 ? [`${failedWebhooks} webhooks com falha`] : []),
      ...(deadLetterEvents > 0
        ? [`${deadLetterEvents} eventos em dead-letter`]
        : []),
      ...(playbackFailurePercent > 2
        ? [`Falhas de reprodução em ${playbackFailurePercent}%`]
        : []),
      ...(!alertDeliveryMet ? ['SLO de entrega ao OBS não atingido'] : []),
    ];
    if (reconciliationDivergences)
      gateReasons.push(
        `${reconciliationDivergences} divergências de conciliação`,
      );
    if (payments.length && netPlatformMarginInCents < 0)
      gateReasons.push(
        `Margem operacional negativa em R$ ${Math.abs(netPlatformMarginInCents / 100).toFixed(2)}`,
      );
    if (!backup.healthy) gateReasons.push(backup.reason);
    return {
      periodHours: 24,
      checkedAt: new Date(),
      psp: {
        provider: (process.env.PAYMENT_PROVIDER ?? 'mock').toUpperCase(),
        environment:
          process.env.NODE_ENV === 'production' ? 'Produção' : 'Sandbox local',
        credentialsConfigured: Boolean(process.env.WOOVI_APP_ID),
        webhookConfigured: Boolean(process.env.WOOVI_WEBHOOK_AUTHORIZATION),
        pixOutEnabled:
          (process.env.PAYOUTS_ENABLED ?? 'false').toLowerCase() === 'true',
        kycKyb: process.env.PSP_KYC_STATUS ?? 'PENDING',
        medHandling:
          (process.env.PAYMENT_PROVIDER ?? 'mock').toLowerCase() === 'woovi'
            ? 'Configurado'
            : 'Simulado',
      },
      infrastructure: {
        postgresql: 'ONLINE',
        redis:
          this.redis.status === 'ready'
            ? 'ONLINE'
            : this.redis.status.toUpperCase(),
        worker: deadLetterEvents === 0 ? 'OPERACIONAL' : 'ATENÇÃO',
        realtime: overlayConnected ? 'CONECTADO' : 'SEM OVERLAY',
      },
      flags: {
        paymentsEnabled:
          (process.env.PAYMENTS_ENABLED ?? 'true').toLowerCase() === 'true',
        payoutsEnabled:
          (process.env.PAYOUTS_ENABLED ?? 'false').toLowerCase() === 'true',
        videoPixEnabled:
          (process.env.VIDEOPIX_ENABLED ?? 'true').toLowerCase() === 'true',
        songPixEnabled:
          (process.env.SONGPIX_ENABLED ?? 'true').toLowerCase() === 'true',
        subscriptionsEnabled:
          (process.env.SUBSCRIPTIONS_ENABLED ?? 'true').toLowerCase() ===
          'true',
      },
      paymentIntents: intents,
      confirmedPayments: payments.length,
      conversionPercent: intents
        ? Math.round((payments.length / intents) * 10_000) / 100
        : 0,
      averageConfirmationMs: confirmationTimes.length
        ? Math.round(
            confirmationTimes.reduce((sum, value) => sum + value, 0) /
              confirmationTimes.length,
          )
        : 0,
      p95ConfirmationMs: this.percentile(confirmationTimes, 95),
      p95AlertStartMs: this.percentile(alertStartTimes, 95),
      p95OverlayDeliveryMs: this.percentile(overlayDeliveryTimes, 95),
      playbackFailurePercent,
      slo: {
        paymentConfirmationTargetMs: 10_000,
        paymentConfirmationMet:
          !confirmationTimes.length ||
          this.percentile(confirmationTimes, 95) <= 10_000,
        alertStartTargetMs: 2_000,
        alertStartMet: alertDeliveryMet,
      },
      betaGate: { ready: gateReasons.length === 0, reasons: gateReasons },
      grossInCents: Number(
        payments.reduce((sum, payment) => sum + payment.amountInCents, 0n),
      ),
      platformRevenueInCents,
      providerFeesInCents,
      netPlatformMarginInCents,
      reconciliation: {
        healthy: reconciliationDivergences === 0,
        divergences: reconciliationDivergences,
        missingJournalEntries,
        unbalancedJournalEntries,
      },
      backup,
      playbackTotal,
      playbackFailures,
      overlayConnected,
      lastHeartbeatAt: channel?.lastHeartbeatAt ?? null,
      pendingOutbox,
      failedWebhooks,
      durableQueueDepth,
      streamPending: Number(streamPendingResult[0] ?? 0),
      deadLetterEvents,
    };
  }

  private async backupStatus() {
    const directory = process.env.BACKUP_DIRECTORY
      ? resolve(process.env.BACKUP_DIRECTORY)
      : resolve(process.cwd(), '../../.runtime/backups');
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      const dates = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            try {
              const manifest = JSON.parse(
                await readFile(
                  resolve(directory, entry.name, 'manifest.json'),
                  'utf8',
                ),
              ) as { createdAt?: string };
              const date = manifest.createdAt
                ? new Date(manifest.createdAt)
                : null;
              return date && !Number.isNaN(date.getTime()) ? date : null;
            } catch {
              return null;
            }
          }),
      );
      const latest = dates
        .filter((date): date is Date => date !== null)
        .sort((left, right) => right.getTime() - left.getTime())[0];
      if (!latest)
        return {
          healthy: false,
          lastBackupAt: null,
          ageHours: null,
          reason: 'Nenhum backup válido encontrado',
        };
      const ageHours =
        Math.round(((Date.now() - latest.getTime()) / 3_600_000) * 10) / 10;
      return {
        healthy: ageHours <= 26,
        lastBackupAt: latest,
        ageHours,
        reason: ageHours <= 26 ? '' : `Último backup tem ${ageHours} horas`,
      };
    } catch {
      return {
        healthy: false,
        lastBackupAt: null,
        ageHours: null,
        reason: 'Diretório de backup indisponível',
      };
    }
  }

  private percentile(values: number[], percentile: number) {
    if (!values.length) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.ceil((percentile / 100) * sorted.length) - 1] ?? 0;
  }

  async wallet(organizationId: string) {
    const [accounts, entries, payouts, received] = await Promise.all([
      this.prisma.ledgerAccount.findMany({
        where: { organizationId },
        include: { postings: true },
      }),
      this.prisma.journalEntry.findMany({
        where: { organizationId },
        orderBy: { occurredAt: 'desc' },
        take: 100,
        include: {
          postings: { include: { ledgerAccount: true } },
        },
      }),
      this.prisma.payout.findMany({
        where: { organizationId },
        orderBy: { requestedAt: 'desc' },
        take: 20,
      }),
      this.prisma.payment.aggregate({
        where: {
          organizationId,
          status: { in: ['CONFIRMED', 'SETTLED', 'AVAILABLE'] },
        },
        _sum: { creatorNetInCents: true },
      }),
    ]);
    const accountBalance = (code: string) =>
      accounts
        .filter((account) => account.code === code)
        .flatMap((account) => account.postings)
        .reduce(
          (sum, posting) =>
            sum +
            (posting.direction === 'CREDIT'
              ? posting.amountInCents
              : -posting.amountInCents),
          0n,
        );
    return {
      balances: {
        pendingInCents: Number(accountBalance('creator_pending')),
        availableInCents: Number(accountBalance('creator_available')),
        blockedInCents: Number(accountBalance('creator_blocked')),
        inPayoutInCents: Number(
          payouts
            .filter((item) => ['REQUESTED', 'PROCESSING'].includes(item.status))
            .reduce((sum, item) => sum + item.amountInCents, 0n),
        ),
        totalReceivedInCents: Number(received._sum.creatorNetInCents ?? 0n),
      },
      entries: entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        description: entry.description,
        occurredAt: entry.occurredAt,
        postings: entry.postings.map((posting) => ({
          account: posting.ledgerAccount.name,
          code: posting.ledgerAccount.code,
          direction: posting.direction,
          amountInCents: Number(posting.amountInCents),
        })),
      })),
      payouts: payouts.map((payout) => ({
        ...payout,
        amountInCents: Number(payout.amountInCents),
      })),
    };
  }

  async walletSettings(organizationId: string) {
    let settings = await this.prisma.walletSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
    if (settings.providerSubaccountId && this.paymentProvider.getSubaccount) {
      try {
        const provider = await this.paymentProvider.getSubaccount(
          settings.providerSubaccountId,
        );
        settings = await this.prisma.walletSettings.update({
          where: { organizationId },
          data: {
            providerSubaccountStatus: provider.withdrawBlocked
              ? 'WITHDRAW_BLOCKED'
              : 'VERIFIED',
            providerWithdrawBlocked: provider.withdrawBlocked,
            providerSyncedAt: new Date(),
          },
        });
      } catch {
        settings = await this.prisma.walletSettings.update({
          where: { organizationId },
          data: { providerSubaccountStatus: 'REQUIRES_ATTENTION' },
        });
      }
    }
    return this.serializeWalletSettings(settings);
  }

  async updatePixKey(
    organizationId: string,
    actorUserId: string,
    input: { type: string; value: string },
  ) {
    const type = input.type.trim().toUpperCase();
    const allowed = new Set(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']);
    const normalized = allowed.has(type)
      ? normalizeAndValidatePixKey(type, input.value)
      : null;
    if (!normalized) throw new BadRequestException('Chave Pix inválida');
    const [pendingPayouts, currentWallet] = await Promise.all([
      this.prisma.payout.count({
        where: {
          organizationId,
          status: { in: ['REQUESTED', 'PROCESSING'] },
        },
      }),
      this.prisma.walletSettings.findUnique({ where: { organizationId } }),
    ]);
    if (pendingPayouts > 0)
      throw new BadRequestException(
        'A chave Pix não pode ser alterada enquanto existe um saque em andamento.',
      );
    if (
      this.paymentProvider.name === 'woovi' &&
      (!currentWallet?.legalName ||
        !currentWallet.taxIdCiphertext ||
        !currentWallet.financialTermsAcceptedAt)
    )
      throw new BadRequestException(
        'Conclua seus dados legais e aceite os termos financeiros antes de criar a carteira.',
      );
    const pixKeyHash = createHash('sha256').update(normalized).digest('hex');
    const pixKeyMasked = this.maskPixKey(type, normalized);
    const pixKeyCiphertext = this.encryptSecret(normalized);
    const verifiedAt = new Date();
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    });
    const providerSubaccount = this.paymentProvider.createSubaccount
      ? await this.paymentProvider.createSubaccount({
          name: organization.name,
          pixKey: normalized,
        })
      : null;
    const [, settings] = await this.prisma.$transaction([
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'wallet.pix_key.update',
          targetType: 'WalletSettings',
          metadata: { type, masked: pixKeyMasked },
        },
      }),
      this.prisma.walletSettings.upsert({
        where: { organizationId },
        update: {
          pixKeyType: type,
          pixKeyHash,
          pixKeyMasked,
          pixKeyCiphertext,
          pixKeyVerifiedAt: verifiedAt,
          providerSubaccountId: providerSubaccount?.id,
          providerSubaccountStatus: providerSubaccount ? 'VERIFIED' : 'SANDBOX',
          providerWithdrawBlocked: providerSubaccount?.withdrawBlocked ?? false,
          providerSyncedAt: providerSubaccount ? verifiedAt : null,
        },
        create: {
          organizationId,
          pixKeyType: type,
          pixKeyHash,
          pixKeyMasked,
          pixKeyCiphertext,
          pixKeyVerifiedAt: verifiedAt,
          providerSubaccountId: providerSubaccount?.id,
          providerSubaccountStatus: providerSubaccount ? 'VERIFIED' : 'SANDBOX',
          providerWithdrawBlocked: providerSubaccount?.withdrawBlocked ?? false,
          providerSyncedAt: providerSubaccount ? verifiedAt : null,
        },
      }),
    ]);
    return this.serializeWalletSettings(settings);
  }

  async receivables(organizationId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        status: { in: ['CONFIRMED', 'SETTLED', 'AVAILABLE'] },
      },
      include: { paymentIntent: true },
      orderBy: { confirmedAt: 'desc' },
      take: 100,
    });
    return payments.map((payment) => {
      const confirmedAt = payment.confirmedAt ?? payment.createdAt;
      return {
        id: payment.id,
        supporterName: payment.paymentIntent.anonymous
          ? 'Anônimo'
          : payment.paymentIntent.supporterName,
        grossInCents: Number(payment.amountInCents),
        platformFeeInCents: Number(payment.platformFeeInCents),
        providerFeeInCents: Number(payment.providerFeeInCents),
        totalFeeInCents: Number(
          payment.platformFeeInCents + payment.providerFeeInCents,
        ),
        netInCents: Number(payment.creatorNetInCents),
        status: payment.status,
        confirmedAt,
        expectedAvailabilityAt:
          payment.availableAt ??
          new Date(confirmedAt.getTime() + 2 * 24 * 60 * 60 * 1000),
      };
    });
  }

  async statement(
    organizationId: string,
    filters: { type?: string; from?: string; to?: string },
  ) {
    const occurredAt: { gte?: Date; lte?: Date } = {};
    if (filters.from) {
      const value = new Date(`${filters.from}T00:00:00.000Z`);
      if (Number.isNaN(value.getTime()))
        throw new BadRequestException('Data inicial inválida');
      occurredAt.gte = value;
    }
    if (filters.to) {
      const value = new Date(`${filters.to}T23:59:59.999Z`);
      if (Number.isNaN(value.getTime()))
        throw new BadRequestException('Data final inválida');
      occurredAt.lte = value;
    }
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        ...(filters.type ? { type: filters.type } : {}),
        ...(Object.keys(occurredAt).length ? { occurredAt } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: 500,
      include: { postings: { include: { ledgerAccount: true } } },
    });
    return entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      referenceId: entry.referenceId,
      description: entry.description,
      occurredAt: entry.occurredAt,
      postings: entry.postings.map((posting) => ({
        account: posting.ledgerAccount.name,
        code: posting.ledgerAccount.code,
        direction: posting.direction,
        amountInCents: Number(posting.amountInCents),
      })),
    }));
  }

  async statementCsv(
    organizationId: string,
    filters: { type?: string; from?: string; to?: string },
  ) {
    const entries = await this.statement(organizationId, filters);
    const escape = (value: string | number) =>
      `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      [
        'data',
        'tipo',
        'referencia',
        'descricao',
        'conta',
        'direcao',
        'valor_centavos',
      ],
      ...entries.flatMap((entry) =>
        entry.postings.map((posting) => [
          entry.occurredAt.toISOString(),
          entry.type,
          entry.referenceId,
          entry.description ?? '',
          posting.code,
          posting.direction,
          posting.amountInCents,
        ]),
      ),
    ];
    return `\uFEFF${rows.map((row) => row.map(escape).join(';')).join('\r\n')}\r\n`;
  }

  async payout(organizationId: string, payoutId: string) {
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, organizationId },
    });
    if (!payout) throw new NotFoundException('Saque não encontrado');
    return { ...payout, amountInCents: Number(payout.amountInCents) };
  }

  private serializeWalletSettings(settings: {
    legalName: string | null;
    taxIdMasked: string | null;
    financialTermsAcceptedAt: Date | null;
    pixKeyType: string | null;
    pixKeyMasked: string | null;
    pixKeyVerifiedAt: Date | null;
    providerSubaccountId: string | null;
    providerSubaccountStatus: string;
    providerWithdrawBlocked: boolean;
    providerSyncedAt: Date | null;
    minimumPayoutInCents: bigint;
    dailyPayoutLimitInCents: bigint;
    monthlyPayoutLimitInCents: bigint;
  }) {
    return {
      legalName: settings.legalName,
      taxIdMasked: settings.taxIdMasked,
      financialTermsAcceptedAt: settings.financialTermsAcceptedAt,
      legalProfileCompleted: Boolean(
        settings.legalName &&
        settings.taxIdMasked &&
        settings.financialTermsAcceptedAt,
      ),
      pixKeyType: settings.pixKeyType,
      pixKeyMasked: settings.pixKeyMasked,
      pixKeyVerifiedAt: settings.pixKeyVerifiedAt,
      providerSubaccountConfigured: Boolean(settings.providerSubaccountId),
      providerSubaccountStatus: settings.providerSubaccountStatus,
      providerWithdrawBlocked: settings.providerWithdrawBlocked,
      providerSyncedAt: settings.providerSyncedAt,
      minimumPayoutInCents: Number(settings.minimumPayoutInCents),
      dailyPayoutLimitInCents: Number(settings.dailyPayoutLimitInCents),
      monthlyPayoutLimitInCents: Number(settings.monthlyPayoutLimitInCents),
    };
  }

  private maskPixKey(type: string, value: string) {
    if (type === 'EMAIL') {
      const [name = '', domain = ''] = value.split('@');
      return `${name.slice(0, 2)}***@${domain}`;
    }
    const visible = value.slice(-4);
    return `${'*'.repeat(Math.min(8, Math.max(3, value.length - 4)))}${visible}`;
  }

  private encryptSecret(value: string) {
    const key = createHash('sha256')
      .update(
        process.env.APP_ENCRYPTION_KEY ??
          'streamos-local-development-encryption-key',
      )
      .digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  async contributions(organizationId: string) {
    const intents = await this.prisma.paymentIntent.findMany({
      where: { organizationId, payment: { isNot: null } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        payment: true,
        songRequest: true,
        videoRequest: true,
        campaignContribution: true,
      },
    });
    const paymentIds = intents.flatMap((intent) =>
      intent.payment?.id ? [intent.payment.id] : [],
    );
    const events = paymentIds.length
      ? await this.prisma.outboxEvent.findMany({
          where: {
            organizationId,
            aggregateId: { in: paymentIds },
            eventType: 'payment.confirmed.v1',
          },
          select: {
            id: true,
            aggregateId: true,
            occurredAt: true,
            publishedAt: true,
            attempts: true,
            lastError: true,
          },
        })
      : [];
    const eventByPayment = new Map(
      events.map((event) => [event.aggregateId, event]),
    );
    const eventIds = events.map((event) => event.id);
    const receipts = eventIds.length
      ? await this.prisma.overlayPlaybackReceipt.findMany({
          where: { organizationId, eventId: { in: eventIds } },
          orderBy: { updatedAt: 'desc' },
        })
      : [];
    const receiptByEvent = new Map(
      receipts.map((receipt) => [receipt.eventId, receipt]),
    );
    return intents.map((intent) => ({
      id: intent.payment?.id,
      intentId: intent.id,
      supporterName: intent.anonymous ? 'Anônimo' : intent.supporterName,
      message: intent.message,
      anonymous: intent.anonymous,
      amountInCents: Number(intent.amountInCents),
      platformFeeInCents: Number(intent.payment?.platformFeeInCents ?? 0n),
      providerFeeInCents: Number(intent.payment?.providerFeeInCents ?? 0n),
      netInCents: Number(intent.payment?.creatorNetInCents ?? 0n),
      status: intent.payment?.status,
      confirmedAt: intent.payment?.confirmedAt,
      createdAt: intent.createdAt,
      type: intent.videoRequest
        ? 'VIDEO'
        : intent.songRequest
          ? 'SONG'
          : intent.campaignContribution
            ? 'CAMPAIGN'
            : 'TEXT',
      mediaTitle:
        intent.videoRequest?.title ?? intent.songRequest?.title ?? null,
      thumbnailUrl:
        intent.videoRequest?.thumbnailUrl ??
        intent.songRequest?.artworkUrl ??
        null,
      trace: (() => {
        const event = intent.payment?.id
          ? eventByPayment.get(intent.payment.id)
          : undefined;
        const receipt = event ? receiptByEvent.get(event.id) : undefined;
        return {
          provider: intent.provider,
          providerReference: intent.providerReference,
          intentCreatedAt: intent.createdAt,
          paymentConfirmedAt: intent.payment?.confirmedAt,
          webhookProcessed: Boolean(intent.payment?.confirmedAt),
          ledgerRecorded: Boolean(intent.payment),
          queuedAt: event?.occurredAt ?? null,
          dispatchedAt: event?.publishedAt ?? null,
          dispatchAttempts: event?.attempts ?? 0,
          dispatchError: event?.lastError ?? null,
          overlayStatus: receipt?.status ?? 'PENDING',
          overlayStartedAt: receipt?.startedAt ?? null,
          overlayCompletedAt: receipt?.completedAt ?? null,
          overlayFailure: receipt?.failureReason ?? null,
          correlationId: event?.id ?? null,
        };
      })(),
    }));
  }

  async updateGoal(
    organizationId: string,
    input: {
      title: string;
      targetInCents: number;
      active?: boolean;
      deadline?: string | null;
      color?: string;
      imageUrl?: string | null;
      completionMessage?: string | null;
    },
  ) {
    if (
      input.title.trim().length < 2 ||
      !Number.isInteger(input.targetInCents) ||
      input.targetInCents < 100
    )
      throw new BadRequestException('Meta inválida');
    const deadline = input.deadline ? new Date(input.deadline) : null;
    if (deadline && Number.isNaN(deadline.getTime()))
      throw new BadRequestException('Prazo inválido');
    const color = /^#[0-9a-f]{6}$/i.test(input.color ?? '')
      ? input.color
      : '#7c5cff';
    const presentation = {
      deadline,
      color,
      imageUrl: input.imageUrl?.trim() || null,
      completionMessage: input.completionMessage?.trim() || null,
    };
    const existing = await this.prisma.goal.findFirst({
      where: { organizationId, active: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) {
      const goal = await this.prisma.goal.create({
        data: {
          organizationId,
          title: input.title.trim(),
          targetInCents: BigInt(input.targetInCents),
          active: input.active ?? true,
          ...presentation,
        },
      });
      return this.serializeGoal(goal);
    }
    const goal = await this.prisma.goal.update({
      where: { id: existing.id },
      data: {
        title: input.title.trim(),
        targetInCents: BigInt(input.targetInCents),
        active: input.active ?? true,
        ...presentation,
      },
    });
    return this.serializeGoal(goal);
  }

  alertConfig(organizationId: string) {
    return this.prisma.alertConfig
      .findUnique({ where: { organizationId } })
      .then((config) => (config ? this.serializeAlertConfig(config) : null));
  }

  async updateAlertConfig(
    organizationId: string,
    input: {
      enabled: boolean;
      minimumInCents: number;
      durationMs: number;
      accent: string;
    },
  ) {
    if (
      !Number.isInteger(input.minimumInCents) ||
      input.minimumInCents < 0 ||
      !Number.isInteger(input.durationMs) ||
      input.durationMs < 2_000 ||
      input.durationMs > 30_000 ||
      !/^#[0-9a-f]{6}$/i.test(input.accent)
    )
      throw new BadRequestException('Configuração de alerta inválida');
    const config = await this.prisma.alertConfig.upsert({
      where: { organizationId },
      update: {
        enabled: input.enabled,
        minimumInCents: BigInt(input.minimumInCents),
        durationMs: input.durationMs,
        theme: { template: 'neon-pulse', accent: input.accent },
      },
      create: {
        organizationId,
        enabled: input.enabled,
        minimumInCents: BigInt(input.minimumInCents),
        durationMs: input.durationMs,
        theme: { template: 'neon-pulse', accent: input.accent },
      },
    });
    return this.serializeAlertConfig(config);
  }

  async testAlert(organizationId: string) {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { organizationId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');
    const now = new Date();
    const event = await this.prisma.outboxEvent.create({
      data: {
        organizationId,
        eventType: 'alert.test.v1',
        eventVersion: 1,
        aggregateId: profile.id,
        correlationId: randomUUID(),
        payload: {
          amountInCents: '2000',
          supporterName: 'Teste StreamOS',
          message: 'Seu overlay está funcionando!',
        },
        occurredAt: now,
      },
    });
    return { eventId: event.id, queued: true };
  }

  private serializeGoal(goal: {
    id: string;
    title: string;
    targetInCents: bigint;
    currentInCents: bigint;
    active: boolean;
  }) {
    return {
      ...goal,
      targetInCents: Number(goal.targetInCents),
      currentInCents: Number(goal.currentInCents),
    };
  }

  private serializeAlertConfig(config: {
    enabled: boolean;
    minimumInCents: bigint;
    durationMs: number;
    theme: unknown;
  }) {
    return {
      ...config,
      minimumInCents: Number(config.minimumInCents),
    };
  }
}
