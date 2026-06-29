-- schema_notifications.sql — in-app notification system
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50),   -- application_approved | application_rejected | booking | message | review | system
  title      VARCHAR(255),
  message    TEXT,
  read       BOOLEAN DEFAULT false,
  data       JSONB,         -- extra context (application_id, etc.)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user        ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created     ON notifications (created_at DESC);
