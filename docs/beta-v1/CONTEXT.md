# Solaris Health Beta V1 -- Build Context

Source: 11-ABACUS-BETA-V1-KICKOFF-CONTEXT.md (2026-08-05), WEB-APP-V1-SPEC.md (2026-08-04)
Governance node: G0-GOVERNANCE (2026-08-06)

---

## 1. MANDATE AND AUTHORITY

Turn the existing Solaris Abacus v4 prototype into a complete, functioning, production-
quality closed Beta V1 while preserving the product and visual work that already functions.

Authority order for all work:

  1. Majd's current instruction and explicit decisions  [HUMAN]
  2. Accepted IDENTITY-BINDING-CONTRACT.md and WEB-APP-V1-SPEC.md  [CONTRACT]
  3. Repository copies of those sources after G0  [CONTRACT]
  4. Accepted governance contracts  [CONTRACT]
  5. Kickoff context  [KICKOFF]
  6. Earlier sprint reports and architecture exports -- assertions until verified  [ASSERTED]

If two sources conflict, report the conflict and stop. Do not silently choose.
Mark factual claims VERIFIED, ASSERTED, or UNVERIFIED. Mark Majd's decisions HUMAN.

---

## 2. REPOSITORY OF RECORD

  Repository:       TheMajicCode/solaris-health
  Branch of record: agent/abacus-beta-v1-hardening (never main)
  Source commit:    263ab5a98e1049e7d5a2e4cd483705dc6b47d696
  Stack:            React 19 + Vite + JavaScript frontend;
                    Node/Express + JavaScript API;
                    one PostgreSQL database

Every Abacus session must begin by reporting the current branch, full commit, and
worktree status. Never use /home/ubuntu/github_repos/solaris-health for G0 or any
subsequent node -- see WORKFLOW.md for workspace safety rules.

---

## 3. PRODUCT BOUNDARY

Beta V1 includes:
  - member Solaris Passport
  - LUCA as an identity-attached intelligence layer (never "LUCA Chat")
  - practitioner portal
  - member-held Nostr identity key and identity bindings
  - client-created Spark spending wallet on REGTEST/sandbox for Beta
  - visibly simulated GPS shadow receipts and other approved simulations
  - export, consent, recovery-designate, safe failure, and release evidence

Beta V1 excludes:
  - Clinic OS
  - real patient data in any builder, seed, screenshot, analytics event, or test
  - Spark mainnet or automatic money movement
  - real GPS settlement
  - diagnostic, prescriptive, legal, or financial decisions by AI
  - framework rewrite, second application shell, second database, Supabase, Firebase,
    or parallel authentication
  - TTS
  - Shamir Secret Sharing (V2)

---

## 4. VISUAL AND INTERACTION LANGUAGE

The shipped Abacus design is authoritative. Preserve its dark, premium, cinematic
Solaris language. The real palette (VERIFIED from src/index.css):

  --surface: #0c1322               deep navy-black canvas
  --primary: #4edea3               mint green signature
  --secondary: #4fdbc8             teal
  --tertiary: #ffb95f              gold
  --on-surface: #dce2f8            text on dark
  --ease: cubic-bezier(0.22,1,0.36,1)  0.4-0.6s transitions

The component vocabulary exists as 40+ named classes in index.css:
  app-frame, card, card-high, card-low, glass, btn, btn-ghost, btn-tertiary,
  chip, pill, eyebrow, display, serif, gold, mint, ring-glow, ring-wrap,
  floaty, fade-in, fade-up, bottom-nav, nav-item, nav-ico, top-bar, wordmark,
  sol-bg, divider, field-label

Keep these names. Do not invent new ones without justification.
Respect prefers-reduced-motion. Every animation needs a static fallback.

Before any visual refactor, capture reference screenshots for: welcome, member home,
Passport, LUCA, practitioner portal, and wallet.

---

## 5. NON-NEGOTIABLE SAFETY AND ARCHITECTURE RULES

(KICKOFF ss.5, rules 1-14. These are non-negotiable for every node.)

  1.  Domain code has zero I/O. Ports live in ports/; adapters live in adapters/;
      dependencies are injected at the edge.

  2.  Configuration is environment-only. No hard-coded secret, endpoint, policy
      timeout, or vendor credential.

  3.  One canonical API, one PostgreSQL database, one auth system. No parallel
      identity store. No Supabase. No Firebase.

  4.  The server never generates, receives, stores, or logs an nsec, raw 64-hex
      private key, mnemonic, seed phrase, or Spark wallet secret -- not in seed
      data, not for a demo, not once.

  5.  Every body-bearing endpoint rejects secret-shaped material before business
      handlers with typed 400 SECRET_MATERIAL_REJECTED, without echoing, hashing,
      or logging the submitted value.

  6.  PHI is classified by data provenance, not by regex. Anything originating in a
      clinical thread, health table, intake, journal, appointment context, or assembled
      health context is PHI whatever its wording.

  7.  No PHI enters logs, invoices, payment metadata, analytics, Nostr tags, GPS
      evidence, or any third-party payload.

  8.  LUCA may draft, summarise, translate, educate, and organise. It never diagnoses,
      prescribes, or decides clinically, legally, or financially.

  9.  Anything patient-facing or money-moving requires explicit human confirmation and
      a value-free audit record (actor, model, inputs hash, approver, time).

  10. Unknown and dependency failure fail closed. A database, consent, revocation,
      authority, PHI, or destination check that cannot complete denies the action and
      surfaces the safe failure.

  11. Every simulated response carries a typed simulated: true. Every simulated surface
      carries a visible "Simulated" or "Sandbox" label. Mock fallback is visibly degraded,
      never presented as live.

  12. Every durable member object has a portable export representation or a written
      exclusion reason.

  13. Migrations are additive and reversible. Never rewrite deployed migration history.
      Determine the next migration number from the branch immediately before creating one.

  14. No deploy, shared-database migration, production seed, real key, real patient data,
      real payment, deletion, public posting, new service, merge, or push without Majd's
      explicit approval for that action.

---

## 6. D43 -- PHI-GATE PROHIBITION (NO N1/N1.5 PORT)

The local-only N1 implementation is withdrawn. Its three independent negative failures:
  - ordinary health text was treated as general and routed raw to cloud
  - LUCA_AI_MODE=local could point to an external URL while claiming device residency
  - the proposed receipt defaulted missing de-identification evidence to TRUE

These failures compose: raw PHI could leave while the audit receipt claimed it had been
de-identified.

D43 prohibition (applies to every node without exception):
  - do not port N1
  - do not wire N1.5
  - do not "fix the regex"
  - use local N1 files only as negative-test fixtures
  - design a new L2 PHI-egress contract before any PHI-routing implementation

The replacement contract must make five independent inputs explicit:

  1. Data provenance: clinical/health/intake/journal/appointment context is PHI by origin.
  2. Destination evidence: device residency is earned from an enforced resolved destination,
     not asserted by a mode name. Deny non-loopback targets, unsafe redirects, resolution
     changes, and DNS rebinding at the request boundary.
  3. Consent and purpose: current consent, actor authority, intended use, and permitted
     transformation are checked separately and fail closed.
  4. Transformation evidence: raw, de-identified, and unknown are explicit states. Unknown
     never defaults to safe.
  5. Receipt truth: receipts contain decision metadata and evidence state, never raw
     prompt/reply or PHI.

Executable negative tests come first and must prove that:
  - ordinary clinical prose cannot reach a cloud adapter raw
  - an external URL cannot earn device residency
  - an omitted evidence value cannot become deidentified=true

---

## 7. D72 -- DERIVATION MODEL DECISION

Majd has HUMAN-authorized Option A for the current implementation path:
independent Nostr secret (nsec) and independent Spark mnemonic -- two separate secrets.

The final derivation-model decision remains human-owned (D72 is open).
Option B (single BIP-39 mnemonic, dual derivation via NIP-06) stays isolated behind one
explicit seam. Abacus must not activate Option B, select it, or let a builder pick it
by default. Until Majd rules, build the authorized Option A path.

---

## 8. IDENTITY AND RECOVERY CONTRACT

The permanent identity is Solaris subject_id. Email, OAuth, passkey, npub, wallet, and
recovery methods are replaceable bindings.

The accepted detailed contract is docs/beta-v1/IDENTITY-BINDING-CONTRACT.md.
It must be read before any identity code changes.

Required V1 API behavior (summary; full detail in IBC):
  - list bindings
  - issue an operation-bound challenge
  - add with proof of control
  - rotate with lineage and proof
  - unpair/remove by soft revocation
  - set or clear one recovery-designate binding
  - return 409 LAST_USABLE_BINDING with no state change on removal that would lock out
  - require patients to retain a usable non-Nostr sign-in method
  - revoke sessions authenticated through a removed/rotated binding

Passport surface shows:
  Solaris ID         sol_7f3a...                     permanent
  Identity key       npub1zutz...x7nu   Tier 1       [Unpair] [Rotate]
  Sign-in methods    email * OAuth * passkey          [Add] [Remove]
  Recovery designate not set                          [Set up]

A recovery designate receives no key, mnemonic, backup, ciphertext, or secret share.
V1 recovery is the member's passphrase-encrypted backup plus the designate relationship.
Shamir Secret Sharing is V2.

---

## 9. ONBOARDING AND CUSTODY ORDER

  Welcome
    -> Reclaim Your Health     (identity key generated here -- Screen 1)
    -> Reclaim Your Wealth     (Spark wallet created here -- Screen 2)
    -> Reclaim Your Sovereignty
    -> Heal * Learn * Earn
    -> App

Screen 1 generates the real Nostr keypair on the member device using @noble/curves.
Screen 2 creates a real Spark REGTEST wallet on the member device using
@buildonspark/spark-sdk SparkWallet.initialize(), which returns { wallet, mnemonic }.
The server sees only approved public state.

Save panel (identical on Screen 1 and Screen 2):
  - copy with clipboard warning
  - plain download with explicit risk warning
  - passphrase-encrypted backup generated on device
  - passkey storage through WebAuthn largeBlob only when feature-detected, as
    progressive enhancement -- not the only recovery path
  - blocking acknowledgement plus randomized three-item/word spot-check before
    Continue enables

Never persist raw secret material in localStorage, IndexedDB, or sessionStorage.
Prefer external signer (NIP-07/NIP-46) where available; otherwise keep in memory only.

---

## 10. REAL, SIMULATED, AND PROHIBITED BEHAVIOR

Keep and harden (real behavior):
  canonical email auth, subject IDs and bindings, Passport data/consent/export,
  journeys and journal, practitioner functions, AI-provider seam, audits,
  client-held identity/Spark ceremonies

Keep with typed response and visible label (simulated -- correct as-is):
  REGTEST wallet behavior, GPS shadow allocation/receipts, payment splits, sandbox Wompi,
  synthetic LUCA context, provider earnings/admin finance where not settled,
  appointment follow-up simulations, every mock/degraded AI response

Remove from production reachability:
  /api/auth/nostr-mock, /api/auth/google-mock (now 410 tombstones per S1A),
  mock key generation, stored mock nsec-shaped values, app-managed key custody,
  silent cloud fallback, any UI that claims simulation is real

---

## 11. NEVER GENERATE OR INTRODUCE

  - a new app, framework rewrite, second database, Supabase, Firebase, or parallel auth
  - Clinic OS screens or APIs
  - server key/mnemonic generation, receipt, logging, seed data, recovery copy, or
    fake secret
  - hard-coded credentials, endpoints, JWT lifetime, clinical policy, or vendor lock-in
  - diagnostic/prescriptive/clinical/legal/financial autonomous action
  - PHI-bearing logs, analytics, model payloads, receipts, invoices, payment metadata,
    GPS evidence, or Nostr tags
  - a "LUCA Chat" label
  - TTS in V1
  - invisible simulation, silent mock fallback, or fake success
  - destructive migration-history edits, shared-database wipes, or automatic seed
    execution
  - one prompt that "builds everything," broad cleanup by keyword, unexplained dependency
    rewrites, or unbounded refactors
  - claims of green tests, secure behavior, live integrations, or production readiness
    without executable evidence tied to the exact commit

---

## 12. DEFINITION OF COMPLETE BETA V1

Beta V1 is complete only when:

  - the primary member journey -- auth, three-screen onboarding, Passport, LUCA,
    consent/export, and Spark REGTEST wallet -- passes native E2E
  - the practitioner client/consent/booking/profile/earnings journey passes native E2E
    without Clinic OS
  - identity binding proof/lifecycle and last-binding protections pass concurrency and
    denial tests
  - PHI egress, authority, session revocation, secret rejection, and money/patient-
    facing gates fail closed under dependency failure
  - simulated/degraded behavior is typed and visibly labelled
  - lint/build/tests, migration on a disposable production-like copy, backup/restore,
    accessibility, and agreed performance budgets pass
  - a release dossier names what is real, simulated, disabled, and unverified
  - Majd explicitly approves the allowed beta users, data class, deployment, and any
    money-moving environment

An attractive preview, a deployment URL, or Abacus saying "production-ready" is not
completion.
