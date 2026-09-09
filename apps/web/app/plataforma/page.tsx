'use client';
import { useCallback, useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
import { PageHeader } from '../ui';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Delivery = {
  id: string;
  eventType: string;
  status: string;
  attempts: number;
  lastError?: string;
};
type Overview = {
  members: Array<{ id: string; role: string; user: { email: string } }>;
  invites: Array<{
    id: string;
    email: string;
    role: string;
    acceptedAt: string | null;
    revokedAt: string | null;
  }>;
  tokens: Array<{
    id: string;
    name: string;
    tokenPrefix: string;
    revokedAt: string | null;
  }>;
  webhooks: Array<{
    id: string;
    url: string;
    enabled: boolean;
    deliveries: Delivery[];
  }>;
  integrations: Array<{ id: string; provider: string; status: string }>;
  roles: string[];
  scopes: string[];
  webhookEvents: string[];
};
const rolePermissions: Record<string, string> = {
  ADMIN: 'Gerencia equipe, transmissão, conteúdo e configurações.',
  MODERATOR: 'Controla fila, alertas e moderação; não acessa saques.',
  FINANCE: 'Consulta carteira, recebíveis, extrato e saques.',
  VIEWER: 'Somente leitura nas áreas autorizadas.',
};
export default function Page() {
  const [data, setData] = useState<Overview>();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MODERATOR');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [tokenName, setTokenName] = useState('Automação');
  const [inviteToken, setInviteToken] = useState('');
  const load = useCallback(async () => {
    const r = await fetch(`${api}/dashboard/platform`, {
      credentials: 'include',
    });
    if (r.ok) setData((await r.json()) as Overview);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const mutate = async <
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    path: string,
    method = 'POST',
    body?: unknown,
  ): Promise<T> => {
    const r = await fetch(`${api}${path}`, {
      method,
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result: unknown = await r.json().catch(() => ({}));
    const value = result as T & { message?: string };
    if (!r.ok) throw new Error(value.message ?? 'Falha na operação');
    await load();
    return value;
  };
  return (
    <PanelShell>
      <main className="feature-page settings-page platform-settings-page">
        <PageHeader
          eyebrow="Configurações"
          title="Organização e integrações"
          description="Controle acessos, credenciais e entregas externas da organização."
        />
        <nav
          className="ui-tabs settings-tabs"
          aria-label="Seções da plataforma"
        >
          <a href="#equipe">Equipe</a>
          <a href="#integracoes">Integrações</a>
          <a href="#api">API</a>
          <a href="#webhooks">Webhooks</a>
        </nav>
        <section id="equipe" className="feature-card settings-form">
          <div className="settings-section-heading">
            <h2>Equipe</h2>
            <p>
              Convide pessoas e defina o nível de acesso de cada integrante.
            </p>
          </div>
          <div className="inline-fields">
            <label>
              E-mail
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Papel
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {data?.roles
                  .filter((r) => r !== 'OWNER')
                  .map((r) => (
                    <option key={r}>{r}</option>
                  ))}
              </select>
            </label>
          </div>
          <button
            className="primary-button"
            disabled={!email}
            onClick={() =>
              void (async () => {
                const b = await mutate<{ inviteToken: string }>(
                  '/dashboard/team/invites',
                  'POST',
                  {
                    email,
                    role,
                  },
                );
                setInviteToken(b.inviteToken);
              })()
            }
          >
            Gerar convite
          </button>
          <p className="role-explanation">
            <strong>{role}</strong> — {rolePermissions[role]}
          </p>
          {inviteToken && (
            <div className="generated-secret">
              <small>Convite gerado — copie agora</small>
              <code>{inviteToken}</code>
            </div>
          )}
          {data?.members.map((m) => (
            <div className="subscription-member-row" key={m.id}>
              <span>{m.user.email}</span>
              <select
                value={m.role}
                disabled={m.role === 'OWNER'}
                onChange={(e) =>
                  void mutate(`/dashboard/team/members/${m.id}`, 'PATCH', {
                    role: e.target.value,
                  })
                }
              >
                {data.roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              {m.role !== 'OWNER' && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    void mutate(`/dashboard/team/members/${m.id}`, 'DELETE')
                  }
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          {data?.invites
            .filter((i) => !i.acceptedAt && !i.revokedAt)
            .map((i) => (
              <div className="subscription-member-row" key={i.id}>
                <span>
                  Convite: {i.email} · {i.role}
                </span>
                <button
                  className="secondary-button"
                  onClick={() =>
                    void mutate(`/dashboard/team/invites/${i.id}/revoke`)
                  }
                >
                  Revogar
                </button>
              </div>
            ))}
        </section>
        <section id="api" className="feature-card settings-form">
          <div className="settings-section-heading">
            <h2>Tokens de API</h2>
            <p>
              Crie credenciais para automações e mantenha apenas tokens em uso.
            </p>
          </div>
          <label>
            Nome
            <input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
            />
          </label>
          <button
            className="primary-button"
            onClick={() =>
              void (async () => {
                const b = await mutate<{ token: string }>(
                  '/dashboard/api-tokens',
                  'POST',
                  {
                    name: tokenName,
                    scopes: data?.scopes ?? [],
                  },
                );
                setToken(b.token);
              })()
            }
          >
            Criar token
          </button>
          {token && (
            <div className="generated-secret">
              <small>Token exibido uma única vez</small>
              <code>{token}</code>
            </div>
          )}
          {data?.tokens.map((t) => (
            <div className="subscription-member-row" key={t.id}>
              <span>
                {t.name} · {t.tokenPrefix} ·{' '}
                {t.revokedAt ? 'revogado' : 'ativo'}
              </span>
              {!t.revokedAt && (
                <>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void (async () => {
                        const b = await mutate<{ token: string }>(
                          `/dashboard/api-tokens/${t.id}/rotate`,
                        );
                        setToken(b.token);
                      })()
                    }
                  >
                    Rotacionar
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void mutate(`/dashboard/api-tokens/${t.id}/revoke`)
                    }
                  >
                    Revogar
                  </button>
                </>
              )}
            </div>
          ))}
        </section>
        <section id="webhooks" className="feature-card settings-form">
          <div className="settings-section-heading">
            <h2>Webhooks</h2>
            <p>Envie eventos assinados da StreamOS para seus sistemas.</p>
          </div>
          <label>
            URL
            <input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button
            className="primary-button"
            disabled={!url}
            onClick={() =>
              void (async () => {
                const b = await mutate<{ signingSecret: string }>(
                  '/dashboard/webhook-endpoints',
                  'POST',
                  {
                    url,
                    events: data?.webhookEvents ?? ['payment.confirmed.v1'],
                  },
                );
                setSecret(b.signingSecret);
              })()
            }
          >
            Adicionar endpoint
          </button>
          {secret && (
            <div className="generated-secret">
              <small>Segredo de assinatura — copie agora</small>
              <code>{secret}</code>
            </div>
          )}
          {data?.webhooks.map((w) => (
            <div key={w.id}>
              <div className="subscription-member-row">
                <span>
                  {w.url} · {w.enabled ? 'ativo' : 'pausado'}
                </span>
                <button
                  className="secondary-button"
                  onClick={() =>
                    void mutate(
                      `/dashboard/webhook-endpoints/${w.id}`,
                      'PATCH',
                      { enabled: !w.enabled },
                    )
                  }
                >
                  {w.enabled ? 'Pausar' : 'Ativar'}
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    void (async () => {
                      const b = await mutate<{ signingSecret: string }>(
                        `/dashboard/webhook-endpoints/${w.id}/rotate-secret`,
                      );
                      setSecret(b.signingSecret);
                    })()
                  }
                >
                  Rotacionar segredo
                </button>
              </div>
              {w.deliveries.map((d) => (
                <div className="subscription-member-row" key={d.id}>
                  <small>
                    {d.eventType} · {d.status} · {d.attempts} tentativa(s)
                    {d.lastError ? ` · ${d.lastError}` : ''}
                  </small>
                  {d.status === 'FAILED' && (
                    <button
                      className="secondary-button"
                      onClick={() =>
                        void mutate(
                          `/dashboard/webhook-deliveries/${d.id}/retry`,
                        )
                      }
                    >
                      Tentar novamente
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
        <section id="integracoes" className="feature-card">
          <div className="settings-section-heading">
            <h2>Integrações</h2>
            <p>
              Conecte os serviços usados na transmissão e confira suas
              permissões.
            </p>
          </div>
          <div className="integration-grid">
            {['twitch', 'youtube', 'discord'].map((p) => (
              <article key={p}>
                <strong>
                  {p[0]?.toUpperCase()}
                  {p.slice(1)}
                </strong>
                <small>
                  {data?.integrations.find(
                    (item) => item.provider === p.toUpperCase(),
                  )?.status ?? 'Desconectado'}
                </small>
                <span>Permissões básicas de conta e eventos.</span>
                <div className="compact-actions">
                  <button
                    onClick={() =>
                      void mutate(
                        `/dashboard/integrations/${p}/connect`,
                        'POST',
                        {},
                      )
                    }
                  >
                    Conectar
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void mutate(`/dashboard/integrations/${p}/test`)
                    }
                  >
                    Testar
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      void mutate(`/dashboard/integrations/${p}/disconnect`)
                    }
                  >
                    Desconectar
                  </button>
                </div>
              </article>
            ))}
          </div>
          {data?.integrations.map((i) => (
            <p key={i.id}>
              {i.provider} · {i.status}
            </p>
          ))}
        </section>
      </main>
    </PanelShell>
  );
}
