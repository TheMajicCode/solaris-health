-- =====================================================================
-- 032 — Nostr identity handles / NIP-05 (Track B, M8; spec A2 §3). Additive.
--
-- One seed, two paths (A2 §3.1): a member's BIP-39 mnemonic is generated and
-- kept CLIENT-SIDE. Only the npub (NIP-06 derivation) is ever sent to Solaris,
-- stored as a `nostr` binding on the permanent subject. Solaris NEVER stores
-- the secret key or the mnemonic.
--
-- nostr_handles maps a human-readable NIP-05 handle (`name@solaris.health`) to
-- the member's npub + hex pubkey, so `GET /.well-known/nostr.json?name=<name>`
-- can resolve it. The same handle doubles as a Lightning Address later
-- (A2 §3.3) — the lnurlp endpoint returns "not configured" until payments make
-- it meaningful (A2 §3.4 scope note).
-- Additive: no existing table is modified.
-- =====================================================================

CREATE TABLE IF NOT EXISTS nostr_handles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    VARCHAR(40) NOT NULL REFERENCES solaris_subjects(subject_id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  handle        VARCHAR(64) UNIQUE NOT NULL,      -- the NIP-05 local part, lowercased
  npub          TEXT NOT NULL,                    -- bech32 npub1...
  pubkey_hex    VARCHAR(64) NOT NULL,             -- 32-byte x-only pubkey, hex
  nip05_verified BOOLEAN NOT NULL DEFAULT true,   -- served from our own well-known
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nostr_handles_subject ON nostr_handles(subject_id);
CREATE INDEX IF NOT EXISTS idx_nostr_handles_pubkey  ON nostr_handles(pubkey_hex);
