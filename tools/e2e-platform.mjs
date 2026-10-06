import './lib/e2e-invites.mjs';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';

const api = process.env.API_URL ?? 'http://localhost:3001';
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
const ownerRegistration = await request(
  '/auth/register',
  json('POST', {
    email: `platform-owner-${suffix}@streamos.local`,
    password: 'StreamOS-Platform-123!',
    displayName: 'Owner',
    acceptTerms: true,
  }),
  201,
);
const ownerCookie = cookieFrom(ownerRegistration.response);
const memberEmail = `platform-member-${suffix}@streamos.local`;
const invite = await request(
  '/dashboard/team/invites',
  json('POST', { email: memberEmail, role: 'MODERATOR' }, ownerCookie),
  201,
);
const memberRegistration = await request(
  '/auth/register',
  json('POST', {
    email: memberEmail,
    password: 'StreamOS-Platform-123!',
    displayName: 'Member',
    acceptTerms: true,
  }),
  201,
);
const memberCookie = cookieFrom(memberRegistration.response);
await request(
  '/dashboard/team/invites/accept',
  json('POST', { token: invite.body.inviteToken }, memberCookie),
  201,
);
const ownerOrganizationId =
  ownerRegistration.body.memberships[0].organization.id;
await request(`/auth/organizations/${ownerOrganizationId}/select`, {
  method: 'POST',
  headers: { cookie: memberCookie },
});
let overview = await request('/dashboard/platform', {
  headers: { cookie: ownerCookie },
});
const member = overview.body.members.find(
  (item) => item.user.email === memberEmail,
);
await request(
  `/dashboard/team/members/${member.id}`,
  json('PATCH', { role: 'VIEWER' }, ownerCookie),
);
await request('/dashboard/alerts/test', json('POST', {}, memberCookie), 403);

const createdToken = await request(
  '/dashboard/api-tokens',
  json('POST', { name: 'E2E', scopes: ['payments:read'] }, ownerCookie),
  201,
);
await request('/v1/account', {
  headers: { authorization: `Bearer ${createdToken.body.token}` },
});
const rotated = await request(
  `/dashboard/api-tokens/${createdToken.body.id}/rotate`,
  { method: 'POST', headers: { cookie: ownerCookie } },
  201,
);
await request(
  '/v1/account',
  { headers: { authorization: `Bearer ${createdToken.body.token}` } },
  403,
);
await request('/v1/account', {
  headers: { authorization: `Bearer ${rotated.body.token}` },
});

let received;
const server = createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    received = { raw, headers: req.headers };
    res.writeHead(204);
    res.end();
  });
});
await new Promise((resolve) => server.listen(3219, '127.0.0.1', resolve));
const endpoint = await request(
  '/dashboard/webhook-endpoints',
  json(
    'POST',
    { url: 'http://127.0.0.1:3219/events', events: ['alert.test.v2'] },
    ownerCookie,
  ),
  201,
);
await request('/dashboard/alerts/test', json('POST', {}, ownerCookie), 201);
for (let attempt = 0; attempt < 50 && !received; attempt += 1)
  await new Promise((resolve) => setTimeout(resolve, 200));
server.close();
if (!received) throw new Error('Webhook não entregue');
const expectedSignature = createHmac('sha256', endpoint.body.signingSecret)
  .update(`${received.headers['x-streamos-timestamp']}.${received.raw}`)
  .digest('hex');
if (received.headers['x-streamos-signature'] !== `sha256=${expectedSignature}`)
  throw new Error('Assinatura HMAC inválida');
let delivery;
for (let attempt = 0; attempt < 25; attempt += 1) {
  overview = await request('/dashboard/platform', {
    headers: { cookie: ownerCookie },
  });
  delivery = overview.body.webhooks.find((item) => item.id === endpoint.body.id)
    ?.deliveries[0];
  if (delivery?.status === 'DELIVERED') break;
  await new Promise((resolve) => setTimeout(resolve, 200));
}
if (delivery?.status !== 'DELIVERED')
  throw new Error('Histórico de entrega inconsistente');
await request(`/dashboard/team/members/${member.id}`, {
  method: 'DELETE',
  headers: { cookie: ownerCookie },
});
console.log(
  JSON.stringify({
    rbac: true,
    bearerRotation: true,
    webhookHmac: true,
    webhookHistory: true,
    isolation: true,
  }),
);
