import { PrismaClient } from '../../packages/database/dist/index.js';
import { createHash, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();
const originalFetch = globalThis.fetch;

async function createBetaInvite(email) {
  const code = randomBytes(18).toString('base64url');
  await prisma.betaInvite.create({
    data: {
      email: email.trim().toLowerCase(),
      codeHash: createHash('sha256').update(code).digest('hex'),
    },
  });
  return code;
}

globalThis.fetch = async (input, init = {}) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const method = (
    init.method ??
    (typeof input === 'object' && 'method' in input ? input.method : 'GET')
  ).toUpperCase();
  if (
    !url ||
    method !== 'POST' ||
    !new URL(url).pathname.endsWith('/auth/register')
  )
    return originalFetch(input, init);

  const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
  if (!body?.email || body.inviteCode) return originalFetch(input, init);
  const inviteCode = await createBetaInvite(body.email);
  return originalFetch(input, {
    ...init,
    body: JSON.stringify({ ...body, inviteCode }),
  });
};

process.once('beforeExit', () => prisma.$disconnect());
