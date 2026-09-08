import { describe, expect, it } from 'vitest';
import {
  canOperateLiveQueue,
  canTransitionLiveQueue,
  orderedQueue,
  prioritizedQueue,
  shouldSuppressGenericPaymentAlert,
} from './live-control.policy';

describe('live control policy', () => {
  it.each(['OWNER', 'ADMIN', 'MODERATOR'])(
    'allows operator role %s',
    (role) => {
      expect(canOperateLiveQueue(role)).toBe(true);
    },
  );

  it.each(['FINANCE', 'VIEWER', 'MEMBER', 'SUPPORT'])(
    'keeps %s read-only',
    (role) => {
      expect(canOperateLiveQueue(role)).toBe(false);
    },
  );

  it('accepts valid dispatch and playback transitions', () => {
    expect(canTransitionLiveQueue('QUEUED', 'DISPATCHING')).toBe(true);
    expect(canTransitionLiveQueue('DISPATCHING', 'PLAYING')).toBe(true);
    expect(canTransitionLiveQueue('PLAYING', 'COMPLETED')).toBe(true);
    expect(canTransitionLiveQueue('QUEUED', 'PLAYING')).toBe(true);
    expect(canTransitionLiveQueue('COMPLETED', 'PLAYING')).toBe(true);
  });

  it('rejects financial-history-breaking and invalid transitions', () => {
    expect(canTransitionLiveQueue('COMPLETED', 'DISPATCHING')).toBe(false);
    expect(canTransitionLiveQueue('EXPIRED', 'COMPLETED')).toBe(false);
    expect(canTransitionLiveQueue('FAILED', 'QUEUED')).toBe(true);
  });

  it('uses deterministic position, creation time and id ordering', () => {
    const time = new Date('2026-08-20T12:00:00Z');
    const result = orderedQueue([
      { id: 'b', position: 2, createdAt: time },
      { id: 'c', position: 1, createdAt: new Date(time.getTime() + 1) },
      { id: 'a', position: 1, createdAt: time },
    ]);
    expect(result.map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });

  it('supports value and arrival queue modes', () => {
    const time = new Date('2026-08-20T12:00:00Z');
    const items = [
      {
        id: 'first',
        position: 1,
        createdAt: time,
        kind: 'ALERT',
        amountInCents: 100,
      },
      {
        id: 'valuable',
        position: 2,
        createdAt: new Date(time.getTime() + 1),
        kind: 'VIDEO_PIX',
        amountInCents: 5000,
      },
    ];
    expect(prioritizedQueue(items, 'FIFO').map((item) => item.id)).toEqual([
      'first',
      'valuable',
    ]);
    expect(prioritizedQueue(items, 'VALUE').map((item) => item.id)).toEqual([
      'valuable',
      'first',
    ]);
  });

  it('balances media with textual alerts and avoids media starvation', () => {
    const time = new Date('2026-08-20T12:00:00Z');
    const items = [
      {
        id: 'video-a',
        position: 1,
        createdAt: time,
        kind: 'VIDEO_PIX',
        amountInCents: 10000,
      },
      {
        id: 'video-b',
        position: 2,
        createdAt: new Date(time.getTime() + 1),
        kind: 'VIDEO_PIX',
        amountInCents: 9000,
      },
      {
        id: 'video-c',
        position: 3,
        createdAt: new Date(time.getTime() + 2),
        kind: 'VIDEO_PIX',
        amountInCents: 8000,
      },
      {
        id: 'text',
        position: 4,
        createdAt: new Date(time.getTime() + 3),
        kind: 'ALERT',
        amountInCents: 500,
      },
      {
        id: 'song',
        position: 5,
        createdAt: new Date(time.getTime() + 4),
        kind: 'SONG_PIX',
        amountInCents: 3000,
      },
    ];
    const result = prioritizedQueue(items, 'BALANCED');
    expect(result[0]?.id).toBe('video-a');
    expect(result[1]?.id).toBe('text');
    expect(
      result.slice(0, 3).filter((item) => item.kind === 'VIDEO_PIX'),
    ).toHaveLength(2);
  });

  it('suppresses the generic donate paired with a media request', () => {
    expect(
      shouldSuppressGenericPaymentAlert(
        { intentId: 'media-intent' },
        new Set(['media-intent']),
      ),
    ).toBe(true);
    expect(
      shouldSuppressGenericPaymentAlert(
        { intentId: 'text-intent' },
        new Set(['media-intent']),
      ),
    ).toBe(false);
  });

  it('honors the explicit suppression marker in new payment events', () => {
    expect(
      shouldSuppressGenericPaymentAlert(
        { suppressGenericAlert: true },
        new Set(),
      ),
    ).toBe(true);
  });
});
