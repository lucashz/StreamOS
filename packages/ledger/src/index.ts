export interface Posting {
  accountId: string;
  amountInCents: bigint;
  direction: 'credit' | 'debit';
}

export function isBalanced(postings: readonly Posting[]): boolean {
  return (
    postings.reduce((balance, posting) => {
      return posting.direction === 'debit'
        ? balance + posting.amountInCents
        : balance - posting.amountInCents;
    }, 0n) === 0n
  );
}

export interface PaymentFees {
  grossInCents: bigint;
  platformFeeInCents: bigint;
  providerFeeInCents: bigint;
  creatorNetInCents: bigint;
}

const PLATFORM_RATE_BASIS_POINTS = 500n;
const WOOVI_RATE_BASIS_POINTS = 80n;
const WOOVI_MINIMUM_FEE_IN_CENTS = 50n;
const WOOVI_MAXIMUM_FEE_IN_CENTS = 500n;
const BASIS_POINTS = 10_000n;

function percentageInCents(amountInCents: bigint, basisPoints: bigint) {
  return (amountInCents * basisPoints) / BASIS_POINTS;
}

/**
 * StreamOS pricing for confirmed Pix payments.
 *
 * The provider charges 0.80%, bounded between R$0.50 and R$5.00. The
 * R$0.50 is a minimum, not an additional fixed fee.
 */
export function calculatePixFees(grossInCents: bigint): PaymentFees {
  if (grossInCents <= 0n) throw new RangeError('Gross amount must be positive');

  const platformFeeInCents = percentageInCents(
    grossInCents,
    PLATFORM_RATE_BASIS_POINTS,
  );
  const percentageProviderFee = percentageInCents(
    grossInCents,
    WOOVI_RATE_BASIS_POINTS,
  );
  const providerFeeInCents =
    percentageProviderFee < WOOVI_MINIMUM_FEE_IN_CENTS
      ? WOOVI_MINIMUM_FEE_IN_CENTS
      : percentageProviderFee > WOOVI_MAXIMUM_FEE_IN_CENTS
        ? WOOVI_MAXIMUM_FEE_IN_CENTS
        : percentageProviderFee;
  const creatorNetInCents =
    grossInCents - platformFeeInCents - providerFeeInCents;

  if (creatorNetInCents < 0n)
    throw new RangeError('Fees exceed the gross payment amount');

  return {
    grossInCents,
    platformFeeInCents,
    providerFeeInCents,
    creatorNetInCents,
  };
}
