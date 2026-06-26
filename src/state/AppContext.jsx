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
  const logout = () => { api.logout(); setUser(null); setProfile(null); setTab('home'); setAuthView('intro'); };

  const refreshUser = async () => {
    const { user, profile } = await api.getMe();
    setUser(user); setProfile(profile);
  };

  return (
    <AppContext.Provider value={{
      user, profile, loading, tab, setTab, authView, setAuthView,
      login, register, logout, refreshUser, setUser, setProfile,
    }}>
      {children}
    </AppContext.Provider>
  );
}
