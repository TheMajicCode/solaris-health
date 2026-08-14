/**
 * PWAInstallInvitation visibility tests (correction §3).
 *
 * The "Keep Solaris close" install invitation must:
 *   - NEVER render while a Solaris account is authenticated (so it can never
 *     cover the wallet screens or the fixed mobile navigation);
 *   - still capture a genuine `beforeinstallprompt` and show ONLY during the
 *     UNAUTHENTICATED welcome / account-creation journey;
 *   - hide the moment an account signs in, and be able to reappear on sign-out.
 *
 * We drive the authenticated/unauthenticated state through a mocked useApp and
 * simulate the real installability signal via a beforeinstallprompt event.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// Mutable auth state for the mocked app context.
const appState = { user: null };
vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => appState,
}));

import PWAInstallInvitation from '../components/PWAInstallInvitation.jsx';

function fireBeforeInstallPrompt() {
  const e = new Event('beforeinstallprompt');
  e.prompt = vi.fn();
  e.userChoice = Promise.resolve({ outcome: 'dismissed' });
  act(() => { window.dispatchEvent(e); });
  return e;
}

beforeEach(() => {
  appState.user = null;
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => { cleanup(); });

describe('PWAInstallInvitation — auth gating', () => {
  it('shows during the UNAUTHENTICATED journey once a genuine install signal arrives', () => {
    appState.user = null;
    render(<PWAInstallInvitation />);
    expect(screen.queryByText('Keep Solaris close')).not.toBeInTheDocument();
    fireBeforeInstallPrompt();
    expect(screen.getByText('Keep Solaris close')).toBeInTheDocument();
    expect(screen.getByText('Install Solaris')).toBeInTheDocument();
  });

  it('NEVER renders while authenticated, even after a genuine install signal', () => {
    appState.user = { id: 'user-1', email: 'a@example.com' };
    render(<PWAInstallInvitation />);
    fireBeforeInstallPrompt();
    expect(screen.queryByText('Keep Solaris close')).not.toBeInTheDocument();
  });

  it('captures the signal while authenticated but only surfaces it after sign-out', () => {
    appState.user = { id: 'user-1', email: 'a@example.com' };
    const { rerender } = render(<PWAInstallInvitation />);
    fireBeforeInstallPrompt();                      // captured, not shown
    expect(screen.queryByText('Keep Solaris close')).not.toBeInTheDocument();

    // Sign out → the invitation may now appear (not standalone, not dismissed).
    act(() => { appState.user = null; });
    rerender(<PWAInstallInvitation />);
    expect(screen.getByText('Keep Solaris close')).toBeInTheDocument();
  });

  it('hides immediately when an account signs in mid-session', () => {
    appState.user = null;
    const { rerender } = render(<PWAInstallInvitation />);
    fireBeforeInstallPrompt();
    expect(screen.getByText('Keep Solaris close')).toBeInTheDocument();

    act(() => { appState.user = { id: 'user-1', email: 'a@example.com' }; });
    rerender(<PWAInstallInvitation />);
    expect(screen.queryByText('Keep Solaris close')).not.toBeInTheDocument();
  });
});
