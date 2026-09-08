import type { NextFunction, Request, Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';

type Metric = { count: number; durationMs: number };
const startedAt = Date.now();
const requests = new Map<string, Metric>();
const maxMetricSeries = 500;
let activeRequests = 0;

function normalizedPath(value: string) {
  return value
    .split('?')[0]!
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

export function httpObservability(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const requestId =
    typeof request.headers['x-request-id'] === 'string' &&
    /^[a-zA-Z0-9._-]{8,100}$/.test(request.headers['x-request-id'])
      ? request.headers['x-request-id']
      : randomUUID();
  const incomingTrace =
    typeof request.headers.traceparent === 'string'
      ? /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(
          request.headers.traceparent,
        )
      : null;
  const traceId =
    incomingTrace?.[1]?.toLowerCase() ?? randomBytes(16).toString('hex');
  const spanId = randomBytes(8).toString('hex');
  const traceFlags = incomingTrace?.[3]?.toLowerCase() ?? '01';
  const start = performance.now();
  activeRequests += 1;
  response.setHeader('x-request-id', requestId);
  response.setHeader('traceparent', `00-${traceId}-${spanId}-${traceFlags}`);
  response.once('finish', () => {
    activeRequests = Math.max(0, activeRequests - 1);
    const durationMs = performance.now() - start;
    const path = normalizedPath(request.originalUrl);
    const candidateKey = `${request.method}|${path}|${response.statusCode}`;
    const key =
      requests.has(candidateKey) || requests.size < maxMetricSeries
        ? candidateKey
        : `OTHER|/__overflow__|0`;
    const metric = requests.get(key) ?? { count: 0, durationMs: 0 };
    metric.count += 1;
    metric.durationMs += durationMs;
    requests.set(key, metric);
    process.stdout.write(
      `${JSON.stringify({ timestamp: new Date().toISOString(), level: response.statusCode >= 500 ? 'error' : 'info', service: 'api', requestId, traceId, spanId, errorTrackingConfigured: Boolean(process.env.ERROR_TRACKING_DSN), method: request.method, path, statusCode: response.statusCode, durationMs: Math.round(durationMs * 100) / 100 })}\n`,
    );
  });
  next();
}

function labels(method: string, path: string, status: string) {
  const escape = (value: string) =>
    value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `method="${escape(method)}",path="${escape(path)}",status="${escape(status)}"`;
}

export function prometheusMetrics() {
  const memory = process.memoryUsage();
  const lines = [
    '# HELP streamos_process_uptime_seconds Process uptime in seconds.',
    '# TYPE streamos_process_uptime_seconds gauge',
    `streamos_process_uptime_seconds ${(Date.now() - startedAt) / 1000}`,
    '# HELP streamos_process_resident_memory_bytes Resident memory used by the API process.',
    '# TYPE streamos_process_resident_memory_bytes gauge',
    `streamos_process_resident_memory_bytes ${memory.rss}`,
    '# HELP streamos_process_heap_used_bytes Heap memory used by the API process.',
    '# TYPE streamos_process_heap_used_bytes gauge',
    `streamos_process_heap_used_bytes ${memory.heapUsed}`,
    '# HELP streamos_http_active_requests Requests currently being processed.',
    '# TYPE streamos_http_active_requests gauge',
    `streamos_http_active_requests ${activeRequests}`,
    '# HELP streamos_http_metric_series Number of HTTP metric series held in memory.',
    '# TYPE streamos_http_metric_series gauge',
    `streamos_http_metric_series ${requests.size}`,
    '# HELP streamos_http_requests_total HTTP requests received.',
    '# TYPE streamos_http_requests_total counter',
    '# HELP streamos_http_request_duration_milliseconds_total Accumulated HTTP request duration.',
    '# TYPE streamos_http_request_duration_milliseconds_total counter',
  ];
  for (const [key, metric] of requests) {
    const [method, path, status] = key.split('|') as [string, string, string];
    const metricLabels = labels(method, path, status);
    lines.push(`streamos_http_requests_total{${metricLabels}} ${metric.count}`);
    lines.push(
      `streamos_http_request_duration_milliseconds_total{${metricLabels}} ${metric.durationMs}`,
    );
  }
  return `${lines.join('\n')}\n`;
}
