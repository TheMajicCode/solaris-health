import React, { useMemo, useState } from 'react';

/**
 * PractitionerLucaCopilot.jsx  — Node J
 *
 * A role-aware practice brief + draft toolkit for the practitioner LUCA copilot.
 * It uses the existing practitioner-specific LUCA endpoint (api.getPractitionerLucaMessages /
 * sendPractitionerLucaMessage) for the conversational surface; this component adds the
 * structured brief and draft tools on top.
 *
 * Brief surfaces (each line names its SOURCE and opens an EXACT destination — nothing
 * auto-executes; every action is a navigation the practitioner initiates):
 *   • Today's + upcoming bookings          • Intake status
 *   • Journey Pipeline movement            • Review-due
 *   • Unanswered messages                  • Follow-ups
 *   • Listing / availability completeness   • Next admin actions
 *
 * Draft tools (all marked "Draft", editable, and NEVER sent / signed / published /
 * booked / ordered without explicit practitioner approval):
 *   intake reminder · booking confirmation & follow-up · welcome note · visit-prep ·
 *   after-visit summary · referral-note outline · task checklist · journey review.
 *
 * LUCA never generates diagnosis, prescription, legal, billing, or lab-order content,
 * and never fabricates facts — drafts contain only [placeholders] the practitioner fills.
 *
 * Persistence: shared beta DB is read-only this sprint, so the brief runs on a
 * deterministic feature-flagged fixture labeled "Beta preview · Simulated"; the future
 * additive persistence contract is backend/migrations/042_practitioner_copilot.sql
 * (committed, NOT applied).
 */

export const LUCA_COPILOT_SIMULATED =
  (import.meta?.env?.VITE_LUCA_COPILOT_SIMULATED === 'true');

export const COPILOT_ALGO_VERSION = 'luca-copilot-v1-brief';

// Deterministic non-PHI brief fixture. Each item names a source + an exact destination
// (tab/sub the shell can navigate to). No PHI beyond a first name is included.
// RC1 item6 — every destination is a REAL practitioner-portal route id that the
// shell can resolve (my-practice / prac-clients / prac-bookings / prac-availability
// / prac-messages). The former non-existent "practice" tab shape silently
// no-op'd. Opening a row only navigates — nothing is executed.
const BRIEF_ITEMS = [
  { id: 'today', source: 'Bookings', label: "Today: 2 sessions (next at 2:00 PM)", dest: { tab: 'prac-bookings' } },
  { id: 'upcoming', source: 'Bookings', label: '5 upcoming this week', dest: { tab: 'prac-bookings' } },
  { id: 'intake', source: 'Intake', label: '1 intake pending review (Maria)', dest: { tab: 'prac-clients' } },
  { id: 'pipeline', source: 'Journey Pipeline', label: '2 clients moved to Discovery booked', dest: { tab: 'prac-clients' } },
  { id: 'review', source: 'Pipeline', label: '1 review due', dest: { tab: 'prac-clients' } },
  { id: 'messages', source: 'Messages', label: '3 unanswered messages', dest: { tab: 'prac-messages' } },
  { id: 'followups', source: 'Follow-ups', label: '2 follow-ups scheduled', dest: { tab: 'prac-bookings' } },
  { id: 'listing', source: 'Listing', label: 'Listing 80% complete — add availability', dest: { tab: 'prac-availability' } },
  { id: 'admin', source: 'Admin', label: 'Next: confirm 1 booking request', dest: { tab: 'prac-bookings' } },
];

// Draft templates. Bodies contain only [placeholders] — LUCA fabricates no facts.
const DRAFT_TOOLS = [
  { id: 'intake_reminder', label: 'Intake reminder', body: 'Hi [first name], a friendly reminder to complete your intake before our session on [date]. It helps me prepare. — [your name]' },
  { id: 'booking_followup', label: 'Booking confirmation & follow-up', body: 'Hi [first name], your session is confirmed for [date/time]. Here is how to prepare: [notes]. See you then. — [your name]' },
  { id: 'welcome', label: 'Welcome note', body: 'Welcome to my practice, [first name]. I look forward to supporting your journey. A few things to know: [details].' },
  { id: 'visit_prep', label: 'Visit-prep', body: 'Before our visit on [date], it would help to have: [items]. Nothing else is required.' },
  { id: 'after_visit', label: 'After-visit summary', body: 'Summary of our session on [date]: we discussed [topics]. Suggested next steps you agreed to: [steps]. This is not medical advice or a diagnosis.' },
  { id: 'referral_outline', label: 'Referral-note outline', body: 'Referral outline (for your review, not a clinical determination): reason [reason]; suggested type of provider [type]; notes [notes].' },
  { id: 'task_checklist', label: 'Task checklist', body: 'Practice tasks: [ ] [task 1] [ ] [task 2] [ ] [task 3].' },
  { id: 'journey_review', label: 'Journey review', body: 'Journey review for [first name]: progress observed [observations]; open questions [questions]; proposed next human-approved step [step].' },
];

function BriefRow({ item, onOpen }) {
  return (
    <div className="copilot-brief-row" data-testid="copilot-brief-row"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ minWidth: 0 }}>
        <div className="f7" style={{ color: 'var(--ink)' }}>{item.label}</div>
        <div className="f8" style={{ color: 'var(--muted)' }}>Source: {item.source}</div>
      </div>
      <button type="button" onClick={() => onOpen(item)} aria-label={`Open ${item.source}: ${item.label}`}>Open</button>
    </div>
  );
}

function DraftTool({ tool, onApprove }) {
  const [text, setText] = useState(tool.body);
  const [approved, setApproved] = useState(false);
  return (
    <div className="copilot-draft" data-testid="copilot-draft" data-tool-id={tool.id}
      style={{ border: '1px dashed var(--line)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong className="f7">{tool.label}</strong>
        <span className="f8" style={{ color: 'var(--muted)' }}>Draft · not sent</span>
      </div>
      <textarea
        aria-label={`${tool.label} draft`}
        value={text}
        onChange={(e) => { setText(e.target.value); setApproved(false); }}
        rows={3}
        style={{ width: '100%', marginTop: 8, fontSize: 13 }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button type="button" aria-label={`Approve ${tool.label} draft`}
          onClick={() => { setApproved(true); onApprove?.(tool.id, text); }}>
          {approved ? 'Approved (ready for you to send)' : 'Approve draft'}
        </button>
        <span className="f8" style={{ color: 'var(--muted)' }}>
          Editable · never sent, signed, or published without you
        </span>
      </div>
    </div>
  );
}

export default function PractitionerLucaCopilot({ user = {}, onNavigate }) {
  const [tab, setTab] = useState('brief'); // brief | drafts
  const brief = useMemo(() => BRIEF_ITEMS, []);

  if (!LUCA_COPILOT_SIMULATED) {
    return (
      <div className="copilot-brief-off" data-testid="copilot-brief-off" style={{ padding: 12 }}>
        <p className="f8" style={{ color: 'var(--muted)' }}>
          LUCA practice brief is a Beta preview. Enable it with VITE_LUCA_COPILOT_SIMULATED
          to see today&apos;s brief and draft tools.
        </p>
      </div>
    );
  }

  const open = (item) => {
    // Navigation the practitioner initiates — nothing auto-executes.
    if (onNavigate) onNavigate(item.dest);
    else window.dispatchEvent(new CustomEvent('solaris:navigate', { detail: item.dest }));
  };

  return (
    <div className="copilot-brief" data-testid="copilot-brief" style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong className="f6">Your practice brief</strong>
        <span className="f8" style={{ color: 'var(--muted)' }}>Beta preview · Simulated</span>
      </div>
      <div role="tablist" aria-label="Copilot sections" style={{ display: 'flex', gap: 8 }}>
        <button type="button" role="tab" aria-selected={tab === 'brief'} onClick={() => setTab('brief')}>Brief</button>
        <button type="button" role="tab" aria-selected={tab === 'drafts'} onClick={() => setTab('drafts')}>Draft tools</button>
      </div>

      {tab === 'brief' ? (
        <div>
          {brief.map((item) => <BriefRow key={item.id} item={item} onOpen={open} />)}
          <p className="f8" style={{ color: 'var(--muted)', marginTop: 8 }}>
            Every suggestion names its source and opens the exact place to act. LUCA suggests
            only — it never books, sends, orders, or signs anything.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {DRAFT_TOOLS.map((tool) => <DraftTool key={tool.id} tool={tool} />)}
          <p className="f8" style={{ color: 'var(--muted)' }}>
            Drafts never contain diagnosis, prescription, legal, billing, or lab-order content,
            and are never sent, signed, or published without your approval.
          </p>
        </div>
      )}
    </div>
  );
}
