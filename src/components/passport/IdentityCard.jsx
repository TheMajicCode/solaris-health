/**
 * IdentityCard — the sovereign identity panel of the LUCA Passport.
 * Shows the member's name/avatar, decentralized identifier (DID), sovereign
 * Nostr key (mock), contribution level, personas (Main + Anonymous), key custody,
 * and a one-click "Export My Data" action. The member owns their identity.
 */
import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Fingerprint, Download, Loader2, User, VenetianMask } from 'lucide-react';
import { api } from '../../lib/api.js';
import { levelFor } from './levels.js';

const truncMid = (s, head = 12, tail = 6) => {
  if (!s) return '—';
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
};

export default function IdentityCard({ user, compact = false }) {
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState('');
  if (!user) return null;

  const name = user.displayName || user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member';
  const npub = user.nostrNpub || 'npub1mock…';
  const did = user.did || `did:solaris:${(user.id || 'mock')}`;
  const lv = levelFor(user.levelPoints);
  const custody = user.keyCustody || 'self';
  const createdVia = user.createdVia || 'email';

  const copy = async (label, val) => {
    try { await navigator.clipboard.writeText(val); setCopied(label); setTimeout(() => setCopied(''), 1400); } catch {}
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
        <button className="idc-row" onClick={() => copy('did', did)} title="Copy DID">
          <Fingerprint size={14} className="idc-row-ico" />
          <span className="idc-row-lbl">DID</span>
          <span className="idc-row-val">{truncMid(did, 16, 6)}</span>
          <span className="idc-copy">{copied === 'did' ? 'Copied' : ''}</span>
        </button>
        <button className="idc-row" onClick={() => copy('npub', npub)} title="Copy Nostr key">
          <KeyRound size={14} className="idc-row-ico" />
          <span className="idc-row-lbl">Nostr key</span>
          <span className="idc-row-val mono">{truncMid(npub, 12, 6)}</span>
          <span className="idc-mock-tag">mock</span>
          <span className="idc-copy">{copied === 'npub' ? 'Copied' : ''}</span>
        </button>
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
      `}</style>
    </div>
  );
}
