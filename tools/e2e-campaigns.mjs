import './lib/e2e-invites.mjs';
import { io } from 'socket.io-client';
import {
  assertPaymentInvariants,
  closeInvariantDatabase,
} from './assert-payment-invariants.mjs';

const api = process.env.API_URL ?? 'http://localhost:3001';
const realtime = process.env.REALTIME_URL ?? 'http://localhost:3002';
const suffix = Date.now();

async function request(path, options = {}, expected = 200) {
  const response = await fetch(`${api}${path}`, options);
  const body = await response.json().catch(() => null);
  const accepted = Array.isArray(expected)
    ? expected.includes(response.status)
    : response.status === expected;
  if (!accepted)
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
function waitFor(socket, predicate, timeout = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Evento realtime não recebido')),
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

const registration = await request(
  '/auth/register',
  json('POST', {
    email: `campaign-${suffix}@streamos.local`,
    password: 'StreamOS-Campaign-123!',
    displayName: 'Criador Vaquinha',
    acceptTerms: true,
  }),
  201,
);
const cookie = cookieFrom(registration.response);
const organization = registration.body.memberships[0].organization;
const creatorSlug = organization.creatorProfile.slug;
await request(
  '/dashboard/onboarding',
  json(
    'PUT',
    {
      displayName: 'Criador Vaquinha',
      slug: creatorSlug,
      bio: 'Vaquinha E2E',
      minimumContributionInCents: 100,
      isPublished: true,
    },
    cookie,
  ),
);
const campaign = await request(
  '/dashboard/campaigns',
  json(
    'POST',
    {
      title: 'Setup novo da live',
      slug: `setup-${suffix}`,
      description: 'Objetivo validado por E2E',
      targetInCents: 100_000,
    },
    cookie,
  ),
  201,
);
const reward = await request(
  `/dashboard/campaigns/${campaign.body.id}/rewards`,
  json(
    'POST',
    {
      title: 'Recompensa única',
      description: 'Somente uma unidade',
      minimumInCents: 1_000,
      quantity: 1,
    },
    cookie,
  ),
  201,
);
await request(
  `/dashboard/campaigns/${campaign.body.id}/status`,
  json('POST', { status: 'PUBLISHED' }, cookie),
  201,
);
const widget = await request(
  '/dashboard/widgets',
  json('POST', { type: 'CAMPAIGN', name: 'Progresso da vaquinha' }, cookie),
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
socket.emit('streamos:heartbeat');
await new Promise((resolve, reject) => {
  socket.once('connect', resolve);
  socket.once('connect_error', reject);
});

const attempts = await Promise.all(
  ['Apoiador A', 'Apoiador B'].map((supporterName) =>
    request(
      `/public/campaigns/${campaign.body.id}/contributions`,
      json('POST', {
        amountInCents: 1_000,
        supporterName,
        rewardId: reward.body.id,
      }),
      [201, 400],
    ),
  ),
);
const winner = attempts.find((attempt) => attempt.response.status === 201);
const rejected = attempts.filter((attempt) => attempt.response.status === 400);
if (!winner || rejected.length !== 1)
  throw new Error(
    `Concorrência da recompensa falhou: ${attempts.map((x) => x.response.status)}`,
  );

const eventPromise = waitFor(
  socket,
  (event) =>
    event.eventType === 'live.queue.item.playing.v1' &&
    event.payload.kind === 'CAMPAIGN',
);
const confirmation = await request(
  `/mock/payment-intents/${winner.body.id}/confirm`,
  { method: 'POST' },
  201,
);
const event = await eventPromise;
if (event.presentation?.widgetType !== 'CAMPAIGN')
  throw new Error('Evento não foi direcionado ao widget de vaquinha');
socket.emit('streamos:ack', { eventId: event.eventId });

const publicCampaign = await request(
  `/public/creators/${creatorSlug}/campaigns/${campaign.body.slug}`,
);
if (publicCampaign.body.currentInCents !== 1_000)
  throw new Error('Progresso público da vaquinha incorreto');
const dashboard = await request('/dashboard/campaigns', {
  headers: { cookie },
});
const saved = dashboard.body.find((item) => item.id === campaign.body.id);
const claim = saved?.rewards?.[0]?.claims?.find(
  (item) => item.status === 'CLAIMED',
);
if (!claim) throw new Error('Resgate confirmado não apareceu no painel');
await request(
  `/dashboard/reward-claims/${claim.id}/deliver`,
  json('POST', { note: 'Entregue no E2E' }, cookie),
  201,
);

const other = await request(
  '/auth/register',
  json('POST', {
    email: `campaign-other-${suffix}@streamos.local`,
    password: 'StreamOS-Campaign-123!',
    displayName: 'Outra organização',
    acceptTerms: true,
  }),
  201,
);
const otherCookie = cookieFrom(other.response);
await request('/dashboard/campaigns', { headers: { cookie: otherCookie } });
await request(
  `/dashboard/campaigns/${campaign.body.id}/status`,
  json('POST', { status: 'CLOSED' }, otherCookie),
  404,
);
socket.close();
const invariants = await assertPaymentInvariants({
  paymentId: confirmation.body.paymentId,
  organizationId: organization.id,
  expectedQueueKind: 'CAMPAIGN',
});
await closeInvariantDatabase();

console.log(
  JSON.stringify(
    {
      result: 'ok',
      publicCheckout: true,
      lastRewardConcurrency: true,
      realtimeWidget: true,
      claimDelivery: true,
      crossOrganizationIsolation: true,
      paymentInvariant: invariants,
    },
    null,
    2,
  ),
);
