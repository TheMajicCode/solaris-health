import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/api.js';
import { signChallenge, rememberKeyForSession, forgetSessionKey } from '../lib/identity-key.js';
import { buildLocalTodosFromJourney, loadDeviceTodos, saveDeviceTodos, deviceTodosKey } from '../lib/deviceTodos.js';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // K1.2 §3 — session-boot resilience. `sessionUnavailable` is true ONLY during a
  // TRANSIENT backend outage (5xx / network / timeout / offline / malformed) while a
  // saved token is still present. It drives a retryable "temporarily unavailable"
  // screen and is NEVER set for a confirmed 401 (which clears the token instead).
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  // In-flight guard: prevents duplicate concurrent /users/me calls from React
  // StrictMode's double effect invocation, rapid Retry taps, or an 'online' event
  // racing a manual retry.
  const bootInFlight = useRef(false);
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
        // K1.4.1 §B — immediately materialize the approved journey into the
        // USER-SCOPED device-local To-do store so the SAME Growth pipeline and
        // the Dashboard "Your Next Step" resolver have real, actionable rows even
        // while the optional seed-plan endpoint is a 404. Existing completion
        // state is preserved across a re-approve (merge by step_key on `done`).
        const fresh = buildLocalTodosFromJourney(block, uid);
        if (fresh.length) {
          const prev = loadDeviceTodos(uid);
          const doneByKey = new Map(prev.map((t) => [t.step_key, !!t.done]));
          const merged = fresh.map((t) => (
            doneByKey.has(t.step_key) ? { ...t, done: doneByKey.get(t.step_key) } : t
          ));
          saveDeviceTodos(uid, merged);
        }
      } else {
        localStorage.removeItem(key);
        // Dismiss/delete also clears the device-local To-dos for this account.
        try { localStorage.removeItem(deviceTodosKey(uid)); } catch { /* ignore */ }
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

  // K1.2 §3 — resilient session boot. Clear the saved token ONLY on a CONFIRMED 401
  // (invalid/revoked token) from /users/me. For every other failure — 5xx gateway
  // errors, network errors, offline, timeouts, malformed gateway responses, or any
  // temporary server failure — PRESERVE the token and ALL local data (locale,
  // device-local journeys, encryption identity, …) and surface a retryable
  // "temporarily unavailable" screen instead of silently logging the member out.
  const loadUser = useCallback(async ({ isRetry = false } = {}) => {
    if (!api.token) { setSessionUnavailable(false); setLoading(false); return; }
    // Deduplicate concurrent boot/recovery attempts.
    if (bootInFlight.current) return;
    bootInFlight.current = true;
    if (isRetry) setSessionUnavailable(false);
    try {
      const { user, profile } = await api.getMe();
      setUser(user);
      setProfile(profile);
      setSessionUnavailable(false); // connectivity restored → authenticated session back
    } catch (e) {
      if (e && e.status === 401) {
        // CONFIRMED invalid/revoked token — safe to clear and drop to auth. This is
        // the ONLY branch that erases the token. api.logout() removes only the token
        // (locale / journeys / identity are left untouched).
        api.logout();
        setUser(null);
        setSessionUnavailable(false);
      } else {
        // TRANSIENT outage — keep the token and local data; show Retry / Sign out.
        setSessionUnavailable(true);
      }
    } finally {
      bootInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  // Member-triggered recovery from the "temporarily unavailable" screen. The
  // in-flight guard inside loadUser collapses duplicate taps into a single request.
  const retrySession = useCallback(() => { loadUser({ isRetry: true }); }, [loadUser]);

  // Auto-restore the authenticated session the moment connectivity returns, without
  // any user action, but only while we are actually in the transient-outage state.
  useEffect(() => {
    const onOnline = () => {
      if (api.token && sessionUnavailable) loadUser({ isRetry: true });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [sessionUnavailable, loadUser]);

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
      user, profile, loading, sessionUnavailable, retrySession, tab, setTab, authView, setAuthView,
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
