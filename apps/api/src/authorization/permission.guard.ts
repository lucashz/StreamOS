import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaClient } from '@streamos/database';
import { AuthService } from '../identity/auth.service';
import { hasPermission, type Permission } from './permissions';
import { PERMISSION_METADATA } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
  ) {}
  async canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<Permission>(
      PERMISSION_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.auth.me(
      request.cookies?.streamos_session as string | undefined,
    );
    const membership = user.memberships[0];
    if (membership && hasPermission(membership.role, permission)) return true;
    if (membership)
      await this.prisma.auditLog.create({
        data: {
          organizationId: membership.organization.id,
          actorUserId: user.id,
          action: 'authorization.denied',
          targetType: 'Permission',
          targetId: permission,
          metadata: {
            role: membership.role,
            method: request.method,
            path: request.path,
          },
        },
      });
    throw new ForbiddenException(`Permissão necessária: ${permission}`);
  }
}
