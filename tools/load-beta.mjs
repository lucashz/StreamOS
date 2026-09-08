import { performance } from 'node:perf_hooks';

const target =
  process.env.LOAD_TEST_URL ?? 'http://localhost:3001/health/ready';
const total = Number(process.env.LOAD_TEST_REQUESTS ?? 500);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 25);
const maximumP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS ?? 500);
const durations = [];
let failures = 0;
let cursor = 0;

async function worker() {
  while (cursor < total) {
    cursor += 1;
    const startedAt = performance.now();
    try {
      const response = await fetch(target, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) failures += 1;
    } catch {
      failures += 1;
    } finally {
      durations.push(performance.now() - startedAt);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
durations.sort((left, right) => left - right);
const percentile = (value) =>
  durations[Math.ceil((value / 100) * durations.length) - 1] ?? 0;
const result = {
  target,
  requests: total,
  concurrency,
  failures,
  p50Ms: Math.round(percentile(50) * 100) / 100,
  p95Ms: Math.round(percentile(95) * 100) / 100,
  p99Ms: Math.round(percentile(99) * 100) / 100,
};
console.log(JSON.stringify(result, null, 2));
if (failures > 0 || result.p95Ms > maximumP95Ms) process.exitCode = 1;
