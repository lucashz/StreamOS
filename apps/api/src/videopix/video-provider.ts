export type VideoMetadata = {
  provider: 'MOCK_YOUTUBE' | 'YOUTUBE';
  externalId: string;
  url: string;
  title: string;
  channelId: string;
  channelTitle: string;
  durationSeconds: number;
  views: number;
  publishedAt: Date;
  thumbnailUrl: string;
  embeddable: boolean;
  madeForKids: boolean;
  broadcastType: 'NONE' | 'LIVE' | 'UPCOMING';
  availability: 'PUBLIC' | 'PRIVATE' | 'REMOVED';
};
export interface VideoProvider {
  metadata(url: string): Promise<VideoMetadata>;
}

export function youtubeVideoId(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('URL de vídeo inválida');
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  let id: string | null = null;
  if (host === 'youtu.be')
    id = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    id = parsed.searchParams.get('v');
    if (!id) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0] ?? ''))
        id = parts[1] ?? null;
    }
  }
  if (!id || !/^[\w-]{6,20}$/.test(id))
    throw new Error('URL ou ID do YouTube inválido');
  return id;
}
export function isoDurationSeconds(value: string): number {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) throw new Error('Duração de vídeo inválida');
  return (
    Number(match[1] ?? 0) * 86400 +
    Number(match[2] ?? 0) * 3600 +
    Number(match[3] ?? 0) * 60 +
    Number(match[4] ?? 0)
  );
}

type YouTubeItem = {
  snippet?: {
    title?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
    thumbnails?: { high?: { url?: string }; default?: { url?: string } };
  };
  contentDetails?: { duration?: string };
  status?: {
    privacyStatus?: string;
    embeddable?: boolean;
    madeForKids?: boolean;
  };
  statistics?: { viewCount?: string };
};
export class YouTubeVideoProvider implements VideoProvider {
  private readonly cache = new Map<
    string,
    { expiresAt: number; value: VideoMetadata }
  >();
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  async metadata(url: string): Promise<VideoMetadata> {
    const externalId = youtubeVideoId(url);
    const cached = this.cache.get(externalId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const endpoint = new URL('https://www.googleapis.com/youtube/v3/videos');
    endpoint.searchParams.set(
      'part',
      'snippet,contentDetails,status,statistics',
    );
    endpoint.searchParams.set('id', externalId);
    endpoint.searchParams.set('key', this.apiKey);
    const response = await this.fetcher(endpoint, {
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? 'YouTube indisponível ou quota excedida'
          : 'Falha ao consultar o YouTube',
      );
    const item = ((await response.json()) as { items?: YouTubeItem[] })
      .items?.[0];
    if (!item) throw new Error('Vídeo removido ou indisponível');
    const privacy = String(item.status?.privacyStatus ?? 'private');
    const broadcast = String(item.snippet?.liveBroadcastContent ?? 'none');
    const value: VideoMetadata = {
      provider: 'YOUTUBE',
      externalId,
      url: `https://www.youtube.com/watch?v=${externalId}`,
      title: String(item.snippet?.title ?? '').slice(0, 300),
      channelId: String(item.snippet?.channelId ?? ''),
      channelTitle: String(item.snippet?.channelTitle ?? '').slice(0, 200),
      durationSeconds: isoDurationSeconds(
        String(item.contentDetails?.duration ?? ''),
      ),
      views: Math.min(Number(item.statistics?.viewCount ?? 0), 2_147_483_647),
      publishedAt: new Date(String(item.snippet?.publishedAt)),
      thumbnailUrl: String(
        item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.default?.url ??
          '',
      ),
      embeddable: item.status?.embeddable === true,
      madeForKids: item.status?.madeForKids === true,
      broadcastType:
        broadcast === 'live'
          ? 'LIVE'
          : broadcast === 'upcoming'
            ? 'UPCOMING'
            : 'NONE',
      availability: privacy === 'public' ? 'PUBLIC' : 'PRIVATE',
    };
    if (
      !value.title ||
      !value.channelId ||
      Number.isNaN(value.publishedAt.valueOf())
    )
      throw new Error('Metadados incompletos do YouTube');
    this.cache.set(externalId, { expiresAt: Date.now() + 5 * 60_000, value });
    return value;
  }
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
export class MockYouTubeVideoProvider implements VideoProvider {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async metadata(url: string): Promise<VideoMetadata> {
    const externalId = youtubeVideoId(url);
    const variants: Record<string, Partial<VideoMetadata>> = {
      private: { availability: 'PRIVATE', embeddable: false },
      removed: { availability: 'REMOVED', embeddable: false },
      noembed: { embeddable: false },
      longvideo: { durationSeconds: 1200 },
      lowviews: { views: 25 },
      newvideo: { publishedAt: daysAgo(1) },
      kidsvideo: { madeForKids: true },
      livevideo: { broadcastType: 'LIVE' },
      VreW7bn450g: {
        title: 'Levei o Vinícius Jr. para andar de Lamborghini',
        channelTitle: 'Gui Avantgarde',
        durationSeconds: 826,
        views: 1_000_000,
        publishedAt: daysAgo(120),
      },
    };
    const known = ['video-ok', ...Object.keys(variants)].includes(externalId);
    let liveMetadata: Partial<VideoMetadata> = {};
    if (!known) {
      const canonicalUrl = `https://www.youtube.com/watch?v=${externalId}`;
      const [watchResponse, embedResponse] = await Promise.all([
        this.fetcher(canonicalUrl, { signal: AbortSignal.timeout(8000) }),
        this.fetcher(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
          { signal: AbortSignal.timeout(8000) },
        ),
      ]);
      if (!watchResponse.ok || !embedResponse.ok)
        throw new Error('Vídeo público não encontrado no YouTube');
      const watchPage = await watchResponse.text();
      const embed = (await embedResponse.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      const duration = Number(
        /"lengthSeconds":"(\d+)"/.exec(watchPage)?.[1] ?? 0,
      );
      if (!duration)
        throw new Error(
          'Não foi possível identificar a duração deste vídeo. Lives não são aceitas.',
        );
      liveMetadata = {
        title: String(embed.title ?? 'Vídeo do YouTube').slice(0, 300),
        channelTitle: String(embed.author_name ?? 'Canal do YouTube').slice(
          0,
          200,
        ),
        durationSeconds: duration,
        thumbnailUrl: String(
          embed.thumbnail_url ??
            `https://img.youtube.com/vi/${externalId}/hqdefault.jpg`,
        ),
      };
    }
    return {
      provider: 'MOCK_YOUTUBE',
      externalId,
      url: `https://www.youtube.com/watch?v=${externalId}`,
      title: 'Melhores momentos da comunidade',
      channelId: 'mock-channel',
      channelTitle: 'Canal Verificado',
      durationSeconds: 180,
      views: 250000,
      publishedAt: daysAgo(120),
      thumbnailUrl: `https://img.youtube.com/vi/${externalId}/hqdefault.jpg`,
      embeddable: true,
      madeForKids: false,
      broadcastType: 'NONE',
      availability: 'PUBLIC',
      ...variants[externalId],
      ...liveMetadata,
    };
  }
}
export function createVideoProvider(): VideoProvider {
  const kind = (
    process.env.VIDEO_PROVIDER ??
    (process.env.NODE_ENV === 'production' ? 'youtube' : 'mock')
  ).toLowerCase();
  if (kind === 'mock') return new MockYouTubeVideoProvider();
  if (kind !== 'youtube')
    throw new Error(`VIDEO_PROVIDER não suportado: ${kind}`);
  if (!process.env.YOUTUBE_API_KEY)
    throw new Error(
      'YOUTUBE_API_KEY é obrigatória para VIDEO_PROVIDER=youtube',
    );
  return new YouTubeVideoProvider(process.env.YOUTUBE_API_KEY);
}
