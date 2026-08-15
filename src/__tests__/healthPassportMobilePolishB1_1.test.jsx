/**
 * Health Passport mobile polish (branch agent/abacus-health-passport-mobile-polish-b1-1)
 * Node B.1 — practitioner intake card repair + Shared-with-LUCA header polish +
 * no duplicate Sovereignty surface. jsdom-provable structure + behaviour:
 *
 *   §1  Practitioner clinic-intake card composes as separate title / meta /
 *       status / action blocks (no nesting, no absolute overlap), long titles
 *       and long practitioner names stay intact, the primary action still fires.
 *   §2  "Shared with LUCA" collapsed header keeps title + count + chevron and
 *       carries the mobile "hide subtitle while collapsed" rule (no clipped
 *       fragment). Full subtitle text is intact in the DOM (not JS-truncated).
 *   §3  The Sovereignty ownership card ("Who holds your Passport") exists ONLY
 *       under Settings → Privacy & Sovereignty, never on the Health Passport.
 *
 * True pixel geometry / no bounding-box intersection at 360/390/412 is proven in
 * the installed-PWA Chromium simulation, reported honestly as a simulation.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';

const LONG_TITLE = 'Comprehensive Functional Medicine Cardiometabolic & Hormonal Baseline Intake Questionnaire (Extended)';
const LONG_PROVIDER = 'Dr. Alexandra Konstantinopoulou-Featherstonehaugh, Integrative Cardiology Clinic';

beforeAll(() => {
  window.matchMedia = (q) => ({
    matches: /max-width/.test(q),
    media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {},
  });
});

const intakeState = { submissions: [] };

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({ startRetake: vi.fn(), setExploreFilter: vi.fn(), refreshUser: vi.fn(), logout: vi.fn() }),
  AppProvider: ({ children }) => children,
}));

vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'getMyIntakeSubmissions') return () => Promise.resolve({ submissions: intakeState.submissions });
      if (prop === 'getHealthDocuments') return () => Promise.resolve({ documents: [] });
      if (prop === 'getProfile') return () => Promise.resolve({ profile: {} });
      if (prop === 'getSovereigntyStatus') return () => Promise.resolve({
        identity: { plain: 'You hold your Passport. Nobody else does.' },
        identityMethods: [],
        access: { plain: 'Only you decide who sees what.', practitioners: [] },
        storage: { plain: 'Encrypted and portable.' },
        ai: { plain: 'LUCA educates and prepares — never diagnoses.', provider: null, at: null },
        rights: { plain: 'Export or delete your data anytime.' },
      });
      if (prop === 'getLucaAgent') return () => Promise.resolve({ active: true });
      if (prop === 'getIdentityMe') return () => Promise.resolve({ solarisId: 'sol_x', solarisIdShort: 'sol_x…', gps: {} });
      if (prop === 'getIntakeFoundational') return () => Promise.resolve({ foundational: null });
      return () => Promise.resolve({});
    },
  }),
}));

import {
  IntakeFormsSection, PassportActions, SettingsPage,
} from '../components/LucaPassport.jsx';

let originalLocation;
beforeEach(() => {
  cleanup();
  intakeState.submissions = [];
  originalLocation = window.location;
  delete window.location;
  window.location = { href: '' };
});
afterEach(() => { window.location = originalLocation; });

describe('§1 practitioner clinic-intake card (mobile repair)', () => {
  const seedPending = () => {
    intakeState.submissions = [{
      id: 7, template_name: LONG_TITLE, provider_name: LONG_PROVIDER,
      status: 'pending', created_at: '2026-08-10', submitted_at: '2026-08-10',
    }];
  };

  it('renders the full long title and long practitioner name intact (no JS truncation)', async () => {
    seedPending();
    render(<div className="luca"><IntakeFormsSection /></div>);
    expect(await screen.findByText(LONG_TITLE)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(LONG_PROVIDER.slice(0, 30)))).toBeInTheDocument();
  });

  it('composes title / meta / status / action as separate, non-nested blocks (no overlap by structure)', async () => {
    seedPending();
    render(<div className="luca"><IntakeFormsSection /></div>);
    await screen.findByText(LONG_TITLE);
    const card = document.querySelector('.hp-intake');
    expect(card).toBeTruthy();
    const main = card.querySelector('.hp-intake-main');
    const status = card.querySelector('.hp-intake-status');
    const cta = card.querySelector('.hp-intake-cta');
    expect(main).toBeTruthy();
    expect(status).toBeTruthy();
    expect(cta).toBeTruthy();
    // Status and action live in distinct sibling containers — neither wraps the other.
    expect(status.contains(cta)).toBe(false);
    expect(cta.contains(status)).toBe(false);
    expect(main.contains(status)).toBe(false);
    expect(main.contains(cta)).toBe(false);
    // The status pill is NOT absolutely positioned (mobile requirement).
    const pill = status.firstElementChild;
    if (pill) expect(pill.getAttribute('style') || '').not.toMatch(/position:\s*absolute/i);
    // The Complete button is inside the CTA block.
    expect(within(cta).getByRole('button', { name: /Complete/i })).toBeInTheDocument();
  });

  it('primary action still executes (Complete → /intake?id=…)', async () => {
    seedPending();
    render(<div className="luca"><IntakeFormsSection /></div>);
    await screen.findByText(LONG_TITLE);
    fireEvent.click(screen.getByRole('button', { name: /Complete/i }));
    expect(window.location.href).toBe('/intake?id=7');
  });

  it('non-pending submissions expose View instead of Complete (status state preserved)', async () => {
    intakeState.submissions = [{
      id: 9, template_name: 'Sleep & recovery intake', provider_name: 'Dr. Rhodes',
      status: 'reviewed', created_at: '2026-08-01', submitted_at: '2026-08-01',
    }];
    render(<div className="luca"><IntakeFormsSection /></div>);
    await screen.findByText(/Sleep & recovery intake/i);
    expect(screen.getByRole('button', { name: /View/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete/i })).toBeNull();
  });
});

describe('§2 Shared with LUCA collapsed header (no clipped fragment)', () => {
  it('collapsed header keeps title + count; subtitle text is intact in the DOM', async () => {
    render(<div className="luca"><PassportActions go={vi.fn()} /></div>);
    const head = await screen.findByRole('button', { name: /Shared with LUCA/i });
    expect(head).toHaveAttribute('aria-expanded', 'false');
    expect(within(head).getByText('0')).toBeInTheDocument();
    // The subtitle, if present, carries its COMPLETE text (ellipsis/hiding is CSS,
    // never a truncated JS string like "Health documents you've chos…").
    const sub = head.querySelector('.hp-acc-sub');
    if (sub) {
      expect(sub.textContent).not.toMatch(/…|\.\.\.$/);
      expect(sub.textContent).toMatch(/Health documents you've chosen to share/i);
    }
  });

  it('ships the mobile rule that hides the collapsed subtitle (regression guard)', () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const src = fs.readFileSync(path.resolve(__dirname, '../components/LucaPassport.jsx'), 'utf8');
    expect(src).toMatch(/hp-acc\[data-open="false"\] \.hp-acc-sub\{display:none\}/);
  });
});

describe('§3 no duplicate Sovereignty surface', () => {
  it('Health Passport actions do NOT render the ownership card', async () => {
    render(<div className="luca"><PassportActions go={vi.fn()} /></div>);
    await screen.findByRole('button', { name: /Update my Health Passport/i });
    expect(screen.queryByText(/Who holds your Passport/i)).toBeNull();
  });

  it('Settings → Privacy & Sovereignty renders exactly one ownership card', async () => {
    render(<div className="luca"><SettingsPage user={{ id: 1 }} go={vi.fn()} sub="privacy" /></div>);
    expect(await screen.findByRole('tab', { name: /Privacy & Sovereignty/i })).toBeInTheDocument();
    const owners = await screen.findAllByText(/Who holds your Passport/i);
    expect(owners.length).toBe(1);
  });
});
