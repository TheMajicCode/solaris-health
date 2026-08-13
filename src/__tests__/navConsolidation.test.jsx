/**
 * Navigation-consolidation unit tests — verify the simplified member sidebar,
 * the legacy → new parent+sub-tab redirects, and the nested sub-tab shape used
 * by the consolidated areas (LUCA Coach, Communications, Economic Passport,
 * Settings). Journal + Messages now merge into a single Communications
 * destination. These guard the acceptance criteria for the sidebar cleanup.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({ user: null }),
}));

import {
  navForPersona,
  resolveNav,
  SUBTABS,
  LEGACY_TAB_MAP,
} from '../components/LucaPassport.jsx';

const tabIds = (nav) => nav.flatMap((g) => g.items.map((i) => i.id));

describe('member sidebar consolidation', () => {
  const ids = tabIds(navForPersona('patient', 'patient', false));

  it('keeps the core member destinations (Journal + Messages now one Communications)', () => {
    for (const id of ['dashboard', 'explore', 'health', 'coach', 'communications', 'wallet']) {
      expect(ids).toContain(id);
    }
  });

  it('removes the now-consolidated standalone entries from the sidebar', () => {
    for (const id of ['intelligence', 'media', 'inbox', 'contributions', 'gps-map', 'network', 'identity', 'account', 'journal', 'messages']) {
      expect(ids).not.toContain(id);
    }
  });

  it('has no duplicate tab ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('resolveNav — legacy redirects', () => {
  it('maps each legacy target to its new parent + sub-tab', () => {
    expect(resolveNav('intelligence')).toEqual({ tab: 'coach', sub: 'intelligence' });
    // Journal + Messages (and their former sub-pages) all fold into Communications.
    expect(resolveNav('journal')).toEqual({ tab: 'communications', sub: 'journal' });
    expect(resolveNav('growth')).toEqual({ tab: 'communications', sub: 'growth' });
    expect(resolveNav('media')).toEqual({ tab: 'communications', sub: 'media' });
    expect(resolveNav('messages')).toEqual({ tab: 'communications', sub: 'messages' });
    expect(resolveNav('inbox')).toEqual({ tab: 'communications', sub: 'inbox' });
    expect(resolveNav('contributions')).toEqual({ tab: 'wallet', sub: 'contributions' });
    expect(resolveNav('gps-map')).toEqual({ tab: 'wallet', sub: 'network' });
    expect(resolveNav('network')).toEqual({ tab: 'wallet', sub: 'network' });
  });

  it('every LEGACY_TAB_MAP entry resolves to a valid sub-tab of its parent', () => {
    for (const [legacy, target] of Object.entries(LEGACY_TAB_MAP)) {
      const r = resolveNav(legacy);
      expect(r.tab).toBe(target.tab);
      expect(SUBTABS[r.tab].tabs).toContain(r.sub);
    }
  });
});

describe('resolveNav — canonicalisation', () => {
  it('defaults an area with sub-tabs to its first sub-tab', () => {
    expect(resolveNav('coach')).toEqual({ tab: 'coach', sub: 'coach' });
    expect(resolveNav('communications')).toEqual({ tab: 'communications', sub: 'messages' });
    expect(resolveNav('wallet')).toEqual({ tab: 'wallet', sub: 'wallet' });
    expect(resolveNav('account')).toEqual({ tab: 'account', sub: 'profile' });
  });

  it('preserves a valid explicit sub-tab', () => {
    expect(resolveNav('coach', 'intelligence')).toEqual({ tab: 'coach', sub: 'intelligence' });
    expect(resolveNav('communications', 'journal')).toEqual({ tab: 'communications', sub: 'journal' });
    expect(resolveNav('wallet', 'network')).toEqual({ tab: 'wallet', sub: 'network' });
    expect(resolveNav('account', 'security')).toEqual({ tab: 'account', sub: 'security' });
  });

  it('falls back to the default sub-tab for an unknown sub', () => {
    expect(resolveNav('coach', 'bogus')).toEqual({ tab: 'coach', sub: 'coach' });
    expect(resolveNav('communications', 'bogus')).toEqual({ tab: 'communications', sub: 'messages' });
  });

  it('leaves a flat tab (no sub-tabs) with a null sub', () => {
    expect(resolveNav('dashboard')).toEqual({ tab: 'dashboard', sub: null });
    expect(resolveNav('health')).toEqual({ tab: 'health', sub: null });
  });
});

describe('SUBTABS shape', () => {
  it('Economic Passport carries Wallet, GPS, Contributions and Network', () => {
    expect(SUBTABS.wallet.tabs).toEqual(['wallet', 'gps', 'contributions', 'network']);
  });
  it('LUCA Coach carries Coach and Intelligence', () => {
    expect(SUBTABS.coach.tabs).toEqual(['coach', 'intelligence']);
  });
  it('Communications merges With Others (Messages, Inbox) + With Yourself (Journal, Growth, Media)', () => {
    expect(SUBTABS.communications.tabs).toEqual(['messages', 'inbox', 'journal', 'growth', 'media']);
    expect(SUBTABS.communications.def).toBe('messages');
  });
  it('Settings exposes the five account sections', () => {
    expect(SUBTABS.account.tabs).toEqual(['profile', 'preferences', 'notifications', 'security', 'privacy']);
  });
});
