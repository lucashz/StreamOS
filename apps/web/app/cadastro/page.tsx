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
          <span className="section-kicker">Crie sua conta sem custo</span>
          <h2>Receba contribuições e organize sua live.</h2>
          <p>
            Crie sua página, conecte o OBS e faça um teste antes de transmitir.
          </p>
          <ul>
            <li>Conta e página do criador</li>
            <li>Alertas e widgets personalizáveis</li>
            <li>Vaquinhas, recompensas e assinaturas</li>
          </ul>
        </div>
        <small>
          2FA ainda não disponível · pagamentos em ambiente de teste
        </small>
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
