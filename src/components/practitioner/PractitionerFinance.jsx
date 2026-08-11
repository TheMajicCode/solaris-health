/**
 * PractitionerFinance.jsx — the practitioner's simulated earnings workspace.
 *
 * Shows an earnings summary (total simulated value + this-cycle estimate), the
 * per-visit transaction ledger with the GPS practitioner split, and a payout-method
 * form. Every figure is clearly SIMULATED — GPS demonstrates how value routes back
 * to the practitioner; no real money moves and live payouts are not yet enabled.
 *
 * Data: GET /api/provider/earnings (payment_splits, see earnings.js).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Wallet, TrendingUp, Landmark, Info, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';

const C = {
  head: '#0A2B29', body: '#6b807a', green: '#2DB584', line: '#E3EDEA',
  greenSoft: '#E6F6F0', indigo: '#6B7FD7', amber: '#C58A53',
};
const PROVIDER_SPLIT = 0.9; // GPS routes 90% of the eligible value to the practitioner.

const usd = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return '—'; } };

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

export default function PractitionerFinance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [payout, setPayout] = useState({ method: 'bank', account: '', holder: '' });
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutSaved, setPayoutSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.getProviderEarnings();
      setData(r || { earnings: [], totalSimulatedUsd: 0 });
    } catch (e) {
      setErr('Could not load your earnings. Please try again.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const savePayout = (e) => {
    e.preventDefault();
    setSavingPayout(true);
    // Simulated — no real payout rails are connected yet.
    setTimeout(() => {
      setSavingPayout(false);
      setPayoutSaved(true);
      toast.success('Payout method saved (simulated)');
    }, 600);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.body, padding: 40 }}>
        <style>{'@keyframes pfspin{to{transform:rotate(360deg)}} .pfspin{animation:pfspin 1s linear infinite}'}</style>
        <Loader2 size={18} className="pfspin" /> Loading your earnings…
      </div>
    );
  }

  const earnings = data?.earnings || [];
  const total = Number(data?.totalSimulatedUsd) || 0;
  const providerShare = total * PROVIDER_SPLIT;

  return (
    <div style={{ maxWidth: 900 }}>
      <style>{'@keyframes pfspin{to{transform:rotate(360deg)}} .pfspin{animation:pfspin 1s linear infinite}'}</style>

      {/* Simulated banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FBF3EA', border: `1px solid ${C.amber}44`, color: '#7A5A34', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
        <Info size={15} color={C.amber} />
        <span><strong>Simulated earnings.</strong> GPS shows how value routes back to you. Live payouts are coming soon — no real money moves yet.</span>
      </div>

      {err && <div style={{ background: '#FDECEC', color: '#B23B3B', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard icon={Wallet} label="Total simulated value" value={usd(total)} tone={C.green} note="Across all recorded visits" />
        <StatCard icon={TrendingUp} label="Your GPS share (90%)" value={usd(providerShare)} tone={C.indigo} note="Routed to the practitioner" />
        <StatCard icon={Landmark} label="Visits recorded" value={String(earnings.length)} tone={C.amber} note="Payment splits on file" />
      </div>

      {/* Transactions */}
      <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <div style={{ color: C.head, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Transaction ledger</div>
        {earnings.length === 0 ? (
          <div style={{ color: C.body, fontSize: 13.5, padding: '18px 0' }}>No earnings recorded yet. As members complete visits, their GPS splits will appear here.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.body, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  <th style={{ padding: '6px 8px' }}>Date</th>
                  <th style={{ padding: '6px 8px' }}>Member</th>
                  <th style={{ padding: '6px 8px' }}>Type</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Your share (90%)</th>
                  <th style={{ padding: '6px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: '9px 8px', color: C.body }}>{fmtDate(e.createdAt)}</td>
                    <td style={{ padding: '9px 8px', color: C.head, fontWeight: 600 }}>{e.patientName}</td>
                    <td style={{ padding: '9px 8px', color: C.body }}>{e.splitType || 'consultation'}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: C.head }}>{usd(e.amountUsd)}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: C.green, fontWeight: 700 }}>{usd(e.amountUsd * PROVIDER_SPLIT)}</td>
                    <td style={{ padding: '9px 8px' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: C.indigo, background: '#EEF1FB', borderRadius: 999, padding: '2px 9px' }}>{e.status || 'simulated'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout method */}
      <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 20 }}>
        <div style={{ color: C.head, fontWeight: 700, fontSize: 15 }}>Payout method</div>
        <div style={{ color: C.body, fontSize: 12.5, margin: '4px 0 14px' }}>Simulated — live payouts coming soon. We store your preference so it's ready when payouts go live.</div>
        <form onSubmit={savePayout} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
          <label style={{ fontSize: 12.5, color: C.head, fontWeight: 600 }}>
            Method
            <select value={payout.method} onChange={(e) => { setPayout((p) => ({ ...p, method: e.target.value })); setPayoutSaved(false); }}
              style={{ display: 'block', width: '100%', marginTop: 5, padding: '9px 11px', borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13.5, color: C.head, fontFamily: 'inherit' }}>
              <option value="bank">Bank transfer</option>
              <option value="lightning">Bitcoin (Lightning)</option>
            </select>
          </label>
          <label style={{ fontSize: 12.5, color: C.head, fontWeight: 600 }}>
            Account holder
            <input value={payout.holder} onChange={(e) => { setPayout((p) => ({ ...p, holder: e.target.value })); setPayoutSaved(false); }} placeholder="Full name on the account"
              style={{ display: 'block', width: '100%', marginTop: 5, padding: '9px 11px', borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13.5, color: C.head, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </label>
          <label style={{ fontSize: 12.5, color: C.head, fontWeight: 600 }}>
            Account / address
            <input value={payout.account} onChange={(e) => { setPayout((p) => ({ ...p, account: e.target.value })); setPayoutSaved(false); }} placeholder="Account number or wallet address"
              style={{ display: 'block', width: '100%', marginTop: 5, padding: '9px 11px', borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13.5, color: C.head, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </label>
          <button type="submit" disabled={savingPayout}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: savingPayout ? 'default' : 'pointer', background: payoutSaved ? C.indigo : C.green, color: '#fff', fontWeight: 600, fontSize: 13.5, alignSelf: 'flex-start', fontFamily: 'inherit', opacity: savingPayout ? 0.7 : 1 }}>
            {savingPayout ? <Loader2 size={15} className="pfspin" /> : payoutSaved ? <Check size={15} /> : <Landmark size={15} />}
            {savingPayout ? 'Saving…' : payoutSaved ? 'Saved (simulated)' : 'Save payout method'}
          </button>
        </form>
      </div>
    </div>
  );
}
