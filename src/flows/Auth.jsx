import React, { useState, useMemo } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { Button } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import SparkWalletCard from '../components/SparkWalletCard.jsx';
import {
  ArrowRight, ArrowLeft, KeyRound, Info, X, ShieldCheck, Copy, Check,
  Eye, EyeOff, Mail, Sparkles, Globe, Lock, LogIn, UserPlus,
} from 'lucide-react';
import {
  createStandaloneIdentity, deriveFromMnemonic, identityFromNsec, isValidMnemonic, IDENTITY_KEY_INFO,
} from '../lib/identity-key.js';

/* ────────────────────────────────────────────────────────────────────────────
 * Beta V1 investor-demo onboarding + auth (spec §3–§8).
 *
 * One local flow inside the existing React/Vite app — NO parallel app.
 *
 *   Welcome
 *     ├─ Email + password
 *     │    ├─ Sign in          (returning member/practitioner → routes now)
 *     │    └─ Create account   (minimum profile → transition → arrival → …)
 *     └─ Solaris identity key
 *          ├─ Create a new identity key   (Screen 1 · real standalone nsec/npub)
 *          ├─ Use an existing nsec        (decode on-device → routes now)
 *          └─ Restore legacy 12-word Solaris identity (NIP-06 legacy → routes now)
 *
 *   New-account paths then flow through:
 *     Screen 2 optional Spark wallet / Skip for now (UTEXO Coming Soon)
 *     → Screen 3 Reclaim Your Sovereignty + Roadmap Preview
 *     → minimum profile  (REQUIRED persistence GATE — spec §3.5)
 *     → hands off to the existing Assessment intake.
 *
 * SECRET DISCIPLINE (spec §3/§4): identity nsec/skHex live in component memory
 * only for the session — never sent to Solaris, never stored, never snapshotted.
 * Only the public npub is registered. Returning members' existing nsec is decoded
 * on-device and only npub/nonce/signature reach the API. New-account creation
 * gates on a REQUIRED minimum-profile save before the React user is activated.
 * ──────────────────────────────────────────────────────────────────────────── */

// Beta-safe copy blocks (spec §2A) — used verbatim; do NOT paraphrase or broaden.
const SCREEN1 = {
  eyebrow: 'Your health identity',
  title: 'Reclaim Your Health',
  lede: 'Your identity secret is generated on this device and is not sent to Solaris. Keep it private. '
    + "Your Solaris health records remain governed by the app's current storage, consent, and export controls.",
  bullets: [
    'A real, portable Nostr identity',
    'Clinical data stays private in Solaris',
    'Keep your health identity separate from your social identity',
  ],
  cta: 'Create my Solaris identity key',
  next: 'Continue to Reclaim Your Wealth',
};
const SCREEN3 = {
  title: 'Reclaim Your Sovereignty',
  lede: 'Built toward portable identity, user-controlled keys, private-by-design workflows, and infrastructure '
    + 'you can move or self-host. Beta capabilities and roadmap items must remain visibly distinguishable.',
  sections: [
    ['Own your path', 'Your identity and exportable records are not locked to one login provider.'],
    ['Intelligence with boundaries', 'LUCA helps organise and explain. It does not diagnose or decide for you.'],
    ['Built for greater sovereignty', 'Solaris uses its protected Core API and Postgres today, with a documented path to self-hosting later.'],
  ],
  motto: 'Heal · Learn · Earn',
  cta: 'Continue to my profile',
  roadmapTitle: 'Roadmap Preview',
  roadmap: [
    'Designed toward enterprise-grade encrypted infrastructure',
    'A path toward complete user sovereignty',
    'Production hardening in progress',
  ],
};

// Three-step progress rail — adopted from the reference visual direction
// (thin segment bars + "N of 3" label). Purely presentational.
function ProgressRail({ step }) {
  return (
    <div className="ob-topbar" role="presentation">
      <div className="ob-steps" aria-hidden="true">
        {[1, 2, 3].map((n) => {
          const state = n < step ? 'done' : n === step ? 'now' : 'todo';
          return <span key={n} className={`ob-step ob-step-${state}`} />;
        })}
      </div>
      <span className="ob-step-label">{step} of 3</span>
    </div>
  );
}

// Serif display title with the final word in an accent colour — the reference
// visual direction ("Reclaim your <accent>Health / Wealth / Sovereignty</accent>").
function DisplayTitle({ text, accent = 'mint' }) {
  const parts = text.trim().split(' ');
  const last = parts.pop();
  const head = parts.join(' ');
  return (
    <h2 className="ob-display serif">
      {head ? `${head} ` : ''}<span className={`ob-accent ob-accent-${accent}`}>{last}</span>
    </h2>
  );
}

// Three-point explanation card with icon tiles — reference row/ico pattern.
function PointCard({ items, warmLast = false }) {
  return (
    <div className="ob-points">
      {items.map(({ icon: Ico, h, b }, i) => {
        const warm = warmLast && i === items.length - 1;
        return (
          <div key={h} className={`ob-point${warm ? ' ob-point-warm' : ''}`}>
            <span className="ob-point-ico"><Ico size={16} /></span>
            <span className="ob-point-body">
              <span className="ob-point-h">{h}</span>
              {b ? <span className="ob-point-b">{b}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Decorative "you are the node" network — adapted from the reference SVG to the
// light onboarding palette. Non-interactive; motion respects prefers-reduced-motion.
function SovereigntyNet() {
  return (
    <div className="ob-net" aria-hidden="true">
      <svg viewBox="0 0 320 176" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <line className="ob-link" x1="160" y1="88" x2="62" y2="44" style={{ animationDelay: '.15s' }} />
        <line className="ob-link" x1="160" y1="88" x2="42" y2="118" style={{ animationDelay: '.30s' }} />
        <line className="ob-link ob-link-warm" x1="160" y1="88" x2="112" y2="152" style={{ animationDelay: '.45s' }} />
        <line className="ob-link" x1="160" y1="88" x2="258" y2="40" style={{ animationDelay: '.60s' }} />
        <line className="ob-link" x1="160" y1="88" x2="282" y2="110" style={{ animationDelay: '.75s' }} />
        <line className="ob-link ob-link-warm" x1="160" y1="88" x2="212" y2="154" style={{ animationDelay: '.90s' }} />
        <circle className="ob-halo" cx="160" cy="88" r="26" fill="none" stroke="#2DB584" strokeWidth="1" />
        <circle cx="160" cy="88" r="8" fill="#2DB584" />
        <circle cx="160" cy="88" r="14" fill="none" stroke="#2DB584" strokeWidth="1.2" opacity=".4" />
        <circle className="ob-net-node" cx="62" cy="44" r="5" fill="#3fb0c4" style={{ animationDelay: '.9s' }} />
        <circle className="ob-net-node" cx="42" cy="118" r="4" fill="#3fb0c4" style={{ animationDelay: '1.05s' }} />
        <circle className="ob-net-node" cx="112" cy="152" r="4.5" fill="#e0972f" style={{ animationDelay: '1.2s' }} />
        <circle className="ob-net-node" cx="258" cy="40" r="4.5" fill="#3fb0c4" style={{ animationDelay: '1.35s' }} />
        <circle className="ob-net-node" cx="282" cy="110" r="5" fill="#3fb0c4" style={{ animationDelay: '1.5s' }} />
        <circle className="ob-net-node" cx="212" cy="154" r="4" fill="#e0972f" style={{ animationDelay: '1.65s' }} />
      </svg>
    </div>
  );
}

// Icon mapping for the three-point cards (presentational; copy is unchanged).
const SCREEN1_POINTS = [
  { icon: KeyRound, h: SCREEN1.bullets[0] },
  { icon: Lock, h: SCREEN1.bullets[1] },
  { icon: ShieldCheck, h: SCREEN1.bullets[2] },
];
const SCREEN3_POINTS = [
  { icon: Globe, h: SCREEN3.sections[0][0], b: SCREEN3.sections[0][1] },
  { icon: Sparkles, h: SCREEN3.sections[1][0], b: SCREEN3.sections[1][1] },
  { icon: Lock, h: SCREEN3.sections[2][0], b: SCREEN3.sections[2][1] },
];

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

// Pick three distinct 1-based character positions inside a secret string.
function pickCharPositions(secret, n = 3) {
  const len = (secret || '').length;
  if (len < n) return [];
  const chosen = new Set();
  while (chosen.size < n) chosen.add(1 + Math.floor(Math.random() * len));
  return Array.from(chosen).sort((a, b) => a - b);
}

export default function Auth() {
  const {
    setAuthView, login, loginWithIdentityKey,
    identityAuthDeferred, registerAccountDeferred, activateUser,
  } = useApp();

  // Wizard stage machine.
  const [stage, setStage] = useState('welcome');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ikInfo, setIkInfo] = useState(false);

  // Identity-key (new standalone) state — secrets held in memory only.
  const [ident, setIdent] = useState(null); // { npub, nsec, pubkeyHex, skHex }
  const [revealNsec, setRevealNsec] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [charPos, setCharPos] = useState([]);
  const [charAns, setCharAns] = useState(['', '', '']);

  // Existing-nsec sign-in (returning member) — held in memory only.
  const [nsecInput, setNsecInput] = useState('');

  // Legacy 12-word restore.
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [phrase, setPhrase] = useState('');

  // Email/password paths.
  const [signup, setSignup] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [signin, setSignin] = useState({ email: '', password: '' });

  // Minimum profile (spec §4) collected after Screen 3 — REQUIRED persistence.
  const [profile, setProfile] = useState({
    firstName: '', lastName: '', dob: '', country: '', city: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '', language: 'en',
    email: '', phone: '',
  });

  // Which NEW-account method reached the shared screens: 'identity' | 'email'.
  const [method, setMethod] = useState(null);

  const nsecMasked = useMemo(() => (ident?.nsec ? ident.nsec.replace(/./g, '•') : ''), [ident]);

  const resetIdentityState = () => {
    setIdent(null); setRevealNsec(false); setCopied(false);
    setSavedConfirmed(false); setCharPos([]); setCharAns(['', '', '']);
    setNsecInput('');
  };

  // ── Welcome CTAs ──
  const chooseEmail = () => { setError(''); setStage('email-choice'); };
  const chooseIdentity = () => { setError(''); setStage('ik-choice'); };

  // ── Email choice ──
  const startEmailCreate = () => { setError(''); setMethod('email'); setStage('email-form'); };
  const startEmailSignin = () => { setError(''); setStage('email-signin'); };

  // ── Identity choice ──
  const startIdentityCreate = () => { setError(''); setMethod('identity'); resetIdentityState(); setStage('ik-screen1'); };
  const startNsecSignin = () => { setError(''); resetIdentityState(); setStage('ik-nsec'); };

  // ── Returning member — email + password sign in (routes immediately) ──
  const submitSignin = async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!signin.email || !signin.password) { setError('Enter your email and password to sign in.'); return; }
    setBusy(true);
    try {
      await login(signin.email, signin.password); // loadUser → Root routes
    } catch (err) {
      setError(err.message || 'Sign in failed. Please check your email and password.');
      setBusy(false);
    }
  };

  // ── Returning member — existing nsec sign in (routes immediately) ──
  const submitNsec = async (e) => {
    if (e) e.preventDefault();
    setError('');
    let keys;
    try {
      keys = identityFromNsec(nsecInput); // decode on-device; derive pubkey
    } catch (err) {
      setError(err.message || 'That does not look like a valid nsec key.');
      return;
    }
    setBusy(true);
    try {
      // Only npub + nonce + signature reach the API; the nsec/skHex never leave.
      await loginWithIdentityKey({ npub: keys.npub, skHex: keys.skHex, pubkeyHex: keys.pubkeyHex });
    } catch (err) {
      setError(err.message || 'Sign in failed. Please check your nsec and try again.');
      setBusy(false);
    }
  };

  // ── Screen 1: create the real standalone identity key ──
  const createKey = () => {
    setError('');
    try {
      const id = createStandaloneIdentity(); // { npub, nsec, pubkeyHex, skHex }
      setIdent(id);
      setRevealNsec(false);
      setSavedConfirmed(false);
      setCharPos(pickCharPositions(id.nsec, 3));
      setCharAns(['', '', '']);
      setStage('ik-reveal');
    } catch {
      setError('Could not generate an identity key. Please try again.');
    }
  };

  const copyNsec = async () => {
    if (!ident?.nsec) return;
    try { await navigator.clipboard.writeText(ident.nsec); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard optional */ }
  };

  const charChecksPass = () => charPos.length === 3 && charPos.every((p, i) => (charAns[i] || '') === (ident?.nsec?.[p - 1] || '\0'));

  const finishIdentityKey = () => {
    if (!savedConfirmed || !charChecksPass()) { setError('Please confirm your backup and complete the three character checks.'); return; }
    setError('');
    setStage('wallet');
  };

  // ── Legacy 12-word restore (routes immediately) ──
  const submitRestore = async () => {
    setError('');
    const clean = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!isValidMnemonic(clean)) { setError('That does not look like a valid 12-word recovery phrase.'); return; }
    setBusy(true);
    try {
      const keys = deriveFromMnemonic(clean); // { npub, nsec, pubkeyHex, skHex }
      await loginWithIdentityKey({ npub: keys.npub, skHex: keys.skHex, pubkeyHex: keys.pubkeyHex });
    } catch (err) {
      setError(err.message || 'Sign in failed. Please check your phrase and try again.');
      setBusy(false);
    }
  };

  // ── Email create path: minimum signup first ──
  const submitSignup = (e) => {
    e.preventDefault();
    setError('');
    if (!signup.firstName || !signup.lastName || !signup.email || !signup.password) {
      setError('Please complete every field to continue.'); return;
    }
    setProfile((p) => ({ ...p, firstName: signup.firstName, lastName: signup.lastName, email: signup.email }));
    setStage('email-transition');
  };

  // ── Screen 3 → collect minimum profile ──
  const goToProfile = () => {
    if (method === 'email') {
      setProfile((p) => ({ ...p, firstName: p.firstName || signup.firstName, lastName: p.lastName || signup.lastName }));
    }
    setStage('profile');
  };

  // ── Finalize (NEW accounts only): auth deferred → REQUIRED profile GATE → activate ──
  const finalize = async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!profile.firstName || !profile.lastName || !profile.dob || !profile.country || !profile.city || !profile.timezone || !profile.language) {
      setError('Please complete the required profile fields.'); return;
    }
    setBusy(true);

    // Step 1 — authenticate WITHOUT activating the React user yet.
    try {
      if (method === 'identity') {
        // Register ONLY the public npub — the nsec never leaves the device.
        await identityAuthDeferred({ npub: ident.npub, skHex: ident.skHex, pubkeyHex: ident.pubkeyHex });
      } else {
        await registerAccountDeferred({
          firstName: profile.firstName, lastName: profile.lastName,
          email: signup.email, password: signup.password,
          country: profile.country, role: 'patient',
        });
      }
    } catch (err) {
      setError(err.message || 'We could not create your account. Please try again.');
      setBusy(false);
      return;
    }

    // Step 2 — REQUIRED minimum-profile persistence (spec §3.5). This is a GATE,
    // NOT best-effort: on failure we STAY on this retryable screen and do NOT
    // activate the user or route into the intake.
    try {
      await api.saveProfile({
        firstName: profile.firstName, lastName: profile.lastName,
        dateOfBirth: profile.dob, country: profile.country, city: profile.city,
        timezone: profile.timezone, language: profile.language,
        contactEmail: profile.email || undefined, phone: profile.phone || undefined,
      });
    } catch {
      setError('We could not save your profile. Your account is ready — please try saving again.');
      setBusy(false);
      return; // fail-closed: stay on the profile screen
    }

    // Step 3 — only now activate the authenticated user → Root routes to Assessment.
    try {
      await activateUser();
    } catch {
      setError('We could not finish signing you in. Please try again.');
      setBusy(false);
    }
  };

  const backHome = () => { setError(''); setStage('welcome'); resetIdentityState(); };

  /* ── Renders ── */
  return (
    <div className="app-frame" style={{ paddingBottom: 0, minHeight: '100vh' }}>
      <div className="sol-bg" />
      <div className="page ob-page">
        {/* Top-left back to intro */}
        {stage === 'welcome' && (
          <button onClick={() => setAuthView('intro')} className="ob-back" aria-label="Back">
            <ArrowLeft size={15} /> Back
          </button>
        )}

        {/* ───────── Welcome ───────── */}
        {stage === 'welcome' && (
          <div className="ob-card fade-up">
            <div className="ob-brand">
              <img src="/solaris-logo.png" alt="Solaris Holistic Health" className="ob-logo" />
              <p className="wordmark ob-wordmark">SOLARIS</p>
              <p className="ob-tag">Holistic Health</p>
            </div>
            <p className="ob-lede">Choose how you'd like to begin your sovereign health journey.</p>

            <button className="ob-primary" onClick={chooseIdentity}>
              <KeyRound size={17} /> Continue with Solaris identity key
              <span role="button" tabIndex={0} className="ob-info" aria-label="What is an Identity Key?"
                onClick={(ev) => { ev.stopPropagation(); setIkInfo(true); }}
                onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); setIkInfo(true); } }}>
                <Info size={13} />
              </span>
            </button>
            <button className="ob-secondary" onClick={chooseEmail}>
              <Mail size={17} /> Continue with email and password
            </button>

            <p className="text-center" style={{ marginTop: 18, fontSize: '0.86rem' }}>
              <button className="ob-textbtn" onClick={() => { window.location.href = '/find'; }}>
                Browse practitioners <ArrowRight size={14} />
              </button>
            </p>
          </div>
        )}

        {/* ───────── Email choice — Sign in vs Create account ───────── */}
        {stage === 'email-choice' && (
          <div className="ob-card fade-up">
            <h2 className="ob-title">Email and password</h2>
            <p className="ob-lede">Sign in to your existing Solaris account, or create a new one.</p>
            <button className="ob-primary ob-primary-plain" onClick={startEmailSignin}>
              <LogIn size={17} /> Sign in to my account
            </button>
            <button className="ob-secondary" onClick={startEmailCreate}>
              <UserPlus size={17} /> Create a new account
            </button>
            <button className="ob-back-inline" onClick={backHome}><ArrowLeft size={14} /> Back</button>
          </div>
        )}

        {/* ───────── Returning member — email sign in ───────── */}
        {stage === 'email-signin' && (
          <form className="ob-card fade-up" onSubmit={submitSignin}>
            <h2 className="ob-title">Welcome back</h2>
            <p className="ob-lede">Sign in with the email and password on your Solaris account.</p>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" htmlFor="signin-email">Email</label>
              <input id="signin-email" className="input" type="email" autoComplete="email"
                value={signin.email} onChange={(e) => setSignin({ ...signin, email: e.target.value })} required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="field-label" htmlFor="signin-password">Password</label>
              <input id="signin-password" className="input" type="password" autoComplete="current-password"
                value={signin.password} onChange={(e) => setSignin({ ...signin, password: e.target.value })} required />
            </div>
            {error && <p className="ob-error">{error}</p>}
            <Button type="submit" className="btn-block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
            </Button>
            <button type="button" className="ob-back-inline" onClick={() => { setError(''); setStage('email-choice'); }}>
              <ArrowLeft size={14} /> Back
            </button>
          </form>
        )}

        {/* ───────── Identity choice — Create / Use existing / Restore legacy ───────── */}
        {stage === 'ik-choice' && (
          <div className="ob-card fade-up">
            <h2 className="ob-title">Solaris identity key</h2>
            <p className="ob-lede">Create a new identity key, or sign in with an identity you already hold.</p>
            <button className="ob-primary ob-primary-plain" onClick={startIdentityCreate}>
              <KeyRound size={17} /> Create a new identity key
            </button>
            <button className="ob-secondary" onClick={startNsecSignin}>
              <LogIn size={17} /> Use an existing nsec
            </button>
            <button className="ob-link" onClick={() => { setRestoreOpen(true); setError(''); }}>
              Restore legacy 12-word Solaris identity
            </button>
            <button className="ob-back-inline" onClick={backHome}><ArrowLeft size={14} /> Back</button>
          </div>
        )}

        {/* ───────── Returning member — use an existing nsec ───────── */}
        {stage === 'ik-nsec' && (
          <form className="ob-card fade-up" onSubmit={submitNsec}>
            <h2 className="ob-title">Use an existing nsec</h2>
            <p className="ob-lede">
              Paste your existing nsec. It is decoded on this device only to sign a one-time login challenge —
              it is never sent to Solaris.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" htmlFor="nsec-input">Your nsec</label>
              <input
                id="nsec-input" className="input" type="password" autoComplete="off" spellCheck={false}
                value={nsecInput} onChange={(e) => setNsecInput(e.target.value)}
                placeholder="nsec1…" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
            <div className="ob-warn">
              <ShieldCheck size={15} /> Never share this secret. Anyone who has it can act as you.
            </div>
            {error && <p className="ob-error">{error}</p>}
            <Button type="submit" className="btn-block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in with nsec'} <ArrowRight size={16} />
            </Button>
            <button type="button" className="ob-back-inline" onClick={() => { setError(''); resetIdentityState(); setStage('ik-choice'); }}>
              <ArrowLeft size={14} /> Back
            </button>
          </form>
        )}

        {/* ───────── Screen 1 — Reclaim Your Health ───────── */}
        {stage === 'ik-screen1' && (
          <div className="ob-card fade-up">
            <ProgressRail step={1} />
            <p className="ob-eyebrow">{SCREEN1.eyebrow}</p>
            <DisplayTitle text={SCREEN1.title} accent="mint" />
            <p className="ob-lede">{SCREEN1.lede}</p>
            <PointCard items={SCREEN1_POINTS} />
            {error && <p className="ob-error">{error}</p>}
            <Button className="btn-block" onClick={createKey}>{SCREEN1.cta} <ArrowRight size={16} /></Button>
            <button className="ob-back-inline" onClick={() => { setError(''); resetIdentityState(); setStage('ik-choice'); }}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        )}

        {/* ───────── Screen 1 — reveal + backup + 3 character checks ───────── */}
        {stage === 'ik-reveal' && ident && (
          <div className="ob-card fade-up">
            <ProgressRail step={1} />
            <h2 className="ob-title serif">Back up your identity key</h2>
            <p className="ob-lede">Your <b>npub</b> is public; your <b>nsec</b> is private. Solaris only registers your public npub.</p>

            <div className="ob-keyfield">
              <span className="ob-keylabel">Public key (npub)</span>
              <code className="ob-key ob-key-pub">{ident.npub}</code>
            </div>

            <div className="ob-keyfield">
              <span className="ob-keylabel">Private key (nsec)</span>
              <div className="ob-key-row">
                <code className="ob-key ob-key-secret">{revealNsec ? ident.nsec : nsecMasked}</code>
                <button className="ob-icon" onClick={() => setRevealNsec((v) => !v)} aria-label={revealNsec ? 'Hide private key' : 'Reveal private key'}>
                  {revealNsec ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button className="ob-copy" onClick={copyNsec}>
                {copied ? <><Check size={13} /> Copied — clear your clipboard after</> : <><Copy size={13} /> Copy (clipboard is less safe than paper)</>}
              </button>
            </div>

            <div className="ob-warn">
              <ShieldCheck size={15} /> Never share this secret. Anyone who has it can act as you.
            </div>

            <label className="ob-confirm" htmlFor="ik-saved">
              <input id="ik-saved" type="checkbox" checked={savedConfirmed} onChange={(e) => setSavedConfirmed(e.target.checked)} />
              I have safely backed up my private key.
            </label>

            {savedConfirmed && charPos.length === 3 && (
              <div className="ob-checks">
                <p className="ob-checks-title">Confirm your backup — enter these characters of your nsec:</p>
                <div className="ob-checks-row">
                  {charPos.map((pos, i) => (
                    <div key={pos} className="ob-check">
                      <label htmlFor={`ik-char-${pos}`}>Character #{pos}</label>
                      <input
                        id={`ik-char-${pos}`} className="input" maxLength={1} value={charAns[i]}
                        autoComplete="off" spellCheck={false}
                        onChange={(e) => setCharAns((a) => { const n = [...a]; n[i] = e.target.value; return n; })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="ob-error">{error}</p>}
            <Button className="btn-block" onClick={finishIdentityKey} disabled={!savedConfirmed || !charChecksPass()}>
              {SCREEN1.next} <ArrowRight size={16} />
            </Button>
            <button className="ob-back-inline" onClick={() => { resetIdentityState(); setStage('ik-screen1'); }}>
              <ArrowLeft size={14} /> Regenerate
            </button>
          </div>
        )}

        {/* ───────── Email create path — minimum profile first ───────── */}
        {stage === 'email-form' && (
          <form className="ob-card fade-up" onSubmit={submitSignup}>
            <h2 className="ob-title">Create your account</h2>
            <p className="ob-lede">Just the essentials to get started — you can add your Solaris identity key later.</p>
            <div className="row gap-2" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="signup-first">First name</label>
                <input id="signup-first" className="input" autoComplete="given-name"
                  value={signup.firstName} onChange={(e) => setSignup({ ...signup, firstName: e.target.value })} required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="signup-last">Last name</label>
                <input id="signup-last" className="input" autoComplete="family-name"
                  value={signup.lastName} onChange={(e) => setSignup({ ...signup, lastName: e.target.value })} required />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" htmlFor="signup-email">Email</label>
              <input id="signup-email" className="input" type="email" autoComplete="email"
                value={signup.email} onChange={(e) => setSignup({ ...signup, email: e.target.value })} required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="field-label" htmlFor="signup-password">Password</label>
              <input id="signup-password" className="input" type="password" autoComplete="new-password"
                value={signup.password} onChange={(e) => setSignup({ ...signup, password: e.target.value })} required />
            </div>
            {error && <p className="ob-error">{error}</p>}
            <Button type="submit" className="btn-block">Continue <ArrowRight size={16} /></Button>
            <button type="button" className="ob-back-inline" onClick={() => { setError(''); setStage('email-choice'); }}>
              <ArrowLeft size={14} /> Back
            </button>
          </form>
        )}

        {/* ───────── Email path — motion-toward-viewer transition ───────── */}
        {stage === 'email-transition' && (
          <div className="ob-card ob-transition fade-up">
            <div className="ob-node" aria-hidden="true"><Sparkles size={30} /></div>
            <p className="ob-transition-copy">
              {signup.firstName || profile.firstName}, you just signed up the normal way — now here's the part nobody else gives you.
            </p>
            <Button className="btn-block" onClick={() => setStage('email-arrival')}>Continue <ArrowRight size={16} /></Button>
          </div>
        )}

        {/* ───────── Email path — arrival screen 1 of 3 (health identity) ───────── */}
        {stage === 'email-arrival' && (
          <div className="ob-card fade-up">
            <ProgressRail step={1} />
            <p className="ob-eyebrow">{SCREEN1.eyebrow}</p>
            <DisplayTitle text={SCREEN1.title} accent="mint" />
            <p className="ob-lede">{SCREEN1.lede}</p>
            <PointCard items={SCREEN1_POINTS} />
            <p className="ob-note">You can create a Solaris identity key any time from your profile.</p>
            <Button className="btn-block" onClick={() => setStage('wallet')}>{SCREEN1.next} <ArrowRight size={16} /></Button>
          </div>
        )}

        {/* ───────── Screen 2 — optional Spark wallet / UTEXO teaser / Skip ───────── */}
        {stage === 'wallet' && (
          <div className="ob-card fade-up">
            <ProgressRail step={2} />
            <p className="ob-eyebrow ob-eyebrow-gold">Your digital wealth</p>
            <DisplayTitle text="Reclaim Your Wealth" accent="gold" />
            <SparkWalletCard />
            <Button className="btn-block ob-skip" onClick={() => setStage('sovereignty')}>Skip for now <ArrowRight size={16} /></Button>
          </div>
        )}

        {/* ───────── Screen 3 — Reclaim Your Sovereignty + Roadmap Preview ───────── */}
        {stage === 'sovereignty' && (
          <div className="ob-card fade-up">
            <ProgressRail step={3} />
            <SovereigntyNet />
            <p className="ob-eyebrow">You are the node</p>
            <DisplayTitle text={SCREEN3.title} accent="mint" />
            <p className="ob-lede">{SCREEN3.lede}</p>
            <PointCard items={SCREEN3_POINTS} warmLast />

            <div className="ob-roadmap">
              <p className="ob-roadmap-title"><Lock size={13} /> {SCREEN3.roadmapTitle}</p>
              <ul>
                {SCREEN3.roadmap.map((r) => (<li key={r}>{r}</li>))}
              </ul>
            </div>

            <Button className="btn-block" onClick={goToProfile}>{SCREEN3.cta} <ArrowRight size={16} /></Button>
            <div className="ob-subrow" aria-label={SCREEN3.motto}>
              {SCREEN3.motto.split('·').map((w) => w.trim()).map((w, i) => (
                <React.Fragment key={w}>
                  {i > 0 && <span className="ob-subrow-dot" aria-hidden="true" />}
                  <span>{w}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* ───────── Minimum profile (spec §4) — REQUIRED persistence GATE ───────── */}
        {stage === 'profile' && (
          <form className="ob-card fade-up" onSubmit={finalize}>
            <h2 className="ob-title">Your profile</h2>
            <p className="ob-lede">A few details to personalise your Solaris journey.</p>
            <div className="row gap-2" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="profile-first">First name</label>
                <input id="profile-first" className="input" autoComplete="given-name"
                  value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="profile-last">Last name</label>
                <input id="profile-last" className="input" autoComplete="family-name"
                  value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} required />
              </div>
            </div>
            <div className="row gap-2" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="profile-dob">Date of birth</label>
                <input id="profile-dob" className="input" type="date"
                  value={profile.dob} onChange={(e) => setProfile({ ...profile, dob: e.target.value })} required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="profile-country">Country</label>
                <input id="profile-country" className="input" autoComplete="country-name"
                  value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} required />
              </div>
            </div>
            <div className="row gap-2" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="profile-city">City / current location</label>
                <input id="profile-city" className="input" autoComplete="address-level2"
                  value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} placeholder="Your current city" required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="profile-tz">Timezone</label>
                <input id="profile-tz" className="input"
                  value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} required />
              </div>
            </div>
            <div className="row gap-2" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="profile-lang">Language</label>
                <input id="profile-lang" className="input"
                  value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })} required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="profile-contact">Contact email <span className="ob-optional">(optional)</span></label>
                <input id="profile-contact" className="input" type="email" autoComplete="email"
                  value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="field-label" htmlFor="profile-phone">Phone <span className="ob-optional">(optional)</span></label>
              <input id="profile-phone" className="input" autoComplete="tel"
                value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            {error && <p className="ob-error">{error}</p>}
            <Button type="submit" className="btn-block" disabled={busy}>
              {busy ? 'Creating your Solaris account…' : 'Continue to my intake'} <ArrowRight size={16} />
            </Button>
          </form>
        )}
      </div>

      {ikInfo && <IdentityKeyInfo onClose={() => setIkInfo(false)} />}

      {/* Legacy 12-word restore modal */}
      {restoreOpen && (
        <div className="ik-modal-backdrop" onClick={() => setRestoreOpen(false)}>
          <div className="ik-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <button className="ik-modal-close" onClick={() => setRestoreOpen(false)} aria-label="Close"><X size={18} /></button>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px', color: '#0A2B29', fontSize: '1.1rem' }}>
              <KeyRound size={18} color="#2DB584" /> Restore legacy 12-word Solaris identity
            </h3>
            <p style={{ color: '#6b807a', fontSize: '0.84rem', lineHeight: 1.5, margin: '8px 0 10px' }}>
              Enter your 12-word recovery phrase. It is used on this device only to sign in — it never leaves your device.
            </p>
            <label className="field-label" htmlFor="legacy-phrase">Recovery phrase</label>
            <textarea
              id="legacy-phrase" className="input" rows={3} value={phrase} onChange={(e) => setPhrase(e.target.value)}
              placeholder="word1 word2 word3 …" style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
            <div className="ob-warn" style={{ marginTop: 10 }}>
              <ShieldCheck size={15} /> Never share this secret. Anyone who has it can act as you.
            </div>
            {error && <p className="ob-error">{error}</p>}
            <Button className="btn-block" onClick={submitRestore} disabled={busy}>
              {busy ? 'Signing in…' : 'Restore identity'} <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      <style>{`
        .ob-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px 16px}
        .ob-card{width:100%;max-width:460px;background:#fff;border-radius:20px;padding:26px 22px;
          box-shadow:0 24px 60px rgba(6,20,19,0.22);position:relative}
        .ob-back{position:absolute;top:16px;left:10px;background:none;border:none;cursor:pointer;
          display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.85);font-size:0.85rem;z-index:2}
        .ob-brand{display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:14px}
        .ob-logo{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 0 14px rgba(47,190,159,0.4))}
        .ob-wordmark{font-size:1.5rem;letter-spacing:.18em;color:#0A2B29;margin:6px 0 0}
        .ob-tag{color:#2DB584;font-size:0.68rem;letter-spacing:.2em;text-transform:uppercase;margin:2px 0 0}
        .ob-eyebrow{color:#2DB584;font-size:0.72rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin:0 0 4px}
        .ob-title{color:#0A2B29;font-size:1.4rem;margin:0 0 8px;line-height:1.2}
        .ob-title.serif{font-family:var(--font-serif,'Noto Serif',Georgia,serif)}
        .ob-lede{color:#5b706a;font-size:0.9rem;line-height:1.55;margin:0 0 16px}
        .ob-note{color:#7d8f89;font-size:0.8rem;margin:8px 0 14px;font-style:italic}
        .ob-bullets{list-style:none;padding:0;margin:0 0 18px;display:flex;flex-direction:column;gap:10px}
        .ob-bullets li{display:flex;align-items:flex-start;gap:8px;color:#0A2B29;font-size:0.9rem;line-height:1.4}
        .ob-bullets li svg{color:#2DB584;flex-shrink:0;margin-top:2px}
        /* progress rail — reference thin-bar top bar + "N of 3" label */
        .ob-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px}
        .ob-steps{display:flex;gap:7px;align-items:center}
        .ob-step{height:3px;width:26px;border-radius:2px;background:#e2e9e6;transition:all .4s var(--ease,ease)}
        .ob-step-done{background:#ffb95f}
        .ob-step-now{background:#2DB584;width:34px}
        .ob-step-label{font-size:0.66rem;letter-spacing:.14em;text-transform:uppercase;color:#9aa9a4;font-weight:700;white-space:nowrap}
        /* serif display title with accent final word */
        .ob-display{color:#0A2B29;font-size:1.85rem;line-height:1.16;font-weight:600;letter-spacing:-0.015em;margin:0 0 10px}
        .ob-accent-mint{color:#2DB584}
        .ob-accent-gold{color:#c58a53}
        .ob-eyebrow-gold{color:#c58a53}
        /* three-point explanation card with icon tiles */
        .ob-points{border:1px solid rgba(10,43,41,0.1);border-radius:14px;overflow:hidden;margin:0 0 18px;background:#fbfdfc}
        .ob-point{display:flex;gap:12px;padding:13px 14px;align-items:flex-start}
        .ob-point + .ob-point{border-top:1px solid rgba(10,43,41,0.08)}
        .ob-point-ico{flex:0 0 32px;height:32px;border-radius:10px;display:grid;place-items:center;
          background:rgba(45,181,132,0.12);color:#2DB584}
        .ob-point-warm .ob-point-ico{background:rgba(197,138,83,0.14);color:#c58a53}
        .ob-point-body{display:flex;flex-direction:column;gap:2px}
        .ob-point-h{font-size:0.92rem;font-weight:600;color:#0A2B29;line-height:1.3}
        .ob-point-b{font-size:0.82rem;line-height:1.45;color:#6b807a}
        /* sovereignty network visual (decorative) */
        .ob-net{height:150px;display:flex;align-items:center;justify-content:center;margin:2px 0 12px}
        .ob-net svg{max-width:300px;overflow:visible}
        .ob-link{stroke:rgba(10,43,41,0.16);stroke-width:1.1;fill:none;stroke-dasharray:120;stroke-dashoffset:120;
          animation:obDraw 1s var(--ease,ease) forwards}
        .ob-link-warm{stroke:rgba(197,138,83,0.4)}
        .ob-net-node{opacity:0;animation:obPop .6s var(--ease,ease) forwards}
        .ob-halo{transform-origin:160px 88px;animation:obBreathe 4.6s var(--ease,ease) infinite}
        @keyframes obDraw{to{stroke-dashoffset:0}}
        @keyframes obPop{to{opacity:1}}
        @keyframes obBreathe{0%,100%{transform:scale(.82);opacity:.4}50%{transform:scale(1.12);opacity:.08}}
        /* Heal · Learn · Earn sub-row under the final CTA */
        .ob-subrow{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:12px;
          font-size:0.8rem;color:#6b807a;font-weight:600;letter-spacing:.02em}
        .ob-subrow-dot{width:3px;height:3px;border-radius:50%;background:#c9d4cf}
        .ob-primary{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;position:relative;
          background:#2DB584;border:1px solid #2DB584;color:#fff;border-radius:14px;padding:15px 16px;cursor:pointer;
          font-weight:700;font-size:0.95rem;box-shadow:0 4px 14px rgba(45,181,132,0.28);margin-bottom:12px}
        .ob-primary:hover{background:#26a074}
        .ob-primary-plain{box-shadow:none}
        .ob-secondary{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;
          background:#f5f9f7;border:1px solid rgba(45,181,132,0.35);color:#0A2B29;border-radius:14px;
          padding:15px 16px;cursor:pointer;font-weight:600;font-size:0.95rem;margin-bottom:14px}
        .ob-secondary:hover{background:#eaf4f0}
        .ob-info{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:99px;
          background:rgba(255,255,255,0.25);color:#fff;cursor:pointer}
        .ob-link{display:block;width:100%;text-align:center;background:none;border:none;color:#2DB584;
          font-weight:600;font-size:0.86rem;cursor:pointer;padding:6px}
        .ob-textbtn{background:none;border:none;color:#2DB584;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:5px}
        .ob-error{color:#c0392b;font-size:0.84rem;margin:0 0 12px}
        .ob-back-inline{display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:#6b807a;
          font-size:0.82rem;cursor:pointer;margin:12px auto 0}
        .ob-keyfield{margin:0 0 14px}
        .ob-keylabel{display:block;font-size:0.74rem;color:#6b807a;font-weight:600;margin-bottom:5px}
        .ob-key{display:block;font-family:monospace;font-size:0.78rem;word-break:break-all;background:#f5f9f7;
          border:1px solid rgba(10,43,41,0.1);border-radius:10px;padding:10px 12px;color:#0A2B29}
        .ob-key-secret{background:#fff6f0;border-color:rgba(197,138,83,0.4)}
        .ob-key-row{display:flex;align-items:stretch;gap:8px}
        .ob-key-row .ob-key{flex:1}
        .ob-icon{background:#f5f9f7;border:1px solid rgba(10,43,41,0.1);border-radius:10px;cursor:pointer;
          padding:0 12px;color:#6b807a;display:flex;align-items:center}
        .ob-copy{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:#c58a53;
          font-size:0.78rem;font-weight:600;cursor:pointer;margin-top:6px;padding:2px 0}
        .ob-warn{display:flex;gap:8px;align-items:flex-start;background:rgba(197,138,83,0.12);
          border:1px solid rgba(197,138,83,0.35);color:#8a5a2b;border-radius:10px;padding:10px 12px;
          font-size:0.8rem;line-height:1.45;margin:0 0 14px}
        .ob-warn svg{flex-shrink:0;margin-top:1px}
        .ob-confirm{display:flex;gap:8px;align-items:flex-start;font-size:0.84rem;color:#5b706a;cursor:pointer;line-height:1.4;margin-bottom:14px}
        .ob-confirm input{margin-top:2px}
        .ob-checks{background:#f5f9f7;border-radius:12px;padding:12px;margin-bottom:14px}
        .ob-checks-title{font-size:0.82rem;color:#0A2B29;font-weight:600;margin:0 0 10px}
        .ob-checks-row{display:flex;gap:10px}
        .ob-check{flex:1;text-align:center}
        .ob-check label{display:block;font-size:0.72rem;color:#6b807a;margin-bottom:4px}
        .ob-check .input{text-align:center;font-family:monospace;font-size:1rem}
        .ob-transition{text-align:center;align-items:center}
        .ob-node{width:74px;height:74px;border-radius:99px;background:radial-gradient(circle,#2DB584,#0A2B29);
          display:flex;align-items:center;justify-content:center;color:#fff;margin:6px auto 18px;
          box-shadow:0 0 40px rgba(45,181,132,0.5);animation:obPulse 2.2s ease-in-out infinite}
        @keyframes obPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
        .ob-transition-copy{color:#0A2B29;font-size:1.15rem;line-height:1.5;font-weight:600;margin:0 0 22px}
        .ob-skip{}
        .ob-sov-row{display:flex;flex-direction:column;gap:3px;margin-bottom:14px}
        .ob-sov-h{display:inline-flex;align-items:center;gap:7px;font-weight:700;color:#0A2B29;font-size:0.96rem}
        .ob-sov-h svg{color:#2DB584}
        .ob-sov-b{color:#6b807a;font-size:0.86rem;line-height:1.5;padding-left:21px}
        .ob-motto{text-align:center;color:#2DB584;font-weight:700;letter-spacing:.06em;font-size:1rem;margin:6px 0 16px}
        .ob-roadmap{background:#f5f9f7;border:1px dashed rgba(45,181,132,0.5);border-radius:12px;padding:14px;margin-bottom:18px}
        .ob-roadmap-title{display:flex;align-items:center;gap:6px;font-weight:700;color:#0A2B29;font-size:0.84rem;
          text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px}
        .ob-roadmap ul{margin:0;padding-left:18px;color:#6b807a;font-size:0.84rem;line-height:1.6}
        .ob-optional{color:#9aa9a4;font-weight:400}
        .ik-modal-backdrop{position:fixed;inset:0;background:rgba(6,20,19,0.55);backdrop-filter:blur(3px);
          display:flex;align-items:center;justify-content:center;z-index:1000;padding:18px}
        .ik-modal{position:relative;background:#fff;border-radius:18px;max-width:420px;width:100%;
          padding:22px 20px;box-shadow:0 24px 60px rgba(6,20,19,0.35);max-height:88vh;overflow-y:auto}
        .ik-modal-close{position:absolute;top:12px;right:12px;background:none;border:none;cursor:pointer;color:#6b807a}
        @media (prefers-reduced-motion:reduce){
          .ob-node{animation:none}
          .fade-up{animation:none!important}
          .ob-net-node{opacity:1;animation:none}
          .ob-link{stroke-dashoffset:0;animation:none}
          .ob-halo{animation:none;opacity:.24}
        }
      `}</style>
    </div>
  );
}
