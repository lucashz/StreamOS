import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Put,
  Param,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../identity/auth.service';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ModerationService } from './moderation.service';
@Controller('dashboard/moderation')
export class ModerationController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ModerationService) private readonly moderation: ModerationService,
  ) {}
  @Get()
  @RequirePermission('moderation:read')
  async overview(@Req() req: Request) {
    const a = await this.account(req);
    return this.moderation.overview(a.organizationId);
  }
  @Put('settings')
  @RequirePermission('moderation:write')
  async settings(
    @Req() req: Request,
    @Body()
    body: {
      moderationEnabled: boolean;
      ttsEnabled: boolean;
      voice: string;
      minimumInCents: number;
      maximumCharacters: number;
      paused: boolean;
    },
  ) {
    const a = await this.account(req);
    return this.moderation.settings(a.organizationId, a.userId, body);
  }
  @Post('policies')
  @RequirePermission('moderation:write')
  async policy(
    @Req() req: Request,
    @Body()
    body: {
      name: string;
      blockedWords: string[];
      blockLinks: boolean;
      minimumInCents: number;
    },
  ) {
    const a = await this.account(req);
    return this.moderation.createPolicy(a.organizationId, a.userId, body);
  }
  @Post('items/:id/decision')
  @RequirePermission('moderation:write')
  async decide(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { decision: string; reason?: string },
  ) {
    const a = await this.account(req);
    return this.moderation.decide(
      a.organizationId,
      a.userId,
      id,
      body.decision,
      body.reason,
    );
  }
  private async account(req: Request) {
    const user = await this.auth.me(
      req.cookies?.streamos_session as string | undefined,
    );
    const organization = user.memberships[0]?.organization;
    if (!organization) throw new Error('Organização não encontrada');
    return { organizationId: organization.id, userId: user.id };
  }
}
