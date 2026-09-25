# HANDOFF-DOCS-ARCH-R3

## Preparation status

Prepared on 24 September 2026 from remote source at `bb0bcf5beb54e956ac8eb046eb38483ac62ec4bf`, tree `a6350bbe98b2492cf7e44ad60db59c9351a13799`. This is a reviewable draft; it has not been applied to GitHub, committed, pushed or merged by its preparer. The separate delivery pack records patch checks and independent documentation review.

The candidate changes eight documentation paths listed in [the contract](../contracts/CONTRACT-DOCS-ARCH-R3.md). It corrects public claims and records the owner's intended architecture. No SDK, token, wallet migration, AI activation or discovery profile is implemented here.

## Evidence used

- Fresh GitHub metadata: PR #3 merged, main tree matches reviewed WEB-R1 tree, Maple still diverged, no open PR at review, no active workflow files in the complete inspected tree.
- Pinned source inspection: README and governance, contributor/release documents, package manifests, wallet/Spark placeholders, WEB-R1 route/tests and adjacent security/discovery paths.
- Recorded WEB-R1 test counts from Claude's handoff; not re-executed here and not summarized as an all-green backend suite.
- Owner-supplied Abacus runtime/trigger reports; not a fresh host inspection.
- Official upstream SDK/protocol references linked in [the target architecture](../../ECONOMIC-PASSPORT-ARCHITECTURE.md), plus the owner's current product direction.

## Claude execution record — complete with actual values

- **Actual starting state.** Remote `main` re-fetched at `bb0bcf5beb54e956ac8eb046eb38483ac62ec4bf`,
  tree `a6350bbe98b2492cf7e44ad60db59c9351a13799` — identical to the pack's observed base, so no
  base adaptation was needed and the old `79f10b23` base was not used. The session's local branch
  was `claude/web-r1-context-isolation-y7kpm5` at `fab59fb8bcf825e7cb48be6a1e578e45aed316ed` with a
  clean worktree (zero uncommitted paths). The task branch `claude/docs-arch-r3` was cut from
  `origin/main` at `bb0bcf5beb54e956ac8eb046eb38483ac62ec4bf`, tree
  `a6350bbe98b2492cf7e44ad60db59c9351a13799`.
- **Owner authorization accepted.** `PROCEED DOCS-ARCH-R3` for the eight-path documentation scope,
  covering apply/validate/review/commit/push/PR/normal-merge without repeated generic approval.
  No base adaptation was required; no allowlist widening, reset, force-push or unrelated branch
  merge occurred. The Maple branch was fetched read-only for verification and was not modified.
- **Final changed paths.** Exactly the eight allowlisted documentation files; set equality against
  `ALLOWLIST.json` confirmed programmatically, with nothing outside it and nothing omitted.
- **Checks actually performed.**

  | Check | Result |
  | --- | --- |
  | `sha256sum -c SHA256SUMS` | 16 of 16 files OK |
  | Patch digest vs `PATCH-MANIFEST.json` | match (`a1e58e1c…`) |
  | Archive path safety | all relative; no absolute paths or `..` traversal |
  | Base blobs vs manifest | 4 present files match both `git_blob` and `sha256`; 4 new files confirmed absent at base |
  | `git apply --check` | exit 0 |
  | `git apply` | exit 0 |
  | Reconstruction vs `candidate/` | 8 of 8 byte-identical at apply, before this record was completed |
  | Scope vs allowlist | exact match, 8 paths |
  | `git diff --cached --check` | exit 0 |
  | Relative file links | 37 checked, 0 broken |
  | Factual spot-checks | Maple `af5eb2e9…` 3 ahead / 4 behind, merge base `79f10b23…`; `trends.js` practitioner/admin cross-account read present; `server.js` schedules intake reminders at startup; `/api/metrics` queries clinical tables; no `.github/workflows` in the tree |

- **Independent review.** An author-uninvolved, read-only reviewer inspected the complete applied
  eight-path candidate against this repository. Its identity, verdict and any resolved findings are
  recorded in the pull request body and the delivery report rather than here, to keep this file free
  of self-referential digests. The pack's own prior draft review is retained at `DOCS-REVIEW.md`
  inside the delivery pack and is not restated as new evidence.
- **Blockers and residual limitations.** None blocking publication. This is documentation-only work:
  no dependency installation, application test run, database operation, host inspection, migration,
  seed, restart or deployment was performed, and none was required. The WEB-R1 suite results above
  remain *recorded* results that were not re-executed here, including the two unresolved
  `intake-foundational.test.js` fixture failures. There is still no active CI in the tree, so no CI
  status is claimed for this pull request. This record's completion changes the delivery diff, so it
  is no longer byte-identical to the pack's draft patch; that is expected and is stated plainly
  rather than claimed otherwise.

Do not put the final candidate diff digest inside this file: that would make the digest self-referential. Keep candidate/final diff hashes in external PR/chat evidence. Do not commit guessed future commit or merge SHAs into this file. After committing, report actual commit/tree/PR/merge identifiers in the PR body and final chat response, with the final reviewed diff digest. Re-review any substantive change made while completing this record.

## Carried forward

WEB-R2 trends isolation; Maple DIRECT-3/source convergence; consent and complete outbound-AI context enforcement; SOV-01A discovery routes and background jobs; isolated CI/preview/recovery; staged Economic Passport adapters and receipts. No production-readiness claim or operational authorization follows from this documentation PR.
