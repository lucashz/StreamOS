'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePaymentSimulation } from '../../use-payment-simulation';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Session = {
  id: string;
  name: string;
  theme: string;
  allowedGenres: string[];
  minimumContributionInCents: number;
  maximumDurationSeconds: number;
};
type Song = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  durationSeconds: number;
  artworkUrl?: string | null;
  available?: boolean;
  provider?: string;
};
type Pix = {
  id: string;
  pixCopyPaste: string;
  amountInCents: number;
  expiresAt?: string;
};
const normalizeGenre = (value: string) => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (normalized.includes('sertanejo')) return 'sertanejo';
  if (normalized.includes('rock') || normalized.includes('metal'))
    return 'rock';
  if (normalized.includes('eletron')) return 'eletronica';
  if (normalized.includes('hip hop') || normalized.includes('trap'))
    return 'rap';
  return normalized;
};
const unknownGenre = (value: string) =>
  ['nao identificado', 'link externo', ''].includes(normalizeGenre(value));
const compatibleGenre = (song: Song, session: Session) =>
  unknownGenre(song.genre) ||
  !session.allowedGenres.length ||
  session.allowedGenres.some(
    (genre) => normalizeGenre(genre) === normalizeGenre(song.genre),
  );

export default function PublicSongPixPage() {
  const simulationEnabled = usePaymentSimulation();
  const { slug } = useParams<{ slug: string }>();
  const embedded = useSearchParams().get('embedded') === '1';
  const [session, setSession] = useState<Session | null>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [supporterName, setSupporterName] = useState('');
  const [amountInCents, setAmountInCents] = useState(0);
  const [selected, setSelected] = useState<Song>();
  const [pix, setPix] = useState<Pix>();
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [status, setStatus] = useState('Carregando SongPix…');
  useEffect(() => {
    void Promise.all([
      fetch(`${api}/public/creators/${slug}/songpix`, {
        signal: AbortSignal.timeout(6000),
      }).then(async (response) => {
        if (!response.ok)
          throw new Error('Não foi possível carregar o SongPix.');
        const payload = await response.text();
        return payload ? (JSON.parse(payload) as Session) : null;
      }),
      fetch(`${api}/public/songpix/catalog`, {
        signal: AbortSignal.timeout(6000),
      }).then((response) => {
        if (!response.ok)
          throw new Error('O catálogo musical está indisponível.');
        return response.json();
      }),
    ])
      .then(([active, catalog]: [Session | null, Song[]]) => {
        setSession(active);
        if (active)
          setAmountInCents((current) =>
            Math.max(current, active.minimumContributionInCents),
          );
        setSongs(
          active
            ? catalog.filter(
                (song) =>
                  compatibleGenre(song, active) &&
                  song.durationSeconds <= active.maximumDurationSeconds,
              )
            : [],
        );
        setStatus(active ? '' : 'O criador não está aceitando pedidos agora.');
      })
      .catch(() =>
        setStatus('O SongPix demorou para responder. Tente novamente.'),
      );
  }, [slug]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      setStatus('Buscando músicas…');
      setSelected(undefined);
      void fetch(
        `${api}/public/songpix/catalog?q=${encodeURIComponent(query)}`,
        {
          signal: AbortSignal.timeout(8000),
        },
      )
        .then((response) => {
          if (!response.ok) throw new Error('Link ou busca inválida.');
          return response.json() as Promise<Song[]>;
        })
        .then((catalog) => {
          const compatible = catalog.filter(
            (song) =>
              song.available !== false &&
              compatibleGenre(song, session) &&
              song.durationSeconds <= session.maximumDurationSeconds,
          );
          setSongs(compatible);
          if (compatible.length === 1) setSelected(compatible[0]);
          setStatus(
            compatible.length
              ? ''
              : 'Nenhuma música compatível com as regras da live.',
          );
        })
        .catch(() => setStatus('O catálogo está indisponível agora.'));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, session]);
  useEffect(() => {
    if (!pix || paymentConfirmed) return;
    const expiresAt = pix.expiresAt ? new Date(pix.expiresAt).getTime() : 0;
    if (!expiresAt) return;
    const expire = window.setTimeout(
      () => {
        setPix(undefined);
        setStatus(
          'Este Pix expirou. Escolha a música novamente para gerar uma nova cobrança.',
        );
      },
      Math.max(0, expiresAt - Date.now()),
    );
    return () => window.clearTimeout(expire);
  }, [paymentConfirmed, pix]);
  async function checkout() {
    if (!session || !selected) return;
    setStatus('Validando regras antes do pagamento…');
    const response = await fetch(
      `${api}/public/songpix/sessions/${session.id}/checkout`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          songId: selected.id,
          supporterName,
          amountInCents,
        }),
      },
    ).catch(() => null);
    if (!response) return setStatus('A conexão falhou. Tente novamente.');
    const body = (await response.json()) as Pix & { message?: string };
    if (!response.ok || !body.id)
      return setStatus(
        body.message ?? 'Pedido incompatível com as regras atuais.',
      );
    setPix(body);
    setPaymentConfirmed(false);
    setStatus(
      'Pix gerado. Após a confirmação, a música entra automaticamente na fila.',
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
        ? 'Contribuição confirmada. Sua música entrou na fila!'
        : 'Não foi possível confirmar.',
    );
    if (response.ok) setPaymentConfirmed(true);
  }
  return (
    <main
      className={`public-incentive-page${embedded ? ' embedded-flow' : ''}`}
    >
      <Link className="public-back-link" href={`/${slug}`}>
        ← Voltar
      </Link>
      <header className="public-incentive-header">
        <span>Pedido musical</span>
        <h1>SongPix</h1>
        <p>
          Escolha uma música que combine com o tema da live. A validação
          acontece antes do Pix.
        </p>
      </header>
      {session ? (
        <>
          <h2>{session.name}</h2>
          <p>
            {session.theme} · mínimo{' '}
            {(session.minimumContributionInCents / 100).toLocaleString(
              'pt-BR',
              { style: 'currency', currency: 'BRL' },
            )}
          </p>
          <section className="public-incentive-card">
            <div className="public-form-grid">
              <label>
                Pesquisar música
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Título, artista ou link do YouTube"
                />
              </label>
              <label>
                Seu apelido
                <input
                  value={supporterName}
                  onChange={(e) => setSupporterName(e.target.value)}
                  placeholder="Como aparecerá na live"
                />
              </label>
            </div>
          </section>
          <div className="song-catalog-grid">
            {songs.map((song) => (
              <button
                type="button"
                key={song.id}
                onClick={() => setSelected(song)}
                className={`song-catalog-card${selected?.id === song.id ? ' selected' : ''}`}
              >
                {song.artworkUrl ? (
                  <Image
                    unoptimized
                    src={song.artworkUrl}
                    alt=""
                    width={72}
                    height={72}
                  />
                ) : (
                  <span className="song-artwork-fallback">♫</span>
                )}
                <span>
                  <strong>{song.title}</strong>
                  <small>
                    {song.artist} · {song.genre}
                  </small>
                  {unknownGenre(song.genre) ? (
                    <small>Estilo não confirmado · aceito</small>
                  ) : null}
                  <small>
                    {Math.floor(song.durationSeconds / 60)}:
                    {String(song.durationSeconds % 60).padStart(2, '0')}
                  </small>
                </span>
              </button>
            ))}
          </div>
          {!songs.length && !status ? (
            <div className="public-empty-state">
              Nenhuma música compatível com o tema atual.
            </div>
          ) : null}
          {!pix ? (
            <>
              <SongValue value={amountInCents} onChange={setAmountInCents} />
              <small>
                Valor mínimo:{' '}
                {(session.minimumContributionInCents / 100).toLocaleString(
                  'pt-BR',
                  { style: 'currency', currency: 'BRL' },
                )}
              </small>
              <button
                className="primary-button"
                disabled={
                  !selected ||
                  supporterName.trim().length < 2 ||
                  amountInCents < session.minimumContributionInCents
                }
                onClick={() => void checkout()}
              >
                Continuar para o Pix
              </button>
              {!selected ? (
                <small className="flow-status error">
                  Selecione uma música para continuar.
                </small>
              ) : supporterName.trim().length < 2 ? (
                <small className="flow-status error">
                  Informe seu apelido para continuar.
                </small>
              ) : amountInCents < session.minimumContributionInCents ? (
                <small className="flow-status error">
                  Informe pelo menos o valor mínimo.
                </small>
              ) : null}
            </>
          ) : (
            <section className="public-incentive-card pix-checkout-card">
              <h3>Pagamento Pix</h3>
              <code>{pix.pixCopyPaste}</code>
              {pix.expiresAt ? (
                <small>
                  Este Pix expira em{' '}
                  {new Date(pix.expiresAt).toLocaleString('pt-BR')}.
                </small>
              ) : null}
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
          )}
        </>
      ) : null}
      <p>{status}</p>
    </main>
  );
}

function SongValue({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const formatted = (value / 100).toFixed(2).replace('.', ',');
  const [text, setText] = useState(formatted);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(formatted);
  }, [editing, formatted]);
  return (
    <div className="compact-value standalone-song-value">
      <span className="currency-selector">BRL</span>
      <fieldset className="value-field">
        <legend>Valor</legend>
        <div>
          <span>R$</span>
          <input
            aria-label="Valor da contribuição"
            type="text"
            inputMode="decimal"
            value={text}
            onFocus={(event) => {
              setEditing(true);
              event.currentTarget.select();
            }}
            onChange={(event) => {
              const next = event.target.value
                .replace(/[^\d,.]/g, '')
                .replace('.', ',');
              if (!/^\d*(,\d{0,2})?$/.test(next)) return;
              setText(next);
              const parsed = Number(next.replace(',', '.'));
              if (Number.isFinite(parsed)) onChange(Math.round(parsed * 100));
            }}
            onBlur={() => {
              setEditing(false);
              setText(formatted);
            }}
          />
        </div>
      </fieldset>
    </div>
  );
}
