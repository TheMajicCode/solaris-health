-- ============================================================
-- SOLARIS OVERNIGHT SPRINT — Additive schema migration
-- Identity-first sovereign passport: communities, organizations,
-- personas, wallets, data-driven split policies + receipts,
-- simulated payments, treatment plans, health records,
-- contribution events, per-role LUCA guidance, vault exports,
-- and clinic appointments.
--
-- Fully additive & idempotent (CREATE ... IF NOT EXISTS / ADD COLUMN
-- IF NOT EXISTS). Safe to run repeatedly. No drops.
-- ============================================================

-- ---------- Users extensions (identity + sovereignty) ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS nostr_nsec_encrypted_mock TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS key_custody TEXT DEFAULT 'app_managed';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarder_user_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_community_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_via TEXT DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ---------- Communities ----------
CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region TEXT,
  treasury_wallet_mock TEXT,
  treasury_balance_sats BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Organizations (map pins + clinic nodes) ----------
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'clinic',            -- clinic|farm|vendor
  steward_user_id UUID,
  did TEXT,
  npub_mock TEXT,
  community_id UUID REFERENCES communities(id),
  health_dial INTEGER DEFAULT 50,
  wealth_dial INTEGER DEFAULT 30,
  sovereignty_dial INTEGER DEFAULT 20,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  visibility TEXT DEFAULT 'discoverable', -- hidden|discoverable|public
  description TEXT,
  services TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Personas ----------
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  label TEXT DEFAULT 'Main',             -- Main|Anonymous|Merchant
  npub_mock TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Wallets ----------
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,              -- user|org|community
  owner_id UUID NOT NULL,
  balance_sats_simulated BIGINT DEFAULT 0,
  lightning_address_mock TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Split policies (data-driven) ----------
CREATE TABLE IF NOT EXISTS split_policies_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  recipients JSONB NOT NULL,             -- [{role, recipient_ref, share_bps, immutable, location_routing?}]
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Split receipts ----------
CREATE TABLE IF NOT EXISTS split_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID,
  policy_id UUID REFERENCES split_policies_v2(id),
  payer_user_id UUID REFERENCES users(id),
  org_id UUID REFERENCES organizations(id),
  amount_sats BIGINT NOT NULL,
  legs JSONB NOT NULL,                   -- [{role, recipient_ref, share_bps, amount_sats, proof_mock}]
  receipt_hash_mock TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Payments (simulated) ----------
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_user_id UUID REFERENCES users(id),
  org_id UUID REFERENCES organizations(id),
  amount_sats BIGINT NOT NULL,
  status TEXT DEFAULT 'simulated_settled',
  invoice_mock TEXT,
  description TEXT,
  split_receipt_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Treatment plans ----------
CREATE TABLE IF NOT EXISTS treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  patient_id UUID REFERENCES users(id),
  practitioner_id UUID REFERENCES users(id),
  title TEXT,
  items JSONB,
  total_sats BIGINT DEFAULT 1500000,
  status TEXT DEFAULT 'pending',         -- pending|approved|paid|completed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Health records (mock content only) ----------
CREATE TABLE IF NOT EXISTS health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  kind TEXT,                             -- assessment|note|lab|plan
  title TEXT,
  body_md TEXT,
  private BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Contribution events (extended, signed) ----------
CREATE TABLE IF NOT EXISTS contribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_user_id UUID REFERENCES users(id),
  kind TEXT NOT NULL,                    -- referral|hosting|maintenance|education|care_milestone|coordination
  subject_ref TEXT,
  evidence JSONB,
  points INTEGER DEFAULT 10,
  signature_mock TEXT,
  status TEXT DEFAULT 'attested',        -- attested|pending
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- LUCA guidance (per-role config) ----------
CREATE TABLE IF NOT EXISTS luca_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT UNIQUE NOT NULL,
  job TEXT,
  first_message_template TEXT,
  top_actions JSONB,                     -- [string]
  tone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Vault exports log ----------
CREATE TABLE IF NOT EXISTS vault_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);

-- ---------- Appointments (clinic node) ----------
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  patient_id UUID REFERENCES users(id),
  practitioner_id UUID REFERENCES users(id),
  title TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'confirmed',       -- confirmed|pending|cancelled|completed
  notes TEXT,
  follow_up_status TEXT DEFAULT 'none',  -- none|draft|approved|sent
  follow_up_draft TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Helpful indexes ----------
CREATE INDEX IF NOT EXISTS idx_organizations_community ON organizations(community_id);
CREATE INDEX IF NOT EXISTS idx_organizations_visibility ON organizations(visibility);
CREATE INDEX IF NOT EXISTS idx_wallets_owner ON wallets(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_split_policies_org ON split_policies_v2(owner_org_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_split_receipts_payer ON split_receipts(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_health_records_user ON health_records(user_id);
CREATE INDEX IF NOT EXISTS idx_contribution_events_user ON contribution_events(contributor_user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(org_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
