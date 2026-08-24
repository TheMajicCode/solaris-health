/**
 * NODE K1.1 — §5 practical Spanish preview.
 *
 * Proves the ordinary (non-clinical) strings added to the preview are:
 *  - present in BOTH catalogs (parity is also enforced by i18n.locale.test.jsx);
 *  - genuinely translated in es (not identical English), except proper nouns;
 *  - wired into the always-visible member chrome (bottom nav, LUCA collapse
 *    controls, Communications message filters, dashboard LUCA cards) via t().
 * Safety/clinical keys are intentionally NOT asserted here — they remain
 * reviewed English by policy (see i18n.locale.test.jsx safety-blocker test).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../lib/i18n/en.js';
import es from '../lib/i18n/es.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

// The ordinary keys this node added / relies on for the preview chrome.
const PREVIEW_KEYS = [
  'nav.dashboard', 'nav.health', 'nav.coach', 'nav.economic', 'nav.journal', 'nav.media',
  'nav.explore', 'nav.communications', 'nav.messages', 'nav.bookings', 'nav.clients', 'nav.more',
  'action.expand', 'action.collapse',
  'msg.filterAll', 'msg.filterBookings', 'msg.filterUnread',
  'dash.lucaRecommends', 'dash.personalizedForYou', 'dash.curatedJourney',
];
// Proper nouns / brand tokens that are legitimately identical across locales.
const SAME_IN_BOTH = new Set(['nav.coach', 'lang.english', 'lang.spanish']);

describe('§5 ordinary preview keys exist in both catalogs', () => {
  it('every preview key resolves in en and es', () => {
    for (const k of PREVIEW_KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(es[k], `es missing ${k}`).toBeTruthy();
    }
  });
  it('es values are actually translated (differ from en), except proper nouns', () => {
    for (const k of PREVIEW_KEYS) {
      if (SAME_IN_BOTH.has(k)) continue;
      expect(es[k], `es[${k}] should differ from en`).not.toBe(en[k]);
    }
  });
});

describe('§5 preview keys are wired into the member chrome via t()', () => {
  const passport = read('../components/LucaPassport.jsx');
  const securechat = read('../components/SecureChat.jsx');

  it('bottom nav resolves labels through a locale key map', () => {
    expect(passport).toMatch(/BOTTOM_NAV_LABEL_KEYS/);
    expect(passport).toMatch(/navLabel\(it\)/);
    // and the map covers the member destinations
    for (const key of ['nav.health', 'nav.economic', 'nav.coach', 'nav.explore', 'nav.communications']) {
      expect(passport).toContain(`'${key}'`);
    }
  });

  it('LUCA collapse/expand controls use action.expand / action.collapse', () => {
    expect(passport).toMatch(/tl\('action\.expand'/);
    expect(passport).toMatch(/tl\('action\.collapse'/);
  });

  it('dashboard LUCA cards use the dash.* keys', () => {
    expect(passport).toMatch(/tl\('dash\.lucaRecommends'/);
    expect(passport).toMatch(/tl\('dash\.personalizedForYou'/);
    expect(passport).toMatch(/tl\('dash\.curatedJourney'/);
  });

  it('Communications message filters resolve through msg.filter* keys', () => {
    expect(securechat).toMatch(/MESSAGE_FILTER_LABEL_KEYS/);
    expect(securechat).toMatch(/filterLabel\(f\)/);
    for (const key of ['msg.filterAll', 'msg.filterBookings', 'msg.filterUnread']) {
      expect(securechat).toContain(`'${key}'`);
    }
  });
});
