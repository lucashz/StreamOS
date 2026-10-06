import './lib/e2e-invites.mjs';
import { io } from 'socket.io-client';
const api = process.env.API_URL ?? 'http://localhost:3001';
const realtime = (process.env.REALTIME_URL ?? 'http://localhost:3002').replace(
  /^ws/,
  'http',
);
async function req(path, opt = {}, expected) {
  const r = await fetch(`${api}${path}`, opt),
    t = await r.text();
  let b;
  try {
    b = t ? JSON.parse(t) : null;
  } catch {
    b = t;
  }
  if (expected === undefined ? !r.ok : r.status !== expected)
    throw new Error(`${path} ${r.status} ${JSON.stringify(b)}`);
  return { r, b };
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
function event(s, type, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout ${type}`)),
      timeout,
    );
    const listener = (v) => {
      if (v.eventType !== type) return;
      clearTimeout(timer);
      s.off('streamos:event', listener);
      resolve(v);
    };
    s.on('streamos:event', listener);
  });
}
const x = Date.now(),
  reg = await req(
    '/auth/register',
    json('POST', {
      email: `moderation-${x}@local.test`,
      password: 'StreamOS-Moderation-123!',
      displayName: 'Mod E2E',
      acceptTerms: true,
    }),
  ),
  cookie = reg.r.headers.getSetCookie()[0].split(';')[0],
  profile = reg.b.memberships[0].organization.creatorProfile;
await req(
  '/dashboard/onboarding',
  json(
    'PUT',
    {
      displayName: 'Mod E2E',
      slug: profile.slug,
      bio: 'mod',
      minimumContributionInCents: 100,
      isPublished: true,
    },
    cookie,
  ),
);
await req(
  '/dashboard/moderation/settings',
  json(
    'PUT',
    {
      moderationEnabled: true,
      ttsEnabled: true,
      voice: 'pt-BR-default',
      minimumInCents: 100,
      maximumCharacters: 100,
      paused: false,
    },
    cookie,
  ),
);
await req(
  '/dashboard/moderation/policies',
  json(
    'POST',
    {
      name: 'Anti spam',
      blockedWords: ['golpe'],
      blockLinks: true,
      minimumInCents: 100,
    },
    cookie,
  ),
);
const widget = await req(
  '/dashboard/widgets',
  json('POST', { type: 'ALERT', name: 'Moderado' }, cookie),
);
const s = io(realtime, {
  transports: ['websocket'],
  auth: { token: widget.b.token },
});
await new Promise((ok, bad) => {
  s.once('connect', ok);
  s.once('connect_error', bad);
});
const intent = await req(
  `/public/creators/${profile.slug}/payment-intents`,
  json('POST', {
    amountInCents: 500,
    supporterName: 'Apoiador',
    message: 'Mensagem segura',
  }),
);
await req(`/mock/payment-intents/${intent.b.id}/confirm`, { method: 'POST' });
await new Promise((r) => setTimeout(r, 300));
const overview = await req('/dashboard/moderation', { headers: { cookie } }),
  item = overview.b.items.find((i) => i.sourceId === intent.b.id);
if (item?.status !== 'APPROVED')
  throw new Error('Item não aprovado automaticamente');
if (item.ttsJob?.status !== 'QUEUED')
  throw new Error('TTS automático não foi criado');
await req(
  `/public/creators/${profile.slug}/payment-intents`,
  json('POST', {
    amountInCents: 500,
    supporterName: 'Spam',
    message: 'isso é golpe',
  }),
  400,
);
const final = await req('/dashboard/moderation', { headers: { cookie } });
if (
  final.b.items.find((i) => i.content === 'isso é golpe')?.status !== 'REJECTED'
)
  throw new Error('Política automática falhou');
s.close();
console.log(
  JSON.stringify(
    {
      result: 'ok',
      preChargeModeration: true,
      automaticPolicy: true,
      automaticTts: true,
    },
    null,
    2,
  ),
);
