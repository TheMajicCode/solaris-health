import React from 'react';

export const SolarisMark = ({ size = 36 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(circle at 50% 35%, #0e3b32, #0a1a2e)',
    boxShadow: '0 0 22px rgba(78,222,163,0.4)', border: '1px solid rgba(78,222,163,0.3)' }}>
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="13" r="4.2" fill="#ffb95f" />
      {[...Array(8)].map((_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={12 + Math.cos(a) * 6} y1={13 + Math.sin(a) * 6}
          x2={12 + Math.cos(a) * 8.5} y2={13 + Math.sin(a) * 8.5} stroke="#ffb95f" strokeWidth="1.4" strokeLinecap="round" />;
      })}
    </svg>
  </div>
);

export const Wordmark = ({ size = '1.4rem' }) => (
  <span className="wordmark" style={{ fontSize: size }}>SOLARIS</span>
);

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const cls = variant === 'ghost' ? 'btn btn-ghost' : variant === 'tertiary' ? 'btn btn-tertiary' : 'btn';
  return <button className={`${cls} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = '', glass = false, style, ...props }) {
  return <div className={`${glass ? 'glass' : 'card'} ${className}`} style={{ padding: '1.25rem', ...style }} {...props}>{children}</div>;
}

export function Chip({ active, children, ...props }) {
  return <button className={`chip ${active ? 'active' : ''}`} {...props}>{children}</button>;
}

export function Pill({ children, variant = '' }) {
  return <span className={`pill ${variant}`}>{children}</span>;
}

export function TBD({ label = 'TBD soon' }) {
  return <span className="tbd">✦ {label}</span>;
}

export function Spinner({ label }) {
  return (
    <div className="center col gap-3" style={{ minHeight: '60vh' }}>
      <div style={{ width: 44, height: 44, border: '3px solid var(--surface-container-highest)',
        borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      {label && <p className="muted" style={{ fontSize: '0.9rem' }}>{label}</p>}
    </div>
  );
}

// Circular progress ring (vitality score)
export function VitalityRing({ score = 0, size = 220, label = 'Vitality Score', sub }) {
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4edea3" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-container-highest)" strokeWidth={stroke} fill="none" opacity="0.4" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#ringGrad)" strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.4s var(--ease)', filter: 'drop-shadow(0 0 8px rgba(78,222,163,0.5))' }} />
      </svg>
      <div className="ring-glow" />
      <div style={{ position: 'absolute', inset: 0 }} className="center col">
        <span className="label" style={{ color: 'rgba(78,222,163,0.7)', marginBottom: 4 }}>{label}</span>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: size * 0.32, lineHeight: 1 }}>
          {score}<span style={{ fontSize: size * 0.1, color: 'var(--outline)', fontWeight: 300 }}>/100</span>
        </div>
        {sub && <div className="pill" style={{ marginTop: 8 }}>{sub}</div>}
      </div>
    </div>
  );
}

// 8-system radar chart (pure SVG, no deps needed)
export function RadarChart({ data = [], size = 280 }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 40;
  const n = data.length || 1;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i, val) => {
    const rr = (val / 100) * R;
    return [cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr];
  };
  const rings = [25, 50, 75, 100];
  const poly = data.map((d, i) => point(i, d.score).join(',')).join(' ');
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {rings.map((ring) => (
        <polygon key={ring}
          points={data.map((_, i) => { const rr = (ring / 100) * R; return [cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr].join(','); }).join(' ')}
          fill="none" stroke="rgba(220,226,248,0.07)" strokeWidth="1" />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(220,226,248,0.06)" strokeWidth="1" />;
      })}
      <polygon points={poly} fill="rgba(78,222,163,0.18)" stroke="#4edea3" strokeWidth="2"
        style={{ filter: 'drop-shadow(0 0 6px rgba(78,222,163,0.4))' }} />
      {data.map((d, i) => {
        const [x, y] = point(i, d.score);
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#4edea3" />;
      })}
      {data.map((d, i) => {
        const [lx, ly] = (() => { const rr = R + 18; return [cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr]; })();
        return <text key={i} x={lx} y={ly} fontSize="9" fill="var(--on-surface-variant)"
          textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>
          {(d.short || d.name || '').toUpperCase()}</text>;
      })}
    </svg>
  );
}

export const bandColor = (b) => ({ thriving: 'var(--primary)', balanced: 'var(--secondary)', attention: 'var(--tertiary)', priority: 'var(--error)' }[b] || 'var(--outline)');
