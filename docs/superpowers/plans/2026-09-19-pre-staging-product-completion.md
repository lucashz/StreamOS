# StreamOS Pre-Staging Product Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar integridade financeira, concorrência, backlog, erros e validações necessárias para levar o núcleo do StreamOS à revisão de staging.

**Architecture:** PostgreSQL continua como fonte de verdade, Worker como único materializador/seletor da fila e Gateway como transporte e reconciliador. As mudanças reforçam invariantes existentes, acrescentam política visual de backlog e validam o produto sem introduzir subsistemas concorrentes.

**Tech Stack:** NestJS, TypeScript, Prisma/PostgreSQL, Redis Streams, Socket.IO, Next.js/React, Vitest, Playwright, agent-browser, Docker Compose e pnpm.

**Spec:** `docs/superpowers/specs/2026-09-19-pre-staging-product-completion-design.md`

## Global Constraints

- Preservar funções, regras financeiras, mensagens da API e nomes técnicos existentes.
- Não adicionar observabilidade externa, novos provedores ou redesign geral.
- Alertas pagos nunca expiram enquanto o OBS estiver offline.
- Um pagamento repetido produz exatamente um efeito financeiro e um item de fila.
- Cada tarefa termina em teste dirigido e commit próprio.
- Validação visual: 360, 768, 1366 e 1920 px no fechamento.

## Review Focus

- Confirmação concorrente e repetida deve manter uma única contabilização — Task 2 adiciona contagens persistentes.
- `P2002` de sequência não pode ser confundido com idempotência de origem — Task 1 adiciona teste dirigido.
- Worker/Gateway reiniciados não podem deixar processos órfãos — Task 1 valida a árvore de processos.
- Backlog offline de uma organização não pode bloquear outra — Task 3 adiciona cenário multi-organização.
- Conteúdo longo e mensagens de erro não podem causar overflow mobile — Tasks 4 e 5 validam com navegador.

---

### Task 1: Concorrência idempotente e reinício local

**Files:**
- Modify: `apps/worker/src/outbox.worker.ts`
- Modify: `apps/worker/src/live-queue.policy.spec.ts`
- Modify: `tools/restart-local-service.ps1`
- Modify: `tools/e2e-alert-reliability.mjs`

**Interfaces:**
- Consumes: unique key `organizationId_sourceType_sourceId` and persistent Outbox events.
- Produces: materialization that returns existing queue item only for the expected source collision.

- [ ] Add a failing unit/integration test that simulates concurrent materialization and asserts one queue item.
- [ ] Add a failing test that simulates another `P2002` target and asserts the error is rethrown.
- [ ] Narrow the catch by inspecting `error.meta.target`, then verify both tests pass.
- [ ] Make restart tooling terminate descendants recursively and verify one Worker/Gateway remains after repeated restarts.
- [ ] Run Worker unit tests and reliability E2E, then commit.

### Task 2: Invariantes dos cinco fluxos pagos

**Files:**
- Modify: `tools/e2e-vertical.mjs`
- Modify: `tools/e2e-campaigns.mjs`
- Modify: `tools/e2e-subscriptions.mjs`
- Modify: `tools/e2e-songpix.mjs`
- Modify: `tools/e2e-videopix.mjs`
- Create: `tools/assert-payment-invariants.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: payment ID, organization ID and source identifiers emitted by each E2E.
- Produces: `assertPaymentInvariants({ paymentId, organizationId, expectedQueueKind })` that fails unless Payment, receivable/ledger effect and LiveQueueItem counts equal one.

- [ ] Write the shared assertion helper and make one E2E fail before duplicate confirmation handling is exercised.
- [ ] Update every simulator to complete `sync-state`, await ordered playback receipts and repeat confirmation/webhook.
- [ ] Query the database through Prisma and assert one Payment, one receivable/financial effect and one LiveQueueItem.
- [ ] Run each E2E independently and together; fix only product defects revealed by the assertions.
- [ ] Update `docs/WORK_STATUS.md` with exact evidence and commit.

### Task 3: Política e isolamento de backlog

**Files:**
- Create: `apps/web/app/central-da-live/backlog-policy.ts`
- Create: `apps/web/app/central-da-live/backlog-policy.spec.ts`
- Modify: `apps/web/app/central-da-live/live-control-client.tsx`
- Modify: `apps/web/app/styles.css`
- Modify: `tools/load-paid-alerts.mjs`

**Interfaces:**
- Produces: `backlogState(items): { estimatedSeconds: number; level: 'normal' | 'warning'; reason?: string }` using thresholds 900 seconds or 100 pending items.

- [ ] Write tests for empty, media-long, 15-minute and 100-item queues.
- [ ] Implement the pure policy and render a warning with preserved-payment copy and existing queue actions.
- [ ] Extend load test with congested offline org A and online org B; assert B continues receiving.
- [ ] Validate Central da Live at 360 and 1366 px and commit.

### Task 4: Estados de erro nas jornadas críticas

**Files:**
- Modify only the existing page/components responsible for public checkout, Carteira, Central da Live, SongPix and VideoPix.
- Add targeted component/browser assertions in `tests/browser/streamos.spec.ts`.

**Interfaces:**
- Consumes existing API status/error payloads.
- Produces user-facing state containing cause, financial consequence and next action.

- [ ] Inventory the exact existing errors and write failing browser assertions for expired/refused checkout, unavailable media, disconnected OBS, review and disabled payout.
- [ ] Implement concise copy using existing alert/banner components.
- [ ] Verify long names/messages and retry actions at 360 and 1366 px.
- [ ] Run targeted browser tests and commit.

### Task 5: Fechamento visual com conteúdo real

**Files:**
- Modify: `tests/browser/design-review.spec.ts`
- Modify CSS/components only where screenshots reveal a regression.

**Interfaces:**
- Consumes stable flows from Tasks 1–4.
- Produces screenshots and overflow assertions for all critical pages and states.

- [ ] Create deterministic data for long queue, `NEEDS_REVIEW`, five checkouts and wallet histories.
- [ ] Run Vercel `agent-browser` through `npx agent-browser` for interactive inspection.
- [ ] Run Playwright at 360, 768, 1366 and 1920 px.
- [ ] Fix only observed alignment, spacing, truncation and responsive regressions.
- [ ] Commit screenshots/test changes and product fixes.

### Task 6: Fechamento técnico e staging gate

**Files:**
- Modify: `docs/WORK_STATUS.md`
- Modify: `docs/ALERT_QUEUE_AUDIT.md`
- Modify installation/operation documentation only where commands are stale.

**Interfaces:**
- Consumes all prior task commits.
- Produces a reproducible go/no-go report with commands, results, limitations and rollback notes.

- [ ] Run migrations against a clean temporary PostgreSQL database and verify seed/startup.
- [ ] Run format check, typecheck, lint, unit tests and monorepo build.
- [ ] Run directed E2Es, load/resilience tests, `preflight:staging` and backup verification.
- [ ] Run `check:woovi:sandbox` only when credentials exist; otherwise record payouts disabled as a staging limitation.
- [ ] Update status/audit docs, request final code review, fix blocking findings and commit.
