import { MOCK_SONGS, type CatalogSong } from './song-catalog';

export interface SongCatalogProvider {
  readonly name: string;
  search(query: string): Promise<CatalogSong[]>;
  metadata(id: string): Promise<CatalogSong>;
}

const externalMetadataCache = new Map<
  string,
  { expiresAt: number; value: CatalogSong }
>();

const GENRE_MARKERS: Array<[genre: string, markers: string[]]> = [
  [
    'Sertanejo',
    [
      'sertanejo',
      'ana castela',
      'jorge & mateus',
      'jorge e mateus',
      'henrique & juliano',
      'henrique e juliano',
      'gusttavo lima',
      'maiara & maraisa',
      'maiara e maraisa',
      'marília mendonça',
      'ze neto e cristiano',
      'zé neto & cristiano',
      'luan santana',
      'lauana prado',
      'murilo huff',
      'simone mendes',
      'bruno & marrone',
      'bruno e marrone',
      'matheus & kauan',
      'matheus e kauan',
      'guilherme & benuto',
      'guilherme e benuto',
      'chitãozinho',
      'zeze di camargo',
      'zé ramalho',
    ],
  ],
  [
    'Rock',
    [
      'rock',
      'metallica',
      'iron maiden',
      'guns n roses',
      "guns n' roses",
      'ac/dc',
      'linkin park',
      'nirvana',
      'foo fighters',
      'system of a down',
      'slipknot',
      'black sabbath',
    ],
  ],
  ['Funk', ['funk', 'mc ', 'mandelão', 'mandelao']],
  ['Pagode', ['pagode', 'menos é mais', 'menos e mais', 'grupo revelação']],
  ['Samba', ['samba', 'zeca pagodinho', 'alcione']],
  ['Gospel', ['gospel', 'adoração', 'adoracao', 'louvor']],
  ['Eletrônica', ['eletrônica', 'eletronica', 'edm', 'techno', 'house music']],
  ['Rap', ['rap', 'hip hop', 'trap']],
];

export function inferYouTubeGenre(title: string, artist: string) {
  const searchable = `${title} ${artist}`.toLocaleLowerCase('pt-BR');
  return (
    GENRE_MARKERS.find(([, markers]) =>
      markers.some((marker) => searchable.includes(marker)),
    )?.[0] ?? 'Não identificado'
  );
}

function externalLink(value: string) {
  if (value.startsWith('youtube:')) {
    const id = value.slice('youtube:'.length);
    if (/^[\w-]{6,20}$/.test(id))
      return {
        kind: 'YOUTUBE' as const,
        url: new URL(`https://www.youtube.com/watch?v=${id}`),
      };
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host))
      return { kind: 'YOUTUBE' as const, url };
    if (host === 'open.spotify.com') return { kind: 'SPOTIFY' as const, url };
  } catch {
    // A busca comum do catálogo tratará valores que não são URLs válidas.
  }
  return null;
}

async function externalMetadata(value: string): Promise<CatalogSong | null> {
  const directCached = externalMetadataCache.get(value);
  if (directCached && directCached.expiresAt > Date.now())
    return directCached.value;
  const source = externalLink(value);
  if (!source) return null;
  const cacheKey = source.url.toString();
  const cached = externalMetadataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (source.kind === 'YOUTUBE') {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(source.url.toString())}&format=json`,
      { signal: AbortSignal.timeout(4_000) },
    );
    if (!response.ok) throw new Error('Vídeo do YouTube indisponível');
    const body = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    const id = source.url.hostname.includes('youtu.be')
      ? source.url.pathname.split('/').filter(Boolean)[0]
      : source.url.searchParams.get('v');
    if (!id || !/^[\w-]{6,20}$/.test(id))
      throw new Error('Link do YouTube inválido');
    const song: CatalogSong = {
      id: `youtube:${id}`,
      title: body.title ?? 'Música do YouTube',
      artist: body.author_name ?? 'YouTube',
      genre: inferYouTubeGenre(
        body.title ?? 'Música do YouTube',
        body.author_name ?? 'YouTube',
      ),
      durationSeconds: 300,
      provider: 'YOUTUBE',
      artworkUrl: body.thumbnail_url,
      playbackUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=0`,
      available: true,
      restrictions: { playback: 'DIRECT_STREAM', attribution: 'YouTube' },
    };
    externalMetadataCache.set(cacheKey, {
      expiresAt: Date.now() + 5 * 60_000,
      value: song,
    });
    externalMetadataCache.set(song.id, {
      expiresAt: Date.now() + 5 * 60_000,
      value: song,
    });
    return song;
  }
  const parts = source.url.pathname.split('/').filter(Boolean);
  const type = parts[0];
  const id = parts[1];
  if (!id || !['track', 'episode'].includes(type ?? ''))
    throw new Error('Use um link de faixa ou episódio do Spotify');
  const response = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(source.url.toString())}`,
    { signal: AbortSignal.timeout(6_000) },
  );
  if (!response.ok) throw new Error('Conteúdo do Spotify indisponível');
  const body = (await response.json()) as {
    title?: string;
    thumbnail_url?: string;
  };
  const song: CatalogSong = {
    id: `spotify:${type}:${id}`,
    title: body.title ?? 'Música do Spotify',
    artist: 'Spotify',
    genre: 'Link externo',
    durationSeconds: 300,
    provider: 'SPOTIFY',
    artworkUrl: body.thumbnail_url,
    playbackUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&autoplay=1`,
    available: true,
    restrictions: { playback: 'DIRECT_STREAM', attribution: 'Spotify' },
  };
  externalMetadataCache.set(cacheKey, {
    expiresAt: Date.now() + 5 * 60_000,
    value: song,
  });
  externalMetadataCache.set(song.id, {
    expiresAt: Date.now() + 5 * 60_000,
    value: song,
  });
  return song;
}

export class MockSongCatalogProvider implements SongCatalogProvider {
  readonly name = 'MOCK';
  search(query: string) {
    const normalized = query.trim().toLowerCase();
    return Promise.resolve(
      MOCK_SONGS.filter(
        (song) =>
          !normalized ||
          `${song.title} ${song.artist} ${song.genre}`
            .toLowerCase()
            .includes(normalized),
      ).map((song) => this.normalize(song)),
    );
  }
  metadata(id: string) {
    if (externalLink(id)) return externalMetadata(id) as Promise<CatalogSong>;
    const song = MOCK_SONGS.find((item) => item.id === id);
    if (!song) return Promise.reject(new Error('Música não encontrada'));
    return Promise.resolve(this.normalize(song));
  }
  private normalize(song: CatalogSong): CatalogSong {
    return {
      ...song,
      provider: this.name,
      available: true,
      restrictions: { playback: 'METADATA_ONLY' },
    };
  }
}

type RemoteSong = {
  id?: string;
  title?: string;
  artist?: string;
  genre?: string;
  durationSeconds?: number;
  artworkUrl?: string | null;
  playbackUrl?: string | null;
  available?: boolean;
  restrictions?: CatalogSong['restrictions'];
};

export class HttpSongCatalogProvider implements SongCatalogProvider {
  readonly name = 'REMOTE';
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  search(query: string) {
    const url = new URL('/v1/tracks/search', this.baseUrl);
    url.searchParams.set('q', query.trim());
    url.searchParams.set('limit', '30');
    return this.fetchSongs(url);
  }
  async metadata(id: string) {
    const external = await externalMetadata(id);
    if (external) return external;
    const response = await this.fetcher(
      new URL(`/v1/tracks/${encodeURIComponent(id)}`, this.baseUrl),
      { headers: this.headers(), signal: AbortSignal.timeout(6000) },
    );
    if (response.status === 404) throw new Error('Música não encontrada');
    if (!response.ok) throw new Error('Catálogo musical indisponível');
    return this.normalize((await response.json()) as RemoteSong);
  }
  private async fetchSongs(url: URL) {
    const response = await this.fetcher(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error('Catálogo musical indisponível');
    const body = (await response.json()) as { tracks?: RemoteSong[] };
    return (body.tracks ?? []).map((song) => this.normalize(song));
  }
  private normalize(song: RemoteSong): CatalogSong {
    const value: CatalogSong = {
      id: String(song.id ?? ''),
      title: String(song.title ?? '').slice(0, 300),
      artist: String(song.artist ?? '').slice(0, 200),
      genre: String(song.genre ?? '').slice(0, 100),
      durationSeconds: Number(song.durationSeconds ?? 0),
      provider: this.name,
      artworkUrl: song.artworkUrl ?? null,
      playbackUrl: song.playbackUrl ?? null,
      available: song.available !== false,
      restrictions: song.restrictions ?? { playback: 'METADATA_ONLY' },
    };
    if (
      !value.id ||
      !value.title ||
      !value.artist ||
      value.durationSeconds <= 0
    )
      throw new Error('Metadados musicais incompletos');
    if (value.playbackUrl) {
      const playback = new URL(value.playbackUrl);
      if (!['https:', 'http:'].includes(playback.protocol))
        throw new Error('URL de reprodução inválida');
    }
    return value;
  }
  private headers() {
    return {
      authorization: `Bearer ${this.apiKey}`,
      accept: 'application/json',
    };
  }
}

export function createSongCatalogProvider(): SongCatalogProvider {
  const kind = (process.env.SONG_CATALOG_PROVIDER ?? 'mock').toLowerCase();
  if (kind === 'mock') return new MockSongCatalogProvider();
  if (kind !== 'http')
    throw new Error(`SONG_CATALOG_PROVIDER não suportado: ${kind}`);
  if (!process.env.SONG_CATALOG_BASE_URL || !process.env.SONG_CATALOG_API_KEY)
    throw new Error(
      'SONG_CATALOG_BASE_URL e SONG_CATALOG_API_KEY são obrigatórias',
    );
  const url = new URL(process.env.SONG_CATALOG_BASE_URL);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    throw new Error('SONG_CATALOG_BASE_URL deve usar HTTPS em produção');
  return new HttpSongCatalogProvider(
    url.toString(),
    process.env.SONG_CATALOG_API_KEY,
  );
}
