'use client';

import { useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    v / 100,
  );
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
      setDescription(''); setImageUrl(''); setEndsAt('');
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
    setRewardDescription(''); setRewardQuantity('');
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
      <main className="feature-page">
        <header>
          <span className="section-kicker">Incentivos</span>
          <h1>Vaquinhas e recompensas</h1>
          <p>
            Crie objetivos para a comunidade sem separar o saldo das
            contribuições.
          </p>
        </header>
        <section className="feature-card settings-form compact-create-card">
          <h2>Nova vaquinha</h2>
          <label>
            Título
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Meta em reais
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label>Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></label>
          <div className="form-grid two-columns"><label>Imagem<input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></label><label>Prazo<input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label></div>
          <button disabled={!title} onClick={() => void create()}>
            Criar rascunho
          </button>
        </section>
        <section className="data-list polished-list">
          {items.map((item) => (
            <article className="feature-card" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.status} · {money(item.currentInCents)} de{' '}
                  {money(item.targetInCents)} · {item.contributions.length} contribuições {item.endsAt ? `· até ${new Date(item.endsAt).toLocaleDateString('pt-BR')}` : ''}
                </small>
                <div className="progress">
                  <i
                    style={{
                      width: `${Math.min(100, (item.currentInCents / item.targetInCents) * 100)}%`,
                    }}
                  />
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
              <div>
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
                    setRewardCampaign(rewardCampaign === item.id ? '' : item.id)
                  }
                >
                  Nova recompensa
                </button>
              </div>
              {rewardCampaign === item.id && (
                <div className="inline-reward-form">
                  <input
                    aria-label="Nome da recompensa"
                    placeholder="Nome da recompensa"
                    value={rewardName}
                    onChange={(e) => setRewardName(e.target.value)}
                  />
                  <input aria-label="Descrição da recompensa" placeholder="Descrição e instruções de entrega" value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} />
                  <input aria-label="Quantidade da recompensa" type="number" min="1" placeholder="Quantidade (vazio = ilimitada)" value={rewardQuantity} onChange={(e) => setRewardQuantity(e.target.value)} />
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
