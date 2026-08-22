-- 040_journey_pipeline.sql  — NODE H (additive, FORWARD-ONLY)
--
-- STATUS: COMMITTED, NOT APPLIED to the shared beta database.
-- This is the future additive persistence contract for the Journey Pipeline and
-- the Clinic OS foundation. Both currently run on feature-flagged, clearly
-- labelled "Beta preview · Simulated" fixtures (VITE_CLINIC_OS_BETA) with no
-- shared-DB write, because tenancy/RBAC are incomplete and unattended migrations
-- are not authorized this sprint. Majd applies this deliberately at cutover:
--     cd backend && npm run migrate
--
-- Additive only — new tables + a new enum. Nothing existing is altered, so it is
-- backward compatible with the running beta code.

-- Seven ordered operational stages (mirrors PIPELINE_STAGES in
-- src/components/provider/JourneyPipeline.jsx). Operational, NOT clinical:
-- a stage never implies a diagnosis, suitability, or outcome.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_pipeline_stage') THEN
    CREATE TYPE journey_pipeline_stage AS ENUM (
      'new_inquiry', 'intake_pending', 'discovery_booked', 'active_journey',
      'review_due', 'paused', 'completed'
    );
  END IF;
END$$;

-- One row per practitioner<->member care relationship on the board.
CREATE TABLE IF NOT EXISTS journey_pipeline_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id  UUID NOT NULL REFERENCES users(id),
  member_id        UUID NOT NULL REFERENCES users(id),
  stage            journey_pipeline_stage NOT NULL DEFAULT 'new_inquiry',
  goal_summary     TEXT,                         -- member-chosen, non-clinical
  next_action      TEXT,                         -- the human-approved next step
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (practitioner_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_jpe_practitioner ON journey_pipeline_entries(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_jpe_stage ON journey_pipeline_entries(stage);

-- Every stage change / outreach is practitioner-confirmed and audited. This log
-- captures the confirmed transition (identifiers only — never PHI / free text
-- beyond the non-clinical next_action label).
CREATE TABLE IF NOT EXISTS journey_pipeline_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id       UUID NOT NULL REFERENCES journey_pipeline_entries(id) ON DELETE CASCADE,
  actor_id       UUID NOT NULL REFERENCES users(id),   -- the confirming practitioner
  from_stage     journey_pipeline_stage,
  to_stage       journey_pipeline_stage NOT NULL,
  confirmed      BOOLEAN NOT NULL DEFAULT true,        -- human-in-the-loop required
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jpev_entry ON journey_pipeline_events(entry_id);

-- Clinic OS FOUNDATION — non-sensitive organisation metadata only, linked to an
-- approved practitioner. NO tenants, NO entitlements, NO RBAC here yet; those
-- arrive in a later, separately-reviewed contract. status stays 'pending_review'
-- until an operator approves.
CREATE TABLE IF NOT EXISTS clinic_os_orgs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id    UUID NOT NULL REFERENCES users(id),
  name             VARCHAR(200) NOT NULL,
  org_type         VARCHAR(60),
  city             VARCHAR(120),
  about            TEXT,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending_review',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_clinic_os_orgs_owner ON clinic_os_orgs(owner_user_id);
