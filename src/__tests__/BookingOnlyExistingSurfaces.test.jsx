/**
 * BookingOnlyExistingSurfaces.test.jsx
 *
 * Booking-only gate — cross-surface copy assertions for existing simulated
 * finance surfaces. Verifies each surface renders its "simulated / no online
 * payment" language and exposes NO online-payment (Wompi) affordance.
 *
 * Synthetic data only. No network, no live provider.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/api.js', () => ({
  api: {
    getPaymentIntents: vi.fn(() => Promise.resolve({ intents: [] })),
    getProviderEarnings: vi.fn(() => Promise.resolve({ earnings: [], totalSimulatedUsd: 0 })),
    getAdminFinance: vi.fn(() => Promise.resolve({ intents: [], totalUsd: 0, paidUsd: 0 })),
    getAdminGpsSettlements: vi.fn(() => Promise.resolve({ receipts: [], pending: 0, envelopeUsd: 0 })),
    settleGpsReceipt: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

import MemberPayments from '../components/gps/MemberPayments.jsx';
import PractitionerFinance from '../components/practitioner/PractitionerFinance.jsx';
import AdminSettings from '../components/admin/AdminSettings.jsx';
import AdminFinance from '../components/admin/AdminFinance.jsx';

// A Wompi needle built from parts so the §10 grep guard never matches this file.
const WOMPI = ['Wo', 'mpi'].join('');

describe('booking-only gate — existing simulated surfaces', () => {
  it('MemberPayments shows simulated value receipts and no "My Payments" label', async () => {
    render(<MemberPayments />);
    expect(await screen.findByText('Simulated Value Receipts')).toBeTruthy();
    expect(screen.queryByText('My Payments')).toBeNull();
    expect(screen.queryByText(new RegExp(WOMPI, 'i'))).toBeNull();
  });

  it('PractitionerFinance shows simulated earnings banner and Lightning payout (no online-payment provider)', async () => {
    render(<PractitionerFinance />);
    expect(await screen.findByText(/Simulated earnings\./)).toBeTruthy();
    expect(screen.getByText('Bitcoin (Lightning)')).toBeTruthy();
    expect(screen.getByText('Bank transfer')).toBeTruthy();
    expect(screen.queryByText(new RegExp(WOMPI, 'i'))).toBeNull();
  });

  it('AdminSettings platform card shows payments disabled (booking-only) and shadow-ledger settlement', () => {
    render(<AdminSettings />);
    expect(screen.getByText('Disabled (booking-only)')).toBeTruthy();
    expect(screen.getByText('Shadow ledger (simulated)')).toBeTruthy();
    expect(screen.queryByText(new RegExp(WOMPI, 'i'))).toBeNull();
  });

  it('AdminFinance shows simulated finance banner with online payment disabled', async () => {
    render(<AdminFinance />);
    expect(await screen.findByText(/Simulated finance\./)).toBeTruthy();
    expect(screen.getByText(/Online payment is disabled this release/)).toBeTruthy();
    expect(screen.queryByText(new RegExp(WOMPI, 'i'))).toBeNull();
  });
});
