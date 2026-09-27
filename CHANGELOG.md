# Changelog

This file records changes to **Solaris / LUCA Passport**.

> Historical release descriptions below retain their original wording. In particular, the June 2026 “production-ready” and CI/CD claims are not current acceptance evidence. See [Current state](docs/CURRENT-STATE.md) for the inspected source, recorded test limitations and open production blockers.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed — ECO-CLEAN-R1 obsolete wallet prototypes

- Removed the nested Crypto wallets hub, injected EVM/Solana providers, browser
  EVM transaction sending, simulated Health NFT mint/transfers and exclusive
  `ethers` / `@solana/web3.js` dependencies. GPS, Self Care and Network remain.
- Retired legacy wallet operations with authenticated 410 responses; retained
  owner-only access to historical public-address metadata. No stored data or
  historical migration was deleted. Passport status marks those records inactive.
- Removed email-triggered fake balances, the simulated opening-balance card,
  mock Lightning address and nonfunctional Spark public-address linking controls.
  BTC balances distinguish observed zero from unavailable; USD₮ stays unconnected.
- Updated the obsolete UTEXO placeholder to the planned Tether WDK direction.
  This does not install Breez/WDK, select a USD₮ network, enable funds or issue RGB assets.
- Direct Spark wallet encryption, keys, recovery and safety gates are unchanged.
  Tests for retired features are replaced with retirement, privacy and retained-flow checks.
  Source changes only; not deployed.

### Fixed — WEB-R2-UI trends chart states

- The trends panel (`TrendCharts`) no longer shows a refused request as "No check-in data". A 403
  shows an access-denied message, a 401 shows session guidance, and network errors, timeouts, 5xx
  (including 503), other failures and unusable responses show a temporarily-unavailable state with
  Retry. The empty message appears only for a valid, successful response with no daily points.
- Results are shown only for the scope that requested them — signed-in viewer, target patient and
  range — and only for the latest request in that scope. Switching patient, account or range, or
  signing out, no longer shows the previous values, and a slow earlier response or its failure can
  no longer replace newer content or end a newer loading state.
- The component no longer logs error objects and never displays server error text.
- Successful charts, vitality-only results, range controls, metric toggles and styling are
  preserved. During a Refresh, stat cards and charts are hidden until the new result arrives rather
  than showing the previous values. Not deployed.

### Security — WEB-R2 trends isolation

- `GET /api/trends/vitals` now reads only the authenticated account's trends. Previously a
  `practitioner` or `admin` could pass any `userId` and read that account's daily check-ins and
  assessment scores with no consent, care-relationship or expiry check.
- The optional `userId` query value is only an assertion of the same account, compared
  case-insensitively; both trends queries bind the session `userId`. A different valid account
  returns 403 for every role, malformed or duplicate values return 400, and an invalid session
  `userId` returns 401, all before any trends query.
- Storage failures return a generic 500 and log a fixed marker instead of the raw error object.
- Behavior change: the practitioner patient-detail trends panel no longer loads another account's
  data. Clinician access requires a separate consent/care policy.
- Known unresolved UI defect, not an intended outcome: that panel shows a denied request as its
  ordinary "No check-in data for this range" empty state, which a clinician could misread as the
  patient not checking in. To be fixed separately (WEB-R2-UI).
- `docs/API.md` Trends section now documents own-account-only access, the optional same-account
  `userId`, its 401/400/403/503/500 responses, the `1y` range and the full success payload.
- Authentication/revocation middleware, payloads, statistics and `range` handling are unchanged.
  Not deployed.

### Documentation alignment — DOCS-ARCH-R3

- Replace obsolete front-page cross-chain, NFT, complete-export and CI/test claims with dated implementation evidence.
- Document the owner-selected Breez/WDK direction, conditional Bark alternative, proposed GPS/RGB rewards and private contribution boundaries.
- Distinguish the founder-reported SatsPath collaboration from proposed ecosystem connections and unverified integrations.
- Record WEB-R1 source integration, remaining repairs and Maple divergence; correct contributor branch/setup/verification guidance.
- Preserve historical architecture and release records with explicit status notices. No application, dependency or deployment change.

Earlier uncompleted planning notes are superseded for prioritization by [Current state](docs/CURRENT-STATE.md); this documentation entry is not a feature release.

---

## [1.0.0] - 2026-06-28

First production-ready release of LUCA Passport — a patient-owned health
identity and data-portability platform.

### Added — Phase 6: Testing, Documentation & DevOps
- **Backend test suite** (Jest + Supertest) under `backend/tests/` covering
  auth, timeline, wallet, vault export, LUCA assistant, and trends routes
  (57 tests). Includes `tests/setup.js` with shared fixtures and helpers.
- **Frontend test suite** (Vitest + React Testing Library) under
  `src/__tests__/` covering the API client, `WalletConnect`, `HealthTimeline`,
  and `LucaPassport` components (30 tests).
- **Code coverage** reporting for both suites (`test:coverage`).
- **Health & observability endpoints**: `GET /api/health` (liveness + DB probe,
  returns 503 when the database is unreachable) and `GET /api/metrics`
  (Prometheus-compatible text exposition).
- **Comprehensive documentation** in `docs/`: `ARCHITECTURE.md`, `API.md`,
  `DATABASE.md`, `DEPLOYMENT.md`, `USER_GUIDE.md`, `DEVELOPMENT.md`,
  `SECURITY.md`, and `PERFORMANCE.md`, plus a rewritten root `README.md` with
  badges, table of contents, and mermaid diagrams.
- **CI/CD**: GitHub Actions workflows `.github/workflows/ci.yml` (lint + test +
  build for backend and frontend against an ephemeral Postgres service) and
  `.github/workflows/deploy.yml` (manual build/deploy pipeline).
- **`docker-compose.test.yml`** for running the backend suite against an
  ephemeral tmpfs Postgres instance.
- **Code quality tooling**: ESLint (frontend flat config + backend legacy
  config), Prettier (`.prettierrc`, `.prettierignore`), and `.editorconfig`,
  with `lint`, `lint:fix`, and `format` scripts.
- **Project meta**: `LICENSE` (MIT), `CONTRIBUTING.md`, this `CHANGELOG.md`,
  and GitHub issue templates for bug reports and feature requests.

### Added — Phase 4: LUCA Assistant & Trends
- LUCA conversational health assistant with a mock AI backend
  (`backend/src/lib/ai/mock.js`) and conversation history.
- Health trends and vitals analytics endpoints (`/api/trends/*`) with
  role-aware access control.

### Added — Phase 3: Wallet & Vault Export
- Web3 wallet linking with SIWE-style signature verification across multiple
  EVM chains (`backend/src/lib/web3.js`).
- Portable vault export (`backend/src/lib/vault-export.js`) producing a
  Markdown/JSONL bundle (identity, health records, contributions, credentials,
  event log, and a signed manifest).

### Added — Phase 2: Health Timeline & Records
- Patient health timeline aggregating assessments, events, and contributions.
- Role-based access control for patients, providers, and administrators.

### Added — Phase 1: Foundation
- Authentication and authorization (JWT) with patient/provider/admin roles.
- React (Vite) frontend with shared application state via `AppContext`.
- Node.js/Express backend and PostgreSQL schema.
- Docker Compose stack (frontend, backend, postgres) deployed at
  https://solaris-health.abacusai.cloud.

[Unreleased]: https://github.com/TheMajicCode/solaris-health/commits/main
[1.0.0]: #100---2026-06-28
