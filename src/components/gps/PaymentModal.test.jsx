/**
 * PaymentModal booking-only gate smoke test.
 * Verifies the modal presents a simulated-only demonstration: no online
 * payment affordance, explicit "simulated / no real funds move" copy, and a
 * "Generate simulated receipt" action instead of any pay button.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/api.js', () => ({
  api: { simulatePayment: vi.fn(() => Promise.resolve({ receipt: { legs: [] }, payment: {}, educationCreditSats: 0 })) },
}));

import PaymentModal from './PaymentModal.jsx';

describe('PaymentModal (booking-only gate)', () => {
  it('renders the simulated demonstration idle state with no online-payment affordance', () => {
    render(<PaymentModal open={true} onClose={() => {}} orgId={1} />);

    // Simulated framing is explicit.
    expect(screen.getByText('Simulated demonstration')).toBeInTheDocument();
    expect(screen.getByText('(simulated)')).toBeInTheDocument();
    expect(screen.getAllByText(/no real funds move/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/All values simulated/i)).toBeInTheDocument();

    // The action generates a simulated receipt — it is not a payment.
    expect(screen.getByRole('button', { name: /Generate simulated receipt/i })).toBeInTheDocument();
    // No online-payment call-to-action.
    expect(screen.queryByRole('button', { name: /^pay\b/i })).toBeNull();
    expect(screen.queryByText(/checkout/i)).toBeNull();
  });

  it('returns nothing when closed', () => {
    const { container } = render(<PaymentModal open={false} onClose={() => {}} orgId={1} />);
    expect(container).toBeEmptyDOMElement();
  });
});
