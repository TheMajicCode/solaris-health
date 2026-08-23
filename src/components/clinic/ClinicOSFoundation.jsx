/**
 * ClinicOSFoundation — NODE H "Clinic OS" (informational preview).
 *
 * SCOPE GUARD (RC1 item8): this surface is INFORMATIONAL ONLY. It is NOT an
 * ERP/EHR/billing system, and — unlike an earlier draft — it no longer collects
 * or stages ANY organisation metadata. It creates NO orgs, NO tenants, NO
 * memberships, NO entitlements, and NO approval records (not even locally), and
 * performs NO shared-DB write. It simply explains that Clinic OS is coming later
 * and that a SEPARATE verification will be required, and shows a clearly-labelled
 * SIMULATED preview of the future clinic workspace.
 *
 * The future additive persistence contract lives in
 * migrations/040_journey_pipeline.sql (clinic_os_orgs table) — COMMITTED, NOT
 * APPLIED. Nothing on this surface depends on it. Gated behind VITE_CLINIC_OS_BETA.
 */
import React from 'react';
import { Building2, Clock, Info, Layers, Lock, ShieldCheck } from 'lucide-react';

const FLAG = import.meta.env.VITE_CLINIC_OS_BETA === 'true';

// What a real Clinic OS activation will require BEFORE any org/tenant exists.
// Documented here so the boundary is explicit; none of this is implemented yet.
const REAL_REQUIREMENTS = [
  'Multi-tenant data model with row-level isolation per organisation',
  'Role-based access control (owner / admin / clinician / staff) and audited memberships',
  'Separate practitioner + organisation verification (identity, licensure, ownership)',
  'Entitlement / billing model governing which features an org may use',
  'Applied database migration (clinic_os_orgs and related tables — 040 is committed, NOT applied)',
  'Security, privacy, and compliance review before any real patient/clinic data is stored',
];

export default function ClinicOSFoundation({ user }) {
  const approved = user?.role === 'practitioner' || user?.isProvider === true;

  if (!FLAG) {
    return (
      <div style={{ padding: 18, border: '1px dashed var(--line,#e3ece8)', borderRadius: 12, textAlign: 'center' }}>
        <Building2 size={18} className="muted" />
        <div className="tiny muted" style={{ marginTop: 6 }}>Clinic OS is coming later. It becomes visible once the Clinic OS preview is enabled.</div>
      </div>
    );
  }

  if (!approved) {
    return (
      <div style={{ padding: 18, border: '1px solid var(--line,#e3ece8)', borderRadius: 12 }}>
        <div className="tiny muted"><Lock size={14} /> Clinic OS information is shown to approved practitioners. Complete Join Solaris to view it.</div>
      </div>
    );
  }

  return (
    <div data-testid="clinic-os-foundation">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Building2 size={17} /> Clinic OS
        </h3>
        <span data-testid="clinic-os-preview-badge" style={{ fontSize: 11, fontWeight: 700, color: '#8a6d3b', background: '#fbf3df', border: '1px solid #ecd9a6', borderRadius: 999, padding: '2px 9px' }}>Simulated Preview · Informational</span>
      </div>

      {/* RC1 item8 — required boundary copy. */}
      <p data-testid="clinic-os-coming-later" style={{ marginTop: 0, fontSize: 13.5, fontWeight: 600 }}>
        Clinic OS — coming later; separate verification required.
      </p>
      <p className="tiny muted" style={{ marginTop: 2 }}>
        This is an informational preview only. It does not create an organisation, tenant,
        membership, entitlement, or approval record, and nothing here is saved to any server.
      </p>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#8a6d3b', background: '#fbf3df', border: '1px solid #ecd9a6', borderRadius: 999, padding: '4px 11px', margin: '8px 0 4px' }}>
        <Clock size={13} /> Not yet available
      </div>

      {/* What a real Clinic OS will require — documented, not implemented. */}
      <div style={{ marginTop: 12 }}>
        <div className="tiny" style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} /> What real Clinic OS will require
        </div>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {REAL_REQUIREMENTS.map((r) => (
            <li key={r} className="tiny muted" style={{ marginBottom: 4 }}>{r}</li>
          ))}
        </ul>
        <div className="tiny muted" style={{ marginTop: 8 }}>
          <Info size={13} /> When Clinic OS is built, setting up an organisation will be a
          distinct, separately-verified step — not an automatic result of practitioner approval.
        </div>
      </div>

      {/* Simulated future workspace preview — clearly labelled, non-interactive. */}
      <div style={{ marginTop: 18 }}>
        <div className="tiny" style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Layers size={14} /> Future workspace (simulated preview)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginTop: 8, opacity: .6 }}>
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
