-- 036_journey_todos.sql
-- Personal-growth To-Do list. Guided journeys seed rows here on start; members
-- can also add their own. The Journal tab renders this as the member's hub for
-- mental / physical / emotional / spiritual growth.
-- Idempotent + additive; safe to re-run.

CREATE TABLE IF NOT EXISTS member_todos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_type  varchar(40),                 -- NULL for a member's own custom to-do
  step_key      varchar(60),                 -- blueprint step key (dedupe within a journey)
  title         varchar(200) NOT NULL,
  detail        text,
  kind          varchar(20) DEFAULT 'activity',   -- checkin|habit|audio|activity|reflection|practitioner|navigate
  dimension     varchar(12),                 -- mind|body|heart|spirit
  action_type   varchar(24),                 -- start_checkin|play_audio|open_listing|navigate|null
  action_target varchar(120),                -- audio id / provider id / tab name
  done          boolean DEFAULT false,
  done_at       timestamptz,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_todos_user ON member_todos(user_id);

-- One row per (member, journey, step) so re-starting a journey is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_todos_step
  ON member_todos(user_id, journey_type, step_key)
  WHERE journey_type IS NOT NULL AND step_key IS NOT NULL;
