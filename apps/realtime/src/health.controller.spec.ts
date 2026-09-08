import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('realtime health', () => {
  it('reports liveness', () => {
    expect(new HealthController().live()).toEqual({
      service: 'realtime',
      status: 'ok',
    });
  });
});
