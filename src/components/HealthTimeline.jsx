/**
 * HealthTimeline — Phase 3
 * Interactive vertical timeline of health events, clustered by date with
 * filtering, search, detail modal and CSV/JSON export.
 *
 * Props:
 *   loader(params)      async fn returning { total, events, limit, offset }
 *   exporter(body)      async fn returning a Blob (CSV/JSON)  [optional]
 *   exportUserId        userId to pass to exporter (for patient view)
 *   title, subtitle     header copy
 *   clusterBy           'day' | 'week' (default 'day')
 *   onEventNavigate     optional fn(event) — extra action button in modal
 *   extraNote           optional node rendered under event detail (e.g. clinical notes)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  format, parseISO, isValid, startOfWeek, endOfWeek,
} from 'date-fns';
import {
  Calendar, HeartPulse, ClipboardCheck, Bot, Coins, FileText, Search, X,
  Filter, Download, ChevronDown, ChevronRight, Clock, Sparkles, RefreshCw,
  UserPlus, Layers,
} from 'lucide-react';

/* ---- event type config ---- */
export const EVENT_TYPES = {
  appointment: { label: 'Appointments', color: '#3B82F6', soft: 'rgba(59,130,246,.12)', icon: Calendar },
  vitals: { label: 'Vitals', color: '#10B981', soft: 'rgba(16,185,129,.12)', icon: HeartPulse },
  assessment: { label: 'Assessments', color: '#8B5CF6', soft: 'rgba(139,92,246,.12)', icon: ClipboardCheck },
  coach: { label: 'Coach', color: '#E3AC46', soft: 'rgba(227,172,70,.14)', icon: Bot },
  reward: { label: 'Rewards', color: '#C58A53', soft: 'rgba(197,138,83,.14)', icon: Coins },
  document: { label: 'Documents', color: '#64748B', soft: 'rgba(100,116,139,.14)', icon: FileText },
  registration: { label: 'Sign-ups', color: '#0EA5A0', soft: 'rgba(14,165,160,.14)', icon: UserPlus },
};
const typeOf = (t) => EVENT_TYPES[t] || { label: t, color: '#64748B', soft: 'rgba(100,116,139,.14)', icon: Layers };

const safeDate = (d) => {
  if (!d) return null;
  const dt = typeof d === 'string' ? parseISO(d) : new Date(d);
  return isValid(dt) ? dt : null;
};
const fmtFull = (d) => { const x = safeDate(d); return x ? format(x, 'EEE, MMM d, yyyy') : '—'; };
const fmtTime = (d) => { const x = safeDate(d); return x ? format(x, 'h:mm a') : ''; };

const CSS = `
.luca .tl-wrap{display:flex;flex-direction:column;gap:14px}
.luca .tl-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.luca .tl-chips{display:flex;flex-wrap:wrap;gap:7px}
.luca .tl-typechip{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;
  border:1px solid var(--line);background:var(--surface);cursor:pointer;font-size:12.5px;font-weight:600;
  color:var(--muted-2);transition:all .15s ease;user-select:none}
.luca .tl-typechip .tl-dot{width:9px;height:9px;border-radius:50%}
.luca .tl-typechip.on{color:var(--ink);border-color:transparent}
.luca .tl-date-inp{border:1px solid var(--line);border-radius:10px;padding:7px 10px;font-size:12.5px;
  color:var(--ink);background:var(--surface);font-family:inherit;outline:none}
.luca .tl-date-inp:focus{border-color:var(--mint);box-shadow:0 0 0 3px var(--mint-soft)}
.luca .tl-cluster{margin-top:2px}
.luca .tl-cluster-head{display:flex;align-items:center;gap:10px;cursor:pointer;padding:7px 0;
  border-bottom:1px solid var(--line-2);margin-bottom:6px}
.luca .tl-cluster-head .tl-cdate{font-weight:700;font-size:13.5px;color:var(--ink)}
.luca .tl-cluster-head .tl-ccount{font-size:11.5px;color:var(--muted-2);font-weight:600}
.luca .tl-line{position:relative;padding-left:30px}
.luca .tl-line::before{content:'';position:absolute;left:10px;top:4px;bottom:4px;width:2px;background:var(--line)}
.luca .tl-item{position:relative;padding:10px 0;cursor:pointer}
.luca .tl-item .tl-node{position:absolute;left:-26px;top:13px;width:20px;height:20px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;border:2px solid var(--surface);box-shadow:0 0 0 1px var(--line)}
.luca .tl-card{display:flex;align-items:flex-start;gap:11px;padding:11px 13px;border:1px solid var(--line);
  border-radius:13px;background:var(--surface);transition:all .15s ease}
.luca .tl-item:hover .tl-card{border-color:var(--mint);box-shadow:0 4px 16px rgba(20,80,75,.07);transform:translateY(-1px)}
.luca .tl-card-body{flex:1;min-width:0}
.luca .tl-card-title{font-weight:650;font-size:13.5px;color:var(--ink);line-height:1.3}
.luca .tl-card-detail{font-size:12.5px;color:var(--muted-2);margin-top:2px;overflow:hidden;
  text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.luca .tl-card-time{font-size:11px;color:var(--muted-2);white-space:nowrap;display:flex;align-items:center;gap:4px}
.luca .tl-modal-scrim{position:fixed;inset:0;background:rgba(10,30,28,.45);backdrop-filter:blur(3px);
  z-index:120;display:flex;align-items:center;justify-content:center;padding:18px}
.luca .tl-modal{background:var(--surface);border-radius:18px;max-width:460px;width:100%;
  box-shadow:0 24px 60px rgba(8,30,28,.3);overflow:hidden}
.luca .tl-modal-head{padding:18px 20px;display:flex;align-items:flex-start;gap:12px;border-bottom:1px solid var(--line-2)}
.luca .tl-modal-body{padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.luca .tl-kv{display:flex;justify-content:space-between;gap:14px;font-size:13px;padding:6px 0;border-bottom:1px dashed var(--line-2)}
.luca .tl-kv:last-child{border-bottom:none}
.luca .tl-kv .k{color:var(--muted-2);font-weight:600}
.luca .tl-kv .v{color:var(--ink);text-align:right}
.luca .tl-empty{padding:40px 16px;text-align:center;color:var(--muted-2)}
.luca .tl-loadmore{display:flex;justify-content:center;margin-top:8px}
.luca .spin{animation:lucaspin 1s linear infinite}
@keyframes lucaspin{to{transform:rotate(360deg)}}
`;

function EventModal({ event, onClose, onEventNavigate, extraNote }) {
  if (!event) return null;
  const cfg = typeOf(event.type);
  const Icon = cfg.icon;
  const meta = event.meta || {};
  const metaEntries = Object.entries(meta).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length));
  return (
    <div className="tl-modal-scrim" onClick={onClose}>
      <div className="tl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tl-modal-head">
          <div className="tl-node" style={{ position: 'static', width: 38, height: 38, background: cfg.soft, boxShadow: 'none' }}>
            <Icon size={19} color={cfg.color} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="tl-card-title" style={{ fontSize: 15 }}>{event.title}</div>
            <div className="tl-card-time" style={{ marginTop: 3 }}>
              <Clock size={12} />{fmtFull(event.date)} {fmtTime(event.date) && `· ${fmtTime(event.date)}`}
            </div>
          </div>
          <button className="btn ghost" style={{ padding: 6 }} onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <div className="tl-modal-body">
          <span className="pill" style={{ background: cfg.soft, color: cfg.color, alignSelf: 'flex-start' }}>{cfg.label}</span>
          {event.detail && <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{event.detail}</div>}
          {event.status && (
            <div className="tl-kv"><span className="k">Status</span><span className="v" style={{ textTransform: 'capitalize' }}>{event.status}</span></div>
          )}
          {metaEntries.map(([k, v]) => (
            <div className="tl-kv" key={k}>
              <span className="k" style={{ textTransform: 'capitalize' }}>{k}</span>
              <span className="v">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
            </div>
          ))}
          {event.source && (
            <div className="tl-kv"><span className="k">Source</span><span className="v" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }}>{event.source.table}</span></div>
          )}
          {extraNote && extraNote(event)}
          {onEventNavigate && (
            <button className="btn" onClick={() => onEventNavigate(event)} style={{ marginTop: 4 }}>
              <ChevronRight size={15} /> View source
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HealthTimeline({
  loader, exporter, exportUserId, title = 'Health Timeline',
  subtitle = 'Your complete journey, in one chronological view.',
  clusterBy = 'day', onEventNavigate, extraNote,
}) {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [collapsed, setCollapsed] = useState({});

  // filters
  const allTypeKeys = useMemo(() => Object.keys(EVENT_TYPES).filter((k) => k !== 'registration'), []);
  const [selTypes, setSelTypes] = useState([]); // empty = all
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const buildParams = useCallback((nextOffset) => {
    const p = { limit: LIMIT, offset: nextOffset };
    if (selTypes.length) p.types = selTypes.join(',');
    if (from) p.from = from;
    if (to) p.to = to;
    if (q.trim()) p.q = q.trim();
    return p;
  }, [selTypes, from, to, q]);

  const load = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const nextOffset = reset ? 0 : offset;
      const data = await loader(buildParams(nextOffset));
      const rows = data?.events || [];
      setTotal(data?.total || rows.length);
      setEvents((prev) => (reset ? rows : [...prev, ...rows]));
      setOffset(nextOffset + rows.length);
    } catch (e) {
      console.error('timeline load', e);
      if (reset) setEvents([]);
    } finally { setLoading(false); }
  }, [loader, buildParams, offset]);

  // reload when filters change (debounced search)
  useEffect(() => {
    const t = setTimeout(() => { load(true); }, q ? 280 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selTypes, from, to, q, loader]);

  const toggleType = (k) => setSelTypes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  // cluster events
  const clusters = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const d = safeDate(e.date) || new Date();
      let key, label;
      if (clusterBy === 'week') {
        const ws = startOfWeek(d, { weekStartsOn: 1 });
        key = format(ws, 'yyyy-ww');
        label = `Week of ${format(ws, 'MMM d')} – ${format(endOfWeek(d, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;
      } else {
        key = format(d, 'yyyy-MM-dd');
        label = format(d, 'EEEE, MMMM d, yyyy');
      }
      if (!map.has(key)) map.set(key, { key, label, items: [] });
      map.get(key).items.push(e);
    }
    return Array.from(map.values());
  }, [events, clusterBy]);

  const doExport = async (fmt) => {
    try {
      let blob;
      if (exporter) {
        blob = await exporter({ format: fmt, userId: exportUserId, ...buildParams(0), limit: 1000 });
      } else {
        const payload = { exportedAt: new Date().toISOString(), count: events.length, events };
        blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `luca-timeline.${fmt}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('export', e); }
  };

  return (
    <div className="tl-wrap">
      <style>{CSS}</style>

      {/* controls */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="between" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div className="card-title">{title}</div>
            <div className="small muted" style={{ marginTop: 2 }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => doExport('csv')}><Download size={15} /> CSV</button>
            <button className="btn ghost" onClick={() => doExport('json')}><Download size={15} /> JSON</button>
            <button className="btn ghost" onClick={() => load(true)} title="Refresh"><RefreshCw size={15} /></button>
          </div>
        </div>

        <div className="tl-controls">
          <div className="search-inline" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} />
            <input placeholder="Search events…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button className="btn ghost" style={{ padding: 2 }} onClick={() => setQ('')}><X size={14} /></button>}
          </div>
          <input className="tl-date-inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <span className="small muted">to</span>
          <input className="tl-date-inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </div>

        <div className="tl-chips">
          <span className="tl-typechip" style={{ borderStyle: 'dashed', opacity: .85 }}><Filter size={13} /> Types</span>
          {allTypeKeys.map((k) => {
            const cfg = EVENT_TYPES[k];
            const on = selTypes.length === 0 || selTypes.includes(k);
            return (
              <span key={k} className={`tl-typechip ${selTypes.includes(k) ? 'on' : ''}`}
                onClick={() => toggleType(k)}
                style={selTypes.includes(k) ? { background: cfg.soft, color: cfg.color } : { opacity: selTypes.length && !on ? .45 : 1 }}>
                <span className="tl-dot" style={{ background: cfg.color }} />{cfg.label}
              </span>
            );
          })}
          {selTypes.length > 0 && (
            <span className="tl-typechip" onClick={() => setSelTypes([])} style={{ borderStyle: 'dashed' }}>
              <X size={13} /> Clear
            </span>
          )}
        </div>
      </div>

      {/* timeline */}
      <div className="card">
        {loading && events.length === 0 ? (
          <div className="tl-empty"><RefreshCw size={26} className="spin" style={{ opacity: .5 }} /><div style={{ marginTop: 8 }}>Loading your timeline…</div></div>
        ) : clusters.length === 0 ? (
          <div className="tl-empty">
            <Sparkles size={28} style={{ opacity: .5 }} />
            <div style={{ marginTop: 8, fontWeight: 600, color: 'var(--ink)' }}>No events yet</div>
            <div className="small">Check-ins, appointments, assessments and coach sessions will appear here.</div>
          </div>
        ) : (
          <>
            {clusters.map((cl) => {
              const isCollapsed = collapsed[cl.key];
              return (
                <div className="tl-cluster" key={cl.key}>
                  <div className="tl-cluster-head" onClick={() => setCollapsed((c) => ({ ...c, [cl.key]: !c[cl.key] }))}>
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    <span className="tl-cdate">{cl.label}</span>
                    <span className="tl-ccount">{cl.items.length} event{cl.items.length !== 1 ? 's' : ''}</span>
                  </div>
                  {!isCollapsed && (
                    <div className="tl-line">
                      {cl.items.map((e) => {
                        const cfg = typeOf(e.type);
                        const Icon = cfg.icon;
                        return (
                          <div className="tl-item" key={e.id} onClick={() => setActive(e)}>
                            <div className="tl-node" style={{ background: cfg.soft }}>
                              <Icon size={11} color={cfg.color} />
                            </div>
                            <div className="tl-card">
                              <div className="tl-card-body">
                                <div className="tl-card-title">{e.title}</div>
                                {e.detail && <div className="tl-card-detail">{e.detail}</div>}
                              </div>
                              <div className="tl-card-time"><Clock size={11} />{fmtTime(e.date) || fmtFull(e.date)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {events.length < total && (
              <div className="tl-loadmore">
                <button className="btn ghost" onClick={() => load(false)} disabled={loading}>
                  {loading ? 'Loading…' : `Load more (${total - events.length} left)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <EventModal event={active} onClose={() => setActive(null)} onEventNavigate={onEventNavigate} extraNote={extraNote} />
    </div>
  );
}
