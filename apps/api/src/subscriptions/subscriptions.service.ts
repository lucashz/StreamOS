/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion */
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@streamos/database';
import { randomUUID } from 'node:crypto';
@Injectable()
export class SubscriptionsService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}
  async plans(organizationId: string) {
    const values = await this.prisma.subscriptionPlan.findMany({
      where: { organizationId },
      include: { subscriptions: { include: { renewals: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return values.map((v) => this.plan(v));
  }
  async publicPlans(slug: string) {
    const values = await this.prisma.subscriptionPlan.findMany({
      where: {
        published: true,
        organization: { creatorProfile: { slug, isPublished: true } },
      },
      orderBy: { priceInCents: 'asc' },
    });
    return values.map((v) => this.plan(v));
  }
  async create(
    organizationId: string,
    userId: string,
    input: {
      name: string;
      description?: string;
      priceInCents: number;
      benefits?: string[];
    },
  ) {
    if (
      !input.name?.trim() ||
      !Number.isInteger(input.priceInCents) ||
      input.priceInCents < 100
    )
      throw new BadRequestException('Plano inválido');
    const slug = input.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const value = await this.prisma.subscriptionPlan.create({
      data: {
        organizationId,
        slug,
        name: input.name.trim(),
        description: input.description?.trim() ?? '',
        priceInCents: BigInt(input.priceInCents),
        benefits: (input.benefits ?? []) as Prisma.InputJsonArray,
      },
    });
    await this.audit(
      organizationId,
      userId,
      'subscription.plan.create',
      value.id,
    );
    return this.plan(value);
  }
  async publish(
    organizationId: string,
    userId: string,
    id: string,
    published: boolean,
  ) {
    const found = await this.prisma.subscriptionPlan.findFirst({
      where: { id, organizationId },
    });
    if (!found) throw new NotFoundException('Plano não encontrado');
    const value = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { published },
    });
    await this.audit(organizationId, userId, 'subscription.plan.publish', id);
    return this.plan(value);
  }
  async subscribe(
    planId: string,
    input: { supporterName: string; supporterEmail: string },
  ) {
    if ((process.env.SUBSCRIPTIONS_ENABLED ?? 'true').toLowerCase() !== 'true')
      throw new ServiceUnavailableException(
        'Assinaturas estão temporariamente pausadas',
      );
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: planId, published: true },
    });
    if (
      !plan ||
      !input.supporterEmail?.includes('@') ||
      !input.supporterName?.trim()
    )
      throw new BadRequestException('Assinatura inválida');
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.creatorSubscription.create({
        data: {
          organizationId: plan.organizationId,
          planId,
          supporterName: input.supporterName.trim().slice(0, 80),
          supporterEmail: input.supporterEmail.trim().toLowerCase(),
          currentPeriodStart: start,
          currentPeriodEnd: end,
          renewals: {
            create: {
              amountInCents: plan.priceInCents,
              periodStart: start,
              periodEnd: end,
            },
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          organizationId: plan.organizationId,
          eventType: 'subscription.created.v1',
          eventVersion: 1,
          aggregateId: subscription.id,
          correlationId: randomUUID(),
          payload: {
            subscriptionId: subscription.id,
            planId,
            planName: plan.name,
            supporterName: subscription.supporterName,
            amountInCents: plan.priceInCents.toString(),
          },
          occurredAt: start,
        },
      });
      return { ...subscription, mock: true };
    });
  }
  async cancel(organizationId: string, userId: string, id: string) {
    const found = await this.prisma.creatorSubscription.findFirst({
      where: { id, organizationId },
    });
    if (!found) throw new NotFoundException('Assinatura não encontrada');
    const value = await this.prisma.creatorSubscription.update({
      where: { id },
      data: { cancelAtPeriodEnd: true },
    });
    await this.audit(organizationId, userId, 'subscription.cancel', id);
    return value;
  }
  async renew(
    organizationId: string,
    userId: string,
    id: string,
    idempotencyKey: string,
    fail = false,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 120)
      throw new BadRequestException('Chave de idempotência inválida');
    const existing = await this.prisma.subscriptionRenewal.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return this.renewal(existing);
    const subscription = await this.prisma.creatorSubscription.findFirst({
      where: { id, organizationId },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException('Assinatura não encontrada');
    if (subscription.status !== 'ACTIVE')
      throw new BadRequestException('Assinatura não está ativa');
    if (subscription.cancelAtPeriodEnd) {
      await this.prisma.creatorSubscription.update({
        where: { id },
        data: { status: 'CANCELED' },
      });
      await this.audit(organizationId, userId, 'subscription.canceled', id);
      return { subscriptionId: id, status: 'CANCELED', canceled: true };
    }
    const periodStart = subscription.currentPeriodEnd;
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    try {
      const renewal = await this.prisma.$transaction(async (tx) => {
        const created = await tx.subscriptionRenewal.create({
          data: {
            subscriptionId: id,
            amountInCents: subscription.plan.priceInCents,
            periodStart,
            periodEnd,
            status: fail ? 'MOCK_FAILED' : 'MOCK_PAID',
            idempotencyKey,
          },
        });
        if (!fail) {
          const advanced = await tx.creatorSubscription.updateMany({
            where: {
              id,
              status: 'ACTIVE',
              currentPeriodEnd: subscription.currentPeriodEnd,
            },
            data: {
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            },
          });
          if (advanced.count !== 1)
            throw new BadRequestException('Assinatura já foi renovada');
        }
        await tx.outboxEvent.create({
          data: {
            organizationId,
            eventType: fail
              ? 'subscription.renewal.failed.v1'
              : 'subscription.renewed.v1',
            eventVersion: 1,
            aggregateId: id,
            correlationId: randomUUID(),
            payload: {
              subscriptionId: id,
              planId: subscription.planId,
              planName: subscription.plan.name,
              supporterName: subscription.supporterName,
              amountInCents: subscription.plan.priceInCents.toString(),
              status: fail ? 'FAILED' : 'PAID',
            },
            occurredAt: new Date(),
          },
        });
        return created;
      });
      await this.audit(
        organizationId,
        userId,
        fail ? 'subscription.renewal.failed' : 'subscription.renewed',
        id,
      );
      return this.renewal(renewal);
    } catch (error) {
      const duplicate = await this.prisma.subscriptionRenewal.findUnique({
        where: { idempotencyKey },
      });
      if (duplicate) return this.renewal(duplicate);
      throw error;
    }
  }
  private renewal(value: { amountInCents: bigint } & Record<string, unknown>) {
    return { ...value, amountInCents: Number(value.amountInCents) };
  }
  private plan(v: any) {
    return {
      ...v,
      priceInCents: Number(v.priceInCents),
      subscriptions: v.subscriptions?.map((s: any) => ({
        ...s,
        renewals: s.renewals.map((r: any) => ({
          ...r,
          amountInCents: Number(r.amountInCents),
        })),
      })),
    };
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
        targetType: 'Subscription',
        targetId,
        metadata: { mode: 'mock' },
      },
    });
  }
}
