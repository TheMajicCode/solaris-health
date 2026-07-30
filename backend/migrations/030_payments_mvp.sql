-- =====================================================================
-- 030 — Payments MVP (Track B, M6; spec A4 §2). Additive only.
--
-- Wompi sandbox is the only live payment rail. Aura is the merchant of
-- record; Solaris never holds funds. These tables own the *information*
-- (intent, webhook events, allocation ledger) — not the money.
--
--   payment_intents  — one row per booking payment attempt. Idempotent via
--                      idempotency_key. subject_id (sol_<32hex>) anchors it
--                      to the permanent Solaris identity. level 'L3-financial',
--                      consent_scope carried per cross-cutting invariant.
--   payment_events   — append-only log of every webhook / state change with
--                      provider_signature_valid (never mutate history).
--   allocations      — the internal ledger. NO money moves from this table:
--                      settlement_status defaults to 'SIMULATED'. Four buckets
--                      (obligation | earned_value | gps_envelope | voluntary).
--
-- All amounts are simulated for the ecosystem envelope; only the gross
-- charge is a real Wompi sandbox transaction. Additive: no existing table
-- is modified.
-- =====================================================================

CREATE TABLE IF NOT EXISTS payment_intents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       VARCHAR(40) NOT NULL
                     REFERENCES solaris_subjects(subject_id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  appointment_id   UUID REFERENCES appointments(id) ON DELETE SET NULL,
  provider_id      UUID,                       -- practitioner (users.id), informational
  merchant_id      VARCHAR(80) NOT NULL DEFAULT 'aura-clinic',  -- merchant of record
  merchant_label   TEXT NOT NULL DEFAULT 'Aura clinic',
  amount_cents     BIGINT NOT NULL CHECK (amount_cents > 0),
  currency         TEXT NOT NULL DEFAULT 'USD',
  purpose          TEXT NOT NULL DEFAULT 'consultation'
                     CHECK (purpose IN ('consultation','deposit','treatment','membership')),
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'created'
                     CHECK (status IN ('created','pending','paid','failed','expired','refunded','disputed')),
  provider         TEXT NOT NULL DEFAULT 'wompi',
  provider_ref     TEXT,
  checkout_url     TEXT,
  provider_fee_cents BIGINT,
  idempotency_key  TEXT UNIQUE NOT NULL,
  -- cross-cutting provenance invariants
  level            VARCHAR(16) NOT NULL DEFAULT 'L3-financial',
  source           TEXT NOT NULL DEFAULT 'wompi-sandbox',
  consent_scope    TEXT NOT NULL DEFAULT 'payments',
  observed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_subject ON payment_intents(subject_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status  ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_ref     ON payment_intents(provider_ref);

CREATE TABLE IF NOT EXISTS payment_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id                UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  kind                     TEXT NOT NULL,     -- e.g. 'TRANSACTION.UPDATED', 'checkout.created'
  payload                  JSONB NOT NULL,
  provider_signature_valid BOOLEAN,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_intent ON payment_events(intent_id);

CREATE TABLE IF NOT EXISTS allocations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id            UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  subject_id           VARCHAR(40) NOT NULL
                         REFERENCES solaris_subjects(subject_id) ON DELETE CASCADE,
  recipient_subject_id VARCHAR(40),           -- when the recipient is a Solaris subject
  recipient_label      TEXT NOT NULL,         -- 'Aura clinic' | 'Solaris coordination' | ...
  bucket               TEXT NOT NULL
                         CHECK (bucket IN ('obligation','earned_value','gps_envelope','voluntary')),
  canonical_domain_id  TEXT,                  -- one of the ten GPS domains (when gps_envelope)
  share_bps            INT NOT NULL,          -- basis points of eligible value
  amount_cents         BIGINT NOT NULL,
  settlement_status    TEXT NOT NULL DEFAULT 'SIMULATED',
  -- provenance invariants
  level                VARCHAR(16) NOT NULL DEFAULT 'L3-financial',
  source               TEXT NOT NULL DEFAULT 'gps-policy-v0.1',
  consent_scope        TEXT NOT NULL DEFAULT 'payments',
  observed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_allocations_intent  ON allocations(intent_id);
CREATE INDEX IF NOT EXISTS idx_allocations_subject ON allocations(subject_id);
