-- 037_onboarding_experience.sql
-- Beta V1 onboarding-experience gate. Records, per ACCOUNT (server-side, not
-- localStorage), whether the one-time Screens 1-3 (Identity / Wealth / Sovereignty)
-- have been shown & completed, so a completed account never re-sees them on any
-- device and an abandoned session resumes at the correct step.
-- Additive + idempotent; safe to re-run. No secrets are ever stored here.

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_experience_version integer DEFAULT 0;
-- identity backup ACKNOWLEDGEMENT (checkbox), NOT the key itself
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_backup_ack_at timestamptz;
-- wealth (Spark) screen outcome: 'completed' (generated + acked) | 'skipped'
ALTER TABLE users ADD COLUMN IF NOT EXISTS wealth_screen_status varchar(20);
-- wallet recovery-words backup ACKNOWLEDGEMENT (checkbox), only when generated
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_backup_ack_at timestamptz;
-- sovereignty screen completed
ALTER TABLE users ADD COLUMN IF NOT EXISTS sovereignty_ack_at timestamptz;
