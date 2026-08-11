/**
 * GPSLedger — the patient's "Value Trail".
 *
 * Every transaction the member makes is shown with its GPS split (90% to the
 * provider, up to 10% through the regenerative envelope), the LOVE points
 * earned, and its contribution to the regenerative commons.
 * "You own your economic trail."
 */

import React, { useEffect, useState } from 'react';
import {
  Sprout, Heart, Coins, TrendingUp, ChevronDown, Loader2, Leaf, Info,
  ShieldQuestion, ShieldAlert, ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import ValueFlowViz, { GPS_BUCKETS } from './ValueFlowViz.jsx';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (d) => {
  try { return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return String(d); }
};

const SPLIT_FIELDS = [
  { key: 'provider_share', bucket: 'provider' },
  { key: 'contributor_share', bucket: 'contributor' },
  { key: 'infrastructure_share', bucket: 'infrastructure' },
  { key: 'treasury_share', bucket: 'treasury' },
  { key: 'software_share', bucket: 'software' },
  { key: 'user_reward_share', bucket: 'userReward' },
];

export default function GPSLedger() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getGpsLedger(50, 0);
        if (alive) setData(r);
      } catch { if (alive) setData({ transactions: [], summary: {} }); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const s = data?.summary || {};
  const txs = data?.transactions || [];
  const lovePoints = Math.round(Number(s.total_rewards || 0) * 100);

  return (
    <div className="gpl">
      <div className="gpl-hero">
        <div className="gpl-hero-badges">
          <span className="gpl-hero-badge"><Leaf size={13} /> GPS — Global Prosperous Split</span>
          <span className="gpl-hero-badge gpl-sim">Simulated</span>
        </div>
        <h2 className="gpl-hero-h">Your Value Trail</h2>
        <p className="gpl-hero-sub">These figures are a simulated preview — no online payment is collected and no real money moves this release. Under GPS, 90% of every payment is intended to go to your practitioner, with up to 10% through the regenerative envelope, once settlement goes live.</p>
        <button className="gpl-how-link" onClick={() => setShowHow((v) => !v)}>
          <Info size={13} /> How GPS works {showHow ? '▲' : '▼'}
        </button>
        {showHow && (
          <div className="gpl-how">
            <ValueFlowViz total={100} compact />
            <p className="gpl-how-note">Value flows to where value was created: 90% to your practitioner, always — the rest through a capped regenerative envelope that feeds the people and commons behind your care.</p>
          </div>
        )}
      </div>

      <div className="gpl-cards">
        <SummaryCard icon={Coins} tone="teal" label="Total spent" value={money(s.total_spent)} sub={`${s.tx_count || 0} transactions`} />
        <SummaryCard icon={Heart} tone="gold" label="LOVE (simulated)" value={`${lovePoints}`} sub="Simulated reciprocity credits" />
        <SummaryCard icon={Sprout} tone="green" label="Treasury contributed" value={money(s.treasury_contributed)} sub="To the regenerative commons" />
        <SummaryCard icon={TrendingUp} tone="mint" label="Ecosystem impact" value={`${s.impact_score || 0}`} sub="Your regenerative footprint" />
      </div>

      {loading ? (
        <div className="gpl-loading"><Loader2 className="gpl-spin" size={22} /> Loading your value trail…</div>
      ) : txs.length === 0 ? (
        <div className="gpl-empty">
          <Sprout size={30} />
          <h3>No value trail yet</h3>
          <p>Once your appointments are completed, you'll see exactly how every transaction fed the ecosystem — and the LOVE credits you earned.</p>
        </div>
      ) : (
        <div className="gpl-list">
          {txs.map((t) => {
            const isOpen = open === t.id;
            return (
              <div className={`gpl-tx ${isOpen ? 'open' : ''}`} key={t.id}>
                <button className="gpl-tx-head" onClick={() => setOpen(isOpen ? null : t.id)}>
                  <div className="gpl-tx-main">
                    <span className="gpl-tx-title">{t.service_name || 'Service'} · {t.business_name || 'Provider'}</span>
                    <span className="gpl-tx-date">{fmtDate(t.created_at)}</span>
                  </div>
                  <div className="gpl-tx-right">
                    <span className="gpl-tx-amt">{money(t.total_amount)}</span>
                    <span className="gpl-tx-reward"><Heart size={11} /> +{Math.round(Number(t.user_reward_share) * 100)} LOVE</span>
                    <span className={`gpl-tx-status ${t.status}`}>{t.status === 'settled' ? 'Settled' : 'Pending'}</span>
                    <ChevronDown size={16} className="gpl-tx-chev" />
                  </div>
                </button>
                {isOpen && (
                  <div className="gpl-tx-body">
                    <div className="gpl-split-note">Your contribution to the ecosystem, split transparently:</div>
                    {SPLIT_FIELDS.map((f) => {
                      const meta = GPS_BUCKETS.find((b) => b.key === f.bucket);
                      const amt = Number(t[f.key]) || 0;
                      return (
                        <div className="gpl-split-row" key={f.key}>
                          <span className="gpl-split-dot" style={{ background: meta.color }} />
                          <span className="gpl-split-lbl">{meta.label}</span>
                          <span className="gpl-split-pct">{meta.pct}%</span>
                          <span className="gpl-split-amt">{money(amt)}</span>
                        </div>
                      );
                    })}
                    <AllocationEvidence transactionId={t.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .luca .gpl{display:flex;flex-direction:column;gap:18px}
        .luca .gpl-hero{background:linear-gradient(155deg,var(--teal-d) 0%,var(--teal-d2) 100%);color:#fff;
          border-radius:var(--r-lg);padding:22px 24px;box-shadow:var(--shadow);position:relative;overflow:hidden}
        .luca .gpl-hero::after{content:'';position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;
          background:radial-gradient(circle,rgba(159,231,214,.22),transparent 70%)}
        .luca .gpl-hero-badges{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .luca .gpl-hero-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;
          background:rgba(255,255,255,.14);padding:4px 10px;border-radius:99px;letter-spacing:.04em}
        .luca .gpl-hero-badge.gpl-sim{background:rgba(246,214,122,.22);color:#F6D67A;font-weight:700}
        .luca .gpl-hero-h{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;margin:10px 0 4px}
        .luca .gpl-hero-sub{font-size:13.5px;opacity:.9;max-width:560px;margin:0}
        .luca .gpl-how-link{margin-top:12px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);
          border:none;color:#fff;font-size:12px;padding:6px 12px;border-radius:99px;cursor:pointer;font-weight:600}
        .luca .gpl-how-link:hover{background:rgba(255,255,255,.2)}
        .luca .gpl-how{margin-top:16px;background:rgba(255,255,255,.96);border-radius:var(--r);padding:18px}
        .luca .gpl-how-note{font-size:12px;color:var(--muted);font-style:italic;margin:14px 0 0;text-align:center}
        .luca .gpl-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        @media(max-width:820px){.luca .gpl-cards{grid-template-columns:repeat(2,1fr)}}
        .luca .gpl-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px;
          box-shadow:var(--shadow-sm)}
        .luca .gpl-card-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
        .luca .gpl-card-ico.teal{background:var(--mint-soft);color:var(--teal-d)}
        .luca .gpl-card-ico.gold{background:#FBEFD3;color:#B67D1C}
        .luca .gpl-card-ico.green{background:#E9F3DA;color:#5E7F2C}
        .luca .gpl-card-ico.mint{background:var(--mint-soft);color:var(--teal-d)}
        .luca .gpl-card-val{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:var(--ink)}
        .luca .gpl-card-lbl{font-size:12px;font-weight:600;color:var(--ink);margin-top:2px}
        .luca .gpl-card-sub{font-size:11px;color:var(--muted-2);margin-top:1px}
        .luca .gpl-list{display:flex;flex-direction:column;gap:9px}
        .luca .gpl-tx{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;
          box-shadow:var(--shadow-sm)}
        .luca .gpl-tx.open{border-color:var(--mint-line)}
        .luca .gpl-tx-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;
          background:none;border:none;padding:14px 16px;cursor:pointer;text-align:left}
        .luca .gpl-tx-main{display:flex;flex-direction:column;gap:2px;min-width:0}
        .luca .gpl-tx-title{font-size:14px;font-weight:600;color:var(--ink)}
        .luca .gpl-tx-date{font-size:11.5px;color:var(--muted-2)}
        .luca .gpl-tx-right{display:flex;align-items:center;gap:12px;flex:none}
        .luca .gpl-tx-amt{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:var(--ink)}
        .luca .gpl-tx-reward{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;
          color:#B67D1C;background:#FBEFD3;padding:3px 8px;border-radius:99px}
        .luca .gpl-tx-status{font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.04em}
        .luca .gpl-tx-status.settled{background:var(--mint-soft);color:var(--teal-d)}
        .luca .gpl-tx-status.pending{background:var(--surface-2);color:var(--muted)}
        .luca .gpl-tx-chev{color:var(--muted-2);transition:transform .2s}
        .luca .gpl-tx.open .gpl-tx-chev{transform:rotate(180deg)}
        .luca .gpl-tx-body{padding:4px 16px 16px;border-top:1px solid var(--line)}
        .luca .gpl-split-note{font-size:11.5px;color:var(--muted);margin:12px 0 10px;font-style:italic}
        .luca .gpl-split-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line)}
        .luca .gpl-split-row:last-child{border-bottom:none}
        .luca .gpl-split-dot{width:9px;height:9px;border-radius:50%;flex:none}
        .luca .gpl-split-lbl{flex:1;font-size:13px;color:var(--ink)}
        .luca .gpl-split-pct{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--muted);width:42px;text-align:right}
        .luca .gpl-split-amt{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;color:var(--ink);width:64px;text-align:right}
        .luca .gpl-ev{margin-top:12px;padding-top:10px;border-top:1px dashed var(--line)}
        .luca .gpl-ev-link{display:inline-flex;align-items:center;gap:6px;background:var(--surface-2);
          border:1px solid var(--line);color:var(--ink);font-size:12px;font-weight:600;padding:6px 12px;
          border-radius:99px;cursor:pointer}
        .luca .gpl-ev-link:hover{border-color:var(--mint-line)}
        .luca .gpl-ev-link.warn{color:#A2541F;background:#FBEFE0;border-color:#EFD9BF;margin-top:10px}
        .luca .gpl-ev-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .luca .gpl-ev-state{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;
          padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.04em}
        .luca .gpl-ev-state.proposed{background:var(--mint-soft);color:var(--teal-d)}
        .luca .gpl-ev-state.disputed{background:#FBEFE0;color:#A2541F}
        .luca .gpl-ev-state.corrected{background:#E9F3DA;color:#5E7F2C}
        .luca .gpl-ev-shadow{font-size:11px;color:var(--muted-2);font-style:italic}
        .luca .gpl-ev-plain{font-size:12.5px;color:var(--muted);margin:10px 0 8px}
        .luca .gpl-ev-lines{display:flex;flex-direction:column;gap:5px}
        .luca .gpl-ev-line{font-size:12px;color:var(--ink);padding-left:12px;position:relative}
        .luca .gpl-ev-line::before{content:'·';position:absolute;left:2px;color:var(--teal)}
        .luca .gpl-ev-meta{margin-top:10px;font-size:11px;color:var(--muted-2)}
        .luca .gpl-ev-meta code{font-family:'IBM Plex Mono',monospace;font-size:10.5px;background:var(--surface-2);
          padding:1px 5px;border-radius:5px}
        .luca .gpl-ev-disputes{margin-top:10px;display:flex;flex-direction:column;gap:6px}
        .luca .gpl-ev-dispute{font-size:12px;color:var(--ink);background:var(--surface-2);border-radius:10px;
          padding:8px 10px;display:flex;flex-direction:column;gap:3px}
        .luca .gpl-ev-dstatus{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .luca .gpl-ev-dstatus.open{color:#A2541F}
        .luca .gpl-ev-dstatus.resolved{color:#5E7F2C}
        .luca .gpl-ev-dreason{font-style:italic;color:var(--muted)}
        .luca .gpl-ev-dres{color:var(--ink)}
        .luca .gpl-ev-form{margin-top:10px}
        .luca .gpl-ev-ta{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;
          padding:8px 10px;font-size:12.5px;font-family:inherit;resize:vertical;background:var(--surface)}
        .luca .gpl-ev-actions{display:flex;gap:8px;margin-top:8px}
        .luca .gpl-ev-btn{border:none;background:var(--teal-d);color:#fff;font-size:12px;font-weight:600;
          padding:7px 14px;border-radius:99px;cursor:pointer}
        .luca .gpl-ev-btn:disabled{opacity:.6;cursor:default}
        .luca .gpl-ev-btn.ghost{background:var(--surface-2);color:var(--ink);border:1px solid var(--line)}
        .luca .gpl-ev-err{margin-top:8px;font-size:12px;color:#A23B2E}
        .luca .gpl-empty,.luca .gpl-loading{text-align:center;padding:40px 20px;color:var(--muted);
          background:var(--surface);border:1px dashed var(--line);border-radius:var(--r)}
        .luca .gpl-empty svg{color:var(--teal);margin-bottom:8px}
        .luca .gpl-empty h3{font-family:'Space Grotesk',sans-serif;margin:0 0 6px;color:var(--ink)}
        .luca .gpl-empty p{font-size:13px;max-width:420px;margin:0 auto}
        .luca .gpl-loading{display:flex;align-items:center;justify-content:center;gap:8px}
        .luca .gpl-spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

/**
 * AllocationEvidence — "why does this allocation exist?"
 *
 * Loads the shadow allocation receipt (evidence hash + policy version +
 * state) on demand and explains each leg in plain language. Receipts are
 * evidence anyone can verify — not tickets waiting on an authority. A member
 * can still flag a receipt that looks off; the flag is logged on the record
 * next to the evidence. No real money moves — everything here is a
 * transparent, evidence-backed proposal.
 */
function AllocationEvidence({ transactionId }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try { setInfo(await api.explainGpsAllocation(transactionId)); }
    catch (e) { setError(e?.message || 'Could not load the allocation evidence.'); }
    finally { setLoading(false); }
  };

  const sendFlag = async () => {
    if (reason.trim().length < 5) { setError('Please describe what looks off (a sentence is enough).'); return; }
    setSending(true); setError(null);
    try {
      await api.disputeGpsAllocation(transactionId, reason.trim());
      setDisputing(false); setReason('');
      await load();
    } catch (e) { setError(e?.message || 'Could not log your flag.'); }
    finally { setSending(false); }
  };

  if (!info) {
    return (
      <div className="gpl-ev">
        <button className="gpl-ev-link" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={13} className="gpl-spin" /> : <ShieldQuestion size={13} />}
          Why this allocation?
        </button>
        {error && <div className="gpl-ev-err">{error}</div>}
      </div>
    );
  }

  const r = info.receipt || {};
  const stateMeta = {
    proposed: { label: 'Proposed', cls: 'proposed', Icon: ShieldQuestion },
    disputed: { label: 'Flagged', cls: 'disputed', Icon: ShieldAlert },
    corrected: { label: 'Corrected on the record', cls: 'corrected', Icon: ShieldCheck },
  }[r.state] || { label: r.state, cls: 'proposed', Icon: ShieldQuestion };

  return (
    <div className="gpl-ev open">
      <div className="gpl-ev-head">
        <span className={`gpl-ev-state ${stateMeta.cls}`}><stateMeta.Icon size={12} /> {stateMeta.label}</span>
        <span className="gpl-ev-shadow">Shadow allocation — no real money has moved</span>
      </div>
      <p className="gpl-ev-plain">{info.plain}</p>
      <div className="gpl-ev-lines">
        {(info.explanation || []).map((l) => (
          <div className="gpl-ev-line" key={l.role}>{l.because}</div>
        ))}
      </div>
      <div className="gpl-ev-meta">
        Policy <code>{r.policyVersion}</code>
        {r.receiptVersion ? <> · {r.receiptVersion}</> : null}
        {' · evidence '}<code>{String(r.evidenceHash || '').slice(0, 12)}…</code>
        {r.policyHash ? <> · policy hash <code>{String(r.policyHash).slice(0, 12)}…</code></> : null}
        {r.evidenceVerified ? ' · verified' : ' · verification failed'}
      </div>
      {(info.disputes || []).length > 0 && (
        <div className="gpl-ev-disputes">
          {info.disputes.map((d) => (
            <div className="gpl-ev-dispute" key={d.id}>
              <span className={`gpl-ev-dstatus ${d.status}`}>{d.status === 'resolved' ? 'Answered on the record' : 'Flag logged'}</span>
              <span className="gpl-ev-dreason">“{d.reason}”</span>
              {d.resolution && <span className="gpl-ev-dres">→ {d.resolution}</span>}
            </div>
          ))}
        </div>
      )}
      {info.canDispute && !disputing && (
        <button className="gpl-ev-link warn" onClick={() => setDisputing(true)}>
          <ShieldAlert size={13} /> Question this receipt
        </button>
      )}
      {disputing && (
        <div className="gpl-ev-form">
          <textarea
            className="gpl-ev-ta"
            rows={2}
            placeholder="Note what looks off. Your flag is logged on the record, next to the evidence."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="gpl-ev-actions">
            <button className="gpl-ev-btn" onClick={sendFlag} disabled={sending}>
              {sending ? 'Logging…' : 'Log my flag'}
            </button>
            <button className="gpl-ev-btn ghost" onClick={() => { setDisputing(false); setError(null); }}>Cancel</button>
          </div>
        </div>
      )}
      {error && <div className="gpl-ev-err">{error}</div>}
    </div>
  );
}

function SummaryCard({ icon: Icon, tone, label, value, sub }) {
  return (
    <div className="gpl-card">
      <div className={`gpl-card-ico ${tone}`}><Icon size={17} /></div>
      <div className="gpl-card-val">{value}</div>
      <div className="gpl-card-lbl">{label}</div>
      <div className="gpl-card-sub">{sub}</div>
    </div>
  );
}
