import React, { useState, useEffect, useRef } from 'react';
import { Button, Card } from '../components/ui.jsx';

/**
 * NODE E4J-RC1.2 — Admin activation flow (link-only).
 *
 * Reachable ONLY by following an operator-delivered activation link of the form
 *   https://<host>/admin/activate?token=<one-time-activation-token>
 * It is deliberately NOT linked from any nav, dashboard, or public page — there
 * is no admin self-discovery and no public admin signup. The token is a scoped,
 * single-use, expiring pre-auth credential; possession of the link is the only
 * entry point.
 *
 * Steps (each backed by a real API call):
 *   1. Set password          -> POST /api/admin/auth/activate  => { preAuthToken }
 *   2. Enrol TOTP            -> POST /api/admin/auth/totp/setup (pre-auth)
 *   3. Confirm 6-digit code  -> POST /api/admin/auth/totp/confirm (pre-auth)
 *   4. Sign in               -> POST /api/admin/auth/login (password + code)
 *
 * No secret is ever logged. The pre-auth token is held in component state only
 * (never localStorage); only the final admin session token is persisted, via
 * the same `token` key the rest of the app reads.
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

const wrap = { minHeight: '100vh' };
const label = {
  display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6,
  color: '#9FE7D6', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
};
const input = {
  width: '100%', padding: '11px 13px', borderRadius: 12, boxSizing: 'border-box',
  border: '1px solid rgba(159,231,214,.3)', background: 'rgba(3,32,30,.5)',
  color: '#EAFBF4', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 15,
};
const help = { fontSize: 12.5, color: '#7FCFBC', marginTop: 6, lineHeight: 1.5 };

async function post(path, body, bearer) {
  const headers = { 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST', headers, body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error((data && data.error) || 'Request failed');
    e.status = res.status;
    throw e;
  }
  return data;
}

function tokenFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('token') || '';
  } catch { return ''; }
}

export default function AdminActivate() {
  const [step, setStep] = useState('password'); // password | totp | confirm | done | invalid
  const [activationToken] = useState(tokenFromUrl);
  const [preAuth, setPreAuth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef(null);

  useEffect(() => {
    if (!activationToken) setStep('invalid');
  }, [activationToken]);

  // Move focus to the step heading on each transition (accessibility).
  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
  }, [step]);

  async function submitPassword(e) {
    e.preventDefault();
    setError('');
    if (password.length < 12) { setError('Use at least 12 characters.'); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const data = await post('/admin/auth/activate', { token: activationToken, password });
      setPreAuth(data.preAuthToken);
      setStep('totp');
    } catch (err) {
      // Neutral message — never reveal whether the token/account exists.
      setError('This activation link is invalid or has expired.');
    } finally { setBusy(false); }
  }

  async function beginTotp() {
    setError(''); setBusy(true);
    try {
      const data = await post('/admin/auth/totp/setup', {}, preAuth);
      setSecret(data.secret || '');
      setOtpauth(data.otpauth || '');
      setStep('confirm');
    } catch (err) {
      setError('Could not start authenticator setup. Restart from your activation link.');
    } finally { setBusy(false); }
  }

  async function confirmTotp(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await post('/admin/auth/totp/confirm', { code: code.trim() }, preAuth);
      setStep('done');
    } catch (err) {
      setError('That code was not correct. Check your authenticator and try again.');
    } finally { setBusy(false); }
  }

  async function signIn(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = await post('/admin/auth/login', {
        email: email.trim(), password, code: loginCode.trim(),
      });
      if (data && data.token) {
        localStorage.setItem('token', data.token);
        window.history.replaceState({}, '', '/');
        window.location.reload();
        return;
      }
      setError('Sign-in failed. Please try again.');
    } catch (err) {
      setError('Sign-in failed. Check your email, password and current code.');
    } finally { setBusy(false); }
  }

  return (
    <div className="sol-bg" style={wrap}>
      <div className="app-frame">
        <div className="page" style={{ maxWidth: 460, margin: '0 auto', padding: '32px 20px' }}>
          <Card glass style={{ padding: 24 }}>
            <h1
              ref={headingRef}
              tabIndex={-1}
              style={{
                margin: '0 0 4px', fontSize: 22, color: '#EAFBF4', outline: 'none',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}
            >
              Admin activation
            </h1>
            <p style={{ margin: '0 0 20px', color: '#9FE7D6', fontSize: 14 }}>
              Solaris Health · secure administrator onboarding
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  background: 'rgba(242,160,160,.12)', border: '1px solid rgba(242,160,160,.4)',
                  color: '#F2A0A0', borderRadius: 12, padding: '10px 13px', marginBottom: 16, fontSize: 13.5,
                }}
              >
                {error}
              </div>
            )}

            {step === 'invalid' && (
              <p style={{ color: '#EAFBF4', fontSize: 14, lineHeight: 1.6 }}>
                This page can only be opened from a valid administrator activation
                link. Please use the link provided to you by your operator.
              </p>
            )}

            {step === 'password' && (
              <form onSubmit={submitPassword} noValidate>
                <p style={help} id="pw-intro">
                  Step 1 of 3 — Set the password for your administrator account.
                </p>
                <div style={{ marginTop: 16 }}>
                  <label style={label} htmlFor="admin-pw">New password</label>
                  <input
                    id="admin-pw" style={input} type="password" autoComplete="new-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    aria-describedby="pw-help" minLength={12} required
                  />
                  <p id="pw-help" style={help}>At least 12 characters.</p>
                </div>
                <div style={{ marginTop: 14 }}>
                  <label style={label} htmlFor="admin-pw2">Confirm password</label>
                  <input
                    id="admin-pw2" style={input} type="password" autoComplete="new-password"
                    value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required
                  />
                </div>
                <Button type="submit" disabled={busy} style={{ marginTop: 20, width: '100%' }}>
                  {busy ? 'Setting password…' : 'Continue'}
                </Button>
              </form>
            )}

            {step === 'totp' && (
              <div>
                <p style={help}>
                  Step 2 of 3 — Add a second factor. You will link an authenticator
                  app (Google Authenticator, 1Password, Aegis, …).
                </p>
                <Button onClick={beginTotp} disabled={busy} style={{ marginTop: 18, width: '100%' }}>
                  {busy ? 'Preparing…' : 'Set up authenticator'}
                </Button>
              </div>
            )}

            {step === 'confirm' && (
              <form onSubmit={confirmTotp} noValidate>
                <p style={help}>
                  Step 3 of 3 — In your authenticator app, add a new account using
                  the secret below, then enter the 6-digit code it shows.
                </p>
                <div style={{ marginTop: 14 }}>
                  <label style={label} htmlFor="totp-secret">Setup secret</label>
                  <input
                    id="totp-secret" style={{ ...input, letterSpacing: 1, fontFamily: 'monospace' }}
                    type="text" value={secret} readOnly
                    onFocus={(e) => e.target.select()}
                    aria-describedby="secret-help"
                  />
                  <p id="secret-help" style={help}>
                    Type this into your authenticator, or use the otpauth URI if your
                    app supports pasting one.
                  </p>
                </div>
                <div style={{ marginTop: 14 }}>
                  <label style={label} htmlFor="totp-code">6-digit code</label>
                  <input
                    id="totp-code" style={{ ...input, letterSpacing: 4, fontFamily: 'monospace' }}
                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    autoComplete="one-time-code" required
                  />
                </div>
                <Button type="submit" disabled={busy} style={{ marginTop: 20, width: '100%' }}>
                  {busy ? 'Verifying…' : 'Confirm & finish'}
                </Button>
              </form>
            )}

            {step === 'done' && (
              <form onSubmit={signIn} noValidate>
                <p style={{ ...help, color: '#36C9A9' }}>
                  Your administrator account is now activated with two-factor
                  protection. Sign in to continue.
                </p>
                <div style={{ marginTop: 16 }}>
                  <label style={label} htmlFor="signin-email">Email</label>
                  <input
                    id="signin-email" style={input} type="email" autoComplete="username"
                    value={email} onChange={(e) => setEmail(e.target.value)} required
                  />
                </div>
                <div style={{ marginTop: 14 }}>
                  <label style={label} htmlFor="signin-code">Current 6-digit code</label>
                  <input
                    id="signin-code" style={{ ...input, letterSpacing: 4, fontFamily: 'monospace' }}
                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                    value={loginCode} onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, ''))}
                    autoComplete="one-time-code" required
                  />
                </div>
                <Button type="submit" disabled={busy} style={{ marginTop: 20, width: '100%' }}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
