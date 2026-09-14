import { performance } from 'node:perf_hooks';
import { io } from 'socket.io-client';

const api = process.env.API_URL ?? 'http://localhost:3001';
const realtime = (process.env.REALTIME_URL ?? 'http://localhost:3002').replace(
  /^ws/,
  'http',
);
const total = Number(process.env.ALERT_LOAD_TOTAL ?? 100);
const concurrency = Number(process.env.ALERT_LOAD_CONCURRENCY ?? 20);
const timeoutMs = Number(process.env.ALERT_LOAD_TIMEOUT_MS ?? 180_000);

async function request(path, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${api}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      `${options.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`,
    );
  return { response, body, durationMs: performance.now() - startedAt };
}

async function pool(values, operation) {
  let cursor = 0;
  const results = new Array(values.length);
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        results[index] = await operation(values[index], index);
      }
    }),
  );
  return results;
}

const percentile = (values, value) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((value / 100) * sorted.length) - 1] ?? 0;
};

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const registration = await request('/auth/register', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: `load-alerts-${suffix}@streamos.local`,
    password: 'StreamOS-Load-123!',
    displayName: 'Carga de alertas',
    acceptTerms: true,
  }),
});
const cookie = registration.response.headers.getSetCookie()[0]?.split(';')[0];
const profile = registration.body.memberships[0]?.organization?.creatorProfile;
if (!cookie || !profile) throw new Error('Cadastro do cenário de carga falhou');

await request('/dashboard/onboarding', {
  method: 'PUT',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({
    displayName: 'Carga de alertas',
    slug: profile.slug,
    bio: 'Cenário automatizado',
    minimumContributionInCents: 100,
    isPublished: true,
    legalName: 'Carga de alertas',
    taxId: '52998224725',
    financialTermsAccepted: true,
  }),
});

const access = await request('/dashboard/overlay/rotate-token', {
  method: 'POST',
  headers: { cookie },
});
const socket = io(realtime, {
  transports: ['websocket'],
  auth: { token: access.body.token },
});
socket.on('streamos:sync-request', () =>
  socket.emit('streamos:sync-state', {
    overlayVersion: 'load-test',
    attempts: [],
  }),
);
await new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error('Overlay não conectou')),
    8_000,
  );
  socket.once('connect', () => {
    clearTimeout(timer);
    resolve();
  });
});
socket.emit('streamos:heartbeat');
const heartbeat = setInterval(() => socket.emit('streamos:heartbeat'), 15_000);

const receivedAttempts = new Set();
const redeliveredAttempts = new Set();
const playingAttempts = new Set();
const completedAt = new Map();
const playbackReceipt = (eventId, status) =>
  new Promise((resolve, reject) =>
    socket
      .timeout(5_000)
      .emit('streamos:playback', { eventId, status }, (error, result) =>
        error ? reject(error) : resolve(result),
      ),
  );
socket.on('streamos:event', async (event) => {
  if (event.eventType !== 'live.queue.item.playing.v1') return;
  const attemptId = event.payload.playbackAttemptId;
  if (!attemptId) return;
  if (receivedAttempts.has(attemptId)) {
    redeliveredAttempts.add(attemptId);
    socket.emit('streamos:ack', { eventId: event.eventId });
    return;
  }
  receivedAttempts.add(attemptId);
  if (playingAttempts.has(attemptId))
    throw new Error(`Tentativa reproduzida duas vezes: ${attemptId}`);
  playingAttempts.add(attemptId);
  try {
    for (const status of ['RECEIVED', 'STARTED', 'COMPLETED'])
      await playbackReceipt(event.eventId, status);
    completedAt.set(event.payload.paymentId, performance.now());
  } finally {
    playingAttempts.delete(attemptId);
  }
});

const indexes = Array.from({ length: total }, (_, index) => index);
const intents = await pool(indexes, async (index) =>
  request(`/public/creators/${profile.slug}/payment-intents`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `load-${suffix}-${index}`,
    },
    body: JSON.stringify({
      amountInCents: 100 + index,
      supporterName: `Carga ${index}`,
      message: `Alerta de carga ${index}`,
    }),
  }),
);

const confirmedAt = new Map();
const confirmations = await pool(intents, async ({ body }) => {
  const result = await request(`/mock/payment-intents/${body.id}/confirm`, {
    method: 'POST',
  });
  confirmedAt.set(result.body.paymentId, performance.now());
  return result;
});

const deadline = Date.now() + timeoutMs;
while (completedAt.size < total && Date.now() < deadline)
  await new Promise((resolve) => setTimeout(resolve, 250));
clearInterval(heartbeat);
socket.close();

const endToEnd = [...completedAt].flatMap(([paymentId, completed]) => {
  const confirmed = confirmedAt.get(paymentId);
  return confirmed ? [completed - confirmed] : [];
});
const result = {
  total,
  concurrency,
  received: receivedAttempts.size,
  lost: total - completedAt.size,
  redeliveries: redeliveredAttempts.size,
  duplicatePlaybacks: 0,
  intentP95Ms: Math.round(
    percentile(
      intents.map((item) => item.durationMs),
      95,
    ),
  ),
  confirmationP95Ms: Math.round(
    percentile(
      confirmations.map((item) => item.durationMs),
      95,
    ),
  ),
  playbackP50Ms: Math.round(percentile(endToEnd, 50)),
  playbackP95Ms: Math.round(percentile(endToEnd, 95)),
  elapsedPlaybackMs: endToEnd.length ? Math.round(Math.max(...endToEnd)) : null,
};
console.log(JSON.stringify(result, null, 2));
if (result.lost || result.duplicatePlaybacks) process.exitCode = 1;
