/**
 * IntakeForm.jsx — dynamic new-patient intake renderer (spec A5).
 *
 * Full-page form reached via /intake?id=<submissionId> (a practitioner-initiated
 * pending submission) or /intake?template=<templateId> (self-initiated).
 *
 * A5 behaviours:
 *   • Every intake is Part A (Foundational Health Data) + Part B (specialty).
 *   • Bilingual EN/ES — labels/options carry _en/_es; a language toggle switches live.
 *   • A consent statement is shown up front and must be acknowledged.
 *   • Conditional fields via showIf { field, equals | notEquals }.
 *   • If Foundational Health Data was completed < 12 months ago, Part A collapses
 *     to a single "still accurate?" confirm step (prefilled), then Part B only.
 *
 * Field types: text · email · date · phone · textarea · select · radio ·
 *              checkbox_group · scale · likert · file · statement
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, ArrowLeft, Leaf, Upload, Globe } from 'lucide-react';
import { api } from '../lib/api.js';

const LIKERT_EN = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];
const LIKERT_ES = ['Muy en desacuerdo', 'En desacuerdo', 'Neutral', 'De acuerdo', 'Muy de acuerdo'];

const UI = {
  en: {
    back: 'Back to your Passport', loading: 'Loading your intake form…',
    badge: 'New patient intake', partA: 'Part A · Foundational Health Data',
    submit: 'Submit intake form', submitting: 'Submitting…',
    fine: 'Your answers are private and stored in your sovereign Health Passport.',
    thanksTitle: 'Thank you — your intake is complete',
    thanks: 'Your practitioner now has everything they need to prepare for your first session. This lives in your Health Passport, always yours to revisit.',
    doneTitle: "You've already completed this intake",
    done: "Thank you — there's nothing more to do here. You can review it any time from your Health Passport.",
    ret: 'Return to your Passport', select: 'Select…',
    consentTitle: 'Before we begin', iAgree: 'I understand and agree',
    prefillTitle: 'We already have your foundational health data',
    prefillBody: (d) => `You completed your Foundational Health Data on ${d}. Is everything still accurate?`,
    stillOk: 'Yes, still accurate', needUpdate: 'No, I need to update it',
    fileChoose: 'Choose a file…', fileHint: 'File names are recorded; upload securely at your visit.',
    otherLabel: 'Other (please specify)', pleaseComplete: 'Please complete:', consentRequired: 'Please acknowledge the consent statement to continue.',
  },
  es: {
    back: 'Volver a tu Pasaporte', loading: 'Cargando tu formulario de admisión…',
    badge: 'Admisión de nuevo paciente', partA: 'Parte A · Datos de salud fundamentales',
    submit: 'Enviar formulario', submitting: 'Enviando…',
    fine: 'Tus respuestas son privadas y se guardan en tu Pasaporte de Salud soberano.',
    thanksTitle: 'Gracias — tu admisión está completa',
    thanks: 'Tu profesional ya tiene todo lo necesario para preparar tu primera sesión. Esto vive en tu Pasaporte de Salud, siempre tuyo para consultar.',
    doneTitle: 'Ya completaste esta admisión',
    done: 'Gracias — no hay nada más que hacer aquí. Puedes revisarlo cuando quieras desde tu Pasaporte de Salud.',
    ret: 'Volver a tu Pasaporte', select: 'Selecciona…',
    consentTitle: 'Antes de comenzar', iAgree: 'Entiendo y acepto',
    prefillTitle: 'Ya tenemos tus datos de salud fundamentales',
    prefillBody: (d) => `Completaste tus Datos de salud fundamentales el ${d}. ¿Sigue todo correcto?`,
    stillOk: 'Sí, sigue correcto', needUpdate: 'No, necesito actualizarlo',
    fileChoose: 'Elegir un archivo…', fileHint: 'Se registran los nombres de archivo; súbelos de forma segura en tu visita.',
    otherLabel: 'Otro (especifica)', pleaseComplete: 'Por favor completa:', consentRequired: 'Por favor confirma el consentimiento para continuar.',
  },
};

function readParams() {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  return { id: p.get('id'), template: p.get('template'), provider: p.get('provider') };
}

function initialLang() {
  try {
    const stored = localStorage.getItem('lang');
    if (stored === 'en' || stored === 'es') return stored;
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (u && (u.language === 'es' || u.language === 'en')) return u.language;
  } catch (_) { /* ignore */ }
  return 'en';
}

export default function IntakeForm() {
  const { id, template: templateParam, provider } = useMemo(readParams, []);
  const [lang, setLang] = useState(initialLang);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [template, setTemplate] = useState(null); // { id, name, description, partA[], partB[], consent }
  const [submissionId, setSubmissionId] = useState(id || null);
  const [values, setValues] = useState({});
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  // prefill collapse: 'confirm' shows the single confirm step; 'expanded' shows full Part A; null = no prefill
  const [prefill, setPrefill] = useState(null); // { date } | null
  const [prefillMode, setPrefillMode] = useState(null); // 'confirm' | 'expanded' | 'confirmed'

  const t = UI[lang];
  const T = (obj, base) => (obj && (obj[`${base}_${lang}`] ?? obj[`${base}_en`] ?? obj[base])) || '';
  const optLabel = (o) => (typeof o === 'string' ? o : (o[lang] || o.en || ''));
  const optValue = (o) => (typeof o === 'string' ? o : (o.en || ''));

  const switchLang = (l) => { setLang(l); try { localStorage.setItem('lang', l); } catch (_) {} };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        let tid = null, tName = '', tDesc = '', tRow = null, prefRes = null;
        if (id) {
          const r = await api.getIntakeSubmission(id);
          const s = r.submission;
          if (s.status === 'submitted' || s.status === 'reviewed') { if (alive) setAlreadyDone(true); }
          tid = s.template_id;
          const tt = await api.getIntakeTemplate(tid).catch(() => null);
          tRow = tt && tt.template ? tt.template : { fields_json: s.fields_json || [], name: s.template_name || 'Intake form' };
          if (alive && s.responses_json && Object.keys(s.responses_json).length) setValues(s.responses_json);
        } else if (templateParam) {
          const tt = await api.getIntakeTemplate(templateParam);
          tRow = tt.template; tid = tRow.id;
        } else {
          throw new Error('No intake form specified.');
        }
        tName = tRow.name || 'Intake form';
        tDesc = tRow.description || '';
        const partAFields = tRow.foundational_fields || (tRow.part === 'A' ? (tRow.fields_json || []) : []);
        const partBFields = tRow.part === 'A' ? [] : (tRow.fields_json || []);
        const consent = tRow.consent_json || null;

        // Prefill: foundational completed < 12 months ago → collapse Part A to confirm.
        prefRes = await api.getIntakeFoundational().catch(() => null);
        const f = prefRes && prefRes.foundational;
        if (!alive) return;
        if (f && f.updatedWithin12Months && partAFields.length) {
          setValues((prev) => ({ ...(f.data || {}), ...prev }));
          setPrefill({ date: f.observedAt || f.updatedAt });
          setPrefillMode('confirm');
        }
        setTemplate({ id: tid, name: tName, description: tDesc, partA: partAFields, partB: partBFields, consent });
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

  // showIf: return true if the field should be shown given current values.
  const visible = (f) => {
    if (!f.showIf) return true;
    const cur = values[f.showIf.field];
    if ('equals' in f.showIf) return String(cur) === String(f.showIf.equals);
    if ('notEquals' in f.showIf) return String(cur) !== String(f.showIf.notEquals);
    return true;
  };

  // Which Part A fields to render: none while in confirm/confirmed collapse, full otherwise.
  const showPartA = !(prefillMode === 'confirm' || prefillMode === 'confirmed');
  const activePartA = showPartA ? (template?.partA || []) : [];
  const activeFields = [...activePartA, ...(template?.partB || [])].filter(visible);

  const missing = activeFields.filter((f) => f.type !== 'statement' && f.required && !String(values[f.key] ?? '').trim());

  const submit = async () => {
    if (template?.consent && !consented) { setError(t.consentRequired); return; }
    if (missing.length) { setError(`${t.pleaseComplete} ${missing.map((f) => T(f, 'label')).join(', ')}`); return; }
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
  const fmtDate = (v) => { try { return new Date(v).toLocaleDateString(lang === 'es' ? 'es' : 'en'); } catch { return String(v || ''); } };

  return (
    <div className="intake-page">
      <div className="intake-shell">
        <div className="intake-toprow">
          <button className="intake-back" onClick={goHome}><ArrowLeft size={16} /> {t.back}</button>
          <div className="intake-lang"><Globe size={13} />
            <button className={lang === 'en' ? 'on' : ''} onClick={() => switchLang('en')}>EN</button>
            <button className={lang === 'es' ? 'on' : ''} onClick={() => switchLang('es')}>ES</button>
          </div>
        </div>

        {loading ? (
          <div className="intake-center"><Loader2 className="intake-spin" size={26} /> {t.loading}</div>
        ) : error && !template ? (
          <div className="intake-card"><p className="intake-err">{error}</p></div>
        ) : done ? (
          <div className="intake-card intake-success">
            <CheckCircle2 size={44} className="intake-ok-icon" />
            <h2>{t.thanksTitle}</h2><p>{t.thanks}</p>
            <button className="intake-btn" onClick={goHome}>{t.ret}</button>
          </div>
        ) : alreadyDone ? (
          <div className="intake-card intake-success">
            <CheckCircle2 size={44} className="intake-ok-icon" />
            <h2>{t.doneTitle}</h2><p>{t.done}</p>
            <button className="intake-btn" onClick={goHome}>{t.ret}</button>
          </div>
        ) : (
          <>
            <div className="intake-head">
              <div className="intake-badge"><Leaf size={13} /> {t.badge}</div>
              <h1>{template.name}</h1>
              {template.description ? <p className="intake-desc">{template.description}</p> : null}
            </div>

            {/* Consent statement (A5) */}
            {template.consent ? (
              <div className="intake-card intake-consent">
                <h3>{t.consentTitle}</h3>
                <p>{optLabel(template.consent)}</p>
                <label className="intake-check">
                  <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
                  <span>{t.iAgree}</span>
                </label>
              </div>
            ) : null}

            {/* Prefill confirm step (A5 collapse) */}
            {prefillMode === 'confirm' ? (
              <div className="intake-card intake-prefill">
                <h3>{t.prefillTitle}</h3>
                <p>{t.prefillBody(fmtDate(prefill?.date))}</p>
                <div className="intake-opts">
                  <button className="intake-btn2" onClick={() => setPrefillMode('confirmed')}>{t.stillOk}</button>
                  <button className="intake-btn2 ghost" onClick={() => setPrefillMode('expanded')}>{t.needUpdate}</button>
                </div>
              </div>
            ) : null}

            <div className="intake-card">
              {/* Part A */}
              {activePartA.length ? <div className="intake-section">{t.partA}</div> : null}
              {activePartA.filter(visible).map((f) => (
                <Field key={f.key} f={f} value={values[f.key]} set={set} toggle={toggle}
                  lang={lang} T={T} optLabel={optLabel} optValue={optValue} ui={t} LIKERT={lang === 'es' ? LIKERT_ES : LIKERT_EN} />
              ))}

              {/* Part B */}
              {(template.partB || []).length ? <div className="intake-section">{template.name}</div> : null}
              {(template.partB || []).filter(visible).map((f) => (
                <Field key={f.key} f={f} value={values[f.key]} set={set} toggle={toggle}
                  lang={lang} T={T} optLabel={optLabel} optValue={optValue} ui={t} LIKERT={lang === 'es' ? LIKERT_ES : LIKERT_EN} />
              ))}

              {error ? <p className="intake-err">{error}</p> : null}
              <button className="intake-btn" onClick={submit} disabled={submitting}>
                {submitting ? <><Loader2 className="intake-spin" size={16} /> {t.submitting}</> : t.submit}
              </button>
              <p className="intake-fine">{t.fine}</p>
            </div>
          </>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function Field({ f, value, set, toggle, T, optLabel, optValue, ui, LIKERT }) {
  const id = `f_${f.key}`;
  const labelText = T(f, 'label');
  const helper = T(f, 'helper');
  const placeholder = T(f, 'placeholder');
  const label = (
    <label htmlFor={id} className="intake-label">{labelText}{f.required ? <span className="intake-req"> *</span> : null}</label>
  );
  const helperEl = helper ? <span className="intake-hint">{helper}</span> : null;
  const opts = f.options || [];
  switch (f.type) {
    case 'statement':
      return <div className="intake-field"><p className="intake-statement">{labelText}</p></div>;
    case 'textarea':
      return <div className="intake-field">{label}<textarea id={id} rows={3} placeholder={placeholder} value={value || ''} onChange={(e) => set(f.key, e.target.value)} />{helperEl}</div>;
    case 'select':
      return (
        <div className="intake-field">{label}
          <select id={id} value={value || ''} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">{ui.select}</option>
            {opts.map((o) => { const v = optValue(o); return <option key={v} value={v}>{optLabel(o)}</option>; })}
          </select>{helperEl}
        </div>
      );
    case 'radio':
      return (
        <div className="intake-field">{label}
          <div className="intake-opts">
            {opts.map((o) => { const v = optValue(o); return (
              <button type="button" key={v} className={`intake-opt ${value === v ? 'on' : ''}`} onClick={() => set(f.key, v)}>{optLabel(o)}</button>
            ); })}
          </div>{helperEl}
        </div>
      );
    case 'checkbox_group':
      return (
        <div className="intake-field">{label}
          <div className="intake-opts">
            {opts.map((o) => { const v = optValue(o); const on = Array.isArray(value) && value.includes(v);
              return <button type="button" key={v} className={`intake-opt ${on ? 'on' : ''}`} onClick={() => toggle(f.key, v)}>{optLabel(o)}</button>; })}
          </div>{helperEl}
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
          </div>{helperEl}
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
          </div>{helperEl}
        </div>
      );
    case 'file':
      return (
        <div className="intake-field">{label}
          <label className="intake-file"><Upload size={15} /> {value ? value : ui.fileChoose}
            <input type="file" style={{ display: 'none' }} onChange={(e) => set(f.key, e.target.files?.[0]?.name || '')} />
          </label>
          <span className="intake-hint">{ui.fileHint}</span>
        </div>
      );
    case 'date':
      return <div className="intake-field">{label}<input id={id} type="date" value={value || ''} onChange={(e) => set(f.key, e.target.value)} />{helperEl}</div>;
    case 'email':
      return <div className="intake-field">{label}<input id={id} type="email" placeholder={placeholder} value={value || ''} onChange={(e) => set(f.key, e.target.value)} />{helperEl}</div>;
    case 'phone':
      return <div className="intake-field">{label}<input id={id} type="tel" placeholder={placeholder} value={value || ''} onChange={(e) => set(f.key, e.target.value)} />{helperEl}</div>;
    case 'number':
      return <div className="intake-field">{label}<input id={id} type="number" placeholder={placeholder} value={value || ''} onChange={(e) => set(f.key, e.target.value)} />{helperEl}</div>;
    default:
      return <div className="intake-field">{label}<input id={id} type="text" placeholder={placeholder} value={value || ''} onChange={(e) => set(f.key, e.target.value)} />{helperEl}</div>;
  }
}

const CSS = `
.intake-page{min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%,#0B4A44,#062B28 60%,#04201E);padding:28px 16px 60px;font-family:'IBM Plex Sans',system-ui,sans-serif}
.intake-shell{max-width:720px;margin:0 auto}
.intake-toprow{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.intake-back{background:transparent;border:0;color:#9FE7D6;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:6px 2px}
.intake-back:hover{color:#EAFBF4}
.intake-lang{display:inline-flex;align-items:center;gap:4px;color:#9FE7D6}
.intake-lang button{background:transparent;border:1px solid rgba(159,231,214,.3);color:#9FE7D6;border-radius:8px;padding:4px 9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.intake-lang button.on{background:#9FE7D6;color:#062B28;border-color:#9FE7D6}
.intake-center{display:flex;align-items:center;justify-content:center;gap:10px;color:#CFF3E9;padding:80px 0;font-size:15px}
.intake-spin{animation:intakespin 1s linear infinite}
@keyframes intakespin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.intake-spin{animation:none}}
.intake-head{margin-bottom:16px}
.intake-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(159,231,214,.14);color:#9FE7D6;border:1px solid rgba(159,231,214,.3);border-radius:999px;font-size:11.5px;font-weight:700;padding:4px 11px;text-transform:uppercase;letter-spacing:.04em}
.intake-head h1{color:#EAFBF4;font-size:24px;margin:12px 0 6px;line-height:1.2}
.intake-desc{color:#9FE7D6;font-size:14px;margin:0;line-height:1.5}
.intake-card{background:#F6FAF8;border:1px solid #DDECE6;border-radius:20px;padding:22px;margin-bottom:16px}
.intake-consent h3,.intake-prefill h3{color:#0A2B29;font-size:16px;margin:0 0 8px}
.intake-consent p,.intake-prefill p{color:#3C5C55;font-size:13.5px;line-height:1.55;margin:0 0 12px}
.intake-check{display:flex;align-items:center;gap:9px;color:#0A2B29;font-size:13.5px;font-weight:600;cursor:pointer}
.intake-check input{width:18px;height:18px;accent-color:#0B4A44}
.intake-section{color:#0A2B29;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #DDECE6;padding-bottom:8px;margin:6px 0 16px}
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
.intake-btn2{background:#0B4A44;border:0;border-radius:12px;color:#EAFBF4;font-size:13.5px;font-weight:700;padding:10px 16px;cursor:pointer;font-family:inherit}
.intake-btn2.ghost{background:#fff;border:1px solid #CFE3DB;color:#0A2B29}
.intake-err{color:#C25A3A;font-size:13px;margin:6px 0 12px;font-weight:600}
.intake-fine{color:#6E8B84;font-size:11.5px;text-align:center;margin:12px 0 0}
.intake-success{text-align:center}
.intake-ok-icon{color:#36C9A9;margin:0 auto 8px}
.intake-success h2{color:#0A2B29;font-size:21px;margin:6px 0 8px}
.intake-success p{color:#3C5C55;font-size:14px;line-height:1.55;margin:0 auto 18px;max-width:440px}
`;
