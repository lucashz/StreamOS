import './lib/e2e-invites.mjs';
const api = process.env.API_URL ?? 'http://localhost:3001';
import { PrismaClient } from '../packages/database/dist/index.js';
import { createHash, randomBytes } from 'node:crypto';
const web = process.env.WEB_URL ?? 'http://localhost:3000';
const mailpit = process.env.MAILPIT_URL ?? 'http://localhost:8025';

async function request(path, options = {}, expectedStatus) {
  const response = await fetch(`${api}${path}`, options);
  const text = response.status === 204 ? '' : await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (
    expectedStatus === undefined
      ? !response.ok
      : response.status !== expectedStatus
  )
    throw new Error(
      `${options.method ?? 'GET'} ${path}: esperado ${expectedStatus ?? '2xx'}, recebido ${response.status} ${JSON.stringify(body)}`,
    );
  return { response, body };
}

function cookieFrom(response) {
  const cookie = response.headers.getSetCookie()[0]?.split(';')[0];
  if (!cookie) throw new Error('Cookie de sessão não foi criado');
  return cookie;
}

function json(method, body, cookie, userAgent) {
  return {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(userAgent ? { 'user-agent': userAgent } : {}),
    },
    body: JSON.stringify(body),
  };
}

async function latestResetToken(email) {
  const list = await fetch(`${mailpit}/api/v1/messages`);
  if (!list.ok) throw new Error(`Mailpit indisponível: ${list.status}`);
  const messages = (await list.json()).messages ?? [];
  const candidate = messages.find((message) =>
    (message.To ?? []).some((recipient) => recipient.Address === email),
  );
  if (!candidate)
    throw new Error(`E-mail de recuperação não encontrado para ${email}`);
  const detail = await fetch(`${mailpit}/api/v1/message/${candidate.ID}`);
  if (!detail.ok)
    throw new Error(`Não foi possível ler o e-mail: ${detail.status}`);
  const message = await detail.json();
  const match = String(message.Text ?? message.HTML ?? '').match(
    /redefinir-senha\?token=([A-Za-z0-9_-]+)/,
  );
  if (!match) throw new Error('Token não encontrado no e-mail de recuperação');
  return match[1];
}

async function assertPage(path) {
  const response = await fetch(`${web}${path}`);
  if (!response.ok)
    throw new Error(`Página ${path} respondeu ${response.status}`);
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `accounts-${suffix}@streamos.local`;
const otherEmail = `accounts-other-${suffix}@streamos.local`;
const password = 'StreamOS-Conta-123!';
const changedPassword = 'StreamOS-Alterada-456!';
const resetPassword = 'StreamOS-Reset-789!';
const inviteCode = randomBytes(18).toString('base64url');
const otherInviteCode = randomBytes(18).toString('base64url');
const prisma = new PrismaClient();
await prisma.betaInvite.create({
  data: {
    email,
    codeHash: createHash('sha256').update(inviteCode).digest('hex'),
  },
});
await prisma.betaInvite.create({
  data: {
    email: otherEmail,
    codeHash: createHash('sha256').update(otherInviteCode).digest('hex'),
  },
});

await request(
  '/auth/register',
  json('POST', {
    email,
    password,
    displayName: 'Conta E2E',
    acceptTerms: true,
  }),
  403,
);

const registration = await request(
  '/auth/register',
  json(
    'POST',
    {
      email,
      password,
      displayName: 'Conta E2E',
      acceptTerms: true,
      inviteCode,
    },
    null,
    'StreamOS Device One',
  ),
);
const cookieOne = cookieFrom(registration.response);

const secondLogin = await request(
  '/auth/login',
  json('POST', { email, password }, null, 'StreamOS Device Two'),
);
const cookieTwo = cookieFrom(secondLogin.response);

const sessions = await request('/auth/account/sessions', {
  headers: { cookie: cookieOne },
});
if (
  sessions.body.length !== 2 ||
  !sessions.body.some((item) => item.userAgent === 'StreamOS Device Two')
)
  throw new Error(
    `Sessões ou metadados incorretos: ${JSON.stringify(sessions.body)}`,
  );
const foreignTarget = sessions.body.find((item) => !item.current)?.id;
if (!foreignTarget) throw new Error('Segunda sessão não foi identificada');

await request(
  '/auth/account/profile',
  json(
    'PUT',
    { email, displayName: 'Conta Atualizada', bio: 'Perfil validado por E2E' },
    cookieOne,
  ),
);
const profile = await request('/auth/me', { headers: { cookie: cookieOne } });
const creator = profile.body.memberships[0]?.organization?.creatorProfile;
if (
  creator?.displayName !== 'Conta Atualizada' ||
  creator?.bio !== 'Perfil validado por E2E'
)
  throw new Error(`Perfil não foi atualizado: ${JSON.stringify(profile.body)}`);

const otherRegistration = await request(
  '/auth/register',
  json('POST', {
    email: otherEmail,
    password,
    displayName: 'Outra Conta',
    acceptTerms: true,
    inviteCode: otherInviteCode,
  }),
);
const otherCookie = cookieFrom(otherRegistration.response);
await request(
  `/auth/account/sessions/${foreignTarget}`,
  { method: 'DELETE', headers: { cookie: otherCookie } },
  400,
);

await request(
  '/auth/account/password',
  json(
    'PUT',
    { currentPassword: password, newPassword: changedPassword },
    cookieOne,
  ),
);
await request('/auth/me', { headers: { cookie: cookieTwo } }, 401);
await request('/auth/me', { headers: { cookie: cookieOne } });
const changedLogin = await request(
  '/auth/login',
  json('POST', { email, password: changedPassword }),
);
const cookieThree = cookieFrom(changedLogin.response);

await request('/auth/forgot-password', json('POST', { email }));
const token = await latestResetToken(email);
await request(
  '/auth/reset-password',
  json('POST', { token, password: resetPassword }),
);
await request(
  '/auth/reset-password',
  json('POST', { token, password: resetPassword }),
  400,
);
await request('/auth/me', { headers: { cookie: cookieOne } }, 401);
await request('/auth/me', { headers: { cookie: cookieThree } }, 401);
await request('/auth/login', json('POST', { email, password: resetPassword }));
await request(
  '/auth/forgot-password',
  json('POST', { email: `missing-${suffix}@streamos.local` }),
);

await Promise.all([
  assertPage('/conta'),
  assertPage('/recuperar-senha'),
  assertPage('/redefinir-senha?token=invalid'),
]);

console.log(
  JSON.stringify(
    {
      result: 'ok',
      account: email,
      sessionsValidated: 2,
      profileUpdated: true,
      crossAccountIsolation: true,
      passwordChange: true,
      passwordReset: true,
      resetTokenSingleUse: true,
      twoFactorAuthentication: false,
    },
    null,
    2,
  ),
);
