/**
 * GpsExplainer — "What is GPS?" (GPS Protocol Suite v1.0 showcase)
 *
 * The first thing anyone sees on the Economic Passport page. Explains the
 * GPS — Global Prosperous Split — protocol to a member, investor, partner
 * or government official in one scroll:
 *
 *   1. a protocol-accurate one-line definition;
 *   2. an interactive "follow one payment" flow — the HERO FACT is that the
 *      practitioner ALWAYS receives 90%; the 10% GPS ecosystem envelope
 *      then subdivides into the Solaris default recipients;
 *   3. a live example GPS receipt (gps-receipt/1.0) generated from the
 *      chosen amount — the same shape real bookings produce in the ledger;
 *   4. a zoom-out ripple (you → community → nation → world);
 *   5. the protocol truths.
 *
 * Every number comes from the protocol config seam (src/lib/gps-policy.js →
 * GET /api/gps/policy). Everything is SIMULATED — illustrative values, no
 * real money moves. Pure frontend: hand-rolled SVG + CSS, no chart libs.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Unlock, Fingerprint, Landmark, ReceiptText, Zap } from 'lucide-react';
import { STATIC_GPS_POLICY, loadGpsPolicy, bpsToPercent, splitAmount } from '../../lib/gps-policy';

const AMOUNTS = [50, 100, 200];

/* Suite lifecycle, condensed into four stages a first-time reader can hold:
   policy snapshot → payment → allocation → settlement → receipt → atlas. */
const STAGES = [
  { key: 'payment', label: 'Payment', copy: 'One person pays for one service — a single payment, like any other. The split policy is frozen before the invoice is even created.' },
  { key: 'split', label: '90 / 10 Split', copy: 'The protocol routes 90% to your practitioner — always. At most 10% becomes the GPS ecosystem envelope, split by a transparent, versioned policy.' },
  { key: 'regenerate', label: 'Regenerate', copy: 'Each envelope share lands where it regenerates something — prevention, community, open infrastructure, your own savings.' },
  { key: 'ripple', label: 'Ripple', copy: 'Every split produces a verifiable receipt. Multiply by every payment, every day — value stops leaking out and starts circulating.' },
];

const RIPPLES = [
  { key: 'you', label: 'You', copy: 'Every payment leaves a verifiable receipt — and a user-sovereignty share flows back into your own passport.' },
  { key: 'community', label: 'Community', copy: 'Place-based public goods and referral lineage fill up from local activity. Your neighbourhood finances itself.' },
  { key: 'nation', label: 'Nation', copy: 'Care economies stop extracting to distant shareholders and start compounding at home — regeneration over extraction.' },
  { key: 'world', label: 'World', copy: 'An open protocol anyone can implement independently — regenerative value routing for the whole economy.' },
];

const TRUTHS = [
  { Icon: GitBranch, title: 'Open protocol', copy: 'GPS can be implemented independently — Solaris offers one governed implementation. Read it, run it, build on it.' },
  { Icon: Unlock, title: 'No one controls it', copy: 'No middlemen, no gatekeeper. The ecosystem envelope is constitutionally capped at 10% — a transparent policy, never a hidden fee.' },
  { Icon: Fingerprint, title: 'Identity above endpoints', copy: 'Your identity holds your split configuration and persists; payment addresses stay replaceable underneath it.' },
  { Icon: Landmark, title: 'Solaris is only the default', copy: 'Solaris recipients are the default until you set your own end address — a Lightning address today, more rails later.' },
  { Icon: ReceiptText, title: 'Every split leaves a receipt', copy: 'Each allocation produces a gps-receipt/1.0 record — the truth surface of the protocol, verifiable by anyone with access.' },
];

/* Colors for the envelope recipients (Solaris palette, stable by key). */
const ENVELOPE_COLORS = {
  solaris_coordination: '#0E5C57',
  regenerative_health: '#2DB584',
  referral_lineage: '#C58A53',
  user_sovereignty: '#B08D2F',
  infrastructure_open_tech: '#6B7FD7',
  local_community_cause: '#5E7F2C',
  education_intelligence: '#8A5A2B',
};

const fmt = (n) => `$${n.toFixed(2)}`;

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
};

/**
 * Deterministic simulated hash — LOOKS like a sha256 hex digest so the
 * receipt showcase feels real, but is clearly labeled simulated. (FNV-1a
 * over the input with 8 seeds → 64 hex chars.)
 */
function simHash(input) {
  let out = '';
  for (let seed = 0; seed < 8; seed += 1) {
    let h = (0x811c9dc5 ^ (seed * 0x9e3779b9)) >>> 0;
    const s = `${seed}:${input}`;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return out;
}

/* ───────────────────────── Receipt showcase ───────────────────────── */

function GpsReceiptShowcase({ amount, policy, split }) {
  // Regenerate a stable simulated receipt whenever the amount changes.
  const receipt = useMemo(() => {
    const createdAt = new Date().toISOString();
    const body = `${amount}|${policy.policy.id}|${createdAt}`;
    return {
      receiptId: `gps:receipt:sim-${simHash(body).slice(0, 16)}`,
      contextHash: simHash(`ctx|${body}`),
      policyHash: policy.policy.hash || simHash(`policy|${policy.policy.id}`),
      createdAt,
    };
  }, [amount, policy]);

  return (
    <div className="gpse-receipt" aria-label="Example GPS receipt (simulated)">
      <div className="gpse-receipt-top">
        <div>
          <div className="gpse-flow-kicker">The truth surface</div>
          <div className="gpse-receipt-title">Every split leaves a receipt</div>
          <div className="gpse-receipt-sub">
            This is the <code>gps-receipt/1.0</code> record your {fmt(amount)} payment would produce —
            the same shape every real booking writes into your GPS ledger below.
          </div>
        </div>
        <span className="gpse-sim-badge">Simulated</span>
      </div>

      <div className="gpse-receipt-paper" role="figure" aria-label="Simulated GPS receipt">
        <div className="gpse-receipt-head">
          <span className="gpse-receipt-brand">⚡ GPS RECEIPT</span>
          <span className="gpse-receipt-ver">gps-receipt/1.0</span>
        </div>
        <dl className="gpse-receipt-meta">
          <div><dt>receipt_id</dt><dd className="mono">{receipt.receiptId}</dd></div>
          <div><dt>issuer</dt><dd className="mono">gps:identity:solaris</dd></div>
          <div><dt>policy</dt><dd className="mono">{policy.policy.id}</dd></div>
          <div><dt>policy_hash</dt><dd className="mono trunc">{String(receipt.policyHash).slice(0, 20)}…</dd></div>
          <div><dt>context_hash</dt><dd className="mono trunc">{receipt.contextHash.slice(0, 20)}…</dd></div>
          <div><dt>created_at</dt><dd className="mono">{receipt.createdAt.slice(0, 19)}Z</dd></div>
        </dl>

        <div className="gpse-receipt-rule" />

        <div className="gpse-receipt-line total">
          <span>Eligible value</span><span className="mono">{fmt(split.total)}</span>
        </div>
        <div className="gpse-receipt-line hero">
          <span>Provider earned value · {bpsToPercent(policy.providerShareBps)}</span>
          <span className="mono">{fmt(split.provider.amount)}</span>
        </div>
        <div className="gpse-receipt-line envelope">
          <span>GPS ecosystem envelope · {bpsToPercent(policy.envelopeBps)} (cap {bpsToPercent(policy.policy.envelopeCapBps)})</span>
          <span className="mono">{fmt(split.envelope)}</span>
        </div>
        {split.parts.map((p) => (
          <div key={p.key} className="gpse-receipt-line alloc">
            <span>
              <span className="gpse-rec-swatch" style={{ background: ENVELOPE_COLORS[p.key] || '#8fa39c' }} />
              {p.label} · {bpsToPercent(p.shareBps)}
            </span>
            <span className="mono">{fmt(p.amount)}</span>
          </div>
        ))}

        <div className="gpse-receipt-rule" />

        <div className="gpse-receipt-foot">
          <div className="gpse-receipt-line small">
            <span>settlement_summary</span>
            <span className="mono ok">SETTLED {fmt(split.total)} · pending $0.00</span>
          </div>
          <div className="gpse-receipt-line small">
            <span>privacy_profile</span><span className="mono">COUNTERPARTY</span>
          </div>
          <div className="gpse-receipt-line small">
            <span>signatures</span><span className="mono">issuer ✓ (simulated)</span>
          </div>
        </div>
        <div className="gpse-receipt-note">
          Simulated — illustrative values, no PHI, no real money moved. Receipts are append-only:
          corrections reference the original, they never erase it.
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Main explainer ─────────────────────────── */

export default function GpsExplainer() {
  const [policy, setPolicy] = useState(STATIC_GPS_POLICY);
  const [amount, setAmount] = useState(100);
  const [stage, setStage] = useState(0);
  const [autoPlay, setAutoPlay] = useState(() => !prefersReducedMotion());
  const timerRef = useRef(null);

  // Pull the live policy snapshot (falls back to the static copy silently).
  useEffect(() => { let on = true; loadGpsPolicy().then((p) => { if (on) setPolicy(p); }); return () => { on = false; }; }, []);

  // Gentle auto-advance through the stages until the reader takes over.
  useEffect(() => {
    if (!autoPlay) return undefined;
    timerRef.current = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 4200);
    return () => clearInterval(timerRef.current);
  }, [autoPlay]);

  const pickStage = (i) => { setAutoPlay(false); setStage(i); };
  const pickAmount = (a) => { setAutoPlay(false); setAmount(a); setStage((s) => (s === 0 ? 1 : s)); };

  const split = useMemo(() => splitAmount(amount, policy), [amount, policy]);

  const showSplit = stage >= 1;
  const showRegen = stage >= 2;
  const rippleOn = stage >= 3;

  // SVG geometry — fixed viewBox so nothing shifts as stages change.
  const W = 560; const H = 220;
  const srcX = 92; const srcY = H / 2;
  const provPath = `M ${srcX + 34} ${srcY} C ${srcX + 150} ${srcY}, 320 62, 440 62`;
  const envPath = `M ${srcX + 34} ${srcY} C ${srcX + 150} ${srcY}, 320 168, 440 168`;

  return (
    <section className="gpse" aria-label="What is GPS — the Global Prosperous Split protocol">
      {/* ── Definition ── */}
      <div className="gpse-head">
        <span className="gpse-eyebrow">The protocol</span>
        <h3 className="gpse-title">What is GPS?</h3>
        <p className="gpse-def">
          <strong>GPS — the Global Prosperous Split</strong> — is an open, Lightning-native protocol
          that lets a single payment reward the people and systems that made the value possible —
          automatically, transparently and within a clear limit. Regenerative value routing,
          configured by the identity that receives it.
        </p>
      </div>

      {/* ── Follow one payment ── */}
      <div className="gpse-flow-card">
        <div className="gpse-flow-top">
          <div>
            <div className="gpse-flow-kicker">Follow one payment</div>
            <div className="gpse-flow-sub">Pick an amount and watch where it goes.</div>
          </div>
          <div className="gpse-amounts" role="group" aria-label="Choose a demo amount">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                className={`gpse-amt ${amount === a ? 'on' : ''}`}
                onClick={() => pickAmount(a)}
                aria-pressed={amount === a}
              >${a}</button>
            ))}
          </div>
        </div>

        {/* Stage stepper */}
        <div className="gpse-stages" role="tablist" aria-label="Stages of a GPS payment">
          {STAGES.map((s, i) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={stage === i}
              className={`gpse-stage ${stage === i ? 'on' : ''} ${stage > i ? 'done' : ''}`}
              onClick={() => pickStage(i)}
            >
              <span className="gpse-stage-dot">{i + 1}</span>
              {s.label}
            </button>
          ))}
        </div>
        <p className="gpse-stage-copy" aria-live="polite">{STAGES[stage].copy}</p>

        {/* Split flow — hand-rolled SVG: payment → provider (hero) + envelope */}
        <div className="gpse-viz">
          <svg viewBox={`0 0 ${W} ${H}`} className="gpse-svg" role="img"
            aria-label={`A ${fmt(amount)} payment splitting: 90% to the practitioner, 10% into the GPS ecosystem envelope`}>
            <path d={provPath} className={`gpse-path ${showSplit ? 'live' : ''}`}
              style={{ stroke: '#2DB584', strokeWidth: 13 }} />
            <path d={envPath} className={`gpse-path ${showSplit ? 'live' : ''}`}
              style={{ stroke: '#C58A53', strokeWidth: 3.5, transitionDelay: '120ms' }} />
            {showSplit && (
              <>
                <circle r="4.5" fill="#2DB584" className="gpse-dot">
                  <animateMotion dur="2.4s" repeatCount="indefinite" path={provPath} />
                </circle>
                <circle r="3" fill="#C58A53" className="gpse-dot">
                  <animateMotion dur="2.8s" begin="0.4s" repeatCount="indefinite" path={envPath} />
                </circle>
              </>
            )}
            {/* source node */}
            <g className={`gpse-src ${rippleOn ? 'ripple' : ''}`}>
              <circle cx={srcX} cy={srcY} r="40" className="gpse-src-ring r1" />
              <circle cx={srcX} cy={srcY} r="52" className="gpse-src-ring r2" />
              <circle cx={srcX} cy={srcY} r="30" className="gpse-src-core" />
              <text x={srcX} y={srcY - 3} textAnchor="middle" className="gpse-src-amt">{`$${amount}`}</text>
              <text x={srcX} y={srcY + 13} textAnchor="middle" className="gpse-src-lbl">payment</text>
            </g>
            {/* branch percent tags */}
            <text x={300} y={84} textAnchor="middle" className={`gpse-tag hero ${showSplit ? 'live' : ''}`}>
              {bpsToPercent(policy.providerShareBps)}
            </text>
            <text x={300} y={148} textAnchor="middle" className={`gpse-tag ${showSplit ? 'live' : ''}`}>
              {bpsToPercent(policy.envelopeBps)} envelope
            </text>
          </svg>

          {/* the two destinations, aligned to the SVG rows */}
          <div className="gpse-dests">
            <div className={`gpse-dest hero ${showSplit ? 'live' : ''}`}>
              <div className="gpse-dest-pct">{bpsToPercent(policy.providerShareBps)}</div>
              <div className="gpse-dest-body">
                <div className="gpse-dest-name">Your practitioner</div>
                <div className="gpse-dest-copy"><strong>90% goes to your practitioner, always.</strong> Earned
                  value for the human who delivered the care — {showSplit ? fmt(split.provider.amount) : '—'} of this payment.</div>
              </div>
            </div>
            <div className={`gpse-dest ${showSplit ? 'live' : ''}`} style={{ transitionDelay: '140ms' }}>
              <div className="gpse-dest-pct env">{bpsToPercent(policy.envelopeBps)}</div>
              <div className="gpse-dest-body">
                <div className="gpse-dest-name">GPS ecosystem envelope</div>
                <div className="gpse-dest-copy">At most 10% of eligible value — constitutionally capped —
                  {' '}{showSplit ? fmt(split.envelope) : '—'} split across the regenerative recipients below.</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── The 10% envelope subdivision ── */}
        <div className={`gpse-env ${showSplit ? 'live' : ''}`}>
          <div className="gpse-env-kicker">Inside the {bpsToPercent(policy.envelopeBps)} envelope — Solaris default recipients</div>
          <div className="gpse-env-bar" role="img" aria-label="Subdivision of the GPS ecosystem envelope">
            {policy.envelopeRecipients.map((r) => (
              <span key={r.key} className="gpse-env-seg" title={`${r.label} — ${bpsToPercent(r.shareBps)} of the payment`}
                style={{ flexGrow: r.shareBps, background: ENVELOPE_COLORS[r.key] || '#8fa39c' }} />
            ))}
          </div>
          <div className="gpse-env-grid">
            {policy.envelopeRecipients.map((r, i) => {
              const part = split.parts.find((p) => p.key === r.key);
              return (
                <div key={r.key} className={`gpse-env-item ${showSplit ? 'live' : ''}`} style={{ transitionDelay: `${i * 60}ms` }}>
                  <div className="gpse-env-head">
                    <span className="gpse-rec-swatch" style={{ background: ENVELOPE_COLORS[r.key] || '#8fa39c' }} />
                    <span className="gpse-env-name">{r.label}</span>
                    <span className="gpse-env-pct">{bpsToPercent(r.shareBps)}</span>
                    <span className="gpse-env-val">{showSplit && part ? fmt(part.amount) : '—'}</span>
                  </div>
                  <div className={`gpse-rec-regen ${showRegen ? 'live' : ''}`}>{r.regenerates}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="gpse-flow-note">
          <Zap size={11} style={{ verticalAlign: '-1.5px', marginRight: 4 }} />
          Simulated — illustrative values, no real money moves. Policy <code>{policy.policy.id}</code> is
          the Solaris launch profile, not the universal GPS standard: the receiving identity can change
          this configuration, and the receipt always shows the actual distribution.
        </div>
      </div>

      {/* ── Receipt showcase ── */}
      <GpsReceiptShowcase amount={amount} policy={policy} split={split} />

      {/* ── Zoom out: the ripple ── */}
      <div className={`gpse-ripple ${rippleOn ? 'on' : ''}`}>
        <div className="gpse-ripple-head">
          <div className="gpse-flow-kicker light">Zoom out</div>
          <div className="gpse-ripple-title">One payment is a drop. The protocol is the tide.</div>
        </div>
        <div className="gpse-ripple-grid">
          {RIPPLES.map((r, i) => (
            <div key={r.key} className="gpse-ripple-item" style={{ transitionDelay: `${i * 110}ms` }}>
              <div className="gpse-ripple-rings" aria-hidden="true">
                {Array.from({ length: i + 1 }).map((_, j) => (
                  <span key={j} className="gpse-ring" style={{ width: 14 + j * 12, height: 14 + j * 12, opacity: 1 - j * 0.22 }} />
                ))}
              </div>
              <div className="gpse-ripple-lbl">{r.label}</div>
              <div className="gpse-ripple-copy">{r.copy}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Protocol truths ── */}
      <div className="gpse-truths">
        {TRUTHS.map(({ Icon, title, copy }) => (
          <div key={title} className="gpse-truth">
            <div className="gpse-truth-ico"><Icon size={15} /></div>
            <div>
              <div className="gpse-truth-title">{title}</div>
              <div className="gpse-truth-copy">{copy}</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .luca .gpse{display:flex;flex-direction:column;gap:16px}
        .luca .gpse-head{max-width:680px}
        .luca .gpse-eyebrow{font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--teal-d,#0E5C57)}
        .luca .gpse-title{margin:4px 0 6px;font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;color:var(--ink,#0A2B29);line-height:1.15}
        .luca .gpse-def{margin:0;font-size:14px;line-height:1.65;color:var(--muted,#6b807a)}
        .luca .gpse-def strong{color:var(--ink,#0A2B29)}

        .luca .gpse-flow-card{background:var(--surface,#fff);border:1px solid var(--line,#e3ece8);border-radius:var(--r,16px);
          box-shadow:var(--shadow-sm,0 1px 2px rgba(10,43,41,.05));padding:18px 18px 14px;overflow:hidden}
        .luca .gpse-flow-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .luca .gpse-flow-kicker{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--gold-ink,#8A5A2B)}
        .luca .gpse-flow-kicker.light{color:rgba(231,248,243,.65)}
        .luca .gpse-flow-sub{font-size:12.5px;color:var(--muted-2,#8fa39c);margin-top:2px}
        .luca .gpse-amounts{display:flex;gap:6px}
        .luca .gpse-amt{border:1px solid var(--line,#e3ece8);background:var(--surface-2,#F6FAF8);color:var(--ink,#0A2B29);
          font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13.5px;padding:7px 14px;border-radius:999px;cursor:pointer;
          transition:all .18s ease}
        .luca .gpse-amt.on{background:var(--ink,#0A2B29);border-color:var(--ink,#0A2B29);color:#fff}
        .luca .gpse-stages{display:flex;gap:6px;margin-top:14px;flex-wrap:wrap}
        .luca .gpse-stage{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line,#e3ece8);background:none;
          color:var(--muted,#6b807a);font-size:12.5px;font-weight:600;padding:6px 12px 6px 7px;border-radius:999px;cursor:pointer;
          transition:all .18s ease}
        .luca .gpse-stage-dot{width:18px;height:18px;border-radius:50%;background:var(--surface-2,#F6FAF8);
          display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700}
        .luca .gpse-stage.on{border-color:var(--teal-d,#0E5C57);color:var(--teal-d,#0E5C57);background:var(--mint-soft,#E7F5EF)}
        .luca .gpse-stage.on .gpse-stage-dot{background:var(--teal-d,#0E5C57);color:#fff}
        .luca .gpse-stage.done{color:var(--ink,#0A2B29)}
        .luca .gpse-stage-copy{margin:10px 0 0;font-size:13px;line-height:1.55;color:var(--ink,#0A2B29);min-height:40px}

        .luca .gpse-viz{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(230px,1fr);gap:10px;align-items:center;margin-top:4px}
        .luca .gpse-svg{width:100%;height:auto;display:block}
        .luca .gpse-path{fill:none;stroke-linecap:round;opacity:.14;stroke-dasharray:6 7;transition:opacity .5s ease}
        .luca .gpse-path.live{opacity:.8;animation:gpse-flow 1.6s linear infinite}
        @keyframes gpse-flow{to{stroke-dashoffset:-26}}
        .luca .gpse-tag{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:12px;fill:var(--muted-2,#8fa39c);
          opacity:0;transition:opacity .5s ease}
        .luca .gpse-tag.live{opacity:1}
        .luca .gpse-tag.hero{fill:#2DB584;font-size:16px}
        .luca .gpse-src-core{fill:var(--ink,#0A2B29)}
        .luca .gpse-src-ring{fill:none;stroke:var(--teal-d,#0E5C57);opacity:.22}
        .luca .gpse-src.ripple .gpse-src-ring.r1{animation:gpse-pulse 2.4s ease-out infinite}
        .luca .gpse-src.ripple .gpse-src-ring.r2{animation:gpse-pulse 2.4s ease-out infinite 1.2s}
        @keyframes gpse-pulse{0%{transform:scale(.86);opacity:.4}100%{transform:scale(1.18);opacity:0}}
        .luca .gpse-src-ring{transform-origin:92px 110px;transform-box:view-box}
        .luca .gpse-src-amt{fill:#fff;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px}
        .luca .gpse-src-lbl{fill:rgba(255,255,255,.66);font-size:9px;letter-spacing:.8px;text-transform:uppercase}

        .luca .gpse-dests{display:flex;flex-direction:column;gap:10px}
        .luca .gpse-dest{display:flex;gap:12px;align-items:flex-start;background:var(--surface-2,#F6FAF8);
          border:1px solid var(--line,#e3ece8);border-radius:12px;padding:12px 14px;
          opacity:.45;transform:translateX(6px);transition:opacity .45s ease,transform .45s ease}
        .luca .gpse-dest.live{opacity:1;transform:none}
        .luca .gpse-dest.hero{background:linear-gradient(135deg,#EAF7F1 0%,#F3FBF7 100%);border-color:#BFE6D6}
        .luca .gpse-dest-pct{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:26px;color:#2DB584;line-height:1;flex:none;min-width:64px}
        .luca .gpse-dest-pct.env{color:#C58A53;font-size:20px;margin-top:2px}
        .luca .gpse-dest-name{font-size:13px;font-weight:700;color:var(--ink,#0A2B29)}
        .luca .gpse-dest-copy{font-size:12px;line-height:1.55;color:var(--muted,#6b807a);margin-top:3px}
        .luca .gpse-dest-copy strong{color:var(--ink,#0A2B29)}

        .luca .gpse-env{margin-top:14px;opacity:.5;transition:opacity .5s ease}
        .luca .gpse-env.live{opacity:1}
        .luca .gpse-env-kicker{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted-2,#8fa39c);margin-bottom:8px}
        .luca .gpse-env-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;gap:2px}
        .luca .gpse-env-seg{display:block;min-width:4px}
        .luca .gpse-env-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:8px;margin-top:10px}
        .luca .gpse-env-item{background:var(--surface-2,#F6FAF8);border:1px solid var(--line,#e3ece8);border-radius:11px;
          padding:9px 12px;opacity:.5;transform:translateY(4px);transition:opacity .45s ease,transform .45s ease}
        .luca .gpse-env-item.live{opacity:1;transform:none}
        .luca .gpse-env-head{display:flex;align-items:center;gap:8px}
        .luca .gpse-rec-swatch{width:9px;height:9px;border-radius:3px;flex:none;display:inline-block}
        .luca .gpse-env-name{font-size:12px;font-weight:700;color:var(--ink,#0A2B29);min-width:0;flex:1}
        .luca .gpse-env-pct{font-size:10.5px;font-weight:700;color:var(--muted-2,#8fa39c);letter-spacing:.4px}
        .luca .gpse-env-val{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:12.5px;min-width:48px;text-align:right;color:var(--ink,#0A2B29)}
        .luca .gpse-rec-regen{font-size:11.5px;line-height:1.5;color:var(--muted,#6b807a);max-height:0;overflow:hidden;
          opacity:0;transition:max-height .5s ease,opacity .5s ease,margin .5s ease;margin-top:0}
        .luca .gpse-rec-regen.live{max-height:60px;opacity:1;margin-top:5px}
        .luca .gpse-flow-note{margin-top:14px;padding-top:10px;border-top:1px dashed var(--line,#e3ece8);
          font-size:11px;line-height:1.55;color:var(--muted-2,#8fa39c)}
        .luca .gpse-flow-note code,.luca .gpse-receipt-sub code{font-size:10px;background:var(--surface-2,#F6FAF8);padding:1px 5px;border-radius:5px}

        .luca .gpse-receipt{background:var(--surface,#fff);border:1px solid var(--line,#e3ece8);border-radius:var(--r,16px);
          box-shadow:var(--shadow-sm,0 1px 2px rgba(10,43,41,.05));padding:18px;display:grid;
          grid-template-columns:minmax(220px,1fr) minmax(280px,1.1fr);gap:18px;align-items:start}
        .luca .gpse-receipt-top{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
        .luca .gpse-receipt-title{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--ink,#0A2B29);margin-top:2px}
        .luca .gpse-receipt-sub{font-size:12.5px;line-height:1.6;color:var(--muted,#6b807a)}
        .luca .gpse-sim-badge{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8A5A2B;
          background:#FBF3E7;border:1px solid #EAD9BE;border-radius:999px;padding:3px 10px;margin-top:4px}
        .luca .gpse-receipt-paper{background:var(--surface-2,#FBFDFC);border:1px solid var(--line,#e3ece8);border-radius:12px;
          padding:14px 16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}
        .luca .gpse-receipt-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
        .luca .gpse-receipt-brand{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;letter-spacing:1.5px;color:var(--ink,#0A2B29)}
        .luca .gpse-receipt-ver{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:var(--muted-2,#8fa39c)}
        .luca .gpse-receipt-meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 14px;margin:0 0 4px}
        .luca .gpse-receipt-meta div{display:flex;justify-content:space-between;gap:8px;min-width:0}
        .luca .gpse-receipt-meta dt{font-size:10px;color:var(--muted-2,#8fa39c);letter-spacing:.3px}
        .luca .gpse-receipt-meta dd{margin:0;font-size:10px;color:var(--ink,#0A2B29);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .luca .gpse-receipt .mono{font-family:ui-monospace,'SF Mono',Menlo,monospace}
        .luca .gpse-receipt-rule{border-top:1px dashed var(--line,#dbe7e1);margin:9px 0}
        .luca .gpse-receipt-line{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:var(--ink,#0A2B29);padding:2.5px 0}
        .luca .gpse-receipt-line.total{font-weight:700}
        .luca .gpse-receipt-line.hero{font-weight:700;color:#177a56}
        .luca .gpse-receipt-line.envelope{font-weight:600;color:#8A5A2B}
        .luca .gpse-receipt-line.alloc{font-size:11px;color:var(--muted,#6b807a);padding-left:12px}
        .luca .gpse-receipt-line.alloc .gpse-rec-swatch{margin-right:6px;width:7px;height:7px}
        .luca .gpse-receipt-line.small{font-size:10.5px;color:var(--muted,#6b807a)}
        .luca .gpse-receipt .ok{color:#177a56;font-weight:700}
        .luca .gpse-receipt-note{margin-top:9px;font-size:10.5px;line-height:1.5;color:var(--muted-2,#8fa39c)}

        .luca .gpse-ripple{border-radius:var(--r,16px);padding:20px 18px;color:#E7F8F3;
          background:linear-gradient(135deg,#0A2B29 0%,#0E5C57 68%,#134d3a 100%);overflow:hidden}
        .luca .gpse-ripple-title{font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:700;margin-top:3px;line-height:1.3}
        .luca .gpse-ripple-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-top:16px}
        .luca .gpse-ripple-item{opacity:.55;transform:translateY(4px);transition:opacity .5s ease,transform .5s ease}
        .luca .gpse-ripple.on .gpse-ripple-item{opacity:1;transform:none}
        .luca .gpse-ripple-rings{position:relative;height:56px;display:flex;align-items:center;justify-content:flex-start}
        .luca .gpse-ring{position:absolute;border:1.5px solid #2DB584;border-radius:50%;
          left:24px;top:50%;transform:translate(-50%,-50%)}
        .luca .gpse-ripple.on .gpse-ring{animation:gpse-breathe 3.4s ease-in-out infinite}
        @keyframes gpse-breathe{50%{transform:translate(-50%,-50%) scale(1.12)}}
        .luca .gpse-ripple-lbl{font-size:13px;font-weight:700;color:#fff}
        .luca .gpse-ripple-copy{font-size:12px;line-height:1.55;color:rgba(231,248,243,.75);margin-top:4px}

        .luca .gpse-truths{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
        .luca .gpse-truth{display:flex;gap:10px;align-items:flex-start;background:var(--surface,#fff);
          border:1px solid var(--line,#e3ece8);border-radius:12px;padding:12px 13px}
        .luca .gpse-truth-ico{width:28px;height:28px;flex:none;border-radius:9px;display:flex;align-items:center;justify-content:center;
          background:var(--mint-soft,#E7F5EF);color:var(--teal-d,#0E5C57)}
        .luca .gpse-truth-title{font-size:12.5px;font-weight:700;color:var(--ink,#0A2B29)}
        .luca .gpse-truth-copy{font-size:11.5px;line-height:1.5;color:var(--muted,#6b807a);margin-top:2px}

        @media (max-width: 760px){
          .luca .gpse-viz{grid-template-columns:1fr}
          .luca .gpse-receipt{grid-template-columns:1fr}
        }
        @media (prefers-reduced-motion: reduce){
          .luca .gpse-path.live{animation:none}
          .luca .gpse-dot{display:none}
          .luca .gpse-src.ripple .gpse-src-ring.r1,.luca .gpse-src.ripple .gpse-src-ring.r2{animation:none}
          .luca .gpse-ripple.on .gpse-ring{animation:none}
          .luca .gpse-dest,.luca .gpse-env-item,.luca .gpse-rec-regen,.luca .gpse-ripple-item,.luca .gpse-path,.luca .gpse-tag{transition:none}
        }
      `}</style>
    </section>
  );
}
