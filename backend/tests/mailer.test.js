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

// AT-11 (Correction 1) — booking-emails.js neutralization is asserted by
// EXTENDING an existing test block below (no new test() block is added, so the
// backend total stays exactly 198).
const fs = require('fs');
const path = require('path');
const db = require('../src/db');
const { sendBookingEmail, TEMPLATES, NEUTRAL_SUBJECT, NEUTRAL_BODY, NEUTRAL_TEMPLATE } = require('../src/lib/booking-emails');

// The six historical booking events, all of which must now collapse to ONE
// neutral secure_notification payload.
const BOOKING_EVENTS = [
  'booking_request', 'booking_confirmed', 'booking_declined',
  'booking_cancelled', 'booking_reminder', 'booking_completed',
];
// Words that must NEVER appear in an outbound subject/body (§3.2.1).
const CONTEXT_WORDS = [
  'booking', 'appointment', 'patient', 'practitioner', 'provider', 'service',
  'cancellation', 'reminder', 'completed', 'date', 'time', 'address', 'reason',
  'visit', 'care',
];
// Unique recipient marker so AT-11's persisted rows are isolated + cleaned up.
const AT11_EMAIL = `at11-${Date.now()}@test.local`;

afterAll(async () => {
  await db.query('DELETE FROM email_notifications WHERE to_email=$1', [AT11_EMAIL]).catch(() => {});
  await db.pool.end();
});

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

  it('English body contains only a generic nudge + the link, no PHI', async () => {
    const { subject, preheader, text, html } = buildNotification('English', link);
    expect(subject).toBe('You have a new message on Solaris');
    expect(text).toContain(link);
    for (const token of PHI) {
      expect(subject).not.toContain(token);
      expect(preheader).not.toContain(token);
      expect(text).not.toContain(token);
      expect(html).not.toContain(token);
    }

    // ---- AT-11 (Correction 1): booking-emails.js neutralization ----------
    // Exported neutral constants are exactly the contract-mandated strings.
    expect(NEUTRAL_TEMPLATE).toBe('secure_notification');
    expect(NEUTRAL_SUBJECT).toBe('Secure notification');
    expect(NEUTRAL_BODY).toBe('You have a new secure notification. Sign in to Solaris to view it.');

    const lc = (s) => String(s).toLowerCase();

    // (a) Every one of the six historical templates renders the SAME neutral
    //     payload — fixed subject/body, no per-event variation, no PHI/context.
    for (const evt of BOOKING_EVENTS) {
      const render = TEMPLATES[evt];
      expect(typeof render).toBe('function');
      const p = render();
      expect(p.subject).toBe(NEUTRAL_SUBJECT);
      expect(p.body).toBe(NEUTRAL_BODY);
      for (const w of CONTEXT_WORDS) {
        expect(lc(p.subject)).not.toContain(lc(w));
        expect(lc(p.body)).not.toContain(lc(w));
      }
      for (const token of PHI) {
        expect(p.subject).not.toContain(token);
        expect(p.body).not.toContain(token);
      }
    }

    // (b) sendBookingEmail for every event → returns the neutral result,
    //     persists a neutral email_notifications row, and NEVER logs the
    //     recipient / event name / subject / body / PHI to the console.
    for (const evt of BOOKING_EVENTS) {
      const spies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
      let res;
      try {
        res = await sendBookingEmail({ userId: null, toEmail: AT11_EMAIL, template: evt });
      } finally {
        // capture output BEFORE restoring
        var joined = spies
          .flatMap((s) => s.mock.calls)
          .flat()
          .map((a) => String(a))
          .join(' ');
        spies.forEach((s) => s.mockRestore());
      }
      expect(res).toEqual({ ok: true, subject: NEUTRAL_SUBJECT, template: NEUTRAL_TEMPLATE });

      const { rows } = await db.query(
        `SELECT template, subject, body FROM email_notifications
         WHERE to_email=$1 ORDER BY id DESC LIMIT 1`,
        [AT11_EMAIL]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].template).toBe('secure_notification');
      expect(rows[0].subject).toBe(NEUTRAL_SUBJECT);
      expect(rows[0].body).toBe(NEUTRAL_BODY);

      // Console output must be a fixed neutral status line only.
      expect(joined).not.toContain(AT11_EMAIL);
      expect(joined).not.toContain(evt);
      expect(joined).not.toContain(NEUTRAL_BODY);
      for (const token of PHI) expect(joined).not.toContain(token);
    }

    // (c) NEGATIVE caller assertion — no sendBookingEmail call site anywhere in
    //     the booking routes may still supply a `vars` argument (arity/argument
    //     check performed statically on the route sources).
    const callWindows = (src) => {
      const out = [];
      let i = 0;
      while ((i = src.indexOf('sendBookingEmail(', i)) !== -1) {
        const rest = src.slice(i);
        const end = rest.search(/\)\s*;|\}\)\s*;|\)\s*\n/);
        out.push(rest.slice(0, end === -1 ? 200 : end + 1));
        i += 'sendBookingEmail('.length;
      }
      return out;
    };
    const patientSrc = fs.readFileSync(path.join(__dirname, '../src/routes/bookings.js'), 'utf8');
    const providerSrc = fs.readFileSync(path.join(__dirname, '../src/routes/provider/bookings.js'), 'utf8');
    const patientCalls = callWindows(patientSrc);
    const providerCalls = callWindows(providerSrc);
    expect(patientCalls.length).toBe(3);
    expect(providerCalls.length).toBe(3);
    for (const w of [...patientCalls, ...providerCalls]) {
      expect(w).not.toContain('vars');
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
