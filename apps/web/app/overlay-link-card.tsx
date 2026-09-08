'use client';

import { useCallback, useEffect, useState } from 'react';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type OverlayStatus = {
  configured: boolean;
  connected: boolean;
  lastHeartbeatAt?: string | null;
  lastPlayback?: {
    status: string;
    failureReason?: string | null;
    updatedAt: string;
  } | null;
};
const playbackLabels: Record<string, string> = {
  STARTED: 'Reproduzindo',
  PLAYING: 'Reproduzindo',
  COMPLETED: 'Concluída',
  SKIPPED: 'Pulada',
  FAILED: 'Falhou',
  MEDIA_FAILED: 'Mídia indisponível',
};
const presets = {
  fullhd: [1920, 1080],
  hd: [1280, 720],
  vertical: [1080, 1920],
  custom: [1920, 1080],
} as const;

function readableDate(value?: string | null) {
  if (!value) return 'Nenhum sinal recebido';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Horário indisponível'
    : date.toLocaleString('pt-BR');
}

export function OverlayLinkCard({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<OverlayStatus>();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [testStage, setTestStage] = useState<
    'idle' | 'sent' | 'received' | 'playing' | 'completed' | 'failed'
  >('idle');
  const [preset, setPreset] = useState<keyof typeof presets>('fullhd');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`${api}/dashboard/overlay/status`, {
        credentials: 'include',
      });
      if (response.ok) setStatus((await response.json()) as OverlayStatus);
    } catch {
      setStatus(undefined);
    }
  }, []);
  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), 15000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  async function rotate() {
    if (status?.configured && !confirmRotate) {
      setConfirmRotate(true);
      setMessage(
        'Clique novamente para confirmar. A URL anterior será revogada.',
      );
      return;
    }
    setConfirmRotate(false);
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${api}/dashboard/overlay/rotate-token`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Não foi possível gerar o link.');
      const result = (await response.json()) as { browserSourceUrl: string };
      setUrl(result.browserSourceUrl);
      setVisible(false);
      setMessage('Nova URL criada. A anterior foi revogada.');
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setMessage('URL copiada. Cole-a em uma Fonte de navegador do OBS.');
  }

  async function copySettings() {
    await navigator.clipboard.writeText(
      `Fonte: Navegador\nLargura: ${width}\nAltura: ${height}\nControlar áudio pelo OBS: ativado`,
    );
    setMessage('Configurações do OBS copiadas.');
  }

  async function sendTest() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${api}/dashboard/alert-test`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok)
        throw new Error('Não foi possível enviar o alerta de teste.');
      const previousPlayback = status?.lastPlayback?.updatedAt;
      setTestStage('sent');
      setMessage(
        status?.connected
          ? 'Teste enviado. Acompanhando a reprodução no OBS.'
          : 'Teste enviado, mas o OBS ainda não confirmou conexão.',
      );
      void trackTest(previousPlayback);
    } catch (error) {
      setTestStage('failed');
      setMessage(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  async function trackTest(previousPlayback?: string) {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      try {
        const response = await fetch(`${api}/dashboard/overlay/status`, {
          credentials: 'include',
        });
        if (!response.ok) continue;
        const next = (await response.json()) as OverlayStatus;
        setStatus(next);
        if (next.connected)
          setTestStage((current) =>
            current === 'sent' ? 'received' : current,
          );
        const playback = next.lastPlayback;
        if (!playback || playback.updatedAt === previousPlayback) continue;
        if (['FAILED', 'MEDIA_FAILED'].includes(playback.status)) {
          setTestStage('failed');
          return;
        }
        if (playback.status === 'COMPLETED') {
          setTestStage('completed');
          return;
        }
        setTestStage('playing');
      } catch {
        /* a próxima tentativa mantém o diagnóstico em andamento */
      }
    }
    setMessage(
      'O teste foi enviado, mas o OBS não confirmou a conclusão. Verifique a fonte e tente novamente.',
    );
  }

  function selectPreset(value: keyof typeof presets) {
    setPreset(value);
    if (value !== 'custom') {
      setWidth(presets[value][0]);
      setHeight(presets[value][1]);
    }
  }

  if (compact) {
    const setupSteps = [
      {
        label: 'Gerar URL',
        detail: 'Uma fonte para texto, áudio, música e vídeo.',
        done: Boolean(status?.configured),
      },
      {
        label: 'Adicionar no OBS',
        detail: 'Fonte de navegador em 1920 × 1080.',
        done: Boolean(status?.connected),
      },
      {
        label: 'Testar alerta',
        detail: 'O alerta deve aparecer e encerrar sozinho.',
        done: testStage === 'completed',
      },
    ];
    return (
      <article className="overlay-embed-card">
        <div className="overlay-embed-heading">
          <div>
            <span className="section-kicker">OBS</span>
            <h2>Incorporar alertas</h2>
          </div>
          <span
            className={`status-badge ${status?.connected ? 'success' : 'warning'}`}
          >
            {status?.connected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
        <p>
          Use esta URL em uma Fonte de navegador. Ela reúne todos os alertas
          temporários.
        </p>
        <ol
          className="obs-setup-steps"
          aria-label="Etapas para configurar o OBS"
        >
          {setupSteps.map((step, index) => (
            <li className={step.done ? 'done' : ''} key={step.label}>
              <span>{step.done ? '✓' : index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            </li>
          ))}
        </ol>
        <label>
          URL do overlay
          <div className="overlay-embed-url">
            <input
              readOnly
              type={visible ? 'text' : 'password'}
              value={url ?? ''}
              placeholder={
                status?.configured
                  ? 'URL atual protegida'
                  : 'Gere uma URL para começar'
              }
              aria-label="URL secreta do overlay"
            />
            {url ? (
              <button
                type="button"
                className="icon-button"
                onClick={() => void copy()}
                aria-label="Copiar URL"
                title="Copiar URL"
              >
                ⧉
              </button>
            ) : null}
            {url ? (
              <button
                type="button"
                className="icon-button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? 'Ocultar URL' : 'Mostrar URL'}
                title={visible ? 'Ocultar URL' : 'Mostrar URL'}
              >
                {visible ? '◉' : '⊘'}
              </button>
            ) : null}
          </div>
        </label>
        <div className="overlay-recommended-size">
          <strong>Tamanho recomendado</strong>
          <span>
            <small>Largura (width)</small>
            <b>1920 px</b>
          </span>
          <span>
            <small>Altura (height)</small>
            <b>1080 px</b>
          </span>
        </div>
        <div className="overlay-embed-actions">
          <button
            className="secondary-button"
            onClick={() => void sendTest()}
            disabled={loading || !status?.configured}
          >
            Enviar teste
          </button>
          <button
            className="secondary-button"
            onClick={() => void loadStatus()}
            disabled={loading}
          >
            Verificar
          </button>
          <button
            className={confirmRotate ? 'danger-button' : 'secondary-button'}
            onClick={() => void rotate()}
            disabled={loading}
          >
            {confirmRotate
              ? 'Confirmar troca'
              : status?.configured
                ? 'Trocar URL'
                : 'Gerar URL'}
          </button>
        </div>
        {message ? <small role="status">{message}</small> : null}
        {status?.configured && !status.connected ? (
          <details className="obs-troubleshooting">
            <summary>O OBS não conectou?</summary>
            <ul>
              <li>Confirme que a fonte é do tipo Navegador.</li>
              <li>Cole a URL completa, incluindo o token.</li>
              <li>Ative “Atualizar navegador quando a cena ficar ativa”.</li>
              <li>Use 1920 × 1080 e controle o áudio pelo OBS.</li>
            </ul>
          </details>
        ) : null}
      </article>
    );
  }

  return (
    <article className="panel overlay-panel obs-setup-card">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Browser Source</span>
          <h2>Instalar alertas no OBS</h2>
        </div>
        <span
          className={`status-badge ${status?.connected ? 'success' : 'warning'}`}
        >
          {status?.connected ? 'OBS conectado' : 'OBS desconectado'}
        </span>
      </div>
      <p>
        Use uma única Browser Source para todos os alertas temporários. Widgets
        que permanecem na tela possuem URL própria.
      </p>
      <div className="obs-diagnostic-strip">
        <div>
          <span>Último sinal</span>
          <strong>{readableDate(status?.lastHeartbeatAt)}</strong>
        </div>
        <div>
          <span>Última reprodução</span>
          <strong>
            {status?.lastPlayback
              ? (playbackLabels[status.lastPlayback.status] ?? 'Atualizando')
              : 'Nenhum teste recebido'}
          </strong>
        </div>
        <div>
          <span>Transparência</span>
          <strong>Ativa fora dos alertas</strong>
        </div>
      </div>
      <div className="obs-install-grid">
        <section>
          <h3>1. URL protegida</h3>
          {url ? (
            <div className="overlay-secret-row">
              <input
                readOnly
                type={visible ? 'text' : 'password'}
                value={url}
                aria-label="URL secreta do overlay"
              />
              <button
                className="secondary-button"
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? 'Ocultar' : 'Mostrar'}
              </button>
              <button onClick={() => void copy()}>Copiar URL</button>
            </div>
          ) : (
            <p className="field-help">
              {status?.configured
                ? 'A URL atual está protegida. Gere uma nova somente para substituir a fonte.'
                : 'Gere a URL secreta antes de adicionar a fonte no OBS.'}
            </p>
          )}
          <button
            className={confirmRotate ? 'danger-button' : 'secondary-button'}
            onClick={() => void rotate()}
            disabled={loading}
          >
            {loading
              ? 'Aguarde…'
              : confirmRotate
                ? 'Confirmar troca'
                : status?.configured
                  ? 'Rotacionar URL'
                  : 'Gerar URL'}
          </button>
        </section>
        <section>
          <h3>2. Resolução da fonte</h3>
          <label>
            Formato
            <select
              value={preset}
              onChange={(event) =>
                selectPreset(event.target.value as keyof typeof presets)
              }
            >
              <option value="fullhd">Full HD — 1920 × 1080</option>
              <option value="hd">HD — 1280 × 720</option>
              <option value="vertical">Vertical — 1080 × 1920</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <div className="obs-size-fields">
            <label>
              Largura
              <input
                type="number"
                min="320"
                max="7680"
                value={width}
                onChange={(event) => {
                  setPreset('custom');
                  setWidth(Number(event.target.value));
                }}
              />
            </label>
            <label>
              Altura
              <input
                type="number"
                min="240"
                max="4320"
                value={height}
                onChange={(event) => {
                  setPreset('custom');
                  setHeight(Number(event.target.value));
                }}
              />
            </label>
          </div>
        </section>
      </div>
      <ol className="obs-checklist">
        <li>
          <b>Adicionar fonte</b>
          <span>No OBS, escolha Fontes → Navegador e cole a URL.</span>
        </li>
        <li>
          <b>
            Usar {width} × {height}
          </b>
          <span>
            Ative “Controlar áudio pelo OBS” para ajustar o volume na mesa.
          </span>
        </li>
        <li>
          <b>Validar</b>
          <span>Mantenha a fonte visível e envie o teste abaixo.</span>
        </li>
      </ol>
      <div className="overlay-actions">
        <button
          onClick={() => void sendTest()}
          disabled={loading || !status?.configured}
        >
          Enviar teste
        </button>
        <button
          className="secondary-button"
          onClick={() => void copySettings()}
        >
          Copiar configurações
        </button>
        {url ? (
          <a
            className="secondary-button button-link"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            Abrir no navegador
          </a>
        ) : null}
        <button
          className="secondary-button"
          onClick={() => void loadStatus()}
          disabled={loading}
        >
          Verificar conexão
        </button>
      </div>
      {testStage !== 'idle' ? (
        <ol className="alert-test-progress" aria-label="Progresso do teste">
          <li className={testStage !== 'failed' ? 'done' : 'failed'}>
            Teste enviado
          </li>
          <li
            className={
              ['received', 'playing', 'completed'].includes(testStage)
                ? 'done'
                : ''
            }
          >
            OBS recebeu o evento
          </li>
          <li
            className={
              ['playing', 'completed'].includes(testStage) ? 'done' : ''
            }
          >
            Alerta começou
          </li>
          <li className={testStage === 'completed' ? 'done' : ''}>
            Alerta concluído
          </li>
        </ol>
      ) : null}
      {status?.lastPlayback?.failureReason ? (
        <small className="danger-text">
          Falha recente: {status.lastPlayback.failureReason}
        </small>
      ) : null}
      {message ? <small role="status">{message}</small> : null}
    </article>
  );
}
