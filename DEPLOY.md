# Deploying Solaris Health

Solaris is a two-part app: a **Node/Express backend** (`backend/`) and a **Vite/React
frontend** (repo root: `src/`, `public/`, `index.html`). It is 12-factor and portable —
every secret comes from an environment variable and the database is addressed solely by
`DATABASE_URL`, so the same code runs on the current VM, Railway, Render, Heroku, or any
container host with **zero code changes**.

This repo ships ready-to-use configs:

| File | Platform |
|------|----------|
| `docker-compose.yml` + `Dockerfile.backend` / `Dockerfile.frontend` | Current VM (Docker) |
| `railway.json` | Railway (Dockerfile build) |
| `render.yaml` | Render (blueprint: backend + static frontend + managed Postgres) |
| `Procfile` | Heroku / Dokku / any Procfile runner |

---

## Required environment variables

Never commit real values. Copy the examples and fill them in on the platform's secret store:
- Backend: [`backend/.env.example`](backend/.env.example)
- Frontend build: `VITE_API_URL`

| Variable | Where | Notes |
|----------|-------|-------|
| `DATABASE_URL` | backend | **Single source of truth** for the DB. `postgresql://user:pass@host:5432/db`. Add `?sslmode=require` for managed Postgres (Neon/Render/RDS) — the pool enables SSL automatically when it sees that. |
| `JWT_SECRET` | backend | 64-byte hex. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. The server **refuses to boot** without it. |
| `PORT` | backend | Defaults to `5000`. Railway/Render/Heroku inject their own — the app honours `process.env.PORT`. |
| `NODE_ENV` | backend | `production`. |
| `ALLOWED_ORIGINS` | backend | Comma-separated CORS allowlist, e.g. `https://your-domain,http://localhost:3000`. |
| `LUCA_AI_MODE` | backend | `mock` \| `cloud` \| `anthropic` \| `local`. Defaults to `mock` (works with no keys). |
| `LUCA_AI_BASE_URL` / `LUCA_AI_MODEL` / `LUCA_AI_API_KEY` | backend | Needed when `LUCA_AI_MODE=cloud`. |
| `PG_POOL_MAX` | backend | Optional. Max pool connections (default `10`). Keep at/under your provider's connection ceiling. |
| `PGSSL` | backend | Optional. `true` forces SSL when the URL has no `sslmode=require`. |
| `VITE_API_URL` | frontend build | Public backend URL, baked into the bundle at build time. |

---

## Database migrations

Migrations live in `backend/migrations/` (plain SQL, run by **node-pg-migrate**). They are
**idempotent** and tracked in a `pgmigrations` table, so running them repeatedly is safe.

The backend **runs pending migrations automatically on startup** (see the bottom of
`backend/src/server.js`). To run them manually:

```bash
cd backend
DATABASE_URL=postgresql://... npm run migrate          # apply pending
DATABASE_URL=postgresql://... npm run migrate:status    # dry-run: show what would apply
DATABASE_URL=postgresql://... npm run migrate:down       # roll back the last migration
```

`render.yaml` and `Procfile` also invoke `npm run migrate` before `node src/server.js`.

---

## Seed / reset demo data

Demo accounts (all password `demo123`): `sofia@solaris.health`, `alejandro@solaris.health`,
`admin@solaris.health`.

```bash
cd backend
DATABASE_URL=postgresql://... npm run seed        # seed demo data (idempotent)
DATABASE_URL=postgresql://... npm run seed:reset  # wipe + reseed demo data
```

---

## Platform: current VM (Docker Compose)

```bash
cd /home/ubuntu/luca-passport
docker compose up -d --build
curl -s https://solaris-health.abacusai.cloud/api/health   # {"status":"ok",...}
node backend/scripts/smoke-test.js                          # 10/10 expected
```
The Postgres container holds the live data; `Dockerfile.backend` uses `dumb-init` as PID 1
so `docker stop`/redeploy triggers a graceful drain (see Graceful shutdown below).

## Platform: Railway

1. New Project → Deploy from Repo. Railway reads `railway.json` and builds `Dockerfile.backend`.
2. Add a **Postgres** plugin; Railway sets `DATABASE_URL`.
3. Add the backend env vars above (`JWT_SECRET`, `LUCA_AI_*`, `ALLOWED_ORIGINS`, `NODE_ENV`).
4. Healthcheck is preconfigured to `/api/health`. Migrations run on boot.
5. Deploy the frontend separately (static site) with `VITE_API_URL` set to the backend URL.

## Platform: Render

1. New → **Blueprint**, point at this repo. Render reads `render.yaml` and provisions:
   - `solaris-backend` (Node web service, `rootDir: backend`, health check `/api/health`)
   - `solaris-frontend` (static site built from repo root to `./dist`)
   - `solaris-db` (managed Postgres; `DATABASE_URL` auto-wired, includes `sslmode=require`)
2. Fill the `sync: false` secrets in the dashboard: `LUCA_AI_BASE_URL`, `LUCA_AI_API_KEY`,
   `ALLOWED_ORIGINS`, `VITE_API_URL`. `JWT_SECRET` is auto-generated.
3. `startCommand` runs `npm run migrate && node src/server.js`.

## Platform: Heroku (Procfile)

1. `heroku create` + add the **Heroku Postgres** add-on (`DATABASE_URL` auto-set, SSL on).
2. `heroku config:set JWT_SECRET=... NODE_ENV=production LUCA_AI_MODE=cloud LUCA_AI_BASE_URL=... LUCA_AI_API_KEY=... ALLOWED_ORIGINS=...`
3. `git push heroku`. The `Procfile` runs migrations then starts the server.
4. Host the frontend build (`npm run build` → `dist/`) on any static host with `VITE_API_URL` set.

---

## Graceful shutdown

`backend/src/server.js` handles `SIGTERM`/`SIGINT`: it stops accepting new connections,
drains in-flight requests, closes the Postgres pool, and exits — with a 10s forced-exit
safety net. `dumb-init` in `Dockerfile.backend` ensures the signal actually reaches Node.

## Migrating the live database to managed Postgres

See [`NEON_MIGRATION.md`](NEON_MIGRATION.md) for a step-by-step `pg_dump` → Neon → cutover.

---

## Disaster recovery: rebuild the schema from committed source

The entire database schema is reproducible from git alone — no snapshot required. The
committed `backend/schema*.sql` files build the base schema and `backend/migrations/*.sql`
apply every change on top, in filename order. On a fresh Postgres, apply them like so:

```bash
# 1. create an empty database
createdb solaris                       # or: psql -c "CREATE DATABASE solaris;"

# 2. base schema (order matters — foreign keys)
for f in schema schema_solaris schema_wallet schema_messaging schema_marketplace \
         schema_notifications schema_bookings schema_gps schema_sprint; do
  psql -d solaris -f backend/$f.sql
done

# 3. incremental migrations, in order
cd backend && DATABASE_URL=postgresql://.../solaris npm run migrate
```

(On the Docker VM, `schema.sql`, `schema_solaris.sql`, `schema_wallet.sql`,
`schema_messaging.sql` and `schema_marketplace.sql` are auto-applied by the Postgres
`docker-entrypoint-initdb.d` mount on first boot; the remaining four schema files are
covered by their equivalent migrations, and the backend runs `npm run migrate` on startup.)

### Verified recovery test — 2026-07-22

Executed a full clean rebuild into a throwaway `solaris_recovery_test` database on the live
VM's Postgres 15, applying only committed source (9 `schema*.sql` files + 18 migrations):

| Check | Result |
|-------|--------|
| Base schema files applied (9) | ✅ 0 errors |
| Migrations applied (`001`–`018`) | ✅ 0 errors |
| Tables rebuilt | **77** |
| Parity vs live DB (78 tables) | ✅ only `pgmigrations` (node-pg-migrate's runtime tracking table) differs |
| Gate-critical tables present | ✅ `revoked_tokens`; `luca_messages.model_id` + `luca_messages.inputs_hash` |

This test surfaced and fixed a real gap: `journal_entries`, `audio_library` and `user_audio`
were used by application routes but had no committed `CREATE TABLE` (they existed only in the
live DB). Migration `018_journal_and_audio.sql` now creates them, so committed source fully
reproduces production. The throwaway database was dropped after verification.

**Regression command** (safe to re-run; creates and drops a temp DB):

```bash
psql -c "CREATE DATABASE solaris_recovery_test;"
for f in schema schema_solaris schema_wallet schema_messaging schema_marketplace \
         schema_notifications schema_bookings schema_gps schema_sprint; do
  psql -d solaris_recovery_test -f backend/$f.sql; done
for f in backend/migrations/*.sql; do psql -d solaris_recovery_test -f "$f"; done
psql -d solaris_recovery_test -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"  # -> 77
psql -c "DROP DATABASE solaris_recovery_test;"
```
