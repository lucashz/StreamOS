import { PrismaClient } from '../packages/database/dist/index.js';

const prisma = new PrismaClient();

function invariant(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, encontrado ${actual}`);
  }
}

async function eventually(read, predicate, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let value;
  do {
    value = await read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  throw new Error(`${label}: estado esperado não foi persistido em ${timeoutMs}ms`);
}

export async function assertPaymentInvariants({
  paymentId,
  organizationId,
  expectedQueueKind,
  expectedQueueSource,
  expectedPostingCount = 4,
}) {
  const payments = await prisma.payment.findMany({
    where: { id: paymentId, organizationId },
    select: { id: true, paymentIntentId: true },
  });
  invariant(payments.length, 1, 'Payment do fluxo');

  const entries = await prisma.journalEntry.findMany({
    where: {
      organizationId,
      type: 'payment_confirmed',
      referenceId: paymentId,
    },
    include: { postings: true },
  });
  invariant(entries.length, 1, 'JournalEntry payment_confirmed');
  invariant(
    entries[0].postings.length,
    expectedPostingCount,
    'Postings da confirmação',
  );

  const queueWhere = {
    organizationId,
    kind: expectedQueueKind,
    ...(expectedQueueSource
      ? {
          sourceType: expectedQueueSource.sourceType,
          sourceId: expectedQueueSource.sourceId,
        }
      : { paymentId }),
  };
  const queueCount = await eventually(
    () => prisma.liveQueueItem.count({ where: queueWhere }),
    (count) => count === 1,
    `LiveQueueItem ${expectedQueueKind}`,
  );
  invariant(queueCount, 1, `LiveQueueItem ${expectedQueueKind}`);

  return {
    paymentId,
    paymentIntentId: payments[0].paymentIntentId,
    journalEntryId: entries[0].id,
    postingCount: entries[0].postings.length,
    queueItemCount: queueCount,
  };
}

export async function assertSubscriptionInvariants({
  subscriptionId,
  organizationId,
  renewalIdempotencyKey,
}) {
  const [subscriptionCount, renewalCount, renewalEvents] = await Promise.all([
    prisma.creatorSubscription.count({
      where: { id: subscriptionId, organizationId },
    }),
    prisma.subscriptionRenewal.count({
      where: { subscriptionId, idempotencyKey: renewalIdempotencyKey },
    }),
    prisma.outboxEvent.count({
      where: {
        organizationId,
        aggregateId: subscriptionId,
        eventType: 'subscription.renewed.v1',
      },
    }),
  ]);
  invariant(subscriptionCount, 1, 'CreatorSubscription');
  invariant(renewalCount, 1, 'SubscriptionRenewal idempotente');
  invariant(renewalEvents, 1, 'Outbox da renovação idempotente');

  const queueCount = await eventually(
    () =>
      prisma.liveQueueItem.count({
        where: {
          organizationId,
          sourceType: 'subscription.created.v1',
          sourceId: subscriptionId,
          kind: 'SUBSCRIPTION',
        },
      }),
    (count) => count === 1,
    'LiveQueueItem da assinatura inicial',
  );
  invariant(queueCount, 1, 'LiveQueueItem da assinatura inicial');

  return {
    subscriptionId,
    renewalCount,
    renewalOutboxCount: renewalEvents,
    queueItemCount: queueCount,
    financiallyLedgerBacked: false,
  };
}

export async function closeInvariantDatabase() {
  await prisma.$disconnect();
}
