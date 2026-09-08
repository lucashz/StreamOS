import { describe, expect, it } from 'vitest';
import {
  youtubeIdFromPlayback,
  youtubePlaybackCommands,
} from './overlay-client';

describe('youtube playback metadata', () => {
  it('recovers the video id from a privacy-enhanced embed URL', () => {
    expect(
      youtubeIdFromPlayback(
        'https://www.youtube-nocookie.com/embed/vQdnQ8aoUmQ?autoplay=1',
      ),
    ).toBe('vQdnQ8aoUmQ');
  });

  it('recovers the video id from a regular YouTube URL', () => {
    expect(
      youtubeIdFromPlayback(
        'https://www.youtube.com/watch?v=vQdnQ8aoUmQ&list=RDvQdnQ8aoUmQ',
      ),
    ).toBe('vQdnQ8aoUmQ');
  });

  it('rejects malformed playback values', () => {
    expect(youtubeIdFromPlayback('not-a-url')).toBe('');
    expect(youtubeIdFromPlayback(undefined)).toBe('');
  });

  it('rewinds a restarted song before resuming playback', () => {
    expect(youtubePlaybackCommands(0, 80, false)).toContainEqual({
      func: 'seekTo',
      args: [0, true],
    });
    expect(youtubePlaybackCommands(0, 80, false).at(-1)).toEqual({
      func: 'playVideo',
      args: [],
    });
  });

  it('rewinds while paused without starting audio early', () => {
    const commands = youtubePlaybackCommands(0, 80, true);
    expect(commands).toContainEqual({ func: 'seekTo', args: [0, true] });
    expect(commands.at(-1)).toEqual({ func: 'pauseVideo', args: [] });
  });

  it('restarts VideoPix at the selected beginning', () => {
    expect(youtubePlaybackCommands(42, 100, false)).toContainEqual({
      func: 'seekTo',
      args: [42, true],
    });
  });
});
