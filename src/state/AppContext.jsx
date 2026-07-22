import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');        // main app tab
  const [authView, setAuthView] = useState('intro'); // intro | auth
  const [demoRole, setDemoRole] = useState(null); // null = use real user.role; else overrides for demo
  const [nostrBanner, setNostrBanner] = useState({ show: false, npub: '' });
  const [retaking, setRetaking] = useState(false); // re-launch Solaris Method intake (local state only)
  const [exploreFilter, setExploreFilter] = useState(null); // pre-select a listing type in Explore (e.g. 'diagnostic')

  // ── Shared LUCA conversation (CoachPage + floating LucaWidget are two views of it) ──
  const [lucaMessages, setLucaMessages] = useState(() => {
    try {
      const stored = sessionStorage.getItem('luca_messages');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [lucaLoaded, setLucaLoaded] = useState(false);

  // ── Shared audio player state (MediaPage full player + persistent MiniPlayer) ──
  const [currentTrack, setCurrentTrack] = useState(null); // { id, title, audio_url, duration_seconds, ... }
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioQueue, setAudioQueue] = useState([]);        // ordered list of playable tracks

  // Persist the conversation across navigation within a session
  useEffect(() => {
    try { sessionStorage.setItem('luca_messages', JSON.stringify(lucaMessages)); } catch {}
  }, [lucaMessages]);

  // Load the authoritative history from the API once per session (first time either view mounts)
  const loadLucaHistory = useCallback(async () => {
    if (lucaLoaded || !api.token) return;
    try {
      const r = await api.getLucaMessages();
      const rows = r?.messages || [];
      // Only replace local state if the API actually has history — otherwise keep any
      // in-session messages already captured (e.g. from a just-sent turn).
      setLucaMessages((prev) => (rows.length ? rows : prev));
    } catch {}
    finally { setLucaLoaded(true); }
  }, [lucaLoaded]);

  const loadUser = useCallback(async () => {
    if (!api.token) { setLoading(false); return; }
    try {
      const { user, profile } = await api.getMe();
      setUser(user);
      setProfile(profile);
    } catch {
      api.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const { user } = await api.login(email, password);
    await loadUser();
    return user;
  };
  const register = async (payload) => {
    const { user } = await api.register(payload);
    setUser(user);
    return user;
  };
  const logout = () => {
    api.logout();
    setUser(null); setProfile(null); setTab('home'); setAuthView('intro'); setDemoRole(null);
    setNostrBanner({ show: false, npub: '' });
    setLucaMessages([]); setLucaLoaded(false);
    setCurrentTrack(null); setIsPlaying(false); setAudioQueue([]);
    try { sessionStorage.removeItem('luca_messages'); } catch {}
  };

  const refreshUser = async () => {
    const { user, profile } = await api.getMe();
    setUser(user); setProfile(profile);
  };

  const startRetake = () => setRetaking(true);
  const stopRetake = () => setRetaking(false);

  return (
    <AppContext.Provider value={{
      user, profile, loading, tab, setTab, authView, setAuthView,
      login, register, logout, refreshUser, setUser, setProfile,
      demoRole, setDemoRole, nostrBanner, setNostrBanner,
      lucaMessages, setLucaMessages, lucaLoaded, loadLucaHistory,
      currentTrack, setCurrentTrack, isPlaying, setIsPlaying, audioQueue, setAudioQueue,
      retaking, startRetake, stopRetake,
      exploreFilter, setExploreFilter,
    }}>
      {children}
    </AppContext.Provider>
  );
}
