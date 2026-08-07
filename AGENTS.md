# Solaris Health / LUCA Passport -- Agent Instructions

## GOVERNANCE (read before anything else)

This repository is governed by the Beta V1 contract-before-code workflow.
Every new Abacus session must read, in this order:

  1. docs/beta-v1/WORKFLOW.md      -- contract-before-code loop, source hierarchy,
                                      workspace safety, branch plan, stop conditions
  2. docs/beta-v1/README.md        -- what Beta V1 is and is not; stack; branch of record
  3. docs/beta-v1/CONTEXT.md       -- full build mandate, safety rules, D43, D72
  4. docs/beta-v1/RELEASE-LEDGER.md -- accepted release state: real/simulated/disabled,
                                       open P0/P1/P2 findings, no P0 waiver granted
  5. docs/contracts/G0-governance.md -- authoritative source hierarchy, finding ledger,
                                        implementation allowlist, verification commands

Authoritative accepted contracts:
  - docs/beta-v1/IDENTITY-BINDING-CONTRACT.md  (Majd-accepted 2026-08-05)
  - docs/beta-v1/WEB-APP-V1-SPEC.md            (authoritative 2026-08-04)

Branch of record: agent/abacus-beta-v1-hardening.
G0 baseline commit: 263ab5a98e1049e7d5a2e4cd483705dc6b47d696 (G0-GOVERNANCE, 2026-08-06).
Do not use the G0 baseline commit as a standing stop condition for later nodes.

Starting-commit authority for each node:
  The current Majd/Codex node authorization is the canonical source of the exact
  authorized starting branch, commit, tree, and permitted status. Those values are
  copied verbatim into the approved node contract. The previous handoff is supporting
  evidence only; its pre-commit base commit must not be treated as the final accepted
  remote HEAD after an authorized commit has been pushed.
  If the authorization, the approved contract, the local HEAD, and the remote branch
  disagree, stop and report all four values to Majd before touching anything.

Do not write directly to main.

Contract-before-code rule: before any implementation node, write a contract under
docs/beta-v1/contracts/CONTRACT-<NODE>.md, stop, and wait for "PROCEED <NODE>".
See docs/beta-v1/WORKFLOW.md for the full eight-step loop.

LUCA is an intelligence layer attached to an identity -- never "LUCA Chat".

---

## Read next (existing project context)

After reading the governance documents above, also read:

  docs/ABACUS_MASTER_CONTEXT.md
  docs/ARCHITECTURE.md
  docs/SECURITY.md

---

## Product identity

Solaris is a sovereignty-first holistic health coordination ecosystem.

- Solaris Passport is the user-controlled control plane for identity bindings, consent,
  credentials, agent permissions, wallet connections, data locations, recovery, and GPS
  contribution history.
- LUCA is the user-authorized, non-diagnostic intelligence layer attached to an identity.
  It must have scoped authority and must never be treated as the user's root identity or
  wallet. Never label it "LUCA Chat".
- Aura Holistic Dental is the first active clinic node and real-world proving ground.
- GPS is an evidence, attribution, policy, approval, and receipt layer. It begins as a
  shadow ledger; it is not an automatic payment robot.
- The visible experience must remain warm, premium, cinematic, human, simple, and
  sovereign. Do not replace the current look and feel with a generic admin dashboard or
  a crypto-first interface.

## Non-negotiable architecture rules

1. Preserve the existing React/Vite frontend, Express API, PostgreSQL data model, and
   ports-and-adapters AI seam unless a change is justified by tests and an ADR.
2. Keep provider-specific AI code behind backend/src/lib/ai/.
3. Keep a permanent private Solaris Subject ID. Email, Abacus IDs, DIDs, npubs, wallet
   addresses, and clinic directory IDs are replaceable bindings.
4. Agents, humans, organizations, devices, and wallets are separate identities.
5. Never put root wallet keys, root Nostr secrets, unrestricted database credentials,
   or broad production shell access inside LUCA.
6. Do not store plaintext PHI in public events, GPS receipts, logs, analytics, or
   model-provider metadata.
7. Do not send regulated or identifiable health data to an external model endpoint unless
   the exact service, contract, consent, retention, and policy allow it.
8. Prefer additive, reversible migrations. Never edit historical migrations after deploy.
9. No new vendor becomes a launch dependency without a measurable need and an exit path.
10. Preserve exportability. Every new durable user object must have a defined export
    representation or an explicit exclusion reason.

## Abacus-specific rules

- Use the existing OpenAI-compatible adapter or a thin provider-specific adapter.
- Use a pinned model for auditable health-adjacent flows.
- Keep mock and local modes working.
- Never hard-code Abacus API keys, deployment tokens, or secrets.
- Do not ask Abacus App Agent to regenerate the application from scratch.
- Use deployment checkpoints/tags, but Git commits remain the canonical history.

## Execution order

1. Real-patient blockers: PHI boundary, authorization, auditability, recovery, rollback.
2. Broken core journeys and dead ends.
3. Passport authority and consent/capability clarity.
4. AI compute routing, provenance, receipts, and graceful fallback.
5. GPS shadow-ledger evidence and disputeability.
6. Local-node and wallet proofs only after the above are stable.

## Working method

- Inspect the current implementation before proposing a replacement.
- Make the smallest complete vertical slice.
- Use a dedicated branch. Keep commits small and descriptive.
- Add or update tests with every behavior change.
- Update documentation and .env.example when configuration changes.
- Never commit generated secrets, production data, backups, or patient exports.
- If a requested task is unsafe or blocked, implement the safest useful subset and
  record the blocker.

## Validation commands

Run the relevant checks before finishing:

  cd backend
  npx jest --runInBand --forceExit > /tmp/jest.log 2>&1
  jest_rc=$?
  tail -20 /tmp/jest.log
  echo "JEST_EXIT=$jest_rc"

  npm run lint
  npm run migrate:status

## Definition of done

A change is done only when:

- The user-facing flow is complete and has no obvious dead end.
- Authorization and tenant boundaries are explicit.
- Sensitive-data handling is documented.
- Failure degrades safely.
- Tests pass or the exact environmental blocker is documented.
- Migrations and rollback implications are documented.
- The change preserves the Sovereign Passport and portability strategy.
- The final report lists files changed, tests run, residual risks, and next best step.
