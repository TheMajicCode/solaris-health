/**
 * PractitionerSettings.jsx — the practitioner's account & practice settings.
 *
 * Sub-sections: Practice profile (name, bio, phone, city — persisted via
 * PATCH /api/users/me), Availability (embeds the weekly AvailabilityManager),
 * Notifications (local preferences), Payment (payout preference — simulated),
 * and Account (email + sign-out affordance). No dead ends: every control does
 * something real or is clearly labelled simulated.
 */
import React, { useState, useEffect } from 'react';
import { Loader2, User, CalendarCheck, Bell, CreditCard, Shield, Save, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { useApp } from '../../state/AppContext.jsx';
import AvailabilityManager from './AvailabilityManager.jsx';

const C = {
  head: '#0A2B29', body: '#6b807a', green: '#2DB584', line: '#E3EDEA',
  greenSoft: '#E6F6F0', indigo: '#6B7FD7', amber: '#C58A53',
};

const SECTIONS = [
  { id: 'profile', label: 'Practice profile', icon: User },
  { id: 'availability', label: 'Availability', icon: CalendarCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'account', label: 'Account', icon: Shield },
];

const inputStyle = { display: 'block', width: '100%', marginTop: 5, padding: '9px 11px', borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13.5, color: C.head, fontFamily: 'inherit', boxSizing: 'border-box' };
const labelStyle = { fontSize: 12.5, color: C.head, fontWeight: 600 };
const cardStyle = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, maxWidth: 560 };

function ToggleRow({ label, note, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderTop: `1px solid ${C.line}` }}>
      <div>
        <div style={{ color: C.head, fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        {note && <div style={{ color: C.body, fontSize: 12 }}>{note}</div>}
      </div>
      <button onClick={() => onChange(!checked)} role="switch" aria-checked={checked}
        style={{ width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: checked ? C.green : '#CBD8D3', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </button>
    </div>
  );
}

const NOTIF_KEY = 'solaris_prac_notify';

export default function PractitionerSettings() {
  const { user, refreshUser } = useApp();
  const [section, setSection] = useState('profile');
  const [form, setForm] = useState({ fullName: '', bio: '', phone: '', city: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notify, setNotify] = useState({ newBooking: true, reminders: true, messages: true, earnings: false });

  useEffect(() => {
    setForm({ fullName: user?.fullName || '', bio: user?.bio || '', phone: user?.phone || '', city: user?.city || '' });
  }, [user]);
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(NOTIF_KEY) || 'null'); if (s) setNotify((n) => ({ ...n, ...s })); } catch { /* ignore */ }
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateMe({ fullName: form.fullName, bio: form.bio, phone: form.phone, city: form.city });
      toast.success('Practice profile saved');
      setSaved(true);
      refreshUser?.();
    } catch (err) { toast.error('Could not save. Please try again.'); }
    finally { setSaving(false); }
  };

  const setNotifKey = (k, v) => {
    setNotify((prev) => { const next = { ...prev, [k]: v }; try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch { /* ignore */ } return next; });
    toast.success('Preference saved');
  };

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <style>{'@keyframes psspin{to{transform:rotate(360deg)}} .psspin{animation:psspin 1s linear infinite}'}</style>
      {/* Section nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 180 }}>
        {SECTIONS.map((s) => {
          const Icon = s.icon; const active = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: active ? C.greenSoft : 'transparent', color: active ? C.head : C.body, fontWeight: active ? 700 : 500, fontSize: 13.5, fontFamily: 'inherit' }}>
              <Icon size={16} color={active ? C.green : C.body} /> {s.label}
            </button>
          );
        })}
      </div>

      {/* Section body */}
      <div style={{ flex: '1 1 420px', minWidth: 0 }}>
        {section === 'profile' && (
          <form onSubmit={saveProfile} style={cardStyle}>
            <div style={{ color: C.head, fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Practice profile</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={labelStyle}>Display name
                <input value={form.fullName} onChange={(e) => { setForm((f) => ({ ...f, fullName: e.target.value })); setSaved(false); }} style={inputStyle} />
              </label>
              <label style={labelStyle}>Bio
                <textarea value={form.bio} onChange={(e) => { setForm((f) => ({ ...f, bio: e.target.value })); setSaved(false); }} rows={3} placeholder="How you introduce your practice to members" style={{ ...inputStyle, resize: 'vertical' }} />
              </label>
              <label style={labelStyle}>Phone
                <input value={form.phone} onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); setSaved(false); }} style={inputStyle} />
              </label>
              <label style={labelStyle}>City
                <input value={form.city} onChange={(e) => { setForm((f) => ({ ...f, city: e.target.value })); setSaved(false); }} style={inputStyle} />
              </label>
              <button type="submit" disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: saving ? 'default' : 'pointer', background: saved ? C.indigo : C.green, color: '#fff', fontWeight: 600, fontSize: 13.5, alignSelf: 'flex-start', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={15} className="psspin" /> : saved ? <Check size={15} /> : <Save size={15} />}
                {saving ? 'Saving…' : saved ? 'Saved' : 'Save profile'}
              </button>
            </div>
          </form>
        )}

        {section === 'availability' && (
          <div>
            <div style={{ color: C.body, fontSize: 13, marginBottom: 14 }}>Set the weekly hours members can book. Booked hours are locked so a visit can never be removed.</div>
            <AvailabilityManager />
          </div>
        )}

        {section === 'notifications' && (
          <div style={cardStyle}>
            <div style={{ color: C.head, fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Notifications</div>
            <div style={{ color: C.body, fontSize: 12.5, marginBottom: 6 }}>Choose what reaches you. Saved to this browser.</div>
            <ToggleRow label="New booking requests" note="When a member requests a visit" checked={notify.newBooking} onChange={(v) => setNotifKey('newBooking', v)} />
            <ToggleRow label="Appointment reminders" note="Before an upcoming visit" checked={notify.reminders} onChange={(v) => setNotifKey('reminders', v)} />
            <ToggleRow label="Secure messages" note="When a member messages you" checked={notify.messages} onChange={(v) => setNotifKey('messages', v)} />
            <ToggleRow label="Earnings summaries" note="Periodic GPS earnings digest" checked={notify.earnings} onChange={(v) => setNotifKey('earnings', v)} />
          </div>
        )}

        {section === 'payment' && (
          <div style={cardStyle}>
            <div style={{ color: C.head, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Payment</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FBF3EA', border: `1px solid ${C.amber}44`, color: '#7A5A34', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginTop: 8 }}>
              <CreditCard size={15} color={C.amber} />
              <span>Payout methods and simulated earnings live in the <strong>Finance</strong> tab. Live payouts are coming soon.</span>
            </div>
          </div>
        )}

        {section === 'account' && (
          <div style={cardStyle}>
            <div style={{ color: C.head, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Account</div>
            <div style={{ fontSize: 12.5, color: C.body }}>Email</div>
            <div style={{ fontSize: 14, color: C.head, fontWeight: 600, marginBottom: 14 }}>{user?.email || '—'}</div>
            <div style={{ fontSize: 12.5, color: C.body }}>Role</div>
            <div style={{ fontSize: 14, color: C.head, fontWeight: 600 }}>Practitioner</div>
            <div style={{ marginTop: 16, fontSize: 12.5, color: C.body }}>To change your email or delete your account, contact Solaris support. Sign out from the account menu in the sidebar.</div>
          </div>
        )}
      </div>
    </div>
  );
}
