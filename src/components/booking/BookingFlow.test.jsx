/**
 * BookingFlow booking-only gate smoke test (AT-8).
 * Drives the flow to the review step and then to the confirmation step and
 * asserts the booking-only policy copy is present in both, that booking
 * completes without any payment, and that no online-payment affordance
 * (pay button, external checkout window, promised value split) is shown.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../lib/api.js', () => ({
  api: {
    getProvider: vi.fn(() => Promise.resolve({ provider: {}, services: [] })),
    getAvailableSlots: vi.fn(() => Promise.resolve({ dates: [{ date: '2026-12-15', slots: [{ start: '10:00', end: '10:30' }] }] })),
    requestBooking: vi.fn(() => Promise.resolve({
      booking: { booking_date: '2026-12-15', start_time: '10:00', end_time: '10:30' },
      reference: 'ABC123',
      autoConfirmed: true,
    })),
  },
}));

import { api } from '../../lib/api.js';
import BookingFlow from './BookingFlow.jsx';

const provider = { business_name: 'Aura Dental', address: '1 Main', city: 'Bogota' };
const services = [{ id: 1, service_name: 'Consultation', price: 100 }];

describe('BookingFlow (booking-only gate, AT-8)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows booking-only policy copy at review and confirmation, with no payment affordance', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { container } = render(
      <BookingFlow providerId={1} provider={provider} services={services} user={{}} onClose={() => {}} />,
    );

    // Step 1 -> pick the service.
    fireEvent.click(screen.getByText('Consultation'));

    // Step 2 -> a slot becomes available; select it.
    const slot = await waitFor(() => {
      const el = container.querySelector('.tsp-slot');
      if (!el) throw new Error('slot not rendered yet');
      return el;
    });
    fireEvent.click(slot);

    // Advance: Date&Time -> Details -> Review.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Review step: booking-only policy copy present; no promised split / pay button.
    expect(screen.getByText(/does not collect online payment in this release/i)).toBeInTheDocument();
    expect(screen.queryByText(/How your payment flows/i)).toBeNull();
    expect(screen.queryByText(/LOVE/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^pay\b/i })).toBeNull();

    // Confirm the booking — completes without any payment.
    fireEvent.click(screen.getByRole('button', { name: /Confirm booking/i }));

    expect(await screen.findByText(/Appointment confirmed|Booking requested/i)).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    // Confirmation step repeats the booking-only policy copy.
    expect(screen.getByText(/does not collect online payment in this release/i)).toBeInTheDocument();

    expect(api.requestBooking).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
