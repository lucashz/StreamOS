import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@streamos/database';
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { MailerService } from './mailer.service';

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  acceptTerms: boolean;
  inviteCode?: string;
}
interface LoginInput {
  email: string;
  password: string;
}
interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(MailerService) private readonly mailer: MailerService,
  ) {}

  async register(input: RegisterInput, metadata: SessionMetadata = {}) {
    const email = input.email.trim().toLowerCase();
    if (
      !email.includes('@') ||
      input.password.length < 10 ||
      input.displayName.trim().length < 2 ||
      input.acceptTerms !== true
    ) {
      throw new BadRequestException('Dados de cadastro inválidos');
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('E-mail já cadastrado');
    const inviteCode = input.inviteCode?.trim();
    if (!inviteCode)
      throw new ForbiddenException('O cadastro desta beta requer um convite');
    const passwordHash = await this.hashPassword(input.password);
    const slugBase =
      input.displayName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'creator';
    const slug = `${slugBase}-${randomBytes(2).toString('hex')}`;
    const user = await this.prisma.$transaction(async (tx) => {
      const invite = await tx.betaInvite.findUnique({
        where: { codeHash: this.digest(inviteCode) },
      });
      if (
        !invite ||
        invite.revokedAt ||
        invite.acceptedAt ||
        invite.email !== email
      )
        throw new ForbiddenException(
          'O convite nÃ£o Ã© vÃ¡lido para este e-mail',
        );
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          consents: {
            create: {
              type: 'terms_and_privacy',
              version: '2026-08-16',
              ipAddress: metadata.ipAddress?.slice(0, 64),
            },
          },
          memberships: {
            create: {
              role: 'OWNER',
              organization: {
                create: {
                  name: input.displayName.trim(),
                  creatorProfile: {
                    create: { displayName: input.displayName.trim(), slug },
                  },
                  complianceProfile: { create: { status: 'SANDBOX_APPROVED' } },
                  alertConfig: {
                    create: {
                      minimumInCents: 500,
                      theme: { template: 'neon-pulse', accent: '#a98cff' },
                    },
                  },
                  goals: {
                    create: {
                      title: 'Primeira meta da live',
                      targetInCents: 100_000,
                    },
                  },
                },
              },
            },
          },
        },
        select: {
          id: true,
          email: true,
          memberships: {
            select: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  creatorProfile: {
                    select: {
                      id: true,
                      organizationId: true,
                      slug: true,
                      displayName: true,
                      bio: true,
                      isPublished: true,
                      onboardingCompletedAt: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      await tx.betaInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedById: created.id },
      });
      return created;
    });
    return {
      user,
      sessionToken: await this.createSession(user.id, metadata),
    };
  }

  async login(input: LoginInput, metadata: SessionMetadata = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (
      !user ||
      !(await this.verifyPassword(input.password, user.passwordHash))
    )
      throw new UnauthorizedException('Credenciais inválidas');
    return { sessionToken: await this.createSession(user.id, metadata) };
  }

  async me(token?: string) {
    if (!token) throw new UnauthorizedException();
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: this.digest(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            memberships: {
              select: {
                id: true,
                organizationId: true,
                role: true,
                organization: {
                  select: {
                    id: true,
                    name: true,
                    creatorProfile: {
                      omit: { minimumContributionInCents: true },
                    },
                    complianceProfile: { select: { status: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!session) throw new UnauthorizedException();
    if (Date.now() - session.lastUsedAt.getTime() > 60_000)
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });
    if (session.activeOrganizationId) {
      session.user.memberships.sort((a, b) =>
        a.organizationId === session.activeOrganizationId
          ? -1
          : b.organizationId === session.activeOrganizationId
            ? 1
            : 0,
      );
    }
    return session.user;
  }

  async selectOrganization(token: string | undefined, organizationId: string) {
    if (!token) throw new UnauthorizedException();
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: this.digest(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) throw new UnauthorizedException();
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId: session.userId, organizationId },
      },
    });
    if (!membership) throw new UnauthorizedException();
    await this.prisma.session.update({
      where: { id: session.id },
      data: { activeOrganizationId: organizationId },
    });
    return { organizationId };
  }

  async logout(token?: string) {
    if (token)
      await this.prisma.session.updateMany({
        where: { tokenHash: this.digest(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
  }

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: true };
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.digest(token),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      }),
    ]);
    await this.mailer.sendPasswordReset(user.email, token);
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    if (!token || password.length < 10)
      throw new BadRequestException('Token ou senha inválidos');
    const reset = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: this.digest(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!reset) throw new BadRequestException('Link inválido ou expirado');
    const passwordHash = await this.hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async updateProfile(
    token: string | undefined,
    input: {
      email: string;
      displayName: string;
      bio?: string;
      avatarUrl?: string;
    },
  ) {
    const user = await this.me(token);
    const organization = user.memberships[0]?.organization;
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    if (!organization || !email.includes('@') || displayName.length < 2)
      throw new BadRequestException('Dados de perfil inválidos');
    const duplicate = await this.prisma.user.findFirst({
      where: { email, id: { not: user.id } },
    });
    if (duplicate) throw new BadRequestException('E-mail já cadastrado');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { email } }),
      this.prisma.organization.update({
        where: { id: organization.id },
        data: {
          name: displayName,
          creatorProfile: {
            update: {
              displayName,
              bio: input.bio?.trim().slice(0, 500) || null,
              avatarUrl: input.avatarUrl?.trim() || null,
            },
          },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: user.id,
          action: 'account.profile.update',
          targetType: 'User',
          targetId: user.id,
          metadata: {},
        },
      }),
    ]);
    return this.me(token);
  }

  async changePassword(
    token: string | undefined,
    currentPassword: string,
    newPassword: string,
  ) {
    if (newPassword.length < 10)
      throw new BadRequestException(
        'A nova senha deve ter pelo menos 10 caracteres',
      );
    const currentSession = await this.sessionFromToken(token);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: currentSession.userId },
    });
    if (!(await this.verifyPassword(currentPassword, user.passwordHash)))
      throw new UnauthorizedException('Senha atual incorreta');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.hashPassword(newPassword) },
      }),
      this.prisma.session.updateMany({
        where: {
          userId: user.id,
          id: { not: currentSession.id },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async deactivateOrganization(
    token: string | undefined,
    confirmation: string,
  ) {
    const user = await this.me(token);
    const membership = user.memberships[0];
    if (!membership?.organization || membership.role !== 'OWNER')
      throw new ForbiddenException(
        'Somente o proprietário pode desativar a organização',
      );
    if (confirmation !== membership.organization.name)
      throw new BadRequestException(
        'Digite exatamente o nome da organização para confirmar',
      );
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.organization.update({
        where: { id: membership.organization.id },
        data: {
          deactivatedAt: now,
          creatorProfile: { update: { isPublished: false } },
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.auditLog.create({
        data: {
          organizationId: membership.organization.id,
          actorUserId: user.id,
          action: 'organization.deactivate',
          targetType: 'Organization',
          targetId: membership.organization.id,
        },
      }),
    ]);
  }

  async sessions(token?: string) {
    const current = await this.sessionFromToken(token);
    const sessions = await this.prisma.session.findMany({
      where: {
        userId: current.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((session) => ({
      id: session.id,
      current: session.id === current.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
    }));
  }

  async revokeSession(token: string | undefined, sessionId: string) {
    const current = await this.sessionFromToken(token);
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId: current.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0)
      throw new BadRequestException('Sessão não encontrada');
    return { revoked: true, current: sessionId === current.id };
  }

  async logoutAll(token?: string) {
    const current = await this.sessionFromToken(token);
    await this.prisma.session.updateMany({
      where: { userId: current.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async sessionFromToken(token?: string) {
    if (!token) throw new UnauthorizedException();
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: this.digest(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) throw new UnauthorizedException();
    return session;
  }

  private async createSession(userId: string, metadata: SessionMetadata = {}) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.digest(token),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
        userAgent: metadata.userAgent?.slice(0, 500),
        ipAddress: metadata.ipAddress?.slice(0, 64),
      },
    });
    return token;
  }
  private digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
  private async hashPassword(password: string) {
    const salt = randomBytes(16);
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }
  private async verifyPassword(password: string, stored: string) {
    const [saltHex, keyHex] = stored.split(':');
    if (!saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, 'hex');
    const actual = (await scrypt(
      password,
      Buffer.from(saltHex, 'hex'),
      expected.length,
    )) as Buffer;
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
}
