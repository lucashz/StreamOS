import { describe, expect, it } from 'vitest';

import { calculatePixFees, isBalanced } from './index';

describe('isBalanced', () => {
  it('accepts equal debits and credits', () => {
    expect(
      isBalanced([
        { accountId: 'cash', amountInCents: 2_000n, direction: 'debit' },
        { accountId: 'creator', amountInCents: 2_000n, direction: 'credit' },
      ]),
    ).toBe(true);
  });

  it('rejects an unbalanced journal entry', () => {
    expect(
      isBalanced([
        { accountId: 'cash', amountInCents: 2_000n, direction: 'debit' },
        { accountId: 'creator', amountInCents: 1_900n, direction: 'credit' },
      ]),
    ).toBe(false);
  });
});

describe('calculatePixFees', () => {
  it.each([
    [100n, 5n, 50n, 45n],
    [1_000n, 50n, 50n, 900n],
    [2_000n, 100n, 50n, 1_850n],
    [6_250n, 312n, 50n, 5_888n],
    [10_000n, 500n, 80n, 9_420n],
    [100_000n, 5_000n, 500n, 94_500n],
  ])(
    'splits %s cents into platform, provider and creator amounts',
    (gross, platform, provider, creator) => {
      expect(calculatePixFees(gross)).toEqual({
        grossInCents: gross,
        platformFeeInCents: platform,
        providerFeeInCents: provider,
        creatorNetInCents: creator,
      });
    },
  );

  it('rejects an amount that cannot cover the fees', () => {
    expect(() => calculatePixFees(50n)).toThrow(RangeError);
  });

  it('preserves the complete split for every cent from R$ 1 to R$ 20', () => {
    for (let cents = 100n; cents <= 2_000n; cents += 1n) {
      const fees = calculatePixFees(cents);
      expect(
        fees.platformFeeInCents +
          fees.providerFeeInCents +
          fees.creatorNetInCents,
      ).toBe(cents);
      expect(fees.platformFeeInCents).toBe((cents * 500n) / 10_000n);
      expect(fees.providerFeeInCents).toBe(50n);
      expect(fees.creatorNetInCents).toBeGreaterThanOrEqual(0n);
    }
  });
});
