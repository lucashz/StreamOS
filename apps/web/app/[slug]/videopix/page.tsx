'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePaymentSimulation } from '../../use-payment-simulation';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Session = {
  id: string;
  name: string;
  pricePerSecondInCents: number;
  minimumContributionInCents: number;
  minimumViews: number;
  minimumAgeDays: number;
};
type Preview = {
  title: string;
  channelTitle: string;
  durationSeconds: number;
  views: number;
  selectedSeconds: number;
  startAtSeconds: number;
  amountInCents: number;
  validation: 'AUTOMATIC';
};
type Pix = { id: string; pixCopyPaste: string; amountInCents: number };
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const parseClock = (value: string) => {
  const match = value.trim().match(/^(\d+):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
function TimeField({
  label,
  value,
  maximum,
  onChange,
}: {
  label: string;
  value: number;
  maximum: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(clock(value));
  useEffect(() => setText(clock(value)), [value]);
  function commit() {
    const parsed = parseClock(text);
    if (parsed === null) return setText(clock(value));
    onChange(Math.max(0, Math.min(maximum, parsed)));
  }
  return (
    <label>
      {label}
      <input
        value={text}
        inputMode="numeric"
        placeholder="00:00"
        pattern="[0-9]+:[0-5][0-9]"
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
    </label>
  );
}
export default function PublicVideoPixPage() {
  const simulationEnabled = usePaymentSimulation();
  const { slug } = useParams<{ slug: string }>();
  const embedded = useSearchParams().get('embedded') === '1';
  const [session, setSession] = useState<Session | null>();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [startAtSeconds, setStartAtSeconds] = useState(0);
  const [endAtSeconds, setEndAtSeconds] = useState(0);
  const [preview, setPreview] = useState<Preview>();
  const [pix, setPix] = useState<Pix>();
  const [status, setStatus] = useState('Carregando…');
  useEffect(() => {
    void fetch(`${api}/public/creators/${slug}/videopix`, {
      signal: AbortSignal.timeout(6000),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Não foi possível carregar o VideoPix.');
        const payload = await response.text();
        return payload ? (JSON.parse(payload) as Session) : null;
      })
      .then((value: Session | null) => {
        setSession(value);
        setStatus(value ? '' : 'O criador não está aceitando vídeos agora.');
      })
      .catch(() =>
        setStatus('O VideoPix demorou para responder. Tente novamente.'),
      );
  }, [slug]);
  async function validate(useSelectedRange = false) {
    if (!session) return;
    if (!url.trim()) return setStatus('Cole um link público do YouTube.');
    setStatus('Validando vídeo…');
    const selectedSeconds = endAtSeconds - startAtSeconds;
    const response = await fetch(
      `${api}/public/videopix/sessions/${session.id}/preview`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          url,
          ...(useSelectedRange ? { selectedSeconds, startAtSeconds } : {}),
        }),
      },
    ).catch(() => null);
    if (!response)
      return setStatus(
        'A validação demorou demais. Confira o link e tente novamente.',
      );
    const body = (await response.json()) as Preview & { message?: string };
    if (!response.ok) return setStatus(body.message ?? 'Vídeo incompatível.');
    setPreview(body);
    if (!useSelectedRange) {
      setStartAtSeconds(0);
      setEndAtSeconds(body.durationSeconds);
      setStatus('Vídeo compatível. Agora escolha o início e o fim do trecho.');
    } else {
      setStatus('Trecho atualizado. Confira o valor e continue para o Pix.');
    }
  }
  async function checkout() {
    if (!session) return;
    const response = await fetch(
      `${api}/public/videopix/sessions/${session.id}/checkout`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url,
          supporterName: name,
          selectedSeconds: endAtSeconds - startAtSeconds,
          startAtSeconds,
        }),
      },
    ).catch(() => null);
    if (!response) return setStatus('A conexão falhou. Tente novamente.');
    const body = (await response.json()) as Pix & { message?: string };
    if (!response.ok)
      return setStatus(body.message ?? 'Não foi possível gerar o Pix.');
    setPix(body);
    setStatus(
      'Pix gerado. Após a confirmação, o vídeo entra automaticamente na fila.',
    );
  }
  async function confirm() {
    if (!pix) return;
    const response = await fetch(
      `${api}/mock/payment-intents/${pix.id}/confirm`,
      { method: 'POST' },
    );
    setStatus(
      response.ok
        ? 'Contribuição confirmada. Vídeo adicionado à fila!'
        : 'Falha na confirmação.',
    );
  }
  return (
    <main
      className={`public-incentive-page${embedded ? ' embedded-flow' : ''}`}
    >
      <Link className="public-back-link" href={`/${slug}`}>
        ← Voltar
      </Link>
      <header className="public-incentive-header">
        <span>Compartilhamento de mídia</span>
        <h1>VideoPix</h1>
        <p>
          Escolha o trecho, confira o valor e envie para a fila automática da
          live.
        </p>
      </header>
      {session ? (
        <>
          <h2 className="standalone-flow-heading">{session.name}</h2>
          <p className="standalone-flow-heading">
            {session.pricePerSecondInCents} centavos/segundo · mínimo{' '}
            {(session.minimumContributionInCents / 100).toLocaleString(
              'pt-BR',
              { style: 'currency', currency: 'BRL' },
            )}{' '}
            · sem limite artificial de duração ·{' '}
            {session.minimumViews.toLocaleString('pt-BR')} views mínimas
          </p>
          <label>
            Link do YouTube
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPreview(undefined);
              }}
              placeholder="Cole o link do YouTube"
            />
          </label>
          <button onClick={() => void validate(false)}>Carregar vídeo</button>
          {preview ? (
            <section className="panel" style={{ padding: 20, marginTop: 20 }}>
              <strong>{preview.title}</strong>
              <p>
                {preview.channelTitle} · {preview.views.toLocaleString('pt-BR')}{' '}
                views · preço{' '}
                {(preview.amountInCents / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
              <fieldset>
                <legend>Selecionar tempo</legend>
                <p>Defina o início e o fim do trecho que deseja exibir.</p>
                <div className="video-time-fields">
                  <TimeField
                    label="Início (min:seg)"
                    value={startAtSeconds}
                    maximum={Math.max(0, endAtSeconds - 1)}
                    onChange={setStartAtSeconds}
                  />
                  <TimeField
                    label="Fim (min:seg)"
                    value={endAtSeconds}
                    maximum={preview.durationSeconds}
                    onChange={(value) =>
                      setEndAtSeconds(Math.max(startAtSeconds + 1, value))
                    }
                  />
                </div>
                <div className="standalone-trim-ranges">
                  <label>
                    Início
                    <input
                      aria-label="Início do trecho"
                      type="range"
                      min="0"
                      max={preview.durationSeconds}
                      value={startAtSeconds}
                      onChange={(event) =>
                        setStartAtSeconds(
                          Math.min(
                            endAtSeconds - 1,
                            Number(event.target.value),
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Fim
                    <input
                      aria-label="Fim do trecho"
                      type="range"
                      min="0"
                      max={preview.durationSeconds}
                      value={endAtSeconds}
                      onChange={(event) =>
                        setEndAtSeconds(
                          Math.max(
                            startAtSeconds + 1,
                            Number(event.target.value),
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <small>
                  Trecho selecionado: {clock(endAtSeconds - startAtSeconds)} de{' '}
                  {clock(preview.durationSeconds)}
                </small>
                <button
                  type="button"
                  disabled={
                    startAtSeconds < 0 ||
                    endAtSeconds <= startAtSeconds ||
                    endAtSeconds > preview.durationSeconds
                  }
                  onClick={() => void validate(true)}
                >
                  Confirmar trecho e calcular valor
                </button>
              </fieldset>
              <label>
                Seu apelido
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <button
                className="primary-button"
                disabled={
                  name.trim().length < 2 ||
                  endAtSeconds <= startAtSeconds ||
                  preview.selectedSeconds !== endAtSeconds - startAtSeconds ||
                  preview.startAtSeconds !== startAtSeconds
                }
                onClick={() => void checkout()}
              >
                Continuar para o Pix
              </button>
            </section>
          ) : null}
          {pix ? (
            <section className="panel" style={{ padding: 20 }}>
              <h3>Pagamento Pix</h3>
              <code style={{ wordBreak: 'break-all' }}>{pix.pixCopyPaste}</code>
              <br />
              {simulationEnabled ? (
                <button
                  className="primary-button"
                  onClick={() => void confirm()}
                >
                  Simular pagamento (teste)
                </button>
              ) : (
                <span className="payment-waiting">Aguardando pagamentoâ€¦</span>
              )}
            </section>
          ) : null}
        </>
      ) : null}
      <p>{status}</p>
    </main>
  );
}
