import fs from 'node:fs';
import path from 'node:path';

const envFile = path.resolve(process.argv[2] ?? '.env.staging');
if (!fs.existsSync(envFile)) {
  throw new Error(`Arquivo de ambiente não encontrado: ${envFile}`);
}

const values = {};
for (const rawLine of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const separator = line.indexOf('=');
  if (separator < 1) continue;
  const key = line.slice(0, separator).trim();
  let value = line.slice(separator + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  )
    value = value.slice(1, -1);
  values[key] = value;
}

const errors = [];
const requiredDomains = [
  'APP_DOMAIN',
  'API_DOMAIN',
  'REALTIME_DOMAIN',
  'OVERLAY_DOMAIN',
];
const domains = requiredDomains.map((key) => {
  const value = values[key] ?? '';
  if (!/^(?=.{4,253}$)(?!-)[a-z0-9.-]+(?<!-)$/i.test(value))
    errors.push(
      `${key} deve conter somente o hostname, sem protocolo ou caminho.`,
    );
  if (value.endsWith('.example.com'))
    errors.push(`${key} ainda usa o domínio de exemplo.`);
  if (value === 'localhost' || value.endsWith('.localhost'))
    errors.push(`${key} não pode usar localhost no staging.`);
  return value.toLowerCase();
});
if (new Set(domains).size !== domains.length)
  errors.push('Os quatro domínios públicos devem ser diferentes.');

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.ACME_EMAIL ?? ''))
  errors.push('ACME_EMAIL deve ser um e-mail válido para emitir o HTTPS.');

for (const key of [
  'PAYMENTS_ENABLED',
  'PAYOUTS_ENABLED',
  'VIDEOPIX_ENABLED',
  'SONGPIX_ENABLED',
  'SUBSCRIPTIONS_ENABLED',
]) {
  if (!['true', 'false'].includes((values[key] ?? '').toLowerCase()))
    errors.push(`${key} deve ser true ou false.`);
}

for (const key of [
  'POSTGRES_PASSWORD',
  'SESSION_SECRET',
  'WEBHOOK_MOCK_SECRET',
  'APP_ENCRYPTION_KEY',
  'METRICS_TOKEN',
]) {
  const value = values[key] ?? '';
  if (value.length < 32)
    errors.push(`${key} deve ter pelo menos 32 caracteres.`);
  if (/replace|change|example|password|secret/i.test(value))
    errors.push(`${key} ainda parece ser um valor de exemplo.`);
}

const financialEnabled = ['PAYMENTS_ENABLED', 'PAYOUTS_ENABLED'].some(
  (key) => values[key]?.toLowerCase() === 'true',
);
if (
  values.PAYOUTS_ENABLED?.toLowerCase() === 'true' &&
  values.PAYMENTS_ENABLED?.toLowerCase() !== 'true'
)
  errors.push('PAYOUTS_ENABLED exige PAYMENTS_ENABLED=true.');
if (financialEnabled && values.ALLOW_FINANCIAL_STAGING !== 'true')
  errors.push(
    'Pagamentos ou saques estão ativos sem ALLOW_FINANCIAL_STAGING=true.',
  );

if (values.PAYMENT_PROVIDER === 'woovi') {
  if (!values.WOOVI_APP_ID)
    errors.push('WOOVI_APP_ID é obrigatório quando PAYMENT_PROVIDER=woovi.');
  if ((values.WOOVI_WEBHOOK_AUTHORIZATION ?? '').length < 32)
    errors.push(
      'WOOVI_WEBHOOK_AUTHORIZATION deve ter pelo menos 32 caracteres.',
    );
  if (values.PAYOUTS_ENABLED === 'true' && !values.WOOVI_SOURCE_PIX_KEY)
    errors.push('WOOVI_SOURCE_PIX_KEY é obrigatória para habilitar Pix Out.');
}
if (values.VIDEO_PROVIDER === 'youtube' && !values.YOUTUBE_API_KEY)
  errors.push('YOUTUBE_API_KEY é obrigatória quando VIDEO_PROVIDER=youtube.');
if (values.SONG_CATALOG_PROVIDER === 'http') {
  try {
    new URL(values.SONG_CATALOG_BASE_URL ?? '');
  } catch {
    errors.push(
      'SONG_CATALOG_BASE_URL deve ser uma URL válida para o catálogo HTTP.',
    );
  }
}

if (errors.length) {
  console.error('Preflight de staging recusado:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  JSON.stringify({
    result: 'ok',
    environment: path.basename(envFile),
    domains: requiredDomains.map((key) => values[key]),
    financialEnabled,
  }),
);
