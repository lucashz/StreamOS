import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';
import {
  assertPaymentInvariants,
  closeInvariantDatabase,
} from './assert-payment-invariants.mjs';

const api = process.env.API_URL ?? 'http://localhost:3001';
const realtime = (process.env.REALTIME_URL ?? 'http://localhost:3002').replace(
  /^ws/,
  'http',
);

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, options);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new Error(
      `${options.method ?? 'GET'} ${path}: ${JSON.stringify(body)}`,
    );
  return { response, body };
}

function waitFor(socket, event, timeout = 8_000) {
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

function waitForMatching(socket, event, predicate, timeout = 8_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timeout aguardando ${event} compatível`));
    }, timeout);
    const listener = (value) => {
      if (!predicate(value)) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(value);
    };
    socket.on(event, listener);
  });
}

const password = 'StreamOS-E2E-123!';
const email = `e2e-${Date.now()}@streamos.local`;
const registration = await request('/auth/register', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email,
    password,
    displayName: 'Criador E2E',
    acceptTerms: true,
  }),
});
const cookie = registration.response.headers.getSetCookie()[0]?.split(';')[0];
if (!cookie) throw new Error('Cookie de sessão não foi criado');
const organization = registration.body.memberships[0]?.organization;
if (!organization?.creatorProfile)
  throw new Error('Organização não foi criada');

await request('/dashboard/onboarding', {
  method: 'PUT',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({
    displayName: 'Criador E2E',
    slug: organization.creatorProfile.slug,
    bio: 'Canal validado pelo teste vertical',
    minimumContributionInCents: 100,
    isPublished: true,
    legalName: 'Criador E2E',
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
  socket.emit('streamos:sync-state', { overlayVersion: 'e2e', attempts: [] }),
);
await waitFor(socket, 'connect');
socket.emit('streamos:heartbeat');

const intent = await request(
  `/public/creators/${organization.creatorProfile.slug}/payment-intents`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      amountInCents: 10_000,
      supporterName: 'Apoiador E2E',
      message: 'Fluxo vertical validado',
    }),
  },
);
const eventPromise = waitForMatching(
  socket,
  'streamos:event',
  (candidate) =>
    candidate.eventType === 'live.queue.item.playing.v1' &&
    candidate.payload.kind === 'ALERT',
);
const confirmation = await request(
  `/mock/payment-intents/${intent.body.id}/confirm`,
  { method: 'POST' },
);
const repeatedConfirmation = await request(
  `/mock/payment-intents/${intent.body.id}/confirm`,
  { method: 'POST' },
);
if (repeatedConfirmation.body.paymentId !== confirmation.body.paymentId)
  throw new Error('Confirmação repetida criou outro pagamento');
const event = await eventPromise;
const ack = await new Promise((resolve) =>
  socket.emit('streamos:ack', { eventId: event.eventId }, resolve),
);
if (!ack.accepted) throw new Error('ACK não foi persistido');
socket.close();

const invariants = await assertPaymentInvariants({
  paymentId: confirmation.body.paymentId,
  organizationId: organization.id,
  expectedQueueKind: 'ALERT',
});
await closeInvariantDatabase();

await request(
  `/dashboard/payments/${confirmation.body.paymentId}/make-available`,
  { method: 'POST', headers: { cookie } },
);
const payoutKey = `e2e-payout-${randomUUID()}`;
await request('/dashboard/wallet/pix-key', {
  method: 'PUT',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'EMAIL', value: email }),
});
const payoutsEnabled =
  (process.env.PAYOUTS_ENABLED ?? 'false').toLowerCase() === 'true';
if (payoutsEnabled) {
  await request('/dashboard/payouts', {
    method: 'POST',
    headers: {
      cookie,
      'content-type': 'application/json',
      'idempotency-key': payoutKey,
    },
    body: JSON.stringify({ amountInCents: 2_000 }),
  });
} else {
  const blockedPayout = await fetch(`${api}/dashboard/payouts`, {
    method: 'POST',
    headers: {
      cookie,
      'content-type': 'application/json',
      'idempotency-key': payoutKey,
    },
    body: JSON.stringify({ amountInCents: 2_000 }),
  });
  if (blockedPayout.status !== 400)
    throw new Error('O kill switch de saques não bloqueou a operação');
}
const summary = await request('/dashboard/summary', { headers: { cookie } });
const reconciliation = await request('/dashboard/reconciliation', {
  headers: { cookie },
});

if (
  summary.body.pendingInCents !== 0 ||
  summary.body.availableInCents !== (payoutsEnabled ? 7_420 : 9_420)
)
  throw new Error(`Saldo incorreto: ${JSON.stringify(summary.body)}`);
if (!reconciliation.body.reconciled)
  throw new Error(`Conciliação falhou: ${JSON.stringify(reconciliation.body)}`);

console.log(
  JSON.stringify(
    {
      result: 'ok',
      creator: organization.creatorProfile.slug,
      paymentId: confirmation.body.paymentId,
      overlayEventId: event.eventId,
      availableInCents: summary.body.availableInCents,
      reconciliation: reconciliation.body.reconciled,
      payoutsEnabled,
      paymentInvariant: invariants,
    },
    null,
    2,
  ),
);
