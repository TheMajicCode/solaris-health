/**
 * Focused coverage for the mobile navigation + Economic Passport drawer.
 *
 * Preview V3 redesign (§2/§3): the Economic Passport drawer is now
 * NAVIGATION-ONLY. It shows a single vertical list of the four sections
 * (Wallet, Self Care, GPS, Network); selecting one CLOSES the drawer and opens
 * that section as a normal, route-backed FULL APP SCREEN (?area=wallet&sub=...).
 * No section detail, rail, or "Back to Economic Passport" is rendered inside the
 * drawer any more. Presentation / IA / responsive-nav only — no schema, auth,
 * wallet or transaction semantics are exercised here.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react';

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  try { sessionStorage.clear(); localStorage.clear(); } catch { /* noop */ }
});

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    user: { id: 1, email: 'member@test.local', firstName: 'Pat', lastName: 'Tester', role: 'patient' },
    logout: vi.fn(),
    refreshUser: vi.fn(),
    setPendingProviderId: vi.fn(),
    setPendingCurate: vi.fn(),
  }),
  AppProvider: ({ children }) => children,
}));

vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, { get: () => () => Promise.resolve({}) }),
}));

import LucaPassport from '../components/LucaPassport.jsx';

const botnav = () => document.querySelector('.m-botnav');
const openDrawer = () => {
  const trigger = document.querySelector('button.econ-trigger[aria-label="Open Economic Passport"]');
  fireEvent.click(trigger);
  return trigger;
};
const drawer = () => document.querySelector('.econ-drawer');
const menuLabels = () => Array.from(document.querySelectorAll('.econ-drawer .econ-menu .econ-menu-lbl')).map((e) => e.textContent.trim());
const clickSection = (name) => {
  const btn = Array.from(drawer().querySelectorAll('.econ-menu-btn')).find((b) => b.textContent.trim().includes(name));
  fireEvent.click(btn);
  return btn;
};
// The full-screen Economic area renders its own SubTabs (role=tablist); the
// selected section is the tab with aria-selected="true".
const areaTablist = () => document.querySelector('[role="tablist"][aria-label="Economic Passport sections"]');
const activeAreaTab = () => {
  const el = areaTablist()?.querySelector('[role="tab"][aria-selected="true"]');
  return el ? el.textContent.trim() : null;
};

describe('§4 mobile bottom nav — order and route destinations', () => {
  it('routes Home -> dashboard and Health -> health passport surface', () => {
    render(<LucaPassport />);
    const nav = botnav();
    const home = within(nav).getByRole('button', { name: 'Home', hidden: true });
    fireEvent.click(home);
    expect(within(nav).getByRole('button', { name: 'Home', hidden: true }))
      .toHaveAttribute('aria-current', 'page');

    const health = within(nav).getByRole('button', { name: 'Health Passport', hidden: true });
    fireEvent.click(health);
    expect(within(nav).getByRole('button', { name: 'Health Passport', hidden: true }))
      .toHaveAttribute('aria-current', 'page');
  });
});

describe('§2 Economic Passport trigger + navigation-only drawer', () => {
  it('opens a full-height right drawer showing ONLY the heading + section list', () => {
    render(<LucaPassport />);
    openDrawer();
    const d = drawer();
    expect(d).toBeTruthy();
    expect(d.getAttribute('role')).toBe('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(within(d).getByText('Economic Passport')).toBeInTheDocument();
    // Navigation-only: no descriptive subtitle, no section detail, no rail/back.
    expect(within(d).queryByText(/Your care, contribution and value/i)).toBeNull();
    expect(d.querySelector('.econ-back')).toBeNull();
    expect(d.querySelector('.econ-rail')).toBeNull();
    expect(d.querySelector('.econ-body')).toBeNull();
  });

  it('closes via the close button and restores focus to the trigger', async () => {
    render(<LucaPassport />);
    const trigger = document.querySelector('button.econ-trigger[aria-label="Open Economic Passport"]');
    trigger.focus();
    fireEvent.click(trigger);
    const closeBtn = within(drawer()).getByRole('button', { name: /close economic passport/i });
    fireEvent.click(closeBtn);
    await waitFor(() => expect(drawer()).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape and on overlay click', async () => {
    render(<LucaPassport />);
    openDrawer();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(drawer()).toBeNull());

    openDrawer();
    fireEvent.click(document.querySelector('.econ-scrim'));
    await waitFor(() => expect(drawer()).toBeNull());
  });

  it('locks background scroll while open and restores it on close', async () => {
    render(<LucaPassport />);
    openDrawer();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(drawer()).toBeNull());
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('§2 drawer IA — vertical section list Wallet, Self Care, GPS, Network', () => {
  it('presents the four sections as a vertical menu in the required order', () => {
    render(<LucaPassport />);
    openDrawer();
    expect(menuLabels()).toEqual(['Wallet', 'Self Care', 'GPS', 'Network']);
  });

  it('selecting a section CLOSES the drawer and opens it as a full app screen (route-backed)', async () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('GPS');
    // Drawer closes...
    await waitFor(() => expect(drawer()).toBeNull());
    // ...and the full-screen Economic area is now shown with GPS selected,
    // mirrored into the URL so refresh / deep-link / Back all work.
    expect(window.location.search).toMatch(/area=wallet/);
    expect(window.location.search).toMatch(/sub=gps/);
    await waitFor(() => expect(areaTablist()).toBeTruthy());
    expect(activeAreaTab()).toBe('GPS');
  });

  it('opening Wallet from the drawer lands on the Wallet full screen', async () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('Wallet');
    await waitFor(() => expect(drawer()).toBeNull());
    expect(window.location.search).toMatch(/area=wallet/);
    await waitFor(() => expect(areaTablist()).toBeTruthy());
    expect(activeAreaTab()).toBe('Wallet');
  });
});

describe('§7 Self Care full screen — Growth deep link and GPS transition', () => {
  it('opens Self Care as a full screen, then "Continue self-care" navigates to Growth', async () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('Self Care');
    await waitFor(() => expect(drawer()).toBeNull());
    // Full-screen Self Care section is shown (Self Care sub selected).
    await waitFor(() => expect(activeAreaTab()).toBe('Self Care'));
    const primary = await screen.findByRole('button', { name: /continue self-care/i });
    fireEvent.click(primary);
    // Growth lives under the Communications area; the URL reflects the deep link.
    await waitFor(() => expect(window.location.search).toMatch(/growth/));
  });

  it('"See ecosystem impact" navigates to the GPS full screen', async () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('Self Care');
    await waitFor(() => expect(drawer()).toBeNull());
    const secondary = await screen.findByRole('button', { name: /see ecosystem impact/i });
    fireEvent.click(secondary);
    await waitFor(() => expect(activeAreaTab()).toBe('GPS'));
    expect(window.location.search).toMatch(/sub=gps/);
  });
});

describe('§10 Network full screen — BTC Map fallback + collapsed accordions', () => {
  it('always shows an "Open in BTC Map" fallback link and the BTC Map iframe', async () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('Network');
    await waitFor(() => expect(drawer()).toBeNull());
    const open = await screen.findByRole('link', { name: /open in btc map/i });
    expect(open).toHaveAttribute('href', 'https://btcmap.org/map');
    const iframe = document.querySelector('iframe.btcmap-frame');
    expect(iframe).toBeTruthy();
    // Geolocation is NOT auto-requested.
    expect(iframe.getAttribute('allow')).toBeNull();
  });

  it('renders Communities and Ecosystem Apps accordions collapsed by default', async () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('Network');
    await waitFor(() => expect(drawer()).toBeNull());
    await waitFor(() => expect(document.querySelectorAll('.acc-head').length).toBe(2));
    const accHeads = document.querySelectorAll('.acc-head');
    accHeads.forEach((h) => expect(h.getAttribute('aria-expanded')).toBe('false'));
    expect(document.querySelector('.acc-body')).toBeNull();
    fireEvent.click(accHeads[0]);
    expect(document.querySelector('.acc-body')).toBeTruthy();
  });
});
