import { CampaignDonationForm } from './campaign-donation-form';
const api = process.env.API_URL ?? 'http://localhost:3001';
export default async function PublicCampaignPage({
  params,
}: {
  params: Promise<{ slug: string; campaign: string }>;
}) {
  const { slug, campaign } = await params;
  const response = await fetch(
    `${api}/public/creators/${slug}/campaigns/${campaign}`,
    { cache: 'no-store' },
  );
  if (!response.ok)
    return (
      <main className="public-page">
        <h1>Vaquinha indisponível</h1>
      </main>
    );
  const value = (await response.json()) as {
    id: string;
    title: string;
    description: string;
    targetInCents: number;
    currentInCents: number;
    rewards: Array<{
      id: string;
      title: string;
      description: string;
      minimumInCents: number;
      availableQuantity: number | null;
    }>;
  };
  return (
    <main className="public-page">
      <section className="creator-hero">
        <span className="section-kicker">Vaquinha</span>
        <h1>{value.title}</h1>
        <p>{value.description}</p>
        <strong>
          {new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(value.currentInCents / 100)}{' '}
          de{' '}
          {new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(value.targetInCents / 100)}
        </strong>
        <div className="progress">
          <i
            style={{
              width: `${Math.min(100, (value.currentInCents / value.targetInCents) * 100)}%`,
            }}
          />
        </div>
      </section>
      <CampaignDonationForm campaign={value} />
    </main>
  );
}
