/**
 * ClinicOSFoundation — NODE H "Clinic OS — Beta foundation".
 *
 * SCOPE GUARD: this is the My Practice / Clinic OS FOUNDATION only — NOT a full
 * ERP/EHR/billing system. It collects NON-SENSITIVE organisation metadata
 * (practice name, type, city, short description) tied to an approved
 * practitioner, shows a "Pending review" state, and renders a clearly-labelled
 * SIMULATED preview of the future clinic workspace. It performs NO activation,
 * grants NO entitlements, and creates NO tenants.
 *
 * Tenancy / RBAC are incomplete, so there is no shared-DB write here. The future
 * additive persistence contract lives in migrations/040_journey_pipeline.sql
 * (clinic_os_orgs table) — COMMITTED, NOT APPLIED. This surface stages the org
 * metadata locally only, behind VITE_CLINIC_OS_BETA.
 */
import React, { useState } from 'react';
import { Building2, ShieldCheck, Clock, Info, Layers, Lock } from 'lucide-react';

const FLAG = import.meta.env.VITE_CLINIC_OS_BETA === 'true';
const ORG_TYPES = ['Solo practice', 'Group practice', 'Wellness studio', 'Clinic', 'Other'];

// NON-SENSITIVE metadata only. No licence numbers, no PHI, no financial data.
export default function ClinicOSFoundation({ user }) {
  const [org, setOrg] = useState({ name: '', type: ORG_TYPES[0], city: '', about: '' });
  const [staged, setStaged] = useState(false);

  const approved = user?.role === 'practitioner' || user?.isProvider === true;

  if (!FLAG) {
    return (
      <div style={{ padding: 18, border: '1px dashed var(--line,#e3ece8)', borderRadius: 12, textAlign: 'center' }}>
        <Building2 size={18} className="muted" />
        <div className="tiny muted" style={{ marginTop: 6 }}>Clinic OS is a Beta foundation. It becomes available once the Clinic OS Beta preview is enabled.</div>
      </div>
    );
  }

  if (!approved) {
    return (
      <div style={{ padding: 18, border: '1px solid var(--line,#e3ece8)', borderRadius: 12 }}>
        <div className="tiny muted"><Lock size={14} /> Clinic OS is available to approved practitioners. Complete Join Solaris to unlock the Beta foundation.</div>
      </div>
    );
  }

  return (
    <div data-testid="clinic-os-foundation">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Building2 size={17} /> Clinic OS — Beta foundation
        </h3>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#8a6d3b', background: '#fbf3df', border: '1px solid #ecd9a6', borderRadius: 999, padding: '2px 9px' }}>Beta preview · Simulated</span>
      </div>
      <p className="tiny muted" style={{ marginTop: 0 }}>
        Foundation only — organisation basics linked to your approved practitioner profile. No activation, tenants, or entitlements yet.
      </p>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#8a6d3b', background: '#fbf3df', border: '1px solid #ecd9a6', borderRadius: 999, padding: '4px 11px', margin: '4px 0 12px' }}>
        <Clock size={13} /> Pending review
      </div>

      {/* NON-SENSITIVE metadata form */}
      <div style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="tiny" style={{ fontWeight: 700 }}>Practice name</span>
          <input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} placeholder="e.g. Sunrise Wellness" style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="tiny" style={{ fontWeight: 700 }}>Practice type</span>
          <select value={org.type} onChange={(e) => setOrg({ ...org, type: e.target.value })} style={inputStyle}>
            {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="tiny" style={{ fontWeight: 700 }}>City</span>
          <input value={org.city} onChange={(e) => setOrg({ ...org, city: e.target.value })} placeholder="City" style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="tiny" style={{ fontWeight: 700 }}>About (non-sensitive)</span>
          <textarea value={org.about} onChange={(e) => setOrg({ ...org, about: e.target.value })} rows={3} placeholder="A short, public description of your practice." style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
        <div className="tiny muted"><Info size={13} /> Do not enter licence numbers, patient data, or financial details here.</div>
        <div>
          <button type="button" onClick={() => setStaged(true)} style={{ cursor: 'pointer', border: 'none', background: '#2DB584', color: '#04231d', fontWeight: 700, borderRadius: 10, padding: '9px 14px' }}>
            Save to Beta preview
          </button>
          {staged && <span className="tiny" style={{ marginLeft: 10, color: '#3B8C6E' }}><ShieldCheck size={13} /> Saved to this preview only — not published.</span>}
        </div>
      </div>

      {/* Simulated future workspace preview — clearly labelled, non-interactive. */}
      <div style={{ marginTop: 18 }}>
        <div className="tiny" style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Layers size={14} /> Future workspace (preview)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginTop: 8, opacity: .7 }}>
          {['Team & roles', 'Rooms & resources', 'Shared templates', 'Org analytics'].map((f) => (
            <div key={f} style={{ border: '1px dashed var(--line,#e3ece8)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
              <div className="tiny" style={{ fontWeight: 700 }}>{f}</div>
              <div className="tiny muted" style={{ marginTop: 3 }}>Coming in Clinic OS</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle = { border: '1px solid var(--line,#e3ece8)', borderRadius: 10, padding: '9px 11px', fontSize: 13.5, outline: 'none', width: '100%', background: '#fff' };
