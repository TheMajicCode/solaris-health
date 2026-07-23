# Solaris Abacus-First Master Context — V4 Execution Baseline

**Status:** execution context for the current `TheMajicCode/solaris-health` repository  
**Date:** July 23, 2026  
**Purpose:** give Abacus AI Agent, human contributors, and future agents one coherent source of context without forcing the entire Solaris vision into one vendor or one sprint.

---

## 1. Executive decision

Continue from the current GitHub repository and its existing Abacus-hosted deployment. Do **not** rebuild Solaris as a new Abacus-generated app and do **not** restart from the old Hercules assumption.

The practical direction is:

> Use Abacus.AI as the current acceleration environment for coding, model access, agent workflows, checkpoints, and deployment, while preserving the existing portable React/Express/PostgreSQL application, the Sovereign Passport, the ports-and-adapters AI seam, GitHub source control, local-model fallback, and the longer-term multi-plane sovereignty architecture.

This is an execution update, not a vision reset.

The earlier roadmaps remain valid at the architectural level:

- V1 established the Passport control plane, portable schemas, separate agent identity, GPS shadow accounting, and gradual local-first evolution.
- V2 separated user identity, workforce identity, token issuance, consent, and agent governance.
- V3 added compute sovereignty, a Compute Policy Router, infrastructure receipts, and future WDK settlement.
- V4 changes the immediate execution shell: use the code and deployment already running on Abacus rather than treating Hercules as the temporary storefront.

---

## 2. What is already real

The repository is not a blank prototype. It already contains a functioning product foundation:

- React 19 + Vite frontend.
- Node.js + Express API.
- PostgreSQL with migrations and production recovery work.
- Member, practitioner, clinic-admin, and admin surfaces.
- Solaris Method assessment and vitality scoring.
- Sovereign Passport dashboard and portable vault export.
- LUCA member guide and practitioner copilot.
- Journey, booking, intake, journal, habits, audio, timeline, and trends flows.
- GPS/LOVE earnings views.
- Cross-chain wallet connection and ownership verification experiments.
- PWA support.
- Tenant-isolation tests.
- JWT revocation.
- AI model and input-hash audit fields.
- Backup/restore, monitoring, health checks, and load-test evidence.
- A live Abacus-hosted deployment.

This means the correct approach is **audit → harden → complete vertical slices → preserve portability**, not generate a parallel application.

---

## 3. What Solaris is

Solaris is an AI-powered holistic health coordination ecosystem that helps people:

- understand and organize their health journey;
- own and export their data;
- connect with trusted practitioners, clinics, labs, wellness providers, and regenerative farms;
- receive non-diagnostic personalized guidance;
- coordinate journeys rather than isolated appointments;
- earn transparent recognition and, later, value for verified contributions.

Solaris is not one clinic, one database, one cloud, one wallet, or one AI model.

### Core products

1. **Solaris Passport**
   - user-facing identity and sovereignty control plane;
   - connects identity bindings, consent, credentials, agents, wallets, data locations, recovery, and GPS history.

2. **LUCA**
   - user-authorized intelligence and guidance layer;
   - separate agent identity;
   - non-diagnostic;
   - scoped tools and revocable capability grants;
   - local-first over time.

3. **Aura / Clinic-in-a-Box**
   - clinic operations, patient coordination, practitioner tools, and future local node;
   - Aura Holistic Dental is the first proving node.

4. **GPS**
   - contribution evidence, attribution, policy, approval, dispute, and settlement receipts;
   - starts as a shadow ledger.

5. **Solaris Node/Fleet**
   - device enrollment, node health, updates, backup status, model status, and future local/private execution.

---

## 4. Experience and visual direction

Preserve the existing look and feel.

The product should feel:

- warm rather than clinical-cold;
- premium rather than templated;
- cinematic and luminous rather than noisy;
- holistic without making unsupported medical claims;
- sovereign without forcing crypto language;
- simple enough for a patient, practitioner, and clinic coordinator to understand.

The visible hierarchy is:

1. **Heal** — understand and take the next health step.
2. **Learn** — receive clear, personalized education.
3. **Earn** — see recognition and transparent value attribution.
4. **Contribute** — share outcomes, referrals, knowledge, or infrastructure under consent.

Do not turn the Passport into a technical DID/wallet dashboard. Show human outcomes first; expose technical proof progressively.

---

## 5. The five sovereignty questions

### Identity sovereignty

Can the person prove and recover access without being trapped inside one app?

- Permanent private Solaris Subject ID.
- Replaceable identity bindings.
- Passkeys and recoverable fallback.
- Affinidi credentials where useful.
- Future Nostr signing bindings.
- Ory as a possible independent identity gateway.
- JumpCloud only for workforce/device/corporate-agent identity.

### Data sovereignty

Can the person control where data lives, who receives it, and how it is exported?

- Consent grants.
- Portable vault export.
- Explicit data locations.
- Encrypted storage.
- Clinic/local nodes later.
- Versioned event envelopes.
- DWN/Pear adapters only after schemas stabilize.

### Agent sovereignty

Can LUCA operate with limited, revocable authority?

- Separate agent identity.
- Owner attestation.
- Capability grants.
- Tool scopes.
- Data-class restrictions.
- Time limits.
- Spending limits.
- Human approvals.
- Signed/auditable actions.

### Compute sovereignty

Can a task run on the best approved target rather than one permanent provider?

Initial routing order:

1. deterministic/local rule engine;
2. on-device or personal node;
3. clinic node;
4. approved regional/dedicated compute;
5. approved public cloud or Abacus RouteLLM;
6. refuse or ask the user for a safer path.

Routing factors:

- data sensitivity;
- consent;
- clinic policy;
- model capability;
- latency;
- cost;
- region/jurisdiction;
- attestation;
- node health;
- network state;
- clinical vs administrative vs general-wellness purpose.

### Financial sovereignty

Can users and contributors hold and move value without Solaris taking custody of root keys?

- GPS shadow ledger first.
- Wallet connection records, not master secrets.
- Human-approved settlement.
- WDK/Spark/Lightning later.
- Conventional payment rails remain available.
- No wallet is required to receive care.

---

## 6. Correct role of Abacus.AI

### Use Abacus for

- coding acceleration against the existing repository;
- Abacus AI Agent/CLI/Desktop multi-step implementation;
- `AGENTS.md` and project skills;
- RouteLLM API access through the existing AI provider seam;
- model experimentation and nonclinical workflow automation;
- app deployment, version checkpoints, and custom-domain staging;
- scheduled operational tasks that do not expose unapproved PHI;
- future AI workflows with explicit tool and data boundaries.

### Do not use Abacus as

- the permanent Solaris identity authority;
- the user's root Passport ID;
- the custodian of wallet keys;
- the only copy of user health records;
- the only deployment path;
- a reason to replace GitHub;
- a black-box clinical decision engine;
- a substitute for consent, audit, authorization, encryption, recovery, or healthcare agreements.

### Model policy

- Use a pinned model for health-adjacent user experiences when reproducibility and auditability matter.
- Use `route-llm` for low-risk, nonclinical tasks where dynamic routing is acceptable.
- Record requested provider/model and, when available, the actual returned model.
- Preserve `mock` and `local` modes.
- Fail safely and disclose degraded mode.
- Never silently send identifiable clinical content to a model endpoint.

---

## 7. Current hard truth and critique

The product is impressive, but the architecture language is ahead of several production controls.

### Strong today

- real product surfaces;
- export-first sovereignty;
- working provider abstraction;
- tests and launch gates;
- role-aware experiences;
- audit fields for AI replies;
- backup/restore and monitoring;
- live deployment and rapid iteration.

### Main gaps

1. **PHI boundary is not production-ready**
   - no confirmed healthcare agreement/BAA for cloud services;
   - health documents and journals need stronger at-rest protection;
   - access logging is not yet a complete PHI audit trail;
   - browser-local messaging keys are not an acceptable long-term secret store.

2. **Identity sovereignty is still partly conceptual**
   - optional DID/npub/wallet fields are not the same as a mature Passport identity-binding model;
   - the app must verify whether a permanent Solaris Subject ID and binding tables truly exist before claiming the V2 design is implemented.

3. **AI provenance is incomplete**
   - model ID and prompt hash exist;
   - compute target, latency, result hash, data class, consent basis, cost estimate, and degraded/fallback status should become execution receipts.

4. **Incident and rollback readiness is incomplete**
   - migration rollback and versioned image recovery need closing;
   - the incident-response playbook needs to become executable and tested.

5. **GPS risks becoming UI before evidence**
   - LOVE points and earnings views are valuable;
   - the next step is contribution evidence, policy versioning, dispute/correction, and shadow allocations—not automatic payment.

6. **The roadmap can inflate the build**
   - Ory, Affinidi, JumpCloud, HydraHost, WDK, MDK, Proto, Nostr, Pear, and DWN are modular options;
   - none should be added merely to make the architecture diagram look complete.

---

## 8. Near-term target architecture

```text
Solaris Experience
  React/Vite member + practitioner + clinic + admin surfaces
                         |
                         v
Solaris Passport Core / Domain Control Plane
  subject | bindings | consent | capability | agent | wallet | data location | GPS
                         |
       +-----------------+------------------+-------------------+
       |                 |                  |                   |
       v                 v                  v                   v
Operational Cloud    AI Provider Port    Portable Vault    Clinic/Local Node
Express/Postgres     Abacus/cloud/local   Markdown/JSONL    later private data
       |                 |
       |          Compute Target / Policy V0
       |       provider | model | data class | latency | result hash
       |                 |
       +-----------------+------------------+
                         |
                    GPS Receipts
       evidence | policy | approval | dispute | settlement later
```

The Passport is the durable abstraction. The first cloud database is not.

---

## 9. Minimum domain model to audit and converge toward

Do not blindly create duplicates. First map existing tables and migrations.

Required concepts:

- `subjects`
- `identity_bindings`
- `organizations`
- `memberships`
- `credentials`
- `consents`
- `capability_grants`
- `agents`
- `agent_owner_attestations`
- `devices`
- `wallet_connections`
- `data_locations`
- `journeys`
- `appointments`
- `contribution_events`
- `split_policies`
- `settlement_proposals`
- `settlements`
- `audit_events`
- `ai_execution_receipts`
- `recovery_policies`

Protected records should carry, where applicable:

- `subject_id`
- `organization_id`
- `actor_id`
- `agent_id`
- `consent_id`
- `capability_grant_id`
- `schema_version`
- `source_system`
- `sensitivity`
- timestamps

---

## 10. AI execution receipt V0

For every important LUCA response, record safe metadata—not plaintext clinical context.

```json
{
  "eventType": "ai_response_generated",
  "subjectRef": "pairwise-or-private-reference",
  "agentId": "sol_agent_luca",
  "provider": "abacus",
  "requestedModel": "claude-sonnet-4-6",
  "actualModel": "when-returned-by-provider",
  "computeTarget": "public_cloud_approved",
  "dataClass": "wellness_sensitive",
  "consentBasis": "active_user_session",
  "latencyMs": 1840,
  "inputHash": "sha256:...",
  "resultHash": "sha256:...",
  "degraded": false,
  "policyVersion": "ai-routing-0.1",
  "createdAt": "..."
}
```

Rules:

- no raw prompt or response in the receipt;
- the normal conversation record may still store the reply under the application's retention policy;
- compute receipts must not expose a condition, clinic, and wallet in one public correlatable record;
- use private or pairwise identifiers;
- make receipts exportable.

---

## 11. Sprint priority stack

### P0 — Real-patient safety and recoverability

- Explicit pre-production/PHI boundary in onboarding and upload flows.
- Access audit events for sensitive resources.
- Encryption plan and secret-storage corrections.
- Executable incident-response runbook.
- Migration-on-production-copy test.
- Rollback path and image/version strategy.

### P1 — Abacus-first, provider-independent AI

- Add an explicit Abacus provider mode.
- Preserve generic OpenAI-compatible and local modes.
- Add request timeout and graceful fallback.
- Add compute-target and AI execution-receipt schema.
- Record latency, provider, model, result hash, and degraded status.
- Pin the model for health-adjacent production use.
- Add tests and configuration documentation.

### P1 — Complete the visible product

- Audit every primary role journey for dead ends.
- Preserve current visual language.
- Make LUCA actions lead somewhere useful.
- Make Passport controls understandable.
- Add clear “where my data lives” and “who has access” views.
- Ensure practitioner intake, booking, consent, and follow-up form a closed loop.

### P2 — Passport authority

- Verify or add permanent Solaris Subject ID.
- Map current IDs as bindings.
- Add capability-grant and agent-owner records.
- Add revocation and approval status.
- Export these objects in the sovereign vault.

### P2 — GPS evidence

- Define contribution receipts.
- Add policy versions.
- Add shadow allocations.
- Add dispute/correction state.
- Do not move real money.

### P3 — Later proofs

- Ory/Affinidi identity proof.
- Nostr remote signing proof.
- local LUCA node.
- Hydra/deidentified compute adapter.
- WDK test wallet.
- Pear/DWN isolated proofs.

Do not start P3 while P0 remains open.

---

## 12. Anti-goals

- No full rewrite.
- No second parallel product database.
- No “crypto first” onboarding.
- No mandatory DID or wallet.
- No automated diagnosis or prescribing.
- No raw PHI in model logs or GPS receipts.
- No unrestricted agent shell or database access.
- No hard-coded provider royalty or hidden split.
- No new vendor without an adapter and exit path.
- No claiming compliance because a vendor markets security.
- No shipping UI that implies a capability is live when it is only conceptual.

---

## 13. Definition of a successful next release

A successful Abacus-first release should demonstrate:

1. The existing visual experience remains intact or improves.
2. LUCA runs through an explicit, auditable Abacus provider mode with safe fallback.
3. The app tells the truth about data and AI boundaries.
4. The Passport visibly controls access, export, and identity connections.
5. Core member → practitioner → booking → consent → follow-up journeys close without dead ends.
6. The system can be rebuilt and rolled back from GitHub.
7. Tests and launch gates reflect reality.
8. New architecture is introduced through adapters and receipts, not vendor lock-in.
9. No real-money GPS automation is enabled.
10. The final sprint report clearly states what is implemented, what is simulated, what is blocked, and the next best step.

---

## 14. Source map

This V4 context consolidates:

- `Solaris_Sovereign_Agentic_Ecosystem_Roadmap_V1` — Passport, agent identity, cloud/local separation, portable event schema, GPS shadow ledger, build phases.
- `Solaris_Sovereign_Agentic_Ecosystem_Roadmap_V2` — Ory/Affinidi/JumpCloud role separation, stable Solaris Subject ID, organization and agent governance.
- `Solaris_Sovereign_Agentic_Ecosystem_Roadmap_V3` — Compute Policy Router, Hydra as optional compute, MDK/Proto patterns, WDK as future settlement, evidence-based GPS receipts.
- Current repository documentation and launch gates — the actual implementation baseline.

When a roadmap assumption conflicts with current code, inspect the repository and update this document rather than pretending the older assumption is still true.
