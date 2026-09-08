import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthService } from '../identity/auth.service';
import { RequirePermission } from '../authorization/require-permission.decorator';
import type { ProviderWebhook } from './payment-provider';
import { mockPaymentsEnabled } from './mock-payment.policy';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get('public/creators/:slug')
  async creator(@Param('slug') slug: string) {
    const creator = await this.payments.creator(slug);
    return creator ?? { error: 'not_found' };
  }

  @Post('public/creators/:slug/payment-intents')
  createIntent(
    @Param('slug') slug: string,
    @Body()
    body: {
      amountInCents: number;
      supporterName?: string;
      message?: string;
      anonymous?: boolean;
      ttsVoice?: string;
    },
  ) {
    return this.payments.createIntent(slug, body);
  }

  @Post('public/creators/:slug/audio-payment-intents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5_000_000, files: 1 } }),
  )
  createAudioIntent(
    @Param('slug') slug: string,
    @UploadedFile()
    file:
      | { originalname: string; mimetype: string; size: number; buffer: Buffer }
      | undefined,
    @Body()
    body: {
      amountInCents?: string;
      supporterName?: string;
      anonymous?: string;
      durationSeconds?: string;
    },
  ) {
    return this.payments.createAudioIntent(slug, file, {
      amountInCents: Number(body.amountInCents),
      supporterName: body.supporterName,
      anonymous: body.anonymous === 'true',
      durationSeconds: Number(body.durationSeconds),
    });
  }

  @Get('public/payment-intents/:id')
  intentStatus(@Param('id') id: string) {
    return this.payments.intentStatus(id);
  }

  @Get('public/payment-simulation')
  paymentSimulation() {
    return { enabled: mockPaymentsEnabled(process.env) };
  }

  @Post('mock/payment-intents/:id/confirm')
  confirm(@Param('id') id: string) {
    this.assertMockPaymentsEnabled();
    return this.payments.simulateProviderConfirmation(id);
  }

  @Post('webhooks/mock')
  webhook(
    @Headers('x-streamos-signature') signature: string | undefined,
    @Body()
    body: ProviderWebhook,
  ) {
    this.assertMockPaymentsEnabled();
    return this.payments.processMockWebhook(body, signature);
  }

  @Post('webhooks/woovi')
  wooviWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-webhook-signature') providerSignature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
    @Body() body: unknown,
  ) {
    return this.payments.processWooviWebhook(
      body,
      authorization,
      request.rawBody,
      providerSignature,
    );
  }

  @Post('dashboard/payments/:id/make-available')
  @RequirePermission('wallet:write')
  async makeAvailable(@Param('id') id: string, @Req() request: Request) {
    return this.payments.makeFundsAvailable(
      id,
      await this.organizationId(request),
    );
  }

  @Post('dashboard/payouts')
  @RequirePermission('wallet:write')
  async payout(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: { amountInCents: number },
    @Req() request: Request,
  ) {
    const account = await this.account(request);
    return this.payments.payout(
      account.organizationId,
      account.userId,
      body.amountInCents,
      idempotencyKey ?? '',
    );
  }

  @Get('dashboard/reconciliation')
  @RequirePermission('wallet:read')
  async reconcile(@Req() request: Request) {
    return this.payments.reconcile(await this.organizationId(request));
  }

  private async organizationId(request: Request) {
    return (await this.account(request)).organizationId;
  }

  private async account(request: Request) {
    const user = await this.auth.me(
      request.cookies?.streamos_session as string | undefined,
    );
    const organization = user.memberships[0]?.organization;
    if (!organization) throw new Error('Organização não encontrada');
    return { organizationId: organization.id, userId: user.id };
  }

  private assertMockPaymentsEnabled() {
    if (!mockPaymentsEnabled(process.env)) throw new NotFoundException();
  }
}
