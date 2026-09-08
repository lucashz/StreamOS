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
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../identity/auth.service';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get('summary')
  @RequirePermission('contributions:read')
  async summary(@Req() request: Request) {
    return this.dashboard.summary(await this.organizationId(request));
  }

  @Get('operations')
  @RequirePermission('settings:write')
  async operations(@Req() request: Request) {
    return this.dashboard.operations(await this.organizationId(request));
  }

  @Get('onboarding')
  @RequirePermission('settings:write')
  async onboarding(@Req() request: Request) {
    return this.dashboard.onboarding(await this.organizationId(request));
  }

  @Put('onboarding')
  @RequirePermission('settings:write')
  async updateOnboarding(
    @Req() request: Request,
    @Body()
    body: {
      displayName: string;
      slug: string;
      bio?: string;
      avatarUrl?: string | null;
      coverUrl?: string | null;
      minimumContributionInCents: number;
      isPublished: boolean;
      legalName?: string;
      taxId?: string;
      financialTermsAccepted?: boolean;
    },
  ) {
    const user = await this.auth.me(
      request.cookies?.streamos_session as string | undefined,
    );
    const organization = user.memberships[0]?.organization;
    if (!organization) throw new Error('Organização não encontrada');
    return this.dashboard.updateOnboarding(organization.id, user.id, body);
  }

  @Post('overlay/rotate-token')
  @RequirePermission('widgets:write')
  async rotateOverlayToken(@Req() request: Request) {
    const user = await this.auth.me(
      request.cookies?.streamos_session as string | undefined,
    );
    const organization = user.memberships[0]?.organization;
    return organization
      ? this.dashboard.rotateOverlayToken(organization.id, user.id)
      : null;
  }

  @Get('overlay/status')
  @RequirePermission('widgets:read')
  async overlayStatus(@Req() request: Request) {
    return this.dashboard.overlayStatus(await this.organizationId(request));
  }

  @Get('wallet')
  @RequirePermission('wallet:read')
  async wallet(@Req() request: Request) {
    return this.dashboard.wallet(await this.organizationId(request));
  }

  @Get('wallet/settings')
  @RequirePermission('wallet:read')
  async walletSettings(@Req() request: Request) {
    return this.dashboard.walletSettings(await this.organizationId(request));
  }

  @Put('wallet/pix-key')
  @RequirePermission('wallet:write')
  async updatePixKey(
    @Req() request: Request,
    @Body() body: { type: string; value: string },
  ) {
    const user = await this.auth.me(
      request.cookies?.streamos_session as string | undefined,
    );
    const organization = user.memberships[0]?.organization;
    if (!organization) throw new Error('Organização não encontrada');
    return this.dashboard.updatePixKey(organization.id, user.id, body);
  }

  @Get('wallet/receivables')
  @RequirePermission('wallet:read')
  async receivables(@Req() request: Request) {
    return this.dashboard.receivables(await this.organizationId(request));
  }

  @Get('wallet/statement')
  @RequirePermission('wallet:read')
  async statement(
    @Req() request: Request,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.statement(await this.organizationId(request), {
      type,
      from,
      to,
    });
  }

  @Get('wallet/statement.csv')
  @RequirePermission('wallet:read')
  async statementCsv(
    @Req() request: Request,
    @Res() response: Response,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.dashboard.statementCsv(
      await this.organizationId(request),
      { type, from, to },
    );
    response
      .header('content-type', 'text/csv; charset=utf-8')
      .header(
        'content-disposition',
        'attachment; filename="extrato-streamos.csv"',
      )
      .send(csv);
  }

  @Get('wallet/payouts/:id')
  @RequirePermission('wallet:read')
  async payout(@Param('id') id: string, @Req() request: Request) {
    return this.dashboard.payout(await this.organizationId(request), id);
  }

  @Get('contributions')
  @RequirePermission('contributions:read')
  async contributions(@Req() request: Request) {
    return this.dashboard.contributions(await this.organizationId(request));
  }

  @Put('goal')
  @RequirePermission('widgets:write')
  async updateGoal(
    @Req() request: Request,
    @Body()
    body: {
      title: string;
      targetInCents: number;
      active?: boolean;
      deadline?: string | null;
      color?: string;
      imageUrl?: string | null;
      completionMessage?: string | null;
    },
  ) {
    return this.dashboard.updateGoal(await this.organizationId(request), body);
  }

  @Get('alert-config')
  @RequirePermission('alerts:read')
  async alertConfig(@Req() request: Request) {
    return this.dashboard.alertConfig(await this.organizationId(request));
  }

  @Put('alert-config')
  @RequirePermission('alerts:write')
  async updateAlertConfig(
    @Req() request: Request,
    @Body()
    body: {
      enabled: boolean;
      minimumInCents: number;
      durationMs: number;
      accent: string;
    },
  ) {
    return this.dashboard.updateAlertConfig(
      await this.organizationId(request),
      body,
    );
  }

  @Post('alert-test')
  @RequirePermission('alerts:test')
  async testAlert(@Req() request: Request) {
    return this.dashboard.testAlert(await this.organizationId(request));
  }

  private async organizationId(request: Request) {
    const user = await this.auth.me(
      request.cookies?.streamos_session as string | undefined,
    );
    const organization = user.memberships[0]?.organization;
    if (!organization) throw new Error('Organização não encontrada');
    return organization.id;
  }
}
