import { PrismaClient } from '../packages/database/dist/index.js';
import { createHash, randomBytes } from 'node:crypto';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('Uso: node tools/create-beta-invite.mjs email@dominio');
const code = randomBytes(18).toString('base64url');
const prisma = new PrismaClient();
try {
  await prisma.betaInvite.create({
    data: { email, codeHash: createHash('sha256').update(code).digest('hex') },
  });
  console.log(`Convite criado para ${email}: ${code}`);
} finally {
  await prisma.$disconnect();
}
