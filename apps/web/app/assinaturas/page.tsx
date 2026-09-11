'use client';
import { useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
import { PageHeader } from '../ui';
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
  const [status, setStatus] = useState('Carregando planos…');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const priceInCents = Math.round(Number(price.replace(',', '.')) * 100);
  const activeSubscriptions = plans.flatMap((plan) =>
    plan.subscriptions.filter(
      (subscription) => subscription.status === 'ACTIVE',
    ),
  );
  const monthlyRevenue = plans.reduce(
    (total, plan) =>
      total +
      plan.priceInCents *
        plan.subscriptions.filter(
          (subscription) => subscription.status === 'ACTIVE',
        ).length,
    0,
  );
  const load = async () => {
    try {
      const r = await fetch(`${api}/dashboard/subscription-plans`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const body = (await r.json().catch(() => [])) as Plan[] & {
        message?: string;
      };
      if (!r.ok) throw new Error(body.message ?? 'Não foi possível carregar.');
      setPlans(body);
      setStatus('Planos sincronizados.');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os planos.',
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  async function create() {
    if (
      busy ||
      !name.trim() ||
      !Number.isFinite(priceInCents) ||
      priceInCents <= 0
    )
      return;
    setBusy('create');
    setStatus('Criando plano…');
    try {
      const response = await fetch(`${api}/dashboard/subscription-plans`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          priceInCents,
          benefits: benefits
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok)
        throw new Error(body.message ?? 'Não foi possível criar o plano.');
      setName('');
      setDescription('');
      await load();
      setStatus('Plano criado como rascunho.');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o plano.',
      );
    } finally {
      setBusy('');
    }
  }
  async function cancel(id: string) {
    if (busy) return;
    setBusy(id);
    setStatus('Agendando cancelamento…');
    const response = await fetch(
      `${api}/dashboard/subscriptions/${id}/cancel`,
      { method: 'POST', credentials: 'include' },
    ).catch(() => null);
    if (response?.ok) {
      await load();
      setStatus('Cancelamento agendado para o fim do período.');
    } else {
      const body = (await response?.json().catch(() => ({}))) as {
        message?: string;
      };
      setStatus(body.message ?? 'Não foi possível agendar o cancelamento.');
    }
    setBusy('');
  }
  async function publish(id: string, value: boolean) {
    if (busy) return;
    setBusy(id);
    setStatus(value ? 'Publicando plano…' : 'Retirando plano do ar…');
    const response = await fetch(
      `${api}/dashboard/subscription-plans/${id}/publish`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ published: value }),
      },
    ).catch(() => null);
    if (response?.ok) {
      await load();
      setStatus(value ? 'Plano publicado.' : 'Plano retirado do ar.');
    } else {
      const body = (await response?.json().catch(() => ({}))) as {
        message?: string;
      };
      setStatus(body.message ?? 'Não foi possível alterar a publicação.');
    }
    setBusy('');
  }
  return (
    <PanelShell>
      <main className="feature-page">
        <PageHeader
          eyebrow="Comunidade"
          title="Planos de assinatura"
          description="Crie benefícios recorrentes e acompanhe seus membros ativos."
        />
        <section className="metric-grid" aria-label="Resumo das assinaturas">
          <article className="metric-card">
            <small>Planos publicados</small>
            <strong>{plans.filter((plan) => plan.published).length}</strong>
          </article>
          <article className="metric-card">
            <small>Membros ativos</small>
            <strong>{activeSubscriptions.length}</strong>
          </article>
          <article className="metric-card">
            <small>Receita mensal estimada</small>
            <strong>
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(monthlyRevenue / 100)}
            </strong>
          </article>
        </section>
        <section className="feature-card settings-form compact-create-card">
          <h2>Novo plano</h2>
          <label>
            Nome
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Preço mensal
            <input value={price} onChange={(e) => setPrice(e.target.value)} />
            <small>Valor mensal cobrado de cada membro.</small>
          </label>
          <label>
            Descrição
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </label>
          <label>
            Benefícios, separados por vírgula
            <input
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
            />
          </label>
          <button
            disabled={
              Boolean(busy) ||
              !name.trim() ||
              !Number.isFinite(priceInCents) ||
              priceInCents <= 0
            }
            onClick={() => void create()}
          >
            {busy === 'create' ? 'Criando…' : 'Criar plano'}
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
                        · {subscription.renewals.length} cobrança(s) · início{' '}
                        {new Date(subscription.createdAt).toLocaleDateString(
                          'pt-BR',
                        )}{' '}
                        · próxima renovação{' '}
                        {new Date(
                          subscription.currentPeriodEnd,
                        ).toLocaleDateString('pt-BR')}
                        {subscription.cancelAtPeriodEnd
                          ? ' · encerra no fim do período'
                          : ''}
                      </small>
                    </div>
                    {subscription.status === 'ACTIVE' &&
                    !subscription.cancelAtPeriodEnd ? (
                      <button
                        className="secondary-button"
                        disabled={Boolean(busy)}
                        onClick={() => void cancel(subscription.id)}
                      >
                        Cancelar no fim do período
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button
                disabled={Boolean(busy)}
                onClick={() => void publish(p.id, !p.published)}
              >
                {busy === p.id
                  ? 'Processando…'
                  : p.published
                    ? 'Despublicar'
                    : 'Publicar'}
              </button>
            </article>
          ))}
        </section>
        {!loading && !plans.length && (
          <section className="feature-empty">
            <div className="empty-art">◇</div>
            <div>
              <h2>Crie seu primeiro plano</h2>
              <p>Defina o preço e informe o que cada membro recebe.</p>
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
