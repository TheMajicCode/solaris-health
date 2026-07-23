# Migration & Rollback Policy — Solaris Health / LUCA Passport

## How migrations run

- Plain SQL files in `backend/migrations/`, applied by `node-pg-migrate`
  (`npm run migrate`). Numbering skips `006` — leave it; the bookkeeping table
  (`pgmigrations`) tracks names, not sequence.
- Migrations auto-apply at backend startup (`backend/src/server.js`), so a
  container rebuild + restart is the deployment path for schema changes.
- Status check: `npm run migrate:status` (dry run).

## Policy: forward-only, additive

**We do NOT write `down` migrations.** This is a deliberate, truthful decision,
not an omission:

1. Nearly all of our migrations create tables/columns or backfill data. A
   `down` that drops them **destroys member health data** — there is no safe
   automated inverse.
2. A `down` script that is never rehearsed is worse than none: it implies a
   capability that does not exist (the failure mode Gate 3 warns about).

Instead:

- **Schema changes must be additive and backward-compatible** (new tables,
  `ADD COLUMN` with defaults/nullable). Older application code must keep
  working against the newer schema — this is what makes *application* rollback
  (git checkout + rebuild, see `docs/INCIDENT_RESPONSE.md` Step 4) safe without
  touching the DB.
- **Broken migration? Fix forward:** ship a new migration that corrects it.
  Never edit an applied migration file.
- **Corrupted data? Restore from backup** (runbook Step 5), never via `down`.

## Rehearsal before deploy (Gate 2)

Test the full migration chain against a copy of production:

```bash
cd /home/ubuntu/luca-passport/backend
docker exec luca-passport-postgres-1 psql -U luca_user -d postgres \
  -c 'CREATE DATABASE solaris_migrate_test;'
docker exec -i luca-passport-postgres-1 psql -q -U luca_user -d solaris_migrate_test \
  < /home/ubuntu/backups/solaris-<NEWEST>.sql
DATABASE_URL="postgresql://luca_user:<pass>@localhost:5432/solaris_migrate_test" \
  npx node-pg-migrate up -m migrations
docker exec luca-passport-postgres-1 psql -U luca_user -d postgres \
  -c 'DROP DATABASE solaris_migrate_test;'
```

Last run **2026-07-23**: restored `solaris-20260722-2110.sql` (77 tables,
37 users) with 0 errors; pending migration `019_ai_execution_receipts` applied
cleanly → 79 tables. Evidence in `docs/ABACUS_SPRINT_REPORT.md` (Slice 5).

## Continuous guard

`backend/tests/schema-recovery.test.js` fails if any table referenced by
route/lib SQL and defined in a migration is missing from the live schema, if
any critical core-journey table is absent, or if `ai_execution_receipts`
loses its receipt-V0 columns. It runs with the normal `npm test` suite.

## Versioned rollback targets

- Sprint checkpoints are git-tagged (e.g. `sprint-v4-checkpoint`); any commit
  can be rebuilt into images with `docker compose build`.
- No remote image registry yet (honest gap — images are rebuilt from source at
  rollback time, ~minutes not seconds). See `LAUNCH_GATES.md` Gate 3.
