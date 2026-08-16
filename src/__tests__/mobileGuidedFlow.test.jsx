/**
 * Mobile guided-flow corrections (Explore):
 *  • "Recommend for me" sparkle button surfaces a LUCA recommendation sheet
 *    whose primary action deep-links the EXACT recommended provider.
 *  • "Guided journeys" is a compact accordion row (count + chevron), collapsed
 *    by default, expanding to the existing journey cards in one column.
 *  • The selected map card exposes TWO actions ("View details" + "Book"), and
 *    "Book" opens the shared BookingFlow overlay directly.
 *
 * matchMedia is forced to a phone viewport before import so the mobile branch
 * renders. MapView is stubbed to preserve the real onSelect / onOpenDetail /
 * onBook contract (Leaflet cannot lay out in jsdom).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';

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
    id: 7, business_name: 'Aura Dental', provider_type: 'dentist', rating: 4.8, review_count: 42,
    city: 'San Salvador', region: 'San Salvador', price_range: '$$', verified: true,
    latitude: 13.7, longitude: -89.2,
    hours_of_operation: { meta: { modality: 'in_person', languages: ['English'] } },
  },
];

const BLUEPRINTS = [
  { type: 'heart', label: 'Heart Health Journey', specialty: 'cardiology', steps: [] },
  { type: 'sleep', label: 'Better Sleep Journey', specialty: 'sleep', steps: [] },
];

const RECS = {
  nextStep: { title: 'Book a dental cleaning', description: 'You are due for a checkup.', action: 'Based on your last visit', cta: 'Book now', target: 'explore' },
  curatedJourney: { title: 'Aura Dental', specialty: 'Dentistry', city: 'San Salvador', reason: 'Top rated near you', providerId: 7 },
};

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

// MapView stub keeping the real two-action map-card contract.
vi.mock('../components/marketplace/MapView.jsx', () => ({
  default: ({ providers = [], activeId, onSelect, onOpenDetail, onBook, onClearActive }) => {
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
            <span data-testid="map-card-name">{active.business_name}</span>
            <button type="button" onClick={() => onOpenDetail && onOpenDetail(active)}>View details</button>
            <button type="button" onClick={() => onBook && onBook(active)}>Book</button>
            <button type="button" aria-label="Close provider card" onClick={() => onClearActive && onClearActive()}>x</button>
          </div>
        )}
      </div>
    );
  },
}));

import ExploreMarketplace from '../components/marketplace/ExploreMarketplace.jsx';

const renderExplore = async () => {
  // Stable shell `.luca` root so the mobile portal target never migrates into a
  // transient overlay's own `.luca` (mirrors the real LucaPassport shell).
  const utils = render(
    <div className="luca">
      <ExploreMarketplace user={{ id: 1, role: 'patient' }} />
    </div>
  );
  // Mobile Explore now defaults to the List stage, so wait for a list card to
  // mount (map markers only exist once the user switches to Map).
  await waitFor(() => expect(document.querySelector('[data-pid="7"] .plc')).toBeTruthy());
  return utils;
};

// Switch the mobile stage to Map and wait for the marker to mount.
const showMap = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Map' }));
  await screen.findByTestId('marker-7');
};

describe('Recommend (compact guidance button)', () => {
  it('opens a recommendation sheet and reveals + opens the exact recommended provider', async () => {
    await renderExplore();
    const recBtn = screen.getByRole('button', { name: /^Recommend$/i });
    expect(recBtn).toBeInTheDocument();
    fireEvent.click(recBtn);
    await screen.findByRole('dialog', { name: 'LUCA recommendations' });
    // The recommendation resolves asynchronously; wait for its card content.
    await waitFor(() => expect(document.querySelector('.exm-cc.journey')).toBeTruthy());
    expect(document.querySelector('.exm-cc.journey h5').textContent).toBe('Aura Dental');
    // Primary action reveals + opens the exact recommended provider (deep-link by id).
    const view = await screen.findByRole('button', { name: /View this provider/i });
    fireEvent.click(view);
    // Sheet closes; the recommended provider is revealed on the map (marker active).
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'LUCA recommendations' })).toBeNull());
    const card = await screen.findByTestId('map-card');
    expect(within(card).getByTestId('map-card-name')).toHaveTextContent('Aura Dental');
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Guided journeys (bottom sheet)', () => {
  it('opens the AdaptiveOverlay sheet with one-column journey cards and a visible close', async () => {
    await renderExplore();
    const btn = screen.getByRole('button', { name: /Guided journeys/i });
    expect(btn).toBeInTheDocument();
    // No sheet until tapped.
    expect(screen.queryByRole('dialog', { name: 'Guided journeys' })).toBeNull();
    fireEvent.click(btn);
    const sheet = await screen.findByRole('dialog', { name: 'Guided journeys' });
    // One-column journey cards sourced from the existing blueprint data.
    const cards = sheet.querySelectorAll('.exm-gjs .exm-jc');
    expect(cards.length).toBe(BLUEPRINTS.length);
    expect(within(sheet).getByText('Heart Health Journey')).toBeInTheDocument();
    // Visible close (X) dismisses the sheet.
    const close = within(sheet).getByRole('button', { name: /Close guided journeys/i });
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Guided journeys' })).toBeNull());
  });
});

describe('Selected map card — two actions', () => {
  it('exposes View details + Book, and Book opens the booking overlay', async () => {
    await renderExplore();
    await showMap();
    fireEvent.click(screen.getByTestId('marker-7'));
    const card = screen.getByTestId('map-card');
    expect(within(card).getByRole('button', { name: 'View details' })).toBeInTheDocument();
    const book = within(card).getByRole('button', { name: 'Book' });
    expect(book).toBeInTheDocument();
    fireEvent.click(book);
    // The shared BookingFlow overlay opens directly.
    await screen.findByRole('dialog', { name: 'Book an appointment' });
  });
});
