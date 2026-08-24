/**
 * NODE E4J-RC1 item 5 (as carried forward into K1.1) — Journey "Approve & Begin"
 * surfaces the EXACT approved draft in Communications → Growth via the two
 * approved LUCA cards + ApprovedJourneyCard, with human approval preserved.
 *
 * NOTE (K1.1 §7): the obsolete MemberLucaRecommendations component was removed —
 * it had no production consumer. The approve→Growth flow now lives entirely in
 * LucaPassport (PersonalizedJourneySheet → setApprovedJourney → ApprovedJourneyCard),
 * so this file now asserts that source contract only. The device-local persistence
 * assertions live in nodeK11JourneyPersistence.test.jsx (K1.1 §4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PASSPORT_SRC = fs.readFileSync(path.resolve(HERE, '../components/LucaPassport.jsx'), 'utf8');
const CTX_SRC = fs.readFileSync(path.resolve(HERE, '../state/AppContext.jsx'), 'utf8');

describe('RC1 item5 — Growth surfaces the approved draft', () => {
  it('AppContext exposes approvedJourney + setter and clears the in-memory draft on logout', () => {
    expect(CTX_SRC).toMatch(/approvedJourney/);
    expect(CTX_SRC).toMatch(/setApprovedJourney/);
    // K1.1 §4 — logout clears the draft from MEMORY (raw state setter) but
    // intentionally LEAVES the user-scoped device-local key so the draft
    // survives a refresh / re-login on this device.
    expect(CTX_SRC).toMatch(/setApprovedJourneyState\(null\)/);
    expect(CTX_SRC).toMatch(/journeyStorageKey/);           // user-namespaced device key
    expect(CTX_SRC).toMatch(/localStorage\.removeItem/);    // dismiss/delete removes it
  });

  it('LucaPassport navigates to Growth and stores the approved journey', () => {
    expect(PASSPORT_SRC).toMatch(/onApprove=\{\(block\)/);
    expect(PASSPORT_SRC).toMatch(/setApprovedJourney\?\.\(block\)/);
    expect(PASSPORT_SRC).toMatch(/go\('growth'\)/);
  });

  it('ApprovedJourneyCard exists and is rendered in the Growth view', () => {
    expect(PASSPORT_SRC).toMatch(/function ApprovedJourneyCard/);
    expect(PASSPORT_SRC).toMatch(/data-testid="approved-journey-card"/);
    expect(PASSPORT_SRC).toMatch(/<ApprovedJourneyCard journey=\{approvedJourney\}/);
  });
});
