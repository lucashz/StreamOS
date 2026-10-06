import { PrismaClient } from '../packages/database/dist/index.js';
import { createHash, randomBytes } from 'node:crypto';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@'))
  throw new Error('Uso: node tools/create-beta-invite.mjs email@dominio');
const code = randomBytes(18).toString('base64url');
const prisma = new PrismaClient();
await prisma.betaInvite.create({
  data: { email, codeHash: createHash('sha256').update(code).digest('hex') },
});
await prisma.$disconnect();
console.log(code);
