# Beta fechada — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o StreamOS elegível para uma beta fechada de criadores convidados, com jornadas verificadas e bloqueadores documentados ou corrigidos.

**Architecture:** A beta bloqueia cadastros não convidados na API e no formulário, mantendo autenticação e organizações existentes. A revisão usa os testes E2E e Playwright já existentes como evidência, acrescentando cobertura apenas para estados ainda não comprovados.

**Tech Stack:** Next.js 15, NestJS 11, Prisma/PostgreSQL, Redis, Socket.IO, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-05-beta-readiness-design.md`

## Global Constraints

- Beta fechada exige convite único, vinculado ao e-mail e auditado.
- Não habilitar saque real, `PAYOUTS_ENABLED` ou provedor financeiro sem homologação.
- Um menu, página ou fluxo por ciclo; teste direcionado e commit próprio.
- Não fazer redesign geral; ajustar interface apenas para falha comprovada de compreensão, recuperação ou responsividade.
- Atualizar `docs/WORK_STATUS.md` ao encerrar cada ciclo.

## Review Focus

- Convite usado, revogado ou com e-mail diferente não pode criar conta nem consumir outro convite.
- Erro de cadastro explica como obter acesso sem revelar quais e-mails foram convidados.
- Criador que abandona onboarding recebe próximo passo explícito ao voltar ao painel.
- Contribuição confirmada aparece uma única vez na carteira, fila e rastreamento após refresh ou reconexão.
- Página pública explica indisponibilidade e pagamento não confirmado sem expor dados internos.

---

### Task 1: Inventário de prontidão e evidências

**Files:**

- Create: `docs/BETA_READINESS_AUDIT.md`
- Modify: `docs/WORK_STATUS.md`
- Test: `tests/browser/streamos.spec.ts`, `tools/e2e-*.mjs`

**Interfaces:**

- Consumes: fluxos e testes existentes.
- Produces: matriz `PRONTO | PENDENTE | BLOQUEADOR` com evidência, impacto e teste de saída por jornada.

- [ ] Executar os roteiros existentes de identidade, página pública, carteira, alertas, widgets, Central, moderação e fluxos pagos.
- [ ] Criar uma ficha para entrada/identidade, onboarding, página pública, contribuição, Vaquinha, assinatura, SongPix, VideoPix, carteira, alertas/OBS, Central, moderação, configurações e staging.
- [ ] Registrar somente evidência, estado, bloqueador e comando de saída; atualizar `WORK_STATUS.md` com bloqueadores abertos.
- [ ] Commit: `git commit -m "Audita prontidão da beta fechada"`.

### Task 2: Convites obrigatórios para beta fechada

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: migration em `packages/database/prisma/migrations/`
- Modify: `apps/api/src/identity/auth.service.ts`, `apps/api/src/identity/auth.controller.ts`
- Modify: `apps/web/app/auth-form.tsx`
- Test: `tools/e2e-accounts.mjs`, teste Playwright de cadastro

**Interfaces:**

- Consumes: `POST /auth/register`.
- Produces: `POST /auth/register` recebe `inviteCode`; cadastro sem convite retorna erro genérico; convite aceito fica indisponível.

- [ ] Escrever cenários E2E para convite ausente, válido, revogado, e-mail divergente e segunda tentativa.
- [ ] Executar `corepack pnpm test:e2e:accounts` e confirmar falha dos cenários novos.
- [ ] Adicionar `BetaInvite` com código digestado, e-mail normalizado, datas de criação/aceite/revogação e ator administrativo.
- [ ] Validar e consumir o convite atomicamente em `AuthService.register`, junto à criação da conta e organização.
- [ ] Exigir o código no formulário e exibir mensagem de acesso à beta sem enumerar convidados.
- [ ] Repetir E2E e cadastro em 360 e 1366 px; commit `Restringe cadastro à beta fechada`.

### Task 3: Onboarding orientado à primeira live

**Files:**

- Modify: `apps/web/app/onboarding/page.tsx`, `apps/web/app/page.tsx`, `apps/web/app/panel-shell.tsx`
- Test: `tests/browser/streamos.spec.ts`

**Interfaces:**

- Consumes: `GET/PUT /dashboard/onboarding`, `GET /dashboard/overlay/status` e resumo do painel.
- Produces: checklist derivado de perfil público, publicação, Browser Source e teste de alerta, com links para a ação pendente.

- [ ] Escrever cenário para criador convidado que volta antes de concluir onboarding.
- [ ] Confirmar a falha, implementar a lista derivada sem novo estado persistido e validar 360/1366 com perfis incompleto e completo.
- [ ] Commit: `Orienta ativação do criador na beta`.

### Task 4: Entrada e páginas públicas recuperáveis

**Files:**

- Modify: `apps/web/app/page.tsx`, `apps/web/app/[slug]/page.tsx`, `apps/web/app/[slug]/vaquinhas/[campaign]/page.tsx`
- Modify: `apps/web/app/[slug]/assinaturas/page.tsx`, `apps/web/app/[slug]/songpix/page.tsx`, `apps/web/app/[slug]/videopix/page.tsx`
- Test: `tests/browser/design-review.spec.ts`, `tests/browser/streamos.spec.ts`

**Interfaces:**

- Consumes: endpoints públicos existentes para criador, campanhas, planos, SongPix e VideoPix.
- Produces: estados claros para URL inexistente, conteúdo despublicado, indisponibilidade e pagamento pendente/expirado.

- [ ] Criar testes de navegador para URL pública inexistente, criador despublicado e recurso indisponível.
- [ ] Corrigir apenas estados comprovadamente inadequados usando componentes já existentes.
- [ ] Executar testes públicos em 360 e 1366 px; commit `Torna fluxos públicos recuperáveis na beta`.

### Task 5: Fechamento operacional do criador

**Files:**

- Modify: apenas arquivos comprovados em `apps/web/app/{carteira,central-da-live,widgets,alertas,moderacao,conta}/`
- Test: `tools/e2e-wallet.mjs`, `tools/e2e-alert-reliability.mjs`, `tools/e2e-live-control.mjs`, `tools/e2e-moderation.mjs`, `tools/e2e-widgets.mjs`

**Interfaces:**

- Consumes: APIs e estados existentes.
- Produces: correções limitadas a bloqueadores de entendimento, recuperação ou ação operacional.

- [ ] Executar os cinco E2Es e revisar listas vazias, extensas e com erro controlado.
- [ ] Para cada bloqueador confirmado, escrever primeiro o teste proprietário, aplicar a menor correção e repetir o teste.
- [ ] Validar desktop/mobile da tela modificada, atualizar auditoria e criar um commit por jornada.

### Task 6: Fechamento de staging da beta

**Files:**

- Modify: `.env.staging.example` ou documentação operacional existente, sem segredos
- Modify: `docs/WORK_STATUS.md`
- Test: `tools/preflight-staging.mjs`, `tools/smoke-staging.mjs`, migrations em banco limpo

**Interfaces:**

- Consumes: variáveis de ambiente e serviços externos da homologação.
- Produces: preflight e smoke executáveis, ou bloqueadores explícitos de credencial/provedor.

- [ ] Comparar variáveis exigidas pelo preflight com o exemplo de ambiente sem imprimir valores.
- [ ] Executar migration em banco limpo e registrar o resultado.
- [ ] Atualizar o exemplo de staging com nomes de variáveis, URLs e responsáveis.
- [ ] Com credenciais fornecidas, executar `corepack pnpm preflight:staging` e `corepack pnpm smoke:staging`.
- [ ] No fechamento, executar build, testes, lint, typecheck e Playwright uma única vez.
- [ ] Commit: `Prepara staging da beta fechada`.

## Self-review

- O plano cobre as seis áreas da especificação em tarefas próprias.
- Convites, ativação, pagamentos e estados públicos possuem testes de saída explícitos.
- O plano não habilita saque real nem introduz uma arquitetura nova de observabilidade.
- Correções desconhecidas dependem da auditoria, evitando implementar recursos sem evidência.
