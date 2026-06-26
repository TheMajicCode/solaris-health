import React, { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { Card, Spinner, Button, Pill, TBD } from '../components/ui.jsx';
import { Award, Gift, Calendar, Shield, LogOut, ChevronRight, Sparkles, Flame, Heart, Star } from 'lucide-react';

const BADGES = [
  { key: 'explorer', name: 'Solaris Explorer', icon: Sparkles, earned: true },
  { key: 'rhythm', name: 'Rhythm Restorer', icon: Flame, earned: true },
  { key: 'hydration', name: 'Hydration Builder', icon: Heart, earned: false },
  { key: 'seeker', name: 'Healing Seeker', icon: Star, earned: false },
];

export default function Profile() {
  const { user, logout } = useApp();
  const [rewards, setRewards] = useState({ events: [], total: 0 });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, b] = await Promise.all([api.getRewards(), api.getBookings()]);
        setRewards(r); setBookings(b.bookings || []);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="page"><Spinner /></div>;

  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');

  return (
    <div className="page col gap-4">
      {/* Header */}
      <div className="center col text-center fade-up" style={{ gap: 10, marginTop: 8 }}>
        <div className="avatar center" style={{ width: 84, height: 84, fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)' }}>{initials}</div>
        <div>
          <h1 className="display" style={{ fontSize: '1.5rem' }}>{user?.fullName}</h1>
          <p className="muted" style={{ fontSize: '0.85rem' }}>{user?.email}</p>
        </div>
        <div className="row gap-2">
          <Pill><Shield size={12} /> {user?.role}</Pill>
          <Pill variant="gold">{user?.currentPhase}</Pill>
        </div>
      </div>

      {/* LOVE points */}
      <Card glass className="fade-up delay-1" style={{ background: 'linear-gradient(160deg, rgba(255,185,95,0.12), rgba(12,19,34,0.5))' }}>
        <div className="between">
          <div>
            <p className="label gold">LOVE Points</p>
            <div className="display" style={{ fontSize: '2.2rem', marginTop: 2 }}>{rewards.total}</div>
          </div>
          <div className="center floaty" style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,185,95,0.15)' }}>
            <Gift size={26} color="var(--tertiary)" />
          </div>
        </div>
      </Card>

      {/* Badges */}
      <Card className="fade-up delay-2">
        <p className="eyebrow" style={{ marginBottom: 14 }}>Badges</p>
        <div className="row wrap gap-2">
          {BADGES.map((b) => (
            <div key={b.key} className="card-low col center text-center gap-1" style={{ flex: '1 1 44%', padding: '1rem', borderRadius: 'var(--radius-sm)', opacity: b.earned ? 1 : 0.4 }}>
              <b.icon size={22} color={b.earned ? 'var(--primary)' : 'var(--outline)'} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{b.name}</span>
              {b.earned ? <span className="label mint" style={{ fontSize: '0.6rem' }}>Earned</span> : <span className="label muted" style={{ fontSize: '0.6rem' }}>Locked</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Bookings */}
      <Card className="fade-up delay-3">
        <p className="eyebrow" style={{ marginBottom: 12 }}>My Bookings</p>
        <div className="col gap-2">
          {bookings.length === 0 && <p className="muted" style={{ fontSize: '0.85rem' }}>No bookings yet. Explore the marketplace to book care.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="row gap-3 card-low" style={{ padding: '0.8rem 1rem', borderRadius: 'var(--radius-sm)' }}>
              <Calendar size={16} color="var(--secondary)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{b.listing_title || 'Booking'}</div>
                <div className="muted" style={{ fontSize: '0.76rem' }}>{b.preferred_date ? new Date(b.preferred_date).toLocaleDateString() : 'Flexible'} · {b.preferred_time || 'TBD'}</div>
              </div>
              <Pill variant={b.status === 'confirmed' ? '' : 'muted'}>{b.status}</Pill>
            </div>
          ))}
        </div>
      </Card>

      {/* Reward ledger */}
      <Card className="fade-up delay-3">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Recent Rewards</p>
        <div className="col gap-1">
          {rewards.events.slice(0, 6).map((e) => (
            <div key={e.id} className="between" style={{ padding: '0.5rem 0', borderBottom: '1px solid rgba(220,226,248,0.05)' }}>
              <div className="row gap-2"><Award size={14} color="var(--primary)" /><span style={{ fontSize: '0.84rem' }}>{e.note || e.event_type}</span></div>
              <span className="mint" style={{ fontWeight: 700, fontSize: '0.84rem' }}>+{e.points}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Settings */}
      <Card className="fade-up delay-4">
        <p className="eyebrow" style={{ marginBottom: 8 }}>Settings & Privacy</p>
        {['Account details', 'Consents & privacy', 'Payment methods', 'Notifications'].map((s) => (
          <div key={s} className="between" style={{ padding: '0.8rem 0', borderBottom: '1px solid rgba(220,226,248,0.05)', cursor: 'pointer' }}>
            <span style={{ fontSize: '0.88rem' }}>{s}</span>
            <div className="row gap-2"><TBD label="soon" /><ChevronRight size={16} color="var(--outline)" /></div>
          </div>
        ))}
      </Card>

      <Button variant="ghost" className="btn-block fade-up delay-5" onClick={logout} style={{ color: 'var(--error)' }}>
        <LogOut size={16} /> Sign out
      </Button>
      <p className="text-center muted" style={{ fontSize: '0.7rem' }}>Solaris Holistic Health · MVP v1 · FHIR-aligned · Sovereignty-ready</p>
    </div>
  );
}
