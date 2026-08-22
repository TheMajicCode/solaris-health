-- 041_luca_recommendations.sql  — Node I FUTURE ADDITIVE CONTRACT
-- COMMITTED, NOT APPLIED during this beta sprint (shared DB is read-only).
--
-- Persistence contract for LUCA member multi-candidate recommendations and
-- member-approved personalized Journey drafts. All additive; no existing column
-- is dropped or renamed. Provenance columns are NON-PHI only (algorithm version,
-- candidate provider ids, member action). LUCA never stores diagnosis/suitability/outcome.

-- Up to MAX_CANDIDATES diversified approved candidates surfaced per generation.
CREATE TABLE IF NOT EXISTS luca_recommendation_sets (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  algo_version   TEXT NOT NULL,              -- e.g. 'luca-recs-v2-diversified'
  candidate_ids  TEXT[] NOT NULL DEFAULT '{}', -- provider ids only (non-PHI)
  reason         TEXT,                        -- recompute trigger: booking|dismissal|prefs|expiry
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ
);

-- Per-candidate member action within a set (view/save/dismiss/book). Human-in-the-loop.
CREATE TABLE IF NOT EXISTS luca_recommendation_actions (
  id           BIGSERIAL PRIMARY KEY,
  set_id       BIGINT NOT NULL REFERENCES luca_recommendation_sets(id) ON DELETE CASCADE,
  provider_id  TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('view','save','dismiss','book')),
  acted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Member-approved personalized Journey drafts (assembled from clinician-reviewed blocks).
CREATE TABLE IF NOT EXISTS luca_journey_drafts (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cadence       TEXT NOT NULL CHECK (cadence IN ('weekly','monthly')),
  reviewed_by   TEXT NOT NULL,               -- clinical review attribution
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','enrolled')),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_luca_rec_sets_user ON luca_recommendation_sets(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_luca_journey_drafts_user ON luca_journey_drafts(user_id, created_at DESC);
