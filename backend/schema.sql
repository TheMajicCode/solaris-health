-- LUCA Passport Database Schema
-- 9 Tables: users, patients, practitioners, treatments, credentials, contributions, agents, vault_entries, audit_logs

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'patient', 
  avatar_url VARCHAR(255),
  nostr_npub VARCHAR(255),
  did VARCHAR(255),
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  age INT,
  location VARCHAR(255),
  language VARCHAR(50) DEFAULT 'en',
  treatment_status VARCHAR(50) DEFAULT 'inquiry',
  case_size VARCHAR(50),
  assigned_practitioner_id UUID REFERENCES users(id),
  vault_path VARCHAR(255),
  consents JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_status ON patients(treatment_status);

-- Practitioners table
CREATE TABLE practitioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialty VARCHAR(255),
  license_number VARCHAR(255),
  verified_at TIMESTAMP,
  verified_by_id UUID REFERENCES users(id),
  reputation_score FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_practitioners_user_id ON practitioners(user_id);
CREATE INDEX idx_practitioners_verified ON practitioners(verified_at);

-- Treatments table
CREATE TABLE treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  practitioner_id UUID REFERENCES users(id),
  description TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'planned',
  documents_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_treatments_patient_id ON treatments(patient_id);
CREATE INDEX idx_treatments_status ON treatments(status);

-- Credentials table
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holder_id UUID NOT NULL REFERENCES users(id),
  credential_type VARCHAR(255) NOT NULL,
  credential_name VARCHAR(255),
  public BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  verified_by_id UUID REFERENCES users(id),
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_credentials_holder_id ON credentials(holder_id);
CREATE INDEX idx_credentials_type ON credentials(credential_type);

-- Contributions table
CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  description TEXT,
  impact VARCHAR(100),
  reward_sats INT DEFAULT 0,
  gps_value FLOAT DEFAULT 0,
  verified_at TIMESTAMP,
  verifier_id UUID REFERENCES users(id),
  public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_contributions_user_id ON contributions(user_id);
CREATE INDEX idx_contributions_created_at ON contributions(created_at DESC);

-- Agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  purpose TEXT,
  permissions JSONB DEFAULT '[]',
  observer_did VARCHAR(255),
  wallet_permission VARCHAR(50) DEFAULT 'none',
  trust_score INT DEFAULT 0,
  permission_level INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  last_action_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_agents_owner_id ON agents(owner_id);
CREATE INDEX idx_agents_active ON agents(active);

-- Vault Entries table
CREATE TABLE vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  content TEXT,
  encrypted BOOLEAN DEFAULT FALSE,
  content_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_vault_entries_user_id ON vault_entries(user_id);
CREATE INDEX idx_vault_entries_type ON vault_entries(entry_type);

-- Audit Log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  result VARCHAR(50),
  result_reason TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
