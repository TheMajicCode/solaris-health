# Security

Security model, hardening checklist, and disclosure policy for
**Solaris Health / LUCA Passport**. The platform handles sensitive health data, so
security is a first-class concern.

## Table of Contents

- [Threat model](#threat-model)
- [Authentication & authorization](#authentication--authorization)
- [Data protection](#data-protection)
- [Web3 / wallet security](#web3--wallet-security)
- [Input validation](#input-validation)
- [Hardening checklist](#hardening-checklist)
- [Dependency management](#dependency-management)
- [Responsible disclosure](#responsible-disclosure)

---

## Threat model

| Asset | Threat | Mitigation |
|-------|--------|------------|
| Health records | Unauthorized read | JWT auth + role guards on every route |
| Passwords | Credential theft | bcrypt hashing; hashes never returned |
| Sessions | Token forgery | Signed JWT (`JWT_SECRET`), 30-day expiry |
| Other users' data | Horizontal escalation | Server derives `userId` from the token, not the client |
| Wallet ownership | Spoofed linkage | SIWE-style signature verification |
| Database | SQL injection | Parameterized queries throughout |

---

## Authentication & authorization

- **JWT** signed with `JWT_SECRET`; payload `{ userId, email, role }`; 30-day expiry.
- `authMiddleware` rejects missing/invalid tokens with `401`.
- Role guards (`requirePatient`, `requireStaff`, `requireAdmin`) enforce `403` on
  mismatch.
- **Resource ownership is derived from the token**, not request parameters — a patient
  cannot read another user's timeline/vitals (returns `403`).
- Passwords are hashed with **bcrypt**; `shapeUser()` strips `password_hash` from all
  responses.

> 🔑 **Production must set a long, random `JWT_SECRET`.** The development default
> (`dev-secret-key`) is insecure and must never ship.

---

## Data protection

- **In transit:** TLS terminated at Nginx; serve the app over HTTPS only.
- **At rest:** wallet addresses support an encrypted column (`address_enc`); document
  visibility defaults to `private`.
- **Soft deletes:** `users`, `contributions`, `credentials` use `deleted_at` so data
  can be withdrawn from active use.
- **Sovereign export:** users can export and remove their data (data portability).

---

## Web3 / wallet security

- Ownership is proven with **`personal_sign`** (SIWE-style) — never a transaction, so
  no funds move and no gas is spent.
- `verifyEvmSignature` recovers the signer and compares to the claimed address; failure
  returns `false` (never throws).
- The server only ever **reads** public chain data (balances, tx history). It never
  holds private keys.
- Nonces are issued server-side for the signing challenge.

---

## External AI provider & retention boundary

LUCA's AI calls go through a single factory (`backend/src/lib/ai/index.js`). What
crosses the boundary, and what is retained, is explicit:

| Mode (`LUCA_AI_MODE`) | Where inference runs | Crosses network boundary? |
|---|---|---|
| `mock` (default, no key) | In-process canned responses | No |
| `local` | Self-hosted OpenAI-compatible endpoint (e.g. Ollama) | LAN only |
| `abacus` / `cloud` / OpenAI-compatible | Managed external provider | **Yes** |

**What is sent to an external provider (per request):** the system prompt, a
context summary built from the member's Passport (assessment archetype, recent
check-in metrics, upcoming bookings), and the chat message. Nothing is sent when
running in `mock`/`local` mode.

**Restricted-identifier redaction (rule v0):** before any prompt leaves the
boundary to an external provider, `backend/src/lib/phi-boundary.js` scans it and
replaces SSN-like, payment-card-like, and IBAN-like tokens with `[REDACTED:*]`
placeholders (`redactForExternalAI`). The member's original message is stored
unmodified in their own record; only the *outbound* copy is redacted. Health
content itself (symptoms, metrics) is the product's purpose and is sent as-is
under the member's consent basis — this rule targets identifiers that should
never be needed for coaching.

**What is retained where:**

- `luca_messages` (Postgres): full conversation history, including `model_id`
  and `inputs_hash` — the member's own data, exportable and deletable.
- `ai_execution_receipts` (Postgres): **hashes only** (SHA-256 of input/output),
  provider id, compute target, latency, degraded/error class, policy version.
  No prompt or response text — receipts are safe to export and audit.
- Application logs: no prompt/response bodies, no health-derived trigger values;
  errors log error class/message only.
- External provider retention is governed by that provider's terms; the provider
  id recorded in each receipt (`abacus:<model>` etc.) makes the responsible
  party auditable per interaction.

> ⚠️ This is a pre-HIPAA engineering control, not a compliance certification.
> See `LAUNCH_GATES.md` for the honest launch-readiness state.

---

## Solaris identity (ADR 001)

- **Non-PII permanent subject id** — `sol_` + 32 random hex per user
  (`solaris_subjects`, migration 023); never derived from email, name or the user
  UUID, never rotated. The `users` table remains the only place login PII lives.
- **Bindings, not identities** — email/DID/nostr/wallet/clinic are replaceable
  bindings (`solaris_identity_bindings`) with created/verified/revoked states.
  Email bindings are stored **hash-only** (sha256 of the lowercased address) — no
  PII is duplicated outside `users`, and no PII appears in the vault identity file.
- **LUCA never holds root identity keys** — the agent cannot create, rotate or
  revoke subjects or bindings; it acts only under scoped, revocable capability
  grants tied to the owner's subject (`owner_subject_id`).
- **GPS end address is configuration, not custody** — a Lightning-address-shaped
  text value on the subject, validated server-side; this showcase makes no real
  payments and stores no keys.

## Agent authority & economic transparency (sprint v4)

- **Agent capability grants** — the LUCA agent acts only under explicit grants
  (`agent_capability_grants`, migration 020): scoped capabilities, optional expiry,
  revocation, and a human-approval flag for sensitive actions. Every grant use is
  written to `audit_logs` (`agent.grant.used`). Disabling LUCA
  (`POST /api/agents/luca/disable`) blocks agent chat with `403 { agentDisabled }`
  without deleting or logging out the user.
- **GPS allocation evidence** — every value split records a shadow allocation
  receipt (`gps_allocation_receipts`, migration 021) whose evidence document
  contains only structural facts (UUIDs, amounts, split fractions, timestamps) —
  never names or health data — plus a sha256 evidence hash and policy version.
  Allocations are `shadow = TRUE` always: no real settlement exists. Receipts are
  evidence anyone with access can verify — GPS is a standalone, self-configured
  open protocol with no central adjudicating authority; Solaris is only the
  default recipient configuration until the receiving identity sets its own end
  address. A participant can flag a receipt that looks off; flags and any
  corrections are logged on the record and audited (`gps.allocation.disputed` /
  `gps.allocation.resolved`), and access to explanations is restricted to
  allocation participants or admins.
- **Read-only mode** — setting `READ_ONLY_MODE=true` freezes all mutating routes
  (503 `{ readOnly: true }`) while reads, login and logout continue to work; used
  as the incident-response write-freeze (see `docs/INCIDENT_RESPONSE.md`).

## Input validation

- All SQL uses **parameterized queries** (`$1, $2, …`) — no string concatenation.
- Addresses are validated (`validateAddress`) before any chain interaction or storage.
- Chat content is checked for emptiness; payload fields are validated on auth routes.
- JSON body size should be bounded at the proxy/Express layer in production.

---

## Hardening checklist

Before going to production:

- [ ] Set a strong, unique `JWT_SECRET` (≥ 32 random bytes).
- [ ] Set a strong `DB_PASSWORD`; restrict Postgres network exposure.
- [ ] Serve exclusively over HTTPS; enable HSTS at the proxy.
- [ ] Change all seed/demo passwords.
- [ ] Add rate limiting on `/api/auth/*` (e.g. `express-rate-limit`).
- [ ] Set security headers (`helmet`): CSP, X-Frame-Options, X-Content-Type-Options.
- [ ] Restrict CORS to known origins.
- [ ] Bound request body size.
- [ ] Run `npm audit` and patch high/critical issues.
- [ ] Enable database backups + tested restores.
- [ ] Scrub secrets from logs; never log tokens or password hashes.
- [ ] Monitor `/api/health` and `/api/metrics`; alert on anomalies.

---

## Dependency management

```bash
npm audit                 # frontend
cd backend && npm audit   # backend
```

Patch high/critical advisories promptly. Pin major versions and review transitive
updates. CI runs the test suite on every push to catch regressions from updates.

---

## Responsible disclosure

If you discover a vulnerability, please **do not open a public issue**. Email the
maintainers at **security@solaris.health** with:

1. A description and impact assessment.
2. Reproduction steps or a proof of concept.
3. Any suggested remediation.

We aim to acknowledge within 72 hours and will coordinate a fix and disclosure
timeline with you. Thank you for helping keep users safe.
