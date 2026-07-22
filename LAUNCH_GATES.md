# Solaris Health — Non-Negotiable Launch Gates

> Last updated: 2026-07-22
> Status key: ✅ PASS · ⚠️ PARTIAL · ❌ FAIL · 🔲 NOT YET TESTED

---

## Gate 1 — Source Recovery ⚠️ PARTIAL
**Required:** A fresh environment can be recreated solely from GitHub + documented secrets.

**Current state:**
- ✅ All application code is on `main` branch at `github.com/TheMajicCode/solaris-health`
- ✅ `DEPLOY.md` documents step-by-step recreation
- ✅ `backend/.env.example` lists every required env var
- ✅ `docker-compose.yml` + `Dockerfile.backend` + frontend Dockerfile present
- ✅ All 15 DB migrations in `backend/migrations/`
- ⚠️ `backend/src/db/schema*.sql` base schema files must also be present and ordered correctly
- ❌ No tested "clone → up → working" runbook against a clean machine (untested)

**Required to pass:** Run the recreation test on a clean VM. Document exact commands in DEPLOY.md.

**Recovery commands (documented, not yet verified on clean machine):**
```bash
git clone https://github.com/TheMajicCode/solaris-health.git
cd solaris-health
cp backend/.env.example backend/.env   # fill in real secrets
docker compose up -d --build
# Wait ~30s for postgres health check
docker compose exec backend npm run migrate
docker compose exec backend node src/db/seed-demo-data.js
curl http://localhost:5000/api/health
```

---

## Gate 2 — Database Migration ⚠️ PARTIAL
**Required:** All migrations succeed against a copy of production.

**Current state:**
- ✅ `node-pg-migrate` runner installed and wired to startup
- ✅ 15 numbered migration files in `backend/migrations/`
- ✅ Migrations auto-apply on container startup
- ❌ No migration test run against a production data dump (untested)
- ❌ No rollback scripts (`exports.down`) in any migration file

**Required to pass:**
```bash
pg_dump $PRODUCTION_DATABASE_URL > prod-snapshot.sql
psql $TEST_DATABASE_URL < prod-snapshot.sql
DATABASE_URL=$TEST_DATABASE_URL npm run migrate
# All migrations must apply cleanly with no errors
```

---

## Gate 3 — Rollback ⚠️ PARTIAL
**Required:** Previous application version can be restored without losing database integrity.

**Current state:**
- ✅ Every commit tagged with phase (tier1, tier2, etc.) — can `git checkout` any version
- ✅ Docker images can be rebuilt from any commit
- ❌ No `exports.down` in migration files — forward-only migrations
- ❌ No versioned Docker image registry (images not pushed to GHCR/ECR)

**Required to pass:**
- Add `down` migrations to at least the last 3 migration files
- Push Docker images to GitHub Container Registry on each `main` push (add to CI)
- Document rollback procedure: `git revert` + `docker pull <previous-image>` + `npm run migrate:down`

---

## Gate 4 — Backup ❌ FAIL
**Required:** A backup has been successfully restored into a clean environment.

**Current state:**
- ❌ Database is a local Docker volume — no automated backups
- ❌ No backup schedule configured
- ❌ No restore test performed

**Immediate action (can run today on this VM):**
```bash
# Manual backup
docker exec luca-passport-postgres-1 pg_dump -U postgres luca_passport_db > backup-$(date +%Y%m%d).sql
# Upload to cloud storage
aws s3 cp backup-$(date +%Y%m%d).sql s3://<your-bucket>/backups/

# Restore test
psql $TEST_DATABASE_URL < backup-YYYYMMDD.sql
```

**Required to pass:** Migrate to Neon (see `NEON_MIGRATION.md`) or add `pg_dump` cron job + tested restore.

---

## Gate 5 — Tenant Isolation ❌ NOT YET TESTED
**Required:** Automated tests prove Clinic A cannot access Clinic B data.

**Current state:**
- ✅ `authMiddleware` on all protected routes
- ✅ `passport_consents` table gates cross-user Passport access
- ✅ Provider routes check `req.user.userId === booking.provider_id`
- ❌ No automated multi-tenant isolation test
- ❌ No test: "Sofia cannot see Alejandro's copilot conversations"
- ❌ No test: "Patient A cannot read Patient B's health documents"

**Test to write (`tests/tenant-isolation.test.js`):**
```js
// 1. Login as Sofia → try GET /api/health-documents of another user → expect 403
// 2. Login as Alejandro → try GET /api/luca/history of Sofia's account → expect 403
// 3. Login as Sofia → try GET /api/provider/patients → expect 403 (not a provider)
// 4. Login as Dr. Elena → try view Dr. Alejandro's earnings → expect 403
```

---

## Gate 6 — Authentication ⚠️ PARTIAL
**Required:** Real login, session expiry, revocation, and role enforcement tested.

**Current state:**
- ✅ JWT-based auth, 7-day expiry, fail-fast on missing secret
- ✅ Password strength enforced at registration
- ✅ Role checked on admin routes (`adminOnly` middleware)
- ✅ Rate limiting on login (60/15min per real IP)
- ⚠️ No token revocation list (logout only clears client-side token)
- ⚠️ SIWE nonce is in-memory (lost on restart — users must re-auth on deploy)
- ❌ No automated session expiry test
- ❌ No test: "expired token returns 401"

**Required to pass:** Add token blocklist (Redis or DB table) for logout + write expiry/revocation tests.

---

## Gate 7 — AI Safety ⚠️ PARTIAL
**Required:** Every AI output is labelled, logged, and human-approved where clinically relevant.

**Current state:**
- ✅ LUCA system prompt explicitly forbids diagnosis and prescription
- ✅ All LUCA messages stored in `luca_messages` table with `user_id`, `model`, `created_at`
- ✅ Practitioner copilot has separate `context_type='practitioner'` logging
- ✅ LUCA TTS strips markdown — clean audio output
- ⚠️ No human approval gate for AI-generated health summaries shared with practitioners
- ⚠️ No model/inputs-hash stored alongside messages (audit trail incomplete)
- ❌ No automated test: "LUCA response never contains the word 'diagnose'"

**Required to pass:** Log `model_id` + `inputs_hash` in `luca_messages`. Add approval gate before AI summary reaches practitioner view.

---

## Gate 8 — PHI Boundary ❌ NOT CONFIGURED
**Required:** No regulated data enters a service without the proper agreement and configuration.

**Current state:**
- ✅ De-identification intent: raw patient data should stay on local node (luca-node)
- ✅ Vault export gives patients full data portability
- ❌ No BAA (Business Associate Agreement) with any cloud provider
- ❌ No encryption at rest for health documents or journal entries
- ❌ Private messaging keys stored in `localStorage` (XSS-accessible)
- ❌ No HIPAA audit log (who accessed what PHI, when)

**This gate blocks any real patient data.** Current app is safe for consented beta testers who understand it is pre-HIPAA. Document this explicitly in onboarding.

---

## Gate 9 — Load ❌ NOT TESTED
**Required:** Core journeys survive substantially more traffic than expected at launch.

**Current state:**
- ❌ No load test run
- ❌ Single VM, single backend process, no horizontal scale
- ✅ DB pool capped at 10 connections (won't exhaust postgres)
- ✅ Rate limiting protects against naive DoS

**Minimum load test (run with `autocannon` or `k6`):**
```bash
# Install
npm i -g autocannon
# Test: 50 concurrent users, 30 seconds, login endpoint
autocannon -c 50 -d 30 -m POST -H "Content-Type: application/json" \
  -b '{"email":"sofia@solaris.health","password":"demo123"}' \
  https://solaris-health.abacusai.cloud/api/auth/login
# Target: p99 < 500ms, 0 errors
```

---

## Gate 10 — Monitoring ⚠️ PARTIAL
**Required:** Errors, latency, resource use, and failed jobs produce actionable alerts.

**Current state:**
- ✅ `/api/health` endpoint live
- ✅ Structured error logging to stdout (captured by Docker)
- ⚠️ Logs go to Docker stdout only — no aggregation, no alerting
- ❌ No Sentry / Datadog / Grafana
- ❌ No uptime monitor (e.g. BetterUptime, UptimeRobot)
- ❌ No alert if backend crashes or DB pool exhausts

**Immediate action (free):** Set up UptimeRobot to ping `/api/health` every 5 min and email on failure.

---

## Gate 11 — Incident Response ❌ MISSING
**Required:** One written page explaining how to freeze writes, roll back, and restore.

**Playbook (write this and keep it up to date):**

### Step 1 — Freeze writes
```bash
# Put backend in read-only mode (temporarily set env var and restart)
docker compose exec backend sh -c 'echo READ_ONLY=true > /tmp/readonly_flag'
# Or: scale backend to 0
docker compose stop backend
```

### Step 2 — Capture state
```bash
docker exec luca-passport-postgres-1 pg_dump -U postgres luca_passport_db > incident-$(date +%Y%m%d-%H%M).sql
```

### Step 3 — Roll back application
```bash
git log --oneline -10  # find the last good commit
git checkout <good-commit-hash>
docker compose up -d --build
```

### Step 4 — Restore database (if data was corrupted)
```bash
docker exec -i luca-passport-postgres-1 psql -U postgres -c 'DROP DATABASE luca_passport_db; CREATE DATABASE luca_passport_db;'
docker exec -i luca-passport-postgres-1 psql -U postgres luca_passport_db < incident-YYYYMMDD-HHMM.sql
```

### Step 5 — Verify and resume
```bash
curl https://solaris-health.abacusai.cloud/api/health
node backend/scripts/smoke-test.js
docker compose start backend
```

---

## Summary Scorecard

| Gate | Status | Blocker for real patients? |
|------|--------|---------------------------|
| 1. Source Recovery | ⚠️ PARTIAL | No |
| 2. DB Migration | ⚠️ PARTIAL | No |
| 3. Rollback | ⚠️ PARTIAL | No |
| 4. Backup | ❌ FAIL | **YES** |
| 5. Tenant Isolation | 🔲 UNTESTED | **YES** |
| 6. Authentication | ⚠️ PARTIAL | No |
| 7. AI Safety | ⚠️ PARTIAL | **YES** |
| 8. PHI Boundary | ❌ FAIL | **YES** |
| 9. Load | 🔲 UNTESTED | No (beta) |
| 10. Monitoring | ⚠️ PARTIAL | No (beta) |
| 11. Incident Response | ⚠️ PARTIAL | No |

**Gates 4, 5, 7, 8 must pass before any real patient data enters the system.**
**Gates 1–3, 6, 9–11 must pass before public launch.**
