'use strict';
/**
 * Organizations route (Solaris sprint) — GPS map pins + clinic nodes.
 *   GET /api/organizations       -> list (map pins, dials, geo)
 *   GET /api/organizations/:id   -> single org detail (+ steward, split policy)
 */
const express = require('express');
const db = require('../db');

const router = express.Router();

function shapeOrg(o) {
  return {
    id: o.id,
    name: o.name,
    type: o.type,
    stewardUserId: o.steward_user_id,
    did: o.did,
    npubMock: o.npub_mock,
    communityId: o.community_id,
    dials: {
      health: o.health_dial,
      wealth: o.wealth_dial,
      sovereignty: o.sovereignty_dial,
    },
    lat: o.lat,
    lng: o.lng,
    visibility: o.visibility,
    description: o.description,
    services: o.services || [],
    createdAt: o.created_at,
  };
}

// GET /api/organizations  (?visibility=public|discoverable&type=clinic)
router.get('/', async (req, res) => {
  try {
    const { visibility, type } = req.query;
    const clauses = [];
    const params = [];
    if (visibility) { params.push(visibility); clauses.push(`visibility = $${params.length}`); }
    if (type) { params.push(type); clauses.push(`type = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT * FROM organizations ${where} ORDER BY name ASC`,
      params
    );
    res.json({ organizations: result.rows.map(shapeOrg) });
  } catch (err) {
    console.error('organizations list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/organizations/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM organizations WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Organization not found' });
    const org = shapeOrg(result.rows[0]);

    // Steward identity (public-safe fields)
    let steward = null;
    if (result.rows[0].steward_user_id) {
      const s = await db.query(
        'SELECT id, display_name, full_name, nostr_npub, role FROM users WHERE id = $1',
        [result.rows[0].steward_user_id]
      );
      if (s.rows.length) {
        steward = {
          id: s.rows[0].id,
          name: s.rows[0].display_name || s.rows[0].full_name,
          npub: s.rows[0].nostr_npub,
          role: s.rows[0].role,
        };
      }
    }

    // Active split policy (if any)
    const pol = await db.query(
      `SELECT id, name, recipients FROM split_policies_v2
       WHERE owner_org_id = $1 AND active = TRUE ORDER BY updated_at DESC LIMIT 1`,
      [org.id]
    );
    let splitPolicy = null;
    if (pol.rows.length) {
      const recipients = typeof pol.rows[0].recipients === 'string'
        ? JSON.parse(pol.rows[0].recipients) : pol.rows[0].recipients;
      splitPolicy = { id: pol.rows[0].id, name: pol.rows[0].name, recipients };
    }

    res.json({ organization: org, steward, splitPolicy });
  } catch (err) {
    console.error('organization detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
