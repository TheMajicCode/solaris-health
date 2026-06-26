import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { SolarisMark, Wordmark } from './ui.jsx';
import { Home, Activity, Bot, Compass, User, Bell } from 'lucide-react';

const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'health', label: 'Health', icon: Activity },
  { key: 'luca', label: 'LUCA', icon: Bot },
  { key: 'explore', label: 'Explore', icon: Compass },
  { key: 'profile', label: 'Profile', icon: User },
];

export function TopBar() {
  const { user } = useApp();
  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');
  return (
    <div className="top-bar">
      <div className="row gap-2">
        <div className="avatar center" style={{ width: 40, height: 40, fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
          {initials || <User size={18} />}
        </div>
      </div>
      <Wordmark size="1.35rem" />
      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
        <Bell size={20} />
      </button>
    </div>
  );
}

export function BottomNav() {
  const { tab, setTab } = useApp();
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => {
        const active = tab === t.key;
        const Icon = t.icon;
        return (
          <button key={t.key} className={`nav-item ${active ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <span className="nav-ico"><Icon size={20} /></span>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

export function Shell({ children }) {
  return (
    <div className="app-frame">
      <div className="sol-bg" />
      <TopBar />
      {children}
      <BottomNav />
    </div>
  );
}
