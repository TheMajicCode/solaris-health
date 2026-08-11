/**
 * AdminFinance.jsx — platform finance reconciliation + GPS settlement queue.
 *
 * Two panels:
 *  1. Reconciliation — every simulated payment intent on the platform,
 *     with the member and provider it belongs to. Read-only.
 *  2. GPS settlement queue — the shadow receipts awaiting settlement. The admin
 *     can "Mark as settled" to demonstrate the settlement flow.
 *
 * Everything is SIMULATED — no real money moves. Backend: GET /api/admin/finance,
 * GET /api/admin/gps-settlements, PATCH /api/admin/gps-settlements/:id.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Info, DollarSign, Sprout, Check, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';

const C = {
  head: '#0A2B29', body: '#6b807a', green: '#2DB584', line: '#E3EDEA',
  greenSoft: '#E6F6F0', indigo: '#6B7FD7', amber: '#C58A53',
};
const usd = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return '—'; } };

const STATUS_TONE = {
  paid: C.green, approved: C.green, created: C.body, pending: C.amber, failed: '#B23B3B',
};

function StatCard({ icon: Icon, label, value, tone = C.green, note }) {
  return (
    <div style={{ flex: '1 1 200px', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.body, fontSize: 12.5, fontWeight: 600 }}>
        <Icon size={15} color={tone} /> {label}
      </div>
      <div style={{ color: C.head, fontSize: 24, fontWeight: 800, marginTop: 6 }}>{value}</div>
      {note && <div style={{ color: C.body, fontSize: 11.5, marginTop: 3 }}>{note}</div>}
    </div>
  );
}

export default function AdminFinance() {
  const [fin, setFin] = useState(null);
  const [settle, setSettle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [f, s] = await Promise.all([
        api.getAdminFinance().catch(() => ({ intents: [], totalUsd: 0, paidUsd: 0 })),
        api.getAdminGpsSettlements().catch(() => ({ receipts: [], pending: 0, envelopeUsd: 0 })),
      ]);
      setFin(f); setSettle(s);
    } catch (e) {
      setErr('Could not load finance data. Please try again.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const markSettled = async (id) => {
    setBusyId(id);
    try {
      await api.settleGpsReceipt(id, 'SETTLED');
      setSettle((prev) => ({
        ...prev,
        receipts: (prev.receipts || []).map((r) => (r.id === id ? { ...r, settlementState: 'SETTLED' } : r)),
        pending: Math.max(0, (prev.pending || 0) - 1),
      }));
      toast.success('Marked as settled (simulated)');
    } catch (e) {
      toast.error('Could not update. Please try again.');
    } finally { setBusyId(null); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.body, padding: 40 }}>
        <style>{'@keyframes afspin{to{transform:rotate(360deg)}} .afspin{animation:afspin 1s linear infinite}'}</style>
        <Loader2 size={18} className="afspin" /> Loading finance…
      </div>
    );
  }

  const intents = fin?.intents || [];
  const receipts = settle?.receipts || [];

  return (
    <div style={{ maxWidth: 1000 }}>
      <style>{'@keyframes afspin{to{transform:rotate(360deg)}} .afspin{animation:afspin 1s linear infinite}'}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FBF3EA', border: `1px solid ${C.amber}44`, color: '#7A5A34', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
        <Info size={15} color={C.amber} />
        <span><strong>Simulated finance.</strong> Online payment is disabled this release; GPS settlement is a shadow ledger — no real money moves.</span>
      </div>

      {err && <div style={{ background: '#FDECEC', color: '#B23B3B', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard icon={DollarSign} label="Total processed" value={usd(fin?.totalUsd)} tone={C.green} note={`${intents.length} payment intents`} />
        <StatCard icon={DollarSign} label="Paid / approved" value={usd(fin?.paidUsd)} tone={C.indigo} note="Settled payments" />
        <StatCard icon={Sprout} label="GPS envelope" value={usd(settle?.envelopeUsd)} tone={C.amber} note={`${settle?.pending || 0} pending settlement`} />
      </div>

      {/* Reconciliation */}
      <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ color: C.head, fontWeight: 700, fontSize: 15 }}>Payment reconciliation</div>
          <button onClick={load} title="Refresh" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${C.line}`, borderRadius: 9, padding: '6px 11px', cursor: 'pointer', color: C.body, fontSize: 12.5, fontFamily: 'inherit' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        {intents.length === 0 ? (
          <div style={{ color: C.body, fontSize: 13.5, padding: '18px 0' }}>No payment intents on the platform yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.body, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  <th style={{ padding: '6px 8px' }}>Date</th>
                  <th style={{ padding: '6px 8px' }}>Member</th>
                  <th style={{ padding: '6px 8px' }}>Merchant</th>
                  <th style={{ padding: '6px 8px' }}>Purpose</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '6px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {intents.map((i) => (
                  <tr key={i.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: '9px 8px', color: C.body }}>{fmtDate(i.createdAt)}</td>
                    <td style={{ padding: '9px 8px', color: C.head, fontWeight: 600 }}>{i.memberName}</td>
                    <td style={{ padding: '9px 8px', color: C.body }}>{i.merchantLabel}</td>
                    <td style={{ padding: '9px 8px', color: C.body }}>{i.purpose}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: C.head, fontWeight: 700 }}>{usd(i.amountUsd)}</td>
                    <td style={{ padding: '9px 8px' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: STATUS_TONE[i.status] || C.body, background: `${STATUS_TONE[i.status] || C.body}18`, borderRadius: 999, padding: '2px 9px' }}>{i.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settlement queue */}
      <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 20 }}>
        <div style={{ color: C.head, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>GPS settlement queue</div>
        <div style={{ color: C.body, fontSize: 12.5, marginBottom: 12 }}>Shadow receipts describing how the GPS envelope routes back to the commons. Mark an entry settled to demonstrate the flow.</div>
        {receipts.length === 0 ? (
          <div style={{ color: C.body, fontSize: 13.5, padding: '18px 0' }}>No settlement receipts yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.body, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  <th style={{ padding: '6px 8px' }}>Date</th>
                  <th style={{ padding: '6px 8px' }}>Member</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Eligible</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Envelope</th>
                  <th style={{ padding: '6px 8px' }}>State</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => {
                  const settled = r.settlementState === 'SETTLED';
                  return (
                    <tr key={r.id} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={{ padding: '9px 8px', color: C.body }}>{fmtDate(r.createdAt)}</td>
                      <td style={{ padding: '9px 8px', color: C.head, fontWeight: 600 }}>{r.memberName}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: C.head }}>{usd(r.eligibleUsd)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: C.amber, fontWeight: 700 }}>{usd(r.envelopeUsd)}</td>
                      <td style={{ padding: '9px 8px' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: settled ? C.green : C.body, background: settled ? C.greenSoft : '#EEF2F1', borderRadius: 999, padding: '2px 9px' }}>{r.settlementState}</span>
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                        {settled ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.green, fontSize: 12.5, fontWeight: 600 }}><Check size={14} /> Settled</span>
                        ) : (
                          <button onClick={() => markSettled(r.id)} disabled={busyId === r.id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.green, border: 'none', borderRadius: 9, padding: '6px 12px', cursor: busyId === r.id ? 'default' : 'pointer', color: '#fff', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', opacity: busyId === r.id ? 0.7 : 1 }}>
                            {busyId === r.id ? <Loader2 size={13} className="afspin" /> : <Check size={13} />} Mark as settled
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
