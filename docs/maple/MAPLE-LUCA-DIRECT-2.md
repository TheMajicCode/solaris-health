# MAPLE-LUCA-DIRECT-2 — hardening the owner-scoped private LUCA path

Focused, minimal follow-up to MAPLE-LUCA-DIRECT-1 covering brief items 1–6
(`Solaris-Maple-Fix-and-Enable-2026-09-16`). No DB migration, no schema/seed
change, no change to any non-owner AI consumer. The owner designation list is
left EMPTY (real-account enablement is a separate downstream step).

## 1. Designation vs availability (fail-closed toggle)
- `LUCA_MAPLE_OWNER_USER_IDS` remains the immutable **designation** (who is an owner).
- New **availability** gate `isMapleAvailable(env)` in `backend/src/routes/luca.js`:
  requires `LUCA_MAPLE_ENABLED === 'true'` AND base URL AND model AND API key.
  Anything missing ⇒ fail-closed.
- A designated owner while NOT available gets a truthful degraded reply
  (`{reply, suggestions:[], model:null, degraded:'maple_unavailable'}`) returned
  **before** any Passport context assembly or provider construction; the chat turn
  is still persisted. Identity is taken only from `req.user.userId`.
- **SAFE DISABLE** = set `LUCA_MAPLE_ENABLED=false` (NOT clearing the owner list).

## 2. Incomplete completions are failures
- Adapter (`maple.js`) inspects `finish_reason`: only `stop`/absent are complete;
  `length`/`content_filter`/`tool_calls` ⇒ `MapleIncompleteError`
  (`maple_incomplete_length` / `maple_incomplete`); blank ⇒ `maple_blank`.
- Route parses a STRICT envelope (`parseMapleEnvelope`): `JSON.parse` only,
  non-blank string `reply` required, every suggestion action must be in the
  in-code allowlist `MAPLE_ACTION_ENUM` (7 actions; `open_listing` excluded).
  Truncated / blank / malformed / disallowed ⇒ bounded degraded state; no other
  provider is tried and no raw partial JSON / tool / error body is ever shown.
  `LUCA_MAPLE_MAX_TOKENS` stays 256.

## 3. Cancellation + bounded errors
- Client-disconnect cancellation now keys on the **response** `close` event while
  `!res.writableEnded` (a real disconnect closes the socket before we finish
  writing; `res.destroyed` is NOT gated on because it is already true by then).
  The listener is removed in `finally` before `res.json()`, so a healthy request
  whose body merely finished arriving is never aborted.
- `LUCA_AI_TIMEOUT_MS` retained. Errors are collapsed to a single allowlisted
  class (`classifyMapleError` + `MAPLE_ERROR_CLASSES`) and logged with a safe
  random correlation id only — never the raw error, prompt, reply, body,
  Authorization header, or env value.

## 4. Provenance + privacy
- Adapter adds `completeDetailed({system,prompt,context}) -> {text, model, finishReason}`
  capturing the upstream-reported model; `complete() -> string` is unchanged.
- `recordAIReceipt` records REQUESTED vs PROVIDER-REPORTED model; when upstream
  omits it the reported model is `'unknown'` (never invented). The inputs hash is
  taken over the SELECTED system prompt (the dedicated Maple prompt on the owner path).
- `MAPLE_SYSTEM_PROMPT` edited: removed the "Export is always available" /
  "Deletion means deletion" blanket promises; added an accurate
  "how this channel handles information" section (typed messages + replies are
  stored in the Solaris chat DB in plaintext at the Abacus backend; an empty
  Passport block is not anonymization/no-storage; Maple is remote confidential
  inference, not per-user-dedicated and not E2E from the backend). The
  no-fabricated-metrics rule is kept.

## 5. Restart / rollback + migration evidence (READ-ONLY)
- Mechanism: `npm run migrate` = `node-pg-migrate up -m migrations`; ledger table
  `pgmigrations`.
- Release migrations dir (`maple-luca-direct-1` and the new `-2`) = 37 files,
  001–038 (006 was never created). The `pgmigrations` ledger already records the
  same 001–038 (latest `038_binding_proof_and_challenges`). No `039`–`042` exist
  in either the dir or the ledger ⇒ `ExecStartPre npm run migrate` is a **no-op**.
  No migrations were run.
- New release materialized at `/opt/solaris-beta/releases/maple-luca-direct-2/backend`
  via `cp -a` of the `-1` release (includes node_modules) with only the edited
  source overwritten. Unit `WorkingDirectory` repointed to it; `daemon-reload`
  + restart; health 200 (`database:ok`, `migrations:ok`) and MainPID cwd confirmed
  on the new release.
- Checkpoint at `/home/ubuntu/maple-notes/checkpoint-v2/` (v2 source tar excl
  node_modules + effective unit copy + `ROLLBACK.md`). Safe disable and full
  rollback are documented there.

## 6. Regression tests + wiring
- `backend/test/maple/` (node:test): adapter, owner, and route suites cover the
  brief's checks 1–7. `npm run test:maple` (`node --test test/maple/`) added to
  `package.json`. Existing jest suite (`tests/**`) unchanged.

## Verification (this deploy)
- `npm run test:maple` ⇒ 41 pass / 0 fail (also verified from the new release tree).
- Existing jest suite ⇒ 295 pass / 1 fail; the single failure
  (`tests/identity.test.js` — "every user has exactly one subject") is a
  pre-existing shared-DB data-state issue (orphan users) that also fails on the
  baseline without these changes.
