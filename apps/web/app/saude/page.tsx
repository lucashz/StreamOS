'use client';

import { useCallback, useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Operations = {
  periodHours: number;
  checkedAt: string;
  psp: { provider: string; environment: string; credentialsConfigured: boolean; webhookConfigured: boolean; pixOutEnabled: boolean; kycKyb: string; medHandling: string };
  infrastructure: { postgresql: string; redis: string; worker: string; realtime: string };
  flags: {
    paymentsEnabled: boolean;
    payoutsEnabled: boolean;
    videoPixEnabled: boolean;
    songPixEnabled: boolean;
    subscriptionsEnabled: boolean;
  };
  paymentIntents: number;
  confirmedPayments: number;
  conversionPercent: number;
  averageConfirmationMs: number;
  p95ConfirmationMs: number;
  p95AlertStartMs: number;
  p95OverlayDeliveryMs: number;
  playbackFailurePercent: number;
  slo: {
    paymentConfirmationTargetMs: number;
    paymentConfirmationMet: boolean;
    alertStartTargetMs: number;
    alertStartMet: boolean;
  };
  betaGate: { ready: boolean; reasons: string[] };
  grossInCents: number;
  platformRevenueInCents: number;
  providerFeesInCents: number;
  netPlatformMarginInCents: number;
  reconciliation: { healthy: boolean; divergences: number };
  backup: {
    healthy: boolean;
    lastBackupAt: string | null;
    ageHours: number | null;
  };
  playbackTotal: number;
  playbackFailures: number;
  overlayConnected: boolean;
  lastHeartbeatAt: string | null;
  pendingOutbox: number;
  failedWebhooks: number;
  durableQueueDepth: number;
  streamPending: number;
  deadLetterEvents: number;
};

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100);

const duration = (value: number) =>
  value < 1_000
    ? `${value} ms`
    : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1_000)} s`;

export default function HealthPage() {
  const [data, setData] = useState<Operations>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`${api}/dashboard/operations`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      setError(
        response.status === 403
          ? 'Somente proprietários e administradores podem ver esta página.'
          : 'Não foi possível consultar a saúde do sistema.',
      );
      setLoading(false);
      return;
    }
    setData((await response.json()) as Operations);
    setError('');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <PanelShell>
      <main className="feature-page operations-page">
        <header className="operations-header">
          <div>
            <span className="section-kicker">Operação</span>
            <h1>Saúde do sistema</h1>
            <p>Pagamentos, alertas e integrações nas últimas 24 horas.</p>
          </div>
          <button className="secondary" onClick={() => void load()}>
            Atualizar
          </button>
        </header>

        {loading && !data ? (
          <div className="feature-card">Carregando...</div>
        ) : null}
        {error ? (
          <div className="feature-card operations-error">{error}</div>
        ) : null}
        {data ? (
          <>
            <section
              className="operations-flags"
              aria-label="Controles operacionais"
            >
              <div
                className={`operations-flag ${data.flags.paymentsEnabled ? 'ok' : 'off'}`}
              >
                <span />
                <div>
                  <strong>Recebimentos</strong>
                  <small>
                    {data.flags.paymentsEnabled ? 'Ativos' : 'Pausados'}
                  </small>
                </div>
              </div>
              <div
                className={`operations-flag ${data.flags.payoutsEnabled ? 'ok' : 'off'}`}
              >
                <span />
                <div>
                  <strong>Saques</strong>
                  <small>
                    {data.flags.payoutsEnabled ? 'Ativos' : 'Pausados'}
                  </small>
                </div>
              </div>
              <div
                className={`operations-flag ${data.overlayConnected ? 'ok' : 'off'}`}
              >
                <span />
                <div>
                  <strong>Overlay unificado</strong>
                  <small>
                    {data.overlayConnected
                      ? 'Conectado ao OBS'
                      : 'Sem heartbeat recente'}
                  </small>
                </div>
              </div>
              {[
                ['VideoPix', data.flags.videoPixEnabled],
                ['SongPix', data.flags.songPixEnabled],
                ['Assinaturas', data.flags.subscriptionsEnabled],
              ].map(([label, enabled]) => (
                <div
                  className={`operations-flag ${enabled ? 'ok' : 'off'}`}
                  key={String(label)}
                >
                  <span />
                  <div>
                    <strong>{String(label)}</strong>
                    <small>{enabled ? 'Ativo' : 'Pausado'}</small>
                  </div>
                </div>
              ))}
            </section>

            <section
              className={`feature-card beta-gate ${data.betaGate.ready ? 'ready' : 'blocked'}`}
            >
              <div>
                <span className="section-kicker">Gate do beta</span>
                <h2>
                  {data.betaGate.ready ? 'Apto para operar' : 'Bloqueado'}
                </h2>
              </div>
              <small>Última verificação: {new Date(data.checkedAt).toLocaleString('pt-BR')}</small>
              {data.betaGate.reasons.length ? (
                <ul>
                  {data.betaGate.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p>Todos os critérios técnicos locais estão dentro da meta.</p>
              )}
            </section>

            <section className="feature-card psp-health">
              <div className="panel-heading"><div><span className="section-kicker">Financeiro</span><h2>Provedor Pix</h2></div><strong>{data.psp.provider}</strong></div>
              <dl className="psp-health-grid">
                <div><dt>Ambiente</dt><dd>{data.psp.environment}</dd></div>
                <div><dt>Credenciais</dt><dd>{data.psp.credentialsConfigured ? 'Configuradas' : 'Pendentes'}</dd></div>
                <div><dt>Webhook</dt><dd>{data.psp.webhookConfigured ? 'Configurado' : 'Pendente'}</dd></div>
                <div><dt>Pix Out</dt><dd>{data.psp.pixOutEnabled ? 'Habilitado' : 'Desabilitado'}</dd></div>
                <div><dt>KYC/KYB</dt><dd>{data.psp.kycKyb}</dd></div>
                <div><dt>MED</dt><dd>{data.psp.medHandling}</dd></div>
              </dl>
            </section>
            <section className="feature-card psp-health">
              <div className="panel-heading"><div><span className="section-kicker">Infraestrutura</span><h2>Serviços essenciais</h2></div></div>
              <dl className="psp-health-grid">
                {Object.entries(data.infrastructure).map(([service, state]) => <div key={service}><dt>{service === 'postgresql' ? 'PostgreSQL' : service === 'redis' ? 'Redis' : service === 'worker' ? 'Worker' : 'Realtime'}</dt><dd>{state}</dd></div>)}
              </dl>
            </section>

            <section className="operations-grid">
              <article className="feature-card">
                <small>Intenções Pix</small>
                <strong>{data.paymentIntents}</strong>
                <span>{data.confirmedPayments} confirmadas</span>
              </article>
              <article className="feature-card">
                <small>Conversão</small>
                <strong>{data.conversionPercent}%</strong>
                <span>criação até confirmação</span>
              </article>
              <article className="feature-card">
                <small>Tempo de confirmação</small>
                <strong>{duration(data.averageConfirmationMs)}</strong>
                <span>P95 {duration(data.p95ConfirmationMs)}</span>
              </article>
              <article className="feature-card">
                <small>SLO Pix</small>
                <strong>
                  {data.slo.paymentConfirmationMet ? 'OK' : 'Alerta'}
                </strong>
                <span>
                  95% em até {duration(data.slo.paymentConfirmationTargetMs)}
                </span>
              </article>
              <article className="feature-card">
                <small>SLO entrega ao OBS</small>
                <strong>{data.slo.alertStartMet ? 'OK' : 'Alerta'}</strong>
                <span>
                  P95 {duration(data.p95OverlayDeliveryMs)} · meta{' '}
                  {duration(data.slo.alertStartTargetMs)}
                </span>
              </article>
              <article className="feature-card">
                <small>Pagamento → reprodução</small>
                <strong>{duration(data.p95AlertStartMs)}</strong>
                <span>P95 incluindo espera na fila</span>
              </article>
              <article className="feature-card">
                <small>Volume confirmado</small>
                <strong>{money(data.grossInCents)}</strong>
                <span>
                  {money(data.platformRevenueInCents)} para a StreamOS
                </span>
              </article>
              <article className="feature-card">
                <small>Alertas executados</small>
                <strong>{data.playbackTotal}</strong>
                <span>
                  {data.playbackFailures} falhas · {data.playbackFailurePercent}
                  %
                </span>
              </article>
              <article className="feature-card">
                <small>Fila interna</small>
                <strong>{data.pendingOutbox}</strong>
                <span>eventos aguardando entrega</span>
              </article>
              <article className="feature-card">
                <small>Webhooks com falha</small>
                <strong>{data.failedWebhooks}</strong>
                <span>nas últimas 24 horas</span>
              </article>
              <article className="feature-card">
                <small>Taxas do provedor</small>
                <strong>{money(data.providerFeesInCents)}</strong>
                <span>custo financeiro registrado</span>
              </article>
              <article className="feature-card">
                <small>Margem operacional</small>
                <strong>{money(data.netPlatformMarginInCents)}</strong>
                <span>receita StreamOS após o repasse do custo do PSP</span>
              </article>
              <article className="feature-card">
                <small>Conciliação</small>
                <strong>{data.reconciliation.healthy ? 'OK' : 'Alerta'}</strong>
                <span>{data.reconciliation.divergences} divergências</span>
              </article>
              <article className="feature-card">
                <small>Último backup</small>
                <strong>{data.backup.healthy ? 'OK' : 'Alerta'}</strong>
                <span>
                  {data.backup.lastBackupAt
                    ? `${data.backup.ageHours}h atrás`
                    : 'não encontrado'}
                </span>
              </article>
              <article className="feature-card">
                <small>Stream durável</small>
                <strong>{data.durableQueueDepth}</strong>
                <span>{data.streamPending} aguardando ACK do worker</span>
              </article>
              <article className="feature-card">
                <small>Dead-letter</small>
                <strong>{data.deadLetterEvents}</strong>
                <span>eventos que exigem intervenção</span>
              </article>
            </section>

            <section className="feature-card operations-note">
              <h2>Overlay do OBS</h2>
              <p>
                {data.lastHeartbeatAt
                  ? `Último heartbeat em ${new Date(data.lastHeartbeatAt).toLocaleString('pt-BR')}.`
                  : 'O overlay unificado ainda não enviou heartbeat. Abra a URL de alertas no OBS.'}
              </p>
            </section>
          </>
        ) : null}
      </main>
    </PanelShell>
  );
}
