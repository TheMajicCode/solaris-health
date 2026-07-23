-- 019_ai_execution_receipts.sql
-- AI execution receipts V0 (additive).
--
-- One row per AI execution performed on a member's behalf. Receipts prove
-- WHICH provider/model touched WHAT CLASS of data, under WHAT consent basis,
-- with WHAT outcome — without ever storing raw prompts, replies, or PHI.
-- input_hash / result_hash are non-reversible SHA-256 digests only.

CREATE TABLE IF NOT EXISTS ai_execution_receipts (
  id               SERIAL PRIMARY KEY,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type       VARCHAR(60)  NOT NULL,                          -- e.g. 'luca.member.chat'
  agent_id         VARCHAR(60)  NOT NULL DEFAULT 'sol_agent_luca',
  provider         VARCHAR(40)  NOT NULL,                          -- abacus | cloud | anthropic | local | mock
  requested_model  VARCHAR(100),
  actual_model     VARCHAR(100),
  compute_target   VARCHAR(30)  NOT NULL DEFAULT 'managed_cloud',  -- managed_cloud | local
  data_class       VARCHAR(30)  NOT NULL DEFAULT 'health_context', -- health_context | practice_context | nonclinical
  consent_basis    VARCHAR(60)  NOT NULL DEFAULT 'member_self_query',
  latency_ms       INTEGER,
  input_hash       VARCHAR(64),                                    -- sha256, never raw text
  result_hash      VARCHAR(64),                                    -- sha256, never raw text
  degraded         BOOLEAN      NOT NULL DEFAULT false,
  error_class      VARCHAR(60),                                    -- null on success
  policy_version   VARCHAR(20)  NOT NULL DEFAULT 'v0',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_receipts_user_created
  ON ai_execution_receipts (user_id, created_at DESC);
