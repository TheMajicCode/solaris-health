/**
 * NODE E4J-RC1.2 — AdminActivate (link-only) smoke tests.
 *
 * Proves the page is reachable only with a token, exposes no admin self-discovery,
 * and drives the real step machine (password -> TOTP) via mocked API calls.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminActivate from './AdminActivate.jsx';

function setUrl(search) {
  window.history.pushState({}, '', `/admin/activate${search}`);
}

describe('AdminActivate (link-only admin onboarding)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { setUrl(''); });

  it('refuses to render the flow without an activation token', () => {
    setUrl('');
    render(<AdminActivate />);
    expect(screen.getByText(/only be opened from a valid administrator activation link/i))
      .toBeInTheDocument();
    // No password entry is offered without a token.
    expect(screen.queryByLabelText(/New password/i)).toBeNull();
  });

  it('shows step 1 (set password) when a token is present, with no admin discovery', () => {
    setUrl('?token=abc123');
    render(<AdminActivate />);
    expect(screen.getByLabelText(/New password/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
    // Deliberately no "sign up", "create admin", or discovery affordance.
    expect(screen.queryByText(/sign up/i)).toBeNull();
    expect(screen.queryByText(/create admin/i)).toBeNull();
  });

  it('advances to TOTP setup after the password step succeeds', async () => {
    setUrl('?token=abc123');
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ preAuthToken: 'pre.auth.jwt' }) })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminActivate />);
    fireEvent.change(screen.getByLabelText(/New password/i), { target: { value: 'a-strong-pass-123' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'a-strong-pass-123' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument());
    // The activate endpoint was called exactly once, with the URL token.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse(opts.body).token).toBe('abc123');
  });

  it('rejects mismatched passwords client-side without calling the API', () => {
    setUrl('?token=abc123');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminActivate />);
    fireEvent.change(screen.getByLabelText(/New password/i), { target: { value: 'a-strong-pass-123' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'different-pass-123' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
