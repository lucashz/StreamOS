'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { backlogState } from './backlog-policy';

type QueueItem = {
  id: string;
  liveSessionId?: string;
  kind: string;
  supporterName?: string;
  amountInCents?: number;
  title?: string;
  content?: string;
  status: string;
  moderationStatus?: string;
  position: number;
  createdAt: string;
  startedAt?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  playbackAttempts?: Array<{
    id: string;
    status: string;
    attemptNumber: number;
    dispatchCount: number;
    lastError?: string;
    updatedAt: string;
  }>;
};
type Snapshot = {
  state: {
    paused: boolean;
    autoAdvance: boolean;
    queueMode: 'BALANCED' | 'VALUE' | 'FIFO';
    masterVolume: number;
    updatedAt: string;
  };
  items: QueueItem[];
  history: Array<{
    id: string;
    action: string;
    origin: string;
    createdAt: string;
  }>;
  role: string;
  activeSession?: {
    id: string;
    name: string;
    startedAt: string;
  } | null;
  sessions: Array<{
    id: string;
    name: string;
    status: string;
    startedAt: string;
    endedAt?: string;
    _count: { queueItems: number };
  }>;
};
type HistoryResult = {
  items: QueueItem[];
  page: number;
  pages: number;
  total: number;
};

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const activeStatuses = ['QUEUED', 'DISPATCHING', 'PLAYING'];
const labels: Record<string, string> = {
  QUEUED: 'Aguardando',
  DISPATCHING: 'Enviando ao OBS',
  PLAYING: 'Em reprodução',
  COMPLETED: 'Concluído',
  MEDIA_FAILED: 'Mídia indisponível',
  SKIPPED: 'Pulado',
  FAILED: 'Falhou',
  EXPIRED: 'Expirado',
  NEEDS_REVIEW: 'Precisa de revisão',
};
const kindLabels: Record<string, string> = {
  ALERT: 'Donate',
  AUDIO: 'Áudio',
  TTS: 'Mensagem',
  VIDEO_PIX: 'Vídeo',
  SONG_PIX: 'Música',
  SUBSCRIPTION: 'Assinatura',
  CAMPAIGN: 'Vaquinha',
};
const playbackLabels: Record<string, string> = {
  STARTED: 'Tocando',
  PLAYING: 'Tocando',
  COMPLETED: 'Concluído',
  SKIPPED: 'Ignorado',
  FAILED: 'Falhou',
  MEDIA_FAILED: 'Mídia indisponível',
  IDLE: 'Aguardando',
};

function itemDuration(item: QueueItem) {
  const raw =
    item.metadata?.selectedSeconds ??
    item.metadata?.durationSeconds ??
    item.metadata?.durationMs;
  const value = typeof raw === 'number' ? raw : Number(raw ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 8;
  return item.metadata?.durationMs ? Math.ceil(value / 1000) : Math.ceil(value);
}

function shortDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function itemThumbnail(item: QueueItem) {
  const value = item.metadata?.thumbnailUrl ?? item.metadata?.artworkUrl;
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : '';
}

function itemMoney(item: QueueItem) {
  return ((item.amountInCents ?? 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function itemTime(item: QueueItem) {
  const date = new Date(item.createdAt);
  if (Number.isNaN(date.getTime())) return 'Horário indisponível';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LiveControlClient({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Snapshot>();
  const [connection, setConnection] = useState<
    'connecting' | 'online' | 'offline'
  >('connecting');
  const [message, setMessage] = useState('Sincronizando a fila…');
  const [busy, setBusy] = useState(false);
  const [overlayOnline, setOverlayOnline] = useState(0);
  const [playbackStatus, setPlaybackStatus] = useState<string>();
  const [historyFilter, setHistoryFilter] = useState('ALL');
  const [historyKind, setHistoryKind] = useState('ALL');
  const [historyMinAmount, setHistoryMinAmount] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [historyResult, setHistoryResult] = useState<HistoryResult>();
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(100);
  const [selectedSessionId, setSelectedSessionId] = useState('ALL');
  const [clock, setClock] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [supportsNotifications, setSupportsNotifications] = useState(false);

  useEffect(() => {
    setSupportsNotifications('Notification' in window);
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${api}/dashboard/live-control`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Entre na sua conta novamente.'
            : 'Não foi possível carregar a fila.',
        );
      setData((await response.json()) as Snapshot);
      setConnection('online');
      setMessage('Fila sincronizada');
    } catch (error) {
      setConnection('offline');
      setMessage(error instanceof Error ? error.message : 'Conexão perdida');
    }
  }, []);

  useEffect(() => {
    void load();
    const socket = io(
      process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:3002',
      {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: { mode: 'admin' },
      },
    );
    socket.on('connect', () => setConnection('online'));
    socket.on('disconnect', () => setConnection('offline'));
    socket.on('streamos:error', () => {
      setConnection('offline');
      setMessage('Conexão em tempo real não autorizada.');
    });
    socket.on('streamos:admin-ready', () => void load());
    socket.on('streamos:admin-event', () => void load());
    socket.on('streamos:overlay-presence', (presence: { online?: number }) =>
      setOverlayOnline(presence.online ?? 0),
    );
    socket.on('streamos:overlay-playback', (receipt: { status?: string }) => {
      setPlaybackStatus(receipt.status);
      void load();
    });
    return () => {
      socket.disconnect();
    };
  }, [load]);

  useEffect(() => {
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (compact) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: String(historyPage),
        limit: '50',
      });
      if (historyFilter !== 'ALL') params.set('status', historyFilter);
      if (historyKind !== 'ALL') params.set('kind', historyKind);
      if (historyMinAmount) params.set('minAmount', historyMinAmount);
      if (selectedSessionId !== 'ALL')
        params.set('sessionId', selectedSessionId);
      if (historySearch.trim()) params.set('q', historySearch.trim());
      void fetch(`${api}/dashboard/live-control/history?${params}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      })
        .then((response) =>
          response.ok ? (response.json() as Promise<HistoryResult>) : undefined,
        )
        .then((result) => result && setHistoryResult(result))
        .catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    compact,
    historyFilter,
    historyKind,
    historyMinAmount,
    historyPage,
    historySearch,
    selectedSessionId,
    historyRefresh,
  ]);

  useEffect(() => {
    if (
      notificationsEnabled &&
      playbackStatus &&
      ['FAILED', 'MEDIA_FAILED'].includes(playbackStatus) &&
      'Notification' in window
    )
      new Notification('Falha no alerta da StreamOS', {
        body: 'A mídia não foi reproduzida. Abra a Central da Live para repetir ou pular.',
      });
  }, [notificationsEnabled, playbackStatus]);

  async function command(
    action: string,
    itemId?: string,
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    try {
      const response = await fetch(`${api}/dashboard/live-control/commands`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          itemId,
          idempotencyKey: crypto.randomUUID(),
          origin: compact ? 'OBS_DOCK' : 'PANEL',
          ...extra,
        }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      const errorMessage =
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof body.message === 'string'
          ? body.message
          : 'Ação não concluída';
      if (!response.ok) throw new Error(errorMessage);
      setData(body as Snapshot);
      if (action === 'REPLAY') {
        setHistoryRefresh((value) => value + 1);
        setMessage('Alerta reproduzindo novamente');
      } else setMessage('Ação concluída');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ação não concluída');
    } finally {
      setBusy(false);
    }
  }

  const canOperate = data
    ? ['OWNER', 'ADMIN', 'MODERATOR'].includes(data.role)
    : false;
  const current = data?.items.find((item) => item.status === 'PLAYING');
  const currentDuration = current ? itemDuration(current) : 0;
  const playbackClock = data?.state.paused
    ? new Date(data.state.updatedAt).getTime()
    : clock;
  const currentElapsed = current?.startedAt
    ? Math.max(
        0,
        Math.min(
          currentDuration,
          Math.floor(
            (playbackClock - new Date(current.startedAt).getTime()) / 1000,
          ),
        ),
      )
    : 0;
  const currentProgress = currentDuration
    ? Math.min(100, (currentElapsed / currentDuration) * 100)
    : 0;
  const pending = useMemo(
    () =>
      data?.items.filter(
        (item) =>
          activeStatuses.includes(item.status) && item.id !== current?.id,
      ) ?? [],
    [data, current],
  );
  const next = pending[0];
  const reviewItems =
    data?.items.filter((item) => item.status === 'NEEDS_REVIEW') ?? [];
  const history =
    data?.items.filter(
      (item) =>
        !activeStatuses.includes(item.status) && item.status !== 'NEEDS_REVIEW',
    ) ?? [];
  const sessionHistory = data?.activeSession
    ? history.filter((item) => item.liveSessionId === data.activeSession?.id)
    : history;
  const localVisibleHistory = history.filter((item) => {
    const matchesStatus =
      historyFilter === 'ALL' || item.status === historyFilter;
    const matchesSession =
      selectedSessionId === 'ALL' || item.liveSessionId === selectedSessionId;
    const term = historySearch.trim().toLowerCase();
    return (
      matchesStatus &&
      matchesSession &&
      (!term ||
        `${item.supporterName ?? ''} ${item.title ?? ''} ${item.content ?? ''}`
          .toLowerCase()
          .includes(term))
    );
  });
  const visibleHistory = historyResult?.items ?? localVisibleHistory;
  const receivedInCents = sessionHistory.reduce(
    (total, item) => total + (item.amountInCents ?? 0),
    0,
  );
  const failures = sessionHistory.filter((item) =>
    ['FAILED', 'MEDIA_FAILED'].includes(item.status),
  ).length;
  const flagged =
    data?.items.filter((item) => item.moderationStatus === 'FLAGGED').length ??
    0;
  const estimatedQueueSeconds = pending.reduce(
    (total, item) => total + itemDuration(item),
    0,
  );
  const backlog = backlogState({
    pendingCount: pending.length,
    estimatedSeconds: estimatedQueueSeconds,
  });

  async function toggleMute() {
    const volume = data?.state.masterVolume ?? 100;
    if (volume > 0) setVolumeBeforeMute(volume);
    await command('SET_MASTER_VOLUME', undefined, {
      volume: volume > 0 ? 0 : volumeBeforeMute,
    });
  }

  useEffect(() => {
    if (compact || !canOperate) return;
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select')) return;
      if (event.key.toLowerCase() === 'm') void toggleMute();
      if (event.key.toLowerCase() === 'p')
        void command(data?.state.paused ? 'RESUME_QUEUE' : 'PAUSE_QUEUE');
      if (event.key.toLowerCase() === 's' && current)
        void command('SKIP', current.id);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });

  return (
    <div className={compact ? 'live-control compact' : 'live-control'}>
      {!compact && (connection === 'offline' || overlayOnline === 0) ? (
        <div className="live-operational-warning" role="alert">
          <strong>OBS desconectado</strong>
          <span>
            A fila permanece salva e retomará automaticamente quando a Browser
            Source reconectar.
          </span>
        </div>
      ) : null}
      {!compact && backlog.level === 'warning' ? (
        <div className="live-backlog-warning" role="status">
          <strong>Fila extensa</strong>
          <span>
            {backlog.reason} Os pagamentos permanecem registrados. Pause ou
            reorganize a fila antes de iniciar novos alertas.
          </span>
        </div>
      ) : null}
      <div className="live-control-toolbar">
        <div className={`connection ${connection}`}>
          <span />
          {connection === 'online'
            ? 'Conectado'
            : connection === 'offline'
              ? 'Desconectado'
              : 'Conectando'}
        </div>
        <strong>{pending.length} na fila</strong>
        <span
          className={overlayOnline ? 'obs-presence online' : 'obs-presence'}
        >
          OBS: {overlayOnline ? `${overlayOnline} conectado` : 'desconectado'}
          {playbackStatus
            ? ` · ${playbackLabels[playbackStatus] ?? 'Atualizando'}`
            : ''}
        </span>
        {canOperate ? (
          <>
            <label className="live-volume-control">
              <span>Volume {data?.state.masterVolume ?? 100}%</span>
              <input
                aria-label="Volume principal do OBS"
                type="range"
                min="0"
                max="100"
                value={data?.state.masterVolume ?? 100}
                disabled={busy}
                onChange={(event) =>
                  setData((currentData) =>
                    currentData
                      ? {
                          ...currentData,
                          state: {
                            ...currentData.state,
                            masterVolume: Number(event.target.value),
                          },
                        }
                      : currentData,
                  )
                }
                onPointerUp={(event) =>
                  void command('SET_MASTER_VOLUME', undefined, {
                    volume: Number(event.currentTarget.value),
                  })
                }
                onKeyUp={(event) =>
                  void command('SET_MASTER_VOLUME', undefined, {
                    volume: Number(event.currentTarget.value),
                  })
                }
              />
            </label>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                void command(
                  data?.state.paused ? 'RESUME_QUEUE' : 'PAUSE_QUEUE',
                )
              }
            >
              {data?.state.paused ? 'Continuar fila' : 'Pausar fila'}
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void toggleMute()}
            >
              {(data?.state.masterVolume ?? 100) === 0
                ? 'Ativar som'
                : 'Silenciar'}
            </button>
            <button
              className="primary-button"
              disabled={busy || Boolean(current)}
              onClick={() => void command('PLAY_NEXT')}
            >
              Reproduzir próximo
            </button>
          </>
        ) : (
          <span className="role-note">Somente leitura</span>
        )}
        {!compact && supportsNotifications ? (
          <button
            className="secondary-button"
            disabled={notificationsEnabled}
            onClick={() =>
              void Notification.requestPermission().then((permission) =>
                setNotificationsEnabled(permission === 'granted'),
              )
            }
          >
            {notificationsEnabled
              ? 'Notificações ativas'
              : 'Ativar notificações'}
          </button>
        ) : null}
      </div>

      {!compact ? (
        <section className="live-session-bar">
          <div>
            <span className="section-kicker">Transmissão atual</span>
            <strong>
              {data?.activeSession?.name ?? 'Nenhuma live iniciada'}
            </strong>
            <small>
              {data?.activeSession
                ? `Iniciada em ${new Date(data.activeSession.startedAt).toLocaleString('pt-BR')}`
                : 'Inicie uma transmissão para separar métricas e histórico. A fila continua funcionando mesmo sem ela.'}
            </small>
          </div>
          {canOperate ? (
            data?.activeSession ? (
              <button
                className="danger-button"
                disabled={busy}
                onClick={() =>
                  window.confirm(
                    'Encerrar esta transmissão? A fila continuará funcionando.',
                  ) && void command('END_LIVE')
                }
              >
                Encerrar live
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => {
                  const name = window.prompt('Nome da live', 'Live de hoje');
                  if (name?.trim())
                    void command('START_LIVE', undefined, { name });
                }}
              >
                Iniciar live
              </button>
            )
          ) : null}
        </section>
      ) : null}

      {!compact ? (
        <section className="live-summary-grid" aria-label="Resumo da live">
          <article>
            <small>Próximos donates</small>
            <strong>{pending.length}</strong>
            <span>≈ {shortDuration(estimatedQueueSeconds)} de fila</span>
          </article>
          <article>
            <small>Recebidos nesta transmissão</small>
            <strong>{sessionHistory.length}</strong>
          </article>
          <article>
            <small>Valor recebido</small>
            <strong>
              {(receivedInCents / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
          </article>
          <article className={failures ? 'attention' : ''}>
            <small>Falhas de reprodução</small>
            <strong>{failures}</strong>
          </article>
          <article className={flagged ? 'attention' : ''}>
            <small>Sinalizados para revisar</small>
            <strong>{flagged}</strong>
          </article>
        </section>
      ) : null}

      {!compact && reviewItems.length ? (
        <section className="live-review-section" aria-labelledby="review-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Ação necessária</span>
              <h2 id="review-title">Alertas que precisam de revisão</h2>
              <p>
                A reprodução ficou incerta. Confira o que aconteceu antes de
                liberar outra tentativa.
              </p>
            </div>
            <span className="queue-status needs_review">
              {reviewItems.length}{' '}
              {reviewItems.length === 1
                ? 'alerta pendente'
                : 'alertas pendentes'}
            </span>
          </div>
          <div className="live-review-list">
            {reviewItems.map((item) => {
              const attempt = item.playbackAttempts?.[0];
              return (
                <article className="live-review-item" key={item.id}>
                  <div className="queue-copy">
                    <div>
                      <span className={`kind-badge ${item.kind.toLowerCase()}`}>
                        {kindLabels[item.kind] ?? item.kind}
                      </span>
                      <span className="queue-status needs_review">
                        Precisa de revisão
                      </span>
                    </div>
                    <strong>
                      {item.title ?? item.content ?? 'Alerta sem título'}
                    </strong>
                    <small>
                      {item.supporterName ?? 'Apoiador'} · {itemMoney(item)}
                    </small>
                    <span className="review-reason">
                      {attempt?.lastError ??
                        item.failureReason ??
                        'O OBS não confirmou o fim da reprodução.'}
                    </span>
                    <small>
                      Tentativa {attempt?.attemptNumber ?? 1} ·{' '}
                      {attempt?.dispatchCount ?? 1}{' '}
                      {(attempt?.dispatchCount ?? 1) === 1 ? 'envio' : 'envios'}
                    </small>
                  </div>
                  {canOperate ? (
                    <div className="review-actions">
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void command('REPLAY', item.id)}
                      >
                        Tentar novamente
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void command('COMPLETE', item.id)}
                      >
                        Marcar como reproduzido
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void command('SKIP', item.id)}
                      >
                        Pular
                      </button>
                      <button
                        className="danger-action"
                        disabled={busy}
                        onClick={() => void command('CANCEL', item.id)}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="live-now-card">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Reprodução</span>
            <h2>Tocando agora</h2>
          </div>
          <span
            className={`queue-status ${data?.state.paused ? 'skipped' : 'playing'}`}
          >
            {data?.state.paused
              ? 'Pausado'
              : current
                ? 'Ao vivo no OBS'
                : 'Aguardando'}
          </span>
        </div>
        {current ? (
          <>
            <div className="live-item-heading">
              <span className={`kind-badge ${current.kind.toLowerCase()}`}>
                {kindLabels[current.kind] ?? current.kind}
              </span>
              <span className={`queue-status ${current.status.toLowerCase()}`}>
                {labels[current.status]}
              </span>
            </div>
            <h3>
              {current.title ?? current.content ?? 'Incentivo em reprodução'}
            </h3>
            <p>
              {current.supporterName ?? 'Apoiador'}
              {current.amountInCents
                ? ` · ${(current.amountInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                : ''}
            </p>
            <div className="live-playback-progress">
              <div>
                <span>{shortDuration(currentElapsed)}</span>
                <span>{shortDuration(currentDuration)}</span>
              </div>
              <progress
                aria-label="Progresso do alerta atual"
                max="100"
                value={currentProgress}
              />
            </div>
            {canOperate ? (
              <div className="live-actions">
                <button
                  disabled={busy}
                  title="Recomeçar este alerta desde o início"
                  onClick={() => void command('REPLAY', current.id)}
                >
                  ↻ Reiniciar alerta
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void command(
                      data?.state.paused ? 'RESUME_QUEUE' : 'PAUSE_QUEUE',
                    )
                  }
                >
                  {data?.state.paused
                    ? 'Continuar reprodução'
                    : 'Pausar reprodução'}
                </button>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void command('COMPLETE_AND_NEXT', current.id)}
                >
                  Concluir e tocar próximo
                </button>
                <button
                  disabled={busy}
                  onClick={() => void command('SKIP', current.id)}
                >
                  Pular alerta
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void command(
                      current.moderationStatus === 'FLAGGED'
                        ? 'UNFLAG'
                        : 'FLAG',
                      current.id,
                      { reason: 'Revisão solicitada durante a reprodução' },
                    )
                  }
                >
                  {current.moderationStatus === 'FLAGGED'
                    ? 'Remover sinalização'
                    : 'Sinalizar'}
                </button>
                <button
                  className="danger-action"
                  disabled={busy}
                  onClick={() =>
                    window.confirm(
                      'Bloquear este conteúdo agora? O pagamento será preservado.',
                    ) &&
                    void command('BLOCK', current.id, {
                      reason: 'Conteúdo bloqueado durante a reprodução',
                    })
                  }
                >
                  Bloquear
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-live">
            <strong>Nenhum alerta em reprodução</strong>
            <span>Inicie o próximo item ou ative o avanço automático.</span>
          </div>
        )}
        <div className="live-next-preview">
          <span>Próximo alerta</span>
          {next ? (
            <div>
              <strong>{next.title ?? next.content ?? 'Incentivo'}</strong>
              <small>
                {next.supporterName ?? 'Apoiador'} · {itemMoney(next)} ·{' '}
                {shortDuration(itemDuration(next))}
              </small>
            </div>
          ) : (
            <strong>A fila está vazia</strong>
          )}
        </div>
      </section>

      <section className="live-queue-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Fila atual</span>
            <h2>Alertas aguardando ({pending.length})</h2>
          </div>
          {!compact && canOperate ? (
            <div className="queue-settings">
              <label className="queue-mode-field">
                <span>Ordem da fila</span>
                <select
                  aria-label="Modo de prioridade da fila"
                  disabled={busy}
                  value={data?.state.queueMode ?? 'BALANCED'}
                  onChange={(event) =>
                    void command('SET_QUEUE_MODE', undefined, {
                      mode: event.target.value,
                    })
                  }
                >
                  <option value="BALANCED">Equilibrada</option>
                  <option value="VALUE">Maior valor</option>
                  <option value="FIFO">Ordem de chegada</option>
                </select>
              </label>
              <label className="queue-auto-field">
                <span>Reprodução</span>
                <span>
                  <input
                    type="checkbox"
                    checked={data?.state.autoAdvance ?? false}
                    onChange={(event) =>
                      void command('SET_AUTO_ADVANCE', undefined, {
                        value: event.target.checked,
                      })
                    }
                  />
                  Avanço automático
                </span>
              </label>
              <button
                disabled={busy || !pending.length}
                className="danger-link"
                onClick={() =>
                  window.confirm(
                    'Remover todos os itens pendentes? As contribuições e o histórico financeiro serão preservados.',
                  ) && void command('CLEAR_PENDING')
                }
              >
                Limpar pendentes
              </button>
            </div>
          ) : null}
        </div>
        <div className="live-queue-list">
          {pending.slice(0, compact ? 5 : 100).map((item, index) => (
            <article
              className={`live-queue-item ${['VIDEO_PIX', 'SONG_PIX'].includes(item.kind) ? 'media' : 'textual'}`}
              key={item.id}
            >
              <div className="queue-supporter">
                <strong>{item.supporterName ?? 'Apoiador'}</strong>
                <small>{itemTime(item)}</small>
              </div>
              {itemThumbnail(item) ? (
                <div
                  className="queue-media-preview"
                  role="img"
                  aria-label={`Miniatura de ${item.title ?? 'mídia'}`}
                  style={{ backgroundImage: `url("${itemThumbnail(item)}")` }}
                />
              ) : (
                <div className="queue-kind-icon" aria-hidden="true">
                  {item.kind === 'VIDEO_PIX'
                    ? '▶'
                    : item.kind === 'SONG_PIX'
                      ? '♫'
                      : item.kind === 'AUDIO'
                        ? '♪'
                        : '✦'}
                </div>
              )}
              <div className="queue-copy">
                <div>
                  <span className={`kind-badge ${item.kind.toLowerCase()}`}>
                    {kindLabels[item.kind] ?? item.kind}
                  </span>
                  <span className={`queue-status ${item.status.toLowerCase()}`}>
                    {labels[item.status]}
                  </span>
                </div>
                <strong>{item.title ?? item.content ?? 'Incentivo'}</strong>
                <small>
                  {item.content && item.title ? ` · ${item.content}` : ''}
                  {` · ${shortDuration(itemDuration(item))}`}
                  {index > 0
                    ? ` · espera ≈ ${shortDuration(
                        pending
                          .slice(0, index)
                          .reduce(
                            (total, queued) => total + itemDuration(queued),
                            0,
                          ),
                      )}`
                    : ' · próximo'}
                </small>
              </div>
              <strong className="queue-amount">{itemMoney(item)}</strong>
              {canOperate ? (
                <div className="queue-actions">
                  {item.status === 'QUEUED' ? (
                    <button
                      title="Reproduzir agora"
                      aria-label="Reproduzir agora"
                      disabled={
                        busy || Boolean(current) || Boolean(data?.state.paused)
                      }
                      onClick={() => void command('START', item.id)}
                    >
                      ▶
                    </button>
                  ) : null}
                  {!compact ? (
                    <>
                      <button
                        className={
                          item.moderationStatus === 'FLAGGED'
                            ? 'flag-action active'
                            : 'flag-action'
                        }
                        disabled={busy}
                        title={
                          item.moderationStatus === 'FLAGGED'
                            ? 'Item sinalizado'
                            : 'Sinalizar para revisão posterior'
                        }
                        aria-label={`Sinalizar ${item.title ?? 'item'} para revisão`}
                        onClick={() =>
                          void command(
                            item.moderationStatus === 'FLAGGED'
                              ? 'UNFLAG'
                              : 'FLAG',
                            item.id,
                            {
                              reason:
                                item.moderationStatus === 'FLAGGED'
                                  ? 'Sinalização removida durante a live'
                                  : 'Sinalizado durante a live',
                            },
                          )
                        }
                      >
                        ⚑
                      </button>
                      <button
                        className="muted-action"
                        disabled={busy || index === 0}
                        title="Mover para cima"
                        aria-label={`Mover ${item.title ?? 'item'} para cima`}
                        onClick={() =>
                          void command('MOVE', item.id, {
                            position: Math.max(1, index),
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        className="muted-action"
                        disabled={busy || index === pending.length - 1}
                        title="Mover para baixo"
                        aria-label={`Mover ${item.title ?? 'item'} para baixo`}
                        onClick={() =>
                          void command('MOVE', item.id, {
                            position: index + 2,
                          })
                        }
                      >
                        ↓
                      </button>
                      <button
                        className="danger-action"
                        disabled={busy}
                        title="Bloquear este conteúdo"
                        aria-label="Bloquear este conteúdo"
                        onClick={() =>
                          window.confirm(
                            'Bloquear este conteúdo e removê-lo da reprodução? O pagamento e o histórico financeiro serão preservados.',
                          ) &&
                          void command('BLOCK', item.id, {
                            reason: 'Conteúdo bloqueado durante a live',
                          })
                        }
                      >
                        ⊘
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
          {!pending.length ? (
            <div className="queue-empty">
              Nenhum alerta aguardando. A fila está pronta para a próxima
              contribuição.
            </div>
          ) : null}
        </div>
      </section>

      {!compact ? (
        <section className="live-history">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Já tocados</span>
              <h2>Histórico de alertas</h2>
            </div>
            <div className="live-history-filters">
              <select
                aria-label="Filtrar por sessão"
                value={selectedSessionId}
                onChange={(event) => {
                  setSelectedSessionId(event.target.value);
                  setHistoryPage(1);
                }}
              >
                <option value="ALL">Todas as sessões</option>
                {data?.sessions.map((session) => (
                  <option value={session.id} key={session.id}>
                    {session.name} ({session._count.queueItems})
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar histórico"
                value={historyFilter}
                onChange={(event) => {
                  setHistoryFilter(event.target.value);
                  setHistoryPage(1);
                }}
              >
                <option value="ALL">Todos</option>
                <option value="COMPLETED">Reproduzidos</option>
                <option value="SKIPPED">Pulados</option>
                <option value="MEDIA_FAILED">Falhas de mídia</option>
                <option value="FAILED">Falhas</option>
              </select>
              <select
                aria-label="Filtrar por tipo"
                value={historyKind}
                onChange={(event) => {
                  setHistoryKind(event.target.value);
                  setHistoryPage(1);
                }}
              >
                <option value="ALL">Todos os tipos</option>
                {Object.entries(kindLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Pesquisar histórico"
                placeholder="Buscar apoiador ou conteúdo"
                value={historySearch}
                onChange={(event) => {
                  setHistorySearch(event.target.value);
                  setHistoryPage(1);
                }}
              />
              <input
                className="history-value-filter"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                aria-label="Valor mínimo"
                placeholder="Valor mínimo"
                value={historyMinAmount}
                onChange={(event) => {
                  setHistoryMinAmount(event.target.value);
                  setHistoryPage(1);
                }}
              />
              <a
                className="secondary-button"
                href={`${api}/dashboard/live-control/history.csv?${new URLSearchParams(
                  {
                    ...(historyFilter !== 'ALL'
                      ? { status: historyFilter }
                      : {}),
                    ...(historyKind !== 'ALL' ? { kind: historyKind } : {}),
                    ...(historyMinAmount
                      ? { minAmount: historyMinAmount }
                      : {}),
                    ...(selectedSessionId !== 'ALL'
                      ? { sessionId: selectedSessionId }
                      : {}),
                    ...(historySearch.trim()
                      ? { q: historySearch.trim() }
                      : {}),
                  },
                )}`}
              >
                Exportar CSV
              </a>
            </div>
          </div>
          {visibleHistory.slice(0, 50).map((item) => (
            <article
              className={`history-row ${['VIDEO_PIX', 'SONG_PIX'].includes(item.kind) ? 'media' : 'textual'}`}
              key={item.id}
            >
              <div className="queue-supporter">
                <strong>{item.supporterName ?? 'Apoiador'}</strong>
                <small>{itemTime(item)}</small>
              </div>
              {itemThumbnail(item) ? (
                <div
                  className="queue-media-preview"
                  role="img"
                  aria-label={`Miniatura de ${item.title ?? 'mídia'}`}
                  style={{ backgroundImage: `url("${itemThumbnail(item)}")` }}
                />
              ) : (
                <div className="queue-kind-icon" aria-hidden="true">
                  {item.kind === 'VIDEO_PIX'
                    ? '▶'
                    : item.kind === 'SONG_PIX'
                      ? '♫'
                      : '✦'}
                </div>
              )}
              <div className="queue-copy">
                <strong>{item.title ?? item.content ?? item.kind}</strong>
                <small>
                  {item.content ?? kindLabels[item.kind] ?? item.kind}
                </small>
                {item.status === 'NEEDS_REVIEW' &&
                item.playbackAttempts?.[0] ? (
                  <small>
                    Tentativa {item.playbackAttempts[0].attemptNumber} ·{' '}
                    {item.playbackAttempts[0].dispatchCount} envio(s)
                    {item.playbackAttempts[0].lastError
                      ? ` · ${item.playbackAttempts[0].lastError}`
                      : ''}
                  </small>
                ) : null}
              </div>
              <span className={`queue-status ${item.status.toLowerCase()}`}>
                {labels[item.status]}
              </span>
              <strong className="queue-amount">{itemMoney(item)}</strong>
              {canOperate ? (
                <div className="queue-actions">
                  {[
                    'COMPLETED',
                    'SKIPPED',
                    'FAILED',
                    'MEDIA_FAILED',
                    'NEEDS_REVIEW',
                  ].includes(item.status) ? (
                    <button
                      title="Repetir alerta"
                      aria-label="Repetir alerta"
                      onClick={() => void command('REPLAY', item.id)}
                    >
                      ↻
                    </button>
                  ) : null}
                  {item.status === 'NEEDS_REVIEW' ? (
                    <>
                      <button
                        title="Marcar como reproduzido"
                        aria-label="Marcar como reproduzido"
                        onClick={() => void command('COMPLETE', item.id)}
                      >
                        ✓
                      </button>
                      <button
                        title="Pular"
                        aria-label="Pular"
                        onClick={() => void command('SKIP', item.id)}
                      >
                        ⇥
                      </button>
                      <button
                        title="Cancelar"
                        aria-label="Cancelar"
                        onClick={() => void command('CANCEL', item.id)}
                      >
                        ×
                      </button>
                    </>
                  ) : null}
                  <button
                    className={
                      item.moderationStatus === 'FLAGGED'
                        ? 'flag-action active'
                        : 'flag-action'
                    }
                    title="Sinalizar para revisão"
                    aria-label="Sinalizar para revisão"
                    onClick={() =>
                      void command(
                        item.moderationStatus === 'FLAGGED' ? 'UNFLAG' : 'FLAG',
                        item.id,
                        { reason: 'Sinalizado pelo histórico operacional' },
                      )
                    }
                  >
                    ⚑
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {!visibleHistory.length ? (
            <div className="queue-empty">Nenhum item encontrado.</div>
          ) : null}
          {historyResult && historyResult.pages > 1 ? (
            <nav
              className="history-pagination"
              aria-label="Páginas do histórico"
            >
              <button
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
              >
                Anterior
              </button>
              <span>
                Página {historyResult.page} de {historyResult.pages} ·{' '}
                {historyResult.total} itens
              </span>
              <button
                disabled={historyPage >= historyResult.pages}
                onClick={() => setHistoryPage((page) => page + 1)}
              >
                Próxima
              </button>
            </nav>
          ) : null}
        </section>
      ) : null}
      <p className="live-control-message" aria-live="polite">
        {message}
        {!compact ? ' · Atalhos: P pausar, S pular, M silenciar.' : ''}
      </p>
    </div>
  );
}
