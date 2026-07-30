-- 033 · Persistent rate-limit store
--
-- The login/register limiters previously kept all state in express-rate-limit's
-- in-memory MemoryStore, which is wiped on every deploy/restart — a brute-force
-- attacker could reset an account's failed-attempt lockout simply by waiting for
-- (or triggering) a redeploy. This table persists the failed-attempt buckets in
-- Postgres so the lockout survives restarts.
--
-- One row per limiter key (e.g. "login|<ip>|<email>" or "register|<ip>"):
--   hits      — attempts counted in the current window
--   reset_at  — when the window expires; a hit after this rolls the window over
--
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  key       TEXT PRIMARY KEY,
  hits      INTEGER      NOT NULL DEFAULT 0,
  reset_at  TIMESTAMPTZ  NOT NULL
);

-- Lets a periodic sweep drop expired buckets cheaply.
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_reset_at ON rate_limit_hits (reset_at);
