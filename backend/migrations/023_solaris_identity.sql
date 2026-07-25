-- =====================================================================
-- 023 — Solaris ID: permanent portable identity above endpoints
-- (ADR: docs/adr/001-solaris-identity.md, GPS Constitution §6:
--  "Identity is stable above replaceable payment endpoints.")
--
-- Additive & backward compatible:
--   * solaris_subjects: one permanent, non-PII subject id per user
--     ('sol_' + 32 hex; random — never derived from email/uuid).
--   * solaris_identity_bindings: email/did/nostr/wallet/clinic as
--     replaceable BINDINGS on the subject (email stored hash-only).
--   * nullable subject_id join columns on ai_execution_receipts,
--     agent_capability_grants, gps_allocation_receipts — backfilled.
--   * users table untouched; no data rewritten; receipts append-only
--     (evidence blobs are NOT modified — hash-stable).
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. Subjects: 1:1 with users; carries GPS end-address config
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solaris_subjects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id            VARCHAR(40) UNIQUE NOT NULL
                          CHECK (subject_id ~ '^sol_[0-9a-f]{32}$'),
  user_id               UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gps_end_address       VARCHAR(255) NOT NULL DEFAULT 'solaris_default',
  gps_end_address_type  VARCHAR(30)  NOT NULL DEFAULT 'solaris_default'
                          CHECK (gps_end_address_type IN ('solaris_default','lightning_address')),
  status                VARCHAR(20)  NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','suspended')),
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_solaris_subjects_user ON solaris_subjects(user_id);

-- ---------------------------------------------------------------
-- 2. Bindings: replaceable pointers attached to the subject.
--    binding_value holds PUBLIC identifiers only (did/npub/address).
--    For 'email' it is NULL — only a SHA-256 hash is stored (no PII
--    duplicated outside the users table).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solaris_identity_bindings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    VARCHAR(40) NOT NULL
                  REFERENCES solaris_subjects(subject_id) ON DELETE CASCADE,
  binding_type  VARCHAR(30) NOT NULL
                  CHECK (binding_type IN ('email','did','nostr','wallet','clinic')),
  binding_value TEXT,
  binding_hash  VARCHAR(64) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','pending','revoked')),
  verified_at   TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at    TIMESTAMP,
  UNIQUE (subject_id, binding_type, binding_hash)
);

CREATE INDEX IF NOT EXISTS idx_sib_subject ON solaris_identity_bindings(subject_id);
CREATE INDEX IF NOT EXISTS idx_sib_type    ON solaris_identity_bindings(binding_type);

-- ---------------------------------------------------------------
-- 3. Backfill: exactly one subject per existing user (idempotent,
--    never duplicates user records).
-- ---------------------------------------------------------------
INSERT INTO solaris_subjects (subject_id, user_id)
SELECT 'sol_' || replace(gen_random_uuid()::text, '-', ''), u.id
FROM users u
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------
-- 4. Backfill bindings
-- ---------------------------------------------------------------
-- 4a. email: hash-only (lowercased), value stays NULL
INSERT INTO solaris_identity_bindings (subject_id, binding_type, binding_value, binding_hash, status, verified_at)
SELECT s.subject_id, 'email', NULL,
       encode(sha256(lower(u.email)::bytea), 'hex'),
       'active', u.created_at
FROM users u
JOIN solaris_subjects s ON s.user_id = u.id
WHERE u.email IS NOT NULL AND u.email <> ''
ON CONFLICT (subject_id, binding_type, binding_hash) DO NOTHING;

-- 4b. did (public identifier — stored as value)
INSERT INTO solaris_identity_bindings (subject_id, binding_type, binding_value, binding_hash, status, verified_at)
SELECT s.subject_id, 'did', u.did,
       encode(sha256(u.did::bytea), 'hex'),
       'active', u.created_at
FROM users u
JOIN solaris_subjects s ON s.user_id = u.id
WHERE u.did IS NOT NULL AND u.did <> ''
ON CONFLICT (subject_id, binding_type, binding_hash) DO NOTHING;

-- 4c. nostr npub (public identifier)
INSERT INTO solaris_identity_bindings (subject_id, binding_type, binding_value, binding_hash, status, verified_at)
SELECT s.subject_id, 'nostr', u.nostr_npub,
       encode(sha256(u.nostr_npub::bytea), 'hex'),
       'active', u.created_at
FROM users u
JOIN solaris_subjects s ON s.user_id = u.id
WHERE u.nostr_npub IS NOT NULL AND u.nostr_npub <> ''
ON CONFLICT (subject_id, binding_type, binding_hash) DO NOTHING;

-- 4d. wallet addresses (public identifiers)
INSERT INTO solaris_identity_bindings (subject_id, binding_type, binding_value, binding_hash, status, verified_at)
SELECT s.subject_id, 'wallet', w.address,
       encode(sha256(w.address::bytea), 'hex'),
       CASE WHEN w.verified THEN 'active' ELSE 'pending' END,
       w.verified_at
FROM wallet_addresses w
JOIN solaris_subjects s ON s.user_id = w.user_id
WHERE w.address IS NOT NULL AND w.address <> ''
ON CONFLICT (subject_id, binding_type, binding_hash) DO NOTHING;

-- ---------------------------------------------------------------
-- 5. Additive nullable subject_id join columns + backfill.
--    Join keys only — signed/hashed evidence blobs are untouched.
-- ---------------------------------------------------------------
ALTER TABLE ai_execution_receipts
  ADD COLUMN IF NOT EXISTS subject_id VARCHAR(40)
    REFERENCES solaris_subjects(subject_id);

UPDATE ai_execution_receipts r
SET subject_id = s.subject_id
FROM solaris_subjects s
WHERE r.subject_id IS NULL AND s.user_id = r.user_id;

ALTER TABLE agent_capability_grants
  ADD COLUMN IF NOT EXISTS owner_subject_id VARCHAR(40)
    REFERENCES solaris_subjects(subject_id);

UPDATE agent_capability_grants g
SET owner_subject_id = s.subject_id
FROM solaris_subjects s
WHERE g.owner_subject_id IS NULL AND s.user_id = g.owner_id;

ALTER TABLE gps_allocation_receipts
  ADD COLUMN IF NOT EXISTS subject_id VARCHAR(40)
    REFERENCES solaris_subjects(subject_id);

UPDATE gps_allocation_receipts r
SET subject_id = s.subject_id
FROM gps_transactions t
JOIN solaris_subjects s ON s.user_id = t.patient_id
WHERE r.subject_id IS NULL AND r.transaction_id = t.id;

CREATE INDEX IF NOT EXISTS idx_ai_receipts_subject ON ai_execution_receipts(subject_id);
CREATE INDEX IF NOT EXISTS idx_grants_owner_subject ON agent_capability_grants(owner_subject_id);
CREATE INDEX IF NOT EXISTS idx_gps_receipts_subject ON gps_allocation_receipts(subject_id);
