-- 029_intelligence_exclusions.sql
-- M5 · Intelligence Section (spec A3).
-- A member can switch off any context source LUCA is allowed to read. The
-- exclusion is keyed by the permanent Solaris subject id (ADR 001) so it
-- follows the member, never an email/vendor id, and is append-only friendly
-- (one row per excluded source; absence = included).
--
-- Additive only. Safe to re-run.

CREATE TABLE IF NOT EXISTS intelligence_exclusions (
  id              SERIAL PRIMARY KEY,
  subject_id      TEXT        NOT NULL,
  excluded_source TEXT        NOT NULL,
  toggled_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (subject, source): toggling on inserts, toggling off deletes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_intel_excl_subject_source
  ON intelligence_exclusions (subject_id, excluded_source);

CREATE INDEX IF NOT EXISTS idx_intel_excl_subject
  ON intelligence_exclusions (subject_id);
