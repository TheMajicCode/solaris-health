'use strict';
/**
 * The original rule-based reply, preserved as a zero-cost offline fallback (LUCA_AI_MODE=mock).
 * Used automatically if a cloud/anthropic key is missing, so the demo never hard-fails.
 * Non-diagnostic by construction.
 */
function createMockReply(prompt, context) {
  const m = (prompt || '').toLowerCase();
  // context carries the coach context block; pull vitality/focus if present
  const vitality = (context.match(/vitality[^0-9]*(\d+)/i) || [])[1];
  const focus = (context.match(/focus areas?:\s*([^\n]+)/i) || [])[1] || '';

  if (/sleep|tired|rest|insomnia/.test(m))
    return `Sleep is foundational. Try 10 minutes of morning sunlight and a screen-free wind-down tonight.${vitality ? ` Your vitality is ${vitality}/100 — sleep is one of the fastest ways to raise it.` : ''} Want me to suggest a Sleep Foundations workshop?`;
  if (/hydrat|water|thirsty/.test(m))
    return `Hydration touches nearly every body system. Aim for ~2.5L today, with a pinch of mineral salt in the morning. I can log this as a daily habit.`;
  if (/stress|anxious|anxiety|overwhelm/.test(m))
    return `When the nervous system is activated, slow breathing helps most. Try box breathing — inhale 4, hold 4, exhale 4, hold 4, for 5 rounds. A breathwork guide could be a gentle next step.`;
  if (/score|vitality|result/.test(m))
    return vitality
      ? `Your vitality score is ${vitality}/100. Top focus areas: ${focus || 'balanced across the board'}. Small consistent habits there move the needle fastest.`
      : `Complete your Solaris Method assessment and I'll interpret your full 360° picture.`;
  if (/practitioner|doctor|book|appointment|aura|find/.test(m))
    return `I can help you find the right guide. Based on your assessment I'd look at practitioners focused on ${focus || 'whole-body wellness'} — and Aura is a strong fit for holistic, minimally-invasive care. Head to Explore and I'll highlight matches.`;
  if (/hi|hello|hey|morning|good/.test(m))
    return `Good to see you.${vitality ? ` Let's keep building momentum in ${focus}.` : ` Let's begin — your body is speaking, and I'm here to help you listen.`} What would you like to focus on today?`;
  return `I hear you. I'm your wellness concierge — here to guide, educate, and connect you with the right care (never to diagnose).${focus ? ` Right now your body is asking for support in: ${focus}.` : ''} Want some gentle next steps?`;
}

module.exports = { createMockReply };
