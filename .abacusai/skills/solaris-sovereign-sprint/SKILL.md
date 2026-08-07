---
name: solaris-sovereign-sprint
description: Use for implementation, hardening, architecture, security, Passport, LUCA,
  GPS, Abacus integration, or release work in the Solaris Health / LUCA Passport repository.
---

# Solaris Sovereign Sprint

## Authoritative context (read before any task)

This repository is governed by the Beta V1 contract-before-code workflow established
by the G0-GOVERNANCE node (2026-08-06). Every new session must read these documents
in the repository before planning or implementing anything:

  docs/beta-v1/WORKFLOW.md              -- contract-before-code loop, source hierarchy,
                                           workspace safety, branch plan, stop conditions
  docs/beta-v1/README.md                -- Beta V1 scope; stack; branch of record
  docs/beta-v1/CONTEXT.md              -- build mandate, safety rules 1-14, D43, D72
  docs/beta-v1/RELEASE-LEDGER.md       -- accepted release state; open P0/P1/P2 findings
  docs/contracts/G0-governance.md      -- finding ledger; implementation allowlists;
                                          verification commands; rollback; stop conditions

Accepted contracts (normative -- copy verbatim, do not weaken):
  docs/beta-v1/IDENTITY-BINDING-CONTRACT.md   (Majd-accepted 2026-08-05)
  docs/beta-v1/WEB-APP-V1-SPEC.md             (authoritative 2026-08-04)

Branch of record:   agent/abacus-beta-v1-hardening
G0 baseline commit: 263ab5a98e1049e7d5a2e4cd483705dc6b47d696 (G0-GOVERNANCE, 2026-08-06).
Do not use the G0 baseline commit as a standing future-node stop condition.

Starting-commit authority for each node:
  The current Majd/Codex node authorization is the canonical source of the exact
  authorized starting branch, commit, tree, and permitted status. Those values are
  copied verbatim into the approved node contract. The previous handoff is supporting
  evidence only; its pre-commit base commit must not be treated as the final accepted
  remote HEAD after an authorized commit has been pushed.
  If the authorization, the approved contract, the local HEAD, and the remote branch
  disagree, stop and report all four values to Majd before touching anything.

## Procedure

1. Verify the current branch, commit, and clean/known worktree before touching anything.
2. Read the five governance documents above. If any is absent, stop and report.
3. Check docs/beta-v1/RELEASE-LEDGER.md for open P0 findings before any implementation.
   No P0 waiver has been granted; no real-patient data or production deploy is permitted
   while any P0 is open.
4. Write a contract under docs/beta-v1/contracts/CONTRACT-<NODE>.md.
   Stop and wait for "PROCEED <NODE>" before writing any application code.
5. After approval, change only the allowlisted files named in the contract.
6. Run the verification commands from the contract and report all exit codes.
7. Produce docs/beta-v1/handoffs/HANDOFF-<NODE>.md recording the starting/base
   commit, diff, commands, exact exit codes, evidence, residual risk, and rollback.
   The handoff records the pre-commit base; it does not contain and must not claim
   to contain its own final commit SHA.
8. Stop for independent Codex review. After Codex review, three separate gates follow:
   a. AUTHORIZE <NODE> COMMIT  -- commit only; return commit SHA, tree, complete
      status, and file list; stop.
   b. Codex verifies that exact commit SHA.
   c. AUTHORIZE <NODE> PUSH    -- push only; return local and remote SHA; stop.
   d. PR and merge require separate explicit authorization.
   The independently verified pushed/merged SHA becomes the starting commit stated
   in the next node's Majd/Codex authorization and copied into that node's contract.

## Two-ladder source hierarchy

When normative intent and observed behavior disagree, record a gap and stop.

Normative (policy):
  1. Majd's explicit instruction and HUMAN decisions
  2. Accepted IDENTITY-BINDING-CONTRACT.md and WEB-APP-V1-SPEC.md
  3. Accepted repository governance contracts
  4. Kickoff context

Descriptive (evidence):
  1. Exact checked-out source and tests at the named commit
  2. Runtime command evidence and accepted B0 report

## D43 prohibition (mandatory)

Do not port N1. Do not wire N1.5. Do not fix the regex. Design a new L2 PHI-egress
contract before any PHI-routing implementation. Use N1 files only as negative-test
fixtures. The five required explicit inputs for the replacement contract are in
docs/beta-v1/CONTEXT.md.

## D72 derivation model

Majd has HUMAN-authorized Option A: independent Nostr secret and independent Spark
mnemonic. D72 remains open. Option B stays isolated behind one seam; Abacus must not
activate or select it.

## LUCA identity

LUCA is an intelligence layer attached to an identity -- never "LUCA Chat".

## Stop conditions

Do not proceed with a change that would:

- expose secrets or PHI;
- bypass consent, tenant, or care-relationship checks;
- give LUCA unrestricted production authority;
- move real money automatically or without human approval;
- rewrite deployed migration history;
- delete exportability;
- introduce a vendor without an exit path;
- modify a file outside the contract allowlist;
- violate any rule in docs/beta-v1/CONTEXT.md ss.5 (rules 1-14).

Implement a safer subset and document the blocker instead.
