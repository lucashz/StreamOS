import { AuthForm } from '../auth-form';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <aside className="auth-showcase">
        <Link className="auth-showcase-brand" href="/">
          <span>◇</span> StreamOS
        </Link>
        <div>
          <span className="section-kicker">Comece gratuitamente</span>
          <h2>Transforme sua comunidade em experiências ao vivo.</h2>
          <p>
            Configure sua página, conecte o OBS e teste toda a jornada
            localmente.
          </p>
          <ul>
            <li>Conta e página do criador</li>
            <li>Alertas e widgets personalizáveis</li>
            <li>Vaquinhas, recompensas e assinaturas</li>
          </ul>
        </div>
        <small>Sem 2FA nesta fase · pagamentos em modo sandbox</small>
      </aside>
      <section className="auth-card">
        <Link className="auth-brand" href="/">
          <span>◇</span> StreamOS
        </Link>
        <div>
          <span className="section-kicker">Comece agora</span>
          <h1>Crie sua conta</h1>
          <p>Configure sua página e receba contribuições na sua live.</p>
        </div>
        <AuthForm mode="register" />
        <p className="auth-switch">
          Já tenho uma conta. <Link href="/entrar">Entrar</Link>
        </p>
      </section>
    </main>
  );
}
