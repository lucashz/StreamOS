'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelShell } from '../panel-shell';
import { EmptyState, PageHeader, StatusBadge } from '../ui';

type Trace = {
  provider: string;
  providerReference: string | null;
  intentCreatedAt: string;
  paymentConfirmedAt: string | null;
  webhookProcessed: boolean;
  ledgerRecorded: boolean;
  queuedAt: string | null;
  dispatchedAt: string | null;
  dispatchAttempts: number;
  dispatchError: string | null;
  overlayStatus: string;
  overlayStartedAt: string | null;
  overlayCompletedAt: string | null;
  overlayFailure: string | null;
  correlationId: string | null;
};
type Contribution = {
  id: string;
  intentId: string;
  supporterName: string | null;
  message: string | null;
  amountInCents: number;
  platformFeeInCents: number;
  providerFeeInCents: number;
  netInCents: number;
  status: string;
  confirmedAt: string | null;
  createdAt: string;
  type: string;
  mediaTitle: string | null;
  thumbnailUrl: string | null;
  trace: Trace;
};
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    v / 100,
  );
const when = (value: string | null) => {
  if (!value) return 'Pendente';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Horário indisponível'
    : date.toLocaleString('pt-BR');
};
const typeLabel: Record<string, string> = {
  TEXT: 'Texto',
  VIDEO: 'VideoPix',
  SONG: 'SongPix',
  CAMPAIGN: 'Vaquinha',
};
const statusLabel: Record<string, string> = {
  PENDING: 'Aguardando',
  CONFIRMED: 'Confirmado',
  FAILED: 'Falhou',
  REFUNDED: 'Estornado',
  COMPLETED: 'Concluído',
  SKIPPED: 'Ignorado',
  MEDIA_FAILED: 'Mídia indisponível',
  QUEUED: 'Aguardando',
  DISPATCHING: 'Enviando',
  PLAYING: 'Tocando',
  STARTED: 'Tocando',
};

export default function ContributionsPage() {
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<Contribution>();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${api}/dashboard/contributions`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => [])) as Contribution[] & {
        message?: string;
      };
      if (!response.ok)
        throw new Error(
          body.message ?? 'Não foi possível carregar as contribuições.',
        );
      setItems(body);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar as contribuições.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(undefined);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', close);
      previousFocus?.focus();
    };
  }, [selected]);
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const text =
          `${item.supporterName ?? ''} ${item.message ?? ''} ${item.mediaTitle ?? ''} ${item.id}`.toLowerCase();
        return (
          (type === 'ALL' || item.type === type) &&
          (status === 'ALL' || item.status === status) &&
          text.includes(query.toLowerCase())
        );
      }),
    [items, query, status, type],
  );
  return (
    <PanelShell>
      <main className="feature-page contributions-page">
        <PageHeader
          eyebrow="Receitas"
          title="Contribuições"
          description="Acompanhe valores, mídia, taxas e cada etapa da entrega ao OBS."
        />
        <section className="feature-card contribution-filters">
          <label>
            Pesquisar
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Apoiador, mensagem ou referência"
            />
          </label>
          <label>
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="TEXT">Texto</option>
              <option value="VIDEO">VideoPix</option>
              <option value="SONG">SongPix</option>
              <option value="CAMPAIGN">Vaquinha</option>
            </select>
          </label>
          <label>
            Estado
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">Todos</option>
              {[...new Set(items.map((item) => item.status))].map((value) => (
                <option key={value} value={value}>
                  {statusLabel[value] ?? value}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="feature-card compact-contribution-list">
          {filtered.length ? (
            <div className="contribution-table-head" aria-hidden="true">
              <span>Data</span>
              <span>Apoiador e conteúdo</span>
              <span>Tipo</span>
              <span>Bruto</span>
              <span>Taxas</span>
              <span>Líquido</span>
              <span>Pagamento</span>
            </div>
          ) : null}
          {loading ? (
            <p>Carregando contribuições…</p>
          ) : loadError ? (
            <EmptyState
              title="Não foi possível carregar"
              description={loadError}
              action={
                <button type="button" onClick={() => void load()}>
                  Tentar novamente
                </button>
              }
            />
          ) : filtered.length ? (
            filtered.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelected(item)}
                aria-label={`Abrir contribuição de ${item.supporterName || 'Anônimo'}`}
              >
                <time>{when(item.confirmedAt)}</time>
                <div className="contribution-supporter">
                  <strong>{item.supporterName || 'Anônimo'}</strong>
                  <small>
                    {item.mediaTitle || item.message || 'Sem mensagem'}
                  </small>
                </div>
                <span className="contribution-kind">
                  {typeLabel[item.type] ?? item.type}
                </span>
                <strong>{money(item.amountInCents)}</strong>
                <span className="contribution-fees">
                  − {money(item.platformFeeInCents + item.providerFeeInCents)}
                </span>
                <strong className="contribution-net">
                  {money(item.netInCents)}
                </strong>
                <StatusBadge
                  tone={item.status === 'CONFIRMED' ? 'success' : 'neutral'}
                >
                  {statusLabel[item.status] ?? item.status}
                </StatusBadge>
              </button>
            ))
          ) : (
            <EmptyState
              title="Nenhuma contribuição encontrada"
              description="Novas contribuições confirmadas aparecerão aqui."
            />
          )}
        </section>
        {selected ? (
          <>
            <div
              className="detail-backdrop"
              aria-hidden="true"
              onClick={() => setSelected(undefined)}
            />
            <section
              className="contribution-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="contribution-detail-title"
            >
              <header>
                <div>
                  <span className="section-kicker">Rastreamento</span>
                  <h2 id="contribution-detail-title">
                    {selected.supporterName || 'Anônimo'}
                  </h2>
                </div>
                <button
                  className="icon-button contribution-modal-close"
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setSelected(undefined)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </header>
              <dl>
                <div>
                  <dt>Bruto</dt>
                  <dd>{money(selected.amountInCents)}</dd>
                </div>
                <div>
                  <dt>Taxa StreamOS</dt>
                  <dd>{money(selected.platformFeeInCents)}</dd>
                </div>
                <div>
                  <dt>Taxa PSP</dt>
                  <dd>{money(selected.providerFeeInCents)}</dd>
                </div>
                <div>
                  <dt>Líquido</dt>
                  <dd>{money(selected.netInCents)}</dd>
                </div>
              </dl>
              <ol className="trace-timeline">
                <li className="done">
                  <b>Intenção criada</b>
                  <span>{when(selected.trace.intentCreatedAt)}</span>
                </li>
                <li className={selected.trace.webhookProcessed ? 'done' : ''}>
                  <b>Pagamento e webhook</b>
                  <span>{when(selected.trace.paymentConfirmedAt)}</span>
                </li>
                <li className={selected.trace.ledgerRecorded ? 'done' : ''}>
                  <b>Registro financeiro</b>
                  <span>
                    {selected.trace.ledgerRecorded
                      ? 'Registrado'
                      : 'Aguardando'}
                  </span>
                </li>
                <li className={selected.trace.queuedAt ? 'done' : ''}>
                  <b>Fila de alertas</b>
                  <span>{when(selected.trace.queuedAt)}</span>
                </li>
                <li className={selected.trace.dispatchedAt ? 'done' : ''}>
                  <b>Enviado ao overlay</b>
                  <span>
                    {when(selected.trace.dispatchedAt)} ·{' '}
                    {selected.trace.dispatchAttempts} tentativa(s)
                  </span>
                </li>
              </ol>
            </section>
          </>
        ) : null}
      </main>
    </PanelShell>
  );
}
