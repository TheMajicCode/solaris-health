-- ============================================================
-- PHASE 5 — P2P END-TO-END ENCRYPTED MESSAGING
-- Patient <-> Practitioner secure health discussions.
--
-- Security model (E2E, zero-knowledge server):
--   * Each user owns an RSA-OAEP key pair generated in the browser.
--     Only the PUBLIC key is ever uploaded (encryption_keys).
--   * Each message is encrypted with a fresh random AES-256-GCM
--     "content key" (per-message ephemeral key → message-level key
--     independence / forward secrecy for the content layer).
--   * That AES content key is wrapped with the recipient's RSA public
--     key (enc_key_recipient) AND the sender's own public key
--     (enc_key_sender) so each party can decrypt with their private key.
--   * The server stores only opaque ciphertext + wrapped keys and can
--     never read message plaintext or file contents.
-- ============================================================

-- --- PUBLIC ENCRYPTION KEYS (one active key per user) ---
CREATE TABLE IF NOT EXISTS encryption_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key   TEXT NOT NULL,                       -- RSA-OAEP public key as JWK JSON
  algorithm    VARCHAR(40) DEFAULT 'RSA-OAEP-256',
  fingerprint  VARCHAR(64),                          -- SHA-256 of the public key (display / verify)
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- --- CONVERSATIONS (one per patient/practitioner pair) ---
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practitioner_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_id, practitioner_id)
);

-- --- MESSAGES (opaque encrypted blobs) ---
CREATE TABLE IF NOT EXISTS messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_content  TEXT NOT NULL,        -- base64 AES-256-GCM ciphertext
  iv                 TEXT NOT NULL,        -- base64 12-byte IV / nonce
  enc_key_sender     TEXT,                 -- AES content key wrapped w/ sender public key
  enc_key_recipient  TEXT,                 -- AES content key wrapped w/ recipient public key
  message_type       VARCHAR(20) DEFAULT 'text',  -- text | file
  has_attachment     BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at            TIMESTAMP
);

-- --- MESSAGE ATTACHMENTS (encrypted file blobs) ---
CREATE TABLE IF NOT EXISTS message_attachments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  encrypted_filename  TEXT,                -- base64 AES-GCM ciphertext of the file name
  encrypted_blob      TEXT NOT NULL,       -- base64 AES-GCM ciphertext of the file bytes
  iv                  TEXT NOT NULL,       -- base64 IV used for blob + filename
  enc_key_sender      TEXT,                -- file AES key wrapped w/ sender public key
  enc_key_recipient   TEXT,                -- file AES key wrapped w/ recipient public key
  size                INTEGER,             -- size of the original (plaintext) file in bytes
  mime_type           VARCHAR(160),        -- plaintext mime hint (used only to set download type)
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- ABUSE REPORTS ---
CREATE TABLE IF NOT EXISTS message_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id      UUID REFERENCES messages(id) ON DELETE SET NULL,
  reason          TEXT,
  status          VARCHAR(30) DEFAULT 'open',  -- open | reviewing | resolved
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --- INDEXES ---
CREATE INDEX IF NOT EXISTS idx_conversations_patient      ON conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_conversations_practitioner ON conversations(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation      ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender            ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread            ON messages(conversation_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_message        ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter           ON message_reports(reporter_id);
