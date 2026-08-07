# Solaris Health Beta V1 -- Release Ledger

Governance node: G0-GOVERNANCE (2026-08-06)
Source commit:   263ab5a98e1049e7d5a2e4cd483705dc6b47d696
B0 baseline:     B0-CORRECTION-POST-S1A v2 (accepted 2026-08-06) + Codex corrections

---

## NO P0 WAIVER TABLE

No P0 finding has been waived. This table is empty at G0.

  Finding  Waiver  Condition for waiver
  -------  ------  --------------------
  (none granted)

Real-patient use and production deployment are blocked until all P0 findings are
resolved and Majd explicitly approves the deployment.

---

## CONTROLLED DEMO POLICY

Controlled demos may use synthetic data only.
Demos must never submit real secret keys, mnemonics, credentials, PHI, or money.
Real-patient eligibility remains blocked pending explicit legal/privacy review and
Majd's explicit approval.
Legal/privacy review and Majd approval are the required gates for real-patient use.

---

## CLOSED BY S1A

These findings were open in the pre-S1A baseline and are recorded as closed.

  C1  MOCK AUTH ROUTES
      POST /api/auth/nostr-mock and POST /api/auth/google-mock are unconditional
      inert 410 tombstones. No mock key generation, no mock nsec-shaped material,
      no body processing.

  C2  TOKEN REVOCATION FAIL-OPEN
      Missing jti returns 401. Revocation-store failure returns 503 without calling
      next(). The fail-open path at backend/src/middleware/auth.js:43-57 is closed.

  C3  AUTHORITY FAIL-OPEN
      Authority storage failure fails closed. requires_human_approval grants are
      denied before LUCA effects execute. The permissive catch default is removed.

  C4  TTS PHI EGRESS
      POST /api/luca/tts retains authentication but is an inert 410 tombstone.
      No body processing, no credential use, no external fetch, no dynamic log
      processing.

---

## P0 FINDINGS -- OPEN

No waiver granted. Block real-patient use and production deploy.

  P0-01  PHI/HEALTH CONTEXT TO EXTERNAL AI WITHOUT PROVENANCE-BASED DE-IDENTIFICATION
         Location:  backend/src/routes/luca.js
         Evidence:  Health/passport context passed to external AI without provenance-
                    based de-identification. Only the user message (content field) is
                    redacted via redactForExternalAI. Full health context passes
                    unredacted.
         Rule:      PHI must not enter any third-party payload (CONTEXT.md rule 7).
                    D43: provenance-based classification required; regex insufficient.
         Status:    OPEN. No waiver.

  P0-02  PRACTITIONER CONTEXT CONSENT AND CARE-RELATIONSHIP GATE
         Location:  backend/src/routes/luca-practitioner.js and related paths
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
                    business handler (CONTEXT.md rule 5; IBC ss.9).
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
                    sessionStorage (CONTEXT.md rule 4; SPEC Part 3 hard rule 1).
         Status:    OPEN. No waiver.

---

## P1 FINDINGS -- OPEN

Block production promotion. May unblock with explicit Majd decision.

  P1-01  NOSTR BINDING WITHOUT POSSESSION PROOF
         Location:  backend/src/routes/identity.js:21-39;
                    backend/src/lib/identity/index.js:153-173
         Evidence:  POST /api/identity/nostr accepts an npub and marks verified_at=NOW()
                    solely from the submitted public value. No challenge/signature
                    required.
         Rule:      IBC invariant 3: a public identifier is never marked verified merely
                    because an authenticated session submitted it. Full fix is the IBC
                    challenge+proof contract (IBC ss.7).
         Status:    OPEN.

  P1-02  MISSING ROTATE/UNPAIR/RECOVERY-DESIGNATE AND 409 LAST_USABLE_BINDING
         Evidence:  IBC ss.7 defines six binding endpoints. The rotate, unpair/remove,
                    recovery-designate endpoints and 409 LAST_USABLE_BINDING /
                    PATIENT_REQUIRES_NON_NOSTR_BINDING invariants are not implemented
                    at 263ab5a.
         Status:    OPEN.

  P1-03  BACKEND PRODUCTION DEPENDENCY VULNERABILITIES
         Evidence:  npm audit --omit=dev at 263ab5a: 3 vulnerabilities.
         Classification (Codex-corrected):
           - body-parser: low severity
           - ip-address: high severity
           - brace-expansion: installed through migration-tool chain; do not assert
             request-runtime exploitability without evidence that the migration-tool
             chain is reachable from a request handler
         Status:    OPEN.

  P1-04  ASYNC ERROR-BOUNDARY COVERAGE GAP
         Evidence:  219 async handler declarations and 0 global async-wrapper calls at
                    263ab5a. Some handlers contain local try/catch, so not all 219
                    necessarily produce unhandled rejections. The gap is a candidate
                    crash risk on uncovered paths.
         Note:      Do not state "all 219 fail" -- not proven by inventory alone.
         Status:    OPEN. Risk must be addressed proportionate to evidence.

  P1-05  JWT LIFETIME POLICY TODO
         Location:  backend/src/middleware/auth.js (expiresIn: '7d')
         Evidence:  7-day lifetime is a hardcoded placeholder. No policy constant or
                    environment configuration.
         Note:      JWT lifetime is a Majd policy decision. IBC ss.12 records this as a
                    configuration TODO, not a frozen contract constant.
         Status:    OPEN pending Majd decision.

  P1-06  CSP DISABLED
         Location:  backend/src/server.js (Helmet configuration)
         Evidence:  contentSecurityPolicy: false
         Status:    OPEN.

---

## P2 FINDINGS -- OPEN

Document and plan. Do not block controlled demo on synthetic data.

  P2-01  FRONTEND LINT
         Evidence:  npm run lint at source root: EXIT 1, 19 errors, 166 warnings.
         Status:    OPEN.

  P2-02  BACKEND LINT
         Evidence:  npm run lint at backend/: EXIT 0, 0 errors, 8 warnings.
         Status:    OPEN (low).

  P2-03  NO NATIVE PLAYWRIGHT SUITE
         Evidence:  No Playwright configuration found at 263ab5a.
         Status:    OPEN. Required for Beta V1 completion (CONTEXT.md s.12).

  P2-04  FRONTEND BUILD ENVIRONMENT-BLOCKED
         Evidence:  Node 20.18.3; Vite requires ^20.19.0 or >=22.12.0. Build fails in
                    audit environment. Not an application defect; environment constraint.
                    Frontend application behavior is UNVERIFIED in this environment.
         Status:    OPEN (environment).

  P2-05  ARCHITECTURE EXPORTS CONTAIN ORPHAN REFERENCES
         Evidence:  Architecture HTML contains a Cloudflare analytics beacon; JSON graph
                    contains unresolved/orphan references. Diagnostics only, not source
                    truth.
         Status:    Informational.

---

## REAL BEHAVIOR INVENTORY

Items that execute and move real state at 263ab5a (VERIFIED):

  - Email/password auth with bcrypt and JWT (expiresIn 7d -- see P1-05)
  - Nostr npub sign-in: real BIP-340 Schnorr via @noble/curves; CSPRNG nonce,
    5-min TTL, nonce deleted before verify
  - Identity spine: subject_id on 26 tables; solaris_identity_bindings with nostr type
  - AI provider seam: real HTTP to Anthropic/OpenAI-compatible (lib/ai/index.js)
  - PHI classification: lib/phi-boundary.js -- real regex redaction + sensitivity
    classification (note: provenance-based classification is absent -- P0-01)
  - Audit logging: audit_logs with actor/purpose/consent scope
  - Rate limiting: lib/rate-limits.js + migration 033
  - Email delivery: Resend with nodemailer/SMTP fallback
  - Patient plans, procedures, drafts, documents: real CRUD, real Postgres
  - AI execution receipts: ai_execution_receipts, migration 019
  - 35 SQL migrations applied successfully

---

## SIMULATED BEHAVIOR INVENTORY

Items that are correctly simulated -- must remain visibly labelled:

  GPS shadow receipts:      settled_cents=0, status=SIMULATED. Moves zero money by
                            design. Label: "Simulated" required on every surface.

  Payment simulation:       POST /api/payments/simulate -- simulated split, mock proof
                            hashes. Header: "All values are simulated. No real money
                            moves." Label required.

  Wompi gross checkout:     REAL-WHEN-CONFIGURED. Runtime/deployment UNVERIFIED at
                            263ab5a. Sandbox only until legal gate passes.

  MockPaymentAdapter:       DEGRADED/SIMULATED. Must be visibly labelled as degraded;
                            never presented as live.

---

## DISABLED / LEGACY BEHAVIOR INVENTORY

  Spark wallet:             DISABLED at 263ab5a. REGTEST/sandbox only for Beta V1.
                            Mainnet: prohibited until Majd's explicit approval.

  Legacy EVM/SIWE wallet:   LEGACY. Not Spark. Not a V1 path.

  GPS settlement:           PROHIBITED in Beta V1. No real money movement.

  TTS:                      DISABLED. POST /api/luca/tts is a 410 tombstone per S1A.
                            Must remain an inert 410 tombstone: no request-body
                            processing, credential access, external fetch, or dynamic
                            logging.

  Mock auth routes:         DISABLED. POST /api/auth/nostr-mock and google-mock are
                            410 tombstones per S1A (C1).

---

## PRODUCTION-BLOCKED ITEMS AND UNBLOCK CONDITIONS

  Real-patient use:     Blocked. Unblock requires: all P0 resolved + legal/privacy
                        review + explicit Majd approval of data class and deployment.

  Production deploy:    Blocked. Unblock requires: all P0 resolved + Majd explicit
                        approval of the deployment and environment.

  Spark mainnet:        Blocked. Unblock requires: explicit Majd approval.

  GPS real settlement:  Blocked. Prohibited in Beta V1.

  Clinic OS:            Out of scope for Beta V1.
