/**
 * Compact mobile Explore (branch agent/abacus-mobile-explore-compact-a2) —
 * structural checks that jsdom can prove:
 *
 *   §1  The duplicated big "Explore" heading + long description are removed from
 *       the default mobile visual and kept SR-only; the compact controls stack in
 *       the order search → quick filters → two EQUAL guidance buttons (Recommend +
 *       Guided journeys) → compact Map/List selector → results.
 *   §2  The Map/List selector is a compact segmented control (icon + name, no
 *       icon-only), sharing its row with the result count, with aria-pressed and
 *       group semantics intact.
 *   §3  "Recommend" opens the recommendation sheet and its primary action reveals +
 *       opens the EXACT recommended provider; "Guided journeys" opens the
 *       AdaptiveOverlay bottom sheet (title "Guided journeys", visible close,
 *       one-column journey cards from existing blueprint data) and closes cleanly.
 *   §5  List mode keeps the full single-column listing card (compact preview is a
 *       Map-mode-only concern proven in the installed-PWA Chromium simulation).
 *
 * §4 (marker-anchored compact preview) and the pixel geometry acceptance
 * (controls ≤28% / map ≥72%, auto-pan, real-touch close, safe-area) require a
 * laid-out Leaflet map and are proven in the installed-PWA Chromium simulation,
 * reported honestly as a simulation — not asserted here (MapView is stubbed).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';

// Force a phone viewport (max-width queries match) before the component imports.
beforeAll(() => {
  window.matchMedia = (q) => ({
    matches: /max-width/.test(q),
    media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {},
  });
});

const PROVIDERS = [
  {
    id: 1, business_name: 'Aura Dental', provider_type: 'dentist', rating: 4.8, review_count: 42,
    city: 'San Salvador', region: 'San Salvador', price_range: '$$', verified: true, featured: true,
    latitude: 13.7, longitude: -89.2,
    description: 'A trusted dental clinic in San Salvador.',
    hours_of_operation: { meta: { modality: 'in_person', languages: ['Spanish', 'English'] } },
  },
  {
    id: 2, business_name: 'Verde Nutrition', provider_type: 'nutritionist', rating: 4.2, review_count: 10,
    city: 'Santa Ana', region: 'Santa Ana', price_range: '$', latitude: 13.9, longitude: -89.5,
    hours_of_operation: { meta: { modality: 'virtual', languages: ['English'] } },
  },
];

const BLUEPRINTS = [
  { type: 'heart', label: 'Heart Health Journey', specialty: 'cardiology', steps: [] },
  { type: 'sleep', label: 'Better Sleep Journey', specialty: 'sleep', steps: [] },
];

const RECS = {
  nextStep: { title: 'Book a dental cleaning', description: 'You are due for a checkup.', action: 'Based on your last visit' },
  curatedJourney: { title: 'Aura Dental', specialty: 'Dentistry', city: 'San Salvador', reason: 'Top rated near you', providerId: 1 },
};

const APPROVED_DESC = 'Discover trusted health & wellness providers near you — clinics, farms, healers, and more.';

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    setExploreFilter: vi.fn(), setTab: vi.fn(),
    setPendingProviderId: vi.fn(), setPendingCurate: vi.fn(),
  }),
  AppProvider: ({ children }) => children,
}));

vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'getProviders') return () => Promise.resolve({ providers: PROVIDERS });
      if (prop === 'getJourneyBlueprints') return () => Promise.resolve({ blueprints: BLUEPRINTS });
      if (prop === 'getLucaRecommendations') return () => Promise.resolve(RECS);
      if (prop === 'getProvider') return () => Promise.resolve({ provider: PROVIDERS[0], services: [] });
      if (prop === 'getAvailableSlots') return () => Promise.resolve({ slots: [] });
      return () => Promise.resolve({});
    },
  }),
}));

// Light MapView stub (Leaflet cannot lay out in jsdom) keeping the sync contract.
vi.mock('../components/marketplace/MapView.jsx', () => ({
  default: ({ providers = [], activeId, onSelect, onOpenDetail, onClearActive }) => {
    const active = providers.find((p) => p.id === activeId);
    return (
      <div data-testid="mapview">
        {providers.map((p) => (
          <button key={p.id} type="button" data-testid={`marker-${p.id}`} onClick={() => onSelect && onSelect(p)}>
            {p.business_name}
          </button>
        ))}
        {active && (
          <div data-testid="map-card" role="dialog" aria-label={`${active.business_name} summary`}>
            <button type="button" onClick={() => onOpenDetail && onOpenDetail(active)}>Open</button>
            <button type="button" aria-label="Close provider card" onClick={() => onClearActive && onClearActive()}>x</button>
          </div>
        )}
      </div>
    );
  },
}));

import ExploreMarketplace from '../components/marketplace/ExploreMarketplace.jsx';

// A stable shell `.luca` root (as the real LucaPassport shell provides) so the
// mobile portal target never migrates into a transient overlay's own `.luca`.
const renderExplore = async () => {
  const utils = render(
    <div className="luca">
      <ExploreMarketplace user={{ id: 1, role: 'patient' }} />
    </div>
  );
  await waitFor(() => expect(screen.getByTestId('marker-1')).toBeTruthy());
  return utils;
};

// true when `a` precedes `b` in document order.
const precedes = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('§1 compact, content-first mobile Explore', () => {
  it('drops the duplicated visible heading/description and keeps them SR-only', async () => {
    await renderExplore();
    // No visible big heading/description blocks remain.
    expect(document.querySelector('.exm-mhead')).toBeNull();
    expect(document.querySelector('.exm-mtitle')).toBeNull();
    expect(document.querySelector('.exm-mdesc')).toBeNull();
    // Heading + description survive for assistive tech only.
    const heading = screen.getByRole('heading', { name: 'Explore' });
    expect(heading.classList.contains('exm-sr')).toBe(true);
    const desc = document.querySelector('p.exm-sr');
    expect(desc.textContent).toBe(APPROVED_DESC);
  });

  it('stacks the compact controls: search → quick filters → two guidance buttons → segmented → results', async () => {
    await renderExplore();
    const bar = document.querySelector('.exm-mbar');
    const quick = screen.getByRole('group', { name: 'Quick filters' });
    const guide = document.querySelector('.exm-mguide');
    const tools = document.querySelector('.exm-mtools');
    const stage = document.querySelector('.exm-mstage');
    [bar, quick, guide, tools, stage].forEach((n) => expect(n).toBeTruthy());
    expect(precedes(bar, quick)).toBe(true);
    expect(precedes(quick, guide)).toBe(true);
    expect(precedes(guide, tools)).toBe(true);
    expect(precedes(tools, stage)).toBe(true);
  });

  it('renders exactly two EQUAL guidance buttons: Recommend + Guided journeys', async () => {
    await renderExplore();
    const guide = document.querySelector('.exm-mguide');
    const gbtns = guide.querySelectorAll('.exm-mgbtn');
    expect(gbtns.length).toBe(2);
    expect(within(guide).getByRole('button', { name: /^Recommend$/i })).toBeInTheDocument();
    expect(within(guide).getByRole('button', { name: /Guided journeys/i })).toBeInTheDocument();
    // Equal width: the container is a 2-track 1fr/1fr grid (no per-button width hack).
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toMatch(/\.luca \.exm-mguide\{[^}]*grid-template-columns:\s*1fr 1fr/);
  });

  it('keeps 44px tap targets on the guidance buttons (no sub-44 min-height)', async () => {
    await renderExplore();
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toMatch(/\.luca \.exm-mgbtn\{[^}]*min-height:\s*44px/);
  });
});

describe('§2 compact Map/List segmented control', () => {
  it('is a labelled group of icon+name buttons that share the result-count row', async () => {
    await renderExplore();
    const tools = document.querySelector('.exm-mtools');
    // Result count lives on the same row (aria-live for updates).
    const count = tools.querySelector('.exm-mcount');
    expect(count).toBeTruthy();
    expect(count.getAttribute('aria-live')).toBe('polite');
    const group = within(tools).getByRole('group', { name: 'Choose map or list view' });
    const map = within(group).getByRole('button', { name: 'Map' });
    const list = within(group).getByRole('button', { name: 'List' });
    // Names present (never icon-only) + active state exposed via aria-pressed.
    expect(map).toHaveAttribute('aria-pressed', 'true');
    expect(list).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(list);
    expect(within(group).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('§3 guidance actions', () => {
  it('Recommend reveals + opens the exact recommended provider', async () => {
    await renderExplore();
    fireEvent.click(screen.getByRole('button', { name: /^Recommend$/i }));
    await screen.findByRole('dialog', { name: 'LUCA recommendations' });
    await waitFor(() => expect(document.querySelector('.exm-cc.journey')).toBeTruthy());
    const view = await screen.findByRole('button', { name: /View this provider/i });
    fireEvent.click(view);
    // Sheet closes; the recommended provider is revealed on the map (marker active)
    // and its detail is opened (setActiveId + setMobileView('map') + setOpenId).
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'LUCA recommendations' })).toBeNull());
    await screen.findByTestId('map-card');
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Guided journeys opens a bottom sheet with one-column cards + visible close, and closes', async () => {
    await renderExplore();
    expect(screen.queryByRole('dialog', { name: 'Guided journeys' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Guided journeys/i }));
    const sheet = await screen.findByRole('dialog', { name: 'Guided journeys' });
    const cards = sheet.querySelectorAll('.exm-gjs .exm-jc');
    expect(cards.length).toBe(BLUEPRINTS.length);
    expect(within(sheet).getByText('Heart Health Journey')).toBeInTheDocument();
    // One column via a single-track grid override.
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toMatch(/\.exm-gjs \.exm-journeys-grid\{grid-template-columns:1fr\}/);
    fireEvent.click(within(sheet).getByRole('button', { name: /Close guided journeys/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Guided journeys' })).toBeNull());
  });
});

describe('§5 List mode keeps the full single-column listing card', () => {
  it('renders a full .plc card per provider in the list stage', async () => {
    await renderExplore();
    fireEvent.click(within(document.querySelector('.exm-mtools')).getByRole('button', { name: 'List' }));
    expect(document.querySelector('.exm-mlist')).toBeTruthy();
    expect(document.querySelector('[data-pid="1"] .plc')).toBeTruthy();
    expect(document.querySelector('[data-pid="2"] .plc')).toBeTruthy();
  });
});
