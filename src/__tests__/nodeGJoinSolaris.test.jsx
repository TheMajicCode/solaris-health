/**
 * NODE G — "Join Solaris" entry rename + no reapply/switch-to-patient copy.
 *
 * The marketplace CTA that used to read "List your practice" / "Become a
 * provider" now reads "Join Solaris" (ONE identity, staged entitlements — an
 * approved practitioner returns here to Add or claim a practice WITHOUT
 * reapplying). This suite asserts the rename at the surfaces a member sees and
 * that the old reapply / "switch to Patient mode" instructions are gone.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../lib/api.js', () => ({ api: new Proxy({}, { get: () => () => Promise.resolve({}) }) }));

import ExploreMarketplace from '../components/marketplace/ExploreMarketplace.jsx';

beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });

describe('Join Solaris rename', () => {
  it('the marketplace provider CTA reads "Join Solaris"', () => {
    render(<ExploreMarketplace user={{ id: 1, role: 'patient' }} onBecomeProvider={() => {}} />);
    expect(screen.getByText('Join Solaris')).toBeInTheDocument();
    expect(screen.queryByText(/List your practice/i)).toBeNull();
  });

  it('source no longer instructs members to reapply or switch to Patient mode', () => {
    const files = [
      'src/components/provider/MyPractice.jsx',
      'src/components/provider/ProviderWorkspace.jsx',
    ];
    for (const rel of files) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      expect(src).not.toMatch(/apply again from/i);
      expect(src).not.toMatch(/Switch to Patient mode and apply/i);
      expect(src).toMatch(/Add or claim a practice/i);
    }
  });
});
