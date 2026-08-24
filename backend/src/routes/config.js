const express = require('express');

const router = express.Router();

/**
 * K1.1 §3 — public, NON-SENSITIVE client config. Single source of truth so the
 * UI and the backend never disagree about the Beta boundary.
 *
 * NO authentication, NO database, NO secrets. Only three booleans/strings are
 * exposed, all read from environment at request time so a flag flip needs no
 * code change and can be asserted deterministically in tests:
 *   - inviteOnly     : mirrors the SAME env the /register 403 gate reads, so the
 *                      welcome screen and the register endpoint can never diverge.
 *   - waitlistUrl    : included ONLY when a real, absolute http(s) URL is
 *                      configured; otherwise the field is omitted entirely (the
 *                      app must not render a placeholder/private link).
 *   - spanishPreview : whether the Spanish preview locale is offered.
 *
 * This endpoint deliberately exposes nothing else — no versions, hostnames,
 * secret names, or internal flags.
 */
function inviteOnlyEnabled() {
  return String(process.env.BETA_INVITE_ONLY || '').trim().toLowerCase() === 'true';
}

function validWaitlistUrl() {
  const raw = String(process.env.BETA_WAITLIST_URL || '').trim();
  return /^https?:\/\/\S+$/i.test(raw) ? raw : null;
}

function spanishPreviewEnabled() {
  return String(process.env.BETA_SPANISH_PREVIEW || '').trim().toLowerCase() === 'true';
}

router.get('/', (req, res) => {
  const out = {
    inviteOnly: inviteOnlyEnabled(),
    spanishPreview: spanishPreviewEnabled(),
  };
  const waitlistUrl = validWaitlistUrl();
  if (waitlistUrl) out.waitlistUrl = waitlistUrl;
  // Never cache a stale flag at the edge; this response is tiny.
  res.set('Cache-Control', 'no-store');
  res.json(out);
});

module.exports = router;
