-- =====================================================================
-- GPS — Generative Prosperity System
-- The economic coordination layer of Solaris Health.
--
-- Every completed transaction is split transparently across the people
-- and commons that made it possible:
--   85% → Service Provider   (sovereign income)
--    5% → Contributor/Referral (ecosystem builder — or platform if none)
--    3% → Local Infrastructure (node operators)
--    3% → Regenerative Treasury (community commons)
--    2% → Software/Platform maintenance
--    2% → User Rewards/Education (patient earns LOVE points)
--
-- "Value flows to where value was created."
-- =====================================================================

-- ---------------------------------------------------------------------
-- gps_transactions — one row per processed booking, the canonical ledger
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gps_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID REFERENCES bookings(id) ON DELETE SET NULL,
  total_amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency              VARCHAR(8) NOT NULL DEFAULT 'USD',

  provider_share        DECIMAL(12,2) NOT NULL DEFAULT 0,   -- 85%
  contributor_share     DECIMAL(12,2) NOT NULL DEFAULT 0,   -- 5%
  infrastructure_share  DECIMAL(12,2) NOT NULL DEFAULT 0,   -- 3%
  treasury_share        DECIMAL(12,2) NOT NULL DEFAULT 0,   -- 3%
  software_share        DECIMAL(12,2) NOT NULL DEFAULT 0,   -- 2%
  user_reward_share     DECIMAL(12,2) NOT NULL DEFAULT 0,   -- 2%

  provider_id           UUID REFERENCES provider_profiles(id) ON DELETE SET NULL,
  contributor_id        UUID REFERENCES users(id) ON DELETE SET NULL,  -- who referred (nullable)
  patient_id            UUID REFERENCES users(id) ON DELETE SET NULL,

  status                VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending | processing | settled
  split_template        VARCHAR(16) NOT NULL DEFAULT 'default',  -- default | custom
  notes                 TEXT,
  created_at            TIMESTAMP NOT NULL DEFAULT now(),
  settled_at            TIMESTAMP
);
-- One GPS transaction per booking (idempotent processing).
CREATE UNIQUE INDEX IF NOT EXISTS uq_gps_tx_booking ON gps_transactions(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gps_tx_patient  ON gps_transactions(patient_id);
CREATE INDEX IF NOT EXISTS idx_gps_tx_provider ON gps_transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_gps_tx_contrib  ON gps_transactions(contributor_id);
CREATE INDEX IF NOT EXISTS idx_gps_tx_created  ON gps_transactions(created_at);

-- ---------------------------------------------------------------------
-- gps_contributors — running tally of what each contributor has earned
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gps_contributors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_type VARCHAR(24) NOT NULL DEFAULT 'referral', -- referral|content|coordination|hosting|software
  total_earned      DECIMAL(12,2) NOT NULL DEFAULT 0,
  pending_earnings  DECIMAL(12,2) NOT NULL DEFAULT 0,
  settled_earnings  DECIMAL(12,2) NOT NULL DEFAULT 0,
  referral_count    INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT now(),
  updated_at        TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gps_contrib_user_type ON gps_contributors(user_id, contribution_type);

-- ---------------------------------------------------------------------
-- gps_treasury — every deposit into the regenerative commons
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gps_treasury (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES gps_transactions(id) ON DELETE SET NULL,
  amount         DECIMAL(12,2) NOT NULL DEFAULT 0,
  fund_type      VARCHAR(24) NOT NULL DEFAULT 'health', -- health|food|education|infrastructure|emergency|opensource
  description    TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gps_treasury_fund    ON gps_treasury(fund_type);
CREATE INDEX IF NOT EXISTS idx_gps_treasury_created ON gps_treasury(created_at);

-- ---------------------------------------------------------------------
-- gps_referrals — referrer → referred links and their reward status
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gps_referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id       UUID REFERENCES bookings(id) ON DELETE SET NULL,
  reward_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  status           VARCHAR(12) NOT NULL DEFAULT 'pending', -- pending | paid
  created_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gps_ref_referrer ON gps_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_gps_ref_referred ON gps_referrals(referred_user_id);

-- ---------------------------------------------------------------------
-- users — referral code + who referred them
-- ---------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
