/**
 * Economic Passport tab-row — verifies the opt-in horizontally scrollable
 * SubTabs variant used ONLY by the Economic Passport area: all four
 * destinations (Wallet, GPS, Contributions, Network) render in a single
 * tablist row, the active tab is reachable/selectable, the row is a
 * no-wrap horizontally scrollable container (touch scroll + scroll-snap),
 * and the visual scrollbar is hidden via the `subtabs-scroll` class while
 * keyboard a11y (roving tabindex + arrow keys) is preserved. Non-scroll
 * consumers (LUCA Coach, Communications) keep the wrapping `row wrap` layout.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({ user: null }),
  AppProvider: ({ children }) => children,
}));

vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, { get: () => () => Promise.resolve({}) }),
}));

import { SubTabs } from '../components/LucaPassport.jsx';

const EP_ITEMS = [
  { id: 'wallet', label: 'Wallet' },
  { id: 'gps', label: 'GPS' },
  { id: 'contributions', label: 'Contributions' },
  { id: 'network', label: 'Network' },
];

describe('Economic Passport tab row (scroll variant)', () => {
  it('renders all four destinations in a single tablist and each is selectable', () => {
    const onSelect = vi.fn();
    render(<SubTabs ariaLabel="Economic Passport sections" scroll active="wallet" onSelect={onSelect} items={EP_ITEMS} />);
    const list = screen.getByRole('tablist', { name: 'Economic Passport sections' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs.map((t) => t.textContent.trim())).toEqual(['Wallet', 'GPS', 'Contributions', 'Network']);
    // every destination is reachable (clickable) — none dropped from the row
    for (const t of tabs) fireEvent.click(t);
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual(['wallet', 'gps', 'contributions', 'network']);
  });

  it('is a no-wrap, horizontally scrollable row with scrollbar hidden but keyboard a11y intact', () => {
    const onSelect = vi.fn();
    render(<SubTabs ariaLabel="Economic Passport sections" scroll active="network" onSelect={onSelect} items={EP_ITEMS} />);
    const list = screen.getByRole('tablist', { name: 'Economic Passport sections' });
    // scrollbar-hide hook + no-wrap horizontal overflow (single row, not a skinny column)
    expect(list.className).toContain('subtabs-scroll');
    expect(list.style.flexWrap).toBe('nowrap');
    expect(list.style.overflowX).toBe('auto');
    expect(list.style.scrollSnapType).toBe('x proximity');
    // active tab keeps roving focus (tabIndex 0), others -1 — arrow keys still move selection
    const tabs = within(list).getAllByRole('tab');
    const active = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    expect(active.textContent.trim()).toBe('Network');
    expect(active.tabIndex).toBe(0);
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    // each button refuses to shrink into a skinny vertical column
    for (const t of tabs) expect(t.style.flexShrink).toBe('0');
    fireEvent.keyDown(active, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith('wallet'); // wraps from last -> first
  });

  it('non-scroll consumers keep the wrapping layout (Economic Passport change is opt-in)', () => {
    render(<SubTabs ariaLabel="LUCA Coach sections" active="coach" onSelect={vi.fn()} items={[{ id: 'coach', label: 'Coach' }, { id: 'intelligence', label: 'Intelligence' }]} />);
    const list = screen.getByRole('tablist', { name: 'LUCA Coach sections' });
    expect(list.className).toContain('wrap');
    expect(list.className).not.toContain('subtabs-scroll');
    expect(list.style.overflowX).toBe('');
  });
});
