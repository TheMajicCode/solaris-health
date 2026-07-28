-- ============================================================
-- 028 — Intake engine A5 alignment: Foundational Health Data on the
-- Digital Sovereign Passport (provenance L2), intake provenance columns,
-- idempotent 48h reminder tracking, and the auto_send_intake system config.
--
-- Additive & idempotent. Builds on the existing intake system (015):
-- intake_form_templates / patient_intake_submissions / patient_messages.
-- Every fact row carries the four provenance columns + subject_id (spine).
-- ============================================================

-- ---------- provenance + reminder columns on intake submissions ----------
ALTER TABLE patient_intake_submissions
  ADD COLUMN IF NOT EXISTS subject_id     TEXT,
  ADD COLUMN IF NOT EXISTS level          SMALLINT    NOT NULL DEFAULT 2 CHECK (level BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS source         TEXT        NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS observed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS consent_scope  TEXT        NOT NULL DEFAULT 'care_team',
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_intake_sub_subject ON patient_intake_submissions (subject_id);

-- ---------- Foundational Health Data (Part A → Passport, one row per subject) ----------
-- Append-only-friendly: we keep the latest foundational snapshot per subject with
-- full provenance. Historic supersession is captured via updated_at + observed_at.
CREATE TABLE IF NOT EXISTS foundational_health_data (
  id             SERIAL PRIMARY KEY,
  subject_id     TEXT        NOT NULL,
  user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
  data           JSONB       NOT NULL DEFAULT '{}',
  level          SMALLINT    NOT NULL DEFAULT 2 CHECK (level BETWEEN 0 AND 5),
  source         TEXT        NOT NULL DEFAULT 'self',
  observed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_scope  TEXT        NOT NULL DEFAULT 'care_team',
  superseded_by  UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_foundational_subject ON foundational_health_data (subject_id);
CREATE INDEX IF NOT EXISTS idx_foundational_user ON foundational_health_data (user_id);

-- ---------- A5 template metadata (bilingual consent, Part A/B, variant) ----------
ALTER TABLE intake_form_templates
  ADD COLUMN IF NOT EXISTS part         VARCHAR(2),
  ADD COLUMN IF NOT EXISTS variant      VARCHAR(40),
  ADD COLUMN IF NOT EXISTS consent_json JSONB;

-- ---------- system_config (key/value) — auto_send_intake default ON ----------
CREATE TABLE IF NOT EXISTS system_config (
  key         TEXT PRIMARY KEY,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO system_config (key, value)
  VALUES ('auto_send_intake', 'true'::jsonb)
  ON CONFLICT (key) DO NOTHING;
