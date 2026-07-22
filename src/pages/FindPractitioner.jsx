import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Spinner, Chip, Pill } from '../components/ui.jsx';
import { Search, Star, MapPin, ArrowRight, ShieldCheck, Sparkles, Leaf } from 'lucide-react';

// Warm, human labels for each provider type
const TYPE_LABELS = {
  clinic: 'Clinic', doctor: 'Doctor', dentist: 'Dentist', nutritionist: 'Nutritionist',
  therapist: 'Therapist', wellness: 'Wellness Center', gym: 'Gym & Fitness',
  spa: 'Spa & Recovery', farm: 'Organic Farm', workshop: 'Workshop',
};

const FALLBACK_COVER = 'linear-gradient(135deg, #0e3b32, #10b981)';

export default function FindPractitioner() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [types, setTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (type !== 'all') params.type = type;
      const { practitioners } = await api.getPublicPractitioners(params);
      setRows(practitioners || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.getPublicPractitionerTypes().then(({ types }) => setTypes(types || [])).catch(() => {});
  }, []);

  // Reload when the type filter changes (search box reloads on Enter / button)
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type]);

  const openBooking = () => {
    // Public visitors are guided into the sanctuary to book; members land in their hub.
    window.location.href = '/';
  };

  return (
    <div className="app-frame" style={{ paddingBottom: 40, minHeight: '100vh' }}>
      <div className="sol-bg" />
      <div className="page col gap-3" style={{ minHeight: '100vh' }}>

        {/* Header / brand */}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', paddingTop: 14 }}>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <img src="/solaris-logo.png" alt="Solaris Holistic Health" style={{ width: 40, height: 40, objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(47,190,159,0.4))' }} />
            <div>
              <p className="wordmark" style={{ fontSize: '1.1rem', letterSpacing: '.16em', margin: 0 }}>SOLARIS</p>
              <p style={{ color: 'rgba(47,190,159,0.8)', fontSize: '0.6rem', letterSpacing: '.18em', textTransform: 'uppercase', margin: 0 }}>Holistic Health</p>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '0.5rem 1rem' }} onClick={() => { window.location.href = '/'; }}>
            Sign in <ArrowRight size={15} />
          </button>
        </div>

        {/* Hero */}
        <div className="fade-up" style={{ textAlign: 'center', margin: '18px 0 4px' }}>
          <p className="eyebrow gold" style={{ marginBottom: 8 }}>The Solaris Directory</p>
          <h1 className="display" style={{ fontSize: '2rem', lineHeight: 1.1 }}>Find Your Wellness Guide</h1>
          <p className="muted" style={{ fontSize: '0.95rem', maxWidth: 460, margin: '12px auto 0' }}>
            Meet practitioners devoted to integrative, root-cause care — tending Mind, Body, Heart, and Spirit. Browse freely; no account needed.
          </p>
        </div>

        {/* Search */}
        <div className="glass row gap-2 fade-up" style={{ padding: '0.3rem 0.3rem 0.3rem 1rem', borderRadius: 999, marginTop: 8 }}>
          <Search size={18} color="var(--outline)" />
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Search by name, focus, or city..."
            style={{ background: 'transparent', border: 'none', boxShadow: 'none', flex: 1 }}
          />
          <button className="btn" style={{ padding: '0.6rem 1.2rem' }} onClick={load}>Search</button>
        </div>

        {/* Type filters */}
        <div className="scroll-x fade-up delay-1">
          <Chip active={type === 'all'} onClick={() => setType('all')}>All</Chip>
          {types.map((t) => (
            <Chip key={t.provider_type} active={type === t.provider_type} onClick={() => setType(t.provider_type)}>
              {TYPE_LABELS[t.provider_type] || t.provider_type} ({t.n})
            </Chip>
          ))}
        </div>

        {/* Results */}
        {loading ? <Spinner label="Gathering guides..." /> : (
          <>
            <div className="practitioner-grid">
              {rows.map((p) => (
                <PractitionerCard key={p.id} p={p} onBook={openBooking} />
              ))}
            </div>
            {rows.length === 0 && (
              <div className="card text-center" style={{ padding: '2rem 1.4rem' }}>
                <Leaf size={26} color="var(--primary)" style={{ marginBottom: 8 }} />
                <p className="muted">No practitioners match your search just yet. Try a broader term.</p>
              </div>
            )}
          </>
        )}

        {/* Footer CTA */}
        <div className="card glass fade-up text-center" style={{ marginTop: 12, padding: '1.8rem 1.4rem', background: 'linear-gradient(160deg, rgba(16,185,129,0.12), rgba(12,19,34,0.5))' }}>
          <Sparkles size={24} color="var(--primary)" style={{ marginBottom: 8 }} />
          <h3 className="serif" style={{ fontSize: '1.2rem' }}>Ready to begin your journey?</h3>
          <p className="muted" style={{ fontSize: '0.88rem', margin: '6px 0 14px' }}>
            Create your free Solaris Passport to book sessions and meet LUCA, your AI wellness companion.
          </p>
          <button className="btn" style={{ padding: '0.7rem 1.6rem' }} onClick={() => { window.location.href = '/'; }}>
            Claim my Passport <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <style>{`
        .practitioner-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1rem;
          margin-top: 4px;
        }
        @media (max-width: 560px) { .practitioner-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function PractitionerCard({ p, onBook }) {
  const label = TYPE_LABELS[p.provider_type] || p.provider_type;
  const specialties = Array.isArray(p.specialties) ? p.specialties : [];
  const cover = p.cover_photo_url || p.profile_photo_url;

  return (
    <div className="card fade-up" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 120, background: cover ? `url(${cover}) center/cover` : FALLBACK_COVER, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,19,34,0.9), transparent 65%)' }} />
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
          <Pill variant="gold">{label}</Pill>
          {p.vtv_certified && <Pill>VTV</Pill>}
        </div>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <h3 className="serif" style={{ fontSize: '1.05rem', lineHeight: 1.2 }}>{p.business_name}</h3>
          {p.verified && <ShieldCheck size={16} color="var(--primary)" title="Verified" style={{ flexShrink: 0, marginTop: 2 }} />}
        </div>

        {p.description && (
          <p className="muted" style={{ fontSize: '0.82rem', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {p.description}
          </p>
        )}

        {specialties.length > 0 && (
          <div className="row" style={{ flexWrap: 'wrap', gap: 5 }}>
            {specialties.slice(0, 3).map((s, idx) => (
              <span key={idx} className="pill muted" style={{ fontSize: '0.68rem' }}>{s}</span>
            ))}
          </div>
        )}

        <div className="row gap-3" style={{ marginTop: 2, fontSize: '0.78rem' }}>
          {Number(p.rating) > 0 && (
            <span className="row gap-1"><Star size={13} color="var(--tertiary)" fill="var(--tertiary)" /> {Number(p.rating).toFixed(1)} ({p.review_count || 0})</span>
          )}
          {p.city && <span className="row gap-1 muted"><MapPin size={13} /> {p.city}</span>}
          {p.price_range && <span className="muted">{p.price_range}</span>}
        </div>

        <button className="btn btn-block" style={{ marginTop: 'auto' }} onClick={onBook}>
          Book a Session <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
