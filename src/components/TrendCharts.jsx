/**
 * TrendCharts — Phase 3
 * Multi-metric line charts with zoom/pan (Brush), customizable date ranges,
 * comparison stats, annotations and rich tooltips.
 *
 * Props:
 *   loader(params)   async fn returning { points, vitality, metrics, range }
 *   userId           optional userId passed through to loader
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Brush, ReferenceLine,
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { TrendingUp, TrendingDown, Minus, Activity, RefreshCw } from 'lucide-react';

const METRICS = [
  { key: 'energy', label: 'Energy', color: '#10B981', unit: '' },
  { key: 'mood', label: 'Mood', color: '#8B5CF6', unit: '' },
  { key: 'sleep', label: 'Sleep', color: '#3B82F6', unit: 'h' },
  { key: 'hydration', label: 'Hydration', color: '#0EA5A0', unit: '' },
  { key: 'movement', label: 'Movement', color: '#E3AC46', unit: 'm' },
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

export default function TrendCharts({ loader, userId }) {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selMetrics, setSelMetrics] = useState(['energy', 'mood', 'sleep']);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { range };
      if (userId) params.userId = userId;
      const d = await loader(params);
      setData(d);
    } catch (e) { console.error('trends load', e); setData(null); }
    finally { setLoading(false); }
  }, [loader, range, userId]);

  useEffect(() => { load(); }, [load]);

  const toggleMetric = (k) => setSelMetrics((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const points = data?.points || [];
  const vitality = data?.vitality || [];
  const metrics = data?.metrics || {};

  // annotation dates: assessment days (significant events)
  const annotations = useMemo(() => vitality.map((v) => v.date).filter(Boolean), [vitality]);

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
        <button className="btn ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>

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
                <span key={m.key} className="tc-mchip" onClick={() => toggleMetric(m.key)}
                  style={on ? { background: `${m.color}1f`, color: m.color, borderColor: 'transparent' } : { opacity: .55 }}>
                  <span className="tc-dot" style={{ background: m.color }} />{m.label}
                </span>
              );
            })}
          </div>
        </div>
        {loading ? (
          <div className="tc-empty"><RefreshCw size={24} className="spin" style={{ opacity: .5 }} /><div style={{ marginTop: 8 }}>Loading trends…</div></div>
        ) : points.length === 0 ? (
          <div className="tc-empty"><Activity size={26} style={{ opacity: .5 }} /><div style={{ marginTop: 8, fontWeight: 600, color: 'var(--ink)' }}>No check-in data for this range</div><div className="small">Daily check-ins will populate these trends.</div></div>
        ) : (
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
        )}
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
    </div>
  );
}
