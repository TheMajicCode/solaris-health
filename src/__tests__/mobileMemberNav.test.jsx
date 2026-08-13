/**
 * Mobile member experience — bottom-nav shape + routing, Reflection outer label,
 * lightweight LUCA guide (reduced-motion), and the desktop sidebar regression.
 * Covers acceptance scenarios 1, 3, 11 and 12 for the mobile UI sprint.
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
    expect(labels).toEqual(['Explore', 'Health', 'LUCA Coach', 'Reflection', 'Economic']);
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

describe('Reflection outer label / inner tabs', () => {
  it('uses "Reflection" as the outer bottom-nav label', () => {
    render(<LucaPassport />);
    expect(within(botnav()).getByRole('button', { name: 'Reflection', hidden: true })).toBeInTheDocument();
  });

  it('preserves the Journal / Growth / Media inner sub-tabs', () => {
    expect(SUBTABS.journal.tabs).toEqual(['journal', 'growth', 'media']);
  });
});

describe('lightweight LUCA guide (reduced-motion safe)', () => {
  it('renders a dismissible spark that opens the Coach, not a chat widget', () => {
    render(<LucaPassport />);
    const spark = document.querySelector('.luca-guide-spark[aria-label="Open LUCA Coach"]');
    expect(spark).toBeTruthy();
    // No legacy floating "Ask LUCA" chatbot FAB.
    expect(document.querySelector('.luca-fab')).toBeNull();
    // Dismiss removes it for the session.
    fireEvent.click(document.querySelector('.luca-guide-x[aria-label="Dismiss LUCA guide"]'));
    expect(document.querySelector('.luca-guide-spark')).toBeNull();
  });

  it('ships a prefers-reduced-motion guard that stops the guide animation', () => {
    render(<LucaPassport />);
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/luca-guide/);
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
