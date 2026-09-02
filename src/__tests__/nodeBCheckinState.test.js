// Node B §8 — the ONE authoritative hasCheckedInToday predicate.
// Keyed on the LOCAL calendar day, scans ALL check-ins (never assumes [0] is
// newest), empty list => false.
import { describe, it, expect } from 'vitest';
import { hasCheckedInToday } from '../lib/nextAction.js';

const NOW = new Date('2026-09-02T09:30:00'); // local
const localDay = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('Node B §8 — hasCheckedInToday', () => {
  it('empty / non-array list => false (never a fabricated "checked in")', () => {
    expect(hasCheckedInToday([], NOW)).toBe(false);
    expect(hasCheckedInToday(undefined, NOW)).toBe(false);
    expect(hasCheckedInToday(null, NOW)).toBe(false);
  });

  it('true when ANY check-in is dated today (local calendar day)', () => {
    expect(hasCheckedInToday([{ checkin_date: localDay(NOW) }], NOW)).toBe(true);
  });

  it('false when the only check-in is from a prior day', () => {
    expect(hasCheckedInToday([{ checkin_date: '2026-09-01' }], NOW)).toBe(false);
  });

  it('scans ALL rows — today can be anywhere in the list, not just [0]', () => {
    const list = [
      { checkin_date: '2026-08-30' },
      { checkin_date: '2026-08-31' },
      { checkin_date: localDay(NOW) }, // today, last
    ];
    expect(hasCheckedInToday(list, NOW)).toBe(true);
  });

  it('accepts checkin_date, created_at or date as the day source', () => {
    expect(hasCheckedInToday([{ created_at: NOW.toISOString() }], NOW)).toBe(true);
    expect(hasCheckedInToday([{ date: localDay(NOW) }], NOW)).toBe(true);
  });

  it('ignores malformed / undated rows without throwing', () => {
    expect(hasCheckedInToday([{}, { checkin_date: 'not-a-date' }, null], NOW)).toBe(false);
  });
});
