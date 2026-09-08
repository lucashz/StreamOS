'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  useEffect(
    () =>
      setToken(new URLSearchParams(window.location.search).get('token') ?? ''),
    [],
  );
  async function submit() {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/reset-password`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      },
    );
    const body = (await response.json()) as { message?: string };
    if (response.ok) {
      setDone(true);
      setStatus(
        'Senha redefinida. Todas as sessões anteriores foram encerradas.',
      );
    } else setStatus(body.message ?? 'Link inválido ou expirado.');
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">
          <span>◇</span> StreamOS
        </Link>
        <div>
          <span className="section-kicker">Nova senha</span>
          <h1>Redefina sua senha</h1>
        </div>
        {done ? (
          <Link className="primary-button" href="/entrar">
            Entrar com a nova senha
          </Link>
        ) : (
          <>
            <label>
              Nova senha
              <input
                type="password"
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button
              disabled={!token || password.length < 10}
              onClick={() => void submit()}
            >
              Salvar nova senha
            </button>
          </>
        )}
        {status ? <p role="status">{status}</p> : null}
      </section>
    </main>
  );
}
