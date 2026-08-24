/*
 * SharingControls.jsx — NODE K1.3 §Phase 8 Privacy & Sharing UI.
 *
 * Two exports:
 *   <SharingDefaultsCard subjectId />         account-wide defaults (Settings)
 *   <BookingSharingSheet subjectId bookingId onClose />   per-booking override
 *
 * All state persists DEVICE-LOCAL via src/lib/sharingPrefs.js and is clearly
 * labeled "Saved on this device". Sharing is opt-in, itemized and revocable.
 * No PHI is ever read or written here — only booleans.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Smartphone, X, Check } from 'lucide-react';
import { useLocale } from '../lib/i18n/LocaleContext.jsx';
import {
  SHARING_CATEGORIES,
  loadSharingDefaults, saveSharingDefaults,
  loadBookingOverride, saveBookingOverride, clearBookingOverride,
} from '../lib/sharingPrefs.js';

function useTl() {
  const { t } = useLocale() || {};
  return (k, fallback) => { const v = t ? t(k) : null; return v && v !== k ? v : fallback; };
}

function ToggleRow({ cat, checked, onChange, tl }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', cursor: 'pointer' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink,#0B2E33)' }}>
          {tl(`share.cat.${cat.id}`, cat.label)}
        </span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted,#5a6b66)', marginTop: 2 }}>
          {tl(`share.cat.${cat.id}.hint`, cat.hint)}
        </span>
      </span>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!checked); } }}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        style={{
          flex: 'none', width: 42, height: 24, borderRadius: 999, marginTop: 2,
          background: checked ? 'linear-gradient(160deg,#7FD4B8,#1F6F63)' : '#cfe0d9',
          position: 'relative', transition: 'background .15s', cursor: 'pointer',
        }}
      >
        <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </span>
    </label>
  );
}

function DeviceNote({ tl }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted,#5a6b66)', marginTop: 4 }}>
      <Smartphone size={13} /> {tl('share.savedOnDevice', 'Saved on this device')}
    </div>
  );
}

/* Account-wide sharing defaults — rendered inside Settings → Privacy. */
export function SharingDefaultsCard({ subjectId }) {
  const tl = useTl();
  const [prefs, setPrefs] = useState(() => loadSharingDefaults(subjectId));
  const [saved, setSaved] = useState(false);

  useEffect(() => { setPrefs(loadSharingDefaults(subjectId)); }, [subjectId]);

  const toggle = (id, v) => { setPrefs((p) => ({ ...p, [id]: v })); setSaved(false); };
  const save = () => { saveSharingDefaults(subjectId, prefs); setSaved(true); };

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line,#e3ece8)', borderRadius: 16, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <ShieldCheck size={17} style={{ color: '#1F6F63' }} />
        <h4 style={{ margin: 0, fontSize: 15.5, color: 'var(--ink,#0B2E33)' }}>{tl('share.sectionTitle', 'Privacy & Sharing')}</h4>
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--muted,#5a6b66)' }}>{tl('share.sectionHint', 'Choose what you’re willing to share with your practitioners by default. Sharing is opt-in and you can change it any time.')}</p>
      <div style={{ borderTop: '1px solid var(--line,#eef3f1)' }}>
        {SHARING_CATEGORIES.map((cat) => (
          <ToggleRow key={cat.id} cat={cat} checked={!!prefs[cat.id]} onChange={(v) => toggle(cat.id, v)} tl={tl} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 }}>
        <DeviceNote tl={tl} />
        <button
          type="button" onClick={save}
          style={{ border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', color: '#fff', background: 'linear-gradient(160deg,#7FD4B8,#1F6F63)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {saved ? <><Check size={15} /> {tl('action.save', 'Save')}</> : tl('share.saveDefaults', 'Save sharing defaults')}
        </button>
      </div>
    </div>
  );
}

/* Per-booking override sheet — "What I share" for a single appointment. */
export function BookingSharingSheet({ subjectId, bookingId, onClose }) {
  const tl = useTl();
  const [override, setOverride] = useState(() => loadBookingOverride(subjectId, bookingId));
  const [prefs, setPrefs] = useState(() => loadBookingOverride(subjectId, bookingId) || loadSharingDefaults(subjectId));

  const usingDefaults = override == null;

  const toggle = (id, v) => { setPrefs((p) => ({ ...p, [id]: v })); };
  const save = useCallback(() => { saveBookingOverride(subjectId, bookingId, prefs); onClose?.(); }, [subjectId, bookingId, prefs, onClose]);
  const revert = () => { clearBookingOverride(subjectId, bookingId); setOverride(null); setPrefs(loadSharingDefaults(subjectId)); };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(6,26,24,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={tl('share.bookingOverrideTitle', 'What I share for this booking')}
        style={{ background: '#fff', width: 'min(520px, 100%)', maxHeight: '86dvh', overflowY: 'auto', borderRadius: '18px 18px 0 0', padding: 20, paddingBottom: 'calc(20px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h4 style={{ margin: 0, fontSize: 16, color: 'var(--ink,#0B2E33)' }}>{tl('share.bookingOverrideTitle', 'What I share for this booking')}</h4>
          <button type="button" aria-label={tl('action.close', 'Close')} onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted,#5a6b66)' }}><X size={20} /></button>
        </div>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--muted,#5a6b66)' }}>{tl('share.bookingOverrideHint', 'These choices apply to this appointment only and override your defaults.')}</p>
        {usingDefaults && (
          <div style={{ fontSize: 12.5, color: '#1F6F63', fontWeight: 600, marginBottom: 4 }}>{tl('share.usingDefaults', 'Using your account defaults')}</div>
        )}
        <div style={{ borderTop: '1px solid var(--line,#eef3f1)' }}>
          {SHARING_CATEGORIES.map((cat) => (
            <ToggleRow key={cat.id} cat={cat} checked={!!prefs[cat.id]} onChange={(v) => toggle(cat.id, v)} tl={tl} />
          ))}
        </div>
        <DeviceNote tl={tl} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {!usingDefaults && (
            <button type="button" onClick={revert} style={{ flex: '0 0 auto', border: '1px solid var(--line,#e3ece8)', background: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', color: 'var(--ink,#0B2E33)' }}>
              {tl('share.useDefaults', 'Use my defaults')}
            </button>
          )}
          <button type="button" onClick={save} style={{ flex: 1, border: 'none', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', color: '#fff', background: 'linear-gradient(160deg,#7FD4B8,#1F6F63)' }}>
            {tl('action.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SharingDefaultsCard;
