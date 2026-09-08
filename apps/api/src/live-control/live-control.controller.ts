import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../identity/auth.service';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { LiveControlService } from './live-control.service';

@Controller('dashboard/live-control')
export class LiveControlController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(LiveControlService) private readonly live: LiveControlService,
  ) {}

  @Get()
  @RequirePermission('live:read')
  async snapshot(@Req() request: Request): Promise<unknown> {
    return this.live.snapshot(await this.actor(request));
  }

  @Get('history')
  @RequirePermission('live:read')
  async history(
    @Req() request: Request,
    @Query()
    query: {
      page?: string;
      limit?: string;
      sessionId?: string;
      status?: string;
      kind?: string;
      minAmount?: string;
      q?: string;
    },
  ): Promise<unknown> {
    return this.live.history(await this.actor(request), query);
  }

  @Get('history.csv')
  @RequirePermission('live:read')
  async historyCsv(
    @Req() request: Request,
    @Res() response: Response,
    @Query()
    query: {
      sessionId?: string;
      status?: string;
      kind?: string;
      minAmount?: string;
      q?: string;
    },
  ) {
    const csv = await this.live.historyCsv(await this.actor(request), query);
    response.setHeader('content-type', 'text/csv; charset=utf-8');
    response.setHeader(
      'content-disposition',
      `attachment; filename="streamos-historico-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    response.send(`\uFEFF${csv}`);
  }

  @Post('commands')
  @RequirePermission('live:operate')
  async command(
    @Req() request: Request,
    @Body()
    body: {
      action: string;
      itemId?: string;
      reason?: string;
      idempotencyKey: string;
      origin?: string;
      position?: number;
      value?: boolean;
      volume?: number;
      name?: string;
      mode?: string;
    },
  ): Promise<unknown> {
    return this.live.command(await this.actor(request), body);
  }

  private async actor(request: Request) {
    const user = await this.auth.me(
      request.cookies?.streamos_session as string | undefined,
    );
    const membership = user.memberships[0];
    if (!membership) throw new Error('Organização não encontrada');
    return {
      organizationId: membership.organization.id,
      userId: user.id,
      role: membership.role,
    };
  }
}
