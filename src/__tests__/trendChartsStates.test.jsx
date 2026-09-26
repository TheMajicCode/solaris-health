/**
 * WEB-R2-UI — TrendCharts states and stale-data isolation.
 *
 * Synthetic fixtures only. The loader is mocked with deferred promises so the
 * order in which requests settle is controlled exactly. `useApp` is mocked to
 * drive the signed-in viewer. `recharts` is replaced with components that print
 * the data they receive, so chart contents are visible as text. A React
 * Profiler records the document text at every commit, which proves what the
 * first committed render after a scope change contains — not only what remains
 * once effects have run.
 */
import React, { Profiler } from 'react';
import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const appState = vi.hoisted(() => ({ value: null }));

vi.mock('../state/AppContext.jsx', () => ({ useApp: () => appState.value }));

vi.mock('recharts', async () => {
  const { createElement: h } = await import('react');
  const Null = () => null;
  return {
    ResponsiveContainer: ({ children }) => h('div', null, children),
    LineChart: ({ data }) => h('div', { 'data-testid': 'daily-chart' }, `daily:${JSON.stringify(data)}`),
    AreaChart: ({ data }) => h('div', { 'data-testid': 'vitality-chart' }, `vitality:${JSON.stringify(data)}`),
    Line: Null, Area: Null, XAxis: Null, YAxis: Null, CartesianGrid: Null,
    Tooltip: Null, Legend: Null, Brush: Null, ReferenceLine: Null,
  };
});

import TrendCharts from '../components/TrendCharts.jsx';

// ---------------------------------------------------------------- fixtures

const EMPTY_MSG = 'No check-in data for this range';
const LOADING_MSG = 'Loading trends…';
const DENIED_MSG = "You don't have permission to view these trends";
const SESSION_MSG = 'Your session has expired';
const SIGNED_OUT_MSG = 'Sign in to view trends';
const UNAVAILABLE_MSG = 'Trends are temporarily unavailable';
const PRIVATE = 'SERVER_PRIVATE_DETAIL';

const PATIENT_A = 'aaaaaaaa-1111-4aaa-8aaa-111111111111';
const PATIENT_B = 'bbbbbbbb-2222-4bbb-9bbb-222222222222';

// Every value derived from `marker` is unique to one fixture, so the marker's
// presence in the page proves which response is being shown.
function trends(marker, { points = true, vitality = true } = {}) {
  const stat = (avg) => ({ count: 1, avg, min: avg, max: avg, first: avg, last: avg, change: 0 });
  return {
    range: '30d',
    points: points ? [{ date: '2026-09-01', energy: marker, mood: 5, sleep: 7, hydration: 4, movement: 20, nutrition: 6 }] : [],
    vitality: vitality ? [{ date: '2026-09-01', vitality: marker, mental: 60, emotional: 61, physical: 62, spiritual: 63 }] : [],
    metrics: {
      energy: points ? stat(marker + 0.5) : { count: 0 },
      vitality: vitality ? stat(marker + 0.25) : { count: 0 },
    },
  };
}

const httpError = (status) => Object.assign(new Error(PRIVATE), { status, body: { error: PRIVATE } });
const networkError = () => Object.assign(new TypeError(PRIVATE), { isNetworkError: true });
const timeoutError = () => Object.assign(new Error(PRIVATE), { isTimeout: true });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// A loader whose every call returns a fresh deferred promise.
function deferredLoader() {
  const calls = [];
  const loader = vi.fn((params) => {
    const d = deferred();
    calls.push({ params, ...d });
    return d.promise;
  });
  return { loader, calls };
}

const settle = (fn) => act(async () => { fn(); await Promise.resolve(); });

// Render inside a Profiler that snapshots the document text at every commit.
function renderTracked(ui) {
  const commits = [];
  const onRender = () => { commits.push(document.body.textContent); };
  const wrap = (node) => <Profiler id="trends" onRender={onRender}>{node}</Profiler>;
  const utils = render(wrap(ui));
  return {
    ...utils,
    commits,
    rerenderTracked: (node) => utils.rerender(wrap(node)),
  };
}

const text = () => document.body.textContent;
const signedIn = (id, extra = {}) => ({ user: { id }, logout: vi.fn(), ...extra });

let consoleSpies;
beforeEach(() => {
  appState.value = signedIn('viewer-1');
  consoleSpies = ['error', 'warn', 'log', 'info'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  consoleSpies.forEach((s) => s.mockRestore());
});

function expectNothingLogged() {
  for (const spy of consoleSpies) {
    for (const args of spy.mock.calls) {
      for (const a of args) {
        expect(a instanceof Error).toBe(false);
        expect(String(a && a.message !== undefined ? a.message : a)).not.toContain(PRIVATE);
      }
    }
  }
}

// ---------------------------------------------------------------- results

describe('successful results are preserved', () => {
  it('renders stat cards, the daily chart and the vitality chart', async () => {
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} />);
    expect(calls[0].params).toEqual({ range: '30d' });
    expect(screen.getByText(LOADING_MSG)).toBeInTheDocument();

    await settle(() => calls[0].resolve(trends(4101)));

    expect(screen.getByText('4101.5')).toBeInTheDocument();
    expect(screen.getByText('4101.25')).toBeInTheDocument();
    expect(screen.getByTestId('daily-chart').textContent).toContain('"energy":4101');
    expect(screen.getByTestId('vitality-chart').textContent).toContain('"vitality":4101');
    expect(screen.queryByText(EMPTY_MSG)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('passes the target userId in patient mode', async () => {
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} userId={PATIENT_A} />);
    expect(calls[0].params).toEqual({ range: '30d', userId: PATIENT_A });
  });

  it('shows the empty message only for a valid, successful response with no data', async () => {
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} />);
    await settle(() => calls[0].resolve(trends(4102, { points: false, vitality: false })));
    expect(screen.getByText(EMPTY_MSG)).toBeInTheDocument();
    expect(screen.queryByTestId('daily-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vitality-chart')).not.toBeInTheDocument();
  });

  it('keeps a valid vitality-only result', async () => {
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} />);
    await settle(() => calls[0].resolve(trends(4103, { points: false, vitality: true })));
    expect(screen.getByText(EMPTY_MSG)).toBeInTheDocument();
    expect(screen.queryByTestId('daily-chart')).not.toBeInTheDocument();
    expect(screen.getByTestId('vitality-chart').textContent).toContain('"vitality":4103');
    expect(screen.getByText('4103.25')).toBeInTheDocument();
    expect(screen.getByText('Vitality score over time')).toBeInTheDocument();
  });

  it('keeps range controls working', async () => {
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} />);
    fireEvent.click(screen.getByRole('button', { name: '7D' }));
    expect(calls.at(-1).params).toEqual({ range: '7d' });
    expect(screen.getByRole('button', { name: '7D' })).toHaveClass('on');
    expect(screen.getByRole('button', { name: '30D' })).not.toHaveClass('on');
  });

  it('works outside an application provider', async () => {
    appState.value = null;
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} />);
    expect(calls).toHaveLength(1);
    await settle(() => calls[0].resolve(trends(4104)));
    expect(screen.getByText('4104.5')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- failures

describe('failures are never shown as empty data', () => {
  async function failWith(outcome) {
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} userId={PATIENT_A} />);
    await settle(() => outcome(calls[0]));
    return { loader, calls };
  }

  it('shows an explicit access-denied message for 403', async () => {
    await failWith((c) => c.reject(httpError(403)));
    expect(screen.getByText(DENIED_MSG)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MSG)).not.toBeInTheDocument();
    expect(screen.queryByTestId('daily-chart')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
    expect(text()).not.toContain(PRIVATE);
  });

  it('shows session guidance for 401 and does not log the user out', async () => {
    const app = signedIn('viewer-1');
    appState.value = app;
    await failWith((c) => c.reject(httpError(401)));
    expect(screen.getByText(SESSION_MSG)).toBeInTheDocument();
    expect(screen.getByText('Please sign in again to view trends.')).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MSG)).not.toBeInTheDocument();
    expect(app.logout).not.toHaveBeenCalled();
    expect(text()).not.toContain(PRIVATE);
  });

  test.each([
    ['network error', () => networkError()],
    ['timeout', () => timeoutError()],
    ['500', () => httpError(500)],
    ['502', () => httpError(502)],
    ['503', () => httpError(503)],
    ['504', () => httpError(504)],
    ['400', () => httpError(400)],
    ['404', () => httpError(404)],
    ['409', () => httpError(409)],
    ['error without status', () => new Error(PRIVATE)],
    ['non-Error rejection', () => PRIVATE],
  ])('shows the unavailable state for %s', async (_label, make) => {
    await failWith((c) => c.reject(make()));
    expect(screen.getByText(UNAVAILABLE_MSG)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MSG)).not.toBeInTheDocument();
    expect(text()).not.toContain(PRIVATE);
  });

  test.each([
    ['{}', {}],
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a string', PRIVATE],
    ['non-array points', { points: PRIVATE, vitality: [], metrics: {} }],
    ['non-array vitality', { points: [], vitality: PRIVATE, metrics: {} }],
    ['array metrics', { points: [], vitality: [], metrics: [] }],
  ])('shows the unavailable state for an unusable response: %s', async (_label, value) => {
    await failWith((c) => c.resolve(value));
    expect(screen.getByText(UNAVAILABLE_MSG)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MSG)).not.toBeInTheDocument();
    expect(text()).not.toContain(PRIVATE);
  });

  it('treats a loader that throws synchronously as unavailable', async () => {
    const loader = vi.fn(() => { throw httpError(500); });
    render(<TrendCharts loader={loader} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(UNAVAILABLE_MSG)).toBeInTheDocument();
  });

  it('Retry issues a new request and shows its result', async () => {
    const { calls } = await failWith((c) => c.reject(networkError()));
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(calls).toHaveLength(2);
    expect(calls[1].params).toEqual({ range: '30d', userId: PATIENT_A });
    expect(screen.getByText(LOADING_MSG)).toBeInTheDocument();
    await settle(() => calls[1].resolve(trends(4201)));
    expect(screen.getByText('4201.5')).toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE_MSG)).not.toBeInTheDocument();
  });

  it('never logs error objects or their contents', async () => {
    await failWith((c) => c.reject(httpError(503)));
    await failWith((c) => c.reject(httpError(403)));
    await failWith((c) => c.reject(networkError()));
    expectNothingLogged();
  });
});

// ---------------------------------------------------------------- stale isolation

describe('stale information never crosses scopes', () => {
  it('a patient switch shows no previous values in its first committed render', async () => {
    const { loader, calls } = deferredLoader();
    const t = renderTracked(<TrendCharts loader={loader} userId={PATIENT_A} />);
    await settle(() => calls[0].resolve(trends(5101)));
    expect(text()).toContain('5101');

    const before = t.commits.length;
    t.rerenderTracked(<TrendCharts loader={loader} userId={PATIENT_B} />);

    expect(t.commits.length).toBeGreaterThan(before);
    expect(t.commits[before]).not.toContain('5101');
    expect(t.commits[before]).toContain(LOADING_MSG);
    expect(calls.at(-1).params).toEqual({ range: '30d', userId: PATIENT_B });

    await settle(() => calls.at(-1).resolve(trends(5102)));
    expect(text()).toContain('5102');
    t.commits.slice(before).forEach((c) => expect(c).not.toContain('5101'));
  });

  it("a late success for the previous patient cannot replace or end the new patient's loading", async () => {
    const { loader, calls } = deferredLoader();
    const t = renderTracked(<TrendCharts loader={loader} userId={PATIENT_A} />);
    const reqA = calls[0];
    t.rerenderTracked(<TrendCharts loader={loader} userId={PATIENT_B} />);
    const reqB = calls.at(-1);

    await settle(() => reqA.resolve(trends(5201)));
    expect(text()).not.toContain('5201');
    expect(screen.getByText(LOADING_MSG)).toBeInTheDocument();

    await settle(() => reqB.resolve(trends(5202)));
    expect(text()).toContain('5202');
    t.commits.forEach((c) => expect(c).not.toContain('5201'));
  });

  it("a late rejection for the previous patient cannot replace or end the new patient's state", async () => {
    const { loader, calls } = deferredLoader();
    const t = renderTracked(<TrendCharts loader={loader} userId={PATIENT_A} />);
    const reqA = calls.at(-1);
    t.rerenderTracked(<TrendCharts loader={loader} userId={PATIENT_B} />);
    const reqB = calls.at(-1);

    await settle(() => reqA.reject(httpError(403)));
    expect(screen.getByText(LOADING_MSG)).toBeInTheDocument();
    expect(screen.queryByText(DENIED_MSG)).not.toBeInTheDocument();

    await settle(() => reqB.resolve(trends(5302)));
    expect(text()).toContain('5302');
    t.commits.forEach((c) => expect(c).not.toContain(DENIED_MSG));
  });

  it('a signed-in account switch invalidates own-account results', async () => {
    appState.value = signedIn('viewer-1');
    const { loader, calls } = deferredLoader();
    const t = renderTracked(<TrendCharts loader={loader} />);
    await settle(() => calls[0].resolve(trends(5401)));
    expect(text()).toContain('5401');

    const pendingBeforeSwitch = calls.length;
    appState.value = signedIn('viewer-2');
    const before = t.commits.length;
    t.rerenderTracked(<TrendCharts loader={loader} />);

    expect(t.commits[before]).not.toContain('5401');
    expect(t.commits[before]).toContain(LOADING_MSG);
    expect(calls.length).toBe(pendingBeforeSwitch + 1);
    expect(calls.at(-1).params).toEqual({ range: '30d' });

    await settle(() => calls.at(-1).resolve(trends(5402)));
    expect(text()).toContain('5402');
    t.commits.slice(before).forEach((c) => expect(c).not.toContain('5401'));
  });

  it("a late response for the previous account is ignored after an account switch", async () => {
    appState.value = signedIn('viewer-1');
    const { loader, calls } = deferredLoader();
    const t = renderTracked(<TrendCharts loader={loader} />);
    const req1 = calls[0];
    appState.value = signedIn('viewer-2');
    t.rerenderTracked(<TrendCharts loader={loader} />);
    const req2 = calls.at(-1);

    await settle(() => req1.resolve(trends(5501)));
    expect(text()).not.toContain('5501');
    expect(screen.getByText(LOADING_MSG)).toBeInTheDocument();
    await settle(() => req2.resolve(trends(5502)));
    expect(text()).toContain('5502');
    t.commits.forEach((c) => expect(c).not.toContain('5501'));
  });

  it('logout removes the previous values at once, makes no request and does not log out itself', async () => {
    const app = signedIn('viewer-1');
    appState.value = app;
    const { loader, calls } = deferredLoader();
    const t = renderTracked(<TrendCharts loader={loader} />);
    await settle(() => calls[0].resolve(trends(5601)));
    expect(text()).toContain('5601');
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    const inFlight = calls.at(-1);
    const callCount = calls.length;

    appState.value = { user: null, logout: app.logout };
    const before = t.commits.length;
    t.rerenderTracked(<TrendCharts loader={loader} />);

    expect(t.commits[before]).not.toContain('5601');
    expect(t.commits[before]).toContain(SIGNED_OUT_MSG);
    expect(screen.getByRole('status')).toHaveTextContent(SIGNED_OUT_MSG);
    expect(calls.length).toBe(callCount);

    await settle(() => inFlight.resolve(trends(5602)));
    expect(text()).not.toContain('5602');
    expect(screen.getByText(SIGNED_OUT_MSG)).toBeInTheDocument();
    expect(app.logout).not.toHaveBeenCalled();
  });

  it('a range change shows no previous-range values in its first committed render', async () => {
    const { loader, calls } = deferredLoader();
    const t = renderTracked(<TrendCharts loader={loader} />);
    await settle(() => calls[0].resolve(trends(5701)));
    expect(text()).toContain('5701');

    const before = t.commits.length;
    fireEvent.click(screen.getByRole('button', { name: '90D' }));

    expect(t.commits[before]).not.toContain('5701');
    expect(t.commits[before]).toContain(LOADING_MSG);
    expect(calls.at(-1).params).toEqual({ range: '90d' });
    await settle(() => calls.at(-1).resolve(trends(5702)));
    expect(text()).toContain('5702');
  });

  it('a late response for the previous range is ignored', async () => {
    const { loader, calls } = deferredLoader();
    const t = renderTracked(<TrendCharts loader={loader} />);
    const req30 = calls[0];
    fireEvent.click(screen.getByRole('button', { name: '1Y' }));
    const req1y = calls.at(-1);

    await settle(() => req30.resolve(trends(5801)));
    expect(text()).not.toContain('5801');
    expect(screen.getByText(LOADING_MSG)).toBeInTheDocument();
    await settle(() => req1y.resolve(trends(5802)));
    expect(text()).toContain('5802');
    t.commits.forEach((c) => expect(c).not.toContain('5801'));
  });
});

describe('within a scope, the latest request wins', () => {
  it('Refresh hides the previous result in its first committed render', async () => {
    const { loader, calls } = deferredLoader();
    const t = renderTracked(<TrendCharts loader={loader} />);
    await settle(() => calls[0].resolve(trends(6001)));
    const before = t.commits.length;
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    expect(t.commits[before]).not.toContain('6001');
    expect(t.commits[before]).toContain(LOADING_MSG);
    await settle(() => calls.at(-1).resolve(trends(6002)));
    expect(text()).toContain('6002');
  });

  it('overlapping Refresh: an older success cannot replace a newer one', async () => {
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} />);
    await settle(() => calls[0].resolve(trends(6101)));

    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    const older = calls.at(-1);
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    const newer = calls.at(-1);
    expect(newer).not.toBe(older);

    await settle(() => newer.resolve(trends(6103)));
    expect(text()).toContain('6103');
    await settle(() => older.resolve(trends(6102)));
    expect(text()).toContain('6103');
    expect(text()).not.toContain('6102');
  });

  it('overlapping Refresh: an older outcome cannot end the newer loading state', async () => {
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} />);
    await settle(() => calls[0].resolve(trends(6201)));
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    const older = calls.at(-1);
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    const newer = calls.at(-1);

    await settle(() => older.resolve(trends(6202)));
    expect(screen.getByText(LOADING_MSG)).toBeInTheDocument();
    expect(text()).not.toContain('6202');

    await settle(() => newer.resolve(trends(6203)));
    expect(text()).toContain('6203');
  });

  it('overlapping Retry: an older rejection cannot replace newer content', async () => {
    const { loader, calls } = deferredLoader();
    render(<TrendCharts loader={loader} userId={PATIENT_A} />);
    await settle(() => calls[0].reject(networkError()));
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    const older = calls.at(-1);
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    const newer = calls.at(-1);

    await settle(() => older.reject(httpError(403)));
    expect(screen.getByText(LOADING_MSG)).toBeInTheDocument();
    expect(screen.queryByText(DENIED_MSG)).not.toBeInTheDocument();

    await settle(() => newer.resolve(trends(6303)));
    expect(text()).toContain('6303');
    await settle(() => Promise.resolve());
    expect(screen.queryByText(DENIED_MSG)).not.toBeInTheDocument();
  });

  it('a later request in the same scope uses the latest loader', async () => {
    const first = deferredLoader();
    const second = deferredLoader();
    const { rerender } = render(<TrendCharts loader={first.loader} userId={PATIENT_A} />);
    await settle(() => first.calls[0].resolve(trends(6501)));
    rerender(<TrendCharts loader={second.loader} userId={PATIENT_A} />);
    expect(second.calls).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(1);
    expect(second.calls[0].params).toEqual({ range: '30d', userId: PATIENT_A });
    await settle(() => second.calls[0].resolve(trends(6502)));
    expect(text()).toContain('6502');
  });

  it('a new loader function from a parent re-render does not start a request by itself', async () => {
    const { loader, calls } = deferredLoader();
    const { rerender } = render(<TrendCharts loader={(p) => loader(p)} />);
    await settle(() => calls[0].resolve(trends(6401)));
    rerender(<TrendCharts loader={(p) => loader(p)} />);
    rerender(<TrendCharts loader={(p) => loader(p)} />);
    expect(calls).toHaveLength(1);
    expect(text()).toContain('6401');
  });
});

describe('unmount', () => {
  // React 19 does not report state updates after unmount, so the cancellation
  // guard itself is not observable here; this checks late outcomes are harmless.
  it('late outcomes after unmount render nothing, request nothing and log nothing', async () => {
    const { loader, calls } = deferredLoader();
    const { unmount } = render(<TrendCharts loader={loader} />);
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    const callsAtUnmount = calls.length;
    expect(callsAtUnmount).toBe(2);
    unmount();
    await settle(() => {
      calls[0].resolve(trends(7101));
      calls.at(-1).reject(httpError(500));
    });
    expect(text()).not.toContain('7101');
    expect(calls).toHaveLength(callsAtUnmount);
    expect(document.body.querySelector('.tc-wrap')).toBeNull();
    expectNothingLogged();
  });
});
