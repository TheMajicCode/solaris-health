-- 027_health_document_provenance.sql
-- M3 (member journey — "Add health data"): stamp the four mandatory provenance
-- columns on every member-shared health fact, per the A3 provenance ladder (L0–L5).
-- Additive & idempotent. subject_id was already added in migration 026.
--
-- Provenance model (A3 §4): a self-declared note is L0/source='self'; a lab or
-- test result the member uploads is L4 but still source='self' and pending
-- verification until an accredited party attests it.

ALTER TABLE health_documents
  ADD COLUMN IF NOT EXISTS provenance_level SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source          VARCHAR(40) NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS observed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_scope   VARCHAR(40) NOT NULL DEFAULT 'private';

-- Keep the ladder honest: 0..5 only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'health_documents' AND constraint_name = 'health_documents_provenance_level_chk'
  ) THEN
    ALTER TABLE health_documents
      ADD CONSTRAINT health_documents_provenance_level_chk
      CHECK (provenance_level BETWEEN 0 AND 5);
  END IF;
END $$;

-- Backfill: existing rows are member self-declared notes observed when created.
UPDATE health_documents SET observed_at = created_at WHERE observed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_health_documents_provenance
  ON health_documents (user_id, provenance_level, observed_at DESC);
