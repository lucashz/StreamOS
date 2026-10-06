# Beta Validation and Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revalidate the beta journeys affected by mandatory invitations, close the remaining activation and public-state checks, and leave staging ready for execution once its external inputs exist.

**Architecture:** Preserve mandatory invitations in product code and use the existing test-only invitation fixture for automated E2Es. Validate invitation rules directly through the API and a reproducible manual browser flow, without adding Playwright coverage for invitations. Run focused local checks first; keep staging secrets outside Git and treat missing domains, vault and real credentials as external blockers.

**Tech Stack:** Node.js, Prisma/PostgreSQL, Next.js, NestJS, Docker Compose, Playwright only for existing non-invitation E2Es.

**Spec:** `docs/superpowers/specs/2026-10-05-beta-readiness-design.md`

## Global Constraints

- Do not bypass or weaken invitation validation in application code.
- Validate invitations through API requests and a manual browser flow, not Playwright.
- Correct onboarding or public pages only when a route or message is demonstrably wrong.
- Do not commit `.env.staging`, domains or credentials.
- Keep `PAYOUTS_ENABLED=false` locally and in staging.
- Record only fresh evidence and real blockers in `docs/BETA_READINESS_AUDIT.md` and `docs/WORK_STATUS.md`.

## Review Focus

- An invitation can register only its exact e-mail and only once.
- Successful registration creates a usable authenticated session.
- Onboarding distinguishes incomplete profile, private page, configured Browser Source without OBS, and connected OBS.
- Missing/private creators, closed campaigns, unavailable media products and pending/expired Pix show the correct safe message.
- Load and resilience coverage remains representative after invitation creation moved into test setup.

---

### Task 1: Revalidate the E2Es affected by invitations

**Files:**
- Inspect: `tools/lib/e2e-invites.mjs`
- Run: existing E2E, load and resilience scripts
- Modify only if a reproduced test defect requires it: `tools/*.mjs`

**Interfaces:**
- Consumes: test-only `BetaInvite` creation before `POST /auth/register`.
- Produces: fresh pass/fail evidence for alerts, campaigns, subscriptions, SongPix, VideoPix, platform and alert reliability; a decision on extra invitation coverage in load/resilience.

- [ ] Run `test:e2e:alerts`, `test:e2e:campaigns`, `test:e2e:subscriptions`, `test:e2e:songpix`, `test:e2e:videopix`, `test:e2e:platform` and `test:e2e:alert-reliability`.
- [ ] Inspect `load-paid-alerts.mjs`, `load-beta.mjs` and `resilience-beta.mjs` for invitation setup and execute their directed commands.
- [ ] Add an invitation scenario to load or resilience only if the inspection or a failure proves a coverage gap.
- [ ] Update `docs/WORK_STATUS.md` with commands, results, limitations and the next cycle.
- [ ] Commit the cycle if any tracked file changes.

### Task 2: Validate invitation rules through API and manual flow

**Files:**
- Create if useful: a focused reusable API validation script under `tools/`
- Modify only if a failing check proves a product defect: `apps/api/src/identity/*`, `apps/web/app/auth-form.tsx`
- Update: `docs/WORK_STATUS.md`

**Interfaces:**
- Consumes: `POST /auth/register`, `GET /auth/me`, administrative local invitation creation.
- Produces: evidence for invalid code, divergent e-mail, code reuse and post-registration session.

- [ ] Exercise an invalid code and assert rejection without account creation.
- [ ] Exercise an invitation with a different e-mail and assert rejection without consuming the invitation.
- [ ] Register with the correct e-mail, verify the session cookie and confirm `GET /auth/me` succeeds.
- [ ] Reuse the accepted code with another registration attempt and assert rejection.
- [ ] Repeat the successful path manually in the browser and record the observed redirect/session state; do not add Playwright.
- [ ] Update `docs/WORK_STATUS.md` and commit the cycle if tracked files changed.

### Task 3: Validate the four real onboarding states

**Files:**
- Inspect: `apps/web/app/onboarding/page.tsx`, dashboard and overlay-status API routes.
- Modify only if route or message is wrong: the owning onboarding/API file.
- Update: `docs/WORK_STATUS.md`

**Interfaces:**
- Consumes: onboarding profile state and Browser Source configuration/connection state.
- Produces: evidence for incomplete profile, private page, Browser Source without OBS and connected OBS.

- [ ] Create or reset controlled data for each state through existing APIs/database fixtures.
- [ ] Inspect each state at 1366 px and 360 px and compare the action, route and message with the real backend state.
- [ ] If a defect is found, write a focused failing test, apply the minimal correction and rerun the focused validation.
- [ ] Update `docs/WORK_STATUS.md` and commit the cycle if tracked files changed.

### Task 4: Validate public failure and payment states

**Files:**
- Inspect: `apps/web/app/[slug]/**` and owning public API services.
- Modify only if a reproduced route/message defect exists.
- Update: `docs/WORK_STATUS.md`

**Interfaces:**
- Consumes: controlled creator, campaign, SongPix, VideoPix and payment records.
- Produces: evidence for missing/private creator, closed campaign, unavailable SongPix/VideoPix and pending/expired Pix.

- [ ] Validate missing and private creators at their public URLs.
- [ ] Validate a closed campaign URL.
- [ ] Validate unavailable SongPix and VideoPix routes.
- [ ] Validate pending and expired Pix status/return routes.
- [ ] Inspect the affected public states at 1366 px and 360 px; correct only proven route/message defects.
- [ ] Update `docs/WORK_STATUS.md` and commit the cycle if tracked files changed.

### Task 5: Close the operational audit

**Files:**
- Modify: `docs/BETA_READINESS_AUDIT.md`
- Modify: `docs/WORK_STATUS.md`

**Interfaces:**
- Consumes: fresh evidence from Tasks 1–4.
- Produces: the current readiness matrix and explicit blocker list.

- [ ] Replace stale evidence with the exact commands/results collected in this run.
- [ ] Classify every listed journey as `PRONTO`, `PENDENTE` or `BLOQUEADOR EXTERNO` without extrapolating from unrelated tests.
- [ ] Keep staging blocked until domains, secret vault and real provider credentials exist.
- [ ] Commit the audit cycle.

### Task 6: Execute the staging gate when external inputs exist

**Files:**
- Create locally, ignored by Git: `.env.staging`
- Modify only if a proven configuration gap exists: `.env.staging.example`, `tools/preflight-staging.mjs`, `tools/smoke-staging.mjs`

**Interfaces:**
- Consumes: final domains, vault-provided secrets, real provider credentials and a clean staging database.
- Produces: clean migration, passing staging preflight and smoke evidence.

- [ ] Confirm `.env.staging` is ignored, populate it outside Git and verify `PAYOUTS_ENABLED=false`.
- [ ] Run migrations against the clean staging database.
- [ ] Run `node tools/preflight-staging.mjs .env.staging` with the environment values available to the deploy workflow.
- [ ] Run `smoke:staging` against the final public URLs.
- [ ] If any external input is absent, do not fabricate it; record the exact blocker and stop this task at the gate.
- [ ] Update both audit documents and commit only tracked documentation/configuration changes.

## Self-review

- The remaining E2Es named by the user are covered explicitly in Task 1.
- Invitation validation is API plus manual browser flow and contains no Playwright work.
- All four onboarding states and all seven public/payment states have an owning task.
- Load and resilience receive an explicit coverage decision rather than an assumed pass.
- Staging actions are executable only with real external inputs, keep secrets outside Git and retain `PAYOUTS_ENABLED=false`.
