'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
import { replaceZeroMoneyValue, selectZeroMoneyValue } from '../money-input';
import { PageHeader } from '../ui';
import { WidgetOverlayCard } from '../widget-overlay-card';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const statusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  OPEN: 'Ativo',
  CLOSED: 'Encerrado',
  QUEUED: 'Na fila',
  PLAYING: 'Reproduzindo',
  COMPLETED: 'Concluído',
  SKIPPED: 'Pulado',
  UNAVAILABLE: 'Indisponível',
};
type Session = {
  id: string;
  name: string;
  theme: string;
  allowedGenres: string[];
  status: string;
  minimumContributionInCents: number;
  maximumDurationSeconds: number;
  maximumQueueSize: number;
  maximumRequestsPerSupporter: number;
  blockedArtists: string[];
  blockedTerms: string[];
  provider: string;
  volume: number;
  automatic: boolean;
};
type Request = {
  id: string;
  title: string;
  artist: string;
  supporterName: string;
  status: string;
  position: number | null;
};
function formatDuration(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function parseDuration(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
const initial = {
  name: 'Sextaneja',
  theme: 'Sextaneja — só sertanejo',
  genres: 'Sertanejo',
  minimum: 500,
  duration: '06:00',
  queue: 30,
  supporter: 3,
  blockedArtists: '',
  blockedTerms: '',
  provider: 'YOUTUBE',
  volume: 80,
  automatic: true,
};

export default function SongPixPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session>();
  const [requests, setRequests] = useState<Request[]>([]);
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState('Carregando…');

  async function load() {
    const response = await fetch(`${api}/dashboard/songpix/sessions`, {
      credentials: 'include',
    });
    if (!response.ok)
      return setStatus('Entre na sua conta para gerenciar o SongPix.');
    const values = (await response.json()) as Session[];
    setSessions(values);
    setStatus('');
    if (!selected && values[0]) setSelected(values[0]);
  }
  async function loadQueue(id: string) {
    const response = await fetch(
      `${api}/dashboard/songpix/sessions/${id}/queue`,
      { credentials: 'include' },
    );
    if (response.ok) setRequests((await response.json()) as Request[]);
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (selected) {
      void loadQueue(selected.id);
      setForm({
        name: selected.name,
        theme: selected.theme,
        genres: selected.allowedGenres.join(', '),
        minimum: selected.minimumContributionInCents,
        duration: formatDuration(selected.maximumDurationSeconds),
        queue: selected.maximumQueueSize,
        supporter: selected.maximumRequestsPerSupporter,
        blockedArtists: selected.blockedArtists.join(', '),
        blockedTerms: selected.blockedTerms.join(', '),
        provider: selected.provider,
        volume: selected.volume,
        automatic: selected.automatic,
      });
    }
  }, [selected]);

  async function create() {
    const maximumDurationSeconds = parseDuration(form.duration);
    if (
      maximumDurationSeconds === null ||
      maximumDurationSeconds < 60 ||
      maximumDurationSeconds > 900
    ) {
      setStatus('Informe a duração no formato MM:SS, entre 01:00 e 15:00.');
      return;
    }
    const response = await fetch(
      `${api}/dashboard/songpix/sessions${selected ? `/${selected.id}` : ''}`,
      {
        method: selected ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          theme: form.theme,
          allowedGenres: form.genres
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          allowedArtists: [],
          blockedArtists: form.blockedArtists
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          blockedTerms: form.blockedTerms
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          provider: form.provider,
          volume: form.volume,
          automatic: form.automatic,
          minimumContributionInCents: form.minimum,
          maximumDurationSeconds,
          maximumQueueSize: form.queue,
          maximumRequestsPerSupporter: form.supporter,
        }),
      },
    );
    if (!response.ok) return setStatus('Revise as regras do modo.');
    const value = (await response.json()) as Session;
    setSessions((items) =>
      selected
        ? items.map((item) => (item.id === value.id ? value : item))
        : [value, ...items],
    );
    setSelected(value);
    setStatus('Configurações do SongPix salvas.');
  }
  async function activate() {
    if (!selected) return;
    const response = await fetch(
      `${api}/dashboard/songpix/sessions/${selected.id}/activate`,
      { method: 'POST', credentials: 'include' },
    );
    if (response.ok) {
      await load();
      setSelected({ ...selected, status: 'OPEN' });
      setStatus('SongPix ativo para pedidos.');
    }
  }
  async function action(id: string, actionName: string) {
    const response = await fetch(
      `${api}/dashboard/songpix/requests/${id}/action`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: actionName }),
      },
    );
    if (response.ok && selected) {
      await loadQueue(selected.id);
      setStatus('Fila atualizada.');
    } else setStatus('Ação indisponível para este pedido.');
  }

  const activeRequests = requests.filter((request) =>
    ['QUEUED', 'PLAYING'].includes(request.status),
  );

  return (
    <PanelShell>
      <main className="feature-page">
        <PageHeader
          eyebrow="Transmissão"
          title="SongPix"
          description="Defina o tema musical e receba links que entram automaticamente na fila."
          actions={
            <Link className="secondary-button" href="/central-da-live">
              Abrir Central da Live
            </Link>
          }
        />
        <WidgetOverlayCard
          type="SONG_PIX"
          title="Música"
          description="Fonte exclusiva do player musical. Alertas de texto e vídeos não aparecem nesta URL."
        />
        <section
          className="panel media-settings-panel"
          style={{ marginTop: 24 }}
        >
          <h2>Configurações do SongPix</h2>
          <div className="preset-actions" aria-label="Temas rápidos">
            {(
              [
                ['Sextaneja', 'Sertanejo'],
                ['Rock', 'Rock'],
                ['Funk', 'Funk'],
                ['Eletrônica', 'Eletrônica'],
                ['Livre', 'Livre'],
              ] as Array<[string, string]>
            ).map(([name, genre]) => (
              <button
                className="secondary-button"
                key={name}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    name,
                    theme:
                      name === 'Livre'
                        ? 'Tema livre'
                        : `${name} — somente ${genre.toLowerCase()}`,
                    genres: genre,
                  })
                }
              >
                {name}
              </button>
            ))}
          </div>
          <div className="media-settings-grid">
            <label>
              Nome
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Tema
              <input
                value={form.theme}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}
              />
            </label>
            <label>
              Estilos (vírgula)
              <input
                value={form.genres}
                onChange={(e) => setForm({ ...form, genres: e.target.value })}
              />
            </label>
            <label>
              Contribuição mínima
              <span className="money-input">
                <b>R$</b>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Contribuição mínima em reais"
                  value={form.minimum / 100}
                  onFocus={selectZeroMoneyValue}
                  onKeyDown={replaceZeroMoneyValue}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      minimum: Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
              </span>
              <small className="money-field-help">
                Valor mínimo para enviar um pedido musical.
              </small>
            </label>
            <label>
              Duração máxima
              <input
                type="text"
                inputMode="numeric"
                placeholder="06:00"
                pattern="[0-9]{1,2}:[0-5][0-9]"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                onBlur={() => {
                  const seconds = parseDuration(form.duration);
                  if (seconds !== null)
                    setForm({ ...form, duration: formatDuration(seconds) });
                }}
              />
              <small>Use minutos e segundos (MM:SS), de 01:00 a 15:00.</small>
            </label>
            <label>
              Tamanho da fila
              <input
                type="number"
                value={form.queue}
                onChange={(e) =>
                  setForm({ ...form, queue: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Pedidos por apoiador
              <input
                type="number"
                value={form.supporter}
                onChange={(e) =>
                  setForm({ ...form, supporter: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Provedor
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
              >
                <option value="YOUTUBE">YouTube</option>
              </select>
            </label>
            <label>
              Artistas bloqueados
              <input
                value={form.blockedArtists}
                onChange={(e) =>
                  setForm({ ...form, blockedArtists: e.target.value })
                }
                placeholder="Separados por vírgula"
              />
            </label>
            <label>
              Termos bloqueados
              <input
                value={form.blockedTerms}
                onChange={(e) =>
                  setForm({ ...form, blockedTerms: e.target.value })
                }
                placeholder="Separados por vírgula"
              />
            </label>
            <label>
              Volume ({form.volume}%)
              <input
                type="range"
                min="0"
                max="100"
                value={form.volume}
                onChange={(e) =>
                  setForm({ ...form, volume: Number(e.target.value) })
                }
              />
            </label>
            <label className="consent-field">
              <input
                type="checkbox"
                checked={form.automatic}
                onChange={(e) =>
                  setForm({ ...form, automatic: e.target.checked })
                }
              />{' '}
              Reprodução automática
            </label>
          </div>
          <button
            className="primary-button"
            onClick={() => void create()}
            style={{ marginTop: 18 }}
          >
            Salvar configurações
          </button>
        </section>
        <section className="panel song-session-panel">
          <header className="song-session-header">
            <div className="song-session-heading">
              <span className="section-kicker">Sessão atual</span>
              <h2>Tema da transmissão</h2>
              <p>
                Escolha qual conjunto de regras será usado nos próximos pedidos.
              </p>
            </div>
            <div className="song-session-actions">
              <label>
                Sessão
                <select
                  value={selected?.id ?? ''}
                  onChange={(e) =>
                    setSelected(sessions.find((s) => s.id === e.target.value))
                  }
                >
                  <option value="">Selecione</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {statusLabels[s.status] ?? s.status}
                    </option>
                  ))}
                </select>
              </label>
              {selected ? (
                <button
                  className="primary-button"
                  disabled={selected.status === 'OPEN'}
                  onClick={() => void activate()}
                >
                  {selected.status === 'OPEN'
                    ? 'SongPix ativo'
                    : 'Ativar sessão'}
                </button>
              ) : null}
            </div>
          </header>
          {selected ? (
            <div className="song-theme-summary">
              <div className="song-theme-main">
                <span
                  className={`song-session-status ${selected.status === 'OPEN' ? 'active' : ''}`}
                >
                  <i /> {statusLabels[selected.status] ?? selected.status}
                </span>
                <h3>{selected.theme}</h3>
                <div className="song-genre-tags">
                  {selected.allowedGenres.length ? (
                    selected.allowedGenres.map((genre) => (
                      <span key={genre}>{genre}</span>
                    ))
                  ) : (
                    <span>Livre</span>
                  )}
                </div>
              </div>
              <dl className="song-rule-summary">
                <div>
                  <dt>Valor mínimo</dt>
                  <dd>
                    {(selected.minimumContributionInCents / 100).toLocaleString(
                      'pt-BR',
                      { style: 'currency', currency: 'BRL' },
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Duração máxima</dt>
                  <dd>{formatDuration(selected.maximumDurationSeconds)}</dd>
                </div>
                <div>
                  <dt>Limite da fila</dt>
                  <dd>{selected.maximumQueueSize} músicas</dd>
                </div>
                <div>
                  <dt>Reprodução</dt>
                  <dd>{selected.automatic ? 'Automática' : 'Manual'}</dd>
                </div>
              </dl>
            </div>
          ) : null}
          <div className="song-queue-section">
            <div className="song-queue-heading">
              <div>
                <span className="section-kicker">Próximas</span>
                <h3>Fila de músicas</h3>
              </div>
              <span>{activeRequests.length} na fila</span>
            </div>
            {activeRequests.map((request) => (
              <article
                className={`song-queue-item ${request.status === 'PLAYING' ? 'playing' : ''}`}
                key={request.id}
              >
                <b className="song-queue-position">{request.position ?? '—'}</b>
                <div>
                  <strong>{request.title}</strong>
                  <span>
                    {request.artist} · pedido por {request.supporterName}
                  </span>
                </div>
                <small>{statusLabels[request.status] ?? request.status}</small>
                <button
                  className="secondary-button"
                  onClick={() => void action(request.id, 'SKIP')}
                >
                  Pular
                </button>
              </article>
            ))}
            {!activeRequests.length ? (
              <div className="song-queue-empty">
                <span aria-hidden="true">♫</span>
                <strong>A fila está vazia</strong>
                <p>
                  Os novos pedidos aparecerão aqui depois da confirmação do Pix.
                </p>
              </div>
            ) : null}
          </div>
        </section>
        <p>{status}</p>
        <p className="feature-note">
          As músicas entram na fila pela ordem de confirmação e começam
          automaticamente.
        </p>
      </main>
    </PanelShell>
  );
}
