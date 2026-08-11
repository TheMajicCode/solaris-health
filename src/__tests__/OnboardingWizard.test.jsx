/**
 * Onboarding wizard tests (Beta V1 investor-demo — CORRECTED full-stack flow, spec §2–§8).
 *
 * Verifies the recordable onboarding slice against the corrected product model:
 *   - Welcome shows the THREE exact entry options (email sign-in, identity-key
 *     sign-in, create account);
 *   - the identity-key sign-in screen offers an EXISTING key + "create account,
 *     then generate my identity key" + legacy restore (it NEVER creates an
 *     identity-only account);
 *   - every account is created email/password FIRST (registerAccountDeferred runs
 *     at the create-account step, before Screens 1–3), so the identity bind and
 *     onboarding acks run authenticated;
 *   - Screen 1 "Reclaim Your Health" exact Beta-safe copy (spec §2A) + Generate /
 *     Link choices;
 *   - the new-identity nsec is MASKED until a deliberate reveal;
 *   - Screen 1 completion is a CHECKBOX-ONLY acknowledgement (exact text) — there
 *     is NO character-entry confirmation;
 *   - Screen 2 shows the Spark surface + UTEXO Coming Soon + Skip;
 *   - Screen 3 "Reclaim Your Sovereignty" exact copy, motto, and a COMPACT muted
 *     roadmap note — with NONE of the removed forbidden phrases and NO dashed panel;
 *   - finalize persists the minimum profile then activates; only the public npub
 *     is ever bound (no nsec in any request);
 *   - a failed profile save fails CLOSED (no activation, error shown, stays on profile).
 *
 * Uses DETERMINISTIC NON-SECRET fixtures — no real key is created. In the test
 * environment no VITE_SPARK_* env is set, so the Spark surface renders fail-closed
 * (disabled) — which is the correct default for a build with the wallet turned off.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Deterministic, obviously-fake fixtures (NOT real keys).
const FIX = {
  npub: 'npub1demopublicfixture000000000000000000000000',
  nsec: 'nsec1demofixtureABCDEFGHJKLMNPQRSTUVWXYZ023456',
  pubkeyHex: '00'.repeat(32),
  skHex: '11'.repeat(32),
};

// Hoisted so the vi.mock factories (which are lifted above module code) can
// safely reference these spies.
const H = vi.hoisted(() => ({
  identityAuthDeferred: vi.fn(),
  registerAccountDeferred: vi.fn(),
  activateUser: vi.fn(),
  loginWithIdentityKey: vi.fn(),
  login: vi.fn(),
  setAuthView: vi.fn(),
  saveProfile: vi.fn(),
  connectWallet: vi.fn(),
  identityBindChallenge: vi.fn(),
  bindIdentityKey: vi.fn(),
  ackOnboardingScreen: vi.fn(),
}));
const {
  registerAccountDeferred, activateUser, saveProfile, bindIdentityKey, ackOnboardingScreen,
} = H;

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    setAuthView: H.setAuthView, login: H.login, loginWithIdentityKey: H.loginWithIdentityKey,
    identityAuthDeferred: H.identityAuthDeferred, registerAccountDeferred: H.registerAccountDeferred,
    activateUser: H.activateUser,
  }),
}));

vi.mock('../lib/api.js', () => ({
  api: {
    saveProfile: H.saveProfile, connectWallet: H.connectWallet,
    identityBindChallenge: H.identityBindChallenge,
    bindIdentityKey: H.bindIdentityKey, ackOnboardingScreen: H.ackOnboardingScreen,
  },
}));

vi.mock('../lib/identity-key.js', () => ({
  createStandaloneIdentity: () => ({ ...FIX }),
  deriveFromMnemonic: () => ({ ...FIX }),
  identityFromNsec: () => ({ ...FIX }),
  isValidMnemonic: () => true,
  // Local, on-device signing over the server's canonical bind message. Returns a
  // non-secret signature string (never derived from or containing the nsec).
  signChallenge: () => 'ff'.repeat(32),
  IDENTITY_KEY_INFO: { title: 'What is an Identity Key?', lines: ['a', 'b', 'c'] },
}));

import Auth from '../flows/Auth.jsx';

const SCREEN1_LEDE =
  'Your identity secret is generated on this device and is not sent to Solaris. Keep it private. '
  + "Your Solaris health records remain governed by the app's current storage, consent, and export controls.";
const IDENTITY_ACK = 'I have saved my private key securely and understand that Solaris cannot recover it.';

beforeEach(() => {
  Object.values(H).forEach((fn) => fn.mockReset());
  H.identityAuthDeferred.mockResolvedValue(true);
  registerAccountDeferred.mockResolvedValue(true);
  activateUser.mockResolvedValue(true);
  H.loginWithIdentityKey.mockResolvedValue(true);
  H.login.mockResolvedValue({});
  saveProfile.mockResolvedValue({});
  H.connectWallet.mockResolvedValue({});
  H.identityBindChallenge.mockResolvedValue({ challengeId: 'CID', nonce: 'NONCE', message: 'solaris:bind-identity-key:v1|...' });
  bindIdentityKey.mockResolvedValue({});
  ackOnboardingScreen.mockResolvedValue({});
});

describe('Welcome screen', () => {
  it('shows the three exact entry options', () => {
    render(<Auth />);
    expect(screen.getByText('Sign in with email and password')).toBeInTheDocument();
    expect(screen.getByText('Sign in with identity key')).toBeInTheDocument();
    expect(screen.getByText('Create a Solaris account')).toBeInTheDocument();
  });

  it('identity-key sign-in offers an existing key, create-then-generate, and legacy restore — never an identity-only account', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Sign in with identity key'));
    expect(screen.getByText('Use an existing identity key')).toBeInTheDocument();
    expect(screen.getByText('Create account, then generate my identity key')).toBeInTheDocument();
    expect(screen.getByText('Restore legacy 12-word Solaris identity')).toBeInTheDocument();
  });
});

// Create the email/password account, then advance to Screen 1 (identity setup).
async function createAccountToScreen1() {
  render(<Auth />);
  fireEvent.click(screen.getByText('Create a Solaris account'));
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-passphrase-123' } });
  fireEvent.click(screen.getByRole('button', { name: /^Continue/ }));
  // Account registered FIRST — before any Screen 1–3 work.
  await waitFor(() => expect(registerAccountDeferred).toHaveBeenCalledTimes(1));
  // email-transition → Screen 1
  await screen.findByText(/your account is ready/);
  fireEvent.click(screen.getByRole('button', { name: /^Continue/ }));
  await screen.findByRole('heading', { name: 'Reclaim Your Health' });
}

describe('account is created email/password first', () => {
  it('registers with email/password only (no nsec) before Screen 1', async () => {
    await createAccountToScreen1();
    const arg = registerAccountDeferred.mock.calls[0][0];
    expect(arg.email).toBe('ada@example.test');
    expect(JSON.stringify(arg)).not.toContain('nsec');
    expect(JSON.stringify(arg)).not.toContain(FIX.nsec);
  });
});

describe('Screen 1 — Reclaim Your Health', () => {
  it('renders the exact Beta-safe identity copy and Generate / Link choices', async () => {
    await createAccountToScreen1();
    expect(screen.getByText('Your health identity')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reclaim Your Health' })).toBeInTheDocument();
    expect(screen.getByText(SCREEN1_LEDE)).toBeInTheDocument();
    expect(screen.getByText('A real, portable Nostr identity')).toBeInTheDocument();
    expect(screen.getByText('Clinical data stays private in Solaris')).toBeInTheDocument();
    expect(screen.getByText('Keep your health identity separate from your social identity')).toBeInTheDocument();
    expect(screen.getByText(/Generate my identity key locally/)).toBeInTheDocument();
    expect(screen.getByText(/Link an existing key locally/)).toBeInTheDocument();
  });
});

describe('Screen 1 backup gate — checkbox only (no character checks)', () => {
  async function reachReveal() {
    await createAccountToScreen1();
    fireEvent.click(screen.getByText(/Generate my identity key locally/));
    await screen.findByText(FIX.npub);
  }

  it('masks the nsec until a deliberate reveal and never shows it by default', async () => {
    await reachReveal();
    expect(screen.getByText(FIX.npub)).toBeInTheDocument();
    expect(screen.queryByText(FIX.nsec)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Reveal private key'));
    expect(screen.getByText(FIX.nsec)).toBeInTheDocument();
  });

  it('requires ONLY the exact acknowledgement checkbox — there are no character-entry fields', async () => {
    await reachReveal();
    const cont = screen.getByRole('button', { name: /Continue to Reclaim Your Wealth/ });
    expect(cont).toBeDisabled();
    // No character-confirmation inputs exist anymore.
    expect(screen.queryAllByText(/^Character #\d+$/)).toHaveLength(0);
    fireEvent.click(screen.getByLabelText(IDENTITY_ACK));
    expect(screen.getByRole('button', { name: /Continue to Reclaim Your Wealth/ })).toBeEnabled();
  });
});

// Advance new account through Screen 1 (generate + ack) into Screen 2 (wallet).
async function advanceToWallet() {
  await createAccountToScreen1();
  fireEvent.click(screen.getByText(/Generate my identity key locally/));
  await screen.findByText(FIX.npub);
  fireEvent.click(screen.getByLabelText(IDENTITY_ACK));
  fireEvent.click(screen.getByRole('button', { name: /Continue to Reclaim Your Wealth/ }));
  // Only the public npub is bound; identity ack recorded server-side.
  await waitFor(() => expect(bindIdentityKey).toHaveBeenCalledTimes(1));
  await screen.findByRole('heading', { name: 'Reclaim Your Wealth' });
}

describe('Screen 2 + Screen 3', () => {
  it('binds ONLY the public npub — the nsec never travels in the request', async () => {
    await advanceToWallet();
    const bindArgs = bindIdentityKey.mock.calls[0];
    expect(bindArgs[0]).toBe(FIX.npub);
    expect(JSON.stringify(bindArgs)).not.toContain(FIX.nsec);
    expect(ackOnboardingScreen).toHaveBeenCalledWith('identity');
  });

  it('Screen 2 shows the Spark surface, UTEXO Coming Soon, and Skip for now', async () => {
    await advanceToWallet();
    expect(screen.getByText('Create your digital gold wallet')).toBeInTheDocument();
    expect(screen.getByText('Powered by Spark')).toBeInTheDocument();
    expect(screen.getByText('Create your digital dollar wallet')).toBeInTheDocument();
    expect(screen.getByText(/Powered by UTEXO · Coming Soon/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skip for now/ })).toBeInTheDocument();
  });

  it('Screen 3 shows exact sovereignty copy + compact roadmap note, and NONE of the removed phrases', async () => {
    await advanceToWallet();
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/ }));
    await screen.findByRole('heading', { name: 'Reclaim Your Sovereignty' });
    expect(screen.getByLabelText('Heal · Learn · Earn')).toBeInTheDocument();
    expect(screen.getByText('Continue to my profile')).toBeInTheDocument();
    // Compact muted roadmap note is allowed…
    expect(screen.getByText(/Self-hosting and infrastructure hardening continue after Beta/)).toBeInTheDocument();
    // …but the removed panel/phrases must be gone.
    expect(screen.queryByText('Roadmap Preview')).not.toBeInTheDocument();
    expect(screen.queryByText(/enterprise-grade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/complete user sovereignty/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/production readiness/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/production hardening in progress/i)).not.toBeInTheDocument();
  });
});

describe('finalize GATE — minimum profile', () => {
  async function advanceToProfile() {
    await advanceToWallet();
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/ }));
    await screen.findByRole('heading', { name: 'Reclaim Your Sovereignty' });
    fireEvent.click(screen.getByText('Continue to my profile'));
    await screen.findByText('Your profile');
  }

  function fillProfile() {
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'El Salvador' } });
    fireEvent.change(screen.getByLabelText('City / current location'), { target: { value: 'San Salvador' } });
    fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'America/El_Salvador' } });
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'en' } });
  }

  it('persists the profile, then activates', async () => {
    await advanceToProfile();
    fillProfile();
    fireEvent.click(screen.getByRole('button', { name: /Continue to my intake/ }));
    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(activateUser).toHaveBeenCalledTimes(1));
  });

  it('fails CLOSED when the required profile save fails — no activation, error shown, stays on profile', async () => {
    await advanceToProfile();
    saveProfile.mockRejectedValueOnce(new Error('network'));
    fillProfile();
    fireEvent.click(screen.getByRole('button', { name: /Continue to my intake/ }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    expect(activateUser).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/could not save your profile/i)).toBeInTheDocument());
    expect(screen.getByText('Your profile')).toBeInTheDocument();
  });
});
