import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@streamos/database';

@Injectable()
export class SupportService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  payment(id: string) {
    return this.prisma.payment.findFirst({
      where: { OR: [{ id }, { providerReference: id }] },
      include: {
        paymentIntent: true,
        organization: {
          include: {
            creatorProfile: {
              omit: { minimumContributionInCents: true },
            },
          },
        },
      },
    });
  }

  async reprocessOutbox(eventId: string, actorUserId: string) {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Evento não encontrado');
    await this.prisma.$transaction([
      this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { publishedAt: null, lastError: null },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: event.organizationId,
          actorUserId,
          action: 'support.outbox.reprocess',
          targetType: 'OutboxEvent',
          targetId: event.id,
          metadata: { previousPublishedAt: event.publishedAt?.toISOString() },
        },
      }),
    ]);
    return { eventId, queued: true };
  }

  async revokeOverlay(channelId: string, actorUserId: string) {
    const channel = await this.prisma.overlayChannel.findUnique({
      where: { id: channelId },
    });
    if (!channel)
      throw new NotFoundException('Canal de overlay não encontrado');
    await this.prisma.$transaction([
      this.prisma.overlayChannel.update({
        where: { id: channel.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: channel.organizationId,
          actorUserId,
          action: 'support.overlay.revoke',
          targetType: 'OverlayChannel',
          targetId: channel.id,
          metadata: {},
        },
      }),
    ]);
    return { channelId, revoked: true };
  }
}
