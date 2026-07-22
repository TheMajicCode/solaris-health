/**
 * MyPractice — unified provider management workspace shown as a single tab
 * for approved providers (in addition to all their normal patient tabs).
 *
 * Internal sub-tabs: Listings · Bookings · Reviews · Analytics · Settings.
 *
 * Props:
 *   user        current user
 *   onBookings  optional (count)=>void — reports pending booking count for badges
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Store, Star, Calendar, BarChart3, Eye, EyeOff, MapPin, Settings as SettingsIcon,
  CheckCircle2, Clock, TrendingUp, MessageSquare, CalendarClock, Coins,
  Bot, Users, Music, Upload, Send, ShieldCheck, ArrowLeft, X, User as UserIcon,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import ProviderBookings from './ProviderBookings.jsx';
import ProviderCalendar from './ProviderCalendar.jsx';
import GPSEarnings from '../gps/GPSEarnings.jsx';

const SUBTABS = [
  { id: 'copilot', label: 'LUCA Copilot', icon: Bot },
  { id: 'patients', label: 'My Patients', icon: Users },
  { id: 'listings', label: 'Listings', icon: Store },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'availability', label: 'Availability', icon: CalendarClock },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'earnings', label: 'GPS Earnings', icon: Coins },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function MyPractice({ user, onBookings }) {
  const [view, setView] = useState('copilot');
  const [providers, setProviders] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.getMyProviders();
      setProviders(r.providers || []);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = providers || [];
  const visible = list.filter((p) => !p.hidden);

  return (
    <div className="mp">
      <div className="mp-tabs">
        {SUBTABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`mp-tab ${view === t.id ? 'on' : ''}`} onClick={() => setView(t.id)}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="mp-loading"><Loader2 className="mp-spin" size={24} /> Loading your practice…</div>
      ) : (
        <div className="mp-content">
          {view === 'copilot' && <CopilotView user={user} />}
          {view === 'patients' && <PatientsView user={user} />}
          {view === 'audio' && <AudioView />}
          {view === 'listings' && <ListingsView providers={list} onRefresh={load} />}
          {view === 'bookings' && <ProviderBookings onBookings={onBookings} />}
          {view === 'availability' && <ProviderCalendar />}
          {view === 'earnings' && <GPSEarnings />}
          {view === 'reviews' && <ReviewsView providers={visible} />}
          {view === 'analytics' && <AnalyticsView providers={list} />}
          {view === 'settings' && <SettingsView user={user} />}
        </div>
      )}
      <style>{CSS}</style>
    </div>
  );
}

/* ------------------------------- Listings ------------------------------- */
function ListingsView({ providers, onRefresh }) {
  const [busy, setBusy] = useState('');
  if (!providers.length) {
    return (
      <div className="mp-empty">
        <Store size={30} />
        <h3>No listings yet</h3>
        <p>Once your application is approved, your listing appears here for you to manage.</p>
      </div>
    );
  }
  const toggleHidden = async (p) => {
    setBusy(p.id);
    try { await api.updateProvider(p.id, { hidden: !p.hidden }); onRefresh?.(); }
    catch { /* ignore */ }
    finally { setBusy(''); }
  };
  return (
    <div className="mp-grid">
      {providers.map((p) => (
        <div key={p.id} className="mp-listing">
          <div className="mp-listing-top">
            <div className="mp-listing-ico"><Store size={18} /></div>
            <div className="mp-listing-main">
              <div className="mp-listing-name">{p.business_name}</div>
              <div className="mp-listing-meta"><MapPin size={12} /> {[p.city, p.country].filter(Boolean).join(', ') || '—'}</div>
            </div>
            <span className={`mp-badge ${p.approval_status === 'approved' ? 'ok' : p.approval_status === 'rejected' ? 'no' : 'pend'}`}>
              {p.approval_status}
            </span>
          </div>
          <div className="mp-listing-stats">
            <div><Star size={13} /> {Number(p.rating || 0).toFixed(1)} <em>({p.review_count || 0})</em></div>
            <div>{p.hidden ? <EyeOff size={13} /> : <Eye size={13} />} {p.hidden ? 'Hidden' : 'Live'}</div>
            <div className="mp-cap">{p.price_range || '—'}</div>
          </div>
          {p.approval_status === 'approved' && (
            <button className="mp-listing-btn" onClick={() => toggleHidden(p)} disabled={busy === p.id}>
              {busy === p.id ? <Loader2 size={14} className="mp-spin" /> : p.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {p.hidden ? 'Make visible' : 'Hide listing'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Reviews -------------------------------- */
function ReviewsView({ providers }) {
  const [reviews, setReviews] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = [];
        for (const p of providers) {
          const r = await api.getProvider(p.id).catch(() => null);
          (r?.reviews || []).forEach((rv) => all.push({ ...rv, business: p.business_name }));
        }
        if (alive) setReviews(all);
      } catch { if (alive) setReviews([]); }
    })();
    return () => { alive = false; };
  }, [providers]);
  if (reviews === null) return <div className="mp-loading"><Loader2 className="mp-spin" size={22} /> Loading reviews…</div>;
  if (!reviews.length) return <div className="mp-empty"><Star size={30} /><h3>No reviews yet</h3><p>Patient reviews of your services will show up here.</p></div>;
  return (
    <div className="mp-rows">
      {reviews.map((r, i) => (
        <div key={i} className="mp-review">
          <div className="mp-review-head">
            <div className="mp-stars">{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={13} fill={k < (r.rating || 0) ? 'var(--gold)' : 'none'} color="var(--gold)" />)}</div>
            <span className="mp-review-biz">{r.business}</span>
          </div>
          {r.comment && <p className="mp-review-text">{r.comment}</p>}
          <div className="mp-review-by">{r.author_name || 'Anonymous'} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Analytics ------------------------------- */
function AnalyticsView({ providers }) {
  const totalReviews = providers.reduce((s, p) => s + (p.review_count || 0), 0);
  const avgRating = providers.length
    ? (providers.reduce((s, p) => s + Number(p.rating || 0), 0) / providers.length).toFixed(1) : '0.0';
  const live = providers.filter((p) => !p.hidden && p.approval_status === 'approved').length;
  const cards = [
    { icon: Store, label: 'Listings', value: providers.length, cls: 'teal' },
    { icon: Eye, label: 'Live', value: live, cls: 'teal' },
    { icon: Star, label: 'Avg rating', value: avgRating, cls: 'gold' },
    { icon: MessageSquare, label: 'Reviews', value: totalReviews, cls: 'ink' },
  ];
  return (
    <>
      <div className="mp-stats">
        {cards.map((c) => (
          <div key={c.label} className={`mp-stat ${c.cls}`}>
            <div className="mp-stat-ico"><c.icon size={18} /></div>
            <div><div className="mp-stat-val">{c.value}</div><div className="mp-stat-lbl">{c.label}</div></div>
          </div>
        ))}
      </div>
      <div className="mp-note"><TrendingUp size={15} /> Detailed performance trends (views, conversion, revenue) will grow here as you receive bookings. Remember, Solaris Health applies a 10% commission on completed bookings.</div>
    </>
  );
}

/* ------------------------------ Settings -------------------------------- */
function SettingsView({ user }) {
  return (
    <div className="mp-settings">
      <div className="mp-card">
        <div className="mp-card-h"><SettingsIcon size={15} /> Provider account</div>
        <div className="mp-set-row"><span>Account</span><b>{user?.fullName || user?.email}</b></div>
        <div className="mp-set-row"><span>Provider status</span><b className="mp-ok"><CheckCircle2 size={14} /> Approved</b></div>
        <div className="mp-set-row"><span>Approved on</span><b>{user?.providerApprovedAt ? new Date(user.providerApprovedAt).toLocaleDateString() : '—'}</b></div>
        <div className="mp-set-row"><span>Commission</span><b>10% per booking</b></div>
      </div>
      <div className="mp-note"><Clock size={15} /> To edit listing details, open a listing from <b>Listings</b>. Need to add another practice? Apply again from “Become a Provider”.</div>
    </div>
  );
}

/* ------------------------------ LUCA Copilot ---------------------------- */
const COPILOT_STARTERS = [
  'What should I prepare for today?',
  'Draft a warm follow-up message for a patient',
  'Summarize my practice this week',
  'Which patients are most engaged right now?',
];

function CopilotView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = React.useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getPractitionerLucaMessages();
        if (alive) setMessages(r?.messages || []);
      } catch { if (alive) setMessages([]); }
      finally { if (alive) setLoaded(true); }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await api.sendPractitionerLucaMessage(content);
      setMessages((m) => [...m, { role: 'assistant', content: res?.reply || '…', suggestions: res?.suggestions || [], created_at: new Date().toISOString() }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'I had trouble responding just now. Please try again in a moment.', created_at: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  return (
    <div className="mp-copilot">
      <div className="mp-copilot-head">
        <div className="mp-copilot-ava"><Bot size={18} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mp-copilot-title">LUCA Copilot — Your Practice Assistant</div>
          <div className="mp-copilot-sub">Drafts &amp; suggests — you review and decide</div>
        </div>
      </div>

      <div className="mp-copilot-body">
        {!loaded ? (
          <div className="mp-loading"><Loader2 className="mp-spin" size={22} /> Loading…</div>
        ) : messages.length === 0 ? (
          <div className="mp-copilot-empty">
            <div className="mp-copilot-ava lg"><Bot size={26} /></div>
            <div className="mp-copilot-welcome">How can I support your practice today?</div>
            <div className="mp-copilot-starters">
              {COPILOT_STARTERS.map((s) => (
                <button key={s} className="mp-chip" onClick={() => send(s)} disabled={sending}>{s}</button>
              ))}
            </div>
          </div>
        ) : messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} className={`mp-msg-row ${isUser ? 'user' : 'ai'}`}>
              {!isUser && <div className="mp-copilot-ava sm"><Bot size={14} /></div>}
              <div style={{ minWidth: 0, maxWidth: '84%' }}>
                <div className={`mp-bubble ${isUser ? 'user' : 'ai'}`}>{m.content}</div>
                {!isUser && i === messages.length - 1 && !sending && (m.suggestions || []).length > 0 && (
                  <div className="mp-suggests">
                    {m.suggestions.map((s, k) => (
                      <button key={k} className="mp-chip sm" onClick={() => { if (s.action === 'prefill_chat') setInput(s.label); else send(s.label); }} disabled={sending}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="mp-msg-row ai">
            <div className="mp-copilot-ava sm"><Bot size={14} /></div>
            <div className="mp-bubble ai">…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mp-copilot-footer">
        <div className="mp-copilot-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask LUCA about your practice…"
          />
          <button className="mp-send" onClick={() => send()} disabled={sending || !input.trim()}><Send size={15} /> Send</button>
        </div>
        <div className="mp-copilot-disc"><ShieldCheck size={12} /> LUCA drafts and suggests — you review and decide.</div>
      </div>
    </div>
  );
}

/* ------------------------------ My Patients ----------------------------- */
function PatientsView() {
  const [patients, setPatients] = useState(null);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [passport, setPassport] = useState(null); // {loading, data, error} for consent modal

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getProviderPatients();
        if (alive) setPatients(r?.patients || []);
      } catch { if (alive) setPatients([]); }
    })();
    return () => { alive = false; };
  }, []);

  const openPatient = async (p) => {
    setSelected(p);
    setHistory(null);
    try {
      const r = await api.getProviderPatientBookings(p.patientId);
      setHistory(r?.bookings || []);
    } catch { setHistory([]); }
  };

  const requestOrView = async (p) => {
    if (p.consentGranted) {
      setPassport({ loading: true, patient: p });
      try {
        const r = await api.getGrantedPassport(p.patientId);
        setPassport({ loading: false, patient: p, data: r?.passport });
      } catch (e) {
        setPassport({ loading: false, patient: p, error: e.message || 'Could not load Passport' });
      }
    } else {
      try {
        await api.requestConsent(p.patientId);
        toastLike('Access request sent — the member decides.');
        setPatients((list) => list.map((x) => x.patientId === p.patientId ? { ...x, requested: true } : x));
      } catch (e) {
        toastLike(e.message || 'Could not send request');
      }
    }
  };

  if (patients === null) return <div className="mp-loading"><Loader2 className="mp-spin" size={22} /> Loading patients…</div>;
  if (!patients.length) return <div className="mp-empty"><Users size={30} /><h3>No patients yet</h3><p>When members book with your listings, they'll appear here so you can follow their journey.</p></div>;

  return (
    <div className="mp-rows">
      {patients.map((p) => (
        <div key={p.patientId} className="mp-patient">
          <div className="mp-patient-row" onClick={() => openPatient(p)}>
            <div className="mp-row-ico"><UserIcon size={17} /></div>
            <div className="mp-row-main">
              <div className="mp-row-title">{p.name}</div>
              <div className="mp-row-sub">
                {p.bookingCount} booking{p.bookingCount === 1 ? '' : 's'}
                {p.lastBookingDate ? ` · last ${new Date(p.lastBookingDate).toLocaleDateString()}` : ''}
                {p.lastStatus ? ` · ${p.lastStatus}` : ''}
              </div>
            </div>
            {p.consentGranted
              ? <span className="mp-badge ok"><ShieldCheck size={11} /> Passport shared</span>
              : <span className="mp-badge pend">No access</span>}
          </div>

          {selected?.patientId === p.patientId && (
            <div className="mp-patient-detail">
              {history === null ? (
                <div className="mp-loading" style={{ padding: 18 }}><Loader2 className="mp-spin" size={18} /> Loading history…</div>
              ) : (
                <>
                  <div className="mp-detail-h">Booking history</div>
                  {history.length ? history.map((b) => (
                    <div key={b.id} className="mp-detail-row">
                      <span>{b.service_title}</span>
                      <span className="mp-detail-meta">{b.preferred_date ? new Date(b.preferred_date).toLocaleDateString() : 'TBD'} · {b.status}</span>
                    </div>
                  )) : <div className="mp-detail-empty">No bookings on record.</div>}
                  <div className="mp-detail-actions">
                    <button className="mp-act" onClick={() => requestOrView(p)}>
                      <ShieldCheck size={14} /> {p.consentGranted ? 'View Passport' : (p.requested ? 'Request sent' : 'Request Passport access')}
                    </button>
                    <button className="mp-act ghost"><MessageSquare size={14} /> Message</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {passport && (
        <ConsentedPassportView state={passport} onClose={() => setPassport(null)} />
      )}
    </div>
  );
}

function ConsentedPassportView({ state, onClose }) {
  const { loading, data, error, patient } = state;
  return (
    <div className="mp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mp-modal" role="dialog" aria-modal="true">
        <div className="mp-modal-head">
          <div className="mp-copilot-ava sm"><ShieldCheck size={14} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mp-modal-title">{patient?.name}'s Passport</div>
            <div className="mp-copilot-sub">Shared with your consent — for your clinical judgement</div>
          </div>
          <button className="mp-x" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <div className="mp-modal-body">
          {loading ? (
            <div className="mp-loading"><Loader2 className="mp-spin" size={22} /> Loading Passport…</div>
          ) : error ? (
            <div className="mp-detail-empty">{error}</div>
          ) : data ? (
            <>
              {data.assessment ? (
                <div className="mp-pcard">
                  <div className="mp-detail-h">Vitality assessment</div>
                  <div className="mp-vitals">
                    <div className="mp-vital"><b>{data.assessment.vitality_score ?? '—'}</b><span>Vitality</span></div>
                    <div className="mp-vital"><b>{data.assessment.mental_score ?? '—'}</b><span>Mind</span></div>
                    <div className="mp-vital"><b>{data.assessment.physical_score ?? '—'}</b><span>Body</span></div>
                    <div className="mp-vital"><b>{data.assessment.emotional_score ?? '—'}</b><span>Heart</span></div>
                    <div className="mp-vital"><b>{data.assessment.spiritual_score ?? '—'}</b><span>Spirit</span></div>
                  </div>
                  {(data.assessment.top_focus_areas_json || []).length > 0 && (
                    <div className="mp-focus">
                      {(data.assessment.top_focus_areas_json || []).map((f, i) => (
                        <span key={i} className="mp-badge ok">{typeof f === 'string' ? f : f.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : data.grantedSections?.includes('assessment') ? (
                <div className="mp-detail-empty">No assessment on record.</div>
              ) : null}

              {data.checkins ? (
                <div className="mp-pcard">
                  <div className="mp-detail-h">Recent check-ins</div>
                  {data.checkins.length ? data.checkins.slice(0, 7).map((c, i) => (
                    <div key={i} className="mp-detail-row">
                      <span>{new Date(c.checkin_date).toLocaleDateString()}</span>
                      <span className="mp-detail-meta">Energy {c.energy_score} · Mood {c.mood_score} · Sleep {c.sleep_hours}h</span>
                    </div>
                  )) : <div className="mp-detail-empty">No check-ins logged.</div>}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// tiny toast shim (MyPractice has no toast import) — falls back to console
function toastLike(msg) {
  try { window?.dispatchEvent?.(new CustomEvent('luca-toast', { detail: msg })); } catch { /* ignore */ }
  // eslint-disable-next-line no-console
  console.log('[MyPractice]', msg);
}

/* -------------------------------- Audio --------------------------------- */
function AudioView() {
  const [tracks, setTracks] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', tags: '', durationMins: '', isFree: true, fileName: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.getPractitionerAudio();
      setTracks(r?.tracks || []);
    } catch { setTracks([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || busy) return;
    setBusy(true);
    try {
      await api.uploadAudio({
        title: form.title.trim(),
        description: form.description.trim() || null,
        tags_json: form.tags,
        duration_seconds: form.durationMins ? Math.round(parseFloat(form.durationMins) * 60) : null,
        is_free: form.isFree,
        audio_url: form.fileName || null,
      });
      toastLike('Track published to your library.');
      setForm({ title: '', description: '', tags: '', durationMins: '', isFree: true, fileName: '' });
      load();
    } catch (err) {
      toastLike(err.message || 'Upload failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="mp-audio">
      <form className="mp-card" onSubmit={submit}>
        <div className="mp-card-h"><Upload size={15} /> Publish a practice recording</div>
        <label className="mp-field"><span>Title</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Morning grounding breath" required />
        </label>
        <label className="mp-field"><span>Description</span>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this practice offers…" />
        </label>
        <div className="mp-field-row">
          <label className="mp-field"><span>Tags (comma-separated)</span>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="breath, calm, sleep" />
          </label>
          <label className="mp-field sm"><span>Duration (min)</span>
            <input type="number" min="0" step="1" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: e.target.value })} placeholder="10" />
          </label>
        </div>
        <div className="mp-field-row">
          <label className="mp-field"><span>Audio file</span>
            <input type="file" accept="audio/*" onChange={(e) => setForm({ ...form, fileName: e.target.files?.[0]?.name || '' })} />
          </label>
          <label className="mp-toggle">
            <input type="checkbox" checked={form.isFree} onChange={(e) => setForm({ ...form, isFree: e.target.checked })} />
            <span>Offer for free</span>
          </label>
        </div>
        <button className="mp-send" type="submit" disabled={busy || !form.title.trim()}>
          {busy ? <Loader2 size={14} className="mp-spin" /> : <Upload size={14} />} Publish track
        </button>
      </form>

      <div className="mp-card-h" style={{ marginTop: 4 }}><Music size={15} /> Your library</div>
      {tracks === null ? (
        <div className="mp-loading"><Loader2 className="mp-spin" size={20} /> Loading…</div>
      ) : !tracks.length ? (
        <div className="mp-empty"><Music size={28} /><h3>No tracks yet</h3><p>Publish your first recording above to share it with members.</p></div>
      ) : (
        <div className="mp-rows">
          {tracks.map((t) => (
            <div key={t.id} className="mp-row">
              <div className="mp-row-ico"><Music size={16} /></div>
              <div className="mp-row-main">
                <div className="mp-row-title">{t.title}</div>
                <div className="mp-row-sub">
                  {t.duration_seconds ? `${Math.round(t.duration_seconds / 60)} min · ` : ''}
                  {t.is_free ? 'Free' : 'Premium'}
                  {(t.tags_json || []).length ? ` · ${(t.tags_json || []).join(', ')}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CSS = `
.luca .mp{display:flex;flex-direction:column;gap:18px}
.luca .mp-tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:2px}
.luca .mp-tab{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--muted);
  background:none;border:none;border-bottom:2px solid transparent;padding:9px 12px;cursor:pointer;margin-bottom:-1px}
.luca .mp-tab:hover{color:var(--ink)}
.luca .mp-tab.on{color:var(--teal-d);border-bottom-color:var(--teal-d)}
.luca .mp-loading,.luca .mp-empty{padding:48px;text-align:center;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:10px}
.luca .mp-empty h3{font-family:'Space Grotesk',sans-serif;font-size:18px;color:var(--ink);margin:6px 0 0}
.luca .mp-empty p{font-size:13px;color:var(--muted);margin:0;max-width:380px}
.luca .mp-spin{animation:mpspin 1s linear infinite}@keyframes mpspin{to{transform:rotate(360deg)}}
.luca .mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.luca .mp-listing{border:1px solid var(--line);border-radius:var(--r);padding:16px;background:var(--surface);display:flex;flex-direction:column;gap:12px}
.luca .mp-listing-top{display:flex;align-items:flex-start;gap:12px}
.luca .mp-listing-ico{width:40px;height:40px;border-radius:11px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex-shrink:0}
.luca .mp-listing-main{flex:1;min-width:0}
.luca .mp-listing-name{font-size:15px;font-weight:700;color:var(--ink)}
.luca .mp-listing-meta{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);margin-top:2px}
.luca .mp-badge{font-size:10.5px;font-weight:700;text-transform:capitalize;padding:3px 9px;border-radius:999px}
.luca .mp-badge.ok{color:var(--teal-d);background:var(--mint-soft)}
.luca .mp-badge.pend{color:var(--gold-ink);background:var(--gold-soft)}
.luca .mp-badge.no{color:var(--danger-ink);background:var(--danger-soft)}
.luca .mp-listing-stats{display:flex;gap:14px;font-size:12.5px;color:var(--muted-2)}
.luca .mp-listing-stats>div{display:flex;align-items:center;gap:5px}
.luca .mp-listing-stats em{font-style:normal;color:var(--muted)}
.luca .mp-cap{margin-left:auto;font-weight:700;color:var(--teal-d)}
.luca .mp-listing-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;color:var(--teal-d);background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:999px;padding:8px;cursor:pointer}
.luca .mp-rows{display:flex;flex-direction:column;gap:8px}
.luca .mp-row{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface)}
.luca .mp-row-ico{width:38px;height:38px;border-radius:10px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex-shrink:0}
.luca .mp-row-main{flex:1;min-width:0}
.luca .mp-row-title{font-size:14px;font-weight:600;color:var(--ink)}
.luca .mp-row-sub{font-size:12px;color:var(--muted);margin-top:2px}
.luca .mp-review{border:1px solid var(--line);border-radius:var(--r-sm);padding:14px;background:var(--surface)}
.luca .mp-review-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.luca .mp-stars{display:flex;gap:2px}
.luca .mp-review-biz{font-size:12px;color:var(--muted);font-weight:600}
.luca .mp-review-text{font-size:13px;color:var(--muted-2);line-height:1.6;margin:8px 0 6px}
.luca .mp-review-by{font-size:11.5px;color:var(--muted)}
.luca .mp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.luca .mp-stat{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.luca .mp-stat-ico{width:42px;height:42px;border-radius:12px;display:grid;place-items:center}
.luca .mp-stat.gold .mp-stat-ico{background:var(--gold-soft);color:var(--gold-ink)}
.luca .mp-stat.teal .mp-stat-ico{background:var(--mint-soft);color:var(--teal-d)}
.luca .mp-stat.ink .mp-stat-ico{background:var(--surface-2);color:var(--ink)}
.luca .mp-stat-val{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;color:var(--ink);line-height:1}
.luca .mp-stat-lbl{font-size:12px;color:var(--muted);margin-top:3px}
.luca .mp-note{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--muted-2);background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 14px}
.luca .mp-settings{display:flex;flex-direction:column;gap:14px;max-width:520px}
.luca .mp-card{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:16px}
.luca .mp-card-h{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2);margin-bottom:12px}
.luca .mp-set-row{display:flex;justify-content:space-between;align-items:center;font-size:13.5px;padding:9px 0;border-bottom:1px dashed var(--line)}
.luca .mp-set-row:last-child{border-bottom:none}
.luca .mp-set-row span{color:var(--muted)}.luca .mp-set-row b{color:var(--ink);display:flex;align-items:center;gap:5px}
.luca .mp-ok{color:var(--teal-d) !important}

/* ---- LUCA Copilot ---- */
.luca .mp-copilot{display:flex;flex-direction:column;height:min(620px,70vh);border:1px solid var(--line);border-radius:var(--r);background:var(--surface);overflow:hidden}
.luca .mp-copilot-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--surface-2)}
.luca .mp-copilot-ava{width:38px;height:38px;border-radius:11px;background:linear-gradient(170deg,#0E5C57,#0A413D);color:#DAF3EC;display:grid;place-items:center;flex:none}
.luca .mp-copilot-ava.sm{width:28px;height:28px;border-radius:9px}
.luca .mp-copilot-ava.lg{width:54px;height:54px;border-radius:15px}
.luca .mp-copilot-title{font-size:14.5px;font-weight:700;color:var(--ink)}
.luca .mp-copilot-sub{font-size:11.5px;color:var(--muted);margin-top:1px}
.luca .mp-copilot-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.luca .mp-copilot-empty{margin:auto;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;max-width:420px}
.luca .mp-copilot-welcome{font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:700;color:var(--ink)}
.luca .mp-copilot-starters{display:flex;flex-direction:column;gap:8px;width:100%}
.luca .mp-chip{font-size:13px;font-weight:600;color:var(--teal-d);background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:999px;padding:9px 14px;cursor:pointer;text-align:left}
.luca .mp-chip:hover{background:var(--mint-line)}
.luca .mp-chip.sm{font-size:12px;padding:6px 11px}
.luca .mp-msg-row{display:flex;gap:9px;align-items:flex-start}
.luca .mp-msg-row.user{flex-direction:row-reverse}
.luca .mp-bubble{padding:11px 14px;border-radius:14px;font-size:13.5px;line-height:1.55;white-space:pre-wrap}
.luca .mp-bubble.ai{background:var(--surface-2);color:var(--ink);border:1px solid var(--line);border-top-left-radius:4px}
.luca .mp-bubble.user{background:linear-gradient(170deg,#0E5C57,#0A413D);color:#EAFBF5;border-top-right-radius:4px}
.luca .mp-suggests{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.luca .mp-copilot-footer{border-top:1px solid var(--line);padding:12px 14px;background:var(--surface-2)}
.luca .mp-copilot-input{display:flex;gap:8px}
.luca .mp-copilot-input input{flex:1;border:1px solid var(--line);border-radius:999px;padding:10px 15px;font-size:13.5px;background:var(--surface);color:var(--ink)}
.luca .mp-send{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#EAFBF5;background:linear-gradient(170deg,#0E5C57,#0A413D);border:none;border-radius:999px;padding:10px 16px;cursor:pointer}
.luca .mp-send:disabled{opacity:.5;cursor:default}
.luca .mp-copilot-disc{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);margin-top:8px;justify-content:center}

/* ---- My Patients ---- */
.luca .mp-patient{border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);overflow:hidden}
.luca .mp-patient-row{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer}
.luca .mp-patient-row:hover{background:var(--surface-2)}
.luca .mp-patient-detail{border-top:1px dashed var(--line);padding:14px 16px;background:var(--surface-2)}
.luca .mp-detail-h{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2);margin-bottom:8px}
.luca .mp-detail-row{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:var(--ink);padding:6px 0;border-bottom:1px dashed var(--line)}
.luca .mp-detail-row:last-of-type{border-bottom:none}
.luca .mp-detail-meta{color:var(--muted);font-size:12px}
.luca .mp-detail-empty{font-size:13px;color:var(--muted);padding:8px 0}
.luca .mp-detail-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.luca .mp-act{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--teal-d);background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:999px;padding:8px 13px;cursor:pointer}
.luca .mp-act.ghost{color:var(--muted-2);background:var(--surface);border-color:var(--line)}

/* ---- Consented Passport modal ---- */
.luca .mp-modal-overlay{position:fixed;inset:0;background:rgba(10,30,28,.5);backdrop-filter:blur(3px);display:grid;place-items:center;z-index:120;padding:20px}
.luca .mp-modal{width:min(560px,100%);max-height:86vh;overflow:hidden;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);display:flex;flex-direction:column}
.luca .mp-modal-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--surface-2)}
.luca .mp-modal-title{font-size:15px;font-weight:700;color:var(--ink)}
.luca .mp-x{margin-left:auto;background:none;border:none;color:var(--muted);cursor:pointer;padding:4px}
.luca .mp-modal-body{padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
.luca .mp-pcard{border:1px solid var(--line);border-radius:var(--r-sm);padding:14px;background:var(--surface)}
.luca .mp-vitals{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;text-align:center}
.luca .mp-vital b{display:block;font-family:'Space Grotesk',sans-serif;font-size:20px;color:var(--ink)}
.luca .mp-vital span{font-size:10.5px;color:var(--muted)}
.luca .mp-focus{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}

/* ---- Audio ---- */
.luca .mp-audio{display:flex;flex-direction:column;gap:14px;max-width:620px}
.luca .mp-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
.luca .mp-field>span{font-size:12px;font-weight:600;color:var(--muted-2)}
.luca .mp-field input,.luca .mp-field textarea{border:1px solid var(--line);border-radius:var(--r-sm);padding:9px 12px;font-size:13.5px;background:var(--surface);color:var(--ink);font-family:inherit}
.luca .mp-field textarea{min-height:64px;resize:vertical}
.luca .mp-field-row{display:flex;gap:12px;align-items:flex-start}
.luca .mp-field-row .mp-field{flex:1}
.luca .mp-field-row .mp-field.sm{flex:0 0 130px}
.luca .mp-toggle{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink);padding-top:26px}
.luca .mp-toggle input{width:16px;height:16px}
`;
