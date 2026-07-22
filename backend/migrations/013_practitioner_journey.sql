-- Phase 2A: Full Practitioner Journey
-- 1. Distinguish member vs practitioner LUCA conversations
ALTER TABLE luca_messages ADD COLUMN IF NOT EXISTS context_type VARCHAR(20) DEFAULT 'member';

-- 2. Consent-gated Passport sharing between members and practitioners
CREATE TABLE IF NOT EXISTS passport_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_sections JSONB DEFAULT '["assessment","checkins"]'::jsonb,
  status VARCHAR(20) DEFAULT 'pending',       -- pending | granted | revoked
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(member_id, practitioner_id)
);
