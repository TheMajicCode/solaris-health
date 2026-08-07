# G0-GOVERNANCE CONTRACT
# Solaris Health -- Beta V1 Governance Documentation Node

Node ID: G0-GOVERNANCE
Status: DRAFT -- awaiting Codex re-review then Majd acceptance before implementation begins
Contract date: 2026-08-06 (amended 2026-08-06)
Author: Abacus build agent
Authority: Majd (human)

---

## 1. SOURCE PRECONDITIONS (verified before this contract was written)

Repository:      TheMajicCode/solaris-health
Branch:          agent/abacus-sovereign-sprint-v4
Source commit:   263ab5a98e1049e7d5a2e4cd483705dc6b47d696
Tree:            452f36ce167f2357929f011cb833af580c3ed09b

Expected worktree state at implementation start:
  - exact HEAD: 263ab5a98e1049e7d5a2e4cd483705dc6b47d696
  - exact tree: 452f36ce167f2357929f011cb833af580c3ed09b
  - no staged files
  - no tracked modifications
  - exactly one known untracked file: ?? docs/contracts/G0-governance.md
  - STOP on every additional entry in git status --porcelain=v1 --untracked-files=all

After G0 implementation, git status --porcelain=v1 --untracked-files=all must show
only paths from the nine-path allowlist (Section 4). Any other path is a stop condition.

Implementation will create branch agent/abacus-beta-v1-hardening from this exact commit
in a fresh clone. If that branch already exists remotely or points to a different commit,
STOP and report to Majd before proceeding.

---

## 2. AUTHORITATIVE SOURCE HIERARCHY

Two ladders. When they conflict, record a contract-versus-implementation gap and stop.
Do not let current code silently rewrite policy. Do not let a report overrule an accepted
contract.

### 2A. NORMATIVE AUTHORITY (policy, intent, rules)

  1. Majd's current explicit instruction and HUMAN decisions
  2. Accepted IDENTITY-BINDING-CONTRACT.md and authoritative WEB-APP-V1-SPEC.md
  3. Exact repository copies of those sources once G0 places them under docs/beta-v1/
  4. Accepted repository governance contracts (this file and successors)
  5. Kickoff context (11-ABACUS-BETA-V1-KICKOFF-CONTEXT.md, 2026-08-05)
  6. Earlier sprint plans, reports, and architecture exports

### 2B. DESCRIPTIVE EVIDENCE (what the code actually does)

  1. Exact checked-out source and executable tests at commit 263ab5a
  2. Same-commit command and runtime evidence (exit codes, test output, audit output)
  3. Accepted B0-CORRECTION-POST-S1A v2 report with Codex corrections (accepted 2026-08-06)
  4. Repository documentation, earlier reports, and architecture exports

When normative intent (2A) and observed behavior (2B) disagree, the gap is a finding.
Do not promote behavioral evidence to policy, and do not assert policy compliance without
behavioral evidence.

---

## 3. CONTRACT-BEFORE-CODE AND WAIT WORKFLOW

For every implementation node after G0:

  Step 1  Verify current branch, commit, and clean/known worktree.
  Step 2  Inspect only the named surface and its direct dependencies.
  Step 3  Write docs/beta-v1/contracts/CONTRACT-<NODE>.md containing:
            - one outcome and explicit non-goals;
            - exact starting commit;
            - data class, actor, authorization, consent, failure direction, export impact;
            - exact file allowlist;
            - GIVEN/WHEN/THEN acceptance tests and negative tests;
            - migration, rollback, dependency, and deployment effects;
            - commands that will verify the node.
  Step 4  STOP and wait for Majd's "PROCEED <NODE>".
  Step 5  After approval, change only allowlisted files. If another file is required,
          stop and amend the contract first.
  Step 6  Run the named tests plus the unchanged relevant baseline. Never lower test
          counts, disable tests, weaken assertions, add broad skips, or use --force.
  Step 7  Produce docs/beta-v1/handoffs/HANDOFF-<NODE>.md with commit base, diff,
          commands, exit codes, evidence, residual risk, and rollback.
  Step 8  STOP for independent Codex review before commit, push, merge, migration,
          checkpoint promotion, or deploy.

Abacus does not self-certify. Codex independently verifies the diff, tests, and claims
before the next node is authorized.

---

## 4. G0 IMPLEMENTATION ALLOWLIST

The G0 implementation node may only create or modify the nine files listed below.
Every other file in the repository is forbidden for G0.

  AGENTS.md
  .abacusai/skills/solaris-sovereign-sprint/SKILL.md
  docs/beta-v1/README.md
  docs/beta-v1/CONTEXT.md
  docs/beta-v1/IDENTITY-BINDING-CONTRACT.md
  docs/beta-v1/WEB-APP-V1-SPEC.md
  docs/beta-v1/WORKFLOW.md
  docs/beta-v1/RELEASE-LEDGER.md
  docs/contracts/G0-governance.md           (this file -- already written)

Forbidden regardless of circumstance:

  - Application code (src/, backend/src/, any .js/.ts/.jsx/.tsx outside docs/)
  - Tests (backend/tests/, tests/, src/__tests__/, any *.test.*)
  - Migrations (backend/migrations/)
  - Package files (package.json, package-lock.json)
  - Environment files (.env, .env.*)
  - CI configuration (.github/, .circleci/, any pipeline file)
  - Lockfiles
  - Any file not in the nine-path allowlist above

---

## 5. REQUIRED CONTENT AND OWNERSHIP OF EACH G0 DOCUMENT

### 5.1  AGENTS.md

Owner: Abacus (draft), Majd (authority)

Must contain: meta/process content only -- how agents should operate in this repository,
the contract-before-code loop reference, and pointer to docs/beta-v1/WORKFLOW.md.
Must not contain: application-behavior instructions or product rules.

### 5.2  .abacusai/skills/solaris-sovereign-sprint/SKILL.md

Owner: Abacus (draft), Majd (authority)

Must contain: the skill description for the Solaris sovereign sprint, updated to reference
the accepted G0 governance documents under docs/beta-v1/ as the authoritative context
for any new Abacus session working on this repository.

### 5.3  docs/beta-v1/README.md

Owner: Abacus (draft), Majd (authority)

Must contain:
  - what Solaris Beta V1 is and is not (product boundary from KICKOFF ss.3)
  - stack: React 19 + Vite frontend; Node/Express + JavaScript API; one PostgreSQL database
  - repository and branch of record; exact source commit
  - how to read this docs/beta-v1/ tree
  - pointer to WORKFLOW.md for the contract-before-code loop
  - pointer to RELEASE-LEDGER.md for the accepted release state
  - pointer to CONTEXT.md for the full build context
  - "LUCA is an intelligence layer attached to an identity -- never LUCA Chat"

Must not contain:
  - application startup instructions (those belong in the project root README.md)
  - credentials, keys, or environment values
  - claims of green tests or production readiness not backed by verified evidence

### 5.4  docs/beta-v1/CONTEXT.md

Owner: Abacus (draft), Majd (authority)

Must contain:
  - full build mandate from KICKOFF ss.1-2
  - Beta V1 product boundary (includes / excludes) from KICKOFF ss.3
  - visual and interaction language from KICKOFF ss.4 and SPEC Part 2
  - all non-negotiable safety and architecture rules from KICKOFF ss.5 (rules 1-14)
  - D43 prohibition (ss.6): do not port N1; do not wire N1.5; do not fix the regex;
    design a new L2 PHI-egress contract before implementation; the five required
    explicit inputs for the replacement contract
  - D72 decision per Section 9 of this contract
  - identity and recovery contract summary from KICKOFF ss.8
  - onboarding and custody order from KICKOFF ss.9
  - real/simulated/prohibited behavior table from KICKOFF ss.10
  - definition of complete Beta V1 from KICKOFF ss.12
  - never-generate list from KICKOFF ss.13

### 5.5  docs/beta-v1/IDENTITY-BINDING-CONTRACT.md

Owner: Majd (accepted 2026-08-05); Abacus copies byte-for-byte

Must be: an exact byte-for-byte copy of the accepted IDENTITY-BINDING-CONTRACT.md.
No content changes. No formatting normalization. If the SHA-256 checksum of the written
file does not match the checksum of the source file, stop before proceeding.

### 5.6  docs/beta-v1/WEB-APP-V1-SPEC.md

Owner: Majd (authority); Abacus copies byte-for-byte

Must be: an exact byte-for-byte copy of the accepted WEB-APP-V1-SPEC.md.
No content changes. No formatting normalization. If the SHA-256 checksum of the written
file does not match the checksum of the source file, stop before proceeding.

### 5.7  docs/beta-v1/WORKFLOW.md

Owner: Abacus (draft), Majd (authority)

Must contain:
  - the contract-before-code and WAIT workflow (Section 3 of this contract), written as
    a self-contained reference a new Abacus session can read without prior context
  - the two-ladder authoritative source hierarchy (Section 2 of this contract)
  - workspace safety rules: never modify /home/ubuntu/github_repos/solaris-health;
    always verify exact HEAD and tree before any write
  - the implementation branch plan: create agent/abacus-beta-v1-hardening from exact
    commit 263ab5a in a clean clone; stop if the branch already exists remotely or
    points elsewhere
  - the verification commands (Section 8 of this contract)
  - rollback procedure (Section 9 of this contract)
  - stop conditions (Section 10 of this contract)
  - pointer to RELEASE-LEDGER.md for accepted/blocked/simulated state

### 5.8  docs/beta-v1/RELEASE-LEDGER.md

Owner: Abacus (draft from B0 evidence), Majd (authority on all entries)

Must contain:
  - the CLOSED BY S1A table (Section 7.1 of this contract)
  - the open P0/P1/P2 ledger (Section 7.2-7.4 of this contract)
  - real behavior inventory (items that execute and move real state)
  - simulated behavior inventory with visible-label requirement for each
  - disabled/legacy behavior inventory
  - payments ledger (Section 7.5 of this contract)
  - production-blocked items and their unblock conditions
  - controlled demo policy (Section 6.6 of this contract)
  - no P0 waiver table (empty at G0; no waiver has been granted)

---

## 6. STANDING RULES FOR ALL SUBSEQUENT NODES

### 6.1  One PostgreSQL database, one auth system

No second database. No Supabase, Firebase, or parallel identity store.
All identity state lives in the canonical PostgreSQL instance.
Auth stays in the canonical auth system (email/password + Nostr + OAuth bindings).

### 6.2  D43 -- PHI-gate prohibition (no N1/N1.5 port)

The local-only N1 implementation is withdrawn. Its three independent negative failures
are recorded in KICKOFF ss.6. This prohibition applies to every subsequent node:

  - do not port N1
  - do not wire N1.5
  - do not "fix the regex"
  - use the local N1 files only as negative-test fixtures
  - design a new L2 PHI-egress contract before any PHI-routing implementation

The replacement contract must make five independent inputs explicit (KICKOFF ss.6):
  1. Data provenance: clinical/health/intake/journal/appointment context is PHI by origin.
  2. Destination evidence: device residency is earned from an enforced resolved destination,
     not asserted by a mode name.
  3. Consent and purpose: current consent, actor authority, intended use, and permitted
     transformation are checked separately and fail closed.
  4. Transformation evidence: raw, de-identified, and unknown are explicit states; unknown
     never defaults to safe.
  5. Receipt truth: receipts contain decision metadata and evidence state, never raw
     prompt/reply or PHI.

Executable negative tests come first.

### 6.3  Server-secret and secret-shaped material rules

The server never generates, receives, stores, or logs:
  - an nsec or nsec1... value
  - a raw 64-hex private key
  - a mnemonic, seed phrase, or Spark wallet secret
  - key material in any form, including synthetic/mock shapes

The global secret-shaped body guard (IBC ss.9) must be implemented before any patient-
facing write path is hardened. It applies before business handlers to every body-bearing
endpoint. Current state at 263ab5a: no global guard exists; generic body fields such as
journal content and LUCA messages can persist secret-shaped input. This is a confirmed
gap (P0-03), not an asserted safe path.

On detection of secret-shaped material:
  - return 400 SECRET_MATERIAL_REJECTED
  - call no business handler
  - log nothing about the submitted value, field name, word count, or hash
  - audit only: actor/subject if known, endpoint, request ID, time, result,
    coarse detectedShape (nsec / raw_hex / mnemonic / forbidden_key_name)

### 6.4  PHI and AI rules

PHI classification is by data provenance, not regex. Anything originating in a clinical
thread, health table, intake, journal, appointment context, or assembled health context
is PHI regardless of wording.

No PHI enters logs, invoices, payment metadata, analytics, Nostr tags, GPS evidence,
or any third-party payload.

Current state at 263ab5a (P0-01): health/passport context is passed to external AI
without provenance-based de-identification. Must be corrected before any PHI-bearing
LUCA path is used in a demo or real environment.

AI may draft, summarise, translate, educate, and organise.
AI must not diagnose, prescribe, or decide clinically, legally, or financially.

Human approval, logged (actor, model used, inputs hash, approver, time), is required on
anything patient-facing or money-moving.

### 6.5  Visible simulation rules

Every simulated response carries a typed simulated: true field.
Every simulated surface carries a visible "Simulated" or "Sandbox" label.
Mock/degraded fallback is visibly labelled as degraded, never presented as live.
Simulation is never silently promoted to real behavior.

### 6.6  Controlled demo and release policy

No P0 waiver has been granted at the time this contract is written.
Controlled demos may use synthetic data only.
Demos must never submit real secret keys, mnemonics, credentials, PHI, or money.
Real-patient eligibility remains blocked pending explicit legal/privacy review
and Majd's explicit approval.
Legal/privacy review and Majd approval are the required gates for real-patient use.

An attractive preview, a deployment URL, or Abacus saying "production-ready" is not
completion. Beta V1 completion criteria are defined in KICKOFF ss.12.

### 6.7  Consent and human-approval gate

Every patient-facing or money-moving action requires:
  - explicit human confirmation (not a comment saying one is needed)
  - an audit record containing: actor, model used, inputs hash, approver, time
  - no raw patient data or PHI in the audit record

---

## 7. FINDING LEDGER

All findings reference commit 263ab5a98e1049e7d5a2e4cd483705dc6b47d696.
Source: B0-CORRECTION-POST-S1A v2 (accepted 2026-08-06) with Codex corrections,
plus S1A closure evidence.

---

### 7.1  CLOSED BY S1A

These findings were open in the pre-S1A baseline and are recorded as closed by the
S1A hardening changes. They must not be carried forward as open findings.

  C1  MOCK AUTH ROUTES
      POST /api/auth/nostr-mock and POST /api/auth/google-mock are unconditional inert
      410 tombstones. No mock key generation, no mock nsec-shaped material, no body
      processing.

  C2  TOKEN REVOCATION FAIL-OPEN
      Missing-jti returns 401. Revocation-store failure returns 503 without calling
      next(). The fail-open path at backend/src/middleware/auth.js:43-57 is closed.

  C3  AUTHORITY FAIL-OPEN
      Authority storage failure fails closed. requires_human_approval grants are denied
      before LUCA effects execute. The permissive catch default is removed.

  C4  TTS PHI EGRESS
      POST /api/luca/tts retains authentication but is an inert 410 tombstone. No body
      processing, no credential use, no external fetch, no dynamic log processing.

---

### 7.2  P0 FINDINGS -- no waiver granted; block real-patient use and production deploy

  P0-01  PHI/HEALTH CONTEXT TO EXTERNAL AI WITHOUT PROVENANCE-BASED DE-IDENTIFICATION
         Location:  backend/src/routes/luca.js
         Evidence:  Health/passport context is passed to external AI without provenance-
                    based de-identification. Only the user message (content field) is
                    redacted via redactForExternalAI. Full health context passes unredacted.
         Rule:      PHI must not enter any third-party payload (KICKOFF rule 7).
                    D43: provenance-based classification required; regex is insufficient.
         Status:    OPEN. No waiver.

  P0-02  PRACTITIONER CONTEXT CONSENT AND CARE-RELATIONSHIP GATE
         Location:  backend/src/routes/luca-practitioner.js (and related practitioner paths)
         Evidence:  Practitioner context ignores consent expiry and lacks a demonstrated
                    valid care-relationship gate before PHI-bearing context is assembled.
         Rule:      Consent must be checked and fail closed; care relationship must be
                    verified before any PHI-bearing context is assembled or transmitted.
         Status:    OPEN. No waiver.

  P0-03  GLOBAL SECRET-SHAPED BODY GUARD ABSENT
         Evidence:  No global pre-handler guard exists at 263ab5a. Generic body fields
                    such as journal content and LUCA messages can persist secret-shaped
                    input without rejection.
         Rule:      Secret-shaped material must be rejected before every body-bearing
                    business handler (KICKOFF rule 5; IBC ss.9).
         Note:      Do not assert "no transmission path" -- the gap is confirmed.
         Status:    OPEN. No waiver.

  P0-04  ADMIN INVITE CREDENTIALS LOGGED AND RETURNED IN RESPONSE
         Evidence:  Admin invite flow logs email/password content; the temporary password
                    is returned in the API response body.
         Rule:      Temporary passwords and other authentication credentials must never
                    be written to application logs. Returning or generating a temporary
                    password for an authenticated administrator is existing behavior
                    whose acceptability requires a separate account-provisioning contract
                    and explicit Majd decision. Until that decision and removal of
                    credential logging, this finding remains P0. This finding does not
                    prohibit legitimate server-issued session/access tokens.
         Status:    OPEN. No waiver.

  P0-05  RAW PRIVATE KEY IN sessionStorage
         Location:  src/lib/identity-key.js:23,86 -- imported by live frontend modules
         Evidence:  Raw private key (nsec) stored in sessionStorage; readable by any
                    script on the page.
         Rule:      Never persist raw secret material in localStorage, IndexedDB, or
                    sessionStorage (KICKOFF rule 5; SPEC Part 3 hard rule 1).
         Status:    OPEN. No waiver.

---

### 7.3  P1 FINDINGS -- block production promotion; may unblock with explicit Majd decision

  P1-01  NOSTR BINDING WITHOUT POSSESSION PROOF
         Location:  backend/src/routes/identity.js:21-39;
                    backend/src/lib/identity/index.js:153-173
         Evidence:  POST /api/identity/nostr accepts an npub and marks verified_at=NOW()
                    solely from the submitted public value. No challenge/signature required.
         Rule:      IBC invariant 3: a public identifier is never marked verified merely
                    because an authenticated session submitted it. Full fix is the IBC
                    challenge+proof contract (IBC ss.7).
         Status:    OPEN.

  P1-02  MISSING ROTATE/UNPAIR/RECOVERY-DESIGNATE AND 409 LAST_USABLE_BINDING
         Evidence:  IBC ss.7 defines six binding endpoints. The rotate, unpair/remove,
                    recovery-designate, and 409 LAST_USABLE_BINDING / PATIENT_REQUIRES_
                    NON_NOSTR_BINDING invariants are not implemented at 263ab5a.
         Status:    OPEN.

  P1-03  BACKEND PRODUCTION DEPENDENCY VULNERABILITIES
         Evidence:  npm audit --omit=dev at 263ab5a: 3 vulnerabilities.
         Codex-corrected classification:
           - body-parser: low severity
           - ip-address: high severity
           - brace-expansion: installed through the migration-tool dependency chain;
             do not assert request-runtime exploitability without specific evidence
             that the migration-tool chain is reachable from a request handler
         Status:    OPEN.

  P1-04  ASYNC ERROR-BOUNDARY COVERAGE GAP
         Evidence:  219 async handler declarations and 0 global async-wrapper calls are
                    inventory facts at 263ab5a. Some handlers contain local try/catch,
                    so not all 219 necessarily produce unhandled rejections. The gap is
                    a candidate crash risk on uncovered paths.
         Note:      Do not state "all 219 fail" -- that is not proven by inventory alone.
         Status:    OPEN. Risk must be addressed; severity proportionate to evidence.

  P1-05  JWT LIFETIME POLICY TODO
         Location:  backend/src/middleware/auth.js (expiresIn: '7d')
         Evidence:  7-day lifetime is a hardcoded placeholder. No policy constant or
                    environment configuration.
         Note:      JWT lifetime remains a Majd policy decision, not a frozen contract
                    constant. IBC ss.12 records this as a configuration TODO.
         Status:    OPEN pending Majd decision.

  P1-06  CSP DISABLED
         Location:  backend/src/server.js (Helmet configuration)
         Evidence:  contentSecurityPolicy: false
         Status:    OPEN.

---

### 7.4  P2 FINDINGS -- document and plan; do not block controlled demo on synthetic data

  P2-01  FRONTEND LINT -- 19 errors, 166 warnings
         Evidence:  npm run lint at /tmp/b0-audit: EXIT 1, 19 errors, 166 warnings.
         Status:    OPEN.

  P2-02  BACKEND LINT -- 8 warnings
         Evidence:  npm run lint at /tmp/b0-audit/backend: EXIT 0, 0 errors, 8 warnings.
         Status:    OPEN (low).

  P2-03  NO NATIVE PLAYWRIGHT SUITE
         Evidence:  No Playwright configuration found at 263ab5a.
         Status:    OPEN. Required for Beta V1 completion (KICKOFF ss.12).

  P2-04  FRONTEND BUILD ENVIRONMENT-BLOCKED
         Evidence:  Node 20.18.3; Vite requires ^20.19.0 or >=22.12.0. Build fails in
                    the audit environment. Not an application defect; environment constraint.
                    Frontend application behavior is UNVERIFIED in this environment.
         Status:    OPEN (environment).

  P2-05  ARCHITECTURE EXPORTS CONTAIN ORPHAN REFERENCES
         Evidence:  Architecture HTML contains a Cloudflare analytics beacon; JSON graph
                    contains unresolved/orphan references. These are diagnostics, not
                    source truth.
         Status:    Informational.

---

### 7.5  PAYMENTS LEDGER (Codex-corrected)

  Wompi gross checkout:          REAL-WHEN-CONFIGURED
                                 Runtime/deployment UNVERIFIED at 263ab5a.
                                 Sandbox only until the legal gate passes (SPEC Part 1).

  MockPaymentAdapter fallback:   DEGRADED/SIMULATED.
                                 Must be visibly labelled as degraded; never presented
                                 as live.

  Allocation and GPS shadow:     SIMULATED.
                                 settled_cents=0, status=SIMULATED.
                                 Moves zero money by design. Must be visibly labelled.

  Spark:                         DISABLED at 263ab5a.
                                 REGTEST/sandbox only for Beta V1.
                                 Mainnet: prohibited until Majd's explicit approval.

  Legacy EVM/SIWE wallet:        LEGACY. Not Spark. Not a V1 path.

  GPS settlement (real money):   PROHIBITED in Beta V1.

---

## 8. VERIFICATION COMMANDS

Run these commands in the clean clone at exact commit 263ab5a.
Report exact exit codes and literal output before claiming any finding verified or resolved.

  # -- SOURCE CONFIRMATION --

  git rev-parse HEAD
    expected: 263ab5a98e1049e7d5a2e4cd483705dc6b47d696

  git cat-file -p HEAD | grep tree
    expected: tree 452f36ce167f2357929f011cb833af580c3ed09b

  # -- WORKTREE STATE --

  git status --porcelain=v1 --untracked-files=all
    expected at implementation start:
      ?? docs/contracts/G0-governance.md
    expected after G0 implementation:
      only paths from the nine-path allowlist (Section 4); stop on any other path

  git diff --check HEAD
    expected: no output (no whitespace errors in tracked changes)

  # -- ALLOWLIST ENFORCEMENT --

  # Extract every changed/untracked path and compare against the exact nine-path
  # allowlist in Section 4. Any path not exactly equal to one of the nine is a
  # stop condition. Print full status in the handoff.
  git status --porcelain=v1 --untracked-files=all
    expected after G0: only lines whose path field is one of:
      AGENTS.md
      .abacusai/skills/solaris-sovereign-sprint/SKILL.md
      docs/beta-v1/README.md
      docs/beta-v1/CONTEXT.md
      docs/beta-v1/IDENTITY-BINDING-CONTRACT.md
      docs/beta-v1/WEB-APP-V1-SPEC.md
      docs/beta-v1/WORKFLOW.md
      docs/beta-v1/RELEASE-LEDGER.md
      docs/contracts/G0-governance.md
    Any other path is a stop condition.

  # git diff --check HEAD checks tracked-file whitespace only.
  # It does not inspect untracked files.
  git diff --check HEAD
    expected: no output

  # -- ACCEPTED-SOURCE CHECKSUMS (run before and after copying) --

  sha256sum docs/beta-v1/IDENTITY-BINDING-CONTRACT.md
  sha256sum docs/beta-v1/WEB-APP-V1-SPEC.md
    expected: match the checksums of the accepted source files byte-for-byte.
    If they differ, stop before proceeding.

  # -- BASELINE TESTS (run from /tmp/<clone>/backend with DATABASE_URL set) --
  # Capture Jest exit code explicitly; do not use a pipeline that swallows it.

  npx jest --runInBand --forceExit \
    tests/auth.test.js tests/agent-authority.test.js tests/luca.test.js \
    > /tmp/g0-jest-targeted.log 2>&1
  jest_rc=$?
  tail -20 /tmp/g0-jest-targeted.log
  echo "JEST_EXIT=$jest_rc"
    expected: 3 suites, 43 tests, 43 passed, JEST_EXIT=0

  npx jest --runInBand --forceExit tests/schema-recovery.test.js \
    > /tmp/g0-jest-schema.log 2>&1
  jest_rc=$?
  tail -10 /tmp/g0-jest-schema.log
  echo "JEST_EXIT=$jest_rc"
    expected: 1 suite, 3 tests, 3 passed, JEST_EXIT=0

  npx jest --runInBand --forceExit \
    > /tmp/g0-jest-full.log 2>&1
  jest_rc=$?
  tail -20 /tmp/g0-jest-full.log
  echo "JEST_EXIT=$jest_rc"
    expected baseline: 25 suites passed, 196 tests passed, 2 known failures
    (intake fixture-dependent), JEST_EXIT=1
    G0 PASSES when counts are >= this baseline. Any regression is a stop condition.
    The full suite is not called green; the two known failures are documented gaps.

  # Frontend build and test:
    ENVIRONMENT-BLOCKED (Node 20.18.3 < Vite-required 20.19.0). Application
    behavior UNVERIFIED. Do not claim frontend result without a conforming environment.

---

## 9. D72 DERIVATION MODEL

Majd has HUMAN-authorized Option A for the current implementation path:
independent Nostr secret (nsec) and independent Spark mnemonic -- two separate secrets.

The final derivation-model decision remains human-owned (D72 is open).
Option B (single BIP-39 mnemonic, dual derivation) stays isolated behind one explicit
seam. Abacus must not activate Option B, select it, or let a builder pick it by default.

Build the authorized Option A path. Keep Option B isolated behind one explicit option
and one integration seam, untouched until Majd explicitly rules.

---

## 10. ROLLBACK

G0 modifies only documentation files within the nine-path allowlist.
No migration, application code, dependency, environment, or deployment change occurs.

Rollback procedure:

  Step 1  Print and verify the exact current status before any restore action:
            git status --porcelain=v1 --untracked-files=all
          Record the output. Act only on paths that appear in it.

  Step 2  Restore only modified tracked allowlisted paths, named explicitly:
            git restore --worktree -- AGENTS.md
            git restore --worktree -- .abacusai/skills/solaris-sovereign-sprint/SKILL.md
          Restore only paths that are actually shown as modified tracked files in Step 1.
          Do not pass a directory. Do not use --source. Do not use --staged.
          Never touch pre-existing tracked documents under docs/.

  Step 3  For each untracked G0 file present in Step 1 status, move that file
          individually to a timestamped quarantine directory. Never move the whole
          docs/ or docs/contracts/ directory. The only untracked files eligible to
          move are the seven G0 documentation files:
            STAMP=$(date +%Y%m%d-%H%M%S)
            mkdir -p /tmp/g0-rollback-$STAMP/docs/beta-v1
            mkdir -p /tmp/g0-rollback-$STAMP/docs/contracts
            # Move only files that exist and appear as untracked in Step 1:
            [ -f docs/beta-v1/README.md ]                  && mv docs/beta-v1/README.md                  /tmp/g0-rollback-$STAMP/docs/beta-v1/
            [ -f docs/beta-v1/CONTEXT.md ]                 && mv docs/beta-v1/CONTEXT.md                 /tmp/g0-rollback-$STAMP/docs/beta-v1/
            [ -f docs/beta-v1/IDENTITY-BINDING-CONTRACT.md ] && mv docs/beta-v1/IDENTITY-BINDING-CONTRACT.md /tmp/g0-rollback-$STAMP/docs/beta-v1/
            [ -f docs/beta-v1/WEB-APP-V1-SPEC.md ]         && mv docs/beta-v1/WEB-APP-V1-SPEC.md         /tmp/g0-rollback-$STAMP/docs/beta-v1/
            [ -f docs/beta-v1/WORKFLOW.md ]                && mv docs/beta-v1/WORKFLOW.md                /tmp/g0-rollback-$STAMP/docs/beta-v1/
            [ -f docs/beta-v1/RELEASE-LEDGER.md ]          && mv docs/beta-v1/RELEASE-LEDGER.md          /tmp/g0-rollback-$STAMP/docs/beta-v1/
            [ -f docs/contracts/G0-governance.md ]         && mv docs/contracts/G0-governance.md         /tmp/g0-rollback-$STAMP/docs/contracts/
          Do not delete. Do not git clean. Do not git reset --hard.
          Never move any file outside the seven listed above.
          Never move docs/contracts/S1A-p0-fail-closed.md or any other pre-existing
          tracked document.

  Step 4  Verify exact HEAD, tree, and an empty status:
            git rev-parse HEAD
              expected: 263ab5a98e1049e7d5a2e4cd483705dc6b47d696
            git cat-file -p HEAD | grep tree
              expected: tree 452f36ce167f2357929f011cb833af580c3ed09b
            git status --porcelain=v1 --untracked-files=all
              expected: (empty)

  If rollback is needed after a push, open a PR reverting the G0 commits.
  Do not force-push to main or agent/abacus-beta-v1-hardening.
  Never reset, clean, or touch /home/ubuntu/github_repos/solaris-health.

---

## 11. STOP CONDITIONS

Stop immediately and report to Majd if any of the following occur:

  - git rev-parse HEAD does not match 263ab5a98e1049e7d5a2e4cd483705dc6b47d696
  - git cat-file -p HEAD | grep tree does not match 452f36ce167f2357929f011cb833af580c3ed09b
  - git status --porcelain=v1 --untracked-files=all shows any entry other than the
    known ?? docs/contracts/G0-governance.md at implementation start
  - git status --porcelain=v1 --untracked-files=all shows any path outside the
    nine-path allowlist after G0 changes
  - The implementation branch agent/abacus-beta-v1-hardening already exists remotely
    and points to a commit other than 263ab5a
  - Any G0 step would modify application code, tests, migrations, packages, CI,
    or environment files
  - A conflict is detected between two authoritative sources (Section 2)
  - Any baseline test count falls below the stated baseline (Section 8)
  - SHA-256 checksums of docs/beta-v1/IDENTITY-BINDING-CONTRACT.md or
    docs/beta-v1/WEB-APP-V1-SPEC.md do not match the accepted source files
  - An unexpected file is required to complete a G0 document
  - Any action would require real keys, real patient data, real money, a production
    seed, a database migration, a push to main, a merge, or a public deployment

---

## 12. IMPLEMENTATION BRANCH PLAN (for use after this contract is accepted)

Steps to execute after Majd accepts this contract and issues PROCEED G0:

  1. Verify /tmp/b0-audit: exact HEAD 263ab5a, exact tree 452f36ce, status shows only
     ?? docs/contracts/G0-governance.md. If any condition fails, create a fresh clone
     from the exact commit before proceeding.

  2. Check whether agent/abacus-beta-v1-hardening exists remotely:
       git ls-remote origin agent/abacus-beta-v1-hardening
     - Does not exist: create it from 263ab5a in the clean clone.
     - Exists and points to 263ab5a: proceed.
     - Exists and points elsewhere: STOP. Report to Majd.

  3. Create the branch if not already present:
       git -C <clean-clone> checkout -b agent/abacus-beta-v1-hardening 263ab5a

  4. Write AGENTS.md and .abacusai/skills/solaris-sovereign-sprint/SKILL.md per Section 5.

  5. Create docs/beta-v1/ and write README.md, CONTEXT.md, WORKFLOW.md,
     RELEASE-LEDGER.md per Section 5.

  6. Copy IDENTITY-BINDING-CONTRACT.md and WEB-APP-V1-SPEC.md byte-for-byte.
     Verify checksums before proceeding.

  7. Confirm docs/contracts/G0-governance.md is present (already written).

  8. Run all verification commands (Section 8). Record every exit code and output.

  9. STOP for Codex review before any commit, push, or PR.

Do not use /home/ubuntu/github_repos/solaris-health for any G0 work. It contains
preserved S1A changes on agent/abacus-beta-v1-hardening at 7b8843a9 and must not
be touched.

---

## 13. SCOPE LIMITS

G0 produces ONLY the nine allowlisted files:
  - AGENTS.md
  - .abacusai/skills/solaris-sovereign-sprint/SKILL.md
  - docs/beta-v1/README.md
  - docs/beta-v1/CONTEXT.md
  - docs/beta-v1/IDENTITY-BINDING-CONTRACT.md  (byte-for-byte copy)
  - docs/beta-v1/WEB-APP-V1-SPEC.md            (byte-for-byte copy)
  - docs/beta-v1/WORKFLOW.md
  - docs/beta-v1/RELEASE-LEDGER.md
  - docs/contracts/G0-governance.md            (this file)

G0 does NOT produce:
  - any application code change
  - any test change
  - any migration
  - any CI, package, or environment file
  - any deployment
  - any database change
  - any product behavior change
  - any dependency change or lockfile update

---

## 14. ACCEPTANCE TEST

GIVEN a clean clone at exact source commit 263ab5a,
WHEN G0 is implemented from this accepted contract,
THEN a fresh Abacus session can determine from the repository alone:
  - the authoritative Beta V1 context and product boundary
  - the two-ladder source hierarchy (normative vs. descriptive)
  - the hard safety and architecture rules (KICKOFF ss.5, rules 1-14)
  - the contract-and-WAIT loop
  - the accepted release ledger (real/simulated/disabled/blocked)
  - the CLOSED BY S1A table and current open P0/P1/P2 findings
  - safe validation commands with explicit exit-code capture
  - the D43 prohibition and its five required replacement contract inputs
  - the D72 open decision and Majd's HUMAN-authorized Option A path
  - the IBC with its full invariants and proof protocol (byte-for-byte copy)
  - the WEB-APP-V1-SPEC (byte-for-byte copy)
  - the handoff format for subsequent nodes

AND:
  - no application behavior, dependency, migration, CI, or environment setting changes
  - no baseline test counts decrease below Section 8 stated values
  - no file outside the nine-path allowlist is modified
  - git status --porcelain=v1 --untracked-files=all shows only allowlisted paths

---

*End of G0-GOVERNANCE CONTRACT (amended 2026-08-06).*
