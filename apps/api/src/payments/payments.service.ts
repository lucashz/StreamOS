import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@streamos/database';
import { calculatePixFees } from '@streamos/ledger';
import { createDecipheriv, createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type ProviderWebhook,
} from './payment-provider';
import { useLocalSimulatedCharge } from './mock-payment.policy';
import { findBlockingPrechargePolicy } from './precharge-moderation.policy';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async creator(slug: string) {
    const creator = await this.prisma.creatorProfile.findFirst({
      where: { slug, isPublished: true },
      select: {
        displayName: true,
        slug: true,
        bio: true,
        avatarUrl: true,
        coverUrl: true,
        organizationId: true,
        minimumContributionInCents: true,
      },
    });
    return creator
      ? {
          ...creator,
          minimumContributionInCents: Number(
            creator.minimumContributionInCents,
          ),
        }
      : null;
  }

  async createIntent(
    slug: string,
    input: {
      amountInCents: number;
      supporterName?: string;
      message?: string;
      anonymous?: boolean;
      ttsVoice?: string;
    },
  ) {
    const creator = await this.creator(slug);
    if (!creator) throw new NotFoundException('Criador não encontrado');
    await this.assertContributionAllowed(
      creator.organizationId,
      input.amountInCents,
    );
    if (
      !Number.isInteger(input.amountInCents) ||
      input.amountInCents < Number(creator.minimumContributionInCents) ||
      input.amountInCents > 1_000_000
    )
      throw new BadRequestException('Valor inválido');
    const intentId = randomUUID();
    await this.moderateBeforeCharge({
      organizationId: creator.organizationId,
      sourceId: intentId,
      supporterName: input.anonymous ? 'Anônimo' : input.supporterName,
      content: input.message,
      amountInCents: input.amountInCents,
    });
    const charge = await this.createChargeForOrganization(
      creator.organizationId,
      {
        amountInCents: BigInt(input.amountInCents),
        idempotencyKey: intentId,
        comment: input.message,
      },
    );
    const intent = await this.prisma.paymentIntent.create({
      data: {
        id: intentId,
        organizationId: creator.organizationId,
        provider: this.provider.name,
        providerReference: charge.reference,
        idempotencyKey: intentId,
        amountInCents: BigInt(input.amountInCents),
        supporterName: input.supporterName?.trim().slice(0, 60),
        message: input.message?.trim().slice(0, 300),
        anonymous: input.anonymous ?? false,
        ttsVoice: this.donateVoice(input.ttsVoice),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    return {
      id: intent.id,
      status: intent.status,
      amountInCents: Number(intent.amountInCents),
      pixCopyPaste: charge.pixCopyPaste,
      qrCodePayload: charge.qrCodePayload,
      expiresAt: intent.expiresAt,
    };
  }

  async createAudioIntent(
    slug: string,
    file:
      | { originalname: string; mimetype: string; size: number; buffer: Buffer }
      | undefined,
    input: {
      amountInCents: number;
      supporterName?: string;
      anonymous?: boolean;
      durationSeconds: number;
    },
  ) {
    const creator = await this.creator(slug);
    if (!creator) throw new NotFoundException('Criador não encontrado');
    if (!file) throw new BadRequestException('Áudio não enviado');
    const extensions: Record<string, string> = {
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/webm': '.webm',
      'audio/mp4': '.m4a',
    };
    const extension = extensions[file.mimetype];
    if (!extension || file.size < 1 || file.size > 5_000_000)
      throw new BadRequestException(
        'Use áudio MP3, OGG, WAV, WebM ou M4A de até 5 MB',
      );
    if (
      !Number.isFinite(input.durationSeconds) ||
      input.durationSeconds < 1 ||
      input.durationSeconds > 60
    )
      throw new BadRequestException('O áudio deve ter entre 1 e 60 segundos');
    await this.assertContributionAllowed(
      creator.organizationId,
      input.amountInCents,
    );
    if (
      !Number.isInteger(input.amountInCents) ||
      input.amountInCents < Number(creator.minimumContributionInCents) ||
      input.amountInCents > 1_000_000
    )
      throw new BadRequestException('Valor inválido');

    const intentId = randomUUID();
    const relative = join(
      'audio-donates',
      creator.organizationId,
      `${intentId}${extension}`,
    );
    const target = join(process.cwd(), '.runtime', 'uploads', relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.buffer, { flag: 'wx' });
    let charge;
    try {
      charge = await this.createChargeForOrganization(creator.organizationId, {
        amountInCents: BigInt(input.amountInCents),
        idempotencyKey: intentId,
        comment: 'Donate com áudio',
      });
    } catch (error) {
      await unlink(target).catch(() => undefined);
      throw error;
    }
    const publicApiUrl =
      process.env.PUBLIC_API_URL ??
      process.env.API_URL ??
      'http://localhost:3001';
    const audioUrl = `${publicApiUrl.replace(/\/$/, '')}/uploads/${relative.replaceAll('\\', '/')}`;
    const intent = await this.prisma.paymentIntent.create({
      data: {
        id: intentId,
        organizationId: creator.organizationId,
        provider: this.provider.name,
        providerReference: charge.reference,
        idempotencyKey: intentId,
        amountInCents: BigInt(input.amountInCents),
        supporterName: input.supporterName?.trim().slice(0, 60),
        message: 'Donate com áudio',
        anonymous: input.anonymous ?? false,
        alertType: 'AUDIO',
        audioUrl,
        audioDurationSeconds: Math.ceil(input.durationSeconds),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    return {
      id: intent.id,
      status: intent.status,
      amountInCents: Number(intent.amountInCents),
      pixCopyPaste: charge.pixCopyPaste,
      qrCodePayload: charge.qrCodePayload,
      expiresAt: intent.expiresAt,
    };
  }

  async createSongIntent(requestId: string) {
    const request = await this.prisma.songRequest.findUnique({
      where: { id: requestId },
      include: { session: true, paymentIntent: true },
    });
    if (!request) throw new NotFoundException('Pedido musical não encontrado');
    await this.assertContributionAllowed(
      request.session.organizationId,
      Number(request.amountInCents),
    );
    if (request.paymentIntent)
      return {
        id: request.paymentIntent.id,
        status: request.paymentIntent.status,
        amountInCents: Number(request.paymentIntent.amountInCents),
        expiresAt: request.paymentIntent.expiresAt,
        duplicated: true,
      };
    if (
      request.status !== 'AWAITING_PAYMENT' ||
      request.checkoutExpiresAt <= new Date() ||
      request.session.status !== 'OPEN'
    )
      throw new BadRequestException('Pedido musical expirado ou indisponível');
    const intentId = randomUUID();
    const charge = await this.createChargeForOrganization(
      request.session.organizationId,
      {
        amountInCents: request.amountInCents,
        idempotencyKey: intentId,
        comment: `SongPix: ${request.title} — ${request.artist}`,
      },
    );
    const intent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.paymentIntent.create({
        data: {
          id: intentId,
          organizationId: request.session.organizationId,
          provider: this.provider.name,
          providerReference: charge.reference,
          idempotencyKey: `songpix:${request.id}`,
          amountInCents: request.amountInCents,
          supporterName: request.supporterName,
          message: `SongPix: ${request.title} — ${request.artist}`,
          status: 'PENDING',
          expiresAt: request.checkoutExpiresAt,
        },
      });
      await tx.songRequest.update({
        where: { id: request.id },
        data: { paymentIntentId: created.id },
      });
      return created;
    });
    return {
      id: intent.id,
      status: intent.status,
      amountInCents: Number(intent.amountInCents),
      pixCopyPaste: charge.pixCopyPaste,
      qrCodePayload: charge.qrCodePayload,
      expiresAt: intent.expiresAt,
      duplicated: false,
    };
  }

  async createVideoIntent(requestId: string) {
    const request = await this.prisma.videoRequest.findUnique({
      where: { id: requestId },
      include: { session: true, paymentIntent: true },
    });
    if (!request) throw new NotFoundException('Pedido de vídeo não encontrado');
    await this.assertContributionAllowed(
      request.session.organizationId,
      Number(request.amountInCents),
    );
    if (request.paymentIntent)
      return {
        id: request.paymentIntent.id,
        status: request.paymentIntent.status,
        amountInCents: Number(request.paymentIntent.amountInCents),
        expiresAt: request.paymentIntent.expiresAt,
        duplicated: true,
      };
    if (
      request.status !== 'AWAITING_PAYMENT' ||
      request.checkoutExpiresAt <= new Date() ||
      request.session.status !== 'OPEN'
    )
      throw new BadRequestException('Pedido de vídeo expirado ou indisponível');
    const intentId = randomUUID();
    const charge = await this.createChargeForOrganization(
      request.session.organizationId,
      {
        amountInCents: request.amountInCents,
        idempotencyKey: intentId,
        comment: `VideoPix: ${request.title}`,
      },
    );
    const intent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.paymentIntent.create({
        data: {
          id: intentId,
          organizationId: request.session.organizationId,
          provider: this.provider.name,
          providerReference: charge.reference,
          idempotencyKey: `videopix:${request.id}`,
          amountInCents: request.amountInCents,
          supporterName: request.supporterName,
          message: `VideoPix: ${request.title}`,
          status: 'PENDING',
          expiresAt: request.checkoutExpiresAt,
        },
      });
      await tx.videoRequest.update({
        where: { id: request.id },
        data: { paymentIntentId: created.id },
      });
      return created;
    });
    return {
      id: intent.id,
      status: intent.status,
      amountInCents: Number(intent.amountInCents),
      pixCopyPaste: charge.pixCopyPaste,
      qrCodePayload: charge.qrCodePayload,
      expiresAt: intent.expiresAt,
      duplicated: false,
    };
  }

  async createCampaignIntent(
    campaignId: string,
    input: {
      amountInCents: number;
      supporterName?: string;
      message?: string;
      rewardId?: string;
    },
  ) {
    await this.releaseExpiredCampaignRewards();
    if (!Number.isInteger(input.amountInCents) || input.amountInCents < 100)
      throw new BadRequestException('Valor inválido');
    const campaign = await this.prisma.fundraisingCampaign.findFirst({
      where: { id: campaignId, status: 'PUBLISHED' },
      include: { rewards: true },
    });
    if (!campaign || (campaign.endsAt && campaign.endsAt <= new Date()))
      throw new BadRequestException('Vaquinha indisponível');
    const reward = input.rewardId
      ? campaign.rewards.find(
          (item) => item.id === input.rewardId && item.active,
        )
      : undefined;
    if (input.rewardId && !reward)
      throw new BadRequestException('Recompensa indisponível');
    if (reward && BigInt(input.amountInCents) < reward.minimumInCents)
      throw new BadRequestException('Valor insuficiente para a recompensa');
    const intentId = randomUUID();
    await this.moderateBeforeCharge({
      organizationId: campaign.organizationId,
      sourceId: intentId,
      supporterName: input.supporterName,
      content: input.message,
      amountInCents: input.amountInCents,
    });
    const charge = await this.createChargeForOrganization(
      campaign.organizationId,
      {
        amountInCents: BigInt(input.amountInCents),
        idempotencyKey: intentId,
        comment: input.message ?? `Apoio para ${campaign.title}`,
      },
    );
    const intent = await this.prisma.$transaction(async (tx) => {
      if (reward?.quantity != null) {
        const reserved = await tx.campaignReward.updateMany({
          where: {
            id: reward.id,
            active: true,
            claimedCount: { lt: reward.quantity },
          },
          data: { claimedCount: { increment: 1 } },
        });
        if (reserved.count !== 1)
          throw new BadRequestException('Recompensa esgotada');
      } else if (reward) {
        await tx.campaignReward.update({
          where: { id: reward.id },
          data: { claimedCount: { increment: 1 } },
        });
      }
      const created = await tx.paymentIntent.create({
        data: {
          id: intentId,
          organizationId: campaign.organizationId,
          provider: this.provider.name,
          providerReference: charge.reference,
          idempotencyKey: intentId,
          amountInCents: BigInt(input.amountInCents),
          supporterName: input.supporterName?.trim().slice(0, 60),
          message: input.message?.trim().slice(0, 300),
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      const contribution = await tx.campaignContribution.create({
        data: {
          organizationId: campaign.organizationId,
          campaignId: campaign.id,
          paymentIntentId: created.id,
          amountInCents: created.amountInCents,
          supporterName: created.supporterName,
        },
      });
      if (reward)
        await tx.rewardClaim.create({
          data: {
            rewardId: reward.id,
            campaignContributionId: contribution.id,
            status: 'RESERVED',
          },
        });
      return created;
    });
    return {
      id: intent.id,
      status: intent.status,
      amountInCents: Number(intent.amountInCents),
      pixCopyPaste: charge.pixCopyPaste,
      qrCodePayload: charge.qrCodePayload,
      expiresAt: intent.expiresAt,
    };
  }

  private async moderateBeforeCharge(input: {
    organizationId: string;
    sourceId: string;
    supporterName?: string;
    content?: string;
    amountInCents: number;
  }) {
    const content = input.content?.trim();
    if (!content) return;
    const config = await this.prisma.alertConfig.findUnique({
      where: { organizationId: input.organizationId },
      select: { moderationEnabled: true },
    });
    if (!config?.moderationEnabled) return;
    const policies = await this.prisma.moderationPolicy.findMany({
      where: { organizationId: input.organizationId, enabled: true },
    });
    const blocked = findBlockingPrechargePolicy(
      content,
      input.amountInCents,
      policies,
    );
    await this.prisma.moderationItem.create({
      data: {
        organizationId: input.organizationId,
        sourceType: 'PAYMENT_MESSAGE',
        sourceId: input.sourceId,
        supporterName: input.supporterName?.trim().slice(0, 60),
        content: content.slice(0, 300),
        amountInCents: BigInt(input.amountInCents),
        status: blocked ? 'REJECTED' : 'APPROVED',
        decisionReason: blocked
          ? `Política automática: ${blocked.name}`
          : 'Aprovado automaticamente antes da cobrança',
        decidedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
    if (blocked)
      throw new BadRequestException(
        'A mensagem foi bloqueada automaticamente antes da cobrança',
      );
  }

  private async releaseExpiredCampaignRewards() {
    const expired = await this.prisma.rewardClaim.findMany({
      where: {
        status: 'RESERVED',
        campaignContribution: {
          confirmedAt: null,
          paymentIntent: { expiresAt: { lte: new Date() } },
        },
      },
      select: { id: true, rewardId: true },
      take: 500,
    });
    for (const claim of expired) {
      await this.prisma.$transaction(async (tx) => {
        const released = await tx.rewardClaim.updateMany({
          where: { id: claim.id, status: 'RESERVED' },
          data: { status: 'EXPIRED' },
        });
        if (released.count === 1)
          await tx.campaignReward.update({
            where: { id: claim.rewardId },
            data: { claimedCount: { decrement: 1 } },
          });
      });
    }
  }

  async intentStatus(intentId: string) {
    let intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { payment: true },
    });
    if (!intent) throw new NotFoundException('Pagamento não encontrado');
    if (
      !intent.payment &&
      intent.status === 'PENDING' &&
      intent.provider === this.provider.name &&
      intent.providerReference &&
      this.provider.getCharge
    ) {
      const charge = await this.provider
        .getCharge(intent.providerReference)
        .catch(() => null);
      if (charge?.status === 'CONFIRMED') {
        await this.confirm(intent.id);
        const refreshed = await this.prisma.paymentIntent.findUnique({
          where: { id: intentId },
          include: { payment: true },
        });
        if (!refreshed) throw new NotFoundException('Pagamento não encontrado');
        intent = refreshed;
      }
    }
    const resolvedIntent = intent;
    return {
      id: resolvedIntent.id,
      status: resolvedIntent.payment?.status ?? resolvedIntent.status,
      amountInCents: Number(resolvedIntent.amountInCents),
      receiptId: resolvedIntent.payment?.id ?? null,
      confirmedAt: resolvedIntent.payment?.confirmedAt ?? null,
      expiresAt: resolvedIntent.expiresAt,
    };
  }

  async simulateProviderConfirmation(intentId: string) {
    if (!this.provider.confirmation) return this.confirm(intentId);
    if (!this.provider.confirmation)
      throw new NotFoundException('Simulação indisponível para este PSP');
    const { body, signature } = this.provider.confirmation(intentId);
    return this.processMockWebhook(body, signature);
  }

  async processMockWebhook(body: ProviderWebhook, signature?: string) {
    return this.processProviderWebhook(body, signature);
  }

  async processWooviWebhook(
    body: unknown,
    authorization?: string,
    rawBody?: Buffer,
    providerSignature?: string,
  ) {
    if (this.provider.name !== 'woovi') throw new NotFoundException();
    return this.processProviderWebhook(
      body,
      authorization,
      rawBody,
      providerSignature,
    );
  }

  private async processProviderWebhook(
    body: unknown,
    authorization?: string,
    rawBody?: Buffer,
    providerSignature?: string,
  ) {
    let normalized: ProviderWebhook;
    try {
      normalized = this.provider.parseWebhook(
        body,
        authorization,
        rawBody,
        providerSignature,
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Webhook inválido',
      );
    }
    if (
      !normalized.eventId ||
      !normalized.intentId ||
      normalized.type !== 'payment.confirmed'
    )
      throw new BadRequestException('Evento do PSP inválido');

    const payload = JSON.stringify(body);
    const existing = await this.prisma.providerWebhook.findUnique({
      where: {
        provider_providerEventId: {
          provider: this.provider.name,
          providerEventId: normalized.eventId,
        },
      },
    });
    if (existing) {
      const payment = await this.prisma.payment.findUnique({
        where: { paymentIntentId: normalized.intentId },
      });
      return {
        paymentId: payment?.id,
        status: payment?.status ?? 'PENDING',
        duplicated: true,
      };
    }

    const webhook = await this.prisma.providerWebhook.create({
      data: {
        provider: this.provider.name,
        providerEventId: normalized.eventId,
        idempotencyKey: `${this.provider.name}:${normalized.eventId}`,
        payload: {
          eventId: normalized.eventId,
          intentId: normalized.intentId,
          type: normalized.type,
          raw: body as object,
        },
        payloadHash: createHash('sha256').update(payload).digest('hex'),
      },
    });
    try {
      const result = await this.confirm(normalized.intentId);
      await this.prisma.providerWebhook.update({
        where: { id: webhook.id },
        data: { processedAt: new Date() },
      });
      return result;
    } catch (error) {
      await this.prisma.providerWebhook.update({
        where: { id: webhook.id },
        data: {
          failureReason: error instanceof Error ? error.message : 'unknown',
        },
      });
      throw error;
    }
  }

  async makeFundsAvailable(paymentId: string, organizationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
      });
      if (!payment) throw new NotFoundException('Pagamento não encontrado');
      if (payment.status === 'AVAILABLE')
        return { paymentId, status: payment.status, duplicated: true };
      if (payment.status !== 'CONFIRMED' && payment.status !== 'SETTLED')
        throw new BadRequestException('Pagamento não pode ser disponibilizado');

      const net = payment.creatorNetInCents;
      const [pending, available] = await Promise.all([
        tx.ledgerAccount.upsert({
          where: {
            organizationId_code: {
              organizationId,
              code: 'creator_pending',
            },
          },
          update: {},
          create: {
            organizationId,
            code: 'creator_pending',
            name: 'Saldo pendente do criador',
          },
        }),
        tx.ledgerAccount.upsert({
          where: {
            organizationId_code: {
              organizationId,
              code: 'creator_available',
            },
          },
          update: {},
          create: {
            organizationId,
            code: 'creator_available',
            name: 'Saldo disponível do criador',
          },
        }),
      ]);
      const now = new Date();
      await tx.journalEntry.create({
        data: {
          organizationId,
          type: 'funds_available',
          referenceId: payment.id,
          idempotencyKey: `payment:${payment.id}:available`,
          occurredAt: now,
          description: 'Disponibilização de pagamento mock',
          postings: {
            create: [
              {
                ledgerAccountId: pending.id,
                direction: 'DEBIT',
                amountInCents: net,
              },
              {
                ledgerAccountId: available.id,
                direction: 'CREDIT',
                amountInCents: net,
              },
            ],
          },
        },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'AVAILABLE', settledAt: now, availableAt: now },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId,
          eventType: 'funds.available.v1',
          eventVersion: 1,
          aggregateId: payment.id,
          correlationId: randomUUID(),
          causationId: payment.id,
          payload: { paymentId: payment.id, amountInCents: net.toString() },
          occurredAt: now,
        },
      });
      return { paymentId, status: 'AVAILABLE', duplicated: false };
    });
  }

  private async createChargeForOrganization(
    organizationId: string,
    input: { amountInCents: bigint; idempotencyKey: string; comment?: string },
  ) {
    if (useLocalSimulatedCharge(process.env, this.provider.name)) {
      const reference = `local_sim_${randomUUID()}`;
      return {
        reference,
        pixCopyPaste: `STREAMOS-LOCAL-${reference}`,
        qrCodePayload: `streamos://local/${reference}`,
        status: 'PENDING' as const,
      };
    }
    const wallet = await this.prisma.walletSettings.findUnique({
      where: { organizationId },
      select: {
        providerSubaccountId: true,
        providerSubaccountStatus: true,
        providerWithdrawBlocked: true,
        pixKeyCiphertext: true,
      },
    });
    if (this.provider.name === 'woovi') {
      if (
        !wallet?.providerSubaccountId ||
        wallet.providerSubaccountStatus !== 'VERIFIED' ||
        wallet.providerWithdrawBlocked ||
        !wallet.pixKeyCiphertext
      )
        throw new BadRequestException(
          'A carteira do criador ainda não está pronta para receber contribuições.',
        );
      const fees = calculatePixFees(input.amountInCents);
      return this.provider.createCharge({
        ...input,
        subaccountPixKey: this.decryptSecret(wallet.pixKeyCiphertext),
        subaccountAmountInCents: fees.creatorNetInCents,
      });
    }
    return this.provider.createCharge(input);
  }

  async payout(
    organizationId: string,
    actorUserId: string,
    amountInCents: number,
    idempotencyKey: string,
  ) {
    if ((process.env.PAYOUTS_ENABLED ?? 'false').toLowerCase() !== 'true')
      throw new BadRequestException('Saques temporariamente indisponíveis');
    if (!Number.isInteger(amountInCents) || amountInCents <= 0)
      throw new BadRequestException('Valor de saque inválido');
    if (!idempotencyKey)
      throw new BadRequestException('Idempotency-Key ausente');
    const reserved = await this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.payout.findUnique({
        where: { idempotencyKey },
      });
      if (duplicate)
        return {
          payout: duplicate,
          ...((settings) => ({
            destinationCiphertext: settings?.pixKeyCiphertext,
            providerSubaccountId: settings?.providerSubaccountId,
          }))(
            await tx.walletSettings.findUnique({ where: { organizationId } }),
          ),
          duplicated: true,
        };
      const settings = await tx.walletSettings.findUnique({
        where: { organizationId },
      });
      if (
        !settings?.pixKeyHash ||
        !settings.pixKeyCiphertext ||
        !settings.pixKeyVerifiedAt ||
        (this.provider.name === 'woovi' &&
          (!settings.providerSubaccountId ||
            settings.providerSubaccountStatus !== 'VERIFIED' ||
            settings.providerWithdrawBlocked))
      )
        throw new BadRequestException(
          'Cadastre novamente e valide sua chave Pix antes de sacar',
        );
      const amount = BigInt(amountInCents);
      if (amount < settings.minimumPayoutInCents)
        throw new BadRequestException('Valor abaixo do mínimo para saque');
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [daily, monthly] = await Promise.all([
        tx.payout.aggregate({
          where: {
            organizationId,
            requestedAt: { gte: dayStart },
            status: { in: ['REQUESTED', 'PROCESSING', 'COMPLETED'] },
          },
          _sum: { amountInCents: true },
        }),
        tx.payout.aggregate({
          where: {
            organizationId,
            requestedAt: { gte: monthStart },
            status: { in: ['REQUESTED', 'PROCESSING', 'COMPLETED'] },
          },
          _sum: { amountInCents: true },
        }),
      ]);
      if (
        (daily._sum.amountInCents ?? 0n) + amount >
        settings.dailyPayoutLimitInCents
      )
        throw new BadRequestException('Limite diário de saques excedido');
      if (
        (monthly._sum.amountInCents ?? 0n) + amount >
        settings.monthlyPayoutLimitInCents
      )
        throw new BadRequestException('Limite mensal de saques excedido');
      const available = await tx.ledgerAccount.findUnique({
        where: {
          organizationId_code: { organizationId, code: 'creator_available' },
        },
        include: { postings: true },
      });
      const balance =
        available?.postings.reduce(
          (sum, posting) =>
            sum +
            (posting.direction === 'CREDIT'
              ? posting.amountInCents
              : -posting.amountInCents),
          0n,
        ) ?? 0n;
      if (!available || balance < amount)
        throw new BadRequestException('Saldo disponível insuficiente');
      const clearing = await tx.ledgerAccount.upsert({
        where: {
          organizationId_code: { organizationId, code: 'payout_clearing' },
        },
        update: {},
        create: {
          organizationId,
          code: 'payout_clearing',
          name: 'Compensação de saques',
        },
      });
      const payout = await tx.payout.create({
        data: {
          organizationId,
          idempotencyKey,
          amountInCents: amount,
          status: 'REQUESTED',
          destinationMasked: settings.pixKeyMasked,
          provider: this.provider.name,
        },
      });
      await tx.journalEntry.create({
        data: {
          organizationId,
          type: 'payout_requested',
          referenceId: payout.id,
          idempotencyKey: `payout:${payout.id}:requested`,
          occurredAt: now,
          description: 'Valor reservado para saque Pix',
          postings: {
            create: [
              {
                ledgerAccountId: available.id,
                direction: 'DEBIT',
                amountInCents: amount,
              },
              {
                ledgerAccountId: clearing.id,
                direction: 'CREDIT',
                amountInCents: amount,
              },
            ],
          },
        },
      });
      return {
        payout,
        destinationCiphertext: settings.pixKeyCiphertext,
        providerSubaccountId: settings.providerSubaccountId,
        duplicated: false,
      };
    });
    if (['COMPLETED', 'FAILED', 'CANCELED'].includes(reserved.payout.status))
      return {
        ...reserved.payout,
        amountInCents: Number(reserved.payout.amountInCents),
        duplicated: true,
      };
    if (
      !reserved.destinationCiphertext ||
      (!this.provider.requestPixOut && !this.provider.withdrawSubaccount)
    )
      throw new BadRequestException('Pix Out indisponível para este PSP');
    try {
      const providerPayout =
        reserved.payout.status === 'PROCESSING' &&
        reserved.payout.providerReference &&
        this.provider.getPixOut
          ? await this.provider.getPixOut(reserved.payout.providerReference)
          : this.provider.name === 'woovi' &&
              reserved.providerSubaccountId &&
              this.provider.withdrawSubaccount
            ? await this.provider.withdrawSubaccount({
                id: reserved.providerSubaccountId,
                amountInCents: reserved.payout.amountInCents,
                idempotencyKey,
              })
            : await this.provider.requestPixOut!({
                amountInCents: reserved.payout.amountInCents,
                destinationKey: this.decryptSecret(
                  reserved.destinationCiphertext,
                ),
                idempotencyKey,
              });
      return await this.finalizePayout(
        organizationId,
        actorUserId,
        reserved.payout.id,
        providerPayout,
        reserved.duplicated,
      );
    } catch (error) {
      await this.failPayout(
        organizationId,
        reserved.payout.id,
        error instanceof Error ? error.message : 'Falha desconhecida do PSP',
      );
      throw error;
    }
  }

  private async finalizePayout(
    organizationId: string,
    actorUserId: string,
    payoutId: string,
    providerPayout: { reference: string; status: string },
    duplicated: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findFirstOrThrow({
        where: { id: payoutId, organizationId },
      });
      if (payout.status === 'COMPLETED')
        return {
          ...payout,
          amountInCents: Number(payout.amountInCents),
          duplicated: true,
        };
      if (providerPayout.status !== 'PAID') {
        const processing = await tx.payout.update({
          where: { id: payout.id },
          data: {
            status: 'PROCESSING',
            providerReference: providerPayout.reference,
          },
        });
        return {
          ...processing,
          amountInCents: Number(processing.amountInCents),
          duplicated,
        };
      }
      const [clearing, providerPaid] = await Promise.all([
        tx.ledgerAccount.findUniqueOrThrow({
          where: {
            organizationId_code: { organizationId, code: 'payout_clearing' },
          },
        }),
        tx.ledgerAccount.upsert({
          where: {
            organizationId_code: { organizationId, code: 'provider_payout' },
          },
          update: {},
          create: {
            organizationId,
            code: 'provider_payout',
            name: 'Saques liquidados pelo PSP',
          },
        }),
      ]);
      const completed = await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          providerReference: providerPayout.reference,
          failureReason: null,
        },
      });
      await tx.journalEntry.create({
        data: {
          organizationId,
          type: 'payout_completed',
          referenceId: payout.id,
          idempotencyKey: `payout:${payout.id}:completed`,
          occurredAt: completed.completedAt!,
          description: 'Saque Pix confirmado pelo PSP',
          postings: {
            create: [
              {
                ledgerAccountId: clearing.id,
                direction: 'DEBIT',
                amountInCents: payout.amountInCents,
              },
              {
                ledgerAccountId: providerPaid.id,
                direction: 'CREDIT',
                amountInCents: payout.amountInCents,
              },
            ],
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId,
          eventType: 'payout.completed.v1',
          eventVersion: 1,
          aggregateId: payout.id,
          correlationId: randomUUID(),
          causationId: payout.id,
          payload: {
            payoutId: payout.id,
            amountInCents: payout.amountInCents.toString(),
          },
          occurredAt: completed.completedAt!,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'wallet.payout.complete',
          targetType: 'Payout',
          targetId: payout.id,
          metadata: {
            provider: this.provider.name,
            destination: payout.destinationMasked,
          },
        },
      });
      return {
        ...completed,
        amountInCents: Number(completed.amountInCents),
        duplicated,
      };
    });
  }

  private async failPayout(
    organizationId: string,
    payoutId: string,
    reason: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findFirst({
        where: {
          id: payoutId,
          organizationId,
          status: { in: ['REQUESTED', 'PROCESSING'] },
        },
      });
      if (!payout) return;
      const [clearing, available] = await Promise.all([
        tx.ledgerAccount.findUniqueOrThrow({
          where: {
            organizationId_code: { organizationId, code: 'payout_clearing' },
          },
        }),
        tx.ledgerAccount.findUniqueOrThrow({
          where: {
            organizationId_code: { organizationId, code: 'creator_available' },
          },
        }),
      ]);
      await tx.payout.update({
        where: { id: payout.id },
        data: { status: 'FAILED', failureReason: reason.slice(0, 300) },
      });
      await tx.journalEntry.create({
        data: {
          organizationId,
          type: 'payout_failed',
          referenceId: payout.id,
          idempotencyKey: `payout:${payout.id}:failed`,
          occurredAt: new Date(),
          description: 'Reserva devolvida após falha no Pix Out',
          postings: {
            create: [
              {
                ledgerAccountId: clearing.id,
                direction: 'DEBIT',
                amountInCents: payout.amountInCents,
              },
              {
                ledgerAccountId: available.id,
                direction: 'CREDIT',
                amountInCents: payout.amountInCents,
              },
            ],
          },
        },
      });
    });
  }

  private decryptSecret(value: string) {
    const [iv, tag, encrypted] = value.split('.');
    if (!iv || !tag || !encrypted)
      throw new Error('Chave Pix criptografada inválida');
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

  private async assertContributionAllowed(
    organizationId: string,
    amountInCents: number,
  ) {
    if ((process.env.PAYMENTS_ENABLED ?? 'true').toLowerCase() !== 'true')
      throw new BadRequestException(
        'Contribuições temporariamente indisponíveis',
      );
    const limit = Number(process.env.DAILY_ACCOUNT_LIMIT_IN_CENTS ?? 100_000);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const confirmed = await this.prisma.payment.aggregate({
      where: {
        organizationId,
        confirmedAt: { gte: dayStart },
        status: { in: ['CONFIRMED', 'SETTLED', 'AVAILABLE'] },
      },
      _sum: { amountInCents: true },
    });
    if (
      (confirmed._sum.amountInCents ?? 0n) + BigInt(amountInCents) >
      BigInt(limit)
    )
      throw new BadRequestException('Limite diário de contribuições atingido');
  }

  async reconcile(organizationId: string) {
    const [payments, entries, webhooks] = await Promise.all([
      this.prisma.payment.findMany({
        where: { organizationId },
        select: {
          id: true,
          paymentIntentId: true,
          providerReference: true,
          amountInCents: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.journalEntry.findMany({
        where: { organizationId },
        include: { postings: true },
      }),
      this.prisma.providerWebhook.findMany({
        where: { provider: this.provider.name },
        select: {
          id: true,
          payload: true,
          processedAt: true,
          failureReason: true,
        },
      }),
    ]);
    const paymentEntries = new Set(
      entries
        .filter((entry) => entry.type === 'payment_confirmed')
        .map((entry) => entry.referenceId),
    );
    const divergences: Array<{
      type: string;
      referenceId: string;
      detail: string;
    }> = [];
    for (const payment of payments) {
      if (!paymentEntries.has(payment.id))
        divergences.push({
          type: 'missing_journal_entry',
          referenceId: payment.id,
          detail: `Pagamento ${payment.status} sem lançamento de confirmação`,
        });
    }
    for (const entry of entries) {
      const debit = entry.postings
        .filter((posting) => posting.direction === 'DEBIT')
        .reduce((sum, posting) => sum + posting.amountInCents, 0n);
      const credit = entry.postings
        .filter((posting) => posting.direction === 'CREDIT')
        .reduce((sum, posting) => sum + posting.amountInCents, 0n);
      if (debit !== credit)
        divergences.push({
          type: 'unbalanced_journal_entry',
          referenceId: entry.id,
          detail: `Débitos ${debit} diferentes de créditos ${credit}`,
        });
    }
    const intentIds = new Set(
      payments.map((payment) => payment.paymentIntentId),
    );
    const relevantWebhooks = webhooks.filter((webhook) => {
      const payload = webhook.payload as { intentId?: unknown };
      return (
        typeof payload.intentId === 'string' && intentIds.has(payload.intentId)
      );
    });
    const failedWebhooks = relevantWebhooks.filter(
      (webhook) => !webhook.processedAt || webhook.failureReason,
    );
    let providerStatementChecked = 0;
    let providerAvailableInCents: number | null = null;
    const providerPayments = payments.filter(
      (payment) => !payment.providerReference.startsWith('local_sim_'),
    );
    if (this.provider.getStatement && providerPayments.length) {
      try {
        const oldest = providerPayments.reduce(
          (date, payment) =>
            payment.createdAt < date ? payment.createdAt : date,
          providerPayments[0]!.createdAt,
        );
        const statement = await this.provider.getStatement(oldest, new Date());
        const byReference = new Map(
          statement.map((entry) => [entry.reference, entry]),
        );
        providerStatementChecked = statement.length;
        for (const payment of providerPayments) {
          const external = byReference.get(payment.providerReference);
          if (!external || external.amountInCents !== payment.amountInCents)
            divergences.push({
              type: external
                ? 'provider_amount_mismatch'
                : 'missing_provider_transaction',
              referenceId: payment.id,
              detail: external
                ? `PSP registrou ${external.amountInCents} e StreamOS ${payment.amountInCents}`
                : `Transação ${payment.providerReference} ausente no extrato do PSP`,
            });
        }
      } catch (error) {
        divergences.push({
          type: 'provider_statement_unavailable',
          referenceId: this.provider.name,
          detail:
            error instanceof Error ? error.message : 'Extrato indisponível',
        });
      }
    }
    if (this.provider.getBalance) {
      try {
        providerAvailableInCents = Number(
          (await this.provider.getBalance()).availableInCents,
        );
      } catch (error) {
        divergences.push({
          type: 'provider_balance_unavailable',
          referenceId: this.provider.name,
          detail: error instanceof Error ? error.message : 'Saldo indisponível',
        });
      }
    }
    return {
      checkedAt: new Date().toISOString(),
      provider: this.provider.name,
      paymentsChecked: payments.length,
      entriesChecked: entries.length,
      failedWebhooks: failedWebhooks.length,
      providerStatementChecked,
      providerAvailableInCents,
      divergences,
      reconciled: divergences.length === 0 && failedWebhooks.length === 0,
    };
  }

  private async confirm(intentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const intent = await tx.paymentIntent.findUnique({
        where: { id: intentId },
        include: { payment: true },
      });
      if (!intent) throw new NotFoundException('Pagamento não encontrado');
      if (intent.expiresAt <= new Date() && !intent.payment) {
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: 'FAILED' },
        });
        throw new BadRequestException('Cobrança expirada');
      }
      if (intent.payment)
        return {
          paymentId: intent.payment.id,
          status: intent.payment.status,
          duplicated: true,
        };
      const fees = calculatePixFees(intent.amountInCents);
      await tx.ledgerAccount.createMany({
        data: [
          {
            organizationId: intent.organizationId,
            code: 'provider_clearing',
            name: 'Compensação do provedor',
          },
          {
            organizationId: intent.organizationId,
            code: 'creator_pending',
            name: 'Saldo pendente do criador',
          },
          {
            organizationId: intent.organizationId,
            code: 'platform_revenue',
            name: 'Receita da plataforma',
          },
          {
            organizationId: intent.organizationId,
            code: 'provider_fee',
            name: 'Tarifa de processamento Pix',
          },
        ],
        skipDuplicates: true,
      });
      const persistedAccounts = await tx.ledgerAccount.findMany({
        where: {
          organizationId: intent.organizationId,
          code: {
            in: [
              'provider_clearing',
              'creator_pending',
              'platform_revenue',
              'provider_fee',
            ],
          },
        },
      });
      const accountByCode = new Map(
        persistedAccounts.map((account) => [account.code, account]),
      );
      const accounts = [
        'provider_clearing',
        'creator_pending',
        'platform_revenue',
        'provider_fee',
      ].map((code) => {
        const account = accountByCode.get(code);
        if (!account) throw new Error(`Conta contábil ausente: ${code}`);
        return account;
      });
      const now = new Date();
      const payment = await tx.payment.create({
        data: {
          organizationId: intent.organizationId,
          paymentIntentId: intent.id,
          providerReference: intent.providerReference ?? `mock_${intent.id}`,
          amountInCents: intent.amountInCents,
          platformFeeInCents: fees.platformFeeInCents,
          providerFeeInCents: fees.providerFeeInCents,
          creatorNetInCents: fees.creatorNetInCents,
          status: 'CONFIRMED',
          confirmedAt: now,
        },
      });
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'CONFIRMED' },
      });
      const campaignContribution = await tx.campaignContribution.findUnique({
        where: { paymentIntentId: intent.id },
      });
      const [songRequest, videoRequest] = await Promise.all([
        tx.songRequest.findUnique({
          where: { paymentIntentId: intent.id },
          include: { session: { select: { volume: true } } },
        }),
        tx.videoRequest.findUnique({ where: { paymentIntentId: intent.id } }),
      ]);
      if (campaignContribution) {
        await tx.campaignContribution.update({
          where: { id: campaignContribution.id },
          data: { confirmedAt: now },
        });
        await tx.rewardClaim.updateMany({
          where: { campaignContributionId: campaignContribution.id },
          data: { status: 'CLAIMED' },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: intent.organizationId,
            eventType: 'campaign.contribution.confirmed.v1',
            eventVersion: 1,
            aggregateId: campaignContribution.campaignId,
            correlationId: randomUUID(),
            causationId: payment.id,
            payload: {
              campaignId: campaignContribution.campaignId,
              contributionId: campaignContribution.id,
              amountInCents: intent.amountInCents.toString(),
              supporterName: intent.supporterName,
            },
            occurredAt: now,
          },
        });
      }
      await tx.journalEntry.create({
        data: {
          organizationId: intent.organizationId,
          type: 'payment_confirmed',
          referenceId: payment.id,
          idempotencyKey: `payment:${payment.id}:confirmed`,
          occurredAt: now,
          description: 'Confirmação de pagamento mock',
          postings: {
            create: [
              {
                ledgerAccountId: accounts[0]!.id,
                direction: 'DEBIT',
                amountInCents: intent.amountInCents,
              },
              {
                ledgerAccountId: accounts[1]!.id,
                direction: 'CREDIT',
                amountInCents: fees.creatorNetInCents,
              },
              {
                ledgerAccountId: accounts[2]!.id,
                direction: 'CREDIT',
                amountInCents: fees.platformFeeInCents,
              },
              {
                ledgerAccountId: accounts[3]!.id,
                direction: 'CREDIT',
                amountInCents: fees.providerFeeInCents,
              },
            ],
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: intent.organizationId,
          eventType: 'payment.confirmed.v1',
          eventVersion: 1,
          aggregateId: payment.id,
          correlationId: randomUUID(),
          payload: {
            paymentId: payment.id,
            intentId: intent.id,
            amountInCents: intent.amountInCents.toString(),
            platformFeeInCents: fees.platformFeeInCents.toString(),
            providerFeeInCents: fees.providerFeeInCents.toString(),
            creatorNetInCents: fees.creatorNetInCents.toString(),
            supporterName: intent.anonymous ? 'Anônimo' : intent.supporterName,
            message: intent.message,
            alertType: intent.alertType,
            audioUrl: intent.audioUrl,
            audioDurationSeconds: intent.audioDurationSeconds,
            ttsVoice: intent.ttsVoice,
            suppressGenericAlert: Boolean(
              songRequest || videoRequest || campaignContribution,
            ),
          },
          occurredAt: now,
        },
      });
      const moderationConfig = await tx.alertConfig.findUnique({
        where: { organizationId: intent.organizationId },
      });
      if (
        moderationConfig?.moderationEnabled &&
        intent.alertType !== 'AUDIO' &&
        intent.message?.trim()
      ) {
        const policies = await tx.moderationPolicy.findMany({
          where: { organizationId: intent.organizationId, enabled: true },
        });
        const normalized = intent.message.toLowerCase();
        const blocked = policies.find(
          (policy) =>
            intent.amountInCents < policy.minimumInCents ||
            (policy.blockLinks &&
              /https?:\/\/|www\./i.test(intent.message ?? '')) ||
            policy.blockedWords.some((word) => normalized.includes(word)),
        );
        const moderationItem = await tx.moderationItem.upsert({
          where: {
            sourceType_sourceId: {
              sourceType: 'PAYMENT_MESSAGE',
              sourceId: intent.id,
            },
          },
          create: {
            organizationId: intent.organizationId,
            sourceType: 'PAYMENT_MESSAGE',
            sourceId: intent.id,
            supporterName: intent.anonymous ? 'Anônimo' : intent.supporterName,
            content: intent.message,
            amountInCents: intent.amountInCents,
            status: blocked ? 'REJECTED' : 'APPROVED',
            decisionReason: blocked
              ? `Política automática: ${blocked.name}`
              : 'Aprovado automaticamente antes do alerta',
            decidedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
          },
          update: {},
        });
        if (moderationItem.status === 'APPROVED') {
          const tts = await tx.ttsConfig.findUnique({
            where: { organizationId: intent.organizationId },
          });
          if (
            tts?.enabled &&
            !tts.paused &&
            intent.amountInCents >= tts.minimumInCents
          ) {
            const job = await tx.ttsJob.upsert({
              where: { moderationItemId: moderationItem.id },
              update: {},
              create: {
                organizationId: intent.organizationId,
                moderationItemId: moderationItem.id,
                text: intent.message.slice(0, tts.maximumCharacters),
                voice: tts.voice,
              },
            });
            await tx.outboxEvent.create({
              data: {
                organizationId: intent.organizationId,
                eventType: 'tts.queued.v1',
                eventVersion: 1,
                aggregateId: job.id,
                correlationId: randomUUID(),
                causationId: payment.id,
                payload: {
                  ttsJobId: job.id,
                  text: job.text,
                  voice: job.voice,
                  supporterName: intent.anonymous
                    ? 'Anônimo'
                    : intent.supporterName,
                },
                occurredAt: now,
              },
            });
          }
        }
      }
      if (songRequest) {
        const last = await tx.songRequest.aggregate({
          where: {
            songSessionId: songRequest.songSessionId,
            status: { in: ['QUEUED', 'PLAYING'] },
          },
          _max: { position: true },
        });
        const queued = await tx.songRequest.update({
          where: { id: songRequest.id },
          data: { status: 'QUEUED', position: (last._max.position ?? 0) + 1 },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: intent.organizationId,
            eventType: 'song.requested.v1',
            eventVersion: 1,
            aggregateId: queued.id,
            correlationId: randomUUID(),
            causationId: payment.id,
            payload: {
              requestId: queued.id,
              externalId: queued.externalId,
              title: queued.title,
              artist: queued.artist,
              genre: queued.genre,
              supporterName: queued.supporterName,
              durationSeconds: queued.durationSeconds,
              provider: queued.provider,
              artworkUrl: queued.artworkUrl,
              playbackUrl: queued.playbackUrl,
              playbackRestrictions: queued.playbackRestrictions,
              volume: songRequest.session.volume,
              position: queued.position,
              status: queued.status,
            },
            occurredAt: now,
          },
        });
      }
      if (videoRequest) {
        const last = await tx.videoRequest.aggregate({
          where: {
            videoSessionId: videoRequest.videoSessionId,
            status: { in: ['QUEUED', 'PLAYING'] },
          },
          _max: { position: true },
        });
        const queued = await tx.videoRequest.update({
          where: { id: videoRequest.id },
          data: { status: 'QUEUED', position: (last._max.position ?? 0) + 1 },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: intent.organizationId,
            eventType: 'video.requested.v1',
            eventVersion: 1,
            aggregateId: queued.id,
            correlationId: randomUUID(),
            causationId: payment.id,
            payload: {
              requestId: queued.id,
              title: queued.title,
              channelTitle: queued.channelTitle,
              externalId: queued.externalId,
              provider: queued.provider,
              startAtSeconds: queued.startAtSeconds,
              selectedSeconds: queued.selectedSeconds,
              supporterName: queued.supporterName,
              position: queued.position,
              status: queued.status,
            },
            occurredAt: now,
          },
        });
      }
      const goal = await tx.goal.findFirst({
        where: { organizationId: intent.organizationId, active: true },
        orderBy: { createdAt: 'desc' },
      });
      if (goal) {
        const updatedGoal = await tx.goal.update({
          where: { id: goal.id },
          data: { currentInCents: { increment: intent.amountInCents } },
        });
        await tx.outboxEvent.create({
          data: {
            organizationId: intent.organizationId,
            eventType: 'goal.updated.v1',
            eventVersion: 1,
            aggregateId: goal.id,
            correlationId: randomUUID(),
            causationId: payment.id,
            payload: {
              goalId: goal.id,
              title: goal.title,
              currentInCents: updatedGoal.currentInCents.toString(),
              targetInCents: goal.targetInCents.toString(),
            },
            occurredAt: now,
          },
        });
      }
      return {
        paymentId: payment.id,
        status: payment.status,
        duplicated: false,
      };
    });
  }

  private donateVoice(value?: string) {
    const voices = [
      'ai-popular-orator',
      'ai-commander',
      'pt-BR-default',
      'character-narrator',
      'character-deep',
      'character-cheerful',
      'character-robot',
    ];
    return value && voices.includes(value) ? value : null;
  }
}
