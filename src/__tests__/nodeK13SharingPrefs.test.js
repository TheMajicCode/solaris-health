import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHARING_CATEGORIES, SHARING_CATEGORY_IDS, normalizeSharing,
  loadSharingDefaults, saveSharingDefaults,
  loadBookingOverride, saveBookingOverride, clearBookingOverride,
  effectiveBookingSharing, sharingCount,
} from '../lib/sharingPrefs.js';

describe('K1.3 sharingPrefs — device-local, opt-in, per-subject', () => {
  beforeEach(() => { localStorage.clear(); });

  it('exposes itemized categories, all opt-in by default', () => {
    expect(SHARING_CATEGORIES.length).toBeGreaterThanOrEqual(4);
    const d = loadSharingDefaults('user-1');
    for (const id of SHARING_CATEGORY_IDS) expect(d[id]).toBe(false);
  });

  it('normalizeSharing coerces unknown/missing to false', () => {
    const n = normalizeSharing({ checkins: true, bogus: true });
    expect(n.checkins).toBe(true);
    expect(n).not.toHaveProperty('bogus');
    for (const id of SHARING_CATEGORY_IDS) expect(typeof n[id]).toBe('boolean');
  });

  it('saves and reloads account defaults per subject', () => {
    saveSharingDefaults('user-1', { checkins: true, assessments: true });
    const d = loadSharingDefaults('user-1');
    expect(d.checkins).toBe(true);
    expect(d.assessments).toBe(true);
    // A different subject is isolated.
    expect(loadSharingDefaults('user-2').checkins).toBe(false);
  });

  it('per-booking override falls back to defaults until set', () => {
    saveSharingDefaults('user-1', { checkins: true });
    expect(loadBookingOverride('user-1', 'bk-1')).toBeNull();
    // effective uses defaults when no override.
    expect(effectiveBookingSharing('user-1', 'bk-1').checkins).toBe(true);
    // set an override that turns checkins OFF for this booking only.
    saveBookingOverride('user-1', 'bk-1', { checkins: false, contact: true });
    expect(effectiveBookingSharing('user-1', 'bk-1').checkins).toBe(false);
    expect(effectiveBookingSharing('user-1', 'bk-1').contact).toBe(true);
    // defaults unchanged.
    expect(loadSharingDefaults('user-1').checkins).toBe(true);
  });

  it('clearBookingOverride reverts to defaults', () => {
    saveSharingDefaults('user-1', { checkins: true });
    saveBookingOverride('user-1', 'bk-1', { checkins: false });
    clearBookingOverride('user-1', 'bk-1');
    expect(loadBookingOverride('user-1', 'bk-1')).toBeNull();
    expect(effectiveBookingSharing('user-1', 'bk-1').checkins).toBe(true);
  });

  it('sharing is never implied — a brand-new booking shares nothing by default', () => {
    expect(sharingCount(effectiveBookingSharing('fresh-user', 'fresh-booking'))).toBe(0);
  });

  it('sharingCount counts enabled categories', () => {
    expect(sharingCount({ checkins: true, contact: true })).toBe(2);
    expect(sharingCount({})).toBe(0);
  });
});
