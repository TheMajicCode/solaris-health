import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { SolarisMark, Wordmark } from '../components/ui.jsx';
import {
  ArrowRight, KeyRound, Mail, Sparkles, ShieldCheck, Loader2,
  Heart, Stethoscope, Building2, Sprout, Code2, Shield, MapPin, Layers,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  { key: 'sarah', name: 'Sarah', role: 'Patient', email: 'sarah@solaris.health', icon: Heart, tint: '#4edea3' },
  { key: 'elena', name: 'Elena', role: 'Practitioner', email: 'elena@solaris.health', icon: Stethoscope, tint: '#7fd7ff' },
  { key: 'aura', name: 'Aura', role: 'Clinic Admin', email: 'aura@solaris.health', icon: Building2, tint: '#ffb95f' },
  { key: 'marco', name: 'Marco', role: 'Vendor · Farmer', email: 'marco@solaris.health', icon: Sprout, tint: '#8fe3a0' },
  { key: 'alex', name: 'Alex', role: 'Builder', email: 'builder@solaris.health', icon: Code2, tint: '#c9b3ff' },
  { key: 'solaris', name: 'Solaris', role: 'Admin', email: 'solaris@solaris.health', icon: Shield, tint: '#ff9fb0' },
];

export default function Onboarding() {
  const { setAuthView, login, setUser, setNostrBanner } = useApp();
  const [npub, setNpub] = useState('');
  const [busy, setBusy] = useState('');       // which action is loading
  const [err, setErr] = useState('');

  const clearErr = () => err && setErr('');

  const doNostr = async (e) => {
    e.preventDefault();
    if (!npub.trim()) { setErr('Enter your npub to continue.'); return; }
    setBusy('nostr'); setErr('');
    try {
      const data = await api.nostrLogin(npub.trim());
      setUser(data.user);
    } catch (ex) {
      setErr(ex.message || 'Could not sign in with that key.');
    } finally { setBusy(''); }
  };

  const doGoogle = async () => {
    setBusy('google'); setErr('');
    try {
      const data = await api.googleMockLogin();
      setNostrBanner({ show: true, npub: data.npub_mock || data.user?.nostrNpub || 'npub1mock…' });
      setUser(data.user);
    } catch (ex) {
      setErr(ex.message || 'Could not sign in.');
    } finally { setBusy(''); }
  };

  const doDemo = async (email) => {
    setBusy(`demo:${email}`); setErr('');
    try {
      await login(email, 'demo123');
    } catch (ex) {
      setErr(ex.message || 'Demo login failed.');
    } finally { setBusy(''); }
  };

  return (
    <div className="app-frame" style={{ minHeight: '100vh', paddingBottom: 0 }}>
      <div className="sol-bg" />
      <div className="ob-scroll">
        {/* ================= HERO ================= */}
        <section className="ob-hero">
          <div className="ob-topbar fade-up">
            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <SolarisMark size={34} />
              <Wordmark size="1.35rem" />
            </div>
            <span className="ob-node-chip"><MapPin size={13} /> El Salvador · Clinic Node</span>
          </div>

          <div className="ob-hero-body">
            <span className="pill fade-up" style={{ background: 'rgba(78,222,163,0.1)' }}>
              <Sparkles size={13} /> Sovereign Health Protocol
            </span>
            <h1 className="display fade-up delay-1 ob-hero-h">
              Reclaim your <span className="mint">health</span>, <span className="gold">wealth</span> &amp; <span className="mint">sovereignty</span>
            </h1>
            <p className="muted fade-up delay-2 ob-hero-sub">
              One passport for your care, your value, and your identity — owned entirely by you.
              Every payment regenerates the community that heals you.
            </p>
          </div>
        </section>

        {/* ================= AUTH PATHS ================= */}
        <section className="ob-auth">
          <div className="ob-auth-grid">
            {/* Nostr */}
            <form className="card ob-auth-card fade-up delay-1" onSubmit={doNostr}>
              <div className="ob-auth-ico" style={{ background: 'rgba(78,222,163,0.12)' }}>
                <KeyRound size={20} color="var(--primary)" />
              </div>
              <h3 className="ob-auth-h">Sign in with Nostr</h3>
              <p className="ob-auth-p">Bring your own sovereign key. Your identity, your keys.</p>
              <input
                className="input ob-input"
                placeholder="npub1…"
                value={npub}
                onChange={(e) => { setNpub(e.target.value); clearErr(); }}
                spellCheck={false}
                autoCapitalize="off"
              />
              <button className="btn ob-btn" type="submit" disabled={busy === 'nostr'}>
                {busy === 'nostr' ? <Loader2 size={17} className="ob-spin" /> : <KeyRound size={17} />}
                Continue with Nostr
              </button>
              <span className="ob-mock-note">Demo keys are mock (npub1mock…)</span>
            </form>

            {/* Google mock */}
            <div className="card ob-auth-card fade-up delay-2">
              <div className="ob-auth-ico" style={{ background: 'rgba(255,185,95,0.14)' }}>
                <Sparkles size={20} color="var(--gold, #ffb95f)" />
              </div>
              <h3 className="ob-auth-h">One-click sign-in</h3>
              <p className="ob-auth-p">We generate a sovereign key for you behind the scenes.</p>
              <button className="btn ob-btn ob-btn-google" onClick={doGoogle} disabled={busy === 'google'}>
                {busy === 'google' ? <Loader2 size={17} className="ob-spin" /> : <GoogleGlyph />}
                Continue with Google
              </button>
              <span className="ob-mock-note">Simulated — no real Google account used</span>
            </div>

            {/* Email */}
            <div className="card ob-auth-card fade-up delay-3">
              <div className="ob-auth-ico" style={{ background: 'rgba(127,215,255,0.14)' }}>
                <Mail size={20} color="#7fd7ff" />
              </div>
              <h3 className="ob-auth-h">Email &amp; password</h3>
              <p className="ob-auth-p">Prefer the classic route? Create an account or sign in.</p>
              <button className="btn ob-btn ob-btn-ghost" onClick={() => setAuthView('auth')}>
                <Mail size={17} /> Continue with Email <ArrowRight size={16} />
              </button>
              <span className="ob-mock-note">You can add a sovereign key later</span>
            </div>
          </div>

          {err && <div className="ob-err">{err}</div>}
        </section>

        {/* ================= DEMO QUICK LOGIN ================= */}
        <section className="ob-demo">
          <div className="ob-demo-head fade-up">
            <span className="eyebrow gold">Explore the demo</span>
            <h2 className="ob-demo-h">Step into any role</h2>
            <p className="muted ob-demo-sub">Six seeded accounts, one click each. All value is simulated.</p>
          </div>
          <div className="ob-demo-grid">
            {DEMO_ACCOUNTS.map((d, i) => {
              const Icon = d.icon;
              const loading = busy === `demo:${d.email}`;
              return (
                <button
                  key={d.key}
                  className={`ob-demo-card fade-up delay-${Math.min(i + 1, 4)}`}
                  onClick={() => doDemo(d.email)}
                  disabled={!!busy}
                >
                  <div className="ob-demo-ico" style={{ background: `${d.tint}22`, color: d.tint }}>
                    {loading ? <Loader2 size={18} className="ob-spin" /> : <Icon size={18} />}
                  </div>
                  <div className="ob-demo-meta">
                    <span className="ob-demo-name">{d.name}</span>
                    <span className="ob-demo-role">{d.role}</span>
                  </div>
                  <ArrowRight size={15} className="ob-demo-arrow" />
                </button>
              );
            })}
          </div>
        </section>

        {/* ================= STATS BAR ================= */}
        <footer className="ob-stats fade-up">
          <Stat icon={Building2} label="1 Clinic Node" />
          <Dot />
          <Stat icon={Layers} label="6 Roles" />
          <Dot />
          <Stat icon={MapPin} label="GPS Value Splits" />
          <Dot />
          <Stat icon={ShieldCheck} label="Sovereign Identity" />
        </footer>
      </div>

      <style>{`
        .ob-scroll{position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:0 20px 40px;
          display:flex;flex-direction:column;min-height:100vh}
        .ob-topbar{display:flex;align-items:center;justify-content:space-between;padding:22px 0 0}
        .ob-node-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
          color:var(--on-surface-variant);background:rgba(220,226,248,0.06);border:1px solid rgba(220,226,248,0.1);
          padding:6px 13px;border-radius:999px}
        .ob-hero{text-align:center;padding:54px 0 30px}
        .ob-hero-body{display:flex;flex-direction:column;align-items:center;gap:20px}
        .ob-hero-h{font-size:clamp(2.3rem,6vw,3.7rem);line-height:1.05;max-width:16ch;margin:0 auto}
        .ob-hero-sub{font-size:clamp(1rem,2.2vw,1.15rem);max-width:52ch;line-height:1.65;margin:0 auto}
        .ob-auth{padding:14px 0 8px}
        .ob-auth-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        @media(max-width:820px){.ob-auth-grid{grid-template-columns:1fr}}
        .ob-auth-card{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:22px !important;
          border-radius:var(--radius-md);text-align:left}
        .ob-auth-ico{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center}
        .ob-auth-h{font-size:1.15rem;margin:4px 0 0}
        .ob-auth-p{font-size:0.86rem;line-height:1.5;color:var(--on-surface-variant);margin:0;min-height:2.4em}
        .ob-input{width:100%;margin-top:4px}
        .ob-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:auto}
        .ob-btn-google{background:#fff;color:#1f2530}
        .ob-btn-google:hover{background:#f2f4f7}
        .ob-btn-ghost{background:rgba(220,226,248,0.06);border:1px solid rgba(220,226,248,0.14);color:var(--on-surface)}
        .ob-mock-note{font-size:0.72rem;color:var(--on-surface-variant);opacity:.75;align-self:center;margin-top:2px}
        .ob-err{margin-top:16px;text-align:center;font-size:0.9rem;color:var(--error,#ff9fb0);
          background:rgba(255,90,110,0.08);border:1px solid rgba(255,90,110,0.2);border-radius:12px;padding:10px 14px}
        .ob-demo{padding:44px 0 24px}
        .ob-demo-head{text-align:center;margin-bottom:22px}
        .ob-demo-h{font-family:var(--font-serif,serif);font-size:1.9rem;margin:6px 0 6px}
        .ob-demo-sub{font-size:0.95rem}
        .ob-demo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        @media(max-width:820px){.ob-demo-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:520px){.ob-demo-grid{grid-template-columns:1fr}}
        .ob-demo-card{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;cursor:pointer;
          background:rgba(220,226,248,0.04);border:1px solid rgba(220,226,248,0.1);text-align:left;transition:all .18s var(--ease,ease)}
        .ob-demo-card:hover:not(:disabled){background:rgba(220,226,248,0.08);border-color:rgba(78,222,163,0.4);transform:translateY(-2px)}
        .ob-demo-card:disabled{opacity:.55;cursor:default}
        .ob-demo-ico{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
        .ob-demo-meta{display:flex;flex-direction:column;flex:1;min-width:0}
        .ob-demo-name{font-weight:700;font-size:0.98rem;color:var(--on-surface)}
        .ob-demo-role{font-size:0.78rem;color:var(--on-surface-variant)}
        .ob-demo-arrow{color:var(--on-surface-variant);flex:none}
        .ob-stats{margin-top:auto;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:14px;
          padding:22px 20px;border-top:1px solid rgba(220,226,248,0.08);margin-top:32px}
        .ob-stat{display:inline-flex;align-items:center;gap:7px;font-size:0.85rem;font-weight:600;color:var(--on-surface-variant)}
        .ob-stat svg{color:var(--primary)}
        .ob-dot{width:4px;height:4px;border-radius:50%;background:rgba(220,226,248,0.25)}
        .ob-spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

function Stat({ icon: Icon, label }) {
  return <span className="ob-stat"><Icon size={15} /> {label}</span>;
}
const Dot = () => <span className="ob-dot" />;

const GoogleGlyph = () => (
  <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);
