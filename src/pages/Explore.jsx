import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card, Spinner, Button, Chip, Pill } from '../components/ui.jsx';
import { Search, Star, MapPin, ArrowRight, Bot, X, Check, Heart } from 'lucide-react';

const FILTERS = [
  { key: 'practitioner', label: 'Practitioners' }, { key: 'clinic', label: 'Clinics' },
  { key: 'service', label: 'Services' }, { key: 'workshop', label: 'Workshops' },
  { key: 'place', label: 'Places' }, { key: 'all', label: 'All' },
];

export default function Explore() {
  const [filter, setFilter] = useState('practitioner');
  const [q, setQ] = useState('');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { listings } = await api.getListings({ type: filter, q }); setListings(listings || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const featured = listings.find((l) => l.featured) || listings[0];
  const rest = listings.filter((l) => l !== featured);

  return (
    <div className="page col gap-3">
      <div className="fade-up">
        <p className="eyebrow gold">Curation</p>
        <h1 className="display" style={{ fontSize: '1.7rem', marginTop: 4 }}>Health Marketplace</h1>
      </div>

      {/* Search */}
      <div className="glass row gap-2 fade-up" style={{ padding: '0.3rem 0.3rem 0.3rem 1rem', borderRadius: 999 }}>
        <Search size={18} color="var(--outline)" />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Search practitioners, clinics…" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }} />
        <button className="btn" style={{ padding: '0.6rem 1.1rem' }} onClick={load}>Explore</button>
      </div>

      {/* Filters */}
      <div className="scroll-x fade-up delay-1">
        {FILTERS.map((f) => <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</Chip>)}
      </div>

      {loading ? <Spinner /> : (
        <>
          {featured && <FeaturedCard l={featured} onOpen={() => setSelected(featured)} />}
          <div className="col gap-3">
            {rest.map((l) => <ListingCard key={l.id} l={l} onOpen={() => setSelected(l)} />)}
          </div>
          {listings.length === 0 && <Card className="text-center"><p className="muted">No listings found.</p></Card>}
        </>
      )}

      {/* Ask LUCA */}
      <Card glass className="text-center fade-up" style={{ background: 'linear-gradient(160deg, rgba(16,185,129,0.12), rgba(12,19,34,0.5))', padding: '1.8rem 1.4rem' }}>
        <Bot size={26} color="var(--primary)" style={{ marginBottom: 8 }} />
        <h3 className="serif" style={{ fontSize: '1.2rem' }}>Can't find what you need?</h3>
        <p className="muted" style={{ fontSize: '0.85rem', margin: '6px 0 14px' }}>Let LUCA, your AI Health Concierge, find the perfect match.</p>
        <Button variant="ghost" className="btn-block">Ask LUCA</Button>
      </Card>

      {selected && <DetailSheet l={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FeaturedCard({ l, onOpen }) {
  return (
    <div className="card fade-up delay-2" onClick={onOpen} style={{ overflow: 'hidden', padding: 0, cursor: 'pointer' }}>
      <div style={{ height: 170, background: l.cover_image_url ? `url(${l.cover_image_url}) center/cover` : 'linear-gradient(135deg,#0e3b32,#10b981)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,19,34,0.95), transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
          <Pill variant="gold">Featured</Pill>
          <h2 className="serif" style={{ fontSize: '1.5rem', marginTop: 8 }}>{l.title}</h2>
          <div className="row gap-3" style={{ marginTop: 4 }}>
            <span className="row gap-1" style={{ fontSize: '0.8rem' }}><Star size={13} color="var(--tertiary)" fill="var(--tertiary)" /> {l.rating} ({l.reviews_count})</span>
            <span className="row gap-1 muted" style={{ fontSize: '0.8rem' }}><MapPin size={13} /> {l.city}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingCard({ l, onOpen }) {
  return (
    <Card className="row gap-3 fade-up" onClick={onOpen} style={{ cursor: 'pointer', alignItems: 'center' }}>
      <div className="center" style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: 'linear-gradient(135deg,#0e3b32,#10b981)', fontWeight: 700, color: '#00271a', fontSize: '1.2rem' }}>
        {l.title[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>{l.title}</div>
        <div className="label mint" style={{ marginTop: 2 }}>{l.specialty || l.listing_type}</div>
        <div className="row gap-3" style={{ marginTop: 6 }}>
          <span className="row gap-1" style={{ fontSize: '0.76rem' }}><Star size={12} color="var(--tertiary)" fill="var(--tertiary)" /> {l.rating}</span>
          {l.city && <span className="row gap-1 muted" style={{ fontSize: '0.76rem' }}><MapPin size={12} /> {l.city}</span>}
          {l.price && <span className="gold" style={{ fontSize: '0.76rem', fontWeight: 600 }}>${l.price}</span>}
        </div>
      </div>
      <ArrowRight size={18} color="var(--outline)" />
    </Card>
  );
}

function DetailSheet({ l, onClose }) {
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ preferredDate: '', preferredTime: '', note: '' });
  const book = async () => {
    setBooking(true);
    try { await api.createBooking({ listingId: l.id, ...form }); setDone(true); }
    finally { setBooking(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(6,10,18,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} className="glass" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px 24px 0 0', padding: '1.5rem', animation: 'fadeUp 0.4s var(--ease)' }}>
        <div className="between" style={{ marginBottom: 14 }}>
          <Pill variant="muted">{l.listing_type}</Pill>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--outline)" /></button>
        </div>
        <div style={{ height: 130, borderRadius: 'var(--radius-md)', background: l.cover_image_url ? `url(${l.cover_image_url}) center/cover` : 'linear-gradient(135deg,#0e3b32,#10b981)', marginBottom: 14 }} />
        <h2 className="serif" style={{ fontSize: '1.5rem' }}>{l.title}</h2>
        <div className="label mint" style={{ marginTop: 4 }}>{l.specialty || l.listing_type}</div>
        <div className="row gap-3" style={{ margin: '10px 0' }}>
          <span className="row gap-1" style={{ fontSize: '0.82rem' }}><Star size={14} color="var(--tertiary)" fill="var(--tertiary)" /> {l.rating} ({l.reviews_count} reviews)</span>
          {l.city && <span className="row gap-1 muted" style={{ fontSize: '0.82rem' }}><MapPin size={14} /> {l.city}</span>}
        </div>
        <p className="muted" style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 16 }}>{l.full_description || l.short_description}</p>

        {(l.focus_areas_json?.length > 0) && (
          <div className="row wrap gap-2" style={{ marginBottom: 18 }}>
            {l.focus_areas_json.map((f, i) => <span key={i} className="pill muted">{f}</span>)}
          </div>
        )}

        {done ? (
          <div className="card-low text-center" style={{ padding: '1.4rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(78,222,163,0.2)' }}>
            <Check size={28} color="var(--primary)" style={{ marginBottom: 8 }} />
            <h3 className="serif" style={{ fontSize: '1.1rem' }}>Booking requested!</h3>
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>The Solaris team will confirm shortly. +30 LOVE points earned.</p>
            <Button className="btn-block" style={{ marginTop: 14 }} onClick={onClose}>Done</Button>
          </div>
        ) : !booking ? (
          <>
            {l.price && <div className="between card-low" style={{ padding: '0.9rem 1.1rem', borderRadius: 'var(--radius-sm)', marginBottom: 14 }}>
              <span className="muted" style={{ fontSize: '0.85rem' }}>{l.duration_minutes ? `${l.duration_minutes} min session` : 'Session'}</span>
              <span className="gold" style={{ fontWeight: 700, fontSize: '1.1rem' }}>${l.price}</span>
            </div>}
            <Button className="btn-block" onClick={() => setBooking(true)} disabled={!l.booking_enabled}>
              Request Booking <ArrowRight size={17} />
            </Button>
          </>
        ) : (
          <div className="col gap-3">
            <div><label className="field-label">Preferred date</label>
              <input className="input" type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} /></div>
            <div><label className="field-label">Preferred time</label>
              <input className="input" placeholder="e.g. Morning" value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value })} /></div>
            <div><label className="field-label">Your intention / note</label>
              <textarea className="input" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="What would you like to focus on?" /></div>
            <Button className="btn-block" onClick={book}>Confirm Request</Button>
          </div>
        )}
      </div>
    </div>
  );
}
