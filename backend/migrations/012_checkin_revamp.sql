-- P1.3 Daily check-in revamp: Mind/Body/Heart/Spirit + habits

-- 1) Mind/Body/Heart/Spirit scores complement the existing energy/mood/etc columns
ALTER TABLE daily_checkins
  ADD COLUMN IF NOT EXISTS mind_score INTEGER,
  ADD COLUMN IF NOT EXISTS body_score INTEGER,
  ADD COLUMN IF NOT EXISTS heart_score INTEGER,
  ADD COLUMN IF NOT EXISTS spirit_score INTEGER;

-- One check-in per member per day (enables clean upsert / streak / week strip)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_checkins_user_date_uniq'
  ) THEN
    ALTER TABLE daily_checkins
      ADD CONSTRAINT daily_checkins_user_date_uniq UNIQUE (user_id, checkin_date);
  END IF;
END $$;

-- 2) Member-defined habits + daily ticks
CREATE TABLE IF NOT EXISTS member_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(20) DEFAULT '🌱',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_ticks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES member_habits(id) ON DELETE CASCADE,
  tick_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, habit_id, tick_date)
);

CREATE INDEX IF NOT EXISTS idx_habits_user ON member_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_ticks_user_date ON habit_ticks(user_id, tick_date DESC);

-- 3) Seed 3 habits for Sarah
INSERT INTO member_habits (user_id, name, icon, active)
SELECT u.id, habit.name, habit.icon, true
FROM users u, (VALUES
  ('Morning breathwork', '🌬️'),
  ('Drink 8 glasses of water', '💧'),
  ('Evening journal', '📔')
) AS habit(name, icon)
WHERE u.email = 'sarah@solaris.health'
  AND NOT EXISTS (
    SELECT 1 FROM member_habits m WHERE m.user_id = u.id AND m.name = habit.name
  );
