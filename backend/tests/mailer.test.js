/**
 * mailer.test.js — de-identified email adapter.
 *
 * Covers:
 *   1. Transport selection precedence (Resend > SMTP > console).
 *   2. PHI boundary: the delivered message carries NO identifying / health
 *      detail — only a generic "new message" nudge and an app deep link.
 *   3. Bilingual copy is chosen from the recipient language.
 */
const { selectTransport, buildNotification, isSpanish } = require('../src/lib/mailer');

const ENV_KEYS = ['RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];

describe('transport selection', () => {
  const saved = {};
  beforeEach(() => { ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; }); });
  afterEach(() => { ENV_KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); });

  it('falls back to console when nothing is configured', () => {
    expect(selectTransport()).toBe('console');
  });

  it('uses SMTP when all four SMTP vars are present', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    expect(selectTransport()).toBe('smtp');
  });

  it('does NOT pick SMTP when a var is missing', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'u';
    // SMTP_PASS missing
    expect(selectTransport()).toBe('console');
  });

  it('prefers Resend over SMTP when both are configured', () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    expect(selectTransport()).toBe('resend');
  });
});

describe('PHI boundary — delivered content is de-identified', () => {
  const link = 'https://solaris-health.abacusai.cloud/';
  // Values that must NEVER appear in a delivered email.
  const PHI = ['Alejandro', 'Sarah', 'nutrition consultation', '2026-08-01', 'diagnosis', 'anxiety', 'Dr.'];

  it('English body contains only a generic nudge + the link, no PHI', () => {
    const { subject, preheader, text, html } = buildNotification('English', link);
    expect(subject).toBe('You have a new message on Solaris');
    expect(text).toContain(link);
    for (const token of PHI) {
      expect(subject).not.toContain(token);
      expect(preheader).not.toContain(token);
      expect(text).not.toContain(token);
      expect(html).not.toContain(token);
    }
  });

  it('Spanish body is localized and equally de-identified', () => {
    const { subject, text } = buildNotification('Spanish', link);
    expect(subject).toBe('Tienes un mensaje nuevo en Solaris');
    expect(text).toContain(link);
    for (const token of PHI) expect(text).not.toContain(token);
  });

  it('the only URL in the body is the app deep link (no tracking/PHI query args)', () => {
    const { text } = buildNotification('English', link);
    const urls = text.match(/https?:\/\/\S+/g) || [];
    expect(urls).toEqual([link]);
  });
});

describe('language detection', () => {
  it('maps Spanish variants to true and English/other to false', () => {
    ['Spanish', 'spanish', 'es', 'ES', 'Español', 'espanol'].forEach((l) => expect(isSpanish(l)).toBe(true));
    ['English', 'en', '', null, undefined, 'French'].forEach((l) => expect(isSpanish(l)).toBe(false));
  });
});
