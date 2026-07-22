-- 016_revoked_tokens.sql
-- JWT revocation blocklist (Gate 6). When a user logs out, that token's unique
-- jti is recorded here; authMiddleware rejects any token whose jti is present.
-- Rows are auto-cleaned once their token would have expired anyway.

CREATE TABLE IF NOT EXISTS revoked_tokens (
  id         SERIAL PRIMARY KEY,
  jti        VARCHAR(255),        -- JWT ID (unique per issued token)
  user_id    UUID,
  revoked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ          -- when the token would have expired on its own
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_jti     ON revoked_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);
