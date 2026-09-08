'use client';

import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <span className="section-kicker">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`feature-card ui-panel ${className}`}>
      {children}
    </section>
  );
}
export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  children: ReactNode;
}) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">◇</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Tabs({
  value,
  options,
  onChange,
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ui-tabs" role="tablist">
      {options.map((option) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? 'active' : ''}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
export function SecretUrlField({
  value,
  onRotate,
}: {
  value?: string;
  onRotate: () => void;
}) {
  const copy = () => {
    if (value) void navigator.clipboard.writeText(value);
  };
  return (
    <div className="secret-url">
      <div>
        <strong>URL secreta da Browser Source</strong>
        <small>
          Não compartilhe publicamente. Ao rotacionar, a URL anterior para de
          funcionar.
        </small>
      </div>
      {value ? (
        <>
          <input
            aria-label="URL secreta do widget"
            readOnly
            type="password"
            value={value}
          />
          <div className="compact-actions">
            <button onClick={copy}>Copiar URL para OBS</button>
            <button className="secondary-button" onClick={onRotate}>
              Rotacionar
            </button>
          </div>
        </>
      ) : (
        <button onClick={onRotate}>Gerar URL para OBS</button>
      )}
    </div>
  );
}
export function ObsConnectionStatus({
  connected,
  lastHeartbeat,
}: {
  connected: boolean;
  lastHeartbeat?: string | null;
}) {
  const heartbeat = lastHeartbeat ? new Date(lastHeartbeat) : null;
  const heartbeatLabel =
    heartbeat && !Number.isNaN(heartbeat.getTime())
      ? heartbeat.toLocaleString('pt-BR')
      : lastHeartbeat
        ? 'Horário indisponível'
        : 'Nenhum sinal recebido';
  return (
    <div className="obs-status">
      <StatusBadge tone={connected ? 'success' : 'warning'}>
        {connected ? 'OBS conectado' : 'OBS desconectado'}
      </StatusBadge>
      <small>
        {lastHeartbeat ? `Último sinal: ${heartbeatLabel}` : heartbeatLabel}
      </small>
    </div>
  );
}
