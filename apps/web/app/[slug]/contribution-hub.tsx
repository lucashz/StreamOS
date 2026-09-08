'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import Image from 'next/image';
import { usePaymentSimulation } from '../use-payment-simulation';
import { DonationForm } from './donation-form';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Mode = 'TEXT' | 'AUDIO' | 'AI_MUSIC' | 'VIDEO' | 'SONG';
type Pix = {
  id: string;
  pixCopyPaste: string;
  qrCodePayload?: string;
  amountInCents: number;
  expiresAt?: string;
};
type VideoSession = { id: string; minimumContributionInCents: number };
type VideoPreview = {
  title: string;
  channelTitle: string;
  durationSeconds: number;
  startAtSeconds: number;
  selectedSeconds: number;
  amountInCents: number;
  thumbnailUrl?: string;
};
type SongSession = {
  id: string;
  minimumContributionInCents: number;
  allowedGenres: string[];
  maximumDurationSeconds: number;
};
type Song = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  durationSeconds: number;
  available?: boolean;
  provider?: string;
  artworkUrl?: string | null;
};
const modes: {
  value: Mode;
  icon: string;
  label: string;
  available: boolean;
}[] = [
  { value: 'TEXT', icon: '✎', label: 'Texto', available: true },
  { value: 'AUDIO', icon: '♪', label: 'Áudio', available: true },
  { value: 'AI_MUSIC', icon: '✦', label: 'Música IA', available: false },
  { value: 'VIDEO', icon: '▶', label: 'Vídeo', available: true },
  { value: 'SONG', icon: '♫', label: 'Música', available: true },
];
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const parseClock = (value: string) => {
  const match = value.trim().match(/^(\d+):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const normalizedGenre = (value: string) => {
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
  ['nao identificado', 'link externo', ''].includes(normalizedGenre(value));

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
export function ContributionHub({
  slug,
  minimumInCents,
}: Readonly<{ slug: string; minimumInCents: number }>) {
  const [mode, setMode] = useState<Mode>('TEXT');
  const [name, setName] = useState('');
  return (
    <div className="contribution-hub">
      <label>
        Seu nome de usuário
        <input
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como aparecerá na live"
        />
      </label>
      <nav className="contribution-modes" aria-label="Tipo de contribuição">
        {modes.map((item) => (
          <button
            aria-label={item.label}
            className={`contribution-mode${mode === item.value ? ' active' : ''}${!item.available ? ' unavailable' : ''}`}
            disabled={!item.available}
            key={item.value}
            onClick={() => item.available && setMode(item.value)}
            title={!item.available ? `${item.label}: em breve` : item.label}
            type="button"
          >
            <b aria-hidden="true">{item.icon}</b>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
      {mode === 'TEXT' ? (
        <DonationForm
          slug={slug}
          minimumInCents={minimumInCents}
          supporterName={name}
          hideSupporterName
        />
      ) : null}
      {mode === 'AUDIO' ? (
        <AudioBox
          slug={slug}
          supporterName={name}
          minimumInCents={minimumInCents}
        />
      ) : null}
      {mode === 'VIDEO' ? <VideoBox slug={slug} supporterName={name} /> : null}
      {mode === 'SONG' ? <SongBox slug={slug} supporterName={name} /> : null}
    </div>
  );
}

function AudioBox({
  slug,
  supporterName,
  minimumInCents,
}: {
  slug: string;
  supporterName: string;
  minimumInCents: number;
}) {
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [amount, setAmount] = useState(Math.max(500, minimumInCents));
  const [pix, setPix] = useState<Pix>();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAt = useRef(0);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function selectAudio(selected?: File, recordedDuration?: number) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(undefined);
    setPreviewUrl('');
    setDuration(0);
    setStatus('');
    if (!selected) return;
    if (selected.size > 5_000_000) {
      setStatus('O arquivo deve ter no máximo 5 MB.');
      return;
    }
    const nextUrl = URL.createObjectURL(selected);
    if (recordedDuration && recordedDuration >= 1) {
      setFile(selected);
      setPreviewUrl(nextUrl);
      setDuration(Math.min(60, recordedDuration));
      setStatus('Áudio gravado e pronto para enviar.');
      return;
    }
    const audio = new Audio(nextUrl);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      if (
        !Number.isFinite(audio.duration) ||
        audio.duration < 1 ||
        audio.duration > 60
      ) {
        URL.revokeObjectURL(nextUrl);
        setStatus('O áudio deve ter entre 1 e 60 segundos.');
        return;
      }
      setFile(selected);
      setPreviewUrl(nextUrl);
      setDuration(audio.duration);
      setStatus('Áudio pronto para enviar.');
    };
    audio.onerror = () => {
      URL.revokeObjectURL(nextUrl);
      setStatus('Não foi possível ler este arquivo de áudio.');
    };
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus('Seu navegador não permite gravar áudio pelo microfone.');
      return;
    }
    try {
      selectAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        preferred ? { mimeType: preferred } : undefined,
      );
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAt.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const extension = type.includes('ogg') ? 'ogg' : 'webm';
        const elapsed = Math.min(
          60,
          Math.max(1, (Date.now() - recordingStartedAt.current) / 1000),
        );
        selectAudio(
          new File([blob], `gravacao-${Date.now()}.${extension}`, { type }),
          elapsed,
        );
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.start(250);
      setRecording(true);
      setRecordedSeconds(0);
      setStatus('Gravando… fale perto do microfone.');
    } catch {
      setStatus(
        'Não foi possível acessar o microfone. Confira a permissão do navegador.',
      );
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - recordingStartedAt.current) / 1000,
      );
      setRecordedSeconds(elapsed);
      if (elapsed >= 60) stopRecording();
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording')
        recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!file || duration < 1) return;
    setBusy(true);
    setStatus('Gerando Pix…');
    const data = new FormData();
    data.set('file', file);
    data.set('amountInCents', String(amount));
    data.set('supporterName', supporterName.trim());
    data.set('durationSeconds', String(duration));
    const response = await fetch(
      `${api}/public/creators/${slug}/audio-payment-intents`,
      {
        method: 'POST',
        body: data,
        signal: AbortSignal.timeout(15_000),
      },
    ).catch(() => null);
    if (!response) {
      setStatus('O envio não respondeu. Tente novamente.');
      setBusy(false);
      return;
    }
    const body = (await response.json().catch(() => null)) as
      (Pix & { message?: string | string[] }) | null;
    if (!response.ok || !body) {
      const message = Array.isArray(body?.message)
        ? body.message.join(' ')
        : body?.message;
      setStatus(message ?? 'Não foi possível criar o Pix.');
      setBusy(false);
      return;
    }
    setPix(body);
    setBusy(false);
  }

  if (pix) return <PixBox pix={pix} />;
  const blocked =
    !file ||
    duration < 1 ||
    amount < minimumInCents ||
    supporterName.trim().length < 2;
  return (
    <form
      className="compact-media-form audio-donate-form"
      onSubmit={(event) => void checkout(event)}
    >
      <section className={`audio-recorder${recording ? ' recording' : ''}`}>
        <span className="recording-dot" aria-hidden="true" />
        <div>
          <strong>
            {recording ? 'Gravando sua mensagem' : 'Mensagem de áudio'}
          </strong>
          <small>
            {recording
              ? `${clock(recordedSeconds)} / 01:00`
              : 'Grave pelo microfone · máximo de 60 segundos'}
          </small>
        </div>
        <button
          className={recording ? 'stop-recording' : 'start-recording'}
          type="button"
          onClick={() => (recording ? stopRecording() : void startRecording())}
        >
          {recording
            ? 'Parar gravação'
            : file
              ? 'Gravar novamente'
              : 'Começar a gravar'}
        </button>
      </section>
      {previewUrl ? (
        <div className="audio-donate-preview">
          <strong>{file?.name}</strong>
          <small>{clock(Math.ceil(duration))}</small>
          <audio controls preload="metadata" src={previewUrl} />
          <button type="button" onClick={() => void startRecording()}>
            Gravar novamente
          </button>
        </div>
      ) : null}
      <OutputValue
        value={amount}
        minimum={minimumInCents}
        onChange={setAmount}
      />
      <button
        className="contribute-button"
        disabled={blocked || busy}
        type="submit"
      >
        {busy
          ? 'Enviando…'
          : `Continuar com R$ ${(amount / 100).toFixed(2).replace('.', ',')}`}
      </button>
      {supporterName.trim().length < 2 ? (
        <small className="flow-status error">
          Informe seu nome de usuário acima.
        </small>
      ) : null}
      {status ? (
        <small className={`flow-status${file ? ' success' : ' error'}`}>
          {status}
        </small>
      ) : null}
    </form>
  );
}

function VideoBox({
  slug,
  supporterName,
}: {
  slug: string;
  supporterName: string;
}) {
  const [session, setSession] = useState<VideoSession | null>();
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<VideoPreview>();
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [draftStart, setDraftStart] = useState(0);
  const [draftEnd, setDraftEnd] = useState(0);
  const [editingRange, setEditingRange] = useState(false);
  const [pix, setPix] = useState<Pix>();
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    void fetch(`${api}/public/creators/${slug}/videopix`, {
      signal: AbortSignal.timeout(6000),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Não foi possível carregar o VideoPix.');
        const payload = await response.text();
        return payload ? (JSON.parse(payload) as VideoSession) : null;
      })
      .then(setSession)
      .catch(() =>
        setSessionError(
          'O VideoPix não respondeu. Atualize a página e tente novamente.',
        ),
      );
  }, [slug]);
  async function load(selected = false, range = { start, end }) {
    if (!session || !url.trim()) return;
    setStatus('Validando vídeo…');
    try {
      const response = await fetch(
        `${api}/public/videopix/sessions/${session.id}/preview`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            url,
            ...(selected
              ? {
                  startAtSeconds: range.start,
                  selectedSeconds: range.end - range.start,
                }
              : {}),
          }),
        },
      );
      const body = (await response.json()) as VideoPreview & {
        message?: string;
      };
      if (!response.ok) return setStatus(body.message ?? 'Vídeo inválido.');
      setPreview(body);
      setAmount((current) => Math.max(current, body.amountInCents));
      if (!selected) {
        setStart(0);
        setEnd(body.durationSeconds);
        setDraftStart(0);
        setDraftEnd(body.durationSeconds);
        setEditingRange(true);
      } else {
        setStart(range.start);
        setEnd(range.end);
        setDraftStart(range.start);
        setDraftEnd(range.end);
        setEditingRange(false);
      }
      setStatus(selected ? 'Trecho confirmado.' : 'Escolha o início e o fim.');
    } catch (error: unknown) {
      setStatus(
        (error as Error).name === 'TimeoutError'
          ? 'A validação demorou demais. Confira o link e tente novamente.'
          : 'Não foi possível validar o vídeo. Tente novamente.',
      );
    }
  }
  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!session || !preview) return;
    const minimum = preview.amountInCents ?? session.minimumContributionInCents;
    const payableAmount =
      Number.isFinite(amount) && amount > 0 ? amount : minimum;
    setCheckoutBusy(true);
    try {
      const response = await fetch(
        `${api}/public/videopix/sessions/${session.id}/checkout`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            url,
            supporterName,
            startAtSeconds: start,
            selectedSeconds: end - start,
            amountInCents: payableAmount,
          }),
        },
      ).catch(() => null);
      if (!response)
        return setStatus(
          'A conexão falhou. Verifique sua internet e tente novamente.',
        );
      const body = (await response.json()) as Pix & { message?: string };
      if (!response.ok)
        return setStatus(body.message ?? 'Não foi possível continuar.');
      setPix(body);
    } finally {
      setCheckoutBusy(false);
    }
  }
  if (session === null)
    return <p>O criador não está aceitando vídeos agora.</p>;
  if (sessionError) return <p className="flow-status error">{sessionError}</p>;
  if (!session) return <p>Carregando…</p>;
  if (pix) return <PixBox pix={pix} />;
  const confirmed =
    !editingRange &&
    preview?.startAtSeconds === start &&
    preview.selectedSeconds === end - start &&
    draftStart === start &&
    draftEnd === end;
  const videoMinimum =
    preview?.amountInCents ?? session.minimumContributionInCents;
  const videoPayableAmount =
    Number.isFinite(amount) && amount > 0 ? amount : videoMinimum;
  const videoBlockReason = !preview
    ? 'Carregue um vídeo para continuar.'
    : !confirmed
      ? 'Confirme o trecho selecionado para continuar.'
      : supporterName.trim().length < 2
        ? 'Informe seu nome de usuário acima para continuar.'
        : videoPayableAmount < videoMinimum
          ? `O valor mínimo para este trecho é R$ ${(videoMinimum / 100).toFixed(2).replace('.', ',')}.`
          : '';
  const rangeStyle = preview
    ? ({
        '--trim-start': `${(draftStart / preview.durationSeconds) * 100}%`,
        '--trim-end': `${(draftEnd / preview.durationSeconds) * 100}%`,
      } as CSSProperties)
    : undefined;
  return (
    <form className="compact-media-form" onSubmit={(e) => void checkout(e)}>
      <label>
        URL do vídeo
        <textarea
          value={url}
          maxLength={400}
          onChange={(e) => {
            setUrl(e.target.value);
            setPreview(undefined);
          }}
          placeholder="Cole o link do YouTube"
        />
        <small>{url.length}/400 caracteres</small>
      </label>
      {!preview ? (
        <button
          type="button"
          onClick={() => void load()}
          disabled={!url.trim()}
        >
          Carregar vídeo
        </button>
      ) : (
        <div className="media-preview-box">
          {preview.thumbnailUrl ? (
            <div className="video-thumbnail">
              <Image
                unoptimized
                src={preview.thumbnailUrl}
                alt=""
                width={640}
                height={360}
              />
              <span aria-hidden="true">▶</span>
              <strong>{preview.title}</strong>
              <small>{preview.channelTitle}</small>
              <div className="video-trim-bar">
                <i aria-hidden="true">▶</i>
                <div className="video-trim-track" style={rangeStyle}>
                  <span />
                  <input
                    aria-label="Início do trecho"
                    type="range"
                    min="0"
                    max={preview.durationSeconds}
                    value={draftStart}
                    onChange={(event) => {
                      setDraftStart(
                        Math.min(draftEnd - 1, Number(event.target.value)),
                      );
                      setEditingRange(true);
                    }}
                  />
                  <input
                    aria-label="Fim do trecho"
                    type="range"
                    min="0"
                    max={preview.durationSeconds}
                    value={draftEnd}
                    onChange={(event) => {
                      setDraftEnd(
                        Math.max(draftStart + 1, Number(event.target.value)),
                      );
                      setEditingRange(true);
                    }}
                  />
                </div>
                <time>
                  {clock(draftStart)}–{clock(draftEnd)}
                </time>
                <button
                  type="button"
                  title="Editar trecho"
                  aria-label="Editar trecho"
                  onClick={() => setEditingRange(true)}
                >
                  ✎
                </button>
              </div>
            </div>
          ) : (
            <>
              <strong>{preview.title}</strong>
              <small>{preview.channelTitle}</small>
            </>
          )}
        </div>
      )}
      {preview && editingRange ? (
        <section className="inline-trim" aria-label="Trecho do vídeo">
          <div className="video-time-fields">
            <TimeField
              label="Início (min:seg)"
              value={draftStart}
              maximum={Math.max(0, draftEnd - 1)}
              onChange={(value) => {
                setDraftStart(value);
                setEditingRange(true);
              }}
            />
            <TimeField
              label="Fim (min:seg)"
              value={draftEnd}
              maximum={preview.durationSeconds}
              onChange={(value) => {
                setDraftEnd(Math.max(draftStart + 1, value));
                setEditingRange(true);
              }}
            />
          </div>
          <small>
            Trecho selecionado: {clock(draftEnd - draftStart)} de{' '}
            {clock(preview.durationSeconds)}
          </small>
          <button
            className="confirm-trim-button"
            type="button"
            disabled={
              status === 'Validando vídeo…' ||
              draftStart < 0 ||
              draftEnd <= draftStart ||
              draftEnd > preview.durationSeconds
            }
            onClick={() =>
              void load(true, { start: draftStart, end: draftEnd })
            }
          >
            <span aria-hidden="true">✓</span>
            Confirmar trecho
          </button>
        </section>
      ) : null}
      <OutputValue
        value={videoPayableAmount}
        minimum={videoMinimum}
        onChange={setAmount}
      />
      <small className="minimum-copy">
        O valor mínimo é R${' '}
        {((preview?.amountInCents ?? session.minimumContributionInCents) / 100)
          .toFixed(2)
          .replace('.', ',')}
      </small>
      <button
        className="contribute-button"
        disabled={
          !confirmed ||
          checkoutBusy ||
          supporterName.trim().length < 2 ||
          videoPayableAmount < videoMinimum
        }
        type="submit"
      >
        {checkoutBusy ? 'Gerando Pix…' : 'Continuar'}
      </button>
      {videoBlockReason ? (
        <small className="flow-status error">{videoBlockReason}</small>
      ) : null}
      <small className="checkout-terms">
        Ao continuar, você concorda com os Termos de Uso e a Política de
        Privacidade.
      </small>
      <small className="flow-status">{status}</small>
    </form>
  );
}

function SongBox({
  slug,
  supporterName,
}: {
  slug: string;
  supporterName: string;
}) {
  const [session, setSession] = useState<SongSession | null>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Song>();
  const [pix, setPix] = useState<Pix>();
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [loadingSong, setLoadingSong] = useState(false);
  const [validationError, setValidationError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    void fetch(`${api}/public/creators/${slug}/songpix`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Não foi possível carregar o SongPix.');
        const payload = await response.text();
        return payload ? (JSON.parse(payload) as SongSession) : null;
      })
      .then((active) => {
        setSession(active);
        if (active)
          setAmount((current) =>
            Math.max(current, active.minimumContributionInCents),
          );
      })
      .catch((error: unknown) => {
        setValidationError(
          (error as Error).name === 'AbortError'
            ? 'O SongPix demorou para responder. Tente novamente.'
            : (error as Error).message,
        );
      });
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [slug]);
  useEffect(() => {
    const value = query.trim();
    setSelected(undefined);
    setSongs([]);
    setValidationError('');
    if (!session || !value) {
      setLoadingSong(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const debounce = window.setTimeout(() => {
      setLoadingSong(true);
      void fetch(
        `${api}/public/songpix/catalog?q=${encodeURIComponent(value)}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          const body = (await response.json().catch(() => [])) as
            Song[] | { message?: string };
          if (!response.ok || !Array.isArray(body))
            throw new Error(
              !Array.isArray(body) && body.message
                ? body.message
                : 'Não foi possível validar esta música.',
            );
          const available = body.filter((song) => song.available !== false);
          const withinDuration = available.filter(
            (song) => song.durationSeconds <= session.maximumDurationSeconds,
          );
          const compatible = withinDuration.filter(
            (song) =>
              unknownGenre(song.genre) ||
              !session.allowedGenres.length ||
              session.allowedGenres.some(
                (genre) =>
                  normalizedGenre(genre) === normalizedGenre(song.genre),
              ),
          );
          setSongs(compatible);
          if (compatible.length === 1) setSelected(compatible[0]);
          if (!compatible.length) {
            if (available.length && !withinDuration.length)
              setValidationError(
                `Esta música dura mais que o limite de ${clock(session.maximumDurationSeconds)}.`,
              );
            else if (withinDuration.length)
              setValidationError(
                `Esta música foi identificada como ${withinDuration[0]?.genre}. O tema de hoje é ${session.allowedGenres.join(', ')}.`,
              );
            else
              setValidationError(
                'Esta música não está disponível para reprodução.',
              );
          }
        })
        .catch((error: unknown) => {
          setValidationError(
            (error as Error).name === 'AbortError'
              ? 'A validação demorou demais. Confira o link e tente novamente.'
              : (error as Error).message,
          );
        })
        .finally(() => {
          window.clearTimeout(timeout);
          setLoadingSong(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(debounce);
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, session]);
  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!session || !selected) return;
    const payableAmount =
      Number.isFinite(amount) && amount > 0
        ? amount
        : session.minimumContributionInCents;
    if (supporterName.trim().length < 2)
      return setStatus('Informe seu nome de usuário para continuar.');
    if (payableAmount < session.minimumContributionInCents)
      return setStatus(
        `O valor mínimo é R$ ${(session.minimumContributionInCents / 100).toFixed(2).replace('.', ',')}.`,
      );
    setCheckoutBusy(true);
    try {
      const response = await fetch(
        `${api}/public/songpix/sessions/${session.id}/checkout`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            songId: selected.id,
            supporterName,
            amountInCents: payableAmount,
          }),
        },
      ).catch(() => null);
      if (!response)
        return setStatus(
          'A conexão falhou. Verifique sua internet e tente novamente.',
        );
      const body = (await response.json()) as Pix & { message?: string };
      if (!response.ok)
        return setStatus(body.message ?? 'Não foi possível continuar.');
      setPix(body);
    } finally {
      setCheckoutBusy(false);
    }
  }
  if (session === null)
    return <p>O criador não está aceitando músicas agora.</p>;
  if (!session) return <p>Carregando…</p>;
  if (pix) return <PixBox pix={pix} />;
  const payableAmount =
    Number.isFinite(amount) && amount > 0
      ? amount
      : session.minimumContributionInCents;
  const missingName = supporterName.trim().length < 2;
  return (
    <form className="compact-media-form" onSubmit={(e) => void checkout(e)}>
      <label>
        Link da música no YouTube
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cole o link do YouTube"
        />
        <small>
          Tema da live:{' '}
          {session.allowedGenres.length
            ? session.allowedGenres.join(', ')
            : 'livre'}{' '}
          · duração máxima {clock(session.maximumDurationSeconds)}
        </small>
      </label>
      <div className="compact-song-results">
        {songs.map((song) => (
          <button
            type="button"
            className={selected?.id === song.id ? 'selected' : ''}
            key={song.id}
            onClick={() => setSelected(song)}
          >
            {song.artworkUrl ? (
              <Image
                unoptimized
                src={song.artworkUrl}
                alt=""
                width={72}
                height={72}
              />
            ) : null}
            <span>
              <strong>{song.title}</strong>
              <small>
                {song.artist} · {song.genre}
              </small>
            </span>
            <b>♫</b>
          </button>
        ))}
      </div>
      {loadingSong ? (
        <small className="flow-status">Validando música…</small>
      ) : null}
      {!loadingSong && validationError ? (
        <small className="flow-status error">{validationError}</small>
      ) : null}
      {!loadingSong && selected ? (
        <small
          className={`flow-status ${unknownGenre(selected.genre) ? '' : 'success'}`}
        >
          {unknownGenre(selected.genre)
            ? 'Estilo não confirmado automaticamente; o pedido será aceito.'
            : `Música identificada como ${selected.genre} e selecionada.`}
        </small>
      ) : null}
      <OutputValue
        value={payableAmount}
        minimum={session.minimumContributionInCents}
        onChange={setAmount}
      />
      <button
        className="contribute-button"
        disabled={
          !selected ||
          loadingSong ||
          checkoutBusy ||
          missingName ||
          payableAmount < session.minimumContributionInCents
        }
        type="submit"
      >
        {checkoutBusy
          ? 'Gerando Pix…'
          : selected
            ? `Continuar com R$ ${(payableAmount / 100).toFixed(2).replace('.', ',')}`
            : 'Continuar'}
      </button>
      {selected && missingName ? (
        <small className="flow-status error">
          Informe seu nome de usuário acima para liberar o pagamento.
        </small>
      ) : null}
      <small className="minimum-copy">
        O valor mínimo é R${' '}
        {(session.minimumContributionInCents / 100)
          .toFixed(2)
          .replace('.', ',')}
      </small>
      <small className="checkout-terms">
        Ao continuar, você concorda com os Termos de Uso e a Política de
        Privacidade.
      </small>
      {status ? <small className="flow-status error">{status}</small> : null}
    </form>
  );
}

function OutputValue({
  value,
  minimum,
  onChange,
}: {
  value: number;
  minimum: number;
  onChange: (value: number) => void;
}) {
  const formatted = (value / 100).toFixed(2).replace('.', ',');
  const [text, setText] = useState(formatted);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(formatted);
  }, [editing, formatted]);
  function change(next: string) {
    const normalized = next.replace(/[^\d,.]/g, '').replace('.', ',');
    if (!/^\d*(,\d{0,2})?$/.test(normalized)) return;
    setText(normalized);
    if (!normalized || normalized === ',') return;
    const parsed = Number(normalized.replace(',', '.'));
    if (Number.isFinite(parsed)) onChange(Math.round(parsed * 100));
  }
  return (
    <div className="compact-value">
      <span className="currency-selector">
        BRL <i aria-hidden="true" />
      </span>
      <fieldset className="value-field">
        <legend>Valor</legend>
        <div>
          <span>R$</span>
          <input
            aria-label="Valor da contribuição"
            aria-invalid={value < minimum}
            type="text"
            inputMode="decimal"
            value={text}
            onFocus={(event) => {
              setEditing(true);
              event.currentTarget.select();
            }}
            onChange={(event) => change(event.target.value)}
            onBlur={() => {
              setEditing(false);
              setText((value / 100).toFixed(2).replace('.', ','));
            }}
          />
        </div>
      </fieldset>
    </div>
  );
}
function PixBox({ pix }: { pix: Pix }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(30 * 60);
  const isMock = pix.pixCopyPaste.startsWith('STREAMOS-MOCK-');
  const simulationEnabled = usePaymentSimulation();
  useEffect(() => {
    const expiresAt = pix.expiresAt
      ? new Date(pix.expiresAt).getTime()
      : Date.now() + 30 * 60_000;
    const check = async () => {
      const response = await fetch(`${api}/public/payment-intents/${pix.id}`, {
        cache: 'no-store',
      }).catch(() => null);
      if (!response) return;
      if (!response.ok) return;
      const body = (await response.json()) as { confirmedAt?: string | null };
      if (body.confirmedAt) setConfirmed(true);
    };
    void check();
    const poll = window.setInterval(() => void check(), 2_000);
    const timer = window.setInterval(
      () =>
        setRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1_000))),
      1_000,
    );
    return () => {
      clearInterval(poll);
      clearInterval(timer);
    };
  }, [pix.expiresAt, pix.id]);
  return (
    <div className="pix-payment">
      {pix.qrCodePayload?.startsWith('http') ? (
        <Image
          className="pix-qr-image"
          src={pix.qrCodePayload}
          alt="QR Code Pix"
          width={220}
          height={220}
          unoptimized
        />
      ) : (
        <div className="mock-qr" aria-label="QR Code Pix">
          PIX
        </div>
      )}
      <strong>{confirmed ? 'Pagamento identificado' : 'Pagamento Pix'}</strong>
      <p>
        {confirmed
          ? 'A contribuição entrou na fila automática.'
          : `Expira em ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`}
      </p>
      <code>{pix.pixCopyPaste}</code>
      <button
        className="copy-pix-button"
        type="button"
        onClick={() =>
          void navigator.clipboard.writeText(pix.pixCopyPaste).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          })
        }
      >
        <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
        {copied ? 'Código copiado' : 'Copiar código Pix'}
      </button>
      {isMock || simulationEnabled ? (
        <button
          className="contribute-button"
          disabled={confirmed}
          onClick={() =>
            void fetch(`${api}/mock/payment-intents/${pix.id}/confirm`, {
              method: 'POST',
            }).then((response) => setConfirmed(response.ok))
          }
        >
          {confirmed ? 'Enviado para a fila' : 'Simular pagamento (teste)'}
        </button>
      ) : (
        <span
          className={`payment-waiting${confirmed ? ' confirmed' : ''}`}
          role="status"
        >
          {confirmed
            ? 'Recibo confirmado · enviado para a fila'
            : 'Aguardando pagamento…'}
        </span>
      )}
      <small>
        A contribuição é definitiva após a confirmação. Bloquear um conteúdo
        impede sua reprodução, mas não desfaz o apoio.
      </small>
    </div>
  );
}
