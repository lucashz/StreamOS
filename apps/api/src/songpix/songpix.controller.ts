import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../identity/auth.service';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { PaymentsService } from '../payments/payments.service';
import { SongPixService } from './songpix.service';

@Controller()
export class SongPixController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SongPixService) private readonly songpix: SongPixService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  @Get('public/songpix/catalog') async catalog(@Query('q') query = '') {
    return this.songpix.catalog(query);
  }
  @Get('public/creators/:slug/songpix') session(@Param('slug') slug: string) {
    return this.songpix.publicSession(slug);
  }
  @Post('public/songpix/sessions/:id/checkout')
  async checkout(
    @Param('id') id: string,
    @Body()
    body: { songId: string; supporterName: string; amountInCents?: number },
  ) {
    const request = await this.songpix.createCheckoutRequest(id, body);
    const payment = await this.payments.createSongIntent(request.id);
    return { requestId: request.id, ...payment };
  }
  @Get('dashboard/songpix/sessions')
  @RequirePermission('songpix:read')
  async sessions(@Req() request: Request) {
    const account = await this.account(request);
    return this.songpix.sessions(account.organizationId);
  }
  @Post('dashboard/songpix/sessions')
  @RequirePermission('songpix:write')
  async create(
    @Req() request: Request,
    @Body() body: Parameters<SongPixService['createSession']>[2],
  ) {
    const account = await this.account(request);
    return this.songpix.createSession(
      account.organizationId,
      account.userId,
      body,
    );
  }
  @Put('dashboard/songpix/sessions/:id')
  @RequirePermission('songpix:write')
  async update(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: Parameters<SongPixService['createSession']>[2],
  ) {
    const account = await this.account(request);
    return this.songpix.updateSession(
      account.organizationId,
      account.userId,
      id,
      body,
    );
  }
  @Post('dashboard/songpix/sessions/:id/activate')
  @RequirePermission('songpix:write')
  async activate(@Param('id') id: string, @Req() request: Request) {
    const account = await this.account(request);
    return this.songpix.activate(account.organizationId, account.userId, id);
  }
  @Get('dashboard/songpix/sessions/:id/queue')
  @RequirePermission('songpix:read')
  async queue(@Param('id') id: string, @Req() request: Request) {
    const account = await this.account(request);
    return this.songpix.queue(account.organizationId, id);
  }
  @Post('dashboard/songpix/requests/:id/action')
  @RequirePermission('songpix:write')
  async action(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { action: string },
  ) {
    const account = await this.account(request);
    return this.songpix.action(
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
