import React, { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { Card, Spinner, Button, Pill, TBD, Wordmark, SolarisMark } from '../components/ui.jsx';
import {
  Users, Building2, Calendar, ClipboardCheck, LogOut, Heart,
  ShieldCheck, Activity, CheckCircle2, XCircle,
} from 'lucide-react';

export default function Admin() {
  const { user, logout } = useApp();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);

  const load = async () => {
    try {
      const [o, u, l, b] = await Promise.all([
        api.getAdminOverview(), api.getAdminUsers(), api.getAdminListings(), api.getAdminBookings(),
      ]);
      setStats(o.stats); setUsers(u.users || []); setListings(l.listings || []); setBookings(b.bookings || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const setListingStatus = async (id, status) => {
    await api.updateAdminListing(id, status);
    await load();
  };

  if (loading) return <div className="sol-bg" style={{ minHeight: '100vh' }}><div className="app-frame"><div className="page"><Spinner label="Loading admin console…" /></div></div></div>;

  const STAT_CARDS = stats ? [
    { label: 'Members', value: stats.users, icon: Users, color: 'var(--primary)' },
    { label: 'Patients', value: stats.patients, icon: Heart, color: 'var(--secondary)' },
    { label: 'Practitioners', value: stats.practitioners, icon: ShieldCheck, color: 'var(--tertiary)' },
    { label: 'Listings', value: stats.listings, icon: Building2, color: 'var(--primary)' },
    { label: 'Bookings', value: stats.bookings, icon: Calendar, color: 'var(--secondary)' },
    { label: 'Assessments', value: stats.assessments, icon: Activity, color: 'var(--tertiary)' },
  ] : [];

  return (
    <div className="sol-bg" style={{ minHeight: '100vh' }}>
      <div className="app-frame">
        <div className="top-bar">
          <div className="row gap-2"><SolarisMark size={30} /><div><Wordmark size="1.1rem" /><div className="label muted" style={{ fontSize: '0.6rem', letterSpacing: '0.15em' }}>ADMIN CONSOLE</div></div></div>
          <Button variant="ghost" onClick={logout} style={{ padding: '0.4rem 0.6rem' }}><LogOut size={16} /></Button>
        </div>

        <div className="page col gap-4">
          <div className="fade-up">
            <p className="muted" style={{ fontSize: '0.85rem' }}>Signed in as admin</p>
            <h1 className="display" style={{ fontSize: '1.6rem' }}>Solaris Operations</h1>
          </div>

          <div className="row gap-2 fade-up delay-1" style={{ overflowX: 'auto' }}>
            {[['overview', 'Overview'], ['users', 'Users'], ['listings', 'Listings'], ['bookings', 'Bookings']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'chip-active' : ''}`} style={{ flex: '0 0 auto' }}>{label}</button>
            ))}
          </div>

          {tab === 'overview' && (
            <>
              <div className="row wrap gap-3 fade-up">
                {STAT_CARDS.map((s) => (
                  <Card key={s.label} style={{ flex: '1 1 44%' }} className="col gap-1">
                    <div className="row gap-2"><s.icon size={16} color={s.color} /><span className="label muted">{s.label}</span></div>
                    <div className="display" style={{ fontSize: '1.8rem' }}>{s.value}</div>
                  </Card>
                ))}
              </div>
              <Card glass className="fade-up delay-2" style={{ background: 'linear-gradient(160deg, rgba(255,185,95,0.12), rgba(12,19,34,0.5))' }}>
                <div className="between">
                  <div><p className="label gold">Total LOVE Points issued</p><div className="display" style={{ fontSize: '2rem', marginTop: 2 }}>{stats.lovePoints}</div></div>
                  <Heart size={28} color="var(--tertiary)" />
                </div>
              </Card>
              <Card className="fade-up delay-3">
                <p className="eyebrow" style={{ marginBottom: 10 }}>Platform tools</p>
                {['Content moderation queue', 'Revenue & payouts', 'Data export / FHIR audit', 'Notifications & broadcasts'].map((t) => (
                  <div key={t} className="between" style={{ padding: '0.8rem 0', borderBottom: '1px solid rgba(220,226,248,0.05)' }}>
                    <span style={{ fontSize: '0.88rem' }}>{t}</span><TBD label="soon" />
                  </div>
                ))}
              </Card>
            </>
          )}

          {tab === 'users' && (
            <Card className="fade-up">
              <p className="eyebrow" style={{ marginBottom: 12 }}>Members ({users.length})</p>
              <div className="col gap-2">
                {users.map((u) => (
                  <div key={u.id} className="row gap-3 card-low" style={{ padding: '0.7rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                    <div className="avatar center" style={{ width: 36, height: 36, fontSize: '0.8rem', color: 'var(--primary)' }}>{(u.full_name || u.email)[0]?.toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.full_name || '—'}</div>
                      <div className="muted" style={{ fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Pill variant={u.role === 'admin' ? 'gold' : u.role === 'practitioner' ? '' : 'muted'}>{u.role}</Pill>
                      <span className="mint" style={{ fontSize: '0.72rem', fontWeight: 700 }}>{u.love_points || 0} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'listings' && (
            <Card className="fade-up">
              <p className="eyebrow" style={{ marginBottom: 12 }}>Listings ({listings.length})</p>
              <div className="col gap-2">
                {listings.map((l) => (
                  <div key={l.id} className="card-low col gap-2" style={{ padding: '0.8rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                    <div className="row gap-3">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{l.title}</div>
                        <div className="muted" style={{ fontSize: '0.74rem' }}>{l.listing_type} · {l.specialty || '—'} · {l.city || '—'}</div>
                      </div>
                      <Pill variant={l.status === 'active' ? '' : l.status === 'review' ? 'gold' : 'muted'}>{l.status}</Pill>
                    </div>
                    {l.status !== 'active' && (
                      <div className="row gap-2">
                        <Button variant="primary" style={{ flex: 1, padding: '0.45rem' }} onClick={() => setListingStatus(l.id, 'active')}><CheckCircle2 size={14} /> Approve</Button>
                        <Button variant="ghost" style={{ flex: 1, padding: '0.45rem' }} onClick={() => setListingStatus(l.id, 'rejected')}><XCircle size={14} /> Reject</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'bookings' && (
            <Card className="fade-up">
              <p className="eyebrow" style={{ marginBottom: 12 }}>Bookings ({bookings.length})</p>
              <div className="col gap-2">
                {bookings.length === 0 && <p className="muted" style={{ fontSize: '0.85rem' }}>No bookings yet.</p>}
                {bookings.map((b) => (
                  <div key={b.id} className="row gap-3 card-low" style={{ padding: '0.7rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                    <ClipboardCheck size={16} color="var(--secondary)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{b.listing_title || 'Booking'}</div>
                      <div className="muted" style={{ fontSize: '0.74rem' }}>{b.patient_name || 'Patient'} · {b.preferred_date ? new Date(b.preferred_date).toLocaleDateString() : 'Flexible'}</div>
                    </div>
                    <Pill variant={b.status === 'confirmed' ? '' : 'muted'}>{b.status}</Pill>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="text-center muted" style={{ fontSize: '0.7rem', marginTop: 8 }}>Solaris Admin Console · MVP v1</p>
        </div>
      </div>
    </div>
  );
}
