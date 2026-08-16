/**
 * NODE E.1 — Investor release-candidate fixes.
 *
 * P1: Practitioner "My Clients" must source its roster from the authorized
 *     provider-bookings endpoint (api.getProviderBookings) that the Bookings /
 *     Finance screens already use — NOT the empty legacy /practitioner/bookings
 *     contract. The roster deduplicates STRICTLY by the stable patient_id and
 *     excludes malformed rows without one, so eight bookings for six distinct
 *     patients (Maria Campos appears three times) yield exactly six clients.
 * P2: The Economic Passport tab strip exposes all four destinations
 *     (Wallet, GPS, Contributions, Network) and each is navigable.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react';

const H = vi.hoisted(() => ({
  getProviderBookings: vi.fn(),
  getPractitionerBookings: vi.fn(() => Promise.resolve({ bookings: [] })),
  getVitalsTrends: vi.fn(() => Promise.resolve({})),
  getPatientTimeline: vi.fn(() => Promise.resolve({ events: [] })),
  exportTimeline: vi.fn(() => Promise.resolve(new Blob())),
}));

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    user: { id: 7, email: 'prac@test.local', firstName: 'Dr', lastName: 'Solaris', role: 'practitioner', isProvider: true },
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
  AppProvider: ({ children }) => children,
}));

vi.mock('../lib/api.js', () => ({
  api: new Proxy(H, { get: (t, p) => (p in t ? t[p] : () => Promise.resolve({})) }),
}));

import { PatientsPage, SubTabs } from '../components/LucaPassport.jsx';

// Eight synthetic provider bookings: Maria Campos appears 3x under ONE stable
// patient_id; the other five bookings are five distinct patients → 6 unique.
const MARIA = '40513e41-0557-424c-afdc-0823a74fb35a';
const EIGHT = [
  { id: 'b1', patient_id: '12108527-a5a3-4f1b-b7fe-3ea6dc7303d7', patient_name: 'Pablo Menendez', status: 'completed', booking_date: '2026-07-18T00:00:00.000Z' },
  { id: 'b2', patient_id: '319c1e3e-9002-4f6e-ab5f-9eea8f17a49a', patient_name: 'Lucia Flores', status: 'confirmed', booking_date: '2026-07-19T00:00:00.000Z' },
  { id: 'b3', patient_id: MARIA, patient_name: 'Maria Campos', status: 'completed', booking_date: '2026-07-20T00:00:00.000Z' },
  { id: 'b4', patient_id: '31b610da-bd2a-4704-9c8b-fba7348c2888', patient_name: 'Ana Villalta', status: 'pending', booking_date: '2026-07-21T00:00:00.000Z' },
  { id: 'b5', patient_id: MARIA, patient_name: 'Maria Campos', status: 'confirmed', booking_date: '2026-07-22T00:00:00.000Z' },
  { id: 'b6', patient_id: '80910fed-3da2-4d74-a176-410d9ae3ac4b', patient_name: 'Carlos Nunez', status: 'cancelled', booking_date: '2026-07-23T00:00:00.000Z' },
  { id: 'b7', patient_id: MARIA, patient_name: 'Maria Campos', status: 'completed', booking_date: '2026-07-24T00:00:00.000Z' },
  { id: 'b8', patient_id: 'dc752dfb-2fc8-495e-bc99-21bf6c6cc272', patient_name: 'Diego Ramirez', status: 'confirmed', booking_date: '2026-07-25T00:00:00.000Z' },
];
const cards = () => document.querySelectorAll('.patient-card');

beforeEach(() => {
  cleanup();
  H.getProviderBookings.mockReset().mockResolvedValue({ bookings: EIGHT });
  H.getPractitionerBookings.mockClear();
});

describe('P1 — My Clients sources the authorized provider-bookings endpoint', () => {
  it('calls getProviderBookings("all") and never the empty legacy getPractitionerBookings', async () => {
    render(<PatientsPage />);
    await screen.findByText('Your patients');
    expect(H.getProviderBookings).toHaveBeenCalledTimes(1);
    expect(H.getProviderBookings).toHaveBeenCalledWith('all');
    expect(H.getPractitionerBookings).not.toHaveBeenCalled();
  });

  it('derives exactly six unique clients from the eight bookings', async () => {
    render(<PatientsPage />);
    await screen.findByText('Your patients');
    await waitFor(() => expect(cards().length).toBe(6));
    // Maria appears once despite three bookings under her single patient_id
    expect(screen.getAllByText('Maria Campos')).toHaveLength(1);
    expect(screen.getByText('Pablo Menendez')).toBeTruthy();
    expect(screen.getByText('Diego Ramirez')).toBeTruthy();
  });

  it('collapses duplicate bookings from one patient_id into a single client with a visit count', async () => {
    H.getProviderBookings.mockResolvedValue({
      bookings: [
        { id: 'x1', patient_id: MARIA, patient_name: 'Maria Campos', status: 'completed', booking_date: '2026-07-20T00:00:00.000Z' },
        { id: 'x2', patient_id: MARIA, patient_name: 'Maria Campos', status: 'confirmed', booking_date: '2026-07-22T00:00:00.000Z' },
        { id: 'x3', patient_id: MARIA, patient_name: 'Maria Campos', status: 'completed', booking_date: '2026-07-24T00:00:00.000Z' },
      ],
    });
    render(<PatientsPage />);
    await screen.findByText('Your patients');
    await waitFor(() => expect(cards().length).toBe(1));
    expect(screen.getByText(/3 visits/)).toBeTruthy();
  });

  it('keeps different patient_id values as separate clients', async () => {
    H.getProviderBookings.mockResolvedValue({
      bookings: [
        { id: 'y1', patient_id: 'aaaaaaaa-0000-0000-0000-000000000001', patient_name: 'Same Name', status: 'confirmed', booking_date: '2026-07-20T00:00:00.000Z' },
        { id: 'y2', patient_id: 'bbbbbbbb-0000-0000-0000-000000000002', patient_name: 'Same Name', status: 'confirmed', booking_date: '2026-07-21T00:00:00.000Z' },
      ],
    });
    render(<PatientsPage />);
    await screen.findByText('Your patients');
    // dedup is by stable id, NOT by display name → two distinct clients
    await waitFor(() => expect(cards().length).toBe(2));
  });

  it('excludes malformed bookings with no valid patient_id (no phantom clients)', async () => {
    H.getProviderBookings.mockResolvedValue({
      bookings: [
        { id: 'z1', patient_id: '12108527-a5a3-4f1b-b7fe-3ea6dc7303d7', patient_name: 'Pablo Menendez', status: 'confirmed', booking_date: '2026-07-20T00:00:00.000Z' },
        { id: 'z2', patient_id: null, patient_name: 'Ghost One', status: 'confirmed', booking_date: '2026-07-21T00:00:00.000Z' },
        { id: 'z3', patient_name: 'Ghost Two', status: 'confirmed', booking_date: '2026-07-22T00:00:00.000Z' },
      ],
    });
    render(<PatientsPage />);
    await screen.findByText('Your patients');
    await waitFor(() => expect(cards().length).toBe(1));
    expect(screen.queryByText('Ghost One')).toBeNull();
    expect(screen.queryByText('Ghost Two')).toBeNull();
  });

  it('filters the populated roster by search query', async () => {
    render(<PatientsPage />);
    await screen.findByText('Your patients');
    await waitFor(() => expect(cards().length).toBe(6));
    fireEvent.change(screen.getByPlaceholderText('Search patients…'), { target: { value: 'maria' } });
    await waitFor(() => expect(cards().length).toBe(1));
    expect(screen.getByText('Maria Campos')).toBeTruthy();
  });

  it('preserves the genuine "No patients yet" empty state for a true zero-booking response', async () => {
    H.getProviderBookings.mockResolvedValue({ bookings: [] });
    render(<PatientsPage />);
    expect(await screen.findByText('No patients yet')).toBeTruthy();
    expect(cards().length).toBe(0);
  });

  it('shows a readable loading state before data resolves', async () => {
    let resolve;
    H.getProviderBookings.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { container } = render(<PatientsPage />);
    // still loading: neither the populated header nor the empty state is shown yet
    expect(screen.queryByText('Your patients')).toBeNull();
    expect(screen.queryByText('No patients yet')).toBeNull();
    expect(container.querySelector('.skel, .card')).toBeTruthy();
    resolve({ bookings: EIGHT });
    await screen.findByText('Your patients');
  });

  it('shows a readable API-error state, distinct from the empty state, when the endpoint fails', async () => {
    H.getProviderBookings.mockRejectedValue(new Error('503'));
    render(<PatientsPage />);
    expect(await screen.findByText("Couldn't load your patients")).toBeTruthy();
    // must NOT masquerade as the genuine empty state, and must leak no client names
    expect(screen.queryByText('No patients yet')).toBeNull();
    expect(screen.queryByText('Maria Campos')).toBeNull();
  });

  it('authorization: relies solely on the provider-scoped endpoint — an empty provider scope leaks no client data', async () => {
    // The backend scopes /provider/bookings/me to the authenticated provider; a
    // member (non-provider) receives no provider bookings. The UI must then show
    // the genuine empty state and never fall back to any other client source.
    H.getProviderBookings.mockResolvedValue({ bookings: [] });
    render(<PatientsPage />);
    expect(await screen.findByText('No patients yet')).toBeTruthy();
    expect(H.getPractitionerBookings).not.toHaveBeenCalled();
    expect(cards().length).toBe(0);
  });
});

describe('P2 — Economic Passport exposes all four navigable tabs', () => {
  const EP = [
    { id: 'wallet', label: 'Wallet' },
    { id: 'gps', label: 'GPS' },
    { id: 'contributions', label: 'Contributions' },
    { id: 'network', label: 'Network' },
  ];
  it('renders all four tabs with full (unabbreviated) names', () => {
    render(<SubTabs ariaLabel="Economic Passport sections" scroll active="wallet" onSelect={vi.fn()} items={EP} />);
    const list = screen.getByRole('tablist', { name: 'Economic Passport sections' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent.trim())).toEqual(['Wallet', 'GPS', 'Contributions', 'Network']);
  });
  it('navigates to each tab including the fourth (Network)', () => {
    const onSelect = vi.fn();
    render(<SubTabs ariaLabel="Economic Passport sections" scroll active="wallet" onSelect={onSelect} items={EP} />);
    const list = screen.getByRole('tablist', { name: 'Economic Passport sections' });
    for (const t of within(list).getAllByRole('tab')) fireEvent.click(t);
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual(['wallet', 'gps', 'contributions', 'network']);
  });
});
