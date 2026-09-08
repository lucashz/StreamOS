'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PanelShell } from '../panel-shell';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Summary = {
  goal: {
    title: string;
    targetInCents: number;
    currentInCents: number;
    deadline?: string | null;
    color?: string;
    imageUrl?: string | null;
    completionMessage?: string | null;
  } | null;
};
export default function GoalsPage() {
  const [title, setTitle] = useState('Primeira meta da live');
  const [target, setTarget] = useState('1000');
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState('#7c5cff');
  const [imageUrl, setImageUrl] = useState('');
  const [completionMessage, setCompletionMessage] = useState('Meta concluída!');
  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${api}/dashboard/summary`, {
          credentials: 'include',
        });
        const data = (await response.json()) as Summary;
        if (data.goal) {
          setTitle(data.goal.title);
          setTarget(String(data.goal.targetInCents / 100));
          setCurrent(data.goal.currentInCents);
          setDeadline(data.goal.deadline?.slice(0, 10) ?? '');
          setColor(data.goal.color ?? '#7c5cff');
          setImageUrl(data.goal.imageUrl ?? '');
          setCompletionMessage(data.goal.completionMessage ?? 'Meta concluída!');
        }
      } catch {
        setStatus('Não foi possível carregar a meta.');
      }
    }
    void load();
  }, []);
  async function save() {
    const r = await fetch(`${api}/dashboard/goal`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        targetInCents: Math.round(Number(target.replace(',', '.')) * 100),
        active: true,
        deadline: deadline || null,
        color,
        imageUrl: imageUrl || null,
        completionMessage: completionMessage || null,
      }),
    });
    setStatus(r.ok ? 'Meta atualizada.' : 'Confira o título e o valor.');
  }
  const targetCents = Math.max(
    1,
    Math.round(Number(target.replace(',', '.')) * 100),
  );
  const progress = Math.min(100, Math.round((current / targetCents) * 100));
  return (
    <PanelShell>
      <main className="feature-page">
        <Link href="/" className="back-link">
          ← Visão geral
        </Link>
        <header>
          <span className="section-kicker">Engajamento</span>
          <h1>Meta da live</h1>
          <p>
            Os pagamentos confirmados atualizam o progresso automaticamente.
          </p>
        </header>
        <section className="feature-card goal-editor">
          <div className="goal-preview">
            <strong>{progress}%</strong>
            <div className="progress">
              <i style={{ width: `${progress}%`, background: color }} />
            </div>
            <small>
              R$ {(current / 100).toFixed(2)} de R${' '}
              {(targetCents / 100).toFixed(2)}
            </small>
          </div>
          <label>
            Título
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Objetivo em R$
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <div className="form-grid two-columns">
            <label>Prazo opcional<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
            <label>Cor do progresso<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
          </div>
          <label>Imagem da meta<input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /><small>Use uma imagem hospedada em HTTPS.</small></label>
          <label>Mensagem de conclusão<input value={completionMessage} onChange={(e) => setCompletionMessage(e.target.value)} maxLength={160} /></label>
          <button className="primary-button" onClick={() => void save()}>
            Salvar meta
          </button>
          {status ? <p role="status">{status}</p> : null}
        </section>
        <section className="feature-card"><div className="panel-heading"><div><span className="section-kicker">Widget para OBS</span><h2>Progresso da meta</h2></div><Link className="secondary-button" href="/widgets/create?type=GOAL">Editar aparência e copiar URL</Link></div><p>O widget recebe atualizações automaticamente após cada contribuição confirmada.</p></section>
      </main>
    </PanelShell>
  );
}
