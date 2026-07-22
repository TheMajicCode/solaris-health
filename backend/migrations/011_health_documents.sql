-- 011_health_documents.sql
-- Sovereign Passport: member-uploaded health data + LUCA educational summaries.
-- Also seeds diagnostic (lab) listings for the "Book more tests" flow.

CREATE TABLE IF NOT EXISTS health_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type VARCHAR(40) DEFAULT 'upload',
  filename VARCHAR(255),
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  description TEXT,
  luca_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_docs_user ON health_documents(user_id, created_at DESC);

-- Seed diagnostic listings (lab panels) for "Book more tests"
INSERT INTO listings (listing_type, title, specialty, city, country, short_description, booking_enabled, payment_enabled, featured, status)
SELECT 'diagnostic', 'Vital Lab Panel — Functional Blood Test', 'Functional Diagnostics', 'San Salvador', 'El Salvador',
       'Comprehensive blood panel: metabolic, thyroid, hormones, micronutrients. Results reviewed with a functional practitioner.',
       true, true, true, 'published'
WHERE NOT EXISTS (SELECT 1 FROM listings WHERE title='Vital Lab Panel — Functional Blood Test');

INSERT INTO listings (listing_type, title, specialty, city, country, short_description, booking_enabled, payment_enabled, featured, status)
SELECT 'diagnostic', 'Heavy Metal & Toxin Screen', 'Environmental Medicine', 'San José', 'Costa Rica',
       'Urine and hair mineral analysis to identify heavy metal burden and guide a safe detox protocol.',
       true, false, true, 'published'
WHERE NOT EXISTS (SELECT 1 FROM listings WHERE title='Heavy Metal & Toxin Screen');
