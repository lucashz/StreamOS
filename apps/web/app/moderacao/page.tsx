'use client';
import { useEffect, useState } from 'react';
import { PanelShell } from '../panel-shell';
import { replaceZeroMoneyValue, selectZeroMoneyValue } from '../money-input';
import { PageHeader } from '../ui';
import { voiceProfiles, previewTtsVoice } from '../voice-profiles';
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
type Item = {
  id: string;
  supporterName: string | null;
  content: string;
  amountInCents: number | null;
  status: string;
  decisionReason: string | null;
  sourceType: string;
};
type Overview = {
  items: Item[];
  flaggedItems: Array<{
    id: string;
    supporterName: string | null;
    title: string | null;
    content: string | null;
    kind: string;
    status: string;
    amountInCents: number | null;
    createdAt: string;
  }>;
  policies: Array<{ id: string; name: string; blockedWords: string[] }>;
  tts: {
    enabled: boolean;
    voice: string;
    minimumInCents: number;
    maximumCharacters: number;
    paused: boolean;
  } | null;
  moderationEnabled: boolean;
};
export default function ModerationPage() {
  const [data, setData] = useState<Overview>();
  const [status, setStatus] = useState('Carregando…');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState({
    moderationEnabled: true,
    ttsEnabled: true,
    voice: 'voice-silvio',
    minimumInCents: 500,
    maximumCharacters: 200,
    paused: false,
  });
  const [words, setWords] = useState('spam, golpe');
  async function load() {
    const r = await fetch(`${api}/dashboard/moderation`, {
      credentials: 'include',
    });
    if (!r.ok) return setStatus('Entre na conta para moderar.');
    const value = (await r.json()) as Overview;
    setData(value);
    if (value.tts)
      setSettings({
        moderationEnabled: value.moderationEnabled,
        ttsEnabled: value.tts.enabled,
        voice: value.tts.voice,
        minimumInCents: value.tts.minimumInCents,
        maximumCharacters: value.tts.maximumCharacters,
        paused: value.tts.paused,
      });
    setStatus('');
  }
  useEffect(() => {
    void load();
  }, []);
  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus('Salvando configurações…');
    try {
      const r = await fetch(`${api}/dashboard/moderation/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const body = (await r.json().catch(() => ({}))) as { message?: string };
      if (!r.ok) throw new Error(body.message ?? 'Não foi possível salvar.');
      await load();
      setStatus('Configurações salvas.');
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function policy() {
    const blockedWords = words
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!blockedWords.length) {
      setStatus('Informe ao menos uma palavra bloqueada.');
      return;
    }
    if (busy) return;
    setBusy(true);
    setStatus('Adicionando política…');
    try {
      const r = await fetch(`${api}/dashboard/moderation/policies`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Política principal',
          blockedWords,
          blockLinks: true,
          minimumInCents: 100,
        }),
      });
      if (!r.ok) throw new Error('Não foi possível criar a política.');
      await load();
      setStatus('Política criada.');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : 'Não foi possível criar a política.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function clearFlag(itemId: string) {
    const response = await fetch(`${api}/dashboard/live-control/commands`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'UNFLAG',
        itemId,
        reason: 'Revisado na central de moderação',
        idempotencyKey: crypto.randomUUID(),
        origin: 'MODERATION_PANEL',
      }),
    });
    if (response.ok) {
      await load();
      setStatus('Sinalização removida.');
    } else setStatus('Não foi possível concluir a revisão.');
  }
  return (
    <PanelShell>
      <main className="feature-page moderation-page">
        <PageHeader
          eyebrow="Comunidade"
          title="Moderação e TTS"
          description="As regras analisam o conteúdo automaticamente antes da cobrança, sem interromper sua live."
        />
        <p className="feature-note">
          Bloquear conteúdo impede sua reprodução, mas não devolve a
          contribuição.
        </p>
        {status ? (
          <p className="settings-feedback" role="status">
            {status}
          </p>
        ) : null}
        <section id="tts" className="panel" style={{ padding: 24 }}>
          <h2>Configuração</h2>
          <label className="consent-field">
            <input
              type="checkbox"
              checked={settings.moderationEnabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  moderationEnabled: e.target.checked,
                })
              }
            />{' '}
            Filtro automático de mensagens
          </label>
          <label className="consent-field">
            <input
              type="checkbox"
              checked={settings.ttsEnabled}
              onChange={(e) =>
                setSettings({ ...settings, ttsEnabled: e.target.checked })
              }
            />{' '}
            TTS ativado
          </label>
          <label className="consent-field">
            <input
              type="checkbox"
              checked={settings.paused}
              onChange={(e) =>
                setSettings({ ...settings, paused: e.target.checked })
              }
            />{' '}
            TTS pausado
          </label>
          <label>
            Voz padrão do canal
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                minWidth: 0,
                width: '100%',
                flexWrap: 'wrap',
              }}
            >
              <select
                style={{ flex: '1 1 180px', minWidth: 0 }}
                value={settings.voice}
                onChange={(e) =>
                  setSettings({ ...settings, voice: e.target.value })
                }
              >
                <optgroup label="📺 Apresentadores & TV">
                  {voiceProfiles
                    .filter((v) => v.category === 'tv')
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.avatar} {profile.name} — {profile.analogy}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="🎙️ Ícones & Esporte">
                  {voiceProfiles
                    .filter((v) => v.category === 'personalities')
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.avatar} {profile.name} — {profile.analogy}
                      </option>
                    ))}
                </optgroup>
              </select>
              <button
                type="button"
                className="secondary-button"
                style={{
                  whiteSpace: 'nowrap',
                  padding: '0 12px',
                  minHeight: '38px',
                  flexShrink: 0,
                }}
                onClick={() => previewTtsVoice(settings.voice)}
                title="Ouvir demonstração desta voz"
              >
                🔊 Ouvir
              </button>
            </div>
          </label>
          <label>
            Valor mínimo TTS
            <span className="money-input">
              <b>R$</b>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                aria-label="Valor mínimo do TTS em reais"
                value={settings.minimumInCents / 100}
                onFocus={selectZeroMoneyValue}
                onKeyDown={replaceZeroMoneyValue}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minimumInCents: Math.round(Number(e.target.value) * 100),
                  })
                }
              />
            </span>
            <small className="money-field-help">
              Abaixo deste valor, a mensagem não será lida.
            </small>
          </label>
          <label>
            Máximo de caracteres
            <input
              type="number"
              min="1"
              max="500"
              value={settings.maximumCharacters}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maximumCharacters: Number(e.target.value),
                })
              }
            />
          </label>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </section>
        <section
          id="bloqueios"
          className="panel"
          style={{ padding: 24, marginTop: 20 }}
        >
          <h2>Políticas</h2>
          <label>
            Palavras bloqueadas
            <input value={words} onChange={(e) => setWords(e.target.value)} />
          </label>
          <button disabled={busy} onClick={() => void policy()}>
            Adicionar política
          </button>
          {data?.policies.map((p) => (
            <p key={p.id}>
              <strong>{p.name}:</strong> {p.blockedWords.join(', ')}
            </p>
          ))}
        </section>
        <section className="panel" style={{ padding: 24, marginTop: 20 }}>
          <h2>Sinalizados durante a live</h2>
          <p>
            Estes itens já seguiram a fila automática e ficam aqui somente para
            revisão posterior.
          </p>
          {!data?.flaggedItems.length ? <p>Nenhum item sinalizado.</p> : null}
          <div className="moderation-review-list">
            {data?.flaggedItems.map((item) => (
              <article className="moderation-review-row" key={item.id}>
                <div>
                  <small>
                    {new Date(item.createdAt).toLocaleString('pt-BR')} ·{' '}
                    {item.kind} · {item.status}
                  </small>
                  <strong>{item.supporterName ?? 'Anônimo'}</strong>
                  <span>{item.title ?? item.content ?? 'Incentivo'}</span>
                </div>
                <div>
                  <strong>
                    {((item.amountInCents ?? 0) / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </strong>
                  <button onClick={() => void clearFlag(item.id)}>
                    Marcar como revisado
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="panel" style={{ padding: 24, marginTop: 20 }}>
          <h2>Histórico automático</h2>
          {!data?.items.length ? (
            <p>Nenhuma decisão de moderação registrada.</p>
          ) : null}
          {data?.items.map((item) => (
            <div
              key={item.id}
              style={{
                borderTop: '1px solid #333',
                padding: '14px 0',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <span>
                <strong>{item.supporterName ?? 'Anônimo'}</strong> ·{' '}
                {item.sourceType} · {item.status}
                <br />
                {item.content}
                {item.decisionReason ? (
                  <>
                    <br />
                    <small>{item.decisionReason}</small>
                  </>
                ) : null}
              </span>
            </div>
          ))}
        </section>
      </main>
    </PanelShell>
  );
}
