'use client';

import QRCode from 'qrcode';
import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { io, type Socket } from 'socket.io-client';

type StreamEvent = {
  eventId: string;
  eventType: string;
  payload: Record<string, string | number | boolean | null | undefined>;
  presentation?: {
    widgetType?: string;
    config?: Record<string, unknown>;
    durationMs?: number;
    theme?: { accent?: string };
    variation?: AlertVariation;
  };
};

type PersistedPlaybackStatus = 'RECEIVED' | 'STARTED' | 'COMPLETED' | 'FAILED';
const playbackStorageKey = (attemptId: string) =>
  `streamos:playback-attempt:${attemptId}`;

function persistedPlaybackStatus(event: StreamEvent) {
  const attemptId = event.payload.playbackAttemptId;
  if (typeof window === 'undefined' || typeof attemptId !== 'string')
    return null;
  return window.localStorage.getItem(
    playbackStorageKey(attemptId),
  ) as PersistedPlaybackStatus | null;
}

function persistPlaybackStatus(
  event: StreamEvent,
  status: PersistedPlaybackStatus,
) {
  const attemptId = event.payload.playbackAttemptId;
  if (typeof window === 'undefined' || typeof attemptId !== 'string') return;
  window.localStorage.setItem(playbackStorageKey(attemptId), status);
}

function knownPlaybackAttempts() {
  if (typeof window === 'undefined') return [];
  const attempts: Array<{
    playbackAttemptId: string;
    status: PersistedPlaybackStatus;
  }> = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith('streamos:playback-attempt:')) continue;
    const status = window.localStorage.getItem(key) as PersistedPlaybackStatus;
    attempts.push({
      playbackAttemptId: key.slice('streamos:playback-attempt:'.length),
      status,
    });
  }
  return attempts.slice(-100);
}
type MediaAsset = {
  id: string;
  kind: 'IMAGE' | 'GIF' | 'VIDEO' | 'AUDIO';
  url: string;
  mimeType: string;
};
type AlertVariation = {
  id: string;
  name: string;
  template: string;
  accent: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  layout?: Record<string, unknown>;
  minimumDurationMs: number;
  maximumDurationMs: number;
  soundVolume: number;
  ttsEnabled: boolean;
  ttsVoice: string;
  ttsRate: number;
  ttsVolume: number;
  showSupporter: boolean;
  showAmount: boolean;
  showMessage: boolean;
  visualAsset?: MediaAsset | null;
  soundAsset?: MediaAsset | null;
};
type WidgetConfig = {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  initialData: unknown;
  widgets?: WidgetConfig[];
};
type Contribution = { name: string | null; amountInCents: number };
type Goal = { title: string; currentInCents: number; targetInCents: number };
type Song = {
  id?: string;
  requestId?: string;
  title: string;
  artist: string;
  supporterName?: string;
  status?: string;
  isTest?: boolean;
  provider?: string;
  artworkUrl?: string;
  playbackUrl?: string;
  externalId?: string;
  volume?: number;
};
type SongState = {
  sessionName?: string;
  theme?: string;
  current: Song | null;
  queue: Song[];
};
type Video = {
  id?: string;
  requestId?: string;
  title: string;
  channelTitle: string;
  externalId: string;
  startAtSeconds: number;
  selectedSeconds: number;
  supporterName?: string;
  status?: string;
  provider?: string;
  isTest?: boolean;
};

export function youtubePlaybackCommands(
  startAtSeconds: number,
  volume: number,
  paused: boolean,
) {
  return [
    { func: 'addEventListener', args: ['onStateChange'] },
    { func: 'addEventListener', args: ['onError'] },
    { func: 'setVolume', args: [volume] },
    {
      func: 'seekTo',
      args: [
        Math.max(0, Number.isFinite(startAtSeconds) ? startAtSeconds : 0),
        true,
      ],
    },
    { func: paused ? 'pauseVideo' : 'playVideo', args: [] },
  ];
}

function normalizedVoiceName(voice: SpeechSynthesisVoice) {
  return `${voice.name} ${voice.voiceURI}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function configuredVoice(preference: string) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const exact = voices.find(
    (voice) =>
      voice.name === preference ||
      voice.voiceURI === preference ||
      normalizedVoiceName(voice) === preference.toLowerCase(),
  );
  if (exact) return exact;
  const portuguese = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith('pt'),
  );
  const candidates = [
    ...portuguese,
    ...voices.filter((voice) => !portuguese.includes(voice)),
  ];
  const profileIndex: Record<string, number> = {
    'ai-popular-orator': 1,
    'ai-commander': 2,
    'pt-BR-default': 0,
    'character-narrator': 1,
    'character-deep': 2,
    'character-cheerful': 3,
    'character-robot': 4,
  };
  if (preference in profileIndex) {
    const wanted = profileIndex[preference] ?? 0;
    return candidates[wanted % candidates.length];
  }
  const markers = preference.endsWith('-male')
    ? ['antonio', 'daniel', 'ricardo', 'felipe', 'male', 'mascul']
    : preference.endsWith('-female')
      ? ['francisca', 'maria', 'vitoria', 'luciana', 'female', 'femin']
      : [];
  return (
    candidates.find((voice) =>
      markers.some((marker) => normalizedVoiceName(voice).includes(marker)),
    ) ??
    candidates.find((voice) => voice.default) ??
    candidates[0]
  );
}

function speakWithConfiguredVoice(
  speech: SpeechSynthesisUtterance,
  preference: string,
) {
  const synthesis = window.speechSynthesis;
  let spoken = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  const speak = () => {
    if (spoken) return;
    spoken = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    synthesis.removeEventListener('voiceschanged', speak);
    const voice = configuredVoice(preference);
    if (voice) {
      speech.voice = voice;
      speech.lang = voice.lang;
    } else {
      speech.lang = 'pt-BR';
    }
    synthesis.speak(speech);
  };
  if (synthesis.getVoices().length) speak();
  else {
    synthesis.addEventListener('voiceschanged', speak, { once: true });
    fallbackTimer = setTimeout(speak, 500);
  }
}
type VideoState = {
  sessionName?: string;
  current: Video | null;
  queue: Video[];
};

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export function youtubeIdFromPlayback(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    const embed = url.pathname.match(/\/embed\/([\w-]{6,20})/);
    return embed?.[1] ?? url.searchParams.get('v') ?? '';
  } catch {
    return '';
  }
}

export function OverlayClient() {
  const [connected, setConnected] = useState(false);
  const [debug, setDebug] = useState(false);
  const [widget, setWidget] = useState<WidgetConfig>();
  const [current, setCurrent] = useState<StreamEvent | null>(null);
  const [queue, setQueue] = useState<StreamEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [masterVolume, setMasterVolume] = useState(100);
  const [error, setError] = useState<string>();
  const [qr, setQr] = useState('');
  const [goal, setGoal] = useState<Goal>();
  const [items, setItems] = useState<Contribution[]>([]);
  const [songs, setSongs] = useState<SongState>({ current: null, queue: [] });
  const [songIntroVisible, setSongIntroVisible] = useState(false);
  const [videos, setVideos] = useState<VideoState>({
    current: null,
    queue: [],
  });
  const [mediaFailed, setMediaFailed] = useState(false);
  const seen = useRef(new Set<string>());
  const finishedPlayback = useRef(new Set<string>());
  const playbackTiming = useRef<{
    eventId: string;
    remainingMs: number;
    startedAt: number;
  } | null>(null);
  const lastShown = useRef<StreamEvent | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const youtubePlayerRef = useRef<HTMLIFrameElement | null>(null);
  const directAudioRef = useRef<HTMLAudioElement | null>(null);
  const directAudioPosition = useRef<{
    eventId: string;
    seconds: number;
  } | null>(null);
  const masterVolumeRef = useRef(100);
  const widgetsRef = useRef<WidgetConfig[]>([]);
  const defaultWidgetRef = useRef<WidgetConfig | undefined>(undefined);
  const compositeRef = useRef(false);

  function sendYoutubeCommand(func: string, args: unknown[] = []) {
    youtubePlayerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      'https://www.youtube-nocookie.com',
    );
  }

  function synchronizeYoutubePlayer() {
    const playbackStartSeconds =
      current?.eventType === 'video.started.v1'
        ? Math.max(0, Number(current.payload.startAtSeconds ?? 0))
        : 0;
    const mediaVolume =
      current?.eventType === 'song.started.v1'
        ? Number(current.payload.volume ?? 100)
        : 100;
    const effectiveVolume = Math.round(
      (masterVolume * Math.max(0, Math.min(100, mediaVolume))) / 100,
    );
    if (current)
      socketRef.current?.emit('streamos:playback', {
        eventId: current.eventId,
        status: 'MEDIA_READY',
      });
    const synchronize = () => {
      for (const command of youtubePlaybackCommands(
        playbackStartSeconds,
        effectiveVolume,
        paused,
      ))
        sendYoutubeCommand(command.func, command.args);
    };
    synchronize();
    window.setTimeout(() => {
      synchronize();
    }, 350);
  }

  useEffect(() => {
    const token =
      new URLSearchParams(window.location.search).get('token') ?? '';
    setDebug(new URLSearchParams(window.location.search).get('debug') === '1');
    void fetch(
      `${api}/public/widgets/config?token=${encodeURIComponent(token)}`,
    )
      .then(async (response) => {
        if (!response.ok) return;
        const value = (await response.json()) as WidgetConfig;
        const available = value.widgets ?? [value];
        compositeRef.current = value.type === 'COMPOSITE';
        widgetsRef.current = available;
        const initialWidget = value.type === 'COMPOSITE' ? undefined : value;
        setWidget(initialWidget);
        defaultWidgetRef.current = initialWidget;
        if (!initialWidget) return;
        if (
          ['GOAL', 'CAMPAIGN'].includes(initialWidget.type) &&
          initialWidget.initialData
        )
          setGoal(initialWidget.initialData as Goal);
        if (
          [
            'RECENT_CONTRIBUTIONS',
            'RANKING',
            'SUBSCRIPTION',
            'SUPPORTERS_PANEL',
          ].includes(initialWidget.type)
        )
          setItems(initialWidget.initialData as Contribution[]);
        if (initialWidget.type === 'QR_CODE') {
          const publicUrl = (
            initialWidget.initialData as { publicUrl?: string } | null
          )?.publicUrl;
          if (publicUrl)
            void QRCode.toDataURL(publicUrl, { width: 320, margin: 1 }).then(
              setQr,
            );
        }
        if (initialWidget.type === 'SONG_PIX' && initialWidget.initialData)
          setSongs(initialWidget.initialData as SongState);
        if (initialWidget.type === 'VIDEO_PIX' && initialWidget.initialData)
          setVideos(initialWidget.initialData as VideoState);
      })
      .catch(() => setError('Não foi possível carregar o widget'));

    const socket = io(
      process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:3002',
      {
        transports: ['websocket', 'polling'],
        auth: { token },
      },
    );
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      setError(undefined);
      setCurrent((existing) =>
        existing?.presentation?.widgetType === 'ALERT' &&
        ['SONG_PIX', 'VIDEO_PIX'].includes(String(existing.payload.kind ?? ''))
          ? null
          : existing,
      );
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('streamos:error', () => setError('Link inválido ou revogado'));
    socket.on('streamos:sync-request', () => {
      socket.emit('streamos:sync-state', {
        overlayVersion: '1',
        attempts: knownPlaybackAttempts(),
      });
    });
    socket.on(
      'streamos:control',
      (control: { paused?: boolean; masterVolume?: number }) => {
        if (typeof control.paused === 'boolean') setPaused(control.paused);
        if (typeof control.masterVolume === 'number')
          setMasterVolume(Math.max(0, Math.min(100, control.masterVolume)));
      },
    );
    socket.on(
      'streamos:alert-config',
      (presentation: StreamEvent['presentation']) => {
        if (!presentation) return;
        setCurrent((existing) =>
          existing && existing.presentation?.widgetType === 'ALERT'
            ? { ...existing, presentation }
            : existing,
        );
      },
    );
    socket.on('streamos:event', (incoming: StreamEvent) => {
      const persistedStatus = persistedPlaybackStatus(incoming);
      if (persistedStatus) {
        socket.emit('streamos:playback', {
          eventId: incoming.eventId,
          status: persistedStatus,
        });
        if (['COMPLETED', 'FAILED'].includes(persistedStatus))
          socket.emit('streamos:ack', { eventId: incoming.eventId });
        return;
      }
      if (seen.current.has(incoming.eventId)) return;
      seen.current.add(incoming.eventId);
      persistPlaybackStatus(incoming, 'RECEIVED');
      socket.emit('streamos:playback', {
        eventId: incoming.eventId,
        status: 'RECEIVED',
      });
      const type = incoming.presentation?.widgetType;
      if (
        type === 'ALERT' &&
        incoming.eventType.startsWith('live.queue.item.') &&
        ['SONG_PIX', 'VIDEO_PIX'].includes(String(incoming.payload.kind ?? ''))
      ) {
        socket.emit('streamos:ack', { eventId: incoming.eventId });
        return;
      }
      if (type) {
        const targetId = incoming.payload.targetWidgetId;
        const matched = widgetsRef.current.find(
          (item) =>
            (typeof targetId === 'string' && item.id === targetId) ||
            item.type === type,
        );
        setWidget(
          matched ?? {
            id: 'runtime-alert',
            type,
            name: 'Alerta',
            config: incoming.presentation?.config ?? {},
            initialData: null,
          },
        );
      }
      if (
        incoming.eventType.startsWith('live.queue.item.') &&
        incoming.eventType !== 'live.queue.item.playing.v1'
      ) {
        const requestId = String(incoming.payload.requestId ?? '');
        setCurrent((active) =>
          active?.payload.queueItemId === incoming.payload.queueItemId
            ? null
            : active,
        );
        if (incoming.payload.kind === 'SONG_PIX') {
          setSongIntroVisible(false);
          directAudioPosition.current = null;
          playbackTiming.current = null;
          setSongs((existing) => ({
            ...existing,
            current:
              !requestId ||
              (existing.current?.id ?? existing.current?.requestId) ===
                requestId
                ? null
                : existing.current,
          }));
        }
        if (incoming.payload.kind === 'VIDEO_PIX')
          setVideos((existing) => ({
            ...existing,
            current:
              !requestId ||
              (existing.current?.id ?? existing.current?.requestId) ===
                requestId
                ? null
                : existing.current,
          }));
        if (compositeRef.current) setWidget(defaultWidgetRef.current);
        socket.emit('streamos:ack', { eventId: incoming.eventId });
        return;
      }
      if (incoming.eventType === 'tts.queued.v1') {
        if ('speechSynthesis' in window) {
          const speech = new SpeechSynthesisUtterance(
            String(incoming.payload.text ?? ''),
          );
          speakWithConfiguredVoice(speech, 'pt-BR-default');
        }
        socket.emit('streamos:ack', { eventId: incoming.eventId });
        return;
      }
      if (type === 'SONG_PIX') {
        const song: Song = {
          requestId: String(incoming.payload.requestId ?? ''),
          title: String(incoming.payload.title ?? 'Música'),
          artist: String(incoming.payload.artist ?? 'Artista'),
          supporterName: String(incoming.payload.supporterName ?? 'Apoiador'),
          status: String(incoming.payload.status ?? ''),
          isTest: incoming.payload.isTest === true,
          provider: String(incoming.payload.provider ?? ''),
          artworkUrl: String(incoming.payload.artworkUrl ?? ''),
          playbackUrl: String(incoming.payload.playbackUrl ?? ''),
          externalId: String(
            incoming.payload.externalId ??
              youtubeIdFromPlayback(incoming.payload.playbackUrl),
          ),
          volume: Number(incoming.payload.volume ?? 100),
        };
        setSongs((existing) => {
          if (incoming.eventType === 'song.requested.v1')
            return {
              ...existing,
              queue: existing.queue.some(
                (item) => (item.id ?? item.requestId) === song.requestId,
              )
                ? existing.queue
                : [...existing.queue, song],
            };
          if (incoming.eventType === 'song.started.v1')
            return {
              ...existing,
              current: song,
              queue: existing.queue.filter(
                (item) => (item.id ?? item.requestId) !== song.requestId,
              ),
            };
          return {
            ...existing,
            current:
              (existing.current?.id ?? existing.current?.requestId) ===
              song.requestId
                ? null
                : existing.current,
            queue: existing.queue.filter(
              (item) => (item.id ?? item.requestId) !== song.requestId,
            ),
          };
        });
        if (incoming.eventType === 'song.started.v1') {
          setSongIntroVisible(true);
          setCurrent(incoming);
          lastShown.current = incoming;
        } else {
          if (incoming.eventType !== 'song.requested.v1') {
            setCurrent(null);
            setSongIntroVisible(false);
            if (compositeRef.current) setWidget(defaultWidgetRef.current);
          }
          socket.emit('streamos:ack', { eventId: incoming.eventId });
        }
        return;
      }
      if (type === 'VIDEO_PIX') {
        const video: Video = {
          requestId: String(incoming.payload.requestId ?? ''),
          title: String(incoming.payload.title ?? 'Vídeo'),
          channelTitle: String(incoming.payload.channelTitle ?? 'Canal'),
          externalId: String(incoming.payload.externalId ?? ''),
          startAtSeconds: Number(incoming.payload.startAtSeconds ?? 0),
          selectedSeconds: Number(incoming.payload.selectedSeconds ?? 0),
          supporterName: String(incoming.payload.supporterName ?? 'Apoiador'),
          status: String(incoming.payload.status ?? ''),
          provider: String(incoming.payload.provider ?? ''),
          isTest: incoming.payload.isTest === true,
        };
        setVideos((existing) => {
          if (incoming.eventType === 'video.requested.v1')
            return {
              ...existing,
              queue: existing.queue.some(
                (item) => (item.id ?? item.requestId) === video.requestId,
              )
                ? existing.queue
                : [...existing.queue, video],
            };
          if (incoming.eventType === 'video.started.v1')
            return {
              ...existing,
              current: video,
              queue: existing.queue.filter(
                (item) => (item.id ?? item.requestId) !== video.requestId,
              ),
            };
          return {
            ...existing,
            current:
              (existing.current?.id ?? existing.current?.requestId) ===
              video.requestId
                ? null
                : existing.current,
            queue: existing.queue.filter(
              (item) => (item.id ?? item.requestId) !== video.requestId,
            ),
          };
        });
        if (incoming.eventType === 'video.started.v1') {
          setCurrent(incoming);
          lastShown.current = incoming;
        } else {
          if (incoming.eventType !== 'video.requested.v1') {
            setCurrent(null);
            if (compositeRef.current) setWidget(defaultWidgetRef.current);
          }
          socket.emit('streamos:ack', { eventId: incoming.eventId });
        }
        return;
      }
      if (type === 'GOAL' || type === 'CAMPAIGN') {
        setGoal({
          title: String(
            incoming.payload.title ?? incoming.payload.planName ?? 'Vaquinha',
          ),
          currentInCents:
            type === 'CAMPAIGN'
              ? (goal?.currentInCents ?? 0) +
                Number(incoming.payload.amountInCents ?? 0)
              : Number(incoming.payload.currentInCents ?? 0),
          targetInCents: Number(
            incoming.payload.targetInCents ?? goal?.targetInCents ?? 1,
          ),
        });
        setQueue((existing) => [...existing, incoming]);
        return;
      }
      if (
        type === 'RECENT_CONTRIBUTIONS' ||
        type === 'RANKING' ||
        type === 'SUBSCRIPTION' ||
        type === 'SUPPORTERS_PANEL'
      ) {
        const contribution = {
          name: String(incoming.payload.supporterName ?? 'Apoiador'),
          amountInCents: Number(incoming.payload.amountInCents ?? 0),
        };
        setItems((existing) => {
          if (type === 'RECENT_CONTRIBUTIONS' || type === 'SUBSCRIPTION')
            return [contribution, ...existing].slice(0, 10);
          const totals = new Map(
            existing.map((item) => [
              item.name ?? 'Apoiador',
              item.amountInCents,
            ]),
          );
          totals.set(
            contribution.name,
            (totals.get(contribution.name) ?? 0) + contribution.amountInCents,
          );
          return [...totals.entries()]
            .map(([name, amountInCents]) => ({ name, amountInCents }))
            .sort((a, b) => b.amountInCents - a.amountInCents)
            .slice(0, 10);
        });
        setQueue((existing) => [...existing, incoming]);
        return;
      }
      setQueue((existing) => [...existing, incoming]);
    });
    const heartbeat = window.setInterval(
      () => socket.emit('streamos:heartbeat'),
      15_000,
    );
    return () => {
      window.clearInterval(heartbeat);
      socketRef.current = null;
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (paused || current || !queue.length) return;
    const [next, ...remaining] = queue;
    if (!next) return;
    setCurrent(next);
    lastShown.current = next;
    setQueue(remaining);
  }, [current, paused, queue]);

  useEffect(() => {
    if (!songIntroVisible || current?.eventType !== 'song.started.v1') return;
    const introTimer = window.setTimeout(
      () => setSongIntroVisible(false),
      4_500,
    );
    return () => window.clearTimeout(introTimer);
  }, [current, songIntroVisible]);

  useEffect(() => {
    sendYoutubeCommand(paused ? 'pauseVideo' : 'playVideo');
  }, [paused]);

  useEffect(() => {
    const mediaVolume =
      current?.eventType === 'song.started.v1'
        ? Number(current.payload.volume ?? 100)
        : 100;
    sendYoutubeCommand('setVolume', [
      Math.round(
        (masterVolume * Math.max(0, Math.min(100, mediaVolume))) / 100,
      ),
    ]);
    masterVolumeRef.current = masterVolume;
    if (directAudioRef.current)
      directAudioRef.current.volume =
        (masterVolume / 100) *
        Math.max(0, Math.min(1, Number(current?.payload.volume ?? 100) / 100)) *
        Math.max(
          0,
          Math.min(
            1,
            (current?.presentation?.variation?.soundVolume ?? 100) / 100,
          ),
        );
  }, [current, masterVolume]);

  useEffect(() => {
    if (!current) return;
    const completedEvent = current;
    const receivePlayerState = (message: MessageEvent) => {
      if (
        ![
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
        ].includes(message.origin)
      )
        return;
      let body: { event?: string; info?: number };
      try {
        body =
          typeof message.data === 'string'
            ? (JSON.parse(message.data) as { event?: string; info?: number })
            : (message.data as { event?: string; info?: number });
      } catch {
        return;
      }
      if (!body || typeof body !== 'object') return;
      const completed = body.event === 'onStateChange' && body.info === 0;
      const failed = body.event === 'onError';
      if (
        (!completed && !failed) ||
        finishedPlayback.current.has(completedEvent.eventId)
      )
        return;
      finishedPlayback.current.add(completedEvent.eventId);
      persistPlaybackStatus(completedEvent, failed ? 'FAILED' : 'COMPLETED');
      socketRef.current?.emit('streamos:playback', {
        eventId: completedEvent.eventId,
        status: failed ? 'MEDIA_FAILED' : 'COMPLETED',
        ...(failed
          ? {
              reason: `O YouTube recusou a reprodução (código ${body.info ?? 'desconhecido'})`,
            }
          : {}),
      });
      socketRef.current?.emit('streamos:ack', {
        eventId: completedEvent.eventId,
      });
      setCurrent(null);
      setSongIntroVisible(false);
      setSongs((existing) => ({ ...existing, current: null }));
      setVideos((existing) => ({ ...existing, current: null }));
      if (compositeRef.current) setWidget(defaultWidgetRef.current);
    };
    window.addEventListener('message', receivePlayerState);
    return () => window.removeEventListener('message', receivePlayerState);
  }, [current]);

  useEffect(() => {
    if (!current || paused) return;
    setMediaFailed(false);
    persistPlaybackStatus(current, 'STARTED');
    const variation = current.presentation?.variation;
    socketRef.current?.emit('streamos:playback', {
      eventId: current.eventId,
      status: 'STARTED',
    });
    let audio: HTMLAudioElement | undefined;
    let audioEnded: (() => void) | undefined;
    let testAudioContext: AudioContext | undefined;
    const playbackUrl =
      current.eventType === 'song.started.v1'
        ? String(current.payload.playbackUrl ?? '')
        : current.payload.alertType === 'AUDIO'
          ? String(current.payload.audioUrl ?? '')
          : variation?.soundAsset?.url;
    if (playbackUrl && current.payload.provider !== 'YOUTUBE') {
      audio = new Audio(playbackUrl);
      directAudioRef.current = audio;
      if (directAudioPosition.current?.eventId === current.eventId)
        audio.currentTime = directAudioPosition.current.seconds;
      audio.volume =
        (masterVolumeRef.current / 100) *
        Math.max(0, Math.min(1, Number(current.payload.volume ?? 100) / 100)) *
        Math.max(0, Math.min(1, (variation?.soundVolume ?? 100) / 100));
      audioEnded = () => {
        if (finishedPlayback.current.has(current.eventId)) return;
        finishedPlayback.current.add(current.eventId);
        persistPlaybackStatus(current, 'COMPLETED');
        directAudioPosition.current = null;
        playbackTiming.current = null;
        socketRef.current?.emit('streamos:playback', {
          eventId: current.eventId,
          status: 'COMPLETED',
        });
        socketRef.current?.emit('streamos:ack', { eventId: current.eventId });
        setCurrent(null);
        setSongIntroVisible(false);
        setSongs((existing) => ({ ...existing, current: null }));
        if (compositeRef.current) setWidget(defaultWidgetRef.current);
      };
      audio.addEventListener('ended', audioEnded);
      void audio.play().catch(() => {
        if (finishedPlayback.current.has(current.eventId)) return;
        finishedPlayback.current.add(current.eventId);
        persistPlaybackStatus(current, 'FAILED');
        directAudioPosition.current = null;
        playbackTiming.current = null;
        socketRef.current?.emit('streamos:playback', {
          eventId: current.eventId,
          status: 'MEDIA_FAILED',
          reason: 'Não foi possível reproduzir o som',
        });
        setCurrent(null);
        setSongIntroVisible(false);
        setSongs((existing) => ({ ...existing, current: null }));
        if (compositeRef.current) setWidget(defaultWidgetRef.current);
      });
    } else if (
      current.eventType === 'song.started.v1' &&
      current.payload.isTest === true
    ) {
      testAudioContext = new AudioContext();
      const oscillator = testAudioContext.createOscillator();
      const gain = testAudioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, testAudioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        783.99,
        testAudioContext.currentTime + 0.35,
      );
      gain.gain.setValueAtTime(0.12, testAudioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        testAudioContext.currentTime + 0.7,
      );
      oscillator.connect(gain).connect(testAudioContext.destination);
      oscillator.start();
      oscillator.stop(testAudioContext.currentTime + 0.7);
    }
    if (
      variation?.ttsEnabled &&
      current.payload.message &&
      current.payload.alertType !== 'AUDIO' &&
      'speechSynthesis' in window
    ) {
      const speech = new SpeechSynthesisUtterance(
        String(current.payload.message),
      );
      speech.rate = variation.ttsRate;
      speech.volume = (masterVolume / 100) * (variation.ttsVolume / 100);
      const requestedVoice = String(
        current.payload.ttsVoice ?? variation.ttsVoice,
      );
      if (requestedVoice === 'ai-popular-orator') {
        speech.pitch = 0.72;
        speech.rate *= 0.78;
      } else if (requestedVoice === 'ai-commander') {
        speech.pitch = 0.52;
        speech.rate *= 1.04;
      } else if (requestedVoice === 'character-deep') {
        speech.pitch = 0.45;
        speech.rate *= 0.76;
      } else if (requestedVoice === 'character-cheerful') {
        speech.pitch = 1.55;
        speech.rate *= 1.22;
      } else if (requestedVoice === 'character-robot') {
        speech.pitch = 0.25;
        speech.rate *= 0.68;
      } else if (requestedVoice === 'character-narrator') {
        speech.pitch = 0.78;
        speech.rate *= 0.86;
      }
      speakWithConfiguredVoice(speech, requestedVoice);
    }
    const config = current.presentation?.config;
    const mediaDuration =
      current.eventType === 'song.started.v1'
        ? Number(current.payload.durationSeconds ?? 0) * 1000
        : current.eventType === 'video.started.v1'
          ? Number(current.payload.selectedSeconds ?? 0) * 1000
          : current.payload.alertType === 'AUDIO'
            ? Number(current.payload.audioDurationSeconds ?? 0) * 1000
            : 0;
    const duration =
      mediaDuration > 0
        ? mediaDuration
        : (variation?.maximumDurationMs ??
          (typeof config?.durationMs === 'number'
            ? config.durationMs
            : (current.presentation?.durationMs ?? 8000)));
    const timing =
      playbackTiming.current?.eventId === current.eventId
        ? playbackTiming.current
        : {
            eventId: current.eventId,
            remainingMs: duration,
            startedAt: Date.now(),
          };
    timing.startedAt = Date.now();
    playbackTiming.current = timing;
    const timer = setTimeout(
      () => {
        if (finishedPlayback.current.has(current.eventId)) return;
        finishedPlayback.current.add(current.eventId);
        persistPlaybackStatus(current, 'COMPLETED');
        directAudioPosition.current = null;
        playbackTiming.current = null;
        socketRef.current?.emit('streamos:playback', {
          eventId: current.eventId,
          status: 'COMPLETED',
        });
        socketRef.current?.emit('streamos:ack', { eventId: current.eventId });
        setCurrent(null);
        setSongIntroVisible(false);
        setSongs((existing) => ({ ...existing, current: null }));
        setVideos((existing) => ({ ...existing, current: null }));
        if (compositeRef.current) {
          setWidget(defaultWidgetRef.current);
        }
      },
      Math.max(0, timing.remainingMs),
    );
    return () => {
      clearTimeout(timer);
      if (
        playbackTiming.current?.eventId === current.eventId &&
        !finishedPlayback.current.has(current.eventId)
      )
        playbackTiming.current.remainingMs = Math.max(
          0,
          playbackTiming.current.remainingMs -
            (Date.now() - playbackTiming.current.startedAt),
        );
      if (audio && audioEnded) audio.removeEventListener('ended', audioEnded);
      if (audio && !finishedPlayback.current.has(current.eventId))
        directAudioPosition.current = {
          eventId: current.eventId,
          seconds: audio.currentTime,
        };
      audio?.pause();
      if (directAudioRef.current === audio) directAudioRef.current = null;
      if (testAudioContext) void testAudioContext.close();
      window.speechSynthesis?.cancel();
    };
  }, [current, paused]);

  const config = widget?.config ?? {};
  const variation = current?.presentation?.variation;
  const accent =
    variation?.accent ??
    (typeof config.accent === 'string' ? config.accent : '#a98cff');
  const style = {
    '--overlay-accent': accent,
    '--alert-text': variation?.textColor ?? '#ffffff',
    '--alert-font': variation?.fontFamily ?? 'Inter',
    '--alert-size': `${variation?.fontSize ?? 32}px`,
    '--alert-align': variation?.textAlign ?? 'center',
  } as CSSProperties;
  const limit = typeof config.limit === 'number' ? config.limit : 5;
  const qrSize =
    typeof config.size === 'number'
      ? Math.max(120, Math.min(640, config.size))
      : 280;

  function controls() {
    return (
      <nav aria-label="Controles do overlay">
        <button onClick={() => setPaused((value) => !value)}>
          {paused ? 'Continuar' : 'Pausar'}
        </button>
        <button
          disabled={!current}
          onClick={() => {
            if (current)
              socketRef.current?.emit('streamos:ack', {
                eventId: current.eventId,
              });
            setCurrent(null);
            setSongIntroVisible(false);
            setSongs((existing) => ({ ...existing, current: null }));
            setVideos((existing) => ({ ...existing, current: null }));
            setWidget(defaultWidgetRef.current);
          }}
        >
          Pular
        </button>
        <button
          disabled={!lastShown.current}
          onClick={() => lastShown.current && setCurrent(lastShown.current)}
        >
          Repetir
        </button>
      </nav>
    );
  }

  const layoutPreset =
    typeof config.layoutPreset === 'string' ? config.layoutPreset : 'full';
  const compactPosition =
    typeof config.compactPosition === 'string'
      ? config.compactPosition
      : 'bottom-right';
  const requestedAlertPosition =
    variation?.layout && typeof variation.layout.position === 'string'
      ? variation.layout.position
      : 'center';
  const alertPosition = [
    'center',
    'top-center',
    'bottom-center',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'full',
  ].includes(requestedAlertPosition)
    ? requestedAlertPosition
    : 'center';
  const hasVisibleContent =
    (widget?.type === 'QR_CODE' && Boolean(qr)) ||
    ['BANNER', 'CUSTOM_TEXT'].includes(widget?.type ?? '') ||
    (widget?.type === 'VIDEO_PIX' && Boolean(videos.current?.externalId)) ||
    (widget?.type === 'SONG_PIX' && Boolean(songs.current)) ||
    ((widget?.type === 'GOAL' || widget?.type === 'CAMPAIGN') &&
      Boolean(goal)) ||
    ([
      'RECENT_CONTRIBUTIONS',
      'RANKING',
      'SUBSCRIPTION',
      'SUPPORTERS_PANEL',
    ].includes(widget?.type ?? '') &&
      items.length > 0) ||
    Boolean(current);
  const canvasClass =
    hasVisibleContent && widget?.type
      ? `overlay-canvas overlay-${widget.type.toLowerCase().replaceAll('_', '-')} layout-${layoutPreset} compact-${compactPosition}`
      : 'overlay-canvas overlay-empty';

  return (
    <main aria-label="Widget StreamOS" className={canvasClass} style={style}>
      {debug ? (
        <div className={`connection ${connected ? 'online' : ''}`}>
          {error ?? (connected ? 'Ao vivo' : 'Conectando')}
        </div>
      ) : null}
      {debug ? controls() : null}
      {widget?.type === 'QR_CODE' && qr ? (
        <section
          className={`widget-card qr-widget qr-background-${config.background === 'solid' ? 'solid' : 'transparent'}`}
        >
          <Image
            unoptimized
            width={qrSize}
            height={qrSize}
            style={{ width: qrSize, height: qrSize }}
            src={qr}
            alt="QR Code da página de apoio"
          />
          <strong>
            {typeof config.label === 'string' ? config.label : 'Apoie a live'}
          </strong>
        </section>
      ) : widget?.type === 'BANNER' ? (
        <section className="widget-card banner-widget">
          <strong>
            {typeof config.text === 'string'
              ? config.text
              : 'Acompanhe e apoie a transmissão'}
          </strong>
        </section>
      ) : widget?.type === 'CUSTOM_TEXT' ? (
        <section
          className="widget-card custom-text-widget"
          style={{
            fontSize:
              typeof config.fontSize === 'number' ? config.fontSize : 32,
          }}
        >
          <strong>
            {typeof config.text === 'string'
              ? config.text
              : 'Sua mensagem aparece aqui'}
          </strong>
        </section>
      ) : widget?.type === 'VIDEO_PIX' && videos.current?.externalId ? (
        <section
          className={`widget-card list-widget video-widget${paused ? ' playback-paused' : ''}`}
        >
          {videos.current.isTest ? (
            <div
              className="video-test-pattern"
              aria-label="Prévia de teste VideoPix"
            >
              <i>▶</i>
              <strong>VideoPix funcionando</strong>
              <span>Esta área reproduzirá o vídeo enviado pelo apoiador.</span>
            </div>
          ) : (
            <iframe
              key={current?.eventId}
              ref={youtubePlayerRef}
              onLoad={synchronizeYoutubePlayer}
              title={videos.current.title}
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videos.current.externalId)}?autoplay=1&enablejsapi=1&start=${videos.current.startAtSeconds}&controls=0`}
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
          <p className="video-caption">
            {videos.current.title} — {videos.current.channelTitle}
            {videos.current.supporterName && config.showSupporter !== false
              ? ` · enviado por ${videos.current.supporterName}`
              : ''}
          </p>
        </section>
      ) : widget?.type === 'SONG_PIX' && songs.current ? (
        <section
          className={`widget-card song-widget ${songIntroVisible ? 'song-widget-intro' : 'song-widget-compact'}${paused ? ' playback-paused' : ''}`}
          data-phase={songIntroVisible ? 'announcement' : 'now-playing'}
        >
          {songs.current.provider === 'YOUTUBE' && songs.current.externalId ? (
            <iframe
              key={current?.eventId}
              ref={youtubePlayerRef}
              onLoad={synchronizeYoutubePlayer}
              className="song-youtube-player"
              title={songs.current.title}
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(songs.current.externalId.replace(/^youtube:/, ''))}?autoplay=1&enablejsapi=1&controls=0`}
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allow="autoplay; encrypted-media"
            />
          ) : null}
          {songIntroVisible ? (
            <span className="song-announcement">
              <b>{songs.current.supporterName || 'Um apoiador'}</b> mandou a
              seguinte música
            </span>
          ) : (
            <span className="song-now-playing">Tocando agora</span>
          )}
          {songs.current.artworkUrl ? (
            <Image
              unoptimized
              src={songs.current.artworkUrl}
              alt=""
              width={120}
              height={120}
            />
          ) : songs.current.isTest ? (
            <span className="song-test-pulse">♫</span>
          ) : null}
          <div className="song-details">
            <strong>{songs.current.title}</strong>
            <p>{songs.current.artist}</p>
          </div>
        </section>
      ) : (widget?.type === 'GOAL' || widget?.type === 'CAMPAIGN') && goal ? (
        <section
          className={`widget-card goal-widget format-${typeof config.format === 'string' ? config.format : 'horizontal'}`}
        >
          <span>{widget?.type === 'CAMPAIGN' ? 'Vaquinha' : 'Meta'}</span>
          <strong>{goal.title}</strong>
          <>
            <div className="progress">
              <i
                style={{
                  width: `${Math.min(100, (goal.currentInCents / goal.targetInCents) * 100)}%`,
                }}
              />
            </div>
            <p>
              {currency.format(goal.currentInCents / 100)} /{' '}
              {currency.format(goal.targetInCents / 100)}
            </p>
          </>
        </section>
      ) : [
          'RECENT_CONTRIBUTIONS',
          'RANKING',
          'SUBSCRIPTION',
          'SUPPORTERS_PANEL',
        ].includes(widget?.type ?? '') && items.length ? (
        <section className="widget-card list-widget">
          <span>
            {widget?.type === 'RANKING'
              ? 'Ranking'
              : widget?.type === 'SUBSCRIPTION'
                ? 'Novos membros'
                : widget?.type === 'SUPPORTERS_PANEL'
                  ? 'Apoiadores da live'
                  : 'Últimos apoios'}
          </span>
          {items.slice(0, limit).map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <strong>
                {widget?.type === 'RANKING' ||
                widget?.type === 'SUPPORTERS_PANEL'
                  ? `${index + 1}. `
                  : ''}
                {item.name ?? 'Apoiador'}
              </strong>
              {config.showAmount !== false ? (
                <b>{currency.format(item.amountInCents / 100)}</b>
              ) : null}
            </div>
          ))}
        </section>
      ) : current ? (
        <section
          className={`alert-card template-${variation?.template ?? 'neon-pulse'} alert-position-${alertPosition}`}
        >
          {variation?.visualAsset && !mediaFailed ? (
            variation.visualAsset.kind === 'VIDEO' ? (
              <video
                autoPlay
                muted
                playsInline
                src={variation.visualAsset.url}
                onCanPlay={() =>
                  socketRef.current?.emit('streamos:playback', {
                    eventId: current.eventId,
                    status: 'MEDIA_READY',
                  })
                }
                onError={() => {
                  setMediaFailed(true);
                  socketRef.current?.emit('streamos:playback', {
                    eventId: current.eventId,
                    status: 'MEDIA_FAILED',
                    reason: 'Mídia visual indisponível',
                  });
                }}
              />
            ) : (
              <Image
                unoptimized
                src={variation.visualAsset.url}
                alt=""
                width={320}
                height={180}
                onLoad={() =>
                  socketRef.current?.emit('streamos:playback', {
                    eventId: current.eventId,
                    status: 'MEDIA_READY',
                  })
                }
                onError={() => setMediaFailed(true)}
              />
            )
          ) : null}
          <span>Novo apoio</span>
          {variation?.showSupporter !== false ||
          variation?.showAmount !== false ? (
            <strong>
              {variation?.showSupporter !== false
                ? String(current.payload.supporterName ?? 'Apoiador')
                : ''}
              {variation?.showSupporter !== false &&
              variation?.showAmount !== false
                ? ' · '
                : ''}
              {variation?.showAmount !== false
                ? currency.format(
                    Number(current.payload.amountInCents ?? 0) / 100,
                  )
                : ''}
            </strong>
          ) : null}
          {current.payload.message &&
          variation?.showMessage !== false &&
          config.showMessage !== false ? (
            <p>{String(current.payload.message)}</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
