/**
 * RatingStars — compact, accessible star rating.
 * Read-only display or interactive input (when onChange is provided).
 *
 * Props:
 *   value     number (0–5, supports halves for display)
 *   onChange  (n)=>void  — when present, stars become clickable
 *   size      px (default 16)
 *   count     optional review count to render after the stars
 *   showValue bool — render the numeric value (e.g. "4.8")
 */
import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function RatingStars({ value = 0, onChange, size = 16, count, showValue = false }) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === 'function';
  const shown = hover || value;

  return (
    <span className="rs-wrap" role={interactive ? 'radiogroup' : 'img'}
      aria-label={`Rating ${Number(value).toFixed(1)} of 5`}>
      <span className="rs-stars" style={{ ['--rs-size']: `${size}px` }}>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, shown - (i - 1)));
          return (
            <span
              key={i}
              className={`rs-star${interactive ? ' rs-int' : ''}`}
              onMouseEnter={interactive ? () => setHover(i) : undefined}
              onMouseLeave={interactive ? () => setHover(0) : undefined}
              onClick={interactive ? () => onChange(i) : undefined}
              role={interactive ? 'radio' : undefined}
              aria-checked={interactive ? value === i : undefined}
            >
              <Star className="rs-bg" size={size} />
              <span className="rs-fg" style={{ width: `${fill * 100}%` }}>
                <Star size={size} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue && value > 0 && <span className="rs-val">{Number(value).toFixed(1)}</span>}
      {count != null && <span className="rs-count">({count})</span>}
      <style>{CSS}</style>
    </span>
  );
}

const CSS = `
.luca .rs-wrap{display:inline-flex;align-items:center;gap:7px;vertical-align:middle}
.luca .rs-stars{display:inline-flex;gap:2px}
.luca .rs-star{position:relative;display:inline-block;width:var(--rs-size);height:var(--rs-size);line-height:0}
.luca .rs-star .rs-bg{color:var(--line-2);fill:var(--line-2)}
.luca .rs-fg{position:absolute;inset:0;overflow:hidden;display:inline-block;white-space:nowrap}
.luca .rs-fg svg{color:var(--gold);fill:var(--gold)}
.luca .rs-int{cursor:pointer;transition:transform .12s ease}
.luca .rs-int:hover{transform:scale(1.18)}
.luca .rs-val{font-weight:700;font-size:13px;color:var(--ink);font-family:'Space Grotesk',sans-serif}
.luca .rs-count{font-size:12px;color:var(--muted)}
`;
