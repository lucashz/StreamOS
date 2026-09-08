'use client';

import { useEffect, useState } from 'react';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Widget = {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
};

export function WidgetOverlayCard({
  type,
  title,
  description,
  width = 1920,
  height = 1080,
}: Readonly<{
  type: 'ALERT' | 'VIDEO_PIX' | 'SONG_PIX';
  title: string;
  description: string;
  width?: number;
  height?: number;
}>) {
  const [widget, setWidget] = useState<Widget>();
  const [url, setUrl] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void fetch(`${api}/dashboard/widgets`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) =>
        response.ok ? ((await response.json()) as Widget[]) : [],
      )
      .then((items) => setWidget(items.find((item) => item.type === type)));
  }, [type]);

  async function generate() {
    if (widget && !confirmRotate) {
      setConfirmRotate(true);
      setMessage('Clique novamente para trocar a URL atual.');
      return;
    }
    setBusy(true);
    setConfirmRotate(false);
    try {
      let target = widget;
      if (!target) {
        const created = await fetch(`${api}/dashboard/widgets`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type, name: title }),
        });
        if (!created.ok) throw new Error('Não foi possível criar a fonte.');
        const result = (await created.json()) as Widget & {
          browserSourceUrl?: string;
        };
        target = result;
        setWidget(result);
        if (result.browserSourceUrl) setUrl(result.browserSourceUrl);
      } else {
        const rotated = await fetch(
          `${api}/dashboard/widgets/${target.id}/rotate-token`,
          { method: 'POST', credentials: 'include' },
        );
        if (!rotated.ok) throw new Error('Não foi possível gerar a URL.');
        const result = (await rotated.json()) as { browserSourceUrl: string };
        setUrl(result.browserSourceUrl);
      }
      setMessage(`Fonte exclusiva de ${title} pronta para o OBS.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!widget) return;
    setBusy(true);
    const response = await fetch(`${api}/dashboard/widgets/${widget.id}/test`, {
      method: 'POST',
      credentials: 'include',
    });
    setMessage(
      response.ok
        ? 'Teste enviado para esta fonte.'
        : 'O teste não foi enviado.',
    );
    setBusy(false);
  }

  return (
    <article className="overlay-embed-card dedicated-overlay-card">
      <div className="overlay-embed-heading">
        <div>
          <span className="section-kicker">Fonte exclusiva do OBS</span>
          <h2>{title}</h2>
        </div>
        <span
          className={`status-badge ${widget?.enabled ? 'success' : 'warning'}`}
        >
          {widget?.enabled ? 'Ativa' : 'Não criada'}
        </span>
      </div>
      <p>{description}</p>
      <label>
        URL desta fonte
        <div className="overlay-embed-url">
          <input
            readOnly
            type={visible ? 'text' : 'password'}
            value={url}
            placeholder="Gere a URL exclusiva para copiar"
          />
          {url ? (
            <button
              className="icon-button"
              type="button"
              onClick={() => void navigator.clipboard.writeText(url)}
              aria-label="Copiar URL"
            >
              ⧉
            </button>
          ) : null}
          {url ? (
            <button
              className="icon-button"
              type="button"
              onClick={() => setVisible((current) => !current)}
              aria-label={visible ? 'Ocultar URL' : 'Mostrar URL'}
            >
              {visible ? '◉' : '◎'}
            </button>
          ) : null}
        </div>
      </label>
      <div className="overlay-recommended-size">
        <span>Tamanho recomendado</span>
        <strong>
          {width} × {height} px
        </strong>
      </div>
      <div className="overlay-embed-actions">
        <button type="button" disabled={busy} onClick={() => void generate()}>
          {confirmRotate
            ? 'Confirmar nova URL'
            : url
              ? 'Trocar URL'
              : 'Gerar URL'}
        </button>
        <button
          type="button"
          disabled={busy || !widget}
          onClick={() => void test()}
        >
          Enviar teste
        </button>
      </div>
      {message ? <p className="form-status">{message}</p> : null}
    </article>
  );
}
