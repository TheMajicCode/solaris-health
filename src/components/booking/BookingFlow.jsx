/**
 * BookingFlow — a 5-step booking modal (Zocdoc/Calendly style).
 *   1. Select service   2. Choose date & time   3. Add details
 *   4. Review & confirm  5. Confirmation
 *
 * Props:
 *   providerId   provider profile id (required)
 *   provider     optional pre-loaded provider object
 *   services     optional pre-loaded services array
 *   serviceId    optional pre-selected service id
 *   user         current user (pre-fills phone)
 *   onClose      ()=>void
 *   onBooked     (booking)=>void  — fired after a successful request
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Loader2, Check, ChevronRight, ChevronLeft, Calendar, Clock, Tag,
  MapPin, FileText, ShieldCheck, CalendarPlus, PartyPopper,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import TimeSlotPicker from './TimeSlotPicker.jsx';
import { fmtTime, fmtDateLong, downloadICS, tzLabel } from '../../lib/calendar-utils.js';

const STEPS = ['Service', 'Date & Time', 'Details', 'Review', 'Done'];

export default function BookingFlow({ providerId, provider: provIn, services: svcIn, serviceId, user, onClose, onBooked }) {
  const [provider, setProvider] = useState(provIn || null);
  const [services, setServices] = useState(svcIn || null);
  const [loadingProv, setLoadingProv] = useState(!provIn || !svcIn);

  const [step, setStep] = useState(0);
  const [service, setService] = useState(null);
  const [slotData, setSlotData] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const tz = tzLabel();

  // Load provider + services if not supplied.
  useEffect(() => {
    if (provIn && svcIn) return;
    let on = true;
    (async () => {
      try {
        const d = await api.getProvider(providerId);
        if (!on) return;
        setProvider(d.provider);
        setServices(d.services || []);
      } catch {
        if (on) toast.error('Could not load provider');
      } finally {
        if (on) setLoadingProv(false);
      }
    })();
    return () => { on = false; };
  }, [providerId, provIn, svcIn]);

  // Pre-select a service if requested or only one exists.
  useEffect(() => {
    if (service || !services) return;
    if (serviceId) {
      const s = services.find((x) => x.id === serviceId);
      if (s) setService(s);
    }
  }, [services, serviceId, service]);

  const loadSlots = useCallback(async (svc) => {
    if (!svc) return;
    setLoadingSlots(true);
    try {
      const r = await api.getAvailableSlots(providerId, svc.id);
      setSlotData(r.dates || []);
    } catch {
      setSlotData([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [providerId]);

  const pickService = (s) => { setService(s); setSlot(null); setStep(1); loadSlots(s); };

  const submit = async () => {
    if (!slot) return;
    setSubmitting(true);
    try {
      const r = await api.requestBooking({
        providerId,
        serviceId: service?.id,
        date: slot.date,
        startTime: slot.start,
        endTime: slot.end,
        patientNotes: notes,
        patientPhone: phone,
      });
      setResult(r);
      setStep(4);
      toast.success(r.autoConfirmed ? 'Appointment confirmed!' : 'Booking request sent!');
      onBooked?.(r.booking);
    } catch (e) {
      toast.error(e.message || 'Could not complete booking');
    } finally {
      setSubmitting(false);
    }
  };

  const price = service?.price != null ? Number(service.price) : 0;
  const fee = Math.round(price * 10) / 100;

  const canNext = (step === 0 && service) || (step === 1 && slot) || step === 2 || step === 3;

  return (
    <div className="bkf-scrim" onClick={onClose}>
      <div className="bkf" onClick={(e) => e.stopPropagation()}>
        <button className="bkf-x" onClick={onClose} aria-label="Close"><X size={18} /></button>

        {/* Stepper */}
        {step < 4 && (
          <div className="bkf-steps">
            {STEPS.slice(0, 4).map((s, i) => (
              <div key={s} className={`bkf-step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
                <span className="bkf-step-n">{i < step ? <Check size={12} /> : i + 1}</span>
                <span className="bkf-step-l">{s}</span>
              </div>
            ))}
          </div>
        )}

        {loadingProv ? (
          <div className="bkf-loading"><Loader2 className="bkf-spin" size={24} /> Loading…</div>
        ) : (
          <div className="bkf-body">
            {/* header */}
            {step < 4 && provider && (
              <div className="bkf-prov">
                <div className="bkf-prov-name">{provider.business_name}</div>
                {(provider.address || provider.city) && (
                  <div className="bkf-prov-loc"><MapPin size={12} /> {[provider.address, provider.city].filter(Boolean).join(', ')}</div>
                )}
              </div>
            )}

            {/* Step 1: service */}
            {step === 0 && (
              <div className="bkf-pane">
                <h3 className="bkf-h"><Tag size={16} /> Select a service</h3>
                {(!services || !services.length) ? (
                  <p className="bkf-muted">This provider hasn't listed any bookable services yet.</p>
                ) : (
                  <div className="bkf-svc-list">
                    {services.map((s) => (
                      <button key={s.id} className={`bkf-svc ${service?.id === s.id ? 'on' : ''}`} onClick={() => pickService(s)}>
                        <div className="bkf-svc-l">
                          <span className="bkf-svc-n">{s.service_name}</span>
                          {s.description && <span className="bkf-svc-d">{s.description}</span>}
                          <span className="bkf-svc-m">
                            {s.duration_minutes ? <span><Clock size={11} /> {s.duration_minutes} min</span> : null}
                            {s.category ? <span className="bkf-svc-cat">{s.category}</span> : null}
                          </span>
                        </div>
                        <div className="bkf-svc-r">
                          {s.price != null && <span className="bkf-svc-p">${Number(s.price).toFixed(0)}</span>}
                          <ChevronRight size={16} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: date & time */}
            {step === 1 && (
              <div className="bkf-pane">
                <h3 className="bkf-h"><Calendar size={16} /> Choose a date & time</h3>
                <TimeSlotPicker dates={slotData} loading={loadingSlots} value={slot} onChange={setSlot} tz={tz} />
              </div>
            )}

            {/* Step 3: details */}
            {step === 2 && (
              <div className="bkf-pane">
                <h3 className="bkf-h"><FileText size={16} /> Add details</h3>
                <label className="bkf-label">Reason for visit / notes <span>(optional)</span></label>
                <textarea className="bkf-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. follow-up consultation, any allergies or context the provider should know…" />
                <label className="bkf-label">Contact phone</label>
                <input className="bkf-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
                <p className="bkf-note"><ShieldCheck size={13} /> You'll get an email + in-app confirmation once the provider responds.</p>
              </div>
            )}

            {/* Step 4: review */}
            {step === 3 && (
              <div className="bkf-pane">
                <h3 className="bkf-h"><Check size={16} /> Review & confirm</h3>
                <div className="bkf-review">
                  <Row label="Provider" value={provider?.business_name} />
                  <Row label="Service" value={service?.service_name} />
                  <Row label="Date" value={slot ? fmtDateLong(slot.date) : ''} />
                  <Row label="Time" value={slot ? `${fmtTime(slot.start)} – ${fmtTime(slot.end)} (${tz})` : ''} />
                  <div className="bkf-divider" />
                  <Row label="Service price" value={`$${price.toFixed(2)}`} />
                  <Row label="Platform fee (10%)" value={`included`} muted />
                  <Row label="Total" value={`$${price.toFixed(2)}`} strong />
                </div>
                <p className="bkf-policy">
                  <ShieldCheck size={13} /> Cancellation policy: 24 hours notice required. Payment is collected in person for now —
                  online payment is coming soon.
                </p>
              </div>
            )}

            {/* Step 5: confirmation */}
            {step === 4 && result && (
              <div className="bkf-done">
                <div className="bkf-done-ico"><PartyPopper size={34} /></div>
                <h2>{result.autoConfirmed ? 'Appointment confirmed!' : 'Booking requested!'}</h2>
                <p className="bkf-ref">Reference <b>{result.reference}</b></p>
                <p className="bkf-done-sub">
                  {result.autoConfirmed
                    ? 'Your appointment is confirmed. We sent the details to your email and notifications.'
                    : "You'll receive a confirmation once the provider approves your request."}
                </p>
                <div className="bkf-done-card">
                  <div><Calendar size={14} /> {fmtDateLong(result.booking.booking_date)}</div>
                  <div><Clock size={14} /> {fmtTime(result.booking.start_time)} – {fmtTime(result.booking.end_time)} ({tz})</div>
                  <div><Tag size={14} /> {service?.service_name} · {provider?.business_name}</div>
                </div>
                <div className="bkf-done-actions">
                  <button className="bkf-btn ghost" onClick={() => downloadICS({ ...result.booking, service_name: service?.service_name, business_name: provider?.business_name, address: provider?.address, city: provider?.city })}>
                    <CalendarPlus size={15} /> Add to Calendar
                  </button>
                  <button className="bkf-btn primary" onClick={onClose}>Done</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer nav */}
        {step < 4 && !loadingProv && (
          <div className="bkf-foot">
            {step > 0 ? (
              <button className="bkf-btn ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}><ChevronLeft size={15} /> Back</button>
            ) : <span />}
            {step < 3 ? (
              <button className="bkf-btn primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Continue <ChevronRight size={15} />
              </button>
            ) : (
              <button className="bkf-btn primary" disabled={submitting || !slot} onClick={submit}>
                {submitting ? <><Loader2 className="bkf-spin" size={15} /> Booking…</> : <>Confirm booking <Check size={15} /></>}
              </button>
            )}
          </div>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function Row({ label, value, strong, muted }) {
  return (
    <div className={`bkf-row ${strong ? 'strong' : ''}`}>
      <span className="bkf-row-l">{label}</span>
      <span className={`bkf-row-v ${muted ? 'muted' : ''}`}>{value}</span>
    </div>
  );
}

const CSS = `
.luca .bkf-scrim{position:fixed;inset:0;background:rgba(6,30,28,.55);backdrop-filter:blur(4px);z-index:1000;
  display:flex;align-items:center;justify-content:center;padding:20px;animation:bkfIn .15s ease}
@keyframes bkfIn{from{opacity:0}to{opacity:1}}
.luca .bkf{position:relative;background:var(--canvas);border-radius:20px;width:100%;max-width:620px;max-height:92vh;
  display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden}
.luca .bkf-x{position:absolute;top:14px;right:14px;z-index:2;border:none;background:var(--surface-2);border-radius:9px;
  width:32px;height:32px;display:grid;place-items:center;cursor:pointer;color:var(--ink)}
.luca .bkf-x:hover{background:var(--mint-line)}
.luca .bkf-steps{display:flex;gap:6px;padding:18px 20px 12px;border-bottom:1px solid var(--line)}
.luca .bkf-step{display:flex;align-items:center;gap:6px;flex:1;opacity:.5}
.luca .bkf-step.on,.luca .bkf-step.done{opacity:1}
.luca .bkf-step-n{width:22px;height:22px;border-radius:50%;background:var(--surface-2);color:var(--muted);
  display:grid;place-items:center;font-size:12px;font-weight:700;flex:none}
.luca .bkf-step.on .bkf-step-n{background:var(--teal-d);color:#fff}
.luca .bkf-step.done .bkf-step-n{background:var(--mint);color:var(--teal-d)}
.luca .bkf-step-l{font-size:12px;font-weight:700;color:var(--ink);white-space:nowrap}
@media(max-width:520px){.luca .bkf-step-l{display:none}}
.luca .bkf-body{padding:18px 22px;overflow:auto}
.luca .bkf-loading{padding:50px;display:flex;flex-direction:column;align-items:center;gap:10px;color:var(--muted)}
.luca .bkf-spin{animation:spin 1s linear infinite}
.luca .bkf-prov{margin-bottom:14px}
.luca .bkf-prov-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:17px;color:var(--ink)}
.luca .bkf-prov-loc{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);margin-top:2px}
.luca .bkf-h{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:var(--ink);margin:0 0 14px;font-family:'Space Grotesk',sans-serif}
.luca .bkf-muted{color:var(--muted);font-size:14px}
.luca .bkf-svc-list{display:flex;flex-direction:column;gap:9px}
.luca .bkf-svc{display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;
  border:1px solid var(--line);background:var(--surface);border-radius:13px;padding:13px 15px;cursor:pointer;transition:all .12s;font-family:inherit}
.luca .bkf-svc:hover{border-color:var(--teal-d);box-shadow:var(--shadow-sm)}
.luca .bkf-svc.on{border-color:var(--teal-d);background:var(--mint-soft)}
.luca .bkf-svc-l{display:flex;flex-direction:column;gap:3px;min-width:0}
.luca .bkf-svc-n{font-weight:700;font-size:14px;color:var(--ink)}
.luca .bkf-svc-d{font-size:12.5px;color:var(--muted);line-height:1.4}
.luca .bkf-svc-m{display:flex;gap:8px;align-items:center;font-size:11.5px;color:var(--muted-2);margin-top:2px}
.luca .bkf-svc-m span{display:flex;align-items:center;gap:3px}
.luca .bkf-svc-cat{background:var(--surface-2);border-radius:6px;padding:1px 7px;font-weight:600}
.luca .bkf-svc-r{display:flex;align-items:center;gap:8px;color:var(--muted)}
.luca .bkf-svc-p{font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:16px;color:var(--teal-d)}
.luca .bkf-label{display:block;font-size:12.5px;font-weight:700;color:var(--ink);margin:12px 0 6px}
.luca .bkf-label span{font-weight:500;color:var(--muted-2)}
.luca .bkf-textarea,.luca .bkf-input{width:100%;border:1px solid var(--line);border-radius:11px;padding:11px 13px;
  font-family:inherit;font-size:14px;color:var(--ink);background:var(--surface);outline:none;resize:vertical}
.luca .bkf-textarea:focus,.luca .bkf-input:focus{border-color:var(--teal-d)}
.luca .bkf-note,.luca .bkf-policy{display:flex;align-items:flex-start;gap:6px;font-size:12px;color:var(--muted);margin-top:14px;line-height:1.5}
.luca .bkf-review{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:6px 15px}
.luca .bkf-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;font-size:13.5px;border-bottom:1px solid var(--line)}
.luca .bkf-row:last-child{border-bottom:none}
.luca .bkf-row-l{color:var(--muted)}
.luca .bkf-row-v{color:var(--ink);font-weight:600;text-align:right}
.luca .bkf-row-v.muted{color:var(--muted-2);font-weight:500}
.luca .bkf-row.strong .bkf-row-l,.luca .bkf-row.strong .bkf-row-v{font-weight:800;font-size:15px;color:var(--teal-d)}
.luca .bkf-divider{height:1px;background:var(--line);margin:2px 0}
.luca .bkf-foot{display:flex;align-items:center;justify-content:space-between;padding:14px 22px;border-top:1px solid var(--line);gap:10px}
.luca .bkf-btn{display:inline-flex;align-items:center;gap:6px;border-radius:11px;padding:11px 18px;font-weight:700;font-size:14px;
  cursor:pointer;font-family:inherit;border:1px solid transparent;transition:all .12s}
.luca .bkf-btn.primary{background:var(--teal-d);color:#fff}
.luca .bkf-btn.primary:hover{background:var(--teal-d2)}
.luca .bkf-btn.primary:disabled{opacity:.45;cursor:not-allowed}
.luca .bkf-btn.ghost{background:var(--surface);border-color:var(--line);color:var(--ink)}
.luca .bkf-btn.ghost:hover{background:var(--surface-2)}
.luca .bkf-done{text-align:center;padding:24px 10px 8px}
.luca .bkf-done-ico{width:70px;height:70px;border-radius:50%;background:var(--mint-soft);color:var(--teal-d);
  display:grid;place-items:center;margin:0 auto 14px}
.luca .bkf-done h2{font-family:'Space Grotesk',sans-serif;font-size:21px;color:var(--ink);margin:0 0 6px}
.luca .bkf-ref{font-size:13px;color:var(--muted);margin:0 0 4px}
.luca .bkf-ref b{font-family:'IBM Plex Mono',monospace;color:var(--teal-d)}
.luca .bkf-done-sub{font-size:13.5px;color:var(--muted);max-width:420px;margin:0 auto 16px;line-height:1.5}
.luca .bkf-done-card{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:14px;text-align:left;
  display:flex;flex-direction:column;gap:8px;max-width:360px;margin:0 auto 18px}
.luca .bkf-done-card div{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink);font-weight:600}
.luca .bkf-done-card svg{color:var(--teal-d);flex:none}
.luca .bkf-done-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
`;
