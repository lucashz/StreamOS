import { describe, expect, it } from 'vitest';
import { publicRateLimitFor } from './public-rate-limit.guard';

describe('public rate limit policy', () => {
  it.each([
    ['POST', '/auth/login', 10],
    ['POST', '/public/creators/:slug/payment-intents', 30],
    ['GET', '/public/songpix/catalog', 240],
    ['POST', '/mock/payment-intents/:id/confirm', 30],
    ['GET', '/dashboard/widgets', 0],
  ])('%s %s uses limit %i', (method, route, limit) => {
    expect(publicRateLimitFor(method, route)).toBe(limit);
  });
});
