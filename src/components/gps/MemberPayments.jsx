/**
 * MemberPayments.jsx — the member's own payment history ("My Payments").
 *
 * Lists every payment intent the member has made (Wompi sandbox), with the GPS
 * split for each: how much went to earned value (the practitioner) vs. the
 * regenerative envelope. A one-click CSV export lets the member take their
 * financial record with them — sovereign data ownership.
 *
 * Data: GET /api/payments/intents (see payments.js). Everything is SIMULATED.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Download, Receipt, Info } from 'lucide-react';
import { api } from '../../lib/api.js';

const C = {
  head: '#0A2B29', body: '#6b807a', green: '#2DB584', line: '#E3EDEA',
  greenSoft: '#E6F6F0', indigo: '#6B7FD7', amber: '#C58A53',
};
const usd = (cents) => `$${((Number(cents) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return '—'; } };

const STATUS_TONE = { paid: C.green, approved: C.green, pending: C.amber, refunded: C.body, disputed: '#B23B3B', created: C.body };

function toCsv(intents) {
  const header = ['Date', 'Purpose', 'Description', 'Status', 'Amount (USD)', 'Practitioner share (USD)', 'GPS envelope (USD)', 'Currency'];
  const rows = intents.map((i) => [
    fmtDate(i.createdAt),
    i.purpose || '',
    (i.description || '').replace(/"/g, '""'),
    i.status || '',
    ((Number(i.amountCents) || 0) / 100).toFixed(2),
    ((Number(i.earnedValueCents) || 0) / 100).toFixed(2),
    ((Number(i.envelopeCents) || 0) / 100).toFixed(2),
    i.currency || 'USD',
  ]);
  return [header, ...rows].map((r) => r.map((c) => `"${String(c)}"`).join(',')).join('\n');
}

export default function MemberPayments() {
  const [intents, setIntents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.getPaymentIntents();
      setIntents(r?.intents || []);
    } catch (e) { setErr('Could not load your payments.'); setIntents([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const csv = toCsv(intents || []);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solaris-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const total = (intents || []).reduce((s, i) => s + (Number(i.amountCents) || 0), 0);

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 20 }}>
      <style>{'@keyframes mpspin{to{transform:rotate(360deg)}} .mpspin{animation:mpspin 1s linear infinite}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.head, fontWeight: 700, fontSize: 16 }}>
            <Receipt size={18} color={C.green} /> My Payments
          </div>
          <div style={{ color: C.body, fontSize: 13, marginTop: 3 }}>Your payment history and how GPS split each one. Simulated — no funds have moved.</div>
        </div>
        <button onClick={exportCsv} disabled={loading || !(intents && intents.length)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 10, border: `1px solid ${C.green}`, cursor: (intents && intents.length) ? 'pointer' : 'default', background: C.greenSoft, color: '#1c7a5c', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', opacity: (intents && intents.length) ? 1 : 0.5 }}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {err && <div style={{ background: '#FDECEC', color: '#B23B3B', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.body, padding: '20px 0' }}>
          <Loader2 size={16} className="mpspin" /> Loading your payments…
        </div>
      ) : (intents && intents.length) ? (
        <>
          <div style={{ overflowX: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.body, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  <th style={{ padding: '6px 8px' }}>Date</th>
                  <th style={{ padding: '6px 8px' }}>Purpose</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Practitioner</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>GPS envelope</th>
                  <th style={{ padding: '6px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {intents.map((i) => (
                  <tr key={i.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: '9px 8px', color: C.body }}>{fmtDate(i.createdAt)}</td>
                    <td style={{ padding: '9px 8px', color: C.head, fontWeight: 600 }}>{i.description || i.purpose}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: C.head, fontWeight: 700 }}>{usd(i.amountCents)}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: C.green }}>{usd(i.earnedValueCents)}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', color: C.amber }}>{usd(i.envelopeCents)}</td>
                    <td style={{ padding: '9px 8px' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: STATUS_TONE[i.status] || C.body, background: `${STATUS_TONE[i.status] || C.body}18`, borderRadius: 999, padding: '2px 9px' }}>{i.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 12.5, color: C.body }}>
            {intents.length} payment{intents.length === 1 ? '' : 's'} · {usd(total)} total (simulated)
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: C.body, fontSize: 13.5, padding: '16px 0' }}>
          <Info size={15} color={C.body} style={{ marginTop: 1 }} />
          <span>No payments yet. When you book and pay for care, each payment and its GPS split will appear here — ready to export anytime.</span>
        </div>
      )}
    </div>
  );
}
