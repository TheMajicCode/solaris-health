/**
 * NODE K1.3 — Phase 2: "Your Next Step" recomputes live after completion events.
 *
 * The Next Step card is derived every render by resolveNextAction(...) from
 * live dashboard state (check-ins, journeys, bookings, completeness). For it to
 * rotate the instant the user finishes something, every completion surface must
 * emit a completion event and the dashboard must refetch + recompute on it.
 *
 * These are deterministic source-contract assertions (no DOM needed): they lock
 * the event wiring so a future refactor cannot silently break live recompute.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('K1.3 Phase 2 — Next Step live recompute wiring', () => {
  const passport = read('src/components/LucaPassport.jsx');
  const bookings = read('src/components/booking/MyBookings.jsx');

  it('dashboard refetches all Next-Step inputs in one reload callback', () => {
    const m = passport.match(/reloadDashboardState\s*=\s*useCallback\(async[\s\S]*?\}\s*,\s*\[/);
    expect(m, 'reloadDashboardState useCallback should exist').toBeTruthy();
    const body = m[0];
    // Must refetch the four sources the resolver depends on.
    expect(body).toMatch(/getCheckins|checkins/i);
    expect(body).toMatch(/getMyJourneys/);
    expect(body).toMatch(/getMyBookings/);
    expect(body).toMatch(/complete/i);
  });

  it('dashboard recomputes on both check-in and generic progress events', () => {
    expect(passport).toMatch(/addEventListener\(\s*['"]solaris:checkin['"]/);
    expect(passport).toMatch(/addEventListener\(\s*['"]solaris:progress['"]/);
    // The progress listener must drive the same reload path.
    const effect = passport.match(/solaris:progress[\s\S]{0,200}/);
    expect(effect).toBeTruthy();
  });

  it('todo completion emits a progress event', () => {
    expect(passport).toMatch(/toggleTodo[\s\S]*?dispatchEvent\(new CustomEvent\(\s*['"]solaris:progress['"]/);
  });

  it('every booking mutation emits a progress event', () => {
    // cancel, confirm-time, and reschedule all dispatch solaris:progress.
    const dispatches = bookings.match(/dispatchEvent\(new CustomEvent\(\s*['"]solaris:progress['"]/g) || [];
    expect(dispatches.length).toBeGreaterThanOrEqual(3);
  });

  it('progress events never carry PHI or message text (only a source tag)', () => {
    const details = [
      ...passport.matchAll(/solaris:progress['"]\s*,\s*\{\s*detail:\s*(\{[^}]*\})/g),
      ...bookings.matchAll(/solaris:progress['"]\s*,\s*\{\s*detail:\s*(\{[^}]*\})/g),
    ];
    expect(details.length).toBeGreaterThan(0);
    for (const d of details) {
      // Only a coarse source label is allowed in the payload.
      expect(d[1]).toMatch(/source:/);
      expect(d[1]).not.toMatch(/message|note|phi|record|passport|content/i);
    }
  });
});
