/**
 * NODE K1 §F / K1.1 §2 — unified Messages: compact filters + booking-context
 * derivation by STABLE SERVER-DERIVED IDS ONLY (no name/substring matching).
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

// Conversations now carry the server-derived `bookingIds` / `hasBooking` fields.
const conv = (o) => ({ id: 'c1', otherName: 'Dr. Maya Okoro', unread: 0, bookingIds: [], ...o });
const booking = (o) => ({ id: 'b1', business_name: 'Dr. Maya Okoro', service_name: 'Consult', status: 'confirmed', booking_date: '2026-09-01', start_time: '10:00:00', ...o });

describe('§F compact message filters', () => {
  it('exposes exactly All / Bookings / Unread', () => {
    expect(MESSAGE_FILTERS.map((f) => f.id)).toEqual(['all', 'bookings', 'unread']);
    expect(MESSAGE_FILTERS.map((f) => f.label)).toEqual(['All', 'Bookings', 'Unread']);
  });

  it('All returns everything; Unread filters unread>0', () => {
    const list = [conv({ id: 'a', unread: 0 }), conv({ id: 'b', unread: 3 })];
    expect(applyMessageFilter(list, 'all').length).toBe(2);
    const unread = applyMessageFilter(list, 'unread');
    expect(unread.map((c) => c.id)).toEqual(['b']);
  });

  it('Bookings filters to conversations whose server-derived bookingIds are non-empty', () => {
    const list = [
      conv({ id: 'a', bookingIds: ['b1'] }),
      conv({ id: 'b', bookingIds: [] }),
    ];
    const res = applyMessageFilter(list, 'bookings');
    expect(res.map((c) => c.id)).toEqual(['a']);
  });

  it('honours an explicit server-provided hasBooking flag', () => {
    const list = [conv({ id: 'x', bookingIds: [], hasBooking: true })];
    expect(conversationHasBooking(list[0])).toBe(true);
    expect(applyMessageFilter(list, 'bookings').map((c) => c.id)).toEqual(['x']);
  });

  it('a conversation with no bookingIds and no flag is NOT a booking conversation', () => {
    expect(conversationHasBooking(conv({ bookingIds: [] }))).toBe(false);
  });
});

describe('§F booking ↔ conversation matching (ID-only)', () => {
  it('matches iff the booking id is in the conversation server-derived bookingIds', () => {
    const c = conv({ bookingIds: ['b1', 'b2'] });
    expect(bookingMatchesConversation(c, booking({ id: 'b1' }))).toBe(true);
    expect(bookingMatchesConversation(c, booking({ id: 'b2' }))).toBe(true);
    expect(bookingMatchesConversation(c, booking({ id: 'b3' }))).toBe(false);
  });

  it('NEVER matches by name — identical names, unrelated ids do not link', () => {
    const c = conv({ otherName: 'Dr. Maya Okoro', bookingIds: ['b9'] });
    // Same display name, but the booking id is not in the server list.
    const b = booking({ id: 'b1', business_name: 'Dr. Maya Okoro' });
    expect(bookingMatchesConversation(c, b)).toBe(false);
  });

  it('a provider whose business name differs from the practitioner still links by id', () => {
    const c = conv({ otherName: 'Dr. Ana Ruiz', bookingIds: ['bx'] });
    const b = booking({ id: 'bx', business_name: 'Sunrise Wellness Clinic' });
    expect(bookingMatchesConversation(c, b)).toBe(true);
  });

  it('returns all matched bookings newest first', () => {
    const c = conv({ bookingIds: ['old', 'new'] });
    const bookings = [
      booking({ id: 'old', booking_date: '2026-01-01' }),
      booking({ id: 'new', booking_date: '2026-12-01' }),
      booking({ id: 'unrelated', booking_date: '2026-06-01' }),
    ];
    const res = bookingsForConversation(c, bookings);
    expect(res.map((b) => b.id)).toEqual(['new', 'old']);
  });
});

describe('§F booking-context summary', () => {
  it('prefers the soonest open booking as current and collapses the rest', () => {
    const c = conv({ bookingIds: ['done', 'soon', 'later'] });
    const bookings = [
      booking({ id: 'done', status: 'completed', booking_date: '2026-01-01' }),
      booking({ id: 'soon', status: 'confirmed', booking_date: '2026-09-01' }),
      booking({ id: 'later', status: 'pending', booking_date: '2026-11-01' }),
    ];
    const ctx = summarizeBookingContext(c, bookings);
    expect(ctx.current.id).toBe('soon');
    expect(ctx.total).toBe(3);
    expect(ctx.past.map((b) => b.id).sort()).toEqual(['done', 'later']);
  });

  it('falls back to most recent when no open bookings', () => {
    const c = conv({ bookingIds: ['a', 'b'] });
    const bookings = [
      booking({ id: 'a', status: 'completed', booking_date: '2026-01-01' }),
      booking({ id: 'b', status: 'cancelled', booking_date: '2026-05-01' }),
    ];
    const ctx = summarizeBookingContext(c, bookings);
    expect(ctx.current.id).toBe('b');
  });

  it('returns empty context when nothing matches by id', () => {
    const ctx = summarizeBookingContext(conv({ bookingIds: [] }), [booking()]);
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
