'use client';
import { useState } from 'react';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export function SubscribeButton({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  async function subscribe() {
    const r = await fetch(`${api}/public/plans/${planId}/subscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ supporterName: name, supporterEmail: email }),
    });
    setMsg(r.ok ? 'Assinatura mock ativada!' : 'Não foi possível assinar.');
  }
  return open ? (
    <div className="settings-form">
      <input
        placeholder="Seu nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="Seu e-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={() => void subscribe()}>
        Confirmar assinatura mock
      </button>
      {msg && <small>{msg}</small>}
    </div>
  ) : (
    <button onClick={() => setOpen(true)}>Assinar</button>
  );
}
