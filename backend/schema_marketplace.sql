-- ============================================================
-- LUCA PASSPORT — Phase 7: Explore Marketplace & Provider Network
-- Health & wellness provider directory with geo search, ratings,
-- services, credentials and photo galleries.
-- Idempotent: safe to run on a fresh or existing database.
-- ============================================================

-- ---------- provider_profiles ----------
CREATE TABLE IF NOT EXISTS provider_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  provider_type   VARCHAR(40)  NOT NULL,          -- clinic|wellness|farm|workshop|doctor|dentist|nutritionist|therapist|gym|spa
  business_name   VARCHAR(200) NOT NULL,
  description     TEXT,
  address         VARCHAR(300),
  city            VARCHAR(120),
  country         VARCHAR(120) DEFAULT 'El Salvador',
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  phone           VARCHAR(60),
  website         VARCHAR(300),
  email           VARCHAR(200),
  profile_photo_url VARCHAR(500),
  cover_photo_url   VARCHAR(500),
  hours_of_operation JSONB DEFAULT '{}'::jsonb,    -- { mon:{open,close}, ... , closed:[..] }
  specialties     JSONB DEFAULT '[]'::jsonb,       -- free-form tags
  price_range     VARCHAR(8),                      -- $ | $$ | $$$ | $$$$
  rating          NUMERIC(2,1) DEFAULT 0,          -- denormalized average (0–5)
  review_count    INTEGER DEFAULT 0,
  verified        BOOLEAN DEFAULT FALSE,
  vtv_certified   BOOLEAN DEFAULT FALSE,           -- Verified True Value certification
  featured        BOOLEAN DEFAULT FALSE,
  status          VARCHAR(20) DEFAULT 'active',     -- active|pending|suspended
  claimed         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

-- ---------- provider_services ----------
CREATE TABLE IF NOT EXISTS provider_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_name    VARCHAR(200) NOT NULL,
  description     TEXT,
  price           NUMERIC(10,2),
  currency        VARCHAR(8) DEFAULT 'USD',
  duration_minutes INTEGER,
  category        VARCHAR(80),
  created_at      TIMESTAMP DEFAULT now()
);

-- ---------- provider_credentials ----------
CREATE TABLE IF NOT EXISTS provider_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  credential_type VARCHAR(40) NOT NULL,            -- vtv_badge|license|certification|award
  credential_name VARCHAR(200) NOT NULL,
  issued_by       VARCHAR(200),
  issued_date     DATE,
  expiry_date     DATE,
  badge_image_url VARCHAR(500),
  created_at      TIMESTAMP DEFAULT now()
);

-- ---------- provider_ratings ----------
CREATE TABLE IF NOT EXISTS provider_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name     VARCHAR(160),                    -- snapshot for display / seed data
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text     TEXT,
  created_at      TIMESTAMP DEFAULT now(),
  UNIQUE (provider_id, user_id)
);

-- ---------- provider_photos ----------
CREATE TABLE IF NOT EXISTS provider_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  photo_url       VARCHAR(500) NOT NULL,
  caption         VARCHAR(300),
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now()
);

-- ---------- indexes ----------
CREATE INDEX IF NOT EXISTS idx_provider_type      ON provider_profiles (provider_type);
CREATE INDEX IF NOT EXISTS idx_provider_geo        ON provider_profiles (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_provider_city       ON provider_profiles (city);
CREATE INDEX IF NOT EXISTS idx_provider_rating     ON provider_profiles (rating);
CREATE INDEX IF NOT EXISTS idx_provider_user       ON provider_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_provider_status     ON provider_profiles (status);
CREATE INDEX IF NOT EXISTS idx_pservices_provider  ON provider_services (provider_id);
CREATE INDEX IF NOT EXISTS idx_pcred_provider      ON provider_credentials (provider_id);
CREATE INDEX IF NOT EXISTS idx_pratings_provider   ON provider_ratings (provider_id);
CREATE INDEX IF NOT EXISTS idx_pphotos_provider    ON provider_photos (provider_id);
