'use client';
import { useState } from 'react';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Props = {
  campaign: {
    id: string;
    rewards: Array<{
      id: string;
      title: string;
      description: string;
      minimumInCents: number;
      availableQuantity: number | null;
    }>;
  };
};
export function CampaignDonationForm({ campaign }: Props) {
  const [amount, setAmount] = useState('10');
  const [name, setName] = useState('');
  const [rewardId, setRewardId] = useState('');
  const [charge, setCharge] = useState<{
    id: string;
    pixCopyPaste: string;
    expiresAt?: string;
  }>();
  const [message, setMessage] = useState('');
  async function contribute() {
    setMessage('');
    const r = await fetch(
      `${api}/public/campaigns/${campaign.id}/contributions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountInCents: Math.round(Number(amount.replace(',', '.')) * 100),
          supporterName: name,
          rewardId: rewardId || undefined,
        }),
      },
    ).catch(() => null);
    if (!r)
      return setMessage(
        'Não foi possível acessar o pagamento. Tente novamente.',
      );
    if (!r.ok)
      return setMessage(
        ((await r.json()) as { message?: string }).message ??
          'Não foi possível criar o Pix.',
      );
    setCharge((await r.json()) as { id: string; pixCopyPaste: string });
  }
  async function confirm() {
    if (!charge) return;
    const r = await fetch(`${api}/mock/payment-intents/${charge.id}/confirm`, {
      method: 'POST',
    }).catch(() => null);
    setMessage(
      r?.ok
        ? 'Contribuição confirmada. Obrigado!'
        : 'Não foi possível confirmar.',
    );
  }
  return (
    <section className="feature-card settings-form">
      <h2>Contribuir</h2>
      {charge ? (
        <>
          <code>{charge.pixCopyPaste}</code>
          {charge.expiresAt ? (
            <small>
              Este Pix expira em{' '}
              {new Date(charge.expiresAt).toLocaleString('pt-BR')}.
            </small>
          ) : null}
          <button onClick={() => void confirm()}>
            Simular pagamento aprovado (local)
          </button>
        </>
      ) : (
        <>
          <label>
            Valor em reais
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label>
            Seu nome
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Recompensa
            <select
              value={rewardId}
              onChange={(e) => setRewardId(e.target.value)}
            >
              <option value="">Sem recompensa</option>
              {campaign.rewards
                .filter((r) => r.availableQuantity !== 0)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} — mínimo R$ {(r.minimumInCents / 100).toFixed(2)}
                  </option>
                ))}
            </select>
          </label>
          <button onClick={() => void contribute()}>Gerar Pix</button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      <small>
        Contribuições confirmadas são finais. Taxa StreamOS e processamento Pix
        são descontados antes do saldo do criador.
      </small>
    </section>
  );
}
