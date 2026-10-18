'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PanelShell } from '../panel-shell';
import { PageHeader } from '../ui';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Operations = {
  periodHours: number;
  checkedAt: string;
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
  reconciliation: { healthy: boolean; divergences: number };
  playbackTotal: number;
  playbackFailures: number;
  overlayConnected: boolean;
  lastHeartbeatAt: string | null;
  pendingOutbox: number;
  failedWebhooks: number;
};

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
          : 'Não foi possível consultar a saúde da transmissão.',
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

  const playbackSuccessRate = data
    ? Math.max(0, 100 - data.playbackFailurePercent)
    : 100;

  return (
    <PanelShell>
      <main className="feature-page operations-page">
        <PageHeader
          eyebrow="Transmissão · Diagnóstico"
          title="Saúde da transmissão"
          description="Monitore a conexão do OBS, estabilidade dos alertas e desempenho do Pix no seu canal nas últimas 24 horas."
          actions={
            <button
              type="button"
              className="secondary-button"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          }
        />

        {loading && !data ? (
          <div className="feature-card" role="status" aria-busy="true">
            Carregando dados da transmissão…
          </div>
        ) : null}
        {error ? (
          <div className="feature-card operations-error">{error}</div>
        ) : null}
        {data ? (
          <>
            <section
              className="operations-flags"
              aria-label="Status dos módulos da live"
            >
              <div
                className={`operations-flag ${data.overlayConnected ? 'ok' : 'off'}`}
              >
                <span />
                <div>
                  <strong>Conexão com OBS</strong>
                  <small>
                    {data.overlayConnected
                      ? 'Conectado e recebendo heartbeat'
                      : 'Aguardando conexão do OBS'}
                  </small>
                </div>
              </div>
              <div
                className={`operations-flag ${data.flags.paymentsEnabled ? 'ok' : 'off'}`}
              >
                <span />
                <div>
                  <strong>Pix na live</strong>
                  <small>
                    {data.flags.paymentsEnabled ? 'Ativo' : 'Pausado'}
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
                    <small>{enabled ? 'Ativo no canal' : 'Desativado'}</small>
                  </div>
                </div>
              ))}
            </section>

            {/* OBS & Overlay Performance */}
            <section className="feature-card psp-health">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Transmissão</span>
                  <h2>Status do OBS e Alertas</h2>
                </div>
                <strong
                  style={{
                    color: data.overlayConnected
                      ? 'var(--accent)'
                      : 'var(--muted)',
                  }}
                >
                  {data.overlayConnected ? '● Online' : '○ Offline'}
                </strong>
              </div>
              <p
                style={{
                  margin: '8px 0 16px',
                  color: 'var(--muted)',
                  fontSize: '13px',
                }}
              >
                {data.lastHeartbeatAt
                  ? `Último heartbeat recebido em ${new Date(data.lastHeartbeatAt).toLocaleTimeString('pt-BR')} do overlay do OBS.`
                  : 'Nenhum heartbeat recebido recentemente. Adicione a Browser Source no OBS Studio.'}
              </p>
              <dl className="psp-health-grid">
                <div>
                  <dt>Latência OBS (P95)</dt>
                  <dd>{duration(data.p95OverlayDeliveryMs)}</dd>
                </div>
                <div>
                  <dt>Meta de entrega</dt>
                  <dd>
                    {data.slo.alertStartMet
                      ? `OK (meta < ${duration(data.slo.alertStartTargetMs)})`
                      : 'Atenção na rede'}
                  </dd>
                </div>
                <div>
                  <dt>Pagamento → Tela (P95)</dt>
                  <dd>{duration(data.p95AlertStartMs)}</dd>
                </div>
                <div>
                  <dt>Taxa de sucesso</dt>
                  <dd>{playbackSuccessRate}%</dd>
                </div>
              </dl>
            </section>

            {/* Metrics Grid focused on channel */}
            <section
              className="operations-grid"
              aria-label="Indicadores do canal"
            >
              <article className="feature-card">
                <small>Intenções de Pix</small>
                <strong>{data.paymentIntents}</strong>
                <span>{data.confirmedPayments} pagamentos confirmados</span>
              </article>
              <article className="feature-card">
                <small>Conversão do checkout</small>
                <strong>{data.conversionPercent}%</strong>
                <span>intenções que viraram pagamento</span>
              </article>
              <article className="feature-card">
                <small>Confirmação do Pix</small>
                <strong>{duration(data.averageConfirmationMs)}</strong>
                <span>média (P95: {duration(data.p95ConfirmationMs)})</span>
              </article>
              <article className="feature-card">
                <small>Velocidade do Pix (SLO)</small>
                <strong>
                  {data.slo.paymentConfirmationMet ? 'Excelente' : 'Atenção'}
                </strong>
                <span>
                  95% em até {duration(data.slo.paymentConfirmationTargetMs)}
                </span>
              </article>
              <article className="feature-card">
                <small>Alertas reproduzidos</small>
                <strong>{data.playbackTotal}</strong>
                <span>
                  {data.playbackFailures} falhas de mídia (
                  {data.playbackFailurePercent}%)
                </span>
              </article>
              <article className="feature-card">
                <small>Fila de transmissão</small>
                <strong>{data.pendingOutbox}</strong>
                <span>alertas aguardando exibição</span>
              </article>
              <article className="feature-card">
                <small>Conciliação</small>
                <strong>{data.reconciliation.healthy ? 'OK' : 'Alerta'}</strong>
                <span>
                  {data.reconciliation.divergences} divergências na carteira
                </span>
              </article>
              <article className="feature-card">
                <small>Webhooks de integração</small>
                <strong>{data.failedWebhooks}</strong>
                <span>falhas de entrega em 24h</span>
              </article>
            </section>

            {/* Operator reference */}
            <section className="feature-card operations-note">
              <span className="section-kicker">Operador da plataforma</span>
              <h2>Infraestrutura de servidores</h2>
              <p>
                Informações de servidores (PostgreSQL, Redis), backups e gateway
                financeiro pertencem à operação global da plataforma e estão
                disponíveis na área administrativa de Infraestrutura.
              </p>
              <div style={{ marginTop: '12px' }}>
                <Link
                  className="secondary-button button-link"
                  href="/plataforma#sistema"
                >
                  Acessar infraestrutura do sistema →
                </Link>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </PanelShell>
  );
}
