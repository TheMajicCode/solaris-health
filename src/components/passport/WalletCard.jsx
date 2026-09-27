/** Economic Passport entry point. No balances or receive addresses are invented. */
import React from 'react';
import { Wallet, ArrowUpRight } from 'lucide-react';

export default function WalletCard() {
  return (
    <div className="wlt">
      <div className="wlt-head">
        <div className="wlt-ico"><Wallet size={16} /></div>
        <div>
          <div className="wlt-title">Economic Passport</div>
          <div className="wlt-sub">Bitcoin and digital dollars</div>
        </div>
      </div>
      <p className="wlt-note">
        Open your Economic Passport to see available wallet information.
        Balances and receive addresses are shown only when a wallet provides them.
      </p>
      <p className="wlt-note">
        Tether WDK for USDT and top-up integration are planned, not available here.
      </p>
      <a className="wlt-open" href="?area=wallet&amp;sub=wallet">
        Open Economic Passport <ArrowUpRight size={15} />
      </a>
      <style>{`
        .luca .wlt{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px}
        .luca .wlt-head{display:flex;align-items:center;gap:10px}
        .luca .wlt-ico{width:34px;height:34px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;
          background:var(--ink);color:var(--gold)}
        .luca .wlt-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;color:var(--ink)}
        .luca .wlt-sub,.luca .wlt-note{font-size:12px;color:var(--muted);line-height:1.5}
        .luca .wlt-open{display:inline-flex;align-items:center;gap:7px;color:var(--teal-d);font-size:13px;font-weight:600;min-height:44px}
        .luca .wlt-open:focus-visible{outline:3px solid var(--teal);outline-offset:3px}
      `}</style>
    </div>
  );
}
