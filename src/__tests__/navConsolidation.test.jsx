/**
 * Navigation-consolidation unit tests — verify the simplified member sidebar,
 * the legacy → new parent+sub-tab redirects, and the nested sub-tab shape used
 * by the consolidated areas (LUCA Coach, Journal, Messages, Economic Passport,
 * Settings). These guard the acceptance criteria for the sidebar cleanup.
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

  it('keeps the core member destinations', () => {
    for (const id of ['dashboard', 'explore', 'health', 'coach', 'journal', 'messages', 'wallet']) {
      expect(ids).toContain(id);
    }
  });

  it('removes the now-consolidated standalone entries from the sidebar', () => {
    for (const id of ['intelligence', 'media', 'inbox', 'contributions', 'gps-map', 'network', 'identity', 'account']) {
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
    expect(resolveNav('media')).toEqual({ tab: 'journal', sub: 'media' });
    expect(resolveNav('inbox')).toEqual({ tab: 'messages', sub: 'inbox' });
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
    expect(resolveNav('journal')).toEqual({ tab: 'journal', sub: 'journal' });
    expect(resolveNav('messages')).toEqual({ tab: 'messages', sub: 'conversations' });
    expect(resolveNav('wallet')).toEqual({ tab: 'wallet', sub: 'overview' });
    expect(resolveNav('account')).toEqual({ tab: 'account', sub: 'profile' });
  });

  it('preserves a valid explicit sub-tab', () => {
    expect(resolveNav('coach', 'intelligence')).toEqual({ tab: 'coach', sub: 'intelligence' });
    expect(resolveNav('wallet', 'network')).toEqual({ tab: 'wallet', sub: 'network' });
    expect(resolveNav('account', 'security')).toEqual({ tab: 'account', sub: 'security' });
  });

  it('falls back to the default sub-tab for an unknown sub', () => {
    expect(resolveNav('coach', 'bogus')).toEqual({ tab: 'coach', sub: 'coach' });
  });

  it('leaves a flat tab (no sub-tabs) with a null sub', () => {
    expect(resolveNav('dashboard')).toEqual({ tab: 'dashboard', sub: null });
    expect(resolveNav('health')).toEqual({ tab: 'health', sub: null });
  });
});

describe('SUBTABS shape', () => {
  it('Economic Passport carries Overview, Contributions and Network', () => {
    expect(SUBTABS.wallet.tabs).toEqual(['overview', 'contributions', 'network']);
  });
  it('LUCA Coach carries Coach and Intelligence', () => {
    expect(SUBTABS.coach.tabs).toEqual(['coach', 'intelligence']);
  });
  it('Journal preserves Growth alongside Journal and Media', () => {
    expect(SUBTABS.journal.tabs).toEqual(['journal', 'growth', 'media']);
  });
  it('Messages carries Conversations and Inbox', () => {
    expect(SUBTABS.messages.tabs).toEqual(['conversations', 'inbox']);
  });
  it('Settings exposes the five account sections', () => {
    expect(SUBTABS.account.tabs).toEqual(['profile', 'preferences', 'notifications', 'security', 'privacy']);
  });
});
