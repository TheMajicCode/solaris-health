/**
 * M3 — "Add health data" provenance + de-identification tests.
 *
 * Verifies the cross-cutting invariants (A3 §4 provenance ladder, PHI boundary):
 *   - Every member-shared health fact carries level / source / observed_at /
 *     consent_scope and is stamped with the member's Solaris subject_id.
 *   - A member-marked lab/test result is stored at L4 (self-sourced, pending
 *     verification); a plain note defaults to L0/self.
 *   - Free text is de-identified before it can reach a (cloud) model.
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { deidentify } = require('../src/routes/health-documents');

describe('health-data provenance + de-identification', () => {
  let token;
  let userId;
  let subjectId;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
    const s = await db.query('SELECT subject_id FROM solaris_subjects WHERE user_id=$1', [userId]);
    subjectId = s.rows[0] && s.rows[0].subject_id;
  });

  afterAll(async () => {
    if (userId) {
      await db.query('DELETE FROM health_documents WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('de-identifies email, phone and long ID runs, plus the member name', () => {
    const scrubbed = deidentify(
      'Contact Jane Doe at jane@example.com or 555-123-4567, MRN 00123456',
      { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' }
    );
    expect(scrubbed).not.toMatch(/jane@example\.com/i);
    expect(scrubbed).not.toMatch(/555-123-4567/);
    expect(scrubbed).not.toMatch(/00123456/);
    expect(scrubbed).not.toMatch(/Jane/i);
    expect(scrubbed).toMatch(/\[email\]/);
  });

  it('stamps L0/self provenance + subject_id on a plain note', async () => {
    const res = await request(app)
      .post('/api/health-documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'I have felt tired in the afternoons lately.' })
      .expect(200);
    const doc = res.body.document;
    expect(doc.provenance_level).toBe(0);
    expect(doc.source).toBe('self');
    expect(doc.consent_scope).toBe('private');
    expect(doc.observed_at).toBeTruthy();
    const row = await db.query('SELECT subject_id FROM health_documents WHERE id=$1', [doc.id]);
    expect(row.rows[0].subject_id).toBe(subjectId);
  });

  it('stores a member-marked lab result at L4 (pending verification)', async () => {
    const res = await request(app)
      .post('/api/health-documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Ferritin 18 ng/mL from my recent panel.', level: 4, docType: 'upload', observedAt: '2026-05-01' })
      .expect(200);
    const doc = res.body.document;
    expect(doc.provenance_level).toBe(4);
    expect(doc.source).toBe('self');
    expect(new Date(doc.observed_at).getUTCFullYear()).toBe(2026);
  });

  it('clamps an out-of-range level to the 0..5 ladder', async () => {
    const res = await request(app)
      .post('/api/health-documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Test clamp.', level: 99 })
      .expect(200);
    expect(res.body.document.provenance_level).toBe(5);
  });
});
