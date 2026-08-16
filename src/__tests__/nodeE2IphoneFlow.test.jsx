/**
 * NODE E2 — iPhone mobile flow, booking consistency, guided-growth routing,
 * communications binder, and secure practitioner-messaging plumbing.
 *
 * These are focused unit tests that guard the acceptance criteria of Node E2
 * without standing up the whole shell:
 *   • resolveNav routes the guided-journey success + the provider "Message"
 *     hand-off to the right Communications sub-tab.
 *   • The Communications area exposes both semantic folders' sub-tabs.
 *   • The api client sends ONLY the provider profile id to the new secure
 *     provider-conversation endpoint, and surfaces structured error metadata
 *     (status/body) so the CTA can branch on 401/403/404/5xx.
 *   • The mobile Explore surface defaults to the List view.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({ user: null }),
}));

import { resolveNav, SUBTABS, LEGACY_TAB_MAP } from '../components/LucaPassport.jsx';
import { api } from '../lib/api.js';

describe('E2 §5 — guided journey routes to Communications → Growth', () => {
  it('resolves communications+growth to the Growth sub-tab (not Journal)', () => {
    const r = resolveNav('communications', 'growth');
    expect(r).toEqual({ tab: 'communications', sub: 'growth' });
  });

  it('legacy "growth" target still redirects into Communications', () => {
    expect(LEGACY_TAB_MAP.growth).toEqual({ tab: 'communications', sub: 'growth' });
    const r = resolveNav('growth');
    expect(r).toEqual({ tab: 'communications', sub: 'growth' });
  });
});

describe('E2 §4 — provider "Message" routes to Communications → Messages', () => {
  it('resolves communications+messages to the Messages sub-tab', () => {
    const r = resolveNav('communications', 'messages');
    expect(r).toEqual({ tab: 'communications', sub: 'messages' });
  });

  it('Communications owns both semantic folders (Others + Yourself) sub-tabs', () => {
    const tabs = SUBTABS.communications.tabs;
    // With Others
    expect(tabs).toContain('messages');
    expect(tabs).toContain('inbox');
    // With Yourself
    expect(tabs).toContain('journal');
    expect(tabs).toContain('growth');
    expect(tabs).toContain('media');
    // Default landing is Messages
    expect(SUBTABS.communications.def).toBe('messages');
  });
});

describe('E2 §4 — secure provider conversation API client', () => {
  beforeEach(() => { localStorage.clear(); api.setToken(null); });
  afterEach(() => { vi.restoreAllMocks(); });

  function mockFetchOnce({ ok = true, status = 200, body = {} } = {}) {
    global.fetch = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
    return global.fetch;
  }

  it('POSTs ONLY the providerId to /messages/conversations/provider', async () => {
    const fetchMock = mockFetchOnce({ body: { conversationId: 'c1', otherId: 'u1', otherName: 'Dr X', otherRole: 'practitioner', recipientReady: true } });
    const res = await api.startProviderConversation('prof-123');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/messages\/conversations\/provider$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ providerId: 'prof-123' });
    // no contactId / practitioner user id leaks from the client
    expect(opts.body).not.toMatch(/contactId/);
    expect(res.conversationId).toBe('c1');
    expect(res.recipientReady).toBe(true);
  });

  it('propagates structured error metadata (status + body) on a neutral 404', async () => {
    mockFetchOnce({ ok: false, status: 404, body: { error: 'This profile is not available for secure messaging yet' } });
    await expect(api.startProviderConversation('bad')).rejects.toMatchObject({
      status: 404,
      body: { error: 'This profile is not available for secure messaging yet' },
    });
  });

  it('propagates a 403 for ineligible roles', async () => {
    mockFetchOnce({ ok: false, status: 403, body: { error: 'forbidden' } });
    await expect(api.startProviderConversation('x')).rejects.toMatchObject({ status: 403 });
  });
});

describe('E2 §2 — mobile Explore defaults to List', () => {
  it('source initialises mobileView to "list"', async () => {
    const fs = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.resolve(here, '../components/marketplace/ExploreMarketplace.jsx'), 'utf8');
    expect(src).toMatch(/mobileView[^\n]*useState\(\s*['"]list['"]\s*\)/);
  });
});
