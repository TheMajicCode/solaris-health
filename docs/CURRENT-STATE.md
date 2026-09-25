# Current state — 24 September 2026

This is a dated source/evidence register, not a live status endpoint or production approval. Update its anchors when later work changes them. The owner's September direction is described in [Economic Passport architecture](ECONOMIC-PASSPORT-ARCHITECTURE.md). Historical contracts remain discoverable and do not prove implementation of the new direction.

## Evidence categories

- **Source inspected:** pinned repository content or GitHub metadata examined during this review.
- **Recorded test result:** another execution's retained/reportable result; not a new test run here.
- **Operator report:** deployment evidence supplied by Abacus; not independently re-read from the host here.
- **Owner direction/report:** intended design or collaboration reported by the owner.
- **Not verified:** missing execution, deployment, acceptance or integration evidence.

## Source anchors

| Item | Source inspected |
| --- | --- |
| Repository | `TheMajicCode/solaris-health` |
| Main at review | `bb0bcf5beb54e956ac8eb046eb38483ac62ec4bf` |
| Main tree | `a6350bbe98b2492cf7e44ad60db59c9351a13799` |
| WEB-R1 | [PR #3](https://github.com/TheMajicCode/solaris-health/pull/3), merged 22 September 2026; reviewed commit `fab59fb8bcf825e7cb48be6a1e578e45aed316ed` is a merge parent |
| Merge identity | Main's tree equals the reviewed candidate's tree; no extra merge content |
| Maple branch | `agent/maple-luca-direct-1` at `af5eb2e909d40451045cf41b1e7ce74d9c54c13e`; three commits ahead and four behind inspected main |
| CI/protection | Complete inspected tree has no `.github/workflows`; main branch API reported unprotected. No CI pass is inferred. |

This register's anchors precede the documentation commit that adds it. No new application tests, live endpoints, patient records or deployment operations were exercised for this documentation review.

## What is integrated

The [LUCA context route](../backend/src/routes/luca-context.js) uses session `userId` as query authority. Invalid session subjects receive 401; malformed query IDs receive 400; valid foreign IDs receive 403 for every role before context SQL. The [focused tests](../backend/tests/luca-context-isolation.test.js) cover meaningful ownership, parsing, authentication and failure cases. Fresh static inspection found no introduced blocker; it does not replace execution evidence.

Recorded WEB-R1 results from Claude's handoff:

| Run | Recorded result |
| --- | --- |
| Focused fixed route | 51 passed |
| Focused unchanged-route control | 38 failed, 13 passed |
| Full backend at base | 294 passed, 2 failed |
| Full backend with fix | 345 passed, 2 failed |
| Frontend | 92 files, 678 tests passed |
| Backend lint | Exit 0, no errors; pre-existing warnings reported |

The same two `intake-foundational.test.js` failures were reported at base and fix and attributed to missing synthetic fixture data. This is **not an all-green backend result**. CI remains unwired in the inspected tree. These suites were not re-run for this review. See the [WEB-R1 handoff](beta-v1/handoffs/HANDOFF-WEB-R1.md).

## Source and runtime are still divergent

The supplied Abacus trigger investigation reported frontend releases `79f10b23` and a systemd backend materialized from Maple `af5eb2e`, with preview and public domains sharing that backend/database. It also reported a separate legacy Docker deployment. This is operator-reported historical state, not fresh proof of what is serving today.

The operator reported manual VM deployment and migration execution on backend restart. Do not infer that merging WEB-R1 patched that Maple runtime. Source convergence, backup/restore evidence, isolated preview and controlled deployment remain distinct work. Retired hosting integrations are not part of this sprint.

## Open repair register

| Priority / scope | Evidence and required outcome |
| --- | --- |
| **WEB-R2: trends access** | [trends.js](../backend/src/routes/trends.js) permits practitioner/admin cross-account reads without a care/consent lookup. Minimum repair proposal: own-account reads for all roles, validated IDs, generic errors and a failing-old-route control. Any practitioner access needs a separately specified policy. |
| **Consent / AI boundary** | [consent.js](../backend/src/routes/consent.js), [luca-practitioner.js](../backend/src/routes/luca-practitioner.js) and [provider/patients.js](../backend/src/routes/provider/patients.js) omit consent-expiry checks in the inspected paths. Practitioner AI sends assembled context separately from redacted message text. Repair consent enforcement and the entire outbound payload boundary. |
| **Maple DIRECT-3 and source convergence** | The unchanged `af5eb2e` candidate has unresolved response-size, disconnect and provenance findings from its retained independent review, confirmed by a fresh static recheck. Fix and validate those before integrating the diverged branch; do not blindly merge it into main. Owner activation and deployment are separate decisions. |
| **SOV-01A: discovery boundary** | [server.js](../backend/src/server.js) mounts clinical routes and schedules intake reminders without a discovery-only guard. Define exact allowed methods/endpoints and stop clinical background jobs in that profile. Existing `/api/metrics` returns live clinical row counts on its unauthenticated JSON path and is not an appropriate default public allowlist entry. |
| **CI and isolated fixtures** | Wire real checks against disposable infrastructure and repair fixture-dependent failures without skips or lowered baselines. Historical CI drafts are not release gates. |
| **Earlier production blockers** | Assessment/profile preservation and consent defaults; message encryption nonce/key recovery; account-scoped LUCA cache; legacy invitation logging; export completeness and restore; urgent-symptom fallback; writes behind GET/read-only mode. Earlier findings are still open until a pinned repair and relevant evidence close each. |
| **Payments and rewards** | New Breez/WDK/Bark/RGB, ramp, Alby, BTC Map and GPS integrations need separate implementation and recovery evidence. Documentation does not enable them. |

The direct Spark dependency and legacy wallet/NFT components remain in this source. They are not proof of Breez SDK integration, an issued passport NFT, settled GPS allocations or token value. No code, dependencies or user wallet state are removed by this documentation change.

## Delivery order

1. Merge the bounded documentation alignment under `DOCS-ARCH-R3` after review.
2. Close the narrow trends authorization flaw in `WEB-R2`; preserve WEB-R1 behavior.
3. Repair Maple and review source convergence. Complete consent/provider-boundary repairs before permitting health context to leave its intended boundary.
4. Implement and test the discovery profile, including background jobs; establish isolated preview, verified recovery and real CI before promotion.
5. Define the Economic Passport receipt contract, then test one Bitcoin adapter. Add WDK/MoonPay and experimental RGB rewards in separate bounded stages.

Android acceptance, mobile data continuity, clinic companions and P2P transport remain separate workstreams. Keep working vault data, keys and accepted identity contracts intact. The next implementation contract must identify its actual source, dependencies, changed paths and acceptance evidence.
