# Solaris Identity Binding Contract

`[codex 2026-08-04]`

**Layer:** L2 contract. **Status:** HUMAN accepted by Majd on 2026-08-05 for implementation planning before `openapi.yaml` v1. It defines the intended API and required migration behavior; it does not claim the endpoints or proposed columns already exist.

`V4` below means:

`Solaris initial build with Abacus From Github (solaris-health)/solaris-health-agent-abacus-sovereign-sprint-v4/solaris-health-agent-abacus-sovereign-sprint-v4`

## 1. Scope

This contract defines:

- list identity bindings;
- add a binding only after proof of control;
- rotate a binding while preserving lineage;
- unpair an identity key or remove a sign-in method without permitting account lockout;
- set or clear one recovery-designate binding;
- the relationship between binding `status`, assurance `tier`, sign-in usability, and patient safety;
- common errors, audit events, secret-material rejection, idempotency, and race behavior.

It does **not** define npub login, password reset, OAuth provider callbacks, WebAuthn credential storage, Spark custody, key derivation, or recovery by sharing a secret. Authentication stays in the canonical auth system and one Postgres database. D72 remains untouched.

## 2. Load-bearing invariants

1. The permanent identity is `subject_id`; a binding is a replaceable pointer to it.
2. The server never generates, receives, stores, or logs an nsec, raw 64-hex private key, mnemonic, seed phrase, or Spark mnemonic.
3. A public identifier is never marked verified merely because an authenticated session submitted it. Verification requires proof of control bound to the intended operation and subject.
4. `status` and `bindingTier` are orthogonal. `status` answers whether the row is live; tier answers what an otherwise-live binding may authorize.
5. A binding grants only the intersection of its type capability, status, tier, and current policy. Tier never turns an email or passkey into a Nostr signing key.
6. A T0 binding is never a sole login. A patient account is never npub-only, even when its Nostr binding is T1 or T2.
7. Removal is a soft revocation. Rows and lineage are retained; no endpoint hard-deletes a binding.
8. Every state-changing operation is owner-scoped, recently re-authenticated, idempotent, transactional, and audited without binding values or proof payloads.
9. A recovery designate is a verified fallback binding on the same Solaris identity. It is not a third-party custodian, receives no backup file, and receives no copy or share of any secret.
10. Client-visible failures are typed. In particular, deleting the last usable sign-in binding returns `409 LAST_USABLE_BINDING` and makes no state change.

## 3. Verified current storage versus proposed additions

### 3.1 VERIFIED current columns

Migration `023` creates this exact shape (`V4/backend/migrations/023_solaris_identity.sql:42-56`), and `026` widens the binding-type constraint (`V4/backend/migrations/026_identity_spine_sweep.sql:44-50`).

| Column | Verified type/constraint | Contract meaning |
|---|---|---|
| `id` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Stable binding resource ID. |
| `subject_id` | `VARCHAR(40) NOT NULL`, FK to `solaris_subjects(subject_id)` with cascade | Permanent Solaris identity owner. It is **not UUID**. |
| `binding_type` | `VARCHAR(30) NOT NULL` | One of `email`, `did`, `nostr`, `wallet`, `clinic`, `passkey`, `lightning_address`, `oauth`, `external_id`. |
| `binding_value` | `TEXT NULL` | Public or opaque identifier only. Email remains `NULL`; email is represented by its hash. Never secret material. |
| `binding_hash` | `VARCHAR(64) NOT NULL` | Server-computed SHA-256 of the canonical identifier. Clients never supply it. |
| `status` | `VARCHAR(20) NOT NULL DEFAULT 'active'` | `pending`, `active`, or `revoked`. |
| `verified_at` | `TIMESTAMP NULL` | Server time when the latest required control proof succeeded. |
| `created_at` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` | First creation time. |
| `revoked_at` | `TIMESTAMP NULL` | Soft-revocation time. |

The current uniqueness rule is `UNIQUE (subject_id, binding_type, binding_hash)` (`023_solaris_identity.sql:55`). Every insert must supply `binding_hash`.

### 3.2 PROPOSED migration additions

These columns are planned but do not exist in the snapshot. They were named in `IDENTITY-CONVERGENCE.md:181` and must land before the API is implemented.

| Column | Proposed type/constraint | Contract meaning |
|---|---|---|
| `binding_tier` | `VARCHAR(2) NOT NULL DEFAULT 'T0' CHECK (binding_tier IN ('T0','T1','T2'))` | Assurance/authority tier; independent of `status`. |
| `is_recovery_designate` | `BOOLEAN NOT NULL DEFAULT FALSE` | Whether this active, verified, usable sign-in binding is the subject's one selected fallback. |
| `supersedes_binding_id` | `UUID NULL REFERENCES solaris_identity_bindings(id) ON DELETE RESTRICT` | On a successor row, points to the binding it replaced. |
| `rotated_at` | `TIMESTAMPTZ NULL` | On the predecessor row, records when rotation completed. |

Required constraints/indexes in the same migration:

- at most one active recovery designate per `subject_id`;
- a recovery designate must have `status='active'` and non-null `verified_at`;
- a row cannot supersede itself;
- a login-capable identifier cannot be `pending` or `active` on two subjects at once: unique `(binding_type, binding_hash)` for `email`, `nostr`, `passkey`, and `oauth` where `status IN ('pending','active')`;
- retain the existing subject-scoped uniqueness constraint.

Backfill rules are deliberate, not inferred:

- existing active, verified `email` bindings become T1 because the canonical email/password credential is already a sole sign-in method;
- existing Nostr bindings become T0 unless a recorded backup ceremony and fresh possession proof justify T1; do not infer backup from `status='active'`;
- all revoked rows retain `status='revoked'`; their tier grants no authority;
- no existing row becomes a recovery designate automatically.

### 3.3 Server-computed canonical hashes

The server canonicalizes, then hashes with SHA-256 to 64 lowercase hex characters:

| Type | Canonical input |
|---|---|
| `nostr` | validated, lowercase canonical `npub1…`; raw hex pubkeys are not accepted from clients |
| `email` | trimmed lowercase email; `binding_value` remains `NULL` |
| `oauth` | canonical provider name plus provider subject ID, never display email |
| `passkey` | canonical credential ID bytes encoded base64url |
| other types | adapter-owned canonical public/opaque identifier |

The hash is used for matching and uniqueness. It is never returned by the API and never accepted in a request body.

## 4. Status, tier, and usability

### 4.1 Status lifecycle

`pending → active → revoked`

- `pending`: verification is incomplete; grants no authority and is not a usable sign-in.
- `active`: verification succeeded; capabilities still depend on type and tier.
- `revoked`: grants no authority, is not returned as usable, and cannot satisfy lockout checks.

Re-adding the exact identifier after a simple unpair may reactivate its existing row only after a fresh proof, with a new `verified_at` and an audit event. A row with non-null `rotated_at` is superseded and cannot be silently reactivated; return `409 BINDING_SUPERSEDED`.

### 4.2 Tier lifecycle

| Tier | Meaning | Sign-in rule |
|---|---|---|
| `T0` | Control proved, but backup/recovery assurance is not established | Second factor only; never a sole login |
| `T1` | Control re-proved and the V1 backup ceremony was confirmed | May be a sole login if its type supports login |
| `T2` | Server-verified hardened signer/credential path | May receive the type's high-assurance capabilities |

For the Nostr identity key, T0/T1/T2 carry the authority rules in `IDENTITY-CONVERGENCE.md:93-101`. T1 confirmation contains only ceremony metadata—never backup contents. T2 cannot be requested by a client boolean; it requires an attested NIP-46/hardware-capable adapter.

For email, OAuth, and passkey, the canonical auth adapter determines the attained tier. Tier does not add signing powers the binding type lacks.

### 4.3 Usable sign-in predicate

A binding is a `usableSignIn` only when all are true:

1. it belongs to the authenticated subject;
2. `status='active'`;
3. `verified_at` is non-null;
4. its type is enabled as a sign-in method by the canonical auth system;
5. its tier is T1 or T2;
6. it is not expired, superseded, provider-disabled, or otherwise revoked by policy.

T0 never satisfies this predicate.

Additional patient invariant: after any mutation, a patient must retain at least one usable **non-Nostr** sign-in binding (`email`, `oauth`, or a supported `passkey`). Violation returns `409 PATIENT_REQUIRES_NON_NOSTR_BINDING` with no state change.

## 5. Public wire model

### 5.1 `IdentityBinding`

```json
{
  "id": "<synthetic-uuid>",
  "type": "nostr",
  "label": "Identity Key",
  "publicValue": "<synthetic-npub>",
  "maskedValue": "npub1…demo",
  "status": "active",
  "tier": "T1",
  "usableSignIn": true,
  "isRecoveryDesignate": false,
  "capabilities": ["second_factor", "sole_login", "sign_export"],
  "verifiedAt": "2026-08-04T12:00:00Z",
  "createdAt": "2026-08-04T11:55:00Z",
  "revokedAt": null,
  "supersedesBindingId": null,
  "rotatedAt": null,
  "actions": {
    "canRotate": true,
    "canUnpair": true,
    "canRemove": false,
    "canSetRecoveryDesignate": true
  }
}
```

Rules:

- `publicValue` is returned only for intentionally public binding types such as Nostr npub, DID, or public wallet address.
- Email returns `publicValue: null` and a masked display value. OAuth/provider subject IDs, passkey credential IDs/public keys, `binding_hash`, proofs, challenges, and internal metadata are never returned.
- `actions` are server-computed from current invariants; they are hints for UI, not authorization.
- `canUnpair` is the Nostr/DID/wallet UI label. `canRemove` is the email/OAuth/passkey UI label. Both call the same `DELETE` endpoint.
- all API timestamps are RFC 3339 UTC strings even where legacy storage uses `TIMESTAMP` without time zone.

### 5.2 Common error

```json
{
  "error": {
    "code": "LAST_USABLE_BINDING",
    "message": "Add and verify another sign-in method before removing this one.",
    "requestId": "<synthetic-request-id>",
    "details": {
      "requiredAction": "ADD_SIGN_IN_METHOD"
    }
  }
}
```

Errors never echo a submitted binding value, proof, OTP, OAuth artifact, WebAuthn object, signature, or rejected secret-shaped value.

## 6. Proof protocol

### 6.1 Recent step-up

Every mutation requires an authenticated owner session whose last successful primary authentication is no more than five minutes old. The session must identify the authentication method and binding (`auth_time`, `amr`, and `binding_id`, or equivalent server-side session data). Otherwise return `403 STEP_UP_REQUIRED` before inspecting mutation data.

This is authorization to change the subject. It does not replace proof of the candidate binding.

### 6.2 Action-bound challenge

Nostr add and rotate use a dedicated binding challenge. Do not reuse the login message `solaris-login:<nonce>` because it does not express binding intent.

The server creates a 32-byte CSPRNG nonce and an operation-bound message:

```text
solaris.identity.bind:v1|<operation>|<challengeId>|<subjectId>|<bindingType>|<candidateBindingHash>|<replacesBindingId-or-new>|<expiresAt>
```

The client signs the SHA-256 digest of the exact UTF-8 message, matching `verifyChallengeSignature` (`V4/backend/src/lib/nostr.js:49-66`). The server never accepts a client-supplied replacement message.

Challenge rules:

- 120-second TTL;
- bound to authenticated subject, operation, candidate hash, binding type, and predecessor when rotating;
- rate-limited by subject and hashed network metadata;
- atomically consumed **before** proof verification; invalid proof still consumes it;
- replay, expiry, subject mismatch, operation mismatch, or candidate mismatch returns 401;
- challenge/proof bodies are never logged.

### 6.3 Proof union

```text
NostrProof:
  kind = nostr_schnorr
  challengeId
  signatureHex (128 hex chars; public signature, never logged)

AuthAdapterProof:
  kind = auth_adapter_assertion
  challengeId
  assertionId (opaque, single-use reference issued by canonical email/OAuth/passkey adapter)
```

The binding API does not accept passwords, OAuth access tokens, passkey private material, or a second auth database. Provider-specific verification occurs in the canonical auth adapter; this endpoint consumes its short-lived, subject- and challenge-bound assertion.

### 6.4 Backup confirmation and tier assignment

For a Nostr binding, an optional V1 confirmation may contain only:

```json
{
  "ceremonyVersion": "v1",
  "spotCheckPassed": true
}
```

It never contains an nsec, private hex, mnemonic, backup file, ciphertext, passphrase, word positions, or answers. Fresh possession proof plus this confirmation permits T1. Without it the binding is T0. T2 requires server-verifiable hardened-signer evidence and is not self-asserted.

## 7. Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/identity/bindings` | List owner-scoped bindings and permitted actions. |
| `POST` | `/api/identity/binding-challenges` | Issue an action-bound add/rotate proof challenge. |
| `POST` | `/api/identity/bindings` | Add or re-verify a binding with candidate-control proof. |
| `POST` | `/api/identity/bindings/{id}/rotate` | Atomically replace a binding with a proved successor. |
| `DELETE` | `/api/identity/bindings/{id}` | Soft-revoke; UI calls this Unpair or Remove. |
| `PUT` | `/api/identity/recovery-designate` | Set one eligible binding, or clear it with `bindingId: null`. |

All require owner JWT. Every mutation also requires recent step-up and an `Idempotency-Key` header. The list is never cross-subject and has no admin override in V1.

### 7.1 List

`GET /api/identity/bindings`

Success `200`:

```json
{
  "solarisId": "sol_<synthetic-id>",
  "bindings": [],
  "recoveryDesignateBindingId": null
}
```

Behavior:

- returns active and pending bindings by default;
- `?includeRevoked=true` may return the owner's revoked history;
- sorts active identity key first, then sign-in methods, then other bindings, with newest first inside a group;
- never reveals private/opaque identifiers or hashes.

Errors: `401 AUTH_REQUIRED`; `404 IDENTITY_NOT_FOUND`.

### 7.2 Create proof challenge

`POST /api/identity/binding-challenges`

Request for Nostr add:

```json
{
  "operation": "add",
  "candidate": {
    "type": "nostr",
    "publicValue": "<synthetic-npub>"
  }
}
```

Request for rotation additionally supplies `replacesBindingId`. The server validates ownership/type, canonicalizes the candidate, computes the hash, and returns `201`:

```json
{
  "challengeId": "<synthetic-uuid>",
  "proofKind": "nostr_schnorr",
  "message": "<server-generated-domain-separated-message>",
  "expiresAt": "2026-08-04T12:02:00Z"
}
```

For email/OAuth/passkey, the response names `auth_adapter_assertion` and returns only adapter-safe continuation information. It never returns provider tokens or credential secrets.

Errors: `400 VALIDATION_ERROR`; `400 SECRET_MATERIAL_REJECTED`; `403 STEP_UP_REQUIRED`; `404 BINDING_NOT_FOUND`; `409 BINDING_IN_USE`; `429 RATE_LIMITED`.

### 7.3 Add with proof

`POST /api/identity/bindings`

```json
{
  "proof": {
    "kind": "nostr_schnorr",
    "challengeId": "<synthetic-uuid>",
    "signatureHex": "<synthetic-128-hex-signature>"
  },
  "backupConfirmation": {
    "ceremonyVersion": "v1",
    "spotCheckPassed": true
  }
}
```

The candidate comes from the stored challenge, not from this commit body. On success the server:

1. consumes and verifies the proof;
2. locks the subject's relevant binding rows;
3. checks global active/pending uniqueness;
4. inserts or freshly re-verifies the binding with server-computed hash;
5. assigns status/tier from proof and ceremony policy, never from a requested tier;
6. applies patient and last-usable invariants;
7. updates compatibility mirrors such as `users.nostr_npub` only after the binding transaction succeeds;
8. writes the audit event;
9. returns `201` with `{ "binding": IdentityBinding }` (`200` for an idempotent replay or permitted exact-row re-verification).

This endpoint never mints a JWT and is not login.

Errors: `400 VALIDATION_ERROR`; `400 SECRET_MATERIAL_REJECTED`; `401 PROOF_EXPIRED`; `401 PROOF_REPLAYED`; `401 PROOF_INVALID`; `403 STEP_UP_REQUIRED`; `409 BINDING_IN_USE`; `409 BINDING_SUPERSEDED`; `409 PATIENT_REQUIRES_NON_NOSTR_BINDING`.

### 7.4 Rotate

`POST /api/identity/bindings/{id}/rotate`

```json
{
  "proof": {
    "kind": "nostr_schnorr",
    "challengeId": "<synthetic-uuid>",
    "signatureHex": "<synthetic-128-hex-signature>"
  },
  "backupConfirmation": {
    "ceremonyVersion": "v1",
    "spotCheckPassed": true
  },
  "recoveryDisposition": "transfer"
}
```

Authorization requires recent step-up through the predecessor, another usable binding, or the active recovery designate. Candidate proof is always required. Possession of only the new candidate is insufficient to rotate an existing subject.

In one transaction with subject/binding row locks:

1. verify the predecessor is owner-scoped, active, and the same type as the challenge;
2. consume/verify the candidate proof;
3. insert the verified successor with `supersedes_binding_id=<predecessor id>`;
4. set predecessor `status='revoked'`, `revoked_at=NOW()`, `rotated_at=NOW()`;
5. if the predecessor was the recovery designate, require explicit `recoveryDisposition`:
   - `transfer`: successor must itself satisfy recovery eligibility, then designation moves atomically;
   - `clear`: designation is cleared atomically;
6. update compatibility mirrors after the binding writes succeed;
7. revoke sessions authenticated through the predecessor after the response is committed;
8. audit the lineage change.

Success `200`:

```json
{
  "binding": {},
  "replacedBindingId": "<synthetic-uuid>",
  "reauthRequired": true
}
```

Errors: add-with-proof errors plus `404 BINDING_NOT_FOUND`; `409 ROTATION_CONFLICT`; `409 RECOVERY_DISPOSITION_REQUIRED`; `409 RECOVERY_BINDING_INELIGIBLE`.

### 7.5 Unpair / Remove

`DELETE /api/identity/bindings/{id}`

There is intentionally no second `/unpair` mutation. The Passport labels the same safe operation according to type:

- Nostr/DID/wallet: **Unpair**;
- email/OAuth/passkey: **Remove**.

The server locks the subject's active binding rows, computes the post-delete state, and then either soft-revokes or fails with no change.

Success `200`:

```json
{
  "removedBindingId": "<synthetic-uuid>",
  "status": "revoked",
  "reauthRequired": false
}
```

Rules:

- if it is the final `usableSignIn`, return `409 LAST_USABLE_BINDING`;
- if a patient would retain only Nostr sign-in, return `409 PATIENT_REQUIRES_NON_NOSTR_BINDING`;
- if it is the recovery designate and another usable sign-in remains, return `409 RECOVERY_DESIGNATE_IN_USE` until the member transfers or clears designation explicitly;
- if the current session was authenticated through it, complete the response and revoke sessions minted through that binding; return `reauthRequired: true`;
- an idempotent repeat with the same key returns the stored success response; a new request against an already-revoked row returns `200` without changing history.

Errors: `400 SECRET_MATERIAL_REJECTED`; `401 AUTH_REQUIRED`; `403 STEP_UP_REQUIRED`; `404 BINDING_NOT_FOUND`; the three `409` invariants above.

### 7.6 Recovery designate

`PUT /api/identity/recovery-designate`

Set:

```json
{ "bindingId": "<synthetic-uuid>" }
```

Clear:

```json
{ "bindingId": null }
```

Eligibility is type-agnostic but strict: the binding must belong to the subject, be active, verified, T1/T2, and satisfy `usableSignIn`. A T0 Nostr key cannot be designated. The operation requires recent step-up through a different currently usable binding when setting a newly-added method, so a stolen session cannot add itself and immediately become the recovery path.

In one transaction, clear any prior designate and set the selected row. Exactly one or zero may result.

Success `200`:

```json
{ "recoveryDesignate": {} }
```

or `{ "recoveryDesignate": null }` when cleared.

This flag does not send a key, backup, encrypted file, Shamir share, or account capability to anyone. V1 recovery material remains the member's passphrase-encrypted backup file. Shamir Secret Sharing is V2, not this contract.

Errors: `400 VALIDATION_ERROR`; `400 SECRET_MATERIAL_REJECTED`; `403 STEP_UP_REQUIRED`; `404 BINDING_NOT_FOUND`; `409 RECOVERY_BINDING_INELIGIBLE`.

## 8. Error code registry

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `SECRET_MATERIAL_REJECTED` | Any forbidden key name or nsec/raw-private-hex/mnemonic-shaped value was detected recursively. |
| 400 | `VALIDATION_ERROR` | Malformed type, public value, ID, header, or proof shape. |
| 401 | `AUTH_REQUIRED` | No valid owner session. |
| 401 | `PROOF_EXPIRED` | Challenge expired before commit. |
| 401 | `PROOF_REPLAYED` | Challenge was already consumed. |
| 401 | `PROOF_INVALID` | Proof did not verify against the bound candidate/action/subject. |
| 403 | `STEP_UP_REQUIRED` | Primary authentication is absent or older than five minutes. |
| 404 | `IDENTITY_NOT_FOUND` | Authenticated user has no subject. |
| 404 | `BINDING_NOT_FOUND` | Binding is absent or not owned; never reveal cross-subject existence. |
| 409 | `BINDING_IN_USE` | Candidate is pending/active on another subject. |
| 409 | `BINDING_SUPERSEDED` | A rotated predecessor cannot be silently reactivated. |
| 409 | `LAST_USABLE_BINDING` | Removal would leave no usable sign-in method. |
| 409 | `PATIENT_REQUIRES_NON_NOSTR_BINDING` | Mutation would leave a patient npub-only. |
| 409 | `RECOVERY_DESIGNATE_IN_USE` | Remove/rotate requires an explicit recovery disposition. |
| 409 | `RECOVERY_BINDING_INELIGIBLE` | Candidate cannot be a recovery path. |
| 409 | `RECOVERY_DISPOSITION_REQUIRED` | Rotating a designated binding omitted transfer/clear intent. |
| 409 | `ROTATION_CONFLICT` | Predecessor changed between challenge and commit. |
| 410 | `PROOF_REQUIRED` | Deprecated direct-bind route cannot accept an unproved public key. |
| 429 | `RATE_LIMITED` | Challenge or mutation limit exceeded. |

## 9. Secret-shaped body guard

The global boundary guard applies before business handlers to every body-bearing endpoint, including all four body-bearing endpoints in this contract.

Reject with `400 SECRET_MATERIAL_REJECTED` if any recursively inspected key or string value is:

- a case-insensitive forbidden key name such as `nsec`, `mnemonic`, `seedPhrase`, `privateKey`, or `secretKey`;
- an `nsec1…` value;
- exactly 64 hex characters (raw private/public hex is not an accepted client representation here; Nostr public keys must be npub);
- a 12/15/18/21/24-word sequence whose normalized words all belong to the configured mnemonic wordlist.

On detection:

- stop before the route handler;
- never log the body, field name, submitted value, word count, or value hash;
- audit only actor/subject if known, endpoint, request ID, time, result, and coarse `detectedShape` (`nsec`, `raw_hex`, `mnemonic`, or `forbidden_key_name`);
- return the generic error message: `Secret key or recovery phrase material is not accepted.`

## 10. Concurrency, idempotency, and ownership

- All writes require `Idempotency-Key`; scope it to subject + method + path. Store the response code/body digest and replay the original result.
- Add uniqueness checks, rotation, deletion, and recovery selection run in a single transaction with subject and relevant binding rows locked.
- Lockout invariants are evaluated on the proposed post-commit state, inside the same transaction.
- Two concurrent deletes of the last two usable bindings cannot both succeed: one succeeds, the other observes the committed/locked state and receives `409 LAST_USABLE_BINDING`.
- Path IDs are always resolved with `subject_id=<authenticated subject>`. A cross-subject ID returns the same 404 as an absent ID.
- No admin override exists in this V1 user contract. Account merge and exceptional recovery require a separate, human-gated contract.

## 11. Audit and session effects

Required audit actions:

- `identity.binding.challenge_issued`
- `identity.binding.added`
- `identity.binding.reverified`
- `identity.binding.rotated`
- `identity.binding.unpaired`
- `identity.signin_method.removed`
- `identity.recovery_designate.set`
- `identity.recovery_designate.cleared`
- `identity.secret_material.rejected`
- `identity.binding.mutation_denied`

Audit stores actor subject, target binding ID, binding type, operation, result/error code, request ID, purpose `identity_management`, and consent scope `personal`. It stores no binding value/hash, email, npub, challenge, proof, signature, OTP, OAuth artifact, WebAuthn object, secret-shaped value, IP address, or user-agent string. If abuse correlation is required, use separately keyed, rotating hashes with documented retention.

JWT/session issuance must record which binding authenticated it. Removing or rotating that binding revokes all sessions minted through it. JWT lifetime remains configuration with a TODO until Majd decides it; this contract does not freeze `7d`.

That requires a same-Postgres server-side session index from `jti` to `subject_id`, `binding_id`, `amr`, `auth_time`, status, and expiry. It is session metadata, not parallel auth or a second database. Identity mutation authorization and revoked-binding checks fail closed if this index cannot be read.

## 12. Compatibility and required implementation changes

1. `POST /api/identity/nostr` is a binding route, not login (`V4/backend/src/routes/identity.js:21-39`). It currently accepts an npub and calls `bindNostrKey` without possession proof.
2. `bindNostrKey` currently revokes/replaces active Nostr rows and writes `verified_at=NOW()` solely from the submitted public value (`V4/backend/src/lib/identity/index.js:153-173`). **That is a security bug.** It must not remain a successful V1 path.
3. The V1 implementation replaces that write with the challenge + `POST /api/identity/bindings` contract. The legacy `/api/identity/nostr` route must be removed or return `410` with typed code `PROOF_REQUIRED`; it must not be documented as a successful binding endpoint in `openapi.yaml`.
4. Existing `/api/auth/nostr/challenge` and `/api/auth/nostr/login` are authentication endpoints and remain distinct (`V4/backend/src/routes/auth.js:176-239`). Login proof cannot be replayed as binding proof.
5. Nostr login resolution must use active binding rows and tier/patient rules. The current login path's silent bind/refresh and automatic account creation from an unbound npub do not satisfy this contract.
6. `users.nostr_npub` may remain a temporary compatibility mirror, but `solaris_identity_bindings` is authoritative. Mirror updates occur only after a successful binding transaction.
7. Current JWTs contain `userId`, `email`, `role`, `jti`, and optional `sub`, but no `auth_time`, `amr`, or `binding_id` (`V4/backend/src/middleware/auth.js:12-19`). The session minting seam must add them before recent step-up or binding-scoped revocation can work.
8. Current token revocation checks fail open when Postgres cannot be read (`V4/backend/src/middleware/auth.js:43-57`). Binding mutations and sessions authenticated through a revoked binding must fail closed; otherwise unpair/rotation cannot reliably remove authority.

## 13. Acceptance contract

### A. List privacy

**GIVEN** a subject with email, Nostr, OAuth, and revoked bindings  
**WHEN** the owner requests `GET /api/identity/bindings`  
**THEN** active/pending rows are returned with server-computed actions, the npub may be public, email is masked, and no binding hash, provider subject, credential ID/key, proof, or cross-subject row appears.

### B. Add requires possession

**GIVEN** a recently authenticated owner and a candidate npub  
**WHEN** the owner submits the npub without a valid action-bound signature  
**THEN** the challenge is consumed, the API returns `401 PROOF_INVALID`, and no binding or compatibility mirror changes.

### C. Current bug regression

**GIVEN** an authenticated owner  
**WHEN** the owner sends only `{npub}` to the legacy `/api/identity/nostr` route  
**THEN** the server does not create, activate, verify, or rotate a binding and returns typed `PROOF_REQUIRED`/410 or the route is absent.

### D. Secret boundary

**GIVEN** any body-bearing binding endpoint  
**WHEN** a nested field contains an nsec, exact 64-hex value, mnemonic-shaped value, or forbidden secret-key name  
**THEN** the boundary returns `400 SECRET_MATERIAL_REJECTED`, the handler is not called, and the audit/log contains no submitted value or derivative.

### E. Tier is not status

**GIVEN** an active, verified T0 Nostr binding  
**WHEN** authorization evaluates sole-login capability  
**THEN** the result is false even though `status='active'`; after fresh proof plus the V1 backup confirmation, T1 may become sole-login-capable subject to patient rules.

### F. Patient is never npub-only

**GIVEN** a patient with one usable email binding and one T1 Nostr binding  
**WHEN** the owner removes the email binding  
**THEN** the API returns `409 PATIENT_REQUIRES_NON_NOSTR_BINDING` and neither row nor session changes.

### G. Last usable binding

**GIVEN** any subject with exactly one usable sign-in binding  
**WHEN** that binding is unpaired/removed  
**THEN** the API returns `409 LAST_USABLE_BINDING` and commits no state or audit success event.

### H. Concurrent deletion

**GIVEN** exactly two usable sign-in bindings  
**WHEN** two delete transactions race, one for each binding  
**THEN** at most one succeeds; the other returns `409 LAST_USABLE_BINDING` after observing the locked/committed state.

### I. Rotation lineage

**GIVEN** an active owner-scoped Nostr binding, recent step-up, and valid proof of a different candidate key  
**WHEN** rotation commits  
**THEN** the successor is active and points to the predecessor, the predecessor is revoked with `revoked_at` and `rotated_at`, compatibility mirrors change atomically, old-binding sessions are revoked, and no private material crossed the boundary.

### J. Recovery designate is not custody

**GIVEN** an eligible verified fallback binding  
**WHEN** it is selected as recovery designate  
**THEN** it becomes the subject's only designated row, no secret/backup/share is transmitted, and selecting a T0 or unusable binding returns `409 RECOVERY_BINDING_INELIGIBLE`.

### K. Idempotent replay

**GIVEN** a successful add/rotate/remove/designate mutation  
**WHEN** the identical request is retried with the same `Idempotency-Key`  
**THEN** the original typed response is returned and no duplicate row, lineage edge, audit success, email, or session side effect is created.

### L. Revoked-binding sessions fail closed

**GIVEN** a session minted through a binding that was later removed or rotated  
**WHEN** that session calls an authenticated route, or the session-index/revocation lookup is unavailable  
**THEN** authorization fails, and the system does not honor the removed binding merely because the database check failed.

## 14. OpenAPI handoff

`openapi.yaml` must reproduce this contract without weakening it:

- all six paths and the proof/error unions;
- owner JWT plus recent-step-up requirement on mutations;
- `Idempotency-Key` on every mutation;
- common `400 SECRET_MATERIAL_REJECTED` on every body-bearing operation;
- exact 409 codes and examples, especially `LAST_USABLE_BINDING` and `PATIENT_REQUIRES_NON_NOSTR_BINDING`;
- `status`, `tier`, and `usableSignIn` as distinct fields;
- no nsec, private hex, mnemonic, backup contents, valid-looking real identity, or real patient data in schemas/examples;
- no successful legacy `/api/identity/nostr` operation;
- no derivation model and no Spark mnemonic field.

No Abacus snapshot code was modified.
