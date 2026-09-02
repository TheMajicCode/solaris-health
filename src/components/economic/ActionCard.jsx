/**
 * ActionCard — the shared, agentic-ready contextual action card (§11).
 *
 * A single, reusable surface for a "next best action" derived ONLY from verified
 * app state. It renders a title, a brief reason/evidence line, exactly one
 * primary action and up to two secondary actions, an optional status/consent
 * chip, and an optional source timestamp. It performs no AI calls and invents
 * nothing — callers pass fully-resolved, real content or render nothing at all.
 *
 * Design rule (§11): at most one prominent next-best-action per surface. This
 * component does not enforce that on its own; callers decide whether to render.
 */
import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';

export default function ActionCard({
  icon: Icon = Sparkles,
  title,
  reason,
  primary,               // { label, onClick, icon? } — required for a useful card
  secondary = [],        // up to two { label, onClick, icon? }
  status,                // optional short string (e.g. "Consent required")
  sourceLabel,           // optional provenance, e.g. "From your Growth plan"
  timestamp,             // optional ISO string / Date — rendered as a local date
}) {
  if (!title || !primary) return null;
  const secs = (secondary || []).slice(0, 2);
  let ts = '';
  if (timestamp) {
    try { ts = new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { ts = ''; }
  }
  return (
    <div className="act-card" role="group" aria-label={title}>
      <div className="act-card-h">
        <Icon size={16} strokeWidth={2.2} />
        <span className="act-card-title">{title}</span>
      </div>
      {reason && <p className="act-card-reason">{reason}</p>}
      <div className="act-card-actions">
        <button type="button" className="act-btn primary" onClick={primary.onClick}>
          {primary.icon ? <primary.icon size={15} /> : null}
          {primary.label}
          <ChevronRight size={15} />
        </button>
        {secs.map((s, i) => (
          <button type="button" key={i} className="act-btn secondary" onClick={s.onClick}>
            {s.icon ? <s.icon size={15} /> : null}
            {s.label}
          </button>
        ))}
      </div>
      {(status || sourceLabel || ts) && (
        <div className="act-card-meta">
          {status ? <span>{status}</span> : null}
          {status && (sourceLabel || ts) ? <span aria-hidden="true">·</span> : null}
          {sourceLabel ? <span>{sourceLabel}</span> : null}
          {sourceLabel && ts ? <span aria-hidden="true">·</span> : null}
          {ts ? <span>{ts}</span> : null}
        </div>
      )}
    </div>
  );
}
