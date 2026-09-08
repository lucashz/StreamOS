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
function waitForEvent(socket, predicate, timeout = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timeout aguardando alerta')),
      timeout,
    );
    const listener = (event) => {
      if (!predicate(event)) return;
      clearTimeout(timer);
      socket.off('streamos:event', listener);
      resolve(event);
    };
    socket.on('streamos:event', listener);
  });
}

async function uploadAsset(
  cookie,
  { bytes, filename, mimeType, metadata = {} },
) {
  const form = new FormData();
  form.set('file', new File([bytes], filename, { type: mimeType }));
  form.set('name', filename);
  for (const [key, value] of Object.entries(metadata))
    form.set(key, String(value));
  return request('/dashboard/alerts/assets/upload', {
    method: 'POST',
    headers: { cookie },
    body: form,
  });
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const registration = await request(
  '/auth/register',
  json('POST', {
    email: `alert-editor-${suffix}@streamos.local`,
    password: 'StreamOS-Alerts-123!',
    displayName: 'Alert Editor E2E',
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
      displayName: 'Alert Editor E2E',
      slug: profile.slug,
      bio: 'Alertas em teste',
      minimumContributionInCents: 100,
      isPublished: true,
    },
    cookie,
  ),
);

const initial = await request('/dashboard/alerts/editor', {
  headers: { cookie },
});
if (!initial.body.variations.some((item) => item.isDefault))
  throw new Error('Variação padrão ausente');
const appearance = {
  template: 'minimal',
  accent: '#22c55e',
  textColor: '#f8fafc',
  fontFamily: 'DM Sans',
  fontSize: 30,
  textAlign: 'left',
  position: 'bottom-left',
  applyToExisting: true,
};
await request('/dashboard/alerts/appearance', json('PUT', appearance, cookie));
const savedAppearance = await request('/dashboard/alerts/appearance', {
  headers: { cookie },
});
if (
  savedAppearance.body.theme.accent !== appearance.accent ||
  savedAppearance.body.theme.position !== appearance.position
)
  throw new Error('Global appearance did not persist');
const inherited = await request('/dashboard/alerts/editor', {
  headers: { cookie },
});
if (
  !inherited.body.variations.every(
    (item) =>
      item.template === appearance.template &&
      item.accent === appearance.accent &&
      item.layout.position === appearance.position,
  )
)
  throw new Error('Global appearance was not applied to alerts');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const wav = Buffer.alloc(44 + 8_000);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8_000, 24);
wav.writeUInt32LE(8_000, 28);
wav.writeUInt16LE(1, 32);
wav.writeUInt16LE(8, 34);
wav.write('data', 36);
wav.writeUInt32LE(8_000, 40);
wav.fill(128, 44);
const visual = await uploadAsset(cookie, {
  bytes: png,
  filename: 'imagem-alerta-e2e.png',
  mimeType: 'image/png',
  metadata: { width: 1, height: 1 },
});
const sound = await uploadAsset(cookie, {
  bytes: wav,
  filename: 'som-alerta-e2e.wav',
  mimeType: 'audio/wav',
  metadata: { durationMs: 1000 },
});
for (const asset of [visual.body, sound.body]) {
  const media = await fetch(asset.url);
  if (!media.ok || !(await media.arrayBuffer()).byteLength)
    throw new Error(`Upload indisponível no overlay: ${asset.name}`);
}
const input = {
  name: 'Apoio especial',
  enabled: true,
  isDefault: false,
  priority: 50,
  minimumInCents: 1000,
  maximumInCents: 5000,
  template: 'card',
  accent: '#8844ee',
  textColor: '#ffffff',
  fontFamily: 'Inter',
  fontSize: 36,
  textAlign: 'center',
  layout: { direction: 'column', position: 'center', mediaFit: 'contain' },
  minimumDurationMs: 4000,
  maximumDurationMs: 9000,
  soundVolume: 70,
  ttsEnabled: true,
  ttsVoice: 'pt-BR-default',
  ttsRate: 1.1,
  ttsVolume: 90,
  showSupporter: true,
  showAmount: true,
  showMessage: true,
  visualAssetId: visual.body.id,
  soundAssetId: sound.body.id,
};
const variation = await request(
  '/dashboard/alerts/variations',
  json('POST', input, cookie),
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
const incoming = waitForEvent(
  socket,
  (event) => event.eventType === 'live.queue.item.playing.v1',
);
await request(
  '/dashboard/alerts/test',
  json('POST', { variationId: variation.body.id }, cookie),
);
const event = await incoming;
if (event.presentation?.variation?.id !== variation.body.id)
  throw new Error('Variação direcionada não chegou ao overlay');
if (
  event.presentation.variation.visualAsset?.id !== visual.body.id ||
  event.presentation.variation.soundAsset?.id !== sound.body.id
)
  throw new Error('Mídias não chegaram ao overlay');
socket.emit('streamos:playback', { eventId: event.eventId, status: 'STARTED' });
socket.emit('streamos:playback', {
  eventId: event.eventId,
  status: 'COMPLETED',
});

const liveConfigUpdate = new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error('Configuração salva não chegou ao overlay aberto')),
    10_000,
  );
  socket.once('streamos:alert-config', (presentation) => {
    clearTimeout(timer);
    resolve(presentation);
  });
});
const updated = await request(
  `/dashboard/alerts/variations/${variation.body.id}`,
  json(
    'PUT',
    {
      ...input,
      name: 'Apoio especial atualizado',
      accent: '#22aaff',
      fontSize: 42,
    },
    cookie,
  ),
);
if (updated.body.configVersion !== 2)
  throw new Error('Versionamento da variação falhou');
const livePresentation = await liveConfigUpdate;
if (
  livePresentation.variation?.id !== variation.body.id ||
  livePresentation.variation?.accent !== '#22aaff' ||
  livePresentation.variation?.fontSize !== 42
)
  throw new Error('Overlay aberto recebeu configuração divergente');
const duplicate = await request(
  `/dashboard/alerts/variations/${variation.body.id}/duplicate`,
  { method: 'POST', headers: { cookie } },
);
if (duplicate.body.enabled || duplicate.body.isDefault)
  throw new Error('Duplicação insegura');
await request(`/dashboard/alerts/variations/${duplicate.body.id}`, {
  method: 'DELETE',
  headers: { cookie },
});

const other = await request(
  '/auth/register',
  json('POST', {
    email: `other-alert-${suffix}@streamos.local`,
    password: 'StreamOS-Alerts-123!',
    displayName: 'Outra Org',
    acceptTerms: true,
  }),
);
await request(
  `/dashboard/alerts/variations/${variation.body.id}`,
  json('PUT', input, cookieFrom(other.response)),
  404,
);
socket.close();
console.log(
  JSON.stringify(
    {
      result: 'ok',
      defaultVariation: true,
      globalAppearance: true,
      assets: true,
      uploadedMediaAvailable: true,
      targetedPreview: true,
      overlayPresentation: true,
      liveConfigurationRefresh: true,
      versioning: true,
      duplicateDelete: true,
      isolation: true,
    },
    null,
    2,
  ),
);
