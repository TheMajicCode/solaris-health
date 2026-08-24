/**
 * NODE K1.1 §4 — the approved Personalized Journey draft SURVIVES A REFRESH via
 * device-local storage, namespaced by the authenticated user id.
 *
 * Verified against the real AppContext (no migration, no server API):
 *   • approving persists the exact draft to localStorage under a per-user key
 *   • remounting (simulating a refresh) restores the SAME draft
 *   • dismiss/delete removes the device-local copy
 *   • a different account on the SAME browser never sees the first account's draft
 *   • the stored payload carries a device marker (never a server-persistence claim)
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// Controllable mocked API — only what AppContext touches on mount.
let CURRENT_USER = { id: 'user-1' };
vi.mock('../lib/api.js', () => ({
  api: {
    token: 'test-token',
    getMe: vi.fn(async () => ({ user: CURRENT_USER, profile: {} })),
    logout: vi.fn(),
    getLucaMessages: vi.fn(async () => ({ messages: [] })),
  },
}));

import { AppProvider, useApp } from '../state/AppContext.jsx';

function Harness() {
  const { approvedJourney, setApprovedJourney } = useApp();
  return (
    <div>
      <div data-testid="title">{approvedJourney ? approvedJourney.title : 'NONE'}</div>
      <button onClick={() => setApprovedJourney({ title: 'Weekly rhythm draft', cadence: 'weekly', steps: ['a', 'b'], approvedAt: 111 })}>
        approve
      </button>
      <button onClick={() => setApprovedJourney(null)}>dismiss</button>
    </div>
  );
}

async function mountApp() {
  let utils;
  await act(async () => { utils = render(<AppProvider><Harness /></AppProvider>); });
  // allow loadUser() microtasks to resolve so `user` (and the restore effect) run
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return utils;
}

const KEY1 = 'solaris.approvedJourney.user-1';
const KEY2 = 'solaris.approvedJourney.user-2';

beforeEach(() => {
  localStorage.clear();
  CURRENT_USER = { id: 'user-1' };
  cleanup();
});

describe('K1.1 §4 — approved journey survives refresh (device-local)', () => {
  it('persists the exact draft under a per-user key and restores on remount', async () => {
    await mountApp();
    expect(screen.getByTestId('title').textContent).toBe('NONE');

    await act(async () => { screen.getByText('approve').click(); });
    expect(screen.getByTestId('title').textContent).toBe('Weekly rhythm draft');

    const stored = JSON.parse(localStorage.getItem(KEY1));
    expect(stored.title).toBe('Weekly rhythm draft');
    expect(stored.steps).toEqual(['a', 'b']);
    expect(stored.savedOnDevice).toBe(true);   // device marker, not a server claim
    expect(stored.ownerUserId).toBe('user-1');

    // Simulate a full refresh: unmount and mount a fresh provider tree.
    cleanup();
    await mountApp();
    expect(screen.getByTestId('title').textContent).toBe('Weekly rhythm draft');
  });

  it('dismiss/delete removes the device-local copy', async () => {
    await mountApp();
    await act(async () => { screen.getByText('approve').click(); });
    expect(localStorage.getItem(KEY1)).toBeTruthy();

    await act(async () => { screen.getByText('dismiss').click(); });
    expect(screen.getByTestId('title').textContent).toBe('NONE');
    expect(localStorage.getItem(KEY1)).toBeNull();
  });

  it('a different account on the same browser never sees the first account draft', async () => {
    await mountApp();
    await act(async () => { screen.getByText('approve').click(); });
    expect(localStorage.getItem(KEY1)).toBeTruthy();

    // Switch the "logged-in" user and remount (same browser, different account).
    cleanup();
    CURRENT_USER = { id: 'user-2' };
    await mountApp();
    expect(screen.getByTestId('title').textContent).toBe('NONE'); // no cross-account leak
    expect(localStorage.getItem(KEY2)).toBeNull();
    expect(localStorage.getItem(KEY1)).toBeTruthy(); // account 1 copy still isolated
  });
});
