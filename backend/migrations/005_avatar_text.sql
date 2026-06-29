-- Widen avatar_url to TEXT to support base64 data-URL profile photos
ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;
