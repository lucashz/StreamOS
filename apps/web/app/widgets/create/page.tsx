import Link from 'next/link';
import { PanelShell } from '../../panel-shell';
import { PageHeader } from '../../ui';
import { CreateWidgetForm } from './create-widget-form';
import { WidgetCatalog } from './widget-catalog';

const types = [
  [
    'GOAL',
    'Meta',
    'Progresso de uma meta da comunidade.',
    'Persistente ou temporário',
    'Arrecadação',
    'Fonte própria',
  ],
  [
    'CAMPAIGN',
    'Vaquinha',
    'Progresso da vaquinha publicada.',
    'Persistente ou temporário',
    'Arrecadação',
    'Fonte própria',
  ],
  [
    'QR_CODE',
    'QR Code',
    'Atalho visual para sua página pública.',
    'Permanece visível',
    'Informação',
    'Fonte própria',
    true,
  ],
  [
    'RANKING',
    'Ranking',
    'Maiores apoiadores do período.',
    'Permanece visível',
    'Comunidade',
    'Fonte própria',
  ],
  [
    'SUPPORTERS_PANEL',
    'Painel de apoiadores',
    'Maiores e mais recentes apoiadores da live.',
    'Permanece visível',
    'Comunidade',
    'Fonte própria',
  ],
  [
    'RECENT_CONTRIBUTIONS',
    'Últimos apoios',
    'Lista das contribuições recentes.',
    'Permanece visível',
    'Comunidade',
    'Fonte própria',
  ],
  [
    'POLL',
    'Enquete',
    'Votação atualizada em tempo real.',
    'Permanece visível',
    'Interação',
    'Fonte própria',
  ],
  [
    'MARATHON',
    'Maratona',
    'Cronômetro que cresce com contribuições.',
    'Permanece visível',
    'Interação',
    'Fonte própria',
  ],
  [
    'BANNER',
    'Banner rotativo',
    'Alterna avisos e chamadas da transmissão.',
    'Permanece visível',
    'Informação',
    'Fonte própria',
  ],
  [
    'CUSTOM_TEXT',
    'Texto personalizado',
    'Exibe uma mensagem fixa com o visual do canal.',
    'Permanece visível',
    'Informação',
    'Fonte própria',
  ],
] as const;

export default async function CreateWidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const requested = (await searchParams).type?.toUpperCase();
  const selected = types.find(([type]) => type === requested);
  return (
    <PanelShell>
      <main className="feature-page widget-create-page">
        <PageHeader
          eyebrow="Widgets"
          title={selected ? `Criar ${selected[1]}` : 'Novo widget'}
          description={
            selected
              ? 'Escolha o visual, personalize, teste e conecte ao OBS.'
              : 'Escolha o que você deseja mostrar durante a transmissão.'
          }
          actions={
            <Link className="secondary-button button-link" href="/widgets">
              Meus widgets
            </Link>
          }
        />
        {selected ? (
          <>
            <div className="creation-breadcrumb">
              <Link href="/widgets/create">Tipos</Link>
              <span>›</span>
              <strong>{selected[1]}</strong>
            </div>
            <CreateWidgetForm type={selected[0]} />
          </>
        ) : (
          <WidgetCatalog items={types} />
        )}
      </main>
    </PanelShell>
  );
}
