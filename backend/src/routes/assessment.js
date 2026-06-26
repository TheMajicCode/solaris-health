const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { award } = require('../lib/helpers');

const router = express.Router();

const SYSTEM_NAMES = {
  bioelectrical: 'Bioelectrical',
  hydration: 'Hydration',
  circadian: 'Circadian Rhythm',
  microbiome: 'Microbiome',
  respiratory: 'Respiratory',
  neurological: 'Neurological',
  cardiovascular: 'Cardiovascular',
  nutritional: 'Nutritional',
};
const ASPECT_NAMES = {
  mental: 'Mental', emotional: 'Emotional', physical: 'Physical', spiritual: 'Spiritual',
};

function band(score) {
  if (score >= 80) return 'thriving';
  if (score >= 60) return 'balanced';
  if (score >= 40) return 'attention';
  return 'priority';
}

// GET active template with questions
router.get('/template', authMiddleware, async (req, res) => {
  try {
    const t = await db.query("SELECT * FROM assessment_templates WHERE status='active' ORDER BY created_at DESC LIMIT 1");
    if (t.rows.length === 0) return res.json({ template: null, questions: [] });
    const q = await db.query('SELECT * FROM assessment_questions WHERE template_id=$1 ORDER BY sort_order ASC', [t.rows[0].id]);
    res.json({ template: t.rows[0], questions: q.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST submit assessment
// body: { aspects: {mental,emotional,physical,spiritual}, systems: {key:0..100}, answers:[{questionId,systemKey,aspectKey,value}] }
router.post('/submit', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  try {
    const { aspects = {}, systems = {}, answers = [] } = req.body;
    const tpl = await db.query("SELECT id FROM assessment_templates WHERE status='active' ORDER BY created_at DESC LIMIT 1");
    const templateId = tpl.rows[0]?.id || null;

    const aspectVals = Object.values(aspects).map(Number).filter((n) => !isNaN(n));
    const systemVals = Object.values(systems).map(Number).filter((n) => !isNaN(n));
    const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    const vitality = Math.round((avg(aspectVals) * 0.5) + (avg(systemVals) * 0.5));

    // Top focus areas = lowest scoring systems + aspects
    const combined = [
      ...Object.entries(systems).map(([k, v]) => ({ key: k, name: SYSTEM_NAMES[k] || k, score: Number(v), type: 'system' })),
      ...Object.entries(aspects).map(([k, v]) => ({ key: k, name: ASPECT_NAMES[k] || k, score: Number(v), type: 'aspect' })),
    ].sort((a, b) => a.score - b.score);
    const topFocus = combined.slice(0, 3);

    const summary = {
      headline: vitality >= 70 ? 'You are thriving with room to optimize'
        : vitality >= 50 ? 'A solid foundation with clear growth areas'
        : 'Your body is asking for support — and that is okay',
      strengths: combined.slice(-2).map((c) => c.name),
      focus: topFocus.map((c) => c.name),
    };

    const resp = await db.query(
      `INSERT INTO assessment_responses
        (user_id, template_id, completed_at, raw_score, vitality_score, mental_score, emotional_score, physical_score, spiritual_score, summary_json, top_focus_areas_json)
       VALUES ($1,$2,now(),$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [userId, templateId, vitality, vitality,
        Math.round(aspects.mental || 0), Math.round(aspects.emotional || 0),
        Math.round(aspects.physical || 0), Math.round(aspects.spiritual || 0),
        JSON.stringify(summary), JSON.stringify(topFocus)]
    );
    const responseId = resp.rows[0].id;

    // Store body system scores
    for (const [key, val] of Object.entries(systems)) {
      const score = Math.round(Number(val));
      await db.query(
        `INSERT INTO body_system_scores (response_id,user_id,system_key,system_name,score,severity_band)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [responseId, userId, key, SYSTEM_NAMES[key] || key, score, band(score)]
      );
    }
    // Store aspect scores
    for (const [key, val] of Object.entries(aspects)) {
      const score = Math.round(Number(val));
      await db.query(
        `INSERT INTO aspect_scores (response_id,user_id,aspect_key,aspect_name,score)
         VALUES ($1,$2,$3,$4,$5)`,
        [responseId, userId, key, ASPECT_NAMES[key] || key, score]
      );
    }
    // Store raw answers
    for (const a of answers) {
      await db.query(
        `INSERT INTO assessment_answers (response_id,question_id,system_key,aspect_key,answer_number,normalized_score)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [responseId, a.questionId || null, a.systemKey || null, a.aspectKey || null, a.value ?? null, a.value ?? null]
      );
    }

    // Generate recommendations: link lowest systems to matching listings
    const recs = [];
    for (const f of topFocus) {
      // habit rec
      const habitMap = {
        hydration: 'Increase water intake to 2.5L with morning electrolytes',
        circadian: 'Get 10 minutes of morning sunlight within 30 min of waking',
        respiratory: 'Practice 5 minutes of box breathing before bed',
        neurological: 'Add a 10-minute screen-free wind-down each night',
        nutritional: 'Build each meal around protein + colorful vegetables',
        cardiovascular: 'Take a brisk 20-minute walk after your largest meal',
        microbiome: 'Add one fermented food to your daily routine',
        bioelectrical: 'Ground barefoot outdoors for 10 minutes daily',
        mental: 'Try a 5-minute focus breathing reset midday',
        emotional: 'Journal 3 lines of gratitude each evening',
        physical: 'Move your body gently for 20 minutes today',
        spiritual: 'Spend 10 quiet minutes in reflection or nature',
      };
      recs.push({ type: 'habit', title: habitMap[f.key] || `Support your ${f.name.toLowerCase()}`, focus: f.key });
    }
    for (const r of recs) {
      await db.query(
        `INSERT INTO recommendations (user_id,response_id,source_type,recommendation_type,title,priority)
         VALUES ($1,$2,'rules',$3,$4,$5)`,
        [userId, responseId, r.type, r.title, 1]
      );
    }
    // Match a practitioner + workshop by focus systems
    const focusKeys = topFocus.map((f) => f.key);
    const matches = await db.query(
      `SELECT * FROM listings WHERE status='published'
       AND (listing_type IN ('practitioner','workshop','service'))
       ORDER BY featured DESC, rating DESC LIMIT 3`
    );
    for (const m of matches.rows) {
      await db.query(
        `INSERT INTO recommendations (user_id,response_id,source_type,recommendation_type,title,description,linked_listing_id,priority)
         VALUES ($1,$2,'rules',$3,$4,$5,$6,2)`,
        [userId, responseId, m.listing_type, m.title, m.short_description, m.id]
      );
    }

    // Mark onboarding complete + award points
    await db.query("UPDATE users SET onboarding_status='complete', current_phase='active' WHERE id=$1", [userId]);
    await award(userId, 'assessment_complete', 50, 'onboarding', 'Completed the Solaris Method assessment');
    await award(userId, 'onboarding_complete', 25, 'onboarding', 'Completed onboarding journey');

    res.json({ response: resp.rows[0], vitality, topFocus, summary });
  } catch (err) {
    console.error('Assessment submit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET latest results (unified 360 health)
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM assessment_responses WHERE user_id=$1 ORDER BY completed_at DESC NULLS LAST, created_at DESC LIMIT 1', [req.user.userId]);
    if (r.rows.length === 0) return res.json({ response: null });
    const responseId = r.rows[0].id;
    const systems = await db.query('SELECT * FROM body_system_scores WHERE response_id=$1', [responseId]);
    const aspects = await db.query('SELECT * FROM aspect_scores WHERE response_id=$1', [responseId]);
    const recs = await db.query('SELECT * FROM recommendations WHERE response_id=$1 ORDER BY priority ASC', [responseId]);
    res.json({ response: r.rows[0], systems: systems.rows, aspects: aspects.rows, recommendations: recs.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET history (for trends)
router.get('/history', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT id, vitality_score, completed_at, created_at FROM assessment_responses WHERE user_id=$1 ORDER BY created_at ASC', [req.user.userId]);
  res.json({ history: r.rows });
});

module.exports = router;
