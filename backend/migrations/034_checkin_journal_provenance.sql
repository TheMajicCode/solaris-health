-- 034_checkin_journal_provenance.sql
-- Sprint E — provenance rollout to the two remaining member-authored health
-- streams: daily_checkins and journal_entries. Every member-shared health fact
-- now carries the four provenance columns (A3 provenance ladder). Additive &
-- idempotent.
--
-- These streams are member self-reported by construction, so the backfill and
-- write-path defaults are level='L0', source='self_reported', consent_scope
-- ='personal', observed_at = when the fact was recorded (created_at).

ALTER TABLE daily_checkins
  ADD COLUMN IF NOT EXISTS level         CHAR(2)     NOT NULL DEFAULT 'L0',
  ADD COLUMN IF NOT EXISTS source        TEXT        NOT NULL DEFAULT 'self_reported',
  ADD COLUMN IF NOT EXISTS observed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS consent_scope TEXT        NOT NULL DEFAULT 'personal';

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS level         CHAR(2)     NOT NULL DEFAULT 'L0',
  ADD COLUMN IF NOT EXISTS source        TEXT        NOT NULL DEFAULT 'self_reported',
  ADD COLUMN IF NOT EXISTS observed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS consent_scope TEXT        NOT NULL DEFAULT 'personal';

-- Backfill existing rows: observed when they were created. The column default
-- (now()) stamps the migration run time on legacy rows, so realign observed_at
-- to created_at. Idempotent — re-running writes the same values.
UPDATE daily_checkins
   SET level = 'L0', source = 'self_reported', consent_scope = 'personal',
       observed_at = created_at
 WHERE created_at IS NOT NULL;

UPDATE journal_entries
   SET level = 'L0', source = 'self_reported', consent_scope = 'personal',
       observed_at = created_at
 WHERE created_at IS NOT NULL;
