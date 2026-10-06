'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
import { replaceZeroMoneyValue, selectZeroMoneyValue } from '../money-input';
import { PageHeader } from '../ui';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const complianceLabels: Record<string, string> = {
  PENDING: 'Pendente',
  SANDBOX_APPROVED: 'Aprovada no ambiente de testes',
  APPROVED: 'Aprovada',
  REJECTED: 'Requer correção',
};

type Onboarding = {
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  isPublished: boolean;
  minimumContributionInCents: number | string;
  onboardingCompletedAt: string | null;
  organization: {
    complianceProfile: { status: string } | null;
    walletSettings: {
      legalName: string | null;
      taxIdMasked: string | null;
      financialTermsAcceptedAt: string | null;
      providerSubaccountStatus: string;
      providerWithdrawBlocked: boolean;
    } | null;
  };
};

type OverlayStatus = {
  configured: boolean;
  connected: boolean;
};

export default function OnboardingPage() {
  const [profile, setProfile] = useState<Onboarding>();
  const [overlay, setOverlay] = useState<OverlayStatus>();
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [financialTermsAccepted, setFinancialTermsAccepted] = useState(false);
  const [status, setStatus] = useState('Carregando configuração…');

  useEffect(() => {
    void Promise.all([
      fetch(`${api}/dashboard/onboarding`, { credentials: 'include' }),
      fetch(`${api}/dashboard/overlay/status`, { credentials: 'include' }),
    ])
      .then(async ([onboardingResponse, overlayResponse]) => {
        if (!onboardingResponse.ok)
          throw new Error('Entre na sua conta para continuar.');
        const value = (await onboardingResponse.json()) as Onboarding;
        if (overlayResponse.ok)
          setOverlay((await overlayResponse.json()) as OverlayStatus);
        setProfile(value);
        setLegalName(value.organization.walletSettings?.legalName ?? '');
        setFinancialTermsAccepted(
          Boolean(value.organization.walletSettings?.financialTermsAcceptedAt),
        );
        setStatus('');
      })
      .catch((error: unknown) =>
        setStatus(error instanceof Error ? error.message : 'Erro inesperado'),
      );
  }, []);

  async function save() {
    if (!profile) return;
    setStatus('Salvando…');
    const response = await fetch(`${api}/dashboard/onboarding`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...profile,
        legalName,
        taxId,
        financialTermsAccepted,
        minimumContributionInCents: Number(profile.minimumContributionInCents),
      }),
    });
    const body = (await response.json()) as Onboarding & { message?: string };
    if (!response.ok) {
      setStatus(body.message ?? 'Não foi possível salvar.');
      return;
    }
    setProfile({ ...profile, ...body });
    setStatus('Página configurada com sucesso.');
  }

  return (
    <PanelShell>
      <main className="feature-page">
        <Link href="/" className="back-link">
          ← Visão geral
        </Link>
        <PageHeader
          eyebrow="Primeiros passos"
          title="Ative sua página StreamOS"
          description="Configure perfil, contribuições e OBS em uma única tela."
        />
        <ol className="onboarding-steps" aria-label="Etapas da configuração">
          {[
            'Perfil',
            'Página pública',
            'Contribuições',
            'OBS',
            'Conclusão',
          ].map((step, index) => (
            <li className={index === 0 ? 'active' : ''} key={step}>
              <b>{index + 1}</b>
              {step}
            </li>
          ))}
        </ol>
        {profile ? (
          <>
            <section
              className="feature-card settings-form"
              aria-labelledby="profile-step"
            >
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Etapas 1 e 2</span>
                  <h2 id="profile-step">Perfil e página pública</h2>
                </div>
              </div>
              <div className="activation-checklist">
                <strong>Checklist de ativação</strong>
                <span>✓ Conta criada e termos aceitos</span>
                <span>
                  ✓ Verificação sandbox:{' '}
                  {complianceLabels[
                    profile.organization.complianceProfile?.status ?? 'PENDING'
                  ] ?? 'Em análise'}
                </span>
                <span>
                  {profile.onboardingCompletedAt ? '✓' : '○'} Perfil configurado
                </span>
                <span>
                  {profile.isPublished
                    ? '✓ Página publicada'
                    : '○ Página ainda privada'}
                </span>
                <span>
                  {overlay?.connected
                    ? '✓ OBS conectado'
                    : overlay?.configured
                      ? '○ OBS sem conexão'
                      : '○ Browser Source ainda não configurado'}
                </span>
              </div>
              <div className="form-grid two-columns">
                <label>
                  Nome legal
                  <input
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label>
                  CPF ou CNPJ
                  <input
                    value={taxId}
                    onChange={(event) => setTaxId(event.target.value)}
                    inputMode="numeric"
                    placeholder={
                      profile.organization.walletSettings?.taxIdMasked ??
                      'Somente números'
                    }
                  />
                  <small>
                    Usado somente para titularidade e conformidade financeira.
                  </small>
                </label>
              </div>
              <label className="consent-field">
                <input
                  type="checkbox"
                  checked={financialTermsAccepted}
                  onChange={(event) =>
                    setFinancialTermsAccepted(event.target.checked)
                  }
                />
                Aceito os termos financeiros e autorizo a criação da minha
                carteira de recebimentos.
              </label>
              <label>
                Nome público
                <input
                  value={profile.displayName}
                  onChange={(event) =>
                    setProfile({ ...profile, displayName: event.target.value })
                  }
                />
              </label>
              <label>
                Endereço público
                <div className="slug-field">
                  <span>streamos.com/</span>
                  <input
                    value={profile.slug}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        slug: event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, '-'),
                      })
                    }
                  />
                </div>
              </label>
              <label>
                Biografia
                <textarea
                  maxLength={500}
                  value={profile.bio ?? ''}
                  onChange={(event) =>
                    setProfile({ ...profile, bio: event.target.value })
                  }
                />
              </label>
              <div className="form-grid two-columns">
                <label>
                  Avatar
                  <input
                    type="url"
                    value={profile.avatarUrl ?? ''}
                    onChange={(event) =>
                      setProfile({ ...profile, avatarUrl: event.target.value })
                    }
                    placeholder="https://..."
                  />
                  <small>Imagem quadrada hospedada em HTTPS.</small>
                </label>
                <label>
                  Capa
                  <input
                    type="url"
                    value={profile.coverUrl ?? ''}
                    onChange={(event) =>
                      setProfile({ ...profile, coverUrl: event.target.value })
                    }
                    placeholder="https://..."
                  />
                  <small>Recomendado: imagem horizontal.</small>
                </label>
              </div>
              <label>
                Contribuição mínima
                <span className="money-input">
                  <b>R$</b>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    inputMode="decimal"
                    aria-label="Contribuição mínima em reais"
                    value={Number(profile.minimumContributionInCents) / 100}
                    onFocus={selectZeroMoneyValue}
                    onKeyDown={replaceZeroMoneyValue}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        minimumContributionInCents: Math.round(
                          Number(event.target.value) * 100,
                        ),
                      })
                    }
                  />
                </span>
                <small className="money-field-help">
                  Menor valor aceito na sua página pública.
                </small>
              </label>
              <label className="consent-field">
                <input
                  type="checkbox"
                  checked={profile.isPublished}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      isPublished: event.target.checked,
                    })
                  }
                />
                Publicar minha página de contribuição
              </label>
              <div className="form-actions">
                <button onClick={() => void save()}>Salvar configuração</button>
                {profile.isPublished ? (
                  <Link href={`/${profile.slug}`}>Visualizar página</Link>
                ) : null}
              </div>
            </section>
            <section
              className="feature-card settings-form"
              aria-labelledby="contribution-step"
            >
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Etapa 3</span>
                  <h2 id="contribution-step">Contribuições aceitas</h2>
                </div>
              </div>
              <p>
                Texto, VideoPix e SongPix estão disponíveis. Áudio/TTS e Música
                IA aparecem quando forem habilitados.
              </p>
              <div className="acceptance-grid">
                {[
                  'Texto',
                  'Áudio / TTS',
                  'Música IA',
                  'VideoPix',
                  'SongPix',
                ].map((type, index) => (
                  <span
                    className={index === 0 || index > 2 ? 'enabled' : ''}
                    key={type}
                  >
                    {index === 0 || index > 2 ? '✓' : '○'} {type}
                  </span>
                ))}
              </div>
            </section>
            <section aria-labelledby="obs-step">
              <span className="section-kicker">Etapa 4 · OBS</span>
              <h2 id="obs-step">Configurar Browser Source</h2>
              <Link
                className="secondary-button button-link"
                href="/conta#browser-source"
              >
                {overlay?.connected
                  ? 'Revisar configurações do OBS'
                  : 'Configurar Browser Source'}
              </Link>
              {overlay?.configured && !overlay.connected ? (
                <p className="field-help">
                  A URL já foi criada. Abra a Browser Source no OBS para
                  concluir a conexão.
                </p>
              ) : null}
            </section>
            <section
              className="feature-card onboarding-finish"
              aria-labelledby="finish-step"
            >
              <div>
                <span className="section-kicker">Etapa 5</span>
                <h2 id="finish-step">Pronto para transmitir</h2>
                <p>
                  Salve o perfil, publique a página e adicione a URL única ao
                  OBS.
                </p>
              </div>
              <Link
                className="primary-button"
                href={
                  !profile.onboardingCompletedAt || !profile.isPublished
                    ? '#profile-step'
                    : !overlay?.connected
                      ? '/conta#browser-source'
                      : '/central-da-live'
                }
              >
                {!profile.onboardingCompletedAt || !profile.isPublished
                  ? 'Concluir perfil e publicação'
                  : !overlay?.connected
                    ? 'Conectar o OBS'
                    : 'Ir para a Central da Live'}
              </Link>
            </section>
          </>
        ) : null}
        {status ? (
          <p className="account-status" role="status">
            {status}
          </p>
        ) : null}
      </main>
    </PanelShell>
  );
}
