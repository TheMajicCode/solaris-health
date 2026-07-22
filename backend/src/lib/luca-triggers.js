'use strict';
/**
 * luca-triggers.js — shared rule-based trigger engine for LUCA.
 *
 * `computeTriggers(userId)` reads the member's real Solaris Passport data and
 * derives a small set of booleans/numbers that describe their situation *this turn*.
 * `buildTriggerInstructions(triggers)` turns those into a dynamic SYSTEM_PROMPT
 * addon so LUCA's suggestions adapt to what the member actually needs next.
 *
 * Both the coach (`routes/luca.js`) and the recommendations endpoint
 * (`routes/luca-recommendations.js`) import from here so they stay in lock-step.
 *
 * Healthcare-safe: these are engagement/journey nudges only — never clinical.
 */
const db = require('../db');

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from, to = new Date()) {
  if (!from) return null;
  const f = new Date(from);
  if (Number.isNaN(f.getTime())) return null;
  const a = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

function focusNames(json) {
  if (!Array.isArray(json)) return [];
  return json.map((f) => (typeof f === 'string' ? f : f && f.name)).filter(Boolean);
}

/** Count consecutive check-in days ending at the most recent check-in. */
function computeStreak(dateStrings) {
  if (!dateStrings || !dateStrings.length) return 0;
  // dateStrings are ISO 'YYYY-MM-DD', sorted DESC, distinct
  let streak = 1;
  let expected = new Date(dateStrings[0] + 'T00:00:00Z');
  for (let i = 1; i < dateStrings.length; i++) {
    expected = new Date(expected.getTime() - DAY_MS);
    const expIso = expected.toISOString().slice(0, 10);
    if (dateStrings[i] === expIso) streak++;
    else break;
  }
  return streak;
}

/**
 * Compute the active triggers for a member.
 * @param {string} userId
 * @param {string} [message] optional latest user message (to detect stress mentions)
 */
async function computeTriggers(userId, message = '') {
  const triggers = {
    onboardingIncomplete: false,
    daysSinceCheckin: null,
    vitality: 0,
    noAudioUnlocked: true,
    daysSinceBooking: null,
    streakDays: 0,
    latestFocusAreas: [],
    hasMentionedStress: false,
  };

  try {
    const u = await db
      .query('SELECT onboarding_status FROM users WHERE id=$1', [userId])
      .catch(() => ({ rows: [] }));
    if (u.rows[0]) triggers.onboardingIncomplete = u.rows[0].onboarding_status !== 'complete';

    const a = await db
      .query(
        'SELECT vitality_score, top_focus_areas_json FROM assessment_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      )
      .catch(() => ({ rows: [] }));
    if (a.rows[0]) {
      triggers.vitality = Number(a.rows[0].vitality_score) || 0;
      triggers.latestFocusAreas = focusNames(a.rows[0].top_focus_areas_json || []);
    }

    const c = await db
      .query(
        `SELECT DISTINCT checkin_date::text AS d FROM daily_checkins WHERE user_id=$1 ORDER BY d DESC LIMIT 60`,
        [userId]
      )
      .catch(() => ({ rows: [] }));
    if (c.rows.length) {
      const dates = c.rows.map((r) => r.d);
      triggers.daysSinceCheckin = daysBetween(dates[0]);
      triggers.streakDays = computeStreak(dates);
    }

    const au = await db
      .query('SELECT COUNT(*)::int AS n FROM user_audio WHERE user_id=$1', [userId])
      .catch(() => ({ rows: [{ n: 0 }] }));
    triggers.noAudioUnlocked = Number(au.rows[0]?.n || 0) === 0;

    const b = await db
      .query('SELECT created_at FROM booking_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [userId])
      .catch(() => ({ rows: [] }));
    if (b.rows[0]) triggers.daysSinceBooking = daysBetween(b.rows[0].created_at);

    if (message && typeof message === 'string') {
      triggers.hasMentionedStress = /\b(stress|stressed|anxious|anxiety|overwhelm|can'?t sleep|insomnia|sleepless|panic|burn ?out|burned out)\b/i.test(
        message
      );
    }
  } catch (e) {
    // Never let trigger computation break the coach — return safe defaults
    console.error('[LUCA triggers] compute failed (non-fatal):', e.message);
  }

  return triggers;
}

/** Build the dynamic SYSTEM_PROMPT addon describing which rules fired this turn. */
function buildTriggerInstructions(t) {
  const lines = [];
  if (t.onboardingIncomplete) {
    lines.push(
      'The member has not completed their Solaris intake. Your FIRST suggestion MUST be action="start_assessment", label="Complete my Solaris intake".'
    );
  }
  if (t.daysSinceCheckin != null && t.daysSinceCheckin >= 3) {
    lines.push(
      `The member hasn't logged a check-in in ${t.daysSinceCheckin} days. Gently encourage them to reconnect. Include a suggestion with action="start_checkin".`
    );
  }
  if (t.vitality > 0 && t.vitality < 60) {
    const focus = t.latestFocusAreas.length ? ` matching their focus areas (${t.latestFocusAreas.join(', ')})` : '';
    lines.push(
      `The member's vitality is ${t.vitality}. Suggest a curated journey${focus} with action="curate".`
    );
  }
  if (t.noAudioUnlocked && t.hasMentionedStress) {
    lines.push(
      'The member mentioned stress, anxiety, or sleep and has no audio unlocked. Suggest a Dr. Maya Solis audio practice with action="play_audio".'
    );
  }
  if (t.daysSinceBooking === null && t.vitality > 0) {
    lines.push(
      'The member has no bookings yet. Your Curated Journey suggestion should point to a practitioner with action="open_listing".'
    );
  } else if (t.daysSinceBooking != null && t.daysSinceBooking >= 30) {
    lines.push(
      `The member last booked ${t.daysSinceBooking} days ago. Gently suggest reconnecting with a practitioner with action="open_listing".`
    );
  }
  if (t.streakDays >= 3) {
    lines.push(
      `The member has a ${t.streakDays}-day check-in streak — celebrate it warmly and encourage the next check-in.`
    );
  }

  if (!lines.length) return '';
  return (
    '[RULE-ENGINE TRIGGERS — ACTIVE THIS TURN]\n' +
    lines.map((l) => `- ${l}`).join('\n')
  );
}

module.exports = { computeTriggers, buildTriggerInstructions };
