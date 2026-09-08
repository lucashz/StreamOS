'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PanelShell } from '../panel-shell';

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
        <header>
          <span className="section-kicker">Financeiro</span>
          <h1>Carteira operacional</h1>
          <p>Saldo, recebíveis e saques explicados pelo ledger do StreamOS.</p>
        </header>

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
              <section className="feature-card settings-form">
                <h2>Destino Pix</h2>
                {settings && !settings.legalProfileCompleted ? (
                  <div className="wallet-prerequisite" role="alert">
                    <strong>Conclua seus dados financeiros</strong>
                    <p>
                      Antes de criar a subconta, informe o nome legal, CPF ou
                      CNPJ e aceite os termos financeiros.
                    </p>
                    <Link
                      className="secondary-button button-link"
                      href="/onboarding"
                    >
                      Completar cadastro
                    </Link>
                  </div>
                ) : null}
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

              <section className="feature-card settings-form">
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

            <section className="feature-card" id="recebiveis">
              <h2>Agenda de recebíveis</h2>
              <div className="data-list">
                {receivables.length ? (
                  receivables.map((item) => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.supporterName ?? 'Apoiador'}</strong>
                        <small>
                          {item.status === 'AVAILABLE'
                            ? 'Disponibilizado'
                            : `Previsto para ${new Date(item.expectedAvailabilityAt).toLocaleDateString('pt-BR')}`}
                        </small>
                      </div>
                      <div className="posting-summary">
                        <span>Bruto {money(item.grossInCents)}</span>
                        <span>
                          StreamOS (5%) − {money(item.platformFeeInCents)}
                        </span>
                        <span>
                          Processamento Pix − {money(item.providerFeeInCents)}
                        </span>
                        <strong>Líquido {money(item.netInCents)}</strong>
                      </div>
                    </article>
                  ))
                ) : (
                  <p>Nenhum recebível encontrado.</p>
                )}
              </div>
            </section>

            <section className="feature-card" id="historico">
              <h2>Histórico de saques</h2>
              <div className="data-list">
                {wallet.payouts.length ? (
                  wallet.payouts.map((payout) => (
                    <article key={payout.id}>
                      <div>
                        <strong>{money(payout.amountInCents)}</strong>
                        <small>
                          {new Date(payout.requestedAt).toLocaleString('pt-BR')}{' '}
                          ·{' '}
                          {payout.destinationMasked ?? 'Destino não informado'}
                        </small>
                      </div>
                      <span className="status-pill">
                        {payoutLabels[payout.status] ?? payout.status}
                      </span>
                    </article>
                  ))
                ) : (
                  <p>Nenhum saque realizado.</p>
                )}
              </div>
            </section>

            <section className="feature-card">
              <div className="section-heading-row">
                <h2>Extrato</h2>
                <a className="secondary-button" href={exportUrl}>
                  Exportar CSV
                </a>
              </div>
              <div className="statement-filters">
                <select
                  value={entryType}
                  onChange={(event) => setEntryType(event.target.value)}
                >
                  <option value="">Todos os tipos</option>
                  <option value="payment_confirmed">Contribuições</option>
                  <option value="funds_available">Disponibilizações</option>
                  <option value="payout_completed">Saques</option>
                </select>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
              <div className="data-list">
                {entries.map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <strong>{entry.description ?? entry.type}</strong>
                      <small>
                        {new Date(entry.occurredAt).toLocaleString('pt-BR')}
                      </small>
                    </div>
                    <div className="posting-summary">
                      {entry.postings.map((posting, index) => (
                        <span key={`${posting.code}-${index}`}>
                          {posting.direction === 'CREDIT' ? '+' : '−'}{' '}
                          {money(posting.amountInCents)} · {posting.account}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
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
