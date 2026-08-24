import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { signChallenge, rememberKeyForSession, forgetSessionKey } from '../lib/identity-key.js';

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
  const [pendingProviderId, setPendingProviderId] = useState(null); // deep-link: open this practitioner profile in Explore
  const [pendingBookProviderId, setPendingBookProviderId] = useState(null); // deep-link: open the shared BookingFlow for this provider in Explore
  const [pendingCurate, setPendingCurate] = useState(false); // deep-link: run "Curate for me" on Explore mount
  // §4 — a secure conversation the server just authorized, handed to the
  // Communications → Messages surface to open EXACTLY once. Kept in memory only
  // (never localStorage/sessionStorage); cleared after it is consumed and on logout.
  const [pendingConversation, setPendingConversation] = useState(null);
  // RC1 item5 / K1.1 §4 — a Journey draft the member explicitly approved from the
  // Personalized Journey wizard. Surfaced in Communications → Growth so the member
  // sees the exact draft they approved. In K1.1 this now SURVIVES REFRESH via
  // device-local storage (localStorage) NAMESPACED BY the authenticated user id —
  // no server persistence, no migration, no new API. It is labeled "Saved on this
  // device" in the UI and is never presented as multi-device or server-synced.
  const [approvedJourney, setApprovedJourneyState] = useState(null);

  // Device-local key is namespaced by user id so one account can NEVER see another
  // account's draft on a shared browser.
  const journeyStorageKey = (uid) => `solaris.approvedJourney.${uid}`;

  // Public setter used by the approve flow AND by dismiss/delete. Writes the draft
  // to device-local storage for the CURRENT user (adding a device marker), or, when
  // called with null (explicit dismiss/delete), removes the stored draft. Never
  // persists without a known user id (cannot namespace safely).
  const setApprovedJourney = useCallback((block) => {
    setApprovedJourneyState(block);
    try {
      const uid = user?.id;
      if (!uid) return;
      const key = journeyStorageKey(uid);
      if (block) {
        const toStore = {
          ...block,
          savedOnDevice: true,
          savedAt: block.savedAt || Date.now(),
          ownerUserId: uid,
        };
        localStorage.setItem(key, JSON.stringify(toStore));
      } else {
        localStorage.removeItem(key);
      }
    } catch { /* storage unavailable — degrade to in-memory only */ }
  }, [user]);

  // Restore the device-local approved Journey draft after a refresh, scoped to the
  // authenticated user. Runs once the user becomes known. Defense-in-depth: only
  // accept a stored draft whose recorded owner matches the current user id.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    try {
      const raw = localStorage.getItem(journeyStorageKey(uid));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.ownerUserId == null || String(parsed.ownerUserId) === String(uid))) {
        setApprovedJourneyState(parsed);
      }
    } catch { /* ignore malformed/unavailable storage */ }
  }, [user]);

  // ── Shared LUCA conversation (used by the LUCA Coach surface) ──
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

  // Boot failsafe: never let the "Awakening Solaris…" splash hang forever.
  // If bootstrap has not resolved within 25s (e.g. an unexpected stall), drop the
  // splash so the user always reaches a usable screen instead of a blank one.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 25000);
    return () => clearTimeout(t);
  }, []);

  const login = async (email, password) => {
    const { user } = await api.login(email, password);
    await loadUser();
    return user;
  };
  // Identity Key AUTH — real BIP-340 challenge/response (M8). The secret key never
  // leaves the device: we fetch a challenge (npub only), sign it locally, and send
  // only npub + nonce + signature. Deferred variant: it authenticates (sets the
  // session token) and remembers the key in memory, but does NOT activate the React
  // user — the caller must clear the minimum-profile gate first, then activateUser().
  const identityAuthDeferred = async ({ npub, skHex, pubkeyHex }) => {
    const ch = await api.nostrChallenge(npub);                    // sends ONLY { npub }
    const sig = signChallenge(skHex, ch.message);                 // signs locally on-device
    await api.nostrKeyLogin(npub, ch.challengeId, ch.nonce, sig); // sends ONLY { npub, challengeId, nonce, sig }
    rememberKeyForSession({ npub, skHex, pubkeyHex });  // in-memory only
    return true;
  };
  // Identity Key login — deferred auth + immediate activation (returning members /
  // existing-nsec / legacy restore, who already have a profile + onboarding state).
  const loginWithIdentityKey = async ({ npub, skHex, pubkeyHex }) => {
    await identityAuthDeferred({ npub, skHex, pubkeyHex });
    await loadUser();
    return true;
  };
  // New-account registration — DEFERRED. Sets the session token but does NOT
  // activate the React user, so onboarding can gate on required profile persistence
  // (spec §3.5) before Root routes into the Assessment.
  const registerAccountDeferred = async (payload) => {
    await api.register(payload); // sets the auth token; user activated later
    return true;
  };
  // Legacy immediate register (kept for compatibility; not used by onboarding).
  const register = async (payload) => {
    const { user } = await api.register(payload);
    setUser(user);
    return user;
  };
  // Activate the authenticated user in React state — call ONLY after the required
  // minimum-profile save has succeeded (spec §3.5). Root then routes to Assessment.
  const activateUser = async () => {
    await loadUser();
    return true;
  };
  const logout = () => {
    api.logout();
    forgetSessionKey(); // clear the in-memory identity secret (spec §3 logout/forget)
    setUser(null); setProfile(null); setTab('home'); setAuthView('intro'); setDemoRole(null);
    setNostrBanner({ show: false, npub: '' });
    setPendingConversation(null); // §4 — never persist a pending secure conversation across logout
    // K1.1 §4 — clear the approved Journey draft from MEMORY on logout, but LEAVE
    // the device-local copy intact (it is namespaced by user id, so it stays
    // private to this account and is restored when the same member signs back in).
    // Use the raw state setter so we do NOT delete the stored draft here.
    setApprovedJourneyState(null);
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
      login, loginWithIdentityKey, identityAuthDeferred, register, registerAccountDeferred,
      activateUser, logout, refreshUser, setUser, setProfile,
      demoRole, setDemoRole, nostrBanner, setNostrBanner,
      lucaMessages, setLucaMessages, lucaLoaded, loadLucaHistory,
      currentTrack, setCurrentTrack, isPlaying, setIsPlaying, audioQueue, setAudioQueue,
      retaking, startRetake, stopRetake,
      exploreFilter, setExploreFilter,
      pendingProviderId, setPendingProviderId,
      pendingBookProviderId, setPendingBookProviderId,
      pendingCurate, setPendingCurate,
      pendingConversation, setPendingConversation,
      approvedJourney, setApprovedJourney,
    }}>
      {children}
    </AppContext.Provider>
  );
}
