# StreamOS — Plano de implementação local

> Este é o painel mestre de execução. O catálogo completo do produto permanece em [`docs/product/FEATURE_ROADMAP_V2.md`](docs/product/FEATURE_ROADMAP_V2.md), enquanto [`ROADMAP.md`](ROADMAP.md) preserva a visão estratégica e comercial.

## Painel de execução — fonte de verdade

Atualizado em 8 de setembro de 2026. Itens riscados preservam as validações locais registradas anteriormente; itens parcialmente concluídos permanecem abertos. A revisão atual confirmou 100 testes unitários, lint, typecheck e health checks locais. Build, E2E, staging e áudio físico no OBS não foram revalidados nesta revisão.

### Ciclos concluídos

- [x] ~~Ciclo 0 — monorepo, aplicações, pacotes compartilhados e infraestrutura local.~~
- [x] ~~Ciclo 1 — cadastro, login, recuperação de senha, sessões, perfil e onboarding sem 2FA.~~
- [x] ~~Ciclo 2 — página pública, contribuição Pix mock, webhook, recibo e idempotência.~~
- [x] ~~Ciclo 3 — ledger de dupla entrada, outbox, saldos, carteira, extrato e saque mock.~~
- [x] ~~Ciclo 4 — alertas realtime, ACK/replay, overlay e plataforma inicial de widgets.~~
- [x] ~~Ciclo 5 — SongPix temático e VideoPix com validação anterior à cobrança.~~
- [x] ~~Ciclo 6 — central de moderação, políticas, aprovação humana, TTS mock, auditoria e E2E.~~

### Regra financeira implementada

- [x] ~~Taxa StreamOS de 5% calculada em centavos inteiros.~~
- [x] ~~Tarifa Woovi modelada como 0,80%, com mínimo de R$ 0,50 e máximo de R$ 5,00 — sem somar R$ 0,50 ao percentual.~~
- [x] ~~Persistência separada de valor bruto, taxa StreamOS, tarifa do provedor e líquido do streamer.~~
- [x] ~~Lançamentos separados no ledger para receita da plataforma, tarifa Pix e saldo do criador.~~
- [x] ~~Carteira e agenda de recebíveis exibindo as duas tarifas separadamente.~~
- [x] ~~Migration `20260816300000_payment_fee_breakdown` criada e aplicada localmente.~~
- [x] ~~Testes de divisão para R$ 1, R$ 10, R$ 20, transição do mínimo e teto da tarifa.~~
- [ ] Obter proposta comercial para microtransações e confirmar a tarifa contratual real.
- [ ] Homologar o adaptador Woovi já implementado e ativá-lo somente após contrato e testes sandbox.
- [ ] Integrar KYC/KYB, Pix real, webhook real, liquidação, Pix Out e conciliação de extrato.

### Ciclo 7 — vaquinhas e recompensas (concluído localmente)

- [x] ~~Migration e modelos `FundraisingCampaign`, `CampaignContribution`, `CampaignReward` e `RewardClaim`.~~
- [x] ~~Serviço de domínio e API com isolamento por organização.~~
- [x] ~~CRUD do criador: meta, prazo, descrição, imagem, publicação e estados.~~
- [x] ~~Página pública da vaquinha.~~
- [x] ~~Vincular contribuição ao objetivo usando o mesmo pagamento e ledger, sem saldo paralelo.~~
- [x] ~~Limite de quantidade, elegibilidade e reserva de recompensa antes da cobrança.~~
- [x] ~~Histórico de resgate, entrega e auditoria.~~
- [x] ~~Painel do criador.~~
- [x] ~~Widget de progresso para OBS e eventos realtime.~~
- [x] ~~Testes financeiros, autorização, concorrência e E2E.~~

### Ciclo 8 — planos e assinaturas mock (concluído localmente)

- [x] ~~Modelos e migration de planos, benefícios, assinaturas e renovações.~~
- [x] ~~CRUD, publicação e página pública dos planos.~~
- [x] ~~Assinatura inicial e primeira renovação simuladas localmente.~~
- [x] ~~Cancelamento ao fim do período e histórico persistido.~~
- [x] ~~Benefícios vinculados ao plano.~~
- [x] ~~Evento de nova assinatura e widget para OBS.~~
- [x] ~~Testes de isolamento, renovação, cancelamento e E2E.~~
- [ ] Recorrência real somente depois da escolha do parceiro financeiro.

### Ciclo 9 — equipes, API e integrações (concluído localmente)

- [x] ~~Papéis: proprietário, administrador, moderador, financeiro e leitura.~~
- [x] ~~Matriz de permissões aplicada aos domínios administrativos.~~
- [x] ~~Convites, aceite, expiração, remoção e edição de papel.~~
- [x] ~~Tokens de API com escopos, expiração, revogação e rotação.~~
- [x] ~~Webhooks com assinatura HMAC, retry, desativação e histórico.~~
- [x] ~~Integrações mock com Twitch, YouTube e Discord.~~
- [x] ~~Auditoria e testes de autorização entre organizações.~~

### Ciclo 10 — parceiro financeiro e preparação do beta (bloqueado por contrato)

- [ ] Escolher PSP/BaaS adequado a contribuições a partir de R$ 1.
- [ ] Confirmar que não existe tarifa mínima incompatível com microtransações.
- [ ] Homologar contratos, callbacks e estados em sandbox.
- [ ] Testar dinheiro real com limites baixos e conciliação diária.
- [ ] Revisão jurídica, tributária, regulatória e da política de contribuições finais.
- [ ] Observabilidade, backups, restauração, rate limits e runbooks do beta.

### Próxima execução

O próximo bloco é concluir o **Ciclo 12 — staging**. A configuração de produção, imagens Docker, proxy HTTPS, deploy, smoke test e rotinas de backup já foram validados localmente. Falta provisionar o ambiente real, configurar domínio e segredos e executar o primeiro deploy com restauração validada.

### Novos ciclos de implantação

#### Ciclo 11 — fechamento funcional e regressão

- [x] ~~Encerrar os itens restantes dos ciclos 7, 8 e 9.~~
- [x] ~~E2E para vaquinha, assinatura, equipe, token e webhook.~~
- [x] ~~Testes de concorrência para recompensas e renovações.~~
- [x] ~~Matriz RBAC, guards e testes de autorização por papel.~~
- [x] ~~Documentação OpenAPI servida pela API em `/docs`.~~

#### Ciclo 15 — experiência final do streamer (concluído em automação local; áudio físico do OBS pendente)

- [x] ~~Central da Live com fila, reprodução atual, histórico e controles.~~
- [x] ~~Fila automática para texto, áudio, SongPix e VideoPix, sem aprovação manual.~~
- [x] ~~Fontes independentes de Alertas, SongPix e VideoPix, transparentes quando ociosas e responsivas à Browser Source.~~
- [x] ~~Editor de alertas com variações, templates, mídia, som, TTS e prévia do OBS.~~
- [x] ~~Aparência global persistente, herdada por novos alertas e aplicável às variações existentes.~~
- [x] ~~Rate limits, heartbeat do OBS, métricas e controles operacionais.~~
- [x] ~~Regressão integrada de transmissão com PostgreSQL e Redis ativos.~~
- [x] ~~Inicializador local transacional com Docker, PIDs, logs e health checks de API, realtime, web e overlay.~~
- [ ] Confirmar saída, pausa e reinício do áudio no mixer de uma instalação real do OBS.

#### Ciclo 16 — revisão de interface anterior ao staging

- [x] ~~Criar roteiro reproduzível para revisão menu por menu e box por box.~~
- [x] ~~Percorrer 25 destinos em 360, 768, 1366 e 1920 px, com 100 combinações registradas.~~
- [x] ~~Corrigir âncoras de TTS, bloqueios e recompensas e remover o item redundante Conexões.~~
- [x] ~~Reexecutar regressão funcional de contas, carteira, moderação, widgets, mídia, campanhas, assinaturas, plataforma, fila e alertas.~~
- [ ] Repetir a inspeção com uma organização antiga e conteúdo longo para validar estados densos.
- [ ] Fazer uma rodada assistida com usuário externo para avaliar compreensão e ordem das ações.
- [ ] Concluir a validação física de áudio e microfone em navegador e OBS reais.

#### Ciclo 12 — ambiente de staging

- [x] ~~Imagens de produção validadas para web, API, worker, realtime e overlay, executadas por usuário não privilegiado.~~
- [x] ~~Compose de staging com proxy HTTPS, health checks e serviços internos sem portas públicas.~~
- [x] ~~Pipeline CI/CD preparado com migration controlada, deploy e smoke test.~~
- [ ] PostgreSQL e Redis gerenciados, armazenamento de segredos e domínio de staging.
- [x] ~~Logs HTTP estruturados, correlação por trace/request ID, métricas protegidas e rotação de logs dos containers.~~
- [ ] Conectar logs, métricas, tracing e error tracking a fornecedores gerenciados e configurar alertas.
- [x] ~~Scripts de backup, integridade e ensaio de restauração preparados para Linux.~~
- [ ] Agendar os backups e executar o primeiro ensaio de restauração no ambiente real.

#### Ciclo 13 — homologação financeira

- [ ] Adaptador sandbox do PSP escolhido e testes de contrato.
- [ ] KYC/KYB, Pix real, webhook assinado, liquidação, Pix Out e conciliação.
- [ ] Validar tarifa para microtransações de R$ 1 a R$ 20.
- [ ] Fechamento contábil diário e tratamento de MED/incidentes compulsórios.
- [ ] Homologação jurídica, tributária, segurança e privacidade.

#### Ciclo 14 — beta fechado

- [x] ~~Feature flags, limites financeiros e kill switches.~~
- [ ] Piloto com 10 a 20 criadores e suporte assistido.
- [x] ~~Instrumentação do SLO de pagamento até overlay, dashboards de conversão e unidade econômica.~~
- [x] ~~Scripts locais de carga, abuso, indisponibilidade do PSP e reconexão do OBS.~~
- [x] ~~Gate automatizado baseado em conciliação, margem, entrega ao OBS, backup e incidentes.~~
- [ ] Executar os cenários no staging e registrar os resultados do piloto real.

## 0. Resumo executivo — atualizado em 8 de setembro de 2026

### Onde estamos

O ambiente local e a primeira plataforma funcional já existem. A fundação técnica, os cinco ciclos do backlog imediato e suas migrations foram implementados.

| Bloco                    | Estado                        | Entrega disponível                                                                   |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------ |
| Fundação local           | Concluído                     | Monorepo, PostgreSQL, Redis, Mailpit, API, worker, realtime, web e overlay           |
| Contas                   | Concluído                     | Cadastro, login, recuperação, perfil, sessões e autorização por organização, sem 2FA |
| Onboarding e checkout    | Concluído                     | Página pública, Pix mock, confirmação, recibo e consentimentos                       |
| Ledger e carteira        | Concluído                     | Taxas, saldos, recebíveis, extrato/CSV, chave Pix mock, limites e saques simulados   |
| Alertas e widgets        | Concluído                     | Tokens individuais, ACK/replay, alerta, QR Code, meta, ranking e últimos apoios      |
| SongPix                  | Concluído                     | Sessões temáticas, validação pré-pagamento, fila, moderação e widget                 |
| VideoPix                 | Concluído                     | Metadados mock, preço por segundo, revisão pré-pagamento, fila e player isolado      |
| Parceiro financeiro real | Bloqueado por decisão externa | O produto continua usando adaptadores mock locais                                    |

### Regra financeira vigente

As contribuições confirmadas não possuem fluxo comum de reembolso. SongPix e VideoPix validam regras determinísticas e moderação preventiva automática antes de liberar o pagamento; a fila toca sem aprovação manual durante a live. Conteúdo indisponível depois da confirmação é registrado e interrompido, sem desfazer automaticamente a contribuição.

### Próxima sequência de execução

1. [Concluído] Base inicial registrada no Git, com ambientes, backups, uploads, caches e perfis locais do OBS excluídos.
2. Confirmar saída sonora, pausa e reinício no mixer de uma instalação real do OBS (Ciclo 15).
3. Concluir staging (Ciclo 12): infraestrutura, domínio, segredos, deploy, observabilidade, backup agendado e restauração comprovada.
4. Homologar o parceiro financeiro (Ciclo 13), incluindo contrato, tarifas, sandbox e conciliação.
5. Repetir regressão e cenários de carga/resiliência em staging antes do piloto com 10 a 20 criadores (Ciclo 14).

Os ciclos 6 a 9 já foram implementados localmente. Vozes neurais de terceiros, recorrência financeira real e integrações externas definitivas permanecem separadas dos fluxos locais simulados.

### Critério para avançar entre ciclos

Cada ciclo precisa entregar migration, domínio/API, telas, realtime/overlay quando aplicável, auditoria, isolamento por organização, E2E próprio e regressão dos ciclos anteriores. Nenhuma integração com dinheiro real será tratada como concluída usando apenas o provedor mock.

Este plano transforma o roadmap do produto em uma sequência executável no ambiente local. O objetivo inicial não é construir todas as telas: é provar a arquitetura com uma jornada vertical e evoluí-la sem descartar código.

## 1. Estado atual do ambiente

Verificado em 8 de setembro de 2026:

- PostgreSQL, Redis, Mailpit, API, worker, realtime, web e overlay ativos.
- Readiness da API e liveness de realtime, web e overlay aprovados.
- `corepack pnpm test`: 100 testes aprovados.
- `corepack pnpm lint` e `corepack pnpm typecheck`: aprovados.
- Código dos ciclos 0 a 9 e scripts de CI/CD, deploy e backup disponíveis localmente.
- Base inicial registrada no Git no commit `c480214`, sem ambientes, backups, uploads, caches ou perfis locais do OBS.

Pendente:

- Validação física do áudio no OBS.
- Staging real, observabilidade externa e ensaio de restauração nesse ambiente.
- Contrato e homologação de pagamentos, KYC/KYB e recorrência.
- Regressão integrada atual e piloto real: os registros anteriores não substituem nova execução em staging.

### Decisão de infraestrutura para staging

O checklist prevê PostgreSQL e Redis gerenciados, mas `compose.staging.yaml` configura ambos como containers internos. Antes do provisionamento, escolher e registrar uma alternativa:

- Manter containers na VPS para staging, atualizando o requisito e validando persistência, backup e recuperação.
- Usar serviços gerenciados, adaptando as conexões e dependências do Compose antes do deploy.

Nenhum ambiente externo foi provisionado nesta revisão. Até a homologação financeira, manter o fluxo de validação com pagamentos simulados.

## Referência histórica de implementação

As seções 2 a 9 preservam a sequência original de construção e os contratos iniciais. Não são o backlog atual; o painel de execução e a seção 11 definem as próximas ações.

## 2. Primeiro objetivo técnico

Construir esta fatia vertical:

```text
Criador local
  → cria perfil e página
  → apoiador simula um Pix
  → webhook mock confirma o pagamento
  → transação e lançamentos são persistidos
  → outbox publica o evento
  → gateway entrega por WebSocket
  → Browser Source exibe o alerta
  → dashboard mostra receita e saldo de teste
```

Essa fatia valida banco, eventos, filas, realtime, overlay e frontend antes da integração com dinheiro real.

## 3. Arquitetura local inicial

### Aplicações

- `apps/web`: Next.js; painel, onboarding, página pública e checkout.
- `apps/api`: NestJS; API HTTP, autenticação e domínios.
- `apps/worker`: NestJS standalone; outbox, webhooks e filas.
- `apps/realtime`: NestJS WebSocket Gateway; sessões de overlay.
- `apps/overlay`: aplicação web leve para o Browser Source do OBS.

### Pacotes compartilhados

- `packages/contracts`: schemas Zod, tipos e nomes dos eventos.
- `packages/database`: Prisma, migrations e seeds.
- `packages/ledger`: regras financeiras puras e invariantes.
- `packages/ui`: componentes e tokens visuais.
- `packages/config`: configurações compartilhadas de TypeScript, ESLint e testes.
- `packages/testing`: factories, fixtures e utilitários de teste.

### Infraestrutura local

- PostgreSQL: fonte de verdade.
- Redis: filas, cache e fan-out realtime.
- Mailpit: captura de e-mails locais.
- MinIO: adicionar somente quando upload de mídia entrar no escopo.
- BullMQ: tarefas assíncronas.
- Prisma: migrations e acesso ao PostgreSQL.
- Vitest: testes unitários e de integração.
- Playwright: jornadas E2E.

## 4. Etapas de implementação

### Etapa 0 — preparar a estação local

Entregáveis:

1. Ativar uma versão fixa do pnpm com Corepack.
2. Instalar e validar Docker Desktop/Compose.
3. Criar `.nvmrc` ou `.node-version` para fixar o Node usado pelo projeto.
4. Criar `.editorconfig`, `.gitattributes`, `.gitignore` e política de fim de linha.
5. Documentar os comandos no `README.md`.

Critério de conclusão:

- Uma pessoa consegue clonar o repositório e preparar as dependências seguindo apenas o README.

### Etapa 1 — criar o monorepo

Entregáveis:

1. Inicializar workspace pnpm.
2. Configurar Turborepo.
3. Criar `web`, `api`, `worker`, `realtime` e `overlay`.
4. Criar os pacotes compartilhados.
5. Configurar TypeScript estrito, ESLint, Prettier e Vitest.
6. Adicionar scripts raiz:
   - `pnpm dev`
   - `pnpm build`
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm test:e2e`
   - `pnpm db:migrate`
   - `pnpm db:seed`

Critério de conclusão:

- Todas as aplicações sobem juntas e passam em build, lint, typecheck e teste vazio.

### Etapa 2 — infraestrutura e configuração

Entregáveis:

1. Criar `compose.yaml` com PostgreSQL, Redis e Mailpit.
2. Adicionar healthchecks e volumes nomeados.
3. Criar `.env.example`, sem segredos reais.
4. Validar variáveis na inicialização com Zod.
5. Implementar endpoints `/health/live` e `/health/ready`.
6. Adicionar logs estruturados com correlation ID.

Portas sugeridas:

| Serviço    | Porta |
| ---------- | ----: |
| Web        |  3000 |
| API        |  3001 |
| Realtime   |  3002 |
| Overlay    |  3003 |
| PostgreSQL | 55432 |
| Redis      |  6379 |
| Mailpit UI |  8025 |

Critério de conclusão:

- `docker compose up -d` deixa todas as dependências saudáveis e `pnpm dev` inicia as aplicações.

### Etapa 3 — identidade e modelo básico

Entregáveis:

1. Criar entidades `User`, `Organization`, `Membership`, `CreatorProfile`, `Session` e `AuditLog`.
2. Implementar cadastro e login local por e-mail/senha.
3. Proteger senha com algoritmo apropriado e cookies de sessão seguros.
4. Implementar recuperação de senha via Mailpit.
5. Criar autorização por organização e papéis.
6. Criar seed de um criador e um operador de suporte.
7. Implementar onboarding simplificado com KYC marcado como `sandbox_approved`.

Fora desta etapa:

- OAuth social.
- KYC real.
- 2FA completo; a fundação deve permitir adicioná-lo antes de qualquer saque real.

Critério de conclusão:

- Um criador entra, completa o onboarding local e acessa somente os dados de sua organização.

### Etapa 4 — página pública e pagamento mock

Entregáveis:

1. Criar página pública `/c/[slug]`.
2. Criar formulário com valor, apelido, mensagem e anonimato.
3. Definir interface `PaymentProvider`.
4. Implementar `MockPaymentProvider`.
5. Criar `PaymentIntent` com valor em centavos e estado inicial.
6. Exibir QR Code fictício e ação de simular confirmação.
7. Gerar webhook mock assinado.
8. Persistir payload bruto, hash, timestamp e chave de idempotência.
9. Implementar estados `created`, `pending`, `confirmed`, `settled`, `available`, `expired` e `failed`.

Critério de conclusão:

- Duas entregas do mesmo webhook resultam em um único pagamento confirmado.

### Etapa 5 — ledger e outbox

Entregáveis:

1. Criar contas contábeis e `JournalEntry`/`Posting` imutáveis.
2. Implementar lançamentos balanceados de pagamento, taxa, reserva, disponibilidade e saque simulado.
3. Separar saldo contábil das projeções exibidas no dashboard.
4. Adicionar chave de idempotência por operação.
5. Criar tabela de outbox na mesma transação do lançamento.
6. Criar worker que publica e marca eventos processados.
7. Implementar rotina local de conciliação com o provedor mock.

Invariantes mínimas:

- Soma de débitos igual à soma de créditos em cada lançamento.
- Nenhum saldo é editado diretamente.
- Repetir um comando idempotente não cria novos lançamentos.
- Correções usam lançamentos compensatórios.

Critério de conclusão:

- Testes automatizados demonstram pagamento, taxa, disponibilidade e saque sem quebra das invariantes.

### Etapa 6 — alertas em tempo real e overlay

Entregáveis:

1. Criar token secreto e rotacionável para cada overlay.
2. Autenticar a conexão WebSocket.
3. Criar evento versionado `payment.confirmed.v1`.
4. Entregar eventos com identificador, sequência e ACK.
5. Implementar retry e retomada a partir do último ACK.
6. Criar fila visual no overlay.
7. Renderizar nome, valor e mensagem.
8. Criar controles de pausar, pular, repetir e testar.
9. Adicionar meta simples atualizada pelo mesmo fluxo de eventos.

Critério de conclusão:

- Derrubar e reabrir o overlay recupera eventos pendentes sem perder nem exibir duas vezes o mesmo alerta.

### Etapa 7 — dashboard e backoffice mínimo

Entregáveis:

1. Receita diária/mensal e ticket médio.
2. Lista de contribuições e detalhes de uma transação.
3. Saldos pendente, disponível e bloqueado.
4. Extrato derivado do ledger.
5. Configuração de página, alerta e meta.
6. Tela de suporte para buscar pagamento, webhook e lançamentos.
7. Ações auditadas de reprocessar evento e revogar overlay.

Critério de conclusão:

- Toda quantia exibida no dashboard pode ser explicada pelos lançamentos associados.

### Etapa 8 — qualidade antes da integração real

Entregáveis:

1. E2E da jornada completa com Playwright.
2. Testes de webhook duplicado, atrasado, inválido e fora de ordem.
3. Teste de reinício do worker e indisponibilidade temporária do Redis.
4. Teste de autorização entre organizações.
5. Teste de carga do webhook ao overlay.
6. Script de backup e restauração local verificado.
7. Documentação OpenAPI.
8. Threat model e checklist de segurança atualizados.

Critério de conclusão:

- A fatia vertical mock passa de forma determinística em CI e pode ser demonstrada no OBS.

### Etapa 9 — substituir o mock pelo parceiro financeiro

Somente após selecionar o parceiro:

1. Implementar um novo adaptador sem alterar os domínios de payment e ledger.
2. Adicionar testes de contrato com fixtures oficiais.
3. Integrar KYC/KYB, Pix, webhook, liquidação e saque em sandbox.
4. Mapear estados do parceiro para estados internos.
5. Implementar conciliação com extrato real.
6. Executar homologação, revisão jurídica e revisão de segurança.

Critério de conclusão:

- O mesmo E2E executado com o mock passa contra a sandbox do parceiro, com exceções explicitamente documentadas.

## 5. Ordem dos pull requests

PRs pequenos facilitam revisão e evitam misturar fundação, interface e regras financeiras:

1. `chore/bootstrap-monorepo`
2. `chore/local-infrastructure`
3. `feat/identity-and-organizations`
4. `feat/creator-profile-and-public-page`
5. `feat/mock-payment-provider`
6. `feat/payment-webhook-pipeline`
7. `feat/double-entry-ledger`
8. `feat/transactional-outbox`
9. `feat/realtime-overlay`
10. `feat/basic-goal`
11. `feat/creator-dashboard`
12. `feat/support-backoffice`
13. `test/end-to-end-payment-alert`

## 6. Modelo de dados inicial

Primeiro conjunto de tabelas:

- `users`
- `organizations`
- `memberships`
- `sessions`
- `creator_profiles`
- `compliance_profiles`
- `payment_intents`
- `payments`
- `provider_webhooks`
- `ledger_accounts`
- `journal_entries`
- `postings`
- `balance_projections`
- `payouts`
- `outbox_events`
- `overlay_channels`
- `overlay_deliveries`
- `alert_configs`
- `goals`
- `audit_logs`

O schema detalhado deve ser criado em migrations incrementais. Ledger, pagamentos e webhooks não usarão exclusão física.

## 7. Contratos iniciais

Eventos mínimos:

- `payment.created.v1`
- `payment.confirmed.v1`
- `payment.settled.v1`
- `funds.available.v1`
- `payout.requested.v1`
- `payout.completed.v1`
- `alert.queued.v1`
- `alert.acknowledged.v1`
- `goal.updated.v1`

Cada envelope deve conter:

- `eventId`
- `eventType`
- `eventVersion`
- `occurredAt`
- `aggregateId`
- `organizationId`
- `correlationId`
- `causationId`
- `payload`

## 8. Variáveis locais previstas

O `.env.example` deverá documentar, no mínimo:

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://streamos:streamos@localhost:55432/streamos
REDIS_URL=redis://localhost:6379
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
REALTIME_URL=ws://localhost:3002
OVERLAY_URL=http://localhost:3003
SESSION_SECRET=replace-with-local-secret
WEBHOOK_MOCK_SECRET=replace-with-local-secret
MAIL_HOST=localhost
MAIL_PORT=1025
PAYMENT_PROVIDER=mock
```

Valores reais ficam somente no `.env`, que será ignorado pelo Git.

## 9. Ritmo recomendado

### Semana 1

- Estação local, monorepo, Compose, CI, healthchecks e observabilidade básica.

### Semana 2

- Identidade, organizações, onboarding sandbox e perfil público.

### Semana 3

- Payment provider mock, webhook, idempotência e máquina de estados.

### Semana 4

- Ledger, outbox e conciliação mock.

### Semana 5

- WebSocket, Browser Source, fila e alerta básico.

### Semana 6

- Meta, dashboard, backoffice mínimo e primeiro E2E completo.

### Semanas 7 e 8

- Hardening, carga, segurança, backup/restauração e preparação do adaptador financeiro real.

Esse cronograma é uma referência para a fundação local. Com uma única pessoa, as etapas devem ser tratadas como sequência de marcos, sem compromisso rígido de calendário.

## 10. Definition of Done

Uma tarefa só está concluída quando:

- Código e migrations foram revisados.
- Build, lint, typecheck e testes passam.
- Autorização e isolamento por organização foram considerados.
- Logs não expõem segredo ou PII.
- Eventos externos são idempotentes.
- Mudanças financeiras preservam as invariantes do ledger.
- Documentação e `.env.example` foram atualizados.
- Há uma forma local objetiva de demonstrar o comportamento.

## 11. Próxima ação concreta

Concluir a preparação do Ciclo 12:

1. Confirmar a decisão de PostgreSQL/Redis em containers ou gerenciados e registrar os recursos do staging.
2. Configurar os quatro domínios, segredos e destino de deploy a partir de `.env.staging.example`.
3. Executar `preflight:staging`, deploy e smoke test no ambiente escolhido.
4. Conectar observabilidade, agendar backup e registrar um ensaio de restauração bem-sucedido.
5. Repetir E2E e cenários de carga/resiliência em staging; registrar separadamente a validação física do áudio no OBS.

A homologação financeira e o piloto dependem das pendências dos ciclos 13 e 14. O adaptador existente e os testes simulados não comprovam operação com dinheiro real.
