-- Optional. Records which model produced each assistant reply (provenance).
-- The luca.js route works WITHOUT this (it falls back), but adding it gives you
-- a real audit of which engine answered — the same instinct as Strategy A's event log.
ALTER TABLE luca_messages ADD COLUMN IF NOT EXISTS model VARCHAR(120);
