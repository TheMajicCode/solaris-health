/**
 * Focused coverage for the mobile navigation + Economic Passport drawer
 * redesign (contract §4–§11). Presentation / IA / responsive-nav only — no
 * schema, auth, wallet or transaction semantics are exercised here.
 *
 * The bottom nav and the drawer both live in the DOM regardless of viewport
 * (CSS handles the responsive presentation), so these DOM assertions are stable
 * in jsdom.
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
// §5 redesign — sections are now a VERTICAL menu (phone) drilling into a detail
// view, plus a persistent rail (tablet+). Both render in jsdom (CSS handles the
// responsive show/hide), so we drive the menu buttons and read the rail's
// active ("on") state to assert which section is selected.
const menuLabels = () => Array.from(drawer().querySelectorAll('.econ-menu .econ-menu-lbl')).map((e) => e.textContent.trim());
const clickSection = (name) => {
  const btn = Array.from(drawer().querySelectorAll('.econ-menu-btn')).find((b) => b.textContent.trim().includes(name));
  fireEvent.click(btn);
  return btn;
};
const activeSection = () => {
  const on = drawer().querySelector('.econ-railbtn.on');
  return on ? on.textContent.trim() : null;
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

describe('§5 Economic Passport trigger + drawer open/close', () => {
  it('opens a full-height right drawer with the correct header/subline', () => {
    render(<LucaPassport />);
    openDrawer();
    const d = drawer();
    expect(d).toBeTruthy();
    expect(d.getAttribute('role')).toBe('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(within(d).getByText('Economic Passport')).toBeInTheDocument();
    expect(within(d).getByText(/Your care, contribution and value/i)).toBeInTheDocument();
  });

  it('closes via the close button and restores focus to the trigger', async () => {
    render(<LucaPassport />);
    // A real click focuses the button; jsdom does not, so focus it explicitly
    // to reproduce the interaction whose focus we expect to be restored.
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

describe('§5 drawer IA — vertical section list Wallet, Self Care, GPS, Network', () => {
  it('presents the four sections as a vertical menu in the required order', () => {
    render(<LucaPassport />);
    openDrawer();
    expect(menuLabels()).toEqual(['Wallet', 'Self Care', 'GPS', 'Network']);
    // Wallet is the default selected section (reflected in the tablet rail).
    expect(activeSection()).toBe('Wallet');
  });

  it('drilling into a section shows the "Back to Economic Passport" affordance', () => {
    render(<LucaPassport />);
    openDrawer();
    // Fresh open starts on the menu view.
    expect(drawer().classList.contains('view-menu')).toBe(true);
    clickSection('GPS');
    // Choosing a section drills into the detail view.
    expect(drawer().classList.contains('view-detail')).toBe(true);
    // The back affordance is CSS-hidden on tablet, so select it directly.
    const back = drawer().querySelector('.econ-back');
    expect(back).toBeTruthy();
    expect(back.textContent).toMatch(/back to economic passport/i);
    fireEvent.click(back);
    expect(drawer().classList.contains('view-menu')).toBe(true);
  });
});

describe('§7 Self Care -> Growth deep link and -> GPS transition', () => {
  it('"Continue self-care" closes the drawer and navigates to Growth', async () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('Self Care');
    const primary = await within(drawer()).findByRole('button', { name: /continue self-care/i });
    fireEvent.click(primary);
    await waitFor(() => expect(drawer()).toBeNull());
    // Growth lives under the Communications area; the URL reflects the deep link.
    expect(window.location.search).toMatch(/growth/);
  });

  it('"See ecosystem impact" switches the drawer to the GPS section', async () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('Self Care');
    const secondary = await within(drawer()).findByRole('button', { name: /see ecosystem impact/i });
    fireEvent.click(secondary);
    expect(activeSection()).toBe('GPS'); // GPS now selected
  });
});

describe('§10 Network — BTC Map fallback + collapsed accordions', () => {
  it('always shows an "Open in BTC Map" fallback link and the BTC Map iframe', () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('Network');
    const open = within(drawer()).getByRole('link', { name: /open in btc map/i });
    expect(open).toHaveAttribute('href', 'https://btcmap.org/map');
    const iframe = drawer().querySelector('iframe.btcmap-frame');
    expect(iframe).toBeTruthy();
    // Geolocation is NOT auto-requested.
    expect(iframe.getAttribute('allow')).toBeNull();
  });

  it('renders Communities and Ecosystem Apps accordions collapsed by default', () => {
    render(<LucaPassport />);
    openDrawer();
    clickSection('Network');
    const accHeads = drawer().querySelectorAll('.acc-head');
    expect(accHeads.length).toBe(2);
    accHeads.forEach((h) => expect(h.getAttribute('aria-expanded')).toBe('false'));
    // Bodies are collapsed until toggled.
    expect(drawer().querySelector('.acc-body')).toBeNull();
    fireEvent.click(accHeads[0]);
    expect(drawer().querySelector('.acc-body')).toBeTruthy();
  });
});
