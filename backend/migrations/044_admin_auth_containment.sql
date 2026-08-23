-- 044_admin_auth_containment.sql — NODE E4J-RC1.2 (additive, FORWARD-ONLY)
--
-- STATUS: COMMITTED, NOT APPLIED to the shared beta database.
-- Like 039 and 043, this is an additive persistence contract only. It is applied
-- deliberately by Majd at cutover time via:  cd backend && npm run migrate
-- Nothing here creates an admin, mints a token, rotates a credential, or writes
-- a secret value.
--
-- Additive only: nullable columns. No column is dropped or renamed, so it is
-- backward compatible with running code. Idempotent (IF NOT EXISTS everywhere),
-- so re-running `npm run migrate` is a no-op.
--
-- PURPOSE (RC1.2 — admin auth integration + scoped session containment):
--   1. users.tokens_valid_after — per-ACCOUNT session invalidation cut-off.
--      Any JWT whose `iat` (issued-at) predates this timestamp is rejected by
--      authMiddleware for THAT user only. This lets an operator revoke one
--      account's live sessions WITHOUT a password change and WITHOUT rotating
--      the global JWT signing secret (which would log out every user).
--      "Password rotation != session revocation" — this column is the latter.
--   2. users.email_verified_at — canonical verified-email marker. The admin
--      activation flow requires a verified email before an admin password may be
--      set; no such field existed on `users`, so this adds it additively.
--   3. admin_mfa_secrets.last_totp_step — highest accepted TOTP time-step, used
--      to reject replayed/re-used codes (a code is valid at most once).

-- ---------------------------------------------------------------------------
-- 1. Per-account session invalidation cut-off (does NOT touch other users).
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. Canonical verified-email marker (required by admin activation).
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 3. TOTP replay guard — last accepted time-step per confirmed secret.
--    (043 created admin_mfa_secrets.)
-- ---------------------------------------------------------------------------
ALTER TABLE admin_mfa_secrets
  ADD COLUMN IF NOT EXISTS last_totp_step BIGINT;
