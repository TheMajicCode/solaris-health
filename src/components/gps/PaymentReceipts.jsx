/**
 * PaymentReceipts — "Where your payment goes" (M7; spec A4 §3.7).
 *
 * Renders the member's gps-receipt/1.0 shadow receipts: the earned-value
 * summary, the ≤10% regenerative envelope by domain, and the honest label
 * "Simulated — no funds have moved." Money is SIMULATED throughout — this
 * shows how Solaris WILL route value when live.
 *
 * Data: GET /api/gps/receipts (api.getGpsReceipts).
 */
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

const C = {
  head: '#0A2B29', body: '#6b807a', green: '#2DB584', amber: '#C58A53',
  indigo: '#6B7FD7', line: '#e3ece8',
};

const money = (cents, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((Number(cents) || 0) / 100);

function Bar({ label, cents, total, currency, color }) {
  const pct = total > 0 ? Math.round((cents / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.body, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: C.head }}>{money(cents, currency)} · {pct}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 5, background: 'rgba(10,43,41,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5 }} />
      </div>
    </div>
  );
}

function ReceiptCard({ r }) {
  const rec = r.receipt || {};
  const currency = r.currency || (rec.eligible_value && rec.eligible_value.asset) || 'USD';
  const allocations = rec.allocations || [];
  const earned = allocations.filter((a) => a.bucket === 'earned_value');
  const envelope = allocations.filter((a) => a.bucket === 'gps_envelope');
  const eligible = r.eligibleCents || (rec.eligible_value && rec.eligible_value.amount_cents) || 0;

  return (
    <div style={{
      border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px',
      background: '#fff', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.head, textTransform: 'capitalize' }}>
          {r.purpose || 'Payment'} · {money(eligible, currency)}
        </div>
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: C.indigo, background: 'rgba(107,127,215,0.12)',
          padding: '2px 8px', borderRadius: 10, letterSpacing: 0.4,
        }}>{r.settlementState || 'PREPARED'}</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.body, marginBottom: 12 }}>
        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''} · receipt {r.receiptVersion || 'gps-receipt/1.0'}
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.head, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
        Earned value <span style={{ color: C.body, fontWeight: 500, textTransform: 'none' }}>· your practitioner + Solaris coordination</span>
      </div>
      {earned.map((a) => (
        <Bar key={a.allocation_id || a.recipient_label} label={a.recipient_label} cents={a.entitlement_cents}
          total={eligible} currency={currency} color={C.green} />
      ))}

      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.head, textTransform: 'uppercase', letterSpacing: 0.6, margin: '12px 0 6px' }}>
        Regenerative envelope <span style={{ color: C.body, fontWeight: 500, textTransform: 'none' }}>· up to 10%, beyond the clinic and beyond Solaris</span>
      </div>
      {envelope.map((a) => (
        <Bar key={a.allocation_id || a.recipient_label} label={a.recipient_label} cents={a.entitlement_cents}
          total={eligible} currency={currency} color={C.amber} />
      ))}

      <div style={{
        marginTop: 12, padding: '9px 12px', borderRadius: 10,
        background: 'rgba(197,138,83,0.10)', border: '1px solid rgba(197,138,83,0.25)',
        fontSize: 11.5, color: '#7a5327', lineHeight: 1.5,
      }}>
        <strong>Simulated — no funds have moved.</strong> This shows how Solaris will route value when live.
        A payment proof shows money moved; it does not by itself prove an outcome.
      </div>
    </div>
  );
}

export default function PaymentReceipts() {
  const [receipts, setReceipts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getGpsReceipts().then((res) => {
      if (alive) setReceipts((res && res.receipts) || []);
    }).catch((e) => { if (alive) setError(e.message || 'Could not load receipts'); });
    return () => { alive = false; };
  }, []);

  if (error) return null; // fail quiet in the showcase
  if (receipts === null) return null; // loading — stay out of the way
  if (!receipts.length) return null; // nothing to show until a payment happens

  return (
    <section style={{ marginTop: 8 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: C.head }}>
        Where your payment goes
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.body, lineHeight: 1.55, maxWidth: 560 }}>
        A transparent, signed-shaped receipt for every payment — the earned-value pool and the
        regenerative envelope by domain. All figures are simulated in this pilot.
      </p>
      {receipts.map((r) => <ReceiptCard key={r.receiptId} r={r} />)}
    </section>
  );
}
