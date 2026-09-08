import { describe, expect, it } from 'vitest';
import { MockPaymentProvider } from './payment-provider';

describe('MockPaymentProvider', () => {
  it('assina e valida uma confirmação', () => {
    const provider = new MockPaymentProvider();
    const confirmation = provider.confirmation(
      'd0db516d-41d6-407d-a4f4-7261f6dd0098',
    );

    expect(provider.verify(confirmation.body, confirmation.signature)).toBe(
      true,
    );
  });

  it('rejeita payload alterado', () => {
    const provider = new MockPaymentProvider();
    const confirmation = provider.confirmation(
      'd0db516d-41d6-407d-a4f4-7261f6dd0098',
    );

    expect(
      provider.verify(
        { ...confirmation.body, intentId: randomIntentId() },
        confirmation.signature,
      ),
    ).toBe(false);
  });

  it('mantém Pix Out idempotente no gateway local', async () => {
    const provider = new MockPaymentProvider();
    const input = {
      amountInCents: 1000n,
      destinationKey: 'pix@example.com',
      idempotencyKey: 'payout-idempotente',
    };
    const first = await provider.requestPixOut(input);
    const duplicate = await provider.requestPixOut(input);
    expect(first).toEqual(duplicate);
    expect(first.status).toBe('PAID');
  });
});

function randomIntentId() {
  return 'f3167b92-07c2-4920-8b3b-91ef596bfba7';
}
