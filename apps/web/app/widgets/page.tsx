'use client';

import Link from 'next/link';
import { type CSSProperties, useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
import {
  EmptyState,
  ObsConnectionStatus,
  PageHeader,
  SecretUrlField,
  StatusBadge,
} from '../ui';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Widget = {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  configVersion: number;
  channelReady: boolean;
  browserSourceUrl?: string;
  obsConnected: boolean;
  lastHeartbeatAt?: string | null;
  updatedAt: string;
};
const unifiedAlertTypes = new Set([
  'ALERT',
  'VIDEO_PIX',
  'SONG_PIX',
  'SUBSCRIPTION',
]);
const names: Record<string, string> = {
  ALERT: 'Alerta',
  VIDEO_PIX: 'VideoPix',
  SONG_PIX: 'SongPix',
  GOAL: 'Meta',
  QR_CODE: 'QR Code',
  RANKING: 'Ranking',
  RECENT_CONTRIBUTIONS: 'Últimos apoios',
  SUBSCRIPTION: 'Assinatura',
  CAMPAIGN: 'Vaquinha',
  POLL: 'Enquete',
  MARATHON: 'Maratona',
  SUPPORTERS_PANEL: 'Painel de apoiadores',
  BANNER: 'Banner rotativo',
  CUSTOM_TEXT: 'Texto personalizado',
};
const widgetMeta: Record<string, { icon: string; description: string }> = {
  ALERT: { icon: '✦', description: 'Exibe contribuições e mensagens na live' },
  VIDEO_PIX: {
    icon: '▶',
    description: 'Reproduz vídeos enviados pelo público',
  },
  SONG_PIX: { icon: '♫', description: 'Organiza e toca pedidos de música' },
  GOAL: { icon: '◎', description: 'Mostra o progresso de uma meta' },
  QR_CODE: { icon: '▦', description: 'Facilita contribuições pelo QR Code' },
  RANKING: { icon: '♛', description: 'Destaca os maiores apoiadores' },
  RECENT_CONTRIBUTIONS: {
    icon: '≡',
    description: 'Lista os apoios mais recentes',
  },
  SUBSCRIPTION: { icon: '★', description: 'Celebra novas assinaturas' },
  CAMPAIGN: { icon: '♥', description: 'Acompanha o progresso da vaquinha' },
  POLL: { icon: '▥', description: 'Exibe votos da enquete em tempo real' },
  MARATHON: { icon: '◷', description: 'Mostra o tempo restante da maratona' },
  SUPPORTERS_PANEL: {
    icon: '★',
    description: 'Destaca quem mais apoia a transmissão',
  },
  BANNER: { icon: '▰', description: 'Alterna avisos e chamadas na cena' },
  CUSTOM_TEXT: { icon: 'T', description: 'Exibe uma mensagem personalizada' },
};
const productCatalog = [
  {
    type: 'ALERT',
    name: 'Alertas',
    description: 'Texto, áudio e avisos de novas contribuições.',
    detail: 'Incluído no overlay único',
    href: '/alertas',
    action: 'Configurar',
  },
  {
    type: 'VIDEO_PIX',
    name: 'VideoPix',
    description: 'Reproduza automaticamente vídeos enviados pelo público.',
    detail: 'Incluído no overlay único',
    href: '/videopix',
    action: 'Configurar',
  },
  {
    type: 'SONG_PIX',
    name: 'SongPix',
    description: 'Receba pedidos musicais e organize a fila da live.',
    detail: 'Incluído no overlay único',
    href: '/songpix',
    action: 'Configurar',
  },
  {
    type: 'QR_CODE',
    name: 'QR Code',
    description: 'Leve o público até sua página de contribuição.',
    detail: 'Overlay independente · 800 × 800',
    href: '/widgets/create?type=QR_CODE',
    action: 'Adicionar',
  },
  {
    type: 'GOAL',
    name: 'Meta',
    description: 'Mostre o progresso de uma meta em tempo real.',
    detail: 'Overlay independente · 800 × 240',
    href: '/widgets/create?type=GOAL',
    action: 'Adicionar',
  },
  {
    type: 'RANKING',
    name: 'Ranking',
    description: 'Destaque os maiores apoiadores do período.',
    detail: 'Overlay independente · 600 × 800',
    href: '/widgets/create?type=RANKING',
    action: 'Adicionar',
  },
  {
    type: 'RECENT_CONTRIBUTIONS',
    name: 'Últimos apoios',
    description: 'Exiba as contribuições mais recentes da comunidade.',
    detail: 'Overlay independente · 800 × 500',
    href: '/widgets/create?type=RECENT_CONTRIBUTIONS',
    action: 'Adicionar',
  },
  {
    type: 'CAMPAIGN',
    name: 'Vaquinhas',
    description: 'Acompanhe o progresso de uma vaquinha publicada.',
    detail: 'Overlay independente',
    href: '/vaquinhas',
    action: 'Configurar',
  },
] as const;

function WidgetArtwork({ widget }: { widget: Widget }) {
  const meta = widgetMeta[widget.type] ?? {
    icon: '◇',
    description: 'Widget para sua transmissão',
  };
  const accent =
    typeof widget.config.accent === 'string' ? widget.config.accent : '#8b5cf6';
  return (
    <div
      className={`widget-artwork type-${widget.type.toLowerCase()}`}
      style={{ '--widget-accent': accent } as CSSProperties}
    >
      <div className="artwork-topline">
        <span>{meta.icon}</span>
        <small>STREAMOS</small>
      </div>
      {widget.type === 'VIDEO_PIX' ? (
        <div className="artwork-video">
          <i>▶</i>
          <b>Vídeo enviado</b>
        </div>
      ) : null}
      {widget.type === 'SONG_PIX' ? (
        <div className="artwork-song">
          <i>♫</i>
          <div>
            <b>Pedido musical</b>
            <span className="artwork-wave">▂▅▃▇▆▃▅</span>
          </div>
        </div>
      ) : null}
      {['GOAL', 'CAMPAIGN', 'MARATHON'].includes(widget.type) ? (
        <div className="artwork-progress">
          <b>{widget.type === 'MARATHON' ? '02:45:18' : 'R$ 740 / R$ 1.000'}</b>
          <i>
            <span />
          </i>
        </div>
      ) : null}
      {widget.type === 'QR_CODE' ? (
        <div className="artwork-qr">
          <i>▦</i>
          <b>Aponte a câmera</b>
        </div>
      ) : null}
      {['RANKING', 'RECENT_CONTRIBUTIONS', 'SUPPORTERS_PANEL'].includes(
        widget.type,
      ) ? (
        <div className="artwork-list">
          <span>
            <b>1</b> apoiador_01
          </span>
          <span>
            <b>2</b> apoiador_02
          </span>
        </div>
      ) : null}
      {widget.type === 'POLL' ? (
        <div className="artwork-poll">
          <span>
            <b style={{ width: '72%' }} />
            Opção A
          </span>
          <span>
            <b style={{ width: '38%' }} />
            Opção B
          </span>
        </div>
      ) : null}
      {['ALERT', 'SUBSCRIPTION'].includes(widget.type) ? (
        <div className="artwork-alert">
          <i>{meta.icon}</i>
          <div>
            <b>Novo apoio!</b>
            <span>Uma mensagem aparece aqui</span>
          </div>
        </div>
      ) : null}
      {['BANNER', 'CUSTOM_TEXT'].includes(widget.type) ? (
        <div className="artwork-alert">
          <i>{meta.icon}</i>
          <div>
            <b>
              {widget.type === 'BANNER'
                ? 'Aviso da transmissão'
                : 'Texto personalizado'}
            </b>
            <span>Sua mensagem aparece aqui</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [selected, setSelected] = useState<Widget>();
  const [showObsGuide, setShowObsGuide] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState('Carregando…');
  const [loadingWidgets, setLoadingWidgets] = useState(true);
  const [togglingWidgetId, setTogglingWidgetId] = useState<string>();
  const [savingWidget, setSavingWidget] = useState(false);
  async function load() {
    try {
      const response = await fetch(`${api}/dashboard/widgets`, {
        credentials: 'include',
      });
      if (!response.ok)
        throw new Error('Entre na sua conta para gerenciar os widgets.');
      setWidgets((await response.json()) as Widget[]);
      setStatus('');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'A API do StreamOS não respondeu.',
      );
    } finally {
      setLoadingWidgets(false);
    }
  }
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => setConfirmDelete(false), [selected?.id]);
  const visible = widgets.filter(
    (widget) => !unifiedAlertTypes.has(widget.type),
  );
  const activeCount = widgets.filter((widget) => widget.enabled).length;
  const connectedCount = widgets.filter((widget) => widget.obsConnected).length;
  function updateSelectedConfig(key: string, value: unknown) {
    if (!selected) return;
    setSelected({ ...selected, config: { ...selected.config, [key]: value } });
  }
  function configText(key: string, fallback = '') {
    return typeof selected?.config[key] === 'string'
      ? String(selected.config[key])
      : fallback;
  }
  function configNumber(key: string, fallback: number) {
    return typeof selected?.config[key] === 'number'
      ? Number(selected.config[key])
      : fallback;
  }
  async function request(
    path: string,
    method = 'POST',
    body?: unknown,
    widgetId = selected?.id,
  ) {
    const response = await fetch(
      `${api}/dashboard/widgets/${widgetId}${path}`,
      {
        method,
        credentials: 'include',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (!response.ok) throw new Error('Não foi possível concluir a ação.');
    return response.json() as Promise<Widget & { queued?: boolean }>;
  }
  async function save() {
    if (!selected || savingWidget) return;
    setSavingWidget(true);
    try {
      const updated = await request('', 'PUT', {
        name: selected.name,
        enabled: selected.enabled,
        config: selected.config,
      });
      setWidgets((all) =>
        all.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
      setSelected({ ...selected, ...updated });
      setStatus('Alterações salvas.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSavingWidget(false);
    }
  }
  async function toggleWidget(widget: Widget) {
    if (togglingWidgetId) return;
    setTogglingWidgetId(widget.id);
    try {
      const updated = await request(
        '',
        'PUT',
        {
          name: widget.name,
          enabled: !widget.enabled,
          config: widget.config,
        },
        widget.id,
      );
      setWidgets((all) =>
        all.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
      if (selected?.id === updated.id)
        setSelected((current) =>
          current ? { ...current, ...updated } : current,
        );
      setStatus(updated.enabled ? 'Widget ativado.' : 'Widget desativado.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setTogglingWidgetId(undefined);
    }
  }
  async function toggleCatalogWidget(type: string, name: string) {
    const existing = widgets.find((widget) => widget.type === type);
    if (existing) {
      await toggleWidget(existing);
      return;
    }
    if (togglingWidgetId) return;
    setTogglingWidgetId(type);
    try {
      const response = await fetch(`${api}/dashboard/widgets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, name }),
      });
      if (!response.ok) throw new Error('Não foi possível ativar o widget.');
      const created = (await response.json()) as Widget;
      setWidgets((all) => [
        ...all,
        {
          ...created,
          channelReady: true,
          obsConnected: false,
        },
      ]);
      setStatus('Widget ativado. Agora você pode configurá-lo.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setTogglingWidgetId(undefined);
    }
  }
  async function action(
    name: 'test' | 'duplicate' | 'rotate-token',
    target = selected,
  ) {
    if (!target) return;
    try {
      const result = await request(
        `/${name}`,
        'POST',
        name === 'test'
          ? {
              videoUrl: target.config.testVideoUrl,
              songPlaybackUrl: target.config.testSongPlaybackUrl,
            }
          : undefined,
        target.id,
      );
      if (name === 'duplicate') {
        setWidgets((all) => [...all, result]);
        setSelected(result);
      } else if (name === 'rotate-token')
        setSelected({ ...target, browserSourceUrl: result.browserSourceUrl });
      setStatus(
        name === 'test'
          ? 'Teste enviado para a Browser Source.'
          : name === 'duplicate'
            ? 'Widget duplicado.'
            : 'Nova URL criada; a anterior foi revogada.',
      );
    } catch (error) {
      setStatus((error as Error).message);
    }
  }
  async function remove() {
    if (!selected) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setStatus(
        `Clique novamente para excluir “${selected.name}” e revogar sua URL.`,
      );
      return;
    }
    try {
      await request('', 'DELETE');
      setWidgets((all) => all.filter((item) => item.id !== selected.id));
      setSelected(undefined);
      setConfirmDelete(false);
      setStatus('Widget excluído.');
    } catch (error) {
      setStatus((error as Error).message);
    }
  }
  return (
    <PanelShell>
      <main className="feature-page widgets-hub">
        <PageHeader
          eyebrow="Transmissão"
          title="Widgets"
          description="Adicione elementos à sua transmissão e personalize como eles aparecem no OBS."
          actions={
            <>
              <ObsConnectionStatus
                connected={widgets.some((item) => item.obsConnected)}
              />
              <button
                className="secondary-button"
                onClick={() => setShowObsGuide(true)}
              >
                Como adicionar ao OBS
              </button>
              <Link className="secondary-button button-link" href="/alertas">
                Alertas
              </Link>
              <Link
                className="primary-button button-link"
                href="#adicionar-widget"
              >
                Adicionar widget
              </Link>
            </>
          }
        />
        <section className="widget-summary" aria-label="Resumo dos widgets">
          <div>
            <span>Widgets criados</span>
            <strong>{widgets.length}</strong>
          </div>
          <div>
            <span>Ativos</span>
            <strong>{activeCount}</strong>
            <small className="summary-dot active" />
          </div>
          <div>
            <span>Conectados ao OBS</span>
            <strong>{connectedCount}</strong>
            <small
              className={`summary-dot ${connectedCount ? 'connected' : ''}`}
            />
          </div>
          <div>
            <span>Precisam de atenção</span>
            <strong>{widgets.length - activeCount}</strong>
          </div>
        </section>
        <section className="widget-kind-guide" id="instalar-obs">
          <div className="unified-overlay-copy">
            <span className="section-kicker">Alertas da transmissão</span>
            <h2>Alertas temporários e widgets fixos</h2>
            <p>
              Alertas temporários usam uma única fonte no OBS. Elementos
              permanentes, como metas e QR Code, possuem fontes próprias.
            </p>
          </div>
          <Link className="primary-button button-link" href="/alertas">
            Configurar alertas
          </Link>
        </section>
        {loadingWidgets ? (
          <section
            className="widget-card-grid"
            aria-label="Carregando widgets"
            aria-busy="true"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <div className="widget-card-skeleton" key={index}>
                <i />
                <span />
                <span />
              </div>
            ))}
          </section>
        ) : visible.length ? (
          <section className="widget-card-grid">
            {visible.map((widget) => (
              <article
                className={`managed-widget-card ${selected?.id === widget.id ? 'selected' : ''}`}
                key={widget.id}
                onClick={() => setSelected(widget)}
              >
                <WidgetArtwork widget={widget} />
                <div className="widget-card-title">
                  <div>
                    <span className="widget-type-label">
                      {widgetMeta[widget.type]?.icon}{' '}
                      {names[widget.type] ?? widget.type}
                    </span>
                    <h2>{widget.name}</h2>
                    <small>{widgetMeta[widget.type]?.description}</small>
                  </div>
                  <button
                    aria-label={`${widget.enabled ? 'Desativar' : 'Ativar'} ${widget.name}`}
                    aria-pressed={widget.enabled}
                    className={`widget-state-toggle ${widget.enabled ? 'active' : 'inactive'}`}
                    disabled={togglingWidgetId === widget.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleWidget(widget);
                    }}
                    title={
                      widget.enabled ? 'Desativar widget' : 'Ativar widget'
                    }
                    type="button"
                  >
                    <i />
                    {togglingWidgetId === widget.id
                      ? 'Salvando…'
                      : widget.enabled
                        ? 'Ativo'
                        : 'Inativo'}
                  </button>
                </div>
                <div className="widget-delivery-mode">
                  <StatusBadge tone="neutral">
                    {unifiedAlertTypes.has(widget.type)
                      ? 'Overlay unificado'
                      : 'URL própria'}
                  </StatusBadge>
                  <span>{widget.enabled ? 'Configurado' : 'Desativado'}</span>
                </div>
                <ObsConnectionStatus
                  connected={widget.obsConnected}
                  lastHeartbeat={widget.lastHeartbeatAt}
                />
                <small className="widget-updated">
                  Atualizado em{' '}
                  {Number.isNaN(new Date(widget.updatedAt).getTime())
                    ? 'horário indisponível'
                    : new Date(widget.updatedAt).toLocaleDateString('pt-BR')}
                </small>
                <div className="compact-actions widget-card-actions">
                  <button
                    className="primary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void action('test', widget);
                    }}
                  >
                    Testar
                  </button>
                  <button
                    className="secondary-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(widget);
                    }}
                  >
                    Configurar
                  </button>
                  {!unifiedAlertTypes.has(widget.type) &&
                  widget.browserSourceUrl ? (
                    <button
                      className="secondary-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void navigator.clipboard.writeText(
                          widget.browserSourceUrl ?? '',
                        );
                        setStatus('URL do widget copiada para o OBS.');
                      }}
                    >
                      Copiar URL
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ) : !widgets.length && status ? (
          <EmptyState
            title="Não foi possível carregar os widgets"
            description={status}
            action={
              <button
                onClick={() => {
                  setLoadingWidgets(true);
                  void load();
                }}
              >
                Tentar novamente
              </button>
            }
          />
        ) : null}
        <section
          className="add-widget-section"
          id="adicionar-widget"
          aria-labelledby="add-widget-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">Catálogo</span>
              <h2 id="add-widget-title">Adicionar widget</h2>
              <p>
                Escolha uma ferramenta oficial da StreamOS. Não é necessário
                criar um widget do zero.
              </p>
            </div>
          </div>
          <div className="fixed-widget-catalog">
            {productCatalog.map((item) => {
              const widget = widgets.find(
                (candidate) => candidate.type === item.type,
              );
              const active = widget?.enabled ?? false;
              const toggling = togglingWidgetId === (widget?.id ?? item.type);
              return (
                <article key={item.type}>
                  <button
                    aria-label={`${active ? 'Desativar' : 'Ativar'} ${item.name}`}
                    aria-pressed={active}
                    className={`widget-state-toggle catalog-widget-state ${active ? 'active' : 'inactive'}`}
                    disabled={toggling}
                    onClick={() =>
                      void toggleCatalogWidget(item.type, item.name)
                    }
                    title={active ? 'Desativar widget' : 'Ativar widget'}
                    type="button"
                  >
                    <i />
                    {toggling ? 'Salvando…' : active ? 'Desativar' : 'Ativar'}
                  </button>
                  <span
                    className={`widget-type-icon type-${item.type.toLowerCase()}`}
                  >
                    {widgetMeta[item.type]?.icon ?? '◇'}
                  </span>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <small>{item.detail}</small>
                  </div>
                  <Link
                    className="secondary-button button-link"
                    href={item.href}
                  >
                    {item.action}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
        {selected ? (
          <div
            className="editor-backdrop"
            onMouseDown={() => setSelected(undefined)}
          >
            <aside
              className="widget-drawer"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <span className="section-kicker">
                    {names[selected.type] ?? selected.type}
                  </span>
                  <h2>{selected.name}</h2>
                </div>
                <div className="widget-drawer-header-actions">
                  <button
                    className="primary-button"
                    disabled={savingWidget}
                    onClick={() => void save()}
                  >
                    {savingWidget ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                  <button
                    aria-label="Fechar editor"
                    className="icon-button"
                    onClick={() => setSelected(undefined)}
                  >
                    ×
                  </button>
                </div>
              </header>
              <div className="widget-drawer-body">
                <div className="widget-settings-column">
                  <fieldset className="widget-config-section widget-general-section">
                    <legend>Informações gerais</legend>
                    <p>Organize o widget e defina sua identidade visual.</p>
                    <label>
                      Nome interno
                      <input
                        value={selected.name}
                        onChange={(event) =>
                          setSelected({ ...selected, name: event.target.value })
                        }
                      />
                      <small>Visível somente para você no painel.</small>
                    </label>
                    <div className="widget-general-row">
                      <label>
                        Cor principal
                        <span className="widget-color-control">
                          <input
                            aria-label="Selecionar cor principal"
                            type="color"
                            value={
                              typeof selected.config.accent === 'string'
                                ? selected.config.accent
                                : '#a98cff'
                            }
                            onChange={(event) =>
                              setSelected({
                                ...selected,
                                config: {
                                  ...selected.config,
                                  accent: event.target.value,
                                },
                              })
                            }
                          />
                          <code>
                            {configText('accent', '#a98cff').toUpperCase()}
                          </code>
                        </span>
                      </label>
                      <label className="widget-enabled-control">
                        Disponibilidade
                        <button
                          aria-pressed={selected.enabled}
                          className={`widget-state-toggle ${selected.enabled ? 'active' : 'inactive'}`}
                          onClick={() =>
                            setSelected({
                              ...selected,
                              enabled: !selected.enabled,
                            })
                          }
                          type="button"
                        >
                          <i />
                          {selected.enabled ? 'Ativo' : 'Inativo'}
                        </button>
                      </label>
                    </div>
                  </fieldset>
                  {selected.type === 'QR_CODE' ? (
                    <fieldset className="widget-config-section">
                      <legend>QR Code</legend>
                      <label>
                        Texto exibido
                        <input
                          value={configText('label', 'Apoie a live')}
                          onChange={(event) =>
                            updateSelectedConfig('label', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Tamanho
                        <input
                          type="range"
                          min="120"
                          max="640"
                          value={configNumber('size', 280)}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'size',
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                      <label>
                        Fundo
                        <select
                          value={configText('background', 'transparent')}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'background',
                              event.target.value,
                            )
                          }
                        >
                          <option value="transparent">Transparente</option>
                          <option value="solid">Cor sólida</option>
                        </select>
                      </label>
                      <label>
                        Exibição
                        <select
                          value={configText('displayMode', 'persistent')}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'displayMode',
                              event.target.value,
                            )
                          }
                        >
                          <option value="persistent">Sempre visível</option>
                          <option value="interval">
                            Alternar por intervalo
                          </option>
                        </select>
                      </label>
                    </fieldset>
                  ) : null}
                  {selected.type === 'GOAL' || selected.type === 'CAMPAIGN' ? (
                    <fieldset className="widget-config-section">
                      <legend>Meta e progresso</legend>
                      <label>
                        Título
                        <input
                          value={configText(
                            'title',
                            selected.type === 'GOAL'
                              ? 'Meta da comunidade'
                              : 'Vaquinha',
                          )}
                          onChange={(event) =>
                            updateSelectedConfig('title', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Formato
                        <select
                          value={configText('format', 'horizontal')}
                          onChange={(event) =>
                            updateSelectedConfig('format', event.target.value)
                          }
                        >
                          <option value="horizontal">Horizontal</option>
                          <option value="compact">Compacto</option>
                        </select>
                      </label>
                      <label className="consent-field">
                        <input
                          type="checkbox"
                          checked={selected.config.showAmount !== false}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'showAmount',
                              event.target.checked,
                            )
                          }
                        />{' '}
                        Exibir valores
                      </label>
                      <label className="consent-field">
                        <input
                          type="checkbox"
                          checked={selected.config.hideWhenComplete === true}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'hideWhenComplete',
                              event.target.checked,
                            )
                          }
                        />{' '}
                        Ocultar ao concluir
                      </label>
                    </fieldset>
                  ) : null}
                  {[
                    'RANKING',
                    'RECENT_CONTRIBUTIONS',
                    'SUPPORTERS_PANEL',
                  ].includes(selected.type) ? (
                    <fieldset className="widget-config-section">
                      <legend>Lista de apoiadores</legend>
                      <label>
                        Período
                        <select
                          value={configText('period', 'MONTH')}
                          onChange={(event) =>
                            updateSelectedConfig('period', event.target.value)
                          }
                        >
                          <option value="DAY">Hoje</option>
                          <option value="WEEK">Semana</option>
                          <option value="MONTH">Mês</option>
                          <option value="YEAR">Ano</option>
                        </select>
                      </label>
                      <label>
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={configNumber('limit', 5)}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'limit',
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                      <label>
                        Layout
                        <select
                          value={configText('orientation', 'vertical')}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'orientation',
                              event.target.value,
                            )
                          }
                        >
                          <option value="vertical">Vertical</option>
                          <option value="horizontal">Horizontal</option>
                        </select>
                      </label>
                      <label className="consent-field">
                        <input
                          type="checkbox"
                          checked={selected.config.showAmount !== false}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'showAmount',
                              event.target.checked,
                            )
                          }
                        />{' '}
                        Exibir valores
                      </label>
                    </fieldset>
                  ) : null}
                  {selected.type === 'MARATHON' ? (
                    <fieldset className="widget-config-section">
                      <legend>Maratona</legend>
                      <label>
                        Tempo inicial (minutos)
                        <input
                          type="number"
                          min="0"
                          value={configNumber('initialMinutes', 60)}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'initialMinutes',
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                      <label>
                        Segundos adicionados por real
                        <input
                          type="number"
                          min="0"
                          value={configNumber('durationPerContribution', 60)}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'durationPerContribution',
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                      <label>
                        Formato
                        <select
                          value={configText('clockFormat', 'HH:mm:ss')}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'clockFormat',
                              event.target.value,
                            )
                          }
                        >
                          <option value="HH:mm:ss">
                            Horas, minutos e segundos
                          </option>
                          <option value="mm:ss">Minutos e segundos</option>
                        </select>
                      </label>
                      <label className="consent-field">
                        <input
                          type="checkbox"
                          checked={selected.config.warningSound !== false}
                          onChange={(event) =>
                            updateSelectedConfig(
                              'warningSound',
                              event.target.checked,
                            )
                          }
                        />{' '}
                        Avisar quando o tempo estiver acabando
                      </label>
                    </fieldset>
                  ) : null}
                  {selected.type === 'BANNER' ||
                  selected.type === 'CUSTOM_TEXT' ? (
                    <fieldset className="widget-config-section">
                      <legend>Conteúdo</legend>
                      <label>
                        Texto
                        <textarea
                          rows={4}
                          value={configText(
                            'text',
                            'Sua mensagem aparece aqui',
                          )}
                          onChange={(event) =>
                            updateSelectedConfig('text', event.target.value)
                          }
                        />
                      </label>
                      {selected.type === 'BANNER' ? (
                        <label>
                          Alternar a cada (segundos)
                          <input
                            type="number"
                            min="3"
                            max="300"
                            value={configNumber('rotationSeconds', 15)}
                            onChange={(event) =>
                              updateSelectedConfig(
                                'rotationSeconds',
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                      ) : (
                        <label>
                          Tamanho do texto
                          <input
                            type="range"
                            min="12"
                            max="96"
                            value={configNumber('fontSize', 32)}
                            onChange={(event) =>
                              updateSelectedConfig(
                                'fontSize',
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                      )}
                    </fieldset>
                  ) : null}
                  {unifiedAlertTypes.has(selected.type) ? (
                    <label>
                      Área principal do alerta
                      <select
                        value={
                          typeof selected.config.layoutPreset === 'string'
                            ? selected.config.layoutPreset
                            : 'full'
                        }
                        onChange={(event) =>
                          setSelected({
                            ...selected,
                            config: {
                              ...selected.config,
                              layoutPreset: event.target.value,
                            },
                          })
                        }
                      >
                        <option value="full">Tela inteira</option>
                        <option value="safe">Área segura</option>
                        <option value="center">Centro da cena</option>
                      </select>
                    </label>
                  ) : null}
                  {selected.type === 'SONG_PIX' ? (
                    <label>
                      Posição do player compacto
                      <select
                        value={
                          typeof selected.config.compactPosition === 'string'
                            ? selected.config.compactPosition
                            : 'bottom-right'
                        }
                        onChange={(event) =>
                          setSelected({
                            ...selected,
                            config: {
                              ...selected.config,
                              compactPosition: event.target.value,
                            },
                          })
                        }
                      >
                        <option value="bottom-right">Inferior direito</option>
                        <option value="bottom-left">Inferior esquerdo</option>
                        <option value="bottom-center">Inferior central</option>
                        <option value="top-right">Superior direito</option>
                        <option value="top-left">Superior esquerdo</option>
                      </select>
                    </label>
                  ) : null}
                  {selected.type === 'VIDEO_PIX' ? (
                    <label>
                      Vídeo real para o botão Testar
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={
                          typeof selected.config.testVideoUrl === 'string'
                            ? selected.config.testVideoUrl
                            : ''
                        }
                        onChange={(event) =>
                          setSelected({
                            ...selected,
                            config: {
                              ...selected.config,
                              testVideoUrl: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ) : null}
                  {selected.type === 'SONG_PIX' ? (
                    <label>
                      Música real para o botão Testar
                      <input
                        type="url"
                        placeholder="Link do YouTube ou arquivo MP3 HTTPS"
                        value={
                          typeof selected.config.testSongPlaybackUrl ===
                          'string'
                            ? selected.config.testSongPlaybackUrl
                            : ''
                        }
                        onChange={(event) =>
                          setSelected({
                            ...selected,
                            config: {
                              ...selected.config,
                              testSongPlaybackUrl: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ) : null}
                </div>
                <aside className="widget-preview-column">
                  <div className="drawer-preview">
                    <span>Prévia da transmissão</span>
                    <WidgetArtwork widget={selected} />
                  </div>
                  <div className="compact-actions widget-preview-actions">
                    <button onClick={() => void action('test')}>
                      Testar no OBS
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => void action('duplicate')}
                    >
                      Duplicar
                    </button>
                  </div>
                  <div className="obs-instructions">
                    <span className="section-kicker">Instalação</span>
                    <h3>Adicionar ao OBS</h3>
                    {unifiedAlertTypes.has(selected.type) ? (
                      <>
                        <p>Este alerta já faz parte da URL única de alertas.</p>
                        <ol>
                          <li>Copie a URL de alertas no topo desta página.</li>
                          <li>Adicione somente uma fonte Navegador.</li>
                          <li>Use 1920 × 1080 e 30 FPS.</li>
                          <li>Volte aqui e clique em Testar.</li>
                        </ol>
                      </>
                    ) : (
                      <>
                        <p>
                          Este é um widget fixo e precisa de uma Browser Source
                          própria para ser posicionado na cena.
                        </p>
                        <SecretUrlField
                          value={selected.browserSourceUrl}
                          onRotate={() => void action('rotate-token')}
                        />
                        <ol>
                          <li>Gere e copie a URL secreta deste widget.</li>
                          <li>Adicione uma fonte Navegador no OBS.</li>
                          <li>Posicione e dimensione livremente na cena.</li>
                        </ol>
                      </>
                    )}
                  </div>
                </aside>
              </div>
              <footer>
                <span>
                  {status || `Configuração ${selected.configVersion}`}
                </span>
                <button className="danger-button" onClick={() => void remove()}>
                  {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
                </button>
                <button disabled={savingWidget} onClick={() => void save()}>
                  {savingWidget ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </footer>
            </aside>
          </div>
        ) : null}
        {showObsGuide ? (
          <div
            className="editor-backdrop obs-guide-backdrop"
            onMouseDown={() => setShowObsGuide(false)}
          >
            <section
              className="obs-guide-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="obs-guide-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <span className="section-kicker">Configuração rápida</span>
                  <h2 id="obs-guide-title">Adicionar ao OBS</h2>
                </div>
                <button
                  className="icon-button"
                  aria-label="Fechar instruções"
                  onClick={() => setShowObsGuide(false)}
                >
                  ×
                </button>
              </header>
              <p>
                Você configura uma vez e usa a mesma fonte para todos os alertas
                temporários.
              </p>
              <ol className="obs-guide-steps">
                <li>
                  <b>1</b>
                  <span>
                    <strong>Abra o OBS</strong>Na área Fontes, clique em +.
                  </span>
                </li>
                <li>
                  <b>2</b>
                  <span>
                    <strong>Escolha Navegador</strong>Dê o nome “Alertas
                    StreamOS”.
                  </span>
                </li>
                <li>
                  <b>3</b>
                  <span>
                    <strong>Cole a URL secreta</strong>Copie a URL no card
                    Alertas da transmissão.
                  </span>
                </li>
                <li>
                  <b>4</b>
                  <span>
                    <strong>Defina o tamanho</strong>Use 1920 × 1080 ou 1080 ×
                    1920 para lives verticais.
                  </span>
                </li>
                <li>
                  <b>5</b>
                  <span>
                    <strong>Controle o áudio</strong>Marque “Controlar áudio
                    pelo OBS”.
                  </span>
                </li>
                <li>
                  <b>6</b>
                  <span>
                    <strong>Envie um teste</strong>A fonte fica transparente
                    enquanto nenhum alerta toca.
                  </span>
                </li>
              </ol>
              <details>
                <summary>O alerta não apareceu</summary>
                <p>
                  Confirme se a fonte está visível, acima do jogo e se o
                  indicador mostra “OBS conectado”. Atualize o cache da fonte se
                  necessário.
                </p>
              </details>
              <details>
                <summary>O alerta apareceu sem som</summary>
                <p>
                  Ative “Controlar áudio pelo OBS” e confira se a fonte não está
                  silenciada no mixer.
                </p>
              </details>
              <footer>
                <button
                  className="secondary-button"
                  onClick={() => setShowObsGuide(false)}
                >
                  Fechar
                </button>
                <a
                  className="primary-button button-link"
                  href="#instalar-obs"
                  onClick={() => setShowObsGuide(false)}
                >
                  Já adicionei, enviar teste
                </a>
              </footer>
            </section>
          </div>
        ) : null}
        {status ? (
          <p className="account-status" role="status">
            {status}
          </p>
        ) : null}
      </main>
    </PanelShell>
  );
}
