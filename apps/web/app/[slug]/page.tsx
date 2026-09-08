import { ContributionHub } from './contribution-hub';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Creator = {
  displayName: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  minimumContributionInCents: number | string;
};

export default async function CreatorPage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const response = await fetch(
    `${process.env.API_URL ?? 'http://localhost:3001'}/public/creators/${slug}`,
    { cache: 'no-store' },
  );
  if (!response.ok) notFound();
  const creator = (await response.json()) as Creator & { error?: string };
  if (creator.error) notFound();

  return (
    <main className="public-page">
      <Link className="back-link" href="/">
        ← Voltar ao painel
      </Link>
      <section className="creator-card" style={creator.coverUrl ? { backgroundImage: `linear-gradient(#11131acc, #11131a), url(${creator.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <span className="creator-menu" aria-hidden="true">
          ⋮
        </span>
        <div className="creator-avatar" style={creator.avatarUrl ? { backgroundImage: `url(${creator.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: 0 } : undefined}>
          {creator.avatarUrl ? '' : creator.displayName.slice(0, 2).toUpperCase()}
        </div>
        <span className="section-kicker creator-address">
          streamos.com/{slug}
        </span>
        <h1>{creator.displayName}</h1>
        <p>{creator.bio ?? 'Envie uma contribuição para aparecer na live.'}</p>
        <ContributionHub
          slug={slug}
          minimumInCents={Number(creator.minimumContributionInCents)}
        />
        <small>Ambiente demonstrativo · nenhum pagamento será realizado</small>
      </section>
    </main>
  );
}
