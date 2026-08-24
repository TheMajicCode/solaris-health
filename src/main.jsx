import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProvider, useApp } from './state/AppContext.jsx'
import { SparkWalletProvider } from './state/SparkWalletContext.jsx'
import { LocaleProvider, useLocale } from './lib/i18n/LocaleContext.jsx'
import { languageToLocale } from './lib/i18n/index.js'
import { LOCALE_STORAGE_KEY } from './lib/i18n/constants.js'
import { Spinner } from './components/ui.jsx'
import Onboarding from './flows/Onboarding.jsx'
import Auth from './flows/Auth.jsx'
import Assessment from './flows/Assessment.jsx'
import LucaPassport from './components/LucaPassport.jsx'
import FindPractitioner from './pages/FindPractitioner.jsx'
import IntakeForm from './components/IntakeForm.jsx'
import PWAInstallInvitation from './components/PWAInstallInvitation.jsx'
import { Toaster } from 'react-hot-toast'
import './index.css'

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('Root error boundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="sol-bg" style={{ minHeight: '100vh' }}>
          <div className="app-frame">
            <div className="page center" style={{ minHeight: '90vh', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '24px' }}>
              <h2 style={{ margin: 0, color: '#EAFBF4', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>Something went wrong.</h2>
              <p style={{ margin: 0, color: '#9FE7D6', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>Please refresh the page.</p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  marginTop: '8px', padding: '10px 22px', borderRadius: '12px', cursor: 'pointer',
                  border: '1px solid rgba(159,231,214,.3)', background: '#06403B', color: '#EAFBF4',
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: '14px', fontWeight: 600,
                }}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// K1.2 §3 — retryable "temporarily unavailable" screen. Shown ONLY during a
// transient backend outage while a saved token is still present (see AppContext
// loadUser). It preserves the session (token, locale, journeys, identity) and
// offers Retry (re-attempts /users/me) and Sign out (explicit logout). It is
// never shown for a confirmed 401, which drops straight to the auth flow.
function SessionUnavailable() {
  const { retrySession, logout, loading } = useApp();
  const { t } = useLocale();
  return (
    <div className="sol-bg" style={{ minHeight: '100vh' }}>
      <div className="app-frame">
        <div className="page center" style={{ minHeight: '90vh', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '24px' }}>
          <h2 style={{ margin: 0, color: '#EAFBF4', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
            {t('session.unavailableTitle')}
          </h2>
          <p style={{ margin: 0, maxWidth: 340, color: '#9FE7D6', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", lineHeight: 1.5 }}>
            {t('session.unavailableBody')}
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={retrySession}
              disabled={loading}
              style={{
                padding: '10px 22px', borderRadius: '12px', cursor: loading ? 'default' : 'pointer',
                border: '1px solid rgba(159,231,214,.3)', background: '#06403B', color: '#EAFBF4',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: '14px', fontWeight: 600,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? t('session.retrying') : t('action.retry')}
            </button>
            <button
              onClick={logout}
              style={{
                padding: '10px 22px', borderRadius: '12px', cursor: 'pointer',
                border: '1px solid rgba(159,231,214,.3)', background: 'transparent', color: '#9FE7D6',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: '14px', fontWeight: 600,
              }}
            >
              {t('action.signOut')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// K1.2 §5 — reconcile the app locale with the authenticated profile exactly once
// per sign-in, WITHOUT any migration or new API. Two directions:
//   • No explicit device choice (no solaris.locale stored) → HYDRATE the locale
//     from the profile's stored language, so a member who chose Spanish on another
//     device keeps Spanish here.
//   • An explicit device choice exists → the device WINS; push it to the profile
//     (best-effort PATCH) so it persists. This is what prevents an older English
//     profile from ever overwriting an explicit current-device Spanish choice.
function LocaleSync() {
  const { user } = useApp();
  const { locale, setLocale, syncLanguageToProfile } = useLocale();
  const reconciledFor = React.useRef(null);
  React.useEffect(() => {
    const uid = user?.id;
    if (!uid) { reconciledFor.current = null; return; }
    if (reconciledFor.current === uid) return; // once per authenticated user
    reconciledFor.current = uid;
    let hadDeviceChoice = false;
    try { hadDeviceChoice = !!localStorage.getItem(LOCALE_STORAGE_KEY); } catch {}
    if (!hadDeviceChoice) {
      // Hydrate from the profile only when the device made no explicit choice.
      const fromProfile = languageToLocale(user.language);
      if (fromProfile && fromProfile !== locale) setLocale(fromProfile);
    } else {
      // Explicit device choice is authoritative — persist it to the profile.
      syncLanguageToProfile(locale);
    }
  }, [user, locale, setLocale, syncLanguageToProfile]);
  return null;
}

function Root() {
  const { user, loading, sessionUnavailable, authView, retaking } = useApp();

  // Public practitioner directory — fully public, no login required
  if (typeof window !== 'undefined' && window.location.pathname === '/find') {
    return <FindPractitioner />;
  }

  const onIntake = typeof window !== 'undefined' && window.location.pathname === '/intake';

  if (loading) {
    return (
      <div className="sol-bg" style={{ minHeight: '100vh' }}>
        <div className="app-frame">
          <div className="page center" style={{ minHeight: '90vh' }}>
            <Spinner label="Awakening Solaris..." />
          </div>
        </div>
      </div>
    );
  }

  // K1.2 §3 — a saved token could not be validated because of a TRANSIENT outage
  // (5xx / network / timeout / offline). Preserve the session and show the
  // retryable screen instead of silently dropping the member to the sign-in flow.
  if (sessionUnavailable && !user) {
    return <SessionUnavailable />;
  }

  // Not authenticated → cinematic onboarding then auth
  if (!user) {
    return authView === 'auth' ? <Auth /> : <Onboarding />;
  }

  // New-patient intake form (deep link from the inbox CTA)
  if (onIntake) {
    return <IntakeForm />;
  }

  // Any new user must complete (or skip) the Solaris Method assessment first
  if (user.onboardingStatus !== 'complete') {
    return <Assessment />;
  }

  // Member chose to update their Solaris intake from the Passport (local state only)
  if (retaking) {
    return <Assessment retaking />;
  }

  // Unified sovereign hub — one central dashboard for every role
  return <LucaPassport />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
    <LocaleProvider>
    <AppProvider>
    <SparkWalletProvider>
      <LocaleSync />
      <Root />
      <PWAInstallInvitation />
      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          duration: 5000,
          style: {
            background: '#06403B',
            color: '#EAFBF4',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            fontSize: '13.5px',
            fontWeight: 500,
            borderRadius: '14px',
            border: '1px solid rgba(159,231,214,.22)',
            boxShadow: '0 18px 40px -16px rgba(3,32,30,.6)',
            maxWidth: '380px',
          },
          success: { iconTheme: { primary: '#36C9A9', secondary: '#06403B' } },
          error: { iconTheme: { primary: '#F2A0A0', secondary: '#06403B' } },
        }}
      />
    </SparkWalletProvider>
    </AppProvider>
    </LocaleProvider>
    </RootErrorBoundary>
  </React.StrictMode>,
)

// Register service worker for PWA / offline shell.
if ('serviceWorker' in navigator) {
  // Self-heal: when an updated SW replaces a previously-controlling one, reload once
  // so a client that booted from a stale cached shell picks up the fresh app shell.
  // Guarded so it only fires on an actual update (not a first-ever registration) and
  // never loops.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
