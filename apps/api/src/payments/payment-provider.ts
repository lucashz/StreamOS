import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type ProviderWebhook = {
  eventId: string;
  type: 'payment.confirmed';
  intentId: string;
};
export type PixCharge = {
  reference: string;
  pixCopyPaste: string;
  qrCodePayload: string;
  status?: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
};
export type PixOut = {
  reference: string;
  status: 'REQUESTED' | 'PAID' | 'FAILED';
};
export type ProviderSubaccount = {
  id: string;
  pixKey: string;
  balanceInCents: bigint;
  withdrawBlocked: boolean;
};

export interface PaymentProvider {
  readonly name: string;
  createCharge(input: {
    amountInCents: bigint;
    idempotencyKey: string;
    comment?: string;
    subaccountPixKey?: string;
    subaccountAmountInCents?: bigint;
  }): Promise<PixCharge>;
  createSubaccount?(input: {
    name: string;
    pixKey: string;
  }): Promise<ProviderSubaccount>;
  getSubaccount?(id: string): Promise<ProviderSubaccount>;
  getSubaccountStatement?(
    id: string,
  ): Promise<
    Array<{ reference: string; amountInCents: bigint; occurredAt: Date }>
  >;
  withdrawSubaccount?(input: {
    id: string;
    amountInCents: bigint;
    idempotencyKey: string;
  }): Promise<PixOut>;
  getCharge?(reference: string): Promise<PixCharge>;
  getBalance?(): Promise<{ availableInCents: bigint }>;
  requestPixOut?(input: {
    amountInCents: bigint;
    destinationKey: string;
    idempotencyKey: string;
  }): Promise<PixOut>;
  getPixOut?(reference: string): Promise<PixOut>;
  getStatement?(
    from: Date,
    to: Date,
  ): Promise<
    Array<{ reference: string; amountInCents: bigint; occurredAt: Date }>
  >;
  processRegulatoryIncident?(input: {
    paymentReference: string;
    kind: 'MED' | 'COMPULSORY_RETURN';
    reason: string;
  }): Promise<{ incidentReference: string }>;
  confirmation?(intentId: string): {
    body: ProviderWebhook;
    signature: string;
  };
  parseWebhook(
    body: unknown,
    authorization?: string,
    rawBody?: Buffer,
    providerSignature?: string,
  ): ProviderWebhook;
  reconcile?(reference: string): Promise<'PENDING' | 'CONFIRMED' | 'DIVERGENT'>;
}

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly payouts = new Map<string, PixOut>();

  createCharge() {
    const reference = `mock_${randomUUID()}`;
    return Promise.resolve({
      reference,
      pixCopyPaste: `STREAMOS-MOCK-${reference}`,
      qrCodePayload: `streamos://mock/${reference}`,
    });
  }

  confirmation(intentId: string) {
    const body: ProviderWebhook = {
      eventId: `mock_event_${randomUUID()}`,
      type: 'payment.confirmed',
      intentId,
    };
    return { body, signature: this.sign(body) };
  }

  parseWebhook(body: unknown, signature?: string) {
    const value = body as ProviderWebhook;
    if (!signature || !this.verify(value, signature))
      throw new Error('Assinatura do webhook inválida');
    return value;
  }

  requestPixOut(input: {
    amountInCents: bigint;
    destinationKey: string;
    idempotencyKey: string;
  }) {
    const existing = this.payouts.get(input.idempotencyKey);
    if (existing) return Promise.resolve(existing);
    const payout: PixOut = {
      reference: `mock_payout_${input.idempotencyKey}`,
      status: 'PAID',
    };
    this.payouts.set(input.idempotencyKey, payout);
    return Promise.resolve(payout);
  }

  getPixOut(reference: string) {
    return Promise.resolve(
      [...this.payouts.values()].find(
        (payout) => payout.reference === reference,
      ) ?? {
        reference,
        status: 'FAILED' as const,
      },
    );
  }

  verify(body: ProviderWebhook, signature: string) {
    const expected = Buffer.from(this.sign(body), 'hex');
    const received = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }

  private sign(body: ProviderWebhook) {
    return createHmac(
      'sha256',
      process.env.WEBHOOK_MOCK_SECRET ?? 'local-development-secret',
    )
      .update(JSON.stringify(body))
      .digest('hex');
  }
}
