import Link from 'next/link';

export default function CreatorNotFound() {
  return (
    <main className="public-page">
      <section className="creator-card">
        <span className="section-kicker">Página pública</span>
        <h1>Página indisponível</h1>
        <p>
          Este criador não existe, a página está privada ou o endereço foi
          alterado.
        </p>
        <Link className="primary-button button-link" href="/">
          Voltar ao StreamOS
        </Link>
      </section>
    </main>
  );
}
