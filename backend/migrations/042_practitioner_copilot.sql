-- 042_practitioner_copilot.sql  — Node J FUTURE ADDITIVE CONTRACT
-- COMMITTED, NOT APPLIED during this beta sprint (shared DB is read-only).
--
-- Persistence contract for the practitioner LUCA practice brief and its draft toolkit.
-- All additive. Drafts are stored as practitioner-owned content that is NEVER sent,
-- signed, published, booked, or ordered by the system — a human action does that.
-- No diagnosis/prescription/legal/billing/lab-order content is generated or stored.

-- A generated practice-brief snapshot (non-PHI counts + source labels only).
CREATE TABLE IF NOT EXISTS practitioner_briefs (
  id             BIGSERIAL PRIMARY KEY,
  practitioner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  algo_version   TEXT NOT NULL,             -- e.g. 'luca-copilot-v1-brief'
  items          JSONB NOT NULL DEFAULT '[]', -- [{id, source, label, dest}] — no PHI beyond first name
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Practitioner-owned drafts produced by the copilot toolkit. status stays 'draft'
-- until the practitioner explicitly approves; sending/signing is out of scope here.
CREATE TABLE IF NOT EXISTS practitioner_drafts (
  id             BIGSERIAL PRIMARY KEY,
  practitioner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id        TEXT NOT NULL,             -- intake_reminder | booking_followup | welcome | ...
  body           TEXT NOT NULL,             -- editable text with [placeholders]
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prac_briefs ON practitioner_briefs(practitioner_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prac_drafts ON practitioner_drafts(practitioner_id, created_at DESC);
