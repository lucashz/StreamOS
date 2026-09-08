import { io } from 'socket.io-client';

const api = process.env.API_URL ?? 'http://localhost:3001';
const realtime = process.env.REALTIME_URL ?? 'http://localhost:3002';

async function request(path, options = {}, expected) {
  const response = await fetch(`${api}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (expected === undefined ? !response.ok : response.status !== expected)
    throw new Error(
      `${options.method ?? 'GET'} ${path}: ${response.status} ${text}`,
    );
  return { response, body };
}
function json(method, body, cookie) {
  return {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  };
}
function cookieFrom(response) {
  const value = response.headers.getSetCookie()[0]?.split(';')[0];
  if (!value) throw new Error('Cookie ausente');
  return value;
}
async function eventually(check, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timeout aguardando estado da fila');
}
function command(cookie, action, itemId, extra = {}, expected) {
  return request(
    '/dashboard/live-control/commands',
    json(
      'POST',
      { action, itemId, idempotencyKey: crypto.randomUUID(), ...extra },
      cookie,
    ),
    expected,
  );
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const registration = await request(
  '/auth/register',
  json('POST', {
    email: `live-control-${suffix}@streamos.local`,
    password: 'StreamOS-Live-Control-123!',
    displayName: 'Live Control E2E',
    acceptTerms: true,
  }),
);
const cookie = cookieFrom(registration.response);
const profile = registration.body.memberships[0].organization.creatorProfile;
await request(
  '/dashboard/onboarding',
  json(
    'PUT',
    {
      displayName: 'Live Control E2E',
      slug: profile.slug,
      bio: 'Fila unificada em teste',
      minimumContributionInCents: 100,
      isPublished: true,
    },
    cookie,
  ),
);
const overlay = await request('/dashboard/overlay/rotate-token', {
  method: 'POST',
  headers: { cookie },
});
const socket = io(realtime, {
  transports: ['websocket'],
  auth: { token: overlay.body.token },
});
await new Promise((resolve, reject) => {
  socket.once('connect', resolve);
  socket.once('connect_error', reject);
});
socket.emit('streamos:heartbeat');

const controlReceived = new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error('Volume não chegou ao overlay em realtime')),
    5_000,
  );
  socket.once('streamos:control', (control) => {
    clearTimeout(timer);
    resolve(control);
  });
});
await command(cookie, 'SET_MASTER_VOLUME', undefined, { volume: 64 });
const control = await controlReceived;
if (control.masterVolume !== 64) throw new Error('Volume realtime divergente');
const volumeSnapshot = await request('/dashboard/live-control', {
  headers: { cookie },
});
if (volumeSnapshot.body.state.masterVolume !== 64)
  throw new Error('Volume não foi persistido');
await command(cookie, 'SET_QUEUE_MODE', undefined, { mode: 'VALUE' });
const valueMode = await request('/dashboard/live-control', {
  headers: { cookie },
});
if (valueMode.body.state.queueMode !== 'VALUE')
  throw new Error('Modo de prioridade não foi persistido');
await command(cookie, 'SET_QUEUE_MODE', undefined, { mode: 'BALANCED' });

await command(cookie, 'START_LIVE', undefined, { name: 'Live E2E' });
await command(cookie, 'PAUSE_QUEUE');
for (let index = 0; index < 3; index += 1)
  await request(
    '/dashboard/alerts/test',
    json('POST', { sequence: true }, cookie),
  );

const queued = await eventually(async () => {
  const snapshot = await request('/dashboard/live-control', {
    headers: { cookie },
  });
  const items = snapshot.body.items.filter((item) => item.status === 'QUEUED');
  return items.length >= 3 ? items.slice(-3) : null;
});
const last = queued[2];
if (!last.liveSessionId) throw new Error('Item não foi vinculado à live ativa');
await command(cookie, 'MOVE', last.id, { position: 1 });
const reordered = (
  await request('/dashboard/live-control', { headers: { cookie } })
).body.items.filter((item) => item.status === 'QUEUED');
if (reordered[0]?.id !== last.id)
  throw new Error('Reordenação não foi persistida');

await command(cookie, 'RESUME_QUEUE');
const playing = await eventually(async () => {
  const snapshot = await request('/dashboard/live-control', {
    headers: { cookie },
  });
  return snapshot.body.items.find((item) => item.status === 'PLAYING');
});
if (playing.id !== last.id) throw new Error('Worker ignorou a ordem unificada');
await command(cookie, 'COMPLETE', playing.id);
const completed = await eventually(async () => {
  const snapshot = await request('/dashboard/live-control', {
    headers: { cookie },
  });
  return (
    snapshot.body.items.find((item) => item.id === playing.id)?.status ===
    'COMPLETED'
  );
});
if (!completed) throw new Error('Conclusão não persistida');

await command(cookie, 'PAUSE_QUEUE');
const active = (
  await request('/dashboard/live-control', { headers: { cookie } })
).body.items.find((item) => item.status === 'PLAYING');
if (active) await command(cookie, 'COMPLETE', active.id);
await command(cookie, 'REPLAY', playing.id);
const replayed = (
  await request('/dashboard/live-control', { headers: { cookie } })
).body.items.find((item) => item.id === playing.id);
if (replayed.status !== 'PLAYING') throw new Error('Replay não iniciou');

await command(cookie, 'FLAG', playing.id, {
  reason: 'Sinalização E2E',
});
const flagged = (
  await request('/dashboard/live-control', { headers: { cookie } })
).body.items.find((item) => item.id === playing.id);
if (flagged.moderationStatus !== 'FLAGGED')
  throw new Error('Sinalização não foi persistida');
await command(cookie, 'UNFLAG', playing.id);
await command(cookie, 'BLOCK', playing.id, {
  reason: 'Bloqueio E2E sem estorno',
});
const blocked = (
  await request('/dashboard/live-control', { headers: { cookie } })
).body.items.find((item) => item.id === playing.id);
if (blocked.status !== 'SKIPPED' || blocked.moderationStatus !== 'BLOCKED')
  throw new Error('Bloqueio operacional não foi persistido');

const history = await request(
  `/dashboard/live-control/history?sessionId=${last.liveSessionId}&status=SKIPPED&page=1&limit=10`,
  { headers: { cookie } },
);
if (!history.body.items.some((item) => item.id === playing.id))
  throw new Error('Histórico paginado não retornou o item bloqueado');
const csv = await fetch(
  `${api}/dashboard/live-control/history.csv?sessionId=${last.liveSessionId}`,
  { headers: { cookie } },
);
if (!csv.ok || !(await csv.text()).includes('SKIPPED'))
  throw new Error('Exportação CSV do histórico falhou');
await command(cookie, 'END_LIVE');

const other = await request(
  '/auth/register',
  json('POST', {
    email: `other-live-${suffix}@streamos.local`,
    password: 'StreamOS-Live-Control-123!',
    displayName: 'Outra organização',
    acceptTerms: true,
  }),
);
await command(cookieFrom(other.response), 'SKIP', playing.id, {}, 404);
const isolated = await request('/dashboard/live-control', {
  headers: { cookie: cookieFrom(other.response) },
});
if (isolated.body.items.some((item) => item.id === playing.id))
  throw new Error('Falha de isolamento');

socket.close();
console.log(
  JSON.stringify(
    {
      result: 'ok',
      durableOrdering: true,
      move: true,
      pauseResume: true,
      masterVolume: true,
      queueMode: true,
      completeReplay: true,
      liveSession: true,
      flagAndBlock: true,
      paginatedHistoryAndCsv: true,
      isolation: true,
    },
    null,
    2,
  ),
);
