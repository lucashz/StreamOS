import { permanentRedirect } from 'next/navigation';

export default async function LegacyCreatorRedirect({
  params,
}: Readonly<{
  params: Promise<{ slug: string; path?: string[] }>;
}>) {
  const { slug, path = [] } = await params;
  const suffix = path.length
    ? `/${path.map((segment) => encodeURIComponent(segment)).join('/')}`
    : '';
  permanentRedirect(`/${encodeURIComponent(slug)}${suffix}`);
}
