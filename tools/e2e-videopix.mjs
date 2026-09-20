import { io } from 'socket.io-client';
const api = process.env.API_URL ?? 'http://localhost:3001';
const realtime = (process.env.REALTIME_URL ?? 'http://localhost:3002').replace(
  /^ws/,
  'http',
);
async function request(path, options = {}, expected) {
  const response = await fetch(`${api}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (expected === undefined ? !response.ok : response.status !== expected)
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
  const cookie = response.headers.getSetCookie()[0]?.split(';')[0];
  if (!cookie) throw new Error('Cookie ausente');
  return cookie;
}
function event(socket, type, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('streamos:event', listener);
      reject(new Error(`Timeout ${type}`));
    }, timeout);
    const listener = (value) => {
      if (value.eventType !== type) return;
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
    email: `videopix-${suffix}@streamos.local`,
    password: 'StreamOS-VideoPix-123!',
    displayName: 'VideoPix E2E',
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
      displayName: 'VideoPix E2E',
      slug: profile.slug,
      bio: 'VideoPix em teste',
      minimumContributionInCents: 100,
      isPublished: true,
    },
    cookie,
  ),
);
const session = await request(
  '/dashboard/videopix/sessions',
  json(
    'POST',
    {
      name: 'Vídeos da live',
      pricePerSecondInCents: 5,
      minimumContributionInCents: 300,
      maximumDurationSeconds: 300,
      minimumViews: 10000,
      minimumAgeDays: 7,
      maximumQueueSize: 5,
    },
    cookie,
  ),
);
await request(`/dashboard/videopix/sessions/${session.body.id}/activate`, {
  method: 'POST',
  headers: { cookie },
});
const previewPath = `/public/videopix/sessions/${session.body.id}/preview`;
for (const id of ['private', 'removed', 'noembed', 'lowviews', 'newvideo'])
  await request(
    previewPath,
    json('POST', { url: `https://youtube.com/watch?v=${id}` }),
    400,
  );
const longPreview = await request(
  previewPath,
  json('POST', {
    url: 'https://youtube.com/watch?v=longvideo',
    startAtSeconds: 300,
    selectedSeconds: 600,
  }),
);
if (longPreview.body.selectedSeconds !== 600)
  throw new Error('Trecho longo foi limitado indevidamente');
const preview = await request(
  previewPath,
  json('POST', {
    url: 'https://youtube.com/watch?v=video-ok',
    selectedSeconds: 60,
  }),
);
if (preview.body.amountInCents !== 300)
  throw new Error('Precificação incorreta');
const checkout = await request(
  `/public/videopix/sessions/${session.body.id}/checkout`,
  json('POST', {
    url: 'https://youtube.com/watch?v=video-ok',
    supporterName: 'Apoiador vídeo',
    selectedSeconds: 80,
    amountInCents: 550,
  }),
);
if (checkout.body.amountInCents !== 550 || !checkout.body.requestId)
  throw new Error('Checkout direto incorreto');
const requestItem = { body: { id: checkout.body.requestId } };
const intent = checkout;
const widget = await request(
  '/dashboard/widgets',
  json('POST', { type: 'VIDEO_PIX', name: 'Player VideoPix' }, cookie),
);
const unified = await request('/dashboard/overlay/rotate-token', {
  method: 'POST',
  headers: { cookie },
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
const socket = io(realtime, {
  transports: ['websocket'],
  auth: { token: widget.body.token },
});
socket.on('streamos:sync-request', () =>
  socket.emit('streamos:sync-state', {
    overlayVersion: 'e2e',
    attempts: [],
  }),
);
await new Promise((resolve, reject) => {
  socket.once('connect', resolve);
  socket.once('connect_error', reject);
});
const startedPromise = event(socket, 'video.started.v1');
await request(`/mock/payment-intents/${intent.body.id}/confirm`, {
  method: 'POST',
});
const queue = await request(
  `/dashboard/videopix/sessions/${session.body.id}/queue`,
  { headers: { cookie } },
);
if (
  queue.body.find((item) => item.id === requestItem.body.id)?.status !==
  'QUEUED'
)
  throw new Error('Fila não atualizada');
await request(
  `/dashboard/videopix/requests/${requestItem.body.id}/action`,
  json('POST', { action: 'PLAY' }, cookie),
);
const started = await startedPromise;
if (started.presentation?.widgetType !== 'VIDEO_PIX')
  throw new Error('Widget incorreto');
socket.emit('streamos:ack', { eventId: started.eventId });
const unavailablePromise = event(socket, 'video.unavailable.v1');
const unavailable = await request(
  `/dashboard/videopix/requests/${requestItem.body.id}/action`,
  json('POST', { action: 'UNAVAILABLE' }, cookie),
);
await unavailablePromise;
if (unavailable.body.status !== 'UNAVAILABLE')
  throw new Error('Indisponibilidade pós-confirmação falhou');
const config = await request(
  `/public/widgets/config?token=${encodeURIComponent(widget.body.token)}`,
);
if (config.body.type !== 'VIDEO_PIX')
  throw new Error('Config pública incorreta');
const other = await request(
  '/auth/register',
  json('POST', {
    email: `other-video-${suffix}@streamos.local`,
    password: 'StreamOS-VideoPix-123!',
    displayName: 'Outra Org',
    acceptTerms: true,
  }),
);
await request(
  `/dashboard/videopix/sessions/${session.body.id}/queue`,
  { headers: { cookie: cookieFrom(other.response) } },
  404,
);
socket.close();
unifiedSocket.close();
console.log(
  JSON.stringify(
    {
      result: 'ok',
      prePaymentMetadataValidation: true,
      pricingPerSecond: true,
      directCheckoutWithoutReview: true,
      realtimePlayer: true,
      unavailableAfterConfirmation: true,
      crossOrganizationIsolation: true,
    },
    null,
    2,
  ),
);
