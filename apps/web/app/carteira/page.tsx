'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PanelShell } from '../panel-shell';
import { PageHeader } from '../ui';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(value) ? Number(value) / 100 : 0,
  );
const payoutLabels: Record<string, string> = {
  PENDING: 'Solicitado',
  PROCESSING: 'Em processamento',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
  CANCELED: 'Cancelado',
  CANCELLED: 'Cancelado',
};
const entryLabels: Record<string, string> = {
  payment_confirmed: 'Contribuição confirmada',
  funds_available: 'Saldo disponibilizado',
  payout_completed: 'Saque concluído',
};
const accountLabels: Record<string, string> = {
  creator_pending: 'Saldo pendente',
  creator_available: 'Saldo disponível',
  creator_payout: 'Saldo em saque',
  platform_revenue: 'Receita StreamOS',
  provider_fee: 'Taxa de processamento',
  clearing: 'Compensação',
};
const receivableLabels: Record<string, string> = {
  AVAILABLE: 'Disponível',
  PENDING: 'Pendente',
  BLOCKED: 'Bloqueado',
};

type Posting = {
  account: string;
  code: string;
  direction: string;
  amountInCents: number;
};
type Entry = {
  id: string;
  type: string;
  description: string | null;
  occurredAt: string;
  postings: Posting[];
};
type Payout = {
  id: string;
  amountInCents: number;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  destinationMasked: string | null;
};
type Wallet = {
  balances: {
    pendingInCents: number;
    availableInCents: number;
    blockedInCents: number;
    inPayoutInCents: number;
    totalReceivedInCents: number;
  };
  payouts: Payout[];
};
type Settings = {
  legalName: string | null;
  taxIdMasked: string | null;
  financialTermsAcceptedAt: string | null;
  legalProfileCompleted: boolean;
  pixKeyType: string | null;
  pixKeyMasked: string | null;
  pixKeyVerifiedAt: string | null;
  minimumPayoutInCents: number;
  dailyPayoutLimitInCents: number;
  monthlyPayoutLimitInCents: number;
  providerSubaccountConfigured: boolean;
  providerSubaccountStatus: string;
  providerWithdrawBlocked: boolean;
  providerSyncedAt: string | null;
};
type Receivable = {
  id: string;
  supporterName: string | null;
  grossInCents: number;
  platformFeeInCents: number;
  providerFeeInCents: number;
  totalFeeInCents: number;
  netInCents: number;
  status: string;
  confirmedAt: string;
  expectedAvailabilityAt: string;
};

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet>();
  const [settings, setSettings] = useState<Settings>();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [amount, setAmount] = useState('');
  const [pixType, setPixType] = useState('EMAIL');
  const [pixValue, setPixValue] = useState('');
  const [entryType, setEntryType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('Carregando carteira…');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (entryType) params.set('type', entryType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [entryType, from, to]);

  async function load() {
    const [walletResponse, settingsResponse, receivablesResponse] =
      await Promise.all([
        fetch(`${api}/dashboard/wallet`, { credentials: 'include' }),
        fetch(`${api}/dashboard/wallet/settings`, { credentials: 'include' }),
        fetch(`${api}/dashboard/wallet/receivables`, {
          credentials: 'include',
        }),
      ]);
    if (!walletResponse.ok) {
      setStatus('Entre na sua conta para acessar a carteira.');
      return;
    }
    setWallet((await walletResponse.json()) as Wallet);
    if (settingsResponse.ok)
      setSettings((await settingsResponse.json()) as Settings);
    if (receivablesResponse.ok)
      setReceivables((await receivablesResponse.json()) as Receivable[]);
    setStatus('');
  }

  async function loadStatement() {
    const response = await fetch(
      `${api}/dashboard/wallet/statement${query ? `?${query}` : ''}`,
      { credentials: 'include' },
    );
    if (response.ok) setEntries((await response.json()) as Entry[]);
  }

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    void loadStatement();
  }, [query]);

  async function savePixKey() {
    const response = await fetch(`${api}/dashboard/wallet/pix-key`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: pixType, value: pixValue }),
    });
    const body = (await response.json()) as Settings & { message?: string };
    setStatus(
      response.ok
        ? 'Chave Pix validada e carteira de recebimentos configurada.'
        : (body.message ?? 'Não foi possível cadastrar a chave.'),
    );
    if (response.ok) {
      setSettings(body);
      setPixValue('');
    }
  }

  async function requestPayout() {
    const amountInCents = Math.round(Number(amount.replace(',', '.')) * 100);
    const response = await fetch(`${api}/dashboard/payouts`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify({ amountInCents }),
    });
    const body = (await response.json()) as { message?: string };
    setStatus(
      response.ok
        ? 'Saque solicitado e registrado no extrato.'
        : (body.message ?? 'Não foi possível solicitar o saque.'),
    );
    if (response.ok) {
      setAmount('');
      await Promise.all([load(), loadStatement()]);
    }
  }

  const exportUrl = `${api}/dashboard/wallet/statement.csv${query ? `?${query}` : ''}`;
  const requestedInCents = Math.max(
    0,
    Math.round(Number(amount.replace(',', '.')) * 100) || 0,
  );
  const payoutFeeInCents =
    requestedInCents > 0 && requestedInCents < 50_000 ? 100 : 0;

  return (
    <PanelShell>
      <main className="feature-page wallet-page">
        <Link href="/" className="back-link">
          ← Visão geral
        </Link>
        <PageHeader
          eyebrow="Financeiro"
          title="Carteira operacional"
          description="Consulte saldos, recebíveis, saques e lançamentos registrados no ledger do StreamOS."
        />

        {wallet ? (
          <>
            <section className="feature-metrics">
              <article>
                <span>Pendente</span>
                <strong>{money(wallet.balances.pendingInCents)}</strong>
              </article>
              <article>
                <span>Disponível</span>
                <strong>{money(wallet.balances.availableInCents)}</strong>
              </article>
              <article>
                <span>Em saque</span>
                <strong>{money(wallet.balances.inPayoutInCents)}</strong>
              </article>
              <article>
                <span>Total recebido</span>
                <strong>{money(wallet.balances.totalReceivedInCents)}</strong>
              </article>
            </section>

            <div className="wallet-grid" id="limites">
              <section className="feature-card settings-form wallet-settings-card">
                <h2>Destino Pix</h2>
                {settings && !settings.legalProfileCompleted ? (
                  <div className="wallet-prerequisite" role="alert">
                    <strong>Dados financeiros pendentes</strong>
                    <p>
                      Informe o nome legal e o CPF ou CNPJ, depois aceite os
                      termos financeiros para criar a subconta.
                    </p>
                    <Link
                      className="secondary-button button-link"
                      href="/onboarding"
                    >
                      Completar cadastro
                    </Link>
                  </div>
                ) : null}
                <div className="wallet-card-overview">
                  {settings?.pixKeyMasked ? (
                    <>
                      <p>
                        Chave atual: <strong>{settings.pixKeyMasked}</strong>{' '}
                        <small>({settings.pixKeyType})</small>
                      </p>
                      <span
                        className={`status-pill${settings.providerWithdrawBlocked ? ' danger' : ''}`}
                      >
                        {settings.providerWithdrawBlocked
                          ? 'Saque bloqueado — atualize sua chave Pix'
                          : settings.providerSubaccountConfigured
                            ? 'Carteira verificada'
                            : 'Carteira sandbox'}
                      </span>
                    </>
                  ) : (
                    <p>Cadastre uma chave Pix antes do primeiro recebimento.</p>
                  )}
                </div>
                <label>
                  Tipo
                  <select
                    value={pixType}
                    onChange={(event) => setPixType(event.target.value)}
                  >
                    <option value="EMAIL">E-mail</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="PHONE">Telefone</option>
                    <option value="RANDOM">Aleatória</option>
                  </select>
                </label>
                <label>
                  Nova chave
                  <input
                    value={pixValue}
                    onChange={(event) => setPixValue(event.target.value)}
                    placeholder="Sua chave Pix de mesma titularidade"
                  />
                </label>
                <button
                  disabled={!pixValue || !settings?.legalProfileCompleted}
                  onClick={() => void savePixKey()}
                >
                  Validar e criar carteira
                </button>
              </section>

              <section className="feature-card settings-form wallet-settings-card">
                <h2>Solicitar saque</h2>
                <div className="limit-list">
                  <span>
                    Mínimo{' '}
                    <strong>
                      {money(settings?.minimumPayoutInCents ?? 1000)}
                    </strong>
                  </span>
                  <span>
                    Limite diário{' '}
                    <strong>
                      {money(settings?.dailyPayoutLimitInCents ?? 100000)}
                    </strong>
                  </span>
                  <span>
                    Limite mensal{' '}
                    <strong>
                      {money(settings?.monthlyPayoutLimitInCents ?? 1000000)}
                    </strong>
                  </span>
                </div>
                <label>
                  Valor em reais
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </label>
                {requestedInCents > 0 ? (
                  <div className="payout-summary" aria-live="polite">
                    <span>
                      Saque solicitado{' '}
                      <strong>{money(requestedInCents)}</strong>
                    </span>
                    <span>
                      Tarifa coberta pela StreamOS{' '}
                      <strong>{money(payoutFeeInCents)}</strong>
                    </span>
                    <span>
                      Você receberá <strong>{money(requestedInCents)}</strong>
                    </span>
                  </div>
                ) : null}
                <button
                  disabled={!amount || !settings?.pixKeyMasked}
                  onClick={() => void requestPayout()}
                >
                  Sacar
                </button>
              </section>
            </div>

            <details
              className="feature-card wallet-history-menu"
              id="recebiveis"
              name="wallet-history"
              open
            >
              <summary>
                <div>
                  <span className="section-kicker">Próximos créditos</span>
                  <h2>Agenda de recebíveis</h2>
                  <small>
                    {receivables.length}{' '}
                    {receivables.length === 1 ? 'recebível' : 'recebíveis'} ·{' '}
                    {money(
                      receivables.reduce(
                        (total, item) => total + item.netInCents,
                        0,
                      ),
                    )}{' '}
                    líquidos
                  </small>
                </div>
                <span className="wallet-menu-action" aria-hidden="true">
                  <span className="wallet-menu-action-closed">
                    Ver detalhes
                  </span>
                  <span className="wallet-menu-action-open">Recolher</span>
                  <i className="wallet-menu-chevron">
                    <svg viewBox="0 0 16 16" focusable="false">
                      <path d="m4 6 4 4 4-4" />
                    </svg>
                  </i>
                </span>
              </summary>
              <div className="wallet-menu-content">
                <div className="wallet-list-heading" aria-hidden="true">
                  <span>Apoiador</span>
                  <span>Disponibilidade</span>
                  <span>Valores</span>
                </div>
                <div className="data-list wallet-history-list">
                  {receivables.length ? (
                    receivables.map((item) => (
                      <article key={item.id}>
                        <div className="wallet-history-identity">
                          <strong>{item.supporterName ?? 'Apoiador'}</strong>
                          <small>
                            Confirmado em{' '}
                            {new Date(item.confirmedAt).toLocaleDateString(
                              'pt-BR',
                            )}
                          </small>
                        </div>
                        <div className="wallet-history-status">
                          <span
                            className={`status-pill${item.status === 'AVAILABLE' ? ' success' : ''}`}
                          >
                            {receivableLabels[item.status] ?? item.status}
                          </span>
                          <small>
                            {item.status === 'AVAILABLE'
                              ? 'Disponibilizado para saque'
                              : `Previsto para ${new Date(item.expectedAvailabilityAt).toLocaleDateString('pt-BR')}`}
                          </small>
                        </div>
                        <div className="wallet-value-breakdown">
                          <strong>{money(item.netInCents)}</strong>
                          <small>
                            Bruto {money(item.grossInCents)} · Taxas −{' '}
                            {money(item.totalFeeInCents)}
                          </small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="wallet-history-empty">
                      <strong>Nenhum recebível agendado</strong>
                      <span>
                        Cada contribuição confirmada aparecerá aqui com sua data
                        de disponibilidade.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </details>

            <section
              className="feature-card wallet-payout-history"
              id="historico"
            >
              <div className="wallet-section-heading">
                <div>
                  <span className="section-kicker">Transferências</span>
                  <h2>Histórico de saques</h2>
                </div>
                <span>
                  {wallet.payouts.length}{' '}
                  {wallet.payouts.length === 1 ? 'saque' : 'saques'}
                </span>
              </div>
              <div className="data-list wallet-payout-list">
                {wallet.payouts.length ? (
                  wallet.payouts.map((payout) => (
                    <article key={payout.id}>
                      <div className="wallet-history-identity">
                        <strong>Solicitação de saque</strong>
                        <small>
                          {new Date(payout.requestedAt).toLocaleString('pt-BR')}
                        </small>
                      </div>
                      <div className="wallet-payout-destination">
                        <small>Destino</small>
                        <strong>
                          {payout.destinationMasked ?? 'Destino não informado'}
                        </strong>
                      </div>
                      <div className="wallet-payout-value">
                        <strong>{money(payout.amountInCents)}</strong>
                        <span
                          className={`status-pill${payout.status === 'COMPLETED' ? ' success' : payout.status === 'FAILED' ? ' danger' : ''}`}
                        >
                          {payoutLabels[payout.status] ?? payout.status}
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="wallet-history-empty">
                    <strong>Nenhum saque realizado</strong>
                    <span>
                      Quando você solicitar um saque, o destino e o estado
                      aparecerão aqui.
                    </span>
                  </div>
                )}
              </div>
            </section>

            <details
              className="feature-card wallet-history-menu"
              id="extrato"
              name="wallet-history"
            >
              <summary>
                <div>
                  <span className="section-kicker">Movimentações</span>
                  <h2>Extrato</h2>
                  <small>
                    {entries.length}{' '}
                    {entries.length === 1 ? 'lançamento' : 'lançamentos'} nos
                    filtros atuais
                  </small>
                </div>
                <span className="wallet-menu-action" aria-hidden="true">
                  <span className="wallet-menu-action-closed">Ver extrato</span>
                  <span className="wallet-menu-action-open">Recolher</span>
                  <i className="wallet-menu-chevron">
                    <svg viewBox="0 0 16 16" focusable="false">
                      <path d="m4 6 4 4 4-4" />
                    </svg>
                  </i>
                </span>
              </summary>
              <div className="wallet-menu-content">
                <div className="statement-toolbar">
                  <div>
                    <strong>Filtrar movimentações</strong>
                    <small>Escolha o tipo de lançamento e o período.</small>
                  </div>
                  <a className="secondary-button" href={exportUrl}>
                    Exportar CSV
                  </a>
                </div>
                <div className="statement-filters">
                  <select
                    aria-label="Tipo de movimentação"
                    value={entryType}
                    onChange={(event) => setEntryType(event.target.value)}
                  >
                    <option value="">Todos os tipos</option>
                    <option value="payment_confirmed">Contribuições</option>
                    <option value="funds_available">Disponibilizações</option>
                    <option value="payout_completed">Saques</option>
                  </select>
                  <input
                    aria-label="Data inicial"
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                  <input
                    aria-label="Data final"
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </div>
                <div className="data-list wallet-statement-list">
                  {entries.length ? (
                    entries.map((entry) => (
                      <article key={entry.id}>
                        <div className="wallet-history-identity">
                          <strong>
                            {entry.description ??
                              entryLabels[entry.type] ??
                              entry.type}
                          </strong>
                          <small>
                            {new Date(entry.occurredAt).toLocaleString('pt-BR')}
                          </small>
                        </div>
                        <div className="posting-summary">
                          {entry.postings.map((posting, index) => (
                            <span
                              className={
                                posting.direction === 'CREDIT'
                                  ? 'posting-credit'
                                  : 'posting-debit'
                              }
                              key={`${posting.code}-${index}`}
                            >
                              <b>
                                {posting.direction === 'CREDIT' ? '+' : '−'}{' '}
                                {money(posting.amountInCents)}
                              </b>
                              <small>
                                {accountLabels[posting.account] ??
                                  posting.account}
                              </small>
                            </span>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="wallet-history-empty">
                      <strong>Nenhuma movimentação encontrada</strong>
                      <span>
                        Altere os filtros para consultar outro período.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </details>
          </>
        ) : null}
        {status ? (
          <p className="account-status" role="status">
            {status}
          </p>
        ) : null}
      </main>
    </PanelShell>
  );
}
