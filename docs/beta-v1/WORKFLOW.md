# Solaris Health Beta V1 -- Workflow Reference

Governance node: G0-GOVERNANCE (2026-08-06)
Authoritative source: docs/contracts/G0-governance.md

This document is the self-contained workflow reference for any new Abacus session
working on this repository. Read this before any task.

---

## 1. TWO-LADDER SOURCE HIERARCHY

When normative intent and observed behavior disagree, record a contract-versus-
implementation gap and stop. Do not let current code silently rewrite policy. Do not
let a report overrule an accepted contract.

### 1A. NORMATIVE AUTHORITY (policy, intent, rules)

  1. Majd's current explicit instruction and HUMAN decisions
  2. Accepted IDENTITY-BINDING-CONTRACT.md and WEB-APP-V1-SPEC.md
  3. Exact repository copies of those sources (docs/beta-v1/)
  4. Accepted governance contracts (docs/contracts/)
  5. Kickoff context (11-ABACUS-BETA-V1-KICKOFF-CONTEXT.md, 2026-08-05)
  6. Earlier sprint plans, reports, architecture exports

### 1B. DESCRIPTIVE EVIDENCE (what the code actually does)

  1. Exact checked-out source and executable tests at the named commit
  2. Same-commit command and runtime evidence (exit codes, test output)
  3. Accepted B0-CORRECTION-POST-S1A v2 report with Codex corrections (2026-08-06)
  4. Repository documentation, earlier reports, architecture exports

---

## 2. CONTRACT-BEFORE-CODE AND WAIT LOOP

For every implementation node:

  Step 1  Verify current branch, commit, and clean/known worktree.
          Use: git rev-parse HEAD
               git cat-file -p HEAD | grep tree
               git status --porcelain=v1 --untracked-files=all

  Step 2  Inspect only the named surface and its direct dependencies.
          Do not read unrelated files or run broad searches.

  Step 3  Write docs/beta-v1/contracts/CONTRACT-<NODE>.md containing:
            - one outcome and explicit non-goals
            - exact starting commit
            - data class, actor, authorization, consent, failure direction, export impact
            - exact file allowlist (every path named explicitly)
            - GIVEN/WHEN/THEN acceptance tests and negative tests
            - migration, rollback, dependency, and deployment effects
            - commands that will verify the node (with explicit exit-code capture)

  Step 4  STOP and wait for Majd's "PROCEED <NODE>".

  Step 5  After approval, change only allowlisted files. If another file is required,
          stop and amend the contract first.

  Step 6  Run the named tests plus the unchanged relevant baseline. Capture Jest exit
          code before any pipe:
            npx jest --runInBand --forceExit > /tmp/<node>-jest.log 2>&1
            jest_rc=$?
            tail -20 /tmp/<node>-jest.log
            echo "JEST_EXIT=$jest_rc"
          Never lower test counts, disable tests, weaken assertions, add broad skips,
          or use --force to manufacture green.

  Step 7  Produce docs/beta-v1/handoffs/HANDOFF-<NODE>.md recording the starting/base
          commit, diff, commands, exact exit codes, evidence, residual risk, and rollback.
          The handoff records the pre-commit base. It does not contain and must not claim
          to contain its own final commit SHA.

  Step 8  STOP for independent Codex review.

          After Codex pre-commit review, three separate gates follow:

          Gate A -- AUTHORIZE <NODE> COMMIT
            Commit only. Return commit SHA, tree, complete porcelain status, and
            changed file list. Stop. Do not push.

          Gate B -- Codex verifies that exact commit SHA.

          Gate C -- AUTHORIZE <NODE> PUSH
            Push only. Return local branch SHA and remote branch SHA after push.
            Verify they match. Stop. Do not open PR.

          Gate D -- PR and merge require separate explicit authorization.

          The independently verified pushed/merged SHA becomes the exact starting
          commit stated in the next node's Majd/Codex authorization and copied
          verbatim into that node's approved contract.

Abacus does not self-certify. Codex independently verifies the diff, tests, and claims
at each gate before the next action is authorized.

---

## 3. WORKSPACE SAFETY

  - Use an isolated clean clone or worktree for each implementation node.
  - Never modify a preserved workspace unless the current approved contract explicitly
    names it as the authorized workspace.
  - Always verify the authorized branch, commit, tree, and permitted status (from the
    current Majd/Codex authorization and approved node contract) before every write.
  - If the workspace does not meet the authorized preconditions, create a fresh clone
    checked out at the exact starting commit from the current authorization.

---

## 4. IMPLEMENTATION BRANCH PLAN

Branch of record: agent/abacus-beta-v1-hardening
Starting commit:  the exact commit supplied by the current Majd/Codex authorization
                  and copied verbatim into the approved node contract.

Before creating or using the branch, fetch and inspect it:
  git fetch origin agent/abacus-beta-v1-hardening

  - Does not exist:  create from the starting commit only when the current
                     authorization explicitly permits branch creation; otherwise stop.
  - Exists and remote HEAD equals the exact starting commit from the current
    Majd/Codex authorization and approved contract:  proceed.
  - Exists but remote HEAD differs from the authorized starting commit:
                     STOP. Report the authorized commit and the actual remote HEAD
                     to Majd before touching anything.

Create if absent:
  git -C <clean-clone> checkout -b agent/abacus-beta-v1-hardening <starting-commit>

All Beta V1 changes land on this branch as small reviewed commits. Never write directly
to main. Never force-push to main or agent/abacus-beta-v1-hardening.

---

## 5. VERIFICATION COMMANDS

Run these in a clean clone at the exact starting commit specified in the current node
contract and current Majd/Codex authorization. Report literal output and exit codes before
claiming any finding verified or resolved. All expected values (commit, tree, status,
test baseline) are supplied by the current node contract; do not hardcode G0-specific
values here. G0-specific values are preserved in docs/contracts/G0-governance.md and
the G0 evidence bundle only.

  # Source confirmation
  git rev-parse HEAD
    expected: <starting commit from node contract>

  git cat-file -p HEAD | grep tree
    expected: <starting tree from node contract>

  git status --porcelain=v1 --untracked-files=all
    expected at start:  <permitted starting status from node contract>
    expected after node: only the allowlisted paths from the node contract

  git diff --check HEAD
    expected: no output (tracked-file whitespace only; does not cover untracked files)

  # Allowlist enforcement
  git status --porcelain=v1 --untracked-files=all
    validate every path against the exact allowlist in the node contract
    any unlisted path is a stop condition

  # Accepted-source checksums
  sha256sum docs/beta-v1/IDENTITY-BINDING-CONTRACT.md
  sha256sum docs/beta-v1/WEB-APP-V1-SPEC.md
    must match the checksums of the accepted source files byte-for-byte

  # Baseline tests (from backend/ with DATABASE_URL set)
  # S1A security regression floor (run for every node):
  #   auth.test.js, agent-authority.test.js, luca.test.js
  # Additional targeted tests are named in the current node contract.
  npx jest --runInBand --forceExit \
    tests/auth.test.js tests/agent-authority.test.js tests/luca.test.js \
    <additional tests from node contract if any> \
    > /tmp/<node>-jest-targeted.log 2>&1
  jest_rc=$? ; tail -20 /tmp/<node>-jest-targeted.log ; echo "JEST_EXIT=$jest_rc"
    expected: <targeted suite baseline from node contract>

  npx jest --runInBand --forceExit tests/schema-recovery.test.js \
    > /tmp/<node>-jest-schema.log 2>&1
  jest_rc=$? ; tail -10 /tmp/<node>-jest-schema.log ; echo "JEST_EXIT=$jest_rc"
    expected: <schema suite baseline from node contract>

  npx jest --runInBand --forceExit \
    > /tmp/<node>-jest-full.log 2>&1
  jest_rc=$? ; tail -20 /tmp/<node>-jest-full.log ; echo "JEST_EXIT=$jest_rc"
    expected: <full suite baseline from node contract>
    Any regression below the accepted baseline is a stop condition.

---

## 6. ROLLBACK

A node that modifies only documentation files has no migration, application code,
dependency, environment, or deployment change to roll back.

  Step 1  Print and verify exact status before any restore:
            git status --porcelain=v1 --untracked-files=all
          Record output. Act only on paths present in it.

  Step 2  Restore only modified tracked allowlisted paths, named explicitly per the
          current node contract:
            git restore --worktree -- <tracked-path-1>
            git restore --worktree -- <tracked-path-2>
          Only if those exact paths appear as modified tracked in Step 1.
          Do not pass a directory. Never touch tracked files not in the contract.

  Step 3  Move each untracked node file individually to a timestamped quarantine.
          Never move a directory wholesale. Never delete. Never use git clean or
          git reset --hard. Name each path explicitly per the contract allowlist:
            STAMP=$(date +%Y%m%d-%H%M%S)
            mkdir -p /tmp/<node>-rollback-$STAMP/<parent-dirs>
            [ -f <untracked-path> ] && mv <untracked-path> /tmp/<node>-rollback-$STAMP/<untracked-path>
          Never move or modify pre-existing tracked files not in the contract.
          Never move docs/contracts/S1A-p0-fail-closed.md or any pre-existing
          tracked document.

  Step 4  Verify HEAD, tree, and status against the node contract's expected values:
            git rev-parse HEAD
              expected: <starting commit from node contract>
            git cat-file -p HEAD | grep tree
              expected: <starting tree from node contract>
            git status --porcelain=v1 --untracked-files=all
              expected: <permitted starting status from node contract>

  If rollback is needed after a push, open a PR reverting the node's commits.
  Do not force-push.

---

## 7. STOP CONDITIONS

Stop immediately and report to Majd if:

  - git rev-parse HEAD does not match the starting commit in the current node contract
  - git cat-file -p HEAD | grep tree does not match the starting tree in the contract
  - git status shows any entry other than the permitted starting status from the contract
  - git status shows any path outside the node's allowlist after the node's changes
  - agent/abacus-beta-v1-hardening exists remotely and does not point to the exact
    starting commit from the current Majd/Codex authorization and approved contract
  - any node step would modify application code, tests, migrations, packages, CI, or
    environment files (unless the contract explicitly allows it)
  - a conflict is detected between two authoritative sources
  - any baseline test count falls below the accepted baseline in the node contract
  - SHA-256 checksums of the two accepted source copies do not match
  - any action requires real keys, real patient data, real money, a production seed,
    a migration, a push to main, a merge, or a public deployment
