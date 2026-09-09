'use client';

import { useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    v / 100,
  );
const campaignStatusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicada',
  CLOSED: 'Encerrada',
};
const campaignProgress = (current: number, target: number) =>
  target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
type Campaign = {
  id: string;
  slug: string;
  title: string;
  description: string;
  targetInCents: number;
  currentInCents: number;
  status: string;
  imageUrl: string | null;
  endsAt: string | null;
  contributions: Array<{ id: string }>;
  rewards: Array<{
    id: string;
    title: string;
    minimumInCents: number;
    availableQuantity: number | null;
    claims?: Array<{
      id: string;
      status: string;
      supporterName: string | null;
      amountInCents: number | null;
      deliveredAt: string | null;
    }>;
  }>;
};

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('1000');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [status, setStatus] = useState('');
  const [rewardCampaign, setRewardCampaign] = useState('');
  const [rewardName, setRewardName] = useState('');
  const [rewardMinimum, setRewardMinimum] = useState('10');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardQuantity, setRewardQuantity] = useState('');
  const targetPreview = Math.max(
    0,
    Math.round(Number(target.replace(',', '.')) * 100) || 0,
  );
  async function load() {
    const r = await fetch(`${api}/dashboard/campaigns`, {
      credentials: 'include',
    });
    if (r.ok) setItems((await r.json()) as Campaign[]);
    else setStatus('Entre na sua conta para gerenciar vaquinhas.');
  }
  useEffect(() => {
    void load();
  }, []);
  async function create() {
    const targetInCents = Math.round(Number(target.replace(',', '.')) * 100);
    const r = await fetch(`${api}/dashboard/campaigns`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        slug: title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
        description,
        imageUrl: imageUrl || undefined,
        endsAt: endsAt || null,
        targetInCents,
      }),
    });
    setStatus(
      r.ok
        ? 'Vaquinha criada como rascunho.'
        : (((await r.json()) as { message?: string }).message ??
            'Erro ao criar.'),
    );
    if (r.ok) {
      setTitle('');
      setDescription('');
      setImageUrl('');
      setEndsAt('');
      await load();
    }
  }
  async function changeStatus(id: string, value: string) {
    await fetch(`${api}/dashboard/campaigns/${id}/status`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: value }),
    });
    await load();
  }
  async function reward(id: string) {
    if (!rewardName || !rewardMinimum) return;
    await fetch(`${api}/dashboard/campaigns/${id}/rewards`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: rewardName,
        minimumInCents: Math.round(
          Number(rewardMinimum.replace(',', '.')) * 100,
        ),
        description: rewardDescription,
        quantity: rewardQuantity ? Number(rewardQuantity) : null,
      }),
    });
    setRewardCampaign('');
    setRewardName('');
    setRewardDescription('');
    setRewardQuantity('');
    await load();
  }
  async function deliver(claimId: string) {
    const response = await fetch(
      `${api}/dashboard/reward-claims/${claimId}/deliver`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: 'Entrega confirmada pelo criador' }),
      },
    );
    setStatus(
      response.ok
        ? 'Recompensa marcada como entregue.'
        : 'Não foi possível registrar a entrega.',
    );
    if (response.ok) await load();
  }
  return (
    <PanelShell>
      <main className="feature-page campaign-editor-page">
        <header className="feature-header">
          <div>
            <span className="section-kicker">Incentivos</span>
            <h1>Vaquinhas e recompensas</h1>
            <p>
              Crie objetivos para a comunidade sem separar o saldo das
              contribuições.
            </p>
          </div>
        </header>
        <section
          className="campaign-customization"
          aria-labelledby="campaign-editor-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">Personalização</span>
              <h2 id="campaign-editor-title">Configure sua vaquinha</h2>
              <p>Preencha as informações e acompanhe a página na prévia.</p>
            </div>
          </div>

          <div className="campaign-editor-layout">
            <div className="campaign-editor-form">
              <section className="livepix-setting-card campaign-info-card">
                <div className="livepix-card-heading">
                  <h2>Informações</h2>
                  <p>Explique com clareza o objetivo da arrecadação.</p>
                </div>
                <label>
                  <strong>Título</strong>
                  <small>Use um título curto e fácil de reconhecer.</small>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Novo computador para as lives"
                  />
                </label>
                <label>
                  <strong>Descrição</strong>
                  <small>{description.length} de 2.000 caracteres</small>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                    placeholder="Conte à comunidade como o valor será usado."
                  />
                </label>
              </section>

              <section className="livepix-setting-card campaign-goal-card">
                <div className="livepix-card-heading">
                  <h2>Meta e período</h2>
                  <p>Defina o valor desejado e, se quiser, uma data final.</p>
                </div>
                <div className="campaign-field-grid">
                  <label>
                    <strong>Meta em reais</strong>
                    <input
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                  <label>
                    <strong>Prazo</strong>
                    <input
                      type="date"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="livepix-setting-card campaign-image-card">
                <div className="livepix-card-heading">
                  <h2>Imagem de capa</h2>
                  <p>Adicione uma imagem que represente sua campanha.</p>
                </div>
                <label>
                  <strong>Endereço da imagem</strong>
                  <small>Use uma URL pública em HTTPS.</small>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </section>

              <div className="campaign-editor-actions">
                <button disabled={!title} onClick={() => void create()}>
                  Criar rascunho
                </button>
              </div>
            </div>

            <aside
              className="campaign-live-preview"
              aria-label="Prévia da vaquinha"
            >
              <div className="campaign-preview-heading">
                <div>
                  <span className="section-kicker">Prévia pública</span>
                  <strong>Como sua vaquinha será exibida</strong>
                </div>
                <span>Rascunho</span>
              </div>
              <div
                className={`campaign-preview-media${imageUrl ? ' has-image' : ''}`}
                style={
                  imageUrl
                    ? { backgroundImage: `url("${imageUrl}")` }
                    : undefined
                }
                role="img"
                aria-label={
                  imageUrl
                    ? 'Imagem de capa informada'
                    : 'Prévia sem imagem de capa'
                }
              >
                {!imageUrl ? <span aria-hidden="true">◎</span> : null}
              </div>
              <div className="campaign-preview-body">
                <span className="section-kicker">Vaquinha</span>
                <h3>{title || 'Título da sua vaquinha'}</h3>
                <p>
                  {description ||
                    'Sua descrição aparecerá aqui para explicar o objetivo à comunidade.'}
                </p>
                <div
                  className="campaign-preview-progress"
                  aria-label="Progresso inicial em zero por cento"
                >
                  <i />
                </div>
                <div className="campaign-preview-values">
                  <span>
                    Arrecadado <strong>{money(0)}</strong>
                  </span>
                  <span>
                    Meta <strong>{money(targetPreview)}</strong>
                  </span>
                </div>
                <small>
                  {endsAt
                    ? `Recebimentos até ${new Date(`${endsAt}T12:00:00`).toLocaleDateString('pt-BR')}`
                    : 'Sem prazo definido'}
                </small>
              </div>
            </aside>
          </div>
        </section>

        <div className="campaign-list-heading" id="recompensas">
          <div>
            <span className="section-kicker">Gerenciamento</span>
            <h2>Suas vaquinhas</h2>
          </div>
          <span>
            {items.length} {items.length === 1 ? 'campanha' : 'campanhas'}
          </span>
        </div>
        <section className="data-list polished-list campaign-list">
          {items.map((item) => (
            <article className="feature-card" key={item.id}>
              <div className="campaign-summary">
                <div className="campaign-card-heading">
                  <div>
                    <h3>{item.title}</h3>
                    {item.description ? <p>{item.description}</p> : null}
                  </div>
                </div>
                <div className="campaign-card-values">
                  <span>
                    Arrecadado <strong>{money(item.currentInCents)}</strong>
                  </span>
                  <span>
                    Meta <strong>{money(item.targetInCents)}</strong>
                  </span>
                  <strong>
                    {campaignProgress(
                      item.currentInCents,
                      item.targetInCents,
                    ).toFixed(0)}
                    %
                  </strong>
                </div>
                <div
                  className="progress"
                  aria-label={`${campaignProgress(item.currentInCents, item.targetInCents).toFixed(0)}% da meta`}
                >
                  <i
                    style={{
                      width: `${campaignProgress(item.currentInCents, item.targetInCents)}%`,
                    }}
                  />
                </div>
                <div className="campaign-card-meta">
                  <span>
                    {item.contributions.length}{' '}
                    {item.contributions.length === 1
                      ? 'contribuição'
                      : 'contribuições'}
                  </span>
                  <span>
                    {item.endsAt
                      ? `Até ${new Date(item.endsAt).toLocaleDateString('pt-BR')}`
                      : 'Sem prazo definido'}
                  </span>
                </div>
                {item.rewards.map((r) => (
                  <div key={r.id} className="campaign-reward-row">
                    <small>
                      {r.title} · mínimo {money(r.minimumInCents)} ·{' '}
                      {r.availableQuantity ?? 'ilimitada'} disponíveis
                    </small>
                    {r.claims
                      ?.filter((claim) => claim.status !== 'EXPIRED')
                      .map((claim) => (
                        <div className="reward-claim-row" key={claim.id}>
                          <span>
                            {claim.supporterName ?? 'Apoiador'} ·{' '}
                            {claim.amountInCents != null
                              ? money(claim.amountInCents)
                              : ''}{' '}
                            ·{' '}
                            {claim.status === 'DELIVERED'
                              ? 'Entregue'
                              : 'Aguardando entrega'}
                          </span>
                          {claim.status === 'CLAIMED' ? (
                            <button onClick={() => void deliver(claim.id)}>
                              Marcar como entregue
                            </button>
                          ) : null}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
              <div className="campaign-actions">
                <span
                  className={`campaign-status status-${item.status.toLowerCase()}`}
                >
                  {campaignStatusLabels[item.status] ?? item.status}
                </span>
                <div className="campaign-action-buttons">
                  <button
                    onClick={() =>
                      void changeStatus(
                        item.id,
                        item.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED',
                      )
                    }
                  >
                    {item.status === 'PUBLISHED' ? 'Encerrar' : 'Publicar'}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setRewardCampaign(
                        rewardCampaign === item.id ? '' : item.id,
                      )
                    }
                  >
                    Nova recompensa
                  </button>
                </div>
              </div>
              {rewardCampaign === item.id && (
                <div className="inline-reward-form">
                  <input
                    aria-label="Nome da recompensa"
                    placeholder="Nome da recompensa"
                    value={rewardName}
                    onChange={(e) => setRewardName(e.target.value)}
                  />
                  <input
                    aria-label="Descrição da recompensa"
                    placeholder="Descrição e instruções de entrega"
                    value={rewardDescription}
                    onChange={(e) => setRewardDescription(e.target.value)}
                  />
                  <input
                    aria-label="Quantidade da recompensa"
                    type="number"
                    min="1"
                    placeholder="Quantidade (vazio = ilimitada)"
                    value={rewardQuantity}
                    onChange={(e) => setRewardQuantity(e.target.value)}
                  />
                  <input
                    aria-label="Valor mínimo"
                    placeholder="Valor mínimo"
                    value={rewardMinimum}
                    onChange={(e) => setRewardMinimum(e.target.value)}
                  />
                  <button
                    disabled={!rewardName}
                    onClick={() => void reward(item.id)}
                  >
                    Adicionar
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
        {!items.length && !status && (
          <section className="feature-empty">
            <div className="empty-art">◎</div>
            <div>
              <h2>Crie sua primeira vaquinha</h2>
              <p>
                Defina uma meta, publique e acompanhe o progresso em tempo real.
              </p>
            </div>
          </section>
        )}
        {status && (
          <p className="account-status" role="status">
            {status}
          </p>
        )}
      </main>
    </PanelShell>
  );
}
