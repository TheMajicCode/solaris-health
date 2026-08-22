/**
 * JourneyPipeline — NODE H operational pipeline for a practitioner's care
 * relationships. This is an OPERATIONS board, NOT a sales funnel and NOT a
 * clinical record: it organises who needs a human touch next. It never infers a
 * diagnosis, suitability, or outcome from a stage.
 *
 * Seven ordered stages (mirror the backend contract in
 * migrations/040_journey_pipeline.sql, which is COMMITTED but NOT APPLIED to the
 * shared beta DB):
 *   New inquiry · Intake pending · Discovery booked · Active journey ·
 *   Review due · Paused · Completed
 *
 * Persistence needs a shared-DB migration that is deliberately NOT applied this
 * sprint, so the board runs on deterministic, feature-flagged fixtures clearly
 * labelled "Beta preview · Simulated". The fixtures carry NON-PHI only (first
 * name + a member-chosen goal phrase). Every stage change / outreach is a
 * "next action" that REQUIRES explicit practitioner confirmation and is audited
 * server-side once the contract is live — nothing moves or sends autonomously.
 */
import React, { useMemo, useState } from 'react';
import {
  Inbox, ClipboardList, CalendarCheck, Activity, RefreshCw, PauseCircle,
  CheckCircle2, Search, ArrowRight, Info, X,
} from 'lucide-react';

export const PIPELINE_STAGES = [
  { id: 'new_inquiry', label: 'New inquiry', icon: Inbox, color: '#6B7FD7' },
  { id: 'intake_pending', label: 'Intake pending', icon: ClipboardList, color: '#C58A53' },
  { id: 'discovery_booked', label: 'Discovery booked', icon: CalendarCheck, color: '#2DB584' },
  { id: 'active_journey', label: 'Active journey', icon: Activity, color: '#2DB584' },
  { id: 'review_due', label: 'Review due', icon: RefreshCw, color: '#E3AC46' },
  { id: 'paused', label: 'Paused', icon: PauseCircle, color: '#9AA6A2' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, color: '#3B8C6E' },
];

const FLAG = import.meta.env.VITE_CLINIC_OS_BETA === 'true';

// Deterministic NON-PHI fixtures. `next` is the single human-approved action the
// practitioner would take; `deep` is a deep-link target (tab/sub) into the
// existing portal — never an auto-executed side effect.
const FIXTURES = [
  { id: 'j1', name: 'Maria', goal: 'More energy through the week', stage: 'new_inquiry', next: 'Review the inquiry and send a welcome note', deep: { tab: 'communications', sub: 'messages' } },
  { id: 'j2', name: 'Diego', goal: 'Sleep and stress support', stage: 'intake_pending', next: 'Nudge intake completion before booking', deep: { tab: 'communications', sub: 'messages' } },
  { id: 'j3', name: 'Carlos', goal: 'Return to running', stage: 'discovery_booked', next: 'Prepare for the discovery session', deep: { tab: 'prac-bookings' } },
  { id: 'j4', name: 'Lucia', goal: 'Nutrition reset', stage: 'active_journey', next: 'Check in on week-2 progress', deep: { tab: 'communications', sub: 'messages' } },
  { id: 'j5', name: 'Ana', goal: 'Mobility after injury', stage: 'review_due', next: 'Draft a journey review for approval', deep: { tab: 'prac-clients' } },
  { id: 'j6', name: 'Pablo', goal: 'Habit building', stage: 'paused', next: 'Confirm whether to resume or close', deep: { tab: 'prac-clients' } },
  { id: 'j7', name: 'Sofia', goal: 'Post-program maintenance', stage: 'completed', next: 'Offer an optional maintenance plan', deep: { tab: 'prac-clients' } },
  { id: 'j8', name: 'Mateo', goal: 'General wellness', stage: 'new_inquiry', next: 'Review the inquiry and send a welcome note', deep: { tab: 'communications', sub: 'messages' } },
];

function deepLink(deep) {
  if (!deep) return;
  window.dispatchEvent(new CustomEvent('solaris:navigate', { detail: deep }));
}

export default function JourneyPipeline() {
  const [q, setQ] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [confirm, setConfirm] = useState(null); // the action awaiting practitioner confirmation

  const rows = FLAG ? FIXTURES : [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (stageFilter !== 'all' && r.stage !== stageFilter) return false;
      if (!needle) return true;
      return r.name.toLowerCase().includes(needle) || r.goal.toLowerCase().includes(needle);
    });
  }, [rows, q, stageFilter]);

  const counts = useMemo(() => {
    const m = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, 0]));
    rows.forEach((r) => { if (m[r.stage] != null) m[r.stage] += 1; });
    return m;
  }, [rows]);

  return (
    <div className="jp" data-testid="journey-pipeline">
      <div className="jp-head" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Journey Pipeline</h3>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#8a6d3b', background: '#fbf3df', border: '1px solid #ecd9a6', borderRadius: 999, padding: '2px 9px' }}>Beta preview · Simulated</span>
      </div>
      <p className="tiny muted" style={{ marginTop: 0 }}>
        An operations board — who needs a human touch next. It never infers a diagnosis or outcome from a stage, and every action below waits for your explicit confirmation.
      </p>

      {/* Stage count cards */}
      <div className="jp-counts" role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, margin: '12px 0' }}>
        {PIPELINE_STAGES.map((s) => {
          const Icon = s.icon;
          const on = stageFilter === s.id;
          return (
            <button
              key={s.id}
              role="listitem"
              type="button"
              onClick={() => setStageFilter(on ? 'all' : s.id)}
              aria-pressed={on}
              style={{ textAlign: 'left', cursor: 'pointer', border: `1px solid ${on ? s.color : 'var(--line,#e3ece8)'}`, background: on ? `${s.color}14` : '#fff', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: s.color }}>
                <Icon size={14} /> {s.label}
              </span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{counts[s.id]}</span>
            </button>
          );
        })}
      </div>

      {/* Search + clear filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line,#e3ece8)', borderRadius: 10, padding: '7px 10px' }}>
          <Search size={15} className="muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or goal…" aria-label="Search pipeline" style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13.5, background: 'transparent' }} />
        </div>
        {stageFilter !== 'all' && (
          <button type="button" className="tiny" onClick={() => setStageFilter('all')} style={{ cursor: 'pointer', border: '1px solid var(--line,#e3ece8)', background: '#fff', borderRadius: 10, padding: '7px 10px' }}>Clear filter</button>
        )}
      </div>

      {/* Stage cards / rows */}
      {!FLAG && (
        <div className="jp-empty" style={{ padding: 18, border: '1px dashed var(--line,#e3ece8)', borderRadius: 12, textAlign: 'center' }}>
          <Info size={18} className="muted" />
          <div className="tiny muted" style={{ marginTop: 6 }}>The Journey Pipeline is a Beta foundation. Turn on the Clinic OS Beta preview to explore the simulated board.</div>
        </div>
      )}
      {FLAG && filtered.length === 0 && (
        <div className="jp-empty" style={{ padding: 18, border: '1px dashed var(--line,#e3ece8)', borderRadius: 12, textAlign: 'center' }}>
          <div className="tiny muted">No journeys match this view.</div>
        </div>
      )}
      {FLAG && filtered.length > 0 && (
        <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((r) => {
            const stage = PIPELINE_STAGES.find((s) => s.id === r.stage);
            const Icon = stage.icon;
            return (
              <div key={r.id} role="listitem" style={{ border: '1px solid var(--line,#e3ece8)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{r.name}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: stage.color, background: `${stage.color}14`, borderRadius: 999, padding: '2px 9px' }}>
                    <Icon size={12} /> {stage.label}
                  </span>
                </div>
                <div className="tiny muted">Goal: {r.goal}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  <span className="tiny" style={{ color: 'var(--ink)' }}><b>Next:</b> {r.next}</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="tiny" onClick={() => deepLink(r.deep)} style={{ cursor: 'pointer', border: '1px solid var(--line,#e3ece8)', background: '#fff', borderRadius: 9, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    Open <ArrowRight size={13} />
                  </button>
                  <button type="button" className="tiny" onClick={() => setConfirm(r)} style={{ cursor: 'pointer', border: 'none', background: stage.color, color: '#04231d', fontWeight: 700, borderRadius: 9, padding: '6px 10px' }}>
                    Confirm next action
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Human-in-the-loop confirmation — nothing changes or sends without this. */}
      {confirm && (
        <div role="dialog" aria-modal="true" aria-label="Confirm action" onClick={() => setConfirm(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,35,29,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 18, maxWidth: 380, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <b style={{ fontSize: 15 }}>Confirm this action</b>
              <span style={{ flex: 1 }} />
              <button type="button" aria-label="Close" onClick={() => setConfirm(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p className="tiny" style={{ marginTop: 0 }}>You are about to take this step for <b>{confirm.name}</b>:</p>
            <p style={{ fontSize: 13.5, fontWeight: 600 }}>{confirm.next}</p>
            <p className="tiny muted">In this Beta preview nothing is sent, moved, or recorded — this simply confirms that stage changes and outreach always require your explicit approval.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="tiny" onClick={() => setConfirm(null)} style={{ cursor: 'pointer', border: '1px solid var(--line,#e3ece8)', background: '#fff', borderRadius: 9, padding: '7px 12px' }}>Cancel</button>
              <button type="button" className="tiny" onClick={() => { deepLink(confirm.deep); setConfirm(null); }} style={{ cursor: 'pointer', border: 'none', background: '#2DB584', color: '#04231d', fontWeight: 700, borderRadius: 9, padding: '7px 12px' }}>Confirm & open</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
