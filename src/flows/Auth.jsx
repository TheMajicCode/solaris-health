import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { SolarisMark, Wordmark, Button } from '../components/ui.jsx';
import { ArrowRight, ArrowLeft, KeyRound, Info, X, ShieldCheck, Copy, Check } from 'lucide-react';
import {
  createIdentity, deriveFromMnemonic, isValidMnemonic, IDENTITY_KEY_INFO,
} from '../lib/identity-key.js';

// ── Identity Key info popover (exact sovereignty copy — A2 §3) ──
function IdentityKeyInfo({ onClose }) {
  return (
    <div className="ik-modal-backdrop" onClick={onClose}>
      <div className="ik-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ik-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', color: '#0A2B29', fontSize: '1.05rem' }}>
          <KeyRound size={18} color="#2DB584" /> {IDENTITY_KEY_INFO.title}
        </h3>
        {IDENTITY_KEY_INFO.lines.map((line, i) => (
          <p key={i} style={{ color: '#6b807a', fontSize: '0.86rem', lineHeight: 1.55, margin: '0 0 12px' }}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export default function Auth() {
  const { login, register, setAuthView, loginWithIdentityKey } = useApp();
  const [mode, setMode] = useState('signin'); // signin | signup
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', country: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ── Identity Key login state ──
  const [ikOpen, setIkOpen] = useState(false);       // Identity Key panel open
  const [ikInfo, setIkInfo] = useState(false);       // info popover
  const [ikMode, setIkMode] = useState('choose');    // choose | create | existing
  const [created, setCreated] = useState(null);      // { mnemonic, npub, nsec, skHex, pubkeyHex }
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [copied, setCopied] = useState(false);
  const [ikError, setIkError] = useState('');
  const [ikBusy, setIkBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'signin') await login(form.email, form.password);
      // Every new account begins as a member. Role is never chosen at signup.
      else await register({ ...form, role: 'patient' });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally { setBusy(false); }
  };

  const enterAsSarah = () => {
    setMode('signin');
    setForm({ ...form, email: 'sarah@solaris.health', password: 'demo123' });
  };

  // ── Identity Key handlers ──
  const openIk = () => { setIkOpen(true); setIkMode('choose'); setIkError(''); setCreated(null); setSavedConfirmed(false); setPhrase(''); };
  const closeIk = () => { setIkOpen(false); setIkBusy(false); };

  const startCreate = () => {
    setIkError('');
    try {
      const id = createIdentity(); // { mnemonic, npub, nsec, skHex, pubkeyHex }
      setCreated(id);
      setSavedConfirmed(false);
      setIkMode('create');
    } catch (err) {
      setIkError('Could not generate an identity key. Please try again.');
    }
  };

  const copyPhrase = async () => {
    if (!created?.mnemonic) return;
    try { await navigator.clipboard.writeText(created.mnemonic); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  const finishCreate = async () => {
    if (!created || !savedConfirmed) return;
    setIkError(''); setIkBusy(true);
    try {
      await loginWithIdentityKey({ npub: created.npub, skHex: created.skHex, pubkeyHex: created.pubkeyHex });
    } catch (err) {
      setIkError(err.message || 'Sign in failed. Please try again.');
      setIkBusy(false);
    }
  };

  const submitExisting = async () => {
    setIkError('');
    const clean = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!isValidMnemonic(clean)) { setIkError('That does not look like a valid 12-word recovery phrase.'); return; }
    setIkBusy(true);
    try {
      const keys = deriveFromMnemonic(clean); // { npub, nsec, pubkeyHex, skHex }
      await loginWithIdentityKey({ npub: keys.npub, skHex: keys.skHex, pubkeyHex: keys.pubkeyHex });
    } catch (err) {
      setIkError(err.message || 'Sign in failed. Please check your phrase and try again.');
      setIkBusy(false);
    }
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
            {mode === 'signin' ? 'Welcome back to your sanctuary' : 'Begin your sovereign health journey'}
          </p>
        </div>

        {/* Identity Key sovereign login — real challenge/response (M8) */}
        <button type="button" className="auth-nostr-btn fade-up" onClick={openIk}>
          <span className="auth-nostr-row">
            <KeyRound size={16} /> Sign in with your Identity Key
          </span>
          <span className="auth-nostr-sub">
            Sovereign key login — your key stays on your device
            <span
              role="button" tabIndex={0}
              className="auth-ik-info" aria-label="What is an Identity Key?"
              onClick={(e) => { e.stopPropagation(); setIkInfo(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setIkInfo(true); } }}
            >
              <Info size={13} />
            </span>
          </span>
        </button>

        <div className="auth-or fade-up delay-1"><span>or continue with email</span></div>

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
            {busy ? 'One moment…' : mode === 'signin' ? 'Enter Solaris' : 'Claim My Passport'} <ArrowRight size={17} />
          </Button>
        </form>

        <p className="text-center muted fade-up delay-2" style={{ marginTop: 18, fontSize: '0.9rem' }}>
          {mode === 'signin' ? "New to Solaris?" : 'Already have a passport?'}{' '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            {mode === 'signin' ? 'Create account' : 'Sign in'}
          </button>
        </p>

        {/* Demo access */}
        <div className="card-low fade-up delay-3" style={{ marginTop: 22, padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <p className="eyebrow text-center" style={{ marginBottom: 10 }}>Explore the demo</p>
          <button className="chip" style={{ width: '100%' }} onClick={enterAsSarah}>Enter as Sarah</button>
          <p className="muted text-center" style={{ fontSize: '0.72rem', marginTop: 10 }}>Autofills a demo member, then tap Enter Solaris</p>
        </div>

        {/* Public directory — no account required */}
        <p className="text-center fade-up delay-3" style={{ marginTop: 16, fontSize: '0.88rem' }}>
          <button
            onClick={() => { window.location.href = '/find'; }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            Browse practitioners <ArrowRight size={15} />
          </button>
        </p>
      </div>

      {ikInfo && <IdentityKeyInfo onClose={() => setIkInfo(false)} />}

      {/* ── Identity Key login panel ── */}
      {ikOpen && (
        <div className="ik-modal-backdrop" onClick={closeIk}>
          <div className="ik-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <button className="ik-modal-close" onClick={closeIk} aria-label="Close"><X size={18} /></button>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px', color: '#0A2B29', fontSize: '1.1rem' }}>
              <KeyRound size={18} color="#2DB584" /> Identity Key
              <span
                role="button" tabIndex={0} className="auth-ik-info" aria-label="What is an Identity Key?"
                onClick={() => setIkInfo(true)} onKeyDown={(e) => { if (e.key === 'Enter') setIkInfo(true); }}
              ><Info size={13} /></span>
            </h3>

            {/* choose */}
            {ikMode === 'choose' && (
              <div className="col gap-2" style={{ marginTop: 14 }}>
                <p style={{ color: '#6b807a', fontSize: '0.86rem', lineHeight: 1.5, margin: 0 }}>
                  Your Identity Key is created on your device and belongs to you — not Solaris. If you're new, create a new key.
                  If you already have one, use your existing key.
                </p>
                <button className="ik-choice" onClick={startCreate}>
                  <span className="ik-choice-title">Create a new Identity Key</span>
                  <span className="ik-choice-sub">Generates a recovery phrase you must save</span>
                </button>
                <button className="ik-choice" onClick={() => { setIkMode('existing'); setIkError(''); }}>
                  <span className="ik-choice-title">Use my existing Identity Key</span>
                  <span className="ik-choice-sub">Enter your 12-word recovery phrase</span>
                </button>
                {ikError && <p style={{ color: 'var(--error)', fontSize: '0.82rem', margin: '4px 0 0' }}>{ikError}</p>}
              </div>
            )}

            {/* create */}
            {ikMode === 'create' && created && (
              <div className="col gap-2" style={{ marginTop: 12 }}>
                <div className="ik-warn">
                  <ShieldCheck size={15} /> Your secret key is never stored on Solaris. Write down this recovery phrase and keep it safe — it is the only way to restore your account.
                </div>
                <div className="ik-phrase">
                  {created.mnemonic.split(' ').map((w, i) => (
                    <span key={i} className="ik-word"><b>{i + 1}</b>{w}</span>
                  ))}
                </div>
                <button className="ik-copy" onClick={copyPhrase}>
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy phrase</>}
                </button>
                <label className="ik-confirm">
                  <input type="checkbox" checked={savedConfirmed} onChange={(e) => setSavedConfirmed(e.target.checked)} />
                  I have safely written down my recovery phrase.
                </label>
                {ikError && <p style={{ color: 'var(--error)', fontSize: '0.82rem', margin: 0 }}>{ikError}</p>}
                <Button className="btn-block" onClick={finishCreate} disabled={!savedConfirmed || ikBusy}>
                  {ikBusy ? 'Creating your passport…' : 'Continue'} <ArrowRight size={16} />
                </Button>
                <button className="ik-back" onClick={() => setIkMode('choose')}>Back</button>
              </div>
            )}

            {/* existing */}
            {ikMode === 'existing' && (
              <div className="col gap-2" style={{ marginTop: 12 }}>
                <p style={{ color: '#6b807a', fontSize: '0.84rem', lineHeight: 1.5, margin: 0 }}>
                  Enter your 12-word recovery phrase. It is used on this device only to sign in — it never leaves your device.
                </p>
                <textarea
                  className="input" rows={3} value={phrase} onChange={(e) => setPhrase(e.target.value)}
                  placeholder="word1 word2 word3 …" style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                {ikError && <p style={{ color: 'var(--error)', fontSize: '0.82rem', margin: 0 }}>{ikError}</p>}
                <Button className="btn-block" onClick={submitExisting} disabled={ikBusy}>
                  {ikBusy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
                </Button>
                <button className="ik-back" onClick={() => setIkMode('choose')}>Back</button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .auth-nostr-btn{width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;
          background:#2DB584;border:1px solid #2DB584;color:#FFFFFF;
          border-radius:var(--radius-md);padding:14px 16px;cursor:pointer;transition:background .15s,box-shadow .15s;
          box-shadow:0 4px 14px rgba(45,181,132,0.28)}
        .auth-nostr-btn:hover{background:#26a074;border-color:#26a074}
        .auth-nostr-row{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:0.92rem;color:#FFFFFF}
        .auth-nostr-row svg{color:#FFFFFF}
        .auth-nostr-sub{font-size:0.73rem;color:rgba(255,255,255,0.92);display:inline-flex;align-items:center;gap:6px}
        .auth-ik-info{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;
          border-radius:99px;background:rgba(255,255,255,0.25);color:#FFFFFF;cursor:pointer}
        .auth-ik-info:hover{background:rgba(255,255,255,0.4)}
        .auth-or{display:flex;align-items:center;text-align:center;gap:12px;margin:16px 0 18px;color:var(--on-surface-variant);font-size:0.78rem}
        .auth-or::before,.auth-or::after{content:'';flex:1;height:1px;background:rgba(220,226,248,0.12)}
        .ik-modal-backdrop{position:fixed;inset:0;background:rgba(6,20,19,0.55);backdrop-filter:blur(3px);
          display:flex;align-items:center;justify-content:center;z-index:1000;padding:18px}
        .ik-modal{position:relative;background:#fff;border-radius:18px;max-width:420px;width:100%;
          padding:22px 20px;box-shadow:0 24px 60px rgba(6,20,19,0.35);max-height:88vh;overflow-y:auto}
        .ik-modal-close{position:absolute;top:12px;right:12px;background:none;border:none;cursor:pointer;color:#6b807a}
        .ik-choice{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;
          background:#f5f9f7;border:1px solid rgba(45,181,132,0.25);border-radius:12px;padding:13px 15px;cursor:pointer;transition:background .15s}
        .ik-choice:hover{background:#eaf4f0}
        .ik-choice-title{font-weight:600;color:#0A2B29;font-size:0.92rem}
        .ik-choice-sub{font-size:0.76rem;color:#6b807a}
        .ik-warn{display:flex;gap:8px;align-items:flex-start;background:rgba(197,138,83,0.12);
          border:1px solid rgba(197,138,83,0.35);color:#8a5a2b;border-radius:10px;padding:10px 12px;font-size:0.8rem;line-height:1.45}
        .ik-phrase{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#f5f9f7;
          border:1px solid rgba(10,43,41,0.1);border-radius:12px;padding:12px}
        .ik-word{font-size:0.82rem;color:#0A2B29;font-family:monospace;display:flex;gap:5px;align-items:baseline}
        .ik-word b{color:#2DB584;font-size:0.68rem;min-width:15px}
        .ik-copy{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;background:none;border:none;
          color:#2DB584;font-weight:600;font-size:0.82rem;cursor:pointer;padding:2px 0}
        .ik-confirm{display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;color:#6b807a;cursor:pointer;line-height:1.4}
        .ik-confirm input{margin-top:2px}
        .ik-back{background:none;border:none;color:#6b807a;font-size:0.82rem;cursor:pointer;align-self:center;padding:2px}
      `}</style>
    </div>
  );
}
