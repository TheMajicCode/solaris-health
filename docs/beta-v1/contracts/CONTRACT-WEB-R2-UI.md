# CONTRACT-WEB-R2-UI — trends chart states and stale-data isolation

Date: 2026-09-26. Status: implementation authorized by Majd's `PROCEED WEB-R2-UI` instruction,
which approves this behavior and five-path scope and asks for the contract to be recorded first.
Independent review precedes publication. The instruction authorizes commits, a normal push and a
draft pull request; merging is left to a later review. No deployment is authorized.

## Source and authority

- Repository: `TheMajicCode/solaris-health`.
- Base: `main` at `abf507a9eeafcb7e7d534438ff231343bd221dbe`, tree
  `f7d6b3cf0b09f96758ec7c785841451b53fd5d21` (the WEB-R2 merge). Remote `main` was re-fetched
  before editing and matched; nothing was reset.
- Task branch: `claude/web-r2-ui-trends-states`, cut from that commit with a clean worktree and no
  open pull requests. `agent/maple-luca-direct-1` remains at
  `af5eb2e909d40451045cf41b1e7ce74d9c54c13e` and is not touched.
- Governance read: `AGENTS.md`, `CONTRIBUTING.md`, [Current state](../../CURRENT-STATE.md) and the
  WEB-R2 [contract](CONTRACT-WEB-R2.md), whose Amendment 1 records this UI defect as unresolved.

## The defects

In `src/components/TrendCharts.jsx` at the base:

1. **Denial shown as "no data".** Every loader failure is caught and turned into `data = null`
   (line 106), which renders the ordinary empty state "No check-in data for this range". After WEB-R2
   the practitioner patient-detail view receives 403 for another account's trends, so a refused
   request is presented as a patient with no check-ins. The same happens for 401, network errors,
   timeouts and 5xx responses.
2. **Stale values across scopes.** Stat cards (lines 136-140) render from the last stored response
   regardless of loading state, so after a patient, account or range change the previous scope's
   numbers stay visible until the new response arrives.
3. **Late responses win.** `load` (lines 99-110) has no request generation. A slower earlier
   response, or its rejection, can overwrite a newer one, and its `finally` clears the loading flag
   while a newer request is still pending.
4. **Own-account mode ignores the signed-in user.** Without a `userId` prop the request scope does not
   include the viewer, so a change of signed-in account does not invalidate the previous result.
5. **Raw error logging.** The catch block logs the raw error object (line 106).

## Required behavior

| Loader outcome | Data area shows |
| --- | --- |
| Valid response with daily points | stat cards, daily chart and, when present, vitality chart — unchanged |
| Valid response, no daily points, vitality present | the daily empty message plus the vitality chart and stat card |
| Valid response, no daily points, no vitality | the existing "No check-in data for this range" message — **only** here |
| 403 | an explicit access-denied message; never the empty message |
| 401 | session guidance following the existing "Your session has expired. Please sign in again to …" wording |
| Network error, timeout, 5xx including 503 | a temporarily-unavailable state with a working Retry |
| Any other failure, or a response without a `points` array (or with non-array `vitality` / non-object `metrics`) | the unavailable state, not the empty state |
| Signed out (application context present, no user) | sign-in guidance; no request is made |

Error messages are fixed text. Server error bodies, error messages and payloads are never displayed,
and the component no longer logs error objects. The component does not change global
authentication state and does not log the user out. Successful charts, range controls, metric
toggles, tooltips and existing CSS classes are preserved.

## Stale-information design

- **Scope.** A request's scope is the signed-in viewer (`useApp().user.id`, read through the existing
  context without changing `AppContext`), the requested target `userId` (absent in own-account
  mode) and the range. Outside an application provider the viewer is treated as a fixed standalone
  value so the component still works in isolation.
- **Render-time isolation.** The data area is rendered by an inner component keyed by that scope. A
  scope change therefore mounts a fresh instance whose first committed render is the loading state:
  old stat cards, charts, vitality series and their tooltips cannot appear, without relying on a
  later effect to clear them.
- **Latest request wins.** Within a scope, Refresh and Retry advance a generation token. Each request
  runs in an effect whose cleanup marks it cancelled, so the success and rejection handlers of any
  superseded or unmounted request do nothing. The component keeps no separate loading flag, so there
  is no `finally` path through which a stale request could end a newer request's loading state.
  Results are displayed only when their generation equals the current one.
- **Cancellation is logical.** `src/lib/api.js` keeps its own `AbortController` and is not modified.
- **Loader identity.** The loader is read at request time, so a parent re-render that creates a new
  loader function does not by itself trigger a request; scope changes, Refresh and Retry do.

## Exact allowlist

1. `src/components/TrendCharts.jsx`
2. `src/__tests__/trendChartsStates.test.jsx` (new)
3. `docs/beta-v1/contracts/CONTRACT-WEB-R2-UI.md` (new)
4. `docs/beta-v1/handoffs/HANDOFF-WEB-R2-UI.md` (new)
5. `CHANGELOG.md`

No change to `src/lib/api.js`, `src/state/AppContext.jsx`, `LucaPassport.jsx`, the backend,
dependencies, lockfiles, CI or hosting. The pre-existing backend `range` validation defect stays for
its own task. The component remains English-only, as it is today.

## Validation

A focused Vitest suite uses synthetic fixtures, a mocked loader, a mocked `useApp`, deferred
promises and a lightweight `recharts` mock that exposes chart data as text. It covers successful,
empty and vitality-only results; 403, 401, network, timeout, 5xx/503, other 4xx and unusable
responses; that error text and bodies are never shown; patient and signed-in-account switches;
logout; range changes; overlapping Refresh and Retry; and unmount. Deferred promises prove that stale
success and rejection cannot replace current content or end newer loading. A React `Profiler`
records the DOM text of every commit, proving previous values are absent from the first committed
render after each scope change, not merely after effects run.

The same suite runs against the unchanged component as a negative control, which must detect the
denial-as-empty and stale-response defects. The frontend regression suite, production build, root
lint on the changed files and `git diff --check` run and are reported with real commands, counts and
exit codes. No backend database setup or backend suite rerun is needed.

## Effects and rollback

Frontend-only change to one component. No deployment, restart, migration or dependency change.
Reverting would restore denial-as-empty and stale cross-scope display.
