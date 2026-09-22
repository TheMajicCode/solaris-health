# WEB-R1 — authenticated LUCA context isolation

Date: 2026-09-17. Status: implementation authorized by Majd's named task
authorization for "WEB-R1 context isolation", issued to a Claude Code cloud
session acting as the accountable source writer. This continues the previously
scoped WEB-R1 work. No deployment is authorized.

## Source and authority

- Repository: `TheMajicCode/solaris-health`.
- Base: `main`, `09d6e6a43e751d31d06080e45364113a69759b1b`.
- Base tree: `3db946243165a92a5c0039a41114b41589ff030d`.
- Remote `main` was re-checked on 2026-09-17 and had not advanced past this
  commit, so the recorded base is also the current base. Nothing was reset.
- Task branch: `claude/web-r1-context-isolation-y7kpm5`, cut from that base;
  initial status clean. The cloud platform assigns the session suffix, so this
  is the actual branch of record for this node in place of the preferred
  `claude/web-r1-context-isolation`.
- The historical branch of record `agent/abacus-beta-v1-hardening` and the
  separate `agent/maple-luca-direct-1` branch at
  `af5eb2e909d40451045cf41b1e7ce74d9c54c13e` are left intact and untouched.
  Neither is merged, edited or used as a base here.
- AGENTS.md and its referenced governance set were read: `docs/beta-v1/WORKFLOW.md`,
  `README.md`, `CONTEXT.md`, `RELEASE-LEDGER.md`, `docs/contracts/G0-governance.md`,
  `docs/ARCHITECTURE.md` and `docs/SECURITY.md`. No `CLAUDE.md` and no repository
  hooks exist at this base; none were relied upon. Existing production, real-data
  and migration restrictions remain in force.

## Outcome and boundary

`GET /api/luca/context` returns only the authenticated account's context.
`req.user.userId` — the authenticated `users.id` UUID — is the sole record-access
authority. The JWT `sub` claim (the permanent Solaris Subject ID / `public_ref`),
`npub`, `did` and any query-supplied identifier are explicitly NOT substituted for
it; those identifiers have different meanings in this application.

An optional `user_id` query value is only an assertion of that same account: one
canonical UUID-shaped string, compared case-insensitively, while the SQL always
binds `req.user.userId`. Malformed, empty, duplicate, array or object values
return 400; a different valid account returns 403 for every role including admin;
an invalid session subject returns 401. Denial precedes all account-context
queries. The existing auth middleware still validates JWT signature and
revocation, and its revoked-token store read is not an account-context query.
No administrator, practitioner or role-based bypass is introduced.

Data: private identity, appointments and contribution history. Actor:
authenticated account owner. Consent: self-access only; delegated and clinical
consent are outside this endpoint. Failure: deny before reads; storage failures
return a bounded generic 500 with no partial context and no raw database error
detail in logs. No durable object or export representation changes. Existing
success response fields remain byte-compatible.

Out of scope for WEB-R1: no migration, no account modification, no consent
mutation, no external AI call, and no change to `luca.js`, Maple configuration,
the server bootstrap or the auth middleware.

## Exact allowlist

Exactly four paths may change under this node:

- `backend/src/routes/luca-context.js`
- `backend/tests/luca-context-isolation.test.js`
- `docs/beta-v1/contracts/CONTRACT-WEB-R1.md`
- `docs/beta-v1/handoffs/HANDOFF-WEB-R1.md`

The parallel DOCS-EVIDENCE-R2 node owns its own separate documentation paths and
is NOT published by this node: the reviewed archive's `README.md`,
`docs/CURRENT-STATE.md`, `CONTRACT-DOCS-EVIDENCE-R2.md` and
`HANDOFF-DOCS-EVIDENCE-R2.md` are deliberately excluded and left unchanged.

No other route, dependency, lockfile, migration, seed, CI, runtime configuration,
APK, identity key, phone data or UI change is included. Dependencies and lockfiles
are installed from the existing lock only and are not modified.

## Acceptance and verification

- GIVEN a valid session, WHEN `user_id` is omitted or matches the owner
  (including uppercase spelling on either side), THEN return only owner context
  and bind only the session ID in every account-context query.
- GIVEN a different valid account ID, WHEN any authenticated role requests it
  (patient, practitioner, staff, admin, partner), THEN 403 with no context SQL,
  including when that account does not exist.
- GIVEN malformed, empty, valueless, duplicate, array or object query input,
  THEN 400 with no context SQL.
- GIVEN a signed token whose `userId` is missing, null, empty, non-UUID, numeric,
  an array, an object or newline-padded, THEN 401 with no context SQL.
- GIVEN missing, malformed, wrongly signed, expired, `jti`-less or revoked
  authentication, THEN deny without context reads. Revocation storage failure
  retains the existing fail-closed 503.
- GIVEN no owner row, THEN 404 without querying related records; GIVEN failure
  during any of the six context reads, THEN a generic 500 with no partial records
  and only a fixed log marker — no raw error message, account ID or driver code.
- Tests exercise the real Express router, the real JWT/revocation middleware and
  real Express query parsing with synthetic JWTs and a fully mocked
  `backend/src/db`, so no pool is opened and no live account or shared database
  is contacted.

Run from `backend/`, capturing each exit code:

```sh
npm ci --ignore-scripts
npx --no-install jest --config <disposable-config> --runInBand tests/luca-context-isolation.test.js
npx --no-install jest --runInBand --forceExit   # full suite, baseline-compared
npm run lint
```

The focused suite must run under a disposable explicit Jest configuration that
discovers only this file and does NOT inherit `backend/tests/setup.js`,
`backend/.env` or the `luca_passport` fallback connection string. Collection is
verified — the expected case count must actually be collected, not assumed.
`node --check` and the supplementary stub harness alone do not establish success.

Any integration test needing PostgreSQL uses an explicitly disposable local
database whose target is verified first; live or shared database URLs, patient
data, AI provider secrets and signing keys are never used, and live identity
records are never edited to clear a baseline failure. Unexplained failures are
compared against the same base with the same isolated fixtures, and reported as
unchanged-baseline versus newly-introduced.

Before publication: `git diff --check`, exact-allowlist confirmation, and a
committed-tree match against the reviewed patch digest. Independent review of the
complete diff precedes publication.

## Effects and rollback

No deployment, migration, seed, dependency declaration or service restart.
Application rollback is a reviewable revert of this node, but that would restore
the access flaw and is not recommended as an operational rollback. Existing
production blockers remain open until deployment-specific evidence closes them.
Reconcile the shared backend, startup migration behavior and recovery evidence
before preparing any deployment. Do not wholesale promote current main over the
reported older running backend as a one-route hotfix.
