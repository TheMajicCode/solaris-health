# Solaris Health / LUCA Passport — Agent Instructions

## Read first

Before changing code, read these files in order:

1. `docs/ABACUS_MASTER_CONTEXT.md`
2. `LAUNCH_GATES.md`
3. `docs/ARCHITECTURE.md`
4. `docs/SECURITY.md`
5. `docs/ABACUS_OVERNIGHT_SPRINT_PROMPT.md` when running a focused sprint

Treat GitHub as the source of truth. Abacus.AI is the current acceleration, model-access, agent, and deployment environment; it is not the permanent owner of Solaris identity, wallet keys, clinical records, or the Sovereign Passport.

## Product identity

Solaris is a sovereignty-first holistic health coordination ecosystem.

- **Solaris Passport** is the user-controlled control plane for identity bindings, consent, credentials, agent permissions, wallet connections, data locations, recovery, and GPS contribution history.
- **LUCA** is the user-authorized, non-diagnostic guide. It must have scoped authority and must never be treated as the user's root identity or wallet.
- **Aura Holistic Dental** is the first active clinic node and real-world proving ground.
- **GPS** is an evidence, attribution, policy, approval, and receipt layer. It begins as a shadow ledger; it is not an automatic payment robot.
- **Clinic-in-a-Box** is the future local clinic runtime, vault, and node-management product.
- The visible experience must remain warm, premium, cinematic, human, simple, and sovereign. Do not replace the current look and feel with a generic admin dashboard or a crypto-first interface.

## Non-negotiable architecture rules

1. Preserve the existing React/Vite frontend, Express API, PostgreSQL data model, and ports-and-adapters AI seam unless a change is justified by tests and an ADR.
2. Keep provider-specific AI code behind `backend/src/lib/ai/`.
3. Keep a permanent private Solaris Subject ID. Email, Abacus IDs, DIDs, npubs, wallet addresses, Ory IDs, and clinic directory IDs are replaceable bindings.
4. Agents, humans, organizations, devices, and wallets are separate identities or resources.
5. Never put root wallet keys, root Nostr secrets, unrestricted database credentials, or broad production shell access inside LUCA.
6. Do not store plaintext PHI in public events, GPS receipts, logs, analytics, or model-provider metadata.
7. Do not send regulated or identifiable health data to an external model endpoint unless the exact service, contract, consent, retention, and policy allow it.
8. Prefer additive, reversible migrations. Never edit historical migrations after deployment.
9. No new vendor becomes a launch dependency without a measurable need and an exit path.
10. Preserve exportability. Every new durable user object must have a defined export representation or an explicit reason it is excluded.

## Abacus-specific rules

- Use Abacus RouteLLM through the existing OpenAI-compatible adapter or a thin provider-specific adapter.
- Use a pinned model for auditable health-adjacent flows unless routing variability is explicitly acceptable and the actual returned model is recorded.
- Use `route-llm` for low-risk, nonclinical exploratory tasks where cost/speed routing is beneficial.
- Keep `mock` and `local` modes working.
- Never hard-code Abacus API keys, deployment tokens, or secrets.
- Use `AGENTS.md` for always-on project context and `.abacusai/skills/` for repeatable procedures.
- Do not ask Abacus App Agent to regenerate the application from scratch. Work against this repository through the Abacus coding workspace, CLI, desktop, or GitHub-connected agent.
- Use deployment checkpoints/tags, but Git commits remain the canonical history.

## Execution order

Prioritize work in this order:

1. Real-patient blockers: PHI boundary, authorization, auditability, recovery, backup/restore, rollback, incident response.
2. Broken core journeys and dead ends.
3. Passport authority and consent/capability clarity.
4. AI compute routing, provenance, cost/latency/result receipts, and graceful fallback.
5. GPS shadow-ledger evidence and disputeability.
6. Local-node and wallet proofs only after the above are stable.

## Working method

- Inspect the current implementation before proposing a replacement.
- Make the smallest complete vertical slice that improves the live product.
- Do not stop after writing a plan when implementation is possible.
- Use a dedicated branch. Keep commits small and descriptive.
- Avoid unrelated refactors.
- Add or update tests with every behavior change.
- Update documentation and `.env.example` when configuration changes.
- Never commit generated secrets, production data, backups, or patient exports.
- If a requested task is unsafe or blocked, implement the safest useful subset and record the blocker.

## Validation commands

Run the relevant checks before finishing:

```bash
npm install
npm run lint
npm test
npm run build

cd backend
npm install
npm run lint
npm test
npm run migrate:status
```

When Docker is available:

```bash
docker compose up -d --build
curl http://localhost:5000/api/health
node backend/scripts/smoke-test.js
```

## Definition of done

A change is done only when:

- The user-facing flow is complete and has no obvious dead end.
- Authorization and tenant boundaries are explicit.
- Sensitive-data handling is documented.
- Failure degrades safely.
- Tests pass or the exact environmental blocker is documented.
- Migrations and rollback implications are documented.
- The change preserves the Sovereign Passport and portability strategy.
- The final report lists files changed, tests run, residual risks, and the next best step.
