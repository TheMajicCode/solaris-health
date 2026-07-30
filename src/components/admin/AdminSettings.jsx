/**
 * AdminSettings.jsx — platform-level controls for the clinic admin.
 *
 * Sub-sections: Platform (environment + AI model info), Data protection (email &
 * PII masking status — reflects the de-identify-before-cloud invariant), and
 * Audit & retention (log retention preference). Read-mostly; toggles that would
 * change platform behaviour are clearly labelled and stored locally for the demo.
 */
import React, { useState, useEffect } from 'react';
import { Server, ShieldCheck, Archive, Check, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const C = {
  head: '#0A2B29', body: '#6b807a', green: '#2DB584', line: '#E3EDEA',
  greenSoft: '#E6F6F0', indigo: '#6B7FD7', amber: '#C58A53',
};

const SECTIONS = [
  { id: 'platform', label: 'Platform', icon: Server },
  { id: 'data', label: 'Data protection', icon: ShieldCheck },
  { id: 'audit', label: 'Audit & retention', icon: Archive },
];

const cardStyle = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, maxWidth: 560 };
const RETENTION_KEY = 'solaris_admin_retention';

function InfoRow({ label, value, tone = C.head }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderTop: `1px solid ${C.line}` }}>
      <div style={{ color: C.body, fontSize: 13 }}>{label}</div>
      <div style={{ color: tone, fontSize: 13.5, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function StatusPill({ ok, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: ok ? C.green : C.amber, background: ok ? C.greenSoft : '#FBF3EA', borderRadius: 999, padding: '3px 10px' }}>
      {ok && <Check size={12} />} {children}
    </span>
  );
}

export default function AdminSettings() {
  const [section, setSection] = useState('platform');
  const [retention, setRetention] = useState('365');

  useEffect(() => {
    try { const v = localStorage.getItem(RETENTION_KEY); if (v) setRetention(v); } catch { /* ignore */ }
  }, []);

  const saveRetention = (v) => {
    setRetention(v);
    try { localStorage.setItem(RETENTION_KEY, v); } catch { /* ignore */ }
    toast.success('Retention preference saved');
  };

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 180 }}>
        {SECTIONS.map((s) => {
          const Icon = s.icon; const active = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: active ? '#FBF3EA' : 'transparent', color: active ? C.head : C.body, fontWeight: active ? 700 : 500, fontSize: 13.5, fontFamily: 'inherit' }}>
              <Icon size={16} color={active ? C.amber : C.body} /> {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: '1 1 420px', minWidth: 0 }}>
        {section === 'platform' && (
          <div style={cardStyle}>
            <div style={{ color: C.head, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Platform</div>
            <InfoRow label="Environment" value="Demo / Sandbox" tone={C.amber} />
            <InfoRow label="AI model" value="gpt-5.4-mini" />
            <InfoRow label="AI role" value="Guide — never diagnoses" tone={C.green} />
            <InfoRow label="Payments" value="Wompi sandbox (simulated)" tone={C.amber} />
            <InfoRow label="GPS settlement" value="Shadow ledger (simulated)" tone={C.amber} />
          </div>
        )}

        {section === 'data' && (
          <div style={cardStyle}>
            <div style={{ color: C.head, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Data protection</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: C.greenSoft, borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#215B4E', margin: '8px 0 6px' }}>
              <Info size={15} color={C.green} style={{ marginTop: 1 }} />
              <span>Member data is de-identified before any cloud model sees it. These protections are enforced in code and cannot be disabled from this screen.</span>
            </div>
            <InfoRow label="Email masking in logs" value={<StatusPill ok>Enabled</StatusPill>} />
            <InfoRow label="PII de-identification (cloud AI)" value={<StatusPill ok>Enforced</StatusPill>} />
            <InfoRow label="Vault serializers" value={<StatusPill ok>Frozen (additive only)</StatusPill>} />
            <InfoRow label="Member data export" value={<StatusPill ok>One-click, self-serve</StatusPill>} />
          </div>
        )}

        {section === 'audit' && (
          <div style={cardStyle}>
            <div style={{ color: C.head, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Audit & retention</div>
            <div style={{ color: C.body, fontSize: 12.5, marginBottom: 12 }}>How long platform audit events are retained. Saved to this browser for the demo.</div>
            <label style={{ fontSize: 12.5, color: C.head, fontWeight: 600 }}>
              Audit log retention
              <select value={retention} onChange={(e) => saveRetention(e.target.value)}
                style={{ display: 'block', width: '100%', maxWidth: 260, marginTop: 5, padding: '9px 11px', borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13.5, color: C.head, fontFamily: 'inherit' }}>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
                <option value="1095">3 years</option>
              </select>
            </label>
            <div style={{ marginTop: 14 }}>
              <InfoRow label="Audit trail" value={<StatusPill ok>Append-only</StatusPill>} />
              <InfoRow label="System timeline" value="Available in System tab" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
