/**
 * API client tests — verifies token handling, request construction (URL,
 * method, auth header, JSON body), and error propagation. fetch is mocked so
 * these run fully offline.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { api } from '../lib/api';

function mockFetchOnce({ ok = true, status = 200, body = {} } = {}) {
  const res = {
    ok,
    status,
    json: async () => body,
    blob: async () => new Blob([JSON.stringify(body)]),
  };
  global.fetch = vi.fn().mockResolvedValue(res);
  return global.fetch;
}

beforeEach(() => {
  localStorage.clear();
  api.setToken(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('token management', () => {
  it('persists the token to localStorage on setToken', () => {
    api.setToken('abc123');
    expect(localStorage.getItem('token')).toBe('abc123');
    expect(api.token).toBe('abc123');
  });

  it('clears the token on logout', () => {
    api.setToken('abc123');
    api.logout();
    expect(localStorage.getItem('token')).toBeNull();
    expect(api.token).toBeNull();
  });
});

describe('request construction', () => {
  it('GET hits the right URL and parses JSON', async () => {
    const fetchMock = mockFetchOnce({ body: { id: 1, email: 'a@b.c' } });
    const data = await api.getMe();
    expect(data).toEqual({ id: 1, email: 'a@b.c' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/users\/me$/);
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('adds the Authorization header when a token is set', async () => {
    api.setToken('tok-42');
    const fetchMock = mockFetchOnce({ body: {} });
    await api.getMe();
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer tok-42');
  });

  it('omits the Authorization header when no token is set', async () => {
    const fetchMock = mockFetchOnce({ body: {} });
    await api.getMe();
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('POST login sends a JSON body and stores the returned token', async () => {
    const fetchMock = mockFetchOnce({ body: { token: 'new-token', user: { id: 9 } } });
    const data = await api.login('a@b.c', 'secret');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ email: 'a@b.c', password: 'secret' });
    expect(data.token).toBe('new-token');
    expect(api.token).toBe('new-token');
  });

  it('builds query strings for list endpoints', async () => {
    const fetchMock = mockFetchOnce({ body: [] });
    await api.getListings({ category: 'wellness', q: 'yoga' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/listings?');
    expect(url).toContain('category=wellness');
    expect(url).toContain('q=yoga');
  });
});

describe('error handling', () => {
  it('throws with the server-provided error message on a non-OK response', async () => {
    mockFetchOnce({ ok: false, status: 400, body: { error: 'Invalid credentials' } });
    await expect(api.login('a@b.c', 'wrong')).rejects.toThrow('Invalid credentials');
  });

  it('throws a generic message when the error body is unparseable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });
    await expect(api.getMe()).rejects.toThrow('Request failed');
  });

  it('returns null for a 204 No Content response', async () => {
    mockFetchOnce({ ok: true, status: 204, body: {} });
    const data = await api.getMe();
    expect(data).toBeNull();
  });
});
