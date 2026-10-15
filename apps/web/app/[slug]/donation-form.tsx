'use client';

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { usePaymentSimulation } from '../use-payment-simulation';
import {
  voiceProfiles,
  previewTtsVoice,
  stopTtsVoice,
  type VoiceCategory,
} from '../voice-profiles';

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
  const [voice, setVoice] = useState('voice-silvio');
  const [message, setMessage] = useState('Boa sorte na live!');
  const [categoryFilter, setCategoryFilter] = useState<'all' | VoiceCategory>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const simulationEnabled = usePaymentSimulation();

  function togglePreview(targetVoiceId: string) {
    if (playingVoiceId === targetVoiceId || loadingVoiceId === targetVoiceId) {
      stopTtsVoice();
      setPlayingVoiceId(null);
      setLoadingVoiceId(null);
      return;
    }

    setLoadingVoiceId(targetVoiceId);
    const profile = voiceProfiles.find((v) => v.id === targetVoiceId);
    const textToSpeak = message.trim() || profile?.sample || 'Alerta StreamOS!';

    previewTtsVoice(targetVoiceId, textToSpeak, {
      onStart: () => {
        setPlayingVoiceId(targetVoiceId);
        setLoadingVoiceId(null);
      },
      onEnd: () => {
        setPlayingVoiceId(null);
        setLoadingVoiceId(null);
      },
      onError: () => {
        setPlayingVoiceId(null);
        setLoadingVoiceId(null);
      },
    });
  }

  useEffect(() => {
    if (
      !charge ||
      stage !== 'pix' ||
      charge.pixCopyPaste.startsWith('STREAMOS-MOCK-')
    )
      return;
    const check = async () => {
      if (new Date(charge.expiresAt).getTime() <= Date.now()) {
        setCharge(undefined);
        setErrorMessage(
          'Este Pix expirou. Gere uma nova cobrança para continuar.',
        );
        setStage('error');
        return;
      }
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
    const expiry = window.setTimeout(
      () => {
        setCharge(undefined);
        setErrorMessage(
          'Este Pix expirou. Gere uma nova cobrança para continuar.',
        );
        setStage('error');
      },
      Math.max(0, new Date(charge.expiresAt).getTime() - Date.now()),
    );
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(expiry);
    };
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
          message: message,
          anonymous: data.get('anonymous') === 'on',
          ttsVoice: voice,
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
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          placeholder="Digite a mensagem que a voz vai falar na live..."
        />
      </label>
      <fieldset className="voice-picker">
        <legend>Voz do alerta (IA & Personalidades)</legend>
        <div className="voice-picker-header">
          <p>Escolha a voz que falará sua mensagem ao vivo no OBS.</p>
        </div>

        {/* Abas de Categorias */}
        <div
          className="voice-category-tabs"
          role="tablist"
          aria-label="Categorias de voz"
        >
          <button
            type="button"
            className={`voice-tab${categoryFilter === 'all' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            ⭐ Todas ({voiceProfiles.length})
          </button>
          <button
            type="button"
            className={`voice-tab${categoryFilter === 'tv' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('tv')}
          >
            📺 Televisão (
            {voiceProfiles.filter((v) => v.category === 'tv').length})
          </button>
          <button
            type="button"
            className={`voice-tab${categoryFilter === 'personalities' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('personalities')}
          >
            🎙️ Ícones & Esporte (
            {voiceProfiles.filter((v) => v.category === 'personalities').length})
          </button>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="voice-search-box">
          <input
            type="text"
            className="voice-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou personalidade (ex: Silvio, Galvão, Faustão)..."
            aria-label="Buscar vozes"
          />
        </div>

        {/* Grade de Vozes Filtradas */}
        <div className="voice-profile-grid">
          {voiceProfiles
            .filter((p) => {
              const matchesCat =
                categoryFilter === 'all' || p.category === categoryFilter;
              const q = searchQuery.trim().toLowerCase();
              const matchesSearch =
                !q ||
                p.name.toLowerCase().includes(q) ||
                p.analogy.toLowerCase().includes(q) ||
                p.detail.toLowerCase().includes(q);
              return matchesCat && matchesSearch;
            })
            .map((profile) => {
              const isSelected = voice === profile.id;
              const isPlaying = playingVoiceId === profile.id;
              const isLoading = loadingVoiceId === profile.id;

              return (
                <label
                  className={`voice-profile${isSelected ? ' selected' : ''}`}
                  key={profile.id}
                >
                  <input
                    type="radio"
                    name="ttsVoice"
                    value={profile.id}
                    checked={isSelected}
                    onChange={() => setVoice(profile.id)}
                  />
                  {isSelected ? (
                    <span
                      className="voice-profile-check"
                      title="Voz selecionada"
                    >
                      ✓
                    </span>
                  ) : null}
                  <span className="voice-avatar" role="img" aria-label="">
                    {profile.avatar}
                  </span>
                  <strong>{profile.name}</strong>
                  <span className="voice-analogy-badge">{profile.analogy}</span>
                  <small>{profile.detail}</small>
                  <button
                    type="button"
                    className={isPlaying ? 'playing' : ''}
                    aria-label={`Ouvir voz ${profile.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      setVoice(profile.id);
                      togglePreview(profile.id);
                    }}
                  >
                    {isLoading
                      ? '⏳ Gerando…'
                      : isPlaying
                        ? '⏹ Parar'
                        : '▶ Ouvir'}
                  </button>
                </label>
              );
            })}
        </div>

        {/* Resumo da Voz Selecionada e Teste com a Mensagem do Usuário */}
        {(() => {
          const selectedProfile = voiceProfiles.find((v) => v.id === voice);
          if (!selectedProfile) return null;
          const isPlayingSelected = playingVoiceId === selectedProfile.id;
          const isLoadingSelected = loadingVoiceId === selectedProfile.id;

          return (
            <div className="voice-selection-preview">
              <div className="voice-selection-info">
                <span
                  className="voice-avatar"
                  style={{ width: 32, height: 32, fontSize: 16 }}
                >
                  {selectedProfile.avatar}
                </span>
                <div>
                  <strong>Voz ativa: {selectedProfile.name}</strong>
                  <small style={{ display: 'block', color: 'var(--muted)' }}>
                    {selectedProfile.analogy} · Alta fidelidade neural
                  </small>
                </div>
              </div>
              <button
                type="button"
                className={`secondary-button voice-test-my-msg-button${isPlayingSelected ? ' playing' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  togglePreview(selectedProfile.id);
                }}
              >
                {isLoadingSelected
                  ? '⏳ Sintetizando…'
                  : isPlayingSelected
                    ? '⏹ Parar prévia'
                    : '🔊 Testar com minha mensagem'}
              </button>
            </div>
          );
        })()}
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
