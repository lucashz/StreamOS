import { io } from 'socket.io-client';

const api = process.env.API_URL ?? 'http://localhost:3001';
const realtime = (process.env.REALTIME_URL ?? 'http://localhost:3002').replace(
  /^ws/,
  'http',
);
async function request(path, options = {}, expectedStatus) {
  const response = await fetch(`${api}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (
    expectedStatus === undefined
      ? !response.ok
      : response.status !== expectedStatus
  )
    throw new Error(
      `${options.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`,
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
function waitForMatching(socket, predicate, timeout = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('streamos:event', listener);
      reject(new Error('Timeout aguardando evento SongPix'));
    }, timeout);
    const listener = (value) => {
      if (!predicate(value)) return;
      clearTimeout(timer);
      socket.off('streamos:event', listener);
      resolve(value);
    };
    socket.on('streamos:event', listener);
  });
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const registration = await request(
  '/auth/register',
  json('POST', {
    email: `songpix-${suffix}@streamos.local`,
    password: 'StreamOS-SongPix-123!',
    displayName: 'SongPix E2E',
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
      displayName: 'SongPix E2E',
      slug: profile.slug,
      bio: 'SongPix em teste',
      minimumContributionInCents: 100,
      isPublished: true,
    },
    cookie,
  ),
);
const session = await request(
  '/dashboard/songpix/sessions',
  json(
    'POST',
    {
      name: 'Sextaneja',
      theme: 'Só vale sertanejo',
      allowedGenres: ['Sertanejo'],
      allowedArtists: [],
      blockedArtists: [],
      minimumContributionInCents: 500,
      maximumDurationSeconds: 360,
      maximumQueueSize: 5,
      maximumRequestsPerSupporter: 2,
    },
    cookie,
  ),
);
await request(`/dashboard/songpix/sessions/${session.body.id}/activate`, {
  method: 'POST',
  headers: { cookie },
});
const publicSession = await request(`/public/creators/${profile.slug}/songpix`);
if (publicSession.body.id !== session.body.id)
  throw new Error('Sessão pública incorreta');
const catalog = await request('/public/songpix/catalog');
if (!catalog.body.some((song) => song.genre === 'Sertanejo'))
  throw new Error('Catálogo musical ausente');
await request(
  `/public/songpix/sessions/${session.body.id}/checkout`,
  json('POST', { songId: 'rock-1', supporterName: 'Apoiador' }),
  400,
);
const checkout = await request(
  `/public/songpix/sessions/${session.body.id}/checkout`,
  json('POST', {
    songId: 'sertanejo-1',
    supporterName: 'Apoiador',
    amountInCents: 700,
  }),
);
if (checkout.body.amountInCents !== 700)
  throw new Error('Valor escolhido no SongPix não foi preservado');
const duplicateCheckout = await request(
  `/public/songpix/sessions/${session.body.id}/checkout`,
  json('POST', { songId: 'sertanejo-1', supporterName: 'Outro' }),
);
if (
  !duplicateCheckout.body.requestId ||
  duplicateCheckout.body.requestId === checkout.body.requestId
)
  throw new Error('Pedidos duplicados não foram criados de forma independente');
const requestItem = { body: { id: checkout.body.requestId } };
const intent = checkout;
const widget = await request(
  '/dashboard/widgets',
  json('POST', { type: 'SONG_PIX', name: 'SongPix da live' }, cookie),
);
const unified = await request('/dashboard/overlay/rotate-token', {
  method: 'POST',
  headers: { cookie },
});
const socket = io(realtime, {
  transports: ['websocket'],
  auth: { token: widget.body.token },
});
await new Promise((resolve, reject) => {
  socket.once('connect', resolve);
  socket.once('connect_error', reject);
});
const unifiedSocket = io(realtime, {
  transports: ['websocket'],
  auth: { token: unified.body.token },
});
unifiedSocket.on('streamos:sync-request', () =>
  unifiedSocket.emit('streamos:sync-state', {
    overlayVersion: 'e2e',
    attempts: [],
  }),
);
await new Promise((resolve, reject) => {
  unifiedSocket.once('connect', resolve);
  unifiedSocket.once('connect_error', reject);
});
unifiedSocket.emit('streamos:heartbeat');
const startedEvent = waitForMatching(
  unifiedSocket,
  (event) => event.eventType === 'song.started.v1',
);
await request(`/mock/payment-intents/${intent.body.id}/confirm`, {
  method: 'POST',
});
const started = await startedEvent;
if (started.presentation?.widgetType !== 'SONG_PIX')
  throw new Error('Despacho automático/widget falhou');
await new Promise((resolve, reject) =>
  unifiedSocket
    .timeout(5000)
    .emit(
      'streamos:playback',
      { eventId: started.eventId, status: 'STARTED' },
      (error) => (error ? reject(error) : resolve()),
    ),
);
const queue = await request(
  `/dashboard/songpix/sessions/${session.body.id}/queue`,
  { headers: { cookie } },
);
const requested = queue.body.find((item) => item.id === requestItem.body.id);
if (requested?.status !== 'PLAYING' || requested.position !== 1)
  throw new Error('Pedido não entrou na fila');
unifiedSocket.emit('streamos:playback', {
  eventId: started.eventId,
  status: 'COMPLETED',
});
unifiedSocket.emit('streamos:ack', { eventId: started.eventId });
await new Promise((resolve) => setTimeout(resolve, 1000));
const completedQueue = await request(
  `/dashboard/songpix/sessions/${session.body.id}/queue`,
  { headers: { cookie } },
);
if (
  completedQueue.body.find((item) => item.id === requestItem.body.id)
    ?.status !== 'COMPLETED'
)
  throw new Error('Conclusão automática pelo overlay falhou');
const config = await request(
  `/public/widgets/config?token=${encodeURIComponent(widget.body.token)}`,
);
if (
  config.body.type !== 'SONG_PIX' ||
  config.body.initialData.theme !== 'Só vale sertanejo'
)
  throw new Error('Configuração pública SongPix incorreta');
const other = await request(
  '/auth/register',
  json('POST', {
    email: `other-${suffix}@streamos.local`,
    password: 'StreamOS-SongPix-123!',
    displayName: 'Outra Org',
    acceptTerms: true,
  }),
);
await request(
  `/dashboard/songpix/sessions/${session.body.id}/queue`,
  { headers: { cookie: cookieFrom(other.response) } },
  404,
);
socket.close();
unifiedSocket.close();
console.log(
  JSON.stringify(
    {
      result: 'ok',
      prePaymentGenreValidation: true,
      directCheckoutAndQueue: true,
      duplicateSongsAllowed: true,
      realtimeWidget: true,
      automaticPlayback: true,
      overlayReceiptCompletion: true,
      crossOrganizationIsolation: true,
    },
    null,
    2,
  ),
);
