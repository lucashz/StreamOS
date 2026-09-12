import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { PanelSidebar } from './panel-shell';

const navigation = [
  { icon: 'grid', label: 'Visão geral', href: '/', active: true },
  { icon: 'wallet', label: 'Carteira', href: '/carteira' },
  { icon: 'activity', label: 'Contribuições', href: '/contribuicoes' },
  { icon: 'target', label: 'Metas', href: '/metas' },
  { icon: 'monitor', label: 'Alertas e overlays', href: '/alertas' },
  { icon: 'grid', label: 'Widgets', href: '/widgets' },
  { icon: 'activity', label: 'SongPix', href: '/songpix' },
  { icon: 'monitor', label: 'VideoPix', href: '/videopix' },
  { icon: 'settings', label: 'Moderação e TTS', href: '/moderacao' },
  { icon: 'settings', label: 'Configurar página', href: '/onboarding' },
  { icon: 'sparkles', label: 'Vaquinhas', href: '/vaquinhas' },
  { icon: 'users', label: 'Assinaturas', href: '/assinaturas' },
] as const;

const secondaryNavigation = [
  { icon: 'chart', label: 'Analytics' },
  { icon: 'plug', label: 'Equipe e integrações', href: '/plataforma' },
  { icon: 'settings', label: 'Configurações', href: '/conta' },
] as const;

const metrics = [
  {
    label: 'Receita este mês',
    value: 'R$ 0,00',
    trend: '—',
    detail: 'nenhuma contribuição',
    tone: 'purple',
    icon: 'coins',
  },
  {
    label: 'Saldo disponível',
    value: 'R$ 0,00',
    trend: '—',
    detail: 'R$ 0,00 pendente',
    tone: 'green',
    icon: 'wallet',
  },
  {
    label: 'Ticket médio',
    value: 'R$ 0,00',
    trend: '—',
    detail: 'sem dados confirmados',
    tone: 'blue',
    icon: 'trending',
  },
  {
    label: 'Contribuições',
    value: '0',
    trend: '—',
    detail: 'confirmadas neste mês',
    tone: 'orange',
    icon: 'users',
  },
] as const;

const activity: Array<{
  avatar: string;
  name: string;
  type: string;
  value: string;
  time: string;
  tone: string;
}> = [];

const chart = [
  42, 56, 44, 64, 59, 72, 62, 78, 70, 84, 77, 92, 86, 100,
] as const;

function Icon({ name, size = 20 }: Readonly<{ name: string; size?: number }>) {
  const paths: Record<string, ReactNode> = {
    activity: <path d="M4 12h4l2-6 4 12 2-6h4" />,
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    coins: (
      <>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    monitor: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
    plug: <path d="M12 22v-5M9 8V2M15 8V2M18 8v3a6 6 0 0 1-12 0V8Z" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 15a2 2 0 0 0 .4 2l-2.8 2.8a2 2 0 0 0-2-.4 2 2 0 0 0-1.2 1.8h-4a2 2 0 0 0-1.2-1.8 2 2 0 0 0-2 .4L3.4 17a2 2 0 0 0 .4-2A2 2 0 0 0 2 13.8v-4A2 2 0 0 0 3.8 8a2 2 0 0 0-.4-2l2.8-2.8a2 2 0 0 0 2 .4A2 2 0 0 0 9.4 2h4a2 2 0 0 0 1.2 1.6 2 2 0 0 0 2-.4L19.4 6a2 2 0 0 0-.4 2 2 2 0 0 0 1.8 1.2v4A2 2 0 0 0 19 15Z" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8Z" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    trending: <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />,
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    wallet: (
      <path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6M16 13h4" />
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function NavItem({
  icon,
  label,
  href = '#',
  active = false,
}: Readonly<{ icon: string; label: string; href?: string; active?: boolean }>) {
  return (
    <a className={active ? 'nav-item active' : 'nav-item'} href={href}>
      <Icon name={icon} />
      <span>{label}</span>
      {active && <i />}
    </a>
  );
}

interface Viewer {
  email: string;
  memberships: Array<{
    organization: { name: string; creatorProfile: { slug: string } | null };
  }>;
}

interface DashboardSummary {
  revenueInCents: number;
  pendingInCents: number;
  availableInCents: number;
  blockedInCents: number;
  averageTicketInCents: number;
  contributions: number;
  goal: {
    title: string;
    currentInCents: number;
    targetInCents: number;
  } | null;
  recent: Array<{
    id: string;
    supporterName: string | null;
    amountInCents: number;
    createdAt: string;
  }>;
}

async function getViewer(): Promise<Viewer | null> {
  try {
    const cookie = (await cookies()).toString();
    if (!cookie) return null;
    const response = await fetch(
      `${process.env.API_URL ?? 'http://localhost:3001'}/auth/me`,
      {
        headers: { cookie },
        cache: 'no-store',
      },
    );
    return response.ok ? (response.json() as Promise<Viewer>) : null;
  } catch {
    return null;
  }
}

async function getSummary(): Promise<DashboardSummary | null> {
  try {
    const cookie = (await cookies()).toString();
    if (!cookie) return null;
    const response = await fetch(
      `${process.env.API_URL ?? 'http://localhost:3001'}/dashboard/summary`,
      { headers: { cookie }, cache: 'no-store' },
    );
    return response.ok ? (response.json() as Promise<DashboardSummary>) : null;
  } catch {
    return null;
  }
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);
}

export default async function HomePage() {
  const [viewer, summary] = await Promise.all([getViewer(), getSummary()]);
  const organization = viewer?.memberships[0]?.organization;
  const creatorName = organization?.name ?? 'Luna Plays';
  const firstName = creatorName.split(' ')[0];
  const slug = organization?.creatorProfile?.slug ?? 'luna';
  const initials = creatorName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const displayedMetrics = summary
    ? [
        {
          ...metrics[0],
          value: money(summary.revenueInCents),
          detail: `${summary.contributions} contribuições`,
        },
        {
          ...metrics[1],
          value: money(summary.availableInCents),
          detail: `${money(summary.pendingInCents)} pendente`,
        },
        {
          ...metrics[2],
          value: money(summary.averageTicketInCents),
          detail: 'média confirmada',
        },
        {
          ...metrics[3],
          value: String(summary.contributions),
          detail: 'confirmadas neste mês',
        },
      ]
    : metrics;
  const displayedActivity = summary?.recent.length
    ? summary.recent.map((item, index) => ({
        avatar: (item.supporterName ?? 'A')[0] ?? 'A',
        name: item.supporterName ?? 'Anônimo',
        type: 'Pix mock',
        value: `+ ${money(item.amountInCents)}`,
        time: new Date(item.createdAt).toLocaleDateString('pt-BR'),
        tone: ['purple', 'pink', 'blue', 'green'][index % 4] ?? 'purple',
      }))
    : activity;
  const goal = summary?.goal;
  const goalPercent = goal
    ? Math.min(
        100,
        Math.round((goal.currentInCents / goal.targetInCents) * 100),
      )
    : 0;
  const goalCurrent = goal?.currentInCents ?? 0;
  const goalTarget = goal?.targetInCents ?? 0;
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  return (
    <div className="app-shell">
      <div className="legacy-home-sidebar">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <span />
            </div>
            <strong>StreamOS</strong>
            <em>Beta</em>
          </div>
          <nav aria-label="Navegação principal">
            <p className="nav-label">Principal</p>
            {navigation.map((item) => (
              <NavItem key={item.label} {...item} />
            ))}
            <p className="nav-label nav-label-spaced">Gerenciar</p>
            {secondaryNavigation.map((item) => (
              <NavItem key={item.label} {...item} />
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="live-status">
              <span className="pulse" />
              <div>
                <strong>OBS conectado</strong>
                <small>Gameplay · online</small>
              </div>
              <Icon name="chevron" size={16} />
            </div>
            <div className="profile">
              <div className="avatar">{initials}</div>
              <div>
                <strong>{creatorName}</strong>
                <small>{viewer ? 'Conta sandbox' : 'Modo demonstração'}</small>
              </div>
              <button aria-label="Abrir perfil">•••</button>
            </div>
          </div>
        </aside>
      </div>
      <PanelSidebar />

      <main className="dashboard">
        <header className="topbar">
          <div>
            <p>
              {now.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <h1>
              {greeting}, {firstName} <span>✦</span>
            </h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notificações">
              <Icon name="bell" />
              <span className="notification-dot" />
            </button>
            <a className="preview-button" href={`/${slug}`}>
              <Icon name="eye" size={18} />
              Ver minha página
            </a>
          </div>
        </header>

        <section className="demo-notice">
          <div>
            <Icon name="sparkles" size={18} />
            <span>
              <strong>Ambiente sandbox</strong> — pagamentos, saldo e alertas
              estão conectados ao ledger mock local.
            </span>
          </div>
          {viewer ? (
            <Link href="/entrar">Trocar conta</Link>
          ) : (
            <Link href="/cadastro">Criar conta</Link>
          )}
        </section>

        <section className="metrics-grid" aria-label="Indicadores principais">
          {displayedMetrics.map((metric) => (
            <article
              className={`metric-card ${metric.tone}`}
              key={metric.label}
            >
              <div className="metric-head">
                <span>{metric.label}</span>
                <div className="metric-icon">
                  <Icon name={metric.icon} />
                </div>
              </div>
              <strong className="metric-value">{metric.value}</strong>
              <div className="metric-detail">
                <b>{metric.trend}</b>
                <span>{metric.detail}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          <article className="panel revenue-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Performance</span>
                <h2>Receita por live</h2>
              </div>
              <select aria-label="Período do gráfico" defaultValue="30">
                <option value="30">Últimos 30 dias</option>
                <option value="7">Últimos 7 dias</option>
              </select>
            </div>
            {summary?.contributions ? (
              <>
                <div className="chart-summary">
                  <strong>{money(summary.revenueInCents)}</strong>
                  <span>{summary.contributions} contribuições confirmadas</span>
                </div>
                <div
                  className="chart"
                  aria-label="Volume confirmado no período"
                >
                  <div className="chart-lines">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="bars">
                    {chart.map((height, index) => (
                      <div
                        className={
                          index === chart.length - 3 ? 'bar highlighted' : 'bar'
                        }
                        style={{ height: `${height}%` }}
                        key={`${height}-${index}`}
                      >
                        <span>
                          {index === chart.length - 3 ? 'R$ 684' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="chart-labels">
                  <span>18 jul</span>
                  <span>25 jul</span>
                  <span>01 ago</span>
                  <span>08 ago</span>
                  <span>Hoje</span>
                </div>
              </>
            ) : (
              <div className="dashboard-empty">
                <strong>Sem receita no período</strong>
                <span>
                  O gráfico aparecerá após a primeira contribuição confirmada.
                </span>
              </div>
            )}
          </article>

          <article className="panel goal-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Meta ativa</span>
                <h2>{goal?.title ?? 'Nenhuma meta ativa'}</h2>
              </div>
              <button className="more-button" aria-label="Opções da meta">
                •••
              </button>
            </div>
            <div className="goal-visual">
              <div className="goal-ring">
                <span>{goalPercent}%</span>
                <small>concluído</small>
              </div>
            </div>
            <div className="goal-values">
              <strong>{money(goalCurrent)}</strong>
              <span>
                {goal
                  ? `de ${money(goalTarget)}`
                  : 'Crie uma meta para acompanhar o progresso'}
              </span>
            </div>
            <div className="progress">
              <i style={{ width: `${goalPercent}%` }} />
            </div>
            <p>
              {goal ? (
                <>
                  Faltam{' '}
                  <strong>
                    {money(Math.max(0, goalTarget - goalCurrent))}
                  </strong>{' '}
                  para concluir a meta.
                </>
              ) : (
                'Metas ajudam sua comunidade a acompanhar um objetivo.'
              )}
            </p>
            <Link className="secondary-button" href="/metas">
              {goal ? 'Editar meta' : 'Criar meta'}
            </Link>
          </article>

          <article className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Em tempo real</span>
                <h2>Contribuições recentes</h2>
              </div>
              <a href="#">
                Ver todas <Icon name="chevron" size={15} />
              </a>
            </div>
            <div className="activity-list">
              {displayedActivity.length ? (
                displayedActivity.map((item) => (
                  <div
                    className="activity-row"
                    key={`${item.name}-${item.time}`}
                  >
                    <div className={`activity-avatar ${item.tone}`}>
                      {item.avatar}
                    </div>
                    <div className="activity-person">
                      <strong>{item.name}</strong>
                      <span>
                        {item.type} · {item.time}
                      </span>
                    </div>
                    <strong className="activity-value">{item.value}</strong>
                  </div>
                ))
              ) : (
                <div className="dashboard-empty">
                  <strong>Nenhuma contribuição recente</strong>
                  <span>As confirmações aparecerão aqui em tempo real.</span>
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
