'use client';
import Link from 'next/link';
import { useState } from 'react';
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/forgot-password`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      },
    );
    setSent(true);
    setLoading(false);
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/">
          <span>◇</span> StreamOS
        </Link>
        <div>
          <span className="section-kicker">Recuperação</span>
          <h1>Esqueceu sua senha?</h1>
          <p>Enviaremos um link de uso único se o e-mail estiver cadastrado.</p>
        </div>
        {sent ? (
          <div className="auth-success">
            <strong>Confira seu e-mail</strong>
            <p>
              No ambiente local, abra o Mailpit em{' '}
              <a href="http://localhost:8025">localhost:8025</a>.
            </p>
          </div>
        ) : (
          <>
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <button disabled={loading || !email} onClick={() => void submit()}>
              {loading ? 'Enviando…' : 'Enviar link'}
            </button>
          </>
        )}
        <p className="auth-switch">
          <Link href="/entrar">Voltar para entrar</Link>
        </p>
      </section>
    </main>
  );
}
