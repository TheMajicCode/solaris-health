/**
 * Explore mobile map/list experience — quick filters + full filter sheet, the
 * explicit Map | List segmented switch (default Map), and marker<->list
 * synchronisation in both directions via the shared activeId.
 *
 * matchMedia is forced to report a phone viewport BEFORE the component imports,
 * so ExploreMarketplace renders its mobile branch (segmented Map/List stage).
 * Leaflet cannot lay out in jsdom, so MapView is replaced with a light stub that
 * preserves the real marker<->list wiring (onSelect / activeId / onOpenDetail).
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
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  });
});

const PROVIDERS = [
  {
    id: 1, business_name: 'Aura Dental', provider_type: 'dentist', rating: 4.8, review_count: 42,
    city: 'San Salvador', region: 'San Salvador', price_range: '$$', verified: true,
    latitude: 13.7, longitude: -89.2,
    hours_of_operation: { meta: { modality: 'in_person', languages: ['Spanish', 'English'], days: ['mon', 'tue'] } },
  },
  {
    id: 2, business_name: 'Verde Nutrition', provider_type: 'nutritionist', rating: 4.2, review_count: 10,
    city: 'Santa Ana', region: 'Santa Ana', price_range: '$',
    latitude: 13.9, longitude: -89.5,
    hours_of_operation: { meta: { modality: 'virtual', languages: ['English'] } },
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

// Light MapView stub keeping the real sync contract.
vi.mock('../components/marketplace/MapView.jsx', () => ({
  default: ({ providers = [], activeId, onSelect, onOpenDetail, onClearActive }) => {
    const active = providers.find((p) => p.id === activeId);
    return (
      <div data-testid="mapview">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid={`marker-${p.id}`}
            aria-label={`Select ${p.business_name} on map`}
            onClick={() => onSelect && onSelect(p)}
          >
            {p.business_name}
          </button>
        ))}
        {active && (
          <div data-testid="map-card" role="dialog" aria-label={`${active.business_name} summary`}>
            <span data-testid="map-card-name">{active.business_name}</span>
            <button type="button" onClick={() => onOpenDetail && onOpenDetail(active)}>View &amp; book</button>
            <button type="button" aria-label="Close provider card" onClick={() => onClearActive && onClearActive()}>x</button>
          </div>
        )}
      </div>
    );
  },
}));

import ExploreMarketplace from '../components/marketplace/ExploreMarketplace.jsx';

// Default mobile view is the map, so wait for the map stub to mount.
const renderExplore = async () => {
  const utils = render(<ExploreMarketplace user={{ id: 1, role: 'patient' }} />);
  await waitFor(() => expect(screen.getByTestId('marker-1')).toBeTruthy());
  return utils;
};

const seg = (name) => screen.getByRole('button', { name });
const showList = () => fireEvent.click(seg('List'));
const showMap = () => fireEvent.click(seg('Map'));

describe('quick filters + full filter sheet', () => {
  it('renders quick-filter chips mapped to real fields and toggles one', async () => {
    await renderExplore();
    const group = screen.getByRole('group', { name: 'Quick filters' });
    // Real-field chips only (rating / modality / verified / value-to-value / type).
    const topRated = within(group).getByRole('button', { name: 'Top rated' });
    expect(within(group).getByRole('button', { name: 'Virtual' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Verified' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Value-to-value' })).toBeInTheDocument();
    expect(topRated).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(topRated);
    expect(within(group).getByRole('button', { name: 'Top rated' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens an accessible full filter sheet with Clear + Apply(count) and closes on Escape', async () => {
    await renderExplore();
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Filter providers' });
    expect(within(dialog).getByRole('button', { name: /Clear all/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Show \d+ result/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close filters' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filter providers' })).toBeNull());
  });
});

describe('Map | List segmented switch', () => {
  it('defaults to Map and toggles to List (aria-pressed reflects the active view)', async () => {
    await renderExplore();
    const group = screen.getByRole('group', { name: 'Choose map or list view' });
    expect(within(group).getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false');
    // Map stage is mounted, the single-column list stage is not.
    expect(document.querySelector('.exm-mmap')).toBeTruthy();
    expect(document.querySelector('.exm-mlist')).toBeNull();

    showList();
    expect(within(group).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false');
    // List stage renders full-width single-column cards.
    expect(document.querySelector('.exm-mlist')).toBeTruthy();
    expect(document.querySelector('[data-pid="1"] .plc')).toBeTruthy();
    expect(document.querySelector('.exm-mmap')).toBeNull();
  });
});

describe('marker <-> list synchronisation', () => {
  it('selecting a marker opens its map card and highlights the matching list item after switching to List', async () => {
    await renderExplore();
    fireEvent.click(screen.getByTestId('marker-2'));
    // Map card for the selected provider appears.
    expect(screen.getByTestId('map-card-name')).toHaveTextContent('Verde Nutrition');
    // Switching to the list keeps that provider highlighted (plc-active).
    showList();
    const listItem = document.querySelector('[data-pid="2"] .plc');
    expect(listItem).toHaveClass('plc-active');
  });

  it('"Show on map" from a list card selects + reveals its marker (map card shows the same provider)', async () => {
    await renderExplore();
    showList();
    const showMapBtn = within(document.querySelector('[data-pid="1"]')).getByRole('button', { name: /Show on map/i });
    fireEvent.click(showMapBtn);
    // Returns to the map view with that provider selected.
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('map-card-name')).toHaveTextContent('Aura Dental');
  });
});
