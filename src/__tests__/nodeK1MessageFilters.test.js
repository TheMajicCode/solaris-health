/**
 * NODE K1 §F — unified Messages: compact filters + booking-context derivation.
 * Pure-unit coverage for src/lib/messageFilters.js.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  MESSAGE_FILTERS,
  applyMessageFilter,
  bookingMatchesConversation,
  bookingsForConversation,
  conversationHasBooking,
  summarizeBookingContext,
} from '../lib/messageFilters.js';

const conv = (o) => ({ id: 'c1', otherName: 'Dr. Maya Okoro', unread: 0, ...o });
const booking = (o) => ({ id: 'b1', business_name: 'Dr. Maya Okoro', service_name: 'Consult', status: 'confirmed', booking_date: '2026-09-01', start_time: '10:00:00', ...o });

describe('§F compact message filters', () => {
  it('exposes exactly All / Bookings / Unread', () => {
    expect(MESSAGE_FILTERS.map((f) => f.id)).toEqual(['all', 'bookings', 'unread']);
    expect(MESSAGE_FILTERS.map((f) => f.label)).toEqual(['All', 'Bookings', 'Unread']);
  });

  it('All returns everything; Unread filters unread>0', () => {
    const list = [conv({ id: 'a', unread: 0 }), conv({ id: 'b', unread: 3 })];
    expect(applyMessageFilter(list, 'all', []).length).toBe(2);
    const unread = applyMessageFilter(list, 'unread', []);
    expect(unread.map((c) => c.id)).toEqual(['b']);
  });

  it('Bookings filters to conversations that have an associated booking', () => {
    const list = [
      conv({ id: 'a', otherName: 'Dr. Maya Okoro' }),
      conv({ id: 'b', otherName: 'Nurse Ade Cole' }),
    ];
    const bookings = [booking({ business_name: 'Dr. Maya Okoro' })];
    const res = applyMessageFilter(list, 'bookings', bookings);
    expect(res.map((c) => c.id)).toEqual(['a']);
  });

  it('honours an explicit server-provided booking flag (post-cutover)', () => {
    const list = [conv({ id: 'x', otherName: 'Unmatched Name', hasBooking: true })];
    expect(conversationHasBooking(list[0], [])).toBe(true);
    expect(applyMessageFilter(list, 'bookings', []).map((c) => c.id)).toEqual(['x']);
  });
});

describe('§F booking ↔ conversation matching', () => {
  it('matches on exact provider id when present', () => {
    const c = conv({ providerId: 'prof-9', otherName: 'x' });
    const b = booking({ provider_id: 'prof-9', business_name: 'totally different' });
    expect(bookingMatchesConversation(c, b)).toBe(true);
  });

  it('best-effort name match when no id link exists', () => {
    expect(bookingMatchesConversation(conv({ otherName: 'Dr. Maya Okoro' }), booking())).toBe(true);
    expect(bookingMatchesConversation(conv({ otherName: 'Someone Else' }), booking())).toBe(false);
  });

  it('returns all matched bookings newest first', () => {
    const bookings = [
      booking({ id: 'old', booking_date: '2026-01-01' }),
      booking({ id: 'new', booking_date: '2026-12-01' }),
    ];
    const res = bookingsForConversation(conv(), bookings);
    expect(res.map((b) => b.id)).toEqual(['new', 'old']);
  });
});

describe('§F booking-context summary', () => {
  it('prefers the soonest open booking as current and collapses the rest', () => {
    const bookings = [
      booking({ id: 'done', status: 'completed', booking_date: '2026-01-01' }),
      booking({ id: 'soon', status: 'confirmed', booking_date: '2026-09-01' }),
      booking({ id: 'later', status: 'pending', booking_date: '2026-11-01' }),
    ];
    const ctx = summarizeBookingContext(conv(), bookings);
    expect(ctx.current.id).toBe('soon');
    expect(ctx.total).toBe(3);
    expect(ctx.past.map((b) => b.id).sort()).toEqual(['done', 'later']);
  });

  it('falls back to most recent when no open bookings', () => {
    const bookings = [
      booking({ id: 'a', status: 'completed', booking_date: '2026-01-01' }),
      booking({ id: 'b', status: 'cancelled', booking_date: '2026-05-01' }),
    ];
    const ctx = summarizeBookingContext(conv(), bookings);
    expect(ctx.current.id).toBe('b');
  });

  it('returns empty context when nothing matches', () => {
    const ctx = summarizeBookingContext(conv({ otherName: 'No Match' }), [booking()]);
    expect(ctx.current).toBeNull();
    expect(ctx.total).toBe(0);
  });
});

describe('§F navigation source-contract (LucaPassport)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../components/LucaPassport.jsx'), 'utf8');

  it('Communications has a single unified Messages destination (no inbox subtab)', () => {
    expect(src).toMatch(/communications:\s*\{\s*tabs:\s*\[\s*'messages',\s*'journal',\s*'growth',\s*'media'\s*\]/);
  });

  it('legacy inbox deep links redirect to Communications → Messages', () => {
    expect(src).toMatch(/inbox:\s*\{\s*tab:\s*'communications',\s*sub:\s*'messages'\s*\}/);
  });

  it('the "With Others" folder renders only Messages', () => {
    const m = src.match(/const withOthers = \[([\s\S]*?)\];/);
    expect(m).toBeTruthy();
    expect(m[1]).toMatch(/label:\s*'Messages'/);
    expect(m[1]).not.toMatch(/label:\s*'Inbox'/);
  });
});
