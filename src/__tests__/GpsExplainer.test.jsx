/**
 * GpsExplainer smoke test — mounts the rebuilt GPS protocol showcase with the
 * API stubbed out (so the static policy fallback is exercised) and verifies
 * the protocol-accurate hero facts render: the 90% provider guarantee and the
 * gps-receipt/1.0 receipt showcase.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../lib/api.js', () => ({
  api: { request: vi.fn(() => Promise.reject(new Error('offline'))) },
}));

import GpsExplainer from '../components/gps/GpsExplainer.jsx';
import { STATIC_GPS_POLICY, splitAmount } from '../lib/gps-policy.js';

describe('GpsExplainer (GPS protocol showcase)', () => {
  it('renders the 90% provider hero fact and the receipt showcase', async () => {
    render(<GpsExplainer />);
    expect(screen.getAllByText(/90% goes to your practitioner, always/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/gps-receipt\/1\.0/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Simulated/i).length).toBeGreaterThan(0);
  });

  it('static policy splits with largest-remainder and a 1000 bps envelope cap', () => {
    expect(STATIC_GPS_POLICY.providerShareBps).toBe(9000);
    const s = splitAmount(200, STATIC_GPS_POLICY);
    expect(s.provider.amount).toBe(180);
    expect(s.envelope).toBeCloseTo(20, 6);
    const partsSum = s.parts.reduce((a, p) => a + p.amount, 0);
    expect(partsSum).toBeCloseTo(20, 6);
  });
});
