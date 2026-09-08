/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@streamos/database';

@Injectable()
export class CampaignsService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async list(organizationId: string) {
    const campaigns = await this.prisma.fundraisingCampaign.findMany({
      where: { organizationId },
      include: {
        rewards: {
          include: {
            claims: {
              include: { campaignContribution: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        contributions: { where: { confirmedAt: { not: null } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((campaign) => this.serialize(campaign));
  }

  async publicCampaign(creatorSlug: string, campaignSlug: string) {
    const campaign = await this.prisma.fundraisingCampaign.findFirst({
      where: {
        slug: campaignSlug,
        status: 'PUBLISHED',
        organization: {
          creatorProfile: { slug: creatorSlug, isPublished: true },
        },
      },
      include: {
        organization: { include: { creatorProfile: true } },
        rewards: {
          where: { active: true },
          orderBy: { minimumInCents: 'asc' },
        },
        contributions: {
          where: { confirmedAt: { not: null } },
          orderBy: { confirmedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!campaign) throw new NotFoundException('Vaquinha não encontrada');
    return this.serialize(campaign);
  }

  async create(
    organizationId: string,
    actorUserId: string,
    input: CampaignInput,
  ) {
    const data = this.validate(input);
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.fundraisingCampaign.create({
        data: { organizationId, ...data },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'campaign.create',
          targetType: 'FundraisingCampaign',
          targetId: campaign.id,
          metadata: { slug: campaign.slug },
        },
      });
      return this.serialize(campaign);
    });
  }

  async update(
    organizationId: string,
    actorUserId: string,
    id: string,
    input: CampaignInput,
  ) {
    await this.owned(organizationId, id);
    const data = this.validate(input);
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.fundraisingCampaign.update({
        where: { id },
        data,
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'campaign.update',
          targetType: 'FundraisingCampaign',
          targetId: id,
          metadata: {},
        },
      });
      return this.serialize(campaign);
    });
  }

  async status(
    organizationId: string,
    actorUserId: string,
    id: string,
    status: string,
  ) {
    await this.owned(organizationId, id);
    if (!['DRAFT', 'PUBLISHED', 'CLOSED'].includes(status))
      throw new BadRequestException('Estado inválido');
    const campaign = await this.prisma.fundraisingCampaign.update({
      where: { id },
      data: { status },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action: `campaign.${status.toLowerCase()}`,
        targetType: 'FundraisingCampaign',
        targetId: id,
        metadata: {},
      },
    });
    return this.serialize(campaign);
  }

  async addReward(
    organizationId: string,
    actorUserId: string,
    campaignId: string,
    input: RewardInput,
  ) {
    await this.owned(organizationId, campaignId);
    if (
      !input.title?.trim() ||
      !Number.isInteger(input.minimumInCents) ||
      input.minimumInCents < 100 ||
      (input.quantity != null &&
        (!Number.isInteger(input.quantity) || input.quantity < 1))
    )
      throw new BadRequestException('Recompensa inválida');
    const reward = await this.prisma.campaignReward.create({
      data: {
        campaignId,
        title: input.title.trim().slice(0, 100),
        description: input.description?.trim().slice(0, 500) ?? '',
        minimumInCents: BigInt(input.minimumInCents),
        quantity: input.quantity ?? null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action: 'campaign.reward.create',
        targetType: 'CampaignReward',
        targetId: reward.id,
        metadata: { campaignId },
      },
    });
    return { ...reward, minimumInCents: Number(reward.minimumInCents) };
  }

  async deliver(
    organizationId: string,
    actorUserId: string,
    claimId: string,
    note?: string,
  ) {
    const claim = await this.prisma.rewardClaim.findFirst({
      where: { id: claimId, reward: { campaign: { organizationId } } },
    });
    if (!claim) throw new NotFoundException('Resgate não encontrado');
    const value = await this.prisma.rewardClaim.update({
      where: { id: claimId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        deliveryNote: note?.trim().slice(0, 500),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action: 'campaign.reward.deliver',
        targetType: 'RewardClaim',
        targetId: claimId,
        metadata: {},
      },
    });
    return value;
  }

  private async owned(organizationId: string, id: string) {
    const value = await this.prisma.fundraisingCampaign.findFirst({
      where: { id, organizationId },
    });
    if (!value) throw new NotFoundException('Vaquinha não encontrada');
    return value;
  }

  private validate(input: CampaignInput) {
    const title = input.title?.trim();
    const slug = input.slug
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');
    if (
      !title ||
      title.length > 120 ||
      !slug ||
      !Number.isInteger(input.targetInCents) ||
      input.targetInCents < 100
    )
      throw new BadRequestException('Dados da vaquinha inválidos');
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (endsAt && Number.isNaN(endsAt.getTime()))
      throw new BadRequestException('Prazo inválido');
    return {
      title,
      slug,
      description: input.description?.trim().slice(0, 2000) ?? '',
      imageUrl: input.imageUrl?.trim().slice(0, 500) || null,
      targetInCents: BigInt(input.targetInCents),
      endsAt,
    };
  }

  private serialize(campaign: any) {
    const { organization: _organization, ...safeCampaign } = campaign;
    const confirmed =
      campaign.contributions?.filter((item: any) => item.confirmedAt) ?? [];
    return {
      ...safeCampaign,
      targetInCents: Number(campaign.targetInCents),
      currentInCents: confirmed.reduce(
        (sum: number, item: any) => sum + Number(item.amountInCents),
        0,
      ),
      rewards: campaign.rewards?.map((reward: any) => ({
        ...reward,
        minimumInCents: Number(reward.minimumInCents),
        availableQuantity:
          reward.quantity == null
            ? null
            : Math.max(0, reward.quantity - reward.claimedCount),
        claims: reward.claims?.map((claim: any) => ({
          id: claim.id,
          status: claim.status,
          deliveryNote: claim.deliveryNote,
          deliveredAt: claim.deliveredAt,
          createdAt: claim.createdAt,
          supporterName: claim.campaignContribution?.supporterName ?? null,
          amountInCents: claim.campaignContribution
            ? Number(claim.campaignContribution.amountInCents)
            : null,
          confirmedAt: claim.campaignContribution?.confirmedAt ?? null,
        })),
      })),
      contributions: campaign.contributions?.map((item: any) => ({
        ...item,
        amountInCents: Number(item.amountInCents),
      })),
    };
  }
}

export type CampaignInput = {
  title: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  targetInCents: number;
  endsAt?: string | null;
};
export type RewardInput = {
  title: string;
  description?: string;
  minimumInCents: number;
  quantity?: number | null;
};
