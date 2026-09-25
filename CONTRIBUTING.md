# Contributing to Solaris

Be respectful, inclusive and constructive. Keep changes small enough to review against their stated behavior and evidence.

## Start from current evidence

Read [AGENTS.md](AGENTS.md), [WORKFLOW.md](docs/beta-v1/WORKFLOW.md), the applicable contract and [Current state](docs/CURRENT-STATE.md). Record the actual remote base, local HEAD, tree and uncommitted paths. Use the current authorized base; historical fixed SHAs are evidence, not a reason to silently choose an obsolete branch.

Create a topic branch from the freshly verified `main` unless the approved task explicitly identifies another base. Never overwrite unrelated changes or push directly to `main`.

## Development environment

Clone this repository or your fork. Inspect package scripts and setup documentation before execution. Use lockfile-based installation (`npm ci` in root and `backend/`) in an isolated development workspace, with a runtime supported by the pinned dependencies. Dependency scripts require the same review as other executable project code.

Use synthetic fixtures and an explicitly disposable local database. Set and verify `DATABASE_URL` for that target before database-backed tests. Never inherit the legacy fallback database target or copy a hosted environment into a coding agent. Do not run seeds, deployment scripts or migrations against a live/shared database as part of development setup.

[The development guide](docs/DEVELOPMENT.md) and deployment/container files contain historical instructions: validate their targets and startup behavior before use. This document does not authorize infrastructure changes.

## Changes and verification

- Record the named task contract, allowed paths and acceptance cases before implementation.
- Preserve existing behavior outside the scope. New behavior needs meaningful tests, including relevant denial and failure cases.
- Use the root Vitest suite (`npm test`) for frontend changes and the backend Jest suite (`cd backend` then `npm test`) against isolated fixtures for backend changes. Coverage commands are defined in the respective package scripts.
- Run relevant lint checks and `git diff --check`. Format changed files deliberately; avoid repository-wide formatting churn in a bounded repair.
- Compare relevant failures with the same base and fixtures. Report counts, commands, exit codes and unresolved failures. Do not skip tests, hide errors or weaken baselines to obtain a green result.
- For an **explicitly approved documentation-only contract**, link/path checks, patch/whitespace checks and independent factual review may be its required validation. Application test execution is not implied by documentation edits, and old results must not be presented as new ones. Other changes follow their accepted contract and actual enforced repository checks.

The inspected tree on 24 September 2026 has no active `.github/workflows` directory. `ci-workflows/` contains drafts. Do not claim CI passed or wait for nonexistent workflows. Once real required checks exist, they must pass; this note does not authorize bypassing them. The two recorded WEB-R1 baseline failures remain disclosed in [Current state](docs/CURRENT-STATE.md).

## Pull requests

1. Make focused commits with a descriptive message, update relevant documentation and add an entry under `[Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
2. Complete independent review of the actual candidate diff. Record findings and any fixes; re-review changed content as necessary.
3. Push the approved task branch and open a PR against `main` under the applicable owner authorization. Explain the problem, resulting behavior, exact scope, validation actually performed and unresolved limitations.
4. Recheck the head, base and actual merge requirements before a normal PR merge. A changed base needs impact review, not an automatic reset or force-push. Preserve accepted governance and all required checks.
5. Commit, push, PR, merge and deployment are distinct actions. Follow the authorization supplied for the task; an explicitly authorized sequence does not need repeated generic confirmation. A source merge is not a deployment or production acceptance.

Use the [bug](.github/ISSUE_TEMPLATE/bug_report.md) and [feature](.github/ISSUE_TEMPLATE/feature_request.md) templates. Share synthetic reproduction steps and sanitized evidence; exclude credentials and private health information.
