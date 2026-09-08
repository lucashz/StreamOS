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
  status: string;
  pricePerSecondInCents: number;
  minimumContributionInCents: number;
  maximumDurationSeconds: number;
  minimumViews: number;
  minimumAgeDays: number;
  maximumQueueSize: number;
  blockMadeForKids: boolean;
  blockLiveContent: boolean;
  allowedChannelIds: string[];
  blockedChannelIds: string[];
  blockedTitleTerms: string[];
  automatic: boolean;
};
type VideoRequest = {
  id: string;
  title: string;
  channelTitle: string;
  supporterName: string;
  status: string;
  position: number | null;
  selectedSeconds: number;
  amountInCents: number;
};
const defaults = {
  name: 'Vídeos da live',
  pricePerSecondInCents: 5,
  minimumContributionInCents: 300,
  minimumViews: 10000,
  minimumAgeDays: 7,
  maximumQueueSize: 20,
  blockMadeForKids: true,
  blockLiveContent: true,
  allowedChannelIds: [] as string[],
  blockedChannelIds: [] as string[],
  blockedTitleTerms: [] as string[],
  automatic: true,
};
export default function VideoPixPage() {
  const [selected, setSelected] = useState<Session>();
  const [queue, setQueue] = useState<VideoRequest[]>([]);
  const [form, setForm] = useState(defaults);
  const [status, setStatus] = useState('Carregando…');
  async function load() {
    const response = await fetch(`${api}/dashboard/videopix/sessions`, {
      credentials: 'include',
    });
    if (!response.ok)
      return setStatus('Entre na sua conta para gerenciar o VideoPix.');
    const values = (await response.json()) as Session[];
    if (!selected && values[0]) setSelected(values[0]);
    setStatus('');
  }
  async function loadQueue(id: string) {
    const response = await fetch(
      `${api}/dashboard/videopix/sessions/${id}/queue`,
      { credentials: 'include' },
    );
    if (response.ok) setQueue((await response.json()) as VideoRequest[]);
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (selected) {
      void loadQueue(selected.id);
      setForm({
        name: selected.name,
        pricePerSecondInCents: selected.pricePerSecondInCents,
        minimumContributionInCents: selected.minimumContributionInCents,
        minimumViews: selected.minimumViews,
        minimumAgeDays: selected.minimumAgeDays,
        maximumQueueSize: selected.maximumQueueSize,
        blockMadeForKids: selected.blockMadeForKids,
        blockLiveContent: selected.blockLiveContent,
        allowedChannelIds: selected.allowedChannelIds,
        blockedChannelIds: selected.blockedChannelIds,
        blockedTitleTerms: selected.blockedTitleTerms,
        automatic: selected.automatic,
      });
    }
  }, [selected]);
  async function create() {
    const response = await fetch(
      `${api}/dashboard/videopix/sessions${selected ? `/${selected.id}` : ''}`,
      {
        method: selected ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      },
    );
    if (!response.ok) return setStatus('Revise as regras do modo.');
    const value = (await response.json()) as Session;
    setSelected(value);
    setStatus('Configurações do VideoPix salvas.');
  }
  async function activate() {
    if (!selected) return;
    const response = await fetch(
      `${api}/dashboard/videopix/sessions/${selected.id}/activate`,
      { method: 'POST', credentials: 'include' },
    );
    if (response.ok) {
      setSelected({ ...selected, status: 'OPEN' });
      await load();
      setStatus('VideoPix aberto.');
    }
  }
  async function action(id: string, actionName: string) {
    const response = await fetch(
      `${api}/dashboard/videopix/requests/${id}/action`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: actionName }),
      },
    );
    if (response.ok && selected) await loadQueue(selected.id);
  }
  const number = (
    key:
      | 'pricePerSecondInCents'
      | 'minimumContributionInCents'
      | 'minimumViews'
      | 'minimumAgeDays'
      | 'maximumQueueSize',
    label: string,
  ) => (
    <label>
      {label}
      <input
        type="number"
        value={Number(form[key])}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
      />
    </label>
  );
  const moneyNumber = (
    key: 'pricePerSecondInCents' | 'minimumContributionInCents',
    label: string,
  ) => {
    const isPricePerSecond = key === 'pricePerSecondInCents';
    return (
      <label>
        {label}
        <span className="money-input">
          <b>R$</b>
          <input
            type="number"
            min={isPricePerSecond ? 0.01 : 1}
            max={isPricePerSecond ? 10 : undefined}
            step="0.01"
            inputMode="decimal"
            aria-label={`${label} em reais`}
            value={Number(form[key]) / 100}
            onFocus={selectZeroMoneyValue}
            onKeyDown={replaceZeroMoneyValue}
            onChange={(e) =>
              setForm({
                ...form,
                [key]: Math.round(Number(e.target.value) * 100),
              })
            }
          />
        </span>
        <small className="money-field-help">
          {isPricePerSecond
            ? 'Cobrado por segundo do trecho selecionado.'
            : 'O Pix não será gerado abaixo deste valor.'}
        </small>
      </label>
    );
  };
  return (
    <PanelShell>
      <main className="feature-page videopix-page">
        <PageHeader
          eyebrow="Transmissão"
          title="VideoPix"
          description="Defina as regras dos vídeos enviados. Após o Pix, os pedidos válidos entram automaticamente na fila da live."
          actions={
            <Link
              className="secondary-button button-link"
              href="/central-da-live"
            >
              Abrir Central da Live
            </Link>
          }
        />
        <WidgetOverlayCard
          type="VIDEO_PIX"
          title="Vídeo"
          description="Fonte exclusiva para os trechos do VideoPix. Alertas de texto e músicas não aparecem nesta URL."
        />
        <section className="panel videopix-config-panel">
          <header className="videopix-section-header">
            <div>
              <span className="section-kicker">Configuração principal</span>
              <h2>Como o VideoPix deve funcionar?</h2>
              <p>
                Estas regras são aplicadas antes da cobrança para evitar pedidos
                incompatíveis.
              </p>
            </div>
            <span
              className={`status-badge ${selected?.status === 'OPEN' ? 'success' : 'neutral'}`}
            >
              {selected
                ? (statusLabels[selected.status] ?? selected.status)
                : 'Ainda não criado'}
            </span>
          </header>

          <div className="videopix-form-section">
            <div className="videopix-group-title">
              <h3>Identificação e cobrança</h3>
              <p>
                Nome interno e valores usados para calcular o trecho escolhido
                pelo apoiador.
              </p>
            </div>
            <div className="videopix-billing-grid">
              <label>
                Nome interno
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <small>Visível apenas para você.</small>
              </label>
              {moneyNumber('pricePerSecondInCents', 'Preço por segundo')}
              {moneyNumber('minimumContributionInCents', 'Contribuição mínima')}
              {number('minimumViews', 'Visualizações mínimas')}
            </div>
          </div>

          <div className="videopix-form-section">
            <div className="videopix-group-title">
              <h3>Segurança automática</h3>
              <p>
                Filtros simples que reduzem conteúdo inadequado sem exigir
                aprovação manual.
              </p>
            </div>
            <div className="videopix-safety-grid">
              <div className="videopix-number-card">
                {number('minimumAgeDays', 'Idade mínima (dias)')}
                <small>Bloqueia vídeos publicados recentemente.</small>
              </div>
              <div className="videopix-number-card">
                {number('maximumQueueSize', 'Tamanho da fila')}
                <small>
                  Impede novos pedidos quando a fila atingir o limite.
                </small>
              </div>
              <label className="consent-field">
                <input
                  type="checkbox"
                  checked={form.blockMadeForKids}
                  onChange={(e) =>
                    setForm({ ...form, blockMadeForKids: e.target.checked })
                  }
                />{' '}
                <span>
                  <b>Bloquear conteúdo infantil</b>
                  <small>
                    Ignora vídeos marcados como feitos para crianças.
                  </small>
                </span>
              </label>
              <label className="consent-field">
                <input
                  type="checkbox"
                  checked={form.blockLiveContent}
                  onChange={(e) =>
                    setForm({ ...form, blockLiveContent: e.target.checked })
                  }
                />{' '}
                <span>
                  <b>Bloquear lives e estreias</b>
                  <small>
                    Aceita somente vídeos publicados e com duração conhecida.
                  </small>
                </span>
              </label>
            </div>
          </div>

          <details className="videopix-advanced">
            <summary>
              <span>
                <b>Regras avançadas</b>
                <small>
                  Canais permitidos, bloqueados e palavras proibidas
                </small>
              </span>
              <span>Configurar</span>
            </summary>
            <div className="videopix-rules-grid">
              {(
                [
                  ['allowedChannelIds', 'IDs de canais permitidos'],
                  ['blockedChannelIds', 'IDs de canais bloqueados'],
                  ['blockedTitleTerms', 'Termos proibidos no título'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <textarea
                    rows={4}
                    placeholder="Um valor por linha"
                    value={form[key].join('\n')}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        [key]: event.target.value
                          .split('\n')
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>

          <footer className="videopix-config-footer">
            <label className="consent-field videopix-auto-toggle">
              <input
                type="checkbox"
                checked={form.automatic}
                onChange={(e) =>
                  setForm({ ...form, automatic: e.target.checked })
                }
              />
              <span>
                <b>Reprodução automática</b>
                <small>
                  Ao confirmar o Pix, o vídeo entra na fila sem aprovação
                  manual.
                </small>
              </span>
            </label>
            <div className="videopix-footer-actions">
              {selected && selected.status !== 'OPEN' ? (
                <button
                  className="secondary-button"
                  onClick={() => void activate()}
                >
                  Ativar VideoPix
                </button>
              ) : null}
              <button className="primary-button" onClick={() => void create()}>
                {selected ? 'Salvar alterações' : 'Criar VideoPix'}
              </button>
            </div>
          </footer>
        </section>
        <section className="panel videopix-queue-panel">
          <header className="videopix-section-header">
            <div>
              <span className="section-kicker">Execução automática</span>
              <h2>Fila do VideoPix</h2>
              <p>
                Os pedidos são reproduzidos na ordem da confirmação do
                pagamento.
              </p>
            </div>
          </header>
          {queue.length ? (
            <div className="videopix-queue-list">
              {queue.map((request) => (
                <article key={request.id}>
                  <span className="videopix-position">
                    {request.position ?? '—'}
                  </span>
                  <div className="videopix-request-copy">
                    <strong>{request.title}</strong>
                    <small>
                      {request.channelTitle} · enviado por{' '}
                      {request.supporterName}
                    </small>
                  </div>
                  <div className="videopix-request-meta">
                    <strong>
                      {Math.floor(request.selectedSeconds / 60)}:
                      {String(request.selectedSeconds % 60).padStart(2, '0')}
                    </strong>
                    <span>
                      {(request.amountInCents / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  </div>
                  <span className="status-badge neutral">
                    {statusLabels[request.status] ?? request.status}
                  </span>
                  <div className="compact-actions">
                    {request.status === 'QUEUED' ? (
                      <button
                        className="secondary-button"
                        onClick={() => void action(request.id, 'SKIP')}
                      >
                        Pular
                      </button>
                    ) : null}
                    {request.status === 'PLAYING' ? (
                      <button
                        className="secondary-button"
                        onClick={() => void action(request.id, 'UNAVAILABLE')}
                      >
                        Encerrar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="videopix-empty-queue">
              <span>▶</span>
              <div>
                <strong>Nenhum vídeo na fila</strong>
                <p>
                  Quando um Pix for confirmado, o próximo pedido aparecerá aqui.
                </p>
              </div>
            </div>
          )}
        </section>
        {status ? (
          <p className="feature-note" role="status">
            {status}
          </p>
        ) : null}
      </main>
    </PanelShell>
  );
}
