import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { SolarisMark, Wordmark, Button } from '../components/ui.jsx';
import { ArrowRight, User, Stethoscope, ArrowLeft, KeyRound, X, Loader2 } from 'lucide-react';

export default function Auth() {
  const { login, register, setAuthView, setUser, nostrBanner, setNostrBanner } = useApp();
  const [mode, setMode] = useState('signin'); // signin | signup
  const [role, setRole] = useState('patient'); // patient | practitioner
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', country: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const doGoogle = async () => {
    setGoogleBusy(true); setError('');
    try {
      const data = await api.googleMockLogin();
      setNostrBanner({ show: true, npub: data.npub_mock || data.user?.nostrNpub || 'npub1mock…' });
      setUser(data.user);
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally { setGoogleBusy(false); }
  };

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
          <SolarisMark size={56} />
          <Wordmark size="1.7rem" />
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            {mode === 'signin' ? 'Welcome back to your sanctuary' : 'Create your sovereign health passport'}
          </p>
        </div>

        {/* Sovereign-key banner (shown after Google one-click) */}
        {nostrBanner?.show && (
          <div className="auth-key-banner fade-up" role="status">
            <button className="auth-key-close" onClick={() => setNostrBanner({ show: false, npub: '' })} aria-label="Dismiss">
              <X size={14} />
            </button>
            <div className="auth-key-title">🔑 Your sovereign key was created.</div>
            <p className="auth-key-body">You can export or uncouple it anytime.</p>
            {nostrBanner.npub && <code className="auth-key-npub">{nostrBanner.npub} <span className="auth-key-mock">mock</span></code>}
          </div>
        )}

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

        {/* Sovereign one-click (secondary) */}
        <div className="auth-or fade-up delay-2"><span>or</span></div>
        <button type="button" className="btn auth-google-btn fade-up delay-2" onClick={doGoogle} disabled={googleBusy}>
          {googleBusy ? <Loader2 size={16} className="auth-spin" /> : <KeyRound size={16} />}
          Continue with Google &mdash; get a sovereign key
        </button>

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
        .auth-key-banner{position:relative;background:rgba(255,185,95,0.12);border:1px solid rgba(255,185,95,0.35);
          border-radius:var(--radius-md);padding:14px 16px;margin-bottom:20px}
        .auth-key-close{position:absolute;top:10px;right:10px;background:none;border:none;color:var(--on-surface-variant);cursor:pointer}
        .auth-key-title{font-weight:700;font-size:0.95rem;color:#ffb95f}
        .auth-key-body{font-size:0.82rem;color:var(--on-surface-variant);margin:4px 0 8px}
        .auth-key-npub{display:inline-block;font-family:var(--font-mono,monospace);font-size:0.75rem;color:var(--on-surface);
          background:rgba(0,0,0,0.2);padding:5px 9px;border-radius:8px;word-break:break-all}
        .auth-key-mock{font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
          background:rgba(255,185,95,0.25);color:#ffb95f;padding:1px 6px;border-radius:99px;margin-left:6px}
        .auth-or{display:flex;align-items:center;text-align:center;gap:12px;margin:18px 0 12px;color:var(--on-surface-variant);font-size:0.8rem}
        .auth-or::before,.auth-or::after{content:'';flex:1;height:1px;background:rgba(220,226,248,0.12)}
        .auth-google-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:9px;
          background:rgba(220,226,248,0.06);border:1px solid rgba(220,226,248,0.14);color:var(--on-surface)}
        .auth-google-btn:hover:not(:disabled){background:rgba(220,226,248,0.1)}
        .auth-spin{animation:spin 1s linear infinite}
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
