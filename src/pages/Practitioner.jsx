import React, { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { Card, Spinner, Button, Pill, TBD, Wordmark, SolarisMark } from '../components/ui.jsx';
import {
  Stethoscope, Users, Calendar, Star, LogOut, CheckCircle2,
  ClipboardList, Building2, Sparkles, ChevronRight,
} from 'lucide-react';

const FOCUS_OPTIONS = [
  'Bioelectrical', 'Hydration', 'Circadian', 'Microbiome',
  'Respiratory', 'Neurological', 'Cardiovascular', 'Nutritional',
  'Mental', 'Emotional', 'Spiritual', 'Physical',
];

export default function Practitioner() {
  const { user, logout } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('dashboard'); // dashboard | profile | bookings
  const [profile, setProfile] = useState(null);
  const [listing, setListing] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({
    specialty: '', credentialsText: '', yearsExperience: '', bio: '',
    treatmentPhilosophy: '', shortDescription: '', city: '', country: '',
    price: '', focusAreas: [],
  });
  const [savedMsg, setSavedMsg] = useState('');

  const load = async () => {
    try {
      const [p, b] = await Promise.all([api.getPractitionerProfile(), api.getPractitionerBookings()]);
      setProfile(p.profile); setListing(p.listing); setBookings(b.bookings || []);
      if (p.profile) {
        setForm((f) => ({
          ...f,
          specialty: p.profile.specialty || '',
          credentialsText: p.profile.credentials_text || '',
          yearsExperience: p.profile.years_experience || '',
          bio: p.profile.bio || '',
          treatmentPhilosophy: p.profile.treatment_philosophy || '',
          shortDescription: p.listing?.short_description || '',
          city: p.listing?.city || '',
          country: p.listing?.country || '',
          price: p.listing?.price || '',
          focusAreas: p.listing?.focus_areas_json ? (Array.isArray(p.listing.focus_areas_json) ? p.listing.focus_areas_json : JSON.parse(p.listing.focus_areas_json)) : [],
        }));
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggleFocus = (f) => setForm((s) => ({
    ...s, focusAreas: s.focusAreas.includes(f) ? s.focusAreas.filter((x) => x !== f) : [...s.focusAreas, f],
  }));

  const save = async () => {
    setSaving(true); setSavedMsg('');
    try {
      await api.savePractitionerProfile({
        ...form,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : null,
        price: form.price ? Number(form.price) : null,
      });
      setSavedMsg('Profile submitted for review.');
      await load();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="sol-bg" style={{ minHeight: '100vh' }}><div className="app-frame"><div className="page"><Spinner label="Loading your practice…" /></div></div></div>;

  const onboarded = profile?.onboarding_status === 'submitted' || profile?.onboarding_status === 'approved';
  const pendingBookings = bookings.filter((b) => b.status === 'pending').length;

  return (
    <div className="sol-bg" style={{ minHeight: '100vh' }}>
      <div className="app-frame">
        {/* Top bar */}
        <div className="top-bar">
          <div className="row gap-2"><SolarisMark size={30} /><div><Wordmark size="1.1rem" /><div className="label muted" style={{ fontSize: '0.6rem', letterSpacing: '0.15em' }}>PRACTITIONER PORTAL</div></div></div>
          <Button variant="ghost" onClick={logout} style={{ padding: '0.4rem 0.6rem' }}><LogOut size={16} /></Button>
        </div>

        <div className="page col gap-4">
          {/* Greeting */}
          <div className="fade-up">
            <p className="muted" style={{ fontSize: '0.85rem' }}>Welcome back,</p>
            <h1 className="display" style={{ fontSize: '1.6rem' }}>{user?.fullName}</h1>
            <div className="row gap-2" style={{ marginTop: 6 }}>
              <Pill><Stethoscope size={12} /> Practitioner</Pill>
              <Pill variant={onboarded ? '' : 'gold'}>{onboarded ? (profile?.onboarding_status === 'approved' ? 'Approved' : 'In review') : 'Setup needed'}</Pill>
            </div>
          </div>

          {/* Tab switch */}
          <div className="row gap-2 fade-up delay-1">
            {[['dashboard', 'Dashboard'], ['profile', 'My Practice'], ['bookings', 'Bookings']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'chip-active' : ''}`} style={{ flex: 1 }}>{label}</button>
            ))}
          </div>

          {tab === 'dashboard' && (
            <>
              {!onboarded && (
                <Card glass className="fade-up" style={{ background: 'linear-gradient(160deg, rgba(255,185,95,0.12), rgba(12,19,34,0.5))' }}>
                  <div className="row gap-3">
                    <Sparkles size={22} color="var(--tertiary)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>Complete your practice profile</div>
                      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>Add your specialty, credentials and philosophy to be listed in the Solaris marketplace.</p>
                    </div>
                  </div>
                  <Button className="btn-block" style={{ marginTop: 12 }} onClick={() => setTab('profile')}>Start setup <ChevronRight size={16} /></Button>
                </Card>
              )}

              <div className="row gap-3 fade-up delay-1">
                <Card style={{ flex: 1 }} className="col gap-1">
                  <div className="row gap-2"><Calendar size={16} color="var(--primary)" /><span className="label muted">Pending</span></div>
                  <div className="display" style={{ fontSize: '1.8rem' }}>{pendingBookings}</div>
                </Card>
                <Card style={{ flex: 1 }} className="col gap-1">
                  <div className="row gap-2"><Users size={16} color="var(--secondary)" /><span className="label muted">Total requests</span></div>
                  <div className="display" style={{ fontSize: '1.8rem' }}>{bookings.length}</div>
                </Card>
              </div>

              <Card className="fade-up delay-2">
                <div className="between" style={{ marginBottom: 12 }}>
                  <p className="eyebrow">Your listing</p>
                  {listing && <Pill variant={listing.status === 'active' ? '' : 'gold'}>{listing.status}</Pill>}
                </div>
                {listing ? (
                  <div className="col gap-2">
                    <div className="row gap-3">
                      <div className="center" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(78,222,163,0.12)' }}><Building2 size={20} color="var(--primary)" /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{listing.title}</div>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>{listing.specialty} · {listing.city || '—'}{listing.country ? ', ' + listing.country : ''}</div>
                      </div>
                      <div className="row gap-1"><Star size={14} color="var(--tertiary)" /><span style={{ fontWeight: 700 }}>{Number(listing.rating || 0).toFixed(1)}</span></div>
                    </div>
                  </div>
                ) : <p className="muted" style={{ fontSize: '0.85rem' }}>No listing yet. Complete your practice profile to create one.</p>}
              </Card>

              <Card className="fade-up delay-3">
                <p className="eyebrow" style={{ marginBottom: 10 }}>Practice tools</p>
                {['Patient records access', 'Treatment notes & care plans', 'Availability & scheduling', 'Payouts & earnings'].map((t) => (
                  <div key={t} className="between" style={{ padding: '0.8rem 0', borderBottom: '1px solid rgba(220,226,248,0.05)' }}>
                    <div className="row gap-2"><ClipboardList size={15} color="var(--outline)" /><span style={{ fontSize: '0.88rem' }}>{t}</span></div>
                    <TBD label="soon" />
                  </div>
                ))}
              </Card>
            </>
          )}

          {tab === 'profile' && (
            <Card className="fade-up col gap-3">
              <p className="eyebrow">Practice profile</p>
              {savedMsg && <div className="row gap-2" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}><CheckCircle2 size={16} /> {savedMsg}</div>}
              <Field label="Specialty"><input className="input" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="e.g. Functional Medicine, Acupuncture" /></Field>
              <Field label="Short description"><input className="input" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} placeholder="One-line summary for your card" /></Field>
              <Field label="Bio / full description"><textarea className="input" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Tell patients about your approach" /></Field>
              <Field label="Credentials"><input className="input" value={form.credentialsText} onChange={(e) => setForm({ ...form, credentialsText: e.target.value })} placeholder="e.g. MD, LAc, RD" /></Field>
              <Field label="Treatment philosophy"><textarea className="input" rows={2} value={form.treatmentPhilosophy} onChange={(e) => setForm({ ...form, treatmentPhilosophy: e.target.value })} /></Field>
              <div className="row gap-2">
                <Field label="Years experience" style={{ flex: 1 }}><input className="input" type="number" value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} /></Field>
                <Field label="Session price ($)" style={{ flex: 1 }}><input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
              </div>
              <div className="row gap-2">
                <Field label="City" style={{ flex: 1 }}><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
                <Field label="Country" style={{ flex: 1 }}><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
              </div>
              <Field label="Focus areas">
                <div className="row wrap gap-2">
                  {FOCUS_OPTIONS.map((f) => (
                    <button key={f} onClick={() => toggleFocus(f)} className={`chip ${form.focusAreas.includes(f) ? 'chip-active' : ''}`} style={{ fontSize: '0.72rem' }}>{f}</button>
                  ))}
                </div>
              </Field>
              <Button className="btn-block" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & submit for review'}</Button>
            </Card>
          )}

          {tab === 'bookings' && (
            <Card className="fade-up">
              <p className="eyebrow" style={{ marginBottom: 12 }}>Booking requests</p>
              <div className="col gap-2">
                {bookings.length === 0 && <p className="muted" style={{ fontSize: '0.85rem' }}>No booking requests yet.</p>}
                {bookings.map((b) => (
                  <div key={b.id} className="row gap-3 card-low" style={{ padding: '0.8rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                    <Users size={16} color="var(--secondary)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{b.patient_name || 'Patient'}</div>
                      <div className="muted" style={{ fontSize: '0.76rem' }}>{b.listing_title} · {b.preferred_date ? new Date(b.preferred_date).toLocaleDateString() : 'Flexible'}</div>
                    </div>
                    <Pill variant={b.status === 'confirmed' ? '' : 'muted'}>{b.status}</Pill>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="text-center muted" style={{ fontSize: '0.7rem', marginTop: 8 }}>Solaris Practitioner Portal · MVP v1</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <label className="col gap-1" style={style}>
      <span className="label muted" style={{ fontSize: '0.7rem' }}>{label}</span>
      {children}
    </label>
  );
}
