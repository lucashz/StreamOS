import { AuthForm } from '../auth-form';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="auth-page">
      <aside className="auth-showcase">
        <Link className="auth-showcase-brand" href="/">
          <span>◇</span> StreamOS
        </Link>
        <div>
          <span className="section-kicker">Painel do criador</span>
          <h2>Contribuições, alertas e transmissão no mesmo painel.</h2>
          <p>
            Acompanhe pagamentos, organize as filas e controle o que aparece no
            OBS.
          </p>
          <ul>
            <li>Pix, carteira e recebíveis</li>
            <li>SongPix, VideoPix e widgets</li>
            <li>Moderação e controle para OBS</li>
          </ul>
        </div>
        <small>Ambiente local · StreamOS Beta</small>
      </aside>
      <section className="auth-card">
        <Link className="auth-brand" href="/">
          <span>◇</span> StreamOS
        </Link>
        <div>
          <span className="section-kicker">Bem-vindo de volta</span>
          <h1>Entre no StreamOS</h1>
          <p>Acesse seu painel e controle sua transmissão.</p>
        </div>
        <AuthForm mode="login" />
        <p className="auth-switch">
          Ainda não tem conta? <Link href="/cadastro">Criar uma conta</Link>
        </p>
      </section>
    </main>
  );
}
