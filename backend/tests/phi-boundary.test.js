/**
 * PHI boundary tests (Slice 3) — server-side sensitivity classification and
 * the enforced data-class rule: restricted identifiers never reach an
 * external AI provider. Fully offline.
 */
process.env.LUCA_AI_MODE = 'mock';

const {
  classifySensitivity,
  redactForExternalAI,
  isExternalProvider,
} = require('../src/lib/phi-boundary');

describe('classifySensitivity', () => {
  it('flags SSN-style identifiers', () => {
    expect(classifySensitivity('my ssn is 123-45-6789 ok')).toBe('restricted_identifiers');
  });

  it('flags payment-card-like numbers', () => {
    expect(classifySensitivity('card 4111 1111 1111 1111 please')).toBe('restricted_identifiers');
  });

  it('flags IBANs', () => {
    expect(classifySensitivity('send to DE89370400440532013000')).toBe('restricted_identifiers');
  });

  it('does NOT flag ordinary health talk with small numbers', () => {
    expect(classifySensitivity('I slept 6 hours and my vitality is 72')).toBe('general');
    expect(classifySensitivity('call me at 3pm about my 2 appointments')).toBe('general');
  });
});

describe('redactForExternalAI', () => {
  it('redacts identifiers and counts them, leaving the rest intact', () => {
    const { text, redactions } = redactForExternalAI('ssn 123-45-6789 and card 4111111111111111, I feel tired');
    expect(text).not.toContain('123-45-6789');
    expect(text).not.toContain('4111111111111111');
    expect(text).toContain('[REDACTED:ssn]');
    expect(text).toContain('[REDACTED:card]');
    expect(text).toContain('I feel tired');
    expect(redactions.ssn).toBe(1);
    expect(redactions.card).toBe(1);
  });

  it('is a no-op on clean text', () => {
    const { text, redactions } = redactForExternalAI('how is my sleep trending?');
    expect(text).toBe('how is my sleep trending?');
    expect(Object.keys(redactions)).toHaveLength(0);
  });
});

describe('isExternalProvider (where the boundary sits)', () => {
  it('mock and local stay inside the boundary', () => {
    expect(isExternalProvider({ id: 'mock:luca-reflex-v0' })).toBe(false);
    expect(isExternalProvider({ id: 'local:Qwen2.5-7B-Instruct' })).toBe(false);
  });

  it('abacus / cloud / anthropic cross the boundary and get redaction', () => {
    expect(isExternalProvider({ id: 'abacus:claude-sonnet-4-6' })).toBe(true);
    expect(isExternalProvider({ id: 'openai-compatible:gpt-4o-mini' })).toBe(true);
    expect(isExternalProvider({ id: 'anthropic:claude-sonnet-4-6' })).toBe(true);
  });
});
