---
name: solaris-sovereign-sprint
description: Use for implementation, hardening, architecture, security, Passport, LUCA, GPS, Abacus integration, or release work in the Solaris Health / LUCA Passport repository.
---

# Solaris Sovereign Sprint

## Required context

Read, in order:

1. `AGENTS.md`
2. `docs/ABACUS_MASTER_CONTEXT.md`
3. `LAUNCH_GATES.md`
4. the code and tests for the requested area

## Procedure

1. Establish the current branch, commit, worktree state, and test baseline.
2. Identify the smallest complete vertical slice that improves a real user journey or closes a launch gate.
3. State the data class, authorization boundary, failure behavior, and export impact before editing.
4. Preserve the existing visual language and ports-and-adapters architecture.
5. Implement with additive migrations and least privilege.
6. Add tests that prove normal behavior, denied behavior, and safe failure.
7. Run the relevant frontend/backend/build/migration checks.
8. Update the sprint report and architecture/security docs when behavior changes.
9. Commit the vertical slice separately.
10. Report implemented, tested, deferred, risks, and next best step.

## Abacus rule

Abacus is an adapter and execution environment, not the Passport owner. Use the existing AI provider seam. Preserve mock/local fallback and do not send unapproved sensitive data to external models.

## Stop conditions

Do not proceed with a change that would:

- expose secrets or PHI;
- bypass tenant or consent checks;
- give LUCA unrestricted production authority;
- move real money automatically;
- rewrite deployed migration history;
- delete exportability;
- introduce a vendor without an exit path.

Implement a safer subset and document the blocker instead.
