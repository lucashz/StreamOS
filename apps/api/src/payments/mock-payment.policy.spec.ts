import { describe, expect, it } from 'vitest';
import {
  mockPaymentsEnabled,
  useLocalSimulatedCharge,
} from './mock-payment.policy';

describe('mock payment endpoint policy', () => {
  it('is enabled in local development', () => {
    expect(mockPaymentsEnabled({ NODE_ENV: 'development' })).toBe(true);
  });

  it('is disabled by default in production', () => {
    expect(mockPaymentsEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('requires an explicit production override', () => {
    expect(
      mockPaymentsEnabled({
        NODE_ENV: 'production',
        ENABLE_MOCK_PAYMENTS: 'true',
      }),
    ).toBe(true);
  });

  it('uses a local charge instead of requiring a Woovi wallet in development', () => {
    expect(useLocalSimulatedCharge({ NODE_ENV: 'development' }, 'woovi')).toBe(
      true,
    );
    expect(useLocalSimulatedCharge({ NODE_ENV: 'production' }, 'woovi')).toBe(
      false,
    );
    expect(useLocalSimulatedCharge({ NODE_ENV: 'development' }, 'mock')).toBe(
      false,
    );
  });
});
