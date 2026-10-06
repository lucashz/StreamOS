import './lib/e2e-invites.mjs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { io } from 'socket.io-client';

const api = process.env.API_URL ?? 'http://localhost:3001';
const realtime = (process.env.REALTIME_URL ?? 'http://localhost:3002').replace(
  /^ws/,
  'http',
);
const restartService = (service) =>
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'tools/restart-local-service.ps1',
      '-Service',
      service,
    ],
    { stdio: 'ignore' },
  );

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, options);
  const body = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return { response, body };
}
const json = (method, body, cookie) => ({
  method,
  headers: {
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
  },
  body: JSON.stringify(body),
});
async function eventually(check, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timeout aguardando condição');
}
function connect(token, knownAttempts = []) {
  const socket = io(realtime, { transports: ['websocket'], auth: { token } });
  const events = [];
  socket.on('streamos:event', (event) => {
    if (event.payload?.playbackAttemptId) events.push(event);
  });
  socket.on('streamos:sync-request', () =>
    socket.emit('streamos:sync-state', {
      overlayVersion: 'reliability-e2e',
      attempts: knownAttempts,
    }),
  );
  const heartbeat = setInterval(
    () => socket.emit('streamos:heartbeat'),
    15_000,
  );
  return {
    socket,
    events,
    close: () => {
      clearInterval(heartbeat);
      socket.close();
    },
  };
}
async function receipt(socket, eventId, status) {
  return new Promise((resolve, reject) =>
    socket
      .timeout(5_000)
      .emit('streamos:playback', { eventId, status }, (error, result) =>
        error ? reject(error) : resolve(result),
      ),
  );
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const registration = await request(
  '/auth/register',
  json('POST', {
    email: `reliability-${suffix}@streamos.local`,
    password: 'StreamOS-Reliability-123!',
    displayName: 'Confiabilidade E2E',
    acceptTerms: true,
  }),
);
const cookie = registration.response.headers.getSetCookie()[0]?.split(';')[0];
const profile = registration.body.memberships[0].organization.creatorProfile;
await request(
  '/dashboard/onboarding',
  json(
    'PUT',
    {
      displayName: 'Confiabilidade E2E',
      slug: profile.slug,
      bio: 'Teste de falhas',
      minimumContributionInCents: 100,
      isPublished: true,
      legalName: 'Confiabilidade E2E',
      taxId: '52998224725',
      financialTermsAccepted: true,
    },
    cookie,
  ),
);
const access = await request('/dashboard/overlay/rotate-token', {
  method: 'POST',
  headers: { cookie },
});

async function pay(index) {
  const intent = await request(
    `/public/creators/${profile.slug}/payment-intents`,
    json('POST', {
      amountInCents: 1000 + index,
      supporterName: `Falha ${index}`,
      message: `Cenário ${index}`,
    }),
  );
  return request(`/mock/payment-intents/${intent.body.id}/confirm`, {
    method: 'POST',
  });
}

let client = connect(access.body.token);
await eventually(() => client.socket.connected);
const replacedClient = client;
client = connect(access.body.token);
await eventually(() => client.socket.connected);
await eventually(() => !replacedClient.socket.connected);
replacedClient.close();
await pay(1);
const first = await eventually(() => client.events[0]);
if (replacedClient.events.length)
  throw new Error('Conexão substituída recebeu o alerta');
restartService('worker');
const resent = await eventually(
  () =>
    client.events.find(
      (event) =>
        event.eventId !== first.eventId &&
        event.payload.playbackAttemptId === first.payload.playbackAttemptId,
    ),
  12_000,
);
await receipt(client.socket, resent.eventId, 'RECEIVED');
await receipt(client.socket, resent.eventId, 'STARTED');
await receipt(client.socket, resent.eventId, 'COMPLETED');

await pay(2);
const started = await eventually(() =>
  client.events.find(
    (event) =>
      event.payload.playbackAttemptId !== first.payload.playbackAttemptId,
  ),
);
await receipt(client.socket, started.eventId, 'RECEIVED');
await receipt(client.socket, started.eventId, 'STARTED');
client.close();
restartService('realtime');

client = connect(access.body.token, [
  {
    playbackAttemptId: started.payload.playbackAttemptId,
    status: 'STARTED',
  },
]);
await eventually(() => client.socket.connected);
const reviewItem = await eventually(async () => {
  const snapshot = await request('/dashboard/live-control', {
    headers: { cookie },
  });
  return snapshot.body.items.find(
    (item) =>
      item.id === started.payload.queueItemId && item.status === 'NEEDS_REVIEW',
  );
});
await request(
  '/dashboard/live-control/commands',
  json(
    'POST',
    {
      action: 'REPLAY',
      itemId: reviewItem.id,
      idempotencyKey: randomUUID(),
      origin: 'E2E',
    },
    cookie,
  ),
);
const manual = await eventually(() =>
  client.events.find(
    (event) =>
      event.payload.queueItemId === reviewItem.id &&
      event.payload.playbackAttemptId !== started.payload.playbackAttemptId,
  ),
);
await receipt(client.socket, manual.eventId, 'RECEIVED');
await receipt(client.socket, manual.eventId, 'STARTED');
await receipt(client.socket, manual.eventId, 'COMPLETED');
client.close();

await pay(3);
const preservedOffline = await eventually(async () => {
  const offline = await request('/dashboard/live-control', {
    headers: { cookie },
  });
  return offline.body.items.some(
    (item) => item.supporterName === 'Falha 3' && item.status === 'QUEUED',
  );
});
if (!preservedOffline)
  throw new Error('Alerta pago não permaneceu na fila offline');

execFileSync('docker', ['compose', 'restart', 'redis'], { stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 2_000));
client = connect(access.body.token);
await eventually(() => client.socket.connected);
const recoveredAfterRedisRestart = await eventually(
  () =>
    client.events.find((event) => event.payload.supporterName === 'Falha 3'),
  20_000,
);
await receipt(client.socket, recoveredAfterRedisRestart.eventId, 'RECEIVED');
await receipt(client.socket, recoveredAfterRedisRestart.eventId, 'STARTED');
await receipt(client.socket, recoveredAfterRedisRestart.eventId, 'COMPLETED');
client.close();

console.log(
  JSON.stringify(
    {
      result: 'ok',
      singleActiveBrowserSource: replacedClient.events.length === 0,
      recoveredAfterWorkerRestart: true,
      reconciledAfterGatewayRestart: true,
      sameAttemptWasResent:
        first.payload.playbackAttemptId === resent.payload.playbackAttemptId,
      replayAfterStartedPrevented: true,
      movedToReviewAfterReconnect: true,
      manualRetryCreatedNewAttempt:
        manual.payload.playbackAttemptId !== started.payload.playbackAttemptId,
      paidAlertPreservedOffline: preservedOffline,
      recoveredAfterRedisRestart: true,
    },
    null,
    2,
  ),
);
