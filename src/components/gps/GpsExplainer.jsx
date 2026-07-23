/**
 * GpsExplainer — "What is GPS?"
 *
 * The first thing anyone sees on the Economic Passport page. Explains
 * Generative Payment Splits to a member, investor, partner or government
 * official in one scroll: a plain-language definition, an interactive
 * "follow one payment" split flow, a zoom-out ripple (you → community →
 * nation → world) and the protocol truths.
 *
 * Everything here is illustrative — simulated values, no real money moves.
 * Pure frontend: hand-rolled SVG + CSS, no chart libraries.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, Unlock, Fingerprint, Landmark, ReceiptText } from 'lucide-react';

const AMOUNTS = [50, 100, 200];

/* Solaris default split (gps-split-v1), grouped into the four stories a
   first-time reader can hold. Fractions sum to 1. */
const BRANCHES = [
  {
    key: 'practitioner',
    label: 'Practitioner',
    pct: 0.85,
    pctLabel: '85%',
    color: '#2DB584',
    regen: 'A sovereign income for the human who actually delivered the care.',
  },
  {
    key: 'community',
    label: 'Community fund + you',
    pct: 0.05,
    pctLabel: '3% + 2%',
    color: '#C58A53',
    regen: 'Feeds the regenerative commons — and credits you back for participating.',
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure & software',
    pct: 0.05,
    pctLabel: '3% + 2%',
    color: '#6B7FD7',
    regen: 'Keeps local nodes running and the open-source software maintained.',
  },
  {
    key: 'builder',
    label: 'Ecosystem builder',
    pct: 0.05,
    pctLabel: '5%',
    color: '#5E7F2C',
    regen: 'Rewards whoever grew the network that made this connection possible.',
  },
];

const STAGES = [
  { key: 'payment', label: 'Payment', copy: 'One person pays for one service — a single payment, like any other.' },
  { key: 'split', label: 'Split', copy: 'The protocol splits it automatically, the moment it arrives. No invoices, no middlemen, no waiting.' },
  { key: 'regenerate', label: 'Regenerate', copy: 'Every share lands where it regenerates something — a livelihood, a commons, the rails themselves.' },
  { key: 'ripple', label: 'Ripple', copy: 'Multiply by every payment, every day. Value stops leaking out and starts circulating.' },
];

const RIPPLES = [
  { key: 'you', label: 'You', copy: 'Every payment you make leaves a verifiable trail — and sends a share back to you.' },
  { key: 'community', label: 'Community', copy: 'Local funds fill up from local activity. Your neighbourhood finances itself.' },
  { key: 'nation', label: 'Nation', copy: 'Care economies stop extracting to distant shareholders and start compounding at home.' },
  { key: 'world', label: 'World', copy: 'An open protocol anyone can adopt — a circulatory system for a regenerative economy.' },
];

const TRUTHS = [
  { Icon: GitBranch, title: 'Open-source protocol', copy: 'GPS is a standalone, open protocol — read it, run it, build on it.' },
  { Icon: Unlock, title: 'No one controls it', copy: 'No middlemen, no gatekeeper, no central authority deciding who gets paid.' },
  { Icon: Fingerprint, title: 'Identity-first', copy: 'Your identity holds your split configuration. The receiver decides, not a platform.' },
  { Icon: Landmark, title: 'Solaris is only the default', copy: 'Solaris is the default recipient config until you set your own end address — a Lightning address today, more rails later.' },
  { Icon: ReceiptText, title: 'Every split leaves a receipt', copy: 'Each allocation produces evidence anyone with access can verify.' },
];

const fmt = (n) => `$${n.toFixed(2)}`;

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
};

export default function GpsExplainer() {
  const [amount, setAmount] = useState(100);
  const [stage, setStage] = useState(0);
  const [autoPlay, setAutoPlay] = useState(() => !prefersReducedMotion());
  const timerRef = useRef(null);

  // Gentle auto-advance through the stages until the reader takes over.
  useEffect(() => {
    if (!autoPlay) return undefined;
    timerRef.current = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 4200);
    return () => clearInterval(timerRef.current);
  }, [autoPlay]);

  const pickStage = (i) => { setAutoPlay(false); setStage(i); };
  const pickAmount = (a) => { setAutoPlay(false); setAmount(a); setStage((s) => (s === 0 ? 1 : s)); };

  const shares = useMemo(() => BRANCHES.map((b) => ({ ...b, value: amount * b.pct })), [amount]);

  const showBranches = stage >= 1;
  const showRegen = stage >= 2;
  const rippleOn = stage >= 3;

  // SVG geometry — fixed viewBox so nothing shifts as stages change.
  const W = 560; const H = 300;
  const srcX = 92; const srcY = H / 2;
  const dstX = 340;
  const rows = [46, 118, 190, 262];

  return (
    <section className="gpse" aria-label="What is GPS — Generative Payment Splits">
      {/* ── Definition ── */}
      <div className="gpse-head">
        <span className="gpse-eyebrow">The protocol</span>
        <h3 className="gpse-title">What is GPS?</h3>
        <p className="gpse-def">
          <strong>GPS — Generative Payment Splits</strong> — is an open protocol where every payment
          automatically splits value to the people and communities that make the service possible.
          It's configured by the identity that receives it — and controlled by no one.
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

        {/* Split flow — hand-rolled SVG */}
        <div className="gpse-viz">
          <svg viewBox={`0 0 ${W} ${H}`} className="gpse-svg" role="img"
            aria-label={`A ${fmt(amount)} payment splitting into four shares`}>
            {/* branch paths */}
            {shares.map((b, i) => {
              const y = rows[i];
              const d = `M ${srcX + 34} ${srcY} C ${srcX + 130} ${srcY}, ${dstX - 120} ${y}, ${dstX - 8} ${y}`;
              return (
                <g key={b.key}>
                  <path d={d} className={`gpse-path ${showBranches ? 'live' : ''}`}
                    style={{ stroke: b.color, strokeWidth: Math.max(2, b.pct * 16), transitionDelay: `${i * 90}ms` }} />
                  {showBranches && (
                    <circle r="3.5" fill={b.color} className="gpse-dot" style={{ animationDelay: `${i * 0.35}s` }}>
                      <title>share travelling</title>
                      <animateMotion dur="2.6s" begin={`${i * 0.35}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  )}
                </g>
              );
            })}
            {/* source node */}
            <g className={`gpse-src ${rippleOn ? 'ripple' : ''}`}>
              <circle cx={srcX} cy={srcY} r="40" className="gpse-src-ring r1" />
              <circle cx={srcX} cy={srcY} r="52" className="gpse-src-ring r2" />
              <circle cx={srcX} cy={srcY} r="30" className="gpse-src-core" />
              <text x={srcX} y={srcY - 3} textAnchor="middle" className="gpse-src-amt">{`$${amount}`}</text>
              <text x={srcX} y={srcY + 13} textAnchor="middle" className="gpse-src-lbl">payment</text>
            </g>
          </svg>

          {/* recipient rows — HTML overlay aligned to the SVG rows */}
          <div className="gpse-recipients">
            {shares.map((b, i) => (
              <div key={b.key} className={`gpse-rec ${showBranches ? 'live' : ''}`} style={{ transitionDelay: `${120 + i * 90}ms` }}>
                <div className="gpse-rec-head">
                  <span className="gpse-rec-swatch" style={{ background: b.color }} />
                  <span className="gpse-rec-name">{b.label}</span>
                  <span className="gpse-rec-pct">{b.pctLabel}</span>
                  <span className="gpse-rec-val" style={{ color: b.color }}>{showBranches ? fmt(b.value) : '—'}</span>
                </div>
                <div className={`gpse-rec-regen ${showRegen ? 'live' : ''}`}>{b.regen}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="gpse-flow-note">
          Illustrative only — Solaris default split (<code>gps-split-v1</code>), simulated values, no real money moves.
          The receiving identity can change this configuration at any time.
        </div>
      </div>

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
        .luca .gpse-head{max-width:640px}
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

        .luca .gpse-viz{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(220px,1fr);gap:8px;align-items:center;margin-top:4px}
        .luca .gpse-svg{width:100%;height:auto;display:block}
        .luca .gpse-path{fill:none;stroke-linecap:round;opacity:.15;stroke-dasharray:6 7;transition:opacity .5s ease}
        .luca .gpse-path.live{opacity:.75;animation:gpse-flow 1.6s linear infinite}
        @keyframes gpse-flow{to{stroke-dashoffset:-26}}
        .luca .gpse-src-core{fill:var(--ink,#0A2B29)}
        .luca .gpse-src-ring{fill:none;stroke:var(--teal-d,#0E5C57);opacity:.22}
        .luca .gpse-src.ripple .gpse-src-ring.r1{animation:gpse-pulse 2.4s ease-out infinite}
        .luca .gpse-src.ripple .gpse-src-ring.r2{animation:gpse-pulse 2.4s ease-out infinite 1.2s}
        @keyframes gpse-pulse{0%{transform:scale(.86);opacity:.4}100%{transform:scale(1.18);opacity:0}}
        .luca .gpse-src-ring{transform-origin:92px 150px;transform-box:view-box}
        .luca .gpse-src-amt{fill:#fff;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px}
        .luca .gpse-src-lbl{fill:rgba(255,255,255,.66);font-size:9px;letter-spacing:.8px;text-transform:uppercase}
        .luca .gpse-recipients{display:flex;flex-direction:column;justify-content:space-between;gap:8px;min-height:280px;padding:6px 0}
        .luca .gpse-rec{background:var(--surface-2,#F6FAF8);border:1px solid var(--line,#e3ece8);border-radius:12px;
          padding:9px 12px;opacity:.45;transform:translateX(6px);transition:opacity .45s ease,transform .45s ease}
        .luca .gpse-rec.live{opacity:1;transform:none}
        .luca .gpse-rec-head{display:flex;align-items:center;gap:8px}
        .luca .gpse-rec-swatch{width:9px;height:9px;border-radius:3px;flex:none}
        .luca .gpse-rec-name{font-size:12.5px;font-weight:700;color:var(--ink,#0A2B29);min-width:0;flex:1}
        .luca .gpse-rec-pct{font-size:10.5px;font-weight:700;color:var(--muted-2,#8fa39c);letter-spacing:.4px}
        .luca .gpse-rec-val{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13.5px;min-width:56px;text-align:right}
        .luca .gpse-rec-regen{font-size:11.5px;line-height:1.5;color:var(--muted,#6b807a);max-height:0;overflow:hidden;
          opacity:0;transition:max-height .5s ease,opacity .5s ease,margin .5s ease;margin-top:0}
        .luca .gpse-rec-regen.live{max-height:60px;opacity:1;margin-top:5px}
        .luca .gpse-flow-note{margin-top:12px;padding-top:10px;border-top:1px dashed var(--line,#e3ece8);
          font-size:11px;line-height:1.55;color:var(--muted-2,#8fa39c)}
        .luca .gpse-flow-note code{font-size:10px;background:var(--surface-2,#F6FAF8);padding:1px 5px;border-radius:5px}

        .luca .gpse-ripple{border-radius:var(--r,16px);padding:20px 18px;color:#E7F8F3;
          background:linear-gradient(135deg,#0A2B29 0%,#0E5C57 68%,#134d3a 100%);overflow:hidden}
        .luca .gpse-ripple-title{font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:700;margin-top:3px;line-height:1.3}
        .luca .gpse-ripple-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-top:16px}
        .luca .gpse-ripple-item{opacity:.55;transform:translateY(4px);transition:opacity .5s ease,transform .5s ease}
        .luca .gpse-ripple.on .gpse-ripple-item{opacity:1;transform:none}
        .luca .gpse-ripple-rings{position:relative;height:56px;display:flex;align-items:center;justify-content:flex-start}
        .luca .gpse-ring{position:absolute;left:0;border:1.5px solid #2DB584;border-radius:50%;
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

        @media (max-width: 720px){
          .luca .gpse-viz{grid-template-columns:1fr}
          .luca .gpse-recipients{min-height:0}
        }
        @media (prefers-reduced-motion: reduce){
          .luca .gpse-path.live{animation:none}
          .luca .gpse-dot{display:none}
          .luca .gpse-src.ripple .gpse-src-ring.r1,.luca .gpse-src.ripple .gpse-src-ring.r2{animation:none}
          .luca .gpse-ripple.on .gpse-ring{animation:none}
          .luca .gpse-rec,.luca .gpse-rec-regen,.luca .gpse-ripple-item,.luca .gpse-path{transition:none}
        }
      `}</style>
    </section>
  );
}
