-- 038_binding_proof_and_challenges.sql
-- Beta V1 merge-blocker security correction (blockers #3, #4, #5).
--
-- 1) Refuse to migrate if any DUPLICATE ACTIVE Nostr binding already exists
--    (same pubkey active for two subjects). We STOP rather than auto-resolve,
--    so a human decides which owner is legitimate.
-- 2) Enforce AT MOST ONE active owner per Nostr pubkey via a partial unique
--    index (revoked history is preserved — the index only covers active rows).
-- 3) Postgres-backed single-use challenge store (replaces the in-memory Map),
--    so proof-of-control challenges survive restarts and work across >1 backend
--    instance. Stores only a HASH of the nonce — never secret material.
-- 4) Server-enforced onboarding invariants: experience version NOT NULL + >=0,
--    wealth outcome constrained to 'completed'|'skipped' (or NULL).
--
-- Additive + idempotent; safe to re-run.

-- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- (1) Duplicate-active guard — abort the migration if the data is unsafe.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT binding_hash
    FROM solaris_identity_bindings
    WHERE binding_type = 'nostr' AND status = 'active'
    GROUP BY binding_hash
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to migrate: % Nostr pubkey(s) have more than one ACTIVE binding. Resolve the duplicate active owner(s) by hand before applying 038.',
      dup_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- (2) At most ONE active owner per Nostr pubkey. Partial unique index over the
--     binding hash, restricted to active nostr rows — revoked history is kept.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_nostr_binding
  ON solaris_identity_bindings (binding_hash)
  WHERE binding_type = 'nostr' AND status = 'active';

-- ---------------------------------------------------------------------------
-- (3) Proof-of-control challenge store. One row per issued challenge.
--     nonce_hash = sha256(nonce) — the raw nonce is NEVER persisted. No nsec,
--     mnemonic, seed or signature is ever stored here.
--       purpose      'login' | 'bind'  (login and bind challenges are NOT
--                    interchangeable — purpose is part of the atomic consume)
--       subject_id   authenticated subject a BIND challenge is scoped to
--       user_id      authenticated user a BIND challenge is scoped to
--       issued_ms    integer issue time embedded in the signed message (avoids
--                    timestamptz formatting drift when the server reconstructs
--                    the canonical message to verify the signature)
--       expires_at   short expiry enforced in the atomic consume
--       consumed_at  set exactly once — single use
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nostr_auth_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash  text        NOT NULL,
  npub        text        NOT NULL,
  pubkey_hex  text        NOT NULL,
  purpose     text        NOT NULL CHECK (purpose IN ('login', 'bind')),
  subject_id  text,
  user_id     uuid,
  issued_ms   bigint      NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz
);

-- Cheap expired-row sweep.
CREATE INDEX IF NOT EXISTS idx_nostr_auth_challenges_expires_at
  ON nostr_auth_challenges (expires_at);
-- Bounded rate limiting per (npub, purpose) over a recent window.
CREATE INDEX IF NOT EXISTS idx_nostr_auth_challenges_rate
  ON nostr_auth_challenges (npub, purpose, issued_at);

-- ---------------------------------------------------------------------------
-- (4) Onboarding invariants enforced at the schema level.
-- ---------------------------------------------------------------------------
UPDATE users SET onboarding_experience_version = 0 WHERE onboarding_experience_version IS NULL;

ALTER TABLE users ALTER COLUMN onboarding_experience_version SET DEFAULT 0;
ALTER TABLE users ALTER COLUMN onboarding_experience_version SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_onboarding_experience_version_nonneg'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_onboarding_experience_version_nonneg
      CHECK (onboarding_experience_version >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_wealth_screen_status'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_wealth_screen_status
      CHECK (wealth_screen_status IS NULL OR wealth_screen_status IN ('completed', 'skipped'));
  END IF;
END $$;
