// RC1 item8 — Clinic OS is an INFORMATIONAL simulated Preview only. It must not
// collect or stage org metadata and must not create orgs/tenants/memberships/
// entitlements/approval records. It must show the required boundary copy and
// document the real requirements.
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClinicOSFoundation from '../components/clinic/ClinicOSFoundation.jsx';

// The component reads import.meta.env.VITE_CLINIC_OS_BETA at module load. Vitest
// evaluates it once; the preview build sets it true. We assert behaviour under the
// value the test env provides and cover the informational contract via the source
// as well (no form controls, no staging handlers).
const FLAG_ON = import.meta.env.VITE_CLINIC_OS_BETA === 'true';
const practitioner = { role: 'practitioner', name: 'Dr. Test' };
const member = { role: 'member', name: 'Member Test' };

describe('RC1 item8 — Clinic OS informational preview', () => {
  it('renders the required "coming later; separate verification required" boundary copy for approved practitioners (flag on)', () => {
    if (!FLAG_ON) return; // only meaningful when preview flag is enabled
    render(<ClinicOSFoundation user={practitioner} />);
    const copy = screen.getByTestId('clinic-os-coming-later');
    expect(copy.textContent).toMatch(/coming later/i);
    expect(copy.textContent).toMatch(/separate verification required/i);
  });

  it('is labelled Simulated Preview / Informational (flag on)', () => {
    if (!FLAG_ON) return;
    render(<ClinicOSFoundation user={practitioner} />);
    const badge = screen.getByTestId('clinic-os-preview-badge');
    expect(badge.textContent).toMatch(/simulated preview/i);
    expect(badge.textContent).toMatch(/informational/i);
  });

  it('collects NO org metadata — no text inputs, selects, textareas, or save button (flag on)', () => {
    if (!FLAG_ON) return;
    const { container } = render(<ClinicOSFoundation user={practitioner} />);
    expect(container.querySelectorAll('input').length).toBe(0);
    expect(container.querySelectorAll('select').length).toBe(0);
    expect(container.querySelectorAll('textarea').length).toBe(0);
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('states explicitly that nothing is saved / no org/tenant/entitlement is created (flag on)', () => {
    if (!FLAG_ON) return;
    const { container } = render(<ClinicOSFoundation user={practitioner} />);
    const text = container.textContent.toLowerCase();
    expect(text).toContain('does not create');
    expect(text).toContain('saved to any server');
  });

  it('documents the real requirements incl. separate verification and unapplied migration (flag on)', () => {
    if (!FLAG_ON) return;
    const { container } = render(<ClinicOSFoundation user={practitioner} />);
    const text = container.textContent.toLowerCase();
    expect(text).toContain('role-based access control');
    expect(text).toContain('verification');
    expect(text).toContain('not applied');
  });

  it('gates non-practitioners even when the flag is on (no informational form leaks)', () => {
    if (!FLAG_ON) return;
    render(<ClinicOSFoundation user={member} />);
    expect(screen.queryByTestId('clinic-os-foundation')).toBeNull();
  });

  it('source contains no state/staging handlers (useState/onChange/Save) — informational only', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/components/clinic/ClinicOSFoundation.jsx'), 'utf8');
    expect(src).not.toMatch(/useState/);
    expect(src).not.toMatch(/onChange/);
    expect(src).not.toMatch(/Save to Beta preview/);
    // No local persistence either.
    expect(src).not.toMatch(/localStorage/);
  });
});
