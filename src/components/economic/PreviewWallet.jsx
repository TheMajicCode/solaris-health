import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Bitcoin, CircleDollarSign, ArrowDownLeft, ArrowUpRight, Plus, QrCode,
  ShieldCheck, AlertTriangle, Info, X, ChevronDown, Lock,
} from 'lucide-react';
import { useSparkWallet } from '../../state/SparkWalletContext.jsx';

/**
 * Economic Passport wallet overview. Values come from the enabled Spark context,
 * never an email-based demo. An absent context balance is unknown; the existing
 * adapter can still coerce a missing SDK field to zero (separate follow-up).
 * USDT remains unconnected pending a separately accepted adapter.
 * This screen does not send funds, top up a wallet or change wallet storage.
 */
const SATS_PER_BTC = 100000000;

export default function PreviewWallet() {
  const spark = useSparkWallet();
  const [sheet, setSheet] = useState(null);
  const [devOpen, setDevOpen] = useState(false);

  const walletReady = !!(spark && spark.enabled && spark.status === 'ready');
  const realAddress = walletReady ? (spark.address || '') : '';
  const network = walletReady ? (spark.network || null) : null;
  const hasBalance = walletReady && Number.isSafeInteger(spark.balanceSats) && spark.balanceSats >= 0;
  const btcBalance = hasBalance
    ? `${(spark.balanceSats / SATS_PER_BTC).toFixed(8)} BTC`
    : 'Balance unavailable';

  const assets = [
    {
      key: 'btc',
      name: 'Bitcoin',
      tag: 'Digital gold',
      icon: Bitcoin,
      accent: '#E08A2A',
      balance: btcBalance,
      note: walletReady ? (hasBalance ? null : 'The connected wallet has not provided a balance.') : 'Bitcoin wallet not connected.',
    },
    {
      key: 'usdt',
      name: 'USDT',
      tag: 'Digital Dollars',
      icon: CircleDollarSign,
      accent: '#0E5C57',
      balance: 'Balance unavailable',
      note: 'USDT wallet not connected. Tether WDK integration is planned.',
    },
  ];

  return (
    <div className="pvw">
      <div className="pvw-head">
        <div className="pvw-head-titles">
          <h3 className="pvw-title">Your wallet</h3>
          <span className="pvw-status"><ShieldCheck size={13} /> {walletReady ? `Connected · ${network || 'Network unknown'}` : 'Wallet not connected'}</span>
        </div>
      </div>

      <p className="pvw-lead">
        Balances and receive addresses appear only when an enabled wallet provides them.
        Sending and top-ups are unavailable from this screen.{' '}
        <strong>LUCA cannot move money without your explicit authorization.</strong>
      </p>

      <div className="pvw-assets">
        {assets.map((a) => (
          <div className="pvw-card" key={a.key}>
            <div className="pvw-card-top">
              <span className="pvw-asset-ic" style={{ background: `${a.accent}1a`, color: a.accent }}><a.icon size={20} /></span>
              <div className="pvw-asset-id">
                <span className="pvw-asset-name">{a.name}</span>
                <span className="pvw-asset-tag">{a.tag}</span>
              </div>
            </div>
            <div className="pvw-bal-row">
              <span className="pvw-bal">{a.balance}</span>
            </div>
            {a.note && <p className="pvw-card-note"><Info size={12} /> {a.note}</p>}
            <div className="pvw-actions">
              <button type="button" className="pvw-act" onClick={() => setSheet({ asset: a.key, kind: 'receive' })}>
                <ArrowDownLeft size={15} /> Receive
              </button>
              <button type="button" className="pvw-act" onClick={() => setSheet({ asset: a.key, kind: 'send' })}>
                <ArrowUpRight size={15} /> Send
              </button>
              <button type="button" className="pvw-act pvw-act-ghost" onClick={() => setSheet({ asset: a.key, kind: 'topup' })}>
                <Plus size={15} /> Top Up
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Developer / network details — moved out of the primary UI (§6). */}
      <div className="pvw-dev">
        <button type="button" className="pvw-dev-toggle" aria-expanded={devOpen} onClick={() => setDevOpen((v) => !v)}>
          <span>Developer details</span>
          <ChevronDown size={16} className={devOpen ? 'rot' : ''} />
        </button>
        {devOpen && (
          <div className="pvw-dev-body">
            <div className="pvw-dev-row"><span>Network</span><span>{network || 'Not reported'}</span></div>
            <div className="pvw-dev-row"><span>Wallet status</span><span>{walletReady ? 'Ready' : 'Not connected'}</span></div>
            <div className="pvw-dev-row"><span>Spark address</span><span>{realAddress ? `${realAddress.slice(0, 10)}…` : 'Not connected'}</span></div>
            <p className="pvw-dev-hint">
              Check the reported network before receiving funds. This screen displays
              public wallet information only and does not request recovery words.
            </p>
          </div>
        )}
      </div>

      {sheet && (
        <PreviewSheet
          sheet={sheet}
          asset={assets.find((a) => a.key === sheet.asset)}
          realAddress={realAddress}
          network={network}
          onClose={() => setSheet(null)}
        />
      )}

      <PreviewWalletStyle />
    </div>
  );
}

// Receive displays an existing address; Send and Top Up remain unavailable.
// No signing, payment, invoice creation or storage operation occurs here.
function PreviewSheet({ sheet, asset, realAddress, network, onClose }) {
  if (typeof document === 'undefined' || !document.body) return null;
  const title = sheet.kind === 'receive' ? `Receive ${asset.name}`
    : sheet.kind === 'send' ? `Send ${asset.name}`
      : `Top Up ${asset.name}`;

  // Without a reported network, keep the address non-actionable.
  const hasRealAddress = sheet.asset === 'btc' && !!realAddress && !!network;

  return createPortal(
    <div className="luca">
      <div className="pvw-scrim" onClick={onClose} />
      <div className="pvw-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pvw-sheet-head">
          <h4 className="pvw-sheet-title">{title}</h4>
          <button type="button" className="pvw-sheet-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {sheet.kind === 'receive' && (
          <div className="pvw-sheet-body">
            {hasRealAddress ? (
              <>
                <div className="pvw-qr"><QRCodeSVG value={realAddress} size={168} includeMargin /></div>
                <p className="pvw-qr-net">{`${network} address`}</p>
                <code className="pvw-addr">{realAddress}</code>
              </>
            ) : (
              <div className="pvw-qr-placeholder">
                <QrCode size={40} />
                <p className="pvw-qr-ph-title">Receive address unavailable</p>
                <p className="pvw-qr-ph-sub">
                  An address and its network must be provided by a connected {sheet.asset === 'usdt' ? 'USDT' : 'Bitcoin'} wallet.
                  No address is generated by this screen.
                </p>
              </div>
            )}
          </div>
        )}

        {sheet.kind === 'send' && (
          <div className="pvw-sheet-body">
            <div className="pvw-disabled-note">
              <Lock size={16} />
              <div>
                <p className="pvw-dn-title">Sending is unavailable from this screen</p>
                <p className="pvw-dn-sub">
                  This screen cannot create or sign a transaction. LUCA cannot move money
                  without your explicit authorization.
                </p>
              </div>
            </div>
          </div>
        )}

        {sheet.kind === 'topup' && (
          <div className="pvw-sheet-body">
            <div className="pvw-disabled-note">
              <AlertTriangle size={16} />
              <div>
                <p className="pvw-dn-title">Top Up is not connected</p>
                <p className="pvw-dn-sub">
                  No funding provider is connected here. Top-up integration is planned;
                  this screen cannot initiate a charge.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <PreviewWalletStyle />
    </div>,
    document.body,
  );
}

function PreviewWalletStyle() {
  return (
    <style>{`
      .luca .pvw{display:flex;flex-direction:column;gap:14px}
      .luca .pvw-head-titles{display:flex;flex-direction:column;gap:4px}
      .luca .pvw-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:17px;color:var(--ink);margin:0}
      .luca .pvw-status{display:inline-flex;align-items:center;gap:5px;align-self:flex-start;font-size:11.5px;font-weight:700;
        color:var(--teal-d);background:var(--mint-soft);border:1px solid rgba(14,92,87,.2);border-radius:999px;padding:3px 9px}
      .luca .pvw-lead{font-size:12.5px;line-height:1.5;color:var(--muted);margin:0}
      .luca .pvw-lead strong{color:var(--ink)}
      .luca .pvw-assets{display:flex;flex-direction:column;gap:12px}
      .luca .pvw-card{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:15px;box-shadow:var(--shadow-sm)}
      .luca .pvw-card-top{display:flex;align-items:center;gap:11px;margin-bottom:12px}
      .luca .pvw-asset-ic{flex:none;width:42px;height:42px;border-radius:13px;display:grid;place-items:center}
      .luca .pvw-asset-id{display:flex;flex-direction:column;min-width:0}
      .luca .pvw-asset-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15.5px;color:var(--ink)}
      .luca .pvw-asset-tag{font-size:12px;color:var(--muted)}
      .luca .pvw-bal-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:6px}
      .luca .pvw-bal{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;color:var(--ink);letter-spacing:-.01em}
      .luca .pvw-card-note{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);margin:0 0 10px}
      .luca .pvw-actions{display:flex;gap:8px}
      .luca .pvw-act{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:44px;padding:9px 8px;
        border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-weight:600;font-size:12.5px;cursor:pointer}
      .luca .pvw-act:hover{background:var(--surface-2)}
      .luca .pvw-act:focus-visible{outline:3px solid var(--teal);outline-offset:2px}
      .luca .pvw-act-ghost{color:var(--teal-d)}
      .luca .pvw-dev{border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden}
      .luca .pvw-dev-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;
        padding:11px 14px;background:transparent;border:0;color:var(--muted);font-weight:600;font-size:12.5px;cursor:pointer}
      .luca .pvw-dev-toggle:focus-visible{outline:3px solid var(--teal);outline-offset:-3px}
      .luca .pvw-dev-toggle svg.rot{transform:rotate(180deg)}
      .luca .pvw-dev-body{padding:2px 14px 14px;border-top:1px solid var(--line)}
      .luca .pvw-dev-row{display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:6px 0;border-bottom:1px dashed var(--line)}
      .luca .pvw-dev-row span:first-child{color:var(--muted)}
      .luca .pvw-dev-row span:last-child{color:var(--ink);font-weight:600;text-align:right}
      .luca .pvw-dev-hint{font-size:11px;line-height:1.5;color:var(--muted);margin:10px 0 0}
      .luca .pvw-scrim{position:fixed;inset:0;z-index:200070;background:rgba(9,26,24,.5)}
      .luca .pvw-sheet{position:fixed;left:0;right:0;bottom:0;z-index:200080;background:#fff;border-radius:18px 18px 0 0;
        box-shadow:0 -14px 40px rgba(9,26,24,.3);padding:16px 16px calc(20px + env(safe-area-inset-bottom,0px));
        max-width:520px;margin:0 auto;max-height:86vh;overflow-y:auto}
      .luca .pvw-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
      .luca .pvw-sheet-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;color:var(--ink);margin:0}
      .luca .pvw-sheet-x{flex:none;width:38px;height:38px;border-radius:11px;border:1px solid var(--line);background:var(--surface);
        color:var(--ink);display:grid;place-items:center;cursor:pointer}
      .luca .pvw-sheet-x:focus-visible{outline:3px solid var(--teal);outline-offset:2px}
      .luca .pvw-sheet-body{display:flex;flex-direction:column;align-items:center;gap:10px}
      .luca .pvw-qr{background:#fff;padding:12px;border:1px solid var(--line);border-radius:14px}
      .luca .pvw-qr-net{font-size:12px;font-weight:600;color:var(--teal-d);margin:0}
      .luca .pvw-addr{font-size:11.5px;color:var(--ink);word-break:break-all;text-align:center;background:var(--surface);
        border:1px solid var(--line);border-radius:10px;padding:8px 10px;width:100%}
      .luca .pvw-qr-placeholder{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;color:var(--muted);
        border:1px dashed var(--line);border-radius:14px;padding:26px 18px;width:100%}
      .luca .pvw-qr-ph-title{font-weight:700;color:var(--ink);font-size:14px;margin:0}
      .luca .pvw-qr-ph-sub{font-size:12px;line-height:1.5;margin:0}
      .luca .pvw-disabled-note{display:flex;gap:10px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);
        border-radius:14px;padding:14px;width:100%}
      .luca .pvw-disabled-note svg{flex:none;color:var(--teal-d);margin-top:2px}
      .luca .pvw-dn-title{font-weight:700;color:var(--ink);font-size:13.5px;margin:0 0 3px}
      .luca .pvw-dn-sub{font-size:12px;line-height:1.5;color:var(--muted);margin:0}
    `}</style>
  );
}
