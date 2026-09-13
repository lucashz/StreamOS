import { describe, expect, it } from 'vitest';
import {
  immediatePlaybackTimeoutSeconds,
  shouldExpireQueuedAlert,
} from './live-queue.policy';

describe('live queue playback policy', () => {
  const now = new Date('2026-09-13T12:00:00.000Z');

  it('expires delayed immediate alerts', () => {
    expect(
      shouldExpireQueuedAlert(
        'ALERT',
        new Date('2026-09-13T11:58:29.000Z'),
        now,
        90,
      ),
    ).toBe(true);
  });

  it('keeps SongPix and VideoPix durable while OBS is offline', () => {
    const old = new Date('2026-09-13T10:00:00.000Z');
    expect(shouldExpireQueuedAlert('SONG_PIX', old, now, 90)).toBe(false);
    expect(shouldExpireQueuedAlert('VIDEO_PIX', old, now, 90)).toBe(false);
  });

  it('limits the watchdog for an immediate alert', () => {
    expect(immediatePlaybackTimeoutSeconds(120)).toBe(30);
    expect(immediatePlaybackTimeoutSeconds(15)).toBe(15);
  });
});
