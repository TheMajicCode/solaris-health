/**
 * Onboarding wizard tests (Beta V1 investor-demo VISIBLE SPARK/PWA correction, spec §3–§8).
 *
 * Verifies the recordable onboarding slice against the CORRECTED flow:
 *   - Welcome shows the two exact method CTAs (identity key + email);
 *   - the identity-key choice screen exposes Create / Use existing nsec / Restore legacy;
 *   - Screen 1 "Reclaim Your Health" exact Beta-safe copy (spec §2A);
 *   - the new-identity nsec is MASKED until a deliberate reveal;
 *   - three randomized character checks gate progress;
 *   - Screen 2 shows the ENABLED-or-disabled Spark surface + UTEXO Coming Soon + Skip;
 *   - Screen 3 "Reclaim Your Sovereignty" exact copy incl. Roadmap Preview qualifiers;
 *   - the NEW-identity finalize GATE authenticates deferred, then persists the
 *     minimum profile, then activates — registering ONLY the public npub;
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
}));
const {
  identityAuthDeferred, registerAccountDeferred, activateUser,
  loginWithIdentityKey, login, saveProfile,
} = H;

vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    setAuthView: H.setAuthView, login: H.login, loginWithIdentityKey: H.loginWithIdentityKey,
    identityAuthDeferred: H.identityAuthDeferred, registerAccountDeferred: H.registerAccountDeferred,
    activateUser: H.activateUser,
  }),
}));

vi.mock('../lib/api.js', () => ({
  api: { saveProfile: H.saveProfile, connectWallet: H.connectWallet },
}));

vi.mock('../lib/identity-key.js', () => ({
  createStandaloneIdentity: () => ({ ...FIX }),
  deriveFromMnemonic: () => ({ ...FIX }),
  identityFromNsec: () => ({ ...FIX }),
  isValidMnemonic: () => true,
  IDENTITY_KEY_INFO: { title: 'What is an Identity Key?', lines: ['a', 'b', 'c'] },
}));

import Auth from '../flows/Auth.jsx';

const SCREEN1_LEDE =
  'Your identity secret is generated on this device and is not sent to Solaris. Keep it private. '
  + "Your Solaris health records remain governed by the app's current storage, consent, and export controls.";

beforeEach(() => {
  Object.values(H).forEach((fn) => fn.mockReset());
  identityAuthDeferred.mockResolvedValue(true);
  registerAccountDeferred.mockResolvedValue(true);
  activateUser.mockResolvedValue(true);
  loginWithIdentityKey.mockResolvedValue(true);
  login.mockResolvedValue({});
  saveProfile.mockResolvedValue({});
  H.connectWallet.mockResolvedValue({});
});

describe('Welcome screen', () => {
  it('shows the two exact method CTAs', () => {
    render(<Auth />);
    expect(screen.getByText('Continue with Solaris identity key')).toBeInTheDocument();
    expect(screen.getByText('Continue with email and password')).toBeInTheDocument();
  });

  it('the identity-key choice screen exposes create / existing nsec / legacy restore', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Continue with Solaris identity key'));
    expect(screen.getByText('Create a new identity key')).toBeInTheDocument();
    expect(screen.getByText('Use an existing nsec')).toBeInTheDocument();
    expect(screen.getByText('Restore legacy 12-word Solaris identity')).toBeInTheDocument();
  });
});

describe('Screen 1 — Reclaim Your Health', () => {
  it('renders the exact Beta-safe identity copy', () => {
    render(<Auth />);
    fireEvent.click(screen.getByText('Continue with Solaris identity key'));
    fireEvent.click(screen.getByText('Create a new identity key'));
    expect(screen.getByText('Your health identity')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reclaim Your Health' })).toBeInTheDocument();
    expect(screen.getByText(SCREEN1_LEDE)).toBeInTheDocument();
    expect(screen.getByText('A real, portable Nostr identity')).toBeInTheDocument();
    expect(screen.getByText('Clinical data stays private in Solaris')).toBeInTheDocument();
    expect(screen.getByText('Keep your health identity separate from your social identity')).toBeInTheDocument();
    expect(screen.getByText('Create my Solaris identity key')).toBeInTheDocument();
  });
});

describe('new identity backup gate', () => {
  function reachReveal() {
    render(<Auth />);
    fireEvent.click(screen.getByText('Continue with Solaris identity key'));
    fireEvent.click(screen.getByText('Create a new identity key'));
    fireEvent.click(screen.getByText('Create my Solaris identity key'));
  }

  it('masks the nsec until a deliberate reveal and never shows it by default', () => {
    reachReveal();
    // The public npub is shown…
    expect(screen.getByText(FIX.npub)).toBeInTheDocument();
    // …but the nsec is NOT rendered in plaintext until reveal.
    expect(screen.queryByText(FIX.nsec)).not.toBeInTheDocument();
    // Reveal button (accessible name) exposes it deliberately.
    fireEvent.click(screen.getByLabelText('Reveal private key'));
    expect(screen.getByText(FIX.nsec)).toBeInTheDocument();
  });

  it('requires the checkbox + three correct character checks before continuing', () => {
    reachReveal();
    const cont = screen.getByRole('button', { name: /Continue to Reclaim Your Wealth/ });
    expect(cont).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I have safely backed up my private key.'));
    // Character checks appear; solve them from the known fixture.
    const labels = screen.getAllByText(/^Character #\d+$/);
    expect(labels).toHaveLength(3);
    labels.forEach((label) => {
      const pos = parseInt(label.textContent.replace(/\D/g, ''), 10);
      const input = label.parentElement.querySelector('input');
      fireEvent.change(input, { target: { value: FIX.nsec[pos - 1] } });
    });
    expect(screen.getByRole('button', { name: /Continue to Reclaim Your Wealth/ })).toBeEnabled();
  });
});

describe('Screen 2 + Screen 3', () => {
  function advanceToWallet() {
    render(<Auth />);
    fireEvent.click(screen.getByText('Continue with Solaris identity key'));
    fireEvent.click(screen.getByText('Create a new identity key'));
    fireEvent.click(screen.getByText('Create my Solaris identity key'));
    fireEvent.click(screen.getByLabelText('I have safely backed up my private key.'));
    screen.getAllByText(/^Character #\d+$/).forEach((label) => {
      const pos = parseInt(label.textContent.replace(/\D/g, ''), 10);
      fireEvent.change(label.parentElement.querySelector('input'), { target: { value: FIX.nsec[pos - 1] } });
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Reclaim Your Wealth/ }));
  }

  it('Screen 2 shows the Spark surface, UTEXO Coming Soon, and Skip for now', () => {
    advanceToWallet();
    expect(screen.getByText('Create your digital gold wallet')).toBeInTheDocument();
    expect(screen.getByText('Powered by Spark')).toBeInTheDocument();
    expect(screen.getByText('Create your digital dollar wallet')).toBeInTheDocument();
    expect(screen.getByText(/Powered by UTEXO · Coming Soon/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skip for now/ })).toBeInTheDocument();
  });

  it('Screen 3 shows exact sovereignty copy + required Roadmap Preview qualifiers', () => {
    advanceToWallet();
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/ }));
    expect(screen.getByRole('heading', { name: 'Reclaim Your Sovereignty' })).toBeInTheDocument();
    expect(screen.getByLabelText('Heal · Learn · Earn')).toBeInTheDocument();
    expect(screen.getByText('Continue to my profile')).toBeInTheDocument();
    expect(screen.getByText('Roadmap Preview')).toBeInTheDocument();
    expect(screen.getByText('Designed toward enterprise-grade encrypted infrastructure')).toBeInTheDocument();
    expect(screen.getByText('A path toward complete user sovereignty')).toBeInTheDocument();
    expect(screen.getByText('Production hardening in progress')).toBeInTheDocument();
  });
});

describe('finalize GATE — new identity account', () => {
  function advanceToProfile() {
    render(<Auth />);
    fireEvent.click(screen.getByText('Continue with Solaris identity key'));
    fireEvent.click(screen.getByText('Create a new identity key'));
    fireEvent.click(screen.getByText('Create my Solaris identity key'));
    fireEvent.click(screen.getByLabelText('I have safely backed up my private key.'));
    screen.getAllByText(/^Character #\d+$/).forEach((label) => {
      const pos = parseInt(label.textContent.replace(/\D/g, ''), 10);
      fireEvent.change(label.parentElement.querySelector('input'), { target: { value: FIX.nsec[pos - 1] } });
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Reclaim Your Wealth/ }));
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/ }));
    fireEvent.click(screen.getByText('Continue to my profile'));
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

  it('authenticates deferred, persists the profile, then activates — registering ONLY the public npub', async () => {
    advanceToProfile();
    fillProfile();
    fireEvent.click(screen.getByRole('button', { name: /Continue to my intake/ }));

    await waitFor(() => expect(identityAuthDeferred).toHaveBeenCalledTimes(1));
    expect(registerAccountDeferred).not.toHaveBeenCalled();
    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(activateUser).toHaveBeenCalledTimes(1));

    const arg = identityAuthDeferred.mock.calls[0][0];
    expect(arg.npub).toBe(FIX.npub);
    // Only the public key is registered — the nsec must not travel in the arg.
    expect(JSON.stringify(arg)).not.toContain(FIX.nsec);
    expect(JSON.stringify(arg)).not.toContain('nsec');
  });

  it('fails CLOSED when the required profile save fails — no activation, error shown, stays on profile', async () => {
    saveProfile.mockRejectedValueOnce(new Error('network'));
    advanceToProfile();
    fillProfile();
    fireEvent.click(screen.getByRole('button', { name: /Continue to my intake/ }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    // Deferred auth ran, but the user is NOT activated on a failed save.
    expect(activateUser).not.toHaveBeenCalled();
    // A retryable error is shown and we remain on the profile screen.
    await waitFor(() => expect(screen.getByText(/could not save your profile/i)).toBeInTheDocument());
    expect(screen.getByText('Your profile')).toBeInTheDocument();
  });
});
