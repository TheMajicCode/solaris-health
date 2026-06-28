/**
 * SecureChat — Phase 5 (Messages tab)
 * Top-level messaging surface for patients & practitioners.
 *  • Generates / loads the user's E2E messaging identity and publishes the
 *    public key on first use.
 *  • Lists conversations with unread badges, lets the user start a new one from
 *    their care network, and embeds <MessageThread/> for the active chat.
 *  • Polls (60s) for new conversations / unread counts and raises desktop
 *    notifications when a new incoming message arrives.
 *
 * Props:
 *   user        current user
 *   onUnread    (count) => void   optional — lets the shell update its nav badge
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Plus, Search, ShieldCheck, Lock, Loader2, X, Bell, BellOff,
  Paperclip, ChevronRight, Stethoscope, User as UserIcon, AlertTriangle, KeyRound,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { loadOrCreateIdentity, cryptoAvailable } from '../lib/encryption.js';
import MessageThread from './MessageThread.jsx';

const CSS = `
.luca .sc-wrap{display:grid;grid-template-columns:330px 1fr;gap:16px;height:calc(100vh - 150px);min-height:520px}
.luca .sc-list{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);
  border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow-sm)}
.luca .sc-lhead{padding:15px 16px 12px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--surface),var(--surface-2))}
.luca .sc-ltop{display:flex;align-items:center;justify-content:space-between;gap:8px}
.luca .sc-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:17px;display:flex;align-items:center;gap:8px}
.luca .sc-actions{display:flex;gap:7px}
.luca .sc-ico{border:1px solid var(--line);background:var(--surface);cursor:pointer;color:var(--muted);
  width:34px;height:34px;border-radius:10px;display:grid;place-items:center;transition:all .15s ease;position:relative}
.luca .sc-ico:hover{border-color:var(--mint);color:var(--mint-ink);background:var(--mint-soft)}
.luca .sc-ico.on{border-color:var(--mint);color:var(--mint-ink);background:var(--mint-soft)}
.luca .sc-search{display:flex;align-items:center;gap:8px;margin-top:11px;padding:8px 11px;border:1px solid var(--line);
  border-radius:11px;background:var(--surface-2)}
.luca .sc-search input{flex:1;border:none;background:transparent;outline:none;font-size:13px;color:var(--ink);font-family:inherit}
.luca .sc-e2e-note{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mint-ink);margin-top:9px}
.luca .sc-scroll{flex:1;overflow-y:auto}
.luca .sc-conv{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--line-2);
  transition:background .12s ease;position:relative}
.luca .sc-conv:hover{background:var(--surface-2)}
.luca .sc-conv.active{background:var(--mint-soft)}
.luca .sc-conv.active:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--mint)}
.luca .sc-ava{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;flex-shrink:0;
  background:linear-gradient(150deg,var(--teal),var(--mint));color:#fff;font-weight:800;font-size:15px;overflow:hidden}
.luca .sc-ava img{width:100%;height:100%;object-fit:cover}
.luca .sc-cmid{flex:1;min-width:0}
.luca .sc-crow{display:flex;align-items:center;justify-content:space-between;gap:8px}
.luca .sc-cname{font-weight:700;font-size:14px;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.luca .sc-ctime{font-size:11px;color:var(--muted-2);flex-shrink:0}
.luca .sc-cprev{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;
  display:flex;align-items:center;gap:5px}
.luca .sc-badge{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--mint);color:#fff;
  font-size:11px;font-weight:800;display:grid;place-items:center;flex-shrink:0}
.luca .sc-role{font-size:10.5px;color:var(--muted-2);display:inline-flex;align-items:center;gap:4px;text-transform:capitalize}
.luca .sc-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;
  color:var(--muted-2);padding:34px 22px}
.luca .sc-empty .sc-eic{width:54px;height:54px;border-radius:17px;display:grid;place-items:center;background:var(--mint-soft);color:var(--mint-ink)}
.luca .sc-pane{min-width:0}
.luca .sc-pane-empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
  background:var(--surface);border:1px dashed var(--line);border-radius:var(--r);color:var(--muted-2);text-align:center;padding:40px}
.luca .sc-pane-empty .sc-pic{width:74px;height:74px;border-radius:22px;display:grid;place-items:center;
  background:linear-gradient(150deg,var(--mint-soft),var(--surface-2));color:var(--mint-ink)}
.luca .sc-modal-bg{position:fixed;inset:0;background:rgba(10,43,41,.45);display:grid;place-items:center;z-index:60;padding:20px}
.luca .sc-modal{background:var(--surface);border-radius:20px;max-width:460px;width:100%;max-height:80vh;display:flex;flex-direction:column;
  box-shadow:var(--shadow);overflow:hidden}
.luca .sc-mhead{padding:18px 20px 12px;border-bottom:1px solid var(--line)}
.luca .sc-mhead h4{margin:0;font-size:17px;font-weight:700;font-family:'Space Grotesk',sans-serif;display:flex;align-items:center;gap:8px}
.luca .sc-mbody{overflow-y:auto;padding:8px}
.luca .sc-ct{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:12px;cursor:pointer;transition:background .12s ease}
.luca .sc-ct:hover{background:var(--surface-2)}
.luca .sc-ct .sc-cn{font-weight:650;font-size:13.5px;color:var(--ink)}
.luca .sc-tag{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:auto}
.luca .sc-tag.key{background:var(--mint-soft);color:var(--mint-ink)}
.luca .sc-tag.nokey{background:var(--surface-2);color:var(--muted-2)}
.luca .sc-tag.assigned{background:var(--gold-soft);color:var(--gold-ink)}
.luca .sc-load{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--muted-2)}
.luca .sc-spin{animation:scSpin 1s linear infinite}@keyframes scSpin{to{transform:rotate(360deg)}}
.luca .sc-keychip{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:var(--teal);
  background:var(--surface-2);border:1px solid var(--line);padding:4px 10px;border-radius:999px;margin-top:10px}
@media(max-width:860px){
  .luca .sc-wrap{grid-template-columns:1fr;height:calc(100vh - 130px)}
  .luca .sc-wrap.has-active .sc-list{display:none}
  .luca .sc-wrap:not(.has-active) .sc-pane{display:none}
}
`;

const initials = (n) => (n || 'M').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
const fmtAgo = (d) => {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function SecureChat({ user, onUnread }) {
  const myId = user.userId || user.id;
  const [identity, setIdentity] = useState(null);
  const [identityErr, setIdentityErr] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [active, setActive] = useState(null);          // { id, otherId, otherName, otherRole, otherAvatar }
  const [recipientPub, setRecipientPub] = useState(null);
  const [query, setQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [notifyOn, setNotifyOn] = useState(typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const pubCache = useRef({});      // userId -> jwk
  const lastUnreadRef = useRef(0);
  const seenLastMsgRef = useRef({}); // convId -> last message id (for notifications)

  /* ---- identity bootstrap: load/create keypair, publish public key ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!cryptoAvailable()) { setIdentityErr('This browser does not support the Web Crypto API required for encrypted messaging.'); return; }
      try {
        const id = await loadOrCreateIdentity(myId);
        if (!alive) return;
        setIdentity(id);
        // publish/refresh public key so contacts can message us
        try { await api.uploadPublicKey(id.publicJwk); } catch (e) { /* best-effort */ }
      } catch (e) {
        if (alive) setIdentityErr(e.message || 'Could not set up encryption keys');
      }
    })();
    return () => { alive = false; };
  }, [myId]);

  /* ---- conversation list + unread polling ---- */
  const refreshList = useCallback(async (notify) => {
    try {
      const res = await api.getConversations();
      const convs = res.conversations || [];
      setConversations(convs);
      const total = convs.reduce((s, c) => s + (c.unread || 0), 0);
      if (onUnread) onUnread(total);

      // desktop notification on new incoming message
      if (notify && notifyOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const c of convs) {
          const lm = c.lastMessage;
          if (lm && !lm.fromMe && c.unread > 0 && seenLastMsgRef.current[c.id] !== lm.id) {
            if (seenLastMsgRef.current[c.id] !== undefined && (!active || active.id !== c.id)) {
              try {
                new Notification('New secure message', {
                  body: `${c.otherName} sent you ${lm.hasAttachment ? 'an attachment' : 'a message'}`,
                  icon: '/favicon.ico', tag: 'luca-msg-' + c.id,
                });
              } catch { /* ignore */ }
            }
          }
          if (lm) seenLastMsgRef.current[c.id] = lm.id;
        }
      } else {
        for (const c of convs) if (c.lastMessage) seenLastMsgRef.current[c.id] = c.lastMessage.id;
      }
      lastUnreadRef.current = total;
    } catch (e) {
      /* keep prior list */
    } finally {
      setLoadingList(false);
    }
  }, [onUnread, notifyOn, active]);

  useEffect(() => {
    refreshList(false);
    const t = setInterval(() => refreshList(true), 60000);
    return () => clearInterval(t);
  }, [refreshList]);

  /* ---- open a conversation: fetch recipient public key ---- */
  const openConversation = useCallback(async (conv) => {
    setActive(conv);
    setRecipientPub(null);
    // mark read locally for snappy badge update
    setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unread: 0 } : c));
    const otherId = conv.otherId;
    if (pubCache.current[otherId]) { setRecipientPub(pubCache.current[otherId]); }
    else {
      try {
        const k = await api.getPublicKey(otherId);
        if (k && k.publicKey) { pubCache.current[otherId] = k.publicKey; setRecipientPub(k.publicKey); }
      } catch { /* recipient has no key yet */ }
    }
  }, []);

  /* ---- contact picker ---- */
  const openPicker = async () => {
    setShowPicker(true);
    setLoadingContacts(true);
    try {
      const res = await api.getMessageContacts();
      setContacts(res.contacts || []);
    } catch (e) { setContacts([]); }
    finally { setLoadingContacts(false); }
  };

  const startWith = async (contact) => {
    try {
      const res = await api.startConversation(contact.id);
      setShowPicker(false);
      const conv = {
        id: res.conversationId, otherId: res.otherId,
        otherName: res.otherName, otherRole: res.otherRole, otherAvatar: contact.avatarUrl,
      };
      // ensure it's in the list
      setConversations((prev) => prev.some((c) => c.id === conv.id) ? prev : [{ ...conv, unread: 0, lastMessage: null, updatedAt: new Date().toISOString() }, ...prev]);
      openConversation(conv);
    } catch (e) { /* noop */ }
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') { setNotifyOn((v) => !v); return; }
    const p = await Notification.requestPermission();
    setNotifyOn(p === 'granted');
  };

  const onThreadActivity = useCallback(() => { refreshList(false); }, [refreshList]);

  const filtered = query.trim()
    ? conversations.filter((c) => c.otherName.toLowerCase().includes(query.trim().toLowerCase()))
    : conversations;

  if (identityErr) {
    return (
      <div className="sc-pane-empty" style={{ height: 360 }}>
        <style>{CSS}</style>
        <div className="sc-pic" style={{ background: 'var(--danger-soft)', color: 'var(--danger-ink)' }}><AlertTriangle size={30} /></div>
        <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 16 }}>Encryption unavailable</div>
        <div style={{ maxWidth: 360, fontSize: 13.5 }}>{identityErr}</div>
      </div>
    );
  }

  return (
    <div className={'sc-wrap' + (active ? ' has-active' : '')}>
      <style>{CSS}</style>

      {/* conversation list */}
      <div className="sc-list">
        <div className="sc-lhead">
          <div className="sc-ltop">
            <div className="sc-title"><MessageSquare size={19} style={{ color: 'var(--mint-ink)' }} /> Messages</div>
            <div className="sc-actions">
              <button className={'sc-ico' + (notifyOn ? ' on' : '')} onClick={requestNotifications} title={notifyOn ? 'Notifications on' : 'Enable desktop notifications'}>
                {notifyOn ? <Bell size={16} /> : <BellOff size={16} />}
              </button>
              <button className="sc-ico" onClick={openPicker} title="New message"><Plus size={17} /></button>
            </div>
          </div>
          <div className="sc-search">
            <Search size={15} style={{ color: 'var(--muted-2)' }} />
            <input placeholder="Search conversations…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && <X size={15} style={{ cursor: 'pointer', color: 'var(--muted-2)' }} onClick={() => setQuery('')} />}
          </div>
          <div className="sc-e2e-note"><ShieldCheck size={13} /> All messages are end-to-end encrypted</div>
          {identity && (
            <div className="sc-keychip" title="Your encryption key fingerprint">
              <KeyRound size={12} /> Key {identity.fingerprint?.slice(0, 8)}
            </div>
          )}
        </div>

        <div className="sc-scroll">
          {loadingList ? (
            <div className="sc-load" style={{ padding: 40 }}><Loader2 className="sc-spin" size={24} /><div style={{ fontSize: 13 }}>Loading…</div></div>
          ) : filtered.length === 0 ? (
            <div className="sc-empty">
              <div className="sc-eic"><MessageSquare size={24} /></div>
              <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{query ? 'No matches' : 'No conversations yet'}</div>
              <div style={{ fontSize: 12.5 }}>{query ? 'Try another name.' : 'Start a secure conversation with your care network.'}</div>
              {!query && <button className="sc-ico" style={{ width: 'auto', padding: '8px 14px', gap: 7, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600 }} onClick={openPicker}><Plus size={16} /> New message</button>}
            </div>
          ) : filtered.map((c) => (
            <div key={c.id} className={'sc-conv' + (active && active.id === c.id ? ' active' : '')} onClick={() => openConversation(c)}>
              <div className="sc-ava">{c.otherAvatar ? <img src={c.otherAvatar} alt="" /> : initials(c.otherName)}</div>
              <div className="sc-cmid">
                <div className="sc-crow">
                  <span className="sc-cname">{c.otherName}</span>
                  <span className="sc-ctime">{c.lastMessage ? fmtAgo(c.lastMessage.createdAt) : fmtAgo(c.updatedAt)}</span>
                </div>
                <div className="sc-crow">
                  <span className="sc-cprev">
                    {c.lastMessage
                      ? <>{c.lastMessage.hasAttachment && <Paperclip size={12} />}<Lock size={11} />{c.lastMessage.fromMe ? 'You: ' : ''}{c.lastMessage.hasAttachment ? 'Encrypted attachment' : 'Encrypted message'}</>
                      : <span className="sc-role">{c.otherRole === 'practitioner' ? <Stethoscope size={12} /> : <UserIcon size={12} />}{c.otherRole}</span>}
                  </span>
                  {c.unread > 0 && <span className="sc-badge">{c.unread > 9 ? '9+' : c.unread}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* active thread / placeholder */}
      <div className="sc-pane">
        {active && identity ? (
          <MessageThread
            user={user}
            identity={identity}
            conversation={active}
            recipientPubJwk={recipientPub}
            onBack={() => setActive(null)}
            onActivity={onThreadActivity}
          />
        ) : (
          <div className="sc-pane-empty">
            <div className="sc-pic"><Lock size={32} /></div>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 17, fontFamily: "'Space Grotesk',sans-serif" }}>Your messages are private</div>
            <div style={{ maxWidth: 360, fontSize: 13.5 }}>
              Select a conversation or start a new one. Every message is end-to-end encrypted — not even Solaris can read them.
            </div>
            {!identity && <div className="sc-keychip"><Loader2 className="sc-spin" size={12} /> Setting up your encryption keys…</div>}
          </div>
        )}
      </div>

      {/* new-conversation picker */}
      {showPicker && (
        <div className="sc-modal-bg" onClick={() => setShowPicker(false)}>
          <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sc-mhead">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4><Plus size={18} /> New secure message</h4>
                <X size={20} style={{ cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setShowPicker(false)} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                {user.role === 'patient' ? 'Choose a practitioner from your care network.' : 'Choose a patient to message.'}
              </div>
            </div>
            <div className="sc-mbody">
              {loadingContacts ? (
                <div className="sc-load" style={{ padding: 36 }}><Loader2 className="sc-spin" size={22} /></div>
              ) : contacts.length === 0 ? (
                <div className="sc-empty"><div className="sc-eic"><UserIcon size={22} /></div><div style={{ fontWeight: 600, color: 'var(--ink)' }}>No contacts available</div></div>
              ) : contacts.map((ct) => (
                <div key={ct.id} className="sc-ct" onClick={() => startWith(ct)}>
                  <div className="sc-ava" style={{ width: 40, height: 40, borderRadius: 12 }}>
                    {ct.avatarUrl ? <img src={ct.avatarUrl} alt="" /> : initials(ct.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="sc-cn">{ct.name}</div>
                    <div className="sc-role">{ct.role === 'practitioner' ? <Stethoscope size={12} /> : <UserIcon size={12} />}{ct.role}</div>
                  </div>
                  {ct.assigned && <span className="sc-tag assigned">Care team</span>}
                  <span className={'sc-tag ' + (ct.hasKey ? 'key' : 'nokey')}>{ct.hasKey ? 'Encrypted' : 'No key yet'}</span>
                  <ChevronRight size={16} style={{ color: 'var(--muted-2)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
