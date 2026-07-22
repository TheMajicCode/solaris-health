-- 017_luca_ai_audit.sql
-- AI safety audit trail (Gate 7). Records which model produced each assistant
-- reply and a non-reversible hash of the inputs (system prompt prefix + user
-- message) so AI provenance is auditable without storing raw prompt text.

ALTER TABLE luca_messages
  ADD COLUMN IF NOT EXISTS model_id    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS inputs_hash VARCHAR(64);
