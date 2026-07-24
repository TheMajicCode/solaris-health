-- =====================================================================
-- 022 — widen gps_allocation_receipts.policy_version for protocol-style
-- policy ids (GPS Protocol Suite v1.0), e.g.
-- 'gps:policy:solaris:aura-consultation:v0.1' (42 chars > VARCHAR(32)).
--
-- Additive & backward compatible: existing rows keep their original
-- 'gps-split-v1' value (receipts are append-only — historical receipts
-- always reference the policy version they were created with).
-- =====================================================================

ALTER TABLE gps_allocation_receipts
  ALTER COLUMN policy_version TYPE VARCHAR(80);

ALTER TABLE gps_allocation_receipts
  ALTER COLUMN policy_version SET DEFAULT 'gps:policy:solaris:aura-consultation:v0.1';
