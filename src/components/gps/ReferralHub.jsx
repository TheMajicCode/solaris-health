/**
 * ReferralHub — "Become an Ecosystem Builder".
 *
 * Every member gets a personal referral code. When someone they refer books
 * care, the referrer earns 5% of that booking through the GPS contributor
 * share. Shows the code, share tools, referral stats, and a leaderboard.
 */

import React, { useEffect, useState } from 'react';
import {
  Copy, Check, Share2, Users, Trophy, Coins, Gift, Loader2, Sprout, Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

export default function ReferralHub() {
  const [code, setCode] = useState(null);
  const [link, setLink] = useState('');
  const [earnings, setEarnings] = useState(null);
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, e, l] = await Promise.all([
          api.getReferralCode().catch(() => null),
          api.getReferralEarnings().catch(() => null),
          api.getGpsLeaderboard().catch(() => ({ leaderboard: [] })),
        ]);
        if (!alive) return;
        if (c) { setCode(c.code); setLink(c.link); }
        setEarnings(e);
        setBoard(l?.leaderboard || []);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const copy = (text, which) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(which); toast.success('Copied!');
      setTimeout(() => setCopied(''), 1800);
    }).catch(() => toast.error('Could not copy'));
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`Join me on Solaris Health — sovereign, regenerative healthcare. Use my code ${code}: ${link}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const sum = earnings?.summary || {};
  const referrals = earnings?.referrals || [];

  if (loading) return <div className="rfh-loading"><Loader2 className="rfh-spin" size={22} /> Loading your builder hub…</div>;

  return (
    <div className="rfh">
      <div className="rfh-hero">
        <div className="rfh-hero-badge"><Sprout size={13} /> Ecosystem Builder</div>
        <h2 className="rfh-hero-h">Become an Ecosystem Builder</h2>
        <p className="rfh-hero-sub">Share Solaris Health. Earn <b>5%</b> of any booking from someone you refer — value flows to where value was created.</p>

        <div className="rfh-code-wrap">
          <div className="rfh-code-block">
            <span className="rfh-code-lbl">Your referral code</span>
            <span className="rfh-code">{code || '—'}</span>
          </div>
          <button className="rfh-copy" onClick={() => copy(code, 'code')}>
            {copied === 'code' ? <Check size={15} /> : <Copy size={15} />} {copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
        </div>

        <div className="rfh-link-row">
          <Link2 size={14} />
          <span className="rfh-link">{link}</span>
          <button className="rfh-link-btn" onClick={() => copy(link, 'link')}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
          <button className="rfh-link-btn wa" onClick={shareWhatsApp}><Share2 size={13} /> WhatsApp</button>
        </div>
      </div>

      <div className="rfh-stats">
        <Stat icon={Users} label="People joined" value={referrals.length} />
        <Stat icon={Gift} label="Rewards earned" value={sum.reward_count || 0} />
        <Stat icon={Coins} label="Total earned" value={money(sum.total_earned)} />
        <Stat icon={Coins} label="Pending" value={money(sum.pending)} tone="muted" />
      </div>

      <div className="rfh-grid">
        <div className="rfh-panel">
          <h3 className="rfh-panel-h"><Users size={15} /> Who you've brought in</h3>
          {referrals.length === 0 ? (
            <p className="rfh-empty">No one yet — share your code to start growing the regenerative economy. You earn 5% every time they book care.</p>
          ) : (
            <div className="rfh-ref-list">
              {referrals.map((r, i) => (
                <div className="rfh-ref" key={i}>
                  <div className="rfh-ref-av">{(r.full_name || '?').slice(0, 1).toUpperCase()}</div>
                  <div className="rfh-ref-meta">
                    <span className="rfh-ref-name">{r.full_name || 'New member'}</span>
                    <span className="rfh-ref-sub">{r.bookings || 0} booking{Number(r.bookings) === 1 ? '' : 's'}</span>
                  </div>
                  <span className="rfh-ref-earned">{money(r.earned)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rfh-panel">
          <h3 className="rfh-panel-h"><Trophy size={15} /> Top ecosystem builders</h3>
          {board.length === 0 ? (
            <p className="rfh-empty">The leaderboard is just getting started. Be the first to build the commons.</p>
          ) : (
            <div className="rfh-board">
              {board.map((b) => (
                <div className="rfh-board-row" key={b.rank}>
                  <span className={`rfh-rank r${b.rank <= 3 ? b.rank : 'x'}`}>{b.rank}</span>
                  <span className="rfh-board-init">{b.initials}</span>
                  <span className="rfh-board-refs">{b.referral_count} referral{b.referral_count === 1 ? '' : 's'}</span>
                  <span className="rfh-board-amt">{money(b.total_earned)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .luca .rfh{display:flex;flex-direction:column;gap:16px}
        .luca .rfh-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:40px;color:var(--muted)}
        .luca .rfh-spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .luca .rfh-hero{background:linear-gradient(155deg,#0E7C66,#0a5c4c);color:#fff;border-radius:var(--r-lg);
          padding:24px;box-shadow:var(--shadow);position:relative;overflow:hidden}
        .luca .rfh-hero::after{content:'';position:absolute;right:-30px;bottom:-50px;width:180px;height:180px;border-radius:50%;
          background:radial-gradient(circle,rgba(227,172,70,.25),transparent 70%)}
        .luca .rfh-hero-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;
          background:rgba(255,255,255,.15);padding:4px 10px;border-radius:99px}
        .luca .rfh-hero-h{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;margin:10px 0 4px}
        .luca .rfh-hero-sub{font-size:13.5px;opacity:.92;max-width:540px;margin:0 0 16px}
        .luca .rfh-code-wrap{display:flex;align-items:stretch;gap:10px;flex-wrap:wrap}
        .luca .rfh-code-block{background:rgba(255,255,255,.14);border-radius:var(--r);padding:10px 18px;
          display:flex;flex-direction:column;gap:2px}
        .luca .rfh-code-lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
        .luca .rfh-code{font-family:'IBM Plex Mono',monospace;font-size:26px;font-weight:700;letter-spacing:.18em}
        .luca .rfh-copy{background:var(--gold);color:#3a2c07;border:none;border-radius:var(--r);padding:0 18px;
          font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
        .luca .rfh-copy:hover{filter:brightness(1.05)}
        .luca .rfh-link-row{display:flex;align-items:center;gap:8px;margin-top:14px;background:rgba(0,0,0,.18);
          border-radius:99px;padding:7px 8px 7px 14px;flex-wrap:wrap}
        .luca .rfh-link{flex:1;min-width:180px;font-size:12.5px;font-family:'IBM Plex Mono',monospace;opacity:.95;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .luca .rfh-link-btn{background:rgba(255,255,255,.16);border:none;color:#fff;font-size:12px;font-weight:600;
          padding:6px 12px;border-radius:99px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
        .luca .rfh-link-btn:hover{background:rgba(255,255,255,.28)}
        .luca .rfh-link-btn.wa{background:#25D366;color:#053}
        .luca .rfh-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        @media(max-width:820px){.luca .rfh-stats{grid-template-columns:repeat(2,1fr)}}
        .luca .rfh-stat{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;
          box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:4px}
        .luca .rfh-stat-ico{width:30px;height:30px;border-radius:9px;background:var(--mint-soft);color:var(--teal-d);
          display:flex;align-items:center;justify-content:center}
        .luca .rfh-stat-val{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700;color:var(--ink)}
        .luca .rfh-stat-val.muted{color:var(--muted)}
        .luca .rfh-stat-lbl{font-size:11.5px;color:var(--muted-2)}
        .luca .rfh-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:820px){.luca .rfh-grid{grid-template-columns:1fr}}
        .luca .rfh-panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px;box-shadow:var(--shadow-sm)}
        .luca .rfh-panel-h{display:flex;align-items:center;gap:7px;font-family:'Space Grotesk',sans-serif;font-size:15px;
          font-weight:600;color:var(--ink);margin:0 0 12px}
        .luca .rfh-empty{font-size:13px;color:var(--muted);margin:0}
        .luca .rfh-ref-list{display:flex;flex-direction:column;gap:8px}
        .luca .rfh-ref{display:flex;align-items:center;gap:10px}
        .luca .rfh-ref-av{width:32px;height:32px;border-radius:50%;background:var(--mint);color:var(--teal-d);
          display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex:none}
        .luca .rfh-ref-meta{flex:1;display:flex;flex-direction:column}
        .luca .rfh-ref-name{font-size:13px;font-weight:600;color:var(--ink)}
        .luca .rfh-ref-sub{font-size:11px;color:var(--muted-2)}
        .luca .rfh-ref-earned{font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--teal-d)}
        .luca .rfh-board{display:flex;flex-direction:column;gap:6px}
        .luca .rfh-board-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line)}
        .luca .rfh-board-row:last-child{border-bottom:none}
        .luca .rfh-rank{width:22px;height:22px;border-radius:50%;background:var(--surface-2);color:var(--muted);
          display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex:none}
        .luca .rfh-rank.r1{background:#F6D67A;color:#5a4400}
        .luca .rfh-rank.r2{background:#Dfe3e8;color:#485}
        .luca .rfh-rank.r3{background:#EBC79A;color:#6a4a1e}
        .luca .rfh-board-init{flex:1;font-weight:600;font-size:13px;color:var(--ink);letter-spacing:.04em}
        .luca .rfh-board-refs{font-size:11.5px;color:var(--muted-2)}
        .luca .rfh-board-amt{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;color:var(--teal-d)}
      `}</style>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="rfh-stat">
      <div className="rfh-stat-ico"><Icon size={16} /></div>
      <div className={`rfh-stat-val ${tone || ''}`}>{value}</div>
      <div className="rfh-stat-lbl">{label}</div>
    </div>
  );
}
