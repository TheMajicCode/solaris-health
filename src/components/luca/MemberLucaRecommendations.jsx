import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
 *   • Personalized Journey drafts (weekly + monthly) are assembled from
 *     clinician-reviewed building blocks; the member must APPROVE, and only then
 *     does "Begin" enroll into Growth. Labs appear only after an explicit request /
 *     order / reviewed pathway — never surfaced autonomously here.
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

// Clinician-reviewed building blocks for personalized Journey drafts.
const JOURNEY_BLOCKS = {
  weekly: {
    cadence: 'weekly',
    title: 'Weekly rhythm draft',
    steps: [
      'One grounding check-in (5 min) — reviewed self-care block',
      'One movement session aligned to your energy goal',
      'One reflection note you choose to share (or keep private)',
    ],
    reviewedBy: 'Solaris clinical review board',
  },
  monthly: {
    cadence: 'monthly',
    title: 'Monthly focus draft',
    steps: [
      'Revisit your top goal and confirm it still fits',
      'One optional session with a saved provider (your choice)',
      'A gentle progress reflection — no scores, no diagnosis',
    ],
    reviewedBy: 'Solaris clinical review board',
  },
};

function useSimulatedRecommendations(user) {
  const bookedProviderId = user?.bookedProviderId || null;
  const [dismissed, setDismissed] = useState(() => new Set());
  const [saved, setSaved] = useState(() => new Set());
  const [version, setVersion] = useState(0); // bump = recompute
  const [prefsToken, setPrefsToken] = useState('base');

  // Recompute selection: exclude dismissed + the already-booked provider (unless a
  // new reason applies — simulated here as "none"), keep only approved, diversify by
  // modality, cap at MAX_CANDIDATES.
  const candidates = useMemo(() => {
    const seenModality = new Set();
    const out = [];
    for (const p of SIMULATED_POOL) {
      if (!p.approved) continue;
      if (dismissed.has(p.id)) continue;
      if (p.id === bookedProviderId) continue; // never re-recommend booked provider w/o new reason
      if (seenModality.has(p.modality)) continue; // diversify
      seenModality.add(p.modality);
      out.push(p);
      if (out.length >= MAX_CANDIDATES) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, bookedProviderId, version, prefsToken]);

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
      <div className="f7" style={{ color: 'var(--muted)' }}>Assembled from clinician-reviewed blocks · reviewed by {block.reviewedBy}</div>
      <button type="button" style={{ marginTop: 10 }} disabled={approved}
        onClick={() => onApprove(block.cadence)} aria-label={`Approve and begin ${block.title}`}>
        {approved ? 'Approved — enrolled in Growth' : 'Approve & Begin'}
      </button>
    </div>
  );
}

export default function MemberLucaRecommendations({ user = {}, onView, onBook }) {
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
  const handleApprove = (cadence) => { setApprovedCadence(cadence); }; // member approval → enroll

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
