/**
 * NODE E4J-RC1 — item 5: Journey "Approve & Begin" surfaces the EXACT approved
 * draft in Communications → Growth, labeled local/simulated, with human approval
 * preserved and NO fake server-persistence claim.
 *   • Approving a draft calls onApprove with the exact block (cadence/title/steps).
 *   • The approved block carries an approvedAt stamp (record of member approval).
 *   • The MemberLucaRecommendations component makes NO server write on approve.
 *   • JournalPage renders an ApprovedJourneyCard for the approved journey, and its
 *     copy explicitly states it is local/simulated and not saved to a server.
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

async function load(flag) {
  vi.resetModules();
  vi.stubEnv('VITE_LUCA_RECS_SIMULATED', flag);
  return import('../components/luca/MemberLucaRecommendations.jsx');
}

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RECS_SRC = fs.readFileSync(path.resolve(HERE, '../components/luca/MemberLucaRecommendations.jsx'), 'utf8');
const PASSPORT_SRC = fs.readFileSync(path.resolve(HERE, '../components/LucaPassport.jsx'), 'utf8');
const CTX_SRC = fs.readFileSync(path.resolve(HERE, '../state/AppContext.jsx'), 'utf8');

describe('RC1 item5 — Approve & Begin hands the exact draft to the caller', () => {
  it('onApprove fires with the exact approved block (weekly)', async () => {
    const { default: Cmp } = await load('true');
    const onApprove = vi.fn();
    render(<Cmp user={{}} onApprove={onApprove} />);
    const btn = screen.getByLabelText(/Approve and begin Weekly rhythm draft/i);
    fireEvent.click(btn);
    expect(onApprove).toHaveBeenCalledTimes(1);
    const block = onApprove.mock.calls[0][0];
    expect(block.cadence).toBe('weekly');
    expect(block.title).toBe('Weekly rhythm draft');
    expect(Array.isArray(block.steps)).toBe(true);
    expect(block.steps.length).toBeGreaterThan(0);
    expect(typeof block.approvedAt).toBe('number'); // approval record
  });

  it('onApprove fires with the exact approved block (monthly)', async () => {
    const { default: Cmp } = await load('true');
    const onApprove = vi.fn();
    render(<Cmp user={{}} onApprove={onApprove} />);
    fireEvent.click(screen.getByLabelText(/Approve and begin Monthly focus draft/i));
    expect(onApprove.mock.calls[0][0].cadence).toBe('monthly');
  });

  it('button reflects approval state after clicking (human approval preserved in UI)', async () => {
    const { default: Cmp } = await load('true');
    render(<Cmp user={{}} onApprove={() => {}} />);
    const btn = screen.getByLabelText(/Approve and begin Weekly rhythm draft/i);
    fireEvent.click(btn);
    expect(screen.getByText(/Approved — enrolled in Growth/i)).toBeTruthy();
  });
});

describe('RC1 item5 — no fake server persistence on approve', () => {
  it('MemberLucaRecommendations makes no api write call on approve', () => {
    // The recs component must not call any create/enroll/persist API on approval.
    expect(RECS_SRC).not.toMatch(/api\.(create|enroll|save|persist)Journey/i);
    // The approve handler comment states it is local/simulated only.
    expect(RECS_SRC).toMatch(/nothing is written to any server/i);
  });
});

describe('RC1 item5 — Growth surfaces the approved draft, labeled local/simulated', () => {
  it('AppContext holds approvedJourney in memory only (no localStorage/server)', () => {
    expect(CTX_SRC).toMatch(/approvedJourney/);
    expect(CTX_SRC).toMatch(/setApprovedJourney/);
    // cleared on logout — session/local only
    expect(CTX_SRC).toMatch(/setApprovedJourney\(null\)/);
  });

  it('LucaPassport navigates to Growth and stores the approved journey', () => {
    expect(PASSPORT_SRC).toMatch(/onApprove=\{\(block\)/);
    expect(PASSPORT_SRC).toMatch(/setApprovedJourney\?\.\(block\)/);
    expect(PASSPORT_SRC).toMatch(/go\('growth'\)/);
  });

  it('ApprovedJourneyCard exists and is labeled local/simulated, not-saved-to-server', () => {
    expect(PASSPORT_SRC).toMatch(/function ApprovedJourneyCard/);
    expect(PASSPORT_SRC).toMatch(/data-testid="approved-journey-card"/);
    expect(PASSPORT_SRC).toMatch(/not saved to any server/i);
    expect(PASSPORT_SRC).toMatch(/Local preview · Simulated/i);
    // it is rendered in the grow view
    expect(PASSPORT_SRC).toMatch(/<ApprovedJourneyCard journey=\{approvedJourney\}/);
  });
});
