import Link from 'next/link';
import { PanelShell } from '../panel-shell';
import { WidgetOverlayCard } from '../widget-overlay-card';
import { AlertEditor } from './alert-editor';

export default function AlertsPage() {
  return (
    <PanelShell>
      <main className="feature-page alert-editor-page">
        <header className="feature-header">
          <div>
            <span className="section-kicker">Transmissão</span>
            <h1>Alertas</h1>
            <p>
              Personalize os alertas temporários exibidos pela fonte única do
              OBS.
            </p>
          </div>
          <div className="feature-header-actions">
            <Link className="secondary-button button-link" href="/widgets">
              Meus widgets
            </Link>
            <Link
              className="primary-button button-link"
              href="/central-da-live"
            >
              Central da Live
            </Link>
          </div>
        </header>
        <WidgetOverlayCard
          type="ALERT"
          title="Alertas"
          description="Fonte exclusiva para contribuições de texto, áudio gravado e voz. Música e vídeo não aparecem nesta URL."
        />
        <section
          className="alert-customization"
          id="aparencia"
          aria-label="Aparência da transmissão"
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">Personalização</span>
              <h2>Configure seus alertas</h2>
              <p>
                Crie variações, escolha um template e acompanhe o resultado na
                prévia do OBS.
              </p>
            </div>
          </div>
          <AlertEditor />
        </section>
      </main>
    </PanelShell>
  );
}
