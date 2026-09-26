# HANDOFF-WEB-R2 — trends isolation

Date: 2026-09-25. Status: source repair implemented and verified in an isolated cloud checkout
against disposable local PostgreSQL databases. Publication, merge and deployment state must be read
from subsequent Git/PR and operator evidence, not inferred from this file. The original node
authorized no merge; a normal pull-request merge was later authorized by Amendment 1 of
[the contract](../contracts/CONTRACT-WEB-R2.md) (2026-09-26). No deployment is authorized.

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
patient has not been checking in — a misreading that could inform a care decision.

Only the **access restriction** is owner-approved. The **display** is not: showing a denied request as
"no data" is a known, unresolved UI defect in `TrendCharts`, which does not distinguish a refused
request from a successful empty response. It is to be fixed by a separate WEB-R2-UI contract. The
frontend is outside this node's allowlist and is unchanged.

## Changed paths

1. `backend/src/routes/trends.js`
2. `backend/tests/trends.test.js`
3. `backend/tests/trends-isolation.test.js`
4. `docs/beta-v1/contracts/CONTRACT-WEB-R2.md`
5. `docs/beta-v1/handoffs/HANDOFF-WEB-R2.md`
6. `CHANGELOG.md`
7. `docs/API.md` — Trends section only, added by Amendment 1

## Validation actually performed

Runtime: Node `v22.22.2`, npm `10.9.7`, PostgreSQL `16` (container-local, `listen_addresses =
localhost`). No backend `.env` exists; none was created. Dependencies were reinstalled with
`npm ci --ignore-scripts` from the unchanged lockfile after confirming no lifecycle hooks; its exit 0
was observed in the shell but not written into its log.

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
were already refused.

A scratchpad demonstration using the same mocked database recorded which account each query was
bound to. On the unchanged route, a practitioner or admin request with another account's `userId`
returned 200 with **both** trends queries bound to that other account, returning its mood, sleep,
vitality and mental-health scores. On the candidate route all three roles tested received 403 with
zero trends queries. The demonstration script is retained, but its console output was not saved to
a log file; it is recorded only in the session transcript. The independent reviewer re-ran the
script against the candidate and separately rebuilt the base route in memory, reproducing both
results. Codex's separate handler-level checks, as reported by the owner, also reproduced the
practitioner/admin leak; they do not replace the Jest/PostgreSQL evidence here.

The 27 control-passing cases are insensitive to the flaw by design: the parser-fidelity guard,
own-account success paths, the seven role strings the base already refused, JWT `sub`
non-substitution for the caller's own account, the prototype-shaped key, payload/statistics/range
preservation guards, and middleware-level authentication and revocation. Independent review
initially found that the test "a JWT sub naming another account does not authorize reading it" used
the `patient` role, which the base already refused, so it could not detect the flaw it names. It
now uses `admin` and fails on the unchanged route, moving the control from 32/28 to 33/27. The
logs of the earlier 60-passed and 32/28 runs were overwritten by the reruns and are not available;
those figures are history, not current evidence. The control also exposed a latent base defect: the
case-sensitive comparison refused an owner's own ID when spelled in uppercase.

### Baseline comparison

The two full runs used separate databases, `solaris_web_r2_base` and `solaris_web_r2_cand`, each
dropped, recreated and initialized by the same procedure: the nine `backend/schema*.sql` files, then
`node-pg-migrate up`. A query run **before either test run** recorded, for both: 106 tables,
41 applied migrations, zero users and the same checksum over every public column name and data
type. Because each run had its own database, neither could inherit the other's rows. No seed was run
and no fallback or hosted database was used. Target verification, per-file exit codes and error
counts, and this comparison query's results are written to a single evidence log; the query
definition — an MD5 over `table.column:data_type` for public columns — is recorded only in the
session transcript.

Those matching measures support **comparable initialization on those measures**. They do not prove
complete database equivalence — for example constraints, indexes, defaults, nullability, triggers,
view definitions, functions and sequence state were not compared — and they do not show an error-free installation. The first database pair was used before
the first independent review; its findings N2 (database-comparison claims not backed by a log) and N5
(a test unable to detect the flaw it names) led to the rebuild and rerun. That pair's logs were
overwritten and its comparison query was never logged.

Schema application is not error-free, and this was initially missed. `psql` exits 0 even when
statements fail unless `ON_ERROR_STOP` is set, so exit codes alone hide failures.
`schema_bookings.sql` produces 17 `ERROR:` lines and `schema_gps.sql` 12, all of the form
`relation "provider_profiles" does not exist` or a dependent relation, because they reference
tables that a later migration creates. The errors are byte-identical for both databases and the
subsequent migrations complete with exit 0. That is consistent with comparable initialization, but
it is not evidence of an error-free or fully equivalent installation. The same condition affected
the WEB-R1 verification, whose handoff reports schema application only as exit 0.

**Which source each run used.** The test counts are consistent with the intended checkouts but do not
by themselves establish them. The direct evidence is limited:

- Immediately before the base run, the run command wrote `backend/src/routes/trends.js` and
  `backend/tests/trends.test.js` from `git show 2cbeabe4…` and removed
  `backend/tests/trends-isolation.test.js`. Before the candidate run it restored the candidate
  files and byte-compared each with a saved copy. These commands are recorded only in the session
  transcript, not in the logs.
- `full-base.log` lists 37 distinct suites with no `trends-isolation.test.js`; `full-cand.log` lists
  38 including it. This records the test-file set of each run, but not the content of the route file.
- A check printed during the base run was flawed — it compared against the git index, which held the
  staged candidate — and is not evidence. The same construction was afterwards re-run and verified
  with `git diff --quiet HEAD -- <paths>` plus an absence check, confirming it yields the base files;
  that verification output was not saved to a log.

Delta: **+61 tests, all passing; zero newly introduced failures.** The 61 are the 60 focused cases
and the new `999999` malformed-input case. The two failures are byte-identical in both runs, in
`backend/tests/intake-foundational.test.js`:

1. `POST /api/intake/submit persists foundational › self-initiated foundational submission saves
   Part A and reports foundationalSaved`
2. `48h intake reminders are idempotent › sends exactly one reminder no matter how many times it runs`

Both depend on seed data that is not authorized here. They are unrelated to trends and remain
unresolved. No test was skipped, disabled or quarantined and no baseline was lowered.
`backend/tests/trends.test.js` passed against the real database at both base and candidate.

## Finalization amendment (2026-09-26)

Under Amendment 1, `main` had advanced from `2cbeabe4…` to
`13f04c060475fef507345d8ce3c8d49c86c1edd0` through Markdown-only commits (`README.md`, the
`docs/API.md` title and a new `docs/VISION.md`); no code, dependency, test or CI file changed. The
reviewed pull request head `b18293e353f246a74abfce78230f3f40200e32b3` is unchanged. This amendment
corrects documentation only: the Trends section of `docs/API.md`, this handoff, the contract (by an
appended amendment) and `CHANGELOG.md`. The backend route and both test files are unchanged.

A prospective merge of that head, plus these corrections, with freshly fetched `main` was built in a
disposable worktree. The merge was clean; the result keeps the newer "Sovereign Passport" title,
`README.md` and `docs/VISION.md` exactly as on `main`; and its `backend/` tree is byte-identical to the
reviewed head. After a lockfile install (exit 0; the final pass reused that install via symlink, with a
byte-identical lockfile), the focused trends suite discovered exactly
`tests/trends-isolation.test.js` and passed 60 of 60, exit 0. The full database suites were not
repeated for these prose corrections; the results above remain the recorded evidence.

**Evidence retention.** The raw logs are kept in the session scratchpad, outside the repository,
and were frozen with a SHA-256 manifest before these corrections. They are not committed and may not
outlive the session container. Nothing unavailable has been reconstructed.

## Independent review

Independent, author-uninvolved review of this complete candidate is a precondition for commit and
publication under the contract. Its reviewer, verdict and any resolved findings are recorded in the
pull request body and delivery report rather than here, so that this file carries no
self-referential digest.

## Residual risks and delivery

This closes only the trends read path. A pre-existing `range` defect remains: names of built-in object
properties (for example `range=constructor`) make `rangeToDate` produce an invalid date, so the
request returns the generic 500. It exposes no data, and since this change it logs only the fixed
marker; `rangeToDate` is unchanged from base, and the fix is carried forward as a follow-up recorded
in the pull request body. Consent enforcement, the outbound AI context boundary,
the SOV-01A discovery boundary, Maple convergence and the earlier production blockers in
[Current state](../../CURRENT-STATE.md) remain open.

Not deployed. A source merge would not patch any running backend. No migration, seed, restart,
dependency, authentication-middleware, frontend, CI or infrastructure change was made. The
synthetic databases are local to the ephemeral session container. Reverting this change would
restore the cross-account read and is not an acceptable operational rollback.
