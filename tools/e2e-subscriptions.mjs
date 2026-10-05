import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';
import {
  assertSubscriptionInvariants,
  closeInvariantDatabase,
} from './assert-payment-invariants.mjs';

const api = process.env.API_URL ?? 'http://localhost:3001';
const realtime = process.env.REALTIME_URL ?? 'http://localhost:3002';
const suffix = Date.now();
async function request(path, options = {}, expected = 200) {
  const response = await fetch(`${api}${path}`, options);
  const body = await response.json().catch(() => null);
  if (response.status !== expected)
    throw new Error(
      `${options.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(body)}`,
    );
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
const cookieFrom = (response) =>
  response.headers.getSetCookie()[0]?.split(';')[0];
function event(socket, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Evento ${type} não recebido`)),
      10_000,
    );
    const listener = (value) => {
      if (value.eventType !== type) return;
      clearTimeout(timer);
      socket.off('streamos:event', listener);
      resolve(value);
    };
    socket.on('streamos:event', listener);
  });
}

const registration = await request(
  '/auth/register',
  json('POST', {
    email: `subscription-${suffix}@streamos.local`,
    password: 'StreamOS-Subscription-123!',
    displayName: 'Criador Assinaturas',
    acceptTerms: true,
  }),
  201,
);
const cookie = cookieFrom(registration.response);
const creator = registration.body.memberships[0].organization.creatorProfile;
await request(
  '/dashboard/onboarding',
  json(
    'PUT',
    {
      displayName: 'Criador Assinaturas',
      slug: creator.slug,
      bio: '',
      minimumContributionInCents: 100,
      isPublished: true,
    },
    cookie,
  ),
);
const plan = await request(
  '/dashboard/subscription-plans',
  json(
    'POST',
    {
      name: 'Clube da Live',
      description: 'Membros da comunidade',
      priceInCents: 1490,
      benefits: ['Badge exclusivo', 'Grupo da comunidade'],
    },
    cookie,
  ),
  201,
);
await request(
  `/dashboard/subscription-plans/${plan.body.id}/publish`,
  json('POST', { published: true }, cookie),
  201,
);
await request(
  '/dashboard/widgets',
  json('POST', { type: 'SUBSCRIPTION', name: 'Novos membros' }, cookie),
  201,
);
const overlay = await request(
  '/dashboard/overlay/rotate-token',
  { method: 'POST', headers: { cookie } },
  201,
);
const socket = io(realtime, {
  transports: ['websocket'],
  auth: { token: overlay.body.token },
});
socket.on('streamos:sync-request', () =>
  socket.emit('streamos:sync-state', { overlayVersion: 'e2e', attempts: [] }),
);
await new Promise((resolve, reject) => {
  socket.once('connect', resolve);
  socket.once('connect_error', reject);
});
socket.emit('streamos:heartbeat');
const createdEvent = event(socket, 'live.queue.item.playing.v1');
const subscription = await request(
  `/public/plans/${plan.body.id}/subscribe`,
  json('POST', {
    supporterName: 'Membro E2E',
    supporterEmail: `member-${suffix}@example.com`,
  }),
  201,
);
const created = await createdEvent;
if (created.presentation?.widgetType !== 'SUBSCRIPTION')
  throw new Error('Nova assinatura não chegou ao overlay único');
socket.emit('streamos:ack', { eventId: created.eventId });

const renewalKey = randomUUID();
const [renewedA, renewedB] = await Promise.all([
  request(
    `/dashboard/subscriptions/${subscription.body.id}/renew`,
    json('POST', { idempotencyKey: renewalKey }, cookie),
    201,
  ),
  request(
    `/dashboard/subscriptions/${subscription.body.id}/renew`,
    json('POST', { idempotencyKey: renewalKey }, cookie),
    201,
  ),
]);
if (
  renewedA.body.id !== renewedB.body.id ||
  renewedA.body.status !== 'MOCK_PAID'
)
  throw new Error('Renovação idempotente falhou');
const failed = await request(
  `/dashboard/subscriptions/${subscription.body.id}/renew`,
  json('POST', { idempotencyKey: randomUUID(), fail: true }, cookie),
  201,
);
if (failed.body.status !== 'MOCK_FAILED')
  throw new Error('Falha mock não registrada');
await request(
  `/dashboard/subscriptions/${subscription.body.id}/cancel`,
  { method: 'POST', headers: { cookie } },
  201,
);
const canceled = await request(
  `/dashboard/subscriptions/${subscription.body.id}/renew`,
  json('POST', { idempotencyKey: randomUUID() }, cookie),
  201,
);
if (!canceled.body.canceled)
  throw new Error('Cancelamento ao fim do período falhou');

const dashboard = await request('/dashboard/subscription-plans', {
  headers: { cookie },
});
const saved = dashboard.body[0].subscriptions.find(
  (item) => item.id === subscription.body.id,
);
if (saved.status !== 'CANCELED' || saved.renewals.length !== 3)
  throw new Error('Histórico da assinatura incorreto');
const publicPlans = await request(`/public/creators/${creator.slug}/plans`);
if (publicPlans.body[0].benefits.length !== 2)
  throw new Error('Benefícios públicos ausentes');

const other = await request(
  '/auth/register',
  json('POST', {
    email: `subscription-other-${suffix}@streamos.local`,
    password: 'StreamOS-Subscription-123!',
    displayName: 'Outra organização',
    acceptTerms: true,
  }),
  201,
);
await request(
  `/dashboard/subscriptions/${subscription.body.id}/cancel`,
  { method: 'POST', headers: { cookie: cookieFrom(other.response) } },
  404,
);
socket.close();
const invariants = await assertSubscriptionInvariants({
  subscriptionId: subscription.body.id,
  organizationId:
    creator.organizationId ?? registration.body.memberships[0].organization.id,
  renewalIdempotencyKey: renewalKey,
});
await closeInvariantDatabase();
console.log(
  JSON.stringify(
    {
      result: 'ok',
      benefits: true,
      unifiedOverlay: true,
      idempotentRenewal: true,
      failedRenewal: true,
      cancelAtPeriodEnd: true,
      history: true,
      crossOrganizationIsolation: true,
      invariants,
    },
    null,
    2,
  ),
);
