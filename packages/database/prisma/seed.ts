import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Luna Plays',
      creatorProfile: {
        create: {
          displayName: 'Luna Plays',
          slug: 'luna',
          bio: 'Perfil de demonstração local do StreamOS.',
        },
      },
      complianceProfile: {
        create: { status: 'SANDBOX_APPROVED' },
      },
      alertConfig: {
        create: {
          minimumInCents: 500,
          theme: { accent: '#a98cff', template: 'neon-pulse' },
        },
      },
      goals: {
        create: {
          title: 'Setup novo',
          targetInCents: 100_000,
        },
      },
    },
  });

  const supportPassword =
    process.env.SEED_SUPPORT_PASSWORD ?? 'StreamOS-Support-Local-123!';
  const salt = randomBytes(16);
  const passwordHash = `${salt.toString('hex')}:${scryptSync(supportPassword, salt, 64).toString('hex')}`;
  await prisma.user.upsert({
    where: { email: 'support@streamos.local' },
    update: {},
    create: {
      email: 'support@streamos.local',
      passwordHash,
      memberships: {
        create: { organizationId: organization.id, role: 'SUPPORT' },
      },
    },
  });

  console.log(`Seeded organization ${organization.id}`);
  console.log('Seeded local support user support@streamos.local');
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
