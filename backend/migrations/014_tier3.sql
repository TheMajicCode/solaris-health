-- 014_tier3.sql — Tier 3 feature completeness
--   * Booking confirmation loop: practitioner can propose an alternate time,
--     patient confirms it (booking -> scheduled).
--   * GPS earnings: a transparent, clearly-simulated payment_splits ledger so a
--     practitioner can see the value that flows to them from each session.
--
-- node-pg-migrate runs plain .sql files as a single "up" step, idempotently.

/* ---------- Booking: proposed-time round-trip ---------- */
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_date        DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_start_time  TIME;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_end_time    TIME;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS practitioner_notes   TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proposed_at          TIMESTAMPTZ;

/* ---------- GPS: simulated payment splits ledger ----------
   Every amount here is a *simulated* value used to demonstrate the Generative
   Prosperity System — it is never real money movement. The UI always labels it
   as simulated. */
CREATE TABLE IF NOT EXISTS payment_splits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id      UUID REFERENCES users(id) ON DELETE CASCADE,   -- practitioner (users.id)
  patient_id       UUID REFERENCES users(id) ON DELETE SET NULL,  -- member (users.id)
  booking_id       UUID REFERENCES bookings(id) ON DELETE SET NULL,
  amount_sats      BIGINT      NOT NULL DEFAULT 0,
  amount_usd_cents INTEGER     NOT NULL DEFAULT 0,
  split_type       VARCHAR(50) NOT NULL DEFAULT 'session_fee',
  status           VARCHAR(20) NOT NULL DEFAULT 'simulated',
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_splits_provider ON payment_splits (provider_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_patient  ON payment_splits (patient_id);
