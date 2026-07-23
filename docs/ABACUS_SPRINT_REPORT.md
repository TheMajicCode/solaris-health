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
### Slice 2 — AI execution receipts — PENDING
### Slice 3 — PHI boundary truthfulness — PENDING
### Slice 4 — Incident response + read-only mode — PENDING
### Slice 5 — Migration/rollback hardening — PENDING
### Slice 6 — Passport sovereignty status — PENDING
### Slice 7 — Agent authority scaffold — PENDING
### Slice 8 — GPS evidence receipts — PENDING
### Slice 9 — Dead-end sweep — PENDING
### Slice 10 — Docs & handoff — PENDING

## Commits
- `d0c4336` chore: preserve pre-sprint working changes (Economic Passport coming-soon banner, nav navigation)
- (slice commits appended below as they land)

## Known risks / debt at baseline
- Frontend lint: 15 pre-existing errors (mostly empty catch blocks / hooks rules) — not blocking build or tests.
- `jest --forceExit` masks open handles in backend tests (pre-existing).
