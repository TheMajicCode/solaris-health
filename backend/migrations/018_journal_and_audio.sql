-- 018_journal_and_audio.sql
-- Recovery-parity migration.
-- journal_entries, audio_library and user_audio are used by the application
-- (routes/journal.js, routes/audio.js, routes/passport.js) but had no committed
-- CREATE TABLE in any schema file or migration. They existed only in the live DB,
-- so a fresh rebuild from committed source was missing them. This migration adds
-- them (idempotently) so the committed source fully reproduces production.

CREATE TABLE IF NOT EXISTS journal_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mood       VARCHAR(20),
    content    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audio_library (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id       UUID REFERENCES listings(id) ON DELETE SET NULL,
    title            VARCHAR(200) NOT NULL,
    description      TEXT,
    audio_url        TEXT NOT NULL,
    cover_image_url  TEXT,
    duration_seconds INTEGER DEFAULT 0,
    is_free          BOOLEAN DEFAULT TRUE,
    tags_json        JSONB DEFAULT '[]'::jsonb,
    sort_order       INTEGER DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_audio (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    audio_id    UUID NOT NULL REFERENCES audio_library(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, audio_id)
);
CREATE INDEX IF NOT EXISTS idx_user_audio_user ON user_audio (user_id);
