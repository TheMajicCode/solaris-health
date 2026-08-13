/**
 * Mobile practitioner experience — the practitioner bottom nav (Clients,
 * Bookings, raised LUCA, Messages, More) and the "More" sheet that exposes
 * Availability / Finance / Settings and the switch back to the Member portal.
 * Covers acceptance scenario 2. The right to switch portals is derived from the
 * authenticated server user (role === 'practitioner'), never a client flag.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  try { sessionStorage.clear(); } catch { /* noop */ }
});

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    user: { id: 7, email: 'prac@test.local', firstName: 'Dr', lastName: 'Solaris', role: 'practitioner', isProvider: true },
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
  AppProvider: ({ children }) => children,
}));

vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, { get: () => () => Promise.resolve({}) }),
}));

import LucaPassport from '../components/LucaPassport.jsx';

const botnav = () => document.querySelector('.m-botnav');

describe('practitioner mobile bottom navigation', () => {
  it('renders the five practitioner destinations with LUCA raised centre', () => {
    render(<LucaPassport />);
    const items = within(botnav()).getAllByRole('button', { hidden: true });
    expect(items).toHaveLength(5);
    expect(items.map((b) => b.getAttribute('aria-label')))
      .toEqual(['Clients', 'Bookings', 'LUCA Coach', 'Messages', 'More']);
    expect(botnav().querySelector('.m-bn-luca')).toBeTruthy();
  });

  it('opens the More sheet exposing Availability, Finance, Settings and portal switch', () => {
    render(<LucaPassport />);
    fireEvent.click(within(botnav()).getByRole('button', { name: 'More', hidden: true }));
    const sheet = screen.getByRole('dialog', { name: 'More', hidden: true });
    expect(within(sheet).getByText('Availability')).toBeInTheDocument();
    expect(within(sheet).getByText('Finance')).toBeInTheDocument();
    expect(within(sheet).getByText('Settings')).toBeInTheDocument();
    expect(within(sheet).getByText(/Switch to Member/i)).toBeInTheDocument();
  });

  it('switches to the Member portal, revealing the member bottom nav', () => {
    render(<LucaPassport />);
    fireEvent.click(within(botnav()).getByRole('button', { name: 'More', hidden: true }));
    fireEvent.click(screen.getByText(/Switch to Member/i));
    // After the switch the member nav (Explore …) replaces the practitioner nav.
    expect(within(botnav()).getByRole('button', { name: 'Explore', hidden: true })).toBeInTheDocument();
    expect(within(botnav()).queryByRole('button', { name: 'Clients', hidden: true })).toBeNull();
  });
});
