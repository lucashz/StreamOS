import { describe, expect, it, vi } from 'vitest';
import {
  HttpSongCatalogProvider,
  inferYouTubeGenre,
  MockSongCatalogProvider,
} from './song-provider';

describe('Song catalog providers', () => {
  it('searches and resolves the local catalog', async () => {
    const provider = new MockSongCatalogProvider();
    const songs = await provider.search('sertanejo');
    expect(songs.length).toBeGreaterThan(0);
    expect((await provider.metadata(songs[0]!.id)).provider).toBe('MOCK');
  });

  it('accepts a shared YouTube link with playlist parameters', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: 'Música de teste',
          author_name: 'Canal oficial',
          thumbnail_url: 'https://i.ytimg.com/vi/vQdnQ8aoUmQ/hqdefault.jpg',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const song = await new MockSongCatalogProvider().metadata(
        'https://youtu.be/vQdnQ8aoUmQ?list=RDvQdnQ8aoUmQ',
      );
      expect(song).toMatchObject({
        id: 'youtube:vQdnQ8aoUmQ',
        provider: 'YOUTUBE',
        title: 'Música de teste',
      });
      await expect(
        new MockSongCatalogProvider().metadata(song.id),
      ).resolves.toMatchObject({ id: 'youtube:vQdnQ8aoUmQ' });
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('identifies obvious YouTube genres before themed checkout', () => {
    expect(
      inferYouTubeGenre('Metallica: One (Official Music Video)', 'Metallica'),
    ).toBe('Rock');
    expect(inferYouTubeGenre('Hoje tem rodeio', 'Ana Castela')).toBe(
      'Sertanejo',
    );
    expect(inferYouTubeGenre('Faixa desconhecida', 'Canal oficial')).toBe(
      'Não identificado',
    );
  });

  it('normalizes a licensed remote catalog response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          tracks: [
            {
              id: 'licensed-1',
              title: 'Faixa licenciada',
              artist: 'Artista',
              genre: 'Pop',
              durationSeconds: 180,
              playbackUrl: 'https://media.example.test/track.mp3',
              restrictions: { playback: 'DIRECT_STREAM' },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const provider = new HttpSongCatalogProvider(
      'https://catalog.example.test',
      'secret',
      fetcher,
    );
    const songs = await provider.search('faixa');
    expect(songs[0]).toMatchObject({
      provider: 'REMOTE',
      available: true,
      playbackUrl: 'https://media.example.test/track.mp3',
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects incomplete remote metadata', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ tracks: [{}] })));
    const provider = new HttpSongCatalogProvider(
      'https://catalog.example.test',
      'secret',
      fetcher,
    );
    await expect(provider.search('broken')).rejects.toThrow(
      'Metadados musicais incompletos',
    );
  });
});
