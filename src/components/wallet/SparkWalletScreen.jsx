import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Wallet, ShieldCheck, RefreshCw, ArrowDownLeft, ArrowUpRight, Plus, Copy, Check,
  Eye, EyeOff, Lock, AlertTriangle, Loader2, ChevronLeft, Zap, Shield, ArrowRightLeft,
} from 'lucide-react';
import { useSparkWallet } from '../../state/SparkWalletContext.jsx';
import { useApp } from '../../state/AppContext.jsx';

/* ────────────────────────────────────────────────────────────────────────────
 * SparkWalletScreen — the DEFAULT "Wallet" tab of the Economic Passport (spec §4).
 *
 * PREVIEW / REGTEST ONLY. Shows the PUBLIC state of the app-root Spark wallet:
 * a persistent REGTEST badge, the sats balance, the truncated public Spark
 * address (copy + full view), the encrypted-device-vault status, and Refresh /
 * Receive / Send / Add test funds actions. It NEVER shows or requests a mnemonic
 * and never sends a secret anywhere. All values come from the app-root provider,
 * which owns the single active wallet instance.
 * ──────────────────────────────────────────────────────────────────────────── */

function truncateAddr(a) {
  const s = String(a || '');
  if (s.length <= 22) return s;
  return `${s.slice(0, 12)}…${s.slice(-6)}`;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); }
    catch { /* clipboard unavailable — ignore */ }
  }, []);
  return { copied, copy };
}

const REGTEST_BADGE = (
  <span className="spw-badge" title="Regression test network — no real funds">REGTEST</span>
);

export default function SparkWalletScreen() {
  const spark = useSparkWallet();
  const [panel, setPanel] = useState('home');      // home | receive | send
  const [showFull, setShowFull] = useState(false);
  const { copied, copy } = useCopy();

  // Refresh balance whenever we enter the ready home panel.
  useEffect(() => {
    if (spark?.status === 'ready' && panel === 'home') { spark.refresh(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spark?.status]);

  if (!spark) return null;

  /* ── Wallet disabled in this build (fail-closed) ── */
  if (!spark.enabled) {
    return (
      <div className="spw">
        <WalletHeader />
        <div className="spw-card spw-note">
          <AlertTriangle size={15} /> <span>{spark.disabledReason || 'The Spark wallet is turned off in this build.'}</span>
        </div>
        <Style />
      </div>
    );
  }

  /* ── Locked: an encrypted vault exists but no wallet is active this session ── */
  if (spark.status === 'locked') {
    return (
      <div className="spw">
        <WalletHeader />
        <LockedCard />
        {spark.legacyPresent && <LegacyMigrationCard />}
        <Style />
      </div>
    );
  }

  /* ── Idle: no wallet and no vault on this device ── */
  if (spark.status !== 'ready') {
    return (
      <div className="spw">
        <WalletHeader />
        <div className="spw-card spw-empty">
          <div className="spw-empty-icon"><Wallet size={22} /></div>
          <p className="spw-empty-title">No Spark wallet on this device yet</p>
          <p className="spw-empty-sub">
            Create your Spark wallet during onboarding under “Reclaim Your Wealth”. It is created
            on this device on the {spark.network} test network — never with real funds.
          </p>
        </div>
        {spark.legacyPresent && <LegacyMigrationCard />}
        <Style />
      </div>
    );
  }

  /* ── Ready ── */
  return (
    <div className="spw">
      <WalletHeader />

      {panel === 'home' && (
        <>
          <div className="spw-card spw-balance-card">
            <div className="spw-bal-row">
              <span className="spw-bal-label">Available balance</span>
              <button className="spw-icon-btn" onClick={() => spark.refresh()} disabled={spark.loading} aria-label="Refresh balance">
                {spark.loading ? <Loader2 size={15} className="spw-spin" /> : <RefreshCw size={15} />}
              </button>
            </div>
            <div className="spw-bal">
              {spark.balanceSats == null ? '—' : spark.balanceSats.toLocaleString()} <span className="spw-bal-unit">sats</span>
            </div>

            <div className="spw-addr-row">
              <code className="spw-addr">{showFull ? spark.address : truncateAddr(spark.address)}</code>
              <button className="spw-icon-btn" onClick={() => setShowFull((v) => !v)} aria-label={showFull ? 'Show short address' : 'Show full address'}>
                {showFull ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button className="spw-icon-btn" onClick={() => copy(spark.address)} aria-label="Copy address">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p className="spw-vault"><Lock size={12} /> {spark.vaultStatusText}</p>
            {spark.error && <p className="spw-err">{spark.error}</p>}
          </div>

          <div className="spw-actions">
            <button className="spw-action" onClick={() => setPanel('receive')}>
              <ArrowDownLeft size={18} /> <span>Receive</span>
            </button>
            <button className="spw-action" onClick={() => setPanel('send')} disabled={spark.balanceSats === 0} title={spark.balanceSats === 0 ? 'No sats to send yet' : undefined}>
              <ArrowUpRight size={18} /> <span>Send</span>
            </button>
            <button className="spw-action" onClick={() => setPanel('receive')}>
              <Plus size={18} /> <span>Add test funds</span>
            </button>
          </div>

          <PrivacySetting />
        </>
      )}

      {panel === 'receive' && <ReceivePanel onBack={() => setPanel('home')} />}
      {panel === 'send' && <SendPanel onBack={() => setPanel('home')} />}

      <Style />
    </div>
  );
}

function WalletHeader() {
  return (
    <div className="spw-head">
      <span className="spw-title"><Wallet size={17} /> Spark wallet</span>
      {REGTEST_BADGE}
    </div>
  );
}

function LockedCard() {
  const spark = useSparkWallet();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const unlock = async () => {
    if (busy) return;
    setErr(''); setBusy(true);
    try { await spark.unlockFromVault(pass); setPass(''); }
    catch (e) { setErr(e?.message || 'Could not unlock the wallet.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="spw-card spw-locked">
      <div className="spw-lock-icon"><Lock size={22} /></div>
      <p className="spw-locked-title">This wallet is locked on this device</p>
      <p className="spw-vault"><ShieldCheck size={12} /> {spark.vaultStatusText}</p>
      <label className="spw-label" htmlFor="spw-unlock">Unlock passphrase</label>
      <input
        id="spw-unlock" className="spw-input" type="password" value={pass}
        onChange={(e) => setPass(e.target.value)} autoComplete="current-password"
        spellCheck={false} placeholder="Your unlock passphrase"
        onKeyDown={(e) => { if (e.key === 'Enter') unlock(); }}
      />
      {err && <p className="spw-err">{err}</p>}
      <button className="spw-btn" onClick={unlock} disabled={busy || pass.length < 1} aria-busy={busy}>
        {busy ? <><Loader2 size={15} className="spw-spin" /> Unlocking…</> : 'Unlock wallet'}
      </button>
    </div>
  );
}

function ReceivePanel({ onBack }) {
  const spark = useSparkWallet();
  const [amount, setAmount] = useState('');
  const [invoice, setInvoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { copied, copy } = useCopy();

  const makeInvoice = async () => {
    setErr(''); setInvoice('');
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) { setErr('Enter a whole number of sats greater than zero.'); return; }
    setBusy(true);
    try {
      const res = await spark.createInvoice({ amountSats: n }); // memo defaults to neutral text — no health/profile data
      const bolt11 = res?.invoice?.encodedInvoice || res?.encodedInvoice || res?.invoice || '';
      setInvoice(typeof bolt11 === 'string' ? bolt11 : '');
      if (!bolt11) setErr('Invoice created, but no BOLT11 string was returned.');
    } catch (e) {
      setErr(e?.message || 'Could not create a Lightning invoice right now.');
    } finally { setBusy(false); }
  };

  return (
    <div className="spw-card">
      <button className="spw-back" onClick={onBack}><ChevronLeft size={15} /> Back</button>
      <p className="spw-panel-title"><ArrowDownLeft size={16} /> Receive</p>
      <p className="spw-panel-note">
        Add test funds on the {spark.network} network by receiving to this wallet. These are test-network
        sats only — not fiat, not real bitcoin, and not a production balance.
      </p>

      <span className="spw-label">Your Spark address</span>
      <div className="spw-qr"><QRCodeSVG value={spark.address || ''} size={148} level="M" includeMargin /></div>
      <div className="spw-addr-row">
        <code className="spw-addr">{spark.address}</code>
        <button className="spw-icon-btn" onClick={() => copy(spark.address)} aria-label="Copy address">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <div className="spw-divider" />
      <span className="spw-label"><Zap size={12} /> Or create a Lightning invoice (optional)</span>
      <div className="spw-inline">
        <input
          className="spw-input" type="number" min="1" step="1" inputMode="numeric"
          value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount in sats"
        />
        <button className="spw-btn spw-btn-sm" onClick={makeInvoice} disabled={busy} aria-busy={busy}>
          {busy ? <Loader2 size={14} className="spw-spin" /> : 'Create'}
        </button>
      </div>
      {invoice && (
        <div className="spw-invoice">
          <div className="spw-qr"><QRCodeSVG value={invoice} size={148} level="M" includeMargin /></div>
          <div className="spw-addr-row">
            <code className="spw-addr">{invoice}</code>
            <button className="spw-icon-btn" onClick={() => copy(invoice)} aria-label="Copy invoice"><Copy size={14} /></button>
          </div>
        </div>
      )}
      {err && <p className="spw-err">{err}</p>}
    </div>
  );
}

function SendPanel({ onBack }) {
  const spark = useSparkWallet();
  const [addr, setAddr] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState('form');  // form | review | done
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const amountNum = Number(amount);
  const validAmount = Number.isInteger(amountNum) && amountNum > 0;

  const toReview = () => {
    setErr('');
    if (!addr.trim()) { setErr('Enter a destination Spark address.'); return; }
    if (!validAmount) { setErr('Enter a whole number of sats greater than zero.'); return; }
    if (spark.balanceSats != null && amountNum > spark.balanceSats) { setErr('Amount exceeds your available balance.'); return; }
    setStage('review');
  };

  const confirm = async () => {
    if (busy) return;               // prevent double submission
    setErr(''); setBusy(true);
    try {
      await spark.send({ toAddress: addr.trim(), amountSats: amountNum });
      setStage('done');
    } catch (e) {
      setErr(e?.message || 'The transfer could not be completed.');
      setStage('form');
    } finally { setBusy(false); }
  };

  return (
    <div className="spw-card">
      <button className="spw-back" onClick={onBack}><ChevronLeft size={15} /> Back</button>
      <p className="spw-panel-title"><ArrowUpRight size={16} /> Send</p>

      {spark.balanceSats === 0 && stage === 'form' && (
        <p className="spw-panel-note"><AlertTriangle size={13} /> This wallet has no sats yet. Add test funds from the Receive screen first.</p>
      )}

      {stage === 'form' && (
        <>
          <label className="spw-label" htmlFor="spw-to">Destination Spark address</label>
          <input id="spw-to" className="spw-input" value={addr} onChange={(e) => setAddr(e.target.value)}
            placeholder="sparkrt1… (REGTEST)" autoComplete="off" spellCheck={false} />
          <label className="spw-label" htmlFor="spw-amt" style={{ marginTop: 8 }}>Amount (sats)</label>
          <input id="spw-amt" className="spw-input" type="number" min="1" step="1" inputMode="numeric"
            value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Whole sats only" />
          {err && <p className="spw-err">{err}</p>}
          <button className="spw-btn" onClick={toReview} style={{ marginTop: 10 }}>Review</button>
        </>
      )}

      {stage === 'review' && (
        <>
          <div className="spw-review">
            <div className="spw-review-row"><span>Amount</span><b>{amountNum.toLocaleString()} sats</b></div>
            <div className="spw-review-row"><span>To</span><code className="spw-addr">{truncateAddr(addr.trim())}</code></div>
            <div className="spw-review-row"><span>Network</span><b>{spark.network}</b></div>
          </div>
          {err && <p className="spw-err">{err}</p>}
          <div className="spw-inline" style={{ marginTop: 10 }}>
            <button className="spw-btn spw-btn-ghost" onClick={() => setStage('form')} disabled={busy}>Edit</button>
            <button className="spw-btn" onClick={confirm} disabled={busy} aria-busy={busy}>
              {busy ? <><Loader2 size={15} className="spw-spin" /> Sending…</> : 'Confirm & send'}
            </button>
          </div>
        </>
      )}

      {stage === 'done' && (
        <div className="spw-done">
          <div className="spw-done-icon"><Check size={20} /></div>
          <p className="spw-done-title">Transfer submitted</p>
          <p className="spw-panel-note">Your balance will update once the {spark.network} network confirms it.</p>
          <button className="spw-btn" onClick={onBack} style={{ marginTop: 8 }}>Done</button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * PrivacySetting — TRUTHFUL Bitcoin transaction privacy control (correction §4).
 *
 * Explains plainly that, by default, this wallet's BTC transaction history is
 * visible through the PUBLIC Spark endpoints; privacy mode hides that BTC history
 * while token activity may remain visible. It does NOT claim anonymity, complete
 * sovereignty, or that the wallet becomes invisible on-chain. The user explicitly
 * turns it on or off; state is read from the SDK after unlock.
 * ──────────────────────────────────────────────────────────────────────────── */
function PrivacySetting() {
  const spark = useSparkWallet();
  const p = spark.privacy || { supported: false, enabled: false, loading: false, error: '' };
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy || p.loading) return;
    setBusy(true);
    try { await spark.setPrivacyEnabled(!p.enabled); }
    catch { /* error surfaced via spark.privacy.error */ }
    finally { setBusy(false); }
  };

  return (
    <div className="spw-card spw-privacy">
      <p className="spw-panel-title"><Shield size={16} /> Bitcoin transaction privacy</p>
      {!p.supported ? (
        <p className="spw-panel-note">Privacy control is unavailable in this preview SDK.</p>
      ) : (
        <>
          <p className="spw-panel-note">
            By default, this wallet’s Bitcoin transaction history can be seen through the public
            Spark network endpoints. Turning on privacy mode asks Spark to hide your BTC transaction
            history from those public endpoints. Token activity may still be visible. This is not
            anonymity and does not make your wallet invisible on-chain.
          </p>
          <div className="spw-privacy-row">
            <span className="spw-privacy-state">
              {p.enabled ? <ShieldCheck size={15} /> : <Shield size={15} />}
              {p.enabled ? 'Privacy mode is ON' : 'Privacy mode is OFF'}
            </span>
            <button
              className={`spw-toggle${p.enabled ? ' spw-toggle-on' : ''}`}
              role="switch" aria-checked={p.enabled} aria-label="Bitcoin transaction privacy"
              onClick={toggle} disabled={busy || p.loading}
            >
              {(busy || p.loading) ? <Loader2 size={14} className="spw-spin" /> : <span className="spw-knob" />}
            </button>
          </div>
          {p.error && <p className="spw-err">{p.error}</p>}
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * LegacyMigrationCard — one-time explicit move of the LEGACY global wallet into
 * THIS Solaris account (correction §1). Requires the legacy unlock passphrase and
 * an explicit confirmation that this is the intended account. The legacy vault is
 * only removed after a successful re-encrypt + read-back inside migrateLegacy().
 * ──────────────────────────────────────────────────────────────────────────── */
function LegacyMigrationCard() {
  const spark = useSparkWallet();
  const app = useApp();
  const email = app?.user?.email || 'this account';
  const [pass, setPass] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const move = async () => {
    if (busy) return;
    setErr(''); setBusy(true);
    try { await spark.migrateLegacy(pass); setPass(''); setDone(true); }
    catch (e) { setErr(e?.message || 'Could not move the legacy wallet.'); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="spw-card spw-legacy">
        <p className="spw-panel-title"><Check size={16} /> Legacy wallet moved</p>
        <p className="spw-panel-note">This wallet now belongs to your Solaris account and is locked on this device. Unlock it above with its passphrase.</p>
      </div>
    );
  }

  return (
    <div className="spw-card spw-legacy">
      <p className="spw-panel-title"><ArrowRightLeft size={16} /> Move an older wallet to this account</p>
      <p className="spw-panel-note">
        An older, account-less wallet was found on this device. You can move it into your Solaris
        account once. Your existing wallet is only replaced after a successful, verified move.
      </p>
      <label className="spw-label" htmlFor="spw-legacy-pass">Legacy wallet passphrase</label>
      <input
        id="spw-legacy-pass" className="spw-input" type="password" value={pass}
        onChange={(e) => setPass(e.target.value)} autoComplete="off" spellCheck={false}
        placeholder="The passphrase for the older wallet"
      />
      <label className="spw-check">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>Move this legacy wallet to <b>{email}</b>.</span>
      </label>
      {err && <p className="spw-err">{err}</p>}
      <button
        className="spw-btn" onClick={move}
        disabled={busy || !confirmed || pass.length < 1} aria-busy={busy}
        style={{ marginTop: 10 }}
      >
        {busy ? <><Loader2 size={15} className="spw-spin" /> Moving…</> : 'Move this legacy wallet to this Solaris account'}
      </button>
    </div>
  );
}

/* Light Solaris palette (dark-green / mint / cream / restrained gold) — matches
   the Economic Passport surfaces. Tokens inherited from LucaPassport CSS vars. */
function Style() {
  return (
    <style>{`
      .spw{max-width:520px}
      .spw-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
      .spw-title{display:inline-flex;align-items:center;gap:8px;font-family:var(--dp,inherit);font-weight:700;font-size:18px;color:var(--ink,#0A2B29)}
      .spw-badge{font-size:10.5px;font-weight:800;letter-spacing:.06em;padding:3px 8px;border-radius:999px;
        background:var(--gold-soft,#F7E8C8);color:var(--gold-ink,#7E5715);border:1px solid #EBD3A0}
      .spw-card{border:1px solid var(--line,#E1ECE8);border-radius:16px;padding:16px;background:var(--surface,#fff);margin-bottom:12px}
      .spw-note{display:flex;align-items:center;gap:8px;color:var(--terra-ink,#7A4A21);font-size:13px}
      .spw-balance-card{background:linear-gradient(160deg,#F6FAF8,#FFFFFF)}
      .spw-bal-row{display:flex;align-items:center;justify-content:space-between}
      .spw-bal-label{font-size:12px;font-weight:700;color:var(--muted,#5C726B);text-transform:uppercase;letter-spacing:.04em}
      .spw-bal{font-family:var(--dp,inherit);font-weight:700;font-size:34px;color:var(--ink,#0A2B29);line-height:1.1;margin:6px 0 12px}
      .spw-bal-unit{font-size:16px;color:var(--mint-ink,#0B6A57);font-weight:600}
      .spw-addr-row{display:flex;align-items:center;gap:6px;background:var(--surface-2,#F6FAF8);border:1px solid var(--line-2,#EBF3F0);border-radius:10px;padding:8px 10px}
      .spw-addr{font-family:var(--mono,ui-monospace,monospace);font-size:12.5px;color:var(--ink,#0A2B29);word-break:break-all;flex:1;min-width:0}
      .spw-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;border:1px solid var(--line,#E1ECE8);
        background:var(--surface,#fff);border-radius:8px;color:var(--teal,#0E5C57);cursor:pointer;transition:.15s}
      .spw-icon-btn:hover{background:var(--mint-soft,#DAF3EC)}
      .spw-icon-btn:disabled{opacity:.5;cursor:default}
      .spw-vault{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted,#5C726B);margin:10px 0 0}
      .spw-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .spw-action{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;border-radius:14px;
        border:1px solid var(--line,#E1ECE8);background:var(--surface,#fff);color:var(--teal-d,#06403B);font-weight:700;font-size:12.5px;cursor:pointer;transition:.15s}
      .spw-action:hover{background:var(--mint-soft,#DAF3EC);border-color:var(--mint-line,#BFE8DD)}
      .spw-action:disabled{opacity:.5;cursor:default}
      .spw-btn{width:100%;border-radius:12px;padding:12px;font-weight:700;font-size:14px;border:1px solid var(--teal,#0E5C57);
        background:var(--teal,#0E5C57);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px}
      .spw-btn:hover{background:var(--teal-d2,#0A524C)}
      .spw-btn:disabled{opacity:.55;cursor:default}
      .spw-btn-ghost{background:transparent;color:var(--teal,#0E5C57)}
      .spw-btn-ghost:hover{background:var(--mint-soft,#DAF3EC)}
      .spw-btn-sm{width:auto;padding:10px 14px;font-size:13px}
      .spw-label{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--ink,#0A2B29);margin:12px 0 6px}
      .spw-input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line,#E1ECE8);background:var(--surface,#fff);
        color:var(--ink,#0A2B29);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box}
      .spw-input:focus{border-color:var(--mint,#2FBE9F)}
      .spw-inline{display:flex;gap:8px;align-items:center}
      .spw-inline .spw-input{flex:1}
      .spw-qr{display:flex;justify-content:center;background:#fff;border:1px solid var(--line,#E1ECE8);border-radius:12px;padding:12px;margin:8px 0}
      .spw-divider{height:1px;background:var(--line,#E1ECE8);margin:16px 0}
      .spw-invoice{margin-top:10px}
      .spw-panel-title{display:flex;align-items:center;gap:7px;font-weight:700;font-size:15px;color:var(--ink,#0A2B29);margin:4px 0 6px}
      .spw-panel-note{display:flex;align-items:flex-start;gap:6px;font-size:12.5px;color:var(--muted,#5C726B);line-height:1.5;margin:0 0 10px}
      .spw-back{display:inline-flex;align-items:center;gap:3px;background:none;border:none;color:var(--teal,#0E5C57);font-weight:600;font-size:13px;cursor:pointer;padding:0;margin-bottom:8px}
      .spw-review{background:var(--surface-2,#F6FAF8);border:1px solid var(--line-2,#EBF3F0);border-radius:12px;padding:12px}
      .spw-review-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;font-size:13px;color:var(--muted,#5C726B)}
      .spw-review-row b{color:var(--ink,#0A2B29)}
      .spw-done{text-align:center;padding:8px 0}
      .spw-done-icon,.spw-lock-icon,.spw-empty-icon{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;
        background:var(--mint-soft,#DAF3EC);color:var(--mint-ink,#0B6A57);margin-bottom:8px}
      .spw-done-title,.spw-locked-title,.spw-empty-title{font-weight:700;font-size:15px;color:var(--ink,#0A2B29);margin:0 0 4px}
      .spw-locked,.spw-empty{text-align:center}
      .spw-empty-sub{font-size:13px;color:var(--muted,#5C726B);line-height:1.55;margin:6px 0 0}
      .spw-locked .spw-label,.spw-locked .spw-input{text-align:left}
      .spw-err{color:var(--error,#B23B3B);font-size:12.5px;margin:8px 0 0}
      .spw-privacy{margin-top:12px}
      .spw-privacy-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px}
      .spw-privacy-state{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:var(--ink,#0A2B29)}
      .spw-toggle{position:relative;width:46px;height:26px;flex:none;border-radius:999px;border:1px solid var(--line,#E1ECE8);
        background:var(--surface-2,#F0F5F3);cursor:pointer;transition:.18s;display:inline-flex;align-items:center;padding:0 3px}
      .spw-toggle-on{background:var(--mint,#2FBE9F);border-color:var(--mint,#2FBE9F);justify-content:flex-end}
      .spw-toggle:disabled{opacity:.6;cursor:default}
      .spw-knob{width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(3,14,13,0.3)}
      .spw-legacy{border-color:#EBD3A0;background:linear-gradient(160deg,#FCF7EC,#FFFFFF)}
      .spw-check{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--ink,#0A2B29);margin-top:10px;line-height:1.5;cursor:pointer}
      .spw-check input{margin-top:2px}
      .spw-spin{animation:spwspin 1s linear infinite}
      @keyframes spwspin{to{transform:rotate(360deg)}}
    `}</style>
  );
}
