/**
 * AdaptiveOverlay — ONE reusable overlay primitive for the whole app.
 *
 *   • Desktop (>= 640px): a centred modal dialog.
 *   • Mobile / tablet portrait (< 640px): a full / near-full-height bottom sheet
 *     that slides up from the bottom edge.
 *
 * Shared behaviour on every breakpoint:
 *   • Renders through a portal into <body> (so `position:fixed` is pinned to the
 *     viewport, not to a transformed route wrapper).
 *   • Visible close button, closes on the scrim, and on Escape.
 *   • Focus is trapped inside the panel while open; focus is restored on close.
 *   • Body content scrolls internally; an optional sticky footer never scrolls.
 *   • Safe-area padding at the bottom (`env(safe-area-inset-bottom)`).
 *   • While open it asks the shell to hide the mobile bottom nav via the shared
 *     `solaris:botnav` event, so a blocking overlay is never obstructed.
 *
 * This primitive is presentation only — it carries no business logic. Callers
 * own their content, footer actions, and any data handling.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

// Ref-counted background scroll lock so nested overlays (e.g. booking over a
// detail sheet) don't fight over document.body.style.overflow.
let _lockCount = 0;
let _prevOverflow = '';
function lockBodyScroll() {
  if (_lockCount === 0) { _prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
  _lockCount += 1;
}
function unlockBodyScroll() {
  _lockCount = Math.max(0, _lockCount - 1);
  if (_lockCount === 0) document.body.style.overflow = _prevOverflow || '';
}

export default function AdaptiveOverlay({
  open = true,
  onClose,
  title,
  ariaLabel,
  footer,
  children,
  size = 'md',        // sm | md | lg — desktop max-width only
  className = '',
  closeLabel = 'Close',
  dismissable = true, // allow scrim / Escape to close
}) {
  const panelRef = useRef(null);
  const lastFocus = useRef(null);

  // Hide the mobile bottom nav for as long as this blocking overlay is mounted.
  useEffect(() => {
    if (!open) return undefined;
    window.dispatchEvent(new CustomEvent('solaris:botnav', { detail: { hidden: true } }));
    lockBodyScroll();
    return () => {
      window.dispatchEvent(new CustomEvent('solaris:botnav', { detail: { hidden: false } }));
      unlockBodyScroll();
    };
  }, [open]);

  // Escape to close + focus trap + focus restore.
  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const panel = panelRef.current;
    // Move focus into the panel on open.
    const focusables = panel ? panel.querySelectorAll(FOCUSABLE) : [];
    if (focusables.length) focusables[0].focus();
    else if (panel) panel.focus();

    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable) { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const el = lastFocus.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return createPortal(
    <div className="luca">
      <div className={`aov-scrim ${className}`} onClick={dismissable ? onClose : undefined}>
        <div
          ref={panelRef}
          className={`aov aov-${size}`}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || (typeof title === 'string' ? title : undefined)}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="aov-grab" aria-hidden="true" />
          <div className="aov-head">
            {title ? <div className="aov-title">{title}</div> : <span />}
            <button type="button" className="aov-x" onClick={onClose} aria-label={closeLabel}><X size={18} /></button>
          </div>
          <div className="aov-body">{children}</div>
          {footer ? <div className="aov-foot">{footer}</div> : null}
        </div>
      </div>
      <style>{CSS}</style>
    </div>,
    document.body
  );
}

const CSS = `
.luca .aov-scrim{position:fixed;inset:0;z-index:1000;background:rgba(6,30,28,.55);backdrop-filter:blur(4px);
  display:flex;align-items:flex-end;justify-content:center;animation:aovFade .15s ease}
@keyframes aovFade{from{opacity:0}to{opacity:1}}
.luca .aov{position:relative;display:flex;flex-direction:column;width:100%;background:var(--canvas);
  box-shadow:0 -18px 50px rgba(8,40,38,.32);border-radius:22px 22px 0 0;
  max-height:100dvh;height:auto;animation:aovUp .3s cubic-bezier(.2,.8,.2,1);overflow:hidden;
  padding-top:env(safe-area-inset-top,0px)}
@keyframes aovUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.luca .aov-grab{width:40px;height:4px;border-radius:999px;background:var(--line-2);margin:8px auto 2px;flex:none}
.luca .aov-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 16px 10px;flex:none}
.luca .aov-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;color:var(--ink);min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.luca .aov-x{flex:none;border:none;background:var(--surface-2);border-radius:9px;width:34px;height:34px;
  display:grid;place-items:center;cursor:pointer;color:var(--ink)}
.luca .aov-x:hover{background:var(--line-2)}
.luca .aov-body{flex:1 1 auto;overflow:auto;-webkit-overflow-scrolling:touch;padding:0 16px 14px}
.luca .aov-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:var(--canvas)}
/* Desktop / large tablet landscape: a centred dialog instead of a bottom sheet. */
@media(min-width:640px){
  .luca .aov-scrim{align-items:center;padding:20px}
  .luca .aov{width:auto;max-height:92vh;border-radius:20px;animation:aovFade .15s ease}
  .luca .aov-grab{display:none}
  .luca .aov-sm{max-width:440px}
  .luca .aov-md{max-width:620px}
  .luca .aov-lg{max-width:840px}
  .luca .aov-foot{padding:14px 20px}
  .luca .aov-head{padding:16px 20px 8px}
  .luca .aov-body{padding:0 20px 16px}
}
@media(prefers-reduced-motion:reduce){.luca .aov,.luca .aov-scrim{animation:none!important}}
`;
