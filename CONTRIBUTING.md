# Contributing to LUCA Passport

First off, thank you for taking the time to contribute! 🎉

This document describes how to set up your environment, the workflow we follow,
and the quality bar a change must clear before it can be merged.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Running the Test Suites](#running-the-test-suites)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs & Requesting Features](#reporting-bugs--requesting-features)

## Code of Conduct

Be respectful, inclusive, and constructive. Harassment or discrimination of any
kind will not be tolerated. By participating you agree to uphold these values.

## Getting Started

1. **Fork** the repository and **clone** your fork.
2. Install dependencies for both the frontend and backend:
   ```bash
   # Frontend (repo root)
   npm install

   # Backend
   cd backend && npm install
   ```
3. Copy `.env.example` to `.env` (root and `backend/` as applicable) and fill in
   the required values. See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the
   full setup guide, including running the stack with Docker Compose.
4. Start the development stack:
   ```bash
   docker compose up -d
   ```

## Development Workflow

1. Create a topic branch off `master`:
   ```bash
   git checkout -b feat/short-description
   ```
   Use a prefix that reflects the change: `feat/`, `fix/`, `docs/`, `test/`,
   `chore/`, or `refactor/`.
2. Make your change in small, focused commits.
3. Keep existing functionality intact — add tests for new behavior.
4. Ensure linting, formatting, and **both** test suites pass before opening a PR.

## Running the Test Suites

A change must keep **all** tests green. Run both suites locally before pushing.

**Backend** (Jest + Supertest, requires a reachable Postgres):
```bash
cd backend
npm test                # run all backend tests
npm run test:coverage   # run with coverage report
```
Set `DATABASE_URL` if your Postgres is not on the default
`postgresql://luca_user:luca_prod_2026@localhost:5432/luca_passport`.

**Frontend** (Vitest + React Testing Library):
```bash
npm test                # run all frontend tests
npm run test:coverage   # run with coverage report
```

You can also run the backend suite in a fully ephemeral container:
```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

## Code Style

- **ESLint** enforces our JavaScript/JSX rules. The frontend uses a flat config
  (`eslint.config.js`); the backend uses a legacy config (`backend/.eslintrc.json`).
  ```bash
  npm run lint            # frontend
  npm run lint:fix        # frontend, autofix
  cd backend && npm run lint
  ```
- **Prettier** handles formatting (`.prettierrc`):
  ```bash
  npm run format
  ```
- `.editorconfig` keeps indentation and line endings consistent across editors.
- Prefer clear, self-documenting code; add comments for non-obvious logic.

## Commit Messages

Write concise, descriptive commit messages in the imperative mood, e.g.:

```
Add vitals trend aggregation endpoint

Adds GET /api/trends/vitals with role-aware access control and tests.
```

## Submitting a Pull Request

1. Push your branch and open a PR against `master`.
2. Fill in the PR description: what changed, why, and how it was tested.
3. Confirm the checklist:
   - [ ] Linting passes (`npm run lint` for both frontend and backend)
   - [ ] Formatting is applied (`npm run format`)
   - [ ] Backend tests pass (`cd backend && npm test`)
   - [ ] Frontend tests pass (`npm test`)
   - [ ] New behavior is covered by tests
   - [ ] Documentation updated where relevant
   - [ ] `CHANGELOG.md` updated under `[Unreleased]`
4. CI (GitHub Actions) must be green before review.

## Reporting Bugs & Requesting Features

Please use the GitHub issue templates:

- **Bug reports** → [`.github/ISSUE_TEMPLATE/bug_report.md`](.github/ISSUE_TEMPLATE/bug_report.md)
- **Feature requests** → [`.github/ISSUE_TEMPLATE/feature_request.md`](.github/ISSUE_TEMPLATE/feature_request.md)

Include as much detail as possible — reproduction steps, expected vs. actual
behavior, environment, and screenshots/logs where helpful.

Thank you for helping make LUCA Passport better! 💙
