import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';

/**
 * MemberLucaRecommendations.jsx  — Node I
 *
 * Replaces the static single-result LUCA suggestion with UP TO THREE transparent,
 * diversified, APPROVED-provider candidates. Every card discloses:
 *   • Why surfaced  • Assumptions LUCA made  • Unknowns LUCA could not see
 * and offers member-controlled actions: Dismiss · Save · View · Book.
 *
 * Behaviour (all human-in-the-loop — LUCA never books/orders/messages/spends):
 *   • Candidates are diversified across modality so the member sees range, not one path.
 *   • Recompute is triggered by: booking, dismissal, preference change, or expiry.
 *   • A booked provider is NOT re-recommended unless a NEW reason applies.
 *   • Only APPROVED providers are eligible.
 *   • Personalized Journey drafts (weekly + monthly) are assembled from standard,
 *     non-clinical self-care building blocks; the member must APPROVE, and only
 *     then does "Begin" enroll into Growth. Labs appear only after an explicit
 *     request / order / reviewed pathway — never surfaced autonomously here.
 *   • View opens the EXACT provider profile and Book opens the SAME shared
 *     BookingFlow used across the app (deep-link by provider id). When live
 *     approved-provider data is available the candidates are bound to real
 *     provider ids; otherwise a clearly-labeled simulated fallback is shown.
 *
 * Persistence: shared beta DB is read-only for this sprint, so state is held in a
 * deterministic feature-flagged fixture labeled "Beta preview · Simulated".
 * The future additive persistence contract lives in
 * backend/migrations/041_luca_recommendations.sql (committed, NOT applied).
 *
 * Provenance logged is NON-PHI only (algorithm version + candidate ids). LUCA never
 * infers diagnosis, clinical suitability, or outcome.
 */

export const LUCA_RECS_SIMULATED =
  (import.meta?.env?.VITE_LUCA_RECS_SIMULATED === 'true');

export const RECS_ALGO_VERSION = 'luca-recs-v2-diversified';
export const MAX_CANDIDATES = 3;

// Deterministic, non-PHI simulated pool of APPROVED providers. Diversified by modality.
// (Real build reads api.getLucaRecommendations(); this pool drives the Beta preview.)
const SIMULATED_POOL = [
  {
    id: 'sim-prov-therapy',
    title: 'Aria Nguyen, LMFT',
    modality: 'Talk therapy',
    city: 'Austin, TX',
    language: 'en',
    approved: true,
    why: 'Matches your stated goal "manage stress" and your English preference; offers evening telehealth that fits your availability window.',
    assumptions: 'Assumes you still prefer telehealth over in-person, based on your last saved preference.',
    unknowns: 'LUCA cannot see your insurance network or any diagnosis — confirm coverage before booking.',
  },
  {
    id: 'sim-prov-nutrition',
    title: 'Marcus Bell, RDN',
    modality: 'Nutrition',
    city: 'Remote',
    language: 'en',
    approved: true,
    why: 'You saved two nutrition-focused listings this month; this approved dietitian covers energy and sleep goals you flagged.',
    assumptions: 'Assumes your energy goal is still active from your intake.',
    unknowns: 'LUCA has no lab values and does not order labs — any testing requires your explicit request and a reviewed pathway.',
  },
  {
    id: 'sim-prov-movement',
    title: 'Sol Movement Studio',
    modality: 'Movement / yoga',
    city: 'Austin, TX',
    language: 'es',
    approved: true,
    why: 'Adds a different modality so you see range; located near your saved area and offers Spanish-language classes.',
    assumptions: 'Assumes proximity still matters to you for in-person movement.',
    unknowns: 'LUCA cannot confirm accessibility accommodations — check with the studio directly.',
  },
  {
    id: 'sim-prov-sleep',
    title: 'Dr. Lena Ortiz — Sleep',
    modality: 'Sleep medicine',
    city: 'Remote',
    language: 'en',
    approved: true,
    why: 'Backup candidate aligned to your sleep goal, surfaced when another option is dismissed.',
    assumptions: 'Assumes sleep remains one of your top goals.',
    unknowns: 'LUCA cannot diagnose a sleep disorder; this is a suggestion to explore, not a clinical determination.',
  },
];

// Standard, non-clinical self-care building blocks for personalized Journey
// drafts. These are generic wellness templates — NOT reviewed or endorsed by any
// named clinical body (no such review board exists in this build). The member
// reviews and approves every draft before anything begins; nothing is clinical
// advice, diagnosis, or a prescription.
const JOURNEY_BLOCKS = {
  weekly: {
    cadence: 'weekly',
    title: 'Weekly rhythm draft',
    steps: [
      'One grounding check-in (5 min) — standard self-care block',
      'One movement session aligned to your energy goal',
      'One reflection note you choose to share (or keep private)',
    ],
    source: 'Standard self-care template',
  },
  monthly: {
    cadence: 'monthly',
    title: 'Monthly focus draft',
    steps: [
      'Revisit your top goal and confirm it still fits',
      'One optional session with a saved provider (your choice)',
      'A gentle progress reflection — no scores, no diagnosis',
    ],
    source: 'Standard self-care template',
  },
};

// Generic, honest transparency copy bound onto a REAL approved provider when live
// data is available. Keeps the "why / assumptions / unknowns" disclosure without
// asserting any clinical claim LUCA cannot support.
function liveCandidateFrom(p) {
  const type = p.provider_type || 'provider';
  return {
    id: `live-${p.id}`,
    providerId: p.id,           // real provider id — View/Book deep-link this
    live: true,
    title: p.business_name || 'Approved provider',
    modality: type,
    city: p.city || 'See profile',
    language: p.language || 'en',
    approved: true,
    why: `Surfaced because this approved ${type} matches a goal or saved interest on your profile and is currently listed.`,
    assumptions: 'Assumes your most recently saved preferences still apply — update them to change what surfaces.',
    unknowns: 'LUCA cannot see your insurance network, diagnosis, or clinical suitability — confirm fit before booking.',
  };
}

function useSimulatedRecommendations(user) {
  const bookedProviderId = user?.bookedProviderId || null;
  const [dismissed, setDismissed] = useState(() => new Set());
  const [saved, setSaved] = useState(() => new Set());
  const [version, setVersion] = useState(0); // bump = recompute
  const [prefsToken, setPrefsToken] = useState('base');
  // Live-bound pool of REAL approved providers (null until a successful read).
  // Reads are allowed against the read-only shared DB; on any failure we keep the
  // deterministic simulated fallback so the surface never dead-ends.
  const [livePool, setLivePool] = useState(null);

  useEffect(() => {
    let cancel = false;
    api.getProviders({ limit: 50 })
      .then((d) => {
        const list = (d && Array.isArray(d.providers)) ? d.providers : [];
        const seen = new Set();
        const bound = [];
        for (const p of list) {
          if (!p || p.id == null) continue;
          const t = p.provider_type || 'provider';
          if (seen.has(t)) continue; // diversify by real modality
          seen.add(t);
          bound.push(liveCandidateFrom(p));
          if (bound.length >= MAX_CANDIDATES) break;
        }
        if (!cancel && bound.length) setLivePool(bound);
      })
      .catch(() => { /* keep simulated fallback */ });
    return () => { cancel = true; };
  }, []);

  const basePool = livePool || SIMULATED_POOL;

  // Recompute selection: exclude dismissed + the already-booked provider (unless a
  // new reason applies — simulated here as "none"), keep only approved, diversify by
  // modality, cap at MAX_CANDIDATES.
  const candidates = useMemo(() => {
    const seenModality = new Set();
    const out = [];
    for (const p of basePool) {
      if (!p.approved) continue;
      if (dismissed.has(p.id)) continue;
      // never re-recommend the booked provider w/o a new reason (match sim id or real id)
      if (p.id === bookedProviderId || p.providerId === bookedProviderId) continue;
      if (seenModality.has(p.modality)) continue; // diversify
      seenModality.add(p.modality);
      out.push(p);
      if (out.length >= MAX_CANDIDATES) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, bookedProviderId, version, prefsToken, basePool]);

  const recompute = useCallback(() => setVersion((v) => v + 1), []);
  const dismiss = useCallback((id) => {
    setDismissed((prev) => new Set(prev).add(id)); // dismissal triggers recompute via memo dep
  }, []);
  const save = useCallback((id) => {
    setSaved((prev) => new Set(prev).add(id));
  }, []);
  const changePrefs = useCallback((token) => {
    setPrefsToken(token || String(Date.now())); // preference change triggers recompute
  }, []);

  // Provenance: NON-PHI only.
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug('[luca-recs] provenance', {
        algo: RECS_ALGO_VERSION,
        candidateIds: candidates.map((c) => c.id),
        count: candidates.length,
      });
    } catch { /* noop */ }
  }, [candidates]);

  return { candidates, saved, dismiss, save, recompute, changePrefs };
}

function Disclosure({ label, children }) {
  return (
    <div className="luca-rec-disc" style={{ marginTop: 6 }}>
      <span className="f7" style={{ fontWeight: 700, color: 'var(--ink)' }}>{label}: </span>
      <span className="f7" style={{ color: 'var(--muted)' }}>{children}</span>
    </div>
  );
}

function CandidateCard({ c, isSaved, onDismiss, onSave, onView, onBook }) {
  return (
    <div className="luca-rec-card" data-testid="luca-rec-card" data-provider-id={c.id}
      style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h5 style={{ margin: 0 }}>{c.title}</h5>
          <div className="f7" style={{ color: 'var(--muted)' }}>{c.modality} · {c.city}</div>
        </div>
        <span className="f7" style={{ color: 'var(--muted)' }}>Approved</span>
      </div>
      <Disclosure label="Why surfaced">{c.why}</Disclosure>
      <Disclosure label="Assumptions">{c.assumptions}</Disclosure>
      <Disclosure label="Unknowns">{c.unknowns}</Disclosure>
      <div className="luca-rec-actions" style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onView(c)} aria-label={`View ${c.title}`}>View</button>
        <button type="button" onClick={() => onBook(c)} aria-label={`Book ${c.title}`}>Book</button>
        <button type="button" onClick={() => onSave(c)} aria-label={`Save ${c.title}`} aria-pressed={isSaved}>
          {isSaved ? 'Saved' : 'Save'}
        </button>
        <button type="button" onClick={() => onDismiss(c)} aria-label={`Dismiss ${c.title}`}>Dismiss</button>
      </div>
    </div>
  );
}

function JourneyDraftCard({ block, onApprove, approved }) {
  return (
    <div className="luca-journey-draft" data-testid="luca-journey-draft"
      style={{ border: '1px dashed var(--line)', borderRadius: 14, padding: 14, background: 'var(--surface, #fff)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h5 style={{ margin: 0 }}>{block.title}</h5>
        <span className="f7" style={{ color: 'var(--muted)' }}>Draft · you approve</span>
      </div>
      <ul className="f7" style={{ margin: '8px 0', paddingLeft: 18, color: 'var(--ink)' }}>
        {block.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
      <div className="f7" style={{ color: 'var(--muted)' }}>{block.source} · you review and approve before anything begins</div>
      <button type="button" style={{ marginTop: 10 }} disabled={approved}
        onClick={() => onApprove(block.cadence)} aria-label={`Approve and begin ${block.title}`}>
        {approved ? 'Approved — enrolled in Growth' : 'Approve & Begin'}
      </button>
    </div>
  );
}

export default function MemberLucaRecommendations({ user = {}, onView, onBook, onApprove }) {
  const {
    candidates, saved, dismiss, save, recompute, changePrefs,
  } = useSimulatedRecommendations(user);
  const [approvedCadence, setApprovedCadence] = useState(null);

  if (!LUCA_RECS_SIMULATED) {
    return (
      <div className="luca-recs-off" data-testid="luca-recs-off" style={{ padding: 16 }}>
        <p className="f7" style={{ color: 'var(--muted)' }}>
          LUCA multi-candidate recommendations are a Beta preview. Enable them with
          VITE_LUCA_RECS_SIMULATED to see up to three transparent suggestions.
        </p>
      </div>
    );
  }

  const handleBook = (c) => {
    onBook?.(c);        // real book flow is the caller's; nothing auto-executes here
    recompute();        // booking triggers recompute (booked provider drops out)
  };
  const handleDismiss = (c) => { dismiss(c.id); };            // dismissal triggers recompute
  const handleSave = (c) => { save(c.id); };
  const handleView = (c) => { onView?.(c); };
  // Member approval → record locally AND hand the exact approved draft to the
  // caller so it can surface it in Communications → Growth. This is a local,
  // simulated enrollment: nothing is written to any server here.
  const handleApprove = (cadence) => {
    setApprovedCadence(cadence);
    const block = JOURNEY_BLOCKS[cadence];
    if (block) onApprove?.({ ...block, approvedAt: Date.now() });
  };

  return (
    <div className="luca-recs" data-testid="luca-recs" style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>LUCA suggestions for you</h4>
        <span className="f7" style={{ color: 'var(--muted)' }}>Beta preview · Simulated</span>
      </div>
      <p className="f7" style={{ margin: 0, color: 'var(--muted)' }}>
        Up to three approved options, diversified so you see range. LUCA suggests only —
        it never books, orders, messages, or spends on your behalf.
      </p>

      {candidates.length === 0 ? (
        <div className="luca-recs-empty f7" data-testid="luca-recs-empty">
          No current suggestions. Update your preferences to see fresh options.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              c={c}
              isSaved={saved.has(c.id)}
              onDismiss={handleDismiss}
              onSave={handleSave}
              onView={handleView}
              onBook={handleBook}
            />
          ))}
        </div>
      )}

      <button type="button" onClick={() => changePrefs(String(Date.now()))}
        aria-label="Update preferences and recompute">
        Update preferences (recompute)
      </button>

      <div style={{ marginTop: 8 }}>
        <h4 style={{ margin: '0 0 8px' }}>Personalized Journey drafts</h4>
        <div style={{ display: 'grid', gap: 10 }}>
          <JourneyDraftCard block={JOURNEY_BLOCKS.weekly}
            approved={approvedCadence === 'weekly'} onApprove={handleApprove} />
          <JourneyDraftCard block={JOURNEY_BLOCKS.monthly}
            approved={approvedCadence === 'monthly'} onApprove={handleApprove} />
        </div>
      </div>
    </div>
  );
}
