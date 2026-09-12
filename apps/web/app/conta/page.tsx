'use client';

import { useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
import { PageHeader } from '../ui';
import { OverlayLinkCard } from '../overlay-link-card';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Viewer = {
  email: string;
  memberships: Array<{
    role: string;
    organization: {
      name: string;
      creatorProfile: {
        displayName: string;
        bio: string | null;
        slug: string;
        avatarUrl: string | null;
      } | null;
    };
  }>;
};
type Session = {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
};

export default function AccountPage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [status, setStatus] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [role, setRole] = useState('');
  const [deactivationConfirmation, setDeactivationConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const responses = await Promise.all([
      fetch(`${api}/auth/me`, { credentials: 'include' }),
      fetch(`${api}/auth/account/sessions`, { credentials: 'include' }),
    ]).catch(() => null);
    if (!responses) {
      setStatus('Não foi possível carregar os dados da conta.');
      return;
    }
    const [meResponse, sessionsResponse] = responses;
    if (!meResponse.ok) {
      setStatus('Entre na sua conta para continuar.');
      return;
    }
    const viewer = (await meResponse.json()) as Viewer;
    const organization = viewer.memberships[0]?.organization;
    setEmail(viewer.email);
    setDisplayName(
      organization?.creatorProfile?.displayName ?? organization?.name ?? '',
    );
    setBio(organization?.creatorProfile?.bio ?? '');
    setAvatarUrl(organization?.creatorProfile?.avatarUrl ?? '');
    setOrganizationName(organization?.name ?? '');
    setOrganizationSlug(organization?.creatorProfile?.slug ?? '');
    setRole(viewer.memberships[0]?.role ?? '');
    if (sessionsResponse.ok)
      setSessions((await sessionsResponse.json()) as Session[]);
  }
  useEffect(() => {
    void load();
  }, []);
  async function saveProfile() {
    if (busy) return;
    setBusy(true);
    setStatus('Salvando perfil…');
    try {
      const response = await fetch(`${api}/auth/account/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          bio: bio.trim(),
          avatarUrl: avatarUrl.trim(),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      setStatus(
        response.ok
          ? 'Perfil atualizado.'
          : (body.message ?? 'Não foi possível atualizar.'),
      );
      if (response.ok) await load();
    } catch {
      setStatus('Não foi possível conectar ao servidor.');
    } finally {
      setBusy(false);
    }
  }
  async function changePassword() {
    if (busy) return;
    setBusy(true);
    setStatus('Alterando senha…');
    const response = await fetch(`${api}/auth/account/password`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).catch(() => null);
    if (!response) {
      setStatus('Não foi possível conectar ao servidor.');
      setBusy(false);
      return;
    }
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    setStatus(
      response.ok
        ? 'Senha alterada e outras sessões encerradas.'
        : (body.message ?? 'Não foi possível alterar.'),
    );
    if (response.ok) {
      setCurrentPassword('');
      setNewPassword('');
      await load();
    }
    setBusy(false);
  }
  async function revoke(id: string) {
    if (busy) return;
    setBusy(true);
    const response = await fetch(`${api}/auth/account/sessions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null);
    if (response?.ok) {
      const body = (await response.json()) as { current: boolean };
      if (body.current) {
        window.location.href = '/entrar';
        return;
      }
      await load();
      setStatus('Sessão encerrada.');
    } else {
      setStatus('Não foi possível encerrar a sessão.');
    }
    setBusy(false);
  }
  async function logoutAll() {
    if (busy) return;
    setBusy(true);
    setStatus('Encerrando sessões…');
    const response = await fetch(`${api}/auth/account/logout-all`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => null);
    if (response?.ok) {
      window.location.href = '/entrar';
      return;
    }
    setStatus('Não foi possível encerrar as sessões.');
    setBusy(false);
  }
  async function deactivateOrganization() {
    if (busy) return;
    setBusy(true);
    setStatus('Desativando organização…');
    const response = await fetch(
      `${api}/auth/account/deactivate-organization`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmation: deactivationConfirmation }),
      },
    ).catch(() => null);
    if (response?.ok) window.location.href = '/entrar';
    else {
      const body = (await response?.json().catch(() => ({}))) as {
        message?: string;
      };
      setStatus(body.message ?? 'Não foi possível desativar a organização.');
      setBusy(false);
    }
  }
  return (
    <PanelShell>
      <main className="feature-page settings-page account-settings-page">
        <PageHeader
          eyebrow="Configurações"
          title="Conta e segurança"
          description="Gerencie seu perfil público, senha, sessões e organização."
        />
        <nav className="ui-tabs settings-tabs" aria-label="Seções da conta">
          <a href="#perfil">Perfil</a>
          <a href="#seguranca">Senha e sessões</a>
          <a href="#organizacao">Organização</a>
          <a href="#browser-source">Browser Source</a>
        </nav>
        <section id="perfil" className="feature-card settings-form">
          <div className="settings-section-heading">
            <h2>Perfil público</h2>
            <p>Informações exibidas na sua página de contribuições.</p>
          </div>
          <label>
            Nome público
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Biografia
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
            />
            <small>{bio.length}/500 caracteres</small>
          </label>
          <label>
            Avatar
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <button
            className="primary-button"
            disabled={busy || !displayName.trim() || !email.includes('@')}
            onClick={() => void saveProfile()}
          >
            {busy ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </section>
        <section id="seguranca" className="feature-card settings-form">
          <div className="settings-section-heading">
            <h2>Alterar senha</h2>
            <p>
              Use pelo menos 10 caracteres. A alteração encerra as outras
              sessões.
            </p>
          </div>
          <label>
            Senha atual
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={10}
            />
          </label>
          <button
            className="primary-button"
            disabled={
              busy || currentPassword.length < 1 || newPassword.length < 10
            }
            onClick={() => void changePassword()}
          >
            {busy ? 'Processando…' : 'Alterar senha'}
          </button>
        </section>
        <section className="feature-card settings-sessions-card">
          <div className="settings-section-heading">
            <h2>Sessões ativas</h2>
            <p>Revise os dispositivos conectados à sua conta.</p>
          </div>
          <div className="data-list">
            {sessions.map((session) => (
              <article key={session.id}>
                <div>
                  <strong>
                    {session.current ? 'Este dispositivo' : 'Outro dispositivo'}
                  </strong>
                  <small>
                    {session.userAgent ?? 'Navegador desconhecido'} ·{' '}
                    {session.ipAddress ?? 'IP indisponível'}
                  </small>
                  <small>
                    Último acesso:{' '}
                    {new Date(session.lastUsedAt).toLocaleString('pt-BR')}
                  </small>
                </div>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void revoke(session.id)}
                >
                  Encerrar
                </button>
              </article>
            ))}
          </div>
          <button
            className="danger-button"
            disabled={busy}
            onClick={() => void logoutAll()}
          >
            Sair de todos os dispositivos
          </button>
        </section>
        <section id="organizacao" className="feature-card settings-form">
          <h2>Organização</h2>
          <div className="organization-summary">
            <span>
              <small>Nome</small>
              <strong>{organizationName}</strong>
            </span>
            <span>
              <small>Endereço público</small>
              <strong>/{organizationSlug}</strong>
            </span>
            <span>
              <small>Seu papel</small>
              <strong>{role.toLowerCase()}</strong>
            </span>
            <span>
              <small>Ambiente</small>
              <strong>Local / sandbox</strong>
            </span>
          </div>
          {role === 'OWNER' ? (
            <div className="danger-zone">
              <h3>Desativar organização</h3>
              <p>
                A página pública será retirada do ar e todas as suas sessões
                serão encerradas. Os registros financeiros serão preservados.
              </p>
              <label>
                <span>
                  Digite <strong>{organizationName}</strong> para confirmar
                </span>
                <input
                  value={deactivationConfirmation}
                  onChange={(event) =>
                    setDeactivationConfirmation(event.target.value)
                  }
                />
              </label>
              <button
                className="danger-button"
                disabled={busy || deactivationConfirmation !== organizationName}
                onClick={() => void deactivateOrganization()}
              >
                Desativar organização
              </button>
            </div>
          ) : null}
        </section>
        <section id="browser-source" aria-label="Browser Source">
          <OverlayLinkCard />
        </section>
        {status ? (
          <p className="account-status" role="status">
            {status}
          </p>
        ) : null}
      </main>
    </PanelShell>
  );
}
