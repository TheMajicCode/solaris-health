const db = require('../db');

async function award(userId, eventType, points, category, note) {
  // Avoid duplicate one-time awards
  if (['onboarding_complete', 'assessment_complete'].includes(eventType)) {
    const existing = await db.query(
      'SELECT id FROM reward_events WHERE user_id=$1 AND event_type=$2', [userId, eventType]
    );
    if (existing.rows.length > 0) return;
  }
  await db.query(
    'INSERT INTO reward_events (user_id, event_type, points, category, note) VALUES ($1,$2,$3,$4,$5)',
    [userId, eventType, points, category, note]
  );
  await db.query('UPDATE users SET love_points = COALESCE(love_points,0) + $1 WHERE id = $2', [points, userId]);
}

function shapeUser(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    avatarUrl: u.avatar_url,
    onboardingStatus: u.onboarding_status,
    currentPhase: u.current_phase,
    lovePoints: u.love_points,
    country: u.country,
    city: u.city,
    language: u.language,
  };
}

module.exports = { award, shapeUser };
