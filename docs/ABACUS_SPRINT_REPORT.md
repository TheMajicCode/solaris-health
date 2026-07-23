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
  evidence hash, dispute history, and a "Something looks wrong — dispute this"
  human path. Warm style preserved (gpl-* pattern). `api.js`:
  `explainGpsAllocation`, `disputeGpsAllocation`.
- **Tests**: `backend/tests/gps-allocations.test.js` — 8 tests (PHI-free
  deterministic evidence hash, idempotent + verifiable receipts, participant
  explain, non-participant 403, dispute lifecycle + audit row, empty-reason 400,
  admin resolve → corrected, non-admin resolve 403).
- **Evidence**: backend 103/103 (13 suites), lint 0 errors; frontend 30/30,
  build PASS.
- Simulated by design: allocations are shadow proposals; no settlement exists.
### Slice 9 — Dead-end sweep — PENDING
### Slice 10 — Docs & handoff — PENDING

## Commits
- `d0c4336` chore: preserve pre-sprint working changes (Economic Passport coming-soon banner, nav navigation)
- (slice commits appended below as they land)

## Known risks / debt at baseline
- Frontend lint: 15 pre-existing errors (mostly empty catch blocks / hooks rules) — not blocking build or tests.
- `jest --forceExit` masks open handles in backend tests (pre-existing).
