-- ============================================================
-- Phase 4 — Cross-chain Wallet Integration
-- Tables for connecting Web3 wallets to a user (sovereign identity)
-- Idempotent: safe to run on existing databases.
-- ============================================================

-- --- WALLET ADDRESSES ---
CREATE TABLE IF NOT EXISTS wallet_addresses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain       VARCHAR(20) NOT NULL,          -- ethereum | polygon | solana | bitcoin
  address     VARCHAR(255) NOT NULL,         -- stored address (lower-cased for EVM)
  address_enc TEXT,                          -- optional encrypted copy of the address
  label       VARCHAR(120),                  -- user-friendly label / provider name
  provider    VARCHAR(60),                   -- metamask | walletconnect | phantom | manual
  verified    BOOLEAN DEFAULT FALSE,         -- ownership proven via signature (SIWE)
  is_primary  BOOLEAN DEFAULT FALSE,         -- the user's primary wallet
  verified_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, chain, address)
);

-- --- WALLET TRANSACTIONS (optional cache) ---
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address_id UUID REFERENCES wallet_addresses(id) ON DELETE CASCADE,
  tx_hash           VARCHAR(255) NOT NULL,
  chain             VARCHAR(20),
  type              VARCHAR(20),             -- sent | received | swap | contract
  amount            NUMERIC,
  token             VARCHAR(40),             -- ETH | SOL | BTC | symbol
  counterparty      VARCHAR(255),
  block_time        TIMESTAMP,
  raw_json          JSONB DEFAULT '{}',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (chain, tx_hash, wallet_address_id)
);

-- --- INDEXES ---
CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_chain ON wallet_addresses(chain);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_address_id);

-- Ensure only one primary wallet per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_primary
  ON wallet_addresses(user_id) WHERE is_primary = TRUE;
