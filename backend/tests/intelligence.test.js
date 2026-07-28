/**
 * Intelligence section tests (spec A3).
 *
 * Proves:
 *   • GET /api/intelligence/context returns the three panes (natural,
 *     artificial, enhanced) with warm empty states for a brand-new member.
 *   • The Artificial pane reflects the REAL buildContext sources with counts,
 *     the never-list, and NEVER any raw PHI (only counts / labels / names).
 *   • Toggling a source off persists a row keyed by the Solaris subject id and
 *     measurably changes what buildContext feeds LUCA (source dropped from the
 *     prompt, still recorded as included:false).
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const lucaRouter = require('../src/routes/luca');
const { subjectIdForUser } = require('../src/lib/identity');
const { saveFoundational } = require('../src/lib/foundational');
const { getExclusions } = require('../src/lib/intelligence');

let token;
let userId;

beforeAll(async () => {
  process.env.LUCA_AI_MODE = 'mock';
  const res = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  token = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  if (userId) {
    const subj = await subjectIdForUser(userId).catch(() => null);
    if (subj) {
      await db.query('DELETE FROM intelligence_exclusions WHERE subject_id=$1', [subj]);
      await db.query('DELETE FROM foundational_health_data WHERE subject_id=$1', [subj]);
    }
    await db.query('DELETE FROM users WHERE id=$1', [userId]);
  }
  await db.pool.end();
});

describe('GET /api/intelligence/context', () => {
  it('returns three panes with warm empty states for a new member', async () => {
    const res = await request(app)
      .get('/api/intelligence/context')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.natural)).toBe(true);
    expect(res.body.artificial).toBeTruthy();
    expect(Array.isArray(res.body.enhanced)).toBe(true);

    // Artificial pane: real sources array + never-list, no hardcoding.
    expect(Array.isArray(res.body.artificial.sources)).toBe(true);
    expect(res.body.artificial.sources.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.artificial.neverList)).toBe(true);
    expect(res.body.artificial.neverList.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.artificial.exclusions)).toBe(true);

    // A new member should still get an "open questions" nudge on the Natural pane.
    expect(res.body.natural.some((n) => n.shelf === 'Open questions')).toBe(true);
  });

  it('never leaks raw PHI in the Artificial pane (counts/labels only)', async () => {
    // Seed a foundational profile with a distinctive PHI value.
    await saveFoundational(db, {
      userId,
      responses: { systemic_conditions: 'PHI_SECRET_CONDITION_XYZ', medications_supplements: 'PHI_SECRET_MED_ABC' },
    });
    const res = await request(app)
      .get('/api/intelligence/context')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const artificialBlob = JSON.stringify(res.body.artificial);
    expect(artificialBlob).not.toContain('PHI_SECRET_CONDITION_XYZ');
    expect(artificialBlob).not.toContain('PHI_SECRET_MED_ABC');
    // The foundational source is present with a count, not the value.
    const fnd = res.body.artificial.sources.find((s) => s.key === 'foundational');
    expect(fnd).toBeTruthy();
    expect(typeof fnd.count).toBe('number');
    expect(fnd.count).toBeGreaterThan(0);
    expect(fnd.included).toBe(true);
  });
});

describe('PUT /api/intelligence/exclusions', () => {
  it('persists an exclusion row keyed by subject id and filters buildContext', async () => {
    // Baseline: foundational is included in the real context.
    const before = {};
    await lucaRouter.buildContext(userId, before);
    const fndBefore = (before.sources || []).find((s) => s.key === 'foundational');
    expect(fndBefore).toBeTruthy();
    expect(fndBefore.included).toBe(true);

    // Toggle foundational OFF.
    const put = await request(app)
      .put('/api/intelligence/exclusions')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'foundational', excluded: true });
    expect(put.status).toBe(200);
    expect(put.body.excluded).toBe(true);

    // A row exists, keyed by the Solaris subject id (never email/vendor id).
    const subj = await subjectIdForUser(userId);
    const row = await db.query(
      'SELECT * FROM intelligence_exclusions WHERE subject_id=$1 AND excluded_source=$2',
      [subj, 'foundational']
    );
    expect(row.rows.length).toBe(1);

    // buildContext now DROPS foundational from the prompt (recorded included:false).
    const excluded = await getExclusions(db, userId);
    const after = { excluded };
    const prompt = await lucaRouter.buildContext(userId, after);
    const fndAfter = after.sources.find((s) => s.key === 'foundational');
    expect(fndAfter.included).toBe(false);
    expect(prompt).not.toContain('FOUNDATIONAL HEALTH PROFILE');

    // Toggle back ON removes the row and restores the source.
    const putOn = await request(app)
      .put('/api/intelligence/exclusions')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'foundational', excluded: false });
    expect(putOn.status).toBe(200);
    const rowGone = await db.query(
      'SELECT * FROM intelligence_exclusions WHERE subject_id=$1 AND excluded_source=$2',
      [subj, 'foundational']
    );
    expect(rowGone.rows.length).toBe(0);
  });

  it('rejects an unknown or non-excludable source', async () => {
    const res = await request(app)
      .put('/api/intelligence/exclusions')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'directory', excluded: true });
    expect(res.status).toBe(400);
  });
});
