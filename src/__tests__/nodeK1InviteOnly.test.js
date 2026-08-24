/**
 * NODE K1.1 — §3 invite-only Beta boundary (frontend welcome/access screen).
 *
 * Source-contract assertions on src/flows/Auth.jsx. As of K1.1 the invite-only
 * boundary and waitlist URL are NO LONGER read from a build-time env constant.
 * They come from the public /api/config endpoint (api.getPublicConfig) so the
 * welcome screen and the server /register 403 gate share one runtime source of
 * truth. These assertions prove:
 *   - the welcome screen fetches public config and derives inviteOnly/waitlistUrl,
 *   - the "Beta · Invite only" badge renders only when inviteOnly is true,
 *   - the "Join the waitlist" CTA renders only when inviteOnly AND a validated
 *     absolute http(s) URL are present (never a hardcoded private/temp URL),
 *   - public account creation is hidden when inviteOnly is true,
 *   - no hardcoded absolute URL leaks into the waitlist CTA.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import en from '../lib/i18n/en.js';

const SRC = fs.readFileSync(path.resolve(__dirname, '../flows/Auth.jsx'), 'utf8');

describe('§3 invite-only Beta boundary — Auth.jsx welcome screen (config-driven)', () => {
  it('fetches public config at runtime and derives inviteOnly / waitlistUrl', () => {
    // Runtime config, not a build-time env constant.
    expect(SRC).toMatch(/api\.getPublicConfig/);
    expect(SRC).toMatch(/const \[publicConfig, setPublicConfig\] = useState\(/);
    expect(SRC).toMatch(/const inviteOnly = publicConfig\.inviteOnly/);
    expect(SRC).toMatch(/const waitlistUrl = publicConfig\.waitlistUrl/);
    // The old build-time env constant must be gone.
    expect(SRC).not.toMatch(/import\.meta\.env\.VITE_WAITLIST_URL/);
  });

  it('defaults to invite-only:true (fail-safe) before/around config load', () => {
    expect(SRC).toMatch(/useState\(\{\s*inviteOnly:\s*true/);
    // Missing/false inviteOnly from config is treated as invite-only.
    expect(SRC).toMatch(/inviteOnly:\s*cfg\.inviteOnly\s*!==\s*false/);
  });

  it('only accepts an absolute http(s) waitlist URL from config', () => {
    expect(SRC).toMatch(/\^https\?:\\\/\\\//);
  });

  it('displays a "Beta · Invite only" badge only when invite-only is on', () => {
    // K1.2: the badge copy is now localized via t('auth.welcome.betaBadge') — the
    // gated render + badge class stay in source; the reviewed English copy lives in
    // the catalog (parity with es is enforced by i18n.locale.test.jsx).
    expect(SRC).toMatch(/\{inviteOnly && \(/);
    expect(SRC).toMatch(/ob-beta-badge/);
    expect(SRC).toMatch(/t\('auth\.welcome\.betaBadge'\)/);
    expect(en['auth.welcome.betaBadge']).toMatch(/Beta ·\s*Invite only/);
  });

  it('renders "Join the waitlist" ONLY when invite-only AND a URL are present', () => {
    // Guarded render: {inviteOnly && waitlistUrl && (<a ... href={waitlistUrl} ...>)}
    expect(SRC).toMatch(/\{inviteOnly && waitlistUrl &&/);
    expect(SRC).toMatch(/href=\{waitlistUrl\}/);
    expect(SRC).toMatch(/t\('error\.register\.inviteWaitlistCta'\)/);
    expect(en['error.register.inviteWaitlistCta']).toMatch(/Join the waitlist/);
    expect(SRC).toMatch(/target="_blank"[\s\S]*rel="noopener noreferrer"/);
  });

  it('hides public account creation when invite-only is on', () => {
    expect(SRC).toMatch(/\{!inviteOnly && \(/);
    expect(SRC).toMatch(/t\('auth\.welcome\.createAccount'\)/);
    expect(en['auth.welcome.createAccount']).toMatch(/Create a Solaris account/i);
  });

  it('states the invite-only boundary and keeps sign-in available for invited members', () => {
    // Copy is localized via t('auth.welcome.inviteNote'); source wires the key and
    // the reviewed English copy states the boundary and that sign-in stays available.
    expect(SRC).toMatch(/t\('auth\.welcome\.inviteNote'\)/);
    expect(en['auth.welcome.inviteNote']).toMatch(/invite-only Beta/i);
    expect(en['auth.welcome.inviteNote']).toMatch(/Invited members can sign in/i);
  });

  it('does NOT hardcode any absolute solaris/marketing URL in the waitlist CTA', () => {
    const anchor = SRC.match(/<a className="ob-waitlist"[\s\S]*?<\/a>/);
    expect(anchor).toBeTruthy();
    expect(anchor[0]).not.toMatch(/https?:\/\//);
  });
});
