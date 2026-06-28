/**
 * MessageThread — Phase 5
 * A single end-to-end-encrypted conversation. Messages are decrypted in the
 * browser with the user's private key; the server only ever sees ciphertext.
 *
 * Props:
 *   user            current user { userId|id, ... }
 *   identity        { privateKey, publicJwk } messaging identity (from SecureChat)
 *   conversation    { id, otherId, otherName, otherRole, otherAvatar }
 *   recipientPubJwk recipient public key JWK string (null if not yet registered)
 *   onBack          () => void          (mobile back)
 *   onActivity      () => void          (notify parent to refresh list/unread)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Paperclip, Search, Download, Flag, MoreVertical, ArrowLeft, ShieldCheck,
  Check, CheckCheck, X, Trash2, AlertTriangle, Loader2, FileText, Lock, Image as ImageIcon,
} from 'lucide-react';
import { api } from '../lib/api.js';
import {
  decryptMessage, encryptMessage, encryptFile, decryptFile,
  getDeletedIds, deleteLocally,
} from '../lib/encryption.js';

const CSS = `
.luca .mt-wrap{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--surface);border-radius:var(--r);
  border:1px solid var(--line);overflow:hidden;box-shadow:var(--shadow-sm)}
.luca .mt-head{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--line);
  background:linear-gradient(180deg,var(--surface),var(--surface-2))}
.luca .mt-back{display:none;border:none;background:transparent;cursor:pointer;color:var(--muted);padding:4px;border-radius:8px}
.luca .mt-ava{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex-shrink:0;
  background:linear-gradient(150deg,var(--teal),var(--mint));color:#fff;font-weight:800;font-size:15px;overflow:hidden}
.luca .mt-ava img{width:100%;height:100%;object-fit:cover}
.luca .mt-id{flex:1;min-width:0}
.luca .mt-name{font-weight:700;font-size:14.5px;color:var(--ink);display:flex;align-items:center;gap:7px}
.luca .mt-role{font-size:11.5px;color:var(--muted-2);text-transform:capitalize;display:flex;align-items:center;gap:5px;margin-top:1px}
.luca .mt-e2e{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:var(--mint-ink);
  background:var(--mint-soft);padding:2px 8px;border-radius:999px}
.luca .mt-hbtn{border:1px solid var(--line);background:var(--surface);cursor:pointer;color:var(--muted);
  width:34px;height:34px;border-radius:10px;display:grid;place-items:center;transition:all .15s ease;position:relative}
.luca .mt-hbtn:hover{border-color:var(--mint);color:var(--mint-ink);background:var(--mint-soft)}
.luca .mt-menu{position:absolute;top:42px;right:0;background:var(--surface);border:1px solid var(--line);border-radius:12px;
  box-shadow:var(--shadow);z-index:20;min-width:190px;overflow:hidden;padding:5px}
.luca .mt-menu button{display:flex;align-items:center;gap:9px;width:100%;border:none;background:transparent;cursor:pointer;
  padding:9px 11px;font-size:13px;color:var(--ink);border-radius:8px;text-align:left}
.luca .mt-menu button:hover{background:var(--surface-2)}
.luca .mt-menu button.danger{color:var(--danger-ink)}
.luca .mt-search{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--line);background:var(--surface-2)}
.luca .mt-search input{flex:1;border:none;background:transparent;outline:none;font-size:13px;color:var(--ink);font-family:inherit}
.luca .mt-body{flex:1;min-height:0;overflow-y:auto;padding:18px 16px;display:flex;flex-direction:column;gap:10px;
  background:radial-gradient(circle at 50% 0%,rgba(47,190,159,.04),transparent 60%)}
.luca .mt-day{align-self:center;font-size:11px;font-weight:600;color:var(--muted-2);background:var(--surface-2);
  border:1px solid var(--line);padding:3px 12px;border-radius:999px;margin:4px 0}
.luca .mt-row{display:flex;max-width:78%}
.luca .mt-row.me{align-self:flex-end;justify-content:flex-end}
.luca .mt-row.them{align-self:flex-start}
.luca .mt-bub{padding:9px 13px;border-radius:16px;font-size:13.5px;line-height:1.45;word-break:break-word;white-space:pre-wrap;position:relative}
.luca .mt-row.me .mt-bub{background:linear-gradient(160deg,var(--teal),var(--teal-d2));color:#EAFBF5;border-bottom-right-radius:5px}
.luca .mt-row.them .mt-bub{background:var(--surface);border:1px solid var(--line);color:var(--ink);border-bottom-left-radius:5px}
.luca .mt-meta{display:flex;align-items:center;gap:5px;font-size:10.5px;margin-top:4px;opacity:.85}
.luca .mt-row.me .mt-meta{justify-content:flex-end;color:#Bfeae0}
.luca .mt-row.them .mt-meta{color:var(--muted-2)}
.luca .mt-att{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:11px;cursor:pointer;margin-bottom:3px;
  background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2)}
.luca .mt-row.them .mt-att{background:var(--surface-2);border:1px solid var(--line)}
.luca .mt-att .mt-aic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;
  background:rgba(255,255,255,.2)}
.luca .mt-row.them .mt-att .mt-aic{background:var(--mint-soft);color:var(--mint-ink)}
.luca .mt-att .mt-an{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px}
.luca .mt-att .mt-as{font-size:10.5px;opacity:.8}
.luca .mt-undec{font-style:italic;opacity:.7;display:flex;align-items:center;gap:6px}
.luca .mt-typing{align-self:flex-start;display:flex;align-items:center;gap:4px;padding:9px 14px;background:var(--surface);
  border:1px solid var(--line);border-radius:16px;border-bottom-left-radius:5px}
.luca .mt-typing span{width:7px;height:7px;border-radius:50%;background:var(--muted-2);animation:mtBlink 1.3s infinite both}
.luca .mt-typing span:nth-child(2){animation-delay:.2s}.luca .mt-typing span:nth-child(3){animation-delay:.4s}
@keyframes mtBlink{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.luca .mt-foot{border-top:1px solid var(--line);padding:11px 14px;background:var(--surface)}
.luca .mt-warn{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--gold-ink);background:var(--gold-soft);
  border:1px solid #EBD3A0;border-radius:10px;padding:8px 11px;margin-bottom:9px}
.luca .mt-compose{display:flex;align-items:flex-end;gap:9px}
.luca .mt-compose textarea{flex:1;resize:none;border:1px solid var(--line);border-radius:14px;padding:10px 13px;font-size:13.5px;
  font-family:inherit;color:var(--ink);outline:none;max-height:120px;line-height:1.4;background:var(--surface-2)}
.luca .mt-compose textarea:focus{border-color:var(--mint);box-shadow:0 0 0 3px var(--mint-soft);background:var(--surface)}
.luca .mt-icbtn{border:1px solid var(--line);background:var(--surface);cursor:pointer;color:var(--muted);
  width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex-shrink:0;transition:all .15s ease}
.luca .mt-icbtn:hover{border-color:var(--mint);color:var(--mint-ink);background:var(--mint-soft)}
.luca .mt-send{border:none;background:linear-gradient(160deg,var(--mint),var(--teal));color:#fff;cursor:pointer;
  width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex-shrink:0;transition:all .15s ease}
.luca .mt-send:disabled{opacity:.45;cursor:not-allowed}
.luca .mt-send:not(:disabled):hover{filter:brightness(1.06)}
.luca .mt-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--muted-2);text-align:center;padding:30px}
.luca .mt-empty .mt-eic{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:var(--mint-soft);color:var(--mint-ink)}
.luca .mt-modal-bg{position:fixed;inset:0;background:rgba(10,43,41,.45);display:grid;place-items:center;z-index:60;padding:20px}
.luca .mt-modal{background:var(--surface);border-radius:18px;max-width:420px;width:100%;padding:22px;box-shadow:var(--shadow)}
.luca .mt-modal h4{margin:0 0 4px;font-size:16px;font-weight:700}
.luca .mt-modal textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;font-size:13px;
  margin-top:12px;resize:vertical;min-height:80px;outline:none}
.luca .mt-modal-act{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
.luca .mt-btn{border:none;border-radius:11px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer}
.luca .mt-btn.ghost{background:var(--surface-2);border:1px solid var(--line);color:var(--ink)}
.luca .mt-btn.primary{background:linear-gradient(160deg,var(--mint),var(--teal));color:#fff}
.luca .mt-btn.danger{background:var(--danger);color:#fff}
.luca .mt-pin{position:absolute;top:-7px;right:6px;opacity:0;transition:opacity .15s ease}
.luca .mt-row:hover .mt-pin{opacity:1}
.luca .mt-pin button{border:1px solid var(--line);background:var(--surface);border-radius:8px;width:24px;height:24px;
  display:grid;place-items:center;cursor:pointer;color:var(--muted);box-shadow:var(--shadow-sm)}
.luca .mt-pin button:hover{color:var(--danger-ink);border-color:var(--danger)}
.luca .mt-wrap .spin{animation:mtSpin 1s linear infinite}
@keyframes mtSpin{to{transform:rotate(360deg)}}
@media(max-width:860px){.luca .mt-back{display:grid;place-items:center}.luca .mt-row{max-width:88%}}
`;

const MAX_FILE = 10 * 1024 * 1024;
const fmtBytes = (n) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
};
const dayKey = (d) => new Date(d).toDateString();
const fmtDay = (d) => {
  const dt = new Date(d); const today = new Date(); const yd = new Date(); yd.setDate(today.getDate() - 1);
  if (dt.toDateString() === today.toDateString()) return 'Today';
  if (dt.toDateString() === yd.toDateString()) return 'Yesterday';
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const initials = (n) => (n || 'M').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

export default function MessageThread({ user, identity, conversation, recipientPubJwk, onBack, onActivity }) {
  const myId = user.userId || user.id;
  const [messages, setMessages] = useState([]);
  const [plain, setPlain] = useState({});      // id -> decrypted text
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportFor, setReportFor] = useState(null); // message id or 'conversation'
  const [reportText, setReportText] = useState('');
  const [err, setErr] = useState('');
  const [downloading, setDownloading] = useState(null);
  const bodyRef = useRef(null);
  const fileRef = useRef(null);
  const typingSentRef = useRef(0);
  const deletedRef = useRef(getDeletedIds(myId));
  const lastCountRef = useRef(0);

  const scrollToBottom = useCallback((smooth) => {
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  const decryptAll = useCallback(async (msgs) => {
    if (!identity?.privateKey) return;
    const next = {};
    for (const m of msgs) {
      if (plain[m.id] !== undefined) { next[m.id] = plain[m.id]; continue; }
      if (!m.encryptedContent && m.type === 'file') { next[m.id] = ''; continue; }
      try {
        next[m.id] = await decryptMessage({ encryptedContent: m.encryptedContent, iv: m.iv, encKey: m.encKey }, identity.privateKey);
      } catch {
        next[m.id] = null; // undecryptable
      }
    }
    setPlain(next);
  }, [identity, plain]);

  const load = useCallback(async (initial) => {
    try {
      const res = await api.getConversation(conversation.id);
      const visible = (res.messages || []).filter((m) => !deletedRef.current.has(m.id));
      setTyping(!!res.typing);
      setMessages(visible);
      await decryptAll(visible);
      const grew = visible.length > lastCountRef.current;
      lastCountRef.current = visible.length;
      if (initial || grew) scrollToBottom(!initial);
      if (grew && onActivity) onActivity();
    } catch (e) {
      setErr(e.message || 'Could not load messages');
    } finally {
      if (initial) setLoading(false);
    }
  }, [conversation.id, decryptAll, scrollToBottom, onActivity]);

  // initial load + reset on conversation switch
  useEffect(() => {
    setLoading(true); setMessages([]); setPlain({}); lastCountRef.current = 0;
    deletedRef.current = getDeletedIds(myId);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // poll for new messages + typing (near real-time without sockets)
  useEffect(() => {
    const t = setInterval(() => load(false), 6000);
    return () => clearInterval(t);
  }, [load]);

  const handleTyping = (v) => {
    setDraft(v);
    const now = Date.now();
    if (now - typingSentRef.current > 3000) {
      typingSentRef.current = now;
      api.setTyping(conversation.id).catch(() => {});
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (!recipientPubJwk) { setErr('This contact has not set up encryption yet. They need to open Messages once.'); return; }
    setSending(true); setErr('');
    try {
      const env = await encryptMessage(text, recipientPubJwk, identity.publicJwk);
      const res = await api.sendMessage({
        conversationId: conversation.id,
        encryptedContent: env.ciphertext, iv: env.iv,
        encKeySender: env.encKeySender, encKeyRecipient: env.encKeyRecipient,
      });
      setDraft('');
      // optimistic: append locally with decrypted text
      const newMsg = {
        id: res.id, fromMe: true, senderId: myId, encryptedContent: env.ciphertext, iv: env.iv,
        encKey: env.encKeySender, type: 'text', hasAttachment: false, createdAt: res.createdAt, readAt: null, attachment: null,
      };
      setMessages((prev) => [...prev, newMsg]);
      setPlain((prev) => ({ ...prev, [res.id]: text }));
      lastCountRef.current += 1;
      scrollToBottom(true);
      onActivity && onActivity();
    } catch (e) {
      setErr(e.message || 'Failed to send');
    } finally { setSending(false); }
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE) { setErr('File exceeds the 10 MB limit'); return; }
    if (!recipientPubJwk) { setErr('This contact has not set up encryption yet.'); return; }
    setSending(true); setErr('');
    try {
      const env = await encryptFile(file, recipientPubJwk, identity.publicJwk);
      const res = await api.uploadAttachment({
        conversationId: conversation.id,
        encryptedBlob: env.encryptedBlob, encryptedFilename: env.encryptedFilename, iv: env.iv,
        encKeySender: env.encKeySender, encKeyRecipient: env.encKeyRecipient,
        size: env.size, mimeType: env.mimeType,
      });
      await load(false);
      scrollToBottom(true);
      onActivity && onActivity();
    } catch (e2) {
      setErr(e2.message || 'Failed to upload file');
    } finally { setSending(false); }
  };

  const downloadAttachment = async (m) => {
    if (!m.attachment) return;
    setDownloading(m.id);
    try {
      const data = await api.downloadAttachment(m.id);
      const { blob, filename } = await decryptFile(
        { encryptedBlob: data.encryptedBlob, encryptedFilename: data.encryptedFilename, iv: data.iv, encKey: data.encKey, mimeType: data.mimeType },
        identity.privateKey, data.mimeType,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || 'attachment';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErr('Could not decrypt attachment');
    } finally { setDownloading(null); }
  };

  const localDelete = (id) => {
    deleteLocally(myId, id);
    deletedRef.current.add(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const submitReport = async () => {
    try {
      await api.reportMessage({
        conversationId: conversation.id,
        messageId: reportFor !== 'conversation' ? reportFor : null,
        reason: reportText.trim(),
      });
      setReportFor(null); setReportText(''); setMenuOpen(false);
      setErr(''); alert('Report submitted. Our trust & safety team will review it.');
    } catch (e) {
      setErr('Could not submit report');
    }
  };

  const exportConversation = () => {
    const lines = [`Encrypted conversation with ${conversation.otherName}`, `Exported ${new Date().toLocaleString()}`, ''.padEnd(48, '─'), ''];
    for (const m of messages) {
      const who = m.fromMe ? 'You' : conversation.otherName;
      const when = new Date(m.createdAt).toLocaleString();
      let txt = plain[m.id];
      if (txt === null || txt === undefined) txt = m.hasAttachment ? '[encrypted attachment]' : '[unable to decrypt]';
      if (m.hasAttachment && !txt) txt = '[encrypted attachment]';
      lines.push(`[${when}] ${who}: ${txt}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `conversation-${conversation.otherName.replace(/\s+/g, '-').toLowerCase()}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setMenuOpen(false);
  };

  // render list with day separators + search filter
  const q = query.trim().toLowerCase();
  const filtered = q
    ? messages.filter((m) => (plain[m.id] || '').toLowerCase().includes(q))
    : messages;

  const rows = [];
  let lastDay = null;
  filtered.forEach((m) => {
    const dk = dayKey(m.createdAt);
    if (dk !== lastDay) { rows.push({ sep: true, id: 'sep-' + dk, label: fmtDay(m.createdAt) }); lastDay = dk; }
    rows.push(m);
  });

  return (
    <div className="mt-wrap">
      <style>{CSS}</style>

      {/* header */}
      <div className="mt-head">
        <button className="mt-back" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="mt-ava">
          {conversation.otherAvatar ? <img src={conversation.otherAvatar} alt="" /> : initials(conversation.otherName)}
        </div>
        <div className="mt-id">
          <div className="mt-name">{conversation.otherName}</div>
          <div className="mt-role">
            {conversation.otherRole}
            <span className="mt-e2e"><Lock size={10} /> End-to-end encrypted</span>
          </div>
        </div>
        <button className="mt-hbtn" onClick={() => setShowSearch((s) => !s)} title="Search"><Search size={16} /></button>
        <div style={{ position: 'relative' }}>
          <button className="mt-hbtn" onClick={() => setMenuOpen((m) => !m)} title="More"><MoreVertical size={16} /></button>
          {menuOpen && (
            <div className="mt-menu" onMouseLeave={() => setMenuOpen(false)}>
              <button onClick={exportConversation}><Download size={15} /> Export conversation</button>
              <button className="danger" onClick={() => { setReportFor('conversation'); setMenuOpen(false); }}>
                <Flag size={15} /> Report conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* search bar */}
      {showSearch && (
        <div className="mt-search">
          <Search size={15} style={{ color: 'var(--muted-2)' }} />
          <input autoFocus placeholder="Search this conversation…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && <X size={15} style={{ cursor: 'pointer', color: 'var(--muted-2)' }} onClick={() => setQuery('')} />}
        </div>
      )}

      {/* body */}
      <div className="mt-body" ref={bodyRef}>
        {loading ? (
          <div className="mt-empty"><Loader2 className="spin" size={26} /><div>Decrypting messages…</div></div>
        ) : rows.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-eic"><ShieldCheck size={26} /></div>
            <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{q ? 'No matches' : 'Start the conversation'}</div>
            <div style={{ fontSize: 13, maxWidth: 280 }}>
              {q ? 'Try a different search term.' : 'Messages are end-to-end encrypted. Only you and ' + conversation.otherName + ' can read them.'}
            </div>
          </div>
        ) : rows.map((m) => m.sep ? (
          <div key={m.id} className="mt-day">{m.label}</div>
        ) : (
          <div key={m.id} className={'mt-row ' + (m.fromMe ? 'me' : 'them')}>
            <div className="mt-bub">
              {m.fromMe && (
                <span className="mt-pin">
                  <button title="Delete for me" onClick={() => localDelete(m.id)}><Trash2 size={12} /></button>
                </span>
              )}
              {!m.fromMe && (
                <span className="mt-pin" style={{ right: 'auto', left: 6 }}>
                  <button title="Report" onClick={() => setReportFor(m.id)}><Flag size={12} /></button>
                </span>
              )}
              {m.hasAttachment && m.attachment && (
                <div className="mt-att" onClick={() => downloadAttachment(m)}>
                  <span className="mt-aic">
                    {downloading === m.id ? <Loader2 className="spin" size={16} />
                      : (m.attachment.mimeType || '').startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="mt-an">{plain[m.id] || 'Encrypted file'}</div>
                    <div className="mt-as">{fmtBytes(m.attachment.size)} · tap to decrypt &amp; download</div>
                  </div>
                  <Download size={15} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              )}
              {!m.hasAttachment && (
                plain[m.id] === null
                  ? <span className="mt-undec"><AlertTriangle size={13} /> Unable to decrypt</span>
                  : plain[m.id] === undefined
                    ? <span className="mt-undec"><Loader2 className="spin" size={13} /> Decrypting…</span>
                    : plain[m.id]
              )}
              <div className="mt-meta">
                {fmtTime(m.createdAt)}
                {m.fromMe && (m.readAt ? <CheckCheck size={13} /> : <Check size={13} />)}
              </div>
            </div>
          </div>
        ))}
        {typing && !loading && (
          <div className="mt-typing"><span></span><span></span><span></span></div>
        )}
      </div>

      {/* footer / compose */}
      <div className="mt-foot">
        {err && <div className="mt-warn"><AlertTriangle size={15} /> {err}</div>}
        {!recipientPubJwk && !err && (
          <div className="mt-warn">
            <AlertTriangle size={15} /> {conversation.otherName} hasn’t opened Messages yet, so they can’t receive encrypted messages. You can still write — delivery completes once they set up their key.
          </div>
        )}
        <div className="mt-compose">
          <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={onPickFile} />
          <button className="mt-icbtn" onClick={() => fileRef.current?.click()} disabled={sending} title="Attach encrypted file"><Paperclip size={18} /></button>
          <textarea
            rows={1} placeholder="Write an encrypted message…" value={draft}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{ height: Math.min(120, 42 + (draft.split('\n').length - 1) * 18) }}
          />
          <button className="mt-send" onClick={send} disabled={sending || !draft.trim()} title="Send">
            {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* report modal */}
      {reportFor && (
        <div className="mt-modal-bg" onClick={() => setReportFor(null)}>
          <div className="mt-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Report {reportFor === 'conversation' ? 'conversation' : 'message'}</h4>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Help us keep the community safe. Your report is confidential. Messages stay encrypted — only metadata you provide is shared with trust &amp; safety.
            </div>
            <textarea placeholder="Describe the issue (optional)…" value={reportText} onChange={(e) => setReportText(e.target.value)} />
            <div className="mt-modal-act">
              <button className="mt-btn ghost" onClick={() => { setReportFor(null); setReportText(''); }}>Cancel</button>
              <button className="mt-btn danger" onClick={submitReport}>Submit report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
