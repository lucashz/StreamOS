import { SubscribeButton } from './subscribe-button';
const api = process.env.API_URL ?? 'http://localhost:3001';
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await fetch(`${api}/public/creators/${slug}/plans`, {
    cache: 'no-store',
  });
  const plans = r.ok
    ? ((await r.json()) as Array<{
        id: string;
        name: string;
        description: string;
        priceInCents: number;
        benefits: string[];
      }>)
    : [];
  return (
    <main className="public-page">
      <section className="creator-hero">
        <span className="section-kicker">Comunidade</span>
        <h1>Planos de assinatura</h1>
        <p>Apoie mensalmente no ambiente local mock.</p>
      </section>
      <section className="feature-grid">
        {plans.map((p) => (
          <article className="feature-card" key={p.id}>
            <h2>{p.name}</h2>
            <strong>R$ {(p.priceInCents / 100).toFixed(2)}/mês</strong>
            <p>{p.description}</p>
            <ul>
              {p.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <SubscribeButton planId={p.id} />
          </article>
        ))}
      </section>
      {!plans.length && <p>Nenhum plano publicado.</p>}
    </main>
  );
}
