import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../identity/auth.service';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { PlatformService } from './platform.service';
@Controller()
export class PlatformController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PlatformService) private readonly service: PlatformService,
  ) {}
  @Get('dashboard/platform')
  @RequirePermission('team:read')
  async overview(@Req() r: Request) {
    const a = await this.account(r);
    return this.service.overview(a.organizationId);
  }
  @Patch('dashboard/team/members/:id')
  @RequirePermission('team:write')
  async memberRole(
    @Param('id') id: string,
    @Req() r: Request,
    @Body() b: { role: string },
  ) {
    const a = await this.account(r);
    return this.service.updateMember(a.organizationId, a.userId, id, b.role);
  }
  @Delete('dashboard/team/members/:id')
  @RequirePermission('team:write')
  async removeMember(@Param('id') id: string, @Req() r: Request) {
    const a = await this.account(r);
    return this.service.removeMember(a.organizationId, a.userId, id);
  }
  @Post('dashboard/team/invites/:id/revoke')
  @RequirePermission('team:write')
  async revokeInvite(@Param('id') id: string, @Req() r: Request) {
    const a = await this.account(r);
    return this.service.revokeInvite(a.organizationId, a.userId, id);
  }
  @Post('dashboard/team/invites')
  @RequirePermission('team:write')
  async invite(@Req() r: Request, @Body() b: { email: string; role: string }) {
    const a = await this.account(r);
    return this.service.invite(a.organizationId, a.userId, b.email, b.role);
  }
  @Post('dashboard/team/invites/accept') async accept(
    @Req() r: Request,
    @Body() b: { token: string },
  ) {
    const a = await this.account(r);
    return this.service.accept(b.token, a.userId);
  }
  @Post('dashboard/api-tokens')
  @RequirePermission('tokens:write')
  async token(
    @Req() r: Request,
    @Body() b: { name: string; scopes: string[]; expiresAt?: string },
  ) {
    const a = await this.account(r);
    return this.service.token(a.organizationId, a.userId, b);
  }
  @Post('dashboard/api-tokens/:id/revoke')
  @RequirePermission('tokens:write')
  async revoke(@Param('id') id: string, @Req() r: Request) {
    const a = await this.account(r);
    return this.service.revokeToken(a.organizationId, a.userId, id);
  }
  @Post('dashboard/api-tokens/:id/rotate')
  @RequirePermission('tokens:write')
  async rotate(@Param('id') id: string, @Req() r: Request) {
    const a = await this.account(r);
    return this.service.rotateToken(a.organizationId, a.userId, id);
  }
  @Get('v1/account')
  async apiAccount(@Headers('authorization') authorization?: string) {
    const token = await this.service.authenticateToken(
      authorization?.replace(/^Bearer\s+/i, ''),
      'payments:read',
    );
    return {
      organizationId: token.organizationId,
      tokenId: token.id,
      scopes: token.scopes,
    };
  }
  @Post('dashboard/webhook-endpoints')
  @RequirePermission('webhooks:write')
  async webhook(
    @Req() r: Request,
    @Body() b: { url: string; events: string[] },
  ) {
    const a = await this.account(r);
    return this.service.webhook(a.organizationId, a.userId, b);
  }
  @Patch('dashboard/webhook-endpoints/:id')
  @RequirePermission('webhooks:write')
  async toggleWebhook(
    @Param('id') id: string,
    @Req() r: Request,
    @Body() b: { enabled: boolean },
  ) {
    const a = await this.account(r);
    return this.service.toggleWebhook(
      a.organizationId,
      a.userId,
      id,
      Boolean(b.enabled),
    );
  }
  @Post('dashboard/webhook-deliveries/:id/retry')
  @RequirePermission('webhooks:write')
  async retryDelivery(@Param('id') id: string, @Req() r: Request) {
    const a = await this.account(r);
    return this.service.retryDelivery(a.organizationId, a.userId, id);
  }
  @Post('dashboard/webhook-endpoints/:id/rotate-secret')
  @RequirePermission('webhooks:write')
  async rotateWebhookSecret(@Param('id') id: string, @Req() r: Request) {
    const a = await this.account(r);
    return this.service.rotateWebhookSecret(a.organizationId, a.userId, id);
  }
  @Post('dashboard/integrations/:provider/connect')
  @RequirePermission('integrations:write')
  async connect(
    @Param('provider') p: string,
    @Req() r: Request,
    @Body() b: { displayName?: string },
  ) {
    const a = await this.account(r);
    return this.service.connect(a.organizationId, a.userId, p, b.displayName);
  }
  @Post('dashboard/integrations/:provider/disconnect')
  @RequirePermission('integrations:write')
  async disconnect(@Param('provider') p: string, @Req() r: Request) {
    const a = await this.account(r);
    return this.service.disconnect(a.organizationId, a.userId, p);
  }
  @Post('dashboard/integrations/:provider/test')
  @RequirePermission('integrations:write')
  async testIntegration(@Param('provider') p: string, @Req() r: Request) {
    const a = await this.account(r);
    return this.service.testIntegration(a.organizationId, a.userId, p);
  }
  private async account(r: Request) {
    const u = await this.auth.me(
      r.cookies?.streamos_session as string | undefined,
    );
    const o = u.memberships[0]?.organization;
    if (!o) throw new Error('Organização não encontrada');
    return { organizationId: o.id, userId: u.id };
  }
}
