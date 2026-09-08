import { describe, expect, it } from 'vitest';

import { metricsAuthorizationValid } from './metrics.controller';

describe('metrics authorization', () => {
  const token = 'metrics-token-with-at-least-32-characters';

  it('accepts only the configured bearer token', () => {
    expect(metricsAuthorizationValid(token, `Bearer ${token}`, true)).toBe(
      true,
    );
    expect(metricsAuthorizationValid(token, 'Bearer wrong', true)).toBe(false);
    expect(metricsAuthorizationValid(token, undefined, true)).toBe(false);
  });

  it('never exposes metrics without a token in production', () => {
    expect(metricsAuthorizationValid(undefined, undefined, true)).toBe(false);
    expect(metricsAuthorizationValid(undefined, undefined, false)).toBe(true);
  });
});
