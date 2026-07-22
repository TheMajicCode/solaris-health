import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProvider, useApp } from './state/AppContext.jsx'
import { Spinner } from './components/ui.jsx'
import Onboarding from './flows/Onboarding.jsx'
import Auth from './flows/Auth.jsx'
import Assessment from './flows/Assessment.jsx'
import LucaPassport from './components/LucaPassport.jsx'
import FindPractitioner from './pages/FindPractitioner.jsx'
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

function Root() {
  const { user, loading, authView, retaking } = useApp();

  // Public practitioner directory — fully public, no login required
  if (typeof window !== 'undefined' && window.location.pathname === '/find') {
    return <FindPractitioner />;
  }

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

  // Not authenticated → cinematic onboarding then auth
  if (!user) {
    return authView === 'auth' ? <Auth /> : <Onboarding />;
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
    <AppProvider>
      <Root />
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
    </AppProvider>
    </RootErrorBoundary>
  </React.StrictMode>,
)

// Register service worker for PWA / offline shell
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('SW registration failed:', err));
  });
}
