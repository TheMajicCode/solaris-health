import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/*
 * TopbarPopover — NODE K1.4 Defect 4.
 *
 * ONE reusable topbar popover primitive shared by BOTH the account menu and the
 * language menu. Guarantees the menus float cleanly above every Explore sticky
 * region, filter chip, search row, map/list control, provider card, in-page
 * modal portal, and the bottom navigation — the layering that regressed on
 * physical phones.
 *
 * Behaviour (contract §8):
 *   - Renders through a React portal to document.body (escapes any stacking
 *     context created by transformed/overflow-clipped ancestors on Explore).
 *   - position:fixed panel + full-screen backdrop, z-index above everything.
 *   - Safe-area-aware top and side offsets.
 *   - Opening one menu closes the other (single-open invariant via a window
 *     event; no shared React state needed between the two triggers).
 *   - Dismisses on outside press, Escape, browser/app Back (popstate), and an
 *     explicit close action.
 *   - Locks background scroll and traps + restores focus while open.
 */

// Focusable selector for the focus trap.
const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Single window-level event so only ONE topbar popover is open at a time,
// without the two independent trigger components sharing React state.
export const TOPBAR_POPOVER_OPEN_EVENT = 'solaris:topbar-popover-open';

// Above the mini-player (9990) and every Explore chrome layer (≤4200), and the
// bottom nav — while staying well under full-screen takeover modals.
export const TOPBAR_POPOVER_Z = 200000;

// Reference-counted body scroll lock so two popovers overlapping in time never
// leave the page permanently unscrollable.
let scrollLockCount = 0;
function lockScroll() {
  if (typeof document === 'undefined' || !document.body) return;
  scrollLockCount += 1;
  if (scrollLockCount === 1) {
    document.body.dataset.topbarPrevOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  }
}
function unlockScroll() {
  if (typeof document === 'undefined' || !document.body) return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = document.body.dataset.topbarPrevOverflow || '';
    delete document.body.dataset.topbarPrevOverflow;
  }
}

export default function TopbarPopover({
  id,
  open,
  onClose,
  ariaLabel,
  testId,
  triggerRef,
  panelStyle,
  children,
}) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const close = () => onCloseRef.current && onCloseRef.current();

    // Single-open invariant: announce that we are opening; any other topbar
    // popover already open hears this and closes itself.
    try {
      window.dispatchEvent(new CustomEvent(TOPBAR_POPOVER_OPEN_EVENT, { detail: { id } }));
    } catch (_) { /* older engines */ }
    const onPeerOpen = (e) => { if (e && e.detail && e.detail.id !== id) close(); };
    window.addEventListener(TOPBAR_POPOVER_OPEN_EVENT, onPeerOpen);

    // Focus management — move focus into the panel, restore on close.
    const prevFocus = typeof document !== 'undefined' ? document.activeElement : null;
    const panel = panelRef.current;
    const initial = panel ? panel.querySelectorAll(FOCUSABLE) : [];
    if (initial.length) initial[0].focus();
    else if (panel) panel.focus();

    lockScroll();

    // Dismiss on browser/app Back. The app owns its own popstate-based routing,
    // so we only listen (never push a competing entry that could unwind a real
    // navigation triggered from a menu item).
    const onPop = () => close();
    window.addEventListener('popstate', onPop);

    const onDocPointer = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      if (triggerRef && triggerRef.current && triggerRef.current.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('touchstart', onDocPointer);
    window.addEventListener('keydown', onKey, true);

    return () => {
      window.removeEventListener(TOPBAR_POPOVER_OPEN_EVENT, onPeerOpen);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('touchstart', onDocPointer);
      window.removeEventListener('keydown', onKey, true);
      unlockScroll();
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
      else if (triggerRef && triggerRef.current) triggerRef.current.focus();
    };
  }, [open, id, triggerRef]);

  if (!open || typeof document === 'undefined' || !document.body) return null;

  // SHARED TOPBAR-POPOVER VISUAL CONTRACT (Preview V3, defects 4 & 5).
  // The panel renders in a body portal, i.e. OUTSIDE the app's `.luca` root, so
  // every Solaris design token (--ink/--surface/--line/--gold/--muted/…, defined
  // only under `.luca`) and every component style scoped as `.luca .*` (e.g.
  // NotificationCenter's injected `.luca .nc-*` rules, the language/profile menu
  // colours) previously failed to resolve here — the panels came out faded, with
  // default browser control borders. Re-establishing the `.luca` scope AT THE
  // PORTAL ROOT makes the full token set + all scoped styles apply again, so all
  // three consumers (Notifications, Language, Profile) inherit one opaque,
  // on-brand, WCAG-AA surface without each re-declaring colours.
  return createPortal(
    <div
      className="luca topbar-pop-scrim"
      onClick={() => onCloseRef.current && onCloseRef.current()}
      style={{ position: 'fixed', inset: 0, zIndex: TOPBAR_POPOVER_Z, background: 'rgba(10,43,41,.28)' }}
    >
      <div
        ref={panelRef}
        role="menu"
        aria-label={ariaLabel}
        data-testid={testId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="topbar-pop"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
          right: 'max(16px, env(safe-area-inset-right, 0px))',
          width: 'min(320px, calc(100vw - 32px))',
          maxHeight: 'min(72dvh, calc(100dvh - 96px - env(safe-area-inset-bottom, 0px)))',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          background: '#fff',
          border: '1px solid var(--line,#e3ece8)',
          borderRadius: 16,
          boxShadow: '0 18px 44px rgba(10,43,41,.22)',
          padding: 8,
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
          zIndex: TOPBAR_POPOVER_Z + 1,
          ...panelStyle,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
