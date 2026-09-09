'use client';

import { useEffect, useState } from 'react';

type Theme = {
  template: string;
  accent: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  textAlign: string;
  position: string;
};
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const fallback: Theme = {
  template: 'neon-pulse',
  accent: '#a98cff',
  textColor: '#ffffff',
  fontFamily: 'Inter',
  fontSize: 32,
  textAlign: 'center',
  position: 'center',
};
const templates: Array<{
  value: string;
  label: string;
  description: string;
  preset: Omit<Theme, 'template'>;
}> = [
  {
    value: 'neon-pulse',
    label: 'StreamOS',
    description: 'Destaque neon central',
    preset: {
      accent: '#a98cff',
      textColor: '#ffffff',
      fontFamily: 'Inter',
      fontSize: 32,
      textAlign: 'center',
      position: 'center',
    },
  },
  {
    value: 'card',
    label: 'Card clássico',
    description: 'Card sólido e legível',
    preset: {
      accent: '#3b82f6',
      textColor: '#ffffff',
      fontFamily: 'DM Sans',
      fontSize: 30,
      textAlign: 'left',
      position: 'center',
    },
  },
  {
    value: 'minimal',
    label: 'Minimalista',
    description: 'Somente o essencial',
    preset: {
      accent: '#ffffff',
      textColor: '#ffffff',
      fontFamily: 'Inter',
      fontSize: 28,
      textAlign: 'center',
      position: 'center',
    },
  },
  {
    value: 'video-focus',
    label: 'Vídeo',
    description: 'Área ampla para mídia',
    preset: {
      accent: '#ef4444',
      textColor: '#ffffff',
      fontFamily: 'Roboto',
      fontSize: 30,
      textAlign: 'center',
      position: 'center',
    },
  },
  {
    value: 'song-compact',
    label: 'Música',
    description: 'Compacto no canto',
    preset: {
      accent: '#ec4899',
      textColor: '#ffffff',
      fontFamily: 'Montserrat',
      fontSize: 24,
      textAlign: 'left',
      position: 'bottom-right',
    },
  },
];

export function AppearanceEditor() {
  const [theme, setTheme] = useState<Theme>(fallback);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [status, setStatus] = useState('Carregando tema global…');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void fetch(`${api}/dashboard/alerts/appearance`, {
      credentials: 'include',
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok)
        return setStatus('Entre na sua conta para editar o tema global.');
      const body = (await response.json()) as { theme: Theme };
      setTheme({ ...fallback, ...body.theme });
      setStatus('Tema global sincronizado.');
    });
  }, []);
  function update<K extends keyof Theme>(key: K, value: Theme[K]) {
    setTheme((current) => ({ ...current, [key]: value }));
    setStatus('Alterações ainda não salvas.');
  }
  function selectTemplate(template: (typeof templates)[number]) {
    setTheme({ template: template.value, ...template.preset });
    setStatus(`${template.label} selecionado. Salve para aplicar no OBS.`);
  }
  async function save() {
    setSaving(true);
    setStatus('Salvando…');
    const response = await fetch(`${api}/dashboard/alerts/appearance`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...theme, applyToExisting }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      return setStatus(
        body.message ?? 'Não foi possível salvar o tema global.',
      );
    }
    setStatus(
      applyToExisting
        ? 'Tema global salvo e aplicado às variações existentes.'
        : 'Tema global salvo como padrão para novas variações.',
    );
  }
  return (
    <div className="appearance-editor">
      <section className="appearance-form" aria-labelledby="global-theme-title">
        <div className="appearance-section-heading">
          <span className="section-kicker">Tema global</span>
          <h2 id="global-theme-title">Visual do canal</h2>
          <p>Escolha um ponto de partida consistente para os alertas.</p>
        </div>
        <div
          className="appearance-template-grid"
          role="radiogroup"
          aria-label="Visual padrão"
        >
          {templates
            .filter(
              (template) =>
                template.value !== 'video-focus' &&
                template.value !== 'song-compact',
            )
            .map((template) => (
              <button
                type="button"
                role="radio"
                aria-checked={theme.template === template.value}
                aria-label={`Usar visual ${template.label}: ${template.description}`}
                className={theme.template === template.value ? 'selected' : ''}
                key={template.value}
                onClick={() => selectTemplate(template)}
              >
                <span
                  className={`alert-template-demo template-${template.value}`}
                >
                  <i aria-hidden="true" />
                  <b>Novo apoio</b>
                  <small>Lucas · R$ 20,00</small>
                </span>
                <strong>{template.label}</strong>
                <small>{template.description}</small>
              </button>
            ))}
        </div>
        <div className="appearance-fields">
          <label>
            <span>Cor principal</span>
            <input
              type="color"
              value={theme.accent}
              onChange={(e) => update('accent', e.target.value)}
            />
          </label>
          <label>
            <span>Cor do texto</span>
            <input
              type="color"
              value={theme.textColor}
              onChange={(e) => update('textColor', e.target.value)}
            />
          </label>
          <label>
            <span>Fonte</span>
            <select
              value={theme.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
            >
              <option>Inter</option>
              <option>DM Sans</option>
              <option>Montserrat</option>
              <option>Roboto</option>
            </select>
          </label>
          <label>
            <span>Tamanho da fonte</span>
            <input
              type="number"
              min="12"
              max="96"
              value={theme.fontSize}
              onChange={(e) => update('fontSize', Number(e.target.value))}
            />
          </label>
          <label>
            <span>Alinhamento</span>
            <select
              value={theme.textAlign}
              onChange={(e) => update('textAlign', e.target.value)}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </label>
          <label>
            <span>Posição padrão</span>
            <select
              value={theme.position}
              onChange={(e) => update('position', e.target.value)}
            >
              <option value="center">Centro</option>
              <option value="top-center">Centro superior</option>
              <option value="bottom-center">Centro inferior</option>
              <option value="top-left">Superior esquerdo</option>
              <option value="top-right">Superior direito</option>
              <option value="bottom-left">Inferior esquerdo</option>
              <option value="bottom-right">Inferior direito</option>
              <option value="full">Tela inteira</option>
            </select>
          </label>
        </div>
        <label className="appearance-propagate">
          <input
            type="checkbox"
            checked={applyToExisting}
            onChange={(e) => setApplyToExisting(e.target.checked)}
          />
          <span>
            <strong>Aplicar também às variações existentes</strong>
            <small>
              Substitui template, cores, fonte, alinhamento e posição atuais.
            </small>
          </span>
        </label>
        <div className="appearance-save-row">
          <button
            className="primary-button"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Salvando…' : 'Salvar tema global'}
          </button>
          <span role="status">{status}</span>
        </div>
      </section>
      <aside className="appearance-preview">
        <div>
          <span className="section-kicker">Prévia do OBS</span>
          <strong>Alerta padrão</strong>
        </div>
        <div
          className={`appearance-preview-canvas preview-position-${theme.position}`}
        >
          <article
            className={`appearance-preview-alert template-${theme.template}`}
            style={{
              borderColor: theme.accent,
              color: theme.textColor,
              fontFamily: `${theme.fontFamily}, sans-serif`,
              fontSize: theme.fontSize,
              textAlign: theme.textAlign as 'left' | 'center' | 'right',
            }}
          >
            <small style={{ color: theme.accent }}>NOVO APOIO</small>
            <strong>Lucas · R$ 20,00</strong>
            <p>Boa sorte na live!</p>
          </article>
        </div>
        <p>
          Variações individuais podem substituir este tema em Alertas e
          variações.
        </p>
      </aside>
    </div>
  );
}
