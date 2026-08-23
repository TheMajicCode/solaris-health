/**
 * NODE E4J-RC1 — item 3: mobile practitioner portal-switch + My Practice
 * reachability, fail-closed persona authorization, and 44px touch targets.
 *
 * The switch right and the rendered persona are pure functions of the
 * authenticated SERVER user, so the authorization rules are unit-tested here
 * directly (fail-closed by construction — a member can never obtain the
 * practitioner persona through a tampered URL/state).
 *
 * Real-viewport geometry (zero horizontal overflow, tap targets) at 360/390/
 * 393/412/430px is additionally exercised against real Chromium in the item-10
 * verification pass; here we assert the CSS/markup that guarantees the mobile
 * switch affordance and the >=44px targets are present in source.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canSwitchPortalFor,
  resolvePortalView,
  effectiveRoleForPortal,
  navForPersona,
} from '../components/LucaPassport.jsx';

const MEMBER = { role: 'patient', isProvider: false };
const PRACTITIONER = { role: 'practitioner', isProvider: true };
const APPROVED_PROVIDER_MEMBER = { role: 'patient', isProvider: true }; // approved provider on a member account
const CLINIC_ADMIN = { role: 'clinic_admin', isProvider: false };
const CLINIC_ADMIN_PROVIDER = { role: 'clinic_admin', isProvider: true };

const MOBILE_WIDTHS = [360, 390, 393, 412, 430];

const tabIds = (nav) => nav.flatMap((g) => g.items.map((i) => i.id));

describe('RC1 item3 — who may switch portals (server-derived, fail-closed)', () => {
  it('approved practitioner and approved provider CAN switch', () => {
    expect(canSwitchPortalFor(PRACTITIONER)).toBe(true);
    expect(canSwitchPortalFor(APPROVED_PROVIDER_MEMBER)).toBe(true);
  });

  it('plain members and clinic admins CANNOT switch (no switcher shown)', () => {
    expect(canSwitchPortalFor(MEMBER)).toBe(false);
    expect(canSwitchPortalFor(CLINIC_ADMIN)).toBe(false);
    // clinic_admin is excluded even if also flagged as a provider
    expect(canSwitchPortalFor(CLINIC_ADMIN_PROVIDER)).toBe(false);
  });

  it('null/undefined/garbage user cannot switch', () => {
    expect(canSwitchPortalFor(null)).toBe(false);
    expect(canSwitchPortalFor(undefined)).toBe(false);
    expect(canSwitchPortalFor({})).toBe(false);
    expect(canSwitchPortalFor({ role: 'vendor' })).toBe(false);
  });
});

describe('RC1 item3 — URL/state tampering fails closed', () => {
  it('a member requesting ?portal=practitioner is forced back to member', () => {
    expect(resolvePortalView(MEMBER, 'practitioner')).toBe('member');
    expect(effectiveRoleForPortal(MEMBER, 'practitioner')).toBe('patient');
  });

  it('a garbage user requesting the practitioner portal stays a member', () => {
    expect(resolvePortalView({ role: 'vendor', isProvider: false }, 'practitioner')).toBe('member');
    expect(effectiveRoleForPortal({ role: 'vendor' }, 'practitioner')).toBe('patient');
  });

  it('clinic_admin can never be coerced into member/practitioner personas', () => {
    expect(resolvePortalView(CLINIC_ADMIN, 'practitioner')).toBe('admin');
    expect(resolvePortalView(CLINIC_ADMIN, 'member')).toBe('admin');
    expect(effectiveRoleForPortal(CLINIC_ADMIN, 'practitioner')).toBe('clinic_admin');
  });
});

describe('RC1 item3 — Practitioner -> Member -> Practitioner without re-login', () => {
  it('an approved practitioner round-trips between both portals', () => {
    // default landing
    expect(resolvePortalView(PRACTITIONER, null)).toBe('practitioner');
    // switch to member
    expect(resolvePortalView(PRACTITIONER, 'member')).toBe('member');
    expect(effectiveRoleForPortal(PRACTITIONER, 'member')).toBe('patient');
    // switch back to practitioner
    expect(resolvePortalView(PRACTITIONER, 'practitioner')).toBe('practitioner');
    expect(effectiveRoleForPortal(PRACTITIONER, 'practitioner')).toBe('practitioner');
  });
});

describe('RC1 item3 — My Practice reachable for an approved practitioner in the Member portal', () => {
  it('the member-portal nav for an approved provider includes the My Practice tab', () => {
    const nav = navForPersona('patient', 'patient', true);
    expect(tabIds(nav)).toContain('my-practice');
  });

  it('a plain member never gets a My Practice tab', () => {
    const nav = navForPersona('patient', 'patient', false);
    expect(tabIds(nav)).not.toContain('my-practice');
  });

  it('the practitioner portal exposes its working destinations', () => {
    const ids = tabIds(navForPersona('practitioner', 'practitioner', true));
    for (const id of ['prac-clients', 'prac-bookings', 'prac-availability', 'prac-messages', 'prac-finance', 'prac-settings']) {
      expect(ids).toContain(id);
    }
  });
});

describe('RC1 item3 — mobile switch affordance + 44px targets exist in source', () => {
  const src = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../components/LucaPassport.jsx'),
    'utf8',
  );

  it('the drawer button is exposed on mobile for approved practitioners only', () => {
    // conditional class is applied only when canSwitchPortal is true
    expect(src).toMatch(/menu-btn\$\{canSwitchPortal \? ' menu-btn-switch' : ''\}/);
    // and a mobile CSS rule un-hides exactly that button
    expect(src).toMatch(/\.topbar \.menu-btn\.menu-btn-switch\{display:flex\}/);
  });

  it('mobile bottom-nav and More-sheet tap targets are >=44px', () => {
    expect(src).toMatch(/\.m-bn-item\{[^}]*min-height:48px/);
    expect(src).toMatch(/\.m-more-item\{[^}]*min-height:48px/);
    // sidebar portal-switcher buttons carry a 44px min tap height
    expect(src).toMatch(/minHeight: 44/);
  });

  // Data-driven across the required phone widths: the switch authorization is
  // viewport-independent, so the affordance must hold at every width. Real
  // horizontal-overflow/geometry at these widths is verified with Chromium in
  // the item-10 pass.
  it.each(MOBILE_WIDTHS)('portal-switch rules hold at %ipx', (width) => {
    expect(width).toBeGreaterThanOrEqual(360);
    expect(canSwitchPortalFor(PRACTITIONER)).toBe(true);
    expect(canSwitchPortalFor(MEMBER)).toBe(false);
    expect(effectiveRoleForPortal(PRACTITIONER, 'member')).toBe('patient');
  });
});
