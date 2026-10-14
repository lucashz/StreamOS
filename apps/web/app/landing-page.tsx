import Link from 'next/link';

export function LandingPage() {
  return (
    <div className="landing-shell">
      {/* Top Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-container">
          <Link className="landing-brand" href="/">
            <div className="landing-brand-mark">
              <span>◇</span>
            </div>
            <span>StreamOS</span>
            <span className="landing-beta-tag">Beta Fechada</span>
          </Link>

          <nav
            className="landing-nav-links"
            aria-label="Navegação da landing page"
          >
            <a className="landing-nav-link" href="#recursos">
              Recursos
            </a>
            <a className="landing-nav-link" href="#como-funciona">
              Como funciona
            </a>
            <a className="landing-nav-link" href="#vantagens">
              Diferenciais
            </a>
            <Link className="landing-nav-link" href="/saude">
              Status
            </Link>
          </nav>

          <div className="landing-nav-actions">
            <Link className="landing-btn landing-btn-ghost" href="/entrar">
              Entrar
            </Link>
            <Link className="landing-btn landing-btn-primary" href="/cadastro">
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="landing-hero" aria-label="Apresentação do StreamOS">
          <div className="landing-hero-grid">
            <div className="landing-hero-content">
              <span className="landing-kicker">
                <span>✦</span> A infraestrutura da monetização ao vivo
              </span>
              <h1 className="landing-hero-title">
                Receba apoios em Pix com alertas{' '}
                <span className="landing-hero-title-accent">instantâneos</span>{' '}
                na sua live.
              </h1>
              <p className="landing-hero-description">
                Plataforma independente de pagamentos, carteira, alertas OBS,
                SongPix, VideoPix, vaquinhas e assinaturas com conciliação
                contábil e latência inferior a 1 segundo.
              </p>

              <div className="landing-hero-actions">
                <Link
                  className="landing-btn landing-btn-primary landing-btn-lg"
                  href="/cadastro"
                >
                  Começar com convite
                </Link>
                <Link
                  className="landing-btn landing-btn-secondary landing-btn-lg"
                  href="/entrar"
                >
                  Acessar painel
                </Link>
              </div>

              <div className="landing-hero-bullets">
                <div className="landing-hero-bullet-item">
                  <span aria-hidden="true">✓</span> Pix direto na tela em &lt;
                  1s
                </div>
                <div className="landing-hero-bullet-item">
                  <span aria-hidden="true">✓</span> Moderação antes do pagamento
                </div>
                <div className="landing-hero-bullet-item">
                  <span aria-hidden="true">✓</span> Ledger de dupla entrada
                </div>
                <div className="landing-hero-bullet-item">
                  <span aria-hidden="true">✓</span> Fila resiliente offline
                </div>
              </div>
            </div>

            {/* Interactive Preview Mockup */}
            <div
              className="landing-preview-card"
              aria-label="Prévia do alerta na live"
            >
              <div className="landing-preview-header">
                <div className="landing-preview-dots">
                  <span className="landing-preview-dot red" />
                  <span className="landing-preview-dot yellow" />
                  <span className="landing-preview-dot green" />
                </div>
                <span className="landing-preview-title">
                  OBS Browser Source • Ao Vivo
                </span>
              </div>
              <div className="landing-preview-body">
                <div className="landing-preview-alert">
                  <div className="landing-preview-avatar">L</div>
                  <div className="landing-preview-info">
                    <span className="landing-preview-amount">R$ 50,00</span>
                    <span className="landing-preview-name">
                      Lucas apoiou o canal
                    </span>
                    <span className="landing-preview-msg">
                      &quot;Parabéns pela live! O StreamOS tá voando! 🚀&quot;
                    </span>
                  </div>
                </div>

                <div className="landing-preview-stats">
                  <div className="landing-preview-stat-box">
                    <span className="landing-preview-stat-label">
                      Latência do alerta
                    </span>
                    <span className="landing-preview-stat-val">340 ms</span>
                  </div>
                  <div className="landing-preview-stat-box">
                    <span className="landing-preview-stat-label">
                      Entrega garantida
                    </span>
                    <span className="landing-preview-stat-val">
                      100% idempotente
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section
          className="landing-section"
          id="recursos"
          aria-label="Recursos da plataforma"
        >
          <div className="landing-section-header">
            <span className="landing-kicker">Tudo o que você precisa</span>
            <h2 className="landing-section-title">
              Construído para criadores que exigem controle total
            </h2>
            <p className="landing-section-desc">
              Do apoio individual em Pix às ferramentas multimídia e automação
              de comunidade, o StreamOS oferece uma experiência unificada e sem
              fricção.
            </p>
          </div>

          <div className="landing-grid-3">
            <article className="landing-feature-card">
              <div className="landing-feature-icon">
                <span>⚡</span>
              </div>
              <h3 className="landing-feature-title">
                Pix Instantâneo & Carteira
              </h3>
              <p className="landing-feature-body">
                Receba pagamentos com confirmação em tempo real. Cada centavo é
                registrado em um livro contábil de dupla entrada com extrato
                detalhado e conciliação transparente.
              </p>
            </article>

            <article className="landing-feature-card">
              <div className="landing-feature-icon cyan">
                <span>📺</span>
              </div>
              <h3 className="landing-feature-title">
                Alertas & Browser Source OBS
              </h3>
              <p className="landing-feature-body">
                Overlay leve para OBS Studio e Streamlabs. Conexão WebSocket
                durável com fila resiliente que não perde alertas mesmo se a sua
                internet oscilar.
              </p>
            </article>

            <article className="landing-feature-card">
              <div className="landing-feature-icon lime">
                <span>🎵</span>
              </div>
              <h3 className="landing-feature-title">SongPix & VideoPix</h3>
              <p className="landing-feature-body">
                Permita que seu público sugira músicas do seu catálogo ou envie
                vídeos do YouTube com preço por segundo e moderação automática
                pré-reprodução.
              </p>
            </article>

            <article className="landing-feature-card">
              <div className="landing-feature-icon orange">
                <span>🎯</span>
              </div>
              <h3 className="landing-feature-title">Vaquinhas & Metas</h3>
              <p className="landing-feature-body">
                Crie metas de arrecadação coletiva na tela com barras de
                progresso dinâmicas e recompensas exclusivas para incentivar seu
                chat a bater recordes.
              </p>
            </article>

            <article className="landing-feature-card">
              <div className="landing-feature-icon">
                <span>⭐</span>
              </div>
              <h3 className="landing-feature-title">Assinaturas Recorrentes</h3>
              <p className="landing-feature-body">
                Ofereça níveis de membros com vantagens especiais, distintivos
                no chat e renovações transparentes com métricas de retenção para
                o criador.
              </p>
            </article>

            <article className="landing-feature-card">
              <div className="landing-feature-icon cyan">
                <span>🛡️</span>
              </div>
              <h3 className="landing-feature-title">
                Moderação Inteligente & TTS
              </h3>
              <p className="landing-feature-body">
                Filtro automático de palavras e termos ofensivos antes mesmo da
                geração do Pix. Vozes neurais para leitura de mensagens na live
                com limites de caracteres seguros.
              </p>
            </article>
          </div>
        </section>

        {/* How It Works Steps */}
        <section
          className="landing-section"
          id="como-funciona"
          aria-label="Como funciona"
        >
          <div className="landing-section-header">
            <span className="landing-kicker">
              Simplicidade de ponta a ponta
            </span>
            <h2 className="landing-section-title">
              Configure em 3 minutos e comece a transmitir
            </h2>
            <p className="landing-section-desc">
              Sem burocracia técnica. O StreamOS guia você do cadastro à
              primeira contribuição na tela.
            </p>
          </div>

          <div className="landing-steps">
            <div className="landing-step-card">
              <span className="landing-step-num">01</span>
              <h3 className="landing-step-title">Crie sua conta com convite</h3>
              <p className="landing-step-desc">
                Defina o nome do seu canal, cadastre sua chave Pix segura e
                personalize sua página pública de apoio.
              </p>
            </div>

            <div className="landing-step-card">
              <span className="landing-step-num">02</span>
              <h3 className="landing-step-title">Conecte a Browser Source</h3>
              <p className="landing-step-desc">
                Copie a URL protegida do seu overlay em Configurações e adicione
                como fonte de navegador na sua cena do OBS.
              </p>
            </div>

            <div className="landing-step-card">
              <span className="landing-step-num">03</span>
              <h3 className="landing-step-title">Transmita e monetize</h3>
              <p className="landing-step-desc">
                Compartilhe seu link exclusivo com a sua audiência e veja os
                apoios aparecerem com som, vídeo e texto na sua transmissão.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="landing-section" id="vantagens">
          <div className="landing-cta-banner">
            <h2>Pronto para elevar o nível da sua live?</h2>
            <p>
              O StreamOS é projetado para criadores que buscam estabilidade,
              pagamento sem intermediários que atrasam repasses e ferramentas
              modernas de interação.
            </p>
            <div className="landing-hero-actions">
              <Link
                className="landing-btn landing-btn-primary landing-btn-lg"
                href="/cadastro"
              >
                Criar conta com convite
              </Link>
              <Link
                className="landing-btn landing-btn-secondary landing-btn-lg"
                href="/entrar"
              >
                Já tenho uma conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="landing-footer-top">
            <div className="landing-brand">
              <div className="landing-brand-mark">
                <span>◇</span>
              </div>
              <span>StreamOS</span>
            </div>
            <div className="landing-footer-links">
              <Link className="landing-footer-link" href="/cadastro">
                Cadastro
              </Link>
              <Link className="landing-footer-link" href="/entrar">
                Entrar
              </Link>
              <Link className="landing-footer-link" href="/saude">
                Saúde do Sistema
              </Link>
              <Link className="landing-footer-link" href="/onboarding">
                Onboarding
              </Link>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <span>
              © {new Date().getFullYear()} StreamOS. Todos os direitos
              reservados.
            </span>
            <span>
              Ambiente seguro • Pagamentos em conformidade com o Banco Central
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
