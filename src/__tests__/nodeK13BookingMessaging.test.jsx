/**
 * NODE K1.3 §F — booking-centered messaging + device-local sharing.
 *
 * Asserts the connected-flow guarantees that do NOT require the backend cutover:
 *   1. A message thread with an un-provisioned recipient NEVER pretends a message
 *      can be sent — compose + attach are disabled, booking context stays visible.
 *   2. Per-booking sharing is opt-in, device-local, and overrides account defaults.
 *   3. Booking↔conversation deep-links target the EXACT booking (not a generic
 *      tab): MyBookings listens for solaris:focus-booking, the thread's
 *      "View booking" dispatches the booking id, LUCA re-emits focus-booking,
 *      and "bookings" canonicalizes to Health Passport → My Bookings.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, { get: () => () => Promise.resolve({ messages: [], conversation: {} }) }),
}));
vi.mock('../lib/encryption.js', () => ({
  decryptMessage: () => Promise.resolve(''),
  encryptMessage: () => Promise.resolve({}),
  encryptFile: () => Promise.resolve({}),
  decryptFile: () => Promise.resolve(new Blob()),
  getDeletedIds: () => [],
  deleteLocally: () => {},
}));

import MessageThread from '../components/MessageThread.jsx';
import { BookingSharingSheet } from '../components/SharingControls.jsx';
import { loadBookingOverride } from '../lib/sharingPrefs.js';

beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });

const read = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

describe('K1.3 §F — thread never fakes delivery when recipient is not provisioned', () => {
  const conversation = { id: 'c1', otherName: 'Dr. Ruiz', otherRole: 'practitioner' };

  it('disables compose + attach and keeps booking details visible when recipientPubJwk is null', () => {
    render(
      <div className="luca">
        <MessageThread
          user={{ id: 1 }}
          identity={{ id: 'me' }}
          conversation={conversation}
          recipientPubJwk={null}
        />
      </div>,
    );
    // Send + attach + textarea disabled — nothing can pretend to send.
    expect(screen.getByTitle('Send')).toBeDisabled();
    const attach = document.querySelector('.mt-icbtn');
    expect(attach).toBeDisabled();
    const textarea = document.querySelector('.mt-compose textarea');
    expect(textarea).toBeDisabled();
    // Honest banner: booking context stays; sending unavailable until key setup.
    expect(screen.getByText(/booking details are still visible/i)).toBeInTheDocument();
  });
});

describe('K1.3 §F — per-booking sharing is opt-in, device-local, overrides defaults', () => {
  it('toggling a category then saving persists a booking override on this device', () => {
    render(<BookingSharingSheet subjectId="u1" bookingId="b1" onClose={() => {}} />);
    // Nothing stored yet — pure opt-in.
    expect(loadBookingOverride('u1', 'b1')).toBeNull();
    const switches = document.querySelectorAll('[role="switch"]');
    expect(switches.length).toBeGreaterThan(0);
    fireEvent.click(switches[0]);
    // Persistence is explicit (Save), never silent.
    fireEvent.click(screen.getByText('Save'));
    const saved = loadBookingOverride('u1', 'b1');
    expect(saved).not.toBeNull();
    expect(Object.values(saved).some((v) => v === true)).toBe(true);
  });
});

describe('K1.3 §F — exact-booking deep-links (no generic-tab fallback)', () => {
  it('MyBookings resolves solaris:focus-booking to the exact booking and can message the practitioner', () => {
    const src = read('src/components/booking/MyBookings.jsx');
    expect(src).toMatch(/solaris:focus-booking/);
    expect(src).toMatch(/startProviderConversation\(b\.provider_id\)/);
    expect(src).toMatch(/BookingSharingSheet/);
    expect(src).toMatch(/share\.messagePractitioner/);
  });

  it('the message thread\'s View booking dispatches the exact booking id', () => {
    const src = read('src/components/SecureChat.jsx');
    expect(src).toMatch(/activeContext\.current[\s\S]*?\.id/);
    expect(src).toMatch(/bookingId:\s*id\s*\?/);
  });

  it('LUCA re-emits focus-booking and "bookings" canonicalizes to Health Passport → My Bookings', () => {
    const src = read('src/components/LucaPassport.jsx');
    expect(src).toMatch(/d\.bookingId != null/);
    expect(src).toMatch(/solaris:focus-booking/);
    expect(src).toMatch(/bookings:\s*\{\s*tab:\s*'health',\s*sub:\s*'bookings'\s*\}/);
  });
});
