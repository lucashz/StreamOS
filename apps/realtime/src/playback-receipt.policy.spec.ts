import { describe, expect, it } from 'vitest';
import { acceptsPlaybackReceipt } from './playback-receipt.policy';

describe('overlay playback receipts', () => {
  it('accepts the ordered lifecycle', () => {
    expect(acceptsPlaybackReceipt(null, 'RECEIVED')).toBe(true);
    expect(acceptsPlaybackReceipt(1, 'MEDIA_READY')).toBe(true);
    expect(acceptsPlaybackReceipt(2, 'STARTED')).toBe(true);
    expect(acceptsPlaybackReceipt(3, 'COMPLETED')).toBe(true);
  });
  it('rejects duplicates and events arriving backwards', () => {
    expect(acceptsPlaybackReceipt(3, 'STARTED')).toBe(false);
    expect(acceptsPlaybackReceipt(3, 'MEDIA_READY')).toBe(false);
    expect(acceptsPlaybackReceipt(4, 'RECEIVED')).toBe(false);
  });
  it('rejects unknown receipt states', () => {
    expect(acceptsPlaybackReceipt(null, 'WHATEVER')).toBe(false);
  });
});
