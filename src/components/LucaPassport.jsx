/* ============================================================
   LUCA PASSPORT — Unified Sovereign Hub
   One central dashboard for every user, adapting by role.
   Design foundation: Solaris navy / teal / emerald / gold,
   Space Grotesk (display) + IBM Plex Sans (body).
   Scoped under `.luca` so it is fully isolated from the
   global dark theme used by the auth / onboarding flows.
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  RadarChart as ReRadar, PolarGrid, PolarAngleAxis, Radar, CartesianGrid,
} from 'recharts';
import {
  LayoutDashboard, HeartPulse, Bot, Wallet, Calendar, ClipboardList, CalendarDays,
  Users, Activity, UserCog, Settings, Search, Bell, ChevronRight, ShieldCheck,
  Send, Download, Sparkles, Leaf, TrendingUp, Award, Gift, Stethoscope, LogOut,
  Menu, X, Check, CheckCircle2, Clock, FileText, Plus, Building2, Star, Coins,
  Droplet, Moon, Footprints, Brain, Heart, ArrowUpRight, ArrowDownLeft, ArrowRight, Eye,
  BadgeCheck, Zap, MapPin, RefreshCw, MessageSquare, Globe, Compass, Store,
  Briefcase, FileCheck, BarChart3, CalendarCheck, Sprout,
  BookOpen, Headphones, Play, Pause, Lock, Trash2, Music,
  Repeat, Shuffle, Rewind, FastForward, Upload, ListMusic,
  CalendarClock, Volume2, VolumeX, Inbox, Mail, Copy, Fingerprint, Grid,
} from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { STATIC_GPS_POLICY } from '../lib/gps-policy.js';
import HealthTimeline from './HealthTimeline.jsx';
import TrendCharts from './TrendCharts.jsx';
import SecureChat from './SecureChat.jsx';
import WalletConnect from './wallet/WalletConnect.jsx';
import WalletDashboard from './wallet/WalletDashboard.jsx';
import HealthNFT from './wallet/HealthNFT.jsx';
import ExploreMarketplace from './marketplace/ExploreMarketplace.jsx';
import ProviderApplication from './provider/ProviderApplication.jsx';
import MyPractice from './provider/MyPractice.jsx';
import ProviderBookings from './provider/ProviderBookings.jsx';
import ProviderApprovals from './admin/ProviderApprovals.jsx';
import MyBookings from './booking/MyBookings.jsx';
import BookingManagement from './admin/BookingManagement.jsx';
import NotificationCenter from './NotificationCenter.jsx';
import GPSLedger from './gps/GPSLedger.jsx';
import GpsExplainer from './gps/GpsExplainer.jsx';
import PaymentReceipts from './gps/PaymentReceipts.jsx';
import MemberPayments from './gps/MemberPayments.jsx';
import ReferralHub from './gps/ReferralHub.jsx';
import RegenerativeTreasury from './gps/RegenerativeTreasury.jsx';
import GPSStats from './admin/GPSStats.jsx';
import AdminFinance from './admin/AdminFinance.jsx';
import AdminSettings from './admin/AdminSettings.jsx';
import AvailabilityManager from './practitioner/AvailabilityManager.jsx';
import PractitionerFinance from './practitioner/PractitionerFinance.jsx';
import PractitionerSettings from './practitioner/PractitionerSettings.jsx';
import GPSMapView from './gps/GPSMapView.jsx';
import PaymentModal from './gps/PaymentModal.jsx';
import IdentityCard from './passport/IdentityCard.jsx';
import WalletCard from './passport/WalletCard.jsx';
import LevelBadge from './passport/LevelBadge.jsx';
import ContributionLedger from './contributions/ContributionLedger.jsx';
import SparkWalletScreen from './wallet/SparkWalletScreen.jsx';
import AuraAdmin from './clinic/AuraAdmin.jsx';
import toast from 'react-hot-toast';

/* ============================== DESIGN SYSTEM ============================== */
const CSS = `
/* Offline-coherent local/system font stack (no network @import). The installed
   PWA renders identically online and offline. */
.luca{
  --font-display:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  --font-body:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  --font-mono:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace;
  --ink:#0A2B29; --teal:#0E5C57; --teal-d:#06403B; --teal-d2:#0A524C;
  --mint:#2FBE9F; --mint-soft:#DAF3EC; --mint-line:#BFE8DD; --mint-ink:#0B6A57;
  --gold:#D69B33; --gold-2:#E3AC46; --gold-soft:#F7E8C8; --gold-ink:#7E5715;
  --terra:#B5713C; --terra-soft:#EFDCC8; --terra-ink:#7A4A21;
  --canvas:#EEF4F1; --surface:#FFFFFF; --surface-2:#F6FAF8;
  --line:#E1ECE8; --line-2:#EBF3F0;
  --muted:#5C716E; --muted-2:#8AA09C;
  --danger:#D7604C; --danger-soft:#FBE6E1; --danger-ink:#8F3525;
  --shadow:0 1px 2px rgba(10,43,41,.05),0 14px 32px -20px rgba(10,43,41,.20);
  --shadow-sm:0 1px 2px rgba(10,43,41,.05),0 7px 18px -14px rgba(10,43,41,.18);
  --r:16px; --r-sm:12px; --r-lg:22px;
  color:var(--ink); line-height:1.5; -webkit-font-smoothing:antialiased;
  font-family:var(--font-body);
}
.luca *{box-sizing:border-box}
.luca .mono{font-family:var(--font-mono)}
.luca .dp{font-family:var(--font-display)}

.luca-app{display:grid;grid-template-columns:252px 1fr;min-height:100vh;
  background:
   radial-gradient(1100px 560px at -8% -12%, rgba(47,190,159,.12), transparent 58%),
   radial-gradient(820px 460px at 112% -6%, rgba(214,155,51,.08), transparent 54%),
   var(--canvas);}

/* sidebar */
.sidebar{background:linear-gradient(180deg,var(--teal-d),var(--teal-d2));color:#D9EEE8;
  padding:16px 12px 22px;display:flex;flex-direction:column;gap:2px;position:sticky;top:0;
  height:100vh;overflow:auto;border-right:1px solid rgba(255,255,255,.06)}
.brand{display:flex;align-items:center;gap:11px;padding:8px 10px 14px}
.brand-mark{width:36px;height:36px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 50% 35%,#13716A,#06403B);box-shadow:0 0 18px rgba(47,190,159,.45);border:1px solid rgba(47,190,159,.4)}
.brand-name{font-family:var(--font-display);font-weight:700;font-size:18px;color:#fff;letter-spacing:.12em;line-height:1}
.brand-sub{font-size:10px;color:rgba(217,238,232,.62);letter-spacing:.16em;text-transform:uppercase;margin-top:3px}
.nav-label{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(217,238,232,.46);
  padding:15px 12px 6px;font-weight:600;display:flex;align-items:center;gap:7px}
.nav-label .dot{width:5px;height:5px;border-radius:50%}
.nav-item{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:11px;
  color:rgba(220,239,234,.80);font-size:13.5px;font-weight:500;cursor:pointer;border:1px solid transparent;
  transition:.15s;position:relative;width:100%;text-align:left;background:transparent;font-family:inherit}
.nav-item:hover{background:rgba(255,255,255,.07);color:#fff}
.nav-item.active{background:rgba(255,255,255,.11);color:#fff;border-color:rgba(255,255,255,.10)}
.nav-item.active::before{content:"";position:absolute;left:-12px;top:9px;bottom:9px;width:3px;
  border-radius:3px;background:var(--mint)}
.nav-item .badge{margin-left:auto;background:var(--gold);color:#3C2807;font-size:10.5px;font-weight:700;
  border-radius:999px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 5px}
.nav-item .soon-badge{margin-left:auto;background:rgba(255,159,10,.18);color:#FFB454;border:1px solid rgba(255,159,10,.42);
  font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:2px 7px;line-height:1.4}
.become-provider{margin-top:auto;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px;
  width:100%;padding:11px 14px;border-radius:12px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;
  color:#0A2B29;background:linear-gradient(135deg,#E3AC46,#D69B33);border:1px solid rgba(255,255,255,.18);
  box-shadow:0 8px 20px -10px rgba(214,155,51,.7);transition:transform .15s ease,box-shadow .15s ease}
.become-provider:hover{transform:translateY(-1px);box-shadow:0 12px 26px -10px rgba(214,155,51,.85)}
.become-provider.pending{background:rgba(227,172,70,.16);color:rgba(243,222,178,.92);border:1px solid rgba(227,172,70,.32);
  box-shadow:none;cursor:default}
.become-provider.pending:hover{transform:none;box-shadow:none}

/* topbar */
.topbar{display:flex;align-items:center;gap:12px;padding:13px 24px;position:sticky;top:0;z-index:30;
  background:rgba(238,244,241,.82);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.search{flex:1;max-width:560px;display:flex;align-items:center;gap:10px;background:var(--surface);
  border:1px solid var(--line);border-radius:12px;padding:9px 13px;color:var(--muted-2);font-size:13px;min-width:0}
.search input{border:none;outline:none;background:transparent;flex:1;color:var(--ink);font-size:13.5px;min-width:0;font-family:inherit}
.icon-btn{width:39px;height:39px;border-radius:11px;border:1px solid var(--line);background:var(--surface);
  display:flex;align-items:center;justify-content:center;color:var(--muted);cursor:pointer;flex:none;position:relative}
.icon-btn:hover{background:var(--surface-2);color:var(--ink)}
.icon-btn .ping{position:absolute;top:8px;right:9px;width:7px;height:7px;border-radius:50%;background:var(--gold);border:1.5px solid var(--surface)}
.menu-btn{display:none}

.main{min-width:0}
.page{padding:24px 26px 64px;max-width:1260px;margin:0 auto;animation:lucafade .4s ease both}
@keyframes lucafade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.page-title{font-family:var(--font-display);font-weight:600;font-size:25px;letter-spacing:-.015em;color:var(--ink);line-height:1.1}
.page-sub{color:var(--muted);font-size:13.5px;margin-top:5px;max-width:560px}

/* cards & primitives */
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px;box-shadow:var(--shadow-sm)}
.card.lg{padding:22px;border-radius:var(--r-lg)}
.card.flat{box-shadow:none}
.card.tint{background:linear-gradient(180deg,#FBFEFC,#F4FAF7)}
/* card-low is defined dark in the global (index.css) theme used by Auth/Assessment.
   Inside the light Passport (.luca) scope it must be a light surface, otherwise the
   dark ink titles/body inside these cards render invisibly on a dark background. */
.luca .card-low{background:var(--surface-2);border:1px solid var(--line);color:var(--ink)}
.luca .card-low .small,.luca .card-low .f6,.luca .card-low .card-title{color:var(--ink)}
.luca .card-low .tiny,.luca .card-low .muted{color:var(--muted)}
.luca .inbox-msg.unread{border-color:var(--mint);box-shadow:0 0 0 1px var(--mint) inset}
.luca .inbox-dot{flex:none;width:9px;height:9px;border-radius:999px;background:var(--gold)}
.eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);font-weight:600}
.card-title{font-size:15px;font-weight:600;color:var(--ink)}
.stat{font-family:var(--font-display);font-weight:600;font-size:27px;letter-spacing:-.02em;color:var(--ink);line-height:1}
.stat .unit{font-size:13px;color:var(--muted-2);font-weight:500;margin-left:5px}
.divider{height:1px;background:var(--line);margin:14px 0}
.grid{display:grid;gap:18px}
/* Phone (<=767px): every major card grid collapses to a single full-width
   column. Uses !important to beat inline gridTemplateColumns styles (fixed
   1fr 1fr / 1fr 1fr 1fr / minmax()+fixed-px layouts) so no skinny side-by-side
   columns survive on phones. Auto-fit grids already collapse; this is a no-op
   for them. */
@media(max-width:767px){
  .luca .grid,.luca .grid-2-1{grid-template-columns:1fr!important}
}
.row{display:flex;align-items:center}
.col{display:flex;flex-direction:column}
.between{display:flex;align-items:center;justify-content:space-between}
.wrap{flex-wrap:wrap}
.top{align-items:flex-start}

.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;border:1px solid transparent;white-space:nowrap}
.pill.mint{background:var(--mint-soft);color:var(--mint-ink);border-color:var(--mint-line)}
.pill.gold{background:var(--gold-soft);color:var(--gold-ink);border-color:#EBD3A0}
.pill.terra{background:var(--terra-soft);color:var(--terra-ink);border-color:#E3C5A4}
.pill.teal{background:#E1EFEC;color:#0B4B47;border-color:#CCE4DE}
.pill.gray{background:#EEF3F1;color:var(--muted);border-color:var(--line)}
.pill.danger{background:var(--danger-soft);color:var(--danger-ink);border-color:#F0C9BF}
.pill-cta{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px;
  border:1px solid #EBD3A0;background:linear-gradient(90deg,#fdf3dc,#faf1e0);color:var(--gold-ink,#8a6a1e);cursor:pointer;font-family:inherit;white-space:nowrap}
.pill-cta:hover{filter:brightness(.97)}

.chip{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none}
.chip svg{flex:none}
.chip.sm{width:34px;height:34px;border-radius:10px}
.chip.mint{background:var(--mint-soft);color:var(--mint-ink)}
.chip.gold{background:var(--gold-soft);color:var(--gold-ink)}
.chip.teal{background:#E1EFEC;color:#0B4B47}
.chip.terra{background:var(--terra-soft);color:var(--terra-ink)}
.chip.gray{background:#EEF3F1;color:var(--muted)}
.chip.danger{background:var(--danger-soft);color:var(--danger-ink)}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:13px;
  padding:9px 14px;border-radius:11px;border:1px solid var(--line);background:var(--surface);color:var(--ink);
  cursor:pointer;transition:.15s;font-family:inherit}
.btn:hover{background:var(--surface-2)}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn.primary{background:linear-gradient(180deg,var(--teal),#0B4E49);color:#EAFBF6;border-color:#0B4E49}
.btn.primary:hover{filter:brightness(1.07)}
.btn.gold{background:linear-gradient(180deg,var(--gold-2),var(--gold));color:#3C2807;border-color:#C98F2C}
.btn.gold:hover{filter:brightness(1.04)}
.btn.ghost{background:transparent;border-color:transparent;color:var(--teal);padding-left:8px;padding-right:8px}
.btn.ghost:hover{background:#E7F2EF}
.btn.sm{padding:6px 11px;font-size:12.5px;border-radius:9px}
.btn.block{width:100%}
.btn.danger{color:var(--danger-ink);border-color:#F0C9BF;background:var(--danger-soft)}

.avatar{border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;
  font-family:var(--font-display);flex:none;font-size:15px;letter-spacing:.02em}

.track{height:8px;border-radius:999px;background:var(--line-2);overflow:hidden;width:100%}
.bar{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--mint),var(--teal));transition:width 1s var(--ease,ease)}
.bar.gold{background:linear-gradient(90deg,var(--gold-2),var(--gold))}

.toggle{width:42px;height:24px;border-radius:999px;background:var(--line);position:relative;cursor:pointer;transition:.18s;border:1px solid #D5E3DE;flex:none}
.toggle.on{background:linear-gradient(90deg,var(--mint),var(--teal));border-color:transparent}
.knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.18s;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.toggle.on .knob{left:20px}

.list-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line-2)}
.list-row:last-child{border-bottom:none}

.seg{display:inline-flex;background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:3px;gap:2px;flex-wrap:wrap}
.seg button{border:none;background:transparent;padding:6px 11px;border-radius:8px;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit}
.seg button.on{background:var(--surface);color:var(--ink);box-shadow:var(--shadow-sm)}

.kv{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid var(--line-2);font-size:13.5px}
.kv:last-child{border-bottom:none}
.kv .k{color:var(--muted)} .kv .v{color:var(--ink);font-weight:500;text-align:right}

.lay-dash{display:grid;grid-template-columns:1fr 326px;gap:18px;align-items:start}
.muted{color:var(--muted)} .muted2{color:var(--muted-2)}
.small{font-size:12.5px}.tiny{font-size:11.5px}.f6{font-weight:600}.f7{font-weight:700}.f5{font-weight:500}
.t-mint{color:var(--mint-ink)}.t-gold{color:var(--gold-ink)}.t-teal{color:var(--teal)}.t-danger{color:var(--danger-ink)}
.gap-2{gap:8px}.gap-3{gap:12px}.gap-4{gap:16px}

/* coach chat */
.chat-wrap{display:flex;flex-direction:column;height:calc(100vh - 180px);min-height:420px}
.chat-scroll{flex:1;overflow-y:auto;padding:6px 2px 14px;display:flex;flex-direction:column;gap:14px}
.bubble{max-width:78%;padding:11px 15px;border-radius:16px;font-size:13.5px;line-height:1.55;white-space:pre-wrap}
.bubble.user{align-self:flex-end;background:linear-gradient(180deg,var(--teal),#0B4E49);color:#EAFBF6;border-bottom-right-radius:5px}
.bubble.ai{align-self:flex-start;background:var(--surface);border:1px solid var(--line);color:var(--ink);border-bottom-left-radius:5px;box-shadow:var(--shadow-sm)}
.chat-input{display:flex;gap:10px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:8px 8px 8px 16px;box-shadow:var(--shadow-sm)}
.chat-input input{flex:1;border:none;outline:none;background:transparent;font-size:13.5px;color:var(--ink);font-family:inherit}

/* skeleton shimmer */
.skel{position:relative;overflow:hidden;background:#E7F0EC;border-radius:10px}
.skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:shimmer 1.4s infinite}
@keyframes shimmer{100%{transform:translateX(100%)}}

.empty{text-align:center;padding:34px 18px;color:var(--muted)}
.dot-typing{display:inline-flex;gap:4px}
.dot-typing i{width:6px;height:6px;border-radius:50%;background:var(--muted-2);animation:blink 1.2s infinite both}
.dot-typing i:nth-child(2){animation-delay:.2s}.dot-typing i:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}

.luca :focus-visible{outline:2px solid var(--mint);outline-offset:2px}
.luca ::-webkit-scrollbar{width:10px;height:10px}
.luca ::-webkit-scrollbar-thumb{background:rgba(10,43,41,.16);border-radius:8px;border:2px solid transparent;background-clip:content-box}
.sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18)}

@media(prefers-reduced-motion:reduce){.luca *{transition:none!important;animation:none!important}}
@media(max-width:1080px){.lay-dash{grid-template-columns:1fr}}
@media(max-width:900px){
  .luca-app{grid-template-columns:1fr}
  .sidebar{position:fixed;z-index:70;width:252px;left:0;top:0;transform:translateX(-100%);transition:transform .25s}
  .sidebar.open{transform:none;box-shadow:0 24px 70px rgba(0,0,0,.34)}
  .scrim{position:fixed;inset:0;background:rgba(6,32,30,.46);z-index:65}
  .menu-btn{display:flex}
  .page{padding:18px 16px 56px}
}
@media(min-width:901px){.scrim{display:none}}

/* ---- layout helpers & page-specific blocks ---- */
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:860px){.grid-2{grid-template-columns:1fr}}
.h1{font-family:var(--font-display);font-weight:700;font-size:30px;letter-spacing:-.02em;color:var(--ink)}
.h2{font-family:var(--font-display);font-weight:700;font-size:23px;letter-spacing:-.02em;color:var(--ink)}
.ar{text-align:right}
.ellipsis{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:560px){.stat-row{grid-template-columns:1fr}}
.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:760px){.metric-grid{grid-template-columns:1fr 1fr}}
@media(max-width:460px){.metric-grid{grid-template-columns:1fr}}
.love-hero{display:flex;align-items:center;gap:14px;padding:16px;border-radius:14px;
  background:linear-gradient(135deg,#F6EBD3,#FBF6EA);border:1px solid #EBD3A0;color:var(--gold-ink)}
.draft-row{display:flex;align-items:flex-start;gap:12px;padding:14px 0;border-bottom:1px solid var(--line-2);flex-wrap:wrap}
.draft-row:last-child{border-bottom:none}
.search-inline{display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--line);
  border-radius:11px;padding:7px 12px;color:var(--muted-2);min-width:200px}
.search-inline input{border:none;outline:none;background:transparent;flex:1;color:var(--ink);font-size:13px;font-family:inherit;min-width:0}
.table-wrap{overflow-x:auto;margin-top:6px}
.luca-table{width:100%;border-collapse:collapse;font-size:13px}
.luca-table th{text-align:left;font-weight:600;color:var(--muted-2);font-size:11.5px;text-transform:uppercase;
  letter-spacing:.04em;padding:10px 12px;border-bottom:1px solid var(--line)}
.luca-table th.ar{text-align:right}
.luca-table td{padding:11px 12px;border-bottom:1px solid var(--line-2);color:var(--ink);vertical-align:middle}
.luca-table tbody tr:hover{background:var(--surface-2)}
.luca-table td.ar{text-align:right}
.setting-row{display:flex;align-items:center;gap:13px;padding:13px 0;border-bottom:1px solid var(--line-2)}
.setting-row:last-child{border-bottom:none}
.status-line{display:flex;align-items:center;gap:10px}
.status-line .small{flex:1}
.status-line .dot,.dot.ok,.dot.warn{width:9px;height:9px;border-radius:50%;flex:none}
.dot.ok{background:var(--mint-ink);box-shadow:0 0 0 3px var(--mint-soft)}
.dot.warn{background:var(--gold-ink);box-shadow:0 0 0 3px var(--gold-soft)}
.patient-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:6px}
.patient-card{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--line);
  border-radius:13px;background:var(--surface-2)}
.input-line{width:100%;border:1px solid var(--line);border-radius:11px;padding:9px 12px;font-size:13.5px;
  color:var(--ink);background:var(--surface);outline:none;font-family:inherit}
.input-line:focus{border-color:var(--mint);box-shadow:0 0 0 3px var(--mint-soft)}
textarea.input-line{resize:vertical;min-height:64px}

/* ---- premium LUCA coach ---- */
.luca .coach-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start}
.luca .coach-shell{display:flex;flex-direction:column;height:calc(100vh - 150px);min-height:540px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow)}
.luca .coach-head{padding:16px 20px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:14px;background:linear-gradient(180deg,var(--mint-soft) 0%,transparent 100%)}
.luca .luca-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0E5C57,#1A8C7D);display:grid;place-items:center;flex-shrink:0;box-shadow:0 0 0 3px rgba(47,190,159,.22),0 4px 16px rgba(10,43,41,.24)}
.luca .luca-avatar.sm{width:32px;height:32px}
.luca .luca-avatar.lg{width:74px;height:74px;box-shadow:0 0 0 6px rgba(47,190,159,.16),0 0 34px rgba(47,190,159,.30)}
.luca .coach-body{flex:1;overflow-y:auto;padding:20px 18px 12px;display:flex;flex-direction:column;gap:16px;scroll-behavior:smooth;background:linear-gradient(180deg,var(--surface-2),var(--surface))}
.luca .msg-row{display:flex;gap:10px;align-items:flex-end;animation:msgIn .28s ease}
.luca .msg-row.user{flex-direction:row-reverse}
.luca .msg-row .avatar{flex:none}
@keyframes msgIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
.luca .msg-bubble{padding:12px 16px;border-radius:18px;font-size:13.5px;line-height:1.6;white-space:pre-wrap;box-shadow:var(--shadow-sm)}
.luca .msg-bubble.user{background:linear-gradient(160deg,var(--mint),#0B4E49);color:#EAFBF6;border-bottom-right-radius:5px}
.luca .msg-bubble.ai{background:var(--surface);border:1px solid var(--line);color:var(--ink);border-bottom-left-radius:5px}
.luca .msg-time{font-size:10px;color:var(--muted-2);text-align:right}
.luca .msg-time.ai-time{text-align:left}
.luca .msg-meta{display:flex;align-items:center;gap:7px;margin-top:4px;justify-content:flex-end}
.luca .msg-meta.ai-meta{justify-content:flex-start}
.luca .msg-speak{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:7px;border:1px solid var(--line);
  background:var(--surface);color:var(--teal-d,#0E5C57);cursor:pointer;padding:0;transition:all .12s;flex:none}
.luca .msg-speak:hover:not(:disabled){background:var(--mint-soft);border-color:var(--mint-line,#B7E4D8)}
.luca .msg-speak:disabled{opacity:.5;cursor:default}
.luca .msg-speak.busy{animation:pulse 1.1s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
.luca .coach-voice{display:inline-flex;align-items:center;gap:6px;flex:none;border:1px solid var(--line);background:var(--surface);
  color:var(--muted);border-radius:999px;padding:6px 12px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .12s}
.luca .coach-voice:hover{background:var(--surface-2)}
.luca .coach-voice.on{background:var(--mint-soft);border-color:var(--mint-line,#B7E4D8);color:var(--teal-d,#0E5C57)}
.luca .coach-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:32px 18px}
.luca .coach-suggestions{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;max-width:400px;margin-top:6px}
.luca .suggest-chip{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:12.5px;color:var(--muted);cursor:pointer;text-align:left;transition:all .15s;font-family:inherit;width:100%}
.luca .suggest-chip:hover{border-color:var(--mint);color:var(--ink);background:var(--mint-soft)}
.luca .suggest-chip:disabled{opacity:.55;cursor:default}
.luca .coach-footer{padding:14px 18px;border-top:1px solid var(--line);background:var(--surface)}
.luca .coach-input-row{display:flex;gap:10px;align-items:center;background:var(--surface-2);border:1px solid var(--line);border-radius:14px;padding:8px 8px 8px 18px;transition:border-color .15s,box-shadow .15s}
.luca .coach-input-row:focus-within{border-color:var(--mint);box-shadow:0 0 0 3px var(--mint-soft)}
.luca .coach-input-row input{flex:1;border:none;outline:none;background:transparent;font-size:13.5px;color:var(--ink);font-family:inherit;min-width:0}
.luca .coach-disclaimer{font-size:11px;color:var(--muted-2);text-align:center;margin-top:9px}
@media(max-width:1080px){.luca .coach-layout{grid-template-columns:1fr}.luca .coach-shell{height:auto;min-height:60vh}}
/* Follow-up suggestion chips */
.luca .luca-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
.luca .luca-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid transparent;border-radius:999px;padding:6px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;line-height:1.2;transition:filter .15s,transform .1s}
.luca .luca-chip:hover{filter:brightness(.97)}
.luca .luca-chip:active{transform:translateY(1px)}
.luca .luca-chip:disabled{opacity:.55;cursor:default}
/* Persistent mini-player bar */
.luca .mini-player{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:9990;display:flex;align-items:center;justify-content:space-between;gap:14px;background:var(--surface,#fff);border:1px solid var(--line,#E6EDEA);box-shadow:0 12px 40px rgba(10,40,40,.18);border-radius:16px;padding:10px 14px;width:min(680px,calc(100% - 48px))}
.luca .mini-progress{position:absolute;top:0;left:0;right:0;height:3px;border-radius:16px 16px 0 0;background:var(--line,#E6EDEA);overflow:hidden}
.luca .mini-progress-fill{height:100%;background:linear-gradient(90deg,#1A8C7D,#2FBE9F);transition:width .25s linear}
.luca .mp-ctrl{width:34px;height:34px;border-radius:10px;border:1px solid var(--line,#E6EDEA);background:var(--surface-2,#F7FAF9);color:var(--ink,#123);display:grid;place-items:center;cursor:pointer;flex:none;transition:background .15s}
.luca .mp-ctrl:hover{background:#EBF3F0}
.luca .mp-ctrl.primary{background:linear-gradient(150deg,#0E5C57,#0A413D);color:#E7F8F3;border-color:transparent}
/* Full player card (Media tab) */
.luca .full-player{background:linear-gradient(170deg,#0E5C57,#0A413D);border:none;color:#F2FBF8;display:flex;flex-direction:column;gap:14px}
.luca .fp-seek{display:flex;align-items:center;gap:10px}
.luca .fp-range{flex:1;-webkit-appearance:none;appearance:none;height:5px;border-radius:999px;background:rgba(255,255,255,.24);outline:none;cursor:pointer}
.luca .fp-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:15px;height:15px;border-radius:50%;background:#DAF3EC;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer}
.luca .fp-range::-moz-range-thumb{width:15px;height:15px;border:none;border-radius:50%;background:#DAF3EC;cursor:pointer}
.luca .fp-controls{display:flex;align-items:center;justify-content:center;gap:8px}
.luca .fp-btn{width:42px;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#E7F8F3;display:grid;place-items:center;cursor:pointer;transition:background .15s}
.luca .fp-btn:hover{background:rgba(255,255,255,.18)}
.luca .fp-btn.on{background:rgba(218,243,236,.9);color:#0A413D;border-color:transparent}
.luca .fp-btn.play{width:54px;height:54px;border-radius:50%;background:#DAF3EC;color:#0A413D;border:none}
.luca .fp-btn.play:hover{background:#fff}
.luca .fp-speed{background:rgba(255,255,255,.12);color:#E7F8F3;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:4px 8px;font-family:inherit;font-size:12px;cursor:pointer}
.luca .fp-speed option{color:#123}
/* Queue rows */
.luca .queue-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 10px;border-radius:10px;border:none;background:transparent;color:var(--ink,#123);cursor:pointer;transition:background .15s}
.luca .queue-row:hover{background:var(--surface-2,#F7FAF9)}
.luca .queue-row.on{background:#EBF3F0}
.luca .queue-ico{width:26px;height:26px;border-radius:8px;background:linear-gradient(150deg,#0E5C57,#0A413D);color:#E7F8F3;display:grid;place-items:center;flex:none}
.luca .queue-title{font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
@media(max-width:520px){.luca .mini-player{left:12px;right:12px;transform:none;width:auto}}
/* Daily check-in modal */
.luca .ci-overlay{position:fixed;inset:0;z-index:10000;background:rgba(8,32,30,.55);backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:center;animation:ciFade .2s ease}
@keyframes ciFade{from{opacity:0}to{opacity:1}}
.luca .ci-modal{width:min(560px,100%);max-height:92vh;overflow-y:auto;background:var(--surface,#fff);border-radius:22px 22px 0 0;box-shadow:0 -18px 60px rgba(8,40,38,.3);animation:ciUp .32s cubic-bezier(.2,.8,.2,1)}
@media(min-width:640px){.luca .ci-overlay{align-items:center}.luca .ci-modal{border-radius:22px}}
@keyframes ciUp{from{transform:translateY(40px);opacity:.4}to{transform:translateY(0);opacity:1}}
.luca .ci-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:18px 20px 14px;background:linear-gradient(160deg,#0E5C57,#0A413D);color:#EAFBF6;border-radius:22px 22px 0 0}
@media(max-width:639px){.luca .ci-head{border-radius:22px 22px 0 0}}
.luca .ci-head h3{margin:0;font-size:16px;font-weight:700;font-family:var(--serif,inherit)}
.luca .ci-head .ci-x{margin-left:auto;background:rgba(255,255,255,.15);border:none;color:#EAFBF6;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;cursor:pointer}
.luca .ci-head .ci-x:hover{background:rgba(255,255,255,.26)}
.luca .ci-body{padding:18px 20px 22px;display:flex;flex-direction:column;gap:20px}
.luca .ci-slider{display:flex;flex-direction:column;gap:8px}
.luca .ci-slider .ci-slabel{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--ink)}
.luca .ci-slider .ci-sval{margin-left:auto;font-size:13px;font-weight:700;color:var(--mint);min-width:26px;text-align:right}
.luca input[type=range].ci-range{-webkit-appearance:none;appearance:none;width:100%;height:8px;border-radius:999px;background:linear-gradient(90deg,var(--mint) 0%,var(--mint) var(--pct,50%),#E6EDEA var(--pct,50%),#E6EDEA 100%);outline:none;cursor:pointer}
.luca input[type=range].ci-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid var(--mint);box-shadow:0 2px 8px rgba(10,60,55,.3);cursor:pointer}
.luca input[type=range].ci-range::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid var(--mint);box-shadow:0 2px 8px rgba(10,60,55,.3);cursor:pointer}
/* Mobile: expand the slider hit area to a >=44px touch target while keeping the
   visible track thin (8px, vertically centered) and enlarging the thumb. */
@media(max-width:640px){
  .luca input[type=range].ci-range{height:44px;background:linear-gradient(90deg,var(--mint) 0%,var(--mint) var(--pct,50%),#E6EDEA var(--pct,50%),#E6EDEA 100%) no-repeat center / 100% 8px}
  .luca input[type=range].ci-range::-webkit-slider-thumb{width:28px;height:28px}
  .luca input[type=range].ci-range::-moz-range-thumb{width:28px;height:28px}
}
.luca .ci-question{background:var(--mint-soft,#E9F7F2);border:1px solid var(--line,#E6EDEA);border-radius:14px;padding:14px}
.luca .ci-question .ci-q{font-size:13.5px;color:var(--ink);font-weight:600;display:flex;gap:8px;align-items:flex-start;line-height:1.5}
.luca .ci-question textarea{width:100%;margin-top:10px;border:1px solid var(--line,#E6EDEA);border-radius:10px;padding:10px;font-family:inherit;font-size:13px;resize:vertical;min-height:56px;background:var(--surface,#fff);color:var(--ink);outline:none}
.luca .ci-question textarea:focus{border-color:var(--mint)}
.luca .ci-habits{display:flex;flex-direction:column;gap:8px}
.luca .ci-habit{display:flex;align-items:center;gap:10px;border:1px solid var(--line,#E6EDEA);border-radius:12px;padding:10px 12px;cursor:pointer;background:var(--surface,#fff);transition:all .15s;font-family:inherit;text-align:left;width:100%}
.luca .ci-habit:hover{border-color:var(--mint)}
.luca .ci-habit.on{background:var(--mint-soft,#E9F7F2);border-color:var(--mint)}
.luca .ci-habit .ci-hcheck{width:22px;height:22px;border-radius:7px;border:2px solid #CBD9D5;display:grid;place-items:center;flex:none;color:#fff}
.luca .ci-habit.on .ci-hcheck{background:var(--mint);border-color:var(--mint)}
.luca .ci-habit .ci-hname{font-size:13.5px;color:var(--ink);font-weight:500}
.luca .ci-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-2,#8AA39E);margin-bottom:2px}
.luca .ci-sleeprow{display:flex;align-items:center;gap:12px}
.luca .ci-sleeprow input[type=number]{width:90px;border:1px solid var(--line,#E6EDEA);border-radius:10px;padding:9px 10px;font-family:inherit;font-size:14px;color:var(--ink);outline:none}
.luca .ci-sleeprow input[type=number]:focus{border-color:var(--mint)}
/* Celebration */
.luca .ci-celebrate{padding:44px 24px 52px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
.luca .ci-love-badge{font-size:34px;font-weight:800;color:#159C7E;animation:loveFloat 1.8s ease forwards}
@keyframes loveFloat{0%{opacity:0;transform:translateY(18px) scale(.8)}25%{opacity:1;transform:translateY(0) scale(1.05)}75%{opacity:1;transform:translateY(-4px) scale(1)}100%{opacity:.9;transform:translateY(-10px) scale(1)}}
.luca .ci-bonus{font-size:14px;font-weight:700;color:#CC8E27;background:#FCF3E1;border-radius:999px;padding:6px 14px;animation:loveFloat 1.8s ease .15s both}
.luca .ci-streak-line{font-size:15px;font-weight:700;color:var(--ink);margin-top:4px}
.luca .ci-spark{font-size:40px;animation:sparkPop .6s ease}
@keyframes sparkPop{0%{transform:scale(0) rotate(-20deg)}60%{transform:scale(1.2) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
/* Weekly strip */
.luca .week-strip{display:flex;gap:8px;justify-content:space-between}
.luca .week-day{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.luca .week-day .wd-letter{font-size:11px;font-weight:700;color:var(--muted-2,#8AA39E)}
.luca .week-day .wd-dot{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#EEF3F1;color:#B4C4C0;font-size:13px;border:1px solid var(--line,#E6EDEA)}
.luca .week-day.done .wd-dot{background:linear-gradient(150deg,#36C9A9,#159C7E);color:#fff;border-color:transparent;box-shadow:0 3px 10px rgba(21,156,126,.35)}
.luca .week-day.today .wd-letter{color:var(--mint)}
.luca .week-day.today .wd-dot{outline:2px solid var(--mint);outline-offset:2px}
.luca .checkin-cta{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(150deg,#36C9A9,#159C7E);color:#fff;border:none;border-radius:12px;padding:10px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 6px 18px rgba(21,156,126,.32);transition:transform .15s,box-shadow .15s}
.luca .checkin-cta:hover{transform:translateY(-1px);box-shadow:0 9px 24px rgba(21,156,126,.4)}

/* ============================================================
   MOBILE APP SHELL (V1) — sticky header + safe-area bottom nav.
   Desktop (>=901px) is unchanged; all rules below are mobile-only.
   ============================================================ */
.luca .home-btn{display:none}
.luca .m-title{display:none}
.luca .m-botnav{display:none}
@media(max-width:900px){
  /* Compact sticky header: Home (left) · title (center) · notif+profile (right) */
  .topbar{padding:10px 12px;gap:8px}
  .topbar .search{display:none}
  .topbar .menu-btn{display:none}
  .luca .home-btn{display:flex}
  .luca .m-title{display:block;flex:1;min-width:0;font-family:var(--font-display);font-weight:700;
    font-size:16px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
  /* leave room for the fixed bottom nav so nothing hides behind it */
  .page{padding:16px 14px calc(84px + env(safe-area-inset-bottom,0px))}

  /* Fixed bottom navigation */
  /* Exactly five equal columns that can never overflow the viewport. Grid keeps
     every destination visible and complete; the centre LUCA orb rises visually
     but stays inside its own 1fr column. */
  .luca .m-botnav{position:fixed;inset-inline:0;left:0;right:0;bottom:0;z-index:60;
    display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:end;gap:2px;
    width:100%;max-width:100vw;box-sizing:border-box;
    background:rgba(255,255,255,.94);backdrop-filter:blur(12px);
    border-top:1px solid var(--line);padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px));
    transition:transform .28s cubic-bezier(.2,.8,.2,1)}
  .luca .m-botnav.hidden{transform:translateY(120%)}
  .luca .m-bn-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
    min-width:0;min-height:48px;padding:6px 2px;border:none;background:transparent;color:var(--muted);
    font-family:inherit;font-size:10.5px;font-weight:600;cursor:pointer;border-radius:12px;transition:color .15s}
  /* Labels stay on ONE line, never split inside a word (e.g. "Communications").
     Responsive type + slight negative tracking keeps the longest label fully
     visible inside its 1fr column at 360/390/412px without page overflow. */
  .luca .m-bn-item span{white-space:nowrap;text-align:center;line-height:1.15;max-width:100%;
    font-size:clamp(7px,2.2vw,10.5px);letter-spacing:-.2px}
  .luca .m-bn-item.active{color:var(--teal-d)}
  .luca .m-bn-item.active svg{transform:translateY(-1px)}
  .luca .m-bn-luca{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
    justify-self:center;min-width:0;border:none;background:transparent;cursor:pointer;font-family:inherit;margin-top:-22px}
  .luca .m-bn-luca .m-bn-orb{width:54px;height:54px;border-radius:50%;
    background:radial-gradient(circle at 50% 35%,#36C9A9,#0E5C57);color:#EAFBF6;display:grid;place-items:center;
    box-shadow:0 6px 18px rgba(14,92,87,.42),0 0 0 4px rgba(255,255,255,.9);transition:transform .18s}
  .luca .m-bn-luca.active .m-bn-orb,.luca .m-bn-luca:active .m-bn-orb{transform:scale(1.06)}
  .luca .m-bn-luca .m-bn-lbl{font-size:10.5px;font-weight:700;color:var(--teal-d);margin-top:2px}

  /* Practitioner "More" bottom sheet */
  .luca .m-more-scrim{position:fixed;inset:0;z-index:75;background:rgba(6,32,30,.5);display:flex;align-items:flex-end}
  .luca .m-more{width:100%;background:var(--surface);border-radius:20px 20px 0 0;padding:10px 12px calc(14px + env(safe-area-inset-bottom,0px));
    box-shadow:0 -18px 50px rgba(8,40,38,.3);animation:ciUp .3s cubic-bezier(.2,.8,.2,1)}
  .luca .m-more-grab{width:40px;height:4px;border-radius:999px;background:var(--line-2);margin:2px auto 10px}
  .luca .m-more-item{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:none;background:transparent;
    padding:14px 12px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:600;color:var(--ink);cursor:pointer;min-height:48px}
  .luca .m-more-item:hover{background:var(--surface-2)}
  .luca .m-more-item svg{color:var(--teal-d);flex:none}
  .luca .m-more-item.switch{color:var(--teal-d);border-top:1px solid var(--line);margin-top:4px}
}

/* Economic Passport sub-tabs: hide only the visual scrollbar of the opt-in
   horizontally scrollable tab row. Keyboard/pointer scrolling and focus are
   unaffected; only Economic Passport uses .subtabs-scroll. */
.subtabs-scroll{scrollbar-width:none;-ms-overflow-style:none}
.subtabs-scroll::-webkit-scrollbar{display:none}

`;

/* ============================== HELPERS ============================== */
const toneGrad = {
  teal: 'linear-gradient(145deg,#13716A,#0B4E49)',
  mint: 'linear-gradient(145deg,#36C9A9,#159C7E)',
  gold: 'linear-gradient(145deg,#E6B255,#CC8E27)',
  terra: 'linear-gradient(145deg,#C58A53,#9A5D2C)',
  ink: 'linear-gradient(145deg,#234F4B,#0A2B29)',
};
const initialsOf = (name = '') => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const fmtShort = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
const bandTone = (b) => ({ thriving: 'mint', balanced: 'teal', attention: 'gold', priority: 'danger' }[b] || 'gray');

/* ============================== PRIMITIVES ============================== */
const Avatar = ({ name, tone = 'teal', size = 40, initials }) => (
  <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, background: toneGrad[tone] || toneGrad.teal }}>
    {initials || initialsOf(name)}
  </div>
);
const Chip = ({ icon: Icon, tone = 'teal', sm }) => (
  <div className={`chip ${tone} ${sm ? 'sm' : ''}`}><Icon size={sm ? 16 : 18} strokeWidth={2} /></div>
);
const Card = ({ children, className = '', style }) => <div className={`card ${className}`} style={style}>{children}</div>;
const Pill = ({ children, tone = 'gray', icon: Icon }) => (
  <span className={`pill ${tone}`}>{Icon && <Icon size={12} strokeWidth={2.4} />}{children}</span>
);
const Btn = ({ children, variant = '', className = '', icon: Icon, ...p }) => (
  <button className={`btn ${variant} ${className}`} {...p}>{Icon && <Icon size={15} strokeWidth={2.2} />}{children}</button>
);
const Toggle = ({ on, onClick }) => (
  <div className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} tabIndex={0}
    onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
    <div className="knob" />
  </div>
);
const Progress = ({ v, gold }) => <div className="track"><div className={`bar ${gold ? 'gold' : ''}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>;
const SectionHead = ({ eyebrow, title, action }) => (
  <div className="between" style={{ marginBottom: 14, gap: 12 }}>
    <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<div className="card-title" style={{ marginTop: eyebrow ? 3 : 0 }}>{title}</div></div>
    {action}
  </div>
);
const PageHead = ({ title, sub, action }) => (
  <div className="page-head">
    <div><h1 className="page-title">{title}</h1>{sub && <div className="page-sub">{sub}</div>}</div>
    {action}
  </div>
);
const Ring = ({ value = 0, max = 100, size = 132 }) => {
  const r = (size - 16) / 2, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(1, value / max)), dash = c * pct;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id="lucaRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34C9A9" /><stop offset="100%" stopColor="#D69B33" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EBF3F0" strokeWidth="11" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#lucaRing)" strokeWidth="11"
        strokeLinecap="round" strokeDasharray={`${dash} ${c}`} style={{ transition: 'stroke-dasharray 1.2s var(--ease,ease)' }} />
    </svg>
  );
};
const Skel = ({ h = 16, w = '100%', style }) => <div className="skel" style={{ height: h, width: w, ...style }} />;
const CardSkeleton = ({ rows = 3 }) => (
  <Card className="col gap-3">
    <Skel h={14} w="40%" /><Skel h={28} w="60%" />
    {Array.from({ length: rows }).map((_, i) => <Skel key={i} h={12} w={`${90 - i * 12}%`} />)}
  </Card>
);
const Empty = ({ icon: Icon = Sparkles, title, sub, children }) => (
  <div className="empty col" style={{ alignItems: 'center', gap: 8 }}>
    <div className="chip mint" style={{ width: 48, height: 48 }}><Icon size={22} /></div>
    <div className="f6" style={{ color: 'var(--ink)' }}>{title}</div>
    {sub && <div className="small muted" style={{ maxWidth: 360 }}>{sub}</div>}
    {children && <div style={{ marginTop: 10 }}>{children}</div>}
  </div>
);


/* ============================== NAVIGATION (role-based) ============================== */
// Composite wallet+globe glyph for the Economic Passport tab.
function EconomicPassportIcon({ size = 17, strokeWidth = 2, ...rest }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size }} {...rest}>
      <Wallet size={size} strokeWidth={strokeWidth} />
      <Globe
        size={Math.round(size * 0.62)}
        strokeWidth={strokeWidth}
        style={{ position: 'absolute', right: -3, bottom: -3, background: 'var(--teal-d,#06403B)', borderRadius: '50%' }}
      />
    </span>
  );
}
function navForRole(role, isProvider) {
  // Unified navigation — everyone is a patient on their healing journey.
  // Approved providers simply gain an extra "My Practice" tab; nothing is
  // taken away. No mode switching.
  const nav = [
    {
      group: 'Overview', color: '#9FE7D6', items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'explore', label: 'Explore', icon: Compass },
      ],
    },
    {
      // Intelligence folds into LUCA Coach; Media + Inbox fold into Journal /
      // Messages respectively — each now a sub-tab of its parent, no duplication.
      group: 'Salud', color: '#36C9A9', items: [
        { id: 'health', label: 'Health Passport', icon: HeartPulse },
        { id: 'coach', label: 'LUCA Coach', icon: Bot },
        // Journal + Messages consolidated into a single Communications destination.
        { id: 'communications', label: 'Communications', icon: MessageSquare, badgeKey: 'messages' },
      ],
    },
    {
      // Economic Passport now carries Overview / Contributions / Network as
      // sub-tabs, so it is a real destination (no longer "coming soon").
      group: 'Tierra', color: '#C58A53', items: [
        { id: 'wallet', label: 'Economic Passport', icon: EconomicPassportIcon },
      ],
    },
  ];
  // Approved provider tools — added alongside the patient experience.
  if (isProvider) {
    nav.push({
      group: 'My Practice', color: '#E3AC46', items: [
        { id: 'my-practice', label: 'My Practice', icon: Store, badgeKey: 'bookings' },
      ],
    });
  }
  if (role === 'practitioner' || role === 'admin') {
    nav.push({
      group: 'Practice', color: '#E3AC46', items: [
        { id: 'drafts', label: 'Draft Queue', icon: ClipboardList, badgeKey: 'drafts' },
        { id: 'schedule', label: 'Schedule', icon: CalendarDays },
        { id: 'patients', label: 'Patients', icon: Users },
      ],
    });
  }
  if (role === 'admin') {
    nav.push({
      group: 'System', color: '#8AA09C', items: [
        { id: 'analytics', label: 'Analytics', icon: Activity },
        { id: 'gps-economy', label: 'GPS Economy', icon: Sprout },
        { id: 'provider-approvals', label: 'Provider Approvals', icon: FileCheck, badgeKey: 'approvals' },
        { id: 'booking-oversight', label: 'Booking Oversight', icon: CalendarCheck },
        { id: 'systimeline', label: 'System Timeline', icon: Clock },
        { id: 'users', label: 'Member Management', icon: UserCog },
        { id: 'settings', label: 'System Settings', icon: Settings },
      ],
    });
  }
  return nav;
}

// Solaris-native navigation appended for every role. `effectiveRole` is the
// demo-switched role (may differ from the logged-in account).
function solarisNav(effectiveRole) {
  const groups = [];
  if (effectiveRole === 'clinic_admin') {
    groups.push({
      group: 'Clinic Node', color: '#E3AC46', items: [
        { id: 'aura-admin', label: 'Clinic Console', icon: Building2 },
      ],
    });
  }
  // The former "Sovereign" sidebar group is consolidated: The Network and
  // Contributions are now sub-tabs of the Economic Passport, and Identity & Data
  // lives in the top-right profile menu. No standalone sidebar entries remain.
  return groups;
}

// Map a Solaris demo persona to the closest legacy role the base nav understands.
function legacyRoleFor(effectiveRole) {
  if (effectiveRole === 'clinic_admin') return 'admin';
  return effectiveRole || 'patient';
}

// Only three demo personas are supported. Any other role coming from the DB
// (vendor, builder, solaris_admin, unknown, …) falls back to the patient view.
const SOLARIS_ROLES = [
  { value: 'patient', label: 'Patient' },
  { value: 'practitioner', label: 'Practitioner' },
  { value: 'clinic_admin', label: 'Clinic Admin' },
];
const SOLARIS_ROLE_LABEL = Object.fromEntries(SOLARIS_ROLES.map((r) => [r.value, r.label]));
const SOLARIS_ROLE_SET = new Set(SOLARIS_ROLES.map((r) => r.value));

// Normalize any incoming role to one of the three supported personas.
function normalizeSolarisRole(r) {
  if (r === 'admin') return 'clinic_admin';
  if (SOLARIS_ROLE_SET.has(r)) return r;
  return 'patient';
}

/* ---- Role-differentiated navigation (Sprint F) ----
   Members keep the full sovereign patient experience (navForRole + solarisNav).
   Practitioners and clinic admins get a focused portal: a single, purpose-built
   set of tabs with no patient chrome, so a demo never lands on a dead end. */

// Practitioner Portal — the working surface for an approved practitioner.
function practitionerNav() {
  return [
    {
      group: 'Practice', color: '#6B7FD7', items: [
        { id: 'prac-clients', label: 'My Clients', icon: Users },
        { id: 'prac-bookings', label: 'Bookings', icon: CalendarDays, badgeKey: 'drafts' },
        { id: 'prac-availability', label: 'Availability', icon: CalendarCheck },
        { id: 'prac-messages', label: 'Messages', icon: MessageSquare, badgeKey: 'messages' },
      ],
    },
    {
      group: 'Business', color: '#2DB584', items: [
        { id: 'prac-finance', label: 'Finance', icon: Wallet },
        { id: 'prac-settings', label: 'Settings', icon: Settings },
      ],
    },
  ];
}

// Solaris Admin — the platform operator's console.
function adminNav() {
  return [
    {
      group: 'People', color: '#C58A53', items: [
        { id: 'admin-members', label: 'Members', icon: Users },
        { id: 'admin-practitioners', label: 'Practitioners', icon: Stethoscope, badgeKey: 'approvals' },
      ],
    },
    {
      group: 'Operations', color: '#C58A53', items: [
        { id: 'admin-bookings', label: 'Bookings', icon: CalendarCheck },
        { id: 'admin-finance', label: 'Finance', icon: Wallet },
        { id: 'admin-system', label: 'System', icon: Activity },
        { id: 'admin-settings', label: 'Settings', icon: Settings },
      ],
    },
  ];
}

// Per-persona portal chrome: sidebar sub-title, accent colour, and role label.
export const PORTAL = {
  patient: { sub: 'Sovereign Passport', accent: '#2DB584', label: 'Member' },
  practitioner: { sub: 'Practitioner Portal', accent: '#6B7FD7', label: 'Practitioner' },
  clinic_admin: { sub: 'Solaris Admin', accent: '#C58A53', label: 'Admin' },
};

// The tab a persona lands on when they sign in (or after a role switch).
export function defaultTabFor(effectiveRole) {
  if (effectiveRole === 'practitioner') return 'prac-clients';
  if (effectiveRole === 'clinic_admin') return 'admin-members';
  return 'dashboard';
}

// Build the full navigation for a persona.
export function navForPersona(effectiveRole, legacyRole, isProvider) {
  if (effectiveRole === 'practitioner') return practitionerNav();
  if (effectiveRole === 'clinic_admin') return adminNav();
  return [...navForRole(legacyRole, isProvider), ...solarisNav(effectiveRole)];
}
// Warm, human labels for each member journey type (mirrors backend JOURNEY_LABELS).
const JOURNEY_LABELS = {
  optimal_health: 'Optimal Health',
  detox: 'Gentle Detox',
  menopause: 'Menopause Support',
  heavy_metal: 'Heavy Metal Release',
  smile: 'The Smile Journey',
  thyroid: 'Thyroid Balance',
  sugar: 'Sugar Balance',
  nurture_mama: 'Nurture Mama',
  your_path: 'Your Path',
};

// The journeys offered as a starting grid on Explore (and its empty state).
const JOURNEY_OFFERS = [
  { type: 'detox', label: 'Gentle Detox', blurb: 'Ease your system into cleaner rhythms — food, rest, and breath.' },
  { type: 'optimal_health', label: 'Optimal Health', blurb: 'A steady path to your fullest Mind, Body, Heart & Spirit.' },
  { type: 'menopause', label: 'Menopause Support', blurb: 'Grounded, warm guidance through a season of change.' },
];

const TAB_META = {
  dashboard: { title: 'Dashboard', sub: 'Your steering wheel for health, value, and care — one sovereign view.' },
  explore: { title: 'Explore', sub: 'Discover trusted health & wellness providers near you — clinics, farms, healers, and more.' },
  health: { title: 'Health Passport', sub: 'Your 360° vitality, owned by you and exportable anytime.' },
  inbox: { title: 'Inbox', sub: 'Booking confirmations, intake requests, and messages from your practitioners.' },
  timeline: { title: 'Health Timeline', sub: 'Your complete health journey and trends — chronological and exportable.' },
  systimeline: { title: 'System Timeline', sub: 'Platform-wide activity, sign-ups, and usage patterns over time.' },
  coach: { title: 'LUCA Coach', sub: 'Heart-Centered Intelligence — a guide, never a diagnosis.' },
  intelligence: { title: 'Intelligence', sub: 'The mind working for you — what you know, what LUCA can see, and the insight it draws. Fully in your control.' },
  journal: { title: 'Journal', sub: 'A private space to reflect. Capture how you feel, notice patterns, own your story.' },
  media: { title: 'Media Library', sub: 'Guided audio practices from Solaris practitioners — yours to keep and revisit.' },
  appointments: { title: 'Appointments', sub: 'Book care and track your visits across the Solaris network.' },
  'my-bookings': { title: 'My Bookings', sub: 'Your appointments with marketplace providers — upcoming, pending, and past.' },
  'booking-oversight': { title: 'Booking Oversight', sub: 'Monitor and resolve appointments across every provider on the platform.' },
  messages: { title: 'Secure Messages', sub: 'End-to-end encrypted conversations with your care network — only you can read them.' },
  communications: { title: 'Communications', sub: 'Everything you say and reflect — messages and inbox with others, and your private journal, growth, and media.' },
  wallet: { title: 'Economic Passport', sub: 'Your sovereign economic identity — GPS value flows, LOVE points, and simulated receipts.' },
  treasury: { title: 'Community Treasury', sub: 'The regenerative commons — every transaction seeds our shared prosperity.' },
  'gps-economy': { title: 'GPS Economy', sub: 'The living economy — how value flows, splits, and returns to the commons.' },
  drafts: { title: 'Draft Queue', sub: 'Review and approve AI-prepared triage summaries before they reach patients.' },
  schedule: { title: 'Schedule', sub: 'Your appointment calendar and incoming requests.' },
  patients: { title: 'Patients', sub: 'People in your care across the network.' },
  analytics: { title: 'Analytics', sub: 'Platform health at a glance.' },
  'provider-approvals': { title: 'Provider Approvals', sub: 'Review and verify provider applications before they go live.' },
  users: { title: 'User Management', sub: 'Members, practitioners, and access across Solaris.' },
  settings: { title: 'System Settings', sub: 'Configuration, AI, and platform controls.' },
  // Provider workspace (unified — shown alongside patient tabs)
  'my-practice': { title: 'My Practice', sub: 'Manage your listings, bookings, reviews, and analytics — all in one place.' },
  // Solaris-native pages
  'gps-map': { title: 'The Network', sub: 'The GPS ecosystem, live — every node a sovereign identity, every payment regenerating the whole network.' },
  contributions: { title: 'Contributions', sub: 'Your attested contribution record — the same recognition the GPS envelope rewards. Levels honour what you give, never what you extract.' },
  identity: { title: 'Identity & Data', sub: 'Identity above endpoints — your sovereign identity, GPS end address, and one-click data export. You own all of it.' },
  'aura-admin': { title: 'Clinic Console', sub: "Aura Dental's operations — appointments, simulated payments, follow-ups, and GPS treasury." },
  // Practitioner Portal (Sprint F)
  'prac-clients': { title: 'My Clients', sub: 'The members in your care across the Solaris network.' },
  'prac-bookings': { title: 'Bookings', sub: 'Your appointment requests and confirmed visits — confirm, reschedule, or complete.' },
  'prac-availability': { title: 'Availability', sub: 'Set the weekly hours members can book. Changes take effect instantly.' },
  'prac-messages': { title: 'Messages', sub: 'End-to-end encrypted conversations with the members in your care.' },
  'prac-finance': { title: 'Finance', sub: 'Your simulated GPS earnings, transaction ledger, and payout method.' },
  'prac-settings': { title: 'Settings', sub: 'Your practice profile, availability, notifications, and account.' },
  // Solaris Admin (Sprint F)
  'admin-members': { title: 'Members', sub: 'Everyone on the platform — members, practitioners, and access.' },
  'admin-practitioners': { title: 'Practitioners', sub: 'Review and verify practitioner applications before they go live.' },
  'admin-bookings': { title: 'Bookings', sub: 'Monitor and resolve appointments across every provider.' },
  'admin-finance': { title: 'Finance', sub: 'Platform payment reconciliation and the GPS settlement queue.' },
  'admin-system': { title: 'System', sub: 'Platform health, the living GPS economy, and the activity timeline.' },
  'admin-settings': { title: 'Settings', sub: 'Platform configuration, data protection, and audit retention.' },
  // Account settings (member) — one destination, five sections.
  account: { title: 'Settings', sub: 'Your profile, preferences, notifications, security, and data — all in one place.' },
};

/* ============================== NAVIGATION STATE (URL-backed) ==============================
   The authenticated app keeps its area + nested sub-tab (and the member/practitioner
   portal view) in the URL query string, so bookmarks, refresh, and browser Back/Forward
   all restore the exact view. The pathname is untouched ("/"), so /find and /intake keep
   working. Old, now-consolidated nav targets redirect to their new parent tab + sub-tab. */

// Legacy (pre-consolidation) tab ids → their new { tab, sub } home.
export const LEGACY_TAB_MAP = {
  intelligence: { tab: 'coach', sub: 'intelligence' },
  // Journal + Messages (and their former sub-pages) consolidate into Communications.
  journal: { tab: 'communications', sub: 'journal' },
  growth: { tab: 'communications', sub: 'growth' },
  media: { tab: 'communications', sub: 'media' },
  messages: { tab: 'communications', sub: 'messages' },
  inbox: { tab: 'communications', sub: 'inbox' },
  contributions: { tab: 'wallet', sub: 'contributions' },
  'gps-map': { tab: 'wallet', sub: 'network' },
  network: { tab: 'wallet', sub: 'network' },
};

// Areas that own a set of nested sub-tabs, with the default (first) sub-tab.
export const SUBTABS = {
  coach: { tabs: ['coach', 'intelligence'], def: 'coach' },
  // Communications: "With Others" (messages, inbox) + "With Yourself" (journal, growth, media).
  communications: { tabs: ['messages', 'inbox', 'journal', 'growth', 'media'], def: 'messages' },
  journal: { tabs: ['journal', 'growth', 'media'], def: 'journal' },
  messages: { tabs: ['conversations', 'inbox'], def: 'conversations' },
  wallet: { tabs: ['wallet', 'gps', 'contributions', 'network'], def: 'wallet' },
  account: { tabs: ['profile', 'preferences', 'notifications', 'security', 'privacy'], def: 'profile' },
};

// Canonicalise a raw (possibly legacy) tab + sub into a valid { tab, sub }.
export function resolveNav(rawTab, rawSub) {
  let tab = rawTab || 'dashboard';
  let sub = rawSub || null;
  if (LEGACY_TAB_MAP[tab]) {
    const m = LEGACY_TAB_MAP[tab];
    tab = m.tab;
    if (!sub) sub = m.sub;
  }
  const conf = SUBTABS[tab];
  if (conf) {
    if (!sub || !conf.tabs.includes(sub)) sub = conf.def;
  } else {
    sub = null;
  }
  return { tab, sub };
}

// Read the current nav intent from the URL query string.
function readUrlNav() {
  try {
    const p = new URLSearchParams(window.location.search);
    return { tab: p.get('area'), sub: p.get('sub'), portal: p.get('portal') };
  } catch {
    return { tab: null, sub: null, portal: null };
  }
}

// Push a canonical nav (+ optional portal view) into the URL without touching the pathname.
function writeUrlNav(tab, sub, portalView, replace = false) {
  try {
    const p = new URLSearchParams(window.location.search);
    if (tab) p.set('area', tab); else p.delete('area');
    if (sub) p.set('sub', sub); else p.delete('sub');
    if (portalView) p.set('portal', portalView); else p.delete('portal');
    const qs = p.toString();
    const url = `${window.location.pathname}${qs ? '?' + qs : ''}`;
    if (replace) window.history.replaceState({ tab, sub, portalView }, '', url);
    else window.history.pushState({ tab, sub, portalView }, '', url);
  } catch { /* history unavailable — state still lives in React */ }
}

/* ============================== DAILY CHECK-IN ============================== */
const CI_DIMENSIONS = [
  { key: 'mind', label: 'Mind', emoji: '🧠', hint: 'Clarity & focus' },
  { key: 'body', label: 'Body', emoji: '💪', hint: 'Energy & vitality' },
  { key: 'heart', label: 'Heart', emoji: '💛', hint: 'Mood & connection' },
  { key: 'spirit', label: 'Spirit', emoji: '✨', hint: 'Faith, purpose & peace' },
];
const LUCA_QUESTIONS = [
  "What intention do you carry into the new week?",       // Sun (0)
  "What's one thing you're grateful for this week?",      // Mon (1)
  "What's one thing you want to let go of today?",        // Tue (2)
  "What did your body ask for this morning?",             // Wed (3)
  "When did you feel most at peace recently?",            // Thu (4)
  "What are you most proud of this week?",                // Fri (5)
  "What nourished you most today — food, rest, connection?", // Sat (6)
];

// Mon–Sun strip of check-ins for the current week.
function WeekStrip() {
  const [days, setDays] = useState(null);
  const load = () => api.getWeekStrip().then((r) => setDays(r?.days || [])).catch(() => setDays([]));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('solaris:checkin', h);
    return () => window.removeEventListener('solaris:checkin', h);
  }, []);
  const todayKey = new Date().toISOString().slice(0, 10);
  if (!days) return <div className="week-strip">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="week-day"><Skel h={11} w={12} /><Skel h={26} w={26} style={{ borderRadius: 999 }} /></div>)}</div>;
  return (
    <div className="week-strip">
      {days.map((d) => (
        <div key={d.date} className={`week-day ${d.hasCheckin ? 'done' : ''} ${d.date === todayKey ? 'today' : ''}`}>
          <span className="wd-letter">{d.letter}</span>
          <span className="wd-dot">{d.hasCheckin ? <Check size={14} strokeWidth={3} /> : '○'}</span>
        </div>
      ))}
    </div>
  );
}

function CheckinSlider({ dim, value, onChange }) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div className="ci-slider">
      <div className="ci-slabel">
        <span style={{ fontSize: 18 }}>{dim.emoji}</span>
        <span>{dim.label}</span>
        <span className="tiny muted" style={{ fontWeight: 500 }}>· {dim.hint}</span>
        <span className="ci-sval">{value}</span>
      </div>
      <input
        type="range" min="1" max="10" step="1" value={value}
        className="ci-range" style={{ '--pct': `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={dim.label}
      />
    </div>
  );
}

function DailyCheckinModal({ user, open, onClose, onSaved }) {
  const [scores, setScores] = useState({ mind: 5, body: 5, heart: 5, spirit: 5 });
  const [answer, setAnswer] = useState('');
  const [sleep, setSleep] = useState('');
  const [water, setWater] = useState(null);      // glasses of water today (0-12)
  const [meal, setMeal] = useState(null);        // meal quality 1-10
  const [mealNotes, setMealNotes] = useState('');
  const [habits, setHabits] = useState([]);
  const [ticked, setTicked] = useState({});
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(null);

  const dow = new Date().getDay();
  const question = LUCA_QUESTIONS[dow];

  useEffect(() => {
    if (!open) return;
    // reset each open
    setScores({ mind: 5, body: 5, heart: 5, spirit: 5 });
    setAnswer(''); setSleep(''); setWater(null); setMeal(null); setMealNotes(''); setTicked({}); setCelebrate(null);
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      try {
        const [h, t] = await Promise.all([
          api.getHabits().catch(() => ({ habits: [] })),
          api.getHabitTicks(today, today).catch(() => ({ ticks: [] })),
        ]);
        setHabits(h?.habits || []);
        const pre = {};
        (t?.ticks || []).forEach((x) => { pre[x.habit_id] = true; });
        setTicked(pre);
      } catch { /* noop */ }
    })();
  }, [open]);

  // While the check-in sheet blocks the screen, ask the shell to hide the
  // mobile bottom nav so it never overlaps the sheet.
  useEffect(() => {
    if (!open) return undefined;
    window.dispatchEvent(new CustomEvent('solaris:botnav', { detail: { hidden: true } }));
    return () => window.dispatchEvent(new CustomEvent('solaris:botnav', { detail: { hidden: false } }));
  }, [open]);

  if (!open) return null;

  const setScore = (k, v) => setScores((s) => ({ ...s, [k]: v }));
  const toggleHabit = (id) => setTicked((t) => ({ ...t, [id]: !t[id] }));

  const submit = async () => {
    setSaving(true);
    try {
      const habitIds = Object.keys(ticked).filter((id) => ticked[id]);
      const res = await api.createCheckin({
        mindScore: scores.mind, bodyScore: scores.body, heartScore: scores.heart, spiritScore: scores.spirit,
        // keep energy/mood in sync so existing widgets stay populated (0–100 scale)
        energyScore: scores.body * 10, moodScore: scores.heart * 10,
        sleepHours: sleep === '' ? null : Number(sleep),
        hydrationGlasses: water == null ? null : Number(water),
        nutritionScore: meal == null ? null : Number(meal),
        mealNotes: mealNotes.trim() || null,
        lucaQuestionAnswer: answer.trim() || null,
        habitIds,
      });
      setCelebrate({
        awards: res.awards || [{ points: 5, label: 'Daily check-in' }],
        currentStreak: res.currentStreak || 0,
      });
      window.dispatchEvent(new CustomEvent('solaris:checkin'));
      if (onSaved) onSaved(res);
      setTimeout(() => { onClose(); }, 2200);
    } catch (e) {
      toast.error(e.message || 'Could not save check-in');
      setSaving(false);
    }
  };

  const totalPoints = celebrate ? celebrate.awards.reduce((s, a) => s + a.points, 0) : 0;
  const bonus = celebrate ? celebrate.awards.find((a) => a.points > 5) : null;

  return (
    <div className="ci-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="ci-modal" role="dialog" aria-modal="true" aria-label="Daily check-in">
        {celebrate ? (
          <div className="ci-celebrate">
            <div className="ci-spark">🌟</div>
            <div className="ci-love-badge">+{totalPoints} LOVE</div>
            {bonus && <div className="ci-bonus">+{bonus.points} LOVE • {bonus.label}</div>}
            {celebrate.currentStreak >= 2 && (
              <div className="ci-streak-line">Your streak: {celebrate.currentStreak} days 🔥</div>
            )}
            <div className="small muted" style={{ marginTop: 6 }}>Beautifully done, {user.firstName || 'friend'}. See you tomorrow.</div>
          </div>
        ) : (
          <>
            <div className="ci-head">
              <LucaAvatar size="sm" />
              <h3>How are you feeling today, {user.firstName || 'friend'}?</h3>
              <button className="ci-x" onClick={onClose} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="ci-body">
              <div>
                <div className="ci-eyebrow">Mind · Body · Heart · Spirit</div>
                <div className="col" style={{ gap: 16, marginTop: 10 }}>
                  {CI_DIMENSIONS.map((dim) => (
                    <CheckinSlider key={dim.key} dim={dim} value={scores[dim.key]} onChange={(v) => setScore(dim.key, v)} />
                  ))}
                </div>
              </div>

              <div className="ci-question">
                <div className="ci-q"><Sparkles size={16} className="t-teal" style={{ flex: 'none', marginTop: 1 }} /> {question}</div>
                <textarea
                  maxLength={300} value={answer} onChange={(e) => setAnswer(e.target.value)}
                  placeholder="A word or two is plenty (optional)…"
                />
              </div>

              {habits.length > 0 && (
                <div>
                  <div className="ci-eyebrow">Today's habits</div>
                  <div className="ci-habits" style={{ marginTop: 10 }}>
                    {habits.map((h) => (
                      <button key={h.id} type="button" className={`ci-habit ${ticked[h.id] ? 'on' : ''}`} onClick={() => toggleHabit(h.id)}>
                        <span className="ci-hcheck">{ticked[h.id] && <Check size={14} strokeWidth={3} />}</span>
                        <span style={{ fontSize: 17 }}>{h.icon}</span>
                        <span className="ci-hname">{h.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="ci-eyebrow">Sleep last night</div>
                <div className="ci-sleeprow" style={{ marginTop: 10 }}>
                  <Moon size={18} className="t-teal" />
                  <input type="number" min="0" max="12" step="0.5" value={sleep}
                    onChange={(e) => setSleep(e.target.value)} placeholder="7.5" />
                  <span className="small muted">hours</span>
                </div>
              </div>

              <div>
                <div className="ci-eyebrow">Water today</div>
                <div className="small muted" style={{ marginTop: 4 }}>Glasses so far — your daily goal is 8.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {[0,1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                    <button key={n} type="button" aria-label={`${n} glasses of water`}
                      onClick={() => setWater(water === n ? null : n)}
                      style={{
                        width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                        border: water === n ? '2px solid #2DB584' : '1px solid #dde7e2',
                        background: water === n ? '#e6f7f0' : '#fff',
                        color: water === n ? '#0A2B29' : '#6b807a',
                      }}>{n}</button>
                  ))}
                </div>
              </div>

              <div>
                <div className="ci-eyebrow">Meal quality today</div>
                <div className="small muted" style={{ marginTop: 4 }}>How nourishing were your meals? (1 = processed, 10 = whole & fresh)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <button key={n} type="button" aria-label={`Meal quality ${n} of 10`}
                      onClick={() => setMeal(meal === n ? null : n)}
                      style={{
                        width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                        border: meal === n ? '2px solid #C58A53' : '1px solid #dde7e2',
                        background: meal === n ? '#faf1e8' : '#fff',
                        color: meal === n ? '#0A2B29' : '#6b807a',
                      }}>{n}</button>
                  ))}
                </div>
                {meal != null && (
                  <input type="text" maxLength={300} value={mealNotes}
                    onChange={(e) => setMealNotes(e.target.value)}
                    placeholder="What did you eat? (optional)"
                    style={{ marginTop: 10, width: '100%', padding: '9px 12px', borderRadius: 10,
                      border: '1px solid #dde7e2', fontSize: 13.5, fontFamily: 'inherit', color: '#0A2B29' }} />
                )}
              </div>

              <Btn variant="primary block" icon={Check} onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : 'Save my check-in'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================== PATIENT — DASHBOARD ============================== */
function DashboardPage({ user, go }) {
  const [latest, setLatest] = useState(null);
  const [rewards, setRewards] = useState({ events: [], total: 0 });
  const [contribs, setContribs] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [recs, setRecs] = useState(null);
  const [recsLoading, setRecsLoading] = useState(true);
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [consentReqs, setConsentReqs] = useState([]);
  const [consentBusy, setConsentBusy] = useState('');
  const [completeness, setCompleteness] = useState(null);
  const [myBookings, setMyBookings] = useState([]);

  const loadConsents = async () => {
    try {
      const r = await api.getMyConsentRequests();
      setConsentReqs((r?.requests || []).filter((c) => c.status === 'pending'));
    } catch { setConsentReqs([]); }
  };

  const respondConsent = async (id, grant) => {
    setConsentBusy(id);
    try {
      if (grant) { await api.grantConsent(id); toast.success('Passport access granted.'); }
      else { await api.revokeConsent(id); toast.success('Request declined.'); }
      setConsentReqs((reqs) => reqs.filter((c) => c.id !== id));
    } catch (e) {
      toast.error(e.message || 'Could not update the request.');
    } finally { setConsentBusy(''); }
  };

  const reloadDaily = async () => {
    const [r, ci] = await Promise.all([
      api.getRewards().catch(() => ({ events: [], total: 0 })),
      api.getCheckins().catch(() => ({ checkins: [] })),
    ]);
    setRewards(r || { events: [], total: 0 });
    setCheckins(ci?.checkins || []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [l, r, c, ci] = await Promise.all([
          api.getLatestAssessment().catch(() => null),
          api.getRewards().catch(() => ({ events: [], total: 0 })),
          api.getContributions().catch(() => []),
          api.getCheckins().catch(() => ({ checkins: [] })),
        ]);
        if (!alive) return;
        setLatest(l); setRewards(r || { events: [], total: 0 });
        setContribs(Array.isArray(c) ? c : []); setCheckins(ci?.checkins || []);
      } finally { alive && setLoading(false); }
    })();
    loadConsents();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    api.getMyJourneys()
      .then((r) => { if (alive) setJourneys(r?.journeys || []); })
      .catch(() => { if (alive) setJourneys([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rec = await api.getLucaRecommendations();
        if (alive) setRecs(rec || null);
      } catch {
        if (alive) setRecs(null);
      } finally {
        if (alive) setRecsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getPassportCompleteness().catch(() => null),
      api.getMyBookings().catch(() => ({ bookings: [] })),
    ]).then(([comp, bk]) => {
      if (!alive) return;
      setCompleteness(comp || null);
      setMyBookings(bk?.bookings || []);
    });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <div className="lay-dash"><div className="col gap-4"><CardSkeleton rows={4} /><div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}><CardSkeleton /><CardSkeleton /></div></div><div className="col gap-4"><CardSkeleton rows={5} /></div></div>;
  }

  const vitality = latest?.response?.vitality_score ?? 0;
  const focus = latest?.response?.top_focus_areas_json || [];
  const today = checkins[0];
  const spark = (rewards.events || []).slice(0, 12).reverse().reduce((acc, e, i) => {
    const prev = acc.length ? acc[acc.length - 1].v : 0;
    acc.push({ d: i, v: prev + (e.points || 0) });
    return acc;
  }, []);
  if (!spark.length) spark.push({ d: 0, v: rewards.total || 0 });

  return (
    <div className="lay-dash">
      <div className="col gap-4">
        {/* Hero / profile */}
        <Card className="lg tint">
          <div className="row top wrap" style={{ gap: 16 }}>
            <Avatar name={user.fullName} size={62} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="row wrap" style={{ gap: 9 }}>
                <span className="dp f7" style={{ fontSize: 21 }}>{greeting()}, {user.firstName || 'friend'}</span>
                <Pill tone="mint" icon={ShieldCheck}>{roleLabel(user.role)}</Pill>
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>{user.email}</div>
              <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                <Pill tone="gold" icon={Gift}>{rewards.total} LOVE points</Pill>
                {user.currentPhase && <Pill tone="teal">{user.currentPhase}</Pill>}
                {completeness && completeness.score >= 80 && (
                  <Pill tone="gold" icon={Sparkles}>Sovereign Member ✦</Pill>
                )}
                {completeness && completeness.score < 50 && (
                  <button className="pill-cta" onClick={() => go('health')}>
                    <Sparkles size={13} strokeWidth={2.2} /> Complete your Passport
                  </button>
                )}
              </div>
            </div>
            <div style={{ position: 'relative', width: 132, height: 132, flex: 'none' }}>
              <Ring value={vitality} max={100} />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <div><div className="dp f7" style={{ fontSize: 30 }}>{vitality}</div><div className="tiny muted2">Vitality / 100</div></div>
              </div>
            </div>
          </div>
        </Card>

        {/* Consent requests — a practitioner has asked to view parts of your Passport */}
        {consentReqs.map((c) => (
          <Card key={c.id} className="tint" style={{ borderColor: 'var(--gold-line, var(--line))' }}>
            <div className="row top wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
              <div className="luca-avatar sm" style={{ background: 'linear-gradient(170deg,#0E5C57,#0A413D)', flex: 'none' }}>
                <ShieldCheck size={16} color="#DAF3EC" strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="dp f7" style={{ fontSize: 15.5, color: 'var(--ink)' }}>
                  {c.practitioner_name || c.practitioner_first_name || 'A practitioner'} requests Passport access
                </div>
                <div className="small muted" style={{ marginTop: 4, lineHeight: 1.5 }}>
                  {c.practitioner_listing ? `${c.practitioner_listing} · ` : ''}
                  They'd like to view your {(c.granted_sections || ['assessment', 'checkins']).join(' & ')}.
                  You decide — and you can revoke anytime.
                </div>
                <div className="row gap-2 wrap" style={{ marginTop: 12 }}>
                  <Btn variant="primary" onClick={() => respondConsent(c.id, true)} disabled={consentBusy === c.id}>
                    {consentBusy === c.id ? 'Saving…' : 'Grant access'}
                  </Btn>
                  <Btn onClick={() => respondConsent(c.id, false)} disabled={consentBusy === c.id}>Decline</Btn>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {/* Booking status — proposed times & upcoming sessions */}
        {(() => {
          const proposedBk = myBookings.filter((b) => b.status === 'proposed');
          const upcomingBk = myBookings.filter((b) => b.status === 'confirmed' || b.status === 'scheduled');
          if (!proposedBk.length && !upcomingBk.length) return null;
          return (
            <Card className="tint" style={{ borderColor: proposedBk.length ? 'var(--gold-line, #ecd9a8)' : 'var(--mint-line, var(--line))' }}>
              <div className="between" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <div className="eyebrow">Your appointments</div>
                  <div className="card-title" style={{ marginTop: 3 }}>
                    {proposedBk.length ? 'A new time is waiting for you' : 'Upcoming sessions'}
                  </div>
                </div>
                <Pill tone={proposedBk.length ? 'gold' : 'mint'} icon={CalendarClock}>
                  {proposedBk.length ? `${proposedBk.length} to confirm` : `${upcomingBk.length} scheduled`}
                </Pill>
              </div>
              {proposedBk.length > 0 && (
                <div className="small muted" style={{ marginTop: 12, lineHeight: 1.55 }}>
                  Your practitioner proposed a time for your session. Review and confirm to lock it in.
                </div>
              )}
              <div className="row" style={{ marginTop: 14 }}>
                <Btn variant="primary" icon={ChevronRight} onClick={() => go('my-bookings')}>
                  {proposedBk.length ? 'Review & confirm' : 'View appointments'}
                </Btn>
              </div>
            </Card>
          );
        })()}

        {/* LUCA Recommends */}
        <LucaRecommends recs={recs} loading={recsLoading} go={go} user={user} vitality={vitality} focus={focus} />

        {/* Active journey */}
        {(() => {
          const aj = journeys.find((j) => j.status === 'active');
          if (!aj) return null;
          const total = aj.totalCount || 0;
          const done = aj.completedCount || 0;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const name = JOURNEY_LABELS[aj.journeyType] || 'Your journey';
          return (
            <Card className="tint" style={{ borderColor: 'var(--mint-line, var(--line))' }}>
              <div className="between" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <div className="eyebrow">Your active journey</div>
                  <div className="card-title" style={{ marginTop: 3 }}>{name}</div>
                </div>
                <Pill tone="mint" icon={Compass}>{done} of {total} milestones</Pill>
              </div>
              <div style={{ marginTop: 14 }}><Progress v={pct} /></div>
              {aj.nextMilestone ? (
                <div className="small muted" style={{ marginTop: 12, lineHeight: 1.55 }}>
                  <span className="f6" style={{ color: 'var(--ink)' }}>Next:</span> {aj.nextMilestone.label}
                  {aj.nextMilestone.description ? ` — ${aj.nextMilestone.description}` : ''}
                </div>
              ) : (
                <div className="small muted" style={{ marginTop: 12, lineHeight: 1.55 }}>
                  Every milestone complete — beautifully done. LUCA will help you choose what's next.
                </div>
              )}
              <div className="row" style={{ marginTop: 14 }}>
                <Btn variant="primary" icon={ChevronRight} onClick={() => go('explore')}>Continue journey</Btn>
              </div>
            </Card>
          );
        })()}

        {/* Weekly check-in strip */}
        <Card>
          <div className="between" style={{ marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow">This week</div>
              <div className="card-title" style={{ marginTop: 3 }}>Your check-in rhythm</div>
            </div>
            <button className="checkin-cta" onClick={() => setCheckinOpen(true)}><Plus size={16} strokeWidth={2.4} /> Check in</button>
          </div>
          <WeekStrip />
        </Card>

        {/* Focus areas + daily metrics */}
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Card>
            <SectionHead eyebrow="Today" title="Your focus areas" action={<Btn variant="ghost sm" icon={ChevronRight} onClick={() => go('health')}>Passport</Btn>} />
            {focus.length ? focus.slice(0, 4).map((f, i) => (
              <div key={i} className="list-row" style={{ padding: '10px 0' }}>
                <Chip icon={Leaf} tone={['mint', 'teal', 'gold', 'terra'][i % 4]} sm />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small f6">{f.name}</div>
                  {typeof f.score === 'number' && <div style={{ marginTop: 6 }}><Progress v={f.score} /></div>}
                </div>
                {typeof f.score === 'number' && <span className="small f7 t-teal">{f.score}</span>}
              </div>
            )) : <Empty icon={Activity} title="No assessment yet" sub="Complete the Solaris Method to reveal your focus areas." />}
          </Card>
          <Card>
            <SectionHead eyebrow="Latest check-in" title="Daily signals" action={<Btn variant="ghost sm" icon={Plus} onClick={() => setCheckinOpen(true)}>Log</Btn>} />
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <MiniStat icon={Moon} tone="teal" label="Sleep" value={today ? `${Number(today.sleep_hours).toFixed(1)}h` : '—'} />
              <MiniStat icon={Droplet} tone="mint" label="Hydration" value={today ? `${today.hydration_glasses}` : '—'} />
              <MiniStat icon={Footprints} tone="gold" label="Movement" value={today ? `${today.movement_minutes}m` : '—'} />
            </div>
            <div className="divider" />
            <div className="between small"><span className="muted">Energy</span><span className="f6">{today ? `${today.energy_score}/100` : '—'}</span></div>
            <div style={{ marginTop: 8 }}><Progress v={today?.energy_score || 0} /></div>
            <div className="between small" style={{ marginTop: 12 }}><span className="muted">Mood</span><span className="f6">{today ? `${today.mood_score}/100` : '—'}</span></div>
            <div style={{ marginTop: 8 }}><Progress v={today?.mood_score || 0} gold /></div>
          </Card>
        </div>

        {/* Contributions */}
        <Card>
          <SectionHead eyebrow="Contribution ledger" title="Verified, not claimed" action={<Btn variant="ghost sm" icon={ChevronRight} onClick={() => go('wallet')}>All</Btn>} />
          {contribs.length ? contribs.slice(0, 4).map((c) => (
            <div key={c.id} className="list-row">
              <Chip icon={Award} tone="mint" sm />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small f6">{c.event_type || c.category || 'Contribution'}</div>
                <div className="tiny muted">{c.description || c.impact || '—'} · {fmtShort(c.created_at)}</div>
              </div>
              {c.reward_sats > 0 && <span className="small f7 t-mint">+{Number(c.reward_sats).toLocaleString()}</span>}
            </div>
          )) : <Empty icon={Award} title="No contributions yet" sub="Your verified health actions and rewards will appear here." />}
        </Card>
      </div>

      {/* Right rail */}
      <div className="col gap-4">
        <Card className="lg" style={{ background: 'linear-gradient(170deg,#0E5C57,#0A413D)', color: '#E7F8F3', border: 'none' }}>
          <div className="row gap-3">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.12)', display: 'grid', placeItems: 'center' }}><Bot size={20} color="#9FE7D6" /></div>
            <div><div className="dp f7" style={{ fontSize: 15 }}>LUCA Coach</div><div className="tiny" style={{ color: 'rgba(231,248,243,.7)' }}>Heart-Centered Intelligence</div></div>
          </div>
          <div style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.55, color: 'rgba(231,248,243,.94)' }}>
            {focus.length
              ? <>Welcome back, {user.firstName}. Let's focus on <b>{focus[0].name?.toLowerCase()}</b> today — small steps move your vitality fastest.</>
              : <>Welcome to your sovereign hub, {user.firstName}. Complete your assessment and I'll guide your next best step.</>}
          </div>
          <div className="tiny" style={{ marginTop: 10, color: 'rgba(231,248,243,.65)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <ShieldCheck size={13} /> Suggests only — never spends or shares without your approval.
          </div>
          <div className="divider" style={{ background: 'rgba(255,255,255,.12)' }} />
          <Btn className="block" variant="gold" icon={Send} onClick={() => go('coach')}>Chat with LUCA</Btn>
        </Card>

        <Card>
          <SectionHead eyebrow="Recent rewards" title="LOVE ledger" />
          {(rewards.events || []).length ? rewards.events.slice(0, 6).map((e) => (
            <div key={e.id} className="list-row" style={{ padding: '10px 0' }}>
              <Chip icon={Gift} tone="gold" sm />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small f6">{e.note || e.event_type}</div>
                <div className="tiny muted">{fmtShort(e.created_at)}</div>
              </div>
              <span className="small f7 t-mint">+{e.points}</span>
            </div>
          )) : <Empty icon={Gift} title="No rewards yet" sub="Earn LOVE points by checking in and engaging with care." />}
        </Card>
      </div>

      <DailyCheckinModal user={user} open={checkinOpen} onClose={() => setCheckinOpen(false)} onSaved={reloadDaily} />
    </div>
  );
}
const CURATED_JOURNEYS = [
  { key: 'detox', title: 'Detox & Cleanse Journey', tagline: 'Reset your body’s natural detox pathways with gentle, guided support.', match: ['detox', 'liver', 'gut', 'digest'] },
  { key: 'heavy-metal', title: 'Heavy Metal Release', tagline: 'A careful protocol to reduce toxic load and restore cellular clarity.', match: ['toxin', 'metal', 'fatigue', 'brain fog'] },
  { key: 'menopause', title: 'Menopause Transition', tagline: 'Move through this passage with balance, warmth, and steady energy.', match: ['hormone', 'menopause', 'sleep', 'mood'] },
  { key: 'reset', title: 'Optimal Health Reset', tagline: 'A whole-system reboot for energy, focus, and resilient vitality.', match: ['energy', 'vitality', 'stress'] },
  { key: 'oral', title: 'Smile & Oral Wellness Journey', tagline: 'Whole-body health begins in the mouth — minimally invasive & holistic.', match: ['oral', 'dental', 'smile', 'teeth'] },
  { key: 'thyroid', title: 'Thyroid Balance', tagline: 'Nourish your metabolism and reclaim steady, grounded energy.', match: ['thyroid', 'metabolism', 'weight'] },
  { key: 'sugar', title: 'Sugar Balance Reset', tagline: 'Stabilize energy and cravings with a gentle blood-sugar rhythm.', match: ['sugar', 'blood', 'craving', 'nutrition'] },
  { key: 'mama', title: 'Nurture Mama Journey', tagline: 'Holistic care for the whole arc of motherhood — body, mind, spirit.', match: ['mama', 'pregnan', 'postpartum', 'fertility'] },
];

function pickJourney(focus) {
  const names = (focus || []).map((f) => String(f?.name || f || '').toLowerCase()).join(' ');
  if (names) {
    const hit = CURATED_JOURNEYS.find((j) => j.match.some((m) => names.includes(m)));
    if (hit) return hit;
  }
  // Stable pick for the session if no focus match.
  return CURATED_JOURNEYS[Math.floor(Math.random() * CURATED_JOURNEYS.length)];
}

function LucaRecommends({ recs, loading, go, user, vitality = 0, focus = [] }) {
  if (loading) {
    return (
      <Card>
        <SectionHead eyebrow="Personalized for you" title="LUCA Recommends" />
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <CardSkeleton rows={3} />
          <CardSkeleton rows={3} />
        </div>
      </Card>
    );
  }

  const firstName = user?.firstName || 'friend';

  // ── Card 1: "Your Next Step" (teal) — always resolved to something actionable ──
  let ns = recs?.nextStep;
  if (!ns) {
    if (!vitality) {
      ns = {
        title: 'Begin Your Solaris Journey',
        description: 'Take the Solaris Method assessment to reveal your 360° health map.',
        cta: 'Start assessment', target: 'health',
      };
    } else {
      ns = {
        title: 'Journal Your Day',
        description: 'Capture how you feel right now. 3 minutes, big impact.',
        cta: 'Open journal', target: 'journal',
      };
    }
  }
  const nsTarget = ns.target || (!vitality ? 'health' : 'journal');
  const nsCta = ns.cta || (!vitality ? 'Start assessment' : 'Check in today');

  // ── Card 2: "Curated Journey" (gold) — server value or a smart fallback ──
  const cj = recs?.curatedJourney;
  const fallbackJourney = cj ? null : pickJourney(focus);

  return (
    <Card>
      <SectionHead eyebrow="Personalized for you" title="LUCA Recommends" action={<Pill tone="mint" icon={Sparkles}>LUCA</Pill>} />
      <div className="grid rec-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Card 1 — Next Step */}
        <div className="card flat" style={{ padding: 16, background: 'linear-gradient(165deg,#0E5C57,#0A413D)', color: '#E7F8F3', border: 'none', display: 'flex', flexDirection: 'column' }}>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(159,231,214,.16)', display: 'grid', placeItems: 'center', flex: 'none' }}><Zap size={17} color="#9FE7D6" /></div>
            <div className="tiny" style={{ color: 'rgba(231,248,243,.75)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Your Next Step</div>
          </div>
          <div className="dp f7" style={{ fontSize: 15.5, marginTop: 11 }}>{ns.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(231,248,243,.92)', marginTop: 6, flex: 1 }}>{ns.description}</div>
          {ns.action ? (
            <div className="tiny" style={{ marginTop: 12, color: 'rgba(231,248,243,.72)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <ArrowRight size={13} style={{ marginTop: 2, flex: 'none' }} /><span>{ns.action}</span>
            </div>
          ) : null}
          <button
            onClick={() => go(nsTarget)}
            style={{ marginTop: 13, alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(159,231,214,.35)', background: 'rgba(159,231,214,.14)', color: '#E7F8F3', fontSize: 13, fontWeight: 600, display: 'inline-flex', gap: 6, alignItems: 'center' }}
          >
            {nsCta} <ArrowRight size={14} />
          </button>
        </div>

        {/* Card 2 — Curated Journey */}
        <div className="card flat" style={{ padding: 16, background: 'linear-gradient(165deg,#7A5A1E,#4E3A12)', color: '#FBF3DF', border: 'none', display: 'flex', flexDirection: 'column' }}>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(240,210,140,.18)', display: 'grid', placeItems: 'center', flex: 'none' }}><Compass size={17} color="#F0D28C" /></div>
            <div className="tiny" style={{ color: 'rgba(251,243,223,.78)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Curated Journey for You</div>
          </div>
          <div className="dp f7" style={{ fontSize: 15.5, marginTop: 11 }}>{cj ? cj.title : fallbackJourney.title}</div>
          {cj && (cj.specialty || cj.city) && (
            <div className="tiny" style={{ color: 'rgba(251,243,223,.72)', marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
              {cj.specialty ? <span>{cj.specialty}</span> : null}
              {cj.specialty && cj.city ? <span>·</span> : null}
              {cj.city ? <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}><MapPin size={11} />{cj.city}</span> : null}
            </div>
          )}
          <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(251,243,223,.92)', marginTop: 8, flex: 1 }}>{cj ? cj.reason : fallbackJourney.tagline}</div>
          <button
            onClick={() => go('explore')}
            style={{ marginTop: 13, alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(240,210,140,.35)', background: 'rgba(240,210,140,.14)', color: '#FBF3DF', fontSize: 13, fontWeight: 600, display: 'inline-flex', gap: 6, alignItems: 'center' }}
          >
            Explore <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Card>
  );
}
function MiniStat({ icon: Icon, label, value, tone = 'teal' }) {
  return (
    <div className="card flat" style={{ textAlign: 'center', padding: '14px 8px', background: 'var(--surface-2)' }}>
      <div className={`chip sm ${tone}`} style={{ margin: '0 auto 6px' }}><Icon size={16} /></div>
      <div className="dp f7" style={{ fontSize: 17 }}>{value}</div>
      <div className="tiny muted2">{label}</div>
    </div>
  );
}
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const roleLabel = (r) => ({ patient: 'Member', practitioner: 'Practitioner', admin: 'Administrator' }[r] || 'Member');

/* ---- Sovereignty status card (Slice 6): who am I, who has access, where my
   data lives, which AI touched it last, and how to export/revoke — in plain
   language, with identifiers tucked behind an advanced-details disclosure. ---- */
const BINDING_CHIP_LABEL = { did: 'DID', nostr: 'Identity Key', wallet: 'Wallet', clinic: 'Clinic ID' };

function SovereigntyCard({ onExport, exporting }) {
  const [status, setStatus] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [agent, setAgent] = useState(null);
  const [togglingAgent, setTogglingAgent] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [idCopied, setIdCopied] = useState(false);
  const [endAddrDraft, setEndAddrDraft] = useState('');
  const [savingAddr, setSavingAddr] = useState(false);

  const load = () => {
    api.getSovereigntyStatus()
      .then((s) => setStatus(s || null))
      .catch(() => setStatus(null));
    api.getLucaAgent()
      .then((a) => setAgent(a || null))
      .catch(() => setAgent(null));
    api.getIdentityMe()
      .then((i) => setIdentity(i || null))
      .catch(() => setIdentity(null));
  };
  useEffect(() => { load(); }, []);

  const copySolarisId = async () => {
    if (!identity?.solarisId) return;
    try {
      await navigator.clipboard.writeText(identity.solarisId);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1600);
    } catch { toast.error('Could not copy — you can find the full ID under Advanced details.'); }
  };

  const saveEndAddress = async (value) => {
    if (savingAddr) return;
    setSavingAddr(true);
    try {
      const res = await api.setGpsEndAddress(value);
      setIdentity((i) => (i ? { ...i, gps: res.gps } : i));
      setEndAddrDraft('');
      toast.success(value ? 'End address saved (simulated — no real payments).' : 'Back on the Solaris default end address.');
    } catch (e) {
      toast.error(e.message || 'Could not save that end address.');
    } finally { setSavingAddr(false); }
  };

  const toggleLuca = async () => {
    if (!agent || togglingAgent) return;
    setTogglingAgent(true);
    try {
      const res = await api.setLucaEnabled(!agent.active);
      setAgent((a) => (a ? { ...a, active: res.active } : a));
      toast.success(res.message || (res.active ? 'LUCA is back by your side.' : 'LUCA is switched off.'));
    } catch {
      toast.error('Could not update LUCA right now — please try again.');
    } finally { setTogglingAgent(false); }
  };

  if (!status) return null;

  const revoke = async (id) => {
    setRevoking(id);
    try {
      await api.revokeConsent(id);
      toast.success('Access revoked. Your Passport is yours.');
      load();
    } catch {
      toast.error('Could not revoke right now — please try again.');
    } finally { setRevoking(null); }
  };

  return (
    <Card className="tint" style={{ background: 'linear-gradient(180deg,#FBFEFC,#F4F9F7)' }}>
      <SectionHead eyebrow="Sovereignty" title="Who holds your Passport" action={<Pill tone="gold" icon={ShieldCheck}>You do</Pill>} />
      <div className="small muted" style={{ lineHeight: 1.6, marginBottom: 14 }}>{status.identity.plain}</div>

      {identity && (
        <div
          className="card flat"
          style={{
            padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center',
            flexWrap: 'wrap', gap: 12,
            background: 'linear-gradient(135deg, #0A2B29, #123B36)', color: '#F4F9F7',
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(45,181,132,0.18)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Fingerprint size={18} style={{ color: '#2DB584' }} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div className="tiny" style={{ color: 'rgba(244,249,247,0.65)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10 }}>Your Solaris ID</div>
            <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>{identity.solarisIdShort}</span>
              <button
                onClick={copySolarisId}
                aria-label="Copy full Solaris ID"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#F4F9F7', cursor: 'pointer', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}
              >
                {idCopied ? <Check size={12} style={{ color: '#2DB584' }} /> : <Copy size={12} />}
                {idCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="tiny" style={{ color: 'rgba(244,249,247,0.6)', lineHeight: 1.5, marginTop: 3 }}>
              Permanent and yours. Emails, keys and wallets are replaceable pointers attached to it — full ID under Advanced details.
            </div>
          </div>
          <div className="row gap-1" style={{ flexWrap: 'wrap' }}>
            {(identity.bindings || []).filter((b) => b.status !== 'revoked' && b.type !== 'email').map((b) => (
              <span key={b.type} className="tiny" style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(45,181,132,0.15)', color: '#7FDBB6', border: '1px solid rgba(45,181,132,0.3)' }}>
                {BINDING_CHIP_LABEL[b.type] || b.type} · {b.status === 'active' ? 'linked' : b.status}
              </span>
            ))}
            {(identity.comingSoon || []).map((t) => (
              <span key={t} className="tiny" style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'rgba(244,249,247,0.5)', border: '1px dashed rgba(255,255,255,0.2)' }}>
                {BINDING_CHIP_LABEL[t] || t} · coming soon
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
        <div className="card flat" style={{ padding: 14, background: 'var(--surface-2)' }}>
          <div className="tiny f6 row gap-2" style={{ marginBottom: 8 }}><BadgeCheck size={14} className="t-teal" /> Ways you sign in</div>
          {status.identityMethods.map((m) => (
            <div key={m.method} className="between" style={{ padding: '3px 0' }}>
              <span className="tiny muted">{m.label}</span>
              {m.connected
                ? <span className="tiny t-mint row gap-1"><Check size={12} /> Connected</span>
                : <span className="tiny muted2">Not connected</span>}
            </div>
          ))}
        </div>

        <div className="card flat" style={{ padding: 14, background: 'var(--surface-2)' }}>
          <div className="tiny f6 row gap-2" style={{ marginBottom: 8 }}><Users size={14} className="t-teal" /> Who can see it</div>
          <div className="tiny muted" style={{ lineHeight: 1.55 }}>{status.access.plain}</div>
          {status.access.practitioners.map((p) => (
            <div key={p.id} className="between" style={{ padding: '6px 0' }}>
              <span className="tiny f6">{p.name}</span>
              <button
                className="tiny"
                style={{ background: 'none', border: 'none', color: 'var(--rose, #C0564F)', cursor: 'pointer', textDecoration: 'underline' }}
                disabled={revoking === p.id}
                onClick={() => revoke(p.id)}
              >
                {revoking === p.id ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          ))}
        </div>

        <div className="card flat" style={{ padding: 14, background: 'var(--surface-2)' }}>
          <div className="tiny f6 row gap-2" style={{ marginBottom: 8 }}><Globe size={14} className="t-teal" /> Where it lives</div>
          <div className="tiny muted" style={{ lineHeight: 1.55 }}>{status.storage.plain}</div>
        </div>

        <div className="card flat" style={{ padding: 14, background: 'var(--surface-2)' }}>
          <div className="tiny f6 row gap-2" style={{ marginBottom: 8 }}><Bot size={14} className="t-teal" /> AI & your data</div>
          <div className="tiny muted" style={{ lineHeight: 1.55 }}>{status.ai.plain}</div>
          {status.ai.provider && (
            <div className="tiny muted2" style={{ marginTop: 6 }}>
              Last interaction: {fmtShort(status.ai.at)}
            </div>
          )}
          {agent && (
            <div className="between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line, rgba(10,43,41,0.08))', gap: 10 }}>
              <div>
                <div className="tiny f6">LUCA can act for you</div>
                <div className="tiny muted2" style={{ lineHeight: 1.5 }}>
                  {agent.active
                    ? 'Pause LUCA anytime. Your data, Passport and session stay untouched.'
                    : 'LUCA is paused — you turned it off. Re-enable anytime.'}
                </div>
              </div>
              <div style={{ opacity: togglingAgent ? 0.5 : 1 }}>
                <Toggle on={!!agent.active} onClick={toggleLuca} />
              </div>
            </div>
          )}
        </div>

        <div className="card flat" style={{ padding: 14, background: 'var(--surface-2)' }}>
          <div className="tiny f6 row gap-2" style={{ marginBottom: 8 }}><Zap size={14} className="t-teal" /> Your GPS end address</div>
          <div className="tiny muted" style={{ lineHeight: 1.55 }}>
            In GPS — the Global Prosperous Split — value routes to your <strong>identity</strong>, not a bank account.
            {identity?.gps && !identity.gps.usingSolarisDefault
              ? <> Your share is configured to settle to <strong>your own Lightning address</strong>.</>
              : <> Your share currently settles to the <strong>Solaris default end address</strong>.</>}
          </div>
          <div style={{ marginTop: 8 }}>
            <span className="tiny" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {identity?.gps?.endAddress || STATIC_GPS_POLICY.identity.endAddress.current}
            </span>
          </div>
          {identity ? (
            <>
              <form
                onSubmit={(e) => { e.preventDefault(); if (endAddrDraft.trim()) saveEndAddress(endAddrDraft.trim()); }}
                className="row gap-2"
                style={{ marginTop: 10, flexWrap: 'wrap' }}
              >
                <input
                  type="text"
                  value={endAddrDraft}
                  onChange={(e) => setEndAddrDraft(e.target.value)}
                  placeholder="you@lightning.address"
                  aria-label="Your Lightning address"
                  className="tiny"
                  style={{ flex: 1, minWidth: 140, padding: '7px 10px', borderRadius: 9, border: '1px solid var(--line, rgba(10,43,41,0.14))', background: '#fff', color: '#0A2B29', fontFamily: 'monospace' }}
                />
                <button
                  type="submit"
                  className="tiny f6"
                  disabled={savingAddr || !endAddrDraft.trim()}
                  style={{ padding: '7px 12px', borderRadius: 9, border: 'none', background: '#2DB584', color: '#fff', cursor: savingAddr || !endAddrDraft.trim() ? 'default' : 'pointer', opacity: savingAddr || !endAddrDraft.trim() ? 0.55 : 1 }}
                >
                  {savingAddr ? 'Saving…' : 'Save'}
                </button>
                {identity.gps && !identity.gps.usingSolarisDefault && (
                  <button
                    type="button"
                    className="tiny"
                    disabled={savingAddr}
                    onClick={() => saveEndAddress('')}
                    style={{ background: 'none', border: 'none', color: 'var(--muted, #6b807a)', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Use Solaris default
                  </button>
                )}
              </form>
              <div className="tiny muted2" style={{ marginTop: 6, lineHeight: 1.5 }}>
                Configuration only — this showcase makes no real payments. Wallet connections (NWC, Spark) come later.
              </div>
            </>
          ) : (
            <div className="tiny muted2" style={{ marginTop: 8 }}>Set your own end address — coming soon</div>
          )}
        </div>
      </div>

      <div className="between" style={{ marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="tiny muted2" style={{ lineHeight: 1.5, maxWidth: 520 }}>{status.rights.plain}</div>
        <div className="row gap-2">
          {onExport && (
            <Btn variant="ghost" icon={Download} onClick={onExport} disabled={exporting}>
              {exporting ? 'Preparing…' : 'Export everything'}
            </Btn>
          )}
          <Btn variant="ghost" icon={Eye} onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? 'Hide details' : 'Advanced details'}
          </Btn>
        </div>
      </div>

      {showAdvanced && (
        <div className="card flat" style={{ marginTop: 10, padding: 14, background: 'var(--surface-2)' }}>
          <div className="tiny muted2" style={{ marginBottom: 6 }}>Technical identifiers — you never need these day to day.</div>
          <div className="tiny" style={{ fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.7 }}>
            {identity?.solarisId && <div>Solaris ID: {identity.solarisId}</div>}
            <div>Account ID: {status.advanced.subjectId}</div>
            {status.advanced.did && <div>DID: {status.advanced.did}</div>}
            {status.advanced.nostrNpub && <div>Nostr: {status.advanced.nostrNpub}</div>}
            {status.ai.provider && <div>Last AI provider: {status.ai.provider} · compute: {status.ai.computeTarget}{status.ai.degraded ? ' · degraded fallback' : ''}</div>}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ============================== PATIENT — HEALTH PASSPORT ============================== */
const SYS_SHORT = { bioelectrical: 'Bio', hydration: 'Hydr', circadian: 'Circ', microbiome: 'Micro', respiratory: 'Resp', neurological: 'Neuro', cardiovascular: 'Cardio', nutritional: 'Nutri' };
const ASPECT_ICONS = { physical: Activity, mental: Brain, emotional: Heart, spiritual: Sparkles };

/* Curated guided-journey tasks — derived server-side from the member's journey,
   today's check-in, focus areas, audio library and bookings. */
const TASK_ICONS = { start_checkin: Plus, play_audio: Headphones, open_listing: Stethoscope, navigate: Compass };
function GuidedJourneyTasks({ go, onOpenCheckin }) {
  const { setPendingProviderId } = useApp();
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.getJourneyTasks().then((d) => setData(d || null)).catch(() => setData(null));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('solaris:checkin', load);
    return () => window.removeEventListener('solaris:checkin', load);
  }, [load]);

  if (!data || !data.tasks?.length) return null;
  const done = data.tasks.filter((t) => t.done).length;

  const runTask = (t) => {
    const type = t.action?.type;
    const target = t.action?.target;
    switch (type) {
      case 'start_checkin': onOpenCheckin(); break;
      case 'play_audio': go && go('media'); break;
      case 'open_listing':
        if (target && setPendingProviderId) setPendingProviderId(String(target));
        go && go('explore');
        break;
      case 'navigate': go && go(target || 'health'); break;
      default: break;
    }
  };

  const TASK_CTA = { start_checkin: 'Check in', play_audio: 'Play', open_listing: 'View', navigate: 'Go' };

  return (
    <Card className="tint" style={{ background: 'linear-gradient(180deg,#FBFEFC,#F3FAF6)' }}>
      <SectionHead
        eyebrow="Guided journey"
        title="Today's guided tasks"
        action={<Pill tone={done === data.tasks.length ? 'gold' : 'mint'} icon={Sparkles}>{done}/{data.tasks.length} done</Pill>}
      />
      {data.journeyType && (
        <div className="tiny muted" style={{ marginTop: -6, marginBottom: 10 }}>
          Curated for your {String(data.journeyType).replace(/_/g, ' ')} journey.
        </div>
      )}
      {data.tasks.map((t) => {
        const Icon = TASK_ICONS[t.action?.type] || Compass;
        return (
          <div key={t.id} className="list-row" style={{ padding: '10px 0', opacity: t.done ? 0.72 : 1 }}>
            {t.done
              ? <CheckCircle2 size={20} color="#2DB584" strokeWidth={2.2} style={{ flex: 'none' }} />
              : <span style={{ width: 20, height: 20, borderRadius: 999, border: '2px solid #C9DAD4', flex: 'none' }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small f6" style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</div>
              {t.detail && <div className="tiny muted">{t.detail}</div>}
            </div>
            {!t.done && (
              <button className="checkin-cta" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => runTask(t)}>
                <Icon size={13} strokeWidth={2.4} /> {TASK_CTA[t.action?.type] || 'Go'}
              </button>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function HealthPage({ go }) {
  const { user, startRetake } = useApp();
  const [data, setData] = useState(null);
  const [docs, setDocs] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [completeness, setCompleteness] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getPassportCompleteness()
      .then((c) => { if (alive) setCompleteness(c || null); })
      .catch(() => { if (alive) setCompleteness(null); });
    return () => { alive = false; };
  }, []);

  const reloadCheckins = async () => {
    const ci = await api.getCheckins().catch(() => ({ checkins: [] }));
    setCheckins(ci?.checkins || []);
    // Let the guided-journey task list know a check-in happened.
    window.dispatchEvent(new CustomEvent('solaris:checkin'));
  };

  // Agentic entry point: LUCA chips (and journey CTAs) can open the check-in modal.
  useEffect(() => {
    const open = () => setCheckinOpen(true);
    window.addEventListener('solaris:open-checkin', open);
    return () => window.removeEventListener('solaris:open-checkin', open);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [l, d, ci, h] = await Promise.all([
          api.getLatestAssessment().catch(() => null),
          api.getDocuments().catch(() => ({ documents: [] })),
          api.getCheckins().catch(() => ({ checkins: [] })),
          api.getAssessmentHistory().catch(() => ({ history: [] })),
        ]);
        if (!alive) return;
        setData(l); setDocs(d?.documents || []); setCheckins(ci?.checkins || []);
        setHistory(h?.history || h?.assessments || []);
      } finally { alive && setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const exportVault = async () => {
    setExporting(true); setExportMsg('');
    try {
      const blob = await api.downloadVault();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'luca-vault.zip'; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setExportMsg('Your sovereign vault was downloaded.');
    } catch (e) {
      setExportMsg(e.message || 'Export failed.');
    } finally { setExporting(false); }
  };

  if (loading) return <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}><CardSkeleton rows={5} /><CardSkeleton rows={5} /></div>;

  const resp = data?.response;
  const systems = data?.systems || [];
  const aspects = data?.aspects || [];
  const radar = systems.map((s) => ({ system: SYS_SHORT[s.system_key] || s.system_name, score: s.score }));

  return (
    <div className="col gap-4">
      {completeness && (
        <Card className="tint" style={{ background: 'linear-gradient(180deg,#FBFEFC,#F5FAF4)' }}>
          <div className="row" style={{ gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 132, height: 132, flex: 'none' }}>
              <Ring value={completeness.score} max={100} size={132} />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <div>
                  <div className="dp f7" style={{ fontSize: 30 }}>{completeness.score}</div>
                  <div className="tiny muted2">Passport / 100</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
                <div className="card-title">Your Sovereign Passport</div>
                {completeness.tier === 'sovereign' && <Pill tone="gold" icon={Sparkles}>Sovereign Member ✦</Pill>}
                {completeness.tier === 'growing' && <Pill tone="mint" icon={TrendingUp}>Growing</Pill>}
                {completeness.tier === 'starting' && <Pill tone="teal" icon={Sprout}>Just beginning</Pill>}
              </div>
              {completeness.nextStep ? (
                <>
                  <div className="small muted" style={{ marginTop: 8, lineHeight: 1.55 }}>
                    <span className="f6" style={{ color: 'var(--ink)' }}>Next:</span> {completeness.nextStep.hint}
                  </div>
                  <div className="row" style={{ marginTop: 14 }}>
                    <Btn
                      variant="primary"
                      icon={completeness.nextStep.key === 'intake' ? Activity : ChevronRight}
                      onClick={() => {
                        // The intake step must launch the Solaris Method assessment directly —
                        // navigating to the 'health' tab alone does nothing (we're already here).
                        if (completeness.nextStep.key === 'intake') startRetake?.();
                        else go && go(completeness.nextStep.tab);
                      }}
                    >
                      {completeness.nextStep.label}
                    </Btn>
                  </div>
                </>
              ) : (
                <div className="small muted" style={{ marginTop: 8, lineHeight: 1.55 }}>
                  Every part of your Passport is complete — beautifully done. You're a Sovereign Member. ✦
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
      <Card className="between" style={{ background: 'linear-gradient(180deg,#FBFEFC,#F4FAF7)' }}>
        <div className="row gap-3">
          <Chip icon={ShieldCheck} tone="gold" />
          <div>
            <div className="f6">Data sovereignty</div>
            <div className="small muted">FHIR-aligned and fully portable. Export the whole vault as a ZIP, anytime.</div>
            {exportMsg && <div className="tiny t-mint" style={{ marginTop: 4 }}>{exportMsg}</div>}
          </div>
        </div>
        <Btn variant="primary" icon={Download} onClick={exportVault} disabled={exporting}>{exporting ? 'Preparing…' : 'Export My Vault'}</Btn>
      </Card>

      <SovereigntyCard onExport={exportVault} exporting={exporting} />

      <GuidedJourneyTasks go={go} onOpenCheckin={() => setCheckinOpen(true)} />

      {!resp ? (
        <Card><Empty icon={HeartPulse} title="No assessment on file" sub="Complete the Solaris Method assessment to populate your 360° health passport." /></Card>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Card>
            <SectionHead eyebrow="Vitality" title="360° score" action={<Pill tone="mint" icon={TrendingUp}>{vitalityBand(resp.vitality_score)}</Pill>} />
            <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 140, height: 140, flex: 'none' }}>
                <Ring value={resp.vitality_score} max={100} size={140} />
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <div className="dp f7" style={{ fontSize: 32 }}>{resp.vitality_score}</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                {aspects.map((a) => {
                  const Icon = ASPECT_ICONS[a.aspect_key] || Sparkles;
                  return (
                    <div key={a.aspect_key} className="between" style={{ marginBottom: 12 }}>
                      <span className="small row gap-2"><Icon size={14} className="t-teal" /> {a.aspect_name}</span>
                      <span className="small f6">{a.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card>
            <SectionHead eyebrow="8 body systems" title="System balance" />
            <div style={{ height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ReRadar data={radar} outerRadius="74%">
                  <PolarGrid stroke="#E1ECE8" />
                  <PolarAngleAxis dataKey="system" tick={{ fontSize: 10, fill: '#5C716E' }} />
                  <Radar dataKey="score" stroke="#2FBE9F" fill="#2FBE9F" fillOpacity={0.28} strokeWidth={2} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E1ECE8', fontSize: 12 }} />
                </ReRadar>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card style={{ gridColumn: '1 / -1' }}>
            <SectionHead eyebrow="Body systems" title="Detailed breakdown" />
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
              {systems.map((s) => (
                <div key={s.system_key} className="between" style={{ padding: '6px 0' }}>
                  <span className="small row gap-2"><span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--mint)' }} />{s.system_name}</span>
                  <span className="row gap-2"><Pill tone={bandTone(s.severity_band)}>{s.severity_band}</Pill><span className="small f7" style={{ width: 24, textAlign: 'right' }}>{s.score}</span></span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card>
          <SectionHead eyebrow="Records" title="Labs, imaging & photos" action={<Pill tone="gray">{docs.length}</Pill>} />
          {docs.length ? docs.slice(0, 8).map((d) => (
            <div key={d.id} className="list-row" style={{ padding: '10px 0' }}>
              <Chip icon={FileText} tone="teal" sm />
              <div style={{ flex: 1, minWidth: 0 }}><div className="small f6">{d.file_name}</div><div className="tiny muted">{d.document_type}</div></div>
              <span className="tiny muted2">{fmtShort(d.created_at)}</span>
            </div>
          )) : <Empty icon={FileText} title="No documents yet" sub="Upload labs, imaging, and photos to keep everything in one sovereign place." />}
        </Card>
        <Card>
          <div className="between" style={{ marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow">Progress</div>
              <div className="card-title" style={{ marginTop: 3 }}>Recent check-ins</div>
            </div>
            <button className="checkin-cta" onClick={() => setCheckinOpen(true)}><Plus size={16} strokeWidth={2.4} /> Check in</button>
          </div>
          <div style={{ marginBottom: 14 }}><WeekStrip /></div>
          {checkins.length ? checkins.slice(0, 8).map((c) => (
            <div key={c.id} className="list-row" style={{ padding: '10px 0' }}>
              <Chip icon={Calendar} tone="mint" sm />
              <div style={{ flex: 1 }}><div className="small f6">{fmtShort(c.checkin_date)}</div><div className="tiny muted">Energy {c.energy_score} · Mood {c.mood_score}{c.hydration_glasses != null ? ` · Water ${c.hydration_glasses}` : ''}{c.nutrition_score != null ? ` · Meals ${c.nutrition_score}/10` : ''}</div></div>
              <span className="tiny muted2">{c.sleep_hours != null ? `${Number(c.sleep_hours).toFixed(1)}h` : '—'}</span>
            </div>
          )) : <Empty icon={Calendar} title="No check-ins yet" sub="Daily check-ins help LUCA track your vitality over time." />}
        </Card>
      </div>

      {user && <DailyCheckinModal user={user} open={checkinOpen} onClose={() => setCheckinOpen(false)} onSaved={reloadCheckins} />}
    </div>
  );
}
const vitalityBand = (v) => (v >= 80 ? 'Thriving' : v >= 60 ? 'Balanced' : v >= 40 ? 'Attention' : 'Priority');


/* ============================== PATIENT — LUCA COACH ============================== */
const COACH_SUGGESTIONS = [
  'Explain my vitality score',
  'What should I focus on this week?',
  'Help me build a sleep routine',
  'How do I improve my energy?',
];
const msgTime = (d) => (d ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');

// Rotating palette for follow-up suggestion chips (bg / text)
const CHIP_BG = ['#E7F5F1', '#FBF3DC', '#E7F1F7'];
const CHIP_TEXT = ['#1B5E52', '#7A5B0B', '#1A4A5E'];
const CHIP_BORDER = ['#B7E4D8', '#EDD79B', '#B7D7E7'];

/* Colored follow-up chips rendered under an assistant bubble.
   Suggestions are typed objects: { label, action, target }. */
function LucaChips({ suggestions, onAction, disabled }) {
  if (!suggestions || !suggestions.length) return null;
  return (
    <div className="luca-chips">
      {suggestions.map((s, i) => {
        const label = typeof s === 'string' ? s : s?.label;
        if (!label) return null;
        return (
          <button
            key={label + i}
            className="luca-chip"
            disabled={disabled}
            onClick={() => onAction(typeof s === 'string' ? { label: s, action: 'prefill_chat', target: null } : s)}
            style={{ background: CHIP_BG[i % 3], color: CHIP_TEXT[i % 3], borderColor: CHIP_BORDER[i % 3] }}
          >
            <Sparkles size={12} strokeWidth={2.4} />{label}
          </button>
        );
      })}
    </div>
  );
}

/* Map a typed LUCA suggestion to an in-app effect. */
function executeChipAction(suggestion, { go, setInput, send, playAudio, startRetake, setPendingProviderId, setPendingCurate }) {
  const s = typeof suggestion === 'string' ? { label: suggestion, action: 'prefill_chat', target: null } : (suggestion || {});
  const { action, target, label } = s;
  switch (action) {
    case 'navigate': go(target || 'dashboard'); break;
    case 'start_checkin':
      // Land on the Health Passport and open the daily check-in modal.
      go('health');
      setTimeout(() => window.dispatchEvent(new CustomEvent('solaris:open-checkin')), 300);
      break;
    case 'start_assessment':
    case 'open_intake':
      // Launch the Solaris Method assessment directly when possible.
      if (startRetake) startRetake(); else go('health');
      break;
    case 'open_listing':
      // Deep-link to the exact practitioner profile in the marketplace.
      if (target && setPendingProviderId) setPendingProviderId(String(target));
      go('explore');
      break;
    case 'play_audio': playAudio ? playAudio(go) : go('media'); break;
    case 'curate':
      // Trigger "Curate for me" on the marketplace on arrival.
      setPendingCurate && setPendingCurate(true);
      go('explore');
      break;
    case 'prefill_chat': setInput(label || ''); break;
    default: send(label || ''); break;
  }
}

/* LUCA avatar — teal gradient orb with a glowing ring */
const LucaAvatar = ({ size = 'md' }) => (
  <div className={`luca-avatar ${size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : ''}`}>
    <Bot size={size === 'lg' ? 34 : size === 'sm' ? 16 : 22} color="#DAF3EC" strokeWidth={2} />
  </div>
);

/* ============================ INTELLIGENCE (spec A3) ============================
 * The honest window onto the mind working for the member. Three panes:
 *   Natural    — what the member knows / is, on shelves (source·level·date).
 *   Artificial — what LUCA can actually see now (real sources + counts), the
 *                never-list, the model + compute of the last call, the rules
 *                firing this turn, recent actions, and source toggles the member
 *                controls. No raw PHI ever — counts / labels / names only.
 *   Enhanced   — hedged, sourced insight cards. Every card shows source·date·level.
 */
const SHELF_ORDER = ['Principles', 'Canon', 'Log', 'Decisions', 'Evolution', 'Inventory', 'Open questions'];
const SHELF_HINT = {
  Principles: 'What matters most to you right now',
  Canon: 'Your foundational, carried across every practitioner',
  Log: 'What you’ve recorded over time',
  Decisions: 'The care choices you’ve made',
  Evolution: 'How you’re growing',
  Inventory: 'Documents & evidence you hold',
  'Open questions': 'What would deepen the picture',
};

function SourceRow({ s, onToggle, busy }) {
  const on = s.included;
  return (
    <div className="between" style={{ gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line,#eef3f1)' }}>
      <div style={{ minWidth: 0 }}>
        <div className="small" style={{ color: 'var(--ink)', fontWeight: 600 }}>{s.label}</div>
        <div className="tiny muted">{s.count} record{s.count === 1 ? '' : 's'}{s.included ? '' : ' · switched off'}</div>
      </div>
      {s.excludable ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(s.key, on)}
          aria-pressed={on}
          title={on ? 'LUCA can read this — tap to switch off' : 'Switched off — tap to let LUCA read it again'}
          style={{
            flex: 'none', width: 42, height: 24, borderRadius: 999, border: 'none', cursor: busy ? 'default' : 'pointer',
            background: on ? '#2DB584' : '#CBD5D1', position: 'relative', transition: 'background .18s ease', opacity: busy ? 0.6 : 1,
          }}>
          <span style={{
            position: 'absolute', top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: '50%',
            background: '#fff', transition: 'left .18s ease', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
          }} />
        </button>
      ) : (
        <span className="tiny" style={{ flex: 'none', color: '#6b807a', background: '#EDEFF2', padding: '2px 8px', borderRadius: 999 }}>always on</span>
      )}
    </div>
  );
}

function IntelligencePage({ user, go }) {
  const [data, setData] = useState(undefined);
  const [busyKey, setBusyKey] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api.getIntelligenceContext()
      .then((r) => setData(r))
      .catch(() => { setErr('Could not load your Intelligence view just now.'); setData(null); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (key, currentlyIncluded) => {
    setBusyKey(key);
    try {
      // currentlyIncluded=true means the member is switching it OFF (excluded=true).
      await api.setIntelligenceExclusion(key, currentlyIncluded);
      // Optimistic refresh so the Artificial pane reflects the new reality.
      await new Promise((res) => setTimeout(res, 120));
      load();
    } catch {
      setErr('Could not update that setting. Please try again.');
    } finally {
      setBusyKey('');
    }
  };

  if (data === undefined) return <div style={{ maxWidth: 1080, margin: '0 auto' }}><CardSkeleton rows={5} /></div>;
  if (data === null) return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <Card><Empty icon={Brain} title="Intelligence" sub={err || 'Nothing to show yet — as you use your Passport, this view fills in.'} /></Card>
    </div>
  );

  const { natural = [], artificial = {}, enhanced = [] } = data;
  const shelves = SHELF_ORDER
    .map((name) => ({ name, items: natural.filter((n) => n.shelf === name) }))
    .filter((g) => g.items.length);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      {err && <div className="small" style={{ color: '#B4462E', marginBottom: 10 }}>{err}</div>}

      {/* Two equal panes: Natural + Artificial */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>

        {/* ---------------- NATURAL ---------------- */}
        <Card>
          <SectionHead eyebrow="Natural" title="What you know & are"
            action={<Pill tone="mint" icon={Leaf}>Yours</Pill>} />
          {!shelves.length ? (
            <Empty icon={Leaf} title="Your shelves are waiting"
              sub="Complete your intake, log a check-in, or add a note — everything you record appears here, on your own shelves." />
          ) : (
            <div className="col" style={{ gap: 16 }}>
              {shelves.map((g) => (
                <div key={g.name}>
                  <div className="tiny f6" style={{ letterSpacing: '.08em', textTransform: 'uppercase', color: '#0A2B29', marginBottom: 2 }}>{g.name}</div>
                  <div className="tiny muted" style={{ marginBottom: 6 }}>{SHELF_HINT[g.name]}</div>
                  {g.items.map((it, i) => (
                    <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--line,#eef3f1)' }}>
                      <div className="between" style={{ gap: 8 }}>
                        <span className="small" style={{ color: 'var(--ink)', fontWeight: 600 }}>{it.title}</span>
                        {it.level != null && <ProvenanceBadge level={it.level} />}
                      </div>
                      <div className="tiny muted" style={{ marginTop: 2 }}>{it.detail}</div>
                      <div className="tiny" style={{ marginTop: 3, color: '#8AA09C' }}>
                        {it.source ? `source: ${it.source}` : ''}{it.observedAt ? ` · ${fmtShort(it.observedAt)}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ---------------- ARTIFICIAL ---------------- */}
        <Card>
          <SectionHead eyebrow="Artificial" title="What LUCA can see now"
            action={<Pill tone="gray" icon={Eye}>Live</Pill>} />
          <div className="tiny muted" style={{ marginBottom: 10 }}>
            Exactly the sources LUCA reads on your behalf this moment — counts only, never the contents. Switch any off and LUCA stops reading it on your next message.
          </div>

          <div className="col" style={{ gap: 0 }}>
            {(artificial.sources || []).map((s) => (
              <SourceRow key={s.key} s={s} onToggle={toggle} busy={busyKey === s.key} />
            ))}
          </div>

          {/* Last real AI call */}
          {artificial.lastCall && (
            <div style={{ marginTop: 14, padding: 11, borderRadius: 10, background: '#F4F8F6' }}>
              <div className="tiny f6" style={{ letterSpacing: '.08em', textTransform: 'uppercase', color: '#0A2B29', marginBottom: 4 }}>Last request</div>
              <div className="tiny" style={{ color: '#59636E' }}>
                model <b style={{ color: '#0A2B29' }}>{artificial.lastCall.model}</b> · {artificial.lastCall.computeTarget}
                {artificial.lastCall.latencyMs != null ? ` · ${artificial.lastCall.latencyMs}ms` : ''}
                {artificial.lastCall.degraded ? ' · degraded' : ''}
                {artificial.lastCall.at ? ` · ${fmtShort(artificial.lastCall.at)}` : ''}
              </div>
            </div>
          )}

          {/* Firing rules this turn */}
          {(artificial.firingRules || []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="tiny f6" style={{ letterSpacing: '.08em', textTransform: 'uppercase', color: '#0A2B29', marginBottom: 6 }}>Rules firing now</div>
              {artificial.firingRules.map((r) => (
                <div key={r.id} className="tiny" style={{ padding: '4px 0', color: '#59636E' }}>
                  <b style={{ color: '#0A2B29' }}>{r.label}</b> — {r.because}
                </div>
              ))}
            </div>
          )}

          {/* Recent actions */}
          {(artificial.recentActions || []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="tiny f6" style={{ letterSpacing: '.08em', textTransform: 'uppercase', color: '#0A2B29', marginBottom: 6 }}>Recent actions</div>
              {artificial.recentActions.slice(0, 5).map((a, i) => (
                <div key={i} className="tiny muted" style={{ padding: '3px 0' }}>
                  {a.event} · {a.computeTarget}{a.degraded ? ' · degraded' : ''} · {fmtShort(a.at)}
                </div>
              ))}
            </div>
          )}

          {/* Never-list */}
          <div style={{ marginTop: 14, padding: 11, borderRadius: 10, border: '1px solid #F0DAD2', background: '#FBF3F0' }}>
            <div className="tiny f6" style={{ letterSpacing: '.08em', textTransform: 'uppercase', color: '#8A3E28', marginBottom: 6 }}>LUCA can never see</div>
            {(artificial.neverList || []).map((n, i) => (
              <div key={i} className="tiny" style={{ padding: '3px 0', color: '#8A5347' }}>• {n}</div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- ENHANCED (wide) ---------------- */}
      <div style={{ marginTop: 16 }}>
        <Card>
          <SectionHead eyebrow="Enhanced" title="Insight LUCA draws"
            action={<Pill tone="gold" icon={Sparkles}>Hedged & sourced</Pill>} />
          <div className="tiny muted" style={{ marginBottom: 12 }}>
            Observations, never diagnoses. Every card shows where it came from — source, date, and provenance level.
          </div>
          {!enhanced.length ? (
            <Empty icon={Sparkles} title="Insight grows with you"
              sub="As you log check-ins and add data, LUCA surfaces timelines, gentle patterns, open questions, and suggested next steps here." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 14 }}>
              {enhanced.map((card, ci) => (
                <div key={ci} style={{ padding: 13, borderRadius: 12, border: '1px solid var(--line,#eef3f1)', background: '#fff' }}>
                  <div className="tiny f6" style={{ letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B7FD7', marginBottom: 8 }}>
                    {card.type === 'timeline' ? 'Timeline' : card.type === 'pattern' ? 'Pattern' : card.type === 'open_question' ? 'Open questions' : 'Suggestions'}
                  </div>
                  <div className="small" style={{ color: '#0A2B29', fontWeight: 700, marginBottom: 8 }}>{card.title}</div>

                  {card.type === 'timeline' && (card.items || []).map((it, i) => (
                    <div key={i} className="between" style={{ gap: 8, padding: '5px 0', borderBottom: '1px solid var(--line,#eef3f1)' }}>
                      <span className="tiny" style={{ color: 'var(--ink)' }}>{it.label}</span>
                      <span className="tiny muted" style={{ flex: 'none' }}>{fmtShort(it.at)}{it.level != null ? ` · L${it.level}` : ''}</span>
                    </div>
                  ))}

                  {card.type === 'pattern' && (
                    <>
                      <div className="small" style={{ color: '#59636E', lineHeight: 1.5 }}>{card.body}</div>
                      <div className="tiny" style={{ marginTop: 8, color: '#8AA09C' }}>
                        source: {card.source}{card.observedAt ? ` · ${fmtShort(card.observedAt)}` : ''}{card.level != null ? ` · L${card.level}` : ''}
                      </div>
                    </>
                  )}

                  {card.type === 'open_question' && (card.items || []).map((it, i) => (
                    <div key={i} style={{ padding: '5px 0' }}>
                      <div className="tiny" style={{ color: '#59636E' }}>• {it.text}</div>
                      <div className="tiny" style={{ color: '#8AA09C', marginTop: 1 }}>source: {it.source}{it.level != null ? ` · L${it.level}` : ''}</div>
                    </div>
                  ))}

                  {card.type === 'suggestion' && (card.items || []).map((it, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--line,#eef3f1)' }}>
                      <div className="between" style={{ gap: 8 }}>
                        <span className="small" style={{ color: 'var(--ink)', fontWeight: 600 }}>{it.label}</span>
                        <Btn variant="ghost sm" onClick={() => runSuggestionAction(it, go)}>Go</Btn>
                      </div>
                      <div className="tiny muted" style={{ marginTop: 2 }}>{it.because}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* Map an Enhanced suggestion's typed action (A1 §5) to a navigation. */
function runSuggestionAction(sug, go) {
  if (!go) return;
  switch (sug.action) {
    case 'start_checkin': go('health'); break;
    case 'start_assessment': go('health'); break;
    case 'play_audio': go('media'); break;
    case 'open_listing': go('explore'); break;
    case 'curate': go('explore'); break;
    case 'navigate': go(sug.target || 'dashboard'); break;
    default: go('coach');
  }
}

function CoachPage({ user, go }) {
  const { lucaMessages: messages, setLucaMessages: setMessages, lucaLoaded, loadLucaHistory, startRetake, setPendingProviderId, setPendingCurate } = useApp();
  const { playFromLibrary } = useAudio();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [latest, setLatest] = useState(null);
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem('luca_voice_enabled') === 'true'; } catch { return false; }
  });
  const [ttsBusy, setTtsBusy] = useState(null);   // index currently being fetched/played
  const [ttsFailed, setTtsFailed] = useState(() => new Set()); // indices where TTS is unavailable — hide button
  const endRef = useRef(null);
  const audioRef = useRef(null);
  const autoPlayedRef = useRef(-1);
  const loading = !lucaLoaded;

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* noop */ }
      audioRef.current = null;
    }
  }, []);

  const playTts = useCallback(async (idx, text) => {
    if (!text) return;
    stopAudio();
    setTtsBusy(idx);
    try {
      const blob = await api.ttsSpeak(text);
      if (!blob) {
        // Graceful fallback — voice unavailable in this environment. Hide silently.
        setTtsFailed((s) => new Set(s).add(idx));
        return;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); if (audioRef.current === audio) audioRef.current = null; };
      audio.onerror = () => { URL.revokeObjectURL(url); };
      await audio.play().catch(() => { /* autoplay policy — ignore */ });
    } catch {
      setTtsFailed((s) => new Set(s).add(idx));
    } finally {
      setTtsBusy((b) => (b === idx ? null : b));
    }
  }, [stopAudio]);

  const toggleVoice = useCallback(() => {
    setVoiceOn((v) => {
      const next = !v;
      try { localStorage.setItem('luca_voice_enabled', String(next)); } catch { /* noop */ }
      if (!next) stopAudio();
      return next;
    });
  }, [stopAudio]);

  useEffect(() => {
    let alive = true;
    loadLucaHistory();
    (async () => {
      const l = await api.getLatestAssessment().catch(() => null);
      if (alive) setLatest(l);
    })();
    return () => { alive = false; stopAudio(); };
  }, [loadLucaHistory, stopAudio]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  // Auto-play the newest assistant message when voice is enabled.
  useEffect(() => {
    if (!voiceOn || sending || !messages.length) return;
    const idx = messages.length - 1;
    const last = messages[idx];
    if (last?.role !== 'assistant') return;
    if (autoPlayedRef.current === idx) return;
    if (ttsFailed.has(idx)) return;
    autoPlayedRef.current = idx;
    playTts(idx, last.content);
  }, [messages, voiceOn, sending, playTts, ttsFailed]);

  useEffect(() => {
    api.getLucaAgent().then((a) => setPaused(a ? !a.active : false)).catch(() => { /* best-effort */ });
  }, []);

  const reenableLuca = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      const res = await api.setLucaEnabled(true);
      setPaused(false);
      toast.success(res.message || 'LUCA is back by your side.');
    } catch {
      toast.error('Could not re-enable LUCA right now — please try again.');
    } finally { setResuming(false); }
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await api.sendLucaMessage(content);
      setDegraded(!!res?.degraded);
      setMessages((m) => [...m, { role: 'assistant', content: res?.reply || '…', model: res?.model, suggestions: res?.suggestions || [], created_at: new Date().toISOString() }]);
    } catch (e) {
      if (e?.agentDisabled) {
        setPaused(true);
        setMessages((m) => [...m, { role: 'assistant', content: 'LUCA is paused — you turned it off. Re-enable anytime.', created_at: new Date().toISOString() }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: 'LUCA is taking a moment — try again shortly.', created_at: new Date().toISOString() }]);
      }
    } finally { setSending(false); }
  };

  const vitality = latest?.response?.vitality_score ?? 0;
  const focus = latest?.response?.top_focus_areas_json || [];
  const firstName = user.firstName || 'friend';

  return (
    <div className="coach-layout">
      {/* Chat area */}
      <div className="coach-shell">
        <div className="coach-head">
          <LucaAvatar />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <span className="dp" style={{ fontSize: 17, fontWeight: 700, color: 'var(--gold-ink)' }}>LUCA</span>
              {paused
                ? <Pill tone="gold" icon={Bot}>Paused</Pill>
                : degraded
                  ? <Pill tone="gold" icon={Clock}>Offline mode</Pill>
                  : <Pill tone="mint" icon={Bot}>Online</Pill>}
            </div>
            <div className="tiny muted" style={{ marginTop: 1 }}>Heart-Centered Intelligence</div>
          </div>
          <button
            className={`coach-voice ${voiceOn ? 'on' : ''}`}
            onClick={toggleVoice}
            title={voiceOn ? 'Voice on — LUCA speaks replies' : 'Voice off — tap to let LUCA speak'}
            aria-pressed={voiceOn}
          >
            {voiceOn ? <Volume2 size={16} strokeWidth={2.2} /> : <VolumeX size={16} strokeWidth={2.2} />}
            <span>{voiceOn ? 'Voice on' : 'Voice off'}</span>
          </button>
        </div>

        <div className="coach-body">
          {loading ? (
            <><Skel h={44} w="58%" /><Skel h={44} w="70%" style={{ alignSelf: 'flex-end' }} /><Skel h={44} w="52%" /></>
          ) : messages.length === 0 ? (
            <div className="coach-empty">
              <LucaAvatar size="lg" />
              <div className="dp f7" style={{ fontSize: 18, color: 'var(--ink)', textAlign: 'center' }}>How can I support you today, {firstName}?</div>
              <div className="small muted" style={{ maxWidth: 360, textAlign: 'center' }}>I guide and educate — never diagnose. Ask about your results, daily habits, or finding the right care.</div>
              <div className="coach-suggestions">
                {COACH_SUGGESTIONS.map((s) => (
                  <button key={s} className="suggest-chip" onClick={() => send(s)} disabled={sending}>{s}</button>
                ))}
              </div>
            </div>
          ) : messages.map((m, i) => {
            const isUser = m.role === 'user';
            return (
              <div key={i} className={`msg-row ${isUser ? 'user' : 'ai'}`}>
                {isUser
                  ? <Avatar name={user.fullName} size={30} />
                  : <LucaAvatar size="sm" />}
                <div style={{ minWidth: 0, maxWidth: '82%' }}>
                  <div className={`msg-bubble ${isUser ? 'user' : 'ai'}`}>{m.content}</div>
                  {!isUser && (
                    <span style={{ fontSize: '10px', color: 'var(--muted-2)', display: 'block', marginTop: '4px' }}>
                      AI · Not medical advice
                    </span>
                  )}
                  <div className={`msg-meta ${isUser ? '' : 'ai-meta'}`}>
                    {m.created_at && <span className={`msg-time ${isUser ? '' : 'ai-time'}`}>{msgTime(m.created_at)}</span>}
                    {!isUser && m.content && !ttsFailed.has(i) && (
                      <button
                        className={`msg-speak ${ttsBusy === i ? 'busy' : ''}`}
                        onClick={() => playTts(i, m.content)}
                        disabled={ttsBusy === i}
                        title="Hear this with LUCA's voice"
                        aria-label="Play message audio"
                      >
                        <Volume2 size={13} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                  {!isUser && i === messages.length - 1 && !sending && (
                    <LucaChips suggestions={m.suggestions} onAction={(s) => executeChipAction(s, { go, setInput, send, playAudio: playFromLibrary, startRetake, setPendingProviderId, setPendingCurate })} disabled={sending} />
                  )}
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="msg-row ai">
              <LucaAvatar size="sm" />
              <div className="msg-bubble ai"><span className="dot-typing"><i /><i /><i /></span></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="coach-footer">
          {paused ? (
            <div className="between" style={{ gap: 12, flexWrap: 'wrap', padding: '4px 2px' }}>
              <div className="small muted" style={{ lineHeight: 1.5 }}>
                LUCA is paused — you turned it off. Your data, Passport and session are untouched.
              </div>
              <Btn variant="primary" icon={Bot} onClick={reenableLuca} disabled={resuming}>
                {resuming ? 'Re-enabling…' : 'Re-enable LUCA'}
              </Btn>
            </div>
          ) : (
            <div className="coach-input-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Ask LUCA anything…"
              />
              <Btn variant="primary" icon={Send} onClick={() => send()} disabled={sending || !input.trim()}>Send</Btn>
            </div>
          )}
          <div className="coach-disclaimer">LUCA guides and educates — never diagnoses or prescribes. Pre-production preview · not for emergencies — if this is urgent, contact local emergency services.</div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="col gap-4">
        <Card className="lg" style={{ background: 'linear-gradient(170deg,#0E5C57,#0A413D)', color: '#E7F8F3', border: 'none' }}>
          <div className="row gap-3">
            <LucaAvatar />
            <div>
              <div className="dp f7" style={{ fontSize: 15 }}>LUCA Coach</div>
              <div className="tiny" style={{ color: 'rgba(231,248,243,.7)' }}>Heart-Centered Intelligence</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55, color: 'rgba(231,248,243,.92)' }}>
            Your sovereign guide. LUCA draws on your assessment and check-ins to offer gentle, personalized guidance.
          </div>
          <div className="tiny" style={{ marginTop: 10, color: 'rgba(231,248,243,.65)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <ShieldCheck size={13} /> Suggests only — never diagnoses or prescribes.
          </div>
        </Card>

        <Card>
          <SectionHead eyebrow="What LUCA knows" title="Your health context" />
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 64, height: 64, flex: 'none' }}>
              <Ring value={vitality} max={100} size={64} />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <div className="dp f7" style={{ fontSize: 17 }}>{vitality}</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tiny muted2">Vitality score</div>
              <div className="small f6" style={{ marginTop: 2 }}>{vitality ? `${vitality} / 100` : 'Not assessed yet'}</div>
            </div>
          </div>
          {focus.length > 0 && (
            <>
              <div className="divider" />
              <div className="tiny muted2" style={{ marginBottom: 8 }}>Focus areas</div>
              <div className="row wrap gap-2">
                {focus.slice(0, 4).map((f, i) => (
                  <span key={i} className="pill mint"><Leaf size={12} strokeWidth={2.4} />{f.name}</span>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <SectionHead eyebrow="Try asking" title="Quick prompts" />
          <div className="col gap-2">
            {COACH_SUGGESTIONS.map((s) => (
              <button key={s} className="suggest-chip" onClick={() => send(s)} disabled={sending}>{s}</button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================== PATIENT — JOURNAL ============================== */
const JOURNAL_MOODS = [
  { key: 'great', emoji: '🌟', label: 'Great' },
  { key: 'good', emoji: '😊', label: 'Good' },
  { key: 'okay', emoji: '😐', label: 'Okay' },
  { key: 'low', emoji: '😔', label: 'Low' },
  { key: 'stormy', emoji: '🌪', label: 'Stormy' },
];
const MOOD_MAP = Object.fromEntries(JOURNAL_MOODS.map((m) => [m.key, m]));

/* The four growth dimensions the Journal hub is organised around. */
const GROWTH_DIMS = [
  { key: 'mind', label: 'Mental', icon: Brain, color: '#5B77C9' },
  { key: 'body', label: 'Physical', icon: Activity, color: '#2DB584' },
  { key: 'heart', label: 'Emotional', icon: Heart, color: '#E07A9B' },
  { key: 'spirit', label: 'Spiritual', icon: Sparkles, color: '#C79A3A' },
];
const DIM_MAP = Object.fromEntries(GROWTH_DIMS.map((d) => [d.key, d]));
const TODO_KIND_ICON = { checkin: Plus, habit: Droplet, audio: Headphones, activity: Compass, reflection: BookOpen, practitioner: Stethoscope, navigate: ArrowRight };

// CTA shown on a to-do that takes the member somewhere useful (null = no nav).
function todoCTA(t) {
  const type = t.action_type;
  const tgt = t.action_target;
  if (type === 'start_checkin') return { label: 'Check in', icon: Plus };
  if (type === 'play_audio') return { label: 'Play', icon: Play };
  if (type === 'open_listing') return { label: 'View', icon: Stethoscope };
  if (type === 'navigate' && tgt && tgt !== 'journal') return { label: 'Go', icon: ArrowRight };
  return null;
}

/* Guided-journey To-Do list — the member's personal plan. */
function GrowthTodos({ todos, journeyType, onToggle, onRun, onAdd, onDelete, go }) {
  const [title, setTitle] = useState('');
  const [dim, setDim] = useState('mind');
  const done = todos.filter((t) => t.done).length;
  const add = () => { const v = title.trim(); if (!v) return; onAdd({ title: v, dimension: dim }); setTitle(''); };

  return (
    <Card className="lg">
      <SectionHead
        eyebrow="Your plan"
        title="To-do list"
        action={todos.length ? <Pill tone={done === todos.length ? 'gold' : 'mint'} icon={CheckCircle2}>{done}/{todos.length} done</Pill> : null}
      />
      {journeyType ? (
        <div className="tiny muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Curated from your {String(journeyType).replace(/_/g, ' ')} journey — check each off as you go.
        </div>
      ) : (
        <div className="tiny muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Add your own goals, or begin a guided journey in Explore to fill this with a curated plan.
        </div>
      )}

      {todos.length === 0 ? (
        <Empty icon={Compass} title="No tasks yet" sub="Begin a guided journey in Explore, or add your first goal below." />
      ) : (
        <div className="col" style={{ gap: 2 }}>
          {todos.map((t) => {
            const cta = todoCTA(t);
            const dm = DIM_MAP[t.dimension];
            const KindIcon = TODO_KIND_ICON[t.kind] || Compass;
            const CtaIcon = cta?.icon || ArrowRight;
            return (
              <div key={t.id} className="list-row" style={{ padding: '11px 0', opacity: t.done ? 0.62 : 1, borderBottom: '1px solid var(--line,#EDF2F0)' }}>
                <button
                  onClick={() => onToggle(t)}
                  title={t.done ? 'Mark not done' : 'Mark done'}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, flex: 'none', display: 'grid', placeItems: 'center' }}
                >
                  {t.done
                    ? <CheckCircle2 size={22} color="#2DB584" strokeWidth={2.2} />
                    : <span style={{ width: 21, height: 21, borderRadius: 999, border: '2px solid #C9DAD4', display: 'block' }} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small f6" style={{ textDecoration: t.done ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <KindIcon size={13} style={{ color: dm?.color || 'var(--muted)', flex: 'none' }} />
                    {t.title}
                  </div>
                  {t.detail && <div className="tiny muted" style={{ marginTop: 2, lineHeight: 1.45 }}>{t.detail}</div>}
                </div>
                <div className="row" style={{ gap: 4, flex: 'none', alignItems: 'center' }}>
                  {cta && !t.done && (
                    <button className="checkin-cta" style={{ padding: '6px 11px', fontSize: 12 }} onClick={() => onRun(t)}>
                      <CtaIcon size={13} strokeWidth={2.4} /> {cta.label}
                    </button>
                  )}
                  <button className="icon-btn" title="Remove" onClick={() => onDelete(t)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--muted,#8AA09C)', cursor: 'pointer', padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add a custom goal */}
      <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 6, flex: 1, minWidth: 200 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="Add your own goal…"
            style={{ flex: 1, minWidth: 0, borderRadius: 10, border: '1.5px solid var(--line,#E6EDEA)', padding: '9px 12px', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--ink)', background: '#fff', outline: 'none' }}
          />
        </div>
        <div className="row" style={{ gap: 5 }}>
          {GROWTH_DIMS.map((d) => (
            <button key={d.key} type="button" onClick={() => setDim(d.key)} title={d.label}
              style={{ width: 34, height: 34, borderRadius: 9, cursor: 'pointer', display: 'grid', placeItems: 'center',
                border: `1.5px solid ${dim === d.key ? d.color : 'var(--line,#E6EDEA)'}`, background: dim === d.key ? `${d.color}18` : '#fff', color: d.color }}>
              <d.icon size={15} />
            </button>
          ))}
          <Btn variant="primary" icon={Plus} onClick={add} disabled={!title.trim()}>Add</Btn>
        </div>
      </div>
    </Card>
  );
}

/* Daily habit tracker — today's habits with a tap-to-tick. */
function HabitTracker({ habits, ticked, onToggle, onAdd, onDelete }) {
  const [name, setName] = useState('');
  const doneCount = habits.filter((h) => ticked[h.id]).length;
  const add = () => { const v = name.trim(); if (!v) return; onAdd(v); setName(''); };
  return (
    <Card>
      <SectionHead
        eyebrow="Daily habits"
        title="Habit tracker"
        action={habits.length ? <Pill tone={doneCount === habits.length ? 'gold' : 'mint'} icon={Sparkles}>{doneCount}/{habits.length} today</Pill> : null}
      />
      {habits.length === 0 ? (
        <Empty icon={Leaf} title="No habits yet" sub="Add up to 5 daily habits — or begin a journey to seed them automatically." />
      ) : (
        <div className="ci-habits" style={{ marginTop: 4 }}>
          {habits.map((h) => (
            <div key={h.id} className="row" style={{ gap: 8, alignItems: 'center' }}>
              <button type="button" className={`ci-habit ${ticked[h.id] ? 'on' : ''}`} onClick={() => onToggle(h)} style={{ flex: 1 }}>
                <span className="ci-hcheck">{ticked[h.id] && <Check size={13} strokeWidth={3} />}</span>
                <span style={{ fontSize: 16 }}>{h.icon || '🌱'}</span>
                <span className="ci-hname">{h.name}</span>
              </button>
              <button className="icon-btn" title="Remove habit" onClick={() => onDelete(h)}
                style={{ border: 'none', background: 'transparent', color: 'var(--muted,#8AA09C)', cursor: 'pointer', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {habits.length < 5 && (
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="Add a daily habit…"
            style={{ flex: 1, borderRadius: 10, border: '1.5px solid var(--line,#E6EDEA)', padding: '9px 12px', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--ink)', background: '#fff', outline: 'none' }}
          />
          <Btn variant="primary" icon={Plus} onClick={add} disabled={!name.trim()}>Add</Btn>
        </div>
      )}
    </Card>
  );
}

function JournalPage({ user, go, forcedView, hideToggle }) {
  const { setPendingProviderId } = useApp();
  const { playById } = useAudio();
  // `view` is normally internal (Grow / Reflect toggle). When the Journal area
  // wrapper drives it (Journal = reflect, Growth = grow), it passes `forcedView`
  // and `hideToggle` so the outer sub-tab bar is the single source of truth.
  const [view, setView] = useState(forcedView || 'grow'); // grow | reflect
  useEffect(() => {
    if (forcedView && forcedView !== view) setView(forcedView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedView]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState('good');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  // Growth-hub state
  const [todos, setTodos] = useState([]);
  const [habits, setHabits] = useState([]);
  const [ticked, setTicked] = useState({});

  const loadGrowth = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [td, h, tk] = await Promise.all([
      api.getTodos().catch(() => ({ todos: [] })),
      api.getHabits().catch(() => ({ habits: [] })),
      api.getHabitTicks(today, today).catch(() => ({ ticks: [] })),
    ]);
    setTodos(td?.todos || []);
    setHabits(h?.habits || []);
    const pre = {};
    (tk?.ticks || []).forEach((x) => { pre[x.habit_id] = true; });
    setTicked(pre);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getJournal().catch(() => ({ entries: [] }));
        if (alive) setEntries(r?.entries || []);
        await loadGrowth();
      } finally { alive && setLoading(false); }
    })();
    return () => { alive = false; };
  }, [loadGrowth]);

  // ── To-Do handlers ──
  const toggleTodo = async (t) => {
    setTodos((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    try { await api.toggleTodo(t.id); } catch { setTodos((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: t.done } : x))); }
  };
  const runTodo = (t) => {
    const type = t.action_type;
    const target = t.action_target;
    switch (type) {
      case 'start_checkin':
        go && go('health');
        setTimeout(() => window.dispatchEvent(new CustomEvent('solaris:open-checkin')), 380);
        break;
      case 'play_audio':
        if (playById) playById(target, go); else go && go('media');
        toast.success('Playing your guided session');
        break;
      case 'open_listing':
        if (target && setPendingProviderId) setPendingProviderId(String(target));
        go && go('explore');
        break;
      case 'navigate':
        if (target && target !== 'journal') go && go(target);
        break;
      default: break;
    }
  };
  const addTodo = async (body) => {
    try { const r = await api.createTodo(body); if (r?.todo) { setTodos((xs) => [...xs, r.todo]); toast.success('Added to your plan'); } }
    catch { toast.error('Could not add that'); }
  };
  const removeTodo = async (t) => {
    const prev = todos;
    setTodos((xs) => xs.filter((x) => x.id !== t.id));
    try { await api.deleteTodo(t.id); } catch { setTodos(prev); toast.error('Could not remove that'); }
  };

  // ── Habit handlers ──
  const toggleHabit = async (h) => {
    setTicked((s) => ({ ...s, [h.id]: !s[h.id] }));
    try { await api.tickHabit({ habitId: h.id }); } catch { setTicked((s) => ({ ...s, [h.id]: !s[h.id] })); }
  };
  const addHabit = async (name) => {
    try { const r = await api.createHabit({ name }); if (r?.habit) { setHabits((xs) => [...xs, r.habit]); toast.success('Habit added'); } }
    catch (e) { toast.error(e?.message || 'Could not add habit'); }
  };
  const removeHabit = async (h) => {
    const prev = habits;
    setHabits((xs) => xs.filter((x) => x.id !== h.id));
    try { await api.deleteHabit(h.id); } catch { setHabits(prev); toast.error('Could not remove habit'); }
  };

  const save = async () => {
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const r = await api.createJournalEntry({ content: text, mood });
      if (r?.entry) {
        setEntries((e) => [r.entry, ...e]);
        setContent('');
        setMood('good');
        toast.success('Entry saved to your journal');
      }
    } catch {
      toast.error('Could not save your entry');
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    const prev = entries;
    setEntries((e) => e.filter((x) => x.id !== id));
    try { await api.deleteJournalEntry(id); }
    catch { setEntries(prev); toast.error('Could not delete entry'); }
  };

  const firstName = user?.firstName || 'friend';
  const journeyType = todos.find((t) => t.journey_type)?.journey_type || null;

  return (
    <div className="col" style={{ gap: 20 }}>
      {/* Growth-hub header: four dimensions + Grow/Reflect toggle */}
      <Card className="lg">
        <div className="between" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <SectionHead eyebrow="Personal growth" title={`Your space, ${firstName}`} />
            <div className="tiny muted" style={{ marginTop: -6 }}>
              A hub for the whole you — nurture your mind, body, heart and spirit.
            </div>
            <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
              {GROWTH_DIMS.map((d) => (
                <span key={d.key} className="row" style={{ gap: 6, alignItems: 'center', padding: '5px 11px', borderRadius: 999, background: `${d.color}14`, color: d.color, fontSize: 12.5, fontWeight: 600 }}>
                  <d.icon size={14} /> {d.label}
                </span>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 4, background: '#F1F5F3', borderRadius: 999, padding: 4, flex: 'none', display: hideToggle ? 'none' : undefined }}>
            {[{ k: 'grow', label: 'Grow', icon: Compass }, { k: 'reflect', label: 'Reflect', icon: BookOpen }].map((v) => (
              <button key={v.k} type="button" onClick={() => setView(v.k)}
                className="row" style={{ gap: 6, alignItems: 'center', border: 'none', cursor: 'pointer', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 700,
                  background: view === v.k ? '#fff' : 'transparent', color: view === v.k ? 'var(--ink)' : 'var(--muted,#8AA09C)',
                  boxShadow: view === v.k ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>
                <v.icon size={15} /> {v.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {view === 'grow' ? (
        loading ? (
          <div className="grid-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
            <CardSkeleton rows={4} /><CardSkeleton rows={3} />
          </div>
        ) : (
          <div className="grid-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
            <GrowthTodos
              todos={todos}
              journeyType={journeyType}
              onToggle={toggleTodo}
              onRun={runTodo}
              onAdd={addTodo}
              onDelete={removeTodo}
              go={go}
            />
            <HabitTracker
              habits={habits}
              ticked={ticked}
              onToggle={toggleHabit}
              onAdd={addHabit}
              onDelete={removeHabit}
            />
          </div>
        )
      ) : (
        <div className="grid-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 20, alignItems: 'start' }}>
          {/* Composer */}
          <Card className="lg">
            <SectionHead eyebrow="New entry" title="How are you today?" />
            <div className="tiny muted2" style={{ marginBottom: 8 }}>Today's mood</div>
            <div className="row wrap gap-2" style={{ marginBottom: 14 }}>
              {JOURNAL_MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMood(m.key)}
                  className="mood-pill"
                  aria-pressed={mood === m.key}
                  style={{
                    border: `1.5px solid ${mood === m.key ? 'var(--teal, #36C9A9)' : 'var(--line, #E6EDEA)'}`,
                    background: mood === m.key ? '#E7F5F1' : '#fff',
                    color: 'var(--ink)', borderRadius: 999, padding: '7px 12px',
                    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    fontWeight: mood === m.key ? 700 : 500, fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{m.emoji}</span>{m.label}
                </button>
              ))}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write freely. What happened today, how your body feels, what you're grateful for…"
              rows={7}
              maxLength={5000}
              style={{
                width: '100%', resize: 'vertical', borderRadius: 12,
                border: '1.5px solid var(--line, #E6EDEA)', padding: '12px 14px',
                fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)',
                background: '#fff', outline: 'none',
              }}
            />
            <div className="between" style={{ marginTop: 12, alignItems: 'center' }}>
              <span className="tiny muted">{content.length}/5000 · Private to you</span>
              <Btn variant="primary" icon={Check} onClick={save} disabled={saving || !content.trim()}>
                {saving ? 'Saving…' : 'Save entry'}
              </Btn>
            </div>
          </Card>

          {/* Timeline */}
          <div className="col gap-3">
            <SectionHead eyebrow="Your reflections" title="Recent entries" />
            {loading ? (
              <><CardSkeleton rows={2} /><CardSkeleton rows={2} /></>
            ) : entries.length === 0 ? (
              <Card><Empty icon={BookOpen} title="Your journal is empty" sub="Write your first reflection. Over time, LUCA can help you notice the patterns." /></Card>
            ) : entries.map((e) => {
              const m = MOOD_MAP[e.mood];
              return (
                <Card key={e.id}>
                  <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <div className="row gap-2" style={{ alignItems: 'center' }}>
                      {m && <span style={{ fontSize: 18 }} title={m.label}>{m.emoji}</span>}
                      <div>
                        <div className="small f6" style={{ color: 'var(--ink)' }}>{m ? m.label : 'Entry'}</div>
                        <div className="tiny muted">{new Date(e.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                      </div>
                    </div>
                    <button className="icon-btn" title="Delete entry" onClick={() => remove(e.id)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--muted, #8AA09C)', cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="small" style={{ marginTop: 8, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.content}</div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== PATIENT — MEDIA LIBRARY ============================== */
const fmtDuration = (s) => {
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

/* ============================== SHARED AUDIO ENGINE ==============================
   A single <audio> element lives in the shell (AudioProvider). Both the full
   MediaPage player and the persistent MiniPlayer drive it through this context,
   so playback continues seamlessly as the member moves between tabs. */
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];
const AudioCtx = createContext(null);
const useAudio = () => useContext(AudioCtx) || {};

function AudioProvider({ children }) {
  const {
    currentTrack, setCurrentTrack, isPlaying, setIsPlaying, audioQueue, setAudioQueue,
  } = useApp();
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);

  // Load a new track's source and (if playing) start it.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !currentTrack) return;
    if (a.getAttribute('data-src') !== currentTrack.audio_url) {
      a.src = currentTrack.audio_url;
      a.setAttribute('data-src', currentTrack.audio_url);
      a.load();
      setCurrentTime(0);
      setDuration(currentTrack.duration_seconds || 0);
    }
    if (isPlaying) a.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);

  // Reflect play/pause intent onto the element.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !currentTrack) return;
    if (isPlaying) a.play().catch(() => {}); else a.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentTrack]);

  // Apply playback speed.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, currentTrack]);

  const play = useCallback((track, queue) => {
    if (Array.isArray(queue)) setAudioQueue(queue);
    setCurrentTrack(track);
    setIsPlaying(true);
  }, [setAudioQueue, setCurrentTrack, setIsPlaying]);

  const toggle = useCallback(() => {
    if (!currentTrack) return;
    setIsPlaying((p) => !p);
  }, [currentTrack, setIsPlaying]);

  const seek = useCallback((t) => {
    const a = audioRef.current;
    const clamped = Math.max(0, Math.min(duration || 0, t));
    if (a) a.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const skip = useCallback((delta) => {
    const a = audioRef.current;
    if (!a) return;
    seek((a.currentTime || 0) + delta);
  }, [seek]);

  const goTo = useCallback((dir) => {
    const q = audioQueue;
    if (!q.length || !currentTrack) return;
    const idx = q.findIndex((t) => t.id === currentTrack.id);
    let nextIdx;
    if (shuffle && q.length > 1) {
      do { nextIdx = Math.floor(Math.random() * q.length); } while (nextIdx === idx);
    } else {
      nextIdx = (idx + dir + q.length) % q.length;
    }
    play(q[nextIdx]);
  }, [audioQueue, currentTrack, shuffle, play]);

  const onEnded = useCallback(() => {
    const a = audioRef.current;
    if (repeat && a) { a.currentTime = 0; a.play().catch(() => {}); return; }
    if (audioQueue.length > 1) { goTo(1); return; }
    setIsPlaying(false);
  }, [repeat, audioQueue, goTo, setIsPlaying]);

  const close = useCallback(() => {
    const a = audioRef.current;
    if (a) a.pause();
    setIsPlaying(false);
    setCurrentTrack(null);
  }, [setIsPlaying, setCurrentTrack]);

  // Play the first track from the member's unlocked library (used by LUCA's play_audio chip).
  const playFromLibrary = useCallback(async (go) => {
    try {
      const r = await api.getMyAudio();
      const tracks = r?.tracks || [];
      if (tracks.length) { play(tracks[0], tracks); return true; }
    } catch { /* fall through */ }
    if (go) go('media');
    return false;
  }, [play]);

  // Play a specific track by id (used by guided-journey audio to-dos). Falls
  // back to navigating to the media library if the track isn't unlocked.
  const playById = useCallback(async (id, go) => {
    try {
      const r = await api.getMyAudio();
      const tracks = r?.tracks || [];
      const hit = tracks.find((t) => String(t.id) === String(id));
      if (hit) { play(hit, tracks); return true; }
      if (tracks.length) { play(tracks[0], tracks); return true; }
    } catch { /* fall through */ }
    if (go) go('media');
    return false;
  }, [play]);

  const value = {
    audioRef, currentTime, duration, rate, setRate, repeat, setRepeat, shuffle, setShuffle,
    play, toggle, seek, skip, next: () => goTo(1), prev: () => goTo(-1), close, playFromLibrary, playById,
  };

  return (
    <AudioCtx.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime || 0)}
        onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
        onEnded={onEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />
    </AudioCtx.Provider>
  );
}

/* Persistent mini-player bar — shown on every tab except Media once a track is loaded. */
function MiniPlayer({ hidden }) {
  const { currentTrack, isPlaying } = useApp();
  const { currentTime, duration, toggle, skip, close } = useAudio();
  if (hidden || !currentTrack) return null;
  const pct = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div className="mini-player" role="region" aria-label="Now playing">
      <div className="mini-progress"><div className="mini-progress-fill" style={{ width: `${pct}%` }} /></div>
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', flex: 'none', background: '#EBF3F0' }}>
          {currentTrack.cover_image_url
            ? <img src={currentTrack.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#5C8A80' }}><Music size={15} /></div>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="small f6" style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
          <div className="tiny muted">{fmtDuration(currentTime)} / {fmtDuration(duration || currentTrack.duration_seconds)}</div>
        </div>
      </div>
      <div className="row gap-1" style={{ alignItems: 'center', flex: 'none' }}>
        <button className="mp-ctrl" onClick={() => skip(-15)} title="Back 15s"><Rewind size={16} /></button>
        <button className="mp-ctrl primary" onClick={toggle} title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={17} /> : <Play size={17} />}</button>
        <button className="mp-ctrl" onClick={() => skip(15)} title="Forward 15s"><FastForward size={16} /></button>
        <button className="mp-ctrl" onClick={close} title="Close player"><X size={16} /></button>
      </div>
    </div>
  );
}

/* Full-featured player card shown at the top of the Media tab. */
function FullPlayer() {
  const { currentTrack, isPlaying } = useApp();
  const { currentTime, duration, rate, setRate, repeat, setRepeat, shuffle, setShuffle, toggle, skip, seek, next, prev } = useAudio();
  if (!currentTrack) return null;
  const dur = duration || currentTrack.duration_seconds || 0;
  return (
    <Card className="lg full-player">
      <div className="row gap-3" style={{ alignItems: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 14, overflow: 'hidden', flex: 'none', background: 'rgba(255,255,255,.12)' }}>
          {currentTrack.cover_image_url
            ? <img src={currentTrack.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#DAF3EC' }}><Music size={24} /></div>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tiny" style={{ color: 'rgba(231,248,243,.7)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Now playing</div>
          <div className="dp f7" style={{ fontSize: 17, color: '#F2FBF8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</div>
          {currentTrack.is_local && <span className="pill mint" style={{ fontSize: 11, marginTop: 4 }}>Local file</span>}
        </div>
      </div>

      {/* Seek bar */}
      <div className="fp-seek">
        <span className="tiny" style={{ color: 'rgba(231,248,243,.85)', minWidth: 38 }}>{fmtDuration(currentTime)}</span>
        <input type="range" min={0} max={dur || 0} step="0.5" value={Math.min(currentTime, dur || 0)}
          onChange={(e) => seek(Number(e.target.value))} className="fp-range" aria-label="Seek" />
        <span className="tiny" style={{ color: 'rgba(231,248,243,.85)', minWidth: 38, textAlign: 'right' }}>{fmtDuration(dur)}</span>
      </div>

      {/* Transport controls */}
      <div className="fp-controls">
        <button className={`fp-btn ${shuffle ? 'on' : ''}`} onClick={() => setShuffle((s) => !s)} title="Shuffle"><Shuffle size={17} /></button>
        <button className="fp-btn" onClick={prev} title="Previous"><ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /></button>
        <button className="fp-btn" onClick={() => skip(-15)} title="Back 15s"><Rewind size={19} /></button>
        <button className="fp-btn play" onClick={toggle} title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={24} /> : <Play size={24} />}</button>
        <button className="fp-btn" onClick={() => skip(15)} title="Forward 15s"><FastForward size={19} /></button>
        <button className="fp-btn" onClick={next} title="Next"><ChevronRight size={20} /></button>
        <button className={`fp-btn ${repeat ? 'on' : ''}`} onClick={() => setRepeat((r) => !r)} title="Repeat"><Repeat size={17} /></button>
      </div>

      {/* Speed */}
      <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span className="tiny" style={{ color: 'rgba(231,248,243,.7)' }}>Speed</span>
        <select className="fp-speed" value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Playback speed">
          {PLAYBACK_RATES.map((r) => <option key={r} value={r}>{r}x</option>)}
        </select>
      </div>
    </Card>
  );
}

function MediaPage({ user, go }) {
  const { currentTrack, audioQueue, setAudioQueue } = useApp();
  const { play } = useAudio();
  const [tracks, setTracks] = useState([]);
  const [localTracks, setLocalTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const r = await api.getAudioLibrary().catch(() => ({ tracks: [] }));
    setTracks(r?.tracks || []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => { await load(); if (alive) setLoading(false); })();
    return () => { alive = false; };
  }, [load]);

  const unlocked = tracks.filter((t) => t.unlocked);
  const locked = tracks.filter((t) => !t.unlocked);
  const practitioner = tracks.find((t) => t.practitioner_name);
  const freeLocked = locked.filter((t) => t.is_free).length;

  // The play queue = unlocked Solaris tracks + any imported local files.
  const playable = [...unlocked, ...localTracks];

  // Keep the shared queue in sync with what's playable (without disrupting playback).
  useEffect(() => {
    setAudioQueue(playable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, localTracks]);

  const playTrack = (t) => play(t, playable);

  const importFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const track = {
      id: 'local-' + Date.now(),
      title: file.name.replace(/\.[^.]+$/, ''),
      audio_url: url,
      duration_seconds: 0,
      is_local: true,
      unlocked: true,
    };
    setLocalTracks((prev) => [...prev, track]);
    toast.success('Added to your queue');
    if (e.target) e.target.value = '';
  };

  const unlockOne = async (t) => {
    setBusyId(t.id);
    try {
      await api.unlockAudio(t.id);
      await load();
      toast.success('Added to your library');
    } catch {
      toast.error('This is a premium track — book a session to unlock');
    } finally { setBusyId(null); }
  };

  const acceptAll = async () => {
    const listingId = tracks.find((t) => t.listing_id)?.listing_id;
    if (!listingId) return;
    setAccepting(true);
    try {
      const r = await api.acceptAudioFromListing(listingId);
      await load();
      toast.success(r?.unlocked ? `Added ${r.unlocked} free track${r.unlocked === 1 ? '' : 's'} to your library` : 'Your free tracks are already in your library');
    } catch {
      toast.error('Could not add tracks');
    } finally { setAccepting(false); }
  };

  return (
    <div className="col gap-4" style={{ paddingBottom: 8 }}>
      {/* Full player (shared audio engine) */}
      <FullPlayer />

      {/* Play queue */}
      {audioQueue.length > 0 && (
        <div>
          <SectionHead eyebrow="Up next" title={`Queue (${audioQueue.length})`} />
          <Card className="col" style={{ gap: 2, padding: 6 }}>
            {audioQueue.map((t) => (
              <button key={t.id} className={`queue-row ${currentTrack?.id === t.id ? 'on' : ''}`} onClick={() => playTrack(t)}>
                <span className="queue-ico">{currentTrack?.id === t.id ? <Pause size={14} /> : <Play size={14} />}</span>
                <span className="queue-title">{t.title}</span>
                {t.is_local && <span className="pill mint" style={{ fontSize: 10 }}>Local</span>}
                <span className="tiny muted" style={{ marginLeft: 'auto' }}>{fmtDuration(t.duration_seconds)}</span>
              </button>
            ))}
          </Card>
        </div>
      )}

      {/* Local file import */}
      <Card className="between" style={{ alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div className="small f6" style={{ color: 'var(--ink)' }}>Add your own audio</div>
          <div className="tiny muted" style={{ marginTop: 2 }}>Your local files play in this browser session. No data is uploaded.</div>
        </div>
        <input ref={fileRef} type="file" accept="audio/*" onChange={importFile} style={{ display: 'none' }} />
        <Btn icon={Upload} onClick={() => fileRef.current?.click()}>Add file</Btn>
      </Card>

      {/* Practitioner intro */}
      {practitioner && (
        <Card className="lg" style={{ background: 'linear-gradient(170deg,#0E5C57,#0A413D)', color: '#E7F8F3', border: 'none' }}>
          <div className="row gap-3" style={{ alignItems: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, overflow: 'hidden', flex: 'none', background: 'rgba(255,255,255,.12)' }}>
              {practitioner.practitioner_avatar
                ? <img src={practitioner.practitioner_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}><Headphones size={22} /></div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="dp f7" style={{ fontSize: 16 }}>{practitioner.practitioner_name}</div>
              <div className="tiny" style={{ color: 'rgba(231,248,243,.75)' }}>{practitioner.practitioner_specialty || 'Solaris Practitioner'}</div>
            </div>
            {freeLocked > 0 && (
              <Btn icon={Plus} onClick={acceptAll} disabled={accepting}
                style={{ background: '#F0D28C', color: '#4A3B0F', border: 'none' }}>
                {accepting ? 'Adding…' : `Accept ${freeLocked} free track${freeLocked === 1 ? '' : 's'}`}
              </Btn>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55, color: 'rgba(231,248,243,.92)' }}>
            Guided audio practices to support your nervous system between sessions. Free tracks are yours to keep — premium sessions unlock when you book.
          </div>
        </Card>
      )}

      {loading ? (
        <><CardSkeleton rows={2} /><CardSkeleton rows={2} /></>
      ) : (
        <>
          {/* Your library */}
          <div>
            <SectionHead eyebrow="Your library" title={`Saved practices (${unlocked.length})`} />
            {unlocked.length === 0 ? (
              <Card><Empty icon={Music} title="Your library is empty" sub="Explore wellness audio below — add free guided practices to start building your personal library.">
                <Btn icon={Compass} onClick={() => go && go('explore')}>Explore wellness audio</Btn>
              </Empty></Card>
            ) : (
              <div className="col gap-3">
                {unlocked.map((t) => (
                  <TrackRow key={t.id} t={t} playing={currentTrack?.id === t.id} onPlay={() => playTrack(t)} />
                ))}
              </div>
            )}
          </div>

          {/* Discover / unlock */}
          {locked.length > 0 && (
            <div>
              <SectionHead eyebrow="More from the practitioner" title="Discover more practices" />
              <div className="col gap-3">
                {locked.map((t) => (
                  <TrackRow key={t.id} t={t} locked
                    busy={busyId === t.id}
                    onUnlock={() => t.is_free ? unlockOne(t) : go && go('explore')} />
                ))}
              </div>
            </div>
          )}

          {/* Explore CTA */}
          <Card className="between" style={{ alignItems: 'center' }}>
            <div>
              <div className="small f6" style={{ color: 'var(--ink)' }}>Looking for more support?</div>
              <div className="tiny muted" style={{ marginTop: 2 }}>Explore practitioners across the Solaris network.</div>
            </div>
            <Btn icon={Compass} onClick={() => go && go('explore')}>Explore</Btn>
          </Card>
        </>
      )}
    </div>
  );
}

function TrackRow({ t, playing, locked, busy, onPlay, onUnlock }) {
  const tags = Array.isArray(t.tags_json) ? t.tags_json : [];
  return (
    <Card className="row gap-3" style={{ alignItems: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flex: 'none', background: '#EBF3F0', position: 'relative' }}>
        {t.cover_image_url && <img src={t.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: locked ? 0.55 : 1 }} />}
        {locked && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(10,40,40,.35)' }}><Lock size={18} /></div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <div className="small f6" style={{ color: 'var(--ink)' }}>{t.title}</div>
          {!t.is_free && <Pill tone="gold" icon={Star}>Premium</Pill>}
        </div>
        <div className="tiny muted" style={{ marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</div>
        <div className="row wrap gap-2" style={{ marginTop: 6, alignItems: 'center' }}>
          <span className="tiny muted2"><Clock size={11} style={{ verticalAlign: -1 }} /> {fmtDuration(t.duration_seconds)}</span>
          {tags.slice(0, 3).map((tag) => <span key={tag} className="pill mint" style={{ fontSize: 11 }}>{tag}</span>)}
        </div>
      </div>
      <div style={{ flex: 'none' }}>
        {locked
          ? <Btn variant={t.is_free ? 'primary' : ''} icon={t.is_free ? Plus : Lock} onClick={onUnlock} disabled={busy}>
              {busy ? '…' : t.is_free ? 'Add' : 'Book to unlock'}
            </Btn>
          : <Btn variant="primary" icon={playing ? Pause : Play} onClick={onPlay}>{playing ? 'Playing' : 'Play'}</Btn>}
      </div>
    </Card>
  );
}

/* ============================== PATIENT — APPOINTMENTS ============================== */
function AppointmentsPage() {
  const [bookings, setBookings] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ preferredDate: '', preferredTime: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    const [b, l] = await Promise.all([
      api.getBookings().catch(() => ({ bookings: [] })),
      api.getListings({ type: 'practitioner' }).catch(() => ({ listings: [] })),
    ]);
    setBookings(b?.bookings || []); setListings(l?.listings || []);
  }, []);
  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const book = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      await api.createBooking({ listingId: sel.id, ...form });
      setDone('Booking requested — the Solaris team will confirm shortly.');
      setPicker(false); setSel(null); setForm({ preferredDate: '', preferredTime: '', note: '' });
      await load();
    } catch (e) { setDone(e.message || 'Could not request booking.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}><CardSkeleton rows={4} /><CardSkeleton rows={4} /></div>;

  const upcoming = bookings.filter((b) => b.status !== 'completed' && b.status !== 'cancelled');
  const past = bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled');

  return (
    <div className="col gap-4">
      {done && <Card className="row gap-2" style={{ borderColor: 'var(--mint-line)', background: 'var(--mint-soft)' }}><CheckCircle2 size={16} className="t-mint" /><span className="small t-mint">{done}</span></Card>}

      <div className="between wrap" style={{ gap: 12 }}>
        <div className="seg">
          <button className="on">All visits</button>
        </div>
        <Btn variant="gold" icon={Plus} onClick={() => { setPicker(true); setDone(''); }}>Book care</Btn>
      </div>

      {picker && (
        <Card className="lg">
          <SectionHead eyebrow="New appointment" title="Choose a practitioner" action={<Btn variant="ghost sm" icon={X} onClick={() => { setPicker(false); setSel(null); }}>Close</Btn>} />
          {!sel ? (
            listings.length ? (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
                {listings.map((l) => (
                  <button key={l.id} className="card flat" onClick={() => setSel(l)} style={{ textAlign: 'left', cursor: 'pointer', borderColor: 'var(--line)' }}>
                    <div className="row gap-3"><Avatar name={l.title} tone="teal" size={42} />
                      <div style={{ minWidth: 0 }}><div className="small f6">{l.title}</div><div className="tiny muted">{l.specialty || l.listing_type}{l.city ? ` · ${l.city}` : ''}</div></div></div>
                    <div className="row gap-3" style={{ marginTop: 10 }}>
                      <span className="tiny row gap-1"><Star size={12} className="t-gold" /> {Number(l.rating || 0).toFixed(1)}</span>
                      {l.price && <span className="tiny t-gold f6">${l.price}</span>}
                    </div>
                  </button>
                ))}
              </div>
            ) : <Empty icon={Stethoscope} title="No practitioners listed yet" sub="Check back soon as the Solaris network grows." />
          ) : (
            <div className="col gap-3" style={{ maxWidth: 460 }}>
              <div className="row gap-3"><Avatar name={sel.title} tone="teal" size={44} /><div><div className="f6">{sel.title}</div><div className="tiny muted">{sel.specialty || sel.listing_type}</div></div></div>
              <Field label="Preferred date"><input className="num-like input-line" type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} /></Field>
              <Field label="Preferred time"><input className="input-line" placeholder="e.g. Morning" value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value })} /></Field>
              <Field label="Intention / note"><textarea className="input-line" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="What would you like to focus on?" /></Field>
              <div className="row gap-2"><Btn variant="ghost" onClick={() => setSel(null)}>Back</Btn><Btn variant="primary block" onClick={book} disabled={busy} icon={Check}>{busy ? 'Requesting…' : 'Request booking'}</Btn></div>
            </div>
          )}
        </Card>
      )}

      <Card>
        <SectionHead eyebrow="Upcoming" title="Your appointments" action={<Pill tone="gray">{upcoming.length}</Pill>} />
        {upcoming.length ? upcoming.map((b) => <BookingRow key={b.id} b={b} />) : <Empty icon={Calendar} title="No upcoming visits" sub="Book care from the Solaris network to see it here." />}
      </Card>
      {past.length > 0 && (
        <Card>
          <SectionHead eyebrow="History" title="Past visits" />
          {past.map((b) => <BookingRow key={b.id} b={b} />)}
        </Card>
      )}
    </div>
  );
}
function BookingRow({ b }) {
  const tone = b.status === 'confirmed' ? 'mint' : b.status === 'completed' ? 'teal' : b.status === 'cancelled' ? 'danger' : 'gold';
  return (
    <div className="list-row">
      <Chip icon={Calendar} tone="teal" sm />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="small f6">{b.listing_title || 'Appointment'}</div>
        <div className="tiny muted">{b.preferred_date ? fmtDate(b.preferred_date) : 'Flexible'}{b.preferred_time ? ` · ${b.preferred_time}` : ''}</div>
      </div>
      <Pill tone={tone}>{b.status}</Pill>
    </div>
  );
}
function Field({ label, children }) {
  return <label className="col gap-2"><span className="tiny muted2" style={{ letterSpacing: '.04em', fontWeight: 600 }}>{label}</span>{children}</label>;
}

/* ============================== PATIENT — WALLET & REWARDS ============================== */
function RewardsRecognition({ user }) {
  const [rewards, setRewards] = useState({ events: [], total: 0 });
  const [contribs, setContribs] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [r, c, cr] = await Promise.all([
          api.getRewards().catch(() => ({ events: [], total: 0 })),
          api.getContributions().catch(() => []),
          api.getCredentials().catch(() => []),
        ]);
        if (!alive) return;
        setRewards(r || { events: [], total: 0 });
        setContribs(Array.isArray(c) ? c : []);
        setCredentials(Array.isArray(cr) ? cr : []);
      } finally { alive && setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}><CardSkeleton rows={4} /><CardSkeleton rows={4} /></div>;

  const spark = (rewards.events || []).slice(0, 14).reverse().reduce((acc, e, i) => {
    const prev = acc.length ? acc[acc.length - 1].v : 0; acc.push({ d: i, v: prev + (e.points || 0) }); return acc;
  }, []);
  if (spark.length < 2) { spark.length = 0; spark.push({ d: 0, v: 0 }, { d: 1, v: rewards.total || 0 }); }
  const totalRewardSats = contribs.reduce((s, c) => s + (Number(c.reward_sats) || 0), 0);

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 326px', gap: 18, alignItems: 'start' }}>
      <div className="col gap-4">
        <Card className="lg" style={{ background: 'linear-gradient(160deg,#FCF8EC,#FBF1D9)', borderColor: '#EBD3A0' }}>
          <SectionHead eyebrow="LOVE balance" title="Your rewards" action={<Pill tone="gold" icon={Gift}>Solaris rewards</Pill>} />
          <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="stat">{(rewards.total || 0).toLocaleString()}<span className="unit">LOVE points</span></span>
          </div>
          <div className="small muted" style={{ marginTop: 2 }}>{contribs.length} verified contributions · {totalRewardSats.toLocaleString()} sats earned</div>
          <div style={{ height: 70, margin: '12px -6px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs><linearGradient id="lucaWfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D69B33" stopOpacity={0.34} /><stop offset="100%" stopColor="#D69B33" stopOpacity={0} />
                </linearGradient></defs>
                <Area type="monotone" dataKey="v" stroke="#CC8E27" strokeWidth={2.2} fill="url(#lucaWfill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionHead eyebrow="Contribution ledger" title="Verified actions" action={<Pill tone="gray">{contribs.length}</Pill>} />
          {contribs.length ? contribs.map((c) => (
            <div key={c.id} className="list-row">
              <Chip icon={Award} tone="mint" sm />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small f6">{c.event_type || c.category || 'Contribution'}</div>
                <div className="tiny muted">{c.description || c.impact || '—'} · {fmtShort(c.created_at)}{c.verifier_name ? ` · by ${c.verifier_name}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {c.reward_sats > 0 && <div className="small f7 t-mint">+{Number(c.reward_sats).toLocaleString()} sats</div>}
                <Pill tone={c.verified_at ? 'mint' : 'gold'}>{c.verified_at ? 'Verified' : 'Pending'}</Pill>
              </div>
            </div>
          )) : <Empty icon={Award} title="No contributions yet" sub="Engage with care and community to earn verified rewards." />}
        </Card>
      </div>

      <div className="col gap-4">
        <Card>
          <SectionHead eyebrow="Reward events" title="LOVE ledger" />
          {(rewards.events || []).length ? rewards.events.slice(0, 8).map((e) => (
            <div key={e.id} className="list-row" style={{ padding: '10px 0' }}>
              <Chip icon={ArrowDownLeft} tone="mint" sm />
              <div style={{ flex: 1, minWidth: 0 }}><div className="small f6">{e.note || e.event_type}</div><div className="tiny muted">{fmtShort(e.created_at)}</div></div>
              <span className="small f7 t-mint">+{e.points}</span>
            </div>
          )) : <Empty icon={Gift} title="No reward events" />}
        </Card>
        <Card>
          <SectionHead eyebrow="Credentials" title="Verified badges" action={<Pill tone="gray">{credentials.length}</Pill>} />
          {credentials.length ? credentials.slice(0, 6).map((c) => (
            <div key={c.id} className="list-row" style={{ padding: '10px 0' }}>
              <Chip icon={BadgeCheck} tone="gold" sm />
              <div style={{ flex: 1, minWidth: 0 }}><div className="small f6">{c.credential_name}</div><div className="tiny muted">{c.issuer_name || c.credential_type}</div></div>
              {c.verified_at && <Pill tone="mint" icon={Check}>Active</Pill>}
            </div>
          )) : <Empty icon={BadgeCheck} title="No credentials yet" sub="Verified achievements from the network appear here." />}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------- Web3 wallet hub ---------------------------- */
function WalletHub({ user }) {
  const [wallets, setWallets] = useState([]);
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState(null); // { kind, msg }

  const flash = (kind, msg) => { setToast({ kind, msg }); setTimeout(() => setToast(null), 3600); };

  const load = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([
        api.getWallets().catch(() => ({ wallets: [] })),
        api.getWalletChains().catch(() => ({ chains: [] })),
      ]);
      const list = Array.isArray(w.wallets) ? w.wallets : [];
      setWallets(list);
      setChains(Array.isArray(c.chains) ? c.chains : []);
      setActiveId((prev) => (prev && list.find((x) => x.id === prev)) ? prev : (list[0]?.id || null));
      setShowConnect(list.length === 0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConnected = async (wallet) => {
    flash('ok', `Connected ${wallet.label || wallet.chain} wallet${wallet.verified ? ' (verified)' : ''}`);
    await load();
    setActiveId(wallet.id);
    setShowConnect(false);
  };
  const handlePrimary = async (id) => {
    try { await api.setPrimaryWallet(id); flash('ok', 'Primary wallet updated'); await load(); }
    catch (e) { flash('err', e.message); }
  };
  const handleDisconnect = async (id) => {
    try {
      await api.disconnectWallet(id);
      flash('ok', 'Wallet disconnected');
      const remaining = wallets.filter((w) => w.id !== id);
      setActiveId(remaining[0]?.id || null);
      await load();
    } catch (e) { flash('err', e.message); }
  };

  if (loading) return <CardSkeleton rows={5} />;

  const active = wallets.find((w) => w.id === activeId) || wallets[0];

  return (
    <div className="col gap-4">
      {toast && (
        <div className="row" style={{
          gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 12,
          background: toast.kind === 'ok' ? 'var(--mint-soft)' : 'var(--danger-soft)',
          color: toast.kind === 'ok' ? 'var(--mint-ink)' : 'var(--danger-ink)',
          border: '1px solid', borderColor: toast.kind === 'ok' ? 'var(--mint-line)' : 'var(--danger-soft)',
        }}>
          {toast.kind === 'ok' ? <Check size={16} /> : <X size={16} />}
          <span className="small f6">{toast.msg}</span>
        </div>
      )}

      {/* connected wallets selector */}
      {wallets.length > 0 && (
        <Card>
          <SectionHead eyebrow="Sovereign finance" title="Your wallets"
            action={<Btn variant="ghost" className="sm" icon={Plus} onClick={() => setShowConnect((v) => !v)}>{showConnect ? 'Close' : 'Connect wallet'}</Btn>} />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {wallets.map((w) => (
              <button key={w.id} onClick={() => { setActiveId(w.id); setShowConnect(false); }}
                className="row" style={{
                  gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
                  border: '1px solid', borderColor: w.id === active?.id ? 'var(--mint)' : 'var(--line)',
                  background: w.id === active?.id ? 'var(--mint-soft)' : 'var(--surface)',
                }}>
                <Wallet size={15} style={{ color: 'var(--teal)' }} />
                <span className="small f6">{w.label || w.chain}</span>
                {w.isPrimary && <Pill tone="gold">Primary</Pill>}
                {w.verified && <BadgeCheck size={14} style={{ color: 'var(--mint-ink)' }} />}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* connect panel */}
      {showConnect && (
        <Card>
          <SectionHead eyebrow="Connect" title="Add a crypto wallet"
            action={wallets.length ? <Btn variant="ghost" className="sm" icon={X} onClick={() => setShowConnect(false)}>Cancel</Btn> : null} />
          <WalletConnect chains={chains} onConnected={handleConnected} onError={(m) => flash('err', m)} />
        </Card>
      )}

      {/* active wallet dashboard */}
      {active && !showConnect && (
        <Card>
          <WalletDashboard wallet={active} onPrimary={handlePrimary}
            onDisconnect={handleDisconnect} onError={(m) => flash('err', m)} />
        </Card>
      )}

      {/* health NFTs */}
      <Card>
        <SectionHead eyebrow="Tokenized milestones" title="Health NFTs"
          action={<Pill tone="gray" icon={Sparkles}>Preview</Pill>} />
        <HealthNFT wallets={wallets} onError={(m) => flash('err', m)} />
      </Card>
    </div>
  );
}

/* ============================== PATIENT — WALLET (tabbed) ============================== */
function WalletPage({ user }) {
  const [view, setView] = useState('ledger');
  return (
    <div className="col gap-4">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Btn variant={view === 'ledger' ? 'primary' : 'ghost'} className="sm" icon={Sprout} onClick={() => setView('ledger')}>Value trail</Btn>
        <Btn variant={view === 'referrals' ? 'primary' : 'ghost'} className="sm" icon={Users} onClick={() => setView('referrals')}>Ecosystem builder</Btn>
        <Btn variant={view === 'rewards' ? 'primary' : 'ghost'} className="sm" icon={Gift} onClick={() => setView('rewards')}>LOVE &amp; rewards</Btn>
        <Btn variant={view === 'web3' ? 'primary' : 'ghost'} className="sm" icon={Wallet} onClick={() => setView('web3')}>Crypto wallets</Btn>
      </div>
      {view === 'web3' && <WalletHub user={user} />}
      {view === 'rewards' && <RewardsRecognition user={user} />}
      {view === 'ledger' && <GPSLedger user={user} />}
      {view === 'referrals' && <ReferralHub user={user} />}
    </div>
  );
}



/* ============================== PRACTITIONER — DRAFT QUEUE ============================== */
function DraftQueuePage() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [acted, setActed] = useState({}); // id -> 'approved' | 'declined'

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await api.getPractitionerBookings();
        if (on) setBookings(r.bookings || []);
      } catch { /* noop */ } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  const queue = bookings.filter((b) => (b.status || 'pending') === 'pending' && !acted[b.id]);
  const reviewed = bookings.filter((b) => acted[b.id]);

  if (loading) return <div className="grid-2"><CardSkeleton rows={4} /><CardSkeleton rows={4} /></div>;

  return (
    <div className="col gap-4">
      <div className="stat-row">
        <MiniStat icon={ClipboardList} tone="gold" label="Awaiting review" value={queue.length} />
        <MiniStat icon={CheckCircle2} tone="mint" label="Approved today" value={Object.values(acted).filter((v) => v === 'approved').length} />
        <MiniStat icon={X} tone="danger" label="Declined" value={Object.values(acted).filter((v) => v === 'declined').length} />
      </div>

      <Card>
        <SectionHead eyebrow="Triage" title="Summaries awaiting your sign-off"
          action={<Pill tone="gold" icon={Clock}>{queue.length} pending</Pill>} />
        {queue.length ? queue.map((b) => (
          <div key={b.id} className="draft-row">
            <Avatar name={b.patient_name || 'Patient'} sm />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row gap-2 wrap" style={{ alignItems: 'center' }}>
                <span className="small f6">{b.patient_name || 'Patient'}</span>
                <Pill tone="gray">{b.listing_title || 'Consultation'}</Pill>
              </div>
              <div className="tiny muted">Requested {fmtDate(b.preferred_date)}{b.preferred_time ? ` · ${b.preferred_time}` : ''}</div>
              {b.note && <div className="tiny muted" style={{ marginTop: 4 }}>“{b.note}”</div>}
            </div>
            <div className="row gap-2">
              <Btn variant="ghost sm" icon={X} onClick={() => setActed((a) => ({ ...a, [b.id]: 'declined' }))}>Decline</Btn>
              <Btn variant="primary sm" icon={Check} onClick={() => setActed((a) => ({ ...a, [b.id]: 'approved' }))}>Approve</Btn>
            </div>
          </div>
        )) : <Empty icon={CheckCircle2} title="Queue is clear" sub="No triage summaries are waiting for review right now." />}
      </Card>

      {reviewed.length > 0 && (
        <Card>
          <SectionHead eyebrow="Recently reviewed" title="Your decisions" />
          {reviewed.map((b) => (
            <div key={b.id} className="list-row" style={{ padding: '10px 0' }}>
              <Avatar name={b.patient_name || 'Patient'} sm />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small f6">{b.patient_name || 'Patient'}</div>
                <div className="tiny muted">{b.listing_title || 'Consultation'}</div>
              </div>
              {acted[b.id] === 'approved'
                ? <Pill tone="mint" icon={Check}>Approved</Pill>
                : <Pill tone="danger" icon={X}>Declined</Pill>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ============================== PRACTITIONER — SCHEDULE ============================== */
function SchedulePage() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await api.getPractitionerBookings();
        if (on) setBookings(r.bookings || []);
      } catch { /* noop */ } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  if (loading) return <CardSkeleton rows={6} />;

  // group by date
  const groups = {};
  bookings.forEach((b) => {
    const k = b.preferred_date || 'Unscheduled';
    (groups[k] = groups[k] || []).push(b);
  });
  const keys = Object.keys(groups).sort();

  return (
    <div className="col gap-4">
      <div className="stat-row">
        <MiniStat icon={CalendarDays} tone="teal" label="Total appointments" value={bookings.length} />
        <MiniStat icon={Clock} tone="gold" label="Pending" value={bookings.filter((b) => (b.status || 'pending') === 'pending').length} />
        <MiniStat icon={CheckCircle2} tone="mint" label="Confirmed" value={bookings.filter((b) => b.status === 'confirmed').length} />
      </div>

      {keys.length ? keys.map((k) => (
        <Card key={k}>
          <SectionHead eyebrow={k === 'Unscheduled' ? 'To schedule' : fmtDate(k)} title={`${groups[k].length} appointment${groups[k].length > 1 ? 's' : ''}`} />
          {groups[k].map((b) => (
            <div key={b.id} className="list-row" style={{ padding: '12px 0' }}>
              <Chip icon={Clock} tone="teal" sm />
              <div style={{ width: 64 }} className="small f6 mono">{b.preferred_time || '—'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small f6">{b.patient_name || 'Patient'}</div>
                <div className="tiny muted">{b.listing_title || 'Consultation'}</div>
              </div>
              <Pill tone={b.status === 'confirmed' ? 'mint' : b.status === 'cancelled' ? 'danger' : 'gold'}>{b.status || 'pending'}</Pill>
            </div>
          ))}
        </Card>
      )) : <Empty icon={CalendarDays} title="No appointments scheduled" sub="When patients book with you, they'll appear here organized by day." />}
    </div>
  );
}

/* ============================== PRACTITIONER — PATIENTS ============================== */
function PatientsPage() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null); // { id, name }

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await api.getPractitionerBookings();
        if (on) setBookings(r.bookings || []);
      } catch { /* noop */ } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  if (loading) return <CardSkeleton rows={6} />;

  // detail view: a single patient's timeline
  if (selected) {
    return (
      <div className="col gap-4">
        <div className="row gap-3" style={{ alignItems: 'center' }}>
          <Btn icon={ChevronRight} className="ghost" style={{ transform: 'rotate(180deg)' }} onClick={() => setSelected(null)} aria-label="Back" />
          <Avatar name={selected.name} />
          <div>
            <div className="card-title">{selected.name}</div>
            <div className="small muted">Complete patient history & trends</div>
          </div>
        </div>
        <TrendCharts loader={(p) => api.getVitalsTrends(p)} userId={selected.id} />
        <HealthTimeline
          loader={(p) => api.getPatientTimeline(selected.id, p)}
          exporter={(b) => api.exportTimeline(b)}
          exportUserId={selected.id}
          title={`${selected.name}'s timeline`}
          subtitle="Click any event to review details or add a clinical note."
          clusterBy="day"
          extraNote={(event) => <ClinicalNote event={event} />}
        />
      </div>
    );
  }

  // derive unique patients from bookings (keyed by user_id so we can drill in)
  const map = {};
  bookings.forEach((b) => {
    const id = b.user_id || b.patient_name || 'unknown';
    const name = b.patient_name || 'Unknown patient';
    if (!map[id]) map[id] = { id: b.user_id || null, name, visits: 0, last: null, statuses: [] };
    map[id].visits += 1;
    map[id].statuses.push(b.status || 'pending');
    if (!map[id].last || (b.preferred_date && b.preferred_date > map[id].last)) map[id].last = b.preferred_date;
  });
  let patients = Object.values(map);
  if (q.trim()) patients = patients.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="col gap-4">
      <Card>
        <div className="row gap-3 wrap" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionHead eyebrow="Panel" title="Your patients" />
          <div className="search-inline">
            <Search size={15} />
            <input placeholder="Search patients…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {patients.length ? (
          <div className="patient-grid">
            {patients.map((p) => (
              <div key={p.id || p.name} className="patient-card"
                style={{ cursor: p.id ? 'pointer' : 'default' }}
                onClick={() => p.id && setSelected({ id: p.id, name: p.name })}
                title={p.id ? 'View patient timeline' : 'No linked record'}>
                <Avatar name={p.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small f6 ellipsis">{p.name}</div>
                  <div className="tiny muted">{p.visits} visit{p.visits > 1 ? 's' : ''} · last {p.last ? fmtShort(p.last) : '—'}</div>
                </div>
                {p.id ? <ChevronRight size={16} style={{ color: 'var(--muted-2)' }} /> : <Pill tone="teal">{p.visits}</Pill>}
              </div>
            ))}
          </div>
        ) : <Empty icon={Users} title="No patients yet" sub="Patients who book appointments with you will appear here." />}
      </Card>
    </div>
  );
}

/* ============================== ADMIN — ANALYTICS ============================== */
function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await api.getAdminOverview();
        if (on) setStats(r.stats || null);
      } catch { /* noop */ } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  if (loading) return <div className="grid-2"><CardSkeleton rows={4} /><CardSkeleton rows={4} /></div>;
  if (!stats) return <Empty icon={Activity} title="No analytics available" />;

  const cards = [
    { label: 'Total members', value: stats.users, icon: Users, tone: 'teal' },
    { label: 'Patients', value: stats.patients, icon: HeartPulse, tone: 'mint' },
    { label: 'Practitioners', value: stats.practitioners, icon: Stethoscope, tone: 'gold' },
    { label: 'Listings', value: stats.listings, icon: Building2, tone: 'teal' },
    { label: 'Bookings', value: stats.bookings, icon: CalendarDays, tone: 'mint' },
    { label: 'Assessments', value: stats.assessments, icon: ClipboardList, tone: 'gold' },
  ];
  const barData = [
    { name: 'Patients', value: Number(stats.patients) || 0 },
    { name: 'Practitioners', value: Number(stats.practitioners) || 0 },
    { name: 'Listings', value: Number(stats.listings) || 0 },
    { name: 'Bookings', value: Number(stats.bookings) || 0 },
    { name: 'Assessments', value: Number(stats.assessments) || 0 },
  ];
  const BAR_COLORS = ['#2FBE9F', '#0E5C57', '#D69B33', '#6FCF97', '#0A524C'];

  return (
    <div className="col gap-4">
      <div className="metric-grid">
        {cards.map((c) => (
          <Card key={c.label} pad="sm">
            <div className="row gap-3" style={{ alignItems: 'center' }}>
              <Chip icon={c.icon} tone={c.tone} />
              <div>
                <div className="h2" style={{ lineHeight: 1 }}>{c.value ?? 0}</div>
                <div className="tiny muted">{c.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid-2">
        <Card>
          <SectionHead eyebrow="Distribution" title="Platform footprint" />
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5b6f6c' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#5b6f6c' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(14,92,87,0.06)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e3ece9', fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionHead eyebrow="Economy" title="LOVE in circulation" />
          <div className="col gap-3" style={{ marginTop: 8 }}>
            <div className="love-hero">
              <Coins size={22} />
              <div>
                <div className="h1" style={{ lineHeight: 1 }}>{(Number(stats.lovePoints) || 0).toLocaleString()}</div>
                <div className="tiny muted">Total LOVE points issued across the network</div>
              </div>
            </div>
            <div className="row gap-3 wrap">
              <MiniStat icon={Users} tone="teal" label="Avg / user" value={stats.users ? Math.round((Number(stats.lovePoints) || 0) / Number(stats.users)) : 0} />
              <MiniStat icon={TrendingUp} tone="mint" label="Active patients" value={stats.patients ?? 0} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================== ADMIN — USER MANAGEMENT ============================== */
function UserManagementPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await api.getAdminUsers();
        if (on) setUsers(r.users || []);
      } catch { /* noop */ } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  if (loading) return <CardSkeleton rows={8} />;

  let rows = users;
  if (roleFilter !== 'all') rows = rows.filter((u) => u.role === roleFilter);
  if (q.trim()) rows = rows.filter((u) => (u.full_name || '').toLowerCase().includes(q.toLowerCase()) || (u.email || '').toLowerCase().includes(q.toLowerCase()));

  const roleTone = (r) => (r === 'admin' ? 'gold' : r === 'practitioner' ? 'teal' : 'mint');

  return (
    <Card>
      <div className="row gap-3 wrap" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHead eyebrow="Access" title="User management" action={<Pill tone="gray">{users.length} total</Pill>} />
        <div className="row gap-2 wrap">
          <div className="seg">
            {['all', 'patient', 'practitioner', 'admin'].map((r) => (
              <button key={r} className={`seg-btn ${roleFilter === r ? 'on' : ''}`} onClick={() => setRoleFilter(r)}>{r === 'all' ? 'All' : roleLabel(r)}</button>
            ))}
          </div>
          <div className="search-inline">
            <Search size={15} />
            <input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="luca-table">
          <thead>
            <tr><th>User</th><th>Role</th><th>Status</th><th>Location</th><th className="ar">LOVE</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="row gap-2" style={{ alignItems: 'center' }}>
                    <Avatar name={u.full_name || u.email} sm />
                    <div style={{ minWidth: 0 }}>
                      <div className="small f6 ellipsis">{u.full_name || '—'}</div>
                      <div className="tiny muted ellipsis">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td><Pill tone={roleTone(u.role)}>{roleLabel(u.role)}</Pill></td>
                <td><Pill tone={u.onboarding_status === 'complete' ? 'mint' : 'gold'}>{u.onboarding_status || 'pending'}</Pill></td>
                <td className="tiny muted">{[u.city, u.country].filter(Boolean).join(', ') || '—'}</td>
                <td className="ar small f6 t-gold">{u.love_points ?? 0}</td>
                <td className="tiny muted">{fmtShort(u.created_at)}</td>
              </tr>
            )) : <tr><td colSpan={6}><Empty icon={Users} title="No members match your filters" /></td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ============================== ADMIN — SYSTEM SETTINGS ============================== */
function SystemSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({
    aiCoach: true, publicListings: true, emailNotifs: true,
    autoVerify: false, maintenance: false, openRegistration: true,
  });

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await api.getAdminOverview();
        if (on) setStats(r.stats || null);
      } catch { /* noop */ } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  const toggleKey = (k) => setSettings((s) => ({ ...s, [k]: !s[k] }));

  const toggles = [
    { k: 'aiCoach', icon: Bot, label: 'LUCA AI Coach', sub: 'Enable the AI health companion for all patients.' },
    { k: 'publicListings', icon: Building2, label: 'Public practitioner listings', sub: 'Show verified practitioners in the marketplace.' },
    { k: 'emailNotifs', icon: Bell, label: 'Email notifications', sub: 'Send booking and reward updates by email.' },
    { k: 'autoVerify', icon: BadgeCheck, label: 'Auto-verify credentials', sub: 'Automatically approve low-risk credential submissions.' },
    { k: 'openRegistration', icon: Users, label: 'Open registration', sub: 'Allow new accounts to self-register.' },
    { k: 'maintenance', icon: Settings, label: 'Maintenance mode', sub: 'Temporarily restrict access to admins only.' },
  ];

  return (
    <div className="col gap-4">
      <div className="grid-2">
        <Card>
          <SectionHead eyebrow="Platform" title="Feature controls" />
          <div className="col">
            {toggles.map((t) => (
              <div key={t.k} className="setting-row">
                <Chip icon={t.icon} tone="teal" sm />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small f6">{t.label}</div>
                  <div className="tiny muted">{t.sub}</div>
                </div>
                <Toggle on={settings[t.k]} onClick={() => toggleKey(t.k)} />
              </div>
            ))}
          </div>
        </Card>
        <div className="col gap-4">
          <Card>
            <SectionHead eyebrow="Health" title="System status" />
            <div className="col gap-3" style={{ marginTop: 6 }}>
              <div className="status-line"><span className="dot ok" /> <span className="small f6">API services</span><Pill tone="mint" icon={Check}>Operational</Pill></div>
              <div className="status-line"><span className="dot ok" /> <span className="small f6">Database</span><Pill tone="mint" icon={Check}>Healthy</Pill></div>
              <div className="status-line"><span className="dot ok" /> <span className="small f6">Sovereign vault export</span><Pill tone="mint" icon={Check}>Ready</Pill></div>
              <div className="status-line"><span className={`dot ${settings.maintenance ? 'warn' : 'ok'}`} /> <span className="small f6">Public access</span>
                <Pill tone={settings.maintenance ? 'gold' : 'mint'}>{settings.maintenance ? 'Restricted' : 'Live'}</Pill></div>
            </div>
          </Card>
          {loading ? <CardSkeleton rows={3} /> : stats && (
            <Card>
              <SectionHead eyebrow="At a glance" title="Network scale" />
              <div className="row gap-3 wrap" style={{ marginTop: 6 }}>
                <MiniStat icon={Users} tone="teal" label="Users" value={stats.users ?? 0} />
                <MiniStat icon={Building2} tone="gold" label="Listings" value={stats.listings ?? 0} />
                <MiniStat icon={CalendarDays} tone="mint" label="Bookings" value={stats.bookings ?? 0} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}



/* ============================== PATIENT — TIMELINE ============================== */
function TimelinePage({ user }) {
  return (
    <div className="col gap-4">
      <TrendCharts loader={(p) => api.getVitalsTrends(p)} />
      <HealthTimeline
        loader={(p) => api.getTimeline(p)}
        exporter={(b) => api.exportTimeline(b)}
        title="Your health journey"
        subtitle="Every check-in, appointment, assessment and coach session — in one place."
        clusterBy="day"
      />
    </div>
  );
}

/* ============================== SHARED — CLINICAL NOTE ON EVENT ============================== */
function ClinicalNote({ event }) {
  const key = `luca_note_${event.id}`;
  const [note, setNote] = useState(() => { try { return localStorage.getItem(key) || ''; } catch { return ''; } });
  const [saved, setSaved] = useState(false);
  const save = () => {
    try { localStorage.setItem(key, note); setSaved(true); setTimeout(() => setSaved(false), 1500); } catch { /* noop */ }
  };
  return (
    <div className="col gap-2" style={{ marginTop: 4 }}>
      <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={13} /> Clinical note</div>
      <textarea className="input-line" placeholder="Add a private clinical note for this event…"
        value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        {saved && <span className="pill mint" style={{ alignSelf: 'center' }}><Check size={12} /> Saved</span>}
        <Btn variant="primary" icon={Check} onClick={save}>Save note</Btn>
      </div>
    </div>
  );
}

/* ============================== ADMIN — SYSTEM TIMELINE ============================== */
function SystemTimelinePage() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await api.getSystemTimeline({ limit: 1 });
        if (on) setSeries(r?.series || []);
      } catch { /* noop */ } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  return (
    <div className="col gap-4">
      <Card>
        <SectionHead eyebrow="Usage over time" title="Platform activity" />
        {loading ? (
          <Skel h={240} />
        ) : series.length === 0 ? (
          <Empty icon={Activity} title="No activity yet" sub="Sign-ups, assessments and bookings will chart here." />
        ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="sysReg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0EA5A0" stopOpacity={0.35} /><stop offset="100%" stopColor="#0EA5A0" stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="sysAsm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.35} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} /></linearGradient>
                  <linearGradient id="sysBk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBF3F0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5b6f6c' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#5b6f6c' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e3ece9', fontSize: 12 }} />
                <Area type="monotone" dataKey="registration" name="Sign-ups" stroke="#0EA5A0" strokeWidth={2} fill="url(#sysReg)" />
                <Area type="monotone" dataKey="assessment" name="Assessments" stroke="#8B5CF6" strokeWidth={2} fill="url(#sysAsm)" />
                <Area type="monotone" dataKey="appointment" name="Bookings" stroke="#3B82F6" strokeWidth={2} fill="url(#sysBk)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <HealthTimeline
        loader={(p) => api.getSystemTimeline(p)}
        title="System events"
        subtitle="Registrations, assessments and bookings across the network."
        clusterBy="day"
      />
    </div>
  );
}

/* ============================== SOLARIS — IDENTITY & DATA ============================== */
function IdentityPage({ user }) {
  const [payOpen, setPayOpen] = useState(false);
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="idpage-grid">
        <IdentityCard user={user} />
        <WalletCard user={user} />
      </div>

      <Card>
        <SectionHead eyebrow="GPS — Global Prosperous Split" title="See value flow through the ecosystem" />
        <p className="small" style={{ color: 'var(--muted)', margin: '4px 0 14px', maxWidth: 620, lineHeight: 1.6 }}>
          Run a simulated treatment-plan payment and watch it split across the provider, your onboarder,
          the local node, and the regenerative commons — each leg cryptographically proven. No real funds move.
        </p>
        <Btn variant="primary" icon={Zap} onClick={() => setPayOpen(true)}>Simulate a GPS payment</Btn>
      </Card>

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        orgName="Aura Dental"
        planLabel="Dental Restoration"
        amountSats={1500000}
        onPaid={() => toast.success('Value distributed across the ecosystem (simulated)')}
      />

      <style>{`
        .luca .idpage-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
        @media(max-width:820px){.luca .idpage-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}

/* ============================== ERROR BOUNDARY ============================== */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(err) { /* eslint-disable-next-line no-console */ console.error('Section crashed:', err); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#5b6b66', fontSize: 14 }}>
          This section failed to load.{' '}
          <button onClick={() => this.setState({ error: null })}
            style={{ marginLeft: 8, background: '#0A2B29', color: '#EAFBF4', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================== HEALTH PASSPORT (with internal sections) ============================== */

/* Reads an optional file as metadata only (we never process contents here). */
function fileMeta(file) {
  return { filename: file?.name || null, fileSize: file?.size || null, mimeType: file?.type || null };
}

/* A3 provenance ladder (L0–L5) badge — shows how trustworthy a stored fact is. */
const PROVENANCE_META = {
  0: { label: 'L0 · Self-declared', bg: '#F6E9DC', ink: '#7A4A1E' },
  1: { label: 'L1 · Observed', bg: '#EDEFF2', ink: '#59636E' },
  2: { label: 'L2 · Peer-attested', bg: '#FBEFD3', ink: '#8A5F13' },
  3: { label: 'L3 · Institution-verified', bg: '#E4EEFB', ink: '#2C568F' },
  4: { label: 'L4 · Lab-verified*', bg: '#E6F7F0', ink: '#0A5C46' },
  5: { label: 'L5 · Governed', bg: '#EDE6FA', ink: '#4E3785' },
};
function ProvenanceBadge({ level }) {
  const m = PROVENANCE_META[level] ?? PROVENANCE_META[0];
  const pending = level === 4; // member-marked lab result, verification pending
  return (
    <span title={pending ? 'Recorded at L4 — pending verification by an accredited source' : m.label}
      style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: m.bg, color: m.ink, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

/* "Share something with LUCA" — description + optional file → LUCA educational summary. */
// Two entry points on the A3 provenance ladder that a member can self-submit.
const HD_KINDS = [
  { id: 'note', label: 'Personal note', level: 0, source: 'self', hint: 'Something you noticed — a symptom, feeling or observation. Stored as your own words (L0).' },
  { id: 'result', label: 'Lab / test result', level: 4, source: 'self', hint: 'A lab or test result you\'re sharing. Recorded at L4, pending verification by an accredited source.' },
];

function HealthDataUpload({ onSaved }) {
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState('note');
  const [observedAt, setObservedAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async () => {
    const text = description.trim();
    if (!text || saving) return;
    setSaving(true); setError(''); setResult(null);
    try {
      const meta = file ? fileMeta(file) : {};
      const k = HD_KINDS.find((x) => x.id === kind) || HD_KINDS[0];
      const { document } = await api.createHealthDocument({
        description: text,
        docType: file ? 'upload' : 'note',
        level: k.level,
        source: k.source,
        observedAt: observedAt || null,
        ...meta,
      });
      setResult(document);
      setDescription(''); setFile(null); setObservedAt('');
      onSaved?.(document);
    } catch (e) {
      setError(e?.message || 'Could not save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="col gap-3">
      <div>
        <div className="f6" style={{ color: 'var(--ink)' }}>Share something with LUCA</div>
        <div className="small muted" style={{ marginTop: 2 }}>
          Describe what you're sharing — lab results, a symptom, test results, anything relevant. LUCA will add a warm,
          educational summary to your Passport. LUCA educates and prepares you — it never diagnoses.
        </div>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. My recent blood test showed low vitamin D and slightly high cholesterol…"
        rows={4}
        style={{
          width: '100%', resize: 'vertical', borderRadius: 12, border: '1px solid var(--line,#e3ece8)',
          padding: '11px 13px', fontFamily: 'inherit', fontSize: 13.5, color: 'var(--ink)', background: 'var(--surface,#fff)',
        }}
      />
      <div>
        <div className="tiny f6" style={{ color: 'var(--muted,#6b807a)', marginBottom: 6 }}>What kind of data is this?</div>
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          {HD_KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => setKind(k.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                border: kind === k.id ? '2px solid #2DB584' : '1px solid var(--line,#dde7e2)',
                background: kind === k.id ? '#e6f7f0' : 'var(--surface,#fff)',
                color: kind === k.id ? '#0A2B29' : '#6b807a',
              }}>
              {k.id === 'result' ? <Stethoscope size={13} /> : <Activity size={13} />}{k.label}
              <span style={{ fontSize: 10, fontWeight: 700, opacity: .8 }}>· L{k.level}</span>
            </button>
          ))}
        </div>
        <div className="tiny muted" style={{ marginTop: 6, lineHeight: 1.5 }}>{(HD_KINDS.find((x) => x.id === kind) || HD_KINDS[0]).hint}</div>
      </div>
      <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="tiny f6" style={{ color: 'var(--muted,#6b807a)' }}>When observed (optional)</span>
        <input type="date" value={observedAt} max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setObservedAt(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--line,#dde7e2)', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink)' }} />
      </div>
      <div className="row gap-3" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="btn" style={{ cursor: 'pointer' }}>
          <FileText size={15} strokeWidth={2.2} />{file ? 'Change file' : 'Attach file (optional)'}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
        </label>
        {file && <span className="tiny muted">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>}
        <Btn variant="primary" icon={Sparkles} onClick={submit} disabled={saving || !description.trim()} style={{ marginLeft: 'auto' }}>
          {saving ? 'LUCA is reading…' : 'Share with LUCA'}
        </Btn>
      </div>
      {error && <div className="tiny" style={{ color: '#B4483D' }}>{error}</div>}
      {result && (
        <div className="card-low" style={{ background: 'rgba(78,222,163,0.06)', border: '1px solid rgba(78,222,163,0.18)', borderRadius: 12, padding: '12px 14px' }}>
          <div className="row gap-2" style={{ marginBottom: 6 }}><Sparkles size={14} className="t-teal" /><span className="label t-mint">Health data added — LUCA's summary</span></div>
          <div className="small" style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result.luca_summary}</div>
        </div>
      )}
    </div>
  );
}

/* "Actions" card + shared health data form + document list, always at the top of the Passport. */
// Foundational Health Data — the member's self-reported baseline (spec A5),
// carried across the care team at provenance L2. Only shown once collected.
const FHD_LABELS = {
  full_name: 'Full name', date_of_birth: 'Date of birth', email: 'Email', phone: 'Phone',
  address: 'Address', systemic_conditions: 'Conditions', medications_supplements: 'Medications & supplements',
  allergies: 'Allergies', smoking_status: 'Smoking', smoking_years: 'Years smoking',
  substance_use: 'Substance use', substance_reason: 'Reason', substance_method: 'Method',
  visit_reason: 'Reason for visit', referral_source: 'Heard about us via', communication_pref: 'Preferred contact',
};
function FoundationalHealthSection() {
  const [f, setF] = useState(undefined);
  useEffect(() => {
    let on = true;
    api.getIntakeFoundational()
      .then((r) => { if (on) setF(r && r.foundational ? r.foundational : null); })
      .catch(() => { if (on) setF(null); });
    return () => { on = false; };
  }, []);
  if (f === undefined) return null;
  if (!f || !f.data || !Object.keys(f.data).length) return null;
  const d = f.data;
  const rows = Object.keys(FHD_LABELS)
    .filter((k) => d[k] !== undefined && d[k] !== null && d[k] !== '' && !(Array.isArray(d[k]) && !d[k].length))
    .map((k) => ({ label: FHD_LABELS[k], value: Array.isArray(d[k]) ? d[k].join(', ') : String(d[k]) }));
  if (!rows.length) return null;
  return (
    <Card>
      <SectionHead eyebrow="Yours, carried across your care team" title="Foundational Health Data"
        action={<ProvenanceBadge level={f.level ?? 2} />} />
      <div className="tiny muted" style={{ marginBottom: 10 }}>
        Self-reported {f.observedAt ? `· updated ${fmtShort(f.observedAt)}` : ''}{f.updatedWithin12Months ? ' · current' : ''}
      </div>
      <div className="col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="between" style={{ gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line,#eef3f1)' }}>
            <span className="tiny f6" style={{ color: 'var(--muted)', flex: 'none', minWidth: 130 }}>{r.label}</span>
            <span className="small" style={{ color: 'var(--ink)', textAlign: 'right' }}>{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Clinic intake forms shared through the Passport (only shown when ≥1 exists).
function IntakeFormsSection() {
  const [subs, setSubs] = useState(null);
  useEffect(() => {
    let on = true;
    api.getMyIntakeSubmissions()
      .then((r) => { if (on) setSubs(r.submissions || []); })
      .catch(() => { if (on) setSubs([]); });
    return () => { on = false; };
  }, []);

  if (!subs || subs.length === 0) return null;

  const statusPill = (s) => {
    if (s === 'reviewed') return <Pill tone="teal" icon={CheckCircle2}>Reviewed</Pill>;
    if (s === 'submitted') return <Pill tone="mint" icon={Check}>Submitted</Pill>;
    return <Pill tone="gold" icon={Clock}>Awaiting you</Pill>;
  };

  return (
    <Card>
      <SectionHead eyebrow="From your practitioners" title="Clinic intake forms" action={<Pill tone="gray">{subs.length}</Pill>} />
      <div className="col gap-3">
        {subs.map((s) => (
          <div key={s.id} className="card-low" style={{ padding: '13px 15px', borderRadius: 12 }}>
            <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row gap-2" style={{ marginBottom: 4 }}>
                  <ClipboardList size={14} className="t-teal" />
                  <span className="small f6" style={{ color: 'var(--ink)' }}>{s.template_name || 'Intake form'}</span>
                </div>
                <div className="tiny muted">
                  {s.provider_name ? `${s.provider_name} · ` : ''}{fmtShort(s.submitted_at || s.created_at)}
                </div>
              </div>
              <div className="row gap-2" style={{ flex: 'none', alignItems: 'center' }}>
                {statusPill(s.status)}
                {s.status === 'pending' ? (
                  <Btn variant="primary" icon={ClipboardList} onClick={() => { window.location.href = `/intake?id=${s.id}`; }}>Complete</Btn>
                ) : (
                  <Btn icon={Eye} onClick={() => { window.location.href = `/intake?id=${s.id}`; }}>View</Btn>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PassportActions({ go }) {
  const { startRetake, setExploreFilter } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try { const d = await api.getHealthDocuments(); setDocs(d?.documents || []); }
    catch { setDocs([]); }
    finally { setLoadingDocs(false); }
  }, []);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  const bookMoreTests = () => { setExploreFilter?.('diagnostic'); go?.('explore'); };

  const removeDoc = async (id) => {
    try { await api.deleteHealthDocument(id); setDocs((d) => d.filter((x) => x.id !== id)); } catch { /* noop */ }
  };

  return (
    <div className="col gap-4">
      <Card>
        <SectionHead eyebrow="Your Sovereign Passport" title="Actions" />
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          <div className="card-low" style={{ padding: '14px', borderRadius: 14 }}>
            <div className="row gap-2" style={{ marginBottom: 8 }}><Chip icon={Activity} tone="teal" sm /><span className="small f6">Update your intake</span></div>
            <p className="tiny muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>Your previous scores are saved. LUCA will notice what changed.</p>
            <Btn variant="primary" icon={RefreshCw} onClick={() => startRetake?.()}>Update my Solaris intake</Btn>
          </div>
          <div className="card-low" style={{ padding: '14px', borderRadius: 14 }}>
            <div className="row gap-2" style={{ marginBottom: 8 }}><Chip icon={FileText} tone="gold" sm /><span className="small f6">Add health data</span></div>
            <p className="tiny muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>Share labs, symptoms or results — LUCA adds an educational summary.</p>
            <Btn variant={showAdd ? '' : 'primary'} icon={showAdd ? X : Plus} onClick={() => setShowAdd((s) => !s)}>{showAdd ? 'Close' : 'Add health data'}</Btn>
          </div>
          <div className="card-low" style={{ padding: '14px', borderRadius: 14 }}>
            <div className="row gap-2" style={{ marginBottom: 8 }}><Chip icon={Stethoscope} tone="mint" sm /><span className="small f6">Book more tests</span></div>
            <p className="tiny muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>Explore lab panels and diagnostic screens matched to your journey.</p>
            <Btn icon={Compass} onClick={bookMoreTests}>Book more tests</Btn>
          </div>
        </div>

        {showAdd && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line,#e3ece8)' }}>
            <HealthDataUpload onSaved={loadDocs} />
          </div>
        )}
      </Card>

      <FoundationalHealthSection />

      <IntakeFormsSection />

      <Card>
        <SectionHead eyebrow="Shared with LUCA" title="My health documents" action={<Pill tone="gray">{docs.length}</Pill>} />
        {loadingDocs ? (
          <CardSkeleton rows={2} />
        ) : docs.length === 0 ? (
          <Empty icon={FileText} title="Nothing shared yet" sub="Use “Add health data” above to share labs, symptoms or results. LUCA keeps a warm, educational summary here." />
        ) : (
          <div className="col gap-3">
            {docs.map((d) => (
              <div key={d.id} className="card-low" style={{ padding: '13px 15px', borderRadius: 12 }}>
                <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row gap-2" style={{ marginBottom: 4 }}>
                      <FileText size={14} className="t-teal" />
                      <span className="small f6" style={{ color: 'var(--ink)' }}>{d.filename || (d.doc_type === 'note' ? 'Shared note' : 'Health data')}</span>
                      {d.provenance_level != null && <ProvenanceBadge level={d.provenance_level} />}
                      <span className="tiny muted2">· {fmtShort(d.observed_at || d.created_at)}</span>
                    </div>
                    {d.description && <div className="tiny muted" style={{ marginBottom: 6 }}>{d.description}</div>}
                    {d.luca_summary && <div className="small" style={{ color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{d.luca_summary}</div>}
                  </div>
                  <button onClick={() => removeDoc(d.id)} aria-label="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted,#6b807a)', flex: 'none' }}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const HP_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'bookings', label: 'My Bookings' },
];
function HealthPassportPage({ user, go }) {
  const [hpTab, setHpTab] = useState('overview');
  return (
    <div className="col gap-4">
      <ErrorBoundary><PassportActions go={go} /></ErrorBoundary>
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--line,#e3ece8)', marginBottom: 6, flexWrap: 'wrap' }}>
        {HP_TABS.map((t) => {
          const active = hpTab === t.id;
          return (
            <button key={t.id} onClick={() => setHpTab(t.id)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13.5, fontWeight: 600, padding: '9px 15px', marginBottom: -1,
              color: active ? '#0A2B29' : '#6b807a',
              borderBottom: active ? '2px solid #36C9A9' : '2px solid transparent',
            }}>{t.label}</button>
          );
        })}
      </div>
      {hpTab === 'overview' && <ErrorBoundary><HealthPage go={go} /></ErrorBoundary>}
      {hpTab === 'timeline' && <ErrorBoundary><TimelinePage user={user} /></ErrorBoundary>}
      {hpTab === 'appointments' && <ErrorBoundary><AppointmentsPage /></ErrorBoundary>}
      {hpTab === 'bookings' && <ErrorBoundary><MyBookings user={user} onExplore={() => go('explore')} /></ErrorBoundary>}
    </div>
  );
}

/* ============================== ECONOMIC PASSPORT (with Community Treasury) ============================== */


function EconomicPassportPage({ user }) {
  return (
    <div className="col gap-4">

      {/* ── Coming Soon Banner ── */}
      <div style={{
        borderRadius: 16,
        background: 'linear-gradient(120deg, #0A2B29 0%, #134d3a 60%, #1a3d5c 100%)',
        padding: '24px 22px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative glow */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.18,
          background: 'radial-gradient(circle at 80% 20%, #2DB584 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              background: 'rgba(45,181,132,0.22)', color: '#2DB584',
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>Coming Soon</span>
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            Economic Passport
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, maxWidth: 480 }}>
            Your sovereign economic identity, powered by GPS — the Global Prosperous Split.
            90% of every payment goes to your practitioner, always; up to 10% flows through a regenerative
            envelope back into the ecosystem. Full activation is on the way — everything below is a simulated preview.
          </p>
        </div>
      </div>

      {/* ── What is GPS — interactive explainer ── */}
      <ErrorBoundary><GpsExplainer /></ErrorBoundary>

      {/* ── My Payments — the member's payment history + CSV export (Sprint F) ── */}
      <ErrorBoundary><MemberPayments /></ErrorBoundary>

      {/* ── Where your payment goes — GPS shadow receipts (M7) ── */}
      <ErrorBoundary><PaymentReceipts /></ErrorBoundary>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'var(--line,#e3ece8)', margin: '2px 0' }} />

      {/* ── Existing Wallet + Treasury (live preview) ── */}
      <ErrorBoundary><WalletPage user={user} /></ErrorBoundary>

      <div style={{ height: 1, background: 'var(--line,#e3ece8)', margin: '6px 0 2px' }} />
      <div>
        <h3 style={{ margin: '0 0 3px', fontSize: 17, color: '#0A2B29', fontFamily: 'inherit', fontWeight: 700 }}>Community Treasury</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6b807a' }}>Regenerative funds flowing back to the community — all values simulated.</p>
        <ErrorBoundary><RegenerativeTreasury user={user} /></ErrorBoundary>
      </div>
    </div>
  );
}

/* ============================== BECOME A PRACTITIONER ============================== */
// "Become a Practitioner" now opens the real provider onboarding wizard
// (ProviderApplication renders its own full-screen overlay). On success we
// close and refresh the user so their new provider status takes effect.
function BecomeAPractitionerModal({ user, onClose, onSubmitted }) {
  return (
    <ProviderApplication
      user={user}
      onClose={onClose}
      onSubmitted={() => { onClose?.(); onSubmitted?.(); }}
    />
  );
}

/* ============================== PAGE ROUTER ============================== */
/* =============================== INBOX =============================== */
function InboxPage({ user, go, onUnread }) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);

  const load = useCallback(async () => {
    try {
      const r = await api.getInbox();
      setMessages(r.messages || []);
      const unread = (r.messages || []).filter((m) => !m.is_read).length;
      onUnread?.(unread);
    } catch { setMessages([]); }
    finally { setLoading(false); }
  }, [onUnread]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (m) => {
    if (m.is_read) return;
    try { await api.markInboxRead(m.id); } catch { /* ignore */ }
    setMessages((prev) => {
      const next = prev.map((x) => (x.id === m.id ? { ...x, is_read: true } : x));
      onUnread?.(next.filter((x) => !x.is_read).length);
      return next;
    });
  };

  const openAction = (m) => {
    markRead(m);
    if (m.action_url) window.location.href = m.action_url;
  };

  const iconFor = (t) => (t === 'intake_request' ? ClipboardList : t === 'booking_confirmation' ? CalendarCheck : Mail);

  if (loading) return <div className="grid" style={{ gap: 14 }}><CardSkeleton rows={2} /><CardSkeleton rows={2} /></div>;

  if (!messages.length) {
    return (
      <Card>
        <Empty icon={Inbox} title="Your inbox is quiet for now"
          sub="Booking confirmations and intake requests from your practitioners will appear here." />
      </Card>
    );
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      {messages.map((m) => {
        const Icon = iconFor(m.message_type);
        return (
          <Card key={m.id} className={`inbox-msg ${m.is_read ? '' : 'unread'}`} style={{ cursor: m.action_url ? 'default' : 'pointer' }}>
            <div className="row gap-3" style={{ alignItems: 'flex-start' }} onClick={() => markRead(m)}>
              <div className={`chip ${m.message_type === 'intake_request' ? 'gold' : 'mint'}`} style={{ width: 40, height: 40, flex: 'none' }}>
                <Icon size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="between" style={{ gap: 10 }}>
                  <div className="f6" style={{ color: 'var(--ink)' }}>{m.subject}</div>
                  {!m.is_read && <span className="inbox-dot" title="Unread" />}
                </div>
                <div className="tiny muted" style={{ marginTop: 2 }}>
                  {m.sender_name} · {new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
                <div className="small" style={{ color: 'var(--muted)', marginTop: 7, lineHeight: 1.5 }}>{m.body}</div>
                {m.action_url && (
                  <div style={{ marginTop: 12 }}>
                    <Btn variant="primary" icon={ClipboardList} onClick={() => openAction(m)}>{m.action_label || 'Open'}</Btn>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ============================== SUB-TAB BAR ==============================
   A small, accessible pill bar used by the consolidated areas (LUCA Coach,
   Journal, Messages, Economic Passport, Settings). Reuses the existing visual
   language — mint-tinted active pill on a soft neutral track. */
export function SubTabs({ items, active, onSelect, ariaLabel, scroll = false }) {
  const listRef = useRef(null);
  const onKeyDown = (e, idx) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (idx + dir + items.length) % items.length;
    onSelect(items[next].id);
  };
  const hasActive = items.some((x) => x.id === active);
  // Opt-in scroll variant (Economic Passport only): keep the active tab visible
  // when the row overflows horizontally. Other tab bars are unaffected.
  useEffect(() => {
    if (!scroll || !listRef.current) return;
    const el = listRef.current.querySelector('[aria-selected="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [scroll, active]);
  const wrapStyle = scroll
    ? { gap: 4, background: '#F1F5F3', borderRadius: 999, padding: 4, marginBottom: 18, width: '100%', maxWidth: '100%',
        flexWrap: 'nowrap', overflowX: 'auto', scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }
    : { gap: 4, background: '#F1F5F3', borderRadius: 999, padding: 4, marginBottom: 18, width: 'fit-content', maxWidth: '100%' };
  return (
    <div ref={listRef} role="tablist" aria-label={ariaLabel || 'Sections'}
      className={scroll ? 'row subtabs-scroll' : 'row wrap'} style={wrapStyle}>
      {items.map((it, idx) => {
        const Icon = it.icon;
        const on = active === it.id;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={on}
            tabIndex={on || (!hasActive && idx === 0) ? 0 : -1}
            type="button"
            onClick={() => onSelect(it.id)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className="row"
            style={{ gap: 7, alignItems: 'center', border: 'none', cursor: 'pointer', borderRadius: 999, padding: '8px 15px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
              background: on ? '#fff' : 'transparent', color: on ? 'var(--ink)' : 'var(--muted,#8AA09C)',
              boxShadow: on ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
              ...(scroll ? { flexShrink: 0, scrollSnapAlign: 'start' } : {}) }}
          >
            {Icon && <Icon size={15} strokeWidth={2} />} {it.label}
            {it.badge > 0 && <span className="badge" style={{ background: 'var(--gold)', color: '#3C2807', borderRadius: 999, fontSize: 10.5, fontWeight: 700, padding: '1px 7px', marginLeft: 2 }}>{it.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---- Consolidated areas: each renders a sub-tab bar over EXISTING page
   components (no duplication) and reflects the nested sub-tab from the URL. ---- */

function CoachArea({ user, go, sub }) {
  const active = SUBTABS.coach.tabs.includes(sub) ? sub : SUBTABS.coach.def;
  return (
    <div>
      <SubTabs
        ariaLabel="LUCA Coach sections"
        active={active}
        onSelect={(id) => go('coach', id)}
        items={[
          { id: 'coach', label: 'Coach', icon: Bot },
          { id: 'intelligence', label: 'Intelligence', icon: Brain },
        ]}
      />
      {active === 'intelligence'
        ? <ErrorBoundary><IntelligencePage user={user} go={go} /></ErrorBoundary>
        : <CoachPage user={user} go={go} />}
    </div>
  );
}

function JournalArea({ user, go, sub }) {
  const active = SUBTABS.journal.tabs.includes(sub) ? sub : SUBTABS.journal.def;
  return (
    <div>
      <SubTabs
        ariaLabel="Journal sections"
        active={active}
        onSelect={(id) => go('journal', id)}
        items={[
          { id: 'journal', label: 'Journal', icon: BookOpen },
          { id: 'growth', label: 'Growth', icon: Compass },
          { id: 'media', label: 'Media', icon: Headphones },
        ]}
      />
      {active === 'media'
        ? <ErrorBoundary><MediaPage user={user} go={go} /></ErrorBoundary>
        : <ErrorBoundary><JournalPage user={user} go={go} forcedView={active === 'growth' ? 'grow' : 'reflect'} hideToggle /></ErrorBoundary>}
    </div>
  );
}

function MessagesArea({ user, go, sub, onUnread, onInboxUnread }) {
  const active = SUBTABS.messages.tabs.includes(sub) ? sub : SUBTABS.messages.def;
  return (
    <div>
      <SubTabs
        ariaLabel="Messages sections"
        active={active}
        onSelect={(id) => go('messages', id)}
        items={[
          { id: 'conversations', label: 'Conversations', icon: MessageSquare },
          { id: 'inbox', label: 'Inbox', icon: Inbox },
        ]}
      />
      {active === 'inbox'
        ? <ErrorBoundary><InboxPage user={user} go={go} onUnread={onInboxUnread} /></ErrorBoundary>
        : <SecureChat user={user} onUnread={onUnread} />}
    </div>
  );
}

/* Communications — one destination that merges the former Journal + Messages.
   Two accessible segmented controls: "With Others" (Messages, Inbox) and
   "With Yourself" (Journal, Growth, Media). Every section is URL-backed and
   reuses the existing page components (no duplicated functionality). */
function CommunicationsArea({ user, go, sub, onUnread, onInboxUnread }) {
  const active = SUBTABS.communications.tabs.includes(sub) ? sub : SUBTABS.communications.def;
  const withOthers = [
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
  ];
  const withYourself = [
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'growth', label: 'Growth', icon: Compass },
    { id: 'media', label: 'Media', icon: Headphones },
  ];
  const groupLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#8AA09C)', marginBottom: 6 };
  let body;
  if (active === 'inbox') body = <ErrorBoundary><InboxPage user={user} go={go} onUnread={onInboxUnread} /></ErrorBoundary>;
  else if (active === 'journal' || active === 'growth') body = <ErrorBoundary><JournalPage user={user} go={go} forcedView={active === 'growth' ? 'grow' : 'reflect'} hideToggle /></ErrorBoundary>;
  else if (active === 'media') body = <ErrorBoundary><MediaPage user={user} go={go} /></ErrorBoundary>;
  else body = <SecureChat user={user} onUnread={onUnread} />;
  return (
    <div>
      <div className="comm-groups" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 24px', alignItems: 'flex-start', marginBottom: 4 }}>
        <div className="comm-group">
          <div style={groupLabel}>With Others</div>
          <SubTabs ariaLabel="With Others" active={active} onSelect={(id) => go('communications', id)} items={withOthers} />
        </div>
        <div className="comm-group">
          <div style={groupLabel}>With Yourself</div>
          <SubTabs ariaLabel="With Yourself" active={active} onSelect={(id) => go('communications', id)} items={withYourself} />
        </div>
      </div>
      {body}
    </div>
  );
}

function EconomicPassportArea({ user, go, sub }) {
  const active = SUBTABS.wallet.tabs.includes(sub) ? sub : SUBTABS.wallet.def;
  return (
    <div>
      <SubTabs
        ariaLabel="Economic Passport sections"
        scroll
        active={active}
        onSelect={(id) => go('wallet', id)}
        items={[
          { id: 'wallet', label: 'Wallet', icon: Wallet },
          { id: 'gps', label: 'GPS', icon: EconomicPassportIcon },
          { id: 'contributions', label: 'Contributions', icon: Award },
          { id: 'network', label: 'Network', icon: MapPin },
        ]}
      />
      {active === 'wallet'
        ? <ErrorBoundary><SparkWalletScreen /></ErrorBoundary>
        : active === 'contributions'
          ? <ErrorBoundary><ContributionLedger user={user} /></ErrorBoundary>
          : active === 'network'
            ? <ErrorBoundary><GPSMapView /></ErrorBoundary>
            : <ErrorBoundary><EconomicPassportPage user={user} /></ErrorBoundary>}
    </div>
  );
}

/* ============================== ACCOUNT SETTINGS ==============================
   One destination, five sections. Every control here maps to an EXISTING,
   genuinely-persisting endpoint (PATCH /users/me, PUT /users/profile, avatar
   upload, data export). PUT /users/profile is a full upsert, so we always load
   the current profile, merge the changed fields, and resubmit the whole object.
   No decorative toggles, no password field (no endpoint), and private keys /
   recovery phrases are never shown or stored. */

// Map a loaded user_profiles row (snake_case) to the PUT /profile body (camelCase),
// preserving every field so a partial save never wipes the rest.
function profileRowToBody(row) {
  const r = row || {};
  let goals = [];
  try { goals = Array.isArray(r.goals_json) ? r.goals_json : JSON.parse(r.goals_json || '[]'); } catch { goals = []; }
  return {
    dateOfBirth: r.date_of_birth || null,
    sexAtBirth: r.sex_at_birth || null,
    genderIdentity: r.gender_identity || null,
    heightCm: r.height_cm || null,
    weightKg: r.weight_kg || null,
    timezone: r.timezone || null,
    goalsText: r.goals_text || null,
    goals,
    mainConcernsText: r.main_concerns_text || null,
    budgetRange: r.budget_range || null,
    carePreference: r.care_preference || null,
    travelWillingness: r.travel_willingness || null,
    wantsPractitionerGuidance: r.wants_practitioner_guidance ?? true,
    wantsWorkshops: r.wants_workshops ?? true,
    wantsRoutines: r.wants_routines ?? true,
    consentPrivacy: r.consent_privacy ?? false,
    consentAiGuidance: r.consent_ai_guidance ?? false,
    consentMarketing: r.consent_marketing ?? false,
  };
}

const SET_INPUT = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line,#e3ece8)', background: '#fff', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none' };
const SET_LABEL = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 };

function SetField({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={SET_LABEL}>{label}</label>
      {children}
      {hint && <div className="tiny muted" style={{ marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function SetToggle({ label, hint, checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="row" style={{ width: '100%', textAlign: 'left', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between',
        background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer', padding: '10px 0' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        {hint && <span className="tiny muted" style={{ display: 'block', marginTop: 3 }}>{hint}</span>}
      </span>
      <span aria-hidden="true" style={{ flex: 'none', width: 42, height: 24, borderRadius: 999, background: checked ? 'var(--mint)' : '#cdd9d4', position: 'relative', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </span>
    </button>
  );
}

function SettingsPage({ user, go, sub }) {
  const { refreshUser, logout } = useApp();
  const active = SUBTABS.account.tabs.includes(sub) ? sub : SUBTABS.account.def;
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Account (users table) form
  const [acct, setAcct] = useState({ firstName: '', lastName: '', country: '', city: '', phone: '', bio: '', language: '' });
  const [savingAcct, setSavingAcct] = useState(false);
  const [savingSection, setSavingSection] = useState(null); // 'preferences' | 'notifications' | 'privacy'
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setAcct({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      country: user?.country || '',
      city: user?.city || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
      language: user?.language || '',
    });
  }, [user]);

  useEffect(() => {
    let on = true;
    api.getProfile()
      .then((r) => { if (on) setProfile(r.profile || {}); })
      .catch(() => { if (on) setProfile({}); })
      .finally(() => { if (on) setLoadingProfile(false); });
    return () => { on = false; };
  }, []);

  // Persist a set of user_profiles changes by merging into the full upsert body.
  const saveProfileMerged = async (changes, sectionKey) => {
    setSavingSection(sectionKey);
    try {
      const body = { ...profileRowToBody(profile), ...changes };
      const r = await api.saveProfile(body);
      setProfile(r.profile || { ...(profile || {}), ...changes });
      toast.success('Saved');
    } catch {
      toast.error('Could not save — please try again.');
    } finally {
      setSavingSection(null);
    }
  };

  const saveAccount = async () => {
    setSavingAcct(true);
    try {
      await api.updateMe({
        first_name: acct.firstName || null,
        last_name: acct.lastName || null,
        country: acct.country || null,
        city: acct.city || null,
        phone: acct.phone || null,
        bio: acct.bio || null,
        language: acct.language || null,
      });
      await refreshUser?.();
      toast.success('Profile updated');
    } catch {
      toast.error('Could not update your profile.');
    } finally {
      setSavingAcct(false);
    }
  };

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4_000_000) { toast.error('Image too large (max ~4MB)'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.uploadPhoto(String(reader.result));
        await refreshUser?.();
        toast.success('Photo updated');
      } catch { toast.error('Could not upload photo.'); }
    };
    reader.readAsDataURL(file);
  };

  const downloadData = async () => {
    setDownloading(true);
    try {
      const blob = await api.downloadVault();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'solaris-vault-export.zip';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed — please try again.'); }
    finally { setDownloading(false); }
  };

  const btn = (label, onClick, busy) => (
    <button type="button" onClick={onClick} disabled={busy}
      style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: busy ? 'default' : 'pointer', background: 'var(--mint)', color: '#04231d', fontSize: 13.5, fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
      {busy ? 'Saving…' : label}
    </button>
  );

  const p = profile || {};

  return (
    <div>
      <SubTabs
        ariaLabel="Settings sections"
        active={active}
        onSelect={(id) => go('account', id)}
        items={[
          { id: 'profile', label: 'Profile & Account', icon: UserCog },
          { id: 'preferences', label: 'Preferences', icon: Settings },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'security', label: 'Security', icon: Lock },
          { id: 'privacy', label: 'Privacy & Data', icon: ShieldCheck },
        ]}
      />

      {active === 'profile' && (
        <Card style={{ maxWidth: 640 }}>
          <div className="row" style={{ gap: 14, alignItems: 'center', marginBottom: 20 }}>
            <Avatar name={acct.firstName ? `${acct.firstName} ${acct.lastName}` : (user?.email || 'Member')} size={56} />
            <div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--line,#e3ece8)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                <Upload size={15} /> Change photo
                <input type="file" accept="image/*" onChange={onAvatarPick} style={{ display: 'none' }} />
              </label>
              <div className="tiny muted" style={{ marginTop: 6 }}>JPG or PNG, up to ~4MB.</div>
            </div>
          </div>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 18px' }}>
            <SetField label="First name"><input style={SET_INPUT} value={acct.firstName} onChange={(e) => setAcct({ ...acct, firstName: e.target.value })} /></SetField>
            <SetField label="Last name"><input style={SET_INPUT} value={acct.lastName} onChange={(e) => setAcct({ ...acct, lastName: e.target.value })} /></SetField>
            <SetField label="Country"><input style={SET_INPUT} value={acct.country} onChange={(e) => setAcct({ ...acct, country: e.target.value })} /></SetField>
            <SetField label="City"><input style={SET_INPUT} value={acct.city} onChange={(e) => setAcct({ ...acct, city: e.target.value })} /></SetField>
            <SetField label="Phone"><input style={SET_INPUT} value={acct.phone} onChange={(e) => setAcct({ ...acct, phone: e.target.value })} /></SetField>
            <SetField label="Email" hint="Your sign-in email can't be changed here."><input style={{ ...SET_INPUT, background: '#f4f7f6', color: 'var(--muted,#8AA09C)' }} value={user?.email || ''} disabled /></SetField>
          </div>
          <SetField label="About you"><textarea style={{ ...SET_INPUT, minHeight: 82, resize: 'vertical' }} value={acct.bio} onChange={(e) => setAcct({ ...acct, bio: e.target.value })} /></SetField>
          {btn('Save changes', saveAccount, savingAcct)}
        </Card>
      )}

      {active === 'preferences' && (
        <Card style={{ maxWidth: 640 }}>
          {loadingProfile ? <CardSkeleton rows={4} /> : (
            <>
              <SetField label="Language" hint="Used across your passport where translations are available.">
                <select style={SET_INPUT} value={acct.language} onChange={(e) => setAcct({ ...acct, language: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </SetField>
              <SetField label="Time zone" hint="Keeps reminders and timestamps aligned to your day.">
                <input style={SET_INPUT} placeholder="e.g. America/El_Salvador" defaultValue={p.timezone || ''} onBlur={(e) => { p.timezone = e.target.value; }} id="set-tz" />
              </SetField>
              <SetField label="Care preference">
                <select style={SET_INPUT} defaultValue={p.care_preference || ''} id="set-care">
                  <option value="">No preference</option>
                  <option value="in_person">In person</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </SetField>
              <SetField label="Budget range">
                <select style={SET_INPUT} defaultValue={p.budget_range || ''} id="set-budget">
                  <option value="">No preference</option>
                  <option value="low">Economical</option>
                  <option value="medium">Moderate</option>
                  <option value="high">Premium</option>
                </select>
              </SetField>
              <div style={{ borderTop: '1px solid var(--line,#e3ece8)', margin: '4px 0 8px' }} />
              <SetToggle label="Suggest guided routines" hint="Let LUCA offer daily routines tailored to your journey." checked={p.wants_routines ?? true} onChange={(v) => { setProfile({ ...p, wants_routines: v }); }} />
              <SetToggle label="Invite me to workshops" hint="Occasional live sessions from Solaris practitioners." checked={p.wants_workshops ?? true} onChange={(v) => { setProfile({ ...p, wants_workshops: v }); }} />
              <div style={{ marginTop: 14 }}>
                {btn('Save preferences', () => {
                  const tz = document.getElementById('set-tz')?.value || null;
                  const care = document.getElementById('set-care')?.value || null;
                  const budget = document.getElementById('set-budget')?.value || null;
                  // language lives on the users table
                  api.updateMe({ language: acct.language || null }).then(() => refreshUser?.()).catch(() => {});
                  return saveProfileMerged({ timezone: tz, carePreference: care, budgetRange: budget, wantsRoutines: p.wants_routines ?? true, wantsWorkshops: p.wants_workshops ?? true }, 'preferences');
                }, savingSection === 'preferences')}
              </div>
            </>
          )}
        </Card>
      )}

      {active === 'notifications' && (
        <Card style={{ maxWidth: 640 }}>
          {loadingProfile ? <CardSkeleton rows={3} /> : (
            <>
              <p className="tiny muted" style={{ marginTop: 0, marginBottom: 8 }}>Choose what Solaris may send you. These preferences are stored with your profile.</p>
              <SetToggle label="Practitioner guidance" hint="Nudges and check-ins from practitioners supporting your journey." checked={p.wants_practitioner_guidance ?? true} onChange={(v) => setProfile({ ...p, wants_practitioner_guidance: v })} />
              <SetToggle label="Product & community updates" hint="Occasional news, workshops, and community highlights." checked={p.consent_marketing ?? false} onChange={(v) => setProfile({ ...p, consent_marketing: v })} />
              <div style={{ marginTop: 14 }}>
                {btn('Save notifications', () => saveProfileMerged({ wantsPractitionerGuidance: p.wants_practitioner_guidance ?? true, consentMarketing: p.consent_marketing ?? false }, 'notifications'), savingSection === 'notifications')}
              </div>
            </>
          )}
        </Card>
      )}

      {active === 'security' && (
        <Card style={{ maxWidth: 640 }}>
          <SetField label="Public identity key" hint="Your public Nostr key (npub). This is safe to share — it is not your private key.">
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input style={{ ...SET_INPUT, background: '#f4f7f6', fontFamily: 'monospace', fontSize: 12.5 }} value={user?.nostrNpub || 'Not linked yet'} readOnly />
              {user?.nostrNpub && (
                <button type="button" title="Copy" onClick={() => { navigator.clipboard?.writeText(user.nostrNpub); toast.success('Copied'); }} style={{ flex: 'none', padding: 10, borderRadius: 10, border: '1px solid var(--line,#e3ece8)', background: '#fff', cursor: 'pointer', color: 'var(--ink)' }}><Copy size={15} /></button>
              )}
            </div>
          </SetField>
          {user?.keyCustody && (
            <SetField label="Key custody">
              <input style={{ ...SET_INPUT, background: '#f4f7f6' }} value={user.keyCustody === 'self' ? 'Self-custody — you hold your keys' : String(user.keyCustody)} readOnly />
            </SetField>
          )}
          <div style={{ borderTop: '1px solid var(--line,#e3ece8)', margin: '10px 0 16px' }} />
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Session</div>
          <p className="tiny muted" style={{ marginTop: 0, marginBottom: 12 }}>Signing out ends this session and clears it from this device.</p>
          <button type="button" onClick={logout} className="row" style={{ gap: 8, alignItems: 'center', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--line,#e3ece8)', background: '#fff', color: '#b4432f', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
            <LogOut size={15} /> Sign out
          </button>
        </Card>
      )}

      {active === 'privacy' && (
        <Card style={{ maxWidth: 640 }}>
          {loadingProfile ? <CardSkeleton rows={3} /> : (
            <>
              <SetToggle label="Privacy consent" hint="Store and process my health data to power my passport." checked={p.consent_privacy ?? false} onChange={(v) => setProfile({ ...p, consent_privacy: v })} />
              <SetToggle label="AI guidance consent" hint="Allow LUCA to use my data to personalise guidance." checked={p.consent_ai_guidance ?? false} onChange={(v) => setProfile({ ...p, consent_ai_guidance: v })} />
              <div style={{ marginTop: 8, marginBottom: 18 }}>
                {btn('Save privacy choices', () => saveProfileMerged({ consentPrivacy: p.consent_privacy ?? false, consentAiGuidance: p.consent_ai_guidance ?? false }, 'privacy'), savingSection === 'privacy')}
              </div>
              <div style={{ borderTop: '1px solid var(--line,#e3ece8)', margin: '4px 0 16px' }} />
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>Your data</div>
              <p className="tiny muted" style={{ marginTop: 0, marginBottom: 12 }}>Export a complete copy of your sovereign vault — journals, check-ins, and records — as a ZIP archive. Your data is yours.</p>
              <button type="button" onClick={downloadData} disabled={downloading} className="row" style={{ gap: 8, alignItems: 'center', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--line,#e3ece8)', background: '#fff', color: 'var(--ink)', fontSize: 13.5, fontWeight: 700, cursor: downloading ? 'default' : 'pointer', opacity: downloading ? 0.6 : 1 }}>
                <Download size={15} /> {downloading ? 'Preparing…' : 'Download my data (.zip)'}
              </button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

/* ============================== PROFILE MENU (top-right) ==============================
   Reuses the existing avatar as an accessible dropdown trigger. Mouse, keyboard
   (Enter/Space to open, Escape to close, arrow keys to move), click-outside and
   touch all work. Items: My Profile, Settings, Identity & Data, Sign out. */
function ProfileMenu({ user, displayName, go, logout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const items = [
    { key: 'profile', label: 'My Profile', icon: UserCog, onSelect: () => go('account', 'profile') },
    { key: 'settings', label: 'Settings', icon: Settings, onSelect: () => go('account', 'preferences') },
    { key: 'identity', label: 'Identity & Data', icon: ShieldCheck, onSelect: () => go('identity') },
    { key: 'signout', label: 'Sign out', icon: LogOut, danger: true, onSelect: () => logout?.() },
  ];

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); } };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (it) => { setOpen(false); it.onSelect(); };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', borderRadius: '50%', lineHeight: 0 }}
      >
        {user?.avatarUrl
          ? <img src={user.avatarUrl} alt="" style={{ width: 39, height: 39, borderRadius: '50%', objectFit: 'cover' }} />
          : <Avatar name={displayName} size={39} />}
      </button>
      {open && (
        <div role="menu" aria-label="Account" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 216, background: '#fff', border: '1px solid var(--line,#e3ece8)', borderRadius: 14, boxShadow: '0 12px 34px rgba(10,43,41,.18)', padding: 8, zIndex: 60 }}>
          <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--line,#e3ece8)', marginBottom: 6 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.key}
                role="menuitem"
                type="button"
                onClick={() => choose(it)}
                className="row"
                style={{ width: '100%', textAlign: 'left', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: it.danger ? '#b4432f' : 'var(--ink)', fontSize: 13.5, fontWeight: 600 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f3'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={16} strokeWidth={2} /> {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabPage({ tab, sub, user, go, effectiveRole, onUnread, onInboxUnread, onBecomeProvider, onApprovalStats, onBookings }) {
  switch (tab) {
    case 'gps-map': return <ErrorBoundary><GPSMapView /></ErrorBoundary>;
    case 'contributions': return <ErrorBoundary><ContributionLedger user={user} /></ErrorBoundary>;
    case 'identity': return <ErrorBoundary><IdentityPage user={user} /></ErrorBoundary>;
    case 'aura-admin': return <ErrorBoundary><AuraAdmin /></ErrorBoundary>;
    case 'dashboard': return <ErrorBoundary><DashboardPage user={user} go={go} /></ErrorBoundary>;
    case 'explore': return <ErrorBoundary><ExploreMarketplace user={user} onBecomeProvider={onBecomeProvider} /></ErrorBoundary>;
    case 'health': return <HealthPassportPage user={user} go={go} />;
    case 'timeline': return <TimelinePage user={user} />;
    case 'coach': return <ErrorBoundary><CoachArea user={user} go={go} sub={sub} /></ErrorBoundary>;
    case 'intelligence': return <ErrorBoundary><IntelligencePage user={user} go={go} /></ErrorBoundary>;
    case 'journal': return <ErrorBoundary><JournalArea user={user} go={go} sub={sub} /></ErrorBoundary>;
    case 'media': return <ErrorBoundary><MediaPage user={user} go={go} /></ErrorBoundary>;
    case 'appointments': return <AppointmentsPage user={user} />;
    case 'my-bookings': return <MyBookings user={user} onExplore={() => go('explore')} />;
    case 'booking-oversight': return <BookingManagement />;
    case 'messages': return <ErrorBoundary><MessagesArea user={user} go={go} sub={sub} onUnread={onUnread} onInboxUnread={onInboxUnread} /></ErrorBoundary>;
    case 'communications': return <ErrorBoundary><CommunicationsArea user={user} go={go} sub={sub} onUnread={onUnread} onInboxUnread={onInboxUnread} /></ErrorBoundary>;
    case 'inbox': return <ErrorBoundary><InboxPage user={user} go={go} onUnread={onInboxUnread} /></ErrorBoundary>;
    case 'wallet': return <ErrorBoundary><EconomicPassportArea user={user} go={go} sub={sub} /></ErrorBoundary>;
    case 'account': return <ErrorBoundary><SettingsPage user={user} go={go} sub={sub} /></ErrorBoundary>;
    case 'treasury': return <RegenerativeTreasury user={user} />;
    case 'gps-economy': return <GPSStats />;
    case 'drafts': return <DraftQueuePage />;
    case 'schedule': return <SchedulePage />;
    case 'patients': return <PatientsPage />;
    case 'analytics': return <AnalyticsPage />;
    case 'provider-approvals': return <ProviderApprovals onStatsChange={onApprovalStats} />;
    case 'systimeline': return <SystemTimelinePage />;
    case 'users': return <UserManagementPage />;
    case 'settings': return <SystemSettingsPage />;
    case 'my-practice': return <MyPractice user={user} onBookings={onBookings} />;
    // ---- Practitioner Portal (Sprint F) ----
    case 'prac-clients': return <ErrorBoundary><PatientsPage /></ErrorBoundary>;
    case 'prac-bookings': return <ErrorBoundary><ProviderBookings onBookings={onBookings} /></ErrorBoundary>;
    case 'prac-availability': return <ErrorBoundary><AvailabilityManager /></ErrorBoundary>;
    case 'prac-messages': return <ErrorBoundary><SecureChat user={user} onUnread={onUnread} /></ErrorBoundary>;
    case 'prac-finance': return <ErrorBoundary><PractitionerFinance /></ErrorBoundary>;
    case 'prac-settings': return <ErrorBoundary><PractitionerSettings /></ErrorBoundary>;
    // ---- Solaris Admin (Sprint F) ----
    case 'admin-members': return <ErrorBoundary><UserManagementPage /></ErrorBoundary>;
    case 'admin-practitioners': return <ErrorBoundary><ProviderApprovals onStatsChange={onApprovalStats} /></ErrorBoundary>;
    case 'admin-bookings': return <ErrorBoundary><BookingManagement /></ErrorBoundary>;
    case 'admin-finance': return <ErrorBoundary><AdminFinance /></ErrorBoundary>;
    case 'admin-system': return <ErrorBoundary><AdminSystemPage /></ErrorBoundary>;
    case 'admin-settings': return <ErrorBoundary><AdminSettings /></ErrorBoundary>;
    default: return <DashboardPage user={user} go={go} />;
  }
}

/* Solaris Admin › System — platform health, the living GPS economy, and the
   activity timeline composed into one operator view (Sprint F). */
function AdminSystemPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <ErrorBoundary><AnalyticsPage /></ErrorBoundary>
      <ErrorBoundary><GPSStats /></ErrorBoundary>
      <ErrorBoundary><SystemTimelinePage /></ErrorBoundary>
    </div>
  );
}

/* ============================== MAIN SHELL ============================== */
export default function LucaPassport() {
  const { user, logout, refreshUser } = useApp();
  const realRole = user?.role || 'patient';
  const baseEffectiveRole = normalizeSolarisRole(realRole);
  const isProvider = user?.isProvider === true;

  // Member / Practitioner portal switcher. The right to switch is derived from
  // the authenticated SERVER user (role === 'practitioner' or an approved
  // provider), never from localStorage or any client-only flag. clinic_admin
  // never gets the switcher. A non-approved member can never obtain the
  // practitioner persona here, and the backend independently gates every
  // practitioner endpoint on role, so URL/state tampering cannot leak data.
  const isApprovedPractitioner = user?.role === 'practitioner' || user?.isProvider === true;
  const canSwitchPortal = isApprovedPractitioner && baseEffectiveRole !== 'clinic_admin';

  const initialUrl = readUrlNav();
  const [portalView, setPortalView] = useState(() => {
    if (!canSwitchPortal) return baseEffectiveRole === 'clinic_admin' ? 'admin' : 'member';
    if (initialUrl.portal === 'practitioner' || initialUrl.portal === 'member') return initialUrl.portal;
    return baseEffectiveRole === 'practitioner' ? 'practitioner' : 'member';
  });
  const portalViewRef = useRef(portalView);
  useEffect(() => { portalViewRef.current = portalView; }, [portalView]);

  // The persona actually rendered. clinic_admin is unchanged; a switcher-enabled
  // account renders the practitioner portal only when the switch is set there.
  const effectiveRole = baseEffectiveRole === 'clinic_admin'
    ? 'clinic_admin'
    : (canSwitchPortal && portalView === 'practitioner') ? 'practitioner' : 'patient';
  const role = legacyRoleFor(effectiveRole); // legacy role the base nav understands
  const nav = navForPersona(effectiveRole, role, isProvider);
  const portal = PORTAL[effectiveRole] || PORTAL.patient;

  // Area + nested sub-tab, initialised from the URL so bookmarks/refresh restore it.
  const [route, setRoute] = useState(() => resolveNav(initialUrl.tab || defaultTabFor(effectiveRole), initialUrl.sub));
  const tab = route.tab;
  const sub = route.sub;
  const [drawer, setDrawer] = useState(false);
  const [badges, setBadges] = useState({});
  const [showApplication, setShowApplication] = useState(false);
  const [showPractitioner, setShowPractitioner] = useState(false);
  const [appStatus, setAppStatus] = useState(null); // current user's latest application
  const [moreOpen, setMoreOpen] = useState(false); // practitioner "More" bottom sheet
  const [navHidden, setNavHidden] = useState(false); // mobile bottom nav hidden (full sheet / blocking overlay)

  // Mobile bottom nav visibility — Explore's full-height results sheet and any
  // blocking overlay (booking / check-in) ask the shell to hide the bar via a
  // lightweight window event, so those components stay decoupled from the shell.
  useEffect(() => {
    const onBotnav = (e) => setNavHidden(!!e?.detail?.hidden);
    window.addEventListener('solaris:botnav', onBotnav);
    return () => window.removeEventListener('solaris:botnav', onBotnav);
  }, []);

  // Changing sections always brings the mobile bottom nav back into view.
  useEffect(() => { setNavHidden(false); }, [route.tab]);

  // Escape closes the practitioner "More" sheet.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  // Navigate to an area (+ optional sub-tab). Canonicalises legacy targets and
  // mirrors the result into the URL query string; the pathname is untouched.
  const go = useCallback((rawTab, rawSub) => {
    const r = resolveNav(rawTab, rawSub);
    setRoute(r);
    writeUrlNav(r.tab, r.sub, canSwitchPortal ? portalViewRef.current : undefined);
    setDrawer(false);
  }, [canSwitchPortal]);

  // Switch between the Member and Practitioner portals on the same account.
  const switchPortal = useCallback((view) => {
    if (!canSwitchPortal) return;
    setPortalView(view);
    const nextRole = view === 'practitioner' ? 'practitioner' : 'patient';
    const r = resolveNav(defaultTabFor(nextRole));
    setRoute(r);
    writeUrlNav(r.tab, r.sub, view);
    setDrawer(false);
  }, [canSwitchPortal]);

  // Cross-component navigation (e.g. "Begin a guided journey" -> Health Passport).
  useEffect(() => {
    const onNav = (e) => { if (e?.detail?.tab) go(e.detail.tab, e.detail.sub); };
    window.addEventListener('solaris:navigate', onNav);
    return () => window.removeEventListener('solaris:navigate', onNav);
  }, [go]);

  // Browser Back / Forward — re-read the area, sub-tab, and portal from the URL.
  useEffect(() => {
    const onPop = () => {
      const u = readUrlNav();
      if (canSwitchPortal && (u.portal === 'practitioner' || u.portal === 'member')) setPortalView(u.portal);
      setRoute(resolveNav(u.tab || defaultTabFor(baseEffectiveRole), u.sub));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [canSwitchPortal, baseEffectiveRole]);

  // Keep the URL in sync on first render (so a bare "/" gets ?area=…), and ensure
  // the initial area is valid for the persona.
  useEffect(() => {
    writeUrlNav(route.tab, route.sub, canSwitchPortal ? portalView : undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the active area isn't available for this persona (e.g. after a portal
  // switch), fall back to its home tab. account/identity live in the profile
  // menu, not the sidebar, so they are always allowed.
  const ALWAYS_ALLOWED = ['account', 'identity', 'coach'];
  useEffect(() => {
    const valid = nav.flatMap((g) => g.items.map((i) => i.id));
    if (!valid.includes(route.tab) && !ALWAYS_ALLOWED.includes(route.tab)) {
      setRoute(resolveNav(defaultTabFor(effectiveRole)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRole]);

  // Track the current user's application status (to label the CTA).
  useEffect(() => {
    let on = true;
    if (user && !user.isProvider) {
      api.getApplicationStatus()
        .then((r) => { if (on) setAppStatus(r.application || null); })
        .catch(() => {});
    } else {
      setAppStatus(null);
    }
  }, [user, showApplication]);

  // live badge: pending provider applications for admin
  useEffect(() => {
    let on = true;
    if (role === 'admin') {
      api.getProviderStats()
        .then((s) => { if (on) setBadges((b) => ({ ...b, approvals: s.pending || 0 })); })
        .catch(() => {});
    }
    return () => { on = false; };
  }, [role]);

  // live badge: pending triage count for practitioner / admin
  useEffect(() => {
    let on = true;
    if (role === 'practitioner' || role === 'admin') {
      api.getPractitionerBookings()
        .then((r) => { if (on) setBadges((b) => ({ ...b, drafts: (r.bookings || []).filter((x) => (x.status || 'pending') === 'pending').length })); })
        .catch(() => {});
    }
    return () => { on = false; };
  }, [role]);

  // live badge: patient's active marketplace bookings (pending + upcoming confirmed)
  useEffect(() => {
    let on = true;
    const pull = () => api.getMyBookings()
      .then((r) => {
        if (!on) return;
        const now = Date.now();
        const active = (r.bookings || []).filter((b) => {
          if (!['pending', 'confirmed'].includes(b.status)) return false;
          const when = new Date(`${String(b.booking_date).slice(0, 10)}T${(b.start_time || '00:00').slice(0, 8)}`);
          return when.getTime() >= now - 36e5; // include in-progress within last hour
        }).length;
        setBadges((b) => ({ ...b, mybookings: active }));
      })
      .catch(() => {});
    pull();
    const t = setInterval(pull, 60000);
    return () => { on = false; clearInterval(t); };
  }, []);

  // live badge: total unread secure messages (all roles), polled periodically
  useEffect(() => {
    let on = true;
    const pull = () => api.getUnreadCount()
      .then((r) => { if (on) setBadges((b) => ({ ...b, messages: r.unread || 0 })); })
      .catch(() => {});
    pull();
    const t = setInterval(pull, 60000);
    return () => { on = false; clearInterval(t); };
  }, []);

  // live badge: unread inbox messages (booking confirmations, intake requests)
  useEffect(() => {
    let on = true;
    const pull = () => api.getInboxUnreadCount()
      .then((r) => { if (on) setBadges((b) => ({ ...b, inbox: r.count || 0 })); })
      .catch(() => {});
    pull();
    const t = setInterval(pull, 60000);
    return () => { on = false; clearInterval(t); };
  }, []);

  // live badge: pending bookings for approved providers
  useEffect(() => {
    let on = true;
    if (isProvider) {
      api.getPractitionerBookings()
        .then((r) => { if (on) setBadges((b) => ({ ...b, bookings: (r.bookings || []).filter((x) => (x.status || 'pending') === 'pending').length })); })
        .catch(() => {});
    }
    return () => { on = false; };
  }, [isProvider]);

  // Welcome toast once per browser session.
  useEffect(() => {
    if (!user) return;
    try {
      if (!sessionStorage.getItem('luca_welcomed')) {
        sessionStorage.setItem('luca_welcomed', '1');
        const first = user.firstName || (user.fullName || '').split(' ')[0] || '';
        toast(`Welcome to your Digital Sovereign Passport${first ? `, ${first}` : ''}! 🌿`, { icon: '🌿', duration: 4000 });
      }
    } catch { /* ignore */ }
  }, [user]);

  // Navigate from a notification — routes to the right tab for the active persona.
  const handleNotificationNavigate = useCallback((n) => {
    if (!n) return;
    const isPrac = effectiveRole === 'practitioner';
    const isAdmin = effectiveRole === 'clinic_admin';
    const messagesTab = isPrac ? 'prac-messages' : 'messages';
    const bookingTab = isAdmin ? 'admin-bookings' : isPrac ? 'prac-bookings' : isProvider ? 'my-practice' : 'my-bookings';
    if (n.type === 'application_approved') go(isPrac ? 'prac-clients' : 'my-practice');
    else if (n.type === 'application_rejected') setShowApplication(true);
    else if (n.type === 'message') go(messagesTab);
    else if (n.type === 'booking') go(bookingTab);
    else if (n.data?.tab) go(n.data.tab);
  }, [go, isProvider, effectiveRole]);

  const meta = TAB_META[tab] || { title: 'Digital Sovereign Passport', sub: '' };
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Member';

  // Mobile bottom-nav model. Member gets exactly five destinations (LUCA raised
  // in the centre); the practitioner portal swaps in its own five with a "More"
  // sheet. clinic_admin keeps the sidebar/drawer only (no bottom bar).
  const showBotNav = effectiveRole === 'patient' || effectiveRole === 'practitioner';
  const memberNavItems = [
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'health', label: 'Health', icon: HeartPulse },
    { id: 'coach', label: 'LUCA', center: true },
    { id: 'communications', label: 'Communications', ariaLabel: 'Communications', icon: MessageSquare },
    { id: 'wallet', label: 'Economic', icon: Wallet },
  ];
  const practitionerNavItems = [
    { id: 'prac-clients', label: 'Clients', icon: Users },
    { id: 'prac-bookings', label: 'Bookings', icon: CalendarDays },
    { id: 'coach', label: 'LUCA', center: true },
    { id: 'prac-messages', label: 'Messages', icon: MessageSquare },
    { id: 'more', label: 'More', icon: Grid, more: true },
  ];
  const botNavItems = effectiveRole === 'practitioner' ? practitionerNavItems : memberNavItems;

  return (
    <AudioProvider>
    <div className="luca">
      <style>{CSS}</style>
      <div className="luca-app">
        {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

        {/* ---------------- SIDEBAR ---------------- */}
        <aside className={`sidebar ${drawer ? 'open' : ''}`}>
          <div className="brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/solaris-logo.png" alt="Solaris" style={{ width: 42, height: 42, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(47,190,159,0.5))' }} />
              <div>
                <div className="brand-name" style={{ fontSize: 15 }}>SOLARIS</div>
                <div className="brand-sub" style={{ color: portal.accent }}>{portal.sub}</div>
              </div>
            </div>
          </div>

          {/* Member / Practitioner portal switcher — shown only to an approved
              practitioner (server-derived). Sits at the very top, above the nav. */}
          {canSwitchPortal && (
            <div role="tablist" aria-label="Portal" style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 4, margin: '2px 0 12px' }}>
              {[{ id: 'member', label: 'Member', accent: PORTAL.patient.accent }, { id: 'practitioner', label: 'Practitioner', accent: PORTAL.practitioner.accent }].map((pv) => {
                const on = portalView === pv.id;
                return (
                  <button
                    key={pv.id}
                    role="tab"
                    aria-selected={on}
                    type="button"
                    onClick={() => switchPortal(pv.id)}
                    style={{ flex: 1, padding: '7px 8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      background: on ? pv.accent : 'transparent', color: on ? '#04231d' : '#D9EEE8', transition: 'background .15s' }}
                  >
                    {pv.label}
                  </button>
                );
              })}
            </div>
          )}

          <nav className="col" style={{ gap: 1 }}>
            {nav.map((grp) => (
              <div key={grp.group}>
                <div className="nav-label"><span className="dot" style={{ background: grp.color }} />{grp.group}</div>
                {grp.items.map((it) => {
                  const Icon = it.icon;
                  const count = it.badgeKey ? badges[it.badgeKey] : 0;
                  const onClick = it.comingSoon
                    ? () => { go(it.id); setDrawer(false); }
                    : () => go(it.id);
                  return (
                    <button key={it.id} className={`nav-item ${tab === it.id ? 'active' : ''}`} onClick={onClick}>
                      <Icon size={17} strokeWidth={2} />
                      <span>{it.label}</span>
                      {it.comingSoon && <span className="soon-badge">Soon</span>}
                      {!it.comingSoon && count > 0 && <span className="badge">{count}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {effectiveRole === 'patient' && !user?.isProvider && (
            appStatus?.status === 'pending' ? (
              <div className="become-provider pending" title="Your application is under review">
                <Clock size={16} strokeWidth={2} />
                <span>Application under review</span>
              </div>
            ) : (
              <button className="become-provider" onClick={() => { setShowPractitioner(true); setDrawer(false); }}>
                <Briefcase size={16} strokeWidth={2} />
                <span>{appStatus?.status === 'rejected' ? 'Reapply as Practitioner →' : 'Become a Practitioner →'}</span>
              </button>
            )
          )}

          {/* Account footer — avatar, name/email, and sign out at the very bottom */}
          <div style={{ marginTop: (effectiveRole !== 'patient' || user?.isProvider) ? 'auto' : 0, borderTop: '1px solid rgba(255,255,255,.1)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Avatar name={displayName} size={32} />
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#D9EEE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                <div style={{ fontSize: 11, color: 'rgba(159,231,214,.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
              </div>
            </div>
            <button onClick={logout} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 10, cursor: 'pointer', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', color: '#D9EEE8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogOut size={15} /> Sign out
            </button>
          </div>

        </aside>

        {/* ---------------- MAIN ---------------- */}
        <div className="main">
          <header className="topbar">
            <button className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={18} /></button>
            <button className="icon-btn home-btn" onClick={() => go(defaultTabFor(effectiveRole))} aria-label="Home"><LayoutDashboard size={18} /></button>
            <div className="m-title" aria-hidden="true">{meta.title}</div>
            <div className="search">
              <Search size={16} />
              <input placeholder="Search your passport, care, and value…" />
            </div>
            <NotificationCenter onNavigate={handleNotificationNavigate} />
            <ProfileMenu user={user} displayName={displayName} go={go} logout={logout} />
          </header>

          <main className="page">
            <PageHead title={meta.title} sub={meta.sub}
              action={
                <div className="row gap-2" style={{ alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: portal.accent, background: `${portal.accent}1f`, border: `1px solid ${portal.accent}55`, borderRadius: 999, padding: '4px 11px' }}>
                    <ShieldCheck size={12} strokeWidth={2.4} />{portal.label}
                  </span>
                </div>
              } />
            <TabPage tab={tab} sub={sub} user={user} go={go} effectiveRole={effectiveRole} onUnread={(n) => setBadges((b) => ({ ...b, messages: n }))} onInboxUnread={(n) => setBadges((b) => ({ ...b, inbox: n }))} onBecomeProvider={() => setShowApplication(true)} onApprovalStats={(s) => setBadges((b) => ({ ...b, approvals: s.pending || 0 }))} onBookings={(n) => setBadges((b) => ({ ...b, bookings: n }))} />
          </main>
        </div>
      </div>

      {/* Persistent mini-player — patient experience only (except the Media sub-tab, which has its own player) */}
      <MiniPlayer hidden={(tab === 'communications' && sub === 'media') || effectiveRole !== 'patient'} />

      {/* ---------------- MOBILE BOTTOM NAV ----------------
          Rendered through a portal at document.body so no transformed or
          positioned ancestor (e.g. the .page fade keyframe) can trap or
          compress the fixed bar. Wrapped in a fresh `.luca` scope so the
          existing `.luca .m-botnav` styles still apply. */}
      {showBotNav && typeof document !== 'undefined' && document.body && createPortal(
        <div className="luca">
        <nav className={`m-botnav ${navHidden ? 'hidden' : ''}`} aria-label="Primary">
          {botNavItems.map((it) => {
            if (it.center) {
              const active = tab === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`m-bn-luca ${active ? 'active' : ''}`}
                  aria-label="LUCA Coach"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => go(it.id)}
                >
                  <span className="m-bn-orb"><Sparkles size={24} strokeWidth={2.2} /></span>
                  <span className="m-bn-lbl">{it.label}</span>
                </button>
              );
            }
            if (it.more) {
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`m-bn-item ${moreOpen ? 'active' : ''}`}
                  aria-label="More"
                  aria-haspopup="dialog"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen(true)}
                >
                  <it.icon size={20} strokeWidth={2} />
                  <span>{it.label}</span>
                </button>
              );
            }
            const active = tab === it.id;
            return (
              <button
                key={it.id}
                type="button"
                className={`m-bn-item ${active ? 'active' : ''}`}
                aria-label={it.ariaLabel || it.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => go(it.id)}
              >
                <it.icon size={20} strokeWidth={2} />
                <span>{it.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Practitioner "More" bottom sheet — portaled with the bar so it stacks
            above the page and is never trapped by a transformed ancestor. */}
        {moreOpen && (
          <div className="m-more-scrim" onClick={() => setMoreOpen(false)}>
            <div className="m-more" role="dialog" aria-label="More" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="m-more-grab" />
              <button type="button" className="m-more-item" onClick={() => { go('prac-availability'); setMoreOpen(false); }}>
                <CalendarCheck size={20} strokeWidth={2} /> Availability
              </button>
              <button type="button" className="m-more-item" onClick={() => { go('prac-finance'); setMoreOpen(false); }}>
                <Wallet size={20} strokeWidth={2} /> Finance
              </button>
              <button type="button" className="m-more-item" onClick={() => { go('prac-settings'); setMoreOpen(false); }}>
                <Settings size={20} strokeWidth={2} /> Settings
              </button>
              {canSwitchPortal && (
                <button type="button" className="m-more-item switch" onClick={() => { switchPortal('member'); setMoreOpen(false); }}>
                  <Users size={20} strokeWidth={2} /> Switch to Member portal
                </button>
              )}
            </div>
          </div>
        )}
        </div>,
        document.body,
      )}

      {showApplication && (
        <ProviderApplication
          user={user}
          onClose={() => setShowApplication(false)}
          onSubmitted={() => { setShowApplication(false); refreshUser?.(); }}
        />
      )}

      {showPractitioner && (
        <BecomeAPractitionerModal
          user={user}
          onClose={() => setShowPractitioner(false)}
          onSubmitted={() => refreshUser?.()}
        />
      )}
    </div>
    </AudioProvider>
  );
}
