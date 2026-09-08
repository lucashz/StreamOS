'use client';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import NextImage from 'next/image';
type Asset = {
  id: string;
  name: string;
  kind: string;
  url: string;
  mimeType: string;
};
type Variation = {
  id: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  minimumInCents: number | null;
  maximumInCents: number | null;
  template: string;
  accent: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  textAlign: string;
  layout: Record<string, unknown>;
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
  visualAssetId?: string | null;
  soundAssetId?: string | null;
  visualAsset?: Asset | null;
  soundAsset?: Asset | null;
  configVersion: number;
};
type GlobalTheme = {
  template?: string;
  accent?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  textAlign?: string;
  position?: string;
};
type Editor = {
  config?: { enabled?: boolean; theme?: GlobalTheme };
  variations: Variation[];
  assets: Asset[];
};
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export function AlertEditor() {
  const [editor, setEditor] = useState<Editor>({ variations: [], assets: [] });
  const [selected, setSelected] = useState<Variation>();
  const [status, setStatus] = useState('Carregando editor…');
  const [saving, setSaving] = useState(false);
  const [togglingAlerts, setTogglingAlerts] = useState(false);
  const [uploading, setUploading] = useState<'visual' | 'audio' | null>(null);
  const [previewFormat, setPreviewFormat] = useState<'16/9' | '9/16' | '1/1'>(
    '16/9',
  );
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewAnonymous, setPreviewAnonymous] = useState(false);
  const [previewLongText, setPreviewLongText] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const visualAssets = useMemo(
    () => editor.assets.filter((asset) => asset.kind !== 'AUDIO'),
    [editor.assets],
  );
  const soundAssets = useMemo(
    () => editor.assets.filter((asset) => asset.kind === 'AUDIO'),
    [editor.assets],
  );
  async function load(preferred?: string) {
    const response = await fetch(`${api}/dashboard/alerts/editor`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      setStatus('Entre na sua conta para editar alertas.');
      return;
    }
    const value = (await response.json()) as Editor;
    setEditor(value);
    setSelected(
      value.variations.find((item) => item.id === preferred) ??
        value.variations[0],
    );
    setStatus('Editor sincronizado');
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => setConfirmDelete(false), [selected?.id]);
  function update<K extends keyof Variation>(key: K, value: Variation[K]) {
    if (selected) setSelected({ ...selected, [key]: value });
  }
  function updateLayout(key: string, value: string) {
    if (selected)
      setSelected({
        ...selected,
        layout: { ...selected.layout, [key]: value },
      });
  }
  function selectAlertTemplate(template: string) {
    if (!selected) return;
    const presets: Record<string, Partial<Variation>> = {
      'neon-pulse': {
        accent: '#a98cff',
        textColor: '#ffffff',
        fontFamily: 'Inter',
        fontSize: 32,
        textAlign: 'center',
        layout: {
          direction: 'column',
          position: 'center',
          mediaFit: 'contain',
        },
      },
      card: {
        accent: '#3b82f6',
        textColor: '#ffffff',
        fontFamily: 'DM Sans',
        fontSize: 30,
        textAlign: 'left',
        layout: { direction: 'row', position: 'center', mediaFit: 'cover' },
      },
      minimal: {
        accent: '#ffffff',
        textColor: '#ffffff',
        fontFamily: 'Inter',
        fontSize: 28,
        textAlign: 'center',
        layout: {
          direction: 'column',
          position: 'center',
          mediaFit: 'contain',
        },
      },
    };
    setSelected({ ...selected, template, ...(presets[template] ?? {}) });
    setStatus('Template aplicado. Salve para atualizar o OBS.');
  }
  function errorMessage(body: unknown, fallback: string) {
    return body && typeof body === 'object' && 'message' in body
      ? String(body.message)
      : fallback;
  }
  async function toggleAlerts() {
    if (togglingAlerts) return;
    const enabled = !(editor.config?.enabled ?? true);
    setTogglingAlerts(true);
    const response = await fetch(`${api}/dashboard/alerts/enabled`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).catch(() => null);
    if (!response?.ok) {
      setStatus('Não foi possível alterar o estado dos alertas.');
      setTogglingAlerts(false);
      return;
    }
    setEditor((current) => ({
      ...current,
      config: { ...current.config, enabled },
    }));
    setStatus(
      enabled ? 'Widget de alertas ativado.' : 'Widget de alertas desativado.',
    );
    setTogglingAlerts(false);
  }
  async function save(): Promise<Variation | null> {
    if (!selected) return null;
    if (
      selected.maximumInCents !== null &&
      selected.maximumInCents < (selected.minimumInCents ?? 0)
    ) {
      setStatus('O valor máximo não pode ser menor que o valor mínimo.');
      return null;
    }
    if (selected.maximumDurationMs < selected.minimumDurationMs) {
      setStatus('A duração máxima não pode ser menor que a duração mínima.');
      return null;
    }
    setSaving(true);
    const response = await fetch(
      `${api}/dashboard/alerts/variations${selected.id ? `/${selected.id}` : ''}`,
      {
        method: selected.id ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(selected),
      },
    );
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(errorMessage(body, 'Não foi possível salvar.'));
      setSaving(false);
      return null;
    }
    const saved = body as Variation;
    setStatus('Variação salva e versionada.');
    setSaving(false);
    await load(saved.id);
    return saved;
  }
  async function action(actionName: 'duplicate' | 'delete' | 'test') {
    if (actionName === 'test') {
      const saved = await save();
      if (!saved) return;
      const response = await fetch(`${api}/dashboard/alerts/test`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variationId: saved.id }),
      });
      setStatus(
        response.ok
          ? 'Variação salva e enviada ao OBS.'
          : 'Não foi possível enviar o teste.',
      );
      return;
    }
    if (!selected?.id) return;
    const response = await fetch(
      `${api}/dashboard/alerts/variations/${selected.id}${actionName === 'duplicate' ? '/duplicate' : ''}`,
      {
        method: actionName === 'delete' ? 'DELETE' : 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: undefined,
      },
    );
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => ({}));
      setStatus(errorMessage(body, 'Ação não concluída.'));
      return;
    }
    setStatus('Editor atualizado.');
    await load();
  }
  async function testSequence() {
    const saved = await save();
    if (!saved) return;
    const response = await fetch(`${api}/dashboard/alerts/test`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sequence: true }),
    });
    setStatus(
      response.ok
        ? 'Teste da sequência enviado ao OBS.'
        : 'Não foi possível enviar o teste.',
    );
  }
  async function upload(file: File | undefined, target: 'visual' | 'audio') {
    if (!file) return;
    const allowed =
      target === 'audio'
        ? ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm']
        : ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setStatus(
        target === 'audio'
          ? 'Use um áudio MP3, OGG, WAV ou WebM.'
          : 'Use uma imagem PNG, JPG, WebP ou GIF.',
      );
      return;
    }
    if (file.size > 10_000_000) {
      setStatus('O arquivo deve ter no máximo 10 MB.');
      return;
    }
    const metadata = await inspectMedia(file).catch(() => ({
      durationMs: undefined,
      width: undefined,
      height: undefined,
    }));
    const form = new FormData();
    form.set('file', file);
    form.set('name', file.name);
    if (metadata.durationMs)
      form.set('durationMs', String(metadata.durationMs));
    if (metadata.width) form.set('width', String(metadata.width));
    if (metadata.height) form.set('height', String(metadata.height));
    setUploading(target);
    setStatus(target === 'audio' ? 'Enviando áudio…' : 'Enviando imagem…');
    const response = await fetch(`${api}/dashboard/alerts/assets/upload`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).catch(() => null);
    if (!response) {
      setStatus('A conexão falhou durante o upload. Tente novamente.');
      setUploading(null);
      return;
    }
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => ({}));
      setStatus(errorMessage(body, 'Upload recusado.'));
      setUploading(null);
      return;
    }
    const asset = (await response.json()) as Asset;
    setEditor((current) => ({
      ...current,
      assets: [asset, ...current.assets.filter((item) => item.id !== asset.id)],
    }));
    setSelected((current) =>
      current
        ? {
            ...current,
            [target === 'audio' ? 'soundAssetId' : 'visualAssetId']: asset.id,
          }
        : current,
    );
    setUploading(null);
    setStatus(
      `${target === 'audio' ? 'Áudio' : 'Imagem'} enviado e selecionado. Salve a variação para aplicar.`,
    );
  }
  if (!selected)
    return (
      <section className="feature-card">
        <p>{status}</p>
      </section>
    );
  const visual = editor.assets.find(
    (asset) => asset.id === selected.visualAssetId,
  );
  const sound = editor.assets.find(
    (asset) => asset.id === selected.soundAssetId,
  );
  const selectedPosition =
    typeof selected.layout.position === 'string'
      ? selected.layout.position
      : 'center';
  return (
    <div className="advanced-alert-editor">
      <section className="alert-widget-state-card">
        <div>
          <span className="section-kicker">Widget de alertas</span>
          <strong>
            {(editor.config?.enabled ?? true) ? 'Ativo' : 'Inativo'}
          </strong>
          <small>
            {(editor.config?.enabled ?? true)
              ? 'Novas contribuições podem aparecer no overlay do OBS.'
              : 'Os alertas estão pausados e não serão enviados ao OBS.'}
          </small>
        </div>
        <button
          aria-pressed={editor.config?.enabled ?? true}
          className={`widget-state-toggle ${(editor.config?.enabled ?? true) ? 'active' : 'inactive'}`}
          disabled={togglingAlerts}
          onClick={() => void toggleAlerts()}
          type="button"
        >
          <i />
          {togglingAlerts
            ? 'Salvando…'
            : (editor.config?.enabled ?? true)
              ? 'Ativo'
              : 'Ativar widget'}
        </button>
      </section>
      <section className="alert-editor-form alert-editor-form-full">
        <nav className="alert-editor-steps" aria-label="Etapas de configuração">
          <a href="#alerta-visual">
            <b>1</b>
            <span>Visual</span>
          </a>
          <a href="#alerta-duracao">
            <b>2</b>
            <span>Duração</span>
          </a>
          <a href="#alerta-som">
            <b>3</b>
            <span>Som</span>
          </a>
          <a href="#alerta-voz">
            <b>4</b>
            <span>Voz</span>
          </a>
          <a href="#alerta-regras">
            <b>5</b>
            <span>Regras</span>
          </a>
        </nav>
        <div className="editor-toolbar">
          <label className="toggle">
            <input
              type="checkbox"
              checked={selected.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
            />{' '}
            Variação ativa
          </label>
          <div>
            <button
              className="secondary-button"
              onClick={() => void action('test')}
            >
              Salvar e testar
            </button>
            <button
              className="secondary-button"
              onClick={() => void testSequence()}
            >
              Testar sequência
            </button>
          </div>
        </div>
        <section
          className="alert-template-picker"
          id="alerta-visual"
          aria-labelledby="alert-template-title"
        >
          <div>
            <span className="section-kicker">Template da variação</span>
            <h3 id="alert-template-title">Escolha um visual</h3>
          </div>
          <div role="radiogroup" aria-label="Templates oficiais">
            {(
              [
                ['neon-pulse', 'StreamOS'],
                ['card', 'Card clássico'],
                ['minimal', 'Minimalista'],
                ['video-focus', 'Vídeo'],
                ['song-compact', 'Música'],
              ] as const
            )
              .filter(
                ([value]) =>
                  value !== 'video-focus' && value !== 'song-compact',
              )
              .map(([value, label]) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected.template === value}
                  className={selected.template === value ? 'selected' : ''}
                  key={value}
                  onClick={() => selectAlertTemplate(value)}
                >
                  <span className={`alert-template-demo template-${value}`}>
                    Nova contribuição
                  </span>
                  <strong>{label}</strong>
                </button>
              ))}
          </div>
        </section>
        <section className="livepix-customize-card">
          <div className="livepix-card-heading">
            <h2>Customize</h2>
            <p>Modifique os valores abaixo para personalizar o alerta.</p>
          </div>
          <label>
            <strong>Cor do título</strong>
            <small>Cor do nome do apoiador e do valor</small>
            <input
              type="color"
              value={selected.accent}
              onChange={(event) => update('accent', event.target.value)}
            />
          </label>
          <label>
            <strong>Cor da mensagem</strong>
            <small>Cor da mensagem enviada</small>
            <input
              type="color"
              value={selected.textColor}
              onChange={(event) => update('textColor', event.target.value)}
            />
          </label>
          <label>
            <strong>Imagem</strong>
            <small>Imagem para exibir acima do título do alerta</small>
            <select
              value={selected.visualAssetId ?? ''}
              onChange={(event) =>
                update('visualAssetId', event.target.value || null)
              }
            >
              <option value="">Sem imagem</option>
              {visualAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className={`livepix-upload-box ${uploading === 'visual' ? 'uploading' : ''}`}
          >
            {visual ? (
              visual.kind === 'VIDEO' ? (
                <video muted playsInline src={visual.url} />
              ) : (
                <NextImage
                  unoptimized
                  src={visual.url}
                  alt="Prévia da imagem do alerta"
                  width={320}
                  height={180}
                />
              )
            ) : (
              <b aria-hidden="true">＋</b>
            )}
            <span>
              {uploading === 'visual'
                ? 'Enviando…'
                : visual
                  ? 'Trocar imagem'
                  : 'Enviar imagem'}
            </span>
            <small>PNG, JPG, WebP ou GIF · até 10 MB</small>
            <input
              hidden
              type="file"
              disabled={uploading !== null}
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void upload(file, 'visual');
              }}
            />
          </label>
        </section>

        <div className="livepix-config-heading">
          <h2>
            Configurações da variação{' '}
            {selected.isDefault ? 'Padrão' : selected.name}
          </h2>
          <p>Configure o comportamento deste alerta.</p>
        </div>

        <section
          className="livepix-setting-card livepix-duration-card"
          id="alerta-duracao"
        >
          <div className="livepix-card-heading">
            <h2>Duração do alerta</h2>
            <p>Configure a duração mínima e máxima do alerta.</p>
          </div>
          <label>
            <strong>Duração mínima</strong>
            <small>
              Tempo mínimo de exibição: {selected.minimumDurationMs / 1000}{' '}
              segundos
            </small>
            <input
              type="range"
              min="2"
              max="120"
              value={selected.minimumDurationMs / 1000}
              onChange={(event) =>
                update('minimumDurationMs', Number(event.target.value) * 1000)
              }
            />
          </label>
          <label>
            <strong>Duração máxima</strong>
            <small>
              Tempo máximo de exibição: {selected.maximumDurationMs / 1000}{' '}
              segundos
            </small>
            <input
              type="range"
              min="2"
              max="120"
              value={selected.maximumDurationMs / 1000}
              onChange={(event) =>
                update('maximumDurationMs', Number(event.target.value) * 1000)
              }
            />
          </label>
        </section>

        <section
          className="livepix-setting-card livepix-sound-card"
          id="alerta-som"
        >
          <div className="livepix-card-heading livepix-switch-heading">
            <div>
              <h2>Som de alerta</h2>
              <p>Toque um som ao receber uma notificação.</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={selected.soundVolume > 0}
                onChange={(event) =>
                  update('soundVolume', event.target.checked ? 80 : 0)
                }
              />
              <span />
            </label>
          </div>
          <label>
            <strong>Áudio</strong>
            <small>Personalize o som do alerta</small>
            <select
              value={selected.soundAssetId ?? ''}
              onChange={(event) =>
                update('soundAssetId', event.target.value || null)
              }
            >
              <option value="">Som padrão</option>
              {soundAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label className="secondary-button livepix-file-button">
            {uploading === 'audio'
              ? 'Enviando áudio…'
              : sound
                ? 'Trocar áudio'
                : 'Enviar áudio'}
            <input
              hidden
              type="file"
              disabled={uploading !== null}
              accept="audio/mpeg,audio/ogg,audio/wav,audio/webm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void upload(file, 'audio');
              }}
            />
          </label>
          {sound ? (
            <div className="alert-audio-preview">
              <div>
                <strong>{sound.name}</strong>
                <small>Prévia do som selecionado</small>
              </div>
              <audio controls preload="metadata" src={sound.url} />
            </div>
          ) : null}
          <label>
            <strong>Volume</strong>
            <small>Volume do som: {selected.soundVolume}%</small>
            <input
              type="range"
              min="0"
              max="100"
              value={selected.soundVolume}
              onChange={(event) =>
                update('soundVolume', Number(event.target.value))
              }
            />
          </label>
        </section>

        <section
          className="livepix-setting-card livepix-tts-card"
          id="alerta-voz"
        >
          <div className="livepix-card-heading livepix-switch-heading">
            <div>
              <h2>Text to Speech</h2>
              <p>Ler as mensagens recebidas usando Text to Speech.</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={selected.ttsEnabled}
                onChange={(event) => update('ttsEnabled', event.target.checked)}
              />
              <span />
            </label>
          </div>
          <label>
            <strong>Voz do Text to Speech</strong>
            <select
              disabled={!selected.ttsEnabled}
              value={selected.ttsVoice}
              onChange={(event) => update('ttsVoice', event.target.value)}
            >
              <option value="pt-BR-default">
                Vitória (Português do Brasil)
              </option>
              <option value="pt-BR-female">Português feminina</option>
              <option value="pt-BR-male">Português masculina</option>
              <option value="ai-popular-orator">IA · Orador popular</option>
              <option value="ai-commander">IA · Comandante</option>
            </select>
          </label>
          <label>
            <strong>Volume</strong>
            <small>Volume da voz: {selected.ttsVolume}%</small>
            <input
              disabled={!selected.ttsEnabled}
              type="range"
              min="0"
              max="100"
              value={selected.ttsVolume}
              onChange={(event) =>
                update('ttsVolume', Number(event.target.value))
              }
            />
          </label>
          <label className="consent-field">
            <input
              disabled={!selected.ttsEnabled}
              type="checkbox"
              checked={selected.showSupporter}
              onChange={(event) =>
                update('showSupporter', event.target.checked)
              }
            />{' '}
            Falar nome do autor
          </label>
          <label className="consent-field">
            <input
              disabled={!selected.ttsEnabled}
              type="checkbox"
              checked={selected.showAmount}
              onChange={(event) => update('showAmount', event.target.checked)}
            />{' '}
            Falar o valor
          </label>
        </section>

        <section className="livepix-setting-card livepix-info-card">
          <div className="livepix-card-heading">
            <h2>Informações</h2>
            <p>Defina um nome para facilitar a organização dos alertas.</p>
          </div>
          <label>
            <strong>Nome da variação</strong>
            <input
              value={selected.name}
              onChange={(event) => update('name', event.target.value)}
            />
            <small>Este nome é visível apenas para você.</small>
          </label>
        </section>

        <details className="livepix-advanced-card" id="alerta-regras">
          <summary>Configurações avançadas</summary>
          <div className="livepix-advanced-grid">
            <label>
              Variação ativa
              <input
                type="checkbox"
                checked={selected.enabled}
                onChange={(event) => update('enabled', event.target.checked)}
              />
            </label>
            <label>
              Prioridade
              <input
                type="number"
                min="-1000"
                max="1000"
                value={selected.priority}
                onChange={(event) =>
                  update('priority', Number(event.target.value))
                }
              />
            </label>
            <label>
              Valor mínimo (R$)
              <input
                disabled={selected.isDefault}
                type="number"
                min="0"
                step="0.01"
                value={(selected.minimumInCents ?? 0) / 100}
                onChange={(event) =>
                  update(
                    'minimumInCents',
                    Math.round(Number(event.target.value) * 100),
                  )
                }
              />
            </label>
            <label>
              Valor máximo (R$)
              <input
                disabled={selected.isDefault}
                type="number"
                min="0"
                step="0.01"
                placeholder="Sem limite"
                value={
                  selected.maximumInCents === null
                    ? ''
                    : selected.maximumInCents / 100
                }
                onChange={(event) =>
                  update(
                    'maximumInCents',
                    event.target.value === ''
                      ? null
                      : Math.round(Number(event.target.value) * 100),
                  )
                }
              />
            </label>
            <label>
              Região na cena
              <select
                value={
                  typeof selected.layout.position === 'string'
                    ? selected.layout.position
                    : 'center'
                }
                onChange={(event) =>
                  updateLayout('position', event.target.value)
                }
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
            <label>
              Alinhamento
              <select
                value={selected.textAlign}
                onChange={(event) => update('textAlign', event.target.value)}
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </label>
            <label>
              Fonte
              <input
                value={selected.fontFamily}
                onChange={(event) => update('fontFamily', event.target.value)}
              />
            </label>
            <label>
              Tamanho da fonte
              <input
                type="number"
                min="12"
                max="96"
                value={selected.fontSize}
                onChange={(event) =>
                  update('fontSize', Number(event.target.value))
                }
              />
            </label>
          </div>
        </details>
        {/* The primary cards above are the single source of truth for these
            controls. The previous duplicated legacy form was intentionally
            removed to avoid conflicting edits. */}
        <div className="editor-fields" hidden>
          <div className="editor-fields-heading">
            <span className="section-kicker">Informações</span>
            <h3>Nome e regras da variação</h3>
            <p>Defina quando esta aparência será usada.</p>
          </div>
          <label>
            Nome interno
            <input
              value={selected.name}
              onChange={(event) => update('name', event.target.value)}
            />
          </label>
          <label>
            Prioridade
            <input
              type="number"
              min="-1000"
              max="1000"
              value={selected.priority}
              onChange={(event) =>
                update('priority', Number(event.target.value))
              }
            />
          </label>
          <label>
            Valor mínimo (R$)
            <input
              disabled={selected.isDefault}
              type="number"
              min="0"
              step="0.01"
              value={(selected.minimumInCents ?? 0) / 100}
              onChange={(event) =>
                update(
                  'minimumInCents',
                  Math.round(Number(event.target.value) * 100),
                )
              }
            />
          </label>
          <label>
            Valor máximo (R$)
            <input
              disabled={selected.isDefault}
              type="number"
              min="0"
              step="0.01"
              placeholder="Sem limite"
              value={
                selected.maximumInCents === null
                  ? ''
                  : selected.maximumInCents / 100
              }
              onChange={(event) =>
                update(
                  'maximumInCents',
                  event.target.value === ''
                    ? null
                    : Math.round(Number(event.target.value) * 100),
                )
              }
            />
          </label>
          <div className="editor-fields-heading">
            <span className="section-kicker">Aparência</span>
            <h3>Posição e tipografia</h3>
            <p>Ajuste o visual sem alterar o conteúdo recebido.</p>
          </div>
          <label>
            Região na cena
            <select
              value={
                typeof selected.layout.position === 'string'
                  ? selected.layout.position
                  : 'center'
              }
              onChange={(event) => updateLayout('position', event.target.value)}
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
          <label>
            Alinhamento
            <select
              value={selected.textAlign}
              onChange={(event) => update('textAlign', event.target.value)}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </label>
          <label>
            Cor principal
            <input
              type="color"
              value={selected.accent}
              onChange={(event) => update('accent', event.target.value)}
            />
          </label>
          <label>
            Cor do texto
            <input
              type="color"
              value={selected.textColor}
              onChange={(event) => update('textColor', event.target.value)}
            />
          </label>
          <label>
            Fonte
            <input
              value={selected.fontFamily}
              onChange={(event) => update('fontFamily', event.target.value)}
            />
          </label>
          <label>
            Tamanho da fonte
            <input
              type="number"
              min="12"
              max="96"
              value={selected.fontSize}
              onChange={(event) =>
                update('fontSize', Number(event.target.value))
              }
            />
          </label>
          <div className="editor-fields-heading">
            <span className="section-kicker">Tempo</span>
            <h3>Duração do alerta</h3>
            <p>O alerta encerra automaticamente dentro deste intervalo.</p>
          </div>
          <label>
            Duração mínima (s)
            <input
              type="number"
              min="2"
              max="120"
              value={selected.minimumDurationMs / 1000}
              onChange={(event) =>
                update('minimumDurationMs', Number(event.target.value) * 1000)
              }
            />
          </label>
          <label>
            Duração máxima (s)
            <input
              type="number"
              min="2"
              max="120"
              value={selected.maximumDurationMs / 1000}
              onChange={(event) =>
                update('maximumDurationMs', Number(event.target.value) * 1000)
              }
            />
          </label>
          <div className="editor-fields-heading">
            <span className="section-kicker">Mídia</span>
            <h3>Imagem e som</h3>
            <p>Escolha arquivos da biblioteca e defina o volume.</p>
          </div>
          <label>
            Mídia visual
            <select
              value={selected.visualAssetId ?? ''}
              onChange={(event) =>
                update('visualAssetId', event.target.value || null)
              }
            >
              <option value="">Sem mídia</option>
              {visualAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Som
            <select
              value={selected.soundAssetId ?? ''}
              onChange={(event) =>
                update('soundAssetId', event.target.value || null)
              }
            >
              <option value="">Som padrão</option>
              {soundAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Volume do som: {selected.soundVolume}%
            <input
              type="range"
              min="0"
              max="100"
              value={selected.soundVolume}
              onChange={(event) =>
                update('soundVolume', Number(event.target.value))
              }
            />
          </label>
          <div className="editor-fields-heading">
            <span className="section-kicker">Voz</span>
            <h3>Text to Speech</h3>
            <p>Configure a leitura das mensagens recebidas.</p>
          </div>
          <label>
            Voz TTS
            <select
              value={selected.ttsVoice}
              onChange={(event) => update('ttsVoice', event.target.value)}
            >
              <option value="pt-BR-default">Português padrão</option>
              <option value="pt-BR-female">Português feminina</option>
              <option value="pt-BR-male">Português masculina</option>
              <option value="ai-popular-orator">IA · Orador popular</option>
              <option value="ai-commander">IA · Comandante</option>
            </select>
          </label>
          <label>
            Velocidade TTS: {selected.ttsRate.toFixed(1)}x
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={selected.ttsRate}
              onChange={(event) =>
                update('ttsRate', Number(event.target.value))
              }
            />
          </label>
          <label>
            Volume TTS: {selected.ttsVolume}%
            <input
              type="range"
              min="0"
              max="100"
              value={selected.ttsVolume}
              onChange={(event) =>
                update('ttsVolume', Number(event.target.value))
              }
            />
          </label>
        </div>
        <div className="display-options">
          <label>
            <input
              type="checkbox"
              checked={selected.showSupporter}
              onChange={(event) =>
                update('showSupporter', event.target.checked)
              }
            />{' '}
            Nome
          </label>
          <label>
            <input
              type="checkbox"
              checked={selected.showAmount}
              onChange={(event) => update('showAmount', event.target.checked)}
            />{' '}
            Valor
          </label>
          <label>
            <input
              type="checkbox"
              checked={selected.showMessage}
              onChange={(event) => update('showMessage', event.target.checked)}
            />{' '}
            Mensagem
          </label>
          <label>
            <input
              type="checkbox"
              checked={selected.ttsEnabled}
              onChange={(event) => update('ttsEnabled', event.target.checked)}
            />{' '}
            TTS
          </label>
        </div>
        <div className="editor-actions">
          <button
            className="primary-button"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Salvando…' : 'Salvar variação'}
          </button>
          {selected.id ? (
            <button
              className="secondary-button"
              onClick={() => void action('duplicate')}
            >
              Duplicar
            </button>
          ) : null}
          {selected.id && !selected.isDefault ? (
            <button
              className="danger-link"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  setStatus(
                    'Clique novamente para confirmar a exclusão desta variação.',
                  );
                  return;
                }
                setConfirmDelete(false);
                void action('delete');
              }}
            >
              {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
            </button>
          ) : null}
        </div>
        <p role="status">{status}</p>
      </section>
      <aside className="alert-live-preview">
        <div className="alert-preview-heading">
          <div>
            <span className="section-kicker">Prévia fiel ao OBS</span>
            <strong>Canvas {previewFormat} · área segura</strong>
          </div>
          <span className="status-badge neutral">{selectedPosition}</span>
        </div>
        <div
          className="alert-preview-controls"
          aria-label="Controles da prévia"
        >
          {(['16/9', '9/16', '1/1'] as const).map((format) => (
            <button
              key={format}
              className={previewFormat === format ? 'active' : ''}
              onClick={() => setPreviewFormat(format)}
            >
              {format}
            </button>
          ))}
          <label>
            Zoom{' '}
            <input
              type="range"
              min="60"
              max="120"
              value={previewZoom}
              onChange={(event) => setPreviewZoom(Number(event.target.value))}
            />
          </label>
          <button
            className={previewAnonymous ? 'active' : ''}
            onClick={() => setPreviewAnonymous((value) => !value)}
          >
            Anônimo
          </button>
          <button
            className={previewLongText ? 'active' : ''}
            onClick={() => setPreviewLongText((value) => !value)}
          >
            Texto longo
          </button>
          <button
            onClick={() => {
              setPreviewZoom(100);
              setPreviewAnonymous(false);
              setPreviewLongText(false);
            }}
          >
            Restaurar
          </button>
        </div>
        <div
          className="alert-preview-canvas"
          style={{ aspectRatio: previewFormat }}
        >
          <div
            className={`alert-preview-stage template-${selected.template}`}
            style={
              {
                '--preview-accent': selected.accent,
                borderColor: selected.accent,
                color: selected.textColor,
                fontFamily: `${selected.fontFamily}, 'DM Sans', sans-serif`,
                textAlign: selected.textAlign as 'left' | 'center' | 'right',
                transform: `scale(${previewZoom / 100})`,
              } as CSSProperties
            }
          >
            {visual ? (
              visual.kind === 'VIDEO' ? (
                <video autoPlay muted loop src={visual.url} />
              ) : (
                <NextImage
                  unoptimized
                  src={visual.url}
                  alt=""
                  width={360}
                  height={160}
                />
              )
            ) : (
              <div className="preview-placeholder">StreamOS</div>
            )}
            <span style={{ color: selected.accent }}>NOVO APOIO</span>
            {selected.showSupporter || selected.showAmount ? (
              <strong style={{ fontSize: selected.fontSize }}>
                {selected.showSupporter
                  ? previewAnonymous
                    ? 'Apoiador anônimo'
                    : 'Lucas'
                  : ''}
                {selected.showSupporter && selected.showAmount ? ' · ' : ''}
                {selected.showAmount ? 'R$ 20,00' : ''}
              </strong>
            ) : null}
            {selected.showMessage ? (
              <p>
                {previewLongText
                  ? 'Essa é uma mensagem maior para você conferir que nomes e textos longos continuam legíveis e não escapam da área segura da transmissão.'
                  : 'Seu alerta personalizado está funcionando!'}
              </p>
            ) : null}
          </div>
        </div>
        <small>
          A prévia usa os mesmos campos enviados ao overlay. Mídias inválidas
          usam o alerta sem mídia como fallback.
        </small>
      </aside>
    </div>
  );
}
function inspectMedia(
  file: File,
): Promise<{ durationMs?: number; width?: number; height?: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
      const image = new window.Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
        URL.revokeObjectURL(url);
      };
      image.onerror = reject;
      image.src = url;
      return;
    }
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      const media = document.createElement(
        file.type.startsWith('video/') ? 'video' : 'audio',
      );
      media.onloadedmetadata = () => {
        const video = media instanceof HTMLVideoElement ? media : null;
        resolve({
          durationMs: Math.round(media.duration * 1000),
          width: video?.videoWidth,
          height: video?.videoHeight,
        });
        URL.revokeObjectURL(url);
      };
      media.onerror = reject;
      media.src = url;
      return;
    }
    reject(new Error('Formato inválido'));
  });
}
