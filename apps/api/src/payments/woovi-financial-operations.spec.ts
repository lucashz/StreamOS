import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WooviPaymentProvider } from './woovi-payment-provider';

describe('Woovi financial operations', () => {
  beforeEach(() => {
    process.env.WOOVI_BASE_URL = 'https://api.woovi-sandbox.com';
    process.env.WOOVI_APP_ID = 'sandbox-app-id';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WOOVI_BASE_URL;
    delete process.env.WOOVI_APP_ID;
  });

  it('reads balance, Pix Out status and provider statement', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accounts: [
              {
                accountId: 'default',
                isDefault: true,
                balance: { available: 4321 },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            transaction: { endToEndId: 'E-payout', status: 'COMPLETED' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            transactions: [
              {
                correlationID: 'intent-1',
                value: 100,
                time: '2026-08-23T10:00:00.000Z',
              },
            ],
            pageInfo: { skip: 0, limit: 100, hasNextPage: false },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new WooviPaymentProvider();
    await expect(provider.getBalance()).resolves.toEqual({
      availableInCents: 4321n,
    });
    await expect(provider.getPixOut('E-payout')).resolves.toEqual({
      reference: 'E-payout',
      status: 'PAID',
    });
    await expect(
      provider.getStatement(
        new Date('2026-08-23T00:00:00.000Z'),
        new Date('2026-08-24T00:00:00.000Z'),
      ),
    ).resolves.toEqual([
      {
        reference: 'intent-1',
        amountInCents: 100n,
        occurredAt: new Date('2026-08-23T10:00:00.000Z'),
      },
    ]);
  });

  it('opens only regulatory MED and rejects voluntary return', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ fundsRecovery: { dictId: 'med-123' } }),
            { status: 201 },
          ),
        ),
    );
    const provider = new WooviPaymentProvider();
    await expect(
      provider.processRegulatoryIncident({
        paymentReference: 'E-outbound',
        kind: 'MED',
        reason: 'Fraude confirmada pela equipe de segurança',
      }),
    ).resolves.toEqual({ incidentReference: 'med-123' });
    await expect(
      provider.processRegulatoryIncident({
        paymentReference: 'E-outbound',
        kind: 'COMPULSORY_RETURN',
        reason: 'Solicitação manual',
      }),
    ).rejects.toThrow('Devolução voluntária não é permitida');
  });
});
