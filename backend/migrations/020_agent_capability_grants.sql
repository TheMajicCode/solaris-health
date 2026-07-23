-- 020: Agent capability grants (Slice 7 — agent authority scaffold).
--
-- Additive only. The `agents` table already gives us agent identity, owner
-- relationship (owner_id FK) and an `active` kill-switch. What was missing is
-- a first-class, revocable, expirable capability grant with a human-approval
-- flag — so LUCA's authority is scoped and auditable instead of implicit.
-- Grant *use* is audited into the existing `audit_logs` table
-- (action = 'agent.grant.used'), no new audit table needed.

CREATE TABLE IF NOT EXISTS agent_capability_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Capability identifier, e.g. 'luca.chat', 'passport.read.summary'
  capability VARCHAR(120) NOT NULL,
  -- Optional narrowing of the capability (sections, limits, ...)
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Sensitive actions must be re-approved by the human owner each time.
  requires_human_approval BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | revoked
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,          -- NULL = does not expire
  revoked_at TIMESTAMP,
  UNIQUE (agent_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_agent_grants_owner ON agent_capability_grants(owner_id);
CREATE INDEX IF NOT EXISTS idx_agent_grants_agent ON agent_capability_grants(agent_id, status);
