import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports the API as healthy', () => {
    expect(new HealthController().live()).toEqual({
      service: 'api',
      status: 'ok',
    });
  });
});
