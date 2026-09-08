import { PanelShell } from '../panel-shell';
import { PageHeader } from '../ui';
import { AppearanceEditor } from './appearance-editor';

export default function AppearancePage() {
  return (
    <PanelShell>
      <main className="feature-page appearance-page">
        <PageHeader
          eyebrow="Transmissão"
          title="Aparência"
          description="Defina o visual padrão da sua transmissão. Novos alertas herdam estas escolhas automaticamente."
        />
        <AppearanceEditor />
      </main>
    </PanelShell>
  );
}
