const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Rule-based LUCA concierge (non-diagnostic). OpenAI can be wired later via OPENAI_API_KEY.
function generateReply(message, ctx) {
  const m = (message || '').toLowerCase();
  const focus = (ctx.topFocus || []).map((f) => f.name).join(', ');
  const vitality = ctx.vitality;

  if (/sleep|tired|rest|insomnia/.test(m))
    return `Sleep is foundational to your Circadian rhythm. Try getting 10 minutes of morning sunlight and a screen-free wind-down tonight. ${vitality ? `Your current vitality score is ${vitality}/100 — improving sleep is one of the fastest ways to raise it.` : ''} Would you like me to suggest a Sleep Foundations workshop?`;
  if (/hydrat|water|thirsty/.test(m))
    return `Hydration affects nearly every body system. Aim for 2.5L today, and add a pinch of mineral salt in the morning to support absorption. I can log this as a daily habit if you'd like.`;
  if (/stress|anxious|anxiety|overwhelm/.test(m))
    return `When the nervous system is activated, slow breathing helps most. Try box breathing: inhale 4, hold 4, exhale 4, hold 4 — for 5 rounds. A breathwork guide in Explore could be a beautiful next step.`;
  if (/score|vitality|result/.test(m))
    return vitality
      ? `Your vitality score is ${vitality}/100. Your top focus areas right now are: ${focus || 'balanced across the board'}. Small, consistent habits in these areas will move the needle the fastest.`
      : `Complete your Solaris Method assessment and I'll be able to interpret your full 360° health picture.`;
  if (/practitioner|doctor|book|appointment|help me find/.test(m))
    return `I can help you find the right guide. Based on your assessment, I'd look at practitioners who focus on ${focus || 'whole-body wellness'}. Head to Explore and I'll highlight the best matches for you.`;
  if (/hi|hello|hey|morning|good/.test(m))
    return `Good to see you. ${vitality ? `Based on your assessment, let's keep building momentum in ${focus}.` : `Let's begin your journey — your body is speaking, and I'm here to help you listen.`} What would you like to focus on today?`;
  return `I hear you. Remember, I'm your wellness concierge — here to guide, educate, and connect you with the right care (never to diagnose). ${focus ? `Right now your body is asking for support in: ${focus}.` : ''} Want some gentle next steps?`;
}

router.get('/messages', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT role,content,created_at FROM luca_messages WHERE user_id=$1 ORDER BY created_at ASC LIMIT 100', [req.user.userId]);
  res.json({ messages: r.rows });
});

router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    await db.query('INSERT INTO luca_messages (user_id,role,content) VALUES ($1,$2,$3)', [req.user.userId, 'user', content]);

    // Build context from latest assessment
    const resp = await db.query('SELECT vitality_score, top_focus_areas_json FROM assessment_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1', [req.user.userId]);
    const ctx = resp.rows[0]
      ? { vitality: resp.rows[0].vitality_score, topFocus: resp.rows[0].top_focus_areas_json }
      : {};
    const reply = generateReply(content, ctx);

    await db.query('INSERT INTO luca_messages (user_id,role,content) VALUES ($1,$2,$3)', [req.user.userId, 'assistant', reply]);
    res.json({ reply });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
