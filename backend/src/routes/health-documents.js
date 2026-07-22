'use strict';
/**
 * health-documents.js
 *   GET    /api/health-documents        → list the user's shared health data
 *   POST   /api/health-documents        → { description, filename?, fileSize?, mimeType?, docType? }
 *                                          → LUCA generates a warm, educational (never clinical) summary,
 *                                            stores it, and returns the created row
 *   DELETE /api/health-documents/:id     → delete the user's own document
 *
 * Healthcare safety: LUCA educates and prepares — it NEVER diagnoses or interprets
 * results clinically. Every summary ends with an explicit disclaimer.
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getAIProvider } = require('../lib/ai');

const router = express.Router();

const SUMMARY_SYSTEM_PROMPT = `You are LUCA, a warm, heart-centered holistic health concierge for the Solaris ecosystem.
A member has shared some health data with you (a description, and possibly a document like lab results, a symptom note, or a test result).

Your job: generate a warm, educational, NON-CLINICAL summary for their Sovereign Passport that:
- Explains, in plain and caring language, what this kind of data usually helps a person understand about their health.
- Suggests 2-3 thoughtful questions they could bring to a conversation with their licensed practitioner.
- Gently notes any relevant patterns in relation to their vitality score and focus areas (only if context is provided) — as observations to explore, never as conclusions.

Hard rules (never break):
- You NEVER diagnose, interpret results clinically, prescribe, or state what a value "means" medically.
- You never alarm. Stay calm, grounded, and encouraging.
- Keep it concise: 120-200 words, warm and human.
- End with exactly this disclaimer on its own line:
"This summary is for your personal understanding and preparation for conversations with your licensed practitioner — not a medical interpretation."`;

/** Load a light context string (vitality + focus areas) for the summary. */
async function loadContextString(userId) {
  try {
    const a = await db.query(
      'SELECT vitality_score, top_focus_areas_json FROM assessment_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (!a.rows[0]) return 'No assessment on file yet.';
    const row = a.rows[0];
    let focus = [];
    try {
      const raw = row.top_focus_areas_json;
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
      focus = (arr || []).map((f) => (typeof f === 'string' ? f : f && f.name)).filter(Boolean);
    } catch { /* ignore */ }
    const parts = [];
    if (row.vitality_score != null) parts.push(`Vitality score: ${row.vitality_score}/100.`);
    parts.push(`Focus areas: ${focus.length ? focus.join(', ') : 'not specified'}.`);
    return parts.join(' ');
  } catch {
    return 'No assessment on file yet.';
  }
}

// GET — list the user's documents
router.get('/', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, doc_type, filename, file_size_bytes, mime_type, description, luca_summary, created_at
       FROM health_documents WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ documents: r.rows });
  } catch (err) {
    console.error('health-documents list error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST — store shared data + generate a LUCA educational summary
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { description = '', filename = null, fileSize = null, mimeType = null, docType = 'upload' } = req.body || {};

  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: 'A description of what you are sharing is required.' });
  }

  // Generate the educational summary (graceful fallback if AI unavailable)
  let summary = '';
  try {
    const ai = getAIProvider();
    const context = await loadContextString(userId);
    const prompt = `The member shared this with you:\n"${String(description).trim()}"${filename ? `\n(Attached file: ${filename}${mimeType ? ', ' + mimeType : ''})` : ''}\n\nWrite the warm, educational Passport summary now.`;
    const raw = await ai.complete({ system: SUMMARY_SYSTEM_PROMPT, prompt, context });
    summary = String(raw || '').trim();
  } catch (e) {
    console.error('health-documents summary AI error, using fallback:', e.message);
  }
  if (!summary) {
    summary = `Thank you for sharing this with your Passport. Notes and results like these help build a fuller picture of your health over time, and give you and your practitioner a concrete starting point for conversation.\n\nA few questions you might bring to your practitioner: What do these findings suggest for my current focus areas? Are there simple lifestyle steps worth trying first? When should we re-check?\n\nThis summary is for your personal understanding and preparation for conversations with your licensed practitioner — not a medical interpretation.`;
  }

  try {
    const r = await db.query(
      `INSERT INTO health_documents (user_id, doc_type, filename, file_size_bytes, mime_type, description, luca_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, doc_type, filename, file_size_bytes, mime_type, description, luca_summary, created_at`,
      [userId, docType || 'upload', filename, fileSize, mimeType, String(description).trim(), summary]
    );
    res.json({ document: r.rows[0] });
  } catch (err) {
    console.error('health-documents insert error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE — remove the user's own document
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      'DELETE FROM health_documents WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('health-documents delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
