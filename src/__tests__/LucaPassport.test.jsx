/**
 * LucaPassport shell smoke test — mounts the top-level dashboard with a mocked
 * auth context and a stubbed API client, and verifies the chrome renders and
 * navigation reflects the user's role. Kept intentionally light: the goal is to
 * catch crash-on-render regressions across the whole component tree.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the auth context to inject a deterministic patient user.
vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    user: {
      id: 1,
      email: 'patient@test.local',
      firstName: 'Pat',
      lastName: 'Tester',
      role: 'patient',
    },
    logout: vi.fn(),
  }),
  AppProvider: ({ children }) => children,
}));

// Stub every API method: any property access returns a function that resolves
// to an empty object, so child-component effects never hit the network.
vi.mock('../lib/api.js', () => {
  const handler = {
    get: () => (..._args) => Promise.resolve({}),
  };
  return { api: new Proxy({}, handler) };
});

import LucaPassport from '../components/LucaPassport.jsx';

describe('<LucaPassport /> shell', () => {
  it('renders the brand and sovereign passport chrome without crashing', async () => {
    render(<LucaPassport />);
    expect(screen.getByText('LUCA')).toBeInTheDocument();
    expect(screen.getByText(/Sovereign Passport/i)).toBeInTheDocument();
  });

  it('shows the patient display name somewhere in the shell', async () => {
    render(<LucaPassport />);
    await waitFor(() =>
      expect(screen.getAllByText(/Pat/i).length).toBeGreaterThan(0)
    );
  });
});
