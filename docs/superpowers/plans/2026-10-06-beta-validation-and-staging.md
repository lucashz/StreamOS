# Beta Validation and Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the beta-closed validation suite executable again, validate affected creator and public flows, and prepare a safe staging gate.

**Architecture:** Keep invitation enforcement in the product. Centralize creation of test-only `BetaInvite` records in a tool helper, then migrate each E2E script and browser fixture to it. Validation uses existing local services; staging remains external and secret-free in Git.

**Tech Stack:** Node.js, Prisma/PostgreSQL, Playwright, Next.js, NestJS, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-05-beta-readiness-design.md`

## Global Constraints

- Do not bypass or weaken invite validation in application code.
- Do not enable `PAYOUTS_ENABLED`.
- Do not commit `.env.staging` or real credentials.
- Correct only failures reproduced by a directed test.

## Review Focus

- An invitation can only register its exact e-mail once.
- Browser API registration must transfer the session to page navigation.
- An OBS-disconnected creator must see the Browser Source action.
- Public failure states must offer a safe next action without exposing private data.
- Staging commands must reject placeholder secrets and example domains.

### Task 1: Shared invitation fixture for automation

**Files:**
- Create: `tools/lib/e2e-invites.mjs`
- Modify: every `tools/e2e-*.mjs`, `tools/load-*.mjs`, `tools/resilience-*.mjs`, `tools/audit-ui.mjs`, `tests/browser/streamos.spec.ts`

- [ ] Create `createBetaInvite(email)` using `PrismaClient`, SHA-256 and `BetaInvite`.
- [ ] Replace direct registrations with a helper that adds a generated invite code.
- [ ] Run each directed E2E and fix only failures after registration.
- [ ] Commit: `Atualiza automações para beta fechada`.

### Task 2: Invitation and onboarding browser validation

**Files:**
- Modify: `tests/browser/streamos.spec.ts`
- Modify only if a failing test proves a product defect: `apps/web/app/auth-form.tsx`, `apps/web/app/onboarding/page.tsx`

- [ ] Add browser scenarios for invalid code, divergent e-mail, reused code and post-registration session.
- [ ] Add desktop/mobile onboarding cases for incomplete profile, unpublished page, disconnected and connected OBS.
- [ ] Run focused Playwright projects at 360 and 1366 px.
- [ ] Commit: `Valida convite e ativação da beta`.

### Task 3: Public and creator operational validation

**Files:**
- Modify only when reproduced: public pages and their existing E2E scripts.

- [ ] Validate missing/private creator, closed campaign, unavailable SongPix/VideoPix, pending and expired Pix.
- [ ] Run wallet, live-control, widgets, alerts and moderation with empty, long and failed states.
- [ ] Record remaining reproduced blockers in `docs/BETA_READINESS_AUDIT.md`.
- [ ] Commit: `Valida jornadas públicas e operação do criador`.

### Task 4: Technical gate and staging handoff

**Files:**
- Modify: `docs/BETA_READINESS_AUDIT.md`, `docs/WORK_STATUS.md`, `.env.staging.example` only if a gap is found.

- [ ] Run `typecheck`, `lint`, `build`, directed E2Es and full Playwright once.
- [ ] With externally provisioned domains/secrets, create ignored `.env.staging`, migrate a clean database, then run preflight and smoke.
- [ ] Record missing external credentials as an explicit blocker; retain `PAYOUTS_ENABLED=false`.
- [ ] Commit: `Fecha validação técnica da beta`.

## Self-review

- Task 1 restores every automated journey without weakening beta access control.
- Task 2 covers all invitation and activation states named in the request.
- Task 3 covers public and creator operation states.
- Task 4 separates local verification from external staging credentials.
