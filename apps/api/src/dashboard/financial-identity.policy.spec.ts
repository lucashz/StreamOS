import { describe, expect, it } from 'vitest';

import {
  normalizeAndValidatePixKey,
  normalizeAndValidateTaxId,
} from './financial-identity.policy';

describe('financial identity policy', () => {
  it('validates CPF and CNPJ check digits', () => {
    expect(normalizeAndValidateTaxId('529.982.247-25')).toBe('52998224725');
    expect(normalizeAndValidateTaxId('04.252.011/0001-10')).toBe(
      '04252011000110',
    );
    expect(normalizeAndValidateTaxId('111.111.111-11')).toBeNull();
    expect(normalizeAndValidateTaxId('04.252.011/0001-11')).toBeNull();
  });

  it('normalizes supported Pix key types', () => {
    expect(normalizeAndValidatePixKey('EMAIL', ' User@Example.com ')).toBe(
      'user@example.com',
    );
    expect(normalizeAndValidatePixKey('PHONE', '(11) 99999-9999')).toBe(
      '+5511999999999',
    );
    expect(
      normalizeAndValidatePixKey(
        'RANDOM',
        '123e4567-e89b-42d3-a456-426614174000',
      ),
    ).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(normalizeAndValidatePixKey('EMAIL', 'invalid')).toBeNull();
    expect(normalizeAndValidatePixKey('PHONE', '123')).toBeNull();
  });
});
