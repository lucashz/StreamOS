import { Prisma } from '@streamos/database';
import { describe, expect, it } from 'vitest';
import {
  immediatePlaybackTimeoutSeconds,
  shouldExpireQueuedAlert,
} from './live-queue.policy';
import { OutboxWorker } from './outbox.worker';

type MaterializeEvent = {
  id: string;
  organizationId: string | null;
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: Prisma.JsonValue;
};

type MaterializeWorker = {
  materializeLiveQueueItem(event: MaterializeEvent): Promise<void>;
};

function uniqueConstraint(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

function materializationHarness(collisionTarget: string[]) {
  const queueItems = new Map<string, unknown>();
  let sequence = 0n;
  const prisma = {
    paymentIntent: { findUnique: () => null },
    liveQueueItem: {
      aggregate: () => ({ _max: { position: null } }),
      upsert: (args: {
        where: {
          organizationId_sourceType_sourceId: {
            organizationId: string;
            sourceType: string;
            sourceId: string;
          };
        };
        create: unknown;
      }) => {
        const source = args.where.organizationId_sourceType_sourceId;
        const key = `${source.organizationId}:${source.sourceType}:${source.sourceId}`;
        if (queueItems.has(key)) throw uniqueConstraint(collisionTarget);
        queueItems.set(key, args.create);
      },
    },
    liveSession: { findFirst: () => null },
    organization: {
      update: () => ({ nextLiveQueueSequence: ++sequence }),
    },
  };
  const worker = Object.create(OutboxWorker.prototype) as MaterializeWorker & {
    prisma: typeof prisma;
  };
  worker.prisma = prisma;
  return { worker, queueItems };
}

const paidEvent: MaterializeEvent = {
  id: '10000000-0000-4000-8000-000000000001',
  organizationId: '20000000-0000-4000-8000-000000000001',
  eventType: 'payment.confirmed.v1',
  aggregateId: '30000000-0000-4000-8000-000000000001',
  occurredAt: new Date('2026-09-19T12:00:00.000Z'),
  payload: { supporterName: 'Lucas', amountInCents: 1000 },
};

describe('live queue playback policy', () => {
  const now = new Date('2026-09-13T12:00:00.000Z');

  it('expires delayed test alerts', () => {
    expect(
      shouldExpireQueuedAlert(
        'alert.test.v2',
        new Date('2026-09-13T11:58:29.000Z'),
        now,
        90,
      ),
    ).toBe(true);
  });

  it('keeps every paid alert durable while OBS is offline', () => {
    const old = new Date('2026-09-13T10:00:00.000Z');
    expect(shouldExpireQueuedAlert('payment.confirmed.v1', old, now, 90)).toBe(
      false,
    );
    expect(shouldExpireQueuedAlert('tts.queued.v1', old, now, 90)).toBe(false);
    expect(shouldExpireQueuedAlert('song.requested.v1', old, now, 90)).toBe(
      false,
    );
    expect(shouldExpireQueuedAlert('video.requested.v1', old, now, 90)).toBe(
      false,
    );
  });

  it('limits the watchdog for an immediate alert', () => {
    expect(immediatePlaybackTimeoutSeconds(120)).toBe(30);
    expect(immediatePlaybackTimeoutSeconds(15)).toBe(15);
  });
});

describe('live queue materialization concurrency', () => {
  it('keeps one queue item when concurrent materialization collides on its source', async () => {
    const { worker, queueItems } = materializationHarness([
      'organizationId',
      'sourceType',
      'sourceId',
    ]);

    await Promise.all([
      worker.materializeLiveQueueItem(paidEvent),
      worker.materializeLiveQueueItem(paidEvent),
    ]);

    expect(queueItems.size).toBe(1);
  });

  it('rethrows P2002 collisions from another unique constraint', async () => {
    const { worker } = materializationHarness([
      'organizationId',
      'sequenceNumber',
    ]);
    await worker.materializeLiveQueueItem(paidEvent);

    await expect(
      worker.materializeLiveQueueItem(paidEvent),
    ).rejects.toMatchObject({
      code: 'P2002',
      meta: { target: ['organizationId', 'sequenceNumber'] },
    });
  });
});
