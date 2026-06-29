import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProvider, useApp } from './state/AppContext.jsx'
import { Spinner } from './components/ui.jsx'
import Onboarding from './flows/Onboarding.jsx'
import Auth from './flows/Auth.jsx'
import Assessment from './flows/Assessment.jsx'
import LucaPassport from './components/LucaPassport.jsx'
import { Toaster } from 'react-hot-toast'
import './index.css'

function Root() {
  const { user, loading, authView } = useApp();

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

  // Patient: must complete the Solaris Method assessment first
  if (user.role === 'patient' && user.onboardingStatus !== 'complete') {
    return <Assessment />;
  }

  // Unified sovereign hub — one central dashboard for every role
  return <LucaPassport />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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
  </React.StrictMode>,
)
