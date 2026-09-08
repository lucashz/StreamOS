/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@streamos/database';
import Redis from 'ioredis';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
const ROLES = ['OWNER', 'ADMIN', 'MODERATOR', 'FINANCE', 'VIEWER'] as const;
const SCOPES = [
  'payments:read',
  'campaigns:read',
  'campaigns:write',
  'widgets:write',
  'webhooks:write',
] as const;
const WEBHOOK_EVENTS = [
  'payment.confirmed.v1',
  'campaign.contribution.confirmed.v1',
  'subscription.created.v1',
  'song.requested.v1',
  'video.requested.v1',
  'goal.updated.v1',
  'alert.test.v2',
] as const;
@Injectable()
export class PlatformService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(Redis) private readonly redis: Redis,
  ) {}
  async overview(organizationId: string) {
    const [members, invites, tokens, webhooks, integrations] =
      await Promise.all([
        this.prisma.membership.findMany({
          where: { organizationId },
          include: { user: { select: { id: true, email: true } } },
        }),
        this.prisma.teamInvite.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.apiToken.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.webhookEndpoint.findMany({
          where: { organizationId },
          include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 20 } },
        }),
        this.prisma.integrationConnection.findMany({
          where: { organizationId },
        }),
      ]);
    return {
      members,
      invites,
      tokens,
      webhooks,
      integrations,
      roles: ROLES,
      scopes: SCOPES,
      webhookEvents: WEBHOOK_EVENTS,
    };
  }
  async updateMember(
    organizationId: string,
    actorId: string,
    id: string,
    role: string,
  ) {
    await this.admin(organizationId, actorId);
    if (!ROLES.includes(role as any) || role === 'OWNER')
      throw new BadRequestException('Papel inválido');
    const member = await this.prisma.membership.findFirst({
      where: { id, organizationId },
    });
    if (!member || member.role === 'OWNER')
      throw new NotFoundException('Membro não encontrado');
    const updated = await this.prisma.membership.update({
      where: { id },
      data: { role: role as any },
    });
    await this.audit(organizationId, actorId, 'team.member.role_changed', id, {
      role,
    });
    return updated;
  }
  async removeMember(organizationId: string, actorId: string, id: string) {
    await this.admin(organizationId, actorId);
    const member = await this.prisma.membership.findFirst({
      where: { id, organizationId },
    });
    if (!member || member.role === 'OWNER' || member.userId === actorId)
      throw new BadRequestException('Este membro não pode ser removido');
    await this.prisma.membership.delete({ where: { id } });
    await this.audit(organizationId, actorId, 'team.member.removed', id, {});
    return { removed: true };
  }
  async revokeInvite(organizationId: string, actorId: string, id: string) {
    await this.admin(organizationId, actorId);
    const result = await this.prisma.teamInvite.updateMany({
      where: { id, organizationId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Convite não encontrado');
    return { revoked: true };
  }
  async invite(
    organizationId: string,
    userId: string,
    email: string,
    role: string,
  ) {
    await this.admin(organizationId, userId);
    if (
      !email.includes('@') ||
      !ROLES.includes(role as any) ||
      role === 'OWNER'
    )
      throw new BadRequestException('Convite inválido');
    const token = randomBytes(32).toString('base64url');
    const value = await this.prisma.teamInvite.create({
      data: {
        organizationId,
        email: email.trim().toLowerCase(),
        role: role as 'ADMIN' | 'MODERATOR' | 'FINANCE' | 'VIEWER',
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return { ...value, inviteToken: token };
  }
  async accept(token: string, userId: string) {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !invite ||
      !user ||
      invite.email !== user.email ||
      invite.expiresAt <= new Date() ||
      invite.acceptedAt ||
      invite.revokedAt
    )
      throw new BadRequestException('Convite inválido ou expirado');
    return this.prisma.$transaction(async (tx) => {
      await tx.membership.upsert({
        where: {
          userId_organizationId: {
            userId,
            organizationId: invite.organizationId,
          },
        },
        update: { role: invite.role },
        create: {
          userId,
          organizationId: invite.organizationId,
          role: invite.role,
        },
      });
      return tx.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    });
  }
  async token(
    organizationId: string,
    userId: string,
    input: { name: string; scopes: string[]; expiresAt?: string },
  ) {
    await this.admin(organizationId, userId);
    if (
      !input.name?.trim() ||
      !input.scopes?.length ||
      input.scopes.some((s) => !SCOPES.includes(s as any))
    )
      throw new BadRequestException('Token inválido');
    const raw = `sos_${randomBytes(32).toString('base64url')}`;
    const value = await this.prisma.apiToken.create({
      data: {
        organizationId,
        name: input.name.trim(),
        tokenHash: this.hash(raw),
        tokenPrefix: raw.slice(0, 12),
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
    return { ...value, token: raw };
  }
  async revokeToken(organizationId: string, userId: string, id: string) {
    await this.admin(organizationId, userId);
    const result = await this.prisma.apiToken.updateMany({
      where: { id, organizationId },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Token não encontrado');
    return { revoked: true };
  }
  async rotateToken(organizationId: string, userId: string, id: string) {
    await this.admin(organizationId, userId);
    const current = await this.prisma.apiToken.findFirst({
      where: { id, organizationId },
    });
    if (!current) throw new NotFoundException('Token não encontrado');
    await this.prisma.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return this.token(organizationId, userId, {
      name: current.name,
      scopes: current.scopes,
      expiresAt: current.expiresAt?.toISOString(),
    });
  }
  async authenticateToken(raw: string | undefined, scope: string) {
    if (!raw?.startsWith('sos_'))
      throw new ForbiddenException('Token inválido');
    const token = await this.prisma.apiToken.findUnique({
      where: { tokenHash: this.hash(raw) },
    });
    if (
      !token ||
      token.revokedAt ||
      (token.expiresAt && token.expiresAt <= new Date()) ||
      !token.scopes.includes(scope)
    )
      throw new ForbiddenException('Token sem acesso a este recurso');
    if (this.redis.status === 'wait') await this.redis.connect();
    const rateKey = `streamos:api-token-rate:${token.id}`;
    const count = await this.redis.incr(rateKey);
    if (count === 1) await this.redis.expire(rateKey, 60);
    if (count > 120) throw new ForbiddenException('Limite do token excedido');
    await this.prisma.apiToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    });
    return token;
  }
  async webhook(
    organizationId: string,
    userId: string,
    input: { url: string; events: string[] },
  ) {
    await this.admin(organizationId, userId);
    let url: URL;
    try {
      url = new URL(input.url);
    } catch {
      throw new BadRequestException('URL inválida');
    }
    if (
      process.env.NODE_ENV === 'production' &&
      (url.protocol !== 'https:' ||
        ['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname))
    )
      throw new BadRequestException(
        'Webhook de produção deve usar HTTPS público',
      );
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !input.events?.length ||
      input.events.some((event) => !WEBHOOK_EVENTS.includes(event as any))
    )
      throw new BadRequestException('Webhook inválido');
    const secret = randomBytes(32).toString('base64url');
    const value = await this.prisma.webhookEndpoint.create({
      data: {
        organizationId,
        url: url.toString(),
        events: input.events,
        secretHash: this.hash(secret),
        secretCiphertext: this.encrypt(secret),
      },
    });
    return { ...value, signingSecret: secret };
  }
  async toggleWebhook(
    organizationId: string,
    userId: string,
    id: string,
    enabled: boolean,
  ) {
    await this.admin(organizationId, userId);
    const result = await this.prisma.webhookEndpoint.updateMany({
      where: { id, organizationId },
      data: { enabled },
    });
    if (!result.count) throw new NotFoundException('Webhook não encontrado');
    return { enabled };
  }
  async retryDelivery(organizationId: string, userId: string, id: string) {
    await this.admin(organizationId, userId);
    const result = await this.prisma.webhookDelivery.updateMany({
      where: { id, organizationId },
      data: { status: 'PENDING', nextAttemptAt: new Date(), lastError: null },
    });
    if (!result.count) throw new NotFoundException('Entrega não encontrada');
    return { queued: true };
  }
  async rotateWebhookSecret(
    organizationId: string,
    userId: string,
    id: string,
  ) {
    await this.admin(organizationId, userId);
    const secret = randomBytes(32).toString('base64url');
    const result = await this.prisma.webhookEndpoint.updateMany({
      where: { id, organizationId },
      data: {
        secretHash: this.hash(secret),
        secretCiphertext: this.encrypt(secret),
      },
    });
    if (!result.count) throw new NotFoundException('Webhook não encontrado');
    return { signingSecret: secret };
  }
  async connect(
    organizationId: string,
    userId: string,
    provider: string,
    displayName?: string,
  ) {
    await this.admin(organizationId, userId);
    const normalized = provider.toUpperCase();
    if (!['TWITCH', 'YOUTUBE', 'DISCORD'].includes(normalized))
      throw new BadRequestException('Integração inválida');
    return this.prisma.integrationConnection.upsert({
      where: {
        organizationId_provider: { organizationId, provider: normalized },
      },
      update: {
        status: 'MOCK_CONNECTED',
        displayName,
        revokedAt: null,
        connectedAt: new Date(),
      },
      create: { organizationId, provider: normalized, displayName },
    });
  }
  async disconnect(organizationId: string, userId: string, provider: string) {
    await this.admin(organizationId, userId);
    const normalized = provider.toUpperCase();
    const result = await this.prisma.integrationConnection.updateMany({
      where: { organizationId, provider: normalized, revokedAt: null },
      data: { status: 'DISCONNECTED', revokedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Integração não encontrada');
    return { provider: normalized, status: 'DISCONNECTED' };
  }
  async testIntegration(
    organizationId: string,
    userId: string,
    provider: string,
  ) {
    await this.admin(organizationId, userId);
    const connection = await this.prisma.integrationConnection.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: provider.toUpperCase(),
        },
      },
    });
    if (!connection || connection.revokedAt)
      throw new NotFoundException('Integração não conectada');
    return { provider: connection.provider, ok: true, checkedAt: new Date() };
  }
  private async admin(organizationId: string, userId: string) {
    const member = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!member || !['OWNER', 'ADMIN'].includes(member.role))
      throw new ForbiddenException('Permissão insuficiente');
    return member;
  }
  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
  private encrypt(value: string) {
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
  private audit(
    organizationId: string,
    actorUserId: string,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action,
        targetType: 'Platform',
        targetId,
        metadata: metadata as any,
      },
    });
  }
}
