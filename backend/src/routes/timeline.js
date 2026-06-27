/**
 * Health Timeline routes — Phase 3
 * Aggregates events from multiple tables into a single chronological feed.
 *
 *   GET  /api/timeline/me                     — authenticated user's timeline
 *   GET  /api/timeline/patient/:userId        — a patient's timeline (practitioner/admin)
 *   GET  /api/timeline/system                 — system-wide events (admin)
 *   POST /api/timeline/export                 — export timeline as JSON or CSV
 *
 * Filters (query params, also accepted in POST body for export):
 *   types   comma list: appointment,assessment,vitals,coach,reward,document
 *   from    ISO date (inclusive)
 *   to      ISO date (inclusive)
 *   q       free text search across title/detail
 *   limit   page size (default 100, max 500)
 *   offset  pagination offset
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const ALL_TYPES = ['appointment', 'assessment', 'vitals', 'coach', 'reward', 'document'];

function requireStaff(req, res, next) {
  if (req.user.role !== 'practitioner' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Practitioner or admin access only' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
}

function parseFilters(src = {}) {
  const types = (src.types ? String(src.types).split(',') : ALL_TYPES)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => ALL_TYPES.includes(t));
  const from = src.from ? new Date(src.from) : null;
  const to = src.to ? new Date(src.to) : null;
  const q = (src.q || '').toString().trim().toLowerCase();
  let limit = parseInt(src.limit, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 100;
  limit = Math.min(limit, 500);
  let offset = parseInt(src.offset, 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  return { types: types.length ? types : ALL_TYPES, from, to, q, limit, offset };
}

/**
 * Build a unified list of timeline events for a single user.
 * Returns events sorted newest-first.
 */
async function gatherUserTimeline(userId, filters) {
  const events = [];
  const want = (t) => filters.types.includes(t);

  // --- Appointments (booking_requests) ---
  if (want('appointment')) {
    const r = await db.query(
      `SELECT b.id, b.status, b.preferred_date, b.preferred_time, b.note,
              b.created_at, l.title AS listing_title, l.specialty
         FROM booking_requests b
         LEFT JOIN listings l ON l.id = b.listing_id
        WHERE b.user_id = $1
        ORDER BY b.created_at DESC`,
      [userId]
    );
    for (const row of r.rows) {
      events.push({
        id: `appointment:${row.id}`,
        type: 'appointment',
        date: row.preferred_date || row.created_at,
        title: row.listing_title ? `Appointment · ${row.listing_title}` : 'Appointment request',
        detail: [row.specialty, row.note].filter(Boolean).join(' — ') || `Status: ${row.status}`,
        status: row.status,
        source: { table: 'booking_requests', id: row.id },
        meta: { time: row.preferred_time, specialty: row.specialty },
      });
    }
  }

  // --- Assessments ---
  if (want('assessment')) {
    const r = await db.query(
      `SELECT id, vitality_score, mental_score, emotional_score, physical_score,
              spiritual_score, top_focus_areas_json, completed_at, created_at
         FROM assessment_responses
        WHERE user_id = $1
        ORDER BY COALESCE(completed_at, created_at) DESC`,
      [userId]
    );
    for (const row of r.rows) {
      let focus = [];
      try { focus = Array.isArray(row.top_focus_areas_json) ? row.top_focus_areas_json : JSON.parse(row.top_focus_areas_json || '[]'); } catch { focus = []; }
      events.push({
        id: `assessment:${row.id}`,
        type: 'assessment',
        date: row.completed_at || row.created_at,
        title: 'Vitality assessment completed',
        detail: row.vitality_score != null ? `Vitality score: ${row.vitality_score}/100` : 'Assessment recorded',
        source: { table: 'assessment_responses', id: row.id },
        meta: {
          vitality: row.vitality_score,
          mental: row.mental_score,
          emotional: row.emotional_score,
          physical: row.physical_score,
          spiritual: row.spiritual_score,
          focus: (focus || []).map((f) => (typeof f === 'string' ? f : f?.label || f?.name)).filter(Boolean),
        },
      });
    }
  }

  // --- Vitals (daily check-ins) ---
  if (want('vitals')) {
    const r = await db.query(
      `SELECT id, checkin_date, energy_score, mood_score, sleep_hours,
              hydration_glasses, movement_minutes, notes, created_at
         FROM daily_checkins
        WHERE user_id = $1
        ORDER BY checkin_date DESC`,
      [userId]
    );
    for (const row of r.rows) {
      const bits = [];
      if (row.energy_score != null) bits.push(`Energy ${row.energy_score}`);
      if (row.mood_score != null) bits.push(`Mood ${row.mood_score}`);
      if (row.sleep_hours != null) bits.push(`Sleep ${row.sleep_hours}h`);
      if (row.hydration_glasses != null) bits.push(`Water ${row.hydration_glasses}`);
      if (row.movement_minutes != null) bits.push(`Move ${row.movement_minutes}m`);
      events.push({
        id: `vitals:${row.id}`,
        type: 'vitals',
        date: row.checkin_date || row.created_at,
        title: 'Daily check-in',
        detail: bits.join(' · ') || (row.notes || 'Check-in recorded'),
        source: { table: 'daily_checkins', id: row.id },
        meta: {
          energy: row.energy_score, mood: row.mood_score, sleep: row.sleep_hours,
          hydration: row.hydration_glasses, movement: row.movement_minutes, notes: row.notes,
        },
      });
    }
  }

  // --- Coach sessions (luca_messages, user-initiated) ---
  if (want('coach')) {
    const r = await db.query(
      `SELECT id, role, content, model, created_at
         FROM luca_messages
        WHERE user_id = $1 AND role = 'user'
        ORDER BY created_at DESC`,
      [userId]
    );
    for (const row of r.rows) {
      const snippet = (row.content || '').slice(0, 140);
      events.push({
        id: `coach:${row.id}`,
        type: 'coach',
        date: row.created_at,
        title: 'LUCA coach session',
        detail: snippet + ((row.content || '').length > 140 ? '…' : ''),
        source: { table: 'luca_messages', id: row.id },
        meta: { model: row.model },
      });
    }
  }

  // --- Rewards (LOVE points) ---
  if (want('reward')) {
    const r = await db.query(
      `SELECT id, event_type, points, category, note, created_at
         FROM reward_events
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    for (const row of r.rows) {
      events.push({
        id: `reward:${row.id}`,
        type: 'reward',
        date: row.created_at,
        title: `Earned ${row.points || 0} LOVE`,
        detail: [row.category, row.note].filter(Boolean).join(' — ') || row.event_type || 'Reward',
        source: { table: 'reward_events', id: row.id },
        meta: { points: row.points, category: row.category },
      });
    }
  }

  // --- Documents ---
  if (want('document')) {
    const r = await db.query(
      `SELECT id, document_type, file_name, description, created_at
         FROM documents
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    for (const row of r.rows) {
      events.push({
        id: `document:${row.id}`,
        type: 'document',
        date: row.created_at,
        title: row.file_name || `Document (${row.document_type || 'file'})`,
        detail: row.description || `${row.document_type || 'Document'} uploaded`,
        source: { table: 'documents', id: row.id },
        meta: { documentType: row.document_type },
      });
    }
  }

  return applyFilters(events, filters);
}

function applyFilters(events, filters) {
  let out = events;
  if (filters.from) out = out.filter((e) => e.date && new Date(e.date) >= filters.from);
  if (filters.to) {
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    out = out.filter((e) => e.date && new Date(e.date) <= end);
  }
  if (filters.q) {
    out = out.filter((e) =>
      `${e.title} ${e.detail}`.toLowerCase().includes(filters.q));
  }
  out.sort((a, b) => new Date(b.date) - new Date(a.date));
  return out;
}

function paginate(events, filters) {
  const total = events.length;
  const page = events.slice(filters.offset, filters.offset + filters.limit);
  return { total, events: page, limit: filters.limit, offset: filters.offset };
}

/* ----------------------------- ROUTES ----------------------------- */

// Authenticated user's own timeline
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const events = await gatherUserTimeline(req.user.userId, filters);
    res.json(paginate(events, filters));
  } catch (err) { console.error('timeline/me', err); res.status(500).json({ error: 'Server error' }); }
});

// A specific patient's timeline (practitioner / admin)
router.get('/patient/:userId', authMiddleware, requireStaff, async (req, res) => {
  try {
    const filters = parseFilters(req.query);
    const u = await db.query('SELECT id, full_name, email, role FROM users WHERE id=$1', [req.params.userId]);
    if (!u.rows[0]) return res.status(404).json({ error: 'User not found' });
    const events = await gatherUserTimeline(req.params.userId, filters);
    res.json({ patient: u.rows[0], ...paginate(events, filters) });
  } catch (err) { console.error('timeline/patient', err); res.status(500).json({ error: 'Server error' }); }
});

// System-wide event timeline (admin)
router.get('/system', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const filters = parseFilters({ ...req.query, types: 'all' });
    const events = [];

    const regs = await db.query(
      `SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 500`);
    for (const row of regs.rows) {
      events.push({
        id: `user:${row.id}`, type: 'registration', date: row.created_at,
        title: `New ${row.role || 'user'} registered`,
        detail: row.full_name || row.email, meta: { role: row.role },
      });
    }
    const asmts = await db.query(
      `SELECT ar.id, ar.vitality_score, ar.completed_at, ar.created_at, u.full_name
         FROM assessment_responses ar LEFT JOIN users u ON u.id = ar.user_id
        ORDER BY COALESCE(ar.completed_at, ar.created_at) DESC LIMIT 500`);
    for (const row of asmts.rows) {
      events.push({
        id: `sys-assessment:${row.id}`, type: 'assessment', date: row.completed_at || row.created_at,
        title: 'Assessment completed', detail: `${row.full_name || 'A member'} · vitality ${row.vitality_score ?? '—'}`,
        meta: { vitality: row.vitality_score },
      });
    }
    const books = await db.query(
      `SELECT b.id, b.status, b.created_at, u.full_name, l.title
         FROM booking_requests b LEFT JOIN users u ON u.id = b.user_id
         LEFT JOIN listings l ON l.id = b.listing_id
        ORDER BY b.created_at DESC LIMIT 500`);
    for (const row of books.rows) {
      events.push({
        id: `sys-booking:${row.id}`, type: 'appointment', date: row.created_at,
        title: 'Booking created', detail: `${row.full_name || 'A member'} → ${row.title || 'a practitioner'}`,
        status: row.status,
      });
    }

    const filtered = applyFilters(events, filters);

    // daily aggregation for usage-over-time chart
    const byDay = {};
    for (const e of filtered) {
      const day = new Date(e.date).toISOString().slice(0, 10);
      byDay[day] = byDay[day] || { date: day, registration: 0, assessment: 0, appointment: 0 };
      if (byDay[day][e.type] != null) byDay[day][e.type] += 1;
    }
    const series = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ ...paginate(filtered, filters), series });
  } catch (err) { console.error('timeline/system', err); res.status(500).json({ error: 'Server error' }); }
});

// Export timeline (JSON or CSV)
router.post('/export', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const format = (body.format || 'json').toLowerCase();
    const filters = parseFilters(body);

    // determine target user
    let targetUserId = req.user.userId;
    if (body.userId && body.userId !== req.user.userId) {
      if (req.user.role !== 'practitioner' && req.user.role !== 'admin')
        return res.status(403).json({ error: 'Not allowed' });
      targetUserId = body.userId;
    }
    const events = await gatherUserTimeline(targetUserId, filters);

    if (format === 'csv') {
      const header = ['date', 'type', 'title', 'detail', 'status'];
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [header.join(',')];
      for (const e of events) lines.push([e.date, e.type, e.title, e.detail, e.status || ''].map(esc).join(','));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="luca-timeline.csv"');
      return res.send(lines.join('\n'));
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="luca-timeline.json"');
    res.send(JSON.stringify({ exportedAt: new Date().toISOString(), count: events.length, events }, null, 2));
  } catch (err) { console.error('timeline/export', err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
