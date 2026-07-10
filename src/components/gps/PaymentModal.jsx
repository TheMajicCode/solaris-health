/**
 * PaymentModal — the signature moment of the Solaris demo.
 * A member pays a treatment plan; the GPS engine splits the value across
 * the ecosystem and each leg animates in one-by-one with its role, amount,
 * percentage, recipient, and an immutable proof hash. Split percentages are
 * NEVER hardcoded — they always come from the API receipt. All simulated.
 */
import React, { useEffect, useState } from 'react';
import { X, Zap, CheckCircle2, Loader2, ShieldCheck, GraduationCap, Lock } from 'lucide-react';
import { api } from '../../lib/api.js';

const fmtSats = (n) => `${(Number(n) || 0).toLocaleString()} sats`;

// role → color/label mapping (labels come from API when present)
const ROLE_STYLE = {
  provider: { color: '#2FA37C', soft: '#DDF3EB' },
  onboarder: { color: '#5B8FD9', soft: '#E4EEFB' },
  community_treasury: { color: '#7C5CBF', soft: '#EDE6FA' },
  patient_education: { color: '#D69B33', soft: '#FBEFD3' },
  infrastructure: { color: '#4C9BA8', soft: '#DEF0F2' },
  software: { color: '#9AA6B2', soft: '#EDEFF2' },
};
const styleFor = (role) => ROLE_STYLE[role] || { color: '#6B7785', soft: '#EDEFF2' };
const shortHash = (h) => (h ? (h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h) : '—');

export default function PaymentModal({
  open,
  onClose,
  orgId,
  orgName = 'Aura Dental',
  planLabel = 'Dental Restoration',
  amountSats = 1_500_000,
  onPaid,
}) {
  const [status, setStatus] = useState('idle'); // idle | paying | done | error
  const [receipt, setReceipt] = useState(null);
  const [payment, setPayment] = useState(null);
  const [educationCredit, setEducationCredit] = useState(0);
  const [visibleLegs, setVisibleLegs] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setStatus('idle'); setReceipt(null); setPayment(null);
      setEducationCredit(0); setVisibleLegs(0); setError('');
    }
  }, [open]);

  // reveal legs one-by-one once the receipt arrives
  useEffect(() => {
    if (status !== 'done' || !receipt?.legs?.length) return;
    setVisibleLegs(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1; setVisibleLegs(i);
      if (i >= receipt.legs.length) clearInterval(t);
    }, 420);
    return () => clearInterval(t);
  }, [status, receipt]);

  if (!open) return null;

  const pay = async () => {
    setStatus('paying'); setError('');
    try {
      const r = await api.simulatePayment({ orgId, amountSats, description: `${orgName} — ${planLabel}` });
      setReceipt(r.receipt); setPayment(r.payment);
      setEducationCredit(r.educationCreditSats || 0);
      setStatus('done');
      onPaid && onPaid(r);
    } catch (e) {
      setError(e.message || 'Payment failed'); setStatus('error');
    }
  };

  const legs = receipt?.legs || [];

  return (
    <div className="paym-overlay" onClick={onClose}>
      <div className="paym" onClick={(e) => e.stopPropagation()}>
        <button className="paym-close" onClick={onClose}><X size={18} /></button>

        <div className="paym-head">
          <div className="paym-plan-eyebrow">Treatment plan</div>
          <h3 className="paym-plan">{orgName} — {planLabel}</h3>
          <div className="paym-amt">{fmtSats(amountSats)} <span className="paym-sim">(simulated)</span></div>
        </div>

        {status === 'idle' && (
          <div className="paym-body">
            <p className="paym-intro">
              Paying this plan triggers the <strong>Generative Prosperity System</strong>: your payment is split
              across everyone who created value — the provider, your onboarder, the local node, the commons,
              and more. Watch it happen.
            </p>
            <button className="paym-pay" onClick={pay}>
              <Zap size={16} /> Pay {fmtSats(amountSats)}
            </button>
            <div className="paym-foot"><Lock size={11} /> All values simulated — no real funds move.</div>
          </div>
        )}

        {status === 'paying' && (
          <div className="paym-body paym-center">
            <Loader2 size={30} className="paym-spin" />
            <div className="paym-paying">Signing invoice & computing value split…</div>
          </div>
        )}

        {status === 'error' && (
          <div className="paym-body paym-center">
            <div className="paym-err">{error}</div>
            <button className="paym-pay ghost" onClick={pay}>Try again</button>
          </div>
        )}

        {status === 'done' && (
          <div className="paym-body">
            <div className="paym-success">
              <CheckCircle2 size={16} /> Payment settled — value distributed
            </div>

            <div className="paym-receipt-h">
              <span>Value split · <strong>{receipt?.policyName || 'GPS policy'}</strong></span>
              <span className="paym-receipt-hash" title={receipt?.receiptHashMock}>
                <ShieldCheck size={12} /> {shortHash(receipt?.receiptHashMock)}
              </span>
            </div>

            <div className="paym-legs">
              {legs.map((leg, idx) => {
                const st = styleFor(leg.role);
                const shown = idx < visibleLegs;
                return (
                  <div className={`paym-leg ${shown ? 'in' : ''}`} key={`${leg.role}-${idx}`}>
                    <div className="paym-leg-bar" style={{ background: st.color }} />
                    <div className="paym-leg-main">
                      <div className="paym-leg-row1">
                        <span className="paym-leg-label" style={{ color: st.color }}>
                          {leg.label || String(leg.role).replace(/_/g, ' ')}
                        </span>
                        <span className="paym-leg-pct" style={{ background: st.soft, color: st.color }}>
                          {leg.sharePct != null ? `${leg.sharePct}%` : `${((leg.shareBps || 0) / 100).toFixed(0)}%`}
                        </span>
                      </div>
                      <div className="paym-leg-row2">
                        <span className="paym-leg-recip">{leg.identity || '—'}</span>
                        <span className="paym-leg-amt">{fmtSats(leg.amountSats)}</span>
                      </div>
                      <div className="paym-leg-row3">
                        {leg.immutable && <span className="paym-leg-immutable"><Lock size={9} /> immutable</span>}
                        {leg.locationRouting && <span className="paym-leg-geo">GPS-routed</span>}
                        <span className="paym-leg-proof" title={leg.proofMock}>proof {shortHash(leg.proofMock)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {educationCredit > 0 && visibleLegs >= legs.length && (
              <div className="paym-edu">
                <GraduationCap size={14} />
                <span>A <strong>{fmtSats(educationCredit)}</strong> patient-education credit was set aside for your learning journey.</span>
              </div>
            )}

            <div className="paym-foot"><Lock size={11} /> All values simulated · split ratios read live from the GPS policy engine.</div>
          </div>
        )}

        <style>{`
          .luca .paym-overlay, .paym-overlay{position:fixed;inset:0;z-index:1000;background:rgba(14,22,30,.55);
            backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}
          .paym{position:relative;width:100%;max-width:520px;max-height:90vh;overflow:auto;background:var(--surface,#fff);
            border:1px solid var(--line,#e4e8ec);border-radius:var(--r,16px);box-shadow:0 24px 60px rgba(14,22,30,.3);
            font-family:'IBM Plex Sans',sans-serif}
          .paym-close{position:absolute;top:12px;right:12px;background:var(--surface-2,#f2f4f6);border:none;border-radius:50%;
            width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted,#6b7785)}
          .paym-close:hover{background:var(--line,#e4e8ec)}
          .paym-head{padding:22px 22px 16px;border-bottom:1px solid var(--line,#e4e8ec)}
          .paym-plan-eyebrow{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#6b7785)}
          .paym-plan{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:19px;color:var(--ink,#12202b);margin:4px 0 8px}
          .paym-amt{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;color:var(--ink,#12202b)}
          .paym-sim{font-size:12px;font-weight:400;font-style:italic;color:var(--muted,#6b7785)}
          .paym-body{padding:18px 22px 22px}
          .paym-center{display:flex;flex-direction:column;align-items:center;gap:14px;padding:40px 22px}
          .paym-intro{font-size:13.5px;line-height:1.6;color:var(--muted,#4a5560);margin:0 0 18px}
          .paym-pay{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:13px;
            border-radius:var(--r-sm,10px);border:none;background:var(--ink,#12202b);color:var(--gold,#e6b84f);
            font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;cursor:pointer;transition:transform .1s}
          .paym-pay:hover{transform:translateY(-1px)}
          .paym-pay.ghost{background:var(--surface-2,#f2f4f6);color:var(--ink,#12202b)}
          .paym-foot{margin-top:14px;display:flex;align-items:center;gap:6px;justify-content:center;font-size:11px;
            color:var(--muted,#6b7785);font-style:italic}
          .paym-spin{animation:spin 1s linear infinite;color:var(--teal,#2FA37C)}
          .paym-paying{font-size:13.5px;color:var(--muted,#4a5560)}
          .paym-err{font-size:13px;color:var(--danger,#c0392b);text-align:center}
          .paym-success{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13.5px;color:var(--teal-d,#1f7d5f);
            background:var(--mint-soft,#e2f4ec);padding:10px 12px;border-radius:var(--r-sm,10px);margin-bottom:16px}
          .paym-receipt-h{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted,#6b7785);
            margin-bottom:10px}
          .paym-receipt-h strong{color:var(--ink,#12202b)}
          .paym-receipt-hash{display:inline-flex;align-items:center;gap:4px;font-family:'IBM Plex Mono',monospace;font-size:11px}
          .paym-legs{display:flex;flex-direction:column;gap:8px}
          .paym-leg{display:flex;gap:0;border:1px solid var(--line,#e4e8ec);border-radius:var(--r-sm,10px);overflow:hidden;
            opacity:0;transform:translateY(8px);transition:opacity .4s ease,transform .4s ease;background:var(--surface,#fff)}
          .paym-leg.in{opacity:1;transform:translateY(0)}
          .paym-leg-bar{width:5px;flex:none}
          .paym-leg-main{flex:1;padding:9px 12px}
          .paym-leg-row1{display:flex;align-items:center;justify-content:space-between;gap:8px}
          .paym-leg-label{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;text-transform:capitalize}
          .paym-leg-pct{font-weight:700;font-size:11.5px;padding:2px 8px;border-radius:99px}
          .paym-leg-row2{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:3px}
          .paym-leg-recip{font-size:12px;color:var(--muted,#6b7785)}
          .paym-leg-amt{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;color:var(--ink,#12202b)}
          .paym-leg-row3{display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap}
          .paym-leg-immutable{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;text-transform:uppercase;
            letter-spacing:.04em;color:var(--muted,#6b7785)}
          .paym-leg-geo{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--teal-d,#1f7d5f);
            background:var(--mint-soft,#e2f4ec);padding:2px 6px;border-radius:99px}
          .paym-leg-proof{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted-2,#8b96a1)}
          .paym-edu{display:flex;align-items:center;gap:8px;margin-top:14px;padding:11px 13px;border-radius:var(--r-sm,10px);
            background:#FBEFD3;color:#8A5F13;font-size:12.5px;line-height:1.5}
          .paym-edu svg{flex:none}
          @keyframes spin{to{transform:rotate(360deg)}}
        `}</style>
      </div>
    </div>
  );
}
