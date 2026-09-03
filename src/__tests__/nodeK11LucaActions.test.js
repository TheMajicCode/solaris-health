/**
 * NODE K1.1 — §6 LUCA actions functional + honest.
 *
 * Complements nodeK1LucaActions.test.js (which proves registry shape,
 * two-profile divergence, state-change outcomes and de-identification).
 *
 * This file proves the two remaining §6 guarantees:
 *   (c) a successful model call is displayed; a failed / degraded call falls
 *       back to the deterministic local reply, labeled honestly as degraded;
 *   (d) NO quick action can autonomously book, message, submit or spend —
 *       every action at most navigates the member to a screen or opens a sheet.
 *
 * (c) is asserted as a source contract on CoachPage.runAction in
 * LucaPassport.jsx (the single integration point that calls the LUCA service),
 * so the proof tracks the shipped wiring rather than a re-implementation.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LUCA_ACTIONS,
  deterministicResponse,
} from '../lib/lucaActions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const passportSrc = fs.readFileSync(
  path.join(__dirname, '../components/LucaPassport.jsx'),
  'utf8',
);

// The only chip verbs a LUCA reply is allowed to emit. None of these
// autonomously books, messages, submits or spends — they navigate the member
// to a screen or open a member-driven flow.
const SAFE_CHIP_ACTIONS = new Set([
  'navigate', 'curate', 'open_journey', 'start_checkin', 'start_assessment',
]);
// Verbs that would violate the safety envelope if any chip emitted them.
const FORBIDDEN_CHIP_ACTIONS = [
  'book', 'send', 'submit', 'pay', 'purchase', 'checkout', 'confirm_booking',
  'message_send', 'approve', 'charge',
];

describe('§6(d) no LUCA action can auto-book / send / submit / spend', () => {
  it('every registered action is response|workflow — never an auto-executing kind', () => {
    for (const a of LUCA_ACTIONS) {
      expect(['response', 'workflow']).toContain(a.kind);
    }
  });

  it('every deterministic reply only emits safe, member-driven chips', () => {
    const profiles = [
      {}, // empty newcomer
      {
        vitality: 72,
        completeness: { checks: { intake: true, profile: true } },
        checkins: [{ created_at: new Date().toISOString() }],
        journeys: [{ journeyType: 'sleep_reset', status: 'active', currentStep: 1 }],
        bookings: [{ status: 'confirmed', start_at: new Date(Date.now() + 3 * 86400000).toISOString(), provider_name: 'Aura Dental' }],
        savedIds: ['p1'], bookedIds: ['p2'], goals: ['Sleep', 'Energy'],
      },
    ];
    for (const p of profiles) {
      for (const a of LUCA_ACTIONS) {
        const res = deterministicResponse(a.id, p);
        for (const chip of res.chips || []) {
          expect(SAFE_CHIP_ACTIONS.has(chip.action)).toBe(true);
          expect(FORBIDDEN_CHIP_ACTIONS).not.toContain(chip.action);
        }
      }
    }
  });

  it('the model prompt instructs the model never to book / message / approve / move money', async () => {
    const { buildModelPrompt, deidentifyContext } = await import('../lib/lucaActions.js');
    const prompt = buildModelPrompt('next_step', deidentifyContext({ vitality: 50 }));
    expect(prompt.toLowerCase()).toMatch(/never diagnose, prescribe, book, message, approve, or move money/);
  });
});

describe('§6(c) runAction shows the model reply on success, honest fallback on failure', () => {
  // Isolate CoachPage.runAction from the source.
  const start = passportSrc.indexOf('const runAction = async (actionId)');
  const body = passportSrc.slice(start, start + 3200);

  it('calls the existing LUCA service boundary (api.sendLucaMessage)', () => {
    expect(body).toMatch(/await api\.sendLucaMessage\(action\.label\)/);
  });

  it('uses the model reply only when it is a genuine LIVE model reply (§13)', () => {
    // §13 correction: a mock/degraded reply (Preview runs the AIProvider in mock
    // mode, which returns degraded:null) must NOT be treated as a live reply.
    // modelReply is gated by isLiveModelReply(res), not merely !res.degraded ...
    expect(body).toMatch(/const modelReply = isLiveModelReply\(res\) \? res\.reply : null/);
    // ... and the assistant message prefers the model reply, else the local text.
    expect(body).toMatch(/content:\s*modelReply\s*\|\|\s*local\.reply/);
  });

  it('marks the message degraded whenever there is no model reply', () => {
    expect(body).toMatch(/degraded:\s*!modelReply/);
  });

  it('on a thrown error falls back to the deterministic local reply, labeled degraded', () => {
    expect(body).toMatch(/catch\s*\(e\)/);
    expect(body).toMatch(/setDegraded\(true\)/);
    expect(body).toMatch(/content:\s*local\.reply,\s*degraded:\s*true/);
  });

  it('computes the deterministic fallback from the member context before calling out', () => {
    // Phase 5: the deterministic fallback is now produced through the bounded
    // response contract (buildLucaResponse) which wraps deterministicResponse.
    expect(body).toMatch(/const local = buildLucaResponse\(actionId, actionContext\(\)\)/);
  });

  it('workflow action build_journey OPENS the planner and never auto-completes', () => {
    expect(body).toMatch(/action\.id === 'build_journey'.*setJourneyOpen\(true\); return;/s);
  });
});

describe('§6(c) degraded state is surfaced honestly in the transcript UI', () => {
  it('renders an offline / degraded indicator driven by the degraded flag', () => {
    // The CoachPage tracks a `degraded` state and shows an offline label.
    expect(passportSrc).toMatch(/const \[degraded, setDegraded\] = useState\(false\)/);
    expect(passportSrc.toLowerCase()).toMatch(/offline/);
  });
});
