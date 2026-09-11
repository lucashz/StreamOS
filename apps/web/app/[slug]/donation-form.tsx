'use client';

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { usePaymentSimulation } from '../use-payment-simulation';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Charge = {
  id: string;
  pixCopyPaste: string;
  qrCodePayload?: string;
  expiresAt: string;
};

type Receipt = {
  receiptId: string | null;
  confirmedAt: string | null;
};

const voiceProfiles = [
  {
    id: 'ai-popular-orator',
    name: 'Orador popular',
    detail: 'Teste IA · madura e pausada',
    avatar: '🗣️',
  },
  {
    id: 'ai-commander',
    name: 'Comandante',
    detail: 'Teste IA · grave e enérgica',
    avatar: '🎖️',
  },
  {
    id: 'pt-BR-default',
    name: 'Natural',
    detail: 'Clara e equilibrada',
    avatar: '🎙️',
  },
  {
    id: 'character-narrator',
    name: 'Locutor',
    detail: 'Épica e marcante',
    avatar: '📻',
  },
  {
    id: 'character-deep',
    name: 'Titã',
    detail: 'Grave e cadenciada',
    avatar: '🦁',
  },
  {
    id: 'character-cheerful',
    name: 'Torcida',
    detail: 'Movimento intenso',
    avatar: '⚽',
  },
  {
    id: 'character-robot',
    name: 'Sintético',
    detail: 'Digital e divertida',
    avatar: '🤖',
  },
] as const;

export function DonationForm({
  slug,
  minimumInCents,
  supporterName,
  hideSupporterName = false,
}: Readonly<{
  slug: string;
  minimumInCents: number;
  supporterName?: string;
  hideSupporterName?: boolean;
}>) {
  const [amount, setAmount] = useState(Math.max(2000, minimumInCents));
  const [stage, setStage] = useState<
    'form' | 'creating' | 'pix' | 'confirming' | 'receipt' | 'error'
  >('form');
  const [charge, setCharge] = useState<Charge>();
  const [receipt, setReceipt] = useState<Receipt>();
  const [errorMessage, setErrorMessage] = useState(
    'Não foi possível continuar. Tente novamente.',
  );
  const [voice, setVoice] = useState('pt-BR-default');
  const [copied, setCopied] = useState(false);
  const simulationEnabled = usePaymentSimulation();

  function previewVoice(selectedVoice = voice) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(
      'Valeu pelo apoio! Esta é a voz escolhida para sua mensagem.',
    );
    speech.lang = 'pt-BR';
    const available = window.speechSynthesis.getVoices();
    const portuguese = available.filter((item) =>
      item.lang.toLowerCase().startsWith('pt'),
    );
    const pool = [
      ...portuguese,
      ...available.filter((item) => !portuguese.includes(item)),
    ];
    const profileIndex: Record<string, number> = {
      'ai-popular-orator': 1,
      'ai-commander': 2,
      'pt-BR-default': 0,
      'character-narrator': 1,
      'character-deep': 2,
      'character-cheerful': 3,
      'character-robot': 4,
    };
    const selected = pool[(profileIndex[selectedVoice] ?? 0) % pool.length];
    if (selected) {
      speech.voice = selected;
      speech.lang = selected.lang;
    }
    if (selectedVoice === 'ai-popular-orator') {
      speech.pitch = 0.72;
      speech.rate = 0.78;
    } else if (selectedVoice === 'ai-commander') {
      speech.pitch = 0.52;
      speech.rate = 1.04;
    } else if (selectedVoice === 'character-narrator') {
      speech.pitch = 0.78;
      speech.rate = 0.86;
    } else if (selectedVoice === 'character-deep') {
      speech.pitch = 0.45;
      speech.rate = 0.76;
    } else if (selectedVoice === 'character-cheerful') {
      speech.pitch = 1.55;
      speech.rate = 1.22;
    } else if (selectedVoice === 'character-robot') {
      speech.pitch = 0.25;
      speech.rate = 0.68;
    }
    window.speechSynthesis.speak(speech);
  }

  useEffect(() => {
    if (
      !charge ||
      stage !== 'pix' ||
      charge.pixCopyPaste.startsWith('STREAMOS-MOCK-')
    )
      return;
    const check = async () => {
      const response = await fetch(
        `${api}/public/payment-intents/${charge.id}`,
        { cache: 'no-store' },
      ).catch(() => null);
      if (!response) return;
      if (!response.ok) return;
      const value = (await response.json()) as Receipt;
      if (value.confirmedAt) {
        setReceipt(value);
        setStage('receipt');
      }
    };
    void check();
    const poll = window.setInterval(() => void check(), 2_000);
    return () => window.clearInterval(poll);
  }, [charge, stage]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStage('creating');
    setErrorMessage('Não foi possível criar o Pix. Tente novamente.');
    const data = new FormData(event.currentTarget);
    const response = await fetch(
      `${api}/public/creators/${slug}/payment-intents`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountInCents: amount,
          supporterName: supporterName ?? data.get('supporterName'),
          message: data.get('message'),
          anonymous: data.get('anonymous') === 'on',
          ttsVoice: data.get('ttsVoice'),
        }),
      },
    ).catch(() => null);
    if (!response) {
      setErrorMessage(
        'A API não respondeu. Verifique sua conexão e tente novamente.',
      );
      setStage('error');
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string | string[];
      } | null;
      const detail = Array.isArray(body?.message)
        ? body.message.join(' ')
        : body?.message;
      setErrorMessage(
        detail ?? 'Não foi possível criar o Pix. Tente novamente.',
      );
      setStage('error');
      return;
    }
    setCharge((await response.json()) as Charge);
    setStage('pix');
  }

  async function confirm() {
    if (!charge) return;
    setStage('confirming');
    const response = await fetch(
      `${api}/mock/payment-intents/${charge.id}/confirm`,
      {
        method: 'POST',
      },
    ).catch(() => null);
    if (!response) {
      setErrorMessage('A confirmação não respondeu. Tente novamente.');
      setStage('error');
      return;
    }
    if (!response.ok) {
      setStage('error');
      return;
    }
    const status = await fetch(
      `${api}/public/payment-intents/${charge.id}`,
    ).catch(() => null);
    if (!status) {
      setErrorMessage('Não foi possível consultar o pagamento.');
      setStage('error');
      return;
    }
    if (!status.ok) {
      setStage('error');
      return;
    }
    setReceipt((await status.json()) as Receipt);
    setStage('receipt');
  }

  if (stage === 'pix' || stage === 'confirming')
    return (
      <div className="pix-payment">
        {charge?.qrCodePayload?.startsWith('http') ? (
          <Image
            className="pix-qr-image"
            src={charge.qrCodePayload}
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
        <strong>Pagamento Pix aguardando confirmação</strong>
        <p>Copie o código abaixo ou leia o QR Code.</p>
        <code>{charge?.pixCopyPaste}</code>
        <button
          className="copy-pix-button"
          type="button"
          onClick={() =>
            void navigator.clipboard
              .writeText(charge?.pixCopyPaste ?? '')
              .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              })
          }
        >
          <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
          {copied ? 'Código copiado' : 'Copiar código Pix'}
        </button>
        {charge?.pixCopyPaste.startsWith('STREAMOS-MOCK-') ||
        simulationEnabled ? (
          <button
            className="contribute-button"
            disabled={stage === 'confirming'}
            onClick={() => void confirm()}
          >
            {stage === 'confirming'
              ? 'Confirmando…'
              : 'Simular pagamento (teste)'}
          </button>
        ) : (
          <span className="payment-waiting" role="status">
            Aguardando pagamento…
          </span>
        )}
        <small>
          Esta cobrança expira em{' '}
          {charge
            ? new Date(charge.expiresAt).toLocaleString('pt-BR')
            : '30 minutos'}
          .
        </small>
        <small>
          A contribuição é definitiva após a confirmação. Bloquear conteúdo não
          desfaz o apoio.
        </small>
      </div>
    );

  if (stage === 'receipt')
    return (
      <div className="donation-success">
        <strong>Contribuição confirmada!</strong>
        <p>O pagamento entrou no ledger e o alerta foi enviado ao overlay.</p>
        <small>Recibo: {receipt?.receiptId}</small>
        <small>
          Confirmado em{' '}
          {receipt?.confirmedAt
            ? new Date(receipt.confirmedAt).toLocaleString('pt-BR')
            : 'agora'}
          .
        </small>
        <button
          onClick={() => {
            setCharge(undefined);
            setReceipt(undefined);
            setStage('form');
          }}
        >
          Enviar outra
        </button>
      </div>
    );

  return (
    <form onSubmit={(event) => void submit(event)}>
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
              type="number"
              min={(minimumInCents / 100).toFixed(2)}
              step="0.01"
              value={(amount / 100).toFixed(2)}
              onChange={(event) =>
                setAmount(Math.round(Number(event.target.value) * 100))
              }
            />
          </div>
        </fieldset>
      </div>
      {!hideSupporterName ? (
        <label>
          Seu apelido
          <input
            name="supporterName"
            defaultValue="PixelHero"
            maxLength={60}
            required
          />
        </label>
      ) : null}
      <label>
        Mensagem
        <textarea
          name="message"
          defaultValue="Boa sorte na live!"
          maxLength={300}
        />
      </label>
      <fieldset className="voice-picker">
        <legend>Voz do alerta</legend>
        <p>Personas sintéticas originais. Não representam pessoas reais.</p>
        <div className="voice-profile-grid">
          {voiceProfiles.map((profile) => (
            <label
              className={`voice-profile${voice === profile.id ? ' selected' : ''}`}
              key={profile.id}
            >
              <input
                type="radio"
                name="ttsVoice"
                value={profile.id}
                checked={voice === profile.id}
                onChange={() => setVoice(profile.id)}
              />
              <span className="voice-avatar" role="img" aria-label="">
                {profile.avatar}
              </span>
              <strong>{profile.name}</strong>
              <small>{profile.detail}</small>
              <button
                type="button"
                aria-label={`Ouvir voz ${profile.name}`}
                onClick={(event) => {
                  event.preventDefault();
                  setVoice(profile.id);
                  previewVoice(profile.id);
                }}
              >
                ▶ Ouvir
              </button>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="consent-field">
        <input name="anonymous" type="checkbox" />
        Mostrar esta contribuição como anônima
      </label>
      {stage === 'error' ? <p className="auth-error">{errorMessage}</p> : null}
      <button
        className="contribute-button"
        disabled={
          stage === 'creating' ||
          amount < minimumInCents ||
          (hideSupporterName && (supporterName?.trim().length ?? 0) < 2)
        }
        type="submit"
      >
        {stage === 'creating'
          ? 'Gerando Pix…'
          : `Continuar com R$ ${(amount / 100).toFixed(2).replace('.', ',')}`}
      </button>
      <small>
        Ao continuar, você concorda com os Termos de Uso e a Política de
        Privacidade. Valor mínimo: R${' '}
        {(minimumInCents / 100).toFixed(2).replace('.', ',')}.
      </small>
    </form>
  );
}
