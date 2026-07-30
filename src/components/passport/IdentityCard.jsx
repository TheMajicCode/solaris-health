/**
 * IdentityCard — the sovereign identity panel of the Digital Sovereign Passport.
 * Shows the member's name/avatar, decentralized identifier (DID), sovereign
 * Identity Key (Nostr npub), contribution level, personas (Main + Anonymous),
 * key custody, and a one-click "Export My Data" action. The member owns their identity.
 */
import React, { useState, useEffect } from 'react';
import { ShieldCheck, KeyRound, Fingerprint, Download, Loader2, User, VenetianMask, Sun, Info, X, Copy, Check, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api.js';
import { levelFor } from './levels.js';
import { createIdentity, IDENTITY_KEY_INFO } from '../../lib/identity-key.js';

// ── Identity Key info popover (exact sovereignty copy — A2 §3) ──
function IdentityKeyInfo({ onClose }) {
  return (
    <div className="idc-modal-backdrop" onClick={onClose}>
      <div className="idc-modal" onClick={(e) => e.stopPropagation()}>
        <button className="idc-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', color: '#0A2B29', fontSize: '1.05rem' }}>
          <KeyRound size={18} color="#2DB584" /> {IDENTITY_KEY_INFO.title}
        </h3>
        {IDENTITY_KEY_INFO.lines.map((line, i) => (
          <p key={i} style={{ color: '#6b807a', fontSize: '0.86rem', lineHeight: 1.55, margin: '0 0 12px' }}>{line}</p>
        ))}
      </div>
    </div>
  );
}

const truncMid = (s, head = 12, tail = 6) => {
  if (!s) return '—';
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
};

export default function IdentityCard({ user, compact = false }) {
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState('');
  const [solarisId, setSolarisId] = useState(null);
  const [identityKey, setIdentityKey] = useState(null); // { npub, handle, nip05, hasKey }
  const [ikInfo, setIkInfo] = useState(false);          // info popover
  const [bindOpen, setBindOpen] = useState(false);      // bind flow modal
  const [gen, setGen] = useState(null);                 // { mnemonic, npub, nsec, ... }
  const [handleInput, setHandleInput] = useState('');
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [bindErr, setBindErr] = useState('');
  const [bindBusy, setBindBusy] = useState(false);
  const [genCopied, setGenCopied] = useState(false);

  const loadIdentity = () => {
    api.getIdentityMe()
      .then((i) => { setSolarisId(i?.solarisId || null); setIdentityKey(i?.identityKey || null); })
      .catch(() => { setSolarisId(null); setIdentityKey(null); });
  };
  useEffect(() => { loadIdentity(); }, []);
  if (!user) return null;

  const name = user.displayName || user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member';
  const hasKey = !!(identityKey && identityKey.hasKey && identityKey.npub);
  const npub = (identityKey && identityKey.npub) || user.nostrNpub || null;
  const did = user.did || `did:solaris:${(user.id || 'mock')}`;
  const lv = levelFor(user.levelPoints);
  const custody = user.keyCustody || 'self';
  const createdVia = user.createdVia || 'email';

  const copy = async (label, val) => {
    try { await navigator.clipboard.writeText(val); setCopied(label); setTimeout(() => setCopied(''), 1400); } catch {}
  };

  // ── Identity Key bind flow (generate on device → send only the public npub) ──
  const openBind = () => {
    setBindErr(''); setSavedConfirmed(false); setHandleInput('');
    try { setGen(createIdentity()); setBindOpen(true); }
    catch { setBindErr('Could not generate an identity key. Please try again.'); }
  };
  const copyGen = async () => {
    if (!gen?.mnemonic) return;
    try { await navigator.clipboard.writeText(gen.mnemonic); setGenCopied(true); setTimeout(() => setGenCopied(false), 1800); } catch {}
  };
  const submitBind = async () => {
    if (!gen || !savedConfirmed) return;
    setBindErr(''); setBindBusy(true);
    try {
      const h = handleInput.trim().toLowerCase();
      await api.bindIdentityKey(gen.npub, h || undefined); // only the PUBLIC npub is sent
      loadIdentity();
      setBindOpen(false); setGen(null);
    } catch (err) {
      setBindErr(err.message || 'Could not link your Identity Key. Please try again.');
    } finally { setBindBusy(false); }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const blob = await api.downloadVault();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `luca-passport-${user.id || 'me'}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // fall back to JSON manifest
      try {
        const manifest = await api.getVaultExport();
        const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `luca-passport-${user.id || 'me'}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } catch {}
    } finally { setExporting(false); }
  };

  const avatar = user.avatarUrl
    ? <img src={user.avatarUrl} alt={name} className="idc-avatar-img" />
    : <div className="idc-avatar-fallback">{name.slice(0, 1).toUpperCase()}</div>;

  return (
    <div className={`idc ${compact ? 'compact' : ''}`}>
      <div className="idc-head">
        <div className="idc-avatar">{avatar}</div>
        <div className="idc-id">
          <div className="idc-name">{name}</div>
          <div className="idc-role">{String(user.role || 'member').replace(/_/g, ' ')}</div>
        </div>
        <div className="idc-level" style={{ background: lv.soft, color: lv.ink, borderColor: lv.color }}>
          {lv.band}
        </div>
      </div>

      <div className="idc-rows">
        {solarisId && (
          <button className="idc-row" onClick={() => copy('sol', solarisId)} title="Copy your permanent Solaris ID">
            <Sun size={14} className="idc-row-ico" />
            <span className="idc-row-lbl">Solaris ID</span>
            <span className="idc-row-val mono">{truncMid(solarisId, 12, 4)}</span>
            <span className="idc-copy">{copied === 'sol' ? 'Copied' : ''}</span>
          </button>
        )}
        <button className="idc-row" onClick={() => copy('did', did)} title="Copy DID">
          <Fingerprint size={14} className="idc-row-ico" />
          <span className="idc-row-lbl">DID</span>
          <span className="idc-row-val">{truncMid(did, 16, 6)}</span>
          <span className="idc-copy">{copied === 'did' ? 'Copied' : ''}</span>
        </button>
        {hasKey ? (
          <button className="idc-row" onClick={() => copy('npub', npub)} title="Copy your Identity Key">
            <KeyRound size={14} className="idc-row-ico" />
            <span className="idc-row-lbl">Identity Key</span>
            <span className="idc-row-val mono">{truncMid(npub, 12, 6)}</span>
            <span
              role="button" tabIndex={0} className="idc-ik-info" aria-label="What is an Identity Key?"
              onClick={(e) => { e.stopPropagation(); setIkInfo(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setIkInfo(true); } }}
            ><Info size={12} /></span>
            <span className="idc-copy">{copied === 'npub' ? 'Copied' : ''}</span>
          </button>
        ) : (
          <button className="idc-row idc-row-action" onClick={openBind} title="Create your sovereign Identity Key">
            <KeyRound size={14} className="idc-row-ico" />
            <span className="idc-row-lbl">Identity Key</span>
            <span className="idc-row-val" style={{ color: 'var(--teal-d)', fontWeight: 600 }}>Set up your key</span>
            <span
              role="button" tabIndex={0} className="idc-ik-info" aria-label="What is an Identity Key?"
              onClick={(e) => { e.stopPropagation(); setIkInfo(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setIkInfo(true); } }}
            ><Info size={12} /></span>
          </button>
        )}
        {hasKey && identityKey.handle && (
          <button className="idc-row" onClick={() => copy('nip05', identityKey.nip05 || `${identityKey.handle}@solaris.health`)} title="Copy your Solaris handle (NIP-05)">
            <ShieldCheck size={14} className="idc-row-ico" />
            <span className="idc-row-lbl">Handle</span>
            <span className="idc-row-val">{identityKey.nip05 || `${identityKey.handle}@solaris.health`}</span>
            <span className="idc-copy">{copied === 'nip05' ? 'Copied' : ''}</span>
          </button>
        )}
      </div>

      <div className="idc-personas">
        <div className="idc-persona active">
          <User size={13} /> <span>Main persona</span>
          <span className="idc-persona-tag">active</span>
        </div>
        <div className="idc-persona">
          <VenetianMask size={13} /> <span>Anonymous persona</span>
          <span className="idc-persona-tag ghost">available</span>
        </div>
      </div>

      <div className="idc-custody">
        <ShieldCheck size={13} />
        <span>Key custody: <strong>{custody === 'self' ? 'Self-custody' : custody}</strong></span>
        <span className="idc-custody-via">via {createdVia}</span>
      </div>

      <button className="idc-export" onClick={exportData} disabled={exporting}>
        {exporting ? <Loader2 size={14} className="idc-spin" /> : <Download size={14} />}
        {exporting ? 'Preparing export…' : 'Export My Data'}
      </button>

      {ikInfo && <IdentityKeyInfo onClose={() => setIkInfo(false)} />}

      {/* ── Identity Key bind flow ── */}
      {bindOpen && gen && (
        <div className="idc-modal-backdrop" onClick={() => !bindBusy && setBindOpen(false)}>
          <div className="idc-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <button className="idc-modal-close" onClick={() => !bindBusy && setBindOpen(false)} aria-label="Close"><X size={18} /></button>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px', color: '#0A2B29', fontSize: '1.05rem' }}>
              <KeyRound size={18} color="#2DB584" /> Set up your Identity Key
              <span role="button" tabIndex={0} className="idc-ik-info" aria-label="What is an Identity Key?"
                onClick={() => setIkInfo(true)} onKeyDown={(e) => { if (e.key === 'Enter') setIkInfo(true); }}><Info size={12} /></span>
            </h3>
            <div className="idc-warn">
              <ShieldCheck size={15} /> Your secret key is never stored on Solaris. Write down this recovery phrase and keep it safe — it is the only way to restore your account.
            </div>
            <div className="idc-phrase">
              {gen.mnemonic.split(' ').map((w, i) => (<span key={i} className="idc-word"><b>{i + 1}</b>{w}</span>))}
            </div>
            <button className="idc-copy-btn" onClick={copyGen}>
              {genCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy phrase</>}
            </button>
            <div style={{ marginTop: 10 }}>
              <label className="idc-fld-lbl">Solaris handle <span style={{ opacity: 0.7 }}>(optional)</span></label>
              <div className="idc-handle-row">
                <input className="idc-input" value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value.replace(/[^a-z0-9._-]/gi, ''))}
                  placeholder="yourname" maxLength={32} />
                <span className="idc-handle-suffix">@solaris.health</span>
              </div>
            </div>
            <label className="idc-confirm">
              <input type="checkbox" checked={savedConfirmed} onChange={(e) => setSavedConfirmed(e.target.checked)} />
              I have safely written down my recovery phrase.
            </label>
            {bindErr && <p style={{ color: 'var(--error)', fontSize: '0.82rem', margin: '4px 0 0' }}>{bindErr}</p>}
            <button className="idc-bind-go" onClick={submitBind} disabled={!savedConfirmed || bindBusy}>
              {bindBusy ? 'Linking your key…' : 'Link my Identity Key'} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .luca .idc{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px}
        .luca .idc.compact{padding:14px}
        .luca .idc-head{display:flex;align-items:center;gap:11px}
        .luca .idc-avatar{width:44px;height:44px;flex:none}
        .luca .idc-avatar-img{width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--mint-line)}
        .luca .idc-avatar-fallback{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          background:var(--teal);color:#fff;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px}
        .luca .idc-id{flex:1;min-width:0}
        .luca .idc-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:var(--ink);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .luca .idc-role{font-size:11.5px;color:var(--muted);text-transform:capitalize}
        .luca .idc-level{flex:none;padding:3px 10px;border-radius:99px;border:1.5px solid;font-weight:700;
          font-size:11px;font-family:'Space Grotesk',sans-serif}
        .luca .idc-rows{margin-top:14px;display:flex;flex-direction:column;gap:2px}
        .luca .idc-row{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;border:none;
          padding:7px 6px;border-radius:var(--r-sm);cursor:pointer;color:var(--ink)}
        .luca .idc-row:hover{background:var(--surface-2)}
        .luca .idc-row-ico{color:var(--teal);flex:none}
        .luca .idc-row-lbl{font-size:12px;color:var(--muted);width:66px;flex:none}
        .luca .idc-row-val{font-size:12.5px;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .luca .idc-row-val.mono,.luca .mono{font-family:'IBM Plex Mono',monospace}
        .luca .idc-mock-tag{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
          background:#FBEFD3;color:#8A5F13;padding:2px 6px;border-radius:99px;flex:none}
        .luca .idc-copy{font-size:10px;color:var(--teal-d);width:44px;text-align:right;flex:none}
        .luca .idc-personas{margin-top:12px;display:flex;flex-direction:column;gap:6px}
        .luca .idc-persona{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ink);
          padding:7px 10px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--surface-2)}
        .luca .idc-persona.active{border-color:var(--mint-line);background:var(--mint-soft)}
        .luca .idc-persona svg{color:var(--teal)}
        .luca .idc-persona-tag{margin-left:auto;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
          color:var(--teal-d);background:#fff;padding:2px 7px;border-radius:99px}
        .luca .idc-persona-tag.ghost{color:var(--muted);background:var(--surface)}
        .luca .idc-custody{margin-top:12px;display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--muted);
          padding:9px 11px;border-radius:var(--r-sm);background:var(--mint-soft)}
        .luca .idc-custody svg{color:var(--teal-d);flex:none}
        .luca .idc-custody strong{color:var(--ink)}
        .luca .idc-custody-via{margin-left:auto;font-size:10.5px;opacity:.8}
        .luca .idc-export{margin-top:14px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;
          padding:10px;border-radius:var(--r-sm);border:1px solid var(--teal);background:var(--teal);color:#fff;
          font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;cursor:pointer;transition:background .15s}
        .luca .idc-export:hover:not(:disabled){background:var(--teal-d)}
        .luca .idc-export:disabled{opacity:.7;cursor:default}
        .luca .idc-spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .luca .idc-row-action:hover{background:var(--mint-soft)}
        .luca .idc-ik-info{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;flex:none;
          border-radius:99px;background:var(--mint-soft);color:var(--teal-d);cursor:pointer}
        .luca .idc-ik-info:hover{background:var(--mint-line)}
        .idc-modal-backdrop{position:fixed;inset:0;background:rgba(6,20,19,0.55);backdrop-filter:blur(3px);
          display:flex;align-items:center;justify-content:center;z-index:1000;padding:18px}
        .idc-modal{position:relative;background:#fff;border-radius:18px;max-width:420px;width:100%;
          padding:22px 20px;box-shadow:0 24px 60px rgba(6,20,19,0.35);max-height:88vh;overflow-y:auto}
        .idc-modal-close{position:absolute;top:12px;right:12px;background:none;border:none;cursor:pointer;color:#6b807a}
        .idc-warn{display:flex;gap:8px;align-items:flex-start;background:rgba(197,138,83,0.12);margin-top:12px;
          border:1px solid rgba(197,138,83,0.35);color:#8a5a2b;border-radius:10px;padding:10px 12px;font-size:0.8rem;line-height:1.45}
        .idc-phrase{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#f5f9f7;margin-top:12px;
          border:1px solid rgba(10,43,41,0.1);border-radius:12px;padding:12px}
        .idc-word{font-size:0.82rem;color:#0A2B29;font-family:monospace;display:flex;gap:5px;align-items:baseline}
        .idc-word b{color:#2DB584;font-size:0.68rem;min-width:15px}
        .idc-copy-btn{margin-top:8px;display:inline-flex;align-items:center;gap:6px;background:none;border:none;
          color:#2DB584;font-weight:600;font-size:0.82rem;cursor:pointer;padding:2px 0}
        .idc-fld-lbl{font-size:0.78rem;color:#6b807a;display:block;margin-bottom:5px}
        .idc-handle-row{display:flex;align-items:center;border:1px solid rgba(10,43,41,0.18);border-radius:10px;overflow:hidden}
        .idc-input{flex:1;border:none;padding:9px 11px;font-size:0.88rem;color:#0A2B29;outline:none;background:#fff;min-width:0}
        .idc-handle-suffix{padding:0 11px;color:#6b807a;font-size:0.82rem;background:#f5f9f7;align-self:stretch;display:flex;align-items:center}
        .idc-confirm{display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;color:#6b807a;cursor:pointer;line-height:1.4;margin-top:12px}
        .idc-confirm input{margin-top:2px}
        .idc-bind-go{margin-top:14px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;
          padding:11px;border-radius:12px;border:none;background:#2DB584;color:#fff;font-weight:600;font-size:0.9rem;cursor:pointer}
        .idc-bind-go:disabled{opacity:.55;cursor:default}
      `}</style>
    </div>
  );
}
