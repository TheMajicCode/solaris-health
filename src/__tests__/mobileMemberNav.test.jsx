/**
 * Mobile member experience — bottom-nav shape + routing, the Communications outer
 * label, the removal of every floating LUCA surface, and the desktop sidebar
 * regression. Covers the mobile nav structural fix and the Journal+Messages ->
 * Communications consolidation.
 *
 * The bottom nav lives in the DOM at every viewport (CSS hides it on desktop),
 * so these DOM assertions are viewport-independent and stable in jsdom.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';

// Each test starts from a clean URL + session so navigation in one test never
// leaks the active tab (via the URL query) into the next render.
beforeEach(() => {
  window.history.replaceState({}, '', '/');
  try { sessionStorage.clear(); } catch { /* noop */ }
});

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    user: { id: 1, email: 'member@test.local', firstName: 'Pat', lastName: 'Tester', role: 'patient' },
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
  AppProvider: ({ children }) => children,
}));

vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, { get: () => () => Promise.resolve({}) }),
}));

import LucaPassport, { SUBTABS } from '../components/LucaPassport.jsx';

const botnav = () => document.querySelector('.m-botnav');

describe('member mobile bottom navigation', () => {
  it('renders exactly five destinations in the required order with LUCA raised centre', () => {
    render(<LucaPassport />);
    const nav = botnav();
    expect(nav).toBeTruthy();
    const items = within(nav).getAllByRole('button', { hidden: true });
    expect(items).toHaveLength(5);
    const labels = items.map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Explore', 'Health', 'LUCA Coach', 'Communications', 'Economic']);
    // Centre item is the raised LUCA orb, not a normal tab.
    expect(nav.querySelector('.m-bn-luca')).toBeTruthy();
    // Dashboard is reached from the top-left Home button, never the bottom nav.
    expect(labels).not.toContain('Dashboard');
    expect(labels).not.toContain('Home');
  });

  it('the top-left Home button exposes Dashboard access', () => {
    render(<LucaPassport />);
    // Icon-only button (accessible name via aria-label); query by class + label.
    expect(document.querySelector('button.home-btn[aria-label="Home"]')).toBeTruthy();
  });

  it('tapping a bottom-nav destination routes to it (aria-current reflects the active tab)', () => {
    render(<LucaPassport />);
    const explore = within(botnav()).getByRole('button', { name: 'Explore', hidden: true });
    fireEvent.click(explore);
    expect(within(botnav()).getByRole('button', { name: 'Explore', hidden: true }))
      .toHaveAttribute('aria-current', 'page');
    // The LUCA centre button routes to the Coach (not a separate chatbot).
    fireEvent.click(within(botnav()).getByRole('button', { name: 'LUCA Coach', hidden: true }));
    expect(within(botnav()).getByRole('button', { name: 'LUCA Coach', hidden: true }))
      .toHaveAttribute('aria-current', 'page');
  });
});

describe('Communications outer label / consolidated inner tabs', () => {
  it('uses "Communications" as the outer bottom-nav label', () => {
    render(<LucaPassport />);
    expect(within(botnav()).getByRole('button', { name: 'Communications', hidden: true })).toBeInTheDocument();
  });

  it('consolidates Messages + Journal / Growth / Media under the Communications area', () => {
    // §F — "With Others" (unified Messages) + "With Yourself" (journal, growth, media).
    expect(SUBTABS.communications.tabs).toEqual(['messages', 'journal', 'growth', 'media']);
    expect(SUBTABS.communications.def).toBe('messages');
  });
});

describe('no floating LUCA surface remains', () => {
  it('does not render any floating LUCA guide / spark / FAB / widget', () => {
    render(<LucaPassport />);
    // The removed floating guide and any legacy chatbot FAB must be gone.
    expect(document.querySelector('.luca-guide-spark')).toBeNull();
    expect(document.querySelector('.luca-guide')).toBeNull();
    expect(document.querySelector('.luca-fab')).toBeNull();
    expect(document.querySelector('.luca-widget')).toBeNull();
    expect(screen.queryByLabelText(/open luca coach/i)).toBeNull();
    expect(screen.queryByText(/ask luca/i)).toBeNull();
    // The only persistent mobile LUCA entry is the raised centre nav button.
    expect(botnav().querySelector('.m-bn-luca')).toBeTruthy();
  });
});

describe('bottom nav hides while a blocking overlay (booking / check-in) is open', () => {
  it('adds the hidden class on solaris:botnav {hidden:true} and restores it', () => {
    render(<LucaPassport />);
    const nav = botnav();
    expect(nav.className).not.toMatch(/hidden/);
    act(() => { window.dispatchEvent(new CustomEvent('solaris:botnav', { detail: { hidden: true } })); });
    expect(botnav().className).toMatch(/hidden/);
    act(() => { window.dispatchEvent(new CustomEvent('solaris:botnav', { detail: { hidden: false } })); });
    expect(botnav().className).not.toMatch(/hidden/);
  });
});

describe('desktop chrome regression', () => {
  it('keeps the sidebar with the full member navigation', () => {
    render(<LucaPassport />);
    const sidebar = document.querySelector('.sidebar');
    expect(sidebar).toBeTruthy();
    expect(within(sidebar).getByText('SOLARIS')).toBeInTheDocument();
    // Sidebar retains the full member navigation (multiple destinations).
    expect(sidebar.querySelectorAll('.nav-item').length).toBeGreaterThan(4);
  });
});
