# API Reference

REST API for **Solaris Health / LUCA Passport**. All endpoints are prefixed with
`/api` and return JSON. Authenticated endpoints require a JWT bearer token.

- **Base URL (prod):** `https://solaris-health.abacusai.cloud/api`
- **Base URL (local):** `http://localhost:5000/api`

## Table of Contents

- [Authentication](#authentication)
- [Conventions](#conventions)
- [Error format](#error-format)
- [Operational](#operational)
- [Auth](#auth)
- [Users](#users)
- [Assessment](#assessment)
- [Listings](#listings)
- [Journey](#journey)
- [LUCA AI](#luca-ai)
- [Timeline](#timeline)
- [Trends](#trends)
- [Wallet](#wallet)
- [Export](#export)
- [Contributions, Credentials, Agents](#contributions-credentials-agents)
- [Practitioner](#practitioner)
- [Admin](#admin)

---

## Authentication

Obtain a token from `POST /api/auth/register` or `POST /api/auth/login`, then send it
on every protected request:

```
Authorization: Bearer <token>
```

Tokens are JWTs signed with `JWT_SECRET`, expiring in 30 days, carrying
`{ userId, email, role }`.

## Conventions

| Method | Use |
|--------|-----|
| `GET` | Read |
| `POST` | Create / actions |
| `PUT` / `PATCH` | Update |

Roles: `patient`, `practitioner`, `admin`. Role-restricted routes return `403` for the
wrong role; missing/invalid tokens return `401`.

## Error format

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request / validation error |
| `401` | Missing or invalid token |
| `403` | Authenticated but not permitted |
| `404` | Not found |
| `500` | Server error |

---

## Operational

### `GET /api/health`
Liveness probe. No auth. Returns `503` if the database is unreachable.

```bash
curl https://solaris-health.abacusai.cloud/api/health
```
```json
{ "status": "ok", "uptime": 12345, "database": "ok", "timestamp": "2026-06-28T00:00:00.000Z" }
```

### `GET /api/metrics`
Prometheus text-format metrics. No auth.

```
luca_up 1
luca_database_up 1
luca_uptime_seconds 12345
luca_process_resident_memory_bytes 73400320
luca_process_heap_used_bytes 41943040
```

---

## Auth

### `POST /api/auth/register`
Creates a user, awards +10 LOVE points, returns the user and a token.

**Body:**
```json
{ "email": "a@b.c", "password": "secret", "firstName": "Ada", "lastName": "Lovelace",
  "role": "patient", "country": "UK", "language": "English" }
```
**`201`:**
```json
{ "user": { "id": 42, "email": "a@b.c", "role": "patient", "firstName": "Ada", "lovePoints": 10 },
  "token": "<jwt>" }
```
```bash
curl -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"a@b.c","password":"secret","firstName":"Ada","lastName":"Lovelace","role":"patient"}'
```

### `POST /api/auth/login`
**Body:** `{ "email": "a@b.c", "password": "secret" }` → **`200`** `{ user, token }`.
Wrong credentials → `400`/`401`.

---

## Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/users/me` | ✓ | Current user |
| `PATCH` | `/users/me` | ✓ | Update current user |
| `GET` | `/users/profile` | ✓ | Extended profile |
| `PUT` | `/users/profile` | ✓ | Upsert profile |

```bash
curl $BASE/users/me -H "Authorization: Bearer $TOKEN"
```

---

## Assessment

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/assessment/template` | ✓ | Active Solaris Method template |
| `POST` | `/assessment/submit` | ✓ | Submit answers; computes scores; +50 LOVE |
| `GET` | `/assessment/latest` | ✓ | Most recent result |
| `GET` | `/assessment/history` | ✓ | All past results |

---

## Listings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/listings` | ✓ | Marketplace listings (filters: `type`, `q`, `featured`) |
| `GET` | `/listings/:id` | ✓ | Single listing |
| `POST` | `/listings` | ✓ | Create a listing |

---

## Journey

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`/`POST` | `/journey/bookings` | ✓ | List / create booking requests (+30 LOVE on create) |
| `GET`/`POST` | `/journey/checkins` | ✓ | List / create daily check-ins (+5 LOVE on create) |
| `GET` | `/journey/rewards` | ✓ | LOVE point reward events |
| `GET` | `/journey/documents` | ✓ | List documents |
| `GET` | `/journey/documents/:id` | ✓ | Single document |
| `POST` | `/journey/documents` | ✓ | Upload a document |

---

## LUCA AI

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/luca/messages` | ✓ | Conversation history (latest 100) |
| `POST` | `/luca/messages` | ✓ | Send a message; returns AI reply |

**`POST /luca/messages` body:** `{ "content": "I can't sleep" }`
**`200`:** `{ "reply": "...", "model": "mock", "degraded": null }`. Empty content → `400`.

---

## Timeline

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/timeline/me` | ✓ | any | Current user's unified timeline |
| `GET` | `/timeline/patient/:userId` | ✓ | staff | A patient's timeline |
| `GET` | `/timeline/system` | ✓ | admin | System-wide timeline |
| `POST` | `/timeline/export` | ✓ | any | Export the vault (JSON/ZIP) |

**Query params (`/me`):** `limit`, `offset`, `types` (csv), `from`, `to`, `q`.
**`200`:** `{ "total": 12, "events": [ { "id", "type", "title", "date" } ], "limit": 50, "offset": 0 }`.

```bash
curl "$BASE/timeline/me?limit=5&types=vitals,appointment" -H "Authorization: Bearer $TOKEN"
```

---

## Trends

### `GET /api/trends/vitals` (auth)
Vitals time series for the current user (or `?userId=` for staff/admin).

**Query:** `range` (`7d`, `30d`, `90d`, `all`), `userId` (staff/admin only).
**`200`:**
```json
{ "range": "30d",
  "points": [ { "date": "2026-06-01", "energy": 7, "mood": 8, "sleep": 7.5, "hydration": 6, "movement": 30 } ],
  "vitality": [ ... ],
  "metrics": { "energy": { "avg": 7, "min": 5, "max": 9, "change": 2 } } }
```
A patient requesting another user's vitals → `403`.

---

## Wallet

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| `GET` | `/wallet/chains` | ✓ | any | Supported chain metadata |
| `GET` | `/wallet/me` | ✓ | any | The user's connected wallets |
| `POST` | `/wallet/connect` | ✓ | patient | Connect/link a wallet |
| `PUT` | `/wallet/disconnect` | ✓ | patient | Remove a wallet |
| `PUT` | `/wallet/primary` | ✓ | patient | Set primary wallet |
| `GET` | `/wallet/nonce` | ✓ | patient | Nonce + SIWE message to sign |
| `POST` | `/wallet/verify-signature` | ✓ | patient | Verify ownership (EVM) |
| `GET` | `/wallet/balance/:chain/:address` | ✓ | any | Native balance |
| `GET` | `/wallet/transactions/:chain/:address` | ✓ | any | Recent transactions |

**`POST /wallet/connect` body:** `{ "chain": "ethereum", "address": "0x...", "label": "Main" }`.

```bash
curl $BASE/wallet/chains -H "Authorization: Bearer $TOKEN"
```

---

## Export

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/export/me` | ✓ | Vault manifest (JSON) or `?format=zip` for an archive |

The export serializes the full record (identity, assessment, conversation,
contributions, credentials, event log) into the portable vault format. See
[ARCHITECTURE.md → Sovereign vault export](./ARCHITECTURE.md#sovereign-vault-export).

---

## Contributions, Credentials, Agents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`/`POST` | `/contributions` | ✓ | List / create contributions |
| `GET`/`POST` | `/credentials` | ✓ | List / create credentials |
| `GET`/`POST` | `/agents` | ✓ | List / register AI agents |
| `PATCH` | `/agents/:id/permission` | ✓ | Update an agent's permission |

---

## Practitioner

All require the `practitioner` role.

| Method | Path | Description |
|--------|------|-------------|
| `GET`/`PUT` | `/practitioner/profile` | Get / update practice profile |
| `GET` | `/practitioner/bookings` | Incoming booking requests |

---

## Admin

All require the `admin` role.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/overview` | Platform stats |
| `GET` | `/admin/users` | All users |
| `GET` | `/admin/listings` | All listings |
| `PATCH` | `/admin/listings/:id` | Approve / update a listing |
| `GET` | `/admin/bookings` | All bookings |
