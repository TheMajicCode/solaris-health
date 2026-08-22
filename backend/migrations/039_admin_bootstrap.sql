-- 039_admin_bootstrap.sql  — NODE G (additive, FORWARD-ONLY)
--
-- STATUS: COMMITTED, NOT APPLIED to the shared beta database.
-- The E4–J sprint runs against a SHARED, NON-ISOLATED beta backend/DB with the
-- Preview database deferred (cost decision by Majd). Unattended migrations are
-- NOT authorized. This file is the additive persistence contract for the
-- one-time admin bootstrap; Majd applies it deliberately at cutover time via:
--     cd backend && SOLARIS_ADMIN_EMAIL=<addr> npm run migrate
-- then runs scripts/bootstrap-admin.js exactly once (see that file's header).
--
-- Additive only: adds a nullable/defaulted column + an idempotency guard table.
-- No column is dropped or renamed, so it is backward compatible with running code.

-- Force a credential change on first sign-in for a bootstrapped admin.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- One-time bootstrap ledger. A single row records that THE admin was created;
-- the bootstrap script refuses to run a second time if any row exists. Stores
-- identifiers only — never a password, hash, or reset token.
CREATE TABLE IF NOT EXISTS admin_bootstrap (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  bootstrapped_email_fingerprint VARCHAR(64) NOT NULL,  -- sha256(lower(email)), NOT the address
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- At most one bootstrap row ever.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_admin_bootstrap_singleton
  ON admin_bootstrap ((true));
