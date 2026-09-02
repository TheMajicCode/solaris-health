// Node B §11 — versioned local-first daily-signals store + safe formatting.
// Never render raw null/undefined/NaN/"nullm"; zero shown only when genuinely
// recorded; observations are versioned, per-user isolated, and reviewable.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SIGNALS_SCHEMA_VERSION, makeObservation, saveSignals, loadSignals,
  latestByMetric, deleteSignal, isRecorded, formatSignal, formatSignalOrNotLogged,
  EMPTY_VALUE, NOT_LOGGED,
} from '../lib/dailySignals.js';

beforeEach(() => { localStorage.clear(); });

describe('Node B §11 — observation shape', () => {
  it('every observation is versioned and carries provenance + createdBy', () => {
    const o = makeObservation({ metric: 'steps', value: 6000, unit: 'steps' }, 'u1');
    expect(o.v).toBe(SIGNALS_SCHEMA_VERSION);
    expect(o.metric).toBe('steps');
    expect(o.value).toBe(6000);
    expect(o.source).toBe('manual');
    expect(o.provenance).toBeTruthy();
    expect(o.createdBy).toBe('u1');
    expect(o.consentScope).toBe('device-local');
    expect(typeof o.observedAt).toBe('string');
  });
});

describe('Node B §11 — store save/load + isolation', () => {
  it('saves several signals at once and reloads them', () => {
    saveSignals('u1', [
      { metric: 'steps', value: 6000, unit: 'steps' },
      { metric: 'sleep_hours', value: 7.5, unit: 'h' },
    ]);
    expect(loadSignals('u1')).toHaveLength(2);
  });

  it('drops empty/blank values (partial entry allowed, nothing fabricated)', () => {
    saveSignals('u1', [
      { metric: 'steps', value: 6000 },
      { metric: 'mood', value: '' },
      { metric: 'energy', value: null },
    ]);
    const list = loadSignals('u1');
    expect(list).toHaveLength(1);
    expect(list[0].metric).toBe('steps');
  });

  it('is per-user isolated — one user never reads another user\'s rows', () => {
    saveSignals('u1', [{ metric: 'steps', value: 1000 }]);
    saveSignals('u2', [{ metric: 'steps', value: 2000 }]);
    expect(loadSignals('u1')).toHaveLength(1);
    expect(loadSignals('u1')[0].value).toBe(1000);
    expect(loadSignals('u2')[0].value).toBe(2000);
  });

  it('latestByMetric returns the most recent per metric', () => {
    saveSignals('u1', [{ metric: 'steps', value: 1000, observedAt: '2026-09-01T08:00:00Z' }]);
    saveSignals('u1', [{ metric: 'steps', value: 8000, observedAt: '2026-09-02T08:00:00Z' }]);
    expect(latestByMetric('u1').steps.value).toBe(8000);
  });

  it('member can correct their own entry (delete by id)', () => {
    saveSignals('u1', [{ metric: 'weight', value: 70 }]);
    const id = loadSignals('u1')[0].id;
    deleteSignal('u1', id);
    expect(loadSignals('u1')).toHaveLength(0);
  });
});

describe('Node B §11 — safe formatting (no nullm / undefined / NaN)', () => {
  it('isRecorded: 0 is real, null/undefined/""/NaN are not', () => {
    expect(isRecorded(0)).toBe(true);
    expect(isRecorded(null)).toBe(false);
    expect(isRecorded(undefined)).toBe(false);
    expect(isRecorded('')).toBe(false);
    expect(isRecorded('abc')).toBe(false);
  });

  it('missing values become the em-dash placeholder, never "nullm"', () => {
    expect(formatSignal(null, { unit: 'm' })).toBe(EMPTY_VALUE);
    expect(formatSignal(undefined, { unit: 'm' })).toBe(EMPTY_VALUE);
    expect(formatSignal(NaN, { unit: 'h' })).toBe(EMPTY_VALUE);
  });

  it('a genuinely-recorded zero renders as "0", never blanked', () => {
    expect(formatSignal(0, { unit: 'min' })).toBe('0min'); // short alpha unit: no space
    expect(formatSignal(0)).toBe('0');
  });

  it('joins units cleanly (never a stray "nullm")', () => {
    expect(formatSignal(7.5, { unit: 'h', digits: 1 })).toBe('7.5h'); // short unit, no space
    expect(formatSignal(6000, { unit: 'steps' })).toBe('6000 steps'); // long unit, spaced
  });

  it('formatSignalOrNotLogged uses the "Not logged" label when missing', () => {
    expect(formatSignalOrNotLogged(null)).toBe(NOT_LOGGED);
    expect(formatSignalOrNotLogged(62, 'BPM')).toBe('62BPM'); // short alpha unit: no space
  });
});
