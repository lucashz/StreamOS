# StreamOS: fechamento do produto antes de staging

## Objetivo

Entregar o núcleo do StreamOS pronto para validação de staging: cada pagamento confirmado produz exatamente um efeito financeiro e um item de fila, alertas pagos permanecem operáveis sob concorrência e falhas, o backlog não prejudica outras organizações, e as jornadas críticas comunicam erros e estados com clareza em desktop e mobile.

## Entendimento aprovado

O produto atende criadores e moderadores durante transmissões ao vivo. O risco principal é financeiro e operacional: cobrar sem criar o alerta, criar duas vezes, reproduzir em duplicidade ou deixar uma fila congestionada afetar outros canais. O fechamento preserva NestJS, Prisma/PostgreSQL, Redis Streams, Socket.IO, React/Next.js, Vitest, Playwright e os componentes visuais atuais.

O usuário autorizou que dúvidas sejam resolvidas por evidência do repositório e dos concorrentes, que este plano seja aprovado autonomamente e executado sem novas perguntas.

## Referências competitivas

LivePix e PixGG convergem em checkout público curto, Browser Source copiável e testável, separação de saldo pendente/disponível, taxas visíveis antes do saque, widgets de meta, fila operacional de mídia e ações rápidas de pausa, repetição, avanço e bloqueio. O StreamOS já possui esses fundamentos. A prioridade é torná-los consistentes e comprováveis, em vez de copiar novas categorias.

Referências oficiais consultadas em 19/09/2026:

- LivePix: `https://livepix.gg/`, `https://livepix.gg/paraseucanal/mensagens`, `https://livepix.gg/paraseucanal/vaquinhas`, `https://livepix.gg/paraseucanal/assinaturas`, `https://livepix.gg/taxas`, `https://docs.livepix.gg/api`.
- PixGG: `https://www.pixgg.com/`, `https://beta.pixgg.com/` e assets públicos do aplicativo ligados às páginas de alertas, metas, SongPix, carteira e moderação.

## Escopo

### 1. Integridade dos fluxos pagos

Contribuição, vaquinha, assinatura, SongPix e VideoPix devem provar a mesma invariável: repetir confirmação ou webhook não cria outro `Payment`, recebível, lançamento contábil ou `LiveQueueItem`. A restrição de origem da fila continua como última defesa, enquanto o worker trata apenas a colisão idempotente esperada. Colisões de sequência e outras violações continuam visíveis como erro.

### 2. Concorrência e processos locais

Dois workers podem disputar o mesmo evento sem duplicar efeitos nem bloquear a publicação. Reiniciar Worker ou Gateway deve encerrar toda a árvore do processo anterior. Os testes E2E devem executar o handshake de sincronização usado pelo Browser Source real.

### 3. Backlog isolado por organização

Uma organização offline ou congestionada não pode ocupar a janela de seleção de outra. A Central da Live mostra quantidade, duração estimada e aviso operacional quando a espera estimada atingir 15 minutos ou houver 100 itens pendentes. O aviso orienta pausar, reorganizar ou limpar pendentes; não cancela pagamentos nem descarta alertas automaticamente.

### 4. Erros compreensíveis

Checkout expirado ou recusado, mídia indisponível, OBS desconectado, alerta em revisão e saque desativado devem informar o que ocorreu, se o dinheiro foi preservado e qual ação está disponível. Mensagens da API e regras financeiras permanecem intactas; a interface traduz o estado sem esconder dados técnicos relevantes.

### 5. Fechamento visual e técnico

Validar os cinco checkouts, Central da Live, Carteira e estados de erro em 360, 768, 1366 e 1920 px. Usar `agent-browser` da Vercel via execução isolada e manter Playwright como suíte reproduzível. Executar migrações em banco limpo, build, typecheck, lint, testes, preflight e backup. Saques permanecem explicitamente desabilitados se não houver credenciais sandbox válidas.

## Fora do escopo

- PixAthon, metas colaborativas por pontos, criptomoedas, campanhas beneficentes e novas integrações Twitch/Kick/Discord/Telegram.
- Novo redesign geral ou troca do design system.
- OpenTelemetry, Prometheus, Grafana ou outro sistema externo de observabilidade.
- Produção ou staging sem revisão humana final das limitações financeiras.

## Arquitetura e dados

PostgreSQL permanece a fonte de verdade. `Payment`, razão financeira, recebível e Outbox são gravados transacionalmente; `LiveQueueItem` é materializado idempotentemente pelo worker; `PlaybackAttempt` representa reprodução; Redis transporta e coordena, sem substituir o banco. O worker é o único seletor do próximo item e o Gateway apenas entrega, reconcilia e persiste recibos.

## Tratamento de falhas

- Confirmação repetida retorna o resultado existente.
- Corrida na materialização aceita somente colisão na chave `(organizationId, sourceType, sourceId)` quando o registro já existe.
- Falha antes de `RECEIVED` reenvia a mesma tentativa.
- Falha depois de `STARTED` entra em `NEEDS_REVIEW`.
- OBS offline mantém alerta pago em `QUEUED`.
- Backlog grande gera aviso, sem expiração ou descarte implícito.

## Critérios de aceite

1. Os cinco fluxos pagos passam e comprovam contagens financeiras e de fila iguais a um após repetição.
2. Dois workers não produzem duplicidade e erros de constraints não relacionadas não são absorvidos.
3. VideoPix e SongPix percorrem fila, entrega e recibos com Browser Source unificado.
4. Organização congestionada não aumenta materialmente a latência de outra organização online.
5. Estados de erro e backlog não causam overflow nas quatro larguras.
6. Build, typecheck, lint, unitários, E2Es dirigidos, migração limpa, preflight e backup terminam com resultado registrado.

## Decisões autônomas

Este documento e o plano correspondente são considerados aprovados pela autorização explícita do usuário para esclarecer dúvidas, aprovar o plano e executar sem novas perguntas. A implementação deve parar apenas diante de credencial externa ausente ou operação irreversível não autorizada.
