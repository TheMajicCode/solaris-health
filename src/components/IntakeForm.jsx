/**
 * IntakeForm.jsx — dynamic new-patient intake renderer.
 *
 * Full-page form reached via /intake?id=<submissionId> (a practitioner-initiated
 * pending submission) or /intake?template=<templateId> (self-initiated). Renders
 * whatever fields the template defines and submits answers to /api/intake/submit.
 *
 * Field types: text · email · date · phone · textarea · select · radio ·
 *              checkbox_group · scale · likert · file · statement
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, ArrowLeft, Leaf, Upload } from 'lucide-react';
import { api } from '../lib/api.js';

const LIKERT = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

function readParams() {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  return { id: p.get('id'), template: p.get('template'), provider: p.get('provider') };
}

export default function IntakeForm() {
  const { id, template: templateParam, provider } = useMemo(readParams, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [template, setTemplate] = useState(null);
  const [submissionId, setSubmissionId] = useState(id || null);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        let fields = null, tName = '', tDesc = '', tid = null;
        if (id) {
          const r = await api.getIntakeSubmission(id);
          const s = r.submission;
          if (s.status === 'submitted' || s.status === 'reviewed') { if (alive) setAlreadyDone(true); }
          tid = s.template_id;
          fields = s.fields_json || [];
          tName = s.template_name || 'Intake form';
          tDesc = s.clinic_type ? '' : '';
          const t = await api.getIntakeTemplate(tid).catch(() => null);
          if (t && t.template) { fields = t.template.fields_json || fields; tName = t.template.name; tDesc = t.template.description; }
          if (alive) { setValues(s.responses_json && Object.keys(s.responses_json).length ? s.responses_json : {}); }
        } else if (templateParam) {
          const t = await api.getIntakeTemplate(templateParam);
          tid = t.template.id; fields = t.template.fields_json || [];
          tName = t.template.name; tDesc = t.template.description;
        } else {
          throw new Error('No intake form specified.');
        }
        if (alive) { setTemplate({ id: tid, name: tName, description: tDesc, fields: fields || [] }); }
      } catch (e) {
        if (alive) setError(e.message || 'Could not load this intake form.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, templateParam]);

  const set = (key, v) => setValues((prev) => ({ ...prev, [key]: v }));
  const toggle = (key, opt) => setValues((prev) => {
    const cur = Array.isArray(prev[key]) ? prev[key] : [];
    return { ...prev, [key]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] };
  });

  const missing = (template?.fields || []).filter((f) => f.required && !String(values[f.key] ?? '').trim());

  const submit = async () => {
    if (missing.length) { setError(`Please complete: ${missing.map((f) => f.label).join(', ')}`); return; }
    setError(''); setSubmitting(true);
    try {
      const payload = submissionId
        ? { submissionId, responses: values }
        : { templateId: template.id, providerId: provider || null, responses: values };
      await api.submitIntake(payload);
      setDone(true);
    } catch (e) {
      setError(e.message || 'Could not submit your intake form.');
    } finally { setSubmitting(false); }
  };

  const goHome = () => { window.location.href = '/'; };

  return (
    <div className="intake-page">
      <div className="intake-shell">
        <button className="intake-back" onClick={goHome}><ArrowLeft size={16} /> Back to your Passport</button>

        {loading ? (
          <div className="intake-center"><Loader2 className="intake-spin" size={26} /> Loading your intake form…</div>
        ) : error && !template ? (
          <div className="intake-card"><p className="intake-err">{error}</p></div>
        ) : done ? (
          <div className="intake-card intake-success">
            <CheckCircle2 size={44} className="intake-ok-icon" />
            <h2>Thank you — your intake is complete</h2>
            <p>Your practitioner now has everything they need to prepare for your first session. This lives in your Health Passport, always yours to revisit.</p>
            <button className="intake-btn" onClick={goHome}>Return to your Passport</button>
          </div>
        ) : alreadyDone ? (
          <div className="intake-card intake-success">
            <CheckCircle2 size={44} className="intake-ok-icon" />
            <h2>You've already completed this intake</h2>
            <p>Thank you — there's nothing more to do here. You can review it any time from your Health Passport.</p>
            <button className="intake-btn" onClick={goHome}>Return to your Passport</button>
          </div>
        ) : (
          <>
            <div className="intake-head">
              <div className="intake-badge"><Leaf size={13} /> New patient intake</div>
              <h1>{template.name}</h1>
              {template.description ? <p className="intake-desc">{template.description}</p> : null}
            </div>

            <div className="intake-card">
              {(template.fields || []).map((f) => (
                <Field key={f.key} f={f} value={values[f.key]} set={set} toggle={toggle} />
              ))}

              {error ? <p className="intake-err">{error}</p> : null}
              <button className="intake-btn" onClick={submit} disabled={submitting}>
                {submitting ? <><Loader2 className="intake-spin" size={16} /> Submitting…</> : 'Submit intake form'}
              </button>
              <p className="intake-fine">Your answers are private and stored in your sovereign Health Passport.</p>
            </div>
          </>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function Field({ f, value, set, toggle }) {
  const id = `f_${f.key}`;
  const label = (
    <label htmlFor={id} className="intake-label">{f.label}{f.required ? <span className="intake-req"> *</span> : null}</label>
  );
  switch (f.type) {
    case 'statement':
      return <div className="intake-field"><p className="intake-statement">{f.label}</p></div>;
    case 'textarea':
      return <div className="intake-field">{label}<textarea id={id} rows={3} placeholder={f.placeholder || ''} value={value || ''} onChange={(e) => set(f.key, e.target.value)} /></div>;
    case 'select':
      return (
        <div className="intake-field">{label}
          <select id={id} value={value || ''} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">Select…</option>
            {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    case 'radio':
      return (
        <div className="intake-field">{label}
          <div className="intake-opts">
            {(f.options || []).map((o) => (
              <button type="button" key={o} className={`intake-opt ${value === o ? 'on' : ''}`} onClick={() => set(f.key, o)}>{o}</button>
            ))}
          </div>
        </div>
      );
    case 'checkbox_group':
      return (
        <div className="intake-field">{label}
          <div className="intake-opts">
            {(f.options || []).map((o) => {
              const on = Array.isArray(value) && value.includes(o);
              return <button type="button" key={o} className={`intake-opt ${on ? 'on' : ''}`} onClick={() => toggle(f.key, o)}>{o}</button>;
            })}
          </div>
        </div>
      );
    case 'scale': {
      const min = f.min ?? 1, max = f.max ?? 10;
      const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <div className="intake-field">{label}
          <div className="intake-scale">
            {nums.map((n) => (
              <button type="button" key={n} className={`intake-num ${value === n ? 'on' : ''}`} onClick={() => set(f.key, n)}>{n}</button>
            ))}
          </div>
        </div>
      );
    }
    case 'likert':
      return (
        <div className="intake-field">{label}
          <div className="intake-opts">
            {LIKERT.map((o, i) => (
              <button type="button" key={o} className={`intake-opt ${value === (i + 1) ? 'on' : ''}`} onClick={() => set(f.key, i + 1)}>{o}</button>
            ))}
          </div>
        </div>
      );
    case 'file':
      return (
        <div className="intake-field">{label}
          <label className="intake-file"><Upload size={15} /> {value ? value : 'Choose a file…'}
            <input type="file" style={{ display: 'none' }} onChange={(e) => set(f.key, e.target.files?.[0]?.name || '')} />
          </label>
          <span className="intake-hint">File names are recorded; upload securely at your visit.</span>
        </div>
      );
    case 'date':
      return <div className="intake-field">{label}<input id={id} type="date" value={value || ''} onChange={(e) => set(f.key, e.target.value)} /></div>;
    case 'email':
      return <div className="intake-field">{label}<input id={id} type="email" placeholder={f.placeholder || ''} value={value || ''} onChange={(e) => set(f.key, e.target.value)} /></div>;
    case 'phone':
      return <div className="intake-field">{label}<input id={id} type="tel" placeholder={f.placeholder || ''} value={value || ''} onChange={(e) => set(f.key, e.target.value)} /></div>;
    default:
      return <div className="intake-field">{label}<input id={id} type="text" placeholder={f.placeholder || ''} value={value || ''} onChange={(e) => set(f.key, e.target.value)} /></div>;
  }
}

const CSS = `
.intake-page{min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%,#0B4A44,#062B28 60%,#04201E);padding:28px 16px 60px;font-family:'IBM Plex Sans',system-ui,sans-serif}
.intake-shell{max-width:720px;margin:0 auto}
.intake-back{background:transparent;border:0;color:#9FE7D6;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:18px;padding:6px 2px}
.intake-back:hover{color:#EAFBF4}
.intake-center{display:flex;align-items:center;justify-content:center;gap:10px;color:#CFF3E9;padding:80px 0;font-size:15px}
.intake-spin{animation:intakespin 1s linear infinite}
@keyframes intakespin{to{transform:rotate(360deg)}}
.intake-head{margin-bottom:16px}
.intake-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(159,231,214,.14);color:#9FE7D6;border:1px solid rgba(159,231,214,.3);border-radius:999px;font-size:11.5px;font-weight:700;padding:4px 11px;text-transform:uppercase;letter-spacing:.04em}
.intake-head h1{color:#EAFBF4;font-size:24px;margin:12px 0 6px;line-height:1.2}
.intake-desc{color:#9FE7D6;font-size:14px;margin:0;line-height:1.5}
.intake-card{background:#F6FAF8;border:1px solid #DDECE6;border-radius:20px;padding:22px}
.intake-field{margin-bottom:18px}
.intake-label{display:block;color:#0A2B29;font-size:13.5px;font-weight:600;margin-bottom:7px;line-height:1.4}
.intake-req{color:#C25A3A}
.intake-statement{background:#EAF5F0;border-left:3px solid #36C9A9;border-radius:8px;padding:10px 13px;color:#0A2B29;font-size:13.5px;margin:0}
.intake-field input,.intake-field textarea,.intake-field select{width:100%;box-sizing:border-box;border:1px solid #CFE3DB;border-radius:12px;padding:11px 13px;font-size:14px;font-family:inherit;color:#0A2B29;background:#fff;outline:none}
.intake-field input:focus,.intake-field textarea:focus,.intake-field select:focus{border-color:#36C9A9;box-shadow:0 0 0 3px rgba(54,201,169,.15)}
.intake-opts{display:flex;flex-wrap:wrap;gap:8px}
.intake-opt{background:#fff;border:1px solid #CFE3DB;border-radius:999px;padding:8px 14px;font-size:13px;color:#0A2B29;cursor:pointer;font-family:inherit;transition:all .12s}
.intake-opt:hover{border-color:#36C9A9}
.intake-opt.on{background:#0B4A44;border-color:#0B4A44;color:#EAFBF4;font-weight:600}
.intake-scale{display:flex;flex-wrap:wrap;gap:6px}
.intake-num{width:38px;height:38px;border-radius:10px;border:1px solid #CFE3DB;background:#fff;color:#0A2B29;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
.intake-num:hover{border-color:#36C9A9}
.intake-num.on{background:#0B4A44;border-color:#0B4A44;color:#EAFBF4}
.intake-file{display:inline-flex;align-items:center;gap:8px;border:1px dashed #CFE3DB;border-radius:12px;padding:11px 14px;font-size:13.5px;color:#0A2B29;cursor:pointer;background:#fff}
.intake-file:hover{border-color:#36C9A9}
.intake-hint{display:block;color:#6E8B84;font-size:11.5px;margin-top:5px}
.intake-btn{width:100%;margin-top:8px;background:#0B4A44;border:0;border-radius:14px;color:#EAFBF4;font-size:15px;font-weight:700;padding:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:inherit}
.intake-btn:hover{background:#083c37}
.intake-btn:disabled{opacity:.6;cursor:default}
.intake-err{color:#C25A3A;font-size:13px;margin:6px 0 12px;font-weight:600}
.intake-fine{color:#6E8B84;font-size:11.5px;text-align:center;margin:12px 0 0}
.intake-success{text-align:center}
.intake-ok-icon{color:#36C9A9;margin:0 auto 8px}
.intake-success h2{color:#0A2B29;font-size:21px;margin:6px 0 8px}
.intake-success p{color:#3C5C55;font-size:14px;line-height:1.55;margin:0 auto 18px;max-width:440px}
`;
