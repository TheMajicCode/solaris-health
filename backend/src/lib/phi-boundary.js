'use strict';
/**
 * PHI boundary — server-side sensitivity classification and the first enforced
 * data-class rule (Slice 3).
 *
 * POLICY (v0): government / financial identifiers (SSN-style numbers, payment
 * card numbers, IBANs) must NEVER leave the platform boundary toward an
 * external AI provider. Health context itself is allowed to flow to the
 * configured provider under the member's own-query consent basis — that is
 * what LUCA is for — but raw identifiers add breach blast-radius with zero
 * coaching value, so they are redacted from the outbound prompt.
 *
 * The member's own stored record is untouched (their message is theirs);
 * only the copy sent to a REMOTE model is redacted.
 */

const RESTRICTED_PATTERNS = [
  // US-style SSN: 123-45-6789 (with separators, so we don't eat ordinary numbers)
  { label: 'ssn', re: /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g },
  // Payment-card-like: 13–16 digits, allowing space/dash groups of 4
  { label: 'card', re: /\b(?:\d[ -]?){13,16}\b(?=[^\d]|$)/g },
  // IBAN: 2 letters + 2 digits + 11–30 alphanumerics
  { label: 'iban', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
];

/**
 * Classify text sensitivity. Returns:
 *  - 'restricted_identifiers' — contains identifiers external models must not see
 *  - 'general'                — no restricted identifiers detected
 * (Health content is classified by ROUTE, not by regex — every LUCA member
 *  message is treated as health_context regardless of wording.)
 */
function classifySensitivity(text) {
  const s = String(text || '');
  for (const { re } of RESTRICTED_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(s)) return 'restricted_identifiers';
  }
  return 'general';
}

/**
 * Redact restricted identifiers for external-model use.
 * Returns { text, redactions } where redactions counts replacements by label.
 */
function redactForExternalAI(text) {
  let out = String(text || '');
  const redactions = {};
  for (const { label, re } of RESTRICTED_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, () => {
      redactions[label] = (redactions[label] || 0) + 1;
      return `[REDACTED:${label}]`;
    });
  }
  return { text: out, redactions };
}

/** True when this provider instance sends data off-box (external boundary). */
function isExternalProvider(ai) {
  const provider = String((ai && ai.id) || '').split(':')[0];
  return provider !== 'mock' && provider !== 'local';
}

module.exports = { classifySensitivity, redactForExternalAI, isExternalProvider, RESTRICTED_PATTERNS };
