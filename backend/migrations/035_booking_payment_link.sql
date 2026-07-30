-- 035_booking_payment_link.sql
-- Wire the payments MVP (A4 §2) into the marketplace booking flow.
--   * payment_intents.booking_id links an intent to a bookings row.
--   * bookings.payment_status surfaces PENDING/PAID/FAILED in the UI.
-- Idempotent + additive; safe to re-run.

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_intents_booking ON payment_intents(booking_id);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(12) NOT NULL DEFAULT 'unpaid';

-- Backfill: any booking that already has a paid intent is 'paid'.
UPDATE bookings b
   SET payment_status = 'paid'
  FROM payment_intents pi
 WHERE pi.booking_id = b.id
   AND pi.status = 'paid'
   AND b.payment_status <> 'paid';
