'use client';
import { useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Plan = {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  published: boolean;
  benefits: string[];
  subscriptions: Array<{
    id: string;
    supporterName: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
    currentPeriodEnd: string;
    renewals: Array<{
      id: string;
      status: string;
      amountInCents: number;
      createdAt: string;
    }>;
  }>;
};
export default function Page() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('14,90');
  const [description, setDescription] = useState('');
  const [benefits, setBenefits] = useState(
    'Badge exclusivo, Grupo da comunidade',
  );
  const [status, setStatus] = useState('');
  const load = async () => {
    const r = await fetch(`${api}/dashboard/subscription-plans`, {
      credentials: 'include',
    });
    if (r.ok) setPlans((await r.json()) as Plan[]);
  };
  useEffect(() => {
    void load();
  }, []);
  async function create() {
    await fetch(`${api}/dashboard/subscription-plans`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        priceInCents: Math.round(Number(price.replace(',', '.')) * 100),
        benefits: benefits
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setName('');
    setDescription('');
    await load();
  }
  async function cancel(id: string) {
    const response = await fetch(
      `${api}/dashboard/subscriptions/${id}/cancel`,
      {
        method: 'POST',
        credentials: 'include',
      },
    );
    setStatus(
      response.ok
        ? 'Cancelamento agendado para o fim do período.'
        : 'Não foi possível cancelar.',
    );
    if (response.ok) await load();
  }
  async function publish(id: string, value: boolean) {
    await fetch(`${api}/dashboard/subscription-plans/${id}/publish`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ published: value }),
    });
    await load();
  }
  return (
    <PanelShell>
      <main className="feature-page">
        <header>
          <span className="section-kicker">Comunidade</span>
          <h1>Planos de assinatura</h1>
          <p>
            Crie benefícios recorrentes. As cobranças ainda são simuladas
            localmente.
          </p>
        </header>
        <section className="feature-card settings-form compact-create-card">
          <h2>Novo plano</h2>
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Preço mensal
            <input value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label>Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></label>
          <label>
            Benefícios, separados por vírgula
            <input
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
            />
          </label>
          <button disabled={!name} onClick={() => void create()}>
            Criar plano
          </button>
        </section>
        <section className="data-list polished-list">
          {plans.map((p) => (
            <article className="feature-card" key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <small>
                  R$ {(p.priceInCents / 100).toFixed(2)} ·{' '}
                  {p.published ? 'Publicado' : 'Rascunho'} ·{' '}
                  {p.subscriptions.length} assinaturas
                </small>
                {p.benefits.length ? (
                  <small>{p.benefits.join(' · ')}</small>
                ) : null}
                {p.subscriptions.map((subscription) => (
                  <div
                    className="subscription-member-row"
                    key={subscription.id}
                  >
                    <div>
                      <strong>{subscription.supporterName}</strong>
                      <small>
                        {subscription.status === 'ACTIVE'
                          ? 'Ativa'
                          : 'Cancelada'}{' '}
                        · {subscription.renewals.length} cobrança(s)
                        {' '}· início {new Date(subscription.createdAt).toLocaleDateString('pt-BR')} · próxima renovação {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                        {subscription.cancelAtPeriodEnd
                          ? ' · encerra no fim do período'
                          : ''}
                      </small>
                    </div>
                    {subscription.status === 'ACTIVE' &&
                    !subscription.cancelAtPeriodEnd ? (
                      <button
                        className="secondary-button"
                        onClick={() => void cancel(subscription.id)}
                      >
                        Cancelar no fim do período
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button onClick={() => void publish(p.id, !p.published)}>
                {p.published ? 'Despublicar' : 'Publicar'}
              </button>
            </article>
          ))}
        </section>
        {!plans.length && (
          <section className="feature-empty">
            <div className="empty-art">◇</div>
            <div>
              <h2>Transforme apoiadores em membros</h2>
              <p>Crie seu primeiro plano com preço e benefícios exclusivos.</p>
            </div>
          </section>
        )}
        {status ? (
          <p className="account-status" role="status">
            {status}
          </p>
        ) : null}
      </main>
    </PanelShell>
  );
}
