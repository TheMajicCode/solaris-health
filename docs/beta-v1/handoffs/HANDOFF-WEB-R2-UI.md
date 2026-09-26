# HANDOFF-WEB-R2-UI — trends chart states and stale-data isolation

Date: 2026-09-26. Status: implemented and verified in an isolated cloud checkout. Publication, merge
and deployment state must be read from Git, the pull request and operator evidence, not inferred
from this file. Merging is left to a later review; no deployment is authorized.

## Source and authority

- Base: `main` at `abf507a9eeafcb7e7d534438ff231343bd221dbe`, tree
  `f7d6b3cf0b09f96758ec7c785841451b53fd5d21`. Remote `main` was re-fetched before editing and
  matched; nothing was reset.
- Starting local state: branch `claude/web-r2-trends-isolation` at
  `e20fac5364b9688fb6da238a3f2e13620119d15b`, zero uncommitted paths, no stashes. The task branch
  `claude/web-r2-ui-trends-states` was cut from `origin/main` at the base above. No open pull
  requests. `agent/maple-luca-direct-1` remained at `af5eb2e909d40451045cf41b1e7ce74d9c54c13e`.
- Authority: Majd's `PROCEED WEB-R2-UI`, approving the behavior and five-path scope in
  [the contract](../contracts/CONTRACT-WEB-R2-UI.md), which was recorded before implementation.

## Change

`src/components/TrendCharts.jsx`:

- **States.** A loader failure is classified from its HTTP status and the transport flags set by
  `src/lib/api.js`: 403 → access denied; 401 → session guidance ("Your session has expired / Please
  sign in again to view trends.", matching the existing wording in `MyBookings.jsx` and
  `ProviderDetailModal.jsx`); everything else → temporarily unavailable, with Retry. A response is
  used only if it is an object with a `points` array, and with `vitality` an array and `metrics` an
  object when present; otherwise it is unavailable. The empty message is reached only from a valid
  response with no daily points. Messages are fixed text; error messages and bodies are never shown,
  and the former `console.error('trends load', e)` is removed.
- **Scope isolation.** The signed-in viewer is read with `useApp()` (null-safe; `AppContext` is not
  changed). The data area is an inner component keyed by `[viewer, userId, range]`, so a patient,
  account or range change mounts a fresh instance whose first committed render is the loading state.
  When a provider is present without a user, the panel shows sign-in guidance and makes no request.
- **Latest request wins.** Refresh and Retry advance a generation. Each request runs in an effect whose
  cleanup marks it cancelled; a cancelled request's success and rejection handlers do nothing. There
  is no separate loading flag and no `finally`, so a superseded request cannot end a newer loading
  state. A result is displayed only when its generation matches the current one.
- **Preserved.** `METRICS`, `RANGES`, `fmtAxis`, the CSS, `CustomTooltip` and `StatCard` are
  byte-identical to base. The line-chart and area-chart markup is identical apart from indentation,
  and the range buttons are unchanged. The metric chips and the Refresh button keep their markup but
  now call `onToggleMetric` and `refresh` instead of `toggleMetric` and `load`. The loading and empty
  containers gained `role="status"` (see difference 5).
- **Props contract.** The header comment now states that the target account must be passed as
  `userId`, not captured inside `loader`, because results are scoped, invalidated and refetched by
  that prop. Both current callers already do this.

Deliberate behavior differences a reviewer should know:

1. A parent re-render that passes a new `loader` function no longer triggers a request by itself; the
   loader is read at request time. Requests follow scope changes, Refresh and Retry. Both callers
   pass an inline arrow, so the base refetched on every parent re-render.
2. During a Refresh in the same scope, stat cards and charts are hidden until the new result arrives,
   instead of the base behavior of keeping the stale stat cards and vitality chart beside a loading
   daily chart.
3. The unused `annotations` memo (computed but never rendered at base) is gone with the restructured
   data flow. Nothing rendered depended on it.
4. A loader result without a `points` array is now shown as unavailable. The only existing test that
   mocks this loader (`investorRcFixesE1.test.jsx`, returning `{}`) asserts nothing about trends and
   still passes.
5. State containers now carry roles: `role="status"` for loading, empty and signed-out, and
   `role="alert"` for access denied, session and unavailable.
6. The component reads `useApp()`, so it now re-renders whenever the application provider does
   (the provider value is a new object each render). This causes no additional requests.

## Validation actually performed

Runtime: Node `v22.22.2`, npm `10.9.7`. Root dependencies were installed with
`npm ci --ignore-scripts` from the unchanged lockfile (exit 0, written to its log) after confirming
no lifecycle hooks. Every exit code below was written into its log at run time.

| Check | Command | Result |
| --- | --- | --- |
| Focused suite, candidate | `npx vitest run src/__tests__/trendChartsStates.test.jsx` | 45 passed, exit 0 |
| Focused suite, original component (negative control) | same, with the base component restored | 39 failed, 6 passed, exit 1 |
| Frontend suite, base | `npx vitest run` | 92 files, 678 passed, exit 0 |
| Frontend suite, candidate | `npx vitest run` | 93 files, 723 passed, exit 0 |
| Build, base and candidate | `npm run build` | both exit 0 |
| Lint, changed files | `npx eslint src/components/TrendCharts.jsx src/__tests__/trendChartsStates.test.jsx` | 0 problems, exit 0 |
| Lint, `TrendCharts.jsx` at base | `npx eslint src/components/TrendCharts.jsx` | 0 errors, 3 warnings, exit 0 |
| Lint, whole repository | `npm run lint` | base 265 problems (35 errors, 230 warnings), exit 1; candidate 262 (35 errors, 227 warnings), exit 1 |
| Whitespace | `git diff --cached --check` | exit 0 |

The full-suite difference is exactly the new file's 45 tests; no existing test changed result. The
whole-repository lint failure is pre-existing: the 35 errors are an identical set of file and rule at
base and candidate, in other files, and the candidate removes exactly the three base warnings in
`TrendCharts.jsx`.

These are the second-round results. The first candidate's suite had 43 tests (43 passed; 37 failed and
6 passed on the original; 721 in the full suite). Independent review of that candidate led to the
test changes described below; its logs are retained separately and not overwritten.

### How the focused suite works

Synthetic fixtures only. The loader returns a fresh deferred promise per call, so settlement order is
controlled exactly. `useApp` is mocked to drive the signed-in viewer. `recharts` is replaced by
components that print the data they receive, so chart contents are visible as text. A React
`Profiler` records the document text at every commit. Each fixture carries a unique marker number,
so a marker's presence proves which response is on screen.

It covers: success, valid empty and vitality-only results; the target parameter; range controls; use
of the latest loader for later requests; standalone use outside a provider; 403, 401 (without
logging out), network, timeout, 500/502/503/504, 400/404/409, errors without status, non-Error
rejections, eight unusable response shapes and a synchronous throw; that private error text is never
shown or logged; Retry; patient, signed-in account, logout and range scope changes, each checked on
the **first committed render** and against late success and rejection; overlapping Refresh and
Retry; loader identity; and unmount.

### Negative control

Against the unchanged component, the 6 passing cases are the preservation tests (success, empty,
vitality-only, target parameter, range controls, standalone), which should behave the same in both.
Of the 39 failures, 36 detect base defects:

- Failure-state cases fail because the base shows "No check-in data" or has no Retry. The non-array
  `vitality` case fails because the base crashes (`TypeError: vitality.map is not a function`).
- Scope cases fail because the previous scope's marker appears in a recorded commit, or because a late
  settlement ended the newer loading state.
- "An older success cannot replace a newer one" fails because, after the older request resolves, the
  base shows the older result in place of the newer one.
- "Never logs" and the unmount case fail because the base logs the raw error object. React 19 does not
  report state updates after unmount, so the unmount guard itself is not directly observable.

Three failures are not defect detections; they assert deliberate differences: "Refresh hides the
previous result" (difference 2), and "a later request in the same scope uses the latest loader" and
"a new loader function … does not start a request by itself" (difference 1).

### Probe validity

To show the first-commit checks observe the first committed render rather than the state after
effects, a scratchpad-only mutant of the base component that clears stale data in its effect was run
against the patient-switch test. It fails at exactly
`expect(t.commits[before]).not.toContain('5101')` — the first-commit assertion — which an
after-effects check would miss. The mutant was never part of the candidate.

Independent review ran further mutants. One that removed the loader-ref update passed every first-round
test; the second round adds "a later request in the same scope uses the latest loader", and that
mutant now fails exactly that test and no other.

## Limitations

- Tests run in jsdom with `recharts` mocked, so real chart drawing, the Brush and hover tooltips are
  not exercised. Tooltips are children of the charts, which are rendered only for a current,
  matching result.
- No manual browser check was performed. The copy is English-only, as the component was before.
- After Retry is pressed, its button is replaced by the loading state, so keyboard focus returns to
  the document body.
- The unmount guard cannot be observed through the DOM in React 19; the unmount test shows only that
  late outcomes render nothing, request nothing and log nothing.
- Access remains own-account-only by policy (WEB-R2), so the practitioner patient-detail view will now
  show the access-denied message rather than trends.
- The pre-existing backend `range` defect (built-in property names return 500) is unchanged and left
  for its own task. This UI sends only the five supported ranges, so it does not trigger it; any 500
  would be shown as unavailable.
- CI is not wired; no CI status is claimed. Not deployed.

## Independent review

Independent, author-uninvolved review of this complete candidate is a precondition for commit and
publication under the contract. Its reviewer, verdict and resolved findings will be recorded in the
pull request body. This file notes only how review changed the tests and evidence, and carries no
verdict or self-referential digest.

## Evidence retention

Raw logs are kept in the session scratchpad, outside the repository, frozen by two SHA-256 manifests:
one for the first review round and one for the second. A sanitized copy with checksums is to be
exported outside the repository after publication; its identity will be reported in the pull request
and delivery report rather than here. The logs are not
committed and may not outlive the session container. Nothing unavailable has been reconstructed.
