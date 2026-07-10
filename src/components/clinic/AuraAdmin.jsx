/**
 * AuraAdmin — the clinic-node operations console (Aura Dental).
 * Stat row (appointments, simulated payments, GPS treasury), today's
 * appointment schedule, an AI-assisted follow-up queue (draft → approve →
 * send), and the node's GPS treasury view. Everything is simulated.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Wallet, Landmark, Loader2, Sparkles, Check, Send, PencilLine, Clock,
} from 'lucide-react';
import { api } from '../../lib/api.js';

const fmtSats = (n) => `${(Number(n) || 0).toLocaleString()} sats`;
const fmtTime = (d) => { try { return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ''; } };

export default function AuraAdmin({ orgId }) {
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({}); // id -> action in flight
  const [drafts, setDrafts] = useState({}); // id -> editable draft text

  const load = async () => {
    setLoading(true);
    try {
      const params = orgId ? { orgId } : {};
      const [ap, pm] = await Promise.all([
        api.getAppointments(params).catch(() => ({ appointments: [] })),
        api.getMyPayments().catch(() => ({ payments: [] })),
      ]);
      setAppointments(ap.appointments || []);
      setPayments(pm.payments || []);
      try { const t = await api.getGpsTreasury(); setTreasury(t); } catch { setTreasury(null); }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [orgId]);

  const runFollowUp = async (id, action) => {
    setBusy((b) => ({ ...b, [id]: action }));
    try {
      const draft = action === 'approve' ? drafts[id] : undefined;
      const r = await api.followUp(id, action, draft);
      setAppointments((list) => list.map((a) => (a.id === id ? r.appointment : a)));
      if (r.appointment?.followUpDraft && action === 'draft') {
        setDrafts((d) => ({ ...d, [id]: r.appointment.followUpDraft }));
      }
    } catch {}
    finally { setBusy((b) => ({ ...b, [id]: null })); }
  };

  const stats = useMemo(() => {
    const paidSats = payments.reduce((s, p) => s + (Number(p.amountSats) || 0), 0);
    return {
      appts: appointments.length,
      pending: appointments.filter((a) => (a.followUpStatus && a.followUpStatus !== 'sent')).length,
      paidSats,
      payments: payments.length,
    };
  }, [appointments, payments]);

  const treasurySats = treasury?.balanceSats ?? treasury?.balance ?? treasury?.totalSats ?? null;

  if (loading) return <div className="aura-loading"><Loader2 size={20} className="aura-spin" /> Loading clinic console…</div>;

  return (
    <div className="aura">
      <div className="aura-stats">
        <StatCard icon={CalendarDays} tone="teal" label="Appointments" value={stats.appts} sub={`${stats.pending} follow-ups pending`} />
        <StatCard icon={Wallet} tone="gold" label="Payments (simulated)" value={fmtSats(stats.paidSats)} sub={`${stats.payments} transactions`} />
        <StatCard icon={Landmark} tone="violet" label="GPS treasury" value={treasurySats != null ? fmtSats(treasurySats) : '—'} sub="community commons (simulated)" />
      </div>

      <div className="aura-section">
        <div className="aura-section-h"><CalendarDays size={15} /> Today's appointments</div>
        {appointments.length === 0 ? (
          <div className="aura-empty">No appointments scheduled.</div>
        ) : (
          <table className="aura-table">
            <thead><tr><th>Time</th><th>Patient</th><th>Treatment</th><th>Practitioner</th><th>Status</th></tr></thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td className="aura-time"><Clock size={12} /> {fmtTime(a.scheduledAt)}<span className="aura-date">{fmtDate(a.scheduledAt)}</span></td>
                  <td>{a.patientName || '—'}</td>
                  <td>{a.title || '—'}</td>
                  <td className="aura-muted">{a.practitionerName || '—'}</td>
                  <td><span className={`aura-status ${a.status}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="aura-section">
        <div className="aura-section-h"><Sparkles size={15} /> Follow-up queue <span className="aura-ai-tag">AI-assisted</span></div>
        <p className="aura-section-sub">Draft a follow-up, review &amp; approve it, then send. Nothing is sent without a human approving.</p>
        <div className="aura-followups">
          {appointments.map((a) => {
            const fs = a.followUpStatus || 'none';
            const inFlight = busy[a.id];
            return (
              <div className="aura-fu" key={a.id}>
                <div className="aura-fu-head">
                  <div className="aura-fu-who">
                    <span className="aura-fu-name">{a.patientName || 'Patient'}</span>
                    <span className="aura-fu-title">{a.title || 'Visit'} · {fmtDate(a.scheduledAt)}</span>
                  </div>
                  <span className={`aura-fu-stage ${fs}`}>{fs === 'none' ? 'no draft' : fs}</span>
                </div>

                {(a.followUpDraft || drafts[a.id]) && fs !== 'sent' && (
                  <textarea
                    className="aura-fu-draft"
                    value={drafts[a.id] ?? a.followUpDraft ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                    rows={3}
                  />
                )}
                {fs === 'sent' && a.followUpDraft && <div className="aura-fu-sent-msg">"{a.followUpDraft}"</div>}

                <div className="aura-fu-actions">
                  {fs === 'sent' ? (
                    <span className="aura-fu-done"><Check size={13} /> Sent</span>
                  ) : (
                    <>
                      <button className="aura-fu-btn" disabled={!!inFlight} onClick={() => runFollowUp(a.id, 'draft')}>
                        {inFlight === 'draft' ? <Loader2 size={12} className="aura-spin" /> : <PencilLine size={12} />} Draft
                      </button>
                      <button className="aura-fu-btn" disabled={!!inFlight || !(drafts[a.id] || a.followUpDraft)} onClick={() => runFollowUp(a.id, 'approve')}>
                        {inFlight === 'approve' ? <Loader2 size={12} className="aura-spin" /> : <Check size={12} />} Approve
                      </button>
                      <button className="aura-fu-btn primary" disabled={!!inFlight || fs !== 'approved'} onClick={() => runFollowUp(a.id, 'send')}>
                        {inFlight === 'send' ? <Loader2 size={12} className="aura-spin" /> : <Send size={12} />} Send
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {appointments.length === 0 && <div className="aura-empty">No follow-ups in the queue.</div>}
        </div>
      </div>

      <div className="aura-section">
        <div className="aura-section-h"><Landmark size={15} /> GPS treasury</div>
        <div className="aura-treasury">
          <div className="aura-treasury-main">
            <div className="aura-treasury-val">{treasurySats != null ? fmtSats(treasurySats) : '—'}</div>
            <div className="aura-treasury-lbl">Community commons balance <span className="aura-sim">(simulated)</span></div>
          </div>
          <p className="aura-treasury-note">
            A share of every payment routed through this node flows to the local community treasury —
            funding care for those who can't yet pay. Ratios are set by the node's GPS split policy.
          </p>
        </div>
      </div>

      <style>{`
        .luca .aura-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px}
        @media(max-width:760px){.luca .aura-stats{grid-template-columns:1fr}}
        .luca .aura-stat{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px}
        .luca .aura-stat-ico{width:34px;height:34px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;margin-bottom:11px}
        .luca .aura-stat-ico.teal{background:var(--mint-soft);color:var(--teal-d)}
        .luca .aura-stat-ico.gold{background:#FBEFD3;color:#8A5F13}
        .luca .aura-stat-ico.violet{background:#EDE6FA;color:#4E3785}
        .luca .aura-stat-val{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;color:var(--ink);line-height:1.1}
        .luca .aura-stat-lbl{font-size:12px;color:var(--muted);margin-top:4px}
        .luca .aura-stat-sub{font-size:11px;color:var(--muted-2);margin-top:2px}
        .luca .aura-section{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px;margin-bottom:18px}
        .luca .aura-section-h{display:flex;align-items:center;gap:8px;font-family:'Space Grotesk',sans-serif;font-weight:700;
          font-size:15px;color:var(--ink)}
        .luca .aura-section-h svg{color:var(--teal)}
        .luca .aura-ai-tag{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:#EDE6FA;color:#4E3785;
          padding:2px 8px;border-radius:99px;margin-left:2px}
        .luca .aura-section-sub{font-size:12.5px;color:var(--muted);margin:6px 0 14px}
        .luca .aura-table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:12px}
        .luca .aura-table th{text-align:left;padding:9px 12px;font-size:10.5px;font-weight:700;text-transform:uppercase;
          letter-spacing:.04em;color:var(--muted);background:var(--surface-2);border-bottom:1px solid var(--line)}
        .luca .aura-table td{padding:10px 12px;border-bottom:1px solid var(--line);color:var(--ink)}
        .luca .aura-table tr:last-child td{border-bottom:none}
        .luca .aura-time{display:flex;align-items:center;gap:5px;font-weight:600;color:var(--ink)}
        .luca .aura-date{margin-left:4px;font-weight:400;font-size:11px;color:var(--muted)}
        .luca .aura-muted{color:var(--muted)}
        .luca .aura-status{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:99px}
        .luca .aura-status.scheduled,.luca .aura-status.confirmed{background:var(--mint-soft);color:var(--teal-d)}
        .luca .aura-status.completed{background:#EDE6FA;color:#4E3785}
        .luca .aura-status.cancelled{background:#FBE7E7;color:#B23B3B}
        .luca .aura-followups{display:flex;flex-direction:column;gap:12px}
        .luca .aura-fu{border:1px solid var(--line);border-radius:var(--r-sm);padding:13px}
        .luca .aura-fu-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .luca .aura-fu-who{display:flex;flex-direction:column}
        .luca .aura-fu-name{font-weight:700;font-size:13.5px;color:var(--ink)}
        .luca .aura-fu-title{font-size:11.5px;color:var(--muted)}
        .luca .aura-fu-stage{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:3px 9px;border-radius:99px;
          background:var(--surface-2);color:var(--muted)}
        .luca .aura-fu-stage.drafted{background:#FBEFD3;color:#8A5F13}
        .luca .aura-fu-stage.approved{background:#E4EEFB;color:#2C568F}
        .luca .aura-fu-stage.sent{background:var(--mint-soft);color:var(--teal-d)}
        .luca .aura-fu-draft{width:100%;margin-top:10px;padding:9px 11px;border:1px solid var(--line);border-radius:var(--r-sm);
          font-family:'IBM Plex Sans',sans-serif;font-size:12.5px;color:var(--ink);resize:vertical;background:var(--surface-2)}
        .luca .aura-fu-draft:focus{outline:none;border-color:var(--teal);background:var(--surface)}
        .luca .aura-fu-sent-msg{margin-top:10px;font-size:12.5px;font-style:italic;color:var(--muted);
          background:var(--mint-soft);padding:9px 11px;border-radius:var(--r-sm)}
        .luca .aura-fu-actions{display:flex;gap:7px;margin-top:11px}
        .luca .aura-fu-done{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--teal-d)}
        .luca .aura-fu-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border:1px solid var(--line);
          border-radius:99px;background:var(--surface);color:var(--ink);font-weight:600;font-size:11.5px;cursor:pointer}
        .luca .aura-fu-btn:hover:not(:disabled){border-color:var(--teal)}
        .luca .aura-fu-btn.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
        .luca .aura-fu-btn:disabled{opacity:.45;cursor:default}
        .luca .aura-treasury{display:flex;gap:20px;align-items:center;margin-top:12px}
        @media(max-width:640px){.luca .aura-treasury{flex-direction:column;align-items:flex-start}}
        .luca .aura-treasury-main{flex:none}
        .luca .aura-treasury-val{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:28px;color:var(--ink)}
        .luca .aura-treasury-lbl{font-size:12px;color:var(--muted);margin-top:3px}
        .luca .aura-sim{font-style:italic}
        .luca .aura-treasury-note{font-size:12.5px;color:var(--muted);line-height:1.55;margin:0}
        .luca .aura-empty{padding:22px;text-align:center;color:var(--muted);font-size:13px}
        .luca .aura-loading{padding:40px;display:flex;align-items:center;justify-content:center;gap:9px;color:var(--muted)}
        .luca .aura-spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

function StatCard({ icon: Icon, tone, label, value, sub }) {
  return (
    <div className="aura-stat">
      <div className={`aura-stat-ico ${tone}`}><Icon size={17} /></div>
      <div className="aura-stat-val">{value}</div>
      <div className="aura-stat-lbl">{label}</div>
      <div className="aura-stat-sub">{sub}</div>
    </div>
  );
}
