import React, { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { VitalityRing, Card, Spinner, Button, bandColor } from '../components/ui.jsx';
import { Bot, Droplet, Moon, Footprints, Plus, TrendingUp, Sparkles, ArrowRight, Award } from 'lucide-react';

export default function Hub() {
  const { user, setTab } = useApp();
  const [data, setData] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [latest, ci] = await Promise.all([api.getLatestAssessment(), api.getCheckins()]);
        setData(latest);
        setRecs(latest.recommendations || []);
        setCheckins(ci.checkins || []);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="page"><Spinner label="Loading your hub…" /></div>;

  const vitality = data?.response?.vitality_score ?? 0;
  const topFocus = data?.response?.top_focus_areas_json || [];
  const today = checkins[0];
  const habits = recs.filter((r) => r.recommendation_type === 'habit').slice(0, 3);
  const matchedListings = recs.filter((r) => r.linked_listing_id).slice(0, 2);

  return (
    <div className="page col gap-4">
      {/* Hub heading */}
      <div className="fade-up">
        <p className="eyebrow gold">Your Personal Sovereign Hub</p>
        <h1 className="display" style={{ fontSize: '1.7rem', marginTop: 4 }}>
          Good {greeting()}, {user?.firstName || 'friend'}
        </h1>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>aka your LUCA Passport · {user?.lovePoints ?? 0} LOVE points</p>
      </div>

      {/* Vitality ring */}
      <div className="center fade-up delay-1" style={{ padding: '0.5rem 0' }}>
        <VitalityRing score={vitality} sub={<span className="row gap-1"><TrendingUp size={12} /> 360° Vitality</span>} />
      </div>

      {/* LUCA insight */}
      <Card glass className="fade-up delay-2">
        <div className="row gap-2" style={{ marginBottom: 12 }}>
          <div className="center" style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,var(--primary),var(--primary-container))' }}>
            <Bot size={20} color="#00271a" />
          </div>
          <span className="label mint">LUCA · Your Guide</span>
        </div>
        <p className="serif" style={{ fontStyle: 'italic', fontSize: '1.05rem', lineHeight: 1.5, marginBottom: 8 }}>
          "{lucaLine(user?.firstName, topFocus)}"
        </p>
        <p className="muted" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
          {topFocus.length ? `Let's focus on ${topFocus.map((f) => f.name).join(', ')} today — small steps move your vitality fastest.` : 'Complete your assessment to unlock personalized guidance.'}
        </p>
        <button onClick={() => setTab('luca')} className="btn-tertiary" style={{ marginTop: 10, padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
          Chat with LUCA <ArrowRight size={14} />
        </button>
      </Card>

      {/* Primary focus / habits */}
      {habits.length > 0 && (
        <Card className="fade-up delay-3">
          <div className="between" style={{ marginBottom: 14 }}>
            <span className="label mint">Today's Focus</span>
            <Sparkles size={16} color="var(--primary)" />
          </div>
          <div className="col gap-2">
            {habits.map((h, i) => (
              <div key={i} className="row gap-3 card-low" style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.88rem', lineHeight: 1.4 }}>{h.title}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Daily metrics */}
      <div className="row gap-2 fade-up delay-3">
        <MiniStat icon={Moon} label="Sleep" value={today ? `${Number(today.sleep_hours).toFixed(1)}h` : '—'} tint="var(--secondary)" />
        <MiniStat icon={Droplet} label="Hydration" value={today ? `${today.hydration_glasses} glasses` : '—'} tint="var(--primary)" />
        <MiniStat icon={Footprints} label="Movement" value={today ? `${today.movement_minutes}m` : '—'} tint="var(--tertiary)" />
      </div>

      {/* Matched practitioners */}
      {matchedListings.length > 0 && (
        <Card className="fade-up delay-4">
          <div className="between" style={{ marginBottom: 12 }}>
            <span className="label">Matched for You</span>
            <button onClick={() => setTab('explore')} className="btn-tertiary" style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>Explore</button>
          </div>
          <div className="col gap-2">
            {matchedListings.map((m, i) => (
              <div key={i} className="row gap-3 card-low" style={{ padding: '0.8rem 1rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} onClick={() => setTab('explore')}>
                <div className="center" style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(78,222,163,0.12)', flexShrink: 0 }}>
                  <Award size={18} color="var(--primary)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.title}</div>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>{m.description?.slice(0, 48)}…</div>
                </div>
                <ArrowRight size={16} color="var(--outline)" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick check-in CTA */}
      <Button className="btn-block fade-up delay-5" variant="ghost" onClick={() => setTab('health')}>
        <Plus size={16} /> Log today's check-in
      </Button>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tint }) {
  return (
    <div className="card" style={{ flex: 1, padding: '1rem 0.8rem', textAlign: 'center' }}>
      <Icon size={18} color={tint} style={{ marginBottom: 6 }} />
      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{value}</div>
      <div className="label muted" style={{ fontSize: '0.62rem' }}>{label}</div>
    </div>
  );
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; };
const lucaLine = (name, focus) => focus.length
  ? `Based on your assessment, ${name || 'your body'} is asking for support in ${focus[0].name.toLowerCase()}.`
  : `Welcome, ${name || 'friend'}. Your body is speaking — let's listen together.`;
