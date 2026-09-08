import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@streamos/database';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ModerationService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}
  async overview(organizationId: string) {
    await this.expire(organizationId);
    const [policies, items, flaggedItems, tts, alert] = await Promise.all([
      this.prisma.moderationPolicy.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.moderationItem.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { ttsJob: true },
      }),
      this.prisma.liveQueueItem.findMany({
        where: { organizationId, moderationStatus: 'FLAGGED' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.ttsConfig.findUnique({ where: { organizationId } }),
      this.prisma.alertConfig.findUnique({ where: { organizationId } }),
    ]);
    return {
      policies: policies.map((p) => ({
        ...p,
        minimumInCents: Number(p.minimumInCents),
      })),
      items: items.map((i) => ({
        ...i,
        amountInCents:
          i.amountInCents === null ? null : Number(i.amountInCents),
      })),
      flaggedItems: flaggedItems.map((item) => ({
        ...item,
        amountInCents:
          item.amountInCents === null ? null : Number(item.amountInCents),
      })),
      tts: tts ? { ...tts, minimumInCents: Number(tts.minimumInCents) } : null,
      moderationEnabled: alert?.moderationEnabled ?? false,
    };
  }
  async settings(
    organizationId: string,
    actorUserId: string,
    input: {
      moderationEnabled: boolean;
      ttsEnabled: boolean;
      voice: string;
      minimumInCents: number;
      maximumCharacters: number;
      paused: boolean;
    },
  ) {
    if (
      !Number.isInteger(input.minimumInCents) ||
      input.minimumInCents < 0 ||
      !Number.isInteger(input.maximumCharacters) ||
      input.maximumCharacters < 1 ||
      input.maximumCharacters > 500
    )
      throw new BadRequestException('Configuração inválida');
    await this.prisma.$transaction([
      this.prisma.alertConfig.upsert({
        where: { organizationId },
        create: {
          organizationId,
          enabled: true,
          moderationEnabled: input.moderationEnabled,
          theme: {},
        },
        update: { moderationEnabled: input.moderationEnabled },
      }),
      this.prisma.ttsConfig.upsert({
        where: { organizationId },
        create: {
          organizationId,
          enabled: input.ttsEnabled,
          voice: input.voice.slice(0, 50),
          minimumInCents: BigInt(input.minimumInCents),
          maximumCharacters: input.maximumCharacters,
          paused: input.paused,
        },
        update: {
          enabled: input.ttsEnabled,
          voice: input.voice.slice(0, 50),
          minimumInCents: BigInt(input.minimumInCents),
          maximumCharacters: input.maximumCharacters,
          paused: input.paused,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'moderation.settings.update',
          targetType: 'Moderation',
          metadata: {},
        },
      }),
    ]);
    return this.overview(organizationId);
  }
  async createPolicy(
    organizationId: string,
    actorUserId: string,
    input: {
      name: string;
      blockedWords: string[];
      blockLinks: boolean;
      minimumInCents: number;
    },
  ) {
    if (
      input.name.trim().length < 2 ||
      !Number.isInteger(input.minimumInCents) ||
      input.minimumInCents < 0
    )
      throw new BadRequestException('Política inválida');
    const policy = await this.prisma.moderationPolicy.create({
      data: {
        organizationId,
        name: input.name.trim(),
        blockedWords: [
          ...new Set(
            input.blockedWords
              .map((w) => w.trim().toLowerCase())
              .filter(Boolean),
          ),
        ],
        blockLinks: input.blockLinks,
        minimumInCents: BigInt(input.minimumInCents),
      },
    });
    await this.audit(
      organizationId,
      actorUserId,
      'moderation.policy.create',
      policy.id,
    );
    return { ...policy, minimumInCents: Number(policy.minimumInCents) };
  }
  async decide(
    organizationId: string,
    actorUserId: string,
    id: string,
    decision: string,
    reason?: string,
  ) {
    const item = await this.prisma.moderationItem.findFirst({
      where: { id, organizationId },
    });
    if (!item) throw new NotFoundException('Item de moderação não encontrado');
    if (item.status !== 'PENDING' || !['APPROVE', 'REJECT'].includes(decision))
      throw new BadRequestException('Decisão inválida');
    const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const changed = await this.prisma.$transaction(async (tx) => {
      const value = await tx.moderationItem.update({
        where: { id },
        data: {
          status,
          decisionReason: reason?.trim().slice(0, 200),
          decidedById: actorUserId,
          decidedAt: new Date(),
        },
      });
      if (status === 'APPROVED') {
        await tx.outboxEvent.create({
          data: {
            organizationId,
            eventType: 'message.approved.v1',
            eventVersion: 1,
            aggregateId: id,
            correlationId: randomUUID(),
            payload: {
              moderationItemId: id,
              supporterName: item.supporterName,
              message: item.content,
              amountInCents: item.amountInCents?.toString() ?? '0',
            },
            occurredAt: new Date(),
          },
        });
        const tts = await tx.ttsConfig.findUnique({
          where: { organizationId },
        });
        if (
          tts?.enabled &&
          !tts.paused &&
          (item.amountInCents ?? 0n) >= tts.minimumInCents
        ) {
          const job = await tx.ttsJob.create({
            data: {
              organizationId,
              moderationItemId: id,
              text: item.content.slice(0, tts.maximumCharacters),
              voice: tts.voice,
            },
          });
          await tx.outboxEvent.create({
            data: {
              organizationId,
              eventType: 'tts.queued.v1',
              eventVersion: 1,
              aggregateId: job.id,
              correlationId: randomUUID(),
              payload: {
                ttsJobId: job.id,
                text: job.text,
                voice: job.voice,
                supporterName: item.supporterName,
              },
              occurredAt: new Date(),
            },
          });
        }
      }
      return value;
    });
    await this.audit(
      organizationId,
      actorUserId,
      `moderation.item.${decision.toLowerCase()}`,
      id,
    );
    return {
      ...changed,
      amountInCents:
        changed.amountInCents === null ? null : Number(changed.amountInCents),
    };
  }
  private expire(organizationId: string) {
    return this.prisma.moderationItem.updateMany({
      where: {
        organizationId,
        status: 'PENDING',
        expiresAt: { lte: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
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
        targetType: 'Moderation',
        targetId,
        metadata: {},
      },
    });
  }
}
