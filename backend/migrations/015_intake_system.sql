-- ============================================================
-- SOLARIS HEALTH — New-Patient Intake System
-- Dynamic, multi-template intake forms sent to patients on their
-- first confirmed booking with a practitioner, plus a lightweight
-- patient inbox for system messages (booking confirmations, intake
-- requests). FK types match the real schema: users.id is UUID.
-- Idempotent: safe to run on a fresh or existing database.
-- ============================================================

-- ---------- intake_form_templates (reusable form definitions) ----------
CREATE TABLE IF NOT EXISTS intake_form_templates (
  id            SERIAL PRIMARY KEY,
  clinic_type   VARCHAR(50)  NOT NULL DEFAULT 'general',
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  fields_json   JSONB        NOT NULL DEFAULT '[]',
  is_active     BOOLEAN      DEFAULT TRUE,
  is_system     BOOLEAN      DEFAULT FALSE,
  created_at    TIMESTAMPTZ  DEFAULT now()
);
-- One canonical system template per clinic type (enables idempotent seeding).
CREATE UNIQUE INDEX IF NOT EXISTS uq_intake_template_system_clinic
  ON intake_form_templates (clinic_type) WHERE is_system = TRUE;

-- ---------- patient_intake_submissions (a patient's answers / pending request) ----------
CREATE TABLE IF NOT EXISTS patient_intake_submissions (
  id             SERIAL PRIMARY KEY,
  patient_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  template_id    INTEGER REFERENCES intake_form_templates(id),
  booking_id     UUID,
  responses_json JSONB NOT NULL DEFAULT '{}',
  status         VARCHAR(20) DEFAULT 'pending', -- pending | submitted | reviewed
  submitted_at   TIMESTAMPTZ,
  reviewed_at    TIMESTAMPTZ,
  review_notes   TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intake_sub_patient  ON patient_intake_submissions (patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_sub_provider ON patient_intake_submissions (provider_id);

-- ---------- provider_intake_settings (per-practitioner preferences) ----------
CREATE TABLE IF NOT EXISTS provider_intake_settings (
  id                            SERIAL PRIMARY KEY,
  provider_id                   UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  send_intake_on_first_booking  BOOLEAN DEFAULT TRUE,
  preferred_template_id         INTEGER REFERENCES intake_form_templates(id),
  custom_message                TEXT,
  created_at                    TIMESTAMPTZ DEFAULT now(),
  updated_at                    TIMESTAMPTZ DEFAULT now()
);

-- ---------- patient_messages (lightweight system inbox) ----------
CREATE TABLE IF NOT EXISTS patient_messages (
  id                 SERIAL PRIMARY KEY,
  recipient_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name        VARCHAR(200) DEFAULT 'Solaris Health',
  subject            VARCHAR(500),
  body               TEXT NOT NULL,
  message_type       VARCHAR(50) DEFAULT 'system', -- system | booking_confirmation | intake_request
  related_booking_id UUID,
  related_intake_id  INTEGER REFERENCES patient_intake_submissions(id) ON DELETE SET NULL,
  is_read            BOOLEAN DEFAULT FALSE,
  action_url         TEXT,
  action_label       VARCHAR(100),
  created_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_msg_recipient ON patient_messages (recipient_id, is_read);
