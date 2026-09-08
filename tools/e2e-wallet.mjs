import { randomUUID } from 'node:crypto';

const api = process.env.API_URL ?? 'http://localhost:3001';

async function request(path, options = {}, expectedStatus) {
  const response = await fetch(`${api}${path}`, options);
  const text = response.status === 204 ? '' : await response.text();
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

function json(method, body, cookie, extraHeaders = {}) {
  return {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function cookieFrom(response) {
  const cookie = response.headers.getSetCookie()[0]?.split(';')[0];
  if (!cookie) throw new Error('Cookie de sessão ausente');
  return cookie;
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `wallet-${suffix}@streamos.local`;
const password = 'StreamOS-Wallet-123!';
const registration = await request(
  '/auth/register',
  json('POST', {
    email,
    password,
    displayName: 'Carteira E2E',
    acceptTerms: true,
  }),
);
const cookie = cookieFrom(registration.response);
const creator = registration.body.memberships[0].organization.creatorProfile;

await request(
  '/dashboard/onboarding',
  json(
    'PUT',
    {
      displayName: 'Carteira E2E',
      slug: creator.slug,
      bio: 'Teste da carteira operacional',
      minimumContributionInCents: 100,
      isPublished: true,
      legalName: 'Carteira E2E Ltda',
      taxId: '11222333000181',
      financialTermsAccepted: true,
    },
    cookie,
  ),
);

const initialSettings = await request('/dashboard/wallet/settings', {
  headers: { cookie },
});
if (initialSettings.body.minimumPayoutInCents !== 1000)
  throw new Error(
    `Limite mínimo incorreto: ${JSON.stringify(initialSettings.body)}`,
  );

await request(
  '/dashboard/payouts',
  json('POST', { amountInCents: 1000 }, cookie, {
    'idempotency-key': `without-key-${randomUUID()}`,
  }),
  400,
);

const rawPixKey = `wallet.${suffix}@streamos.local`;
const settings = await request(
  '/dashboard/wallet/pix-key',
  json(
    'PUT',
    {
      type: 'EMAIL',
      value: rawPixKey,
    },
    cookie,
  ),
);
if (
  !settings.body.pixKeyMasked ||
  JSON.stringify(settings.body).includes(rawPixKey)
)
  throw new Error('Chave Pix não foi mascarada corretamente');

const intent = await request(
  `/public/creators/${creator.slug}/payment-intents`,
  json(
    'POST',
    {
      amountInCents: 20_000,
      supporterName: 'Apoiador da Carteira',
      message: 'Validando recebíveis',
    },
    null,
  ),
);
const confirmation = await request(
  `/mock/payment-intents/${intent.body.id}/confirm`,
  { method: 'POST' },
);
await request(
  `/dashboard/payments/${confirmation.body.paymentId}/make-available`,
  {
    method: 'POST',
    headers: { cookie },
  },
);

const receivables = await request('/dashboard/wallet/receivables', {
  headers: { cookie },
});
const receivable = receivables.body.find(
  (item) => item.id === confirmation.body.paymentId,
);
if (
  !receivable ||
  receivable.grossInCents !== 20_000 ||
  receivable.platformFeeInCents !== 1_000 ||
  receivable.providerFeeInCents !== 160 ||
  receivable.totalFeeInCents !== 1_160 ||
  receivable.netInCents !== 18_840
)
  throw new Error(`Recebível incorreto: ${JSON.stringify(receivable)}`);

if (process.env.PAYOUTS_ENABLED !== 'true') {
  const disabledPayout = await request(
    '/dashboard/payouts',
    json('POST', { amountInCents: 2_000 }, cookie, {
      'idempotency-key': `disabled-${randomUUID()}`,
    }),
    400,
  );
  if (!JSON.stringify(disabledPayout.body).includes('temporariamente indisponíveis'))
    throw new Error(
      `Kill switch de saques não retornou a mensagem esperada: ${JSON.stringify(disabledPayout.body)}`,
    );
  console.log(
    JSON.stringify(
      {
        result: 'ok',
        pixKeyProtected: true,
        receivableGrossInCents: receivable.grossInCents,
        receivableNetInCents: receivable.netInCents,
        payoutsEnabled: false,
        payoutKillSwitchEnforced: true,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

await request(
  '/dashboard/payouts',
  json('POST', { amountInCents: 500 }, cookie, {
    'idempotency-key': `below-minimum-${randomUUID()}`,
  }),
  400,
);

const payout = await request(
  '/dashboard/payouts',
  json('POST', { amountInCents: 2_000 }, cookie, {
    'idempotency-key': `payout-${randomUUID()}`,
  }),
);
if (payout.body.status !== 'COMPLETED' || !payout.body.id)
  throw new Error(`Saque inválido: ${JSON.stringify(payout.body)}`);

const detail = await request(`/dashboard/wallet/payouts/${payout.body.id}`, {
  headers: { cookie },
});
if (detail.body.destinationMasked !== settings.body.pixKeyMasked)
  throw new Error('Destino do saque não foi preservado no comprovante');

const statement = await request(
  '/dashboard/wallet/statement?type=payout_completed',
  { headers: { cookie } },
);
if (!statement.body.some((entry) => entry.referenceId === payout.body.id))
  throw new Error('Saque não apareceu no extrato filtrado');

const csv = await request(
  '/dashboard/wallet/statement.csv?type=payout_completed',
  { headers: { cookie } },
);
if (typeof csv.body !== 'string' || !csv.body.includes('payout_completed'))
  throw new Error('Exportação CSV não contém o saque');

const other = await request(
  '/auth/register',
  json('POST', {
    email: `other-${email}`,
    password,
    displayName: 'Outra Carteira',
    acceptTerms: true,
  }),
);
const otherCookie = cookieFrom(other.response);
await request(
  `/dashboard/wallet/payouts/${payout.body.id}`,
  { headers: { cookie: otherCookie } },
  404,
);

console.log(
  JSON.stringify(
    {
      result: 'ok',
      pixKeyProtected: true,
      receivableGrossInCents: receivable.grossInCents,
      receivableNetInCents: receivable.netInCents,
      payoutId: payout.body.id,
      minimumLimitEnforced: true,
      statementFiltered: true,
      csvExported: true,
      crossOrganizationIsolation: true,
    },
    null,
    2,
  ),
);
