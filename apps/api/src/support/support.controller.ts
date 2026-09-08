import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../identity/auth.service';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SupportService) private readonly support: SupportService,
  ) {}

  @Get('payments/:id')
  async payment(@Param('id') id: string, @Req() request: Request) {
    await this.operator(request);
    const payment = await this.support.payment(id);
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    return {
      ...payment,
      amountInCents: Number(payment.amountInCents),
      paymentIntent: {
        ...payment.paymentIntent,
        amountInCents: Number(payment.paymentIntent.amountInCents),
      },
    };
  }

  @Post('outbox/:id/reprocess')
  async reprocess(@Param('id') id: string, @Req() request: Request) {
    const operator = await this.operator(request);
    return this.support.reprocessOutbox(id, operator.id);
  }

  @Post('overlays/:id/revoke')
  async revoke(@Param('id') id: string, @Req() request: Request) {
    const operator = await this.operator(request);
    return this.support.revokeOverlay(id, operator.id);
  }

  private async operator(request: Request) {
    const user = await this.auth.me(
      request.cookies?.streamos_session as string | undefined,
    );
    if (!user.memberships.some((membership) => membership.role === 'SUPPORT'))
      throw new ForbiddenException('Acesso exclusivo do suporte');
    return user;
  }
}
