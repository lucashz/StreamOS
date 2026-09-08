import net from 'node:net';

const targets = {
  web: process.env.APP_URL ?? 'http://localhost:3000',
  api: process.env.API_URL ?? 'http://localhost:3001',
  realtime: process.env.REALTIME_URL ?? 'http://localhost:3002',
  overlay: process.env.OVERLAY_URL ?? 'http://localhost:3003',
};

async function retry(name, check, attempts = 15) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await check();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`${name}: ${lastError?.message ?? 'indisponível'}`);
}

async function expectHttp(name, url, expectedText) {
  await retry(name, async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (expectedText && !(await response.text()).includes(expectedText))
      throw new Error('resposta inesperada');
  });
}

async function expectTcp(name, value) {
  const url = new URL(value);
  const secure = url.protocol === 'https:' || url.protocol === 'wss:';
  const port = Number(url.port || (secure ? 443 : 80));
  await retry(
    name,
    () =>
      new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: url.hostname, port });
        socket.setTimeout(4_000);
        socket.once('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.once('timeout', () => {
          socket.destroy();
          reject(new Error('timeout'));
        });
        socket.once('error', reject);
      }),
  );
}

await Promise.all([
  expectHttp('web', `${targets.web}/entrar`),
  retry('api-observability', async () => {
    const response = await fetch(`${targets.api}/health/live`, {
      headers: { 'x-request-id': 'streamos-smoke-check' },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (response.headers.get('x-request-id') !== 'streamos-smoke-check')
      throw new Error('x-request-id ausente ou alterado');
    if (
      !/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/.test(
        response.headers.get('traceparent') ?? '',
      )
    )
      throw new Error('traceparent ausente ou inválido');
  }),
  expectHttp('api-ready', `${targets.api}/health/ready`),
  expectHttp('openapi', `${targets.api}/docs-json`, 'StreamOS API'),
  expectHttp('overlay', targets.overlay),
  expectTcp('realtime', targets.realtime),
]);

if (process.env.METRICS_TOKEN)
  await retry('metrics', async () => {
    const response = await fetch(`${targets.api}/metrics`, {
      headers: { authorization: `Bearer ${process.env.METRICS_TOKEN}` },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok || !(await response.text()).includes('streamos_process_'))
      throw new Error(`HTTP ${response.status}`);
  });

console.log(
  JSON.stringify({ result: 'ok', checks: Object.keys(targets), openapi: true }),
);
