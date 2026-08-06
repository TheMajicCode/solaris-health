# Contract S1A-P0-FAIL-CLOSED

**Node:** `S1A-P0-FAIL-CLOSED`
**Status:** accepted for the bounded S1A scope and committed locally; push remains a separate Majd gate
**Author:** Codex recovery of reviewed Abacus patch
**Date:** 2026-08-05

## 1. Base and worktree

| Field | Value |
|---|---|
| Repository | `TheMajicCode/solaris-health` |
| Accepted source branch | `agent/abacus-sovereign-sprint-v4` |
| Accepted source commit | `7b8843a9367cebb5ebb0a64c74f597a6c4ac2879` |
| Local implementation branch | `codex/s1a-p0-fail-closed` |
| Remote effect | None; no push, PR, merge, migration, or deploy |

The implementation is valid only when `git rev-parse HEAD` equals the accepted commit and the final status contains only the eight allowlisted paths in section 4. Any staged, deleted, renamed, or additional path is a stop condition.

## 2. Accepted-base behavior

### Mock authentication

At the accepted base, `backend/src/routes/auth.js:246-355` exposed two mock authentication handlers that created or updated real `users` rows, issued JWTs, and generated/stored fabricated secret-shaped identity material. Both routes were mounted in every environment.

### Session revocation

At the accepted base, `backend/src/middleware/auth.js:43-62` skipped revocation validation for tokens without `jti` and continued authentication when the revocation-store query failed.

### LUCA authority

At the accepted base, `backend/src/lib/agent-authority.js:58-74` could throw through its storage path, and `backend/src/routes/luca.js:486` converted a capability-check failure into `allowed:true`. A grant with `requires_human_approval=true` was stored but not enforced.

### TTS

At the accepted base, `backend/src/routes/luca.js:624-668` read member text and provider credentials, made an authenticated outbound speech request, and logged dynamic upstream/error details. This route is disabled for Beta V1 because it had a confirmed PHI-egress/logging defect and no accepted safe provider contract.

## 3. Outcome and non-goals

### Outcome

Eliminate four P0 fail-open or production-reachable paths:

1. Mock authentication is permanently removed at the server boundary in every environment.
2. Tokens without `jti` and revocation-store failures deny access.
3. Authority-store failures and approval-required grants deny LUCA before message, context, AI, receipt, or grant-use effects.
4. TTS is an authenticated, non-egress compatibility tombstone.

### Non-goals

- No frontend behavior or copy change.
- No database schema, migration, seed, package, lockfile, environment, or deployment change.
- No global secret-shaped request-body guard; that remains a separate boundary contract.
- No journal, consent, health-document, or general mutation-audit expansion.
- No approval-artifact design.
- No JWT lifetime decision; the existing lifetime remains a documented parameter/TODO, not a new constant.
- No correction to best-effort/fire-and-forget grant-use audit delivery.
- No unrelated cleanup, dependency remediation, identity-binding work, wallet work, or feature work.

## 4. Exact allowlist

Only these paths may differ from the accepted commit:

1. `backend/src/lib/agent-authority.js`
2. `backend/src/middleware/auth.js`
3. `backend/src/routes/auth.js`
4. `backend/src/routes/luca.js`
5. `backend/tests/agent-authority.test.js`
6. `backend/tests/auth.test.js`
7. `backend/tests/luca.test.js`
8. `docs/contracts/S1A-p0-fail-closed.md`

The four production paths are frozen after recovery of the independently reviewed patch. A new executable falsifier is required to reopen one.

## 5. Actors and data classes

| Surface | Actor | Authorization | Data handled after S1A | Side-effect policy |
|---|---|---|---|---|
| `POST /api/auth/nostr-mock` | Any caller | None, tombstone only | No body read | None |
| `POST /api/auth/google-mock` | Any caller | None, tombstone only | No body read | None |
| `authMiddleware` | Token holder | Valid signature, expiry, `jti`, not revoked | JWT claims and revocation lookup only | Deny on validation-store failure |
| `POST /api/luca/messages` authority gate | Authenticated member | Active unexpired `luca.chat` grant without pending approval | User ID and capability before gate | No downstream effect on denial |
| `POST /api/luca/tts` | Authenticated member | Normal session validation | No request body read | None |

The test data is synthetic and contains no PHI, real identity, key, mnemonic, credential, payment, or patient record.

## 6. Failure direction

| Condition | Required direction |
|---|---|
| Mock-auth request in any environment | 410; no database, JWT, award, referral, or log side effect |
| JWT missing `jti` | 401; `next()` is not called; no revocation query |
| Revocation-store error | 503; `next()` is not called; no dynamic error or token is logged |
| Authority-store error | `allowed:false`, `authority_unavailable`; route 503 before downstream effects |
| Grant requires human approval | `allowed:false`, `approval_required`; route 403 before downstream effects |
| TTS request with valid session | 410; no body processing, credential access, egress, message, or receipt |
| TTS request without valid session | Existing authentication denial |

## 7. Typed responses

### Mock authentication removed

HTTP 410:

```json
{"error":"ENDPOINT_REMOVED","endpoint":"mock_auth","removed":true}
```

### Token requires re-login

HTTP 401:

```json
{"error":"TOKEN_REQUIRES_RELOGIN"}
```

### Session validation unavailable

HTTP 503:

```json
{"error":"SESSION_VALIDATION_UNAVAILABLE"}
```

### LUCA authority unavailable

HTTP 503:

```json
{"error":"AUTHORITY_UNAVAILABLE","agentDisabled":false}
```

### Human approval required

HTTP 403:

```json
{"error":"APPROVAL_REQUIRED","reason":"approval_required","agentDisabled":false}
```

### TTS disabled

HTTP 410:

```json
{"error":"FEATURE_DISABLED","feature":"tts","disabled":true}
```

## 8. Payload, secret, PHI, and log boundary

- The mock-auth and TTS tombstones do not destructure or read `req.body`.
- The removed mock handlers formerly logged dynamic error objects; no source evidence showed explicit request-body logging.
- A revocation-store failure returns only the static typed response and emits no log in S1A. An authority-store failure emits one fixed coarse operational marker. Neither path emits error code/name/message/object, JWT, request body, query, parameters, user ID, capability, or user content.
- Responses never echo tokens, keys, mnemonics, request sentinels, or dependency details.
- No new logging is added to health, identity, consent, or payment paths.
- A future global boundary must reject nested nsec values, raw 64-hex member private keys, and mnemonic-shaped payloads before handlers without logging, echoing, or hashing the values. It is not an SSN/card/IBAN redactor and is outside S1A.

## 9. Implemented plan

1. Replace both mock-auth handlers with unconditional static 410 tombstones and remove their secret/DB/JWT helper paths.
2. Make `authMiddleware` reject missing `jti` and revocation-store outages without calling `next()`.
3. Make `checkCapability` catch storage failures, enforce `requires_human_approval`, and return typed denial reasons.
4. Make LUCA map authority outage and approval-required before persistence, context, AI, receipt, and audit effects.
5. Replace TTS with an authenticated static 410 and remove body/provider/fetch/dynamic-log code.
6. Add executable tests for exact responses, no downstream calls, no sensitive logs, and no persistence/receipt/audit effects.

## 10. Rollback

Before commit, rollback is deletion of this local clone or reversal of the eight-path diff. After an accepted commit, rollback is a normal revert of that one commit. Rollback must never restore the original mock-secret generation, TTS egress, or fail-open behavior in production; an alternative fix needs a new contract.

## 11. Migration, dependency, and deployment statement

S1A adds no table, column, index, migration, seed, dependency, package change, environment key, service, network provider, deployment change, or data backfill. `npm ci` may restore the exact pinned dependency tree without changing `package-lock.json`.

## 12. Acceptance tests and falsifiers

### Mock authentication

GIVEN either removed endpoint and a secret/identity-shaped synthetic body, WHEN called in any environment, THEN the exact 410 body is returned, no token/user is returned, the handler performs zero database calls, no sentinel is logged, and no matching user row exists.

### Session validation

GIVEN a validly signed token without `jti`, WHEN `authMiddleware` runs directly, THEN it returns exact 401, performs no database call, and never calls `next()`.

GIVEN a validly signed `jti` token and a revocation-store failure, WHEN `authMiddleware` runs directly, THEN it returns exact 503, never calls `next()`, and neither response nor logs contain the token/error sentinel or dynamic error code.

### Authority library

GIVEN an authority-store failure inside `ensureLucaAgent`, WHEN `checkCapability` runs, THEN it returns denied `authority_unavailable` and logs only the fixed marker.

GIVEN an active grant marked `requires_human_approval=true`, WHEN checked, THEN it returns denied `approval_required`, and the grant flag is restored in `finally`.

### LUCA route

GIVEN an authority-store failure, WHEN a member posts a message, THEN exact 503 is returned and no query after the failed authority query, health-context read, AI/fallback fetch, LUCA message, execution receipt, or grant-use audit occurs.

GIVEN an approval-required grant, WHEN a member posts a message, THEN exact 403 with `agentDisabled:false` is returned and no external fetch, LUCA message, execution receipt, or grant-use audit occurs.

### TTS

GIVEN a valid member session and a unique text sentinel, WHEN TTS is called, THEN exact 410 is returned, no fetch/log contains the sentinel, and LUCA message/receipt/audit counts remain unchanged.

### Regression

Existing registration, login, valid-token, revoked-token, active LUCA chat, disabled-agent, capability lifecycle, and unauthenticated TTS behavior remain covered. No broad skip, lowered assertion, masked exit, or fixed sleep is accepted.

## 13. Verification commands

Commands run directly; their exit codes and totals are captured without `tail`, `|| true`, or always-successful grep constructs.

```powershell
npm.cmd ci
node_modules/.bin/jest.cmd tests/auth.test.js tests/agent-authority.test.js tests/luca.test.js --runInBand --forceExit --no-coverage
node_modules/.bin/jest.cmd --runInBand --forceExit --no-coverage
$env:ESLINT_USE_FLAT_CONFIG='false'; node_modules/.bin/eslint.cmd src/lib/agent-authority.js src/middleware/auth.js src/routes/auth.js src/routes/luca.js tests/agent-authority.test.js tests/auth.test.js tests/luca.test.js --max-warnings=0
npm.cmd run lint
git diff --check HEAD
git status --porcelain=v1 --untracked-files=all
```

Database-capable verification uses one empty disposable/local PostgreSQL database, the repository's existing base schema files, and `npm run migrate` so `node-pg-migrate` owns `pgmigrations`. Migration files are never applied directly with psql. `seed_solaris.js`, product dumps, and secret/mock-key seeds are forbidden.

Static fail-on-match checks cover recovered mock-secret helpers/storage, TTS provider/fetch implementation, fail-open comments/`next()` paths, dynamic failure logs, the new 400 ms wait, and extra changed files.

## 14. Stop conditions

Stop without commit or cleanup when any of these occurs:

- base commit or branch differs;
- a ninth path changes;
- a production source change is requested without a new failing falsifier;
- package/lockfile, migration, seed, schema, frontend, configuration, or CI changes;
- a real/shared database, user record, PHI, key, mnemonic, payment, or credential enters testing;
- a database must be reset/reused or its credential printed;
- a test is skipped, weakened, truncated, or made green by seed/ambient fixtures;
- a generated PDF/DOCX appears;
- commit, push, PR, merge, deploy, or next-node work is proposed before independent acceptance.

## 15. Residual risks

| Risk | Current truth | Follow-up |
|---|---|---|
| Frontend mock wrappers | `src/lib/api.js:433-445` still defines mock-auth clients; no accepted-base runtime callsite outside those definitions was found. Server 410 prevents use. | Remove/rename through a frontend contract. |
| TTS UI | `src/lib/api.js:143-158` returns `null` on non-2xx; `src/components/LucaPassport.jsx:2457-2461` marks TTS failed and hides it. Stale comments still mention fallback JSON. | Frontend cleanup, separate node. |
| JWT lifetime | Lifetime is unchanged and must remain configurable/documented with a decision TODO. Stolen-token exposure before expiry/revocation, revocation-write failure, and availability during store outage remain. | Session-lifecycle contract. |
| Secret-shaped body rejection | No global recursive boundary exists. | Separate boundary contract on every body-bearing endpoint. |
| Grant-use audit delivery | `backend/src/routes/luca.js:584` remains best-effort/fire-and-forget; the pre-existing authority test uses a timed wait. | `S1B-AUDIT-CONTRACT`; define delivery/failure policy first. |
| Broader mutation audit | Journal, consent, health-document, and other mutations need typed actor/action/resource/purpose/consent/failure semantics. | `S1B-AUDIT-CONTRACT`; never generic `MUTATION_ACTION`. |
| Approval artifact | Approval-required grants are denied because no accepted approval artifact exists. | Separate human-approval contract. |
| Intake tests | Two foundational tests rely on ambient template/provider fixtures. This is baseline test-isolation debt, not an S1A regression. | Separate test-isolation node; do not seed around it. |
| Vault-export date test | One journey export assertion treats a date-only value as local time; it renders July 26 as July 25 in New York and passes under `TZ=UTC`. The source and test are unchanged from the accepted base. | Separate timezone-portability test node; preserve date-only semantics. |
| TTS availability | TTS is intentionally unavailable in Beta V1. | Re-enable only with a PHI-safe provider/consent/logging contract. |

## 16. Acceptance result — 2026-08-05

Codex provisioned PostgreSQL 17.10 from the official EDB Windows binary archive as an isolated portable instance listening only on `127.0.0.1:55432`. The archive SHA-256 is `EF9B1E5E23D2E8A83914BA13D9DC536A72210FBA53FD1808FF1F7E06BB22B106`. No installer, Windows service, shared database, real data, seed, credential, migration file edit, or deployment was used.

The nine repository base-schema files were applied to the empty database with `ON_ERROR_STOP=1` in dependency order. `npm run migrate` then completed all 35 migration files and created/owned all 35 `pgmigrations` rows. `schema-recovery.test.js` passed 3/3.

Acceptance evidence:

- S1A targeted suites: **43/43 passed**, 3/3 suites, exit 0.
- Full backend suite: **195/198 passed**, 24/26 suites, exit 1.
- The two intake failures require absent ambient rows in `intake_form_templates` and `provider_profiles`; the clean migrated database intentionally contains neither fixture.
- The third failure is an unchanged timezone-sensitive vault-export assertion. It fails in `America/New_York` and the exact two-test diagnostic passes under `TZ=UTC`.
- None of the three failing tests or their implementation paths differs from accepted base commit `7b8843a`.
- Seven changed JavaScript files pass `node --check` and zero-warning changed-file ESLint.
- Whole-backend ESLint reports 0 errors and 8 accepted-base warnings.
- `git diff --check` passes; exactly eight allowlisted paths differ.
- `backend/package-lock.json` remains unchanged at SHA-256 `ABB4F6EB79512EAD1AF71591E4A4907664D8A542619DAC25E2D026453AF88238`.

**Verdict:** all S1A falsifiers pass. The three full-suite failures are directly evidenced baseline portability/test-isolation debt outside the S1A diff. S1A is accepted for its bounded security scope, but the repository must not be described as a fully green test baseline. The bounded local commit is complete; push remains a separate human gate.
