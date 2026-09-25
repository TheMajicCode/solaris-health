# CONTRACT-WEB-R2 — trends isolation

Date: 2026-09-25. Status: implementation authorized by Majd's `PROCEED WEB-R2 — TRENDS ISOLATION`
instruction, which approves this bounded behavior and six-file scope and asks for the contract to be
written first. Commit and publication follow independent review. No merge or deployment is authorized.

## Source and authority

- Repository: `TheMajicCode/solaris-health`.
- Base: `main` at `2cbeabe4ed5dff64053886587bc82cf7b92fa739`, tree
  `7410bfb18d007ff718e2664335b88485c4fe1cfe`. Remote `main` was re-fetched before editing and
  matched this authorization exactly; nothing was reset.
- Task branch: `claude/web-r2-trends-isolation`, cut from that commit with a clean worktree.
- No open pull requests existed at start. `agent/maple-luca-direct-1` remains at
  `af5eb2e909d40451045cf41b1e7ce74d9c54c13e` and is not touched.
- Governance read: `AGENTS.md`, `CONTRIBUTING.md` (as revised by DOCS-ARCH-R3) and
  [Current state](../../CURRENT-STATE.md), whose open repair register names this flaw.

## The flaw

`GET /api/trends/vitals` in `backend/src/routes/trends.js` derived its record-access identity from
the query string whenever the caller held a `practitioner` or `admin` role:

```js
let userId = req.user.userId;
if (req.query.userId && req.query.userId !== req.user.userId) {
  if (req.user.role !== 'practitioner' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Not allowed' });
  userId = req.query.userId;
}
```

Any practitioner or admin could read any account's daily check-ins and assessment scores — energy,
mood, sleep, hydration, movement, nutrition and the vitality/mental/emotional/physical/spiritual
series — with no consent, care-relationship or expiry lookup. The comparison was also
case-sensitive, and the catch block logged the raw error object.

## Outcome and boundary

`req.user.userId`, the authenticated `users.id` UUID, is the sole record-access authority. The JWT
`sub` claim (the permanent Solaris Subject ID / `public_ref`), `npub`, `did` and any
query-supplied identifier are not substituted for it.

The optional `userId` query value becomes only an assertion of that same account:

| Condition | Result |
| --- | --- |
| Invalid or missing session `userId`, even with a valid `sub` or a matching query | 401, no trends SQL |
| Malformed, empty, valueless, duplicate, array or object `userId` query | 400, no trends SQL |
| A different valid UUID, for every role including admin | 403, before either trends query |
| Omitted, or equal ignoring case | 200, both queries bind the original session `userId` |
| Failure in either trends query | generic 500; one fixed log marker only |

There is no role-based override. Successful payloads, statistics and `range` handling are preserved
byte-compatibly. The authentication and revocation middleware is unchanged, including its existing
fail-closed 503 when revocation storage is unavailable; its revoked-token lookup is not a trends
query. Clinician access to another account's trends requires a separately specified consent and
care-relationship policy and is not reintroduced here.

Data: private daily check-ins and assessment scores. Actor: authenticated account owner. Consent:
self-access only. Failure: deny before reads; storage failures return a generic 500 without raw
error, SQL, identifiers or private data in the response or logs. No durable object, migration or
export representation changes.

## User-facing impact (disclosed, intended)

The practitioner patient-detail view in `src/components/LucaPassport.jsx` renders
`<TrendCharts userId={selected.id} />`, and `src/components/TrendCharts.jsx` forwards that value as
`?userId=`. That view currently reads the patient's trends through exactly the path this contract
closes. After this change it receives 403. `TrendCharts` catches load errors and sets its data to
`null`, so it does not crash — but it then renders its ordinary empty state, "No check-in data for
this range / Daily check-ins will populate these trends." That text says there is no data, not that
access was refused, so a clinician could reasonably conclude the patient has not been checking in.
In a clinical tool that misreading could inform a care decision. This is the owner-approved
consequence of own-account-only access; the frontend is outside this allowlist and is not changed.
A follow-up should show an explicit "not permitted" state, and restoring clinician trends requires
the separate consent/care policy above.

## Exact allowlist

1. `backend/src/routes/trends.js`
2. `backend/tests/trends.test.js`
3. `backend/tests/trends-isolation.test.js`
4. `docs/beta-v1/contracts/CONTRACT-WEB-R2.md`
5. `docs/beta-v1/handoffs/HANDOFF-WEB-R2.md`
6. `CHANGELOG.md`

No dependency, lockfile, authentication/revocation middleware, server bootstrap, migration, seed,
frontend, CI, hosting, Maple, wallet or unrelated cleanup change.

## Existing-test correction

`backend/tests/trends.test.js` currently asserts 403 for `?userId=999999`. That value is malformed,
not a foreign account, so under this contract it returns 400. The foreign-account denial test is
preserved using a distinct valid synthetic UUID and still expects 403; a separate case asserts
`999999` returns 400. No coverage is removed and the existing success assertions are not weakened.

## Acceptance and verification

A focused suite, `backend/tests/trends-isolation.test.js`, drives the real Express router and the
real JWT/revocation middleware with synthetic tokens and a fully mocked `backend/src/db`, using
Express's production query parser. It must not import `server.js`, inherit `tests/setup.js`, load
`.env` or open a database pool, and runs under a disposable explicit Jest configuration. It covers
every role, both case directions, malformed inputs, an invalid `userId` despite a valid `sub` and a
matching query, authentication and revocation failures, failure at each of the two trends queries,
and the absence of trends SQL on every denial. The legitimate revocation lookup may still occur.

Run the focused suite against the unchanged route as a negative control, and demonstrate the actual
privileged-user leak. Compare full backend results at base and candidate on equivalently initialized
disposable synthetic databases, after verifying each target is disposable; never inherit the
fallback database or hosted configuration, and run no seeds. Run backend lint, `git diff --check`
and an exact-scope check. Report real counts, exit codes and baseline failures without suppression.
Counts are not predeclared.

Independent review of the complete candidate precedes any commit or publication. After it passes,
commit, push the task branch and open a draft pull request. Later corrections use follow-up commits;
no force-push. Final diff digests are recorded outside the files they describe.

## Effects and rollback

No deployment, restart, production migration or dependency change. Reverting this node is
mechanically possible but would restore the cross-account read and is not an acceptable operational
rollback. A source merge does not patch any running backend.
