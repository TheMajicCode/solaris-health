// PersonalizedJourneySheet.jsx — Node K1 §B
//
// A mobile-safe progressive sheet that lets a member co-design a Personalized
// Journey with LUCA. It:
//   • prefills known profile answers but lets the member edit them;
//   • collects only what is needed (focus areas, challenges, outcomes, cadence,
//     setting/travel, accessibility, language, notifications);
//   • asks LUCA to build a DRAFT with concise Daily / Weekly / Monthly views and
//     the assumptions used;
//   • lets the member edit the draft;
//   • starts / saves NOTHING until the member selects "Approve & Begin";
//   • on approval hands the exact approved draft to the caller, which surfaces it
//     under Communications → Growth. Cancel creates nothing.
//
// Persistence is LOCAL/session only (AppContext.setApprovedJourney) because the
// shared beta DB is read-only this sprint and current journey APIs persist only
// predefined journey types — this limitation is labeled honestly in the UI.
// LUCA may organize, educate, draft, and suggest; it must not diagnose,
// prescribe, order a lab, or make a clinical decision.

import React, { useMemo, useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import AdaptiveOverlay from '../ui/AdaptiveOverlay.jsx';
import {
  FOCUS_AREAS, PACES, DEFAULT_JOURNEY_INPUT, buildJourneyDraft,
} from '../../lib/journeyDraft.js';

const SETTINGS = [
  { id: 'virtual', label: 'Virtual' },
  { id: 'in_person', label: 'In-person' },
  { id: 'either', label: 'Either' },
];
const NOTIFY = [
  { id: 'off', label: 'Off' },
  { id: 'gentle', label: 'Gentle' },
  { id: 'daily', label: 'Daily' },
];

function Field({ label, hint, children }) {
  return (
    <label className="pj-field" style={{ display: 'block', marginBottom: 16 }}>
      <span className="small f6" style={{ display: 'block', marginBottom: 6, color: 'var(--ink)' }}>{label}</span>
      {hint ? <span className="tiny muted" style={{ display: 'block', marginBottom: 6, lineHeight: 1.5 }}>{hint}</span> : null}
      {children}
    </label>
  );
}

function Chips({ options, value, onToggle, multi = true, ariaLabel }) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const id = o.id || o;
        const label = o.label || o;
        const active = multi ? value.includes(id) : value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(id)}
            style={{
              minHeight: 44, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${active ? 'var(--teal, #0E5C57)' : 'var(--line)'}`,
              background: active ? 'var(--teal, #0E5C57)' : '#fff',
              color: active ? '#E7F8F3' : 'var(--ink)', fontSize: 13.5, fontWeight: 600,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--line)', fontSize: 14, fontFamily: 'inherit', background: '#fff',
};

export default function PersonalizedJourneySheet({ open, onClose, profile, locale = 'en', onApprove }) {
  // profile may arrive as null (not just undefined) before the app profile
  // loads, so a plain default param is not enough — guard explicitly.
  const p = profile || {};
  const [step, setStep] = useState(0); // 0 focus, 1 cadence, 2 prefs, 3 review
  const [input, setInput] = useState(() => ({
    ...DEFAULT_JOURNEY_INPUT,
    // Prefill known profile answers — the member can still edit everything.
    focusAreas: Array.isArray(p.focus_areas) ? p.focus_areas.filter((a) => FOCUS_AREAS.includes(a)) : [],
    language: locale || DEFAULT_JOURNEY_INPUT.language,
    accessibility: p.accessibility || '',
    travel: p.city ? `Near ${p.city}` : '',
  }));
  const [approved, setApproved] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);

  const draft = useMemo(() => buildJourneyDraft(input), [input]);

  if (!open) return null;

  const set = (patch) => setInput((v) => ({ ...v, ...patch }));
  const toggleFocus = (a) => set({
    focusAreas: input.focusAreas.includes(a)
      ? input.focusAreas.filter((x) => x !== a)
      : [...input.focusAreas, a],
  });
  const toggleRhythm = (k) => set({ rhythm: { ...input.rhythm, [k]: !input.rhythm[k] } });

  const steps = ['Focus', 'Cadence', 'Preferences', 'Review'];
  const isReview = step === 3;

  const approve = () => {
    setApproved(true);
    onApprove?.({
      ...draft,
      input,
      approvedAt: Date.now(),
    });
  };

  const footer = isReview ? (
    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
      <button type="button" onClick={() => setStep(2)} style={{ ...secondaryBtn }}>
        <ArrowLeft size={15} /> Back
      </button>
      <button type="button" onClick={approve} disabled={approved} style={{ ...primaryBtn, flex: 1 }}>
        {approved ? <>Approved <Check size={15} /></> : <>Approve &amp; Begin <ArrowRight size={15} /></>}
      </button>
    </div>
  ) : (
    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
      {step > 0 && (
        <button type="button" onClick={() => setStep(step - 1)} style={{ ...secondaryBtn }}>
          <ArrowLeft size={15} /> Back
        </button>
      )}
      <button type="button" onClick={() => setStep(step + 1)} style={{ ...primaryBtn, flex: 1 }}>
        Next <ArrowRight size={15} />
      </button>
    </div>
  );

  return (
    <AdaptiveOverlay
      open
      onClose={onClose}
      title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Sparkles size={17} /> Personalized Journey</span>}
      ariaLabel="Personalized Journey"
      size="md"
      footer={footer}
    >
      {/* progress */}
      <div aria-hidden="true" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? 'var(--teal, #0E5C57)' : 'var(--line)' }} />
        ))}
      </div>
      <div className="tiny muted" style={{ marginBottom: 14 }}>Step {step + 1} of 4 · {steps[step]}</div>

      {step === 0 && (
        <div data-testid="pj-step-focus">
          <Field label="Which areas do you want to focus on?" hint="Mind, Body, Heart, Spirit — choose any.">
            <Chips options={FOCUS_AREAS} value={input.focusAreas} onToggle={toggleFocus} ariaLabel="Focus areas" />
          </Field>
          <Field label="What are you working through right now?" hint="In your own words — LUCA will not diagnose.">
            <textarea rows={3} style={inputStyle} value={input.challenges}
              onChange={(e) => set({ challenges: e.target.value })} placeholder="e.g. stress and poor sleep" />
          </Field>
          <Field label="What would feel like progress?" hint="Your desired wellness outcomes.">
            <textarea rows={3} style={inputStyle} value={input.outcomes}
              onChange={(e) => set({ outcomes: e.target.value })} placeholder="e.g. steadier energy and calmer evenings" />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div data-testid="pj-step-cadence">
          <Field label="Minutes available per day">
            <input type="number" min={5} max={120} step={5} style={inputStyle} value={input.minutesPerDay}
              onChange={(e) => set({ minutesPerDay: e.target.value })} />
          </Field>
          <Field label="Preferred days per week">
            <input type="number" min={1} max={7} style={inputStyle} value={input.daysPerWeek}
              onChange={(e) => set({ daysPerWeek: e.target.value })} />
          </Field>
          <Field label="Pace">
            <Chips options={PACES.map((p) => ({ id: p, label: p[0].toUpperCase() + p.slice(1) }))}
              value={input.pace} onToggle={(id) => set({ pace: id })} multi={false} ariaLabel="Pace" />
          </Field>
          <Field label="Start date">
            <input type="date" style={inputStyle} value={input.startDate}
              onChange={(e) => set({ startDate: e.target.value })} />
          </Field>
          <Field label="Rhythm to include">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['daily', 'weekly', 'monthly'].map((k) => (
                <button key={k} type="button" aria-pressed={!!input.rhythm[k]} onClick={() => toggleRhythm(k)}
                  style={{
                    minHeight: 44, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                    border: `1px solid ${input.rhythm[k] ? 'var(--teal, #0E5C57)' : 'var(--line)'}`,
                    background: input.rhythm[k] ? 'var(--teal, #0E5C57)' : '#fff',
                    color: input.rhythm[k] ? '#E7F8F3' : 'var(--ink)', fontSize: 13.5, fontWeight: 600,
                    textTransform: 'capitalize',
                  }}>
                  {k}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div data-testid="pj-step-prefs">
          <Field label="Session setting">
            <Chips options={SETTINGS} value={input.setting} onToggle={(id) => set({ setting: id })} multi={false} ariaLabel="Session setting" />
          </Field>
          <Field label="Location / travel preference">
            <input type="text" style={inputStyle} value={input.travel}
              onChange={(e) => set({ travel: e.target.value })} placeholder="e.g. within 10 miles, or remote only" />
          </Field>
          <Field label="Open to practitioners or clinician-reviewed network services?">
            <Chips options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'Not now' }]}
              value={input.openToPractitioners ? 'yes' : 'no'} onToggle={(id) => set({ openToPractitioners: id === 'yes' })}
              multi={false} ariaLabel="Openness to practitioners" />
          </Field>
          <Field label="Accessibility needs" hint="Anything LUCA should keep in mind.">
            <input type="text" style={inputStyle} value={input.accessibility}
              onChange={(e) => set({ accessibility: e.target.value })} placeholder="optional" />
          </Field>
          <Field label="Language preference">
            <Chips options={[{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }]}
              value={input.language} onToggle={(id) => set({ language: id })} multi={false} ariaLabel="Language preference" />
          </Field>
          <Field label="Notifications">
            <Chips options={NOTIFY} value={input.notify} onToggle={(id) => set({ notify: id })} multi={false} ariaLabel="Notification preference" />
          </Field>
        </div>
      )}

      {isReview && (
        <div data-testid="pj-step-review">
          <div className="small muted" style={{ marginBottom: 12, lineHeight: 1.55 }}>
            LUCA drafted this from your answers. Nothing starts until you approve. You can edit anything.
          </div>
          {draft.views.map((v) => (
            <div key={v.cadence} className="card flat" style={{ padding: 14, marginBottom: 10, background: 'var(--surface-2, #f5faf7)' }}>
              <div className="f6" style={{ marginBottom: 6 }}>{v.title}</div>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
                {v.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          ))}
          <div className="card flat" style={{ padding: 14, marginBottom: 10, background: '#FBF7EA', border: '1px solid var(--gold-line, #ecd9a8)' }}>
            <div className="f6" style={{ marginBottom: 6 }}>Assumptions LUCA used</div>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
              {draft.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
            <button type="button" onClick={() => setStep(0)} style={{ ...linkBtn, marginTop: 8 }}>Edit my answers</button>
          </div>
          <div className="tiny muted" style={{ lineHeight: 1.5 }}>
            {draft.source}. Saved to your device for this Beta — appears under Communications → Growth after you approve.
            LUCA suggests only; it never diagnoses, prescribes, books, or spends.
          </div>
        </div>
      )}
    </AdaptiveOverlay>
  );
}

const primaryBtn = {
  minHeight: 44, padding: '10px 16px', borderRadius: 12, cursor: 'pointer', border: 'none',
  background: 'var(--teal, #0E5C57)', color: '#E7F8F3', fontSize: 14, fontWeight: 700,
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center',
};
const secondaryBtn = {
  minHeight: 44, padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
  border: '1px solid var(--line)', background: '#fff', color: 'var(--ink)', fontSize: 14, fontWeight: 600,
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center',
};
const linkBtn = {
  border: 'none', background: 'none', color: 'var(--teal, #0E5C57)', cursor: 'pointer',
  fontSize: 13, fontWeight: 700, padding: 0, textDecoration: 'underline',
};
