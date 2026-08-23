-- 043_admin_activation_security.sql — NODE E4J-RC1.1 (additive, FORWARD-ONLY)
--
-- STATUS: COMMITTED, NOT APPLIED to the shared beta database.
-- Like 039, this is the additive persistence contract for the SECOND-factor and
-- audit boundaries around the one-time admin activation flow. Majd applies it
-- deliberately at cutover time; nothing here creates an admin or mints a token.
--
-- Additive only: new tables + nullable/defaulted columns. No column is dropped
-- or renamed, so it is backward compatible with running code. Idempotent
-- (IF NOT EXISTS everywhere), so re-running `npm run migrate` is a no-op.
--
-- SECURITY: this schema stores ONLY identifiers, fingerprints, wrapped secrets,
-- and outcomes. It NEVER stores a raw password, a raw activation token, a
-- plaintext TOTP secret, or a session token.

-- ---------------------------------------------------------------------------
-- 1. Passkey / MFA enrollment state on the admin user.
--    (039 already added users.admin_mfa_enrolled_at.)
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_passkey_enrolled_at TIMESTAMP,
  -- True once the admin has completed activation (password set via token) AND a
  -- second factor is enrolled. Full-privilege admin session is withheld until
  -- this is true (enforced by app policy in src/lib/admin-activation-flow.js).
  ADD COLUMN IF NOT EXISTS admin_activated_at TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 2. TOTP MFA secrets — stored WRAPPED (KDF/AEAD ciphertext), never plaintext.
--    One active secret per admin; pending until confirmed with a valid code.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_mfa_secrets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret_wrapped TEXT NOT NULL,          -- AEAD-wrapped TOTP secret; NEVER plaintext
  confirmed_at   TIMESTAMP,              -- set once a valid TOTP code is presented
  revoked_at     TIMESTAMP,             -- recovery / rotation
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_mfa_secrets_user
  ON admin_mfa_secrets (admin_user_id);
-- At most one CONFIRMED, non-revoked secret per admin.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_admin_mfa_confirmed
  ON admin_mfa_secrets (admin_user_id)
  WHERE confirmed_at IS NOT NULL AND revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. WebAuthn passkeys — public-key credentials only (no private material).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_passkeys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,          -- opaque credential id (public)
  public_key    TEXT NOT NULL,          -- COSE public key (public by design)
  sign_count    BIGINT NOT NULL DEFAULT 0,
  revoked_at    TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_admin_passkey_credential
  ON admin_passkeys (credential_id);
CREATE INDEX IF NOT EXISTS idx_admin_passkeys_user
  ON admin_passkeys (admin_user_id);

-- ---------------------------------------------------------------------------
-- 4. Admin activation / security audit — identifiers + outcomes ONLY.
--    No raw token, no password, no session token, no PII beyond a fingerprint.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_activation_audit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  email_fingerprint VARCHAR(64),         -- sha256(lower(email)); never the address
  event             VARCHAR(48) NOT NULL, -- e.g. activate_attempt, activate_success
  outcome           VARCHAR(32) NOT NULL, -- ok | expired | reused | revoked | mismatch | rate_limited | ...
  actor_fingerprint VARCHAR(64),         -- sha256 of ip/agent identifier; never raw
  detail            VARCHAR(120),         -- short, non-sensitive reason code only
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_activation_audit_user
  ON admin_activation_audit (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activation_audit_event
  ON admin_activation_audit (event, created_at DESC);
