'use strict';
/**
 * EXPORT route — the always-open sovereign path.
 *
 *   GET /api/export/me            -> JSON { files: [{path, contents}], manifest }
 *   GET /api/export/me?format=zip -> a .zip of the portable vault (if `archiver` is installed)
 *
 * This is what lets you tell investors "the user owns their data" and mean it: any user can
 * pull their entire record, in the exact format the sovereign (Strategy A) node ingests.
 *
 * Drop-in: add this file as backend/src/routes/export.js and register it in server.js:
 *   const exportRoutes = require('./routes/export');
 *   app.use('/api/export', exportRoutes);
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { buildVaultExport } = require('../lib/vault-export');

const router = express.Router();

async function gatherRecord(userId) {
  const u = await db.query('SELECT * FROM users WHERE id=$1', [userId]);
  const user = u.rows[0];
  if (!user) throw new Error('user not found');

  const a = await db.query(
    'SELECT vitality_score, top_focus_areas_json FROM assessment_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  const assessment = a.rows[0]
    ? { vitality_score: a.rows[0].vitality_score, top_focus_areas: a.rows[0].top_focus_areas_json || [] }
    : null;

  const c = await db.query('SELECT * FROM contributions WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [userId]);
  const m = await db.query('SELECT role, content, created_at, model FROM luca_messages WHERE user_id=$1 ORDER BY created_at ASC', [userId])
    .catch(() => db.query('SELECT role, content, created_at FROM luca_messages WHERE user_id=$1 ORDER BY created_at ASC', [userId]));
  const cr = await db.query('SELECT * FROM credentials WHERE holder_id=$1 AND deleted_at IS NULL', [userId]).catch(() => ({ rows: [] }));

  return {
    user: {
      id: user.id, email: user.email, full_name: user.full_name, role: user.role,
      did: user.did, nostr_npub: user.nostr_npub, country: user.country, language: user.language,
    },
    assessment,
    contributions: c.rows,
    messages: m.rows,
    credentials: cr.rows,
  };
}

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const record = await gatherRecord(req.user.userId);
    const files = buildVaultExport(record);
    const manifest = JSON.parse(files.find((f) => f.path === 'manifest.json').contents);

    if ((req.query.format || '').toLowerCase() === 'zip') {
      let archiver;
      try { archiver = require('archiver'); }
      catch { return res.status(501).json({ error: "zip export needs `npm i archiver`; JSON export works without it", files }); }
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="luca-vault.zip"');
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (e) => res.status(500).end(String(e)));
      archive.pipe(res);
      for (const f of files) archive.append(f.contents, { name: `luca-vault/${f.path}` });
      return archive.finalize();
    }

    res.json({ manifest, files });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
