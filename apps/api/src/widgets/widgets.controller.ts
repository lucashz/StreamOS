import {
  Body,
  Controller,
  Delete,
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
import { WidgetsService } from './widgets.service';

@Controller()
export class WidgetsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(WidgetsService) private readonly widgets: WidgetsService,
  ) {}

  @Get('dashboard/widgets/catalog')
  @RequirePermission('widgets:read')
  catalog() {
    return this.widgets.catalog();
  }

  @Get('dashboard/widgets')
  @RequirePermission('widgets:read')
  async list(@Req() request: Request) {
    const account = await this.account(request);
    return this.widgets.list(account.organizationId);
  }

  @Post('dashboard/widgets')
  @RequirePermission('widgets:write')
  async create(
    @Req() request: Request,
    @Body() body: { type: string; name?: string },
  ) {
    const account = await this.account(request);
    return this.widgets.create(account.organizationId, account.userId, body);
  }

  @Put('dashboard/widgets/:id')
  @RequirePermission('widgets:write')
  async update(
    @Param('id') id: string,
    @Req() request: Request,
    @Body()
    body: { name: string; enabled: boolean; config: Record<string, unknown> },
  ) {
    const account = await this.account(request);
    return this.widgets.update(
      account.organizationId,
      account.userId,
      id,
      body,
    );
  }

  @Post('dashboard/widgets/:id/duplicate')
  @RequirePermission('widgets:write')
  async duplicate(@Param('id') id: string, @Req() request: Request) {
    const account = await this.account(request);
    return this.widgets.duplicate(account.organizationId, account.userId, id);
  }

  @Post('dashboard/widgets/:id/rotate-token')
  @RequirePermission('widgets:write')
  async rotate(@Param('id') id: string, @Req() request: Request) {
    const account = await this.account(request);
    return this.widgets.rotateToken(account.organizationId, account.userId, id);
  }

  @Post('dashboard/widgets/:id/test')
  @RequirePermission('alerts:test')
  async test(
    @Param('id') id: string,
    @Body() body: { videoUrl?: string; songPlaybackUrl?: string },
    @Req() request: Request,
  ) {
    const account = await this.account(request);
    return this.widgets.test(account.organizationId, id, body);
  }

  @Delete('dashboard/widgets/:id')
  @RequirePermission('widgets:write')
  async remove(@Param('id') id: string, @Req() request: Request) {
    const account = await this.account(request);
    return this.widgets.remove(account.organizationId, account.userId, id);
  }

  @Get('public/widgets/config')
  publicConfig(@Query('token') token = '') {
    return this.widgets.publicConfig(token);
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
