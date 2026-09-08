import { LiveControlClient } from '../live-control-client';

export default function LiveControlDockPage() {
  return (
    <main className="obs-dock">
      <header>
        <strong>StreamOS</strong>
        <span>Central da Live · Dock seguro</span>
      </header>
      <LiveControlClient compact />
    </main>
  );
}
