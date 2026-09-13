import { describe, expect, it } from 'vitest';
import {
  immediatePlaybackTimeoutSeconds,
  shouldExpireQueuedAlert,
} from './live-queue.policy';

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
