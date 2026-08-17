/**
 * BookingFlow — service-selection + availability-request correctness (NODE E2.1).
 *
 * Proves the two entry paths into BookingFlow behave identically and safely:
 *   (1) general  "Book Appointment" → user picks a service on step 0
 *   (2) service-row "Book"          → serviceId preselected, jumps to Date & Time
 *
 * and that the async race guards (monotonic request tokens held in refs) keep a
 * stale/older availability response from ever clobbering the current service's
 * dates/times/loading/errors — including under React StrictMode double-invoke,
 * out-of-order (deferred) responses, retry-after-failure, and unmount.
 *
 * Availability is driven through manually-resolved deferred promises so the test
 * controls response timing and ordering deterministically.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// Controllable api mock: getAvailableSlots hands back a fresh deferred per call
// and records the (providerId, serviceId) it was invoked with, so tests can
// resolve/reject responses in any order and assert exact request arguments.
const h = vi.hoisted(() => {
  const makeDeferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
  return { calls: [], makeDeferred };
});

vi.mock('../lib/api.js', () => ({
  api: {
    getProvider: vi.fn(() => Promise.resolve({ provider: {}, services: [] })),
    getAvailableSlots: vi.fn((providerId, serviceId) => {
      const d = h.makeDeferred();
      h.calls.push({ providerId, serviceId, deferred: d });
      return d.promise;
    }),
    requestBooking: vi.fn(() => Promise.resolve({ booking: {}, reference: 'REF', autoConfirmed: true })),
  },
}));

import { api } from '../lib/api.js';
import BookingFlow from '../components/booking/BookingFlow.jsx';

const PROVIDER_ID = '8d20d1e3-9a44-482d-a2ea-f4895536a245';
const provider = { business_name: 'Aguas Termales Spa', address: 'Boulevard Pacífica', city: 'Panama City' };
// Two distinct services so a stale response is visibly different from the fresh one.
const SVC_A = { id: '5fbe325d-6973-454a-95e8-9947bef39d67', service_name: 'Detox Ritual', price: 120, duration_minutes: 90 };
const SVC_B = { id: 'aaaa1111-0000-0000-0000-000000000000', service_name: 'Aromatherapy', price: 80, duration_minutes: 60 };
const services = [SVC_A, SVC_B];

// Distinct availability payloads (future dates so nothing is filtered as past).
const DATES_A = [{ date: '2026-12-15', slots: [{ start: '09:00', end: '09:30' }] }]; // -> "9:00 AM"
const DATES_B = [{ date: '2026-12-16', slots: [{ start: '14:00', end: '14:30' }] }]; // -> "2:00 PM"

const lastCall = () => h.calls[h.calls.length - 1];
const callFor = (svcId) => h.calls.find((c) => String(c.serviceId) === String(svcId));
const resolveWith = async (deferred, dates) => { await act(async () => { deferred.resolve({ dates }); }); };
const rejectWith = async (deferred) => { await act(async () => { deferred.reject(new Error('boom')); }); };

const dateTimeHeading = () => screen.queryByText(/Choose a date & time/i);
const selectServiceHeading = () => screen.queryByText(/^Select a service$/i);
const slotButtons = () => Array.from(document.querySelectorAll('.tsp-slot'));

beforeEach(() => { h.calls.length = 0; vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

describe('BookingFlow — service selection & availability requests (E2.1)', () => {
  // (1) General path: pick a service on step 0 → advances to Date & Time and
  //     issues exactly ONE availability request for that provider+service.
  it('general Book: select service advances to Date & Time with one availability request', async () => {
    render(<BookingFlow providerId={PROVIDER_ID} provider={provider} services={services} user={{}} onClose={() => {}} />);

    expect(selectServiceHeading()).toBeInTheDocument();
    fireEvent.click(screen.getByText('Detox Ritual'));

    expect(dateTimeHeading()).toBeInTheDocument();
    expect(api.getAvailableSlots).toHaveBeenCalledTimes(1);
    expect(h.calls).toHaveLength(1);
    expect(lastCall().providerId).toBe(PROVIDER_ID);
    expect(String(lastCall().serviceId)).toBe(SVC_A.id);

    await resolveWith(lastCall().deferred, DATES_A);
    const btns = await waitFor(() => { const b = slotButtons(); if (!b.length) throw new Error('no slots yet'); return b; });
    expect(btns.some((b) => /9:00\s*AM/i.test(b.textContent))).toBe(true);
  });

  // (2) Service-row path: serviceId preselected → jumps straight to Date & Time
  //     (never shows "Select a service") and issues ONE request with the same
  //     provider + service ids as the general path.
  it('service-row Book: preselected serviceId opens Date & Time directly, one request, correct ids', async () => {
    render(<BookingFlow providerId={PROVIDER_ID} provider={provider} services={services} serviceId={SVC_A.id} user={{}} onClose={() => {}} />);

    await waitFor(() => { if (!dateTimeHeading()) throw new Error('not on Date & Time yet'); });
    expect(selectServiceHeading()).toBeNull();
    expect(api.getAvailableSlots).toHaveBeenCalledTimes(1);
    expect(lastCall().providerId).toBe(PROVIDER_ID);
    expect(String(lastCall().serviceId)).toBe(SVC_A.id);

    await resolveWith(lastCall().deferred, DATES_A);
    const btns = await waitFor(() => { const b = slotButtons(); if (!b.length) throw new Error('no slots yet'); return b; });
    expect(btns.some((b) => /9:00\s*AM/i.test(b.textContent))).toBe(true);
  });

  // (3) Equivalence: both entry paths request the SAME (providerId, serviceId)
  //     and render the SAME available date/time options.
  it('both paths render equivalent availability for the same service', async () => {
    // General path.
    const g = render(<BookingFlow providerId={PROVIDER_ID} provider={provider} services={services} user={{}} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Detox Ritual'));
    const generalCall = lastCall();
    await resolveWith(generalCall.deferred, DATES_A);
    const generalTimes = await waitFor(() => {
      const t = slotButtons().map((b) => b.textContent.trim());
      if (!t.length) throw new Error('no general slots'); return t;
    });
    g.unmount();
    h.calls.length = 0;

    // Service-row path.
    render(<BookingFlow providerId={PROVIDER_ID} provider={provider} services={services} serviceId={SVC_A.id} user={{}} onClose={() => {}} />);
    await waitFor(() => { if (!dateTimeHeading()) throw new Error('not on Date & Time yet'); });
    const rowCall = lastCall();
    await resolveWith(rowCall.deferred, DATES_A);
    const rowTimes = await waitFor(() => {
      const t = slotButtons().map((b) => b.textContent.trim());
      if (!t.length) throw new Error('no row slots'); return t;
    });

    expect(rowCall.providerId).toBe(generalCall.providerId);
    expect(String(rowCall.serviceId)).toBe(String(generalCall.serviceId));
    expect(rowTimes).toEqual(generalTimes);
  });

  // (4) Invalid preselected serviceId: honestly stays on "Select a service" and
  //     makes NO availability request.
  it('invalid serviceId stays on Select a service and makes no availability request', async () => {
    render(<BookingFlow providerId={PROVIDER_ID} provider={provider} services={services} serviceId={'does-not-exist'} user={{}} onClose={() => {}} />);

    await waitFor(() => { if (!selectServiceHeading()) throw new Error('not on service step'); });
    expect(dateTimeHeading()).toBeNull();
    expect(api.getAvailableSlots).not.toHaveBeenCalled();
    expect(h.calls).toHaveLength(0);
  });

  // (5) React StrictMode double-invoke must NOT fire a duplicate availability
  //     request for the preselected service, nor leave loading stuck.
  it('StrictMode: preselected request fires once and loading resolves (not stuck)', async () => {
    render(
      <React.StrictMode>
        <BookingFlow providerId={PROVIDER_ID} provider={provider} services={services} serviceId={SVC_A.id} user={{}} onClose={() => {}} />
      </React.StrictMode>,
    );

    await waitFor(() => { if (!dateTimeHeading()) throw new Error('not on Date & Time yet'); });
    expect(api.getAvailableSlots).toHaveBeenCalledTimes(1);
    expect(h.calls).toHaveLength(1);

    await resolveWith(lastCall().deferred, DATES_A);
    await waitFor(() => { if (!slotButtons().length) throw new Error('slots not rendered'); });
    // Loading indicator must be gone — the single in-flight request completed.
    expect(document.querySelector('.tsp-loading')).toBeNull();
  });

  // (6) Deferred-response race A→B: after switching from service A to service B,
  //     a late-arriving A response must NOT overwrite B's dates/times.
  it('race: stale service-A response never overwrites the current service-B availability', async () => {
    render(<BookingFlow providerId={PROVIDER_ID} provider={provider} services={services} user={{}} onClose={() => {}} />);

    // Select A → request 1 (pending).
    fireEvent.click(screen.getByText('Detox Ritual'));
    const callA = callFor(SVC_A.id);
    expect(callA).toBeTruthy();

    // Back → select B → request 2 (pending).
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    fireEvent.click(screen.getByText('Aromatherapy'));
    const callB = callFor(SVC_B.id);
    expect(callB).toBeTruthy();

    // Resolve the CURRENT (B) first, then the STALE (A).
    await resolveWith(callB.deferred, DATES_B);
    await waitFor(() => { if (!slotButtons().some((b) => /2:00\s*PM/i.test(b.textContent))) throw new Error('B slots not shown'); });
    await resolveWith(callA.deferred, DATES_A); // stale — must be ignored

    const times = slotButtons().map((b) => b.textContent.trim());
    expect(times.some((t) => /2:00\s*PM/i.test(t))).toBe(true);   // B retained
    expect(times.some((t) => /9:00\s*AM/i.test(t))).toBe(false);  // A never leaked in
    expect(document.querySelector('.tsp-loading')).toBeNull();     // not stuck loading
  });

  // (7) Latest request fails → inline retry state shown; retry re-requests the
  //     current service and succeeds.
  it('failure shows retry state, and retry re-requests current service and succeeds', async () => {
    render(<BookingFlow providerId={PROVIDER_ID} provider={provider} services={services} serviceId={SVC_A.id} user={{}} onClose={() => {}} />);
    await waitFor(() => { if (!dateTimeHeading()) throw new Error('not on Date & Time yet'); });

    await rejectWith(lastCall().deferred);
    const retryBtn = await screen.findByRole('button', { name: /Try again/i });
    expect(document.querySelector('.bkf-error.inline')).toBeTruthy();

    const before = h.calls.length;
    fireEvent.click(retryBtn);
    expect(h.calls.length).toBe(before + 1);
    expect(String(lastCall().serviceId)).toBe(SVC_A.id); // retry tied to current service

    await resolveWith(lastCall().deferred, DATES_A);
    await waitFor(() => { if (!slotButtons().length) throw new Error('slots not rendered after retry'); });
    expect(document.querySelector('.bkf-error.inline')).toBeNull();
  });

  // (8) Unmount while a request is pending must not cause a stale state update
  //     (no act/unmounted-state warnings, no throw) when it later resolves.
  it('unmount while availability pending causes no stale update', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(
      <BookingFlow providerId={PROVIDER_ID} provider={provider} services={services} serviceId={SVC_A.id} user={{}} onClose={() => {}} />,
    );
    await waitFor(() => { if (!dateTimeHeading()) throw new Error('not on Date & Time yet'); });
    const pending = lastCall();

    unmount();
    await act(async () => { pending.deferred.resolve({ dates: DATES_A }); });

    const bad = errSpy.mock.calls.filter((c) => /not wrapped in act|unmounted|memory leak/i.test(String(c[0])));
    expect(bad).toHaveLength(0);
    errSpy.mockRestore();
  });
});
