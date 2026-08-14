import React, { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';

/* ────────────────────────────────────────────────────────────────────────────
 * PWAInstallInvitation — the "Keep Solaris close" install prompt (spec §5, correction §3).
 *
 * BEHAVIOUR (exact):
 *  • Capture `beforeinstallprompt`, preventDefault(), and stash the event ALWAYS
 *    (so a genuine installability signal is never lost). Only call event.prompt()
 *    AFTER the user taps "Install Solaris". Never fake a native install success
 *    when the event is unavailable.
 *  • AUTH GATING (correction §3): the invitation is shown ONLY during the
 *    UNAUTHENTICATED welcome / account-creation journey. It is hidden the moment
 *    a Solaris account is authenticated, so it can NEVER cover the wallet screens
 *    or the fixed mobile navigation. On logout it may reappear (subject to the
 *    standalone + cooldown checks). It does NOT touch the bottom navigation.
 *  • iOS Safari cannot fire beforeinstallprompt → show the exact manual fallback
 *    "Tap Share, then Add to Home Screen." instead of a native prompt.
 *  • "Not now" sets a seven-day dismissal cooldown (localStorage timestamp).
 *  • Hide entirely when already installed (display-mode: standalone /
 *    navigator.standalone). Clear stored state on `appinstalled`.
 *  • Does NOT request notification permission at the same moment.
 *
 * COPY is used verbatim — do not paraphrase.
 * ──────────────────────────────────────────────────────────────────────────── */

const COPY = {
  title: 'Keep Solaris close',
  body: 'Install Solaris on your Home Screen for quicker, app-like access to your health journey.',
  install: 'Install Solaris',
  dismiss: 'Not now',
  ios: 'Tap Share, then Add to Home Screen.',
};

const DISMISS_KEY = 'solaris_pwa_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // seven days

function isStandalone() {
  try {
    return (
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

function isIOS() {
  try {
    const ua = window.navigator.userAgent || '';
    const iOSDevice = /iPad|iPhone|iPod/.test(ua)
      || (ua.includes('Macintosh') && 'ontouchend' in document);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    return iOSDevice && isSafari;
  } catch {
    return false;
  }
}

function dismissedRecently() {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return ts > 0 && Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export default function PWAInstallInvitation() {
  const app = useApp();
  const authed = !!app?.user;               // authenticated Solaris session?

  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState(null); // stashed beforeinstallprompt event
  const [showIosHint, setShowIosHint] = useState(false);
  const iosMode = isIOS();

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return undefined;

    // Chrome / Android / desktop: wait for the installability signal. We ALWAYS
    // capture + stash the genuine event so it is never lost; we only surface the
    // invitation when the visitor is NOT authenticated (correction §3).
    const onBeforeInstall = (e) => {
      e.preventDefault();       // suppress the mini-infobar
      setDeferred(e);           // stash — used only when the user taps Install
      if (!authed) setVisible(true);
    };
    // Clean up once the app is actually installed.
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      try { localStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari never fires beforeinstallprompt — surface the manual invitation
    // (deferred stays null so we only ever show the exact Share instructions).
    let iosTimer;
    if (iosMode && !authed) {
      iosTimer = setTimeout(() => setVisible(true), 1200);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [iosMode, authed]);

  // Auth transitions: hide the moment an account signs in (so it can never cover
  // the authenticated wallet screens or the fixed mobile nav); on sign-out it may
  // reappear when a genuine install signal is available and not in cooldown.
  useEffect(() => {
    if (authed) {
      setVisible(false);
      setShowIosHint(false);
      return;
    }
    if (isStandalone() || dismissedRecently()) return;
    if (deferred || iosMode) setVisible(true);
  }, [authed, deferred, iosMode]);

  const dismiss = () => {
    setVisible(false);
    setShowIosHint(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  };

  const install = async () => {
    if (deferred) {
      // Real native prompt — only now, after an explicit tap.
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* user closed the prompt */ }
      setDeferred(null);
      setVisible(false);
      return;
    }
    // No native event available (e.g. iOS): show the exact manual instructions.
    // Never fabricate a native install success here.
    setShowIosHint(true);
  };

  // Hard guard: NEVER render while authenticated (defence-in-depth over the
  // effects above) so the invitation can never overlay the wallet screens.
  if (authed || !visible) return null;

  return (
    <div className="pwa-invite" role="dialog" aria-labelledby="pwa-invite-title" aria-describedby="pwa-invite-body">
      <button className="pwa-close" onClick={dismiss} aria-label="Dismiss install invitation"><X size={16} /></button>
      <div className="pwa-body">
        <p id="pwa-invite-title" className="pwa-title">{COPY.title}</p>
        <p id="pwa-invite-body" className="pwa-text">{COPY.body}</p>

        {showIosHint && (
          <p className="pwa-ios"><Share size={14} /> {COPY.ios}</p>
        )}

        <div className="pwa-actions">
          <button className="pwa-install" onClick={install}>
            <Download size={15} /> {COPY.install}
          </button>
          <button className="pwa-dismiss" onClick={dismiss}>{COPY.dismiss}</button>
        </div>
      </div>

      <style>{`
        .pwa-invite{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:1200;
          width:min(420px,calc(100vw - 32px));background:#0c1322;color:#eafbf4;border:1px solid rgba(78,222,163,0.28);
          border-radius:16px;padding:16px 16px 14px;box-shadow:0 20px 50px rgba(3,14,13,0.55);
          animation:pwaRise .28s cubic-bezier(0.22,1,0.36,1)}
        @keyframes pwaRise{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
        .pwa-close{position:absolute;top:10px;right:10px;background:none;border:none;color:rgba(234,251,244,0.6);cursor:pointer}
        .pwa-title{font-family:var(--font-serif,'Noto Serif',Georgia,serif);font-size:1.05rem;font-weight:700;margin:0 0 4px;color:#eafbf4}
        .pwa-text{font-size:0.86rem;line-height:1.5;color:#9fe7d6;margin:0 0 12px}
        .pwa-ios{display:flex;align-items:center;gap:7px;font-size:0.82rem;color:#ffb95f;margin:0 0 12px}
        .pwa-actions{display:flex;gap:10px;align-items:center}
        .pwa-install{display:inline-flex;align-items:center;gap:7px;background:#4edea3;border:1px solid #4edea3;color:#052b21;
          font-weight:700;font-size:0.88rem;border-radius:11px;padding:10px 16px;cursor:pointer}
        .pwa-install:hover{background:#43c893}
        .pwa-dismiss{background:none;border:none;color:#9fe7d6;font-size:0.85rem;font-weight:600;cursor:pointer;padding:10px 6px}
        @media (prefers-reduced-motion:reduce){.pwa-invite{animation:none}}
      `}</style>
    </div>
  );
}
