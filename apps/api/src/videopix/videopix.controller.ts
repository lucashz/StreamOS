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
import { VideoPixService, type VideoSessionInput } from './videopix.service';

@Controller()
export class VideoPixController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(VideoPixService) private readonly videos: VideoPixService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}
  @Get('public/creators/:slug/videopix') session(@Param('slug') slug: string) {
    return this.videos.publicSession(slug);
  }
  @Post('public/videopix/sessions/:id/preview') preview(
    @Param('id') id: string,
    @Body()
    body: { url: string; selectedSeconds?: number; startAtSeconds?: number },
  ) {
    return this.videos.preview(
      id,
      body.url,
      body.selectedSeconds,
      body.startAtSeconds,
    );
  }
  @Post('public/videopix/sessions/:id/checkout')
  async checkout(
    @Param('id') id: string,
    @Body()
    body: {
      url: string;
      supporterName: string;
      amountInCents?: number;
      selectedSeconds?: number;
      startAtSeconds?: number;
    },
  ) {
    const request = await this.videos.createCheckoutRequest(id, body);
    const payment = await this.payments.createVideoIntent(request.id);
    return { requestId: request.id, ...payment };
  }
  @Get('public/videopix/requests/:id') requestStatus(@Param('id') id: string) {
    return this.videos.publicRequest(id);
  }
  @Get('dashboard/videopix/sessions')
  @RequirePermission('videopix:read')
  async sessions(@Req() request: Request) {
    const account = await this.account(request);
    return this.videos.sessions(account.organizationId);
  }
  @Post('dashboard/videopix/sessions')
  @RequirePermission('videopix:write')
  async create(@Req() request: Request, @Body() body: VideoSessionInput) {
    const account = await this.account(request);
    return this.videos.create(account.organizationId, account.userId, body);
  }
  @Put('dashboard/videopix/sessions/:id')
  @RequirePermission('videopix:write')
  async update(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: VideoSessionInput,
  ) {
    const account = await this.account(request);
    return this.videos.update(account.organizationId, account.userId, id, body);
  }
  @Post('dashboard/videopix/sessions/:id/activate')
  @RequirePermission('videopix:write')
  async activate(@Param('id') id: string, @Req() request: Request) {
    const account = await this.account(request);
    return this.videos.activate(account.organizationId, account.userId, id);
  }
  @Get('dashboard/videopix/sessions/:id/queue')
  @RequirePermission('videopix:read')
  async queue(@Param('id') id: string, @Req() request: Request) {
    const account = await this.account(request);
    return this.videos.queue(account.organizationId, id);
  }
  @Post('dashboard/videopix/requests/:id/action')
  @RequirePermission('videopix:write')
  async action(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { action: string },
  ) {
    const account = await this.account(request);
    return this.videos.action(
      account.organizationId,
      account.userId,
      id,
      body.action,
    );
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
