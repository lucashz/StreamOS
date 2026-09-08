'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';

export function AuthForm({ mode }: Readonly<{ mode: 'login' | 'register' }>) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setLoading(true);
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(data.entries());
    if (mode === 'register' && values.password !== values.confirmPassword) {
      setError('As senhas não coincidem');
      formRef.current?.querySelector<HTMLInputElement>('[name="confirmPassword"]')?.focus();
      setLoading(false);
      return;
    }
    delete values.confirmPassword;
    const payload = {
      ...values,
      ...(mode === 'register' ? { acceptTerms: data.has('acceptTerms') } : {}),
    };
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/${mode === 'login' ? 'login' : 'register'}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? 'Não foi possível continuar');
      }
      router.push(mode === 'register' ? '/onboarding' : '/');
      router.refresh();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Erro inesperado');
      formRef.current?.querySelector<HTMLInputElement>(':invalid, [name="email"]')?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="auth-form"
      ref={formRef}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      {mode === 'register' && (
        <label>
          Nome do canal
          <input
            name="displayName"
            placeholder="Luna Plays"
            minLength={2}
            required
            autoFocus={mode === 'register'}
          />
        </label>
      )}
      <label>
        E-mail
        <input
          name="email"
          type="email"
          placeholder="voce@exemplo.com"
          required
          autoFocus={mode === 'login'}
        />
      </label>
      {mode === 'login' ? (
        <Link className="forgot-link" href="/recuperar-senha">
          Esqueci minha senha
        </Link>
      ) : null}
      <label>
        Senha
        <span className="password-field">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            minLength={10}
            placeholder="Mínimo de 10 caracteres"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            required
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </span>
      </label>
      {mode === 'register' ? (
        <ul className="password-requirements" aria-label="Requisitos da senha">
          <li className={password.length >= 10 ? 'valid' : ''}>10 caracteres ou mais</li>
          <li className={/[A-Za-z]/.test(password) && /\d/.test(password) ? 'valid' : ''}>Letras e números</li>
        </ul>
      ) : null}
      {mode === 'register' ? (
        <label>
          Confirmar senha
          <input
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            minLength={10}
            placeholder="Digite novamente"
            autoComplete="new-password"
            required
          />
        </label>
      ) : null}
      {mode === 'register' ? (
        <label className="consent-field">
          <input name="acceptTerms" type="checkbox" value="true" required />
          Li e aceito os Termos de Uso e a Política de Privacidade.
        </label>
      ) : null}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button disabled={loading} type="submit">
        {loading
          ? 'Aguarde…'
          : mode === 'login'
            ? 'Entrar'
            : 'Criar conta'}
      </button>
    </form>
  );
}
