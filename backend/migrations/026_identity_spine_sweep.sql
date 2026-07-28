-- =====================================================================
-- 026 — Identity spine sweep (Track B, M1). Additive only.
--
--  * Every domain table anchored on a user id gains a nullable
--    subject_id VARCHAR(40) REFERENCES solaris_subjects(subject_id),
--    backfilled. Old columns stay for compatibility (A2 §1.2 step 4).
--  * users.subject_id added + backfilled (spec step 3).
--  * audit_logs gains actor_subject_id + purpose + consent_scope
--    (four-W check, A1 §7 Observability).
--  * solaris_subjects gains entity_type (human|organization|agent|treasury).
--  * solaris_identity_bindings binding_type CHECK widened to the A2 kinds
--    (passkey, lightning_address, oauth, external_id) — existing kept.
--  * Subject + email-binding backfill re-run for users created since 023.
-- =====================================================================

-- ---------------------------------------------------------------
-- 0. Re-backfill subjects for any users missing one (idempotent)
-- ---------------------------------------------------------------
INSERT INTO solaris_subjects (subject_id, user_id)
SELECT 'sol_' || replace(gen_random_uuid()::text, '-', ''), u.id
FROM users u
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO solaris_identity_bindings (subject_id, binding_type, binding_value, binding_hash, status, verified_at)
SELECT s.subject_id, 'email', NULL,
       encode(sha256(lower(u.email)::bytea), 'hex'),
       'active', u.created_at
FROM users u
JOIN solaris_subjects s ON s.user_id = u.id
WHERE u.email IS NOT NULL AND u.email <> ''
ON CONFLICT (subject_id, binding_type, binding_hash) DO NOTHING;

-- ---------------------------------------------------------------
-- 1. Subject metadata per A2 §1.1 (additive)
-- ---------------------------------------------------------------
ALTER TABLE solaris_subjects
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) NOT NULL DEFAULT 'human';
DO $$ BEGIN
  ALTER TABLE solaris_subjects
    ADD CONSTRAINT solaris_subjects_entity_type_chk
    CHECK (entity_type IN ('human','organization','agent','treasury'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Widen binding kinds to the full A2 set (keep the legacy values valid)
ALTER TABLE solaris_identity_bindings
  DROP CONSTRAINT IF EXISTS solaris_identity_bindings_binding_type_check;
ALTER TABLE solaris_identity_bindings
  ADD CONSTRAINT solaris_identity_bindings_binding_type_check
  CHECK (binding_type IN ('email','did','nostr','wallet','clinic',
                          'passkey','lightning_address','oauth','external_id'));

-- ---------------------------------------------------------------
-- 2. users.subject_id (spec step 3)
-- ---------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subject_id VARCHAR(40)
    REFERENCES solaris_subjects(subject_id);
UPDATE users u SET subject_id = s.subject_id
FROM solaris_subjects s WHERE u.subject_id IS NULL AND s.user_id = u.id;
CREATE INDEX IF NOT EXISTS idx_users_subject ON users(subject_id);

-- ---------------------------------------------------------------
-- 3. Domain-table sweep: add subject_id + backfill + index.
--    Old user/patient columns remain; new writes carry both.
-- ---------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('appointments',               'patient_id'),
      ('aspect_scores',              'user_id'),
      ('assessment_responses',       'user_id'),
      ('body_system_scores',         'user_id'),
      ('booking_requests',           'user_id'),
      ('bookings',                   'patient_id'),
      ('contributions',              'user_id'),
      ('conversations',              'patient_id'),
      ('daily_checkins',             'user_id'),
      ('documents',                  'user_id'),
      ('habit_plans',                'user_id'),
      ('habit_ticks',                'user_id'),
      ('health_documents',           'user_id'),
      ('health_records',             'user_id'),
      ('journal_entries',            'user_id'),
      ('luca_messages',              'user_id'),
      ('member_habits',              'user_id'),
      ('member_journeys',            'user_id'),
      ('notifications',              'user_id'),
      ('passport_consents',          'member_id'),
      ('patient_intake_submissions', 'patient_id'),
      ('reward_events',              'user_id'),
      ('user_audio',                 'user_id'),
      ('vault_entries',              'user_id'),
      ('vault_exports',              'user_id'),
      ('wallet_addresses',           'user_id')
    ) AS v(tbl, ucol)
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS subject_id VARCHAR(40) REFERENCES solaris_subjects(subject_id)',
      t.tbl);
    EXECUTE format(
      'UPDATE %I d SET subject_id = s.subject_id FROM solaris_subjects s WHERE d.subject_id IS NULL AND s.user_id = d.%I',
      t.tbl, t.ucol);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_subject ON %I(subject_id)',
      t.tbl, t.tbl);
  END LOOP;
END $$;

-- ---------------------------------------------------------------
-- 4. Audit events: actor subject + four-W columns (purpose, consent_scope)
-- ---------------------------------------------------------------
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_subject_id VARCHAR(40)
    REFERENCES solaris_subjects(subject_id);
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(120) NOT NULL DEFAULT 'operations';
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS consent_scope VARCHAR(60) NOT NULL DEFAULT 'private';

UPDATE audit_logs a SET actor_subject_id = s.subject_id
FROM solaris_subjects s WHERE a.actor_subject_id IS NULL AND s.user_id = a.actor_id;
CREATE INDEX IF NOT EXISTS idx_audit_actor_subject ON audit_logs(actor_subject_id);
