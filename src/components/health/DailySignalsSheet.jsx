// DailySignalsSheet — Preview Correction §10 / §11 / §12
//
// A SEPARATE sheet, titled "Log daily signals", that is opened by the Daily
// Signals card's "Log" button. It must NEVER open the Daily Check-in (the
// subjective Mind/Body/Heart/Spirit reflection) — the two are distinct: the
// check-in captures how you FEEL, this captures OBSERVED measurements.
//
// Quick Log: sleep duration + quality, steps, activity type + minutes (+optional
// intensity), resting heart rate, hydration + unit, energy, mood, stress.
// "More signals" (collapsed by default): respiratory rate, blood pressure, SpO2,
// body temperature, weight, and an optional symptom / note.
//
// The member may save ONE or SEVERAL fields — nothing is required. Values are
// written to the versioned, user-scoped, device-local observation store
// (dailySignals.js) and a `solaris:signals` event is dispatched so the card
// updates immediately without a reload.
//
// Safety (standing instructions): guidance is NON-DIAGNOSTIC self-measurement
// help only. Out-of-range entries get a calm, non-alarming note — never a
// diagnosis. LUCA does not diagnose. The optional note is stored on-device only
// and is NEVER auto-sent to any AI provider.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Moon, Footprints, HeartPulse, Droplet, Zap, Smile, Activity, Wind,
  Gauge, Thermometer, Scale, Info, Check, PlusCircle, Watch,
} from 'lucide-react';
import AdaptiveOverlay from '../ui/AdaptiveOverlay.jsx';
import toast from 'react-hot-toast';
import { saveSignals } from '../../lib/dailySignals.js';

// ── Metric metadata — the single source of truth shared with the card ────────
// Each entry: { key, label, unit, icon }. `key` is the stored observation
// `metric`. Composite metrics (blood pressure) are handled specially on save.
export const SIGNAL_METRICS = {
  sleep_hours: { key: 'sleep_hours', label: 'Sleep', unit: 'h', digits: 1, icon: Moon },
  sleep_quality: { key: 'sleep_quality', label: 'Sleep quality', unit: '/5', icon: Moon },
  steps: { key: 'steps', label: 'Steps', unit: '', icon: Footprints },
  activity_minutes: { key: 'activity_minutes', label: 'Activity', unit: 'min', icon: Activity },
  resting_hr: { key: 'resting_hr', label: 'Resting HR', unit: 'BPM', icon: HeartPulse },
  hydration: { key: 'hydration', label: 'Hydration', unit: '', icon: Droplet },
  energy: { key: 'energy', label: 'Energy', unit: '/10', icon: Zap },
  mood: { key: 'mood', label: 'Mood', unit: '/10', icon: Smile },
  stress: { key: 'stress', label: 'Stress', unit: '/10', icon: Activity },
  respiratory_rate: { key: 'respiratory_rate', label: 'Respiratory rate', unit: '/min', icon: Wind },
  blood_pressure: { key: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg', icon: Gauge },
  spo2: { key: 'spo2', label: 'SpO₂', unit: '%', icon: Gauge },
  body_temp: { key: 'body_temp', label: 'Temperature', unit: '°', icon: Thermometer },
  weight: { key: 'weight', label: 'Weight', unit: '', icon: Scale },
};

// Plausibility ranges → a CALM, non-diagnostic note when clearly outside. These
// never block saving and never diagnose; they simply invite care.
const SAFETY = {
  resting_hr: { min: 25, max: 220, gentleLow: 40, gentleHigh: 130 },
  spo2: { min: 50, max: 100, gentleLow: 90, gentleHigh: 100 },
  respiratory_rate: { min: 3, max: 60, gentleLow: 6, gentleHigh: 30 },
  bp_sys: { min: 60, max: 260, gentleLow: 85, gentleHigh: 180 },
  bp_dia: { min: 30, max: 160, gentleLow: 50, gentleHigh: 120 },
  body_temp_c: { min: 30, max: 45, gentleLow: 35, gentleHigh: 38 },
  body_temp_f: { min: 86, max: 113, gentleLow: 95, gentleHigh: 100.4 },
};

const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

// ── Future device adapters (§12) — TRUTHFUL boundary, no active sync ─────────
// This is an adapter-ready boundary only. The PWA does NOT have direct native
// HealthKit / Health Connect access; nothing here syncs today.
export const DEVICE_ADAPTERS = [
  { id: 'health_connect', label: 'Android Health Connect', note: 'Planned via a future native adapter' },
  { id: 'apple_health', label: 'Apple HealthKit / Watch', note: 'Planned via a future native iOS app' },
  { id: 'oura', label: 'Oura', note: 'Planned via the Oura API' },
  { id: 'garmin', label: 'Garmin', note: 'Planned via the Garmin Health API' },
  { id: 'fitbit_google', label: 'Fitbit / Google', note: 'Planned after API validation' },
  { id: 'other', label: 'Other devices', note: 'Via documented, consented adapters' },
];

function Field({ label, hint, children }) {
  return (
    <div className="dss-field">
      <div className="dss-label">{label}</div>
      {hint ? <div className="dss-hint">{hint}</div> : null}
      <div className="dss-control">{children}</div>
    </div>
  );
}

export default function DailySignalsSheet({ open, onClose, uid, onSaved }) {
  const [f, setF] = useState({});
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setF({}); setMore(false); setSaving(false); }
  }, [open]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  // Calm, non-diagnostic safety notes for anything clearly out of range.
  const notes = useMemo(() => {
    const out = [];
    const check = (val, range, label) => {
      const n = numOrNull(val);
      if (n === null || !range) return;
      if (n < range.gentleLow || n > range.gentleHigh) {
        out.push(`${label} looks outside the usual range. If you feel unwell, consider checking with a health professional — LUCA can't diagnose.`);
      }
    };
    check(f.resting_hr, SAFETY.resting_hr, 'Resting heart rate');
    check(f.spo2, SAFETY.spo2, 'SpO₂');
    check(f.respiratory_rate, SAFETY.respiratory_rate, 'Respiratory rate');
    check(f.bp_sys, SAFETY.bp_sys, 'Blood pressure (systolic)');
    check(f.bp_dia, SAFETY.bp_dia, 'Blood pressure (diastolic)');
    if (numOrNull(f.body_temp) !== null) {
      const range = f.temp_unit === 'F' ? SAFETY.body_temp_f : SAFETY.body_temp_c;
      check(f.body_temp, range, 'Temperature');
    }
    return out;
  }, [f]);

  if (!open) return null;

  const buildInputs = () => {
    const inputs = [];
    const push = (metric, value, unit) => {
      const n = numOrNull(value);
      if (n !== null) inputs.push({ metric, value: n, unit: unit || null });
    };
    push('sleep_hours', f.sleep_hours, 'h');
    push('sleep_quality', f.sleep_quality, '/5');
    push('steps', f.steps, 'steps');
    push('activity_minutes', f.activity_minutes, 'min');
    // Activity type + intensity ride along as provenance on the minutes reading.
    if (numOrNull(f.activity_minutes) !== null && (f.activity_type || f.activity_intensity)) {
      const last = inputs[inputs.length - 1];
      last.provenance = {
        entry: 'manual',
        activityType: f.activity_type || null,
        intensity: f.activity_intensity || null,
      };
    }
    push('resting_hr', f.resting_hr, 'BPM');
    push('hydration', f.hydration, f.hydration_unit || 'glasses');
    push('energy', f.energy, '/10');
    push('mood', f.mood, '/10');
    push('stress', f.stress, '/10');
    // More signals
    push('respiratory_rate', f.respiratory_rate, '/min');
    if (numOrNull(f.bp_sys) !== null && numOrNull(f.bp_dia) !== null) {
      inputs.push({
        metric: 'blood_pressure',
        value: `${numOrNull(f.bp_sys)}/${numOrNull(f.bp_dia)}`,
        unit: 'mmHg',
      });
    }
    push('spo2', f.spo2, '%');
    push('body_temp', f.body_temp, `°${f.temp_unit || 'C'}`);
    push('weight', f.weight, f.weight_unit || 'kg');
    // Optional symptom/note — stored on-device only, attached as a note to a
    // lightweight "symptom" observation so it is never lost or auto-sent to AI.
    if (f.note && f.note.trim()) {
      inputs.push({ metric: 'note', value: 1, unit: null, note: f.note.trim() });
    }
    return inputs;
  };

  const save = async () => {
    const inputs = buildInputs();
    if (!inputs.length) { toast.error('Add at least one signal to log.'); return; }
    setSaving(true);
    try {
      saveSignals(uid, inputs);
      window.dispatchEvent(new CustomEvent('solaris:signals'));
      onSaved?.(inputs);
      toast.success(inputs.length > 1 ? `${inputs.length} signals logged` : 'Signal logged');
      onClose?.();
    } catch (e) {
      toast.error(e?.message || 'Could not save your signals.');
      setSaving(false);
    }
  };

  const numInput = (k, placeholder, extra = {}) => (
    <input
      type="number" inputMode="decimal" value={f[k] ?? ''} placeholder={placeholder}
      onChange={(e) => set(k, e.target.value)} className="dss-input" {...extra}
    />
  );

  return (
    <AdaptiveOverlay
      open
      onClose={() => { if (!saving) onClose?.(); }}
      dismissable={!saving}
      title="Log daily signals"
      ariaLabel="Log daily signals"
      size="md"
      footer={(
        <button type="button" className="dss-save" onClick={save} disabled={saving}>
          <Check size={16} strokeWidth={2.6} /> {saving ? 'Saving…' : 'Save signals'}
        </button>
      )}
    >
      <div className="dss">
        <p className="dss-intro">
          Record what you observed today. Log as few or as many as you like —
          nothing is required. These are your measurements, kept separate from how
          you feel in your Daily Check-in.
        </p>

        <div className="dss-sec">Quick log</div>

        <div className="dss-grid">
          <Field label="Sleep (hours)"><div className="dss-inline">{numInput('sleep_hours', '7.5', { min: 0, max: 24, step: 0.5 })}<span className="dss-unit">h</span></div></Field>
          <Field label="Sleep quality">
            <select className="dss-input" value={f.sleep_quality ?? ''} onChange={(e) => set('sleep_quality', e.target.value)}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
            </select>
          </Field>
          <Field label="Steps"><div className="dss-inline">{numInput('steps', '6000', { min: 0, max: 100000, step: 1 })}</div></Field>
          <Field label="Resting heart rate" hint="Sit quietly, then count your pulse for 60 seconds.">
            <div className="dss-inline">{numInput('resting_hr', '62', { min: 25, max: 220, step: 1 })}<span className="dss-unit">BPM</span></div>
          </Field>
        </div>

        <Field label="Activity / exercise">
          <div className="dss-inline dss-wrap">
            <input type="text" className="dss-input" placeholder="e.g. walk, yoga" value={f.activity_type ?? ''} onChange={(e) => set('activity_type', e.target.value)} />
            {numInput('activity_minutes', 'min', { min: 0, max: 1440, step: 1 })}
            <span className="dss-unit">min</span>
            <select className="dss-input" value={f.activity_intensity ?? ''} onChange={(e) => set('activity_intensity', e.target.value)}>
              <option value="">Intensity (optional)</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="vigorous">Vigorous</option>
            </select>
          </div>
        </Field>

        <Field label="Hydration">
          <div className="dss-inline dss-wrap">
            {numInput('hydration', '6', { min: 0, max: 400, step: 1 })}
            <select className="dss-input" value={f.hydration_unit ?? 'glasses'} onChange={(e) => set('hydration_unit', e.target.value)}>
              <option value="glasses">glasses</option>
              <option value="ml">ml</option>
              <option value="oz">oz</option>
            </select>
          </div>
        </Field>

        <div className="dss-grid">
          <Field label="Energy">
            <select className="dss-input" value={f.energy ?? ''} onChange={(e) => set('energy', e.target.value)}>
              <option value="">—</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} / 10</option>)}
            </select>
          </Field>
          <Field label="Mood">
            <select className="dss-input" value={f.mood ?? ''} onChange={(e) => set('mood', e.target.value)}>
              <option value="">—</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} / 10</option>)}
            </select>
          </Field>
          <Field label="Stress">
            <select className="dss-input" value={f.stress ?? ''} onChange={(e) => set('stress', e.target.value)}>
              <option value="">—</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} / 10</option>)}
            </select>
          </Field>
        </div>

        <button type="button" className="dss-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <PlusCircle size={15} /> {more ? 'Hide extra signals' : 'More signals'}
        </button>

        {more && (
          <div className="dss-moreblock">
            <Field label="Respiratory rate" hint="Count natural breaths for 60 seconds — don't change your breathing.">
              <div className="dss-inline">{numInput('respiratory_rate', '14', { min: 3, max: 60, step: 1 })}<span className="dss-unit">/min</span></div>
            </Field>
            <Field label="Blood pressure">
              <div className="dss-inline dss-wrap">
                {numInput('bp_sys', 'systolic', { min: 60, max: 260, step: 1 })}
                <span className="dss-unit">/</span>
                {numInput('bp_dia', 'diastolic', { min: 30, max: 160, step: 1 })}
                <span className="dss-unit">mmHg</span>
              </div>
            </Field>
            <div className="dss-grid">
              <Field label="SpO₂"><div className="dss-inline">{numInput('spo2', '98', { min: 50, max: 100, step: 1 })}<span className="dss-unit">%</span></div></Field>
              <Field label="Temperature">
                <div className="dss-inline">
                  {numInput('body_temp', '36.8', { min: 30, max: 113, step: 0.1 })}
                  <select className="dss-input dss-unitsel" value={f.temp_unit ?? 'C'} onChange={(e) => set('temp_unit', e.target.value)}>
                    <option value="C">°C</option><option value="F">°F</option>
                  </select>
                </div>
              </Field>
            </div>
            <Field label="Weight">
              <div className="dss-inline">
                {numInput('weight', '70', { min: 0, max: 700, step: 0.1 })}
                <select className="dss-input dss-unitsel" value={f.weight_unit ?? 'kg'} onChange={(e) => set('weight_unit', e.target.value)}>
                  <option value="kg">kg</option><option value="lb">lb</option>
                </select>
              </div>
            </Field>
            <Field label="Symptom / note (optional)" hint="Kept on this device only. Never sent to LUCA automatically.">
              <textarea className="dss-input dss-textarea" maxLength={300} value={f.note ?? ''} placeholder="Anything you noticed…" onChange={(e) => set('note', e.target.value)} />
            </Field>
          </div>
        )}

        {notes.length > 0 && (
          <div className="dss-safety" role="status">
            <Info size={15} style={{ flex: 'none', marginTop: 1 }} />
            <div>{notes.map((n, i) => <div key={i}>{n}</div>)}</div>
          </div>
        )}

        {/* §12 — device-adapter boundary. Truthful: no sync is active today. */}
        <div className="dss-devices">
          <div className="dss-sec"><Watch size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Connect a device</div>
          <p className="dss-hint">
            Wearable sync is coming. Solaris doesn't read from any device yet — when
            adapters launch you'll connect them here with your consent, and every
            imported reading will keep its source, device, timestamp and consent.
          </p>
          <ul className="dss-devlist">
            {DEVICE_ADAPTERS.map((d) => (
              <li key={d.id}><span className="dss-devname">{d.label}</span><span className="dss-devnote">{d.note}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <style>{CSS}</style>
    </AdaptiveOverlay>
  );
}

const CSS = `
.dss{color:var(--ink)}
.dss-intro{font-size:13px;line-height:1.55;color:var(--muted);margin:2px 0 14px}
.dss-sec{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:12.5px;letter-spacing:.04em;
  text-transform:uppercase;color:var(--muted);margin:14px 0 8px}
.dss-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dss-field{margin-bottom:12px;min-width:0}
.dss-label{font-size:13px;font-weight:600;color:var(--ink);margin-bottom:3px}
.dss-hint{font-size:11.5px;line-height:1.45;color:var(--muted);margin-bottom:6px}
.dss-control{}
.dss-inline{display:flex;align-items:center;gap:8px}
.dss-wrap{flex-wrap:wrap}
.dss-unit{font-size:12.5px;color:var(--muted);flex:none}
.dss-input{min-width:0;width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line);
  background:var(--surface,#fff);font-size:14px;font-family:inherit;color:var(--ink);min-height:44px}
.dss-input:focus{outline:2px solid #2DB584;outline-offset:1px;border-color:#2DB584}
.dss-unitsel{width:auto;flex:none}
.dss-textarea{min-height:72px;resize:vertical}
.dss-more{margin:6px 0 2px;display:inline-flex;align-items:center;gap:6px;background:none;border:none;
  color:#0E5C57;font-weight:600;font-size:13px;cursor:pointer;padding:8px 2px;min-height:44px}
.dss-moreblock{margin-top:8px;padding-top:10px;border-top:1px solid var(--line)}
.dss-safety{display:flex;gap:8px;margin-top:14px;padding:11px 13px;border-radius:12px;
  background:rgba(197,138,83,.10);border:1px solid rgba(197,138,83,.3);color:#7A4E1E;
  font-size:12.5px;line-height:1.5}
.dss-devices{margin-top:18px;padding-top:12px;border-top:1px solid var(--line)}
.dss-devlist{list-style:none;padding:0;margin:6px 0 0}
.dss-devlist li{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);
  font-size:12.5px}
.dss-devlist li:last-child{border-bottom:none}
.dss-devname{font-weight:600;color:var(--ink)}
.dss-devnote{color:var(--muted);text-align:right}
.dss-save{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:13px 16px;border-radius:12px;border:none;cursor:pointer;min-height:48px;
  background:linear-gradient(165deg,#0E5C57,#0A413D);color:#E7F8F3;font-weight:700;font-size:14.5px}
.dss-save:disabled{opacity:.7;cursor:default}
@media(min-width:640px){.dss-grid{grid-template-columns:1fr 1fr}}
`;
