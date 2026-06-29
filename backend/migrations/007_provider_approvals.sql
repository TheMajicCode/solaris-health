-- ============================================================
-- LUCA PASSPORT — Provider Approval System & Unified Account Toggle
-- Adds provider applications, document verification, legal agreements,
-- and patient/provider mode switching.
-- Idempotent: safe to run on a fresh or existing database.
-- ============================================================

-- ---------- users: provider mode flags ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_provider          BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_mode        BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_approved_at TIMESTAMP;

-- ---------- provider_profiles: approval linkage + visibility ----------
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS application_id  UUID;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending'; -- pending|approved|rejected
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS hidden         BOOLEAN DEFAULT TRUE;

-- Existing (seeded / pre-approval) providers stay public and approved.
UPDATE provider_profiles SET hidden = FALSE, approval_status = 'approved'
  WHERE approval_status IS NULL OR approval_status = 'pending';

-- ---------- provider_applications ----------
CREATE TABLE IF NOT EXISTS provider_applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type    VARCHAR(40)  NOT NULL,
  business_name    VARCHAR(200) NOT NULL,
  status           VARCHAR(20)  DEFAULT 'pending',   -- pending|approved|rejected
  application_data JSONB        DEFAULT '{}'::jsonb,  -- full form payload
  admin_notes      TEXT,                              -- private, admin-only
  rejection_reason TEXT,
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMP,
  submitted_at     TIMESTAMP DEFAULT now(),
  created_at       TIMESTAMP DEFAULT now(),
  updated_at       TIMESTAMP DEFAULT now()
);

-- Profile -> application FK (added after the table exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'provider_profiles_application_id_fkey'
  ) THEN
    ALTER TABLE provider_profiles
      ADD CONSTRAINT provider_profiles_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES provider_applications(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------- provider_documents ----------
CREATE TABLE IF NOT EXISTS provider_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES provider_applications(id) ON DELETE CASCADE,
  document_type  VARCHAR(40) NOT NULL,  -- degree|cssp_number|issp_license|national_id|business_registration|insurance|other
  document_name  VARCHAR(255),
  document_data  TEXT,                  -- base64 data URL (or file path)
  mime_type      VARCHAR(120),
  field_value    VARCHAR(255),          -- e.g. CSSP number, license number
  expiry_date    DATE,                  -- e.g. ISSP license expiry
  verified       BOOLEAN DEFAULT FALSE, -- admin marked as verified
  uploaded_at    TIMESTAMP DEFAULT now()
);

-- ---------- provider_agreements ----------
CREATE TABLE IF NOT EXISTS provider_agreements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES provider_applications(id) ON DELETE CASCADE,
  agreement_type VARCHAR(40) NOT NULL,  -- terms|commission|liability_waiver
  agreed         BOOLEAN DEFAULT FALSE,
  ip_address     VARCHAR(60),
  agreed_at      TIMESTAMP DEFAULT now()
);

-- ---------- email_notifications (audit trail for sent mails) ----------
CREATE TABLE IF NOT EXISTS email_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  to_email    VARCHAR(255),
  template    VARCHAR(80),
  subject     VARCHAR(255),
  body        TEXT,
  status      VARCHAR(20) DEFAULT 'logged', -- logged|sent|failed
  created_at  TIMESTAMP DEFAULT now()
);

-- ---------- indexes ----------
CREATE INDEX IF NOT EXISTS idx_provider_applications_user   ON provider_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_applications_status ON provider_applications(status);
CREATE INDEX IF NOT EXISTS idx_provider_documents_app       ON provider_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_provider_agreements_app      ON provider_agreements(application_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_hidden     ON provider_profiles(hidden);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_approval   ON provider_profiles(approval_status);
