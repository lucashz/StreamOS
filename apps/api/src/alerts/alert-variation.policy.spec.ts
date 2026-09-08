import { describe, expect, it } from 'vitest';
import {
  selectAlertVariation,
  validAlertRange,
  type VariationRange,
} from './alert-variation.policy';

const date = new Date('2026-08-20T00:00:00Z');
function variation(
  id: string,
  minimumInCents: bigint | null,
  maximumInCents: bigint | null,
  priority = 0,
  isDefault = false,
): VariationRange {
  return {
    id,
    minimumInCents,
    maximumInCents,
    priority,
    isDefault,
    enabled: true,
    createdAt: date,
  };
}

describe('alert variation selection', () => {
  it('includes both monetary boundaries', () => {
    const selected = variation('range', 100n, 200n);
    const fallback = variation('default', null, null, 0, true);
    expect(selectAlertVariation([fallback, selected], 100n)?.id).toBe('range');
    expect(selectAlertVariation([fallback, selected], 200n)?.id).toBe('range');
  });
  it('uses priority and then the most specific minimum deterministically', () => {
    const broad = variation('broad', 100n, 1000n, 2);
    const specific = variation('specific', 500n, 1000n, 2);
    expect(selectAlertVariation([broad, specific], 600n)?.id).toBe('specific');
  });
  it('falls back to the default and ignores disabled variations', () => {
    const disabled = { ...variation('disabled', 0n, null, 10), enabled: false };
    expect(
      selectAlertVariation(
        [disabled, variation('default', null, null, 0, true)],
        1n,
      )?.id,
    ).toBe('default');
  });
  it('allows an enabled targeted test variation', () => {
    const target = variation('target', 10000n, null);
    expect(selectAlertVariation([target], 1n, 'target')?.id).toBe('target');
  });
  it('validates ranges', () => {
    expect(validAlertRange(100, 100)).toBe(true);
    expect(validAlertRange(200, 100)).toBe(false);
    expect(validAlertRange(-1, null)).toBe(false);
  });
});
