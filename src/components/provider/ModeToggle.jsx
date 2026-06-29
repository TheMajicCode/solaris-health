/**
 * ModeToggle — Airbnb-style pill that switches a unified account between
 * Patient and Provider mode. Only shown to approved providers.
 *
 * Props:
 *   user      current user (expects isProvider, providerMode)
 *   onToggle  (mode:'patient'|'provider') => Promise   — performs the switch
 */
import React, { useState } from 'react';
import { User, Briefcase, Loader2 } from 'lucide-react';

export default function ModeToggle({ user, onToggle }) {
  const [busy, setBusy] = useState(false);
  if (!user?.isProvider) return null;

  const provider = user.providerMode === true;

  const switchTo = async (mode) => {
    if (busy) return;
    if ((mode === 'provider') === provider) return; // already there
    setBusy(true);
    try { await onToggle?.(mode); } finally { setBusy(false); }
  };

  return (
    <div className={`mt ${busy ? 'busy' : ''}`} role="group" aria-label="Account mode">
      <span className="mt-thumb" style={{ transform: provider ? 'translateX(100%)' : 'none' }} />
      <button className={`mt-opt ${!provider ? 'on' : ''}`} onClick={() => switchTo('patient')} disabled={busy}>
        <User size={14} /> <span>Patient</span>
      </button>
      <button className={`mt-opt ${provider ? 'on' : ''}`} onClick={() => switchTo('provider')} disabled={busy}>
        {busy ? <Loader2 size={14} className="mt-spin" /> : <Briefcase size={14} />} <span>Provider</span>
      </button>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .mt{position:relative;display:inline-flex;align-items:center;background:var(--surface-2);
  border:1px solid var(--line);border-radius:999px;padding:3px;gap:2px}
.luca .mt-thumb{position:absolute;top:3px;left:3px;width:calc(50% - 3px);height:calc(100% - 6px);
  background:var(--teal-d);border-radius:999px;transition:transform .22s cubic-bezier(.4,0,.2,1);box-shadow:var(--shadow-sm)}
.luca .mt-opt{position:relative;z-index:1;display:inline-flex;align-items:center;gap:5px;border:none;background:none;
  cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--muted-2);padding:6px 14px;border-radius:999px;white-space:nowrap;transition:color .2s}
.luca .mt-opt.on{color:#fff}
.luca .mt-opt:disabled{cursor:default}
.luca .mt.busy{opacity:.85}
.luca .mt-spin{animation:mtspin 1s linear infinite}
@keyframes mtspin{to{transform:rotate(360deg)}}
@media(max-width:680px){.luca .mt-opt span{display:none}.luca .mt-opt{padding:7px 12px}}
`;
