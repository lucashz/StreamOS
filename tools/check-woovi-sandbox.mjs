const baseUrl = process.env.WOOVI_BASE_URL ?? 'https://api.woovi-sandbox.com';
const appId = process.env.WOOVI_APP_ID;
if (!appId) throw new Error('WOOVI_APP_ID não configurado');
if (!baseUrl.startsWith('https://api.woovi-sandbox.com'))
  throw new Error('Este comando aceita somente o sandbox da Woovi');

async function readJson(url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  return { response, body };
}

const subaccounts = await readJson(
  `${baseUrl}/api/v1/subaccount?limit=1&skip=0`,
  {
    headers: { accept: 'application/json', authorization: appId },
  },
);
const emptyAccount =
  subaccounts.response.status === 400 &&
  typeof subaccounts.body?.error === 'string' &&
  subaccounts.body.error.toLowerCase().includes('não foram encontradas');
if (!subaccounts.response.ok && !emptyAccount)
  throw new Error(
    `AppID recusado pelo endpoint de subcontas: HTTP ${subaccounts.response.status}`,
  );

const publicKeys = await readJson(`${baseUrl}/api/v1/webhook/public-keys`, {
  headers: { accept: 'application/json', authorization: appId },
});
if (!publicKeys.response.ok)
  throw new Error(
    `Chaves públicas indisponíveis: HTTP ${publicKeys.response.status}`,
  );
console.log(
  JSON.stringify({
    result: 'ok',
    environment: 'woovi-sandbox',
    appIdAccepted: true,
    subaccounts: emptyAccount ? 'empty' : 'available',
    webhookPublicKeysAvailable: true,
  }),
);
