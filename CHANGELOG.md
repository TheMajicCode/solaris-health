# Changelog

All notable changes to the **LUCA Passport** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Playwright end-to-end test suite covering the full patient onboarding flow.
- `husky` + `lint-staged` pre-commit hooks to enforce linting and formatting.
- Real LLM provider integration for the LUCA assistant (currently mock-backed).
- On-chain anchoring of vault export manifests.

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

[Unreleased]: https://github.com/solaris-health/luca-passport/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/solaris-health/luca-passport/releases/tag/v1.0.0
