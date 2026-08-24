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
  signChallenge,
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
 *     → Screen 3 Reclaim Your Sovereignty
 *     → minimum profile  (REQUIRED persistence GATE — spec §3.5)
 *     → hands off to the existing Assessment intake.
 *
 * SECRET DISCIPLINE (spec §3/§4): identity nsec/skHex live in component memory
 * only for the session — never sent to Solaris, never stored, never snapshotted.
 * Only the public npub is registered. Returning members' existing nsec is decoded
 * on-device and only npub/nonce/signature reach the API. New-account creation
 * gates on a REQUIRED minimum-profile save before the React user is activated.
 * ──────────────────────────────────────────────────────────────────────────── */

// §G — Invite-only Beta boundary. The public marketing site owns the email
// waitlist; the app only LINKS to it. The destination is supplied through build
// configuration (VITE_WAITLIST_URL) — never a hardcoded private/temporary URL.
// When unset (e.g. local dev), the waitlist CTA is simply omitted rather than
// pointing at a placeholder. Only absolute http(s) URLs are accepted.
const WAITLIST_URL = (() => {
  const raw = (import.meta.env.VITE_WAITLIST_URL || '').trim();
  return /^https?:\/\//i.test(raw) ? raw : '';
})();

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
  // Compact, muted roadmap note only — no dashed panel, no forbidden claims.
  roadmapNote: 'Roadmap · Self-hosting and infrastructure hardening continue after Beta',
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
        <circle className="ob-halo" cx="160" cy="88" r="30" fill="none" stroke="#4edea3" strokeWidth="1" />
        <circle className="ob-halo ob-halo-2" cx="160" cy="88" r="20" fill="none" stroke="#4edea3" strokeWidth="1" />
        <circle cx="160" cy="88" r="9" fill="#4edea3" />
        <circle cx="160" cy="88" r="15" fill="none" stroke="#4edea3" strokeWidth="1.4" opacity=".5" />
        <circle className="ob-net-node" cx="62" cy="44" r="5" fill="#4fdbc8" style={{ animationDelay: '.9s' }} />
        <circle className="ob-net-node" cx="42" cy="118" r="4" fill="#4fdbc8" style={{ animationDelay: '1.05s' }} />
        <circle className="ob-net-node" cx="112" cy="152" r="4.5" fill="#ffb95f" style={{ animationDelay: '1.2s' }} />
        <circle className="ob-net-node" cx="258" cy="40" r="4.5" fill="#4fdbc8" style={{ animationDelay: '1.35s' }} />
        <circle className="ob-net-node" cx="282" cy="110" r="5" fill="#4fdbc8" style={{ animationDelay: '1.5s' }} />
        <circle className="ob-net-node" cx="212" cy="154" r="4" fill="#ffb95f" style={{ animationDelay: '1.65s' }} />
      </svg>
    </div>
  );
}

// Screen 1 identity-key hero — mint concentric pulse + spokes + centre key glyph.
// Adapted from the reference SVG; decorative, respects prefers-reduced-motion.
function IdentityViz() {
  const spokes = [
    [40, 24], [130, 20], [22, 62], [148, 66], [52, 96], [118, 100],
  ];
  return (
    <div className="ob-viz" aria-hidden="true">
      <svg viewBox="0 0 170 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {spokes.map(([x, y], i) => (
          <line key={i} className="ob-spoke" x1="85" y1="60" x2={x} y2={y} />
        ))}
        {spokes.map(([x, y], i) => (
          <circle key={`m${i}`} className="ob-mote" cx={x} cy={y} r="2.4" fill="#4fdbc8"
            style={{ animationDelay: `${i * 0.4}s` }} />
        ))}
        <circle className="ob-pulse" cx="85" cy="60" r="40" fill="none" stroke="#4edea3" strokeWidth="1" />
        <circle className="ob-pulse ob-pulse-2" cx="85" cy="60" r="30" fill="none" stroke="#4edea3" strokeWidth="1" />
        <circle cx="85" cy="60" r="22" fill="#0a101d" stroke="#4edea3" strokeWidth="1.4" />
        <g stroke="#4edea3" strokeWidth="2.2" strokeLinecap="round" fill="none">
          <circle cx="80" cy="55" r="6" />
          <path d="M85 60 L94 69 M90 65 L95 60 M92 67 L97 62" />
        </g>
      </svg>
    </div>
  );
}

// Screen 2 wealth hero — gold concentric pulse + centre lightning/bolt glyph.
function WalletViz() {
  return (
    <div className="ob-viz ob-viz-gold" aria-hidden="true">
      <svg viewBox="0 0 170 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <path className="ob-arc" d="M25 40 Q85 8 145 40" fill="none" stroke="#ffb95f" strokeWidth="1" opacity=".5" />
        <path className="ob-arc" d="M25 80 Q85 112 145 80" fill="none" stroke="#ffb95f" strokeWidth="1" opacity=".5" />
        <circle className="ob-mote" cx="30" cy="46" r="2.4" fill="#ffb95f" style={{ animationDelay: '.2s' }} />
        <circle className="ob-mote" cx="140" cy="74" r="2.4" fill="#4fdbc8" style={{ animationDelay: '.9s' }} />
        <circle className="ob-pulse" cx="85" cy="60" r="40" fill="none" stroke="#ffb95f" strokeWidth="1" />
        <circle className="ob-pulse ob-pulse-2" cx="85" cy="60" r="30" fill="none" stroke="#ffb95f" strokeWidth="1" />
        <circle cx="85" cy="60" r="22" fill="#0a101d" stroke="#ffb95f" strokeWidth="1.4" />
        <path d="M88 47 L78 62 L85 62 L82 73 L92 58 L85 58 Z" fill="#ffb95f" />
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
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', color: 'var(--on-surface)', fontSize: '1.05rem' }}>
          <KeyRound size={18} color="#4edea3" /> {IDENTITY_KEY_INFO.title}
        </h3>
        {IDENTITY_KEY_INFO.lines.map((line, i) => (
          <p key={i} style={{ color: 'var(--on-surface-variant)', fontSize: '0.86rem', lineHeight: 1.55, margin: '0 0 12px' }}>{line}</p>
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
  const [identMode, setIdentMode] = useState('generate'); // 'generate' | 'link'
  const [revealNsec, setRevealNsec] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  // Existing-nsec sign-in (returning member) — held in memory only.
  const [nsecInput, setNsecInput] = useState('');
  // Set when the backend reports the key is not linked to any account (unknown
  // npub) — we then offer account creation instead of silently creating one.
  const [nsecNeedsAccount, setNsecNeedsAccount] = useState(false);

  // Wealth-screen (Spark) outcome for the server-side onboarding ack.
  const [walletOutcome, setWalletOutcome] = useState(null); // 'completed' | null
  const [walletBackup, setWalletBackup] = useState(false);

  // New-user intent captured from the "Sign in with identity key" entry when the
  // account does not exist yet: harmless in-memory hint only — NO key, NO secret.
  const [continueToIdentitySetup, setContinueToIdentitySetup] = useState(false);

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
    setIdent(null); setIdentMode('generate'); setRevealNsec(false); setCopied(false);
    setSavedConfirmed(false); setNsecInput('');
  };

  // ── Welcome CTAs (3 explicit options) ──
  // (1) Sign in with email and password
  const startEmailSignin = () => { setError(''); setStage('email-signin'); };
  // (2) Sign in with identity key (returning members hold a linked key)
  const chooseIdentity = () => { setError(''); setStage('ik-choice'); };
  // (3) Create a Solaris account (email/password — the recovery foundation)
  const startEmailCreate = () => {
    setError(''); setMethod('email'); setContinueToIdentitySetup(false); setStage('email-form');
  };

  // ── Identity-key entry ── returning member signs in with an existing key.
  const startNsecSignin = () => { setError(''); resetIdentityState(); setStage('ik-nsec'); };
  // New user who wants an identity key: every Beta account is founded on an
  // email/password account first, so route to Create Account, remembering only the
  // harmless intent (no key is generated and no secret exists yet).
  const startCreateThenIdentity = () => {
    setError(''); setMethod('email'); setContinueToIdentitySetup(true); resetIdentityState(); setStage('email-form');
  };

  // ── Screen 1 identity setup (AFTER the account exists) ──
  // "Link existing locally": paste an nsec you already hold — decoded on-device to
  // derive the public npub; only the npub is ever bound to the account.
  const startLinkIdentity = () => { setError(''); resetIdentityState(); setIdentMode('link'); setStage('ik-link'); };

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
    setError(''); setNsecNeedsAccount(false);
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
      // Unknown npub → the backend refuses to create an identity-only account.
      // Offer account creation instead of silently provisioning one.
      if (err && (err.mustCreateAccount || err.body?.mustCreateAccount || /create a solaris account/i.test(err.message || ''))) {
        setNsecNeedsAccount(true);
      }
      setError(err.message || 'Sign in failed. Please check your identity key and try again.');
      setBusy(false);
    }
  };

  // ── Screen 1: create the real standalone identity key (locally) ──
  const createKey = () => {
    setError('');
    try {
      const id = createStandaloneIdentity(); // { npub, nsec, pubkeyHex, skHex }
      setIdent(id);
      setIdentMode('generate');
      setRevealNsec(false);
      setSavedConfirmed(false);
      setStage('ik-reveal');
    } catch {
      setError('Could not generate an identity key. Please try again.');
    }
  };

  // ── Screen 1: link an existing key (decode nsec on-device → derive npub) ──
  const submitLink = (e) => {
    if (e) e.preventDefault();
    setError('');
    let keys;
    try {
      keys = identityFromNsec(nsecInput); // { npub, nsec, pubkeyHex, skHex } — on-device only
    } catch (err) {
      setError(err.message || 'That does not look like a valid nsec key.');
      return;
    }
    setIdent(keys);
    setIdentMode('link');
    setRevealNsec(false);
    setSavedConfirmed(false);
    setStage('ik-reveal');
  };

  const copyNsec = async () => {
    if (!ident?.nsec) return;
    try { await navigator.clipboard.writeText(ident.nsec); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard optional */ }
  };

  // Complete Screen 1: the account already exists (registered before this screen),
  // so we bind ONLY the public npub to it and record the backup ACKNOWLEDGEMENT
  // server-side. The nsec/skHex never leave the device.
  const finishIdentityKey = async () => {
    if (!savedConfirmed) { setError('Please confirm you have saved your private key to continue.'); return; }
    setError(''); setBusy(true);
    try {
      // Proof-of-control binding (blocker #2): request a short-lived BIND
      // challenge, sign the server's canonical message locally with the on-device
      // secret key, then submit ONLY the public npub + signed proof. The nsec
      // never leaves the device.
      const ch = await api.identityBindChallenge(ident.npub);
      const signature = signChallenge(ident.skHex, ch.message);
      await api.bindIdentityKey(ident.npub, { challengeId: ch.challengeId, nonce: ch.nonce, signature });
      await api.ackOnboardingScreen('identity');
      setBusy(false);
      setStage('wallet');
    } catch (err) {
      setBusy(false);
      setError(err.message || 'We could not link your identity key. Please try again.');
    }
  };

  // ── Screen 2 (wealth): advance after generate+ack, restore, or Skip ──
  const advanceFromWallet = async (outcome) => {
    setError(''); setBusy(true);
    try {
      await api.ackOnboardingScreen('wealth', {
        outcome,
        walletBackup: outcome === 'completed' ? walletBackup : false,
      });
    } catch { /* non-blocking: wealth screen is optional and must never trap the user */ }
    setBusy(false);
    setStage('sovereignty');
  };

  // ── Screen 3 (sovereignty): record completion of the one-time experience ──
  const finishSovereignty = async () => {
    setError(''); setBusy(true);
    try { await api.ackOnboardingScreen('sovereignty'); } catch { /* non-blocking */ }
    setBusy(false);
    goToProfile();
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

  // ── Email create path: register the account FIRST (spec order: every Solaris
  // account is created with email/password before identity/wallet setup). We
  // authenticate WITHOUT activating the React user, so Screens 1–3 (identity
  // bind + onboarding acks) run against an authenticated account, yet the app
  // does not route into the intake until the flow completes.
  const submitSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!signup.firstName || !signup.lastName || !signup.email || !signup.password) {
      setError('Please complete every field to continue.'); return;
    }
    setBusy(true);
    try {
      await registerAccountDeferred({
        firstName: signup.firstName, lastName: signup.lastName,
        email: signup.email, password: signup.password, role: 'patient',
      });
    } catch (err) {
      setBusy(false);
      setError(err.message || 'We could not create your account. Please try again.');
      return;
    }
    setProfile((p) => ({ ...p, firstName: signup.firstName, lastName: signup.lastName, email: signup.email }));
    setBusy(false);
    setStage('email-transition');
  };

  // ── Screen 3 → collect minimum profile ──
  const goToProfile = () => {
    if (method === 'email') {
      setProfile((p) => ({ ...p, firstName: p.firstName || signup.firstName, lastName: p.lastName || signup.lastName }));
    }
    setStage('profile');
  };

  // ── Finalize (NEW accounts only): REQUIRED profile GATE → activate ──
  // The account was already registered at submitSignup (spec order), and the
  // authenticated Screens 1–3 have run, so here we only persist the minimum
  // profile and then activate the React user (which routes into the intake).
  const finalize = async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!profile.firstName || !profile.lastName || !profile.dob || !profile.country || !profile.city || !profile.timezone || !profile.language) {
      setError('Please complete the required profile fields.'); return;
    }
    setBusy(true);

    // Step 1 — REQUIRED minimum-profile persistence (spec §3.5). This is a GATE,
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

    // Step 2 — only now activate the authenticated user → Root routes to Assessment.
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
              {/* §G — invite-only Beta boundary, shown up front on the access screen. */}
              <span className="ob-beta-badge">
                <Lock size={12} /> Beta · Invite only
              </span>
            </div>
            <p className="ob-lede">Choose how you'd like to begin your sovereign health journey.</p>

            <button className="ob-primary ob-primary-plain" onClick={startEmailSignin}>
              <Mail size={17} /> Sign in with email and password
            </button>
            <button className="ob-secondary" onClick={chooseIdentity}>
              <KeyRound size={17} /> Sign in with identity key
              <span role="button" tabIndex={0} className="ob-info" aria-label="What is an Identity Key?"
                onClick={(ev) => { ev.stopPropagation(); setIkInfo(true); }}
                onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); setIkInfo(true); } }}>
                <Info size={13} />
              </span>
            </button>
            <button className="ob-secondary" onClick={startEmailCreate}>
              <UserPlus size={17} /> Create a Solaris account
            </button>

            {/* §G — invited members sign in above; everyone else joins the public
                waitlist on the marketing site (this app never collects waitlist
                emails). The link renders only when a real URL is configured. */}
            <p className="ob-invite-note">
              Solaris is in invite-only Beta. Invited members can sign in above.
            </p>
            {WAITLIST_URL && (
              <a className="ob-waitlist" href={WAITLIST_URL} target="_blank" rel="noopener noreferrer">
                <Mail size={15} /> Join the waitlist <ArrowRight size={14} />
              </a>
            )}

            <p className="text-center" style={{ marginTop: 18, fontSize: '0.86rem' }}>
              <button className="ob-textbtn" onClick={() => { window.location.href = '/find'; }}>
                Browse practitioners <ArrowRight size={14} />
              </button>
            </p>
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
            <button type="button" className="ob-back-inline" onClick={backHome}>
              <ArrowLeft size={14} /> Back
            </button>
          </form>
        )}

        {/* ───────── Identity-key sign in (returning members) ───────── */}
        {stage === 'ik-choice' && (
          <div className="ob-card fade-up">
            <h2 className="ob-title">Sign in with identity key</h2>
            <p className="ob-lede">
              Use an identity key already linked to your Solaris account. Your key signs a one-time
              challenge on this device — the private key is never sent to Solaris.
            </p>
            <button className="ob-primary ob-primary-plain" onClick={startNsecSignin}>
              <LogIn size={17} /> Use an existing identity key
            </button>
            <p className="ob-note" style={{ marginTop: 14 }}>
              New to Solaris? Every Beta account is founded on an email and password first — so you'll
              create your account, then generate your identity key on the next step.
            </p>
            <button className="ob-secondary" onClick={startCreateThenIdentity}>
              <UserPlus size={17} /> Create account, then generate my identity key
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
            <h2 className="ob-title">Use an existing identity key</h2>
            <p className="ob-lede">
              Paste the identity key (nsec) already linked to your account. It is decoded on this device
              only to sign a one-time login challenge — it is never sent to Solaris.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" htmlFor="nsec-input">Your identity key (nsec)</label>
              <input
                id="nsec-input" className="input" type="password" autoComplete="off" spellCheck={false}
                value={nsecInput} onChange={(e) => { setNsecInput(e.target.value); setNsecNeedsAccount(false); }}
                placeholder="nsec1…" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
            <div className="ob-warn">
              <ShieldCheck size={15} /> Never share this secret. Anyone who has it can act as you.
            </div>
            {error && <p className="ob-error">{error}</p>}
            {nsecNeedsAccount ? (
              <Button type="button" className="btn-block" onClick={startEmailCreate}>
                <UserPlus size={16} /> Create a Solaris account
              </Button>
            ) : (
              <Button type="submit" className="btn-block" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in with identity key'} <ArrowRight size={16} />
              </Button>
            )}
            <button type="button" className="ob-back-inline" onClick={() => { setError(''); setNsecNeedsAccount(false); resetIdentityState(); setStage('ik-choice'); }}>
              <ArrowLeft size={14} /> Back
            </button>
          </form>
        )}

        {/* ───────── Screen 1 — Reclaim Your Health (identity setup) ───────── */}
        {stage === 'ik-screen1' && (
          <div className="ob-card fade-up ob-card-tight">
            <ProgressRail step={1} />
            <p className="ob-eyebrow">{SCREEN1.eyebrow}</p>
            <DisplayTitle text={SCREEN1.title} accent="mint" />
            <p className="ob-lede">{SCREEN1.lede}</p>
            <PointCard items={SCREEN1_POINTS} />
            {error && <p className="ob-error">{error}</p>}
            <Button className="btn-block" onClick={createKey}>
              <KeyRound size={16} /> Generate my identity key locally
            </Button>
            <button className="ob-secondary" onClick={startLinkIdentity}>
              <LogIn size={16} /> Link an existing key locally
            </button>
          </div>
        )}

        {/* ───────── Screen 1 — link an existing key (paste nsec on-device) ───────── */}
        {stage === 'ik-link' && (
          <form className="ob-card fade-up ob-card-tight" onSubmit={submitLink}>
            <ProgressRail step={1} />
            <h2 className="ob-title serif">Link an existing identity key</h2>
            <p className="ob-lede">
              Paste an identity key you already hold. It is decoded on this device only to derive your
              public npub — Solaris only ever stores the public npub, never your private key.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label" htmlFor="link-nsec">Your identity key (nsec)</label>
              <input
                id="link-nsec" className="input" type="password" autoComplete="off" spellCheck={false}
                value={nsecInput} onChange={(e) => setNsecInput(e.target.value)}
                placeholder="nsec1…" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
            <div className="ob-warn">
              <ShieldCheck size={15} /> Never share this secret. Anyone who has it can act as you.
            </div>
            {error && <p className="ob-error">{error}</p>}
            <Button type="submit" className="btn-block">Continue <ArrowRight size={16} /></Button>
            <button type="button" className="ob-back-inline" onClick={() => { setError(''); resetIdentityState(); setStage('ik-screen1'); }}>
              <ArrowLeft size={14} /> Back
            </button>
          </form>
        )}

        {/* ───────── Screen 1 — reveal + checkbox-only backup acknowledgement ───────── */}
        {stage === 'ik-reveal' && ident && (
          <div className="ob-card fade-up ob-card-tight">
            <ProgressRail step={1} />
            <h2 className="ob-title serif">{identMode === 'link' ? 'Confirm your linked identity key' : 'Back up your identity key'}</h2>
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
              I have saved my private key securely and understand that Solaris cannot recover it.
            </label>

            {error && <p className="ob-error">{error}</p>}
            <Button className="btn-block" onClick={finishIdentityKey} disabled={!savedConfirmed || busy}>
              {busy ? 'Linking…' : SCREEN1.next} <ArrowRight size={16} />
            </Button>
            <button className="ob-back-inline" onClick={() => { resetIdentityState(); setStage('ik-screen1'); }}>
              <ArrowLeft size={14} /> {identMode === 'link' ? 'Use a different key' : 'Regenerate'}
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
            <Button type="submit" className="btn-block" disabled={busy}>
              {busy ? 'Creating your account…' : 'Continue'} <ArrowRight size={16} />
            </Button>
            <button type="button" className="ob-back-inline" onClick={backHome}>
              <ArrowLeft size={14} /> Back
            </button>
          </form>
        )}

        {/* ───────── Email path — motion-toward-viewer transition ───────── */}
        {stage === 'email-transition' && (
          <div className="ob-card ob-transition fade-up">
            <div className="ob-node" aria-hidden="true"><Sparkles size={30} /></div>
            <p className="ob-transition-copy">
              {signup.firstName || profile.firstName}, your account is ready — now here's the part nobody else gives you.
            </p>
            <Button className="btn-block" onClick={() => setStage('ik-screen1')}>Continue <ArrowRight size={16} /></Button>
          </div>
        )}

        {/* ───────── Screen 2 — optional Spark wallet / UTEXO teaser / Skip ───────── */}
        {stage === 'wallet' && (
          <div className="ob-card ob-gold fade-up">
            <ProgressRail step={2} />
            <WalletViz />
            <p className="ob-eyebrow ob-eyebrow-gold">Your digital wealth</p>
            <DisplayTitle text="Reclaim Your Wealth" accent="gold" />
            {/* onWalletReady fires only once the wallet is genuinely ready — either
                generate-after-backup-ack (backedUp:true) or restore-from-mnemonic
                (the member already possesses their recovery words). Either way a
                'completed' outcome carries a valid backup acknowledgement, which the
                server now requires for completion (blocker #5). */}
            <SparkWalletCard onWalletReady={() => { setWalletOutcome('completed'); setWalletBackup(true); }} />
            {error && <p className="ob-error">{error}</p>}
            {walletOutcome === 'completed' ? (
              <Button className="btn-block" onClick={() => advanceFromWallet('completed')} disabled={busy}>
                Continue <ArrowRight size={16} />
              </Button>
            ) : (
              <Button className="btn-block ob-skip" onClick={() => advanceFromWallet('skipped')} disabled={busy}>
                Skip for now <ArrowRight size={16} />
              </Button>
            )}
          </div>
        )}

        {/* ───────── Screen 3 — Reclaim Your Sovereignty ───────── */}
        {stage === 'sovereignty' && (
          <div className="ob-card fade-up">
            <ProgressRail step={3} />
            <SovereigntyNet />
            <p className="ob-eyebrow">You are the node</p>
            <DisplayTitle text={SCREEN3.title} accent="mint" />
            <p className="ob-lede">{SCREEN3.lede}</p>
            <PointCard items={SCREEN3_POINTS} warmLast />

            <p className="ob-roadmap-note"><Lock size={12} /> {SCREEN3.roadmapNote}</p>

            {error && <p className="ob-error">{error}</p>}
            <Button className="btn-block" onClick={finishSovereignty} disabled={busy}>{SCREEN3.cta} <ArrowRight size={16} /></Button>
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
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px', color: 'var(--on-surface)', fontSize: '1.1rem' }}>
              <KeyRound size={18} color="#4edea3" /> Restore legacy 12-word Solaris identity
            </h3>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.84rem', lineHeight: 1.5, margin: '8px 0 10px' }}>
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
        /* ── Beta V1 onboarding · DARK Solaris surfaces (Screens 1–3).
           Full dark screen — NOT a light card on a dark page. Tokens map to the
           Solaris design system in index.css: surfaces #05080f/#0c1322/#151b2b/
           #191f2f/#232a3a, text #dce2f8/#bbcabf/#86948a, mint #4edea3, gold #ffb95f. */
        .ob-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:22px 16px}
        .ob-card{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--outline-variant);
          border-radius:22px;padding:24px 22px 26px;position:relative;
          box-shadow:0 24px 70px rgba(0,0,0,0.55),0 0 0 1px rgba(78,222,163,0.04)}
        .ob-gold{box-shadow:0 24px 70px rgba(0,0,0,0.55),0 0 0 1px rgba(255,185,95,0.05)}
        .ob-back{position:absolute;top:16px;left:10px;background:none;border:none;cursor:pointer;
          display:flex;align-items:center;gap:4px;color:var(--on-surface-variant);font-size:0.85rem;z-index:2}
        .ob-brand{display:flex;flex-direction:column;align-items:center;gap:2px;margin-bottom:14px}
        .ob-logo{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 0 16px rgba(78,222,163,0.45))}
        .ob-wordmark{font-size:1.5rem;letter-spacing:.18em;color:var(--on-surface);margin:6px 0 0}
        .ob-tag{color:var(--primary);font-size:0.68rem;letter-spacing:.2em;text-transform:uppercase;margin:2px 0 0}
        .ob-eyebrow{color:var(--primary);font-size:0.72rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin:0 0 4px}
        .ob-title{color:var(--on-surface);font-size:1.4rem;margin:0 0 8px;line-height:1.2}
        .ob-title.serif{font-family:var(--font-serif)}
        .ob-lede{color:var(--on-surface-variant);font-size:0.9rem;line-height:1.55;margin:0 0 16px;max-width:34ch}
        .ob-note{color:var(--outline);font-size:0.8rem;margin:8px 0 14px;font-style:italic}
        .ob-bullets{list-style:none;padding:0;margin:0 0 18px;display:flex;flex-direction:column;gap:10px}
        .ob-bullets li{display:flex;align-items:flex-start;gap:8px;color:var(--on-surface);font-size:0.9rem;line-height:1.4}
        .ob-bullets li svg{color:var(--primary);flex-shrink:0;margin-top:2px}
        /* progress rail — reference thin-bar top bar + "N of 3" label */
        .ob-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px}
        .ob-steps{display:flex;gap:7px;align-items:center}
        .ob-step{height:3px;width:26px;border-radius:2px;background:var(--outline-variant);transition:all .4s var(--ease,ease)}
        .ob-step-done{background:var(--primary-container)}
        .ob-step-now{background:var(--primary);width:34px}
        .ob-gold .ob-step-now{background:var(--tertiary)}
        .ob-step-label{font-size:0.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--outline);font-weight:700;white-space:nowrap}
        /* hero visualisations (Screen 1 key / Screen 2 wallet) */
        .ob-viz{height:150px;display:flex;align-items:center;justify-content:center;margin:2px 0 14px}
        .ob-viz svg{max-width:250px;overflow:visible}
        .ob-spoke{stroke:var(--outline-variant);stroke-width:1}
        .ob-mote{animation:obMote 3.4s var(--ease,ease) infinite}
        .ob-arc{animation:obDrawArc 1.4s var(--ease,ease) forwards}
        .ob-pulse{transform-origin:85px 60px;animation:obBreathe 4.4s var(--ease,ease) infinite}
        .ob-pulse-2{animation-delay:1.1s}
        @keyframes obMote{0%,100%{opacity:.25}50%{opacity:.9}}
        @keyframes obDrawArc{from{stroke-dasharray:160;stroke-dashoffset:160}to{stroke-dashoffset:0}}
        /* serif display title with accent final word */
        .ob-display{font-family:var(--font-serif);color:var(--on-surface);font-size:1.85rem;line-height:1.16;
          font-weight:600;letter-spacing:-0.015em;margin:0 0 10px}
        .ob-accent-mint{color:var(--primary)}
        .ob-accent-gold{color:var(--tertiary)}
        .ob-eyebrow-gold{color:var(--tertiary)}
        /* three-point explanation card with icon tiles */
        .ob-points{border:1px solid var(--outline-variant);border-radius:14px;overflow:hidden;margin:0 0 18px;
          background:var(--surface-container-low)}
        .ob-point{display:flex;gap:12px;padding:13px 15px;align-items:flex-start}
        .ob-point + .ob-point{border-top:1px solid rgba(60,74,66,0.55)}
        .ob-point-ico{flex:0 0 32px;height:32px;border-radius:10px;display:grid;place-items:center;
          background:rgba(78,222,163,0.11);color:var(--primary)}
        .ob-point-warm .ob-point-ico{background:rgba(255,185,95,0.12);color:var(--tertiary)}
        .ob-point-body{display:flex;flex-direction:column;gap:2px}
        .ob-point-h{font-size:0.92rem;font-weight:600;color:var(--on-surface);line-height:1.3}
        .ob-point-b{font-size:0.82rem;line-height:1.45;color:var(--outline)}
        /* sovereignty network visual (decorative) */
        .ob-net{height:160px;display:flex;align-items:center;justify-content:center;margin:2px 0 12px}
        .ob-net svg{max-width:300px;overflow:visible}
        .ob-link{stroke:var(--outline-variant);stroke-width:1.1;fill:none;stroke-dasharray:120;stroke-dashoffset:120;
          animation:obDraw 1s var(--ease,ease) forwards}
        .ob-link-warm{stroke:rgba(255,185,95,0.5)}
        .ob-net-node{opacity:0;animation:obPop .6s var(--ease,ease) forwards}
        .ob-halo{transform-origin:160px 88px;animation:obBreathe 4.6s var(--ease,ease) infinite}
        .ob-halo-2{animation-delay:1.2s}
        @keyframes obDraw{to{stroke-dashoffset:0}}
        @keyframes obPop{to{opacity:1}}
        @keyframes obBreathe{0%,100%{transform:scale(.82);opacity:.45}50%{transform:scale(1.12);opacity:.08}}
        /* Heal · Learn · Earn sub-row under the final CTA */
        .ob-subrow{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:12px;
          font-size:0.8rem;color:var(--on-surface-variant);font-weight:600;letter-spacing:.02em}
        .ob-subrow-dot{width:3px;height:3px;border-radius:50%;background:var(--outline)}
        .ob-primary{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;position:relative;
          background:var(--primary);border:1px solid var(--primary);color:#062318;border-radius:14px;padding:15px 16px;cursor:pointer;
          font-weight:700;font-size:0.95rem;box-shadow:0 4px 18px rgba(78,222,163,0.22);margin-bottom:12px}
        .ob-primary:hover{background:#5be9b0}
        .ob-primary-plain{box-shadow:none}
        .ob-secondary{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;
          background:var(--surface-container-high);border:1px solid rgba(78,222,163,0.35);color:var(--on-surface);border-radius:14px;
          padding:15px 16px;cursor:pointer;font-weight:600;font-size:0.95rem;margin-bottom:14px}
        .ob-secondary:hover{background:var(--surface-container-highest)}
        .ob-info{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:99px;
          background:rgba(6,35,24,0.35);color:#062318;cursor:pointer}
        .ob-link{display:block;width:100%;text-align:center;background:none;border:none;color:var(--primary);
          font-weight:600;font-size:0.86rem;cursor:pointer;padding:6px}
        .ob-textbtn{background:none;border:none;color:var(--primary);cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:5px}
        .ob-error{color:var(--error);font-size:0.84rem;margin:0 0 12px}
        .ob-back-inline{display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:var(--outline);
          font-size:0.82rem;cursor:pointer;margin:12px auto 0}
        .ob-keyfield{margin:0 0 14px}
        .ob-keylabel{display:block;font-size:0.74rem;color:var(--on-surface-variant);font-weight:600;margin-bottom:5px}
        .ob-key{display:block;font-family:var(--font-mono,ui-monospace,monospace);font-size:0.78rem;word-break:break-all;
          background:var(--surface-container-lowest);border:1px solid var(--outline-variant);border-radius:10px;padding:10px 12px;color:var(--on-surface)}
        .ob-key-pub{border-color:rgba(78,222,163,0.4)}
        .ob-key-secret{background:rgba(10,16,29,0.86);border-color:var(--tertiary);color:var(--on-surface)}
        .ob-key-row{display:flex;align-items:stretch;gap:8px}
        .ob-key-row .ob-key{flex:1}
        .ob-icon{background:var(--surface-container-high);border:1px solid var(--outline-variant);border-radius:10px;cursor:pointer;
          padding:0 12px;color:var(--on-surface-variant);display:flex;align-items:center}
        .ob-copy{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--tertiary);
          font-size:0.78rem;font-weight:600;cursor:pointer;margin-top:6px;padding:2px 0}
        .ob-warn{display:flex;gap:8px;align-items:flex-start;background:rgba(255,185,95,0.1);
          border:1px solid rgba(255,185,95,0.35);color:#ffcf94;border-radius:10px;padding:10px 12px;
          font-size:0.8rem;line-height:1.45;margin:0 0 14px}
        .ob-warn svg{flex-shrink:0;margin-top:1px;color:var(--tertiary)}
        .ob-confirm{display:flex;gap:8px;align-items:flex-start;font-size:0.84rem;color:var(--on-surface-variant);cursor:pointer;line-height:1.4;margin-bottom:14px}
        .ob-confirm input{margin-top:2px;accent-color:var(--primary)}
        .ob-checks{background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:12px;padding:12px;margin-bottom:14px}
        .ob-checks-title{font-size:0.82rem;color:var(--on-surface);font-weight:600;margin:0 0 10px}
        .ob-checks-row{display:flex;gap:10px}
        .ob-check{flex:1;text-align:center}
        .ob-check label{display:block;font-size:0.72rem;color:var(--on-surface-variant);margin-bottom:4px}
        .ob-check .input{text-align:center;font-family:var(--font-mono,ui-monospace,monospace);font-size:1rem}
        .ob-transition{text-align:center;align-items:center}
        .ob-node{width:74px;height:74px;border-radius:99px;background:radial-gradient(circle,#4edea3,#0a2b29);
          display:flex;align-items:center;justify-content:center;color:#062318;margin:6px auto 18px;
          box-shadow:0 0 44px rgba(78,222,163,0.45);animation:obPulse 2.2s ease-in-out infinite}
        @keyframes obPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
        .ob-transition-copy{color:var(--on-surface);font-size:1.15rem;line-height:1.5;font-weight:600;margin:0 0 22px}
        .ob-skip{}
        .ob-sov-row{display:flex;flex-direction:column;gap:3px;margin-bottom:14px}
        .ob-sov-h{display:inline-flex;align-items:center;gap:7px;font-weight:700;color:var(--on-surface);font-size:0.96rem}
        .ob-sov-h svg{color:var(--primary)}
        .ob-sov-b{color:var(--on-surface-variant);font-size:0.86rem;line-height:1.5;padding-left:21px}
        .ob-motto{text-align:center;color:var(--primary);font-weight:700;letter-spacing:.06em;font-size:1rem;margin:6px 0 16px}
        /* compact, muted roadmap note (no dashed panel) */
        .ob-roadmap-note{display:flex;align-items:center;gap:6px;color:var(--outline);font-size:0.78rem;line-height:1.4;margin:0 0 16px}
        .ob-roadmap-note svg{color:var(--outline);flex-shrink:0}
        /* tighter top padding for identity-setup screens (less hero whitespace) */
        .ob-card-tight{padding-top:18px}
        .ob-optional{color:var(--outline);font-weight:400}
        .ik-modal-backdrop{position:fixed;inset:0;background:rgba(3,6,12,0.72);backdrop-filter:blur(4px);
          display:flex;align-items:center;justify-content:center;z-index:1000;padding:18px}
        .ik-modal{position:relative;background:var(--surface-container-low);border:1px solid var(--outline-variant);border-radius:18px;max-width:420px;width:100%;
          padding:22px 20px;box-shadow:0 24px 70px rgba(0,0,0,0.6);max-height:88vh;overflow-y:auto}
        .ik-modal-close{position:absolute;top:12px;right:12px;background:none;border:none;cursor:pointer;color:var(--on-surface-variant)}
        @media (prefers-reduced-motion:reduce){
          .ob-node{animation:none}
          .fade-up{animation:none!important}
          .ob-net-node{opacity:1;animation:none}
          .ob-link{stroke-dashoffset:0;animation:none}
          .ob-halo{animation:none;opacity:.24}
          .ob-mote{animation:none;opacity:.7}
          .ob-arc{animation:none;stroke-dashoffset:0}
          .ob-pulse{animation:none;opacity:.24}
        }
      `}</style>
    </div>
  );
}
