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

/**
 * Write an audit log entry. Best-effort: never throws (failures are logged only),
 * so audit logging can never break a request flow.
 */
async function audit({ actorId, action, resourceType, resourceId, newValues, oldValues, result = 'success', reason, ip }) {
  try {
    await db.query(
      `INSERT INTO audit_logs
        (actor_id, action, resource_type, resource_id, old_values, new_values, result, result_reason, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        actorId || null, action, resourceType || null, resourceId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        result, reason || null,
        ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null,
      ]
    );
  } catch (err) {
    console.error('audit log failed:', err.message);
  }
}

module.exports = { award, shapeUser, audit };
