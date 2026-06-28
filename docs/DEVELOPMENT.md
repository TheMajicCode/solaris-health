# Development Guide

Everything you need to develop on **Solaris Health / LUCA Passport**: local setup,
testing, code style, and conventions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Project layout](#project-layout)
- [Running the app](#running-the-app)
- [Testing](#testing)
- [Code style & linting](#code-style--linting)
- [Conventions](#conventions)
- [Adding a new API route](#adding-a-new-api-route)
- [Git workflow](#git-workflow)

---

## Prerequisites

- **Node.js ≥ 20**
- **PostgreSQL ≥ 14**
- **Docker** (optional, for the Compose workflow)

---

## Local setup

```bash
git clone https://github.com/solaris-health/luca-passport.git
cd luca-passport

# Frontend deps
npm install

# Backend deps
cd backend && npm install && cd ..

# Database
psql -U postgres -c "CREATE USER luca_user WITH PASSWORD 'luca_dev_2026';"
psql -U postgres -c "CREATE DATABASE luca_passport OWNER luca_user;"
cd backend && psql "$DATABASE_URL" -f schema.sql && node seed.js && cd ..
```

`backend/.env`:
```ini
DATABASE_URL=postgresql://luca_user:luca_dev_2026@localhost:5432/luca_passport
JWT_SECRET=dev-secret-key
PORT=5000
LUCA_AI_MODE=mock
```

---

## Project layout

- **Backend** — CommonJS (`require`), Express, tested with **Jest + Supertest**.
- **Frontend** — ESM (`import`, `"type": "module"`), React + Vite, tested with
  **Vitest + React Testing Library**.

See [ARCHITECTURE.md → Component map](./ARCHITECTURE.md#component-map) for the module
breakdown.

---

## Running the app

```bash
# Backend (port 5000)
cd backend && npm start

# Frontend (port 3000) — in another terminal
npm run dev
```

Or run everything in Docker:
```bash
docker compose up -d --build
```

---

## Testing

The repo ships with **87 tests** (57 backend, 30 frontend). Tests must pass before
merging.

### Backend (Jest + Supertest)

```bash
cd backend
npm test                 # all suites (runs serially with --runInBand)
npm run test:coverage    # with coverage
npx jest tests/auth.test.js   # a single file
```

Suites in `backend/tests/`:

| File | Covers |
|------|--------|
| `auth.test.js` | register, login, JWT, auth middleware (401/403) |
| `export.test.js` | vault export serializer (pure, ~100% coverage) |
| `wallet.test.js` | web3 validation/normalization/SIWE/signature + wallet routes |
| `luca.test.js` | mock AI provider + chat routes |
| `timeline.test.js` | timeline aggregation, pagination, role guards, export |
| `trends.test.js` | vitals payload shape, ranges, role guard |

**Testing philosophy:**
- **Pure functions first** — vault export, web3 validation/signing, and the mock AI
  are tested fully offline for high-confidence, fast coverage.
- **HTTP via Supertest** — `server.js` exports the Express `app` (the listener only
  starts when run directly), so tests import it without opening a port.
- **Self-contained data** — HTTP suites register throwaway users with unique
  `@test.local` emails and delete them in `afterAll`, so demo data is never polluted.
- `tests/setup.js` loads `.env`, sets safe fallbacks, and exposes `global.uniqueEmail`
  / `global.makeUserPayload` helpers.

### Frontend (Vitest + React Testing Library)

```bash
npm test                 # all suites
npm run test:coverage    # with coverage
npx vitest run src/__tests__/api.test.js   # a single file
```

Suites in `src/__tests__/`:

| File | Covers |
|------|--------|
| `api.test.js` | API client — token handling, request building, error propagation (fetch mocked) |
| `WalletConnect.test.jsx` | web3-utils helpers + component render smoke test |
| `HealthTimeline.test.jsx` | timeline rendering, empty state, loader params, error path |
| `LucaPassport.test.jsx` | shell smoke test with mocked context + API |

Vitest config lives in `vite.config.js` (`environment: 'jsdom'`, global setup in
`src/__tests__/setup.js`).

---

## Code style & linting

```bash
# Frontend
npm run lint

# Backend
cd backend && npm run lint && npm run format
```

- **ESLint** — flat config (`eslint.config.js`) for the frontend; `.eslintrc.json`
  for the backend (Node/CommonJS env).
- **Prettier** — formatting via `.prettierrc` (single quotes, 100 col, semicolons).
- **EditorConfig** — `.editorconfig` enforces 2-space indent, LF, UTF-8.

---

## Conventions

- **camelCase** in API responses; `shapeUser()` maps DB snake_case → camelCase.
- Mutating routes are **auth- and role-guarded**; never trust client-supplied IDs.
- Keep vendor-specific logic behind a port (see the AI provider).
- Prefer **pure functions** for anything that can be (serialization, validation).
- Component CSS is scoped under the `.luca` class.

---

## Adding a new API route

1. Create `backend/src/routes/<name>.js` exporting an Express `router`.
2. Guard handlers with `authMiddleware` and the appropriate role guard.
3. Mount it in `server.js`: `app.use('/api/<name>', require('./routes/<name>'));`.
4. Add a client method in `src/lib/api.js`.
5. Write a Supertest suite in `backend/tests/<name>.test.js` (self-register users,
   clean up in `afterAll`).
6. Document it in [API.md](./API.md).

---

## Git workflow

- Use feature branches; keep commits focused.
- Run **both** test suites before pushing.
- Open a PR using the templates in `.github/ISSUE_TEMPLATE`.
- See [CONTRIBUTING.md](../CONTRIBUTING.md).
