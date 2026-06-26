import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProvider, useApp } from './state/AppContext.jsx'
import { Shell } from './components/Shell.jsx'
import { Spinner } from './components/ui.jsx'
import Onboarding from './flows/Onboarding.jsx'
import Auth from './flows/Auth.jsx'
import Assessment from './flows/Assessment.jsx'
import Hub from './pages/Hub.jsx'
import HealthPassport from './pages/HealthPassport.jsx'
import Luca from './pages/Luca.jsx'
import Explore from './pages/Explore.jsx'
import Profile from './pages/Profile.jsx'
import Practitioner from './pages/Practitioner.jsx'
import Admin from './pages/Admin.jsx'
import './index.css'

function MainApp() {
  const { tab } = useApp();
  let page;
  switch (tab) {
    case 'health': page = <HealthPassport />; break;
    case 'luca': page = <Luca />; break;
    case 'explore': page = <Explore />; break;
    case 'profile': page = <Profile />; break;
    case 'home':
    default: page = <Hub />; break;
  }
  return <Shell>{page}</Shell>;
}

function Root() {
  const { user, loading, authView } = useApp();

  if (loading) {
    return (
      <div className="sol-bg" style={{ minHeight: '100vh' }}>
        <div className="app-frame">
          <div className="page center" style={{ minHeight: '90vh' }}>
            <Spinner label="Awakening Solaris…" />
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated → cinematic onboarding then auth
  if (!user) {
    return authView === 'auth' ? <Auth /> : <Onboarding />;
  }

  // Practitioner portal
  if (user.role === 'practitioner') return <Practitioner />;

  // Admin console
  if (user.role === 'admin') return <Admin />;

  // Patient: must complete the Solaris Method assessment first
  if (user.role === 'patient' && user.onboardingStatus !== 'complete') {
    return <Assessment />;
  }

  // Main sovereign hub experience
  return <MainApp />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <Root />
    </AppProvider>
  </React.StrictMode>,
)
