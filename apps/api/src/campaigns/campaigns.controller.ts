/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../identity/auth.service';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { PaymentsService } from '../payments/payments.service';
import {
  CampaignsService,
  type CampaignInput,
  type RewardInput,
} from './campaigns.service';

@Controller()
export class CampaignsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CampaignsService) private readonly campaigns: CampaignsService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}
  @Get('public/creators/:creatorSlug/campaigns/:campaignSlug') publicCampaign(
    @Param('creatorSlug') creator: string,
    @Param('campaignSlug') campaign: string,
  ) {
    return this.campaigns.publicCampaign(creator, campaign);
  }
  @Post('public/campaigns/:id/contributions') contribution(
    @Param('id') id: string,
    @Body()
    body: {
      amountInCents: number;
      supporterName?: string;
      message?: string;
      rewardId?: string;
    },
  ) {
    return this.payments.createCampaignIntent(id, body);
  }
  @Get('dashboard/campaigns')
  @RequirePermission('campaigns:read')
  async list(@Req() request: Request) {
    const a = await this.account(request);
    return this.campaigns.list(a.organizationId);
  }
  @Post('dashboard/campaigns')
  @RequirePermission('campaigns:write')
  async create(@Req() request: Request, @Body() body: CampaignInput) {
    const a = await this.account(request);
    return this.campaigns.create(a.organizationId, a.userId, body);
  }
  @Put('dashboard/campaigns/:id')
  @RequirePermission('campaigns:write')
  async update(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: CampaignInput,
  ) {
    const a = await this.account(request);
    return this.campaigns.update(a.organizationId, a.userId, id, body);
  }
  @Post('dashboard/campaigns/:id/status')
  @RequirePermission('campaigns:write')
  async status(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { status: string },
  ) {
    const a = await this.account(request);
    return this.campaigns.status(a.organizationId, a.userId, id, body.status);
  }
  @Post('dashboard/campaigns/:id/rewards')
  @RequirePermission('campaigns:write')
  async reward(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: RewardInput,
  ) {
    const a = await this.account(request);
    return this.campaigns.addReward(a.organizationId, a.userId, id, body);
  }
  @Post('dashboard/reward-claims/:id/deliver')
  @RequirePermission('campaigns:write')
  async deliver(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { note?: string },
  ) {
    const a = await this.account(request);
    return this.campaigns.deliver(a.organizationId, a.userId, id, body.note);
  }
  private async account(request: Request) {
    const user = await this.auth.me(
      request.cookies?.streamos_session as string | undefined,
    );
    const organization = user.memberships[0]?.organization;
    if (!organization) throw new Error('Organização não encontrada');
    return { organizationId: organization.id, userId: user.id };
  }
}
