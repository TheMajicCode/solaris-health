import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { SolarisMark, Wordmark, Button } from '../components/ui.jsx';
import { ArrowRight, User, Stethoscope, ArrowLeft, KeyRound } from 'lucide-react';

export default function Auth() {
  const { login, register, setAuthView } = useApp();
  const [mode, setMode] = useState('signin'); // signin | signup
  const [role, setRole] = useState('patient'); // patient | practitioner
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', country: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'signin') await login(form.email, form.password);
      else await register({ ...form, role });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally { setBusy(false); }
  };

  const fillDemo = (kind) => {
    const creds = {
      patient: { email: 'sarah@solaris.health', password: 'demo123' },
      practitioner: { email: 'elena@solaris.health', password: 'demo123' },
      admin: { email: 'admin@solaris.health', password: 'admin123' },
    }[kind];
    setMode('signin');
    setForm({ ...form, ...creds });
  };

  return (
    <div className="app-frame" style={{ paddingBottom: 0, minHeight: '100vh' }}>
      <div className="sol-bg" />
      <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <button onClick={() => setAuthView('intro')} className="btn-tertiary" style={{ position: 'absolute', top: 18, left: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={15} /> Back
        </button>

        <div className="text-center col center gap-2 fade-up" style={{ marginBottom: 26 }}>
          <img src="/solaris-logo.png" alt="Solaris Holistic Health" style={{ width: 72, height: 72, objectFit: 'contain', filter: 'drop-shadow(0 0 14px rgba(47,190,159,0.45))' }} />
          <div>
            <p className="wordmark" style={{ fontSize: '1.7rem', letterSpacing: '.18em' }}>SOLARIS</p>
            <p style={{ color: 'rgba(47,190,159,0.8)', fontSize: '0.72rem', letterSpacing: '.2em', textTransform: 'uppercase', marginTop: 2 }}>Holistic Health</p>
          </div>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 4 }}>
            {mode === 'signin' ? 'Welcome back to your sanctuary' : 'Create your sovereign health passport'}
          </p>
        </div>

        {/* Nostr sovereign login — coming soon */}
        <button type="button" className="auth-nostr-soon fade-up" disabled aria-disabled="true">
          <span className="auth-nostr-row"><KeyRound size={16} /> Sign in with your Nostr Identity <span className="auth-soon-pill">Coming Soon</span></span>
          <span className="auth-nostr-sub">Sovereign key login — launching soon</span>
        </button>

        <div className="auth-or fade-up delay-1"><span>or continue with email</span></div>

        {/* Role toggle (signup) */}
        {mode === 'signup' && (
          <div className="row gap-2 fade-up" style={{ marginBottom: 18 }}>
            <RoleCard active={role === 'patient'} onClick={() => setRole('patient')} icon={User} title="I'm seeking care" sub="Patient / Member" />
            <RoleCard active={role === 'practitioner'} onClick={() => setRole('practitioner')} icon={Stethoscope} title="I'm a practitioner" sub="Provider / Clinic" />
          </div>
        )}

        <form onSubmit={submit} className="card fade-up delay-1" style={{ padding: '1.4rem' }}>
          {mode === 'signup' && (
            <div className="row gap-2" style={{ marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">First name</label>
                <input className="input" value={form.firstName} onChange={set('firstName')} placeholder="Sarah" required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Last name</label>
                <input className="input" value={form.lastName} onChange={set('lastName')} placeholder="Mitchell" required />
              </div>
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Email</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Password</label>
            <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
          </div>
          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Country</label>
              <input className="input" value={form.country} onChange={set('country')} placeholder="El Salvador" />
            </div>
          )}
          {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}
          <Button type="submit" className="btn-block" disabled={busy}>
            {busy ? 'One moment…' : mode === 'signin' ? 'Enter Solaris' : 'Begin My Journey'} <ArrowRight size={17} />
          </Button>
        </form>

        <p className="text-center muted fade-up delay-2" style={{ marginTop: 18, fontSize: '0.9rem' }}>
          {mode === 'signin' ? "New to Solaris?" : 'Already have a passport?'}{' '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            {mode === 'signin' ? 'Create account' : 'Sign in'}
          </button>
        </p>

        {/* Demo creds */}
        <div className="card-low fade-up delay-3" style={{ marginTop: 22, padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <p className="eyebrow text-center" style={{ marginBottom: 10 }}>Explore the demo</p>
          <div className="row gap-2">
            <button className="chip" style={{ flex: 1 }} onClick={() => fillDemo('patient')}>Patient</button>
            <button className="chip" style={{ flex: 1 }} onClick={() => fillDemo('practitioner')}>Practitioner</button>
            <button className="chip" style={{ flex: 1 }} onClick={() => fillDemo('admin')}>Admin</button>
          </div>
          <p className="muted text-center" style={{ fontSize: '0.72rem', marginTop: 10 }}>Tap a role to autofill, then Enter Solaris</p>
        </div>
      </div>

      <style>{`
        .auth-nostr-soon{width:100%;display:flex;flex-direction:column;align-items:center;gap:3px;
          background:rgba(220,226,248,0.04);border:1px dashed rgba(220,226,248,0.22);color:var(--on-surface-variant);
          border-radius:var(--radius-md);padding:13px 16px;cursor:not-allowed;opacity:0.7}
        .auth-nostr-row{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:0.9rem}
        .auth-nostr-sub{font-size:0.72rem;opacity:0.8}
        .auth-soon-pill{font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
          background:rgba(255,185,95,0.2);color:#ffb95f;padding:2px 7px;border-radius:99px}
        .auth-or{display:flex;align-items:center;text-align:center;gap:12px;margin:16px 0 18px;color:var(--on-surface-variant);font-size:0.78rem}
        .auth-or::before,.auth-or::after{content:'';flex:1;height:1px;background:rgba(220,226,248,0.12)}
      `}</style>
    </div>
  );
}

function RoleCard({ active, onClick, icon: Icon, title, sub }) {
  return (
    <button onClick={onClick} type="button"
      className={active ? 'card-high' : 'card-low'}
      style={{ flex: 1, padding: '1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
        border: active ? '1px solid var(--primary)' : '1px solid transparent', transition: 'all 0.4s var(--ease)' }}>
      <Icon size={20} color={active ? 'var(--primary)' : 'var(--on-surface-variant)'} />
      <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: 8, fontFamily: 'var(--font-sans)' }}>{title}</div>
      <div className="muted" style={{ fontSize: '0.72rem' }}>{sub}</div>
    </button>
  );
}
