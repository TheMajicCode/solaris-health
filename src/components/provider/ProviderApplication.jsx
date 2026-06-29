/**
 * ProviderApplication — 6-step "Become a Provider" application flow.
 *
 *   1. Provider type + basic info
 *   2. Location + contact + hours
 *   3. Services + pricing
 *   4. Verification (conditional: medical vs non-medical)
 *   5. Legal agreements (commission, terms, liability waiver w/ IP capture)
 *   6. Review + submit  ->  "under review" confirmation
 *
 * Props:
 *   user         current user
 *   onClose      ()=>void
 *   onSubmitted  ()=>void   — fired after a successful submission (refresh user)
 */
import React, { useState, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, Loader2, MapPin, Plus, Trash2,
  Briefcase, ShieldCheck, FileCheck, Clock, Search, Stethoscope, Store,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { PROVIDER_TYPES } from '../marketplace/ProviderBadges.jsx';
import DocumentUpload from './DocumentUpload.jsx';

const MEDICAL_TYPES = ['doctor', 'dentist', 'therapist', 'nutritionist'];
const PRICES = ['$', '$$', '$$$', '$$$$'];
const STEPS = ['Type', 'Location', 'Services', 'Verification', 'Legal', 'Review'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const AGREEMENTS = [
  { key: 'commission', label: 'I agree to the platform commission of 10% on all bookings made through Solaris Health.' },
  { key: 'platform_terms', label: 'I have read and accept the Provider Platform Terms, including that Solaris Health acts solely as a coordinator.' },
  { key: 'accuracy', label: 'I certify that all information and documents I provide are true, accurate and current.' },
  { key: 'professional_responsibility', label: 'I accept full professional responsibility for the services I provide and will maintain all required licenses and insurance.' },
  { key: 'document_retention', label: 'I consent to my documents being securely stored for verification and audit for up to 7 years.' },
  { key: 'code_of_conduct', label: 'I agree to uphold the Solaris Health code of conduct and to treat all patients with care and respect.' },
];

export default function ProviderApplication({ user, onClose, onSubmitted }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    provider_type: '', business_name: '', description: '', specialties: [],
    address: '', city: '', country: 'El Salvador', latitude: null, longitude: null,
    phone: '', website: '', email: user?.email || '', social_media: '',
    hours: {}, price_range: '$$', services: [],
    // verification fields
    cssp_number: '', issp_expiry: '',
    docs: {}, // { degree, issp_license, national_id, insurance, business_photo }
  });
  const [agreed, setAgreed] = useState({});
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [specInput, setSpecInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isMedical = MEDICAL_TYPES.includes(form.provider_type);
  const typeLabel = PROVIDER_TYPES.find((t) => t.id === form.provider_type)?.label || form.provider_type;

  const geocode = useCallback(async () => {
    if (!form.address.trim()) return;
    setGeocoding(true); setGeoStatus('');
    try {
      const q = [form.address, form.city, form.country].filter(Boolean).join(', ');
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        set({ latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) });
        setGeoStatus('Location found ✓');
      } else {
        setGeoStatus('Could not find that address — you can still continue.');
      }
    } catch {
      setGeoStatus('Lookup failed — you can still continue.');
    } finally {
      setGeocoding(false);
    }
  }, [form.address, form.city, form.country]);

  const addSpec = () => {
    const v = specInput.trim();
    if (v && !form.specialties.includes(v)) set({ specialties: [...form.specialties, v] });
    setSpecInput('');
  };
  const addService = () => set({ services: [...form.services, { service_name: '', price: '', duration_minutes: '', category: '' }] });
  const updService = (i, patch) => set({ services: form.services.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const rmService = (i) => set({ services: form.services.filter((_, k) => k !== i) });
  const setDoc = (key, val) => set({ docs: { ...form.docs, [key]: val } });
  const setHours = (day, val) => set({ hours: { ...form.hours, [day]: val } });

  const canNext = () => {
    if (step === 0) return form.provider_type && form.business_name.trim();
    if (step === 1) return form.city.trim();
    if (step === 3) {
      if (isMedical) {
        return form.docs.degree && form.cssp_number.trim() && form.docs.issp_license &&
          form.issp_expiry && form.docs.national_id;
      }
      return form.website.trim() || form.social_media.trim() || form.phone.trim();
    }
    if (step === 4) {
      return AGREEMENTS.every((a) => agreed[a.key]) && waiverAccepted;
    }
    return true;
  };

  const next = () => { setError(''); if (canNext()) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => { setError(''); setStep((s) => Math.max(s - 1, 0)); };

  const submit = async () => {
    setSubmitting(true); setError('');
    try {
      const application_data = {
        description: form.description, specialties: form.specialties,
        address: form.address, city: form.city, country: form.country,
        latitude: form.latitude, longitude: form.longitude,
        phone: form.phone, website: form.website, email: form.email,
        social_media: form.social_media, hours_of_operation: form.hours,
        price_range: form.price_range,
        services: form.services.filter((s) => s.service_name.trim()),
        cssp_number: form.cssp_number, issp_expiry: form.issp_expiry,
      };
      const agreements = [
        ...AGREEMENTS.map((a) => ({ agreement_type: a.key, agreed: !!agreed[a.key] })),
        { agreement_type: 'liability_waiver', agreed: waiverAccepted },
      ];

      const res = await api.applyProvider({
        provider_type: form.provider_type,
        business_name: form.business_name.trim(),
        application_data,
        agreements,
      });
      const appId = res.application?.id;

      // Assemble documents.
      const documents = [];
      const pushDoc = (type, doc) => doc && documents.push({
        document_type: type, document_name: doc.document_name,
        document_data: doc.document_data, mime_type: doc.mime_type,
      });
      if (isMedical) {
        pushDoc('degree', form.docs.degree);
        pushDoc('issp_license', form.docs.issp_license);
        pushDoc('national_id', form.docs.national_id);
        pushDoc('insurance', form.docs.insurance);
        if (form.cssp_number) documents.push({ document_type: 'cssp_number', field_value: form.cssp_number });
        if (form.issp_expiry) documents.push({ document_type: 'issp_expiry', field_value: form.issp_expiry, expiry_date: form.issp_expiry });
      } else {
        pushDoc('business_photo', form.docs.business_photo);
        if (form.website) documents.push({ document_type: 'website', field_value: form.website });
        if (form.social_media) documents.push({ document_type: 'social_media', field_value: form.social_media });
        if (form.phone) documents.push({ document_type: 'phone', field_value: form.phone });
      }
      if (appId && documents.length) {
        await api.uploadApplicationDocuments(appId, documents);
      }

      setDone(true);
      onSubmitted?.();
    } catch (e) {
      setError(e.message || 'Could not submit your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ----------------------------- DONE SCREEN ----------------------------- */
  if (done) {
    return (
      <div className="pap-overlay" onClick={onClose}>
        <div className="pap" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="pap-done">
            <div className="pap-done-ico"><Clock size={34} /></div>
            <h2 className="pap-done-title">Application under review</h2>
            <p className="pap-done-sub">
              Thank you, {user?.firstName || 'there'}! We've received your application for
              <b> {form.business_name}</b>. Our team{isMedical ? ' will verify your credentials and' : ''} will
              get back to you, usually within 2–3 business days. You'll receive an email once a decision is made.
            </p>
            <div className="pap-done-steps">
              <div className="pap-done-step"><Check size={15} /> Application submitted</div>
              <div className="pap-done-step pend"><Loader2 size={15} className="pap-spin" /> Under review</div>
              <div className="pap-done-step off"><ShieldCheck size={15} /> Approval &amp; go live</div>
            </div>
            <button className="pap-primary" onClick={onClose}>Done</button>
          </div>
        </div>
        <style>{CSS}</style>
      </div>
    );
  }

  return (
    <div className="pap-overlay" onClick={onClose}>
      <div className="pap" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="pap-close" onClick={onClose} aria-label="Close"><X size={20} /></button>

        <div className="pap-header">
          <span className="pap-eyebrow"><Briefcase size={14} /> Become a provider</span>
          <h2 className="pap-title">Join the Solaris Health network</h2>
          <div className="pap-steps">
            {STEPS.map((s, i) => (
              <div key={s} className={`pap-step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
                <span className="pap-step-n">{i < step ? <Check size={12} /> : i + 1}</span>{s}
              </div>
            ))}
          </div>
        </div>

        <div className="pap-body">
          {/* STEP 1 — Type + basics */}
          {step === 0 && (
            <div className="pap-section">
              <label className="pap-lbl">What type of provider are you?</label>
              <div className="pap-types">
                {PROVIDER_TYPES.map((t) => (
                  <button
                    key={t.id}
                    className={`pap-type ${form.provider_type === t.id ? 'on' : ''}`}
                    onClick={() => set({ provider_type: t.id })}
                  >
                    {MEDICAL_TYPES.includes(t.id) ? <Stethoscope size={18} /> : <Store size={18} />}
                    <span>{t.label}</span>
                    {MEDICAL_TYPES.includes(t.id) && <em className="pap-med-tag">Medical</em>}
                  </button>
                ))}
              </div>
              {form.provider_type && (
                <div className={`pap-note ${isMedical ? 'med' : ''}`}>
                  {isMedical
                    ? 'Medical providers require full credential verification (degree, CSSP registration, ISSP license, ID & insurance).'
                    : 'Non-medical providers are verified using social proof (website, phone, social media).'}
                </div>
              )}
              <label className="pap-lbl">Business / practice name</label>
              <input className="pap-input" value={form.business_name}
                onChange={(e) => set({ business_name: e.target.value })}
                placeholder="e.g. Bright Smile Dental" />
              <label className="pap-lbl">Short description</label>
              <textarea className="pap-input" rows={3} value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Tell patients what makes your practice special…" />
              <label className="pap-lbl">Specialties</label>
              <div className="pap-chip-input">
                <input value={specInput} onChange={(e) => setSpecInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpec())}
                  placeholder="Type and press Enter" />
                <button onClick={addSpec}><Plus size={16} /></button>
              </div>
              <div className="pap-chips">
                {form.specialties.map((s) => (
                  <span key={s} className="pap-chip">{s}
                    <button onClick={() => set({ specialties: form.specialties.filter((x) => x !== s) })}><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — Location + contact + hours */}
          {step === 1 && (
            <div className="pap-section">
              <label className="pap-lbl">Street address</label>
              <div className="pap-geo">
                <input className="pap-input" value={form.address}
                  onChange={(e) => set({ address: e.target.value })}
                  placeholder="Av. La Capilla 123, Colonia San Benito" />
                <button className="pap-geo-btn" onClick={geocode} disabled={geocoding || !form.address.trim()}>
                  {geocoding ? <Loader2 size={15} className="pap-spin" /> : <Search size={15} />} Locate
                </button>
              </div>
              {geoStatus && <div className="pap-geo-status"><MapPin size={13} /> {geoStatus}</div>}
              <div className="pap-row">
                <div><label className="pap-lbl">City</label>
                  <input className="pap-input" value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="San Salvador" /></div>
                <div><label className="pap-lbl">Country</label>
                  <input className="pap-input" value={form.country} onChange={(e) => set({ country: e.target.value })} /></div>
              </div>
              <div className="pap-row">
                <div><label className="pap-lbl">Phone</label>
                  <input className="pap-input" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+503 …" /></div>
                <div><label className="pap-lbl">Public email</label>
                  <input className="pap-input" value={form.email} onChange={(e) => set({ email: e.target.value })} /></div>
              </div>
              <label className="pap-lbl">Website</label>
              <input className="pap-input" value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://…" />
              <label className="pap-lbl">Hours of operation</label>
              <div className="pap-hours">
                {DAYS.map((d) => (
                  <div key={d} className="pap-hour-row">
                    <span className="pap-hour-day">{d}</span>
                    <input className="pap-input pap-hour-in" value={form.hours[d] || ''}
                      onChange={(e) => setHours(d, e.target.value)}
                      placeholder="e.g. 9:00–17:00 or Closed" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 — Services + pricing */}
          {step === 2 && (
            <div className="pap-section">
              <label className="pap-lbl">Price range</label>
              <div className="pap-prices">
                {PRICES.map((p) => (
                  <button key={p} className={`pap-price ${form.price_range === p ? 'on' : ''}`}
                    onClick={() => set({ price_range: p })}>{p}</button>
                ))}
              </div>
              <div className="pap-svc-head">
                <label className="pap-lbl" style={{ margin: 0 }}>Services &amp; pricing</label>
                <button className="pap-add" onClick={addService}><Plus size={15} /> Add service</button>
              </div>
              {form.services.length === 0 && <p className="pap-muted">No services yet — add the services you offer (optional).</p>}
              {form.services.map((s, i) => (
                <div key={i} className="pap-svc">
                  <input className="pap-input" value={s.service_name} onChange={(e) => updService(i, { service_name: e.target.value })} placeholder="Service name" />
                  <input className="pap-input pap-svc-sm" value={s.price} onChange={(e) => updService(i, { price: e.target.value })} placeholder="$" />
                  <input className="pap-input pap-svc-sm" value={s.duration_minutes} onChange={(e) => updService(i, { duration_minutes: e.target.value })} placeholder="min" />
                  <button className="pap-svc-rm" onClick={() => rmService(i)}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}

          {/* STEP 4 — Verification */}
          {step === 3 && (
            <div className="pap-section">
              {isMedical ? (
                <>
                  <div className="pap-note med">
                    <ShieldCheck size={15} /> As a {typeLabel.toLowerCase()}, we verify your professional credentials before approval.
                  </div>
                  <DocumentUpload label="Professional degree / diploma" required
                    hint="Your university degree or professional diploma."
                    value={form.docs.degree} onChange={(v) => setDoc('degree', v)} />
                  <label className="pap-lbl">CSSP registration number <span className="pap-req">*</span></label>
                  <input className="pap-input" value={form.cssp_number}
                    onChange={(e) => set({ cssp_number: e.target.value })}
                    placeholder="Consejo Superior de Salud Pública number" />
                  <DocumentUpload label="ISSP professional license" required
                    hint="Your current professional practice license."
                    value={form.docs.issp_license} onChange={(v) => setDoc('issp_license', v)} />
                  <label className="pap-lbl">License expiry date <span className="pap-req">*</span></label>
                  <input className="pap-input" type="date" value={form.issp_expiry}
                    onChange={(e) => set({ issp_expiry: e.target.value })} />
                  <DocumentUpload label="National ID (DUI / passport)" required
                    hint="Government-issued photo identification."
                    value={form.docs.national_id} onChange={(v) => setDoc('national_id', v)} />
                  <DocumentUpload label="Professional liability insurance"
                    hint="Optional but recommended."
                    value={form.docs.insurance} onChange={(v) => setDoc('insurance', v)} />
                </>
              ) : (
                <>
                  <div className="pap-note">
                    <FileCheck size={15} /> For {typeLabel.toLowerCase()} businesses we verify legitimacy through social proof. Provide at least one.
                  </div>
                  <label className="pap-lbl">Website</label>
                  <input className="pap-input" value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://yourbusiness.com" />
                  <label className="pap-lbl">Social media profile</label>
                  <input className="pap-input" value={form.social_media} onChange={(e) => set({ social_media: e.target.value })} placeholder="Instagram / Facebook URL" />
                  <label className="pap-lbl">Business phone</label>
                  <input className="pap-input" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+503 …" />
                  <DocumentUpload label="Business photo / storefront"
                    hint="Optional — a photo of your location or team."
                    value={form.docs.business_photo} onChange={(v) => setDoc('business_photo', v)} />
                </>
              )}
            </div>
          )}

          {/* STEP 5 — Legal */}
          {step === 4 && (
            <div className="pap-section">
              <div className="pap-note"><ShieldCheck size={15} /> Please review and accept the following to continue.</div>
              {AGREEMENTS.map((a) => (
                <label key={a.key} className="pap-check">
                  <input type="checkbox" checked={!!agreed[a.key]}
                    onChange={(e) => setAgreed((g) => ({ ...g, [a.key]: e.target.checked }))} />
                  <span>{a.label}</span>
                </label>
              ))}
              <div className="pap-waiver">
                <div className="pap-waiver-head"><FileCheck size={15} /> Liability Waiver &amp; Electronic Signature</div>
                <p className="pap-waiver-body">
                  I acknowledge that I am an independent professional/business and not an employee of Solaris Health.
                  I assume full responsibility for the services I provide and release Solaris Health from liability
                  arising from those services, to the extent permitted by law. I understand that checking the box
                  below constitutes my legally binding electronic signature, and that my IP address and a timestamp
                  are recorded as evidence of acceptance. This waiver is governed by the laws of El Salvador.
                </p>
                <label className="pap-check pap-check-strong">
                  <input type="checkbox" checked={waiverAccepted} onChange={(e) => setWaiverAccepted(e.target.checked)} />
                  <span>I have read and accept the Liability Waiver, and I sign it electronically.</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 6 — Review */}
          {step === 5 && (
            <div className="pap-section">
              <h3 className="pap-review-h">Review your application</h3>
              <div className="pap-sum">
                <div className="pap-sum-row"><span>Provider type</span><b>{typeLabel}{isMedical && <em className="pap-med-tag">Medical</em>}</b></div>
                <div className="pap-sum-row"><span>Business name</span><b>{form.business_name}</b></div>
                <div className="pap-sum-row"><span>Location</span><b>{[form.city, form.country].filter(Boolean).join(', ') || '—'}</b></div>
                <div className="pap-sum-row"><span>Phone</span><b>{form.phone || '—'}</b></div>
                <div className="pap-sum-row"><span>Services</span><b>{form.services.filter((s) => s.service_name.trim()).length}</b></div>
                {isMedical ? (
                  <>
                    <div className="pap-sum-row"><span>Degree</span><b>{form.docs.degree ? '✓ uploaded' : '—'}</b></div>
                    <div className="pap-sum-row"><span>CSSP number</span><b>{form.cssp_number || '—'}</b></div>
                    <div className="pap-sum-row"><span>ISSP license</span><b>{form.docs.issp_license ? '✓ uploaded' : '—'}</b></div>
                    <div className="pap-sum-row"><span>National ID</span><b>{form.docs.national_id ? '✓ uploaded' : '—'}</b></div>
                  </>
                ) : (
                  <>
                    <div className="pap-sum-row"><span>Website</span><b>{form.website || '—'}</b></div>
                    <div className="pap-sum-row"><span>Social media</span><b>{form.social_media || '—'}</b></div>
                  </>
                )}
                <div className="pap-sum-row"><span>Agreements</span><b>{AGREEMENTS.length + 1} accepted ✓</b></div>
              </div>
              <p className="pap-muted">By submitting, your application enters review. Your provider profile stays hidden until approved.</p>
            </div>
          )}

          {error && <div className="pap-error">{error}</div>}
        </div>

        <div className="pap-footer">
          <button className="pap-back" onClick={back} disabled={step === 0}><ChevronLeft size={16} /> Back</button>
          {step < STEPS.length - 1 ? (
            <button className="pap-primary" onClick={next} disabled={!canNext()}>Continue <ChevronRight size={16} /></button>
          ) : (
            <button className="pap-primary" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="pap-spin" size={16} /> : <>Submit application <Check size={16} /></>}
            </button>
          )}
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .pap-overlay{position:fixed;inset:0;background:rgba(2,18,24,.55);backdrop-filter:blur(4px);z-index:4000;
  display:flex;align-items:flex-start;justify-content:center;padding:28px 16px;overflow-y:auto}
.luca .pap{position:relative;width:100%;max-width:720px;background:var(--surface);border-radius:var(--r-lg);
  box-shadow:0 24px 70px rgba(2,18,24,.4);overflow:hidden;animation:papin .25s ease;display:flex;flex-direction:column;max-height:calc(100vh - 56px)}
@keyframes papin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.luca .pap-close{position:absolute;top:14px;right:14px;z-index:20;width:36px;height:36px;border-radius:50%;
  background:var(--surface-2);border:1px solid var(--line);cursor:pointer;display:grid;place-items:center;color:var(--ink)}
.luca .pap-close:hover{background:var(--line)}
.luca .pap-header{padding:22px 24px 14px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--surface),var(--surface-2))}
.luca .pap-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--teal-d);text-transform:uppercase;letter-spacing:.05em}
.luca .pap-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;margin:6px 0 14px;color:var(--ink)}
.luca .pap-steps{display:flex;gap:4px;flex-wrap:wrap}
.luca .pap-step{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);padding:4px 9px;border-radius:8px}
.luca .pap-step.on{color:var(--teal-d);font-weight:700;background:var(--mint-soft)}
.luca .pap-step.done{color:var(--teal-d)}
.luca .pap-step-n{width:18px;height:18px;border-radius:50%;background:var(--line);color:var(--muted);display:grid;place-items:center;font-size:11px;font-weight:700}
.luca .pap-step.on .pap-step-n{background:var(--teal);color:#fff}
.luca .pap-step.done .pap-step-n{background:var(--teal-d);color:#fff}
.luca .pap-body{padding:20px 24px;overflow-y:auto;flex:1}
.luca .pap-section{display:flex;flex-direction:column}
.luca .pap-lbl{font-size:13px;font-weight:700;color:var(--ink);margin:14px 0 6px}
.luca .pap-lbl:first-child{margin-top:0}
.luca .pap-req{color:var(--danger)}
.luca .pap-input{width:100%;padding:10px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);
  background:var(--surface);color:var(--ink);font-size:14px;font-family:inherit;box-sizing:border-box}
.luca .pap-input:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 3px var(--mint-soft)}
.luca textarea.pap-input{resize:vertical}
.luca .pap-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.luca .pap-types{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.luca .pap-type{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;
  border:1.5px solid var(--line-2);border-radius:var(--r-sm);background:var(--surface);cursor:pointer;color:var(--ink);font-size:13px;font-weight:600;text-align:left}
.luca .pap-type:hover{border-color:var(--teal)}
.luca .pap-type.on{border-color:var(--teal);background:var(--mint-soft);color:var(--teal-d)}
.luca .pap-med-tag{font-style:normal;font-size:10px;font-weight:700;color:var(--gold-ink);background:var(--gold-soft);
  padding:1px 6px;border-radius:6px;margin-left:6px}
.luca .pap-note{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--muted-2);background:var(--surface-2);
  border:1px solid var(--line);border-radius:var(--r-sm);padding:10px 12px;margin:12px 0}
.luca .pap-note.med{color:var(--gold-ink);background:var(--gold-soft);border-color:var(--gold-2)}
.luca .pap-chip-input{display:flex;gap:8px}
.luca .pap-chip-input input{flex:1;padding:9px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);font-size:14px;font-family:inherit}
.luca .pap-chip-input button{width:40px;border:1px solid var(--teal);background:var(--mint-soft);color:var(--teal-d);border-radius:var(--r-sm);cursor:pointer;display:grid;place-items:center}
.luca .pap-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.luca .pap-chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;background:var(--mint-soft);color:var(--teal-d);padding:4px 8px;border-radius:8px}
.luca .pap-chip button{border:none;background:none;cursor:pointer;color:var(--teal-d);display:grid;place-items:center}
.luca .pap-geo{display:flex;gap:8px}
.luca .pap-geo .pap-input{flex:1}
.luca .pap-geo-btn{white-space:nowrap;padding:0 14px;border:1px solid var(--teal);background:var(--mint-soft);color:var(--teal-d);border-radius:var(--r-sm);cursor:pointer;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:6px}
.luca .pap-geo-btn:disabled{opacity:.5;cursor:default}
.luca .pap-geo-status{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--teal-d);margin-top:6px}
.luca .pap-hours{display:flex;flex-direction:column;gap:6px}
.luca .pap-hour-row{display:flex;align-items:center;gap:10px}
.luca .pap-hour-day{width:42px;font-size:12px;font-weight:700;color:var(--muted-2)}
.luca .pap-hour-in{flex:1}
.luca .pap-prices{display:flex;gap:8px}
.luca .pap-price{flex:1;padding:10px;border:1.5px solid var(--line-2);border-radius:var(--r-sm);background:var(--surface);cursor:pointer;font-weight:700;color:var(--muted-2)}
.luca .pap-price.on{border-color:var(--teal);background:var(--mint-soft);color:var(--teal-d)}
.luca .pap-svc-head{display:flex;align-items:center;justify-content:space-between;margin:16px 0 8px}
.luca .pap-add{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;color:var(--teal-d);background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:8px;padding:5px 10px;cursor:pointer}
.luca .pap-svc{display:flex;gap:8px;margin-bottom:8px}
.luca .pap-svc .pap-input{flex:1}
.luca .pap-svc-sm{max-width:70px}
.luca .pap-svc-rm{width:38px;border:1px solid var(--line);background:var(--surface);border-radius:var(--r-sm);cursor:pointer;color:var(--muted);display:grid;place-items:center}
.luca .pap-svc-rm:hover{color:var(--danger);border-color:var(--danger-soft)}
.luca .pap-muted{font-size:12.5px;color:var(--muted);margin:6px 0}
.luca .pap-check{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--ink);padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-sm);margin-bottom:8px;cursor:pointer;background:var(--surface)}
.luca .pap-check input{margin-top:2px;width:16px;height:16px;accent-color:var(--teal);flex-shrink:0}
.luca .pap-check-strong{background:var(--mint-soft);border-color:var(--mint-line);font-weight:600}
.luca .pap-waiver{margin-top:14px;border:1px solid var(--line);border-radius:var(--r-sm);overflow:hidden}
.luca .pap-waiver-head{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--ink);background:var(--surface-2);padding:10px 12px;border-bottom:1px solid var(--line)}
.luca .pap-waiver-body{font-size:12.5px;color:var(--muted-2);line-height:1.6;padding:12px;margin:0}
.luca .pap-review-h{font-family:'Space Grotesk',sans-serif;font-size:17px;margin:0 0 12px;color:var(--ink)}
.luca .pap-sum{border:1px solid var(--line);border-radius:var(--r-sm);overflow:hidden}
.luca .pap-sum-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;font-size:13px;border-bottom:1px solid var(--line)}
.luca .pap-sum-row:last-child{border-bottom:none}
.luca .pap-sum-row span{color:var(--muted)}
.luca .pap-sum-row b{color:var(--ink);text-align:right;display:flex;align-items:center;gap:6px}
.luca .pap-error{margin-top:14px;font-size:13px;color:var(--danger-ink);background:var(--danger-soft);padding:10px 12px;border-radius:var(--r-sm)}
.luca .pap-footer{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-top:1px solid var(--line);background:var(--surface)}
.luca .pap-back{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:var(--muted-2);background:none;border:none;cursor:pointer;padding:8px 4px}
.luca .pap-back:disabled{opacity:.4;cursor:default}
.luca .pap-primary{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#fff;
  background:var(--teal-d);border:none;border-radius:999px;padding:11px 22px;cursor:pointer;box-shadow:var(--shadow-sm)}
.luca .pap-primary:hover{background:var(--teal-d2)}
.luca .pap-primary:disabled{opacity:.5;cursor:default}
.luca .pap-spin{animation:papspin 1s linear infinite}
@keyframes papspin{to{transform:rotate(360deg)}}
.luca .pap-done{padding:46px 32px;text-align:center;display:flex;flex-direction:column;align-items:center}
.luca .pap-done-ico{width:72px;height:72px;border-radius:50%;background:var(--gold-soft);color:var(--gold-ink);display:grid;place-items:center;margin-bottom:18px}
.luca .pap-done-title{font-family:'Space Grotesk',sans-serif;font-size:24px;margin:0 0 10px;color:var(--ink)}
.luca .pap-done-sub{font-size:14px;color:var(--muted-2);line-height:1.6;max-width:460px;margin:0 0 22px}
.luca .pap-done-steps{display:flex;flex-direction:column;gap:8px;width:100%;max-width:300px;margin-bottom:24px}
.luca .pap-done-step{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--teal-d);background:var(--mint-soft);padding:9px 14px;border-radius:10px}
.luca .pap-done-step.pend{color:var(--gold-ink);background:var(--gold-soft)}
.luca .pap-done-step.off{color:var(--muted);background:var(--surface-2)}
@media(max-width:560px){.luca .pap-row{grid-template-columns:1fr}}
`;
