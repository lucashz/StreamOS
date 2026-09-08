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
  const cookie = response.headers.getSetCookie()[0]?.split(';')[0];
  if (!cookie) throw new Error('Cookie ausente');
  return cookie;
}

function waitFor(socket, event, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout aguardando ${event}`)),
      timeout,
    );
    socket.once(event, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `widgets-${suffix}@streamos.local`;
const registration = await request(
  '/auth/register',
  json('POST', {
    email,
    password: 'StreamOS-Widgets-123!',
    displayName: 'Widgets E2E',
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
      displayName: 'Widgets E2E',
      slug: profile.slug,
      bio: 'Widgets em teste',
      minimumContributionInCents: 100,
      isPublished: true,
    },
    cookie,
  ),
);

const catalog = await request('/dashboard/widgets/catalog', {
  headers: { cookie },
});
if (
  catalog.body.length < 14 ||
  !catalog.body.some((item) => item.type === 'SONG_PIX') ||
  !catalog.body.some((item) => item.type === 'VIDEO_PIX') ||
  !catalog.body.some((item) => item.type === 'POLL') ||
  !catalog.body.some((item) => item.type === 'MARATHON') ||
  !catalog.body.some((item) => item.type === 'BANNER') ||
  !catalog.body.some((item) => item.type === 'CUSTOM_TEXT')
)
  throw new Error('Catálogo incompleto');

const smokeTypes = catalog.body
  .map((item) => item.type)
  .filter((type) => !['ALERT', 'VIDEO_PIX', 'QR_CODE'].includes(type));
for (const type of smokeTypes) {
  const created = await request(
    '/dashboard/widgets',
    json('POST', { type, name: `${type} smoke` }, cookie),
  );
  if (!created.body.token || !created.body.browserSourceUrl)
    throw new Error(`${type}: credenciais do overlay ausentes`);
  const config = await request(
    `/public/widgets/config?token=${encodeURIComponent(created.body.token)}`,
  );
  if (config.body.type !== type)
    throw new Error(`${type}: configuração pública divergente`);
  const tested = await request(`/dashboard/widgets/${created.body.id}/test`, {
    method: 'POST',
    headers: { cookie },
  });
  if (tested.body?.queued !== true && tested.body?.static !== true)
    throw new Error(`${type}: teste do widget não foi aceito`);
  await request(`/dashboard/widgets/${created.body.id}`, {
    method: 'DELETE',
    headers: { cookie },
  });
  await request(
    `/public/widgets/config?token=${encodeURIComponent(created.body.token)}`,
    {},
    404,
  );
}

const alert = await request(
  '/dashboard/widgets',
  json('POST', { type: 'ALERT', name: 'Alerta principal' }, cookie),
);
if (!alert.body.token || !alert.body.browserSourceUrl)
  throw new Error('Acesso do widget ausente');

const updated = await request(
  `/dashboard/widgets/${alert.body.id}`,
  json(
    'PUT',
    {
      name: 'Alerta roxo',
      enabled: true,
      config: {
        accent: '#8844ee',
        durationMs: 3000,
        minimumInCents: 500,
        showMessage: true,
      },
    },
    cookie,
  ),
);
if (
  updated.body.configVersion !== 2 ||
  updated.body.config.accent !== '#8844ee'
)
  throw new Error('Versionamento de configuração falhou');

const unified = await request('/dashboard/overlay/rotate-token', {
  method: 'POST',
  headers: { cookie },
});

const socket = io(realtime, {
  transports: ['websocket'],
  auth: { token: unified.body.token },
});
await waitFor(socket, 'connect');
socket.emit('streamos:heartbeat');
const eventPromise = waitFor(socket, 'streamos:event');
await request(`/dashboard/widgets/${alert.body.id}/test`, {
  method: 'POST',
  headers: { cookie },
});
const event = await eventPromise;
if (event.presentation?.widgetType !== 'ALERT')
  throw new Error('Apresentação do widget incorreta');
const ack = await new Promise((resolve) =>
  socket.emit('streamos:ack', { eventId: event.eventId }, resolve),
);
if (!ack.accepted) throw new Error('ACK do widget não foi aceito');

const video = await request(
  '/dashboard/widgets',
  json('POST', { type: 'VIDEO_PIX', name: 'Vídeo real de teste' }, cookie),
);
const videoEventPromise = waitFor(socket, 'streamos:event');
await request(
  `/dashboard/widgets/${video.body.id}/test`,
  json(
    'POST',
    { videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    cookie,
  ),
);
const videoEvent = await videoEventPromise;
if (
  videoEvent.presentation?.widgetType !== 'VIDEO_PIX' ||
  videoEvent.payload.externalId !== 'dQw4w9WgXcQ' ||
  videoEvent.payload.isTest !== false
)
  throw new Error('Teste do VideoPix não usou a mídia real configurada');
socket.close();

const qr = await request(
  '/dashboard/widgets',
  json('POST', { type: 'QR_CODE', name: 'QR da live' }, cookie),
);
const publicConfig = await request(
  `/public/widgets/config?token=${encodeURIComponent(qr.body.token)}`,
);
if (
  publicConfig.body.type !== 'QR_CODE' ||
  !publicConfig.body.initialData.publicUrl.includes(profile.slug)
)
  throw new Error('Configuração pública do QR Code incorreta');

const duplicate = await request(
  `/dashboard/widgets/${alert.body.id}/duplicate`,
  { method: 'POST', headers: { cookie } },
);
if (duplicate.body.type !== 'ALERT' || !duplicate.body.token)
  throw new Error('Duplicação falhou');

const disabledVideo = await request(
  `/dashboard/widgets/${video.body.id}`,
  json(
    'PUT',
    {
      name: video.body.name,
      enabled: false,
      config: video.body.config,
    },
    cookie,
  ),
);
if (disabledVideo.body.enabled !== false)
  throw new Error('Widget disable was not persisted');
await request(
  `/public/widgets/config?token=${encodeURIComponent(video.body.token)}`,
  {},
  404,
);
const reenabledVideo = await request(
  `/dashboard/widgets/${video.body.id}`,
  json(
    'PUT',
    {
      name: video.body.name,
      enabled: true,
      config: video.body.config,
    },
    cookie,
  ),
);
if (reenabledVideo.body.enabled !== true)
  throw new Error('Widget activation was not persisted');
await request(
  `/public/widgets/config?token=${encodeURIComponent(video.body.token)}`,
);

const rotated = await request(`/dashboard/widgets/${qr.body.id}/rotate-token`, {
  method: 'POST',
  headers: { cookie },
});
await request(
  `/public/widgets/config?token=${encodeURIComponent(qr.body.token)}`,
  {},
  404,
);
await request(
  `/public/widgets/config?token=${encodeURIComponent(rotated.body.token)}`,
);

const other = await request(
  '/auth/register',
  json('POST', {
    email: `other-${email}`,
    password: 'StreamOS-Widgets-123!',
    displayName: 'Outra Org',
    acceptTerms: true,
  }),
);
const otherCookie = cookieFrom(other.response);
await request(
  `/dashboard/widgets/${alert.body.id}`,
  json(
    'PUT',
    {
      name: 'Ataque',
      enabled: false,
      config: {},
    },
    otherCookie,
  ),
  404,
);

await request(`/dashboard/widgets/${duplicate.body.id}`, {
  method: 'DELETE',
  headers: { cookie },
});
await request(
  `/public/widgets/config?token=${encodeURIComponent(duplicate.body.token)}`,
  {},
  404,
);

const list = await request('/dashboard/widgets', { headers: { cookie } });
if (list.body.length !== 3)
  throw new Error(`Lista final incorreta: ${list.body.length}`);

console.log(
  JSON.stringify(
    {
      result: 'ok',
      catalogTypes: catalog.body.length,
      allCatalogTypesSmokeTested: true,
      activationToggle: true,
      configVersioned: true,
      realtimeDelivered: true,
      realMediaTest: true,
      qrPublicConfig: true,
      tokenRotation: true,
      duplicateAndDelete: true,
      crossOrganizationIsolation: true,
    },
    null,
    2,
  ),
);
