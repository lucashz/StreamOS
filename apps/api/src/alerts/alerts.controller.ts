import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthService } from '../identity/auth.service';
import { RequirePermission } from '../authorization/require-permission.decorator';
import {
  AlertsService,
  type AlertVariationInput,
  type GlobalAppearanceInput,
} from './alerts.service';

@Controller('dashboard/alerts')
export class AlertsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AlertsService) private readonly alerts: AlertsService,
  ) {}

  @Get('editor')
  @RequirePermission('alerts:read')
  async editor(@Req() request: Request): Promise<unknown> {
    const actor = await this.actor(request);
    return this.alerts.editor(actor.organizationId);
  }

  @Get('appearance')
  @RequirePermission('alerts:read')
  async appearance(@Req() request: Request): Promise<unknown> {
    const actor = await this.actor(request);
    return this.alerts.appearance(actor.organizationId);
  }

  @Put('enabled')
  @RequirePermission('alerts:write')
  async updateEnabled(
    @Req() request: Request,
    @Body() body: { enabled: boolean },
  ): Promise<unknown> {
    return this.alerts.updateEnabled(
      await this.editorActor(request),
      body.enabled,
    );
  }

  @Put('appearance')
  @RequirePermission('alerts:write')
  async updateAppearance(
    @Req() request: Request,
    @Body() body: GlobalAppearanceInput,
  ): Promise<unknown> {
    return this.alerts.updateAppearance(await this.editorActor(request), body);
  }

  @Post('variations')
  @RequirePermission('alerts:write')
  async create(
    @Req() request: Request,
    @Body() body: AlertVariationInput,
  ): Promise<unknown> {
    return this.alerts.createVariation(await this.editorActor(request), body);
  }

  @Put('variations/:id')
  @RequirePermission('alerts:write')
  async update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: AlertVariationInput,
  ): Promise<unknown> {
    return this.alerts.updateVariation(
      await this.editorActor(request),
      id,
      body,
    );
  }

  @Post('variations/:id/duplicate')
  @RequirePermission('alerts:write')
  async duplicate(
    @Req() request: Request,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.alerts.duplicate(await this.editorActor(request), id);
  }

  @Delete('variations/:id')
  @RequirePermission('alerts:write')
  async remove(
    @Req() request: Request,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.alerts.remove(await this.editorActor(request), id);
  }

  @Post('assets')
  @RequirePermission('alerts:write')
  async asset(
    @Req() request: Request,
    @Body() body: Parameters<AlertsService['createAsset']>[1],
  ): Promise<unknown> {
    return this.alerts.createAsset(await this.editorActor(request), body);
  }

  @Post('assets/upload')
  @RequirePermission('alerts:write')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50_000_000, files: 1 } }),
  )
  async upload(
    @Req() request: Request,
    @UploadedFile()
    file:
      | { originalname: string; mimetype: string; size: number; buffer: Buffer }
      | undefined,
    @Body()
    body: {
      name?: string;
      durationMs?: string;
      width?: string;
      height?: string;
    },
  ): Promise<unknown> {
    if (!file) throw new ForbiddenException('Arquivo não enviado');
    return this.alerts.uploadAsset(await this.editorActor(request), file, {
      name: body.name,
      durationMs: body.durationMs ? Number(body.durationMs) : undefined,
      width: body.width ? Number(body.width) : undefined,
      height: body.height ? Number(body.height) : undefined,
    });
  }

  @Delete('assets/:id')
  @RequirePermission('alerts:write')
  async removeAsset(
    @Req() request: Request,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.alerts.removeAsset(await this.editorActor(request), id);
  }

  @Post('test')
  @RequirePermission('alerts:test')
  async test(
    @Req() request: Request,
    @Body() body: { variationId?: string; sequence?: boolean },
  ): Promise<unknown> {
    const actor = await this.actor(request);
    if (!['OWNER', 'ADMIN', 'MODERATOR'].includes(actor.role))
      throw new ForbiddenException('Sem permissão para testar alertas');
    return this.alerts.test(actor, body.variationId, body.sequence);
  }

  private async editorActor(request: Request) {
    const actor = await this.actor(request);
    if (!['OWNER', 'ADMIN'].includes(actor.role))
      throw new ForbiddenException('Sem permissão para editar alertas');
    return actor;
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
