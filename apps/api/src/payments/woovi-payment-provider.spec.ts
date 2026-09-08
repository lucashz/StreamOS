import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WooviPaymentProvider } from './woovi-payment-provider';

describe('WooviPaymentProvider contract', () => {
  beforeEach(() => {
    process.env.WOOVI_BASE_URL = 'https://api.woovi-sandbox.com';
    process.env.WOOVI_APP_ID = 'sandbox-app-id';
    process.env.WOOVI_WEBHOOK_AUTHORIZATION =
      'sandbox-webhook-authorization-32-characters';
    process.env.WOOVI_SOURCE_PIX_KEY = 'source-pix-key';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WOOVI_BASE_URL;
    delete process.env.WOOVI_APP_ID;
    delete process.env.WOOVI_WEBHOOK_AUTHORIZATION;
    delete process.env.WOOVI_SOURCE_PIX_KEY;
  });

  it('creates an idempotent Pix charge in cents', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          charge: {
            correlationID: 'intent-123',
            status: 'ACTIVE',
            brCode: '000201010212woovi',
            qrCodeImage: 'https://sandbox.example/qr.png',
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const charge = await new WooviPaymentProvider().createCharge({
      amountInCents: 1055n,
      idempotencyKey: 'intent-123',
      comment: 'Teste StreamOS',
    });
    expect(charge).toEqual({
      reference: 'intent-123',
      pixCopyPaste: '000201010212woovi',
      qrCodePayload: 'https://sandbox.example/qr.png',
      status: 'PENDING',
    });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.woovi-sandbox.com/api/v1/charge');
    expect(request.headers).toMatchObject({ authorization: 'sandbox-app-id' });
    expect(JSON.parse(request.body as string)).toMatchObject({
      correlationID: 'intent-123',
      value: 1055,
    });
  });

  it('normalizes a completed webhook using the correlation id', () => {
    const event = new WooviPaymentProvider().parseWebhook(
      {
        event: 'OPENPIX:CHARGE_COMPLETED',
        charge: {
          correlationID: 'intent-123',
          transactionID: 'pix-456',
          status: 'COMPLETED',
        },
      },
      'sandbox-webhook-authorization-32-characters',
    );
    expect(event).toEqual({
      eventId: 'OPENPIX:CHARGE_COMPLETED:pix-456',
      type: 'payment.confirmed',
      intentId: 'intent-123',
    });
  });

  it('creates charges with a creator subaccount split', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            charge: { correlationID: 'intent-split', brCode: 'pix-code' },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    await new WooviPaymentProvider().createCharge({
      amountInCents: 2000n,
      idempotencyKey: 'intent-split',
      subaccountPixKey: 'creator@example.com',
      subaccountAmountInCents: 1840n,
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(request.body as string) as { splits: unknown };
    expect(payload.splits).toEqual([
      {
        pixKey: 'creator@example.com',
        value: 1840,
        splitType: 'SPLIT_SUB_ACCOUNT',
      },
    ]);
  });

  it('creates and withdraws a creator subaccount', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            SubAccount: {
              id: 'sub-1',
              pixKey: 'creator@example.com',
              balance: 2500,
              withdrawBlocked: false,
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            transaction: { endToEndId: 'E-sub-payout', status: 'COMPLETED' },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new WooviPaymentProvider();
    await expect(
      provider.createSubaccount({
        name: 'Canal',
        pixKey: 'creator@example.com',
      }),
    ).resolves.toEqual({
      id: 'sub-1',
      pixKey: 'creator@example.com',
      balanceInCents: 2500n,
      withdrawBlocked: false,
    });
    await expect(
      provider.withdrawSubaccount({
        id: 'sub-1',
        amountInCents: 1000n,
        idempotencyKey: 'payout-sub-1',
      }),
    ).resolves.toEqual({ reference: 'E-sub-payout', status: 'PAID' });
    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain('/api/v1/subaccount/sub-1/withdraw');
    expect(JSON.parse(request.body as string)).toEqual({
      value: 1000,
      correlationID: 'payout-sub-1',
    });
  });

  it('requests Pix Out in cents without returning the destination key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          transaction: {
            correlationID: 'payout-123',
            endToEndId: 'E123456789',
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const payout = await new WooviPaymentProvider().requestPixOut({
      amountInCents: 1234n,
      destinationKey: 'destination-pix-key',
      idempotencyKey: 'payout-123',
    });
    expect(payout).toEqual({ reference: 'E123456789', status: 'PAID' });
    expect(payout).not.toHaveProperty('destinationKey');
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.woovi-sandbox.com/api/v1/transfer');
    expect(JSON.parse(request.body as string)).toEqual({
      value: 1234,
      fromPixKey: 'source-pix-key',
      toPixKey: 'destination-pix-key',
      correlationID: 'payout-123',
    });
  });

  it('rejects invalid authorization and unrelated events', () => {
    const provider = new WooviPaymentProvider();
    expect(() => provider.parseWebhook({}, 'wrong')).toThrow(
      'Autorização do webhook inválida',
    );
    expect(() =>
      provider.parseWebhook(
        { event: 'OPENPIX:CHARGE_EXPIRED', charge: { correlationID: 'x' } },
        'sandbox-webhook-authorization-32-characters',
      ),
    ).toThrow('Evento Woovi ignorado ou inválido');
  });
});
