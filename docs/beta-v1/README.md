# Solaris Health -- Beta V1

Governance node: G0-GOVERNANCE (2026-08-06)
Branch of record: agent/abacus-beta-v1-hardening
Source commit: 263ab5a98e1049e7d5a2e4cd483705dc6b47d696
Tree: 452f36ce167f2357929f011cb833af580c3ed09b

---

## What Beta V1 is

Beta V1 is a closed, invitation-only release of Solaris Health targeting:

  - member Solaris Passport (identity, consent, data, export, recovery)
  - LUCA as an intelligence layer attached to an identity (never "LUCA Chat")
  - practitioner portal (clients, consent-scoped view, bookings, availability,
    profile, earnings)
  - member-held Nostr identity key and identity bindings
  - client-created Spark spending wallet on REGTEST/sandbox
  - visibly simulated GPS shadow receipts and other approved simulations
  - export, consent, recovery-designate, safe failure, and release evidence

## What Beta V1 is not

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

## Stack

  Frontend:  React 19 + Vite + JavaScript
  Backend:   Node.js + Express + JavaScript
  Database:  one PostgreSQL instance (no second database)
  Identity:  canonical auth system -- email/password, Nostr, OAuth bindings

## How to read this docs/beta-v1/ tree

  README.md                    this file -- scope, stack, branch of record
  CONTEXT.md                   full build mandate, safety rules, D43, D72, product detail
  WORKFLOW.md                  contract-before-code loop, source hierarchy, workspace safety
  RELEASE-LEDGER.md            accepted release state: real/simulated/disabled/blocked,
                               open P0/P1/P2 findings, payments ledger
  IDENTITY-BINDING-CONTRACT.md accepted identity binding contract (Majd, 2026-08-05)
  WEB-APP-V1-SPEC.md           authoritative web app build spec (2026-08-04)
  contracts/CONTRACT-<NODE>.md per-node implementation contracts (created before each node)
  handoffs/HANDOFF-<NODE>.md   per-node handoff evidence (created after each node)

The root governance contract is docs/contracts/G0-governance.md.

## Important identity

LUCA is an intelligence layer attached to an identity -- never "LUCA Chat".

## No P0 waiver

No P0 finding has been waived. Real-patient use and production deployment are blocked
until all P0 findings are resolved. See RELEASE-LEDGER.md for the current finding ledger.

## Completion criteria

Beta V1 is complete only when all criteria in CONTEXT.md section 12 are met.
An attractive preview, a deployment URL, or a claim of "production-ready" is not
completion.
