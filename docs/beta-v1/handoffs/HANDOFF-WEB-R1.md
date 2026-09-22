# WEB-R1 — implementation and verification handoff

Date: 2026-09-17. Status: source repair implemented and verified in an isolated
cloud checkout against a disposable local PostgreSQL instance. Publication and
deployment must be identified from subsequent Git/PR and operator evidence, not
inferred here. No deployment is authorized or performed.

## Source and change

- Base: `main` at `09d6e6a43e751d31d06080e45364113a69759b1b`.
- Base tree: `3db946243165a92a5c0039a41114b41589ff030d`.
- Remote `main` was re-checked on 2026-09-17 and had not advanced past that
  commit; the recorded base is the current base. Nothing was reset.
- Task branch: `claude/web-r1-context-isolation-y7kpm5`, cut from that base.
  The cloud platform appends the session suffix, so this is the actual branch of
  record in place of the preferred `claude/web-r1-context-isolation`.
- Writer: Claude Code cloud session, acting as accountable source writer under
  Majd's named "WEB-R1 context isolation" task authorization.
- Candidate provenance: reused from the owner-supplied reviewed archive
  `Solaris-WEB-R1-Reviewed-Patch-2026-09-13.zip`. Archive SHA-256
  `1756a82b2e7afbab8b52d5e62a8b4d053ed1526e29c7424e44477507c7a1d0c0` and patch
  SHA-256 `6b89fc9e0b7e7dfb8bc9fc1a6c81fc43bd8a30564381a512f52b2db2981b3f9d`
  both verified, as did all eight per-file manifest digests. Archive paths were
  checked as relative and safe before extraction. This is NOT a reconstruction;
  the two code files are byte-identical to the reviewed candidate:
  - `backend/src/routes/luca-context.js` — `406b209848945bc25e3b2306529e701f48d953c7e407e8438809c053c405c8f6`
  - `backend/tests/luca-context-isolation.test.js` — `a5c2dc4cd4b203ccdec5c1e104313f640d44dd9f488c610505c66429406710ce`
- The archive's manifest records base commit and tree equal to the current base,
  so no rebase or adaptation to newer source was required.
- `agent/abacus-beta-v1-hardening` (`f7768043262c534fc974192fece56890560bc6e4`)
  and `agent/maple-luca-direct-1` (`af5eb2e909d40451045cf41b1e7ce74d9c54c13e`)
  were confirmed present and left untouched: not merged, edited or used as base.
  `luca.js` and Maple configuration are unchanged.

The route now takes its user ID exclusively from `req.user.userId`, the
authenticated `users.id` UUID. The JWT `sub` claim (permanent Solaris Subject ID
/ `public_ref`), `npub`, `did` and any query-supplied identifier are not
substituted for it. An optional scalar UUID `user_id` query value is only an
assertion of that same account, compared case-insensitively while the SQL binds
`req.user.userId`. Invalid values produce 400; a different valid account produces
403 for every role including admin; an invalid session subject produces 401 — all
before any account-context SQL. There is no role-based override. The existing JWT
and revocation middleware is unchanged and still enforced. Success fields are
preserved byte-compatibly. Query failures return a generic 500 and log only the
fixed marker `[luca-context] context unavailable`, with no database error
contents, account identifier, driver code or partial context.

## Changed paths owned by WEB-R1

1. `backend/src/routes/luca-context.js`
2. `backend/tests/luca-context-isolation.test.js`
3. `docs/beta-v1/contracts/CONTRACT-WEB-R1.md`
4. `docs/beta-v1/handoffs/HANDOFF-WEB-R1.md`

Exactly these four paths are committed. The archive's parallel DOCS-EVIDENCE-R2
documents (`README.md`, `docs/CURRENT-STATE.md`,
`CONTRACT-DOCS-EVIDENCE-R2.md`, `HANDOFF-DOCS-EVIDENCE-R2.md`) are deliberately
NOT published by this node and remain unchanged at base. No dependency, lockfile,
migration, seed, CI, runtime configuration or UI change is included.

## Validation actually performed

Runtime: Node `v22.22.2`, npm `10.9.7`, PostgreSQL `16` (container-local).
No backend `.env` exists in this checkout; none was created or copied.

Database target verification before any use: the local cluster contained only
`postgres`, `template0` and `template1` — no application or live data. A
dedicated disposable database `solaris_web_r1_synthetic` and role
`web_r1_synthetic` were created for this task. No shared or live database URL,
patient data, AI provider secret or real signing key was used, and no live
identity record was modified. The `luca_passport` fallback was never used.

| Check | Command | Result |
| --- | --- | --- |
| Locked install | `npm ci --ignore-scripts` | exit 0 |
| Lifecycle-hook inspection | package scripts audited before install | no `preinstall`/`install`/`postinstall`/`prepare` in either package.json |
| Focused suite (fixed route) | `jest --config <disposable> --runInBand tests/luca-context-isolation.test.js` | **51 collected, 51 passed, exit 0** |
| Focused suite (unchanged route) — control | same command, route restored from HEAD | **38 failed, 13 passed, exit 1** |
| Synthetic schema setup | `psql -f` for 9 `schema*.sql` files | exit 0, 57 tables |
| Synthetic migrations | `node-pg-migrate up -m migrations` | exit 0, 41 migrations applied, 106 tables |
| Full backend suite — base | `jest --runInBand --forceExit` at HEAD route, new test absent | 296 tests: **294 passed, 2 failed**, exit 1 |
| Full backend suite — with fix | `jest --runInBand --forceExit` | 347 tests: **345 passed, 2 failed**, exit 1 |
| Backend lint | `npm run lint` | exit 0, 0 errors, 10 pre-existing warnings, none in the changed files |
| Whitespace | `git diff --check` | exit 0 |
| Accepted-source integrity | SHA-256 of the two accepted contracts | unchanged (see below) |

The focused suite ran under a disposable explicit Jest configuration that matches
only `tests/luca-context-isolation.test.js` and does NOT inherit
`backend/tests/setup.js`, any `.env`, or the `luca_passport` fallback connection
string. `DATABASE_URL`, `JWT_SECRET` and `PGSSL` were explicitly unset for that
run. Collection was verified with `--listTests` and by the reported totals: the
51 cases were actually collected and executed, not assumed. The suite completed
in 0.65 s and exited cleanly without `--forceExit`, confirming `backend/src/db`
is fully mocked and no pool was opened. `node --check` and the archive's stub
handler harness were NOT treated as evidence of success.

### Control evidence that the suite detects the real flaw

Against the unchanged base route the same 51 cases produce 38 failures, including:

- `admin cannot select another account` — expected 403, **received 200**. The same
  200 occurs for patient, practitioner, staff and partner: the base route returned
  another account's private context to every authenticated role.
- `returns only a generic error on owner query failure` — expected the fixed
  marker, received `"luca context error:", [Error: WEB_R1_SYNTHETIC_PRIVATE_DETAIL]`,
  i.e. the base route logged the raw database error object.

All 51 pass with the repair. Negative tests therefore fail before and pass after.

### Baseline comparison

Same base, same disposable database, same fixtures, same commands:

- Base: 296 tests, 2 failed.
- With WEB-R1: 347 tests, 2 failed.
- Delta: **+51 tests, all passing; zero newly-introduced failures.**

The two residual failures are identical in both runs, in
`tests/intake-foundational.test.js`:

1. `POST /api/intake/submit persists foundational › self-initiated foundational
   submission saves Part A and reports foundationalSaved` — intake template row
   absent (`templateId` undefined).
2. `48h intake reminders are idempotent › sends exactly one reminder no matter how
   many times it runs` — `provider_profiles` empty, so `bookings.provider_id`
   violates its NOT NULL constraint.

Both are unchanged-baseline environmental failures caused by the absence of seed
data: `npm run seed`/`seed:reset` is not authorized for this task and was not run.
They are unrelated to `luca-context.js`. No baseline was lowered, skipped,
quarantined or represented as green, and no test was disabled.

## Accepted-source integrity

These files remain byte-identical to the base; no new acceptance is claimed:

- `IDENTITY-BINDING-CONTRACT.md`: SHA-256
  `c1b93933e80832656a9a3fe48ccf49b37f1441c03d28c09f9c04ea3d4e4a6fda`.
- `WEB-APP-V1-SPEC.md`: SHA-256
  `217c42034c424bffde47145797ae026f71fb0e91c923d6e4d4257c3dfb873b09`.

## Residual risks and delivery

This closes only the code path addressed by WEB-R1. It does not fix other LUCA
consent/egress paths, assessment/profile replacement, messaging encryption and
recovery, account-scoped browser caches, invitation credentials, export coverage,
fallback escalation, mutating GETs, or deployment/recovery controls.

Not deployed. The route repair exists only on the task branch and in its draft
pull request. The reported operator topology — frontends at `79f10b23` sharing a
backend at `f7768043`, pending migrations 039–042 and unverified backups —
remains unreconciled. A normal restart may select newer source and migration
hooks. Before delivery, resolve the effective startup configuration, recovery and
rollback evidence, then choose an explicitly compatible backport or a reviewed
backend upgrade. Do not deploy this branch wholesale as a one-route hotfix
against that shared service.

No migrations, seeds, runtime flags, dependencies, CI, frontend behavior, signing
keys, APKs or infrastructure changed in the repository. The synthetic database
created for verification is local to the ephemeral session container and is
discarded with it. A code revert is mechanically possible, but restores the
original access flaw; operational rollback must preserve the authorization
protection and be reviewed separately.

Next bounded task: SOV-01A-DISCOVERY-BOUNDARY. Not started here.
