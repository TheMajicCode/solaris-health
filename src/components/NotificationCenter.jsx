/**
 * NotificationCenter — self-contained notification widget for the topbar.
 *
 * Renders the bell button + unread badge, and a dropdown panel listing the
 * user's notifications with filters (All | Unread | Provider | System),
 * mark-as-read, and mark-all-read. Polls the unread count every 30s and
 * raises a toast when a brand-new notification arrives.
 *
 * Props:
 *   onNavigate(notification)  optional — called when a notification with a
 *                             target (e.g. application_approved) is clicked.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell, Check, CheckCheck, X, PartyPopper, AlertTriangle, CalendarDays,
  MessageSquare, Star, Info, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'provider', label: 'Provider' },
  { id: 'system', label: 'System' },
];

const TYPE_ICON = {
  application_approved: PartyPopper,
  application_rejected: AlertTriangle,
  booking: CalendarDays,
  message: MessageSquare,
  review: Star,
  system: Info,
};

function typeTone(type) {
  if (type === 'application_approved') return 'ok';
  if (type === 'application_rejected') return 'no';
  if (type === 'booking' || type === 'review') return 'gold';
  return 'teal';
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function NotificationCenter({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const seenRef = useRef(null); // Set of known notification ids (null until first load)

  /* Load notification list for the current filter. */
  const load = useCallback(async (f = filter) => {
    setLoading(true);
    try {
      const r = await api.getNotifications(f);
      setItems(r.notifications || []);
      setUnread(r.unread || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  /* Poll unread count; toast newly-arrived notifications. */
  const poll = useCallback(async () => {
    try {
      const r = await api.getNotifications('all');
      const list = r.notifications || [];
      setUnread(r.unread || 0);

      const ids = new Set(list.map((n) => n.id));
      if (seenRef.current === null) {
        // First run — seed without toasting.
        seenRef.current = ids;
      } else {
        const fresh = list.filter((n) => !seenRef.current.has(n.id) && !n.read);
        fresh.slice(0, 3).forEach((n) => {
          const opts = { id: `notif-${n.id}` };
          if (n.type === 'application_approved') toast.success(n.title || 'Notification', opts);
          else if (n.type === 'application_rejected') toast.error(n.title || 'Notification', opts);
          else toast(n.title || 'Notification', { ...opts, icon: '🔔' });
        });
        seenRef.current = ids;
      }
      // Keep the open panel fresh.
      if (open) setItems(filter === 'all' ? list : (await api.getNotifications(filter)).notifications || []);
    } catch {
      /* ignore poll errors */
    }
  }, [open, filter]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload list when filter changes (while open).
  useEffect(() => { if (open) load(filter); }, [filter, open, load]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load(filter);
  };

  const markRead = async (n) => {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try { await api.markNotificationRead(n.id); } catch { /* ignore */ }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try { await api.markAllNotificationsRead(); } catch { /* ignore */ }
  };

  const onItemClick = (n) => {
    markRead(n);
    if (onNavigate) onNavigate(n);
    setOpen(false);
  };

  return (
    <div className="nc" ref={wrapRef}>
      <button className="nc-bell icon-btn" onClick={toggle} aria-label="Notifications">
        <Bell size={17} />
        {unread > 0 && <span className="nc-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="nc-panel">
          <div className="nc-head">
            <div className="nc-title">Notifications</div>
            {unread > 0 && (
              <button className="nc-markall" onClick={markAll}><CheckCheck size={13} /> Mark all read</button>
            )}
          </div>

          <div className="nc-filters">
            {FILTERS.map((f) => (
              <button key={f.id} className={`nc-filter ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="nc-list">
            {loading && <div className="nc-empty"><Loader2 size={18} className="nc-spin" /> Loading…</div>}
            {!loading && items.length === 0 && (
              <div className="nc-empty"><Bell size={22} /><span>No notifications{filter !== 'all' ? ' here' : ' yet'}.</span></div>
            )}
            {!loading && items.map((n) => {
              const Icon = TYPE_ICON[n.type] || Info;
              return (
                <button key={n.id} className={`nc-item ${n.read ? '' : 'unread'}`} onClick={() => onItemClick(n)}>
                  <span className={`nc-ico ${typeTone(n.type)}`}><Icon size={15} /></span>
                  <span className="nc-body">
                    <span className="nc-item-title">{n.title}</span>
                    {n.message && <span className="nc-item-msg">{n.message}</span>}
                    <span className="nc-item-time">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read && (
                    <span
                      className="nc-dot-btn"
                      role="button"
                      tabIndex={0}
                      title="Mark as read"
                      onClick={(e) => { e.stopPropagation(); markRead(n); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); markRead(n); } }}
                    >
                      <Check size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .nc{position:relative;display:flex}
.luca .nc-bell{position:relative}
.luca .nc-badge{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;
  background:var(--gold,#E3AC46);color:#3C2807;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;
  border:2px solid var(--surface,#fff);line-height:1}
.luca .nc-panel{position:absolute;top:calc(100% + 10px);right:0;width:360px;max-width:calc(100vw - 32px);
  background:var(--surface,#fff);border:1px solid var(--line);border-radius:16px;box-shadow:0 22px 50px -18px rgba(3,32,30,.4);
  z-index:80;overflow:hidden;animation:ncIn .14s ease}
@keyframes ncIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.luca .nc-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px}
.luca .nc-title{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;color:var(--ink)}
.luca .nc-markall{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--teal-d);
  background:none;border:none;cursor:pointer}
.luca .nc-markall:hover{text-decoration:underline}
.luca .nc-filters{display:flex;gap:6px;padding:0 14px 10px;border-bottom:1px solid var(--line)}
.luca .nc-filter{font-size:12px;font-weight:600;color:var(--muted);background:var(--surface-2);border:1px solid var(--line);
  border-radius:999px;padding:5px 11px;cursor:pointer}
.luca .nc-filter.on{color:#fff;background:var(--teal-d,#06403B);border-color:var(--teal-d,#06403B)}
.luca .nc-list{max-height:380px;overflow-y:auto;padding:6px}
.luca .nc-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px 16px;color:var(--muted);font-size:13px;text-align:center}
.luca .nc-spin{animation:ncspin 1s linear infinite}@keyframes ncspin{to{transform:rotate(360deg)}}
.luca .nc-item{width:100%;display:flex;gap:10px;align-items:flex-start;text-align:left;padding:11px 10px;border:none;border-radius:11px;
  background:none;cursor:pointer;position:relative}
.luca .nc-item:hover{background:var(--surface-2)}
.luca .nc-item.unread{background:rgba(54,201,169,.07)}
.luca .nc-item.unread:hover{background:rgba(54,201,169,.12)}
.luca .nc-ico{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;margin-top:1px}
.luca .nc-ico.ok{background:var(--mint-soft);color:var(--teal-d)}
.luca .nc-ico.no{background:var(--danger-soft);color:var(--danger-ink)}
.luca .nc-ico.gold{background:var(--gold-soft);color:var(--gold-ink)}
.luca .nc-ico.teal{background:var(--mint-soft);color:var(--teal-d)}
.luca .nc-body{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.luca .nc-item-title{font-size:13px;font-weight:700;color:var(--ink);line-height:1.3}
.luca .nc-item-msg{font-size:12px;color:var(--muted-2);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.luca .nc-item-time{font-size:11px;color:var(--muted);margin-top:2px}
.luca .nc-dot-btn{width:20px;height:20px;border-radius:50%;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex-shrink:0;margin-top:2px}
.luca .nc-dot-btn:hover{background:var(--teal-d);color:#fff}
`;
