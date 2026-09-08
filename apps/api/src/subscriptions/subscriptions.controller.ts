/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../identity/auth.service';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { SubscriptionsService } from './subscriptions.service';
@Controller()
export class SubscriptionsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SubscriptionsService)
    private readonly service: SubscriptionsService,
  ) {}
  @Get('public/creators/:slug/plans') plans(@Param('slug') slug: string) {
    return this.service.publicPlans(slug);
  }
  @Post('public/plans/:id/subscribe') subscribe(
    @Param('id') id: string,
    @Body() body: { supporterName: string; supporterEmail: string },
  ) {
    return this.service.subscribe(id, body);
  }
  @Get('dashboard/subscription-plans')
  @RequirePermission('subscriptions:read')
  async list(@Req() r: Request) {
    const a = await this.account(r);
    return this.service.plans(a.organizationId);
  }
  @Post('dashboard/subscription-plans')
  @RequirePermission('subscriptions:write')
  async create(
    @Req() r: Request,
    @Body()
    b: {
      name: string;
      description?: string;
      priceInCents: number;
      benefits?: string[];
    },
  ) {
    const a = await this.account(r);
    return this.service.create(a.organizationId, a.userId, b);
  }
  @Post('dashboard/subscription-plans/:id/publish')
  @RequirePermission('subscriptions:write')
  async publish(
    @Param('id') id: string,
    @Req() r: Request,
    @Body() b: { published: boolean },
  ) {
    const a = await this.account(r);
    return this.service.publish(a.organizationId, a.userId, id, b.published);
  }
  @Post('dashboard/subscriptions/:id/cancel')
  @RequirePermission('subscriptions:write')
  async cancel(@Param('id') id: string, @Req() r: Request) {
    const a = await this.account(r);
    return this.service.cancel(a.organizationId, a.userId, id);
  }
  @Post('dashboard/subscriptions/:id/renew')
  @RequirePermission('subscriptions:write')
  async renew(
    @Param('id') id: string,
    @Req() r: Request,
    @Body() body: { idempotencyKey: string; fail?: boolean },
  ) {
    const a = await this.account(r);
    return this.service.renew(
      a.organizationId,
      a.userId,
      id,
      body.idempotencyKey,
      body.fail,
    );
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
