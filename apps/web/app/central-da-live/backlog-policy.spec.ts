import { describe, expect, it } from 'vitest';

import { backlogState } from './backlog-policy';

describe('backlogState', () => {
  it('does not warn for a short queue', () => {
    expect(backlogState({ pendingCount: 4, estimatedSeconds: 42 })).toEqual({
      level: 'normal',
      estimatedSeconds: 42,
    });
  });

  it('warns when the estimated wait reaches fifteen minutes', () => {
    expect(backlogState({ pendingCount: 12, estimatedSeconds: 900 })).toEqual({
      level: 'warning',
      estimatedSeconds: 900,
      reason: 'A espera estimada ultrapassa 15 minutos.',
    });
  });

  it('warns when the pending count reaches one hundred items', () => {
    expect(backlogState({ pendingCount: 100, estimatedSeconds: 300 })).toEqual({
      level: 'warning',
      estimatedSeconds: 300,
      reason: 'Há 100 alertas aguardando na fila.',
    });
  });
});
