import Link from 'next/link';
import { PanelShell } from '../panel-shell';
import { PageHeader } from '../ui';
import { AppearanceEditor } from './appearance-editor';

export default function AppearancePage() {
  return (
    <PanelShell>
      <main className="feature-page appearance-page">
        <PageHeader
          eyebrow="Transmissão"
          title="Tema global"
          description="Defina o visual base dos alertas. Novas variações herdam estas escolhas automaticamente."
          actions={
            <Link className="secondary-button button-link" href="/alertas">
              Alertas e variações
            </Link>
          }
        />
        <AppearanceEditor />
      </main>
    </PanelShell>
  );
}
