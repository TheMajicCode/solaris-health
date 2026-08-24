/**
 * messageFilters — pure helpers for the unified Messages destination (NODE K1 §F,
 * corrected in K1.1 §2).
 *
 * The canonical member↔practitioner conversation lives server-side (one row per
 * pair, UNIQUE(patient_id, practitioner_id)). Booking *context* is derived from
 * STABLE SERVER-DERIVED IDS ONLY: the authorized conversations response now
 * returns, for each conversation, `hasBooking`, `bookingIds` (the member's own
 * booking ids that belong to this exact member↔practitioner pair) and
 * `bookingProviderIds`, all computed on the server from the authenticated
 * participants + provider_profiles + the member's bookings.
 *
 * These helpers therefore match a conversation to a booking by ID EQUALITY ONLY.
 * There is deliberately NO practitioner/provider/business-NAME matching and no
 * substring heuristic: name matching cross-links two practitioners who share a
 * name and breaks when a provider's business name differs from the practitioner's
 * name. ID matching is unambiguous and role-agnostic. Booking context is never
 * derived from plaintext system messages in the encrypted message table.
 *
 * Everything here is display-only and read-only.
 */

export const MESSAGE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'unread', label: 'Unread' },
];
export const MESSAGE_FILTER_IDS = MESSAGE_FILTERS.map((f) => f.id);

// Booking states that count as an open/actionable relationship for the card.
export const OPEN_BOOKING_STATES = ['pending', 'confirmed', 'reschedule_proposed', 'rescheduled'];

// Normalize the server-provided booking ids to a Set of strings for O(1),
// type-safe membership tests (ids are UUID strings but guard against numbers).
function bookingIdSet(conv) {
  const ids = conv && Array.isArray(conv.bookingIds) ? conv.bookingIds : [];
  return new Set(ids.map((v) => String(v)));
}

/**
 * True when `booking` belongs to `conv`, by STABLE SERVER-DERIVED ID ONLY.
 * Matches iff the conversation's server-returned bookingIds include this
 * booking's id. No name matching, ever.
 */
export function bookingMatchesConversation(conv, booking) {
  if (!conv || !booking) return false;
  const bId = booking.id != null ? String(booking.id) : null;
  if (!bId) return false;
  return bookingIdSet(conv).has(bId);
}

/** All of `bookings` that belong to `conv` (by id), newest first. */
export function bookingsForConversation(conv, bookings) {
  if (!Array.isArray(bookings)) return [];
  const ids = bookingIdSet(conv);
  if (!ids.size) return [];
  const matched = bookings.filter((b) => b && b.id != null && ids.has(String(b.id)));
  return matched.slice().sort((a, b) => {
    const da = `${a.booking_date || ''} ${a.start_time || ''}`;
    const dbb = `${b.booking_date || ''} ${b.start_time || ''}`;
    return dbb.localeCompare(da);
  });
}

/**
 * True when a conversation has any associated booking. Prefers the server's
 * explicit `hasBooking` flag; falls back to a non-empty server-derived
 * bookingIds list. Never inspects names.
 */
export function conversationHasBooking(conv) {
  if (!conv) return false;
  if (conv.hasBooking === true) return true;
  return Array.isArray(conv.bookingIds) && conv.bookingIds.length > 0;
}

/**
 * Summarise booking context for the compact card above the composer.
 * Returns { current, past, total } where `current` is the most relevant
 * open/upcoming booking (or the most recent one) and `past` is the collapsed
 * remainder. Fed exclusively by id-matched bookings.
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
export function applyMessageFilter(conversations, mode /*, bookings (unused: id-based) */) {
  const list = Array.isArray(conversations) ? conversations : [];
  if (mode === 'unread') return list.filter((c) => (c.unread || 0) > 0);
  if (mode === 'bookings') return list.filter((c) => conversationHasBooking(c));
  return list;
}

export default applyMessageFilter;
