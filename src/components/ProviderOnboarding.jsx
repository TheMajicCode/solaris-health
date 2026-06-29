/**
 * ProviderOnboarding — multi-step "List your practice" flow.
 * Lets any member create a provider listing on the LUCA marketplace.
 *
 * Steps:
 *   1. Provider type
 *   2. Business basics (name, description, specialties)
 *   3. Location (address + city, with geocoding preview on a map)
 *   4. Contact (phone, website, email, price range)
 *   5. Services & pricing
 *   6. Photos + review & submit
 *
 * Props:
 *   user      current user
 *   onClose   ()=>void
 *   onCreated (provider)=>void   — fired after successful creation
 */
import React, { useState, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, Loader2, MapPin, Plus, Trash2,
  Store, Building2, Phone, Camera, Sparkles, Search,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api.js';
import { PROVIDER_TYPES } from './marketplace/ProviderBadges.jsx';

const PRICES = ['$', '$$', '$$$', '$$$$'];
const STEPS = ['Type', 'Basics', 'Location', 'Contact', 'Services', 'Photos'];
const SV_CENTER = [13.6929, -89.2182];

function pin() {
  return L.divIcon({
    html: `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:#0f766e;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
    className: 'mv-divicon', iconSize: [24, 24], iconAnchor: [12, 22],
  });
}

export default function ProviderOnboarding({ user, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    provider_type: '', business_name: '', description: '', specialties: [],
    address: '', city: '', country: 'El Salvador',
    phone: '', website: '', email: user?.email || '', price_range: '$$',
    latitude: null, longitude: null,
    services: [], photos: [],
  });
  const [specInput, setSpecInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');
  const [photoInput, setPhotoInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

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
        setGeoStatus('found');
      } else {
        setGeoStatus('notfound');
      }
    } catch {
      setGeoStatus('error');
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
  const updateService = (i, k, v) => set({ services: form.services.map((s, idx) => idx === i ? { ...s, [k]: v } : s) });
  const removeService = (i) => set({ services: form.services.filter((_, idx) => idx !== i) });
  const addPhoto = () => {
    const v = photoInput.trim();
    if (v) set({ photos: [...form.photos, v] });
    setPhotoInput('');
  };
  const removePhoto = (i) => set({ photos: form.photos.filter((_, idx) => idx !== i) });

  const canNext = () => {
    if (step === 0) return !!form.provider_type;
    if (step === 1) return form.business_name.trim().length > 1;
    return true;
  };

  const next = () => {
    setError('');
    if (step === 2 && form.address.trim() && form.latitude == null && !geocoding) {
      geocode(); // attempt geocode when leaving location step
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setSubmitting(true); setError('');
    try {
      const payload = {
        ...form,
        services: form.services
          .filter((s) => s.service_name.trim())
          .map((s) => ({
            service_name: s.service_name.trim(),
            price: s.price ? Number(s.price) : null,
            duration_minutes: s.duration_minutes ? Number(s.duration_minutes) : null,
            category: s.category || null,
          })),
        photos: form.photos,
        profile_photo_url: form.photos[0] || null,
        cover_photo_url: form.photos[0] || null,
      };
      const { provider } = await api.createProvider(payload);
      setDone(true);
      onCreated && onCreated(provider);
    } catch (e) {
      setError(e.message || 'Could not create your listing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pon-overlay" onClick={onClose}>
      <div className="pon" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="pon-close" onClick={onClose} aria-label="Close"><X size={20} /></button>

        {done ? (
          <div className="pon-done">
            <div className="pon-done-ico"><Check size={34} /></div>
            <h2>You're on the map!</h2>
            <p>{form.business_name} has been listed on the LUCA marketplace. You can manage it anytime from your account.</p>
            <button className="pon-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="pon-header">
              <span className="pon-eyebrow"><Store size={14} /> List your practice</span>
              <h2 className="pon-title">Join the LUCA provider network</h2>
              <div className="pon-steps">
                {STEPS.map((s, i) => (
                  <div key={s} className={`pon-step${i === step ? ' on' : ''}${i < step ? ' done' : ''}`}>
                    <span className="pon-step-dot">{i < step ? <Check size={12} /> : i + 1}</span>
                    <span className="pon-step-label">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pon-body">
              {/* Step 1: Type */}
              {step === 0 && (
                <div className="pon-pane">
                  <h3 className="pon-h3">What kind of provider are you?</h3>
                  <div className="pon-types">
                    {PROVIDER_TYPES.map((t) => {
                      const Icon = t.icon;
                      return (
                        <button key={t.id} type="button"
                          className={`pon-type${form.provider_type === t.id ? ' on' : ''}`}
                          onClick={() => set({ provider_type: t.id })}>
                          <Icon size={22} />
                          <span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: Basics */}
              {step === 1 && (
                <div className="pon-pane">
                  <h3 className="pon-h3">Tell us about your practice</h3>
                  <label className="pon-field">
                    <span>Business name *</span>
                    <input value={form.business_name} onChange={(e) => set({ business_name: e.target.value })} placeholder="e.g. Clínica Solaris" />
                  </label>
                  <label className="pon-field">
                    <span>Description</span>
                    <textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })}
                      placeholder="Describe your practice, philosophy and what makes you unique…" />
                  </label>
                  <label className="pon-field">
                    <span>Specialties</span>
                    <div className="pon-spec-input">
                      <input value={specInput} onChange={(e) => setSpecInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpec(); } }}
                        placeholder="Add a specialty and press Enter" />
                      <button type="button" onClick={addSpec}><Plus size={16} /></button>
                    </div>
                  </label>
                  {form.specialties.length > 0 && (
                    <div className="pon-tags">
                      {form.specialties.map((s, i) => (
                        <span key={i} className="pon-tag">{s}
                          <button onClick={() => set({ specialties: form.specialties.filter((_, idx) => idx !== i) })}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Location */}
              {step === 2 && (
                <div className="pon-pane">
                  <h3 className="pon-h3">Where are you located?</h3>
                  <label className="pon-field">
                    <span>Street address</span>
                    <input value={form.address} onChange={(e) => set({ address: e.target.value, latitude: null, longitude: null })} placeholder="e.g. Paseo General Escalón" />
                  </label>
                  <label className="pon-field">
                    <span>City</span>
                    <input value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="e.g. San Salvador" />
                  </label>
                  <button className="pon-geo" type="button" onClick={geocode} disabled={geocoding || !form.address.trim()}>
                    {geocoding ? <Loader2 className="pon-spin" size={15} /> : <Search size={15} />} Locate on map
                  </button>
                  {geoStatus === 'notfound' && <p className="pon-warn">Couldn't find that address — you can still continue and refine later.</p>}
                  {geoStatus === 'error' && <p className="pon-warn">Geocoding service unavailable — you can still continue.</p>}
                  {form.latitude != null && (
                    <div className="pon-mapbox">
                      <MapContainer center={[form.latitude, form.longitude]} zoom={15} className="pon-map" scrollWheelZoom={false} zoomControl={false}>
                        <TileLayer url="https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Tissot_mercator.png/500px-Tissot_mercator.png" />
                        <Marker position={[form.latitude, form.longitude]} icon={pin()} />
                      </MapContainer>
                      <span className="pon-map-ok"><MapPin size={13} /> Location set</span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Contact */}
              {step === 3 && (
                <div className="pon-pane">
                  <h3 className="pon-h3">How can people reach you?</h3>
                  <label className="pon-field"><span>Phone</span>
                    <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+503 0000 0000" /></label>
                  <label className="pon-field"><span>Website</span>
                    <input value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" /></label>
                  <label className="pon-field"><span>Email</span>
                    <input value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="hello@yourpractice.com" /></label>
                  <label className="pon-field"><span>Price range</span>
                    <div className="pon-prices">
                      {PRICES.map((p) => (
                        <button key={p} type="button" className={`pon-price${form.price_range === p ? ' on' : ''}`} onClick={() => set({ price_range: p })}>{p}</button>
                      ))}
                    </div>
                  </label>
                </div>
              )}

              {/* Step 5: Services */}
              {step === 4 && (
                <div className="pon-pane">
                  <h3 className="pon-h3">Services & pricing</h3>
                  <p className="pon-sub">Add the services you offer. You can edit these later.</p>
                  <div className="pon-services">
                    {form.services.map((s, i) => (
                      <div className="pon-service" key={i}>
                        <input className="pon-svc-name" value={s.service_name} onChange={(e) => updateService(i, 'service_name', e.target.value)} placeholder="Service name" />
                        <input className="pon-svc-price" type="number" value={s.price} onChange={(e) => updateService(i, 'price', e.target.value)} placeholder="$" />
                        <input className="pon-svc-dur" type="number" value={s.duration_minutes} onChange={(e) => updateService(i, 'duration_minutes', e.target.value)} placeholder="min" />
                        <button className="pon-svc-del" onClick={() => removeService(i)}><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                  <button className="pon-add" type="button" onClick={addService}><Plus size={15} /> Add a service</button>
                </div>
              )}

              {/* Step 6: Photos + review */}
              {step === 5 && (
                <div className="pon-pane">
                  <h3 className="pon-h3">Photos & final review</h3>
                  <label className="pon-field">
                    <span>Photo URLs</span>
                    <div className="pon-spec-input">
                      <input value={photoInput} onChange={(e) => setPhotoInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhoto(); } }}
                        placeholder="Paste an image URL and press Enter" />
                      <button type="button" onClick={addPhoto}><Plus size={16} /></button>
                    </div>
                  </label>
                  {form.photos.length > 0 && (
                    <div className="pon-photos">
                      {form.photos.map((url, i) => (
                        <div className="pon-photo" key={i}>
                          <img src={url} alt="" onError={(e) => { e.target.style.opacity = 0.3; }} />
                          <button onClick={() => removePhoto(i)}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pon-summary">
                    <h4><Sparkles size={15} /> Review your listing</h4>
                    <div className="pon-sum-row"><span>Type</span><b>{PROVIDER_TYPES.find((t) => t.id === form.provider_type)?.label || '—'}</b></div>
                    <div className="pon-sum-row"><span>Name</span><b>{form.business_name || '—'}</b></div>
                    <div className="pon-sum-row"><span>Location</span><b>{form.city || form.address || '—'}{form.latitude != null ? ' ✓' : ''}</b></div>
                    <div className="pon-sum-row"><span>Services</span><b>{form.services.filter((s) => s.service_name.trim()).length}</b></div>
                    <div className="pon-sum-row"><span>Photos</span><b>{form.photos.length}</b></div>
                  </div>
                </div>
              )}

              {error && <div className="pon-error">{error}</div>}
            </div>

            <div className="pon-footer">
              <button className="pon-back" onClick={back} disabled={step === 0}><ChevronLeft size={16} /> Back</button>
              {step < STEPS.length - 1 ? (
                <button className="pon-primary" onClick={next} disabled={!canNext()}>Continue <ChevronRight size={16} /></button>
              ) : (
                <button className="pon-primary" onClick={submit} disabled={submitting || !form.business_name.trim()}>
                  {submitting ? <Loader2 className="pon-spin" size={16} /> : <>Publish listing <Check size={16} /></>}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .pon-overlay{position:fixed;inset:0;background:rgba(2,18,24,.55);backdrop-filter:blur(4px);z-index:4000;
  display:flex;align-items:flex-start;justify-content:center;padding:28px 16px;overflow-y:auto}
.luca .pon{position:relative;width:100%;max-width:680px;background:var(--surface);border-radius:var(--r-lg);
  box-shadow:0 24px 70px rgba(2,18,24,.4);overflow:hidden;animation:ponin .25s ease;display:flex;flex-direction:column;max-height:calc(100vh - 56px)}
@keyframes ponin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.luca .pon-close{position:absolute;top:14px;right:14px;z-index:20;width:36px;height:36px;border-radius:50%;
  background:var(--surface-2);border:1px solid var(--line);cursor:pointer;display:grid;place-items:center;color:var(--ink)}
.luca .pon-close:hover{background:var(--line)}
.luca .pon-header{padding:22px 24px 16px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--surface),var(--surface-2))}
.luca .pon-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--teal-d);text-transform:uppercase;letter-spacing:.05em}
.luca .pon-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;margin:6px 0 16px;color:var(--ink)}
.luca .pon-steps{display:flex;gap:4px;flex-wrap:wrap}
.luca .pon-step{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);padding:4px 8px;border-radius:8px}
.luca .pon-step.on{color:var(--teal-d);font-weight:700;background:var(--mint-soft)}
.luca .pon-step.done{color:var(--mint-ink)}
.luca .pon-step-dot{width:20px;height:20px;border-radius:50%;background:var(--line-2);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700}
.luca .pon-step.on .pon-step-dot{background:var(--teal-d)}
.luca .pon-step.done .pon-step-dot{background:var(--mint-ink)}
.luca .pon-body{padding:22px 24px;overflow-y:auto;flex:1}
.luca .pon-h3{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;margin:0 0 14px;color:var(--ink)}
.luca .pon-sub{font-size:13px;color:var(--muted);margin:-8px 0 16px}
.luca .pon-types{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.luca .pon-type{display:flex;flex-direction:column;align-items:center;gap:9px;padding:18px 10px;border:1px solid var(--line);
  background:var(--surface-2);border-radius:var(--r-sm);cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:var(--ink);transition:all .15s}
.luca .pon-type:hover{border-color:var(--mint);background:var(--mint-soft)}
.luca .pon-type.on{border-color:var(--teal-d);background:var(--mint-soft);color:var(--teal-d);box-shadow:inset 0 0 0 1px var(--teal-d)}
.luca .pon-type svg{color:var(--teal-d)}
.luca .pon-field{display:flex;flex-direction:column;gap:6px;margin-bottom:15px}
.luca .pon-field>span{font-size:12px;font-weight:700;color:var(--muted-2);text-transform:uppercase;letter-spacing:.04em}
.luca .pon-field input,.luca .pon-field textarea{border:1px solid var(--line);border-radius:10px;padding:10px 12px;
  font-family:inherit;font-size:14px;color:var(--ink);background:var(--surface);outline:none;transition:border-color .15s}
.luca .pon-field input:focus,.luca .pon-field textarea:focus{border-color:var(--mint)}
.luca .pon-spec-input{display:flex;gap:8px}
.luca .pon-spec-input input{flex:1}
.luca .pon-spec-input button{border:1px solid var(--line);background:var(--surface-2);border-radius:10px;width:42px;display:grid;place-items:center;cursor:pointer;color:var(--teal-d)}
.luca .pon-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:-6px}
.luca .pon-tag{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--mint-ink);background:var(--mint-soft);border:1px solid var(--mint-line);padding:4px 9px;border-radius:999px}
.luca .pon-tag button{border:none;background:none;cursor:pointer;color:var(--mint-ink);display:grid;place-items:center;padding:0}
.luca .pon-geo{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--teal-d);background:var(--mint-soft);
  color:var(--teal-d);border-radius:10px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
.luca .pon-geo:disabled{opacity:.5;cursor:not-allowed}
.luca .pon-warn{font-size:12.5px;color:var(--gold-ink);margin:10px 0 0}
.luca .pon-mapbox{position:relative;height:200px;border-radius:var(--r-sm);overflow:hidden;border:1px solid var(--line);margin-top:14px}
.luca .pon-map{height:100%;width:100%}
.luca .pon-map-ok{position:absolute;bottom:8px;left:8px;z-index:500;display:inline-flex;align-items:center;gap:4px;
  background:var(--mint-ink);color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px}
.luca .pon-prices{display:flex;gap:8px}
.luca .pon-price{flex:1;border:1px solid var(--line);background:var(--surface-2);border-radius:10px;padding:10px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--ink);transition:all .15s}
.luca .pon-price.on{background:var(--teal-d);color:#fff;border-color:var(--teal-d)}
.luca .pon-services{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.luca .pon-service{display:flex;gap:7px}
.luca .pon-svc-name{flex:1;border:1px solid var(--line);border-radius:9px;padding:9px;font-family:inherit;font-size:13px;outline:none}
.luca .pon-svc-price,.luca .pon-svc-dur{width:64px;border:1px solid var(--line);border-radius:9px;padding:9px;font-family:inherit;font-size:13px;outline:none}
.luca .pon-svc-del{border:1px solid var(--line);background:var(--surface-2);border-radius:9px;width:38px;cursor:pointer;color:var(--danger-ink);display:grid;place-items:center}
.luca .pon-add{display:inline-flex;align-items:center;gap:6px;border:1px dashed var(--line-2);background:var(--surface-2);color:var(--teal-d);border-radius:10px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
.luca .pon-photos{display:flex;flex-wrap:wrap;gap:8px;margin:-4px 0 16px}
.luca .pon-photo{position:relative;width:84px;height:84px;border-radius:10px;overflow:hidden;border:1px solid var(--line)}
.luca .pon-photo img{width:100%;height:100%;object-fit:cover}
.luca .pon-photo button{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;border:none;background:rgba(2,18,24,.7);color:#fff;cursor:pointer;display:grid;place-items:center;padding:0}
.luca .pon-summary{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:15px}
.luca .pon-summary h4{display:flex;align-items:center;gap:7px;font-family:'Space Grotesk',sans-serif;font-size:15px;margin:0 0 12px;color:var(--ink)}
.luca .pon-sum-row{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--line);color:var(--muted)}
.luca .pon-sum-row:last-child{border-bottom:none}
.luca .pon-sum-row b{color:var(--ink)}
.luca .pon-error{margin-top:14px;background:var(--danger-soft);color:var(--danger-ink);border-radius:10px;padding:10px 14px;font-size:13px;font-weight:600}
.luca .pon-footer{display:flex;justify-content:space-between;gap:12px;padding:16px 24px;border-top:1px solid var(--line);background:var(--surface-2)}
.luca .pon-back{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:11px;padding:10px 18px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}
.luca .pon-back:disabled{opacity:.4;cursor:not-allowed}
.luca .pon-primary{display:inline-flex;align-items:center;gap:6px;border:none;background:var(--teal-d);color:#fff;border-radius:11px;padding:10px 22px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;transition:background .15s}
.luca .pon-primary:hover{background:var(--teal-d2)}
.luca .pon-primary:disabled{opacity:.5;cursor:not-allowed}
.luca .pon-spin{animation:ponspin 1s linear infinite}
@keyframes ponspin{to{transform:rotate(360deg)}}
.luca .pon-done{padding:50px 30px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
.luca .pon-done-ico{width:72px;height:72px;border-radius:50%;background:var(--mint-soft);color:var(--mint-ink);display:grid;place-items:center;margin-bottom:6px}
.luca .pon-done h2{font-family:'Space Grotesk',sans-serif;font-size:23px;margin:0;color:var(--ink)}
.luca .pon-done p{font-size:14px;color:var(--muted);max-width:380px;line-height:1.5;margin:0 0 10px}
@media(max-width:620px){
  .luca .pon-step-label{display:none}
  .luca .pon-types{grid-template-columns:repeat(3,1fr)}
}
`;
