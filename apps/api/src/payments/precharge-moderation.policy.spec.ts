import { describe, expect, it } from 'vitest';
import { findBlockingPrechargePolicy } from './precharge-moderation.policy';

const policy = {
  name: 'Proteção da live',
  blockedWords: ['banido'],
  blockLinks: true,
  minimumInCents: 100n,
};

describe('precharge moderation', () => {
  it('allows safe content', () => {
    expect(
      findBlockingPrechargePolicy('ótima live', 500, [policy]),
    ).toBeUndefined();
  });

  it.each([
    ['contém palavra BANIDO', 500],
    ['acesse https://exemplo.com', 500],
    ['mensagem abaixo do limite', 50],
  ])('blocks before charging: %s', (content, amount) => {
    expect(findBlockingPrechargePolicy(content, amount, [policy])?.name).toBe(
      policy.name,
    );
  });
});
