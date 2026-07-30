/**
 * Role-routing unit tests (Sprint F) — verify that each persona is routed to
 * its own portal navigation and default landing tab, so a demo never lands on
 * a dead end or another role's chrome.
 */
import { describe, it, expect, vi } from 'vitest';

// The module renders a big component tree on import; stub the auth context so
// importing the named routing helpers has no side effects.
vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({ user: null }),
}));

import { defaultTabFor, navForPersona, PORTAL } from '../components/LucaPassport.jsx';

// Flatten a nav (array of {group, items[]}) into the list of tab ids.
const tabIds = (nav) => nav.flatMap((g) => g.items.map((i) => i.id));

describe('defaultTabFor', () => {
  it('lands a practitioner on My Clients', () => {
    expect(defaultTabFor('practitioner')).toBe('prac-clients');
  });
  it('lands a clinic admin on Members', () => {
    expect(defaultTabFor('clinic_admin')).toBe('admin-members');
  });
  it('lands a member on the dashboard', () => {
    expect(defaultTabFor('patient')).toBe('dashboard');
  });
});

describe('navForPersona', () => {
  it('gives a practitioner the focused practice portal and no patient tabs', () => {
    const ids = tabIds(navForPersona('practitioner', 'practitioner', true));
    expect(ids).toEqual(
      expect.arrayContaining(['prac-clients', 'prac-bookings', 'prac-availability', 'prac-finance', 'prac-settings']),
    );
    expect(ids).not.toContain('dashboard');
    expect(ids.some((id) => id.startsWith('admin-'))).toBe(false);
  });

  it('gives a clinic admin the operator console and no patient tabs', () => {
    const ids = tabIds(navForPersona('clinic_admin', 'admin', false));
    expect(ids).toEqual(
      expect.arrayContaining(['admin-members', 'admin-practitioners', 'admin-bookings', 'admin-finance', 'admin-system', 'admin-settings']),
    );
    expect(ids).not.toContain('dashboard');
    expect(ids.some((id) => id.startsWith('prac-'))).toBe(false);
  });

  it('keeps the full sovereign experience for a member', () => {
    const ids = tabIds(navForPersona('patient', 'patient', false));
    expect(ids).toContain('dashboard');
    expect(ids.some((id) => id.startsWith('prac-') || id.startsWith('admin-'))).toBe(false);
  });
});

describe('PORTAL chrome', () => {
  it('defines distinct accent + label for each persona', () => {
    expect(PORTAL.patient.label).toBe('Member');
    expect(PORTAL.practitioner.label).toBe('Practitioner');
    expect(PORTAL.clinic_admin.label).toBe('Admin');
    const accents = new Set([PORTAL.patient.accent, PORTAL.practitioner.accent, PORTAL.clinic_admin.accent]);
    expect(accents.size).toBe(3);
  });
});
