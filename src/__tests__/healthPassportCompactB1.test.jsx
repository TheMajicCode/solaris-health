/**
 * Compact Health Passport (branch agent/abacus-health-passport-compact-b1) —
 * structural + behavioural checks jsdom can prove:
 *
 *   §1  "Update my Health Passport" is ONE accordion row: an accessible button
 *       with aria-expanded, collapsed by default on mobile, expanding to a single
 *       column of actions incl. the NEW "Add or sync health data from device".
 *   §2  The device-sync action opens the shared AdaptiveOverlay; consent is
 *       required before import; the mock import is deterministic + idempotent
 *       (no duplicate records); imported data is NOT auto-shared with LUCA.
 *   §3  "Shared with LUCA" is ONE accordion row, collapsed by default when empty,
 *       showing the current document count in its header.
 *   §4  The Sovereignty card lives in Settings → Privacy & Sovereignty (not on the
 *       Passport); legacy Sovereignty nav redirects there.
 *   §5  Passport sections are single-column (no side-by-side skinny cards / no
 *       multi-column action grid) at phone widths — CSS + structure invariants.
 *
 * True pixel geometry / no-horizontal-overflow at 360/390/412 is proven in the
 * installed-PWA Chromium simulation, reported honestly as a simulation.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Force a phone viewport so isMobileViewport() (max-width:900px) is true.
beforeAll(() => {
  window.matchMedia = (q) => ({
    matches: /max-width/.test(q),
    media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {},
  });
});

// Mutable API state so individual tests can vary documents.
const apiState = {
  documents: [],
  createCalls: [],
};

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    startRetake: vi.fn(), setExploreFilter: vi.fn(),
    refreshUser: vi.fn(), logout: vi.fn(),
  }),
  AppProvider: ({ children }) => children,
}));

vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'getHealthDocuments') return () => Promise.resolve({ documents: apiState.documents });
      if (prop === 'deleteHealthDocument') return (id) => { apiState.documents = apiState.documents.filter((d) => d.id !== id); return Promise.resolve({}); };
      if (prop === 'createHealthDocument') return (body) => { apiState.createCalls.push(body); return Promise.resolve({ document: { id: 99, ...body } }); };
      if (prop === 'getProfile') return () => Promise.resolve({ profile: {} });
      if (prop === 'getSovereigntyStatus') return () => Promise.resolve({
        identity: { plain: 'You hold your Passport. Nobody else does.' },
        identityMethods: [],
        access: { plain: 'Only you decide who sees what.', practitioners: [] },
        storage: { plain: 'Encrypted and portable.' },
        ai: { plain: 'LUCA educates and prepares — never diagnoses.', provider: null, at: null },
        rights: { plain: 'Export or delete your data anytime.' },
      });
      if (prop === 'getLucaAgent') return () => Promise.resolve({ active: true });
      if (prop === 'getIdentityMe') return () => Promise.resolve({ solarisId: 'sol_x', solarisIdShort: 'sol_x…', gps: {} });
      if (prop === 'getIntakeFoundational') return () => Promise.resolve({ foundational: null });
      if (prop === 'getMyIntakeSubmissions') return () => Promise.resolve({ submissions: [] });
      return () => Promise.resolve({});
    },
  }),
}));

import {
  PassportActions, SettingsPage, resolveNav, SUBTABS,
  importDeviceSnapshot, DEVICE_SYNC_KEY,
} from '../components/LucaPassport.jsx';

const renderPassport = async () => {
  const utils = render(<div className="luca"><PassportActions go={vi.fn()} /></div>);
  // Wait for the initial getHealthDocuments to settle.
  await screen.findByRole('button', { name: /Update my Health Passport/i });
  return utils;
};

beforeEach(() => {
  cleanup();
  apiState.documents = [];
  apiState.createCalls = [];
  try { localStorage.clear(); } catch { /* noop */ }
});

describe('§1 Update my Health Passport accordion', () => {
  it('is ONE accessible accordion button, collapsed by default on mobile', async () => {
    await renderPassport();
    const head = screen.getByRole('button', { name: /Update my Health Passport/i });
    expect(head).toHaveAttribute('aria-expanded', 'false');
    // Collapsed: the actions are not in the DOM yet.
    expect(screen.queryByRole('button', { name: /Add or sync health data from device/i })).toBeNull();
  });

  it('expands to a single column with the 3 existing actions + the NEW device action', async () => {
    await renderPassport();
    const head = screen.getByRole('button', { name: /Update my Health Passport/i });
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Update your intake/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add health data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Book more tests/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add or sync health data from device/i })).toBeInTheDocument();
    // Single column: the actions live in a flex .col container (no multi-col grid).
    const body = document.getElementById('hp-update-body');
    expect(body.querySelector('.col')).toBeTruthy();
    expect(body.querySelector('[style*="repeat(auto-fit"]')).toBeNull();
  });
});

describe('§2 mock device-data sync sheet', () => {
  const openSheet = async () => {
    await renderPassport();
    fireEvent.click(screen.getByRole('button', { name: /Update my Health Passport/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add or sync health data from device/i }));
    return screen.findByRole('dialog', { name: /Sync health data from device/i });
  };

  it('opens the AdaptiveOverlay with both simulated demo providers + disabled roadmap actions', async () => {
    const sheet = await openSheet();
    expect(within(sheet).getByText(/Simulated · Demo data/i)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /Apple Health — Demo/i })).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: /Google Health \/ Fitbit — Demo/i })).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: /Connect Google Health — setup required/i })).toBeDisabled();
    expect(within(sheet).getByRole('button', { name: /Connect Apple Health — native app required/i })).toBeDisabled();
  });

  it('requires consent before import (import disabled until the box is checked)', async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole('button', { name: /Apple Health — Demo/i }));
    // Preview shows synthetic metrics.
    expect(within(sheet).getByText(/Resting heart rate/i)).toBeInTheDocument();
    const importBtn = within(sheet).getByRole('button', { name: /Import to my Passport/i });
    expect(importBtn).toBeDisabled();
    fireEvent.click(within(sheet).getByRole('checkbox'));
    expect(within(sheet).getByRole('button', { name: /Import to my Passport/i })).toBeEnabled();
  });

  it('imports deterministically + idempotently (no duplicate records)', () => {
    const a1 = importDeviceSnapshot('apple');
    const a2 = importDeviceSnapshot('apple'); // repeat — must not duplicate
    expect(Object.keys(a2).length).toBe(1);
    const rec = Object.values(a2)[0];
    expect(rec.simulated).toBe(true);
    expect(rec.source).toBe('Apple Health — Demo');
    const steps = rec.metrics.find((m) => m.key === 'steps');
    expect(steps.value).toBe('8,240'); // deterministic fixture
    const both = importDeviceSnapshot('google');
    expect(Object.keys(both).length).toBe(2);
    // Persisted under the private device-only key.
    expect(Object.keys(JSON.parse(localStorage.getItem(DEVICE_SYNC_KEY))).length).toBe(2);
  });

  it('does NOT auto-share imported device data with LUCA', async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole('button', { name: /Apple Health — Demo/i }));
    fireEvent.click(within(sheet).getByRole('checkbox'));
    fireEvent.click(within(sheet).getByRole('button', { name: /Import to my Passport/i }));
    // No health document was created (never posted to the LUCA-shared store).
    expect(apiState.createCalls.length).toBe(0);
    // Shared-with-LUCA count stays at 0.
    expect(within(screen.getByRole('button', { name: /Shared with LUCA/i })).getByText('0')).toBeInTheDocument();
  });

  it('closes cleanly', async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Close$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Sync health data from device/i })).toBeNull());
  });
});

describe('§3 Shared with LUCA accordion', () => {
  it('is collapsed by default when empty and shows a 0 count', async () => {
    await renderPassport();
    const head = screen.getByRole('button', { name: /Shared with LUCA/i });
    expect(head).toHaveAttribute('aria-expanded', 'false');
    expect(within(head).getByText('0')).toBeInTheDocument();
    expect(screen.queryByText(/Nothing shared yet/i)).toBeNull();
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText(/Nothing shared yet/i)).toBeInTheDocument();
  });

  it('reflects the current document count in the header', async () => {
    apiState.documents = [
      { id: 1, filename: 'labs.pdf', provenance_level: 2, created_at: '2026-08-01' },
      { id: 2, doc_type: 'note', description: 'note', created_at: '2026-08-02' },
    ];
    await renderPassport();
    const head = await screen.findByRole('button', { name: /Shared with LUCA/i });
    await waitFor(() => expect(within(head).getByText('2')).toBeInTheDocument());
  });
});

describe('§4 Privacy & Sovereignty destination + legacy redirect', () => {
  it('resolves legacy Sovereignty nav to Settings → Privacy', () => {
    expect(resolveNav('sovereign')).toEqual({ tab: 'account', sub: 'privacy' });
    expect(resolveNav('sovereignty')).toEqual({ tab: 'account', sub: 'privacy' });
    expect(SUBTABS.account.tabs).toContain('privacy');
  });

  it('renders the Sovereignty card inside Settings → Privacy & Sovereignty', async () => {
    render(<div className="luca"><SettingsPage user={{ id: 1 }} go={vi.fn()} sub="privacy" /></div>);
    // The renamed subtab label.
    expect(await screen.findByRole('tab', { name: /Privacy & Sovereignty/i })).toBeInTheDocument();
    // The relocated Sovereignty card content.
    expect(await screen.findByText(/Who holds your Passport/i)).toBeInTheDocument();
  });

  it('does NOT render the Sovereignty card on the Health Passport actions', async () => {
    await renderPassport();
    expect(screen.queryByText(/Who holds your Passport/i)).toBeNull();
  });
});

describe('§5 single-column compact layout invariants', () => {
  it('renders both sections as compact accordion rows and uses no multi-column action grid', async () => {
    await renderPassport();
    // Two compact accordion rows (Update + Shared with LUCA), each a single block.
    expect(document.querySelectorAll('.hp-acc').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: /Update my Health Passport/i }));
    // Actions stack in a flex column; no legacy auto-fit multi-column grid anywhere.
    const body = document.getElementById('hp-update-body');
    expect(body.querySelector('.col')).toBeTruthy();
    expect(body.querySelectorAll('.hp-actrow').length).toBeGreaterThanOrEqual(4);
    expect(document.querySelector('[style*="repeat(auto-fit"]')).toBeNull();
  });
});
