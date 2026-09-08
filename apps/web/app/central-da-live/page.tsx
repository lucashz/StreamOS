import { PanelShell } from '../panel-shell';
import { LiveControlClient } from './live-control-client';

export default function LiveControlPage() {
  return (
    <PanelShell>
      <main className="feature-page live-control-page">
        <header className="feature-header">
          <div>
            <span className="section-kicker">Operação em tempo real</span>
            <h1>Central da Live</h1>
            <p>
              Controle e reproduza todas as contribuições em uma única fila. Ações
              operacionais nunca alteram o histórico financeiro.
            </p>
          </div>
          <a
            className="secondary-button"
            href="/central-da-live/dock"
            target="_blank"
            rel="noreferrer"
          >
            Abrir dock para OBS
          </a>
        </header>
        <LiveControlClient />
      </main>
    </PanelShell>
  );
}
