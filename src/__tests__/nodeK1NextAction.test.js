// Node K1 §A1 — centralized next-action resolver (pure, table-driven).
import { describe, it, expect } from 'vitest';
import resolveNextAction, {
  isCheckinDue, bookingNeedingAction, classifyMilestone, activeJourneyWithStep, dayKey,
} from '../lib/nextAction.js';

const TODAY = new Date('2026-08-23T10:00:00');
const iso = (d) => d; // checkins carry checkin_date

describe('Node K1 §A1 — resolveNextAction priority ladder', () => {
  it('P1: check-in due when intake complete and not checked in today', () => {
    const a = resolveNextAction({ vitality: 60, checkins: [], now: TODAY });
    expect(a.priority).toBe(1);
    expect(a.destination.type).toBe('checkin');
  });

  it('P1 suppressed: already checked in today', () => {
    const a = resolveNextAction({
      vitality: 60,
      checkins: [{ checkin_date: '2026-08-23' }],
      now: TODAY,
    });
    expect(a.priority).not.toBe(1);
  });

  it('P2: brand-new member (no intake/vitality) routed to assessment, NOT nagged to check in', () => {
    const a = resolveNextAction({ vitality: 0, completeness: { checks: {} }, checkins: [], now: TODAY });
    expect(a.priority).toBe(2);
    expect(a.destination.type).toBe('assessment');
  });

  it('P2: health_doc nextStep routes to the exact section', () => {
    const a = resolveNextAction({
      vitality: 50,
      checkins: [{ checkin_date: '2026-08-23' }], // clear P1
      completeness: { checks: { intake: true }, nextStep: { key: 'health_doc', label: 'Add a document', tab: 'health' } },
      now: TODAY,
    });
    expect(a.priority).toBe(2);
    expect(a.destination).toMatchObject({ type: 'section', tab: 'health', section: 'health_doc' });
  });

  // K1.4.1 §A renumbered the ladder: an unfinished To-do is priority 3 and a
  // journey milestone WITHOUT a To-do representing it is priority 4.
  it('P4: active server journey milestone (no To-do) -> communications/growth', () => {
    const a = resolveNextAction({
      vitality: 50,
      checkins: [{ checkin_date: '2026-08-23' }],
      journeys: [{ status: 'active', nextMilestone: { label: 'Week 2 continue' } }],
      now: TODAY,
    });
    expect(a.priority).toBe(4);
    expect(a.destination).toMatchObject({ type: 'communications', section: 'growth' });
  });

  it('P4: journal milestone classified to journal section', () => {
    const a = resolveNextAction({
      vitality: 50,
      checkins: [{ checkin_date: '2026-08-23' }],
      journeys: [{ status: 'active', nextMilestone: { label: 'Reflect in your journal' } }],
      now: TODAY,
    });
    expect(a.priority).toBe(4);
    expect(a.destination).toMatchObject({ type: 'communications', section: 'journal' });
  });

  it('P5: booking needing action wins over fallback', () => {
    const a = resolveNextAction({
      vitality: 50,
      checkins: [{ checkin_date: '2026-08-23' }],
      bookings: [{ id: 7, status: 'proposed' }],
      now: TODAY,
    });
    expect(a.priority).toBe(5);
    expect(a.destination).toMatchObject({ type: 'booking' });
  });

  it('P6: fallback -> build a personalized journey', () => {
    const a = resolveNextAction({
      vitality: 50,
      checkins: [{ checkin_date: '2026-08-23' }],
      now: TODAY,
    });
    expect(a.priority).toBe(6);
    expect(a.destination.type).toBe('journey');
  });

  it('higher priority always wins: check-in due beats a proposed booking', () => {
    const a = resolveNextAction({
      vitality: 50,
      checkins: [],
      bookings: [{ id: 7, status: 'proposed' }],
      journeys: [{ status: 'active', nextMilestone: { label: 'x' } }],
      now: TODAY,
    });
    expect(a.priority).toBe(1);
  });

  it('every branch returns a complete descriptor', () => {
    const a = resolveNextAction({ vitality: 50, checkins: [], now: TODAY });
    for (const k of ['priority', 'eyebrow', 'title', 'explanation', 'cta', 'icon', 'destination']) {
      expect(a[k]).toBeDefined();
    }
  });
});

describe('Node K1 §A1 — helpers', () => {
  it('dayKey stable for a date', () => {
    expect(dayKey(new Date('2026-08-23T23:00:00'))).toBe('2026-08-23');
    expect(dayKey('not-a-date')).toBe(null);
  });
  it('isCheckinDue false for non-onboarded member', () => {
    expect(isCheckinDue({ intakeComplete: false, checkins: [], now: TODAY })).toBe(false);
  });
  it('bookingNeedingAction picks the actionable state', () => {
    expect(bookingNeedingAction([{ status: 'confirmed' }, { status: 'reschedule_proposed', id: 2 }]).id).toBe(2);
    expect(bookingNeedingAction([{ status: 'confirmed' }])).toBe(null);
  });
  it('classifyMilestone reads explicit type then text', () => {
    expect(classifyMilestone({ actionType: 'media' })).toBe('media');
    expect(classifyMilestone({ label: 'Write in your journal' })).toBe('journal');
    expect(classifyMilestone({ label: 'random' })).toBe(null);
  });
  it('activeJourneyWithStep prefers server journey then local approved', () => {
    const server = activeJourneyWithStep({ journeys: [{ status: 'active', nextMilestone: { label: 'S' } }] });
    expect(server.source).toBe('server');
    const local = activeJourneyWithStep({ journeys: [], approvedJourney: { title: 'T', steps: [{ label: 'L' }] } });
    expect(local.source).toBe('local');
    expect(activeJourneyWithStep({})).toBe(null);
  });
});
