-- =====================================================================
-- 031 — GPS shadow receipts (Track B, M7; spec A4 §3). Additive only.
--
-- The allocation-and-receipt layer ABOVE payment protocols — not a payment
-- rail. It moves ZERO money: it computes, records and displays what *would*
-- be allocated, with a signed-shaped `gps-receipt/1.0` receipt (A4 §3.4).
-- This lets the whole GPS story be demonstrated to members, partners and
-- investors before any custody / accounting question is answered.
--
--   gps_shadow_receipts — one row per paid intent. Stores the canonical
--                         receipt JSON plus queryable columns. subject_id
--                         (sol_<32hex>) anchors it to the permanent Solaris
--                         identity; level 'L3-financial'; consent_scope
--                         'payments' per the cross-cutting invariant.
--
-- settlement_state records the A4 §3.5 enum even though nothing settles
-- (SCHEDULED = envelope held until service completion above a threshold).
-- Additive: no existing table is modified.
-- =====================================================================

CREATE TABLE IF NOT EXISTS gps_shadow_receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id      TEXT UNIQUE NOT NULL,          -- stable id inside the receipt JSON
  receipt_version TEXT NOT NULL DEFAULT 'gps-receipt/1.0',
  intent_id       UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  subject_id      VARCHAR(40) NOT NULL REFERENCES solaris_subjects(subject_id),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  policy_id       TEXT NOT NULL,
  policy_hash     TEXT NOT NULL,
  eligible_cents  BIGINT NOT NULL,
  earned_cents    BIGINT NOT NULL,
  envelope_cents  BIGINT NOT NULL,
  envelope_bps    INTEGER NOT NULL,
  settlement_state TEXT NOT NULL DEFAULT 'PREPARED'
    CHECK (settlement_state IN (
      'PREPARED','PRIMARY_PENDING','PRIMARY_RECEIVED','OUTPUT_SENDING','SETTLED',
      'PENDING_RETRY','SCHEDULED','FALLBACK_REQUIRED','REFUND_PENDING','REFUNDED',
      'DISPUTED','CLOSED')),
  receipt         JSONB NOT NULL,                -- the full gps-receipt/1.0 document
  level           TEXT NOT NULL DEFAULT 'L3-financial',
  source          TEXT NOT NULL DEFAULT 'gps:policy:aura-consultation:v0.1',
  consent_scope   TEXT NOT NULL DEFAULT 'payments',
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_shadow_receipts_intent  ON gps_shadow_receipts(intent_id);
CREATE INDEX IF NOT EXISTS idx_gps_shadow_receipts_subject ON gps_shadow_receipts(subject_id);
CREATE INDEX IF NOT EXISTS idx_gps_shadow_receipts_user    ON gps_shadow_receipts(user_id);
