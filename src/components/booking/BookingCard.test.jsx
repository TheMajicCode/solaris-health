/**
 * BookingCard booking-only gate smoke test.
 * Verifies the card shows the listed price only (no provider payout figure,
 * no pay-status pill) so no payment state is surfaced in the booking-only
 * release.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import BookingCard from './BookingCard.jsx';

const booking = {
  id: 1,
  status: 'confirmed',
  total_price: 120,
  provider_payout: 108,
  payment_status: 'paid',
  service_name: 'Restorative session',
  booking_date: '2026-01-01',
  start_time: '10:00',
  business_name: 'Aura Dental',
};

describe('BookingCard (booking-only gate)', () => {
  it('shows the listed price and no payment state', () => {
    render(<BookingCard booking={booking} perspective="patient" />);

    // Listed price is shown.
    expect(screen.getByText(/listed price/i)).toBeInTheDocument();
    expect(screen.getByText(/120\.00/)).toBeInTheDocument();

    // No provider-payout figure, no pay-status pills.
    expect(screen.queryByText(/you earn/i)).toBeNull();
    expect(screen.queryByText(/^Paid$/i)).toBeNull();
    expect(screen.queryByText(/Payment pending/i)).toBeNull();
  });
});
