# ABACUS Sovereign Sprint Report (v4)

Branch: `agent/abacus-sovereign-sprint-v4`
Baseline commit: `07345f5` — "gates: G1 recovery test, G4 backup+restore, G6 JWT revocation, G7 AI audit trail, G9 load test, G10 monitoring"
Sprint start: 2026-07-23 (UTC)

## Environment reality

- Repo `/home/ubuntu/luca-passport`: React/Vite frontend (`src/`), Node/Express backend (`backend/`), PostgreSQL, docker compose.
- LIVE deployment: containers `luca-passport-{frontend,backend,postgres}-1` behind nginx → https://solaris-health.abacusai.cloud (healthy at sprint start; `/api/health` → `{"status":"ok","checks":{"database":"ok"}}`).
- Migrations 001–018 all applied (`migrate:status`: "No migrations to run"). Numbering skips 006 — historical, left as-is.
- Abacus LLM endpoint reachable from this VM via IMDSv2-provisioned env (`LUCA_AI_BASE_URL` / key in untracked `backend/.env`; never committed).
- Uncommitted user work found at sprint start (Economic Passport "coming soon" banner + nav change in `LucaPassport.jsx`) — preserved and committed first (`d0c4336`), not clobbered.
- No `tests/roundtrip.js` exists in the repo; export roundtrip coverage lives in `backend/tests/export.test.js`. Treating that suite as the roundtrip gate.

## Baseline test results (Slice 0, before any sprint changes)

| Check | Result |
|---|---|
| Frontend `npm test` (vitest) | 29/30 pass; 1 stale test asserted old brand text `LUCA` (UI rebranded to `SOLARIS` at 07345f5). Test updated → 30/30. |
| Frontend `npm run lint` | 15 pre-existing errors, 137 warnings (empty catch blocks, react-hooks rules). Pre-existing debt; not introduced this sprint. |
| Frontend `npm run build` | PASS (chunk-size warnings only) |
| Backend `npm test` (jest) | 57/57 pass |
| Backend `npm run lint` | 0 errors, 4 warnings |
| Backend `migrate:status` | No pending migrations |
| `node tests/tenant-isolation.test.js` (live) | 8/8 pass |
| Backend `npm run smoke-test` (live) | 10/10 pass |
| Live health | OK |

## Slice ledger

### Slice 0 — Reality audit & sprint ledger — DONE
- Preserved user's uncommitted UI work as its own commit.
- Fixed stale brand assertion in `src/__tests__/LucaPassport.test.jsx` (LUCA→SOLARIS).
- Imported sprint context into repo: `AGENTS.md`, `docs/ABACUS_MASTER_CONTEXT.md`, `docs/ABACUS_OVERNIGHT_SPRINT_PROMPT.md`, `.abacusai/skills/solaris-sovereign-sprint/SKILL.md`.
- Created this ledger.

### Slice 1 — Abacus AI provider mode — DONE
- `backend/src/lib/ai/index.js`: added `LUCA_AI_MODE=abacus` (OpenAI-compatible port, default base URL `https://routellm.abacus.ai/v1`, provider id `abacus:<model>`), AbortController timeout on every remote adapter (`LUCA_AI_TIMEOUT_MS`, default 20000ms, exported `requestTimeoutMs`), provider label passthrough for `cloud` mode. `cloud`/`anthropic`/`local`/`mock` untouched in behavior; missing key still degrades safely to mock (never throws at construction).
- `backend/.env.example`: documents abacus mode, timeout, provider label; pinned-model guidance for health-adjacent flows.
- `backend/tests/luca.test.js`: +4 provider-factory unit tests (abacus selection, key-missing degradation, local keyless, timeout parsing) — all offline, zero network.
- Evidence: backend jest 61/61 pass (was 57), lint 0 errors.
### Slice 2 — AI execution receipts — DONE
- Migration `backend/migrations/019_ai_execution_receipts.sql` (additive): `ai_execution_receipts` table — event_type, agent_id (`sol_agent_luca`), provider, requested/actual model, compute_target, data_class, consent_basis, latency_ms, input_hash/result_hash (SHA-256 only), degraded, error_class, policy_version (`v0`), created_at. `user_id UUID` FK → users (repo uses UUID PKs). Applied cleanly.
- `backend/src/lib/ai/receipts.js`: `recordAIReceipt()` (best-effort — never throws, never breaks the chat path), `sha256`, `describeProvider` (provider id → compute target: managed_cloud/local/in_process). Hashing happens inside the helper, so callers cannot accidentally persist raw text.
- Instrumented member LUCA (`luca.js` → event `luca.member.chat`, data_class `health_context`, consent `member_self_query`) and practitioner copilot (`luca-practitioner.js` → `luca.practitioner.copilot`, `practice_context`, `practitioner_self_query`), incl. degraded-fallback + error_class (provider_timeout/provider_error) and latency capture.
- Vault export: `gatherRecord` pulls receipts; `buildVaultExport` emits `ai/execution-receipts.jsonl` + manifest listing + export-event count.
- `backend/tests/ai-receipts.test.js` (7 tests): one receipt per chat turn, correct hashes/provenance, NO raw prompt/reply/PHI copy-through (canary-string check on serialized row AND on export file), export roundtrip via GET /api/export/me, insert-failure safety.
- Evidence: backend jest 68/68 pass, lint 0 errors, migration applied ("Migrations complete!").
### Slice 3 — PHI boundary truthfulness — DONE

- **UI truth:** strengthened LUCA coach disclaimer in `src/components/LucaPassport.jsx` — "LUCA guides and educates — never diagnoses or prescribes. Pre-production preview · not for emergencies…". Compliance-claim sweep of `src/` found no misleading HIPAA/compliance claims; `LAUNCH_GATES.md` already states pre-HIPAA honestly.
- **New `backend/src/lib/phi-boundary.js`:** `classifySensitivity` (SSN/card/IBAN patterns → `restricted_identifiers`), `redactForExternalAI` (replaces with `[REDACTED:*]`, returns counts), `isExternalProvider` (boundary = any provider not `mock:`/`local:`).
- **Wired into both LUCA routes** (`luca.js`, `luca-practitioner.js`): the *outbound* prompt is redacted only when the provider is external; the member's stored message is untouched; degraded-fallback path uses the same redacted outbound copy.
- **Log hygiene:** `[LUCA triggers]` log no longer prints health-derived trigger values (keys only). Audit of other routes: only error objects are logged.
- **Docs:** added "External AI provider & retention boundary" section to `docs/SECURITY.md` (what crosses the boundary per mode, redaction rule v0, retention per table, no-compliance-claim caveat).
- **Tests:** new `backend/tests/phi-boundary.test.js` (8 tests, offline). Full backend suite **76/76**, backend lint 0 errors. Frontend **30/30**, build PASS.

### Slice 4 — Incident response + read-only mode — DONE

- **New `docs/INCIDENT_RESPONSE.md`:** executable runbook — write-freeze (real `READ_ONLY_MODE` switch), evidence capture, backup status (existing `solaris-backup.sh` daily cron), git-based app rollback, DB restore decision tree with rehearse-into-scratch-DB-first rule, secret rotation, notify/review, quarterly tabletop checklist. Container names (`luca-passport-{backend,frontend,postgres}-1`) and DB creds verified against the live deployment before writing.
- **New `READ_ONLY_MODE` middleware** in `backend/src/server.js`: when env `READ_ONLY_MODE=true` (checked per-request), mutating API requests → 503 `{readOnly:true}`; GET/HEAD/OPTIONS + login/logout stay open.
- **Tests:** new `backend/tests/read-only-mode.test.js` (5 tests). Full backend **81/81**, lint 0 errors.
- **`LAUNCH_GATES.md` updated honestly:** Gate 11 → PASS (runbook + tested freeze; tabletop noted not yet executed, owners are placeholders); Gate 8 → PARTIAL (redaction v0 + receipts + SECURITY.md boundary in place; still blocked on BAA + encryption at rest); scorecard updated.

### Slice 5 — Migration and rollback hardening — DONE

- **Migration chain tested against a copy of production:** restored `solaris-20260722-2110.sql` (77 tables, 37 users) into scratch DB `solaris_migrate_test` with 0 restore errors; pending `019_ai_execution_receipts` applied cleanly → 79 tables; scratch dropped. Procedure documented in `docs/MIGRATIONS.md`.
- **New schema/recovery guard `backend/tests/schema-recovery.test.js`** (3 tests): curated critical core-journey tables must exist; every migration-defined table referenced by route/lib SQL must exist (comment-stripped SQL parse to avoid false positives); `ai_execution_receipts` must retain receipt-V0 columns.
- **New `docs/MIGRATIONS.md`:** forward-only/additive policy — NO `exports.down` by deliberate decision (drop-table "rollback" on health data is destructive theater); broken migration → fix forward; corrupted data → backup restore; rehearsal recipe; honest image-registry gap.
- **`LAUNCH_GATES.md`:** Gate 2 → PASS (evidence above); Gate 3 stays PARTIAL honestly (no image registry) but rollback docs now truthful; scorecard updated.
- **Tests:** full backend **84/84**, lint 0 errors.

### Slice 6 — Passport sovereignty status — DONE

- **No new schema needed (no ADR required):** every sovereignty question is answerable from existing tables (`users.did/nostr_npub`, `wallet_addresses`, `passport_consents`, `ai_execution_receipts`, export routes) — verified against the live schema before building.
- **New endpoint `GET /api/passport/sovereignty-status`** (`backend/src/routes/passport.js`): plain-language answers to who am I / identity methods (email, DID, Nostr, wallets) / who has access (granted consents + revoke ids) / where data is stored / which AI provider+compute target handled the latest LUCA interaction (from receipts) / export+revoke rights. Raw UUID/DID/npub live only under `advanced`.
- **New UI `SovereigntyCard`** in `src/components/LucaPassport.jsx`, rendered on the Health Passport page below the export card: four tiles (sign-in methods, who can see it with one-tap Revoke via existing `api.revokeConsent`, where it lives, AI & your data), rights row with Export, and an "Advanced details" disclosure for technical identifiers. Matches the existing warm card style (Card/SectionHead/Pill/Btn, tint gradient).
- **Truthfulness check:** storage copy avoids unverified claims (no encryption-at-rest claim); AI copy matches actual compute target (in_process / local / managed_cloud with redaction note).
- **Tests:** new `backend/tests/sovereignty-status.test.js` (4 tests: auth required, six questions answered plainly, latest receipt surfaced, no raw UUID in plain layer). Backend **88/88**, lint 0 errors. Frontend 30/30, build PASS (1 pre-existing lint error elsewhere, untouched).

### Slice 7 — Agent authority scaffold — DONE

- **Audit first:** existing `agents` table already provides agent identity + owner FK + `active` kill-switch; `audit_logs` provides the audit sink. Only the grants model was missing.
- **Migration `020_agent_capability_grants.sql`** (additive): scoped capability grants per agent — capability, jsonb scope, `requires_human_approval`, status active/revoked, `expires_at`/`revoked_at`, UNIQUE(agent_id, capability). Applied.
- **New `backend/src/lib/agent-authority.js`:** `ensureLucaAgent` (lazy one-LUCA-per-user + default grants `luca.chat`, `passport.read.summary`), `checkCapability` (agent active + grant active + unexpired), `recordGrantUse` (best-effort audit → `audit_logs` action `agent.grant.used`), `setLucaActive`, `revokeGrant`, `exportAgentAuthority`.
- **Enforcement:** `POST /api/luca/messages` now checks `luca.chat` authority before any AI call → 403 plain-language refusal when disabled (user, data, session untouched); audits grant use after each successful reply.
- **Owner routes** in `agents.js`: `GET /api/agents/luca` (identity + grants), `POST /api/agents/luca/disable|enable`, `PATCH /api/agents/grants/:id/revoke`.
- **Export representation:** vault export now emits `agents/authority.json` (agents + capability grants, PHI-free).
- **No Ory/JumpCloud/Nostr/wallet settlement** (per anti-goals).
- **Tests:** new `backend/tests/agent-authority.test.js` (7 tests incl. end-to-end: disable → chat 403 → same token still reads sovereignty status → re-enable; real audit row asserted after a live chat). Fixed FK cleanup in two older suites (audit rows now reference users). Full backend **95/95**, lint 0 errors.
- **Deferred:** frontend toggle UI for the LUCA kill-switch (API-only for now) — spec's done-condition (disableable without deleting/logging out + scoped authority model) is met server-side.

### Slice 8 — GPS evidence receipts — DONE

- **Migration `021_gps_allocation_receipts.sql`** (applied): `gps_allocation_receipts`
  (one per `gps_transactions` row; canonical PHI-free evidence JSONB, sha256
  `evidence_hash`, `policy_version` = `gps-split-v1`, state
  `proposed → disputed → corrected`, `shadow = TRUE` always — no code path sets it
  false) and `gps_allocation_disputes` (human dispute path: reason, open/resolved,
  resolution note, resolver). Additive only.
- **`backend/src/lib/gps-receipts.js`**: deterministic canonical-JSON evidence
  builder (UUIDs, amounts, split fractions, timestamps only — no names/PHI),
  sha256 hashing, idempotent `recordAllocationReceipt`, `verifyReceipt`
  re-hash check, and `explainAllocation` → six plain-language "because" lines.
  The policy fractions embedded in the evidence are the public `GPS_SPLIT`
  (85/5/3/3/2/2) — no hidden protocol royalties.
- **`gps-engine.processGPSSplit`** now records a shadow allocation receipt for
  every new split (best-effort, non-fatal, lazy require to avoid a cycle).
- **Routes** (`backend/src/routes/gps.js`):
  - `GET /api/gps/allocations/:txId/explain` — participants (patient,
    contributor, owning provider) or admin only; lazily backfills receipts for
    pre-Slice-8 transactions; returns receipt (hash, policy version, state,
    shadow), verification result, explanation lines, dispute history.
  - `POST /api/gps/allocations/:txId/dispute` — participant raises a dispute
    with a reason; state → `disputed`; audited (`gps.allocation.disputed`).
  - `POST /api/gps/allocations/:txId/resolve` — admin-only human resolution
    with a note; state → `corrected`; audited (`gps.allocation.resolved`).
- **UI** (`src/components/gps/GPSLedger.jsx`): each Value Trail transaction now
  has a "Why this allocation?" panel — state pill, "shadow allocation, no real
  money has moved" note, six plain-language explanation lines, policy version +
  evidence hash, flag history, and a "Question this receipt" path (flags are
  logged on the record next to the evidence — receipts are verifiable evidence,
  not tickets waiting on an authority). Warm style preserved (gpl-* pattern).
  `api.js`: `explainGpsAllocation`, `disputeGpsAllocation`.
- **Tests**: `backend/tests/gps-allocations.test.js` — 8 tests (PHI-free
  deterministic evidence hash, idempotent + verifiable receipts, participant
  explain, non-participant 403, dispute lifecycle + audit row, empty-reason 400,
  admin resolve → corrected, non-admin resolve 403).
- **Evidence**: backend 103/103 (13 suites), lint 0 errors; frontend 30/30,
  build PASS.
- Simulated by design: allocations are shadow proposals; no settlement exists.
### Slice 9 — Dead-end sweep — DONE

- **Smoke test extended 10 → 18 steps** (`backend/scripts/smoke-test.js`), now
  covering the core member journeys end-to-end over HTTP: registration → token
  identity → onboarding skip → LUCA recommendations → daily check-in → week
  strip → journal → audio → vault export → **Solaris assessment (submit +
  latest)** → **Passport (completeness + sovereignty-status)** → **LUCA
  suggestion action (journey start)** → **explore practitioners (directory +
  detail)** → **booking request + cancel round-trip** → **intake (templates +
  inbox)** → **GPS transparency (treasury + my-ledger)** → **logout with token
  revocation check** (post-logout `/api/users/me` must 401).
- **Result: 18/18 PASS** against a fresh server running the sprint branch
  (local instance on :5057, real dev DB, 38 providers in directory; booking
  requested and cancelled cleanly).
- **No real dead ends found** at the API layer on the swept journeys. Existing
  "coming soon" states (online payment in BookingFlow, community voting in
  Treasury, Nostr login) are honest, non-trapping labels — left as-is per spec.
- Practitioner response path verified wired end-to-end by inspection
  (`/api/provider/bookings/:id/confirm|cancel|complete` ⇄ `api.confirmBooking`
  /`declineBooking`/`completeBooking`); consented Passport view endpoints
  (`/api/consent/*`, `/api/consent/granted/:memberId`) exist with grant/revoke
  covered in Slice 6. Browser-level E2E for the practitioner role was not
  re-run this slice (documented, not claimed).
- No UI changes needed; look and feel untouched.
### Slice 10 — Docs & handoff — DONE
- **Docs updated to match reality:**
  - `README.md`: test badge 57→103 backend tests; testing section now states 133
    automated tests (103 backend, 30 frontend) plus 18-step smoke test and 8-check
    tenant-isolation script; new "Sovereignty & governance layer (sprint v4)"
    feature section; vault-export bullet mentions AI receipts + agent authority exports.
  - `docs/ARCHITECTURE.md`: sovereignty modules added to component map; new
    "Sovereignty & governance layer (sprint v4)" section (AI receipts, PHI boundary,
    sovereignty status, agent authority, GPS allocation evidence, read-only mode,
    migrations 019–021); TOC updated.
  - `docs/SECURITY.md`: new "Agent authority & economic transparency (sprint v4)" section.
  - `LAUNCH_GATES.md`: unchanged — statuses already accurate (gates 1,2,4,5,6,7,9,10,11
    PASS; gate 3 PARTIAL: no container image registry; gate 8 PARTIAL: no BAA /
    encryption-at-rest).
- **Full validation sweep (branch code, pre-deploy):**
  - Frontend: 30/30 tests PASS; production build PASS (2.12s, chunk-size warnings only);
    lint 15 errors / 137 warnings = exact pre-existing baseline (no new debt).
  - Backend: 103/103 tests PASS (13 suites); lint 0 errors / 4 warnings;
    `migrate:status` → "No migrations to run".
  - Smoke test 18/18 PASS and tenant isolation 8/8 PASS against branch code
    (local server, real DB).
  - Diff review vs `main`: 43 files, +3989/−137; no secrets (only `.env.example`
    placeholders), no PHI in logs/receipts (hashes only), all new endpoints
    auth-guarded (dispute-resolve is admin-only), migrations additive only.

## Commits
- `d0c4336` chore: preserve pre-sprint working changes (Economic Passport coming-soon banner, nav navigation)
- `d7837fa` Slice 0: sprint ledger, context import, brand test fix
- `b6921e6` Slice 1: AI provider hardening, abacus mode, request timeouts
- `a1a535d` Slice 2: migration 019 ai_execution_receipts, receipts lib, vault export
- `c23a553` Slice 3: PHI boundary module, outbound redaction, SECURITY.md boundary section
- `8995f97` Slice 4: incident response runbook, READ_ONLY_MODE middleware
- `2ee499e` Slice 5: prod-copy migration test, schema recovery test, MIGRATIONS.md
- `b8b1ce3` Slice 6: sovereignty-status endpoint + SovereigntyCard
- `ea7bb5d` Slice 7: migration 020 agent_capability_grants, agent-authority lib, agents routes, authority export
- `def0b04` Slice 8: migration 021 GPS allocation receipts, evidence/explain/dispute/resolve, GPSLedger evidence UI
- `07579ec` Slice 9: smoke test extended 10→18 steps, dead-end sweep
- (Slice 10 commit: docs & handoff — this commit)

## Implemented vs simulated vs deferred
- **Implemented & tested:** AI execution receipts (019), PHI boundary + outbound
  redaction, READ_ONLY_MODE, sovereignty-status endpoint + card, agent capability
  grants (020) + authority export, GPS allocation receipts/evidence/explain/
  dispute/resolve (021) + ledger evidence UI, extended smoke test, incident
  response + migrations docs. Evidence: 103/103 backend, 30/30 frontend,
  18/18 smoke, 8/8 tenant isolation.
- **Simulated by design (unchanged posture):** GPS economic layer is shadow-mode
  (no real settlement; receipts carry `shadow=TRUE`); payments are simulated sats
  (`payments-sim`); LUCA remains non-diagnostic.
- **Deferred (documented, not claimed):** browser-level practitioner E2E
  (verified wired by inspection only); Gate 3 image registry; Gate 8 BAA /
  encryption-at-rest. (The member-facing LUCA pause toggle has since been
  built — see follow-up work below. An admin dispute dashboard is deliberately
  NOT planned: GPS receipts are self-verifying evidence in an open,
  self-configured protocol, not tickets for a central authority — member flags
  stay on the record via the audited flag path instead.)

## Known risks / debt at end of sprint
- Frontend lint: 15 pre-existing errors (mostly empty catch blocks / hooks rules) — not blocking build or tests; unchanged from baseline.
- `jest --forceExit` masks open handles in backend tests (pre-existing).
- GPS receipts are recorded best-effort in `processGPSSplit` (a receipt write failure
  does not roll back the split); explain endpoint lazily backfills, mitigating gaps.
- Containers share one Postgres with dev; migrations 019–021 are already applied to it,
  so container rebuilds ship code only — a future split of dev/prod DBs will need
  migration execution wired into deploys.
- No container image registry (rollback = rebuild from a previous git ref).

## Deployment state
- **Deployed and verified live** at https://solaris-health.abacusai.cloud on 2026-07-23.
- Sequence: `git tag sprint-v4-checkpoint` → `docker compose build frontend backend`
  → `docker compose up -d frontend backend`. Backend startup: "No migrations to run"
  (019–021 already applied to the shared Postgres). Health endpoint returns
  `{"status":"ok","checks":{"database":"ok"}}`.
- Live verification (post-deploy, against the public URL):
  - Smoke test 18/18 PASS (`SMOKE_BASE_URL=… node backend/scripts/smoke-test.js`).
  - Tenant isolation 8/8 PASS (`API_URL=… node tests/tenant-isolation.test.js`).
  - Browser boot verified for fresh visitor (onboarding) and returning user (assessment).
- Rollback: `git checkout main && docker compose build frontend backend && docker compose up -d`
  (main was the pre-sprint live code), or revert to tag `sprint-v4-checkpoint`.

## Post-sprint hotfix — blank screen on load (2026-07-23)
- **Symptom:** returning users saw a blank dark screen at the live URL; recurred after
  each deploy.
- **Root cause:** the PWA service worker (`public/sw.js`, `solaris-v3`) served the app
  shell **cache-first**, pinning the browser to a stale `index.html` that referenced an
  old content-hashed JS bundle. Every redeploy produces a new hashed bundle name, so the
  old filename 404s → the app never mounts → blank screen.
- **Fix (commits `4a59286`, `497b9c6`, `2c8e9ed`):**
  - `sw.js` → `solaris-v4`: **network-first** for navigations/HTML (fresh `index.html`
    always used; cached shell is offline-only); hashed assets stay cache-first; old caches
    purged on `activate`; `skipWaiting` + `clients.claim`.
  - `src/main.jsx`: register with `updateViaCache:'none'` and a guarded `controllerchange`
    self-heal reload so already-affected clients recover automatically.
  - `src/lib/api.js`: 20s `AbortController` timeout on every request + `AppContext` 25s boot
    failsafe, so a hung `/users/me` can never freeze the "Awakening Solaris…" splash.
  - `deploy/solaris-health.conf` (now tracked + symlinked): `location = /sw.js` forces
    `no-store` at the origin so a new service worker is always detected.
- **Verified live:** a browser stuck on the old `solaris-v3` stale shell recovered after a
  single reload; `caches` now holds only `solaris-v4` with the current bundle
  (`index-CUiD7rBZ.js`) and the app mounts. Future deploys cannot reproduce the stale-shell
  blank screen because HTML is network-first.
- **Residual note:** a client already stuck on a blank page (its old bundle 404'd, so no JS
  runs) needs one manual refresh to recover; all subsequent loads and all future deploys
  are self-healing. FE tests 30/30, lint at baseline (15/137), build PASS after the hotfix.

## Follow-up work (post-sprint, this branch)
- **Member-facing Pause LUCA toggle** — built on the existing agent-authority
  API: SovereigntyCard "LUCA can act for you" toggle, honest paused states in
  the LUCA chat and floating widget (user stays logged in; one-tap re-enable).
- **GPS reframed from "dispute resolution" to transparency & verifiability** —
  receipts are evidence anyone with access can verify; a member can flag a
  receipt ("Question this receipt" → logged on the record, still audited). No
  admin dispute dashboard — GPS is a standalone, self-configured open protocol
  with no central adjudicating authority; Solaris is only the default recipient
  configuration until the receiving identity sets its own end address
  (Lightning address today, more rails possible later). Backend routes and
  migration 021 unchanged.
- **"What is GPS" interactive explainer** — first section of the Economic
  Passport page: plain-language definition, follow-one-payment split flow
  (illustrative amounts only), individual → community → nation → world ripple,
  and protocol-truth callouts (open source, no one controls it, identity-first,
  verifiable receipts).

## Next best step
- Browser-level practitioner E2E, and letting a member set their own GPS end
  address (Lightning address) from the Passport — the protocol-aligned next
  slice now that receipts and the explainer are in place.



---

# Sprint: GPS Protocol Alignment (GPS Protocol Suite v1.0)

**Branch:** `agent/abacus-sovereign-sprint-v4` · **Source of truth:** uploaded
`GPS_Protocol_Document_Suite_v1.0.zip` (distilled into `docs/GPS_PROTOCOL_NOTES.md`).

## What the suite specifies (key facts adopted)
- GPS = **Global Prosperous Split** — "a Lightning-native, identity-aware and
  agent-ready protocol for regenerative value routing".
- **90% to the provider, always**; a constitutional **10% (1000 bps) envelope cap**.
- Aura consultation launch profile (illustrative, not the universal standard):
  Solaris coordination 4% / regenerative health 1.5% / referral lineage 1% /
  user sovereignty 1% / infrastructure & open tech 1% / local community cause 1%
  / education & intelligence 0.5%.
- Receipt schema **gps-receipt/1.0** (receipt id, issuer, policy id + hash,
  context hash, allocations, settlement summary, privacy profile, signatures);
  append-only ledger; privacy profiles PRIVATE→TREASURY_TRANSPARENT.
- Identity above endpoints: value routes to an identity; Solaris is only the
  default end address until the recipient sets their own (Lightning today).

## What was built (one commit per step)
1. **`9f85e80` — Protocol notes** (`docs/GPS_PROTOCOL_NOTES.md`): source-grounded
   digest of all 15 suite documents.
2. **`96e5ed5` — GPS config seam**: `backend/src/lib/gps/protocol-config.js`
   (mock protocol adapter: policy id `gps:policy:solaris:aura-consultation:v0.1`,
   9000 bps provider, 7 envelope recipients, policy hash, legacy 6-column
   mapping); public `GET /api/gps/policy`; engine moved 85% → **90/10**
   (`GPS_SPLIT` now derived from config); receipts stamped with
   `receiptVersion: gps-receipt/1.0` + `policyHash`; migration 022 widens
   `policy_version` to VARCHAR(80); frontend seam `src/lib/gps-policy.js`
   (fetch with static fallback, largest-remainder `splitAmount`); +6 backend tests.
3. **`ee57004` — Economic Passport GPS showcase rebuild**: new `GpsExplainer`
   with hero fact ("90% goes to your practitioner, always"), animated SVG
   payment flow (Payment → 90/10 Split → Regenerate → Ripple), envelope
   subdivision per policy, **live gps-receipt/1.0 showcase** generated from the
   chosen amount (simulated, no PHI, same shape as ledger receipts), ripple
   layer and protocol-truth callouts; banner, treasury, earnings (85→90) and
   flow-viz buckets aligned to 90/1/1/2.5/4.5/1.
4. **`31b3288` — Section alignment**: Network/Contributions/Identity page copy
   reframed to the ecosystem/identity-first protocol narrative; SovereigntyCard
   gains an honest "Your GPS end address: solaris_default — set your own
   (coming soon)" card (no real wallet/Lightning integration); GPS ledger
   evidence view now surfaces receipt version + policy hash (conditionally —
   older receipts predate them); referral copy 5%→1%, treasury 3%→2.5%,
   LOVE back 2%→1%; user-visible "Generative Prosperity System" renamed to
   "GPS — Global Prosperous Split".
5. **This commit — validate & deploy**: sw cache `solaris-v4`→`solaris-v5`,
   docker rebuild (frontend + backend), report below.

## Validation
- Frontend: `npm test -- --run` **30/30**, `npm run build` clean,
  `npm run lint` at baseline **15 errors / 137 warnings** (no new).
- Backend: `npx jest` **109/109** (14 suites) — includes 6 new policy tests.
- Migration 022 applied locally; auto-applies on backend container boot.

## Deferred (exact next tasks)
- **Real end-address setter**: let a member save their own Lightning address as
  their GPS end address (API + SovereigntyCard form) — currently an honest
  "coming soon" placeholder on the Solaris default.
- **User-editable receive policies / auto-configuration** (suite doc 04) and
  recursion-aware routing beyond the single-hop simulation.
- Everything remains **simulated / shadow mode** — no real money moves.

---

# Sprint — Solaris ID System + Network Map (2026-07-24)

## What shipped
1. **STEP A1 — ADR + schema** (`f48e427`): `docs/adr/001-solaris-identity.md`
   (permanent non-PII `sol_`+32-hex Subject ID; email/DID/nostr/wallet/clinic as
   BINDINGS with active/pending/revoked states; GPS end address on the subject;
   LUCA never holds root identity keys). Migration `023_solaris_identity.sql`
   (additive only): `solaris_subjects` + `solaris_identity_bindings`, backfill
   1:1 for all 62 existing users (verified: 62/62, no dupes, valid format),
   email bindings hash-only, nullable `subject_id` join columns backfilled on
   `ai_execution_receipts` (7/7), `agent_capability_grants` (24/24),
   `gps_allocation_receipts`.
2. **STEP A2 — service layer** (`56790a2`): `backend/src/lib/identity/`
   (ensureSubjectForUser — lazy/idempotent for new users, getSubjectByUser,
   listBindings, setGpsEndAddress with `name@domain` validation,
   getIdentitySummary, exportIdentity). Routes `GET /api/identity/me` and
   `PUT /api/identity/me/end-address`. New AI + GPS receipts stamp the
   subject id best-effort (signed evidence blobs untouched — hash-stable).
3. **STEP A3 — UI** (`13db369`): SovereigntyCard gets a dark-gradient Solaris ID
   anchor strip (shortened id + copy button, full id under Advanced details),
   binding chips with honest "coming soon" states (no dead buttons), and a
   working GPS end-address text-field setter (Lightning-address shape,
   clearly labeled simulated — no real payments; reset to Solaris default).
   IdentityCard (Identity & Data area) gets a Solaris ID copy row.
   Health-outcomes-first ordering untouched.
4. **STEP A4 — alignment** (`fb5583f`): vault export gains
   `identity/solaris-id.md` (subject + bindings, PII-safe — email hash-only)
   plus `identity_bindings` count in the event log; `tests/identity.test.js`
   (10 tests: backfill 1:1, non-PII id shape, hash-only email binding, receipt
   stamping, end-address lifecycle, HTTP endpoints, export roundtrip);
   ARCHITECTURE.md + SECURITY.md identity sections.
5. **STEP B — network map** (`768c2c0`): all react-leaflet TileLayers switched
   to CARTO Voyager rastertiles (`basemaps.cartocdn.com/rastertiles/voyager`,
   attribution "© OpenStreetMap contributors © CARTO"). This also FIXES two
   broken tile URLs (GPSMapView pointed at a static carto-website PNG,
   ProviderOnboarding at a static wikimedia PNG). Tile endpoint verified 200.
   No dark mode exists in the app, so no dark tile variant was wired.
6. **Deploy**: sw cache `solaris-v5`→`solaris-v6`, docker rebuild + verify.

## Validation
- Frontend: `npm test -- --run` **32/32**, `npm run build` clean,
  `npm run lint` at baseline **15 errors / 137 warnings** (no new).
- Backend: `npx jest` **119/119** (15 suites — 10 new identity tests).
- Migration **023** applied locally and verified; auto-applies on container boot.

## Deferred (exact next tasks)
- **Real payment rails for the end address**: the Lightning-address setter is
  configuration only (simulated); NWC/Spark wallet connections and any real
  settlement remain future adapters.
- **Clinic ID binding**: schema-ready (`binding_type='clinic'`), surfaced as
  "coming soon" — needs a clinic-verification flow to mint real bindings.
- **DID/npub/wallet verification flows**: bindings are backfilled from existing
  profile fields; challenge-response verification (sign-to-bind) is future work.
- Everything remains **simulated / shadow mode** — no real money moves.



---

# Sprint — Quality + Notifications (2026-07-25)

Branch: `agent/abacus-sovereign-sprint-v4` (continued).

## Item 1 — Login rate-limit bug (P0) · `fc3f761`
Root causes (all verified against live traffic/logs):
1. **Global limiter too low** — 500 req/15 min/IP while the SPA legitimately
   issues ~1 req/s (polling); the "too many attempts" message users saw was the
   GLOBAL limiter's, not the login limiter's. Raised to 2000.
2. **Broken key generator** — raw `X-Forwarded-For` used as the limit key threw
   `ERR_ERL_KEY_GEN_IPV6` (seen 3× in live logs). Now uses express-rate-limit's
   `ipKeyGenerator` (IPv6 /56 aware).
3. **Wrong `trust proxy`** — set to 1 behind a 2-hop chain (cloud proxy +
   nginx); now 2, with an explanatory comment.

New `backend/src/lib/rate-limits.js`: login limiter counts **failed attempts
only** (10/15 min, keyed IP+email, `skipSuccessfulRequests`), register limiter
20/15 min, friendly 429 body + `Retry-After`. Login/register limiters mount
AFTER `express.json` (they key on `req.body.email`). LUCA TTS limiter keys on
userId. 7 new jest tests.

**Live verification:** 15 consecutive successful logins → all 200; 10 failed
logins → 429 with `Retry-After: 900`; a different account on the same IP still
logs in while another is blocked; zero ERR_ERL errors after deploy.

## Item 2 — Button/flow sweep + fixes · `33f2b66`
- New `backend/scripts/api-sweep.js`: 61 live checks across member,
  practitioner and anonymous roles → 60/61 pre-deploy (the 1 failure was the
  not-yet-deployed bookings fix below), plus existing smoke test 18/18.
- **Fix:** `GET /api/bookings/:id` with a malformed id returned a PG-cast 500;
  now a clean 404 (UUID guard).
- **Data fix:** `elena@solaris.health` linked to her seeded provider profile
  (was `user_id NULL` → empty practice pages).
- Findings (no code bug): sarah has an `assessment_complete` reward but no
  assessment answers (seed gap, UI degrades gracefully); alejandro has no
  provider profile; all "coming soon" labels are honest, no dead buttons found.

## Item 3 — Notifications: web push + triggers · `1aeeafa`
- `backend/src/lib/push.js`: VAPID web-push, **PHI-safe by construction** —
  payloads are fixed generic templates ("You have a new secure message"),
  never in-app title/message content; dead endpoints (404/410) auto-revoked;
  no-op when keys absent. Keys live only in `backend/.env` (gitignored);
  rotation documented in the file header.
- Migration `024_push_subscriptions.sql` (additive).
- Endpoints: `GET /api/notifications/vapid-public-key`, `POST /subscribe`
  (endpoint upsert), `POST /unsubscribe` (revoke).
- Fan-out wired at the single `createNotification` choke point → all existing
  triggers (bookings, provider bookings, consent, admin, gps-engine) now push.
- **New triggers:** secure message received (send + attachment upload → the
  recipient; generic copy only) and LUCA pause/re-enable (system note).
- Vault export: `notifications/log.jsonl` + manifest counts + lossless
  roundtrip tests.
- `public/sw.js`: cache `solaris-v6`→`solaris-v7`; `push` +
  `notificationclick` handlers (focus/navigate existing tab or open one).
- NotificationCenter: quiet opt-in footer inside the bell panel — never
  auto-prompts on load; iOS Safari (not installed) gets an honest "Add to
  Home Screen" hint; blocked permission shows "you'll still see everything
  here"; toggle does subscribe/unsubscribe.
- Tests: `push-notifications.test.js` (9 — lifecycle, upsert, revoke, PHI
  safety) + 2 export roundtrip tests.

## Item 4 — Product audit · `docs/PRODUCT_AUDIT.md`
Plain-language audit: what works (each claim names its verification), what's
still to build (one-line next step each), improvements ranked by impact with
this sprint's quick wins marked done.

## Validation
- Backend: `npx jest` **137/137** (17 suites; was 126 — +11 new).
- Frontend: `npx vitest run` **32/32**; `npm run build` clean;
  `npm run lint` at baseline **15 errors / 137 warnings** (no new).
- Migration 024 applied; api-sweep re-run against live post-deploy (see below).



---

# Sprint B — Track B (M1–M3) · branch `agent/abacus-sovereign-sprint-v4`

Sovereign identity spine, platform reliability, and the member journey.
Each milestone built end-to-end, verified, committed and pushed. M4–M8 were
intentionally left for later subtasks.

## M1 — Identity spine + rename · commit `a5f808f`
- **Migration 026** (additive, applied to live DB): `subject_id VARCHAR(40)
  REFERENCES solaris_subjects` added to 26 domain tables + `users`, backfilled
  and indexed; `solaris_subjects.entity_type (human|organization|agent|
  treasury)`; `solaris_identity_bindings.binding_type` CHECK widened to the full
  A2 set (email/did/nostr/wallet/clinic/passkey/lightning_address/oauth/
  external_id); `audit_logs.actor_subject_id + purpose (default 'operations') +
  consent_scope (default 'private')`; subjects/email-bindings re-backfilled for
  users created since migration 023.
- `audit()` records the four-W (who/what/purpose/consent_scope + actor subject).
- JWT now carries `sub` = permanent Solaris public_ref (`sol_…`); userId kept.
- Domain writes stamp subject_id (check-in verified).
- Rename sweep: **"LUCA Passport" → "Digital Sovereign Passport"** across all
  user-facing copy; admin labels "users" → "members".
- Tests: `identity-spine.test.js` (+3).

## M2 — Platform reliability · commit `a3ffff0`
- Structured LUCA output `{reply, suggestions:[{label,action,target}]}` with
  JSON.parse + fallback and the typed A1 §5 action enum (pre-existing from
  Sprint A). **Added:** `buildTriggerSuggestions()` so fallback chips are
  derived from fired A1 §6 rules first, then static defaults.
- Trigger engine (buildContext) drives dashboard cards — verified.
- Widget + Coach share one sessionStorage-persisted thread — verified.
- Orientation grounding in SYSTEM_PROMPT — verified.
- **Scoped seed reset:** `npm run seed:reset -- --email=<email>` wipes only that
  member's journey rows and reseeds them, leaving all other members intact; the
  `seed`/`seed:reset` scripts now target the canonical `seed_solaris.js`.

## M3 — Member journey · commit `767d6f9`
- Role model, Passport hub actions, check-in v2, Curate-for-me, media player v2
  (queue/seek/±15s/speed/mini-player/local import) and bottom-left sign-out —
  all verified in place from Sprint A scaffolding.
- **New — "Add health data" provenance + de-identification** (closes the
  cross-cutting invariant that every derived fact carries level/source/
  observed_at/consent_scope, and that text is de-identified before cloud models):
  - **Migration 027** (additive): `provenance_level SMALLINT (0–5 CHECK)`,
    `source`, `observed_at`, `consent_scope` on `health_documents`; backfill +
    index.
  - Backend de-identifies the shared text before the AI summary; stamps
    subject_id + provenance; a self-note is L0/self, a member-marked lab result
    is L4/self (pending accredited verification).
  - `export.js` serializes provenance (vault roundtrip stays green).
  - Frontend: data-type selector (L0 note / L4 lab), observed date, and an
    L0–L5 `ProvenanceBadge` on every shared document.
  - Tests: `health-data-provenance.test.js` (+4).

## Validation
- Backend `npm test` **151/151** (20 suites; was 144 pre-sprint — +7 new).
- Frontend `npx vitest run` **32/32**; `npm run build` clean.
- Vault roundtrip `node tests/roundtrip.cjs` — **9/9** structural assertions.
- `public/sw.js` cache **solaris-v8 → solaris-v9**.
- `docker compose build frontend backend && docker compose up -d` — containers
  healthy; startup migrations current; seed restored demo data.
- Live https://solaris-health.abacusai.cloud → 200; login/session OK; zero
  console errors; trigger-driven cards + Curate-for-me render; provenance
  verified end-to-end via live API (L4 stamped, PII scrubbed from summary).



---

# Sprint C — Track B (M4–M5) · branch `agent/abacus-sovereign-sprint-v4`

Continuation of Track B. M4 (A5 intake engine + messages inbox) and M5 (A3
Intelligence section, beta) built end-to-end, verified, committed and pushed.

## M4 — Messages inbox + intake engine · commit `c6e3efa`
- **Part A — foundational intake @ L2:** structured foundational health profile
  captured through the intake engine and stamped at provenance **L2**
  (peer-attested) with subject_id; summarized into LUCA's context.
- **Part B — intake variants:** multiple intake templates/variants supported;
  prefill collapse so previously answered fields fold into a compact recap.
- **Bilingual EN/ES** intake copy (UI chrome stays English; intake questions
  render in the member's language).
- **48h reminders** for incomplete intake.
- **Messages inbox** surface for LUCA-initiated intake prompts and nudges.

## M5 — Intelligence section (beta) · commit `bfdf4cd`
Implements the A3 Intelligence spec (beta scope): a three-pane view of what the
system knows and can see about the member.

- **Migration 029** (additive, applied to live DB): `intelligence_exclusions`
  (`id` PK, `subject_id`, `excluded_source`, `toggled_at`); UNIQUE
  (subject_id, excluded_source) + subject index. Idempotent.
- **`backend/src/lib/intelligence.js`** (new): `EXCLUDABLE_SOURCES` (8 —
  foundational, assessment, checkins, bookings, rewards, journal, habits,
  journeys), `NEVER_LIST` (5 honest static boundaries — other members' data,
  data outside consent scope, private keys/passwords/tokens, the open internet,
  raw card/bank/gov-id numbers), `getExclusions()` / `setExclusion()` keyed by
  subject_id.
- **`buildContext` refactor** (`routes/luca.js`): every excludable source is now
  emitted through a single `emit(key,label,count,included)` helper that (a)
  always records the source + record count for the Intelligence view and (b)
  only injects the text into the LUCA prompt when the member has NOT excluded it.
  Chat handler loads the member's exclusions before building context, so
  excluded sources are genuinely dropped from the prompt. `buildContext` is
  exposed on the router for reuse by the Intelligence route.
- **`backend/src/routes/intelligence.js`** (new), mounted at `/api/intelligence`:
  - `GET /context` → three panes: **Natural** (7 human-legible shelves — Canon,
    Principles, Log, Decisions, Evolution, Inventory, Open questions, each with
    ProvenanceBadge + source/date), **Artificial** (what LUCA can see now:
    sources with live record counts + excludable flag, the NEVER list, last AI
    call metadata, fired trigger rules with "because", and the last 8 AI actions
    — provider/target/degraded/time only, **no PHI**), **Enhanced** (4 card
    types — timeline, 7-day pattern averages (hedged, needs ≥3 check-ins),
    open questions, and rule-matched suggestions with typed actions).
  - `GET /exclusions` / `PUT /exclusions` → per-source opt-out toggles (validates
    the source against `EXCLUDABLE_SOURCES`, else 400; writes an audit log).
- **Frontend** (`LucaPassport.jsx`): new **Intelligence** tab (Salud group,
  Brain icon). `IntelligencePage` renders Natural + Artificial as two equal
  panes and Enhanced as a wide card; `SourceRow` toggles call
  `api.setIntelligenceExclusion` and reload; warm empty states; reuses
  Card/SectionHead/Pill/Btn/ProvenanceBadge/Empty. `api.js` gains
  `getIntelligenceContext` / `getIntelligenceExclusions` /
  `setIntelligenceExclusion`.
- Tests: `intelligence.test.js` (+4) — context returns 3 panes with warm empty
  states; **never leaks raw PHI** into the Artificial pane; exclusion toggle
  persists (keyed by subject_id) AND drops the source from the LUCA prompt;
  rejects a non-excludable source with 400.

## Validation
- Backend `npx jest --silent` **161/161** (was 157 pre-M5; +4 intelligence).
- Frontend `npx vitest run` **32/32**; `npx vite build` clean (chunk warning
  benign).
- Vault roundtrip `node tests/roundtrip.cjs` — **9/9**.
- Migrations current through **029** (live/docker DB).
- `public/sw.js` cache **solaris-v9 → solaris-v10**.
- `docker compose build frontend backend && docker compose up -d` — containers
  healthy; `/api/health` → ok.
- Live https://solaris-health.abacusai.cloud → 200. E2E via live API (login
  sarah@solaris.health): `/api/intelligence/context` returns all three panes
  with real per-source counts; `PUT /exclusions` on `checkins` flips its
  `included` flag to false and adds it to `exclusions`; toggled back on.
  Intelligence tab renders the three panes correctly in-browser.

## Beta scoping / deferred (A3)
- **Mandatory four provenance columns (A3 §4.1) full rollout is DEFERRED.** The
  four columns (provenance_level/source/observed_at/consent_scope) are present on
  `health_documents` (M3) and the foundational/intake tables (M4); extending them
  to `daily_checkins` and `journal_entries` is a follow-up. The Intelligence view
  displays the best available provenance per shelf in the interim.
- Enhanced **patterns are simple 7-day averages** with hedged language (not
  clinical trend analysis); require ≥3 check-ins to render.
- Artificial **recentActions capped at the last 8** AI receipts (metadata only).
- LUCA never diagnoses or prescribes; Intelligence surfaces provenance and
  boundaries rather than conclusions.

---

# Sprint D — Track B (M6–M8) · branch `agent/abacus-sovereign-sprint-v4`

Sovereign payments + GPS shadow receipts + a working Identity Key (Nostr).
All work in `/home/ubuntu/luca-passport`; commit+push after every milestone.

## M6 — Payments MVP (Wompi sandbox) · commit `7d4b4f7`
- `PaymentProvider` port + adapters (Wompi sandbox + a deterministic mock);
  idempotent webhook handler; A4-compliant allocation ledger
  (`lib/payments/allocation-policy.js`, `POLICY_ID gps:policy:aura-consultation:v0.1`:
  earned_value 9000 cents = aura_service 8600 + solaris_coord 400; GPS envelope
  1000 bps split across user-sovereignty / regenerative / infrastructure /
  local-community; largest-remainder rounding sums exactly; **no referral leg**).
- Inbox payment receipt surfaced to the member. Migration **030**.
- Backend jest **164/164**.

## M7 — GPS shadow receipts · commit `877c3f7`
- Migration **031** `gps_shadow_receipts` (receipt_id UNIQUE, settlement_state
  enum, receipt JSONB, L3-financial). `lib/gps-shadow.js` builds a
  `gps-receipt/1.0` per A4 §3.4 (issuer/policy/context hash, eligible +
  earned-value summary, `gps_envelope`, four-bucket allocations with
  `status:SIMULATED`, `settlement_summary`, COUNTERPARTY privacy). Invariants
  enforced (earned+envelope === eligible; envelope ≤ 10%). Idempotent via
  `ON CONFLICT (receipt_id)`; settlement_state SCHEDULED ≥ $500 else PREPARED.
  Hooked into `confirmPaidIntent`.
- `GET /api/gps/receipts` (+ `/:receiptId` owner-only). Vault serializer writes
  `payments/gps-receipts.jsonl` + README. Member panel
  `components/gps/PaymentReceipts.jsx` ("Where your payment goes" — earned +
  envelope bars, settlement chip, Simulated disclosure).
- Backend jest **166/166** (+2), frontend **32/32**, roundtrip **9/9**.

## M8 — Identity Key (Nostr) binding + NIP-05 + login · commit `31100df`
- **Client-side only key custody.** `src/lib/identity-key.js`: BIP-39 mnemonic →
  NIP-06 (`m/44'/1237'/0'/0/0`) → npub/nsec. The secret key is derived on device,
  kept in `sessionStorage` (never localStorage, never sent to the server).
- **Binding.** `POST /api/identity/nostr` stores only the **public npub** +
  optional NIP-05 handle. Migration **032** `nostr_handles`
  (handle UNIQUE, pubkey_hex, npub). `bindNostrKey` revokes any prior active
  nostr binding, mirrors to `users.nostr_npub`, upserts the handle.
- **Working login (challenge/response).** `POST /api/auth/nostr/challenge`
  issues a single-use 5-min nonce (`solaris-login:<nonce>`); the client signs it
  with BIP-340 Schnorr over `sha256(message)`; `POST /api/auth/nostr/login`
  verifies the signature, finds/creates the user, and issues a JWT. Replaced the
  old "coming soon" button in `flows/Auth.jsx` with a real
  create-new / use-existing flow.
- **NIP-05 + Lightning.** `GET /.well-known/nostr.json?name=<handle>` resolves the
  handle → pubkey (public, CORS-open). `GET /.well-known/lnurlp/:name` returns a
  friendly "not yet configured" per A4 §3.4 scope note. nginx vhost updated to
  proxy `/.well-known/` to the backend.
- **UI + copy.** Renamed user-visible "Nostr" → **"Identity Key"** everywhere;
  added an ℹ️ info popover with the exact sovereignty copy (identity key vs
  account, created on device, belongs to you not Solaris, no password reset, keep
  a backup, save with 3–5 people, new vs existing key). `IdentityCard` surfaces
  the bound npub + NIP-05 handle and offers an on-device generate/bind flow.
- Also fixed a latent M7 build bug (`PaymentReceipts` default-imported `api`).
- Backend jest **170/170** (+4 `nostr-identity.test.js`), frontend **32/32**,
  roundtrip **9/9**, `npx vite build` clean.

## Validation (Sprint D)
- Migrations current through **032**. `public/sw.js` **solaris-v10 → solaris-v11**.
- Docker rebuilt + up; `/api/health` → ok; live site https://solaris-health.abacusai.cloud → 200.
- **Live E2E of Identity Key login:** create identity → challenge → sign →
  `/api/auth/nostr/login` 200 + JWT → `POST /api/identity/nostr` binds npub +
  handle → `GET /.well-known/nostr.json?name=<handle>` resolves to the pubkey →
  lnurlp returns the "not configured" notice. Client-sign / server-verify parity
  confirmed. Test data cleaned up afterward.

## Beta scoping / deferred (A2/A4)
- **Signing is direct (client holds nsec in sessionStorage), not NIP-46 bunker.**
  A2 §3.2.4 names NIP-46 as the ideal; M8's scope note says ship NIP-05 + npub
  binding first. Key never leaves the device / never persisted to disk.
- **Payments + GPS settlement are simulated** (allocations `SIMULATED`,
  `settled_cents:0`); Wompi runs in sandbox. Lightning address intentionally
  returns "not configured".
- The A4-compliant payments policy runs alongside the older `lib/gps` engine used
  by the legacy `gps_transactions` flows; they are not merged.
