# HANDOFF-WEB-R2 — trends isolation

Date: 2026-09-25. Status: source repair implemented and verified in an isolated cloud checkout
against disposable local PostgreSQL databases. Publication, merge and deployment state must be read
from subsequent Git/PR and operator evidence, not inferred from this file. No merge or deployment is
authorized by this node.

## Source and authority

- Base: `main` at `2cbeabe4ed5dff64053886587bc82cf7b92fa739`, tree
  `7410bfb18d007ff718e2664335b88485c4fe1cfe`. Remote `main` was re-fetched before editing and
  matched the authorization; nothing was reset.
- Starting local state: branch `claude/docs-arch-r3` at
  `aefa2364ef38abd8745004aaaf9bea692e001650`, zero uncommitted paths. The task branch
  `claude/web-r2-trends-isolation` was cut from `origin/main` at the base above.
- No open pull requests at start. `agent/maple-luca-direct-1` remained at
  `af5eb2e909d40451045cf41b1e7ce74d9c54c13e` and was not touched.
- Authority: Majd's `PROCEED WEB-R2 — TRENDS ISOLATION`, approving the behavior and six-file scope in
  [the contract](../contracts/CONTRACT-WEB-R2.md).

## Change

`backend/src/routes/trends.js` now takes its record-access identity only from `req.user.userId`.
The practitioner/admin override is removed. An optional `userId` query value is validated as one
canonical UUID-shaped string and compared case-insensitively with the session value; both trends
queries bind the original session `userId`. Invalid session `userId` returns 401, malformed input
400, and a different account 403 — each before either trends query. The catch block logs the fixed
marker `[trends] vitals unavailable` instead of the raw error. `gatherVitals`, `statsFor`,
`rangeToDate` and the `range` default are unchanged, and the existing 403 body `Not allowed` is kept.

`backend/tests/trends.test.js`: the foreign-account denial test is preserved with a distinct valid
synthetic UUID, still expecting 403. The former `999999` input — malformed rather than foreign — has
its own case expecting 400. No test was removed and the success assertions are unchanged.

`backend/tests/trends-isolation.test.js` (new) drives the real router and the real JWT/revocation
middleware with synthetic tokens and a fully mocked `backend/src/db`.

## User-facing impact

The practitioner patient-detail view (`src/components/LucaPassport.jsx`) renders
`<TrendCharts userId={selected.id} />`, which `src/components/TrendCharts.jsx` forwards as
`?userId=`. That view read patients' trends through exactly the path now closed, and will receive
403. The patient identifier it forwards is `users.id`, so the response is 403 rather than 400.
`TrendCharts` catches the error and sets its data to `null`, so it does not crash, but it then shows
its ordinary empty state: "No check-in data for this range / Daily check-ins will populate these
trends." That says there is no data, not that access was refused, so a clinician could believe the
patient has not been checking in — a misreading that could inform a care decision. This is the
approved consequence of own-account-only access. The frontend is outside the allowlist and is
unchanged; an explicit "not permitted" state is a recommended follow-up.

## Changed paths

1. `backend/src/routes/trends.js`
2. `backend/tests/trends.test.js`
3. `backend/tests/trends-isolation.test.js`
4. `docs/beta-v1/contracts/CONTRACT-WEB-R2.md`
5. `docs/beta-v1/handoffs/HANDOFF-WEB-R2.md`
6. `CHANGELOG.md`

## Validation actually performed

Runtime: Node `v22.22.2`, npm `10.9.7`, PostgreSQL `16` (container-local, `listen_addresses =
localhost`). No backend `.env` exists; none was created. Dependencies were reinstalled with
`npm ci --ignore-scripts` from the unchanged lockfile (exit 0) after confirming no lifecycle hooks.

| Check | Result |
| --- | --- |
| Focused suite, candidate route | 60 collected, 60 passed, exit 0; exited without `--forceExit` |
| Focused suite, unchanged route (negative control) | 33 failed, 27 passed, exit 1 |
| Full backend suite, base | 347 tests: 345 passed, 2 failed; exit 1 |
| Full backend suite, candidate | 408 tests: 406 passed, 2 failed; exit 1 |
| Backend lint, base and candidate | both exit 0, 0 errors, 10 warnings; identical warning sets, none in the changed files |

Each exit code above was written into its own log file at run time, not inferred from counts.

The focused suite ran under a disposable Jest configuration matching only
`tests/trends-isolation.test.js`, with `DATABASE_URL`, `JWT_SECRET` and `PGSSL` unset. It does not
inherit `tests/setup.js`, load `.env`, import `server.js` or open a database pool. It deliberately
does not set Express's query parser; instead it asserts that the default is `extended` and that
`server.js` contains no override, so the tested parsing is the production parsing. That assertion
is also tamper-evident: an upgrade to Express 5, whose default is `simple`, would fail it. It
restores `JWT_SECRET` after running so the synthetic secret does not leak into other suites in the
same process. The "does not inherit `tests/setup.js`" property holds for the disposable
configuration only; in the full `npm test` run the same file does run after `setup.js`, which is
harmless because the database is mocked and `setup.js` only sets environment variables and
globals.

### Negative control and the demonstrated leak

The focused suite exercises nine role strings: the four account roles `patient`, `practitioner`,
`provider` and `admin`, plus five GPS allocation-leg labels (`community_treasury`,
`infrastructure`, `onboarder`, `patient_education`, `software`) used as arbitrary role strings. The
application also has a `member` account role that is not in the list; because the candidate route
consults no role at all, every role string is treated identically. Against the unchanged route,
exactly `practitioner` and `admin` received 200 for another account; the other seven role strings
were already refused. A scratchpad demonstration using the
same mocked database recorded which account each query was bound to. On the unchanged route, a
practitioner or admin request with another account's `userId` returned 200 with **both** trends
queries bound to that other account, returning its mood, sleep, vitality and mental-health scores.
On the candidate route all three roles tested received 403 with zero trends queries.

The 27 control-passing cases are insensitive to the flaw by design: the parser-fidelity guard,
own-account success paths, the seven role strings the base already refused, JWT `sub`
non-substitution for the caller's own account, the prototype-shaped key, payload/statistics/range
preservation guards, and middleware-level authentication and revocation. Independent review
initially found that the test "a JWT sub naming another account does not authorize reading it" used
the `patient` role, which the base already refused, so it could not detect the flaw it names. It
now uses `admin` and fails on the unchanged route, moving the control from 32/28 to 33/27. The control also exposed a latent base defect: the case-sensitive comparison refused
an owner's own ID when spelled in uppercase.

### Baseline comparison

The two full runs used separate databases, `solaris_web_r2_base` and `solaris_web_r2_cand`, each
dropped, recreated and initialized identically by applying the nine `backend/schema*.sql` files and
then `node-pg-migrate up`. A query run **before either test run** recorded, for both: 106 tables,
41 applied migrations, zero users and the same checksum over every public column definition.
Neither run could therefore inherit the other's rows. No seed was run and no fallback or hosted
database was used. Target verification, per-file exit codes and error counts, and this equivalence
query are all written to a single evidence log.

Schema application is not error-free, and this was initially missed. `psql` exits 0 even when
statements fail unless `ON_ERROR_STOP` is set, so exit codes alone hide failures.
`schema_bookings.sql` produces 17 `ERROR:` lines and `schema_gps.sql` 12, all of the form
`relation "provider_profiles" does not exist` or a dependent relation, because they reference
tables that a later migration creates. The errors are byte-identical for both databases and the
subsequent migrations complete with exit 0, so the two databases remain equivalent. The same
condition affected the WEB-R1 verification, whose handoff reports schema application only as
exit 0.

Delta: **+61 tests, all passing; zero newly introduced failures.** The 61 are the 60 focused cases
and the new `999999` malformed-input case. The two failures are byte-identical in both runs, in
`backend/tests/intake-foundational.test.js`:

1. `POST /api/intake/submit persists foundational › self-initiated foundational submission saves
   Part A and reports foundationalSaved`
2. `48h intake reminders are idempotent › sends exactly one reminder no matter how many times it runs`

Both depend on seed data that is not authorized here. They are unrelated to trends and remain
unresolved. No test was skipped, disabled or quarantined and no baseline was lowered.
`backend/tests/trends.test.js` passed against the real database at both base and candidate.

## Independent review

Independent, author-uninvolved review of this complete candidate is a precondition for commit and
publication under the contract. Its reviewer, verdict and any resolved findings are recorded in the
pull request body and delivery report rather than here, so that this file carries no
self-referential digest.

## Residual risks and delivery

This closes only the trends read path. Consent enforcement, the outbound AI context boundary,
the SOV-01A discovery boundary, Maple convergence and the earlier production blockers in
[Current state](../../CURRENT-STATE.md) remain open.

Not deployed. A source merge would not patch any running backend. No migration, seed, restart,
dependency, authentication-middleware, frontend, CI or infrastructure change was made. The
synthetic databases are local to the ephemeral session container. Reverting this change would
restore the cross-account read and is not an acceptable operational rollback.
