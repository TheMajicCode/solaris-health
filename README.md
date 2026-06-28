<div align="center">

# 🌅 Solaris Health — LUCA Passport

**A sovereignty-first holistic health platform.**
Heal · Learn · Earn — own your health data, end to end.

[![CI](https://placehold.co/1200x600/e2e8f0/1e293b?text=Continuous_Integration__CI__status_badge_showing_b)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold.svg)](./LICENSE)
[![Backend Tests](https://img.shields.io/badge/backend%20tests-57%20passing-brightgreen.svg)](./backend/tests)
[![Frontend Tests](https://img.shields.io/badge/frontend%20tests-30%20passing-brightgreen.svg)](./src/__tests__)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933.svg)](https://nodejs.org)

**Live demo → [solaris-health.abacusai.cloud](https://solaris-health.abacusai.cloud)**

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Demo Credentials](#demo-credentials)
- [Testing](#testing)
- [Documentation](#documentation)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**LUCA Passport** is the patient-facing product of **Solaris Health** — a full-stack
holistic wellness platform built around a single conviction: **a person should own
their health data and be able to take it with them, anywhere, at any time.**

It pairs a cinematic "Solaris Method" onboarding with a 360° **Health Passport**, an
AI wellness concierge (**LUCA**), a curated care marketplace, a cross-chain **wallet**
for self-sovereign identity, and a one-click **vault export** that serializes a user's
entire record into a portable, open Markdown + JSONL format.

> **LUCA** = *Last Universal Common Ancestor* — the root from which everything grows.
> The passport is the root of a person's sovereign health graph.

### Why "sovereignty-first"?

Most health apps lock your data in their database. LUCA Passport is architected so the
export path is a **first-class, tested feature**, not an afterthought:

- Every record can be serialized to a portable vault (`identity.md`, `health/*.md`,
  `contributions/*.md`, `credentials/*.md`, `events/log.jsonl`, `manifest.json`).
- That format is the **same one** an independent self-hosted node can ingest — proving
  the "you own your data" claim rather than just promising it.
- Identity is portable too: optional **DID** and **Nostr npub** fields travel with the
  user, and wallets across **Ethereum, Polygon, Solana and Bitcoin** can be linked and
  cryptographically verified.

---

## Features

### 🌗 The Solaris Method — assessment & onboarding
A guided questionnaire scoring **4 Aspects of Being** (Physical, Mental, Emotional,
Spiritual) and **8 Body Systems**, producing a **360° Vitality Score**, a radar
profile, top focus areas, and LUCA-generated starter habits.

### 🪪 Health Passport — your unified record
A single, FHIR-aligned view of every health signal: vitality, aspects, a body-systems
radar, documents, daily check-ins, and a complete chronological **Health Timeline**.

### 📈 Trends & Timeline (Phase 3)
- **Health Timeline** — every event (appointments, vitals, assessments, coach chats,
  rewards, documents) merged into one filterable, paginated, clustered chronology.
- **Vitals Trends** — interactive charts of energy, mood, sleep, hydration, movement
  and vitality over time, with range selection and change deltas.

### 🔗 Cross-Chain Wallet (Phase 4)
- Connect & verify wallets on **Ethereum, Polygon, Solana, Bitcoin**.
- SIWE-style **signature verification** to prove ownership (no gas, no transaction).
- Live native balances, transaction history, a primary-wallet concept, and a
  **Health NFT** identity card.

### 🤖 LUCA — AI wellness concierge
A non-diagnostic AI guide built on a **hexagonal (ports & adapters) AI provider**:
swap between cloud LLMs and a zero-cost offline rule-based fallback without touching
route code. Never hard-fails — degrades gracefully to the mock provider.

### 🛒 Care marketplace
A curated directory of practitioners and clinics with booking requests, admin
approval workflows, and a practitioner portal.

### 💛 LOVE points (rewards)
`account_created` +10 · `assessment_complete` +50 · `onboarding_complete` +25 ·
`daily_checkin` +5 · `booking_request` +30.

### 📦 Sovereign vault export
One click serializes the full record into a portable, open, round-trippable archive.

---

## Screenshots

> Live walkthrough: **[solaris-health.abacusai.cloud](https://opengraph.githubassets.com/1b67c86b0d37cc577aa353d7d8af3bd5cc0df3b4146494ad8d3fdaa10089f42e/EstherJin/WaterlooWorks-Desirability-Predictor

| Health Passport | Timeline | Wallet |
|:---:|:---:|:---:|
| 360° vitality, aspects & systems radar | Unified chronological journey | Cross-chain identity & balances |

_(Run the app with the demo credentials below to explore each surface.)_

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, state-based routing (`AppContext`), Recharts, lucide-react, date-fns |
| **Backend** | Node.js, Express 4, PostgreSQL (`pg`), JWT (`jsonwebtoken`), `bcryptjs`, `archiver` |
| **Web3** | `ethers` v6 (EVM), `@solana/web3.js`, public-RPC balance/tx reads |
| **AI** | Hexagonal provider — cloud LLM adapter + offline rule-based mock |
| **Testing** | Jest + Supertest (backend), Vitest + React Testing Library (frontend) |
| **Tooling** | ESLint, Prettier, EditorConfig, GitHub Actions CI/CD |
| **Infra** | Docker Compose (frontend, backend, postgres), Nginx reverse proxy |

---

## Architecture

```mermaid
flowchart LR
  subgraph Client["🖥️ Frontend — React + Vite"]
    UI[LucaPassport Shell]
    TL[HealthTimeline]
    TR[TrendCharts]
    WC[WalletConnect]
    API[api.js client]
  end

  subgraph Server["⚙️ Backend — Express"]
    MW[JWT auth middleware]
    R[Route layer]
    AIH[AI provider port]
    W3[web3 lib]
    VX[vault-export lib]
  end

  subgraph Data["🗄️ Data & External"]
    PG[(PostgreSQL)]
    LLM[Cloud LLM]
    MOCK[Mock AI]
    CHAINS[(EVM / Solana / BTC RPC)]
  end

  UI --> API --> MW --> R
  R --> PG
  R --> AIH
  AIH --> LLM
  AIH -.fallback.-> MOCK
  R --> W3 --> CHAINS
  R --> VX
  TL --> API
  TR --> API
  WC --> API
```

See **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for the full breakdown
(components, data flow, auth flow, the hexagonal AI provider, and deployment topology).

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/solaris-health/luca-passport.git
cd luca-passport
docker compose up -d --build
# Frontend → http://localhost:3000   Backend → http://localhost:5000
```

### Option B — Local dev

**Prerequisites:** Node ≥ 20, PostgreSQL ≥ 14.

```bash
# 1. Database
psql -U postgres -c "CREATE USER luca_user WITH PASSWORD 'luca_dev_2026';"
psql -U postgres -c "CREATE DATABASE luca_passport OWNER luca_user;"
cd backend && psql "$DATABASE_URL" -f schema.sql && node seed.js

# 2. Backend (port 5000)
cd backend && npm install && npm start

# 3. Frontend (port 3000)
cd .. && npm install && npm run dev
```

**`backend/.env`:**
```ini
DATABASE_URL=postgresql://luca_user:luca_dev_2026@localhost:5432/luca_passport
JWT_SECRET=change_me_to_a_long_random_secret
PORT=5000
LUCA_AI_MODE=mock          # or set an LLM key for cloud mode
```

Full instructions: **[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)**.

---

## Demo Credentials

| Role | Email | Password | Experience |
|------|-------|----------|------------|
| **Patient** | `sarah@solaris.health` | `demo123` | Onboarding → Solaris Method → Passport, Timeline, Trends, Wallet |
| **Practitioner** | `elena@solaris.health` | `demo123` | Practitioner portal — profile, listings, bookings |
| **Admin** | `admin@solaris.health` | `demo123` | Admin console — stats, users, listing approvals |

> Passwords are seed defaults — change them before any real deployment.

---

## Testing

The project ships with **87 automated tests** (57 backend, 30 frontend).

```bash
# Backend — Jest + Supertest
cd backend
npm test                 # run all suites
npm run test:coverage    # with coverage report

# Frontend — Vitest + React Testing Library
cd ..
npm test                 # run all suites
npm run test:coverage    # with coverage report
```

**Coverage highlights:** `vault-export.js` 100 %, `auth.js` route 86 %,
`trends.js` 93 %, mock AI 94 %.

The backend HTTP suites register **throwaway users with unique `@test.local`
emails** and clean them up afterwards, so they never pollute demo data. Pure
functions (vault export, web3 validation/signing, the mock AI) are tested fully
offline. See **[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md#testing)** for details.

---

## Documentation

| Doc | What's inside |
|-----|---------------|
| **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | System diagrams, components, data/auth flow, hexagonal AI provider, deployment topology |
| **[API.md](./docs/API.md)** | Every endpoint with request/response examples, JWT, errors, cURL |
| **[DATABASE.md](./docs/DATABASE.md)** | Full 27-table schema, ER diagram, indexing, migrations, backup |
| **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** | Docker Compose + Nginx production deployment |
| **[USER_GUIDE.md](./docs/USER_GUIDE.md)** | End-user walkthrough for each role |
| **[DEVELOPMENT.md](./docs/DEVELOPMENT.md)** | Local setup, testing, code style, conventions |
| **[SECURITY.md](./docs/SECURITY.md)** | Threat model, hardening checklist, disclosure policy |
| **[PERFORMANCE.md](./docs/PERFORMANCE.md)** | Health/metrics endpoints, benchmarks, tuning |

---

## Deployment

The live demo runs on Docker Compose behind Nginx at
**[solaris-health.abacusai.cloud](https://solaris-health.abacusai.cloud)**.

```bash
docker compose up -d --build       # build & start all services
curl https://solaris-health.abacusai.cloud/api/health   # liveness probe
```

Operational endpoints:
- `GET /api/health` — JSON liveness + DB check (503 if the DB is down).
- `GET /api/metrics` — Prometheus-format metrics (`luca_up`, `luca_database_up`, …).

Full guide: **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**.

---

## Project Structure

```
luca-passport/
├── backend/
│   ├── src/
│   │   ├── routes/        # auth, users, assessment, listings, journey, luca,
│   │   │                  # practitioner, admin, export, timeline, trends, wallet, …
│   │   ├── lib/           # ai/ (hexagonal provider + mock), web3.js, vault-export.js, helpers.js
│   │   ├── middleware/    # auth.js (JWT)
│   │   ├── db.js          # pg pool
│   │   └── server.js      # Express app (+ /api/health, /api/metrics)
│   └── tests/             # Jest + Supertest suites
├── src/
│   ├── components/        # LucaPassport, HealthTimeline, TrendCharts, wallet/*, ui/*
│   ├── flows/             # Onboarding, Auth, Assessment
│   ├── pages/             # Hub, HealthPassport, Luca, Explore, Profile, …
│   ├── lib/               # api.js, web3-utils.js
│   ├── state/             # AppContext.jsx
│   └── __tests__/         # Vitest + RTL suites
├── docs/                  # ARCHITECTURE, API, DATABASE, DEPLOYMENT, USER_GUIDE, DEVELOPMENT, SECURITY, PERFORMANCE
├── .github/workflows/     # ci.yml, deploy.yml
├── docker-compose.yml
└── docker-compose.test.yml
```

---

## Roadmap

- ✅ **Phase 1** — Sovereignty backend & vault export
- ✅ **Phase 2** — Unified Health Passport dashboard
- ✅ **Phase 3** — Visualizations & Health Timeline
- ✅ **Phase 4** — Cross-chain wallet & verifiable identity
- 🔜 **Phase 5** — P2P encrypted messaging (Nostr)
- ✅ **Phase 6** — Testing, documentation & DevOps _(this release)_
- 🔭 **Future** — Full FHIR export, payments/payouts, scheduling, DID issuance

See **[CHANGELOG.md](./CHANGELOG.md)** for release history.

---

## Contributing

Contributions are welcome! Please read **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the
workflow, coding standards, and how to run the test suite before opening a PR. Use the
issue templates under [`.github/ISSUE_TEMPLATE`](./.github/ISSUE_TEMPLATE).

---

## License

Released under the **MIT License** — see **[LICENSE](./LICENSE)**.

<div align="center">

*Solaris Health · LUCA Passport · Sovereignty-first holistic health.*
**Heal · Learn · Earn — Enter the Golden Age.**

</div>
