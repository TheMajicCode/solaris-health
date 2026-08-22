/**
 * NODE E5 — practitioner portal switch: server-derived visibility (fail-closed).
 *
 * The right to switch between the Member and Practitioner portals is derived
 * ONLY from the authenticated server user (role === 'practitioner' OR an
 * approved provider isProvider === true). It is NEVER derived from a client
 * flag, URL, or localStorage. This suite renders the real app shell for each
 * account shape and asserts the "Portal" switcher tablist appears ONLY for an
 * approved practitioner — ordinary members, pending/rejected applicants and
 * admins never see it. A tampered URL (?portal=practitioner) cannot conjure it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Mutable user injected into the mocked AppContext so each case renders the
// shell as a different authenticated account.
let currentUser = null;
vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({ user: currentUser, logout: vi.fn(), refreshUser: vi.fn() }),
  AppProvider: ({ children }) => children,
}));
vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, { get: () => () => Promise.resolve({}) }),
}));

import LucaPassport from '../components/LucaPassport.jsx';

const portalSwitcher = () => document.querySelector('[role="tablist"][aria-label="Portal"]');

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  try { sessionStorage.clear(); localStorage.clear(); } catch { /* noop */ }
});

describe('E5 portal switcher visibility (server-derived, fail-closed)', () => {
  it('shows the switcher for an approved practitioner (role=practitioner)', () => {
    currentUser = { id: 1, email: 'prac@test.local', role: 'practitioner', isProvider: true };
    render(<LucaPassport />);
    expect(portalSwitcher()).toBeTruthy();
  });

  it('shows the switcher for an approved provider (isProvider=true)', () => {
    currentUser = { id: 2, email: 'prov@test.local', role: 'patient', isProvider: true };
    render(<LucaPassport />);
    expect(portalSwitcher()).toBeTruthy();
  });

  it('HIDES the switcher for an ordinary member', () => {
    currentUser = { id: 3, email: 'member@test.local', role: 'patient', isProvider: false };
    render(<LucaPassport />);
    expect(portalSwitcher()).toBeNull();
  });

  it('HIDES the switcher for a pending applicant (not yet approved)', () => {
    currentUser = { id: 4, email: 'pending@test.local', role: 'patient', isProvider: false, applicationStatus: 'submitted' };
    render(<LucaPassport />);
    expect(portalSwitcher()).toBeNull();
  });

  it('HIDES the switcher for a rejected applicant', () => {
    currentUser = { id: 5, email: 'rejected@test.local', role: 'patient', isProvider: false, applicationStatus: 'rejected' };
    render(<LucaPassport />);
    expect(portalSwitcher()).toBeNull();
  });

  it('HIDES the switcher for a clinic admin', () => {
    currentUser = { id: 6, email: 'admin@test.local', role: 'admin', isProvider: false };
    render(<LucaPassport />);
    expect(portalSwitcher()).toBeNull();
  });

  it('a tampered ?portal=practitioner URL cannot conjure the switcher for an ordinary member', () => {
    window.history.replaceState({}, '', '/?portal=practitioner');
    currentUser = { id: 7, email: 'member2@test.local', role: 'patient', isProvider: false };
    render(<LucaPassport />);
    expect(portalSwitcher()).toBeNull();
  });
});
