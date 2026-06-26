import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProvider, useApp } from './state/AppContext.jsx'
import { Spinner } from './components/ui.jsx'
import Onboarding from './flows/Onboarding.jsx'
import Auth from './flows/Auth.jsx'
import Assessment from './flows/Assessment.jsx'
import LucaPassport from './components/LucaPassport.jsx'
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
    </AppProvider>
  </React.StrictMode>,
)
