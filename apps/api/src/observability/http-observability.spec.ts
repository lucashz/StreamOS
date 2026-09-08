import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { httpObservability, prometheusMetrics } from './http-observability';

describe('HTTP observability', () => {
  it('adds a request id, normalizes dynamic paths and exports metrics', () => {
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      setHeader(name: string, value: string): void;
      headers: Record<string, string>;
    };
    response.statusCode = 201;
    response.headers = {};
    response.setHeader = (name, value) => {
      response.headers[name] = value;
    };
    let continued = false;
    httpObservability(
      {
        method: 'POST',
        originalUrl:
          '/dashboard/widgets/123e4567-e89b-12d3-a456-426614174000?token=secret',
        headers: {},
      } as never,
      response as never,
      () => {
        continued = true;
      },
    );
    response.emit('finish');
    const metrics = prometheusMetrics();
    expect(continued).toBe(true);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.traceparent).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/,
    );
    expect(metrics).toContain('path="/dashboard/widgets/:id"');
    expect(metrics).not.toContain('secret');
    expect(metrics).toContain('status="201"');
    expect(metrics).toContain('streamos_process_resident_memory_bytes');
    expect(metrics).toContain('streamos_process_heap_used_bytes');
    expect(metrics).toContain('streamos_http_active_requests 0');
    expect(metrics).toContain('streamos_http_metric_series');
  });
});
