'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const labels: Record<string, string> = {
  GOAL: 'Meta',
  CAMPAIGN: 'Vaquinha',
  QR_CODE: 'QR Code',
  RANKING: 'Ranking',
  SUPPORTERS_PANEL: 'Painel de apoiadores',
  RECENT_CONTRIBUTIONS: 'Últimas contribuições',
  POLL: 'Enquete',
  MARATHON: 'Maratona',
  BANNER: 'Banner',
  CUSTOM_TEXT: 'Texto personalizado',
};
const defaults: Record<string, Record<string, unknown>> = {
  QR_CODE: { label: 'Apoie a live', size: 280, background: 'transparent' },
  GOAL: { title: 'Meta da comunidade', format: 'horizontal', showAmount: true },
  CAMPAIGN: { title: 'Vaquinha', format: 'horizontal', showAmount: true },
  RANKING: { limit: 5, period: 'MONTH', showAmount: true },
  SUPPORTERS_PANEL: { limit: 5, period: 'MONTH', showAmount: true },
  RECENT_CONTRIBUTIONS: { limit: 5, period: 'MONTH', showAmount: true },
  MARATHON: { initialMinutes: 60, durationPerContribution: 60 },
  BANNER: { text: 'Acompanhe e apoie a transmissão', rotationSeconds: 15 },
  CUSTOM_TEXT: { text: 'Sua mensagem aparece aqui', fontSize: 32 },
};
function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function CreateWidgetForm({ type }: { type: string }) {
  const router = useRouter();
  const title = labels[type] ?? 'Widget';
  const [name, setName] = useState(title);
  const [accent, setAccent] = useState('#a98cff');
  const [template, setTemplate] = useState('clean');
  const [config, setConfig] = useState<Record<string, unknown>>(
    defaults[type] ?? {},
  );
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const previewText = useMemo(
    () =>
      textValue(
        config.text,
        textValue(config.title, textValue(config.label, title)),
      ),
    [config, title],
  );
  const set = (key: string, value: unknown) =>
    setConfig((current) => ({ ...current, [key]: value }));
  async function create() {
    setSaving(true);
    setStatus('');
    try {
      const response = await fetch(`${api}/dashboard/widgets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, name }),
      });
      const created = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!response.ok || !created.id)
        throw new Error(created.message ?? 'Não foi possível criar o widget.');
      const saved = await fetch(`${api}/dashboard/widgets/${created.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          enabled,
          config: { ...config, accent, template },
        }),
      });
      if (!saved.ok)
        throw new Error(
          'O widget foi criado, mas a configuração não foi salva.',
        );
      setStatus('Widget criado. Abrindo seus widgets…');
      window.setTimeout(() => router.push('/widgets'), 500);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="widget-create-workspace">
      <div className="widget-create-main">
        <nav className="wizard-steps" aria-label="Etapas de criação">
          <b className="done">1 Tipo</b>
          <b className="active">2 Template e configuração</b>
          <b>3 Adicionar ao OBS</b>
        </nav>
        <section className="widget-editor-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Template</span>
              <h2>Escolha um ponto de partida</h2>
              <p>O card inteiro seleciona o visual.</p>
            </div>
          </div>
          <div
            className="widget-template-grid"
            role="radiogroup"
            aria-label="Templates oficiais"
          >
            {(
              [
                ['clean', 'Essencial'],
                ['glass', 'Glass'],
                ['compact', 'Compacto'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={template === value}
                className={`widget-template-option ${template === value ? 'selected' : ''}`}
                onClick={() => setTemplate(value)}
              >
                <span className={`template-demo ${value}`}>{previewText}</span>
                <strong>{label}</strong>
                <small>Template oficial</small>
              </button>
            ))}
            <button
              type="button"
              className="widget-template-option disabled"
              disabled
            >
              <span className="template-demo">Em breve</span>
              <strong>Comunidade</strong>
              <small>Em breve</small>
            </button>
          </div>
        </section>
        <section className="widget-editor-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Configuração</span>
              <h2>Personalize {title}</h2>
              <p>Somente opções relevantes para este tipo são exibidas.</p>
            </div>
          </div>
          <div className="widget-fields">
            <label>
              Nome interno
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
              <small>Visível apenas para você.</small>
            </label>
            <label>
              Cor principal
              <span className="color-setting">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                />
                <input
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                />
              </span>
            </label>
            {['GOAL', 'CAMPAIGN'].includes(type) && (
              <>
                <label>
                  Título
                  <input
                    value={textValue(config.title)}
                    onChange={(e) => set('title', e.target.value)}
                  />
                </label>
                <label>
                  Formato
                  <select
                    value={textValue(config.format, 'horizontal')}
                    onChange={(e) => set('format', e.target.value)}
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="compact">Compacto</option>
                  </select>
                </label>
              </>
            )}
            {type === 'QR_CODE' && (
              <>
                <label>
                  Texto auxiliar
                  <input
                    value={textValue(config.label)}
                    onChange={(e) => set('label', e.target.value)}
                  />
                </label>
                <label>
                  Tamanho: {Number(config.size ?? 280)} px
                  <input
                    type="range"
                    min="120"
                    max="640"
                    value={Number(config.size ?? 280)}
                    onChange={(e) => set('size', Number(e.target.value))}
                  />
                </label>
                <label>
                  Fundo
                  <select
                    value={textValue(config.background, 'transparent')}
                    onChange={(e) => set('background', e.target.value)}
                  >
                    <option value="transparent">Transparente</option>
                    <option value="solid">Cor sólida</option>
                  </select>
                </label>
              </>
            )}
            {['RANKING', 'SUPPORTERS_PANEL', 'RECENT_CONTRIBUTIONS'].includes(
              type,
            ) && (
              <>
                <label>
                  Quantidade
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={Number(config.limit ?? 5)}
                    onChange={(e) => set('limit', Number(e.target.value))}
                  />
                </label>
                <label>
                  Período
                  <select
                    value={textValue(config.period, 'MONTH')}
                    onChange={(e) => set('period', e.target.value)}
                  >
                    <option value="DAY">Hoje</option>
                    <option value="WEEK">Semana</option>
                    <option value="MONTH">Mês</option>
                    <option value="ALL">Todo o período</option>
                  </select>
                </label>
              </>
            )}
            {type === 'MARATHON' && (
              <>
                <label>
                  Tempo inicial (minutos)
                  <input
                    type="number"
                    min="0"
                    value={Number(config.initialMinutes ?? 60)}
                    onChange={(e) =>
                      set('initialMinutes', Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  Segundos adicionados por real
                  <input
                    type="number"
                    min="0"
                    value={Number(config.durationPerContribution ?? 60)}
                    onChange={(e) =>
                      set('durationPerContribution', Number(e.target.value))
                    }
                  />
                </label>
              </>
            )}
            {['BANNER', 'CUSTOM_TEXT'].includes(type) && (
              <label>
                Conteúdo
                <textarea
                  rows={4}
                  maxLength={500}
                  value={textValue(config.text)}
                  onChange={(e) => set('text', e.target.value)}
                />
              </label>
            )}
            {type === 'BANNER' && (
              <label>
                Alternar a cada (segundos)
                <input
                  type="number"
                  min="3"
                  max="300"
                  value={Number(config.rotationSeconds ?? 15)}
                  onChange={(e) =>
                    set('rotationSeconds', Number(e.target.value))
                  }
                />
              </label>
            )}
            {type === 'CUSTOM_TEXT' && (
              <label>
                Tamanho do texto: {Number(config.fontSize ?? 32)} px
                <input
                  type="range"
                  min="12"
                  max="96"
                  value={Number(config.fontSize ?? 32)}
                  onChange={(e) => set('fontSize', Number(e.target.value))}
                />
              </label>
            )}
            <label className="consent-field">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />{' '}
              Widget ativo
            </label>
          </div>
        </section>
        <div className="widget-save-bar">
          <button
            className="secondary-button"
            type="button"
            onClick={() => router.push('/widgets')}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || name.trim().length < 2}
            onClick={() => void create()}
          >
            {saving ? 'Salvando…' : 'Salvar widget'}
          </button>
          <span role="status">{status}</span>
        </div>
      </div>
      <aside className="widget-live-preview">
        <span className="section-kicker">Prévia no OBS</span>
        <div className="obs-preview-canvas">
          <div
            className={`obs-preview-widget template-${template}`}
            style={{ borderColor: accent, color: accent }}
          >
            <strong>{previewText}</strong>
            <small>{title} · StreamOS</small>
          </div>
        </div>
        <p>A área quadriculada representa a transparência da Browser Source.</p>
        <small>Tamanho recomendado: 800 × 400 px</small>
      </aside>
    </section>
  );
}
