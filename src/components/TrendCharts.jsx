/**
 * TrendCharts — Phase 3
 * Multi-metric line charts with zoom/pan (Brush), customizable date ranges,
 * comparison stats, annotations and rich tooltips.
 *
 * Props:
 *   loader(params)   async fn returning { points, vitality, metrics, range }
 *   userId           optional target account, passed through to loader. The
 *                    target must be given here rather than captured inside
 *                    `loader`: results are scoped, invalidated and refetched
 *                    by this prop, not by the loader function's identity.
 *
 * WEB-R2-UI: a result is shown only for the scope that requested it — the
 * signed-in viewer, the requested userId and the range — and only for the
 * latest request in that scope. The data area is keyed by scope, so a scope
 * change renders a fresh loading state instead of the previous scope's values.
 * Access denial, session loss and unavailability are shown as such; the empty
 * message appears only for a valid, successful response with no daily points.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Brush, ReferenceLine,
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { TrendingUp, TrendingDown, Minus, Activity, RefreshCw, Lock, LogIn, CloudOff } from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';

const METRICS = [
  { key: 'energy', label: 'Energy', color: '#10B981', unit: '' },
  { key: 'mood', label: 'Mood', color: '#8B5CF6', unit: '' },
  { key: 'sleep', label: 'Sleep', color: '#3B82F6', unit: 'h' },
  { key: 'hydration', label: 'Hydration', color: '#0EA5A0', unit: '' },
  { key: 'movement', label: 'Movement', color: '#E3AC46', unit: 'm' },
  { key: 'nutrition', label: 'Nutrition', color: '#C58A53', unit: '' },
];
const RANGES = [
  { key: '7d', label: '7D' }, { key: '30d', label: '30D' },
  { key: '90d', label: '90D' }, { key: '1y', label: '1Y' }, { key: 'all', label: 'All' },
];

const fmtAxis = (d) => { try { const x = parseISO(d); return isValid(x) ? format(x, 'MMM d') : d; } catch { return d; } };

const CSS = `
.luca .tc-wrap{display:flex;flex-direction:column;gap:14px}
.luca .tc-ranges{display:inline-flex;border:1px solid var(--line);border-radius:11px;overflow:hidden}
.luca .tc-ranges button{padding:6px 13px;font-size:12.5px;font-weight:600;background:var(--surface);
  border:none;border-right:1px solid var(--line);color:var(--muted-2);cursor:pointer;font-family:inherit}
.luca .tc-ranges button:last-child{border-right:none}
.luca .tc-ranges button.on{background:var(--mint-soft);color:var(--teal-ink)}
.luca .tc-metrics{display:flex;flex-wrap:wrap;gap:7px}
.luca .tc-mchip{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;
  border:1px solid var(--line);background:var(--surface);cursor:pointer;font-size:12.5px;font-weight:600;
  color:var(--muted-2);user-select:none;transition:all .15s ease}
.luca .tc-mchip .tc-dot{width:9px;height:9px;border-radius:50%}
.luca .tc-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.luca .tc-stat{border:1px solid var(--line);border-radius:13px;padding:12px 13px;background:var(--surface)}
.luca .tc-stat .lab{font-size:11.5px;color:var(--muted-2);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.luca .tc-stat .val{font-size:22px;font-weight:700;color:var(--ink);margin-top:3px;font-family:'Space Grotesk',sans-serif}
.luca .tc-stat .chg{font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:3px;margin-top:3px}
.luca .tc-tooltip{background:var(--surface);border:1px solid var(--line);border-radius:11px;
  padding:10px 12px;box-shadow:0 8px 24px rgba(8,30,28,.14);font-size:12.5px}
.luca .tc-tooltip .tt-date{font-weight:700;color:var(--ink);margin-bottom:6px}
.luca .tc-tooltip .tt-row{display:flex;align-items:center;gap:7px;padding:1px 0}
.luca .tc-tooltip .tt-row .tt-dot{width:8px;height:8px;border-radius:50%}
.luca .tc-empty{padding:40px 16px;text-align:center;color:var(--muted-2)}
.luca .spin{animation:lucaspin 1s linear infinite}
@keyframes lucaspin{to{transform:rotate(360deg)}}
`;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tc-tooltip">
      <div className="tt-date">{fmtAxis(label)}</div>
      {payload.map((p) => (
        <div className="tt-row" key={p.dataKey}>
          <span className="tt-dot" style={{ background: p.color }} />
          <span style={{ color: 'var(--muted-2)' }}>{p.name}:</span>
          <strong style={{ color: 'var(--ink)' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function StatCard({ metric, stats }) {
  if (!stats || !stats.count) return null;
  const change = stats.change;
  const up = change > 0, down = change < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const tone = up ? '#10B981' : down ? '#EF6B6B' : '#94A3B8';
  return (
    <div className="tc-stat">
      <div className="lab" style={{ color: metric.color }}>{metric.label}</div>
      <div className="val">{stats.avg}{metric.unit}</div>
      <div className="chg" style={{ color: tone }}>
        <Icon size={13} />{change > 0 ? '+' : ''}{change}{metric.unit} vs start · {stats.count} pts
      </div>
    </div>
  );
}

// Map a loader failure to a display state. Only the HTTP status and the
// transport flags set by src/lib/api.js are consulted; error messages and
// bodies are never displayed or logged.
function classifyFailure(e) {
  const status = e && typeof e.status === 'number' ? e.status : null;
  if (status === 403) return 'denied';
  if (status === 401) return 'session';
  // Network errors, timeouts, 5xx (including 503) and anything unexpected.
  return 'unavailable';
}

// Accept only the documented response shape; anything else is unusable, which
// is shown as unavailable rather than as an empty result.
function normalizeTrends(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.points)) return null;
  if (d.vitality != null && !Array.isArray(d.vitality)) return null;
  if (d.metrics != null && (typeof d.metrics !== 'object' || Array.isArray(d.metrics))) return null;
  return { points: d.points, vitality: d.vitality || [], metrics: d.metrics || {} };
}

const STATE_COPY = {
  denied: {
    Icon: Lock,
    title: "You don't have permission to view these trends",
    detail: 'Trends can only be viewed by the account they belong to.',
  },
  session: {
    Icon: LogIn,
    title: 'Your session has expired',
    detail: 'Please sign in again to view trends.',
  },
  signedOut: {
    Icon: LogIn,
    title: 'Sign in to view trends',
    detail: 'Your trends are available after you sign in.',
  },
  unavailable: {
    Icon: CloudOff,
    title: 'Trends are temporarily unavailable',
    detail: 'Check your connection and try again.',
  },
};

function StateMessage({ status, onRetry }) {
  const copy = STATE_COPY[status];
  const { Icon } = copy;
  return (
    <div className="tc-empty" role={status === 'signedOut' ? 'status' : 'alert'}>
      <Icon size={26} style={{ opacity: .5 }} />
      <div style={{ marginTop: 8, fontWeight: 600, color: 'var(--ink)' }}>{copy.title}</div>
      <div className="small">{copy.detail}</div>
      {status === 'unavailable' && (
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={onRetry}><RefreshCw size={15} /> Retry</button>
      )}
    </div>
  );
}

// Presentational: renders stat cards, the daily chart card and the vitality
// card for one resolved state. Data is passed in only when status is 'ready'.
function TrendsPanel({ status, data, selMetrics, onToggleMetric, onRetry }) {
  const ready = status === 'ready' && data;
  const points = ready ? data.points : [];
  const vitality = ready ? data.vitality : [];
  const metrics = ready ? data.metrics : {};

  let body;
  if (status === 'loading') {
    body = <div className="tc-empty" role="status"><RefreshCw size={24} className="spin" style={{ opacity: .5 }} /><div style={{ marginTop: 8 }}>Loading trends…</div></div>;
  } else if (!ready) {
    body = <StateMessage status={status} onRetry={onRetry} />;
  } else if (points.length === 0) {
    body = <div className="tc-empty" role="status"><Activity size={26} style={{ opacity: .5 }} /><div style={{ marginTop: 8, fontWeight: 600, color: 'var(--ink)' }}>No check-in data for this range</div><div className="small">Daily check-ins will populate these trends.</div></div>;
  } else {
    body = (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={points} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EBF3F0" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#6B8581' }} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: '#6B8581' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {METRICS.filter((m) => selMetrics.includes(m.key)).map((m) => (
            <Line key={m.key} type="monotone" dataKey={m.key} name={m.label} stroke={m.color}
              strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls />
          ))}
          {points.length > 8 && <Brush dataKey="date" height={22} stroke="#34C9A9" tickFormatter={fmtAxis} travellerWidth={8} />}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <>
      {/* stat cards */}
      <div className="tc-stats">
        {METRICS.map((m) => <StatCard key={m.key} metric={m} stats={metrics[m.key]} />)}
        {metrics.vitality?.count > 0 && (
          <StatCard metric={{ label: 'Vitality', color: '#34C9A9', unit: '' }} stats={metrics.vitality} />
        )}
      </div>

      {/* metric chart */}
      <div className="card">
        <div className="between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div className="card-title">Daily metrics</div>
          <div className="tc-metrics">
            {METRICS.map((m) => {
              const on = selMetrics.includes(m.key);
              return (
                <span key={m.key} className="tc-mchip" onClick={() => onToggleMetric(m.key)}
                  style={on ? { background: `${m.color}1f`, color: m.color, borderColor: 'transparent' } : { opacity: .55 }}>
                  <span className="tc-dot" style={{ background: m.color }} />{m.label}
                </span>
              );
            })}
          </div>
        </div>
        {body}
      </div>

      {/* vitality chart with annotations */}
      {vitality.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Vitality score over time</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={vitality} margin={{ top: 6, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="tcVit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34C9A9" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#34C9A9" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBF3F0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#6B8581' }} minTickGap={24} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B8581' }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={70} stroke="#10B981" strokeDasharray="4 4" label={{ value: 'Thriving', fontSize: 10, fill: '#10B981', position: 'insideTopRight' }} />
              <ReferenceLine y={50} stroke="#E3AC46" strokeDasharray="4 4" label={{ value: 'Attention', fontSize: 10, fill: '#E3AC46', position: 'insideTopRight' }} />
              <Area type="monotone" dataKey="vitality" name="Vitality" stroke="#159C7E" strokeWidth={2.4} fill="url(#tcVit)" dot={{ r: 3 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

// Fetches and shows one scope. It is keyed by scope in TrendCharts, so each
// instance only ever serves a single viewer, target and range; a scope change
// replaces the instance instead of reusing its state.
function ScopedTrends({ loader, range, userId, generation, ...panel }) {
  const [result, setResult] = useState(null);
  const loaderRef = useRef(loader);

  useEffect(() => { loaderRef.current = loader; });

  useEffect(() => {
    let cancelled = false;
    const params = { range };
    if (userId) params.userId = userId;
    let pending;
    try { pending = Promise.resolve(loaderRef.current(params)); } catch (e) { pending = Promise.reject(e); }
    pending.then(
      (d) => {
        if (cancelled) return;
        const data = normalizeTrends(d);
        setResult({ generation, status: data ? 'ready' : 'unavailable', data });
      },
      (e) => {
        if (cancelled) return;
        setResult({ generation, status: classifyFailure(e), data: null });
      },
    );
    // Scope instances unmount on scope change; a newer generation or an
    // unmount cancels this request, so its late outcome is ignored.
    return () => { cancelled = true; };
  }, [range, userId, generation]);

  const current = result && result.generation === generation ? result : null;
  return <TrendsPanel status={current ? current.status : 'loading'} data={current ? current.data : null} {...panel} />;
}

export default function TrendCharts({ loader, userId }) {
  const app = useApp();
  // Outside an application provider (standalone use) the viewer is a fixed
  // value; inside one, a missing user means signed out.
  const signedOut = Boolean(app) && !app.user;
  const viewer = app ? (app.user ? String(app.user.id ?? '') : null) : '(standalone)';

  const [range, setRange] = useState('30d');
  const [selMetrics, setSelMetrics] = useState(['energy', 'mood', 'sleep']);
  const [generation, setGeneration] = useState(0);

  const refresh = useCallback(() => setGeneration((g) => g + 1), []);
  const toggleMetric = useCallback(
    (k) => setSelMetrics((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])),
    [],
  );

  const scopeKey = JSON.stringify([viewer, userId || null, range]);
  const panel = { selMetrics, onToggleMetric: toggleMetric, onRetry: refresh };

  return (
    <div className="tc-wrap">
      <style>{CSS}</style>

      {/* range + refresh */}
      <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="tc-ranges">
          {RANGES.map((r) => (
            <button key={r.key} className={range === r.key ? 'on' : ''} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
        <button className="btn ghost" onClick={refresh}><RefreshCw size={15} /> Refresh</button>
      </div>

      {signedOut ? (
        <TrendsPanel status="signedOut" data={null} {...panel} />
      ) : (
        <ScopedTrends key={scopeKey} loader={loader} range={range} userId={userId}
          generation={generation} {...panel} />
      )}
    </div>
  );
}
