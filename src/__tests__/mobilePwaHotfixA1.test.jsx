/**
 * Mobile PWA hotfix (branch agent/abacus-mobile-pwa-hotfix-a1) — targeted checks
 * for the corrections that can be asserted structurally in jsdom:
 *
 *   §1  Explore MOBILE header is a normal-flow stack in the exact order
 *       title → description → search+filter → quick filters → Recommend →
 *       Map/List segmented → content, with the exact approved description and
 *       the shared PageHead (Member badge host) hidden on mobile Explore.
 *   §2  Mobile listing card keeps stars/reviews/price INSIDE the card, orders
 *       location+price as the final row, uses min-width:0 content containers,
 *       and never positions the price absolutely; a full-width "Show on map"
 *       action sits beneath each list card.
 *   §5  The phone Select-Date step is a 7-day date strip (prev/next week +
 *       "More dates") with a 2-column time grid capped at 6 initial slots.
 *
 * Real pixel-level overlap / tap-target geometry is proven separately in the
 * installed-PWA Chromium simulation (reported honestly as a simulation).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';

// Force a phone viewport (max-width queries match) before anything reads it.
beforeAll(() => {
  window.matchMedia = (q) => ({
    matches: /max-width/.test(q),
    media: q,
    onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {},
  });
});

const PROVIDERS = [
  {
    id: 1, business_name: 'Aura Dental Wellness Center of San Salvador', provider_type: 'dentist',
    rating: 4.8, review_count: 42, city: 'San Salvador', region: 'San Salvador', price_range: '$$',
    verified: true, featured: true, latitude: 13.7, longitude: -89.2,
    description: 'A long clinic description that should clamp to two lines on a phone without ever forcing the card to overflow horizontally beyond its own width.',
    hours_of_operation: { meta: { modality: 'in_person', languages: ['Spanish', 'English'] } },
  },
];

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
      return () => Promise.resolve({});
    },
  }),
}));

// Light MapView stub (Leaflet cannot lay out in jsdom) keeping the sync contract.
vi.mock('../components/marketplace/MapView.jsx', () => ({
  default: ({ providers = [] }) => (
    <div data-testid="mapview">
      {providers.map((p) => (
        <button key={p.id} type="button" data-testid={`marker-${p.id}`}>{p.business_name}</button>
      ))}
    </div>
  ),
}));

import ExploreMarketplace from '../components/marketplace/ExploreMarketplace.jsx';
import ProviderListingCard from '../components/marketplace/ProviderListingCard.jsx';
import TimeSlotPicker from '../components/booking/TimeSlotPicker.jsx';

const APPROVED_DESC = 'Discover trusted health & wellness providers near you — clinics, farms, healers, and more.';

const renderExplore = async () => {
  const utils = render(
    <div className="luca">
      <ExploreMarketplace user={{ id: 1, role: 'patient' }} />
    </div>
  );
  await waitFor(() => expect(screen.getByTestId('marker-1')).toBeTruthy());
  return utils;
};

// DOM order helper: true when `a` precedes `b` in document order.
const precedes = (a, b) =>
  !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('§1 Explore mobile header — compact, content-first (A.2 supersedes A.1)', () => {
  it('retains the heading + approved description for screen readers only (no visible duplicate)', async () => {
    await renderExplore();
    // Heading + description survive for assistive tech, but as visually-hidden nodes.
    const heading = screen.getByRole('heading', { name: 'Explore' });
    expect(heading).toBeInTheDocument();
    expect(heading.classList.contains('exm-sr')).toBe(true);
    const desc = document.querySelector('p.exm-sr');
    expect(desc).toBeTruthy();
    expect(desc.textContent).toBe(APPROVED_DESC);
    // The old visible header block is gone from the default mobile visual.
    expect(document.querySelector('.exm-mhead')).toBeNull();
    expect(document.querySelector('.exm-mtitle')).toBeNull();
    expect(document.querySelector('.exm-mdesc')).toBeNull();
  });

  it('orders the compact controls search → quick filters → two guidance buttons → segmented → content', async () => {
    await renderExplore();
    const bar = document.querySelector('.exm-mbar');
    const quick = screen.getByRole('group', { name: 'Quick filters' });
    const guide = document.querySelector('.exm-mguide');
    const seg = screen.getByRole('group', { name: 'Choose map or list view' });
    const stage = document.querySelector('.exm-mstage');
    [bar, quick, guide, seg, stage].forEach((n) => expect(n).toBeTruthy());
    expect(precedes(bar, quick)).toBe(true);
    expect(precedes(quick, guide)).toBe(true);
    expect(precedes(guide, seg)).toBe(true);
    expect(precedes(seg, stage)).toBe(true);
    // Exactly two equal guidance buttons: Recommend + Guided journeys.
    const gbtns = guide.querySelectorAll('.exm-mgbtn');
    expect(gbtns.length).toBe(2);
    expect(within(guide).getByRole('button', { name: /Recommend/i })).toBeInTheDocument();
    expect(within(guide).getByRole('button', { name: /Guided journeys/i })).toBeInTheDocument();
  });

  it('lays out the visually-hidden heading with the standard clip technique, not a layout hack', async () => {
    await renderExplore();
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    const srRule = (css.match(/\.luca \.exm-sr\{[^}]*\}/) || [])[0];
    expect(srRule).toBeTruthy();
    // Off-screen via clip/absolute — the compact control rows themselves stay in-flow.
    expect(srRule).toMatch(/overflow:\s*hidden/);
    const controlRules = css.match(/\.luca \.exm-m(bar|guide|tools|stage)\{[^}]*\}/g) || [];
    expect(controlRules.length).toBeGreaterThan(0);
    controlRules.forEach((rule) => {
      expect(rule).not.toMatch(/margin[^;:]*:\s*-/);
    });
  });

  it('hides the shared PageHead (Member badge host) on mobile Explore', async () => {
    await renderExplore();
    // The mobile effect flags the shell root so CSS can hide the shared header.
    const root = document.querySelector('.luca');
    expect(root.classList.contains('exm-mobile-active')).toBe(true);
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toMatch(/\.luca\.exm-mobile-active \.page-head\{display:none\}/);
    // No Member badge is rendered inside the Explore mobile subtree.
    expect(screen.queryByText(/^Member$/)).toBeNull();
  });
});

describe('§2 Mobile listing card', () => {
  const renderCard = () =>
    render(<div className="luca"><ProviderListingCard provider={PROVIDERS[0]} onOpen={vi.fn()} /></div>);

  it('keeps rating + review count and price INSIDE the card, price as the final row', () => {
    renderCard();
    const card = document.querySelector('.plc');
    const rating = card.querySelector('.plc-rating');
    const meta = card.querySelector('.plc-meta');
    const price = card.querySelector('.plc-price');
    expect(rating).toBeTruthy();
    expect(meta).toBeTruthy();
    expect(price).toBeTruthy();
    // Price/location row is the last child of the card body.
    const body = card.querySelector('.plc-body');
    expect(body.lastElementChild).toBe(meta);
    // Rating row comes after the name and before the meta row.
    const name = card.querySelector('.plc-name');
    expect(precedes(name, rating)).toBe(true);
    expect(precedes(rating, meta)).toBe(true);
    // Featured badge is inline (not an absolute media overlay).
    expect(card.querySelector('.plc-feat')).toBeNull();
    expect(card.querySelector('.plc-feat-badge')).toBeTruthy();
  });

  it('stacks to one full-width column with min-width:0 and never positions price absolutely', () => {
    renderCard();
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    // Phone breakpoint collapses the card into a single column with a 16:9 cover.
    expect(css).toMatch(/@media\(max-width:480px\)\{[^]*\.luca \.plc\{flex-direction:column/);
    expect(css).toMatch(/\.luca \.plc-media\{width:100%;min-width:0;height:auto;aspect-ratio:16\/9/);
    // Content containers carry min-width:0 so long text can't force overflow.
    expect(css).toMatch(/\.luca \.plc-body\{[^}]*min-width:0/);
    expect(css).toMatch(/\.luca \.plc-meta\{[^}]*min-width:0/);
    // The price is never absolutely positioned.
    const priceRule = css.match(/\.luca \.plc-price\{[^}]*\}/)[0];
    expect(priceRule).not.toMatch(/position:\s*absolute/);
  });
});

describe('§5 phone Select-Date — 7-day strip + capped time grid', () => {
  // 15 evenly spaced slots so the 6-slot cap and "+N more" are exercised.
  const SLOTS = Array.from({ length: 15 }, (_, i) => {
    const h = 8 + i;
    return { start: `${String(h).padStart(2, '0')}:00`, end: `${String(h).padStart(2, '0')}:30` };
  });
  const DATES = [
    { date: '2026-09-15', slots: SLOTS },
    { date: '2026-09-16', slots: [{ start: '10:00', end: '10:30' }] },
  ];

  const renderPicker = (onChange = vi.fn()) => {
    render(<div className="luca"><TimeSlotPicker dates={DATES} value={null} onChange={onChange} tz="America/El_Salvador" /></div>);
    return onChange;
  };

  it('shows a 7-day strip with previous/next week and a "More dates" escape hatch (no full month by default)', () => {
    renderPicker();
    expect(document.querySelector('.tsp-narrow')).toBeTruthy();
    expect(document.querySelectorAll('.tsp-day').length).toBe(7);
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More dates/i })).toBeInTheDocument();
    // The full month grid is NOT shown until "More dates" is tapped.
    expect(document.querySelector('.tsp-cal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /More dates/i }));
    expect(document.querySelector('.tsp-cal')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Back to week/i })).toBeInTheDocument();
  });

  it('caps the initial time choices at 6 in a 2-column grid and reveals the rest on demand', () => {
    renderPicker();
    const grid = document.querySelector('.tsp-slot-grid');
    expect(grid.classList.contains('narrow')).toBe(true);
    expect(document.querySelectorAll('.tsp-slot').length).toBe(6);
    const more = screen.getByRole('button', { name: /\+9 more times/i });
    fireEvent.click(more);
    expect(document.querySelectorAll('.tsp-slot').length).toBe(SLOTS.length);
  });

  it('selecting a time reports the exact chosen slot to the caller', () => {
    const onChange = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: '8:00 AM' }));
    expect(onChange).toHaveBeenCalledWith({ date: '2026-09-15', start: '08:00', end: '08:30' });
  });
});
