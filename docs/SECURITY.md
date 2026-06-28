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
