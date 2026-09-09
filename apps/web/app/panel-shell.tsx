'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
type IconName =
  | 'grid'
  | 'wallet'
  | 'activity'
  | 'target'
  | 'monitor'
  | 'widgets'
  | 'music'
  | 'video'
  | 'shield'
  | 'settings'
  | 'campaign'
  | 'users'
  | 'plug';
function MenuIcon({ name }: { name: IconName }) {
  const p: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    wallet: (
      <path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6M16 13h4" />
    ),
    activity: <path d="M4 12h4l2-6 4 12 2-6h4" />,
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    monitor: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
    widgets: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </>
    ),
    video: (
      <>
        <rect x="2" y="5" width="15" height="14" rx="2" />
        <path d="m17 10 5-3v10l-5-3Z" />
      </>
    ),
    shield: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4" />
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 15a2 2 0 0 0 .4 2l-2.8 2.8a2 2 0 0 0-2-.4 2 2 0 0 0-1.2 1.8h-4a2 2 0 0 0-1.2-1.8 2 2 0 0 0-2 .4L3.4 17a2 2 0 0 0 .4-2A2 2 0 0 0 2 13.8v-4A2 2 0 0 0 3.8 8a2 2 0 0 0-.4-2l2.8-2.8a2 2 0 0 0 2 .4A2 2 0 0 0 9.4 2h4a2 2 0 0 0 1.2 1.6 2 2 0 0 0 2-.4L19.4 6a2 2 0 0 0-.4 2 2 2 0 0 0 1.8 1.2v4A2 2 0 0 0 19 15Z" />
      </>
    ),
    campaign: (
      <>
        <path d="M12 21s-7-4.4-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.6-7 11-7 11Z" />
        <path d="M12 7v9M8 11h8" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    plug: <path d="M12 22v-5M9 8V2M15 8V2M18 8v3a6 6 0 0 1-12 0V8Z" />,
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {p[name]}
    </svg>
  );
}
function NavLink({
  label,
  href,
  icon,
  onNavigate,
}: {
  label: string;
  href: string;
  icon?: IconName;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const syncLocation = () => {
      setHash(window.location.hash);
      setSearch(window.location.search);
    };
    syncLocation();
    window.addEventListener('hashchange', syncLocation);
    window.addEventListener('popstate', syncLocation);
    return () => {
      window.removeEventListener('hashchange', syncLocation);
      window.removeEventListener('popstate', syncLocation);
    };
  }, [pathname]);
  const targetHash = href.includes('#') ? `#${href.split('#')[1]}` : '';
  const targetSearch = href.includes('?')
    ? `?${href.split('?')[1]?.split('#')[0]}`
    : '';
  const targetPath = basePath(href);
  const pathMatches =
    pathname === targetPath ||
    (targetPath !== '/' && pathname.startsWith(`${targetPath}/`));
  const active =
    pathMatches &&
    (targetHash ? hash === targetHash : !hash) &&
    (targetSearch ? search === targetSearch : !search);
  return (
    <Link
      className={
        active ? 'nav-item submenu-item active' : 'nav-item submenu-item'
      }
      href={href}
      onClick={() => {
        onNavigate?.();
        window.setTimeout(() => {
          setHash(window.location.hash);
          setSearch(window.location.search);
        }, 0);
      }}
    >
      {icon ? <MenuIcon name={icon} /> : null}
      <span>{label}</span>
      {active && <i />}
    </Link>
  );
}
function basePath(href: string) {
  return href.split(/[?#]/, 1)[0] ?? href;
}
const groups: ReadonlyArray<{
  label: string;
  icon: IconName;
  roles: ReadonlyArray<string>;
  items: ReadonlyArray<
    readonly [string, string, IconName, ReadonlyArray<string>?]
  >;
}> = [
  {
    label: 'Visão geral',
    icon: 'grid',
    roles: ['OWNER', 'ADMIN', 'MODERATOR', 'FINANCE', 'VIEWER'],
    items: [['Painel', '/', 'grid']],
  },
  {
    label: 'Receitas',
    icon: 'wallet',
    roles: ['OWNER', 'ADMIN', 'FINANCE', 'VIEWER'],
    items: [
      ['Contribuições', '/contribuicoes', 'activity'],
      ['Carteira', '/carteira', 'wallet'],
      ['Vaquinhas', '/vaquinhas', 'campaign'],
      ['Recompensas', '/vaquinhas#recompensas', 'target'],
      ['Assinaturas', '/assinaturas', 'users'],
    ],
  },
  {
    label: 'Transmissão',
    icon: 'widgets',
    roles: ['OWNER', 'ADMIN', 'MODERATOR', 'VIEWER'],
    items: [
      ['Central da Live', '/central-da-live', 'activity'],
      ['Alertas e variações', '/alertas', 'monitor'],
      ['Widgets', '/widgets', 'widgets'],
      ['Tema global', '/aparencia', 'settings'],
    ],
  },
  {
    label: 'Comunidade',
    icon: 'shield',
    roles: ['OWNER', 'ADMIN', 'MODERATOR', 'VIEWER'],
    items: [
      ['Moderação', '/moderacao', 'shield'],
      ['Voz e TTS', '/moderacao#tts', 'activity'],
      ['Bloqueios', '/moderacao#bloqueios', 'shield'],
    ],
  },
  {
    label: 'Configurações',
    icon: 'settings',
    roles: ['OWNER', 'ADMIN', 'MODERATOR', 'FINANCE', 'VIEWER'],
    items: [
      ['Conta e segurança', '/conta', 'users'],
      ['Equipe', '/plataforma#equipe', 'users', ['OWNER', 'ADMIN']],
      ['Integrações', '/plataforma#integracoes', 'plug', ['OWNER', 'ADMIN']],
      ['API e webhooks', '/plataforma#api', 'settings', ['OWNER', 'ADMIN']],
      ['Saúde do sistema', '/saude', 'activity', ['OWNER', 'ADMIN']],
    ],
  },
];
const roleLabels: Record<string, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MODERATOR: 'Moderador',
  FINANCE: 'Financeiro',
  VIEWER: 'Somente leitura',
};
export function PanelSidebar({
  open = false,
  collapsed = false,
  onClose,
  onToggle,
}: {
  open?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [identity, setIdentity] = useState({
    name: 'StreamOS',
    email: 'Conta sandbox',
  });
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/me`,
      { credentials: 'include' },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          user: {
            email?: string;
            memberships?: Array<{
              role?: string;
              organization?: {
                name?: string;
                creatorProfile?: { displayName?: string };
              };
            }>;
          } | null,
        ) => {
          const membership = user?.memberships?.[0];
          setRole(membership?.role ?? null);
          setIdentity({
            name:
              membership?.organization?.creatorProfile?.displayName ??
              membership?.organization?.name ??
              'StreamOS',
            email: user?.email ?? 'Conta sandbox',
          });
        },
      )
      .catch(() => setRole(null));
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/health/live`,
    )
      .then((response) => setApiOnline(response.ok))
      .catch(() => setApiOnline(false));
  }, []);

  const visibleGroups = role
    ? groups.filter((group) => group.roles.includes(role))
    : groups;
  return (
    <aside
      className={`${open ? 'sidebar mobile-open' : 'sidebar'}${collapsed ? ' collapsed' : ''}`}
      aria-label="Menu lateral"
    >
      <button
        className="sidebar-close"
        type="button"
        onClick={onClose}
        aria-label="Fechar menu"
      >
        ×
      </button>
      <Link className="brand" href="/">
        <div className="brand-mark">
          <span />
        </div>
        <strong>StreamOS</strong>
        <em>Beta</em>
      </Link>
      <nav aria-label="Navegação principal">
        <p className="nav-label">StreamOS</p>
        {visibleGroups.map((group) => {
          const visibleItems = group.items.filter(
            ([, , , itemRoles]) =>
              !itemRoles || !role || itemRoles.includes(role),
          );
          const active = visibleItems.some(([, href]) => {
            const target = basePath(href);
            return (
              pathname === target ||
              (target !== '/' && pathname.startsWith(`${target}/`))
            );
          });
          return (
            <details
              className="nav-group"
              key={group.label}
              name="sidebar-navigation"
              open={active || undefined}
            >
              <summary
                className={
                  active ? 'nav-group-title active' : 'nav-group-title'
                }
              >
                <MenuIcon name={group.icon} />
                <span>{group.label}</span>
                <b>⌄</b>
              </summary>
              <div className="nav-submenu">
                {visibleItems.map(([label, href, icon]) => (
                  <NavLink
                    key={href}
                    label={label}
                    href={href}
                    icon={icon}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </nav>
      <button
        className="sidebar-collapse"
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
        <b>{collapsed ? 'Expandir' : 'Recolher menu'}</b>
      </button>
      <div className="sidebar-footer">
        <div className="live-status">
          <span className={apiOnline === false ? 'pulse offline' : 'pulse'} />
          <div>
            <strong>Ambiente local</strong>
            <small>
              {apiOnline === null
                ? 'Verificando API…'
                : apiOnline
                  ? 'API conectada'
                  : 'API desconectada'}
            </small>
          </div>
        </div>
        <div className="profile">
          <div className="avatar">
            {identity.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{identity.name}</strong>
            <small>
              {role ? (roleLabels[role] ?? 'Membro') : identity.email}
            </small>
          </div>
        </div>
      </div>
    </aside>
  );
}
export function PanelShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  useEffect(
    () =>
      setCollapsed(
        window.localStorage.getItem('streamos-sidebar-collapsed') === 'true',
      ),
    [],
  );
  const toggleCollapsed = () =>
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('streamos-sidebar-collapsed', String(next));
      return next;
    });
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) =>
      event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return (
    <div className={collapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <button
        className="mobile-menu-button"
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={menuOpen}
      >
        ☰ <span>Menu</span>
      </button>
      {menuOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}
      <PanelSidebar
        open={menuOpen}
        collapsed={collapsed}
        onClose={() => setMenuOpen(false)}
        onToggle={toggleCollapsed}
      />
      <div className="dashboard panel-content">{children}</div>
    </div>
  );
}
