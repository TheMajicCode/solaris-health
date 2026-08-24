/**
 * NODE K1 — §G invite-only Beta boundary (frontend welcome/access screen).
 *
 * Source-contract assertions on src/flows/Auth.jsx — consistent with the other
 * nodeK1 source-contract tests. They prove the welcome screen shows the invite-
 * only boundary and links to the waitlist via ENV configuration only (never a
 * hardcoded private/temporary URL), and that the CTA is omitted when unconfigured.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(path.resolve(__dirname, '../flows/Auth.jsx'), 'utf8');

describe('§G invite-only Beta boundary — Auth.jsx welcome screen', () => {
  it('displays a "Beta · Invite only" badge', () => {
    expect(SRC).toMatch(/Beta ·\s*Invite only/);
    expect(SRC).toMatch(/ob-beta-badge/);
  });

  it('derives the waitlist URL from VITE_WAITLIST_URL env config (no hardcoded URL)', () => {
    expect(SRC).toMatch(/const WAITLIST_URL[\s\S]*import\.meta\.env\.VITE_WAITLIST_URL/);
    // Only absolute http(s) URLs from config are accepted.
    expect(SRC).toMatch(/\^https\?:\\\/\\\//);
  });

  it('renders "Join the waitlist" as an external link ONLY when a URL is configured', () => {
    // Guarded render: {WAITLIST_URL && (<a ... href={WAITLIST_URL} ...>)}
    expect(SRC).toMatch(/\{WAITLIST_URL &&/);
    expect(SRC).toMatch(/href=\{WAITLIST_URL\}/);
    expect(SRC).toMatch(/Join the waitlist/);
    expect(SRC).toMatch(/target="_blank"[\s\S]*rel="noopener noreferrer"/);
  });

  it('states the invite-only boundary and keeps sign-in available for invited members', () => {
    expect(SRC).toMatch(/invite-only Beta/i);
    expect(SRC).toMatch(/Invited members can sign in/i);
  });

  it('does NOT hardcode any absolute solaris/marketing URL in the waitlist CTA', () => {
    // The anchor must use the env-derived constant, not a literal https URL.
    const anchor = SRC.match(/<a className="ob-waitlist"[\s\S]*?<\/a>/);
    expect(anchor).toBeTruthy();
    expect(anchor[0]).not.toMatch(/https?:\/\//);
  });
});
