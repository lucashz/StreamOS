import { describe, expect, it } from 'vitest';

import { parseEnvironment } from './index';

describe('parseEnvironment', () => {
  it('rejects weak secrets', () => {
    expect(() =>
      parseEnvironment({
        API_URL: 'http://localhost:3001',
        APP_URL: 'http://localhost:3000',
        DATABASE_URL: 'postgresql://localhost/streamos',
        MAIL_HOST: 'localhost',
        MAIL_PORT: '1025',
        OVERLAY_URL: 'http://localhost:3003',
        REALTIME_URL: 'ws://localhost:3002',
        REDIS_URL: 'redis://localhost:6379',
        SESSION_SECRET: 'short',
        WEBHOOK_MOCK_SECRET: 'also-short',
      }),
    ).toThrow();
  });

  it('requires Woovi credentials when the provider is enabled', () => {
    const base = {
      DATABASE_URL: 'postgresql://streamos:streamos@localhost:5432/streamos',
      REDIS_URL: 'redis://localhost:6379',
      APP_URL: 'http://localhost:3000',
      API_URL: 'http://localhost:3001',
      REALTIME_URL: 'ws://localhost:3002',
      OVERLAY_URL: 'http://localhost:3003',
      SESSION_SECRET: 'session-secret-with-at-least-32-characters',
      WEBHOOK_MOCK_SECRET: 'webhook-secret-with-at-least-32-characters',
      MAIL_HOST: 'localhost',
      MAIL_PORT: '1025',
      PAYMENT_PROVIDER: 'woovi',
    };
    expect(() => parseEnvironment(base)).toThrow();
    expect(
      parseEnvironment({
        ...base,
        WOOVI_APP_ID: 'sandbox-id',
        WOOVI_WEBHOOK_AUTHORIZATION:
          'sandbox-webhook-authorization-32-characters',
      }).PAYMENT_PROVIDER,
    ).toBe('woovi');
  });

  it('parses false feature flags without coercing the string to true', () => {
    const parsed = parseEnvironment({
      DATABASE_URL: 'postgresql://streamos:streamos@localhost:5432/streamos',
      REDIS_URL: 'redis://localhost:6379',
      APP_URL: 'http://localhost:3000',
      API_URL: 'http://localhost:3001',
      REALTIME_URL: 'ws://localhost:3002',
      OVERLAY_URL: 'http://localhost:3003',
      SESSION_SECRET: 'session-secret-with-at-least-32-characters',
      WEBHOOK_MOCK_SECRET: 'webhook-secret-with-at-least-32-characters',
      MAIL_HOST: 'localhost',
      MAIL_PORT: '1025',
      PAYMENTS_ENABLED: 'false',
      PAYOUTS_ENABLED: 'false',
      VIDEOPIX_ENABLED: 'false',
      SONGPIX_ENABLED: 'false',
      SUBSCRIPTIONS_ENABLED: 'false',
      WOOVI_BASE_URL: '',
      WOOVI_APP_ID: '',
      OTEL_EXPORTER_OTLP_ENDPOINT: '',
      ERROR_TRACKING_DSN: '',
    });
    expect(parsed.PAYMENTS_ENABLED).toBe(false);
    expect(parsed.PAYOUTS_ENABLED).toBe(false);
    expect(parsed.VIDEOPIX_ENABLED).toBe(false);
    expect(parsed.SONGPIX_ENABLED).toBe(false);
    expect(parsed.SUBSCRIPTIONS_ENABLED).toBe(false);
    expect(parsed.WOOVI_BASE_URL).toBeUndefined();
    expect(parsed.WOOVI_APP_ID).toBeUndefined();
    expect(parsed.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
    expect(parsed.ERROR_TRACKING_DSN).toBeUndefined();
  });
});
