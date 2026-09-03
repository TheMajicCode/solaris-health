/**
 * Preview V3 (§7) — LUCA navigation regression protection.
 *
 * Preview V3 turned the Economic Passport drawer into a navigation-only launcher
 * and made every economic destination render as a full-screen area (Wallet / GPS
 * / Self Care / Network) rather than inside the drawer. LUCA must keep working:
 * when LUCA (chips, suggestions, or the `solaris:navigate` event) targets an
 * economic destination, it goes through the shared nav resolver `resolveNav` —
 * the SAME path `go()` uses — and lands on a full-screen route, NEVER re-opening
 * the drawer.
 *
 * This test pins that contract at the resolver level (pure, deterministic) so a
 * future change to the drawer or routing can't silently break LUCA deep-links.
 */
import { describe, it, expect } from 'vitest';
import { resolveNav, LEGACY_TAB_MAP, SUBTABS } from '../components/LucaPassport.jsx';

// The top-level areas that own a full-screen render switch. If a resolved tab is
// one of these, it renders full-screen (not in the drawer).
const FULL_SCREEN_AREAS = new Set(Object.keys(SUBTABS));

describe('Preview V3 §7 — LUCA economic deep-links route to full-screen areas', () => {
  // These are the economic targets LUCA emits via go()/solaris:navigate.
  const cases = [
    { raw: 'contributions', tab: 'wallet', sub: 'contributions' }, // "Self Care"
    { raw: 'network', tab: 'wallet', sub: 'network' },
    { raw: 'gps-map', tab: 'wallet', sub: 'network' },
    { raw: 'growth', tab: 'communications', sub: 'growth' },
    { raw: 'wallet', tab: 'wallet', sub: 'wallet' },
  ];

  it.each(cases)('resolves LUCA target "$raw" to full-screen $tab/$sub', ({ raw, tab, sub }) => {
    const nav = resolveNav(raw);
    expect(nav.tab).toBe(tab);
    expect(nav.sub).toBe(sub);
    // The resolved tab must be a real full-screen area with a render switch.
    expect(FULL_SCREEN_AREAS.has(nav.tab)).toBe(true);
    // The resolved sub must be a valid tab within that area.
    expect(SUBTABS[nav.tab].tabs).toContain(nav.sub);
  });

  it('never resolves an economic target to a bare drawer stub (always canonicalized)', () => {
    for (const { raw } of cases) {
      const nav = resolveNav(raw);
      expect(nav.tab).toBeTruthy();
      expect(nav.sub).toBeTruthy();
    }
  });

  it('the direct wallet subtabs (Wallet/GPS/Self Care/Network) are all full-screen tabs', () => {
    // These are the four sections the drawer now merely launches into.
    expect(SUBTABS.wallet.tabs).toEqual(['wallet', 'gps', 'contributions', 'network']);
    expect(SUBTABS.wallet.def).toBe('wallet');
  });

  it('legacy economic aliases stay mapped (deep-link stability for LUCA)', () => {
    expect(LEGACY_TAB_MAP.contributions).toEqual({ tab: 'wallet', sub: 'contributions' });
    expect(LEGACY_TAB_MAP.network).toEqual({ tab: 'wallet', sub: 'network' });
    expect(LEGACY_TAB_MAP['gps-map']).toEqual({ tab: 'wallet', sub: 'network' });
    expect(LEGACY_TAB_MAP.growth).toEqual({ tab: 'communications', sub: 'growth' });
  });
});
