# Incident Response Runbook — Solaris Health / LUCA Passport

Executable runbook for the production deployment at
`https://solaris-health.abacusai.cloud` (Docker Compose on the Abacus VM,
repo at `/home/ubuntu/luca-passport`). Every command below is real and has been
verified against this deployment topology.

**Owners (fill in real people before public launch):**

| Role | Owner |
|------|-------|
| Incident Commander | `<OWNER: founder / on-call engineer>` |
| Communications | `<OWNER: member communications>` |
| Database steward | `<OWNER: engineer with VM SSH access>` |

**Severity guide:** SEV1 = data corruption / breach suspected / total outage.
SEV2 = a core journey broken (login, LUCA, bookings). SEV3 = degraded but usable.

---

## Step 1 — Freeze writes (READ_ONLY_MODE)

The backend has a real write-freeze switch (`backend/src/server.js`, tested in
`backend/tests/read-only-mode.test.js`). When `READ_ONLY_MODE=true`, all
mutating API requests return `503 {readOnly:true}`; reads and login keep
working so members see their data and operators can authenticate.

```bash
cd /home/ubuntu/luca-passport
# Add the flag to the backend environment and restart only the backend:
grep -q '^READ_ONLY_MODE=' backend/.env \
  && sed -i 's/^READ_ONLY_MODE=.*/READ_ONLY_MODE=true/' backend/.env \
  || echo 'READ_ONLY_MODE=true' >> backend/.env
docker compose up -d backend

# Verify the freeze is active (expect 503 + readOnly:true):
curl -s -X POST https://solaris-health.abacusai.cloud/api/auth/register \
  -H 'Content-Type: application/json' -d '{}' | head -c 200
# Verify reads still work (expect status ok):
curl -s https://solaris-health.abacusai.cloud/api/health
```

Total outage / breach suspected? Stop serving entirely instead:

```bash
docker compose stop backend    # frontend still serves a static shell
```

## Step 2 — Capture evidence (before changing anything else)

```bash
mkdir -p /home/ubuntu/incidents/$(date +%Y%m%d-%H%M) && cd $_
# Container state + recent logs
docker compose -f /home/ubuntu/luca-passport/docker-compose.yml ps > containers.txt
docker logs --since 2h luca-passport-backend-1  > backend.log  2>&1
docker logs --since 2h luca-passport-frontend-1 > frontend.log 2>&1
docker logs --since 2h luca-passport-postgres-1 > postgres.log 2>&1
# Deployed code version
git -C /home/ubuntu/luca-passport log --oneline -5 > git-state.txt
git -C /home/ubuntu/luca-passport status --short >> git-state.txt
# Immediate DB snapshot (separate from the daily backup)
docker exec luca-passport-postgres-1 pg_dump -U luca_user luca_passport \
  > incident-snapshot.sql
```

Do **not** paste member data or tokens into chat tools; evidence stays on the VM.

## Step 3 — Backup status check

A daily backup already runs at 03:00 via cron (`/home/ubuntu/solaris-backup.sh`
→ `pg_dump` → S3, keeps last 7 local in `/home/ubuntu/backups/`).

```bash
ls -lt /home/ubuntu/backups/ | head        # newest local backups
bash /home/ubuntu/solaris-backup.sh        # take a fresh one now
```

## Step 4 — Roll back the application

Application rollback is git-based (images are built from the working tree):

```bash
cd /home/ubuntu/luca-passport
git log --oneline -10                      # identify last known-good commit/tag
git stash                                  # preserve any uncommitted work
git checkout <good-commit-or-tag>          # e.g. a sprint checkpoint tag
docker compose build frontend backend
docker compose up -d frontend backend
curl -s https://solaris-health.abacusai.cloud/api/health
```

Migrations auto-run at backend startup and are **forward-only** (see
`docs/` forward-fix policy). Rolling the app back does NOT undo schema
changes — additive migrations are designed to be safe under older code.

## Step 5 — Database restore decision tree

```
Data wrong or missing?
├─ NO  → do not touch the DB. App rollback (Step 4) is enough.
├─ YES, single rows / one member affected
│    → fix forward with targeted SQL in a transaction; verify; commit.
│      (Preferred: less blast radius than a full restore.)
└─ YES, widespread corruption after time T
     → full restore from the newest backup taken BEFORE T:
```

Full restore (destructive — requires Incident Commander sign-off; writes must
already be frozen per Step 1):

```bash
# 1. Rehearse into a scratch DB first — NEVER restore straight over prod:
docker exec luca-passport-postgres-1 psql -U luca_user -d postgres \
  -c 'CREATE DATABASE solaris_restore_test;'
docker exec -i luca-passport-postgres-1 psql -U luca_user -d solaris_restore_test \
  < /home/ubuntu/backups/solaris-<TIMESTAMP>.sql
docker exec luca-passport-postgres-1 psql -U luca_user -d solaris_restore_test \
  -c '\dt' | tail -3          # sanity: expect ~77+ tables

# 2. Only after the rehearsal looks right, restore prod:
docker compose stop backend
docker exec luca-passport-postgres-1 psql -U luca_user -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='luca_passport' AND pid <> pg_backend_pid();"
docker exec luca-passport-postgres-1 psql -U luca_user -d postgres \
  -c 'DROP DATABASE luca_passport; CREATE DATABASE luca_passport OWNER luca_user;'
docker exec -i luca-passport-postgres-1 psql -U luca_user -d luca_passport \
  < /home/ubuntu/backups/solaris-<TIMESTAMP>.sql
docker compose start backend   # startup re-applies any missing migrations

# 3. Clean up the rehearsal DB:
docker exec luca-passport-postgres-1 psql -U luca_user -d postgres \
  -c 'DROP DATABASE solaris_restore_test;'
```

Data loss window = time between the chosen backup and the freeze. Record it in
the post-incident review and notify affected members.

## Step 6 — Secret rotation (if leak suspected)

Secrets live in `/home/ubuntu/luca-passport/backend/.env` and root `.env`
(both untracked — never committed).

```bash
cd /home/ubuntu/luca-passport
# 1. JWT secret — invalidates ALL sessions (members must log in again):
NEW=$(openssl rand -hex 32)
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW/" backend/.env
# 2. AI provider key — rotate in the provider console, then:
#    sed -i 's/^LUCA_AI_API_KEY=.*/LUCA_AI_API_KEY=<new-key>/' backend/.env
# 3. DB password — ALTER ROLE in postgres + update .env DATABASE_URL, then:
docker compose up -d backend
# 4. Verify login works with a test account, and old tokens are rejected.
```

## Step 7 — Resume writes, notify, review

```bash
cd /home/ubuntu/luca-passport
sed -i 's/^READ_ONLY_MODE=.*/READ_ONLY_MODE=false/' backend/.env
docker compose up -d backend
node backend/scripts/smoke-test.js         # 10 live checks must pass
node backend/tests/tenant-isolation.manual.js 2>/dev/null || true
curl -s https://solaris-health.abacusai.cloud/api/health
```

Notification: Communications owner informs affected members in plain language
(what happened, what data was affected, what we did, what they should do).
Post-incident review within 72h: timeline, root cause, data-loss window,
action items with owners.

---

## Tabletop checklist (non-destructive rehearsal)

Run quarterly; nothing here touches production data:

- [ ] `READ_ONLY_MODE=true` on a **local** backend; confirm 503 on POST, 200 on GET
      (or just run `npx jest tests/read-only-mode.test.js` in `backend/` — 5 tests).
- [ ] `ls -lt /home/ubuntu/backups/` — newest backup < 24h old.
- [ ] Restore newest backup into `solaris_restore_test` (Step 5 rehearsal block);
      confirm table + user counts; drop the scratch DB.
- [ ] `git log --oneline -5` — identify the current known-good tag you would roll to.
- [ ] Confirm evidence-capture commands (Step 2) run cleanly.
- [ ] Owner table above has real names and reachable contacts.

Last tabletop: `<DATE — not yet run against production>`
