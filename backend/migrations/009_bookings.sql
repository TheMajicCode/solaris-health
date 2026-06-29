-- ============================================================
-- LUCA PASSPORT — Booking & Appointment System
-- Connects patients with providers: weekly availability, generated
-- time slots, booking lifecycle, and a status history audit trail.
-- Idempotent: safe to run on a fresh or existing database.
-- (See migrations/009_bookings.sql for the deployable copy.)
-- ============================================================

-- ---------- provider_availability (weekly recurring schedule) ----------
CREATE TABLE IF NOT EXISTS provider_availability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday .. 6=Saturday
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_available  BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT now()
);

-- ---------- provider_time_slots (concrete bookable slots) ----------
CREATE TABLE IF NOT EXISTS provider_time_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id    UUID REFERENCES provider_services(id) ON DELETE SET NULL,
  slot_date     DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  status        VARCHAR(20) DEFAULT 'available', -- available | booked | blocked
  booking_id    UUID,                            -- FK added after bookings table exists
  created_at    TIMESTAMP DEFAULT now()
);

-- ---------- bookings ----------
CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id         UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id          UUID REFERENCES provider_services(id) ON DELETE SET NULL,
  booking_date        DATE NOT NULL,
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  status              VARCHAR(20) DEFAULT 'pending', -- pending | confirmed | cancelled | completed | no_show
  total_price         NUMERIC(10,2) DEFAULT 0,
  platform_fee        NUMERIC(10,2) DEFAULT 0,       -- 10%
  provider_payout     NUMERIC(10,2) DEFAULT 0,       -- 90%
  currency            VARCHAR(8) DEFAULT 'USD',
  patient_notes       TEXT,
  patient_phone       VARCHAR(60),
  cancellation_reason TEXT,
  clinical_notes      TEXT,
  cancelled_at        TIMESTAMP,
  confirmed_at        TIMESTAMP,
  completed_at        TIMESTAMP,
  created_at          TIMESTAMP DEFAULT now(),
  updated_at          TIMESTAMP DEFAULT now()
);

-- Late-bind the slot -> booking FK (best-effort; ignore if it already exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'provider_time_slots_booking_id_fkey'
  ) THEN
    ALTER TABLE provider_time_slots
      ADD CONSTRAINT provider_time_slots_booking_id_fkey
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ---------- booking_status_history (audit trail) ----------
CREATE TABLE IF NOT EXISTS booking_status_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL,
  changed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  reason       TEXT,
  created_at   TIMESTAMP DEFAULT now()
);

-- ---------- provider booking settings (auto-confirm, buffer) ----------
ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS auto_confirm_bookings BOOLEAN DEFAULT FALSE;
ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS booking_buffer_minutes INTEGER DEFAULT 15;

-- ---------- indexes ----------
CREATE INDEX IF NOT EXISTS idx_pavail_provider     ON provider_availability (provider_id);
CREATE INDEX IF NOT EXISTS idx_pslots_provider     ON provider_time_slots (provider_id);
CREATE INDEX IF NOT EXISTS idx_pslots_date         ON provider_time_slots (slot_date, start_time);
CREATE INDEX IF NOT EXISTS idx_pslots_status       ON provider_time_slots (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pslots_slot   ON provider_time_slots (provider_id, slot_date, start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_date       ON bookings (booking_date, start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_patient    ON bookings (patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider   ON bookings (provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bsh_booking         ON booking_status_history (booking_id);
