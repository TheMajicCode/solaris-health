-- ============================================================
-- SOLARIS HOLISTIC HEALTH — MVP v1 SCHEMA EXTENSION
-- FHIR-aligned, sovereignty-ready. Extends existing LUCA schema.
-- ============================================================

-- --- USERS: add Solaris fields & support patient/practitioner/admin roles ---
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name      VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name       VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country         VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city            VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS language        VARCHAR(40) DEFAULT 'English';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone           VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(40) DEFAULT 'pending'; -- pending | profile | assessment | complete
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_phase   VARCHAR(40) DEFAULT 'onboarding'; -- onboarding | active | care-seeking | maintenance
ALTER TABLE users ADD COLUMN IF NOT EXISTS love_points     INTEGER DEFAULT 0;

-- --- USER PROFILES (health profile) → maps to FHIR Patient ---
CREATE TABLE IF NOT EXISTS user_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth           DATE,
  sex_at_birth            VARCHAR(40),
  gender_identity         VARCHAR(60),
  height_cm               NUMERIC,
  weight_kg               NUMERIC,
  timezone                VARCHAR(80),
  goals_text              TEXT,
  goals_json              JSONB DEFAULT '[]',
  main_concerns_text      TEXT,
  budget_range            VARCHAR(60),
  preferred_contact_method VARCHAR(60),
  wants_practitioner_guidance BOOLEAN DEFAULT true,
  wants_workshops         BOOLEAN DEFAULT true,
  wants_routines          BOOLEAN DEFAULT true,
  care_preference         VARCHAR(40), -- in-person | virtual | hybrid
  travel_willingness      VARCHAR(40),
  consent_privacy         BOOLEAN DEFAULT false,
  consent_ai_guidance     BOOLEAN DEFAULT false,
  consent_marketing       BOOLEAN DEFAULT false,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- --- ASSESSMENT TEMPLATES → maps to FHIR Questionnaire ---
CREATE TABLE IF NOT EXISTS assessment_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(160) NOT NULL,
  version      VARCHAR(40) DEFAULT 'v1',
  status       VARCHAR(40) DEFAULT 'active',
  description  TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- ASSESSMENT QUESTIONS ---
CREATE TABLE IF NOT EXISTS assessment_questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
  section_key       VARCHAR(60),     -- aspects | systems
  system_key        VARCHAR(60),     -- bioelectrical, hydration, circadian, ...
  aspect_key        VARCHAR(60),     -- mental, emotional, physical, spiritual
  question_text     TEXT NOT NULL,
  helper_text       TEXT,
  question_type     VARCHAR(40) DEFAULT 'scale', -- scale | choice | text
  low_label         VARCHAR(60),
  high_label        VARCHAR(60),
  answer_options_json JSONB DEFAULT '[]',
  weight            NUMERIC DEFAULT 1,
  sort_order        INTEGER DEFAULT 0,
  is_required       BOOLEAN DEFAULT true
);

-- --- ASSESSMENT RESPONSES → maps to FHIR QuestionnaireResponse + Observations ---
CREATE TABLE IF NOT EXISTS assessment_responses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id       UUID REFERENCES assessment_templates(id),
  started_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at      TIMESTAMP,
  raw_score         NUMERIC,
  vitality_score    INTEGER,
  mental_score      INTEGER,
  emotional_score   INTEGER,
  physical_score    INTEGER,
  spiritual_score   INTEGER,
  summary_json      JSONB DEFAULT '{}',
  top_focus_areas_json JSONB DEFAULT '[]',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- ANSWERS ---
CREATE TABLE IF NOT EXISTS assessment_answers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id      UUID NOT NULL REFERENCES assessment_responses(id) ON DELETE CASCADE,
  question_id      UUID REFERENCES assessment_questions(id),
  system_key       VARCHAR(60),
  aspect_key       VARCHAR(60),
  answer_number    NUMERIC,
  answer_text      TEXT,
  normalized_score NUMERIC
);

-- --- BODY SYSTEM SCORES (8 systems) → FHIR Observation ---
CREATE TABLE IF NOT EXISTS body_system_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id   UUID NOT NULL REFERENCES assessment_responses(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  system_key    VARCHAR(60),
  system_name   VARCHAR(120),
  score         INTEGER,
  severity_band VARCHAR(40), -- thriving | balanced | attention | priority
  notes         TEXT
);

-- --- 4-ASPECT SCORES → FHIR Observation ---
CREATE TABLE IF NOT EXISTS aspect_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id   UUID NOT NULL REFERENCES assessment_responses(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aspect_key    VARCHAR(60),
  aspect_name   VARCHAR(120),
  score         INTEGER,
  notes         TEXT
);

-- --- LISTINGS (marketplace) → FHIR Practitioner / Organization / Location ---
CREATE TABLE IF NOT EXISTS listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_type      VARCHAR(60),  -- practitioner | clinic | service | workshop | place | diagnostics | kitchen | program
  node_type         VARCHAR(60),  -- practitioner_node | care_node | protocol_node | experience_node | place_node | diagnostics_node | commerce_node
  status            VARCHAR(40) DEFAULT 'published', -- draft | review | published | archived
  visibility        VARCHAR(40) DEFAULT 'public',
  title             VARCHAR(200) NOT NULL,
  slug              VARCHAR(200),
  tagline           VARCHAR(255),
  short_description TEXT,
  full_description  TEXT,
  specialty         VARCHAR(160),
  cover_image_url   TEXT,
  gallery_json      JSONB DEFAULT '[]',
  city              VARCHAR(120),
  region            VARCHAR(120),
  country           VARCHAR(120),
  languages_json    JSONB DEFAULT '[]',
  rating            NUMERIC DEFAULT 0,
  reviews_count     INTEGER DEFAULT 0,
  price             NUMERIC,
  currency          VARCHAR(10) DEFAULT 'USD',
  duration_minutes  INTEGER,
  focus_areas_json  JSONB DEFAULT '[]',
  supports_systems_json JSONB DEFAULT '[]', -- body systems supported (for recommendations)
  supports_aspects_json JSONB DEFAULT '[]',
  trust_score       INTEGER DEFAULT 0,
  verification_status VARCHAR(40) DEFAULT 'verified',
  featured          BOOLEAN DEFAULT false,
  booking_enabled   BOOLEAN DEFAULT true,
  payment_enabled   BOOLEAN DEFAULT false,
  owner_user_id     UUID REFERENCES users(id), -- linked practitioner account (if any)
  created_by_admin  BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- BOOKING REQUESTS → FHIR Appointment ---
CREATE TABLE IF NOT EXISTS booking_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id      UUID REFERENCES listings(id),
  status          VARCHAR(40) DEFAULT 'requested', -- requested | confirmed | completed | cancelled
  preferred_date  DATE,
  preferred_time  VARCHAR(40),
  note            TEXT,
  admin_notes     TEXT,
  quoted_price    NUMERIC,
  payment_status  VARCHAR(40) DEFAULT 'none',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- DAILY CHECK-INS ---
CREATE TABLE IF NOT EXISTS daily_checkins (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date     DATE DEFAULT CURRENT_DATE,
  energy_score     INTEGER,
  mood_score       INTEGER,
  sleep_hours      NUMERIC,
  hydration_glasses INTEGER,
  movement_minutes INTEGER,
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- REWARD EVENTS (LOVE points ledger) ---
CREATE TABLE IF NOT EXISTS reward_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   VARCHAR(80),
  points       INTEGER DEFAULT 0,
  category     VARCHAR(60),
  note         TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- DOCUMENTS / UPLOADS (labs, photos) → FHIR DocumentReference ---
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_id   UUID REFERENCES assessment_responses(id),
  document_type VARCHAR(60), -- lab | photo | note | imaging
  file_name     VARCHAR(255),
  file_data     TEXT,        -- base64/data-url for MVP (cloud storage later)
  mime_type     VARCHAR(120),
  description   TEXT,
  visibility    VARCHAR(40) DEFAULT 'private',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- HABIT PLANS ---
CREATE TABLE IF NOT EXISTS habit_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                 VARCHAR(200),
  status                VARCHAR(40) DEFAULT 'active',
  plan_json             JSONB DEFAULT '[]',
  created_from_response UUID REFERENCES assessment_responses(id),
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- RECOMMENDATIONS ---
CREATE TABLE IF NOT EXISTS recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_id         UUID REFERENCES assessment_responses(id),
  source_type         VARCHAR(40) DEFAULT 'rules',
  recommendation_type VARCHAR(40), -- habit | service | practitioner | workshop | content
  title               VARCHAR(200),
  description         TEXT,
  priority            INTEGER DEFAULT 0,
  linked_listing_id   UUID REFERENCES listings(id),
  status              VARCHAR(40) DEFAULT 'active',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- PRACTITIONER PROFILES (for practitioner login accounts) ---
CREATE TABLE IF NOT EXISTS practitioner_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id          UUID REFERENCES listings(id),
  specialty           VARCHAR(160),
  credentials_text    TEXT,
  years_experience    INTEGER,
  bio                 TEXT,
  treatment_philosophy TEXT,
  onboarding_status   VARCHAR(40) DEFAULT 'pending', -- pending | submitted | approved
  verification_status VARCHAR(40) DEFAULT 'pending',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- --- LUCA CHAT MESSAGES ---
CREATE TABLE IF NOT EXISTS luca_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20), -- user | assistant
  content     TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- INDEXES ---
CREATE INDEX IF NOT EXISTS idx_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_user ON assessment_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_bss_user ON body_system_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_aspect_user ON aspect_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON booking_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON daily_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_user ON reward_events(user_id);
CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_luca_user ON luca_messages(user_id);



-- ============================================================
-- Phase 2B: member journeys (guided wellness programs)
-- ============================================================
CREATE TABLE IF NOT EXISTS member_journeys (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_type VARCHAR(50) NOT NULL CHECK (journey_type IN ('detox','heavy_metal','menopause','optimal_health','smile','thyroid','sugar','nurture_mama','your_path')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','complete')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  milestones_json JSONB DEFAULT '[]',
  notes TEXT,
  UNIQUE(user_id, journey_type)
);
CREATE INDEX IF NOT EXISTS idx_member_journeys_user ON member_journeys(user_id);
