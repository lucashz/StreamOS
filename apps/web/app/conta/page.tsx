'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Viewer = {
  email: string;
  memberships: Array<{
    role: string;
    organization: {
      name: string;
      creatorProfile: { displayName: string; bio: string | null; slug: string; avatarUrl: string | null } | null;
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
  async function load() {
    const [meResponse, sessionsResponse] = await Promise.all([
      fetch(`${api}/auth/me`, { credentials: 'include' }),
      fetch(`${api}/auth/account/sessions`, { credentials: 'include' }),
    ]);
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
    const response = await fetch(`${api}/auth/account/profile`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, displayName, bio, avatarUrl }),
    });
    const body = (await response.json()) as { message?: string };
    setStatus(
      response.ok
        ? 'Perfil atualizado.'
        : (body.message ?? 'Não foi possível atualizar.'),
    );
  }
  async function changePassword() {
    const response = await fetch(`${api}/auth/account/password`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const body = (await response.json()) as { message?: string };
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
  }
  async function revoke(id: string) {
    const response = await fetch(`${api}/auth/account/sessions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (response.ok) {
      const body = (await response.json()) as { current: boolean };
      if (body.current) {
        window.location.href = '/entrar';
        return;
      }
      await load();
    }
  }
  async function logoutAll() {
    await fetch(`${api}/auth/account/logout-all`, {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/entrar';
  }
  async function deactivateOrganization() {
    const response = await fetch(`${api}/auth/account/deactivate-organization`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmation: deactivationConfirmation }) });
    if (response.ok) window.location.href = '/entrar';
    else { const body = (await response.json()) as { message?: string }; setStatus(body.message ?? 'Não foi possível desativar a organização.'); }
  }
  return (
    <PanelShell>
      <main className="feature-page">
        <Link href="/" className="back-link">
          ← Visão geral
        </Link>
        <header>
          <span className="section-kicker">Sua conta</span>
          <h1>Perfil e segurança</h1>
          <p>Gerencie seus dados, senha e dispositivos conectados.</p>
        </header>
        <section id="perfil" className="feature-card settings-form">
          <h2>Perfil</h2>
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
          </label>
          <label>Avatar<input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." /></label>
          <button onClick={() => void saveProfile()}>Salvar perfil</button>
        </section>
        <section id="seguranca" className="feature-card settings-form">
          <h2>Alterar senha</h2>
          <p>A StreamOS não usa autenticação em duas etapas nesta fase.</p>
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
          <button onClick={() => void changePassword()}>Alterar senha</button>
        </section>
        <section className="feature-card">
          <h2>Sessões ativas</h2>
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
                <button onClick={() => void revoke(session.id)}>
                  Encerrar
                </button>
              </article>
            ))}
          </div>
          <button className="danger-button" onClick={() => void logoutAll()}>
            Sair de todos os dispositivos
          </button>
        </section>
        <section id="organizacao" className="feature-card settings-form">
          <h2>Organização</h2>
          <div className="organization-summary"><span><small>Nome</small><strong>{organizationName}</strong></span><span><small>Endereço público</small><strong>/{organizationSlug}</strong></span><span><small>Seu papel</small><strong>{role.toLowerCase()}</strong></span><span><small>Ambiente</small><strong>Local / sandbox</strong></span></div>
          {role === 'OWNER' ? <div className="danger-zone"><h3>Desativar organização</h3><p>A página pública será retirada do ar e todas as suas sessões serão encerradas. Os registros financeiros serão preservados.</p><label>Digite <strong>{organizationName}</strong> para confirmar<input value={deactivationConfirmation} onChange={(event) => setDeactivationConfirmation(event.target.value)} /></label><button className="danger-button" disabled={deactivationConfirmation !== organizationName} onClick={() => void deactivateOrganization()}>Desativar organização</button></div> : null}
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
