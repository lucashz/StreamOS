import { describe, expect, it, vi } from 'vitest';
import {
  isoDurationSeconds,
  MockYouTubeVideoProvider,
  YouTubeVideoProvider,
  youtubeVideoId,
} from './video-provider';

describe('YouTube video provider', () => {
  it.each([
    ['https://youtu.be/abc123xyz01', 'abc123xyz01'],
    ['https://www.youtube.com/watch?v=abc123xyz01', 'abc123xyz01'],
    ['https://youtube.com/shorts/abc123xyz01', 'abc123xyz01'],
    ['https://youtube.com/embed/abc123xyz01', 'abc123xyz01'],
  ])('extracts an id from %s', (url, id) =>
    expect(youtubeVideoId(url)).toBe(id),
  );

  it('rejects lookalike hosts', () => {
    expect(() =>
      youtubeVideoId('https://youtube.com.evil.test/watch?v=abc123xyz01'),
    ).toThrow();
  });

  it('parses ISO 8601 duration', () => {
    expect(isoDurationSeconds('PT1H2M3S')).toBe(3723);
  });

  it('maps official API metadata and caches the result', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [
            {
              snippet: {
                title: 'Vídeo',
                channelId: 'channel-1',
                channelTitle: 'Canal',
                publishedAt: '2025-01-01T00:00:00Z',
                liveBroadcastContent: 'none',
                thumbnails: { high: { url: 'https://image.test/thumb.jpg' } },
              },
              contentDetails: { duration: 'PT3M' },
              status: {
                privacyStatus: 'public',
                embeddable: true,
                madeForKids: false,
              },
              statistics: { viewCount: '12345' },
            },
          ],
        }),
    });
    const provider = new YouTubeVideoProvider(
      'secret',
      fetcher as typeof fetch,
    );
    const first = await provider.metadata('https://youtu.be/abc123xyz01');
    const second = await provider.metadata('https://youtu.be/abc123xyz01');
    expect(first).toMatchObject({
      provider: 'YOUTUBE',
      durationSeconds: 180,
      views: 12345,
      embeddable: true,
    });
    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      'part=snippet%2CcontentDetails%2Cstatus%2Cstatistics',
    );
  });

  it('accepts any public YouTube video in local demonstration mode', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"lengthSeconds":"742"}'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            title: 'Vídeo escolhido pelo apoiador',
            author_name: 'Canal público',
            thumbnail_url: 'https://image.test/video.jpg',
          }),
      });
    const provider = new MockYouTubeVideoProvider(fetcher as typeof fetch);
    const value = await provider.metadata(
      'https://www.youtube.com/watch?v=random12345',
    );
    expect(value).toMatchObject({
      externalId: 'random12345',
      title: 'Vídeo escolhido pelo apoiador',
      durationSeconds: 742,
      embeddable: true,
    });
  });
});
