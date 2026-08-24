/**
 * messageFilters — pure helpers for the unified Messages destination (NODE K1 §F).
 *
 * The canonical member↔practitioner conversation lives server-side (one row per
 * pair, UNIQUE(patient_id, practitioner_id)). Booking *context* is derived from
 * the existing bookings relationship — never from plaintext system messages in
 * the encrypted message table. These helpers are display-only and read-only:
 * they match a member's own bookings to a conversation and summarise status for
 * the compact context card, and they back the All / Bookings / Unread filters.
 *
 * When the shared backend cutover lands, a conversation may carry an explicit
 * booking link (`hasBooking` / `bookingProviderId`); these helpers prefer that
 * signal and fall back to a best-effort provider-name match so the UI degrades
 * honestly on the currently-deployed backend.
 */

export const MESSAGE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'unread', label: 'Unread' },
];
export const MESSAGE_FILTER_IDS = MESSAGE_FILTERS.map((f) => f.id);

// Booking states that count as an open/actionable relationship for the card.
export const OPEN_BOOKING_STATES = ['pending', 'confirmed', 'reschedule_proposed', 'rescheduled'];

function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

function bookingProviderName(b) {
  if (!b || typeof b !== 'object') return '';
  return norm(b.business_name || b.provider_name || b.providerName || b.practitioner_name || '');
}

/** True when a conversation and a booking plausibly refer to the same relationship. */
export function bookingMatchesConversation(conv, booking) {
  if (!conv || !booking) return false;
  // Prefer an explicit server-provided link (post-cutover).
  const convProviderId = conv.bookingProviderId || conv.providerId || conv.provider_id;
  const bId = booking.provider_id || booking.providerId;
  if (convProviderId && bId && String(convProviderId) === String(bId)) return true;
  // Best-effort name match against the conversation counterpart.
  const name = norm(conv.otherName || conv.name);
  const pname = bookingProviderName(booking);
  if (!name || !pname) return false;
  return name === pname || name.includes(pname) || pname.includes(name);
}

/** All of `bookings` that belong to `conv`, newest first. */
export function bookingsForConversation(conv, bookings) {
  if (!Array.isArray(bookings)) return [];
  const matched = bookings.filter((b) => bookingMatchesConversation(conv, b));
  return matched.slice().sort((a, b) => {
    const da = `${a.booking_date || ''} ${a.start_time || ''}`;
    const dbb = `${b.booking_date || ''} ${b.start_time || ''}`;
    return dbb.localeCompare(da);
  });
}

/** True when a conversation has any associated booking (explicit flag or match). */
export function conversationHasBooking(conv, bookings) {
  if (conv && conv.hasBooking) return true;
  return bookingsForConversation(conv, bookings).length > 0;
}

/**
 * Summarise booking context for the compact card above the composer.
 * Returns { current, past } where `current` is the most relevant open/upcoming
 * booking (or the most recent one) and `past` is the collapsed remainder.
 */
export function summarizeBookingContext(conv, bookings) {
  const matched = bookingsForConversation(conv, bookings);
  if (!matched.length) return { current: null, past: [], total: 0 };
  const open = matched.filter((b) => OPEN_BOOKING_STATES.includes(String(b.status || '').toLowerCase()));
  // Prefer the soonest open booking; else the most recent overall.
  let current;
  if (open.length) {
    current = open.slice().sort((a, b) => {
      const da = `${a.booking_date || ''} ${a.start_time || ''}`;
      const dbb = `${b.booking_date || ''} ${b.start_time || ''}`;
      return da.localeCompare(dbb);
    })[0];
  } else {
    current = matched[0];
  }
  const past = matched.filter((b) => b !== current);
  return { current, past, total: matched.length };
}

/** Apply the active compact filter to the conversation list (pure). */
export function applyMessageFilter(conversations, mode, bookings) {
  const list = Array.isArray(conversations) ? conversations : [];
  if (mode === 'unread') return list.filter((c) => (c.unread || 0) > 0);
  if (mode === 'bookings') return list.filter((c) => conversationHasBooking(c, bookings));
  return list;
}

export default applyMessageFilter;
