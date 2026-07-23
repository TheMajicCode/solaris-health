-- =====================================================================
-- 021 — GPS evidence before payment (Slice 8)
--
-- Every GPS allocation must be explainable from evidence BEFORE any money
-- would ever move. This migration adds:
--
--   gps_allocation_receipts — one receipt per gps_transaction carrying the
--     canonical, PHI-free evidence document, its sha256 hash, the split
--     policy version that produced the allocation, and a lifecycle state
--     (proposed → disputed → corrected). All allocations are SHADOW
--     allocations: `shadow = TRUE` means no real settlement exists or is
--     implied. There is no code path that sets shadow = FALSE.
--
--   gps_allocation_disputes — the human dispute path. Any participant in
--     an allocation can raise a dispute with a reason; an admin resolves
--     it, moving the receipt to `corrected` with a plain-language
--     resolution note.
--
-- Evidence documents contain ONLY structural facts (UUIDs, amounts,
-- fractions, timestamps) — never names, health data, or free text.
-- Additive only; no existing tables are modified.
-- =====================================================================

CREATE TABLE IF NOT EXISTS gps_allocation_receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES gps_transactions(id) ON DELETE CASCADE,
  policy_version  VARCHAR(32) NOT NULL DEFAULT 'gps-split-v1',
  evidence        JSONB NOT NULL,           -- canonical, PHI-free evidence document
  evidence_hash   VARCHAR(64) NOT NULL,     -- sha256 hex of the canonical evidence JSON
  allocation_state VARCHAR(12) NOT NULL DEFAULT 'proposed'
                   CHECK (allocation_state IN ('proposed','disputed','corrected')),
  shadow          BOOLEAN NOT NULL DEFAULT TRUE,  -- always TRUE: no real settlement
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gps_alloc_receipt_tx ON gps_allocation_receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_gps_alloc_receipt_state ON gps_allocation_receipts(allocation_state);

CREATE TABLE IF NOT EXISTS gps_allocation_disputes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id   UUID NOT NULL REFERENCES gps_allocation_receipts(id) ON DELETE CASCADE,
  raised_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  status       VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution   TEXT,
  resolved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gps_alloc_dispute_receipt ON gps_allocation_disputes(receipt_id);
CREATE INDEX IF NOT EXISTS idx_gps_alloc_dispute_raised ON gps_allocation_disputes(raised_by);
