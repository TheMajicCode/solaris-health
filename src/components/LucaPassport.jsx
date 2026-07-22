/* ============================================================
   LUCA PASSPORT — Unified Sovereign Hub
   One central dashboard for every user, adapting by role.
   Design foundation: Solaris navy / teal / emerald / gold,
   Space Grotesk (display) + IBM Plex Sans (body).
   Scoped under `.luca` so it is fully isolated from the
   global dark theme used by the auth / onboarding flows.
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import HealthTimeline from './HealthTimeline.jsx';
import TrendCharts from './TrendCharts.jsx';
import SecureChat from './SecureChat.jsx';
import WalletConnect from './wallet/WalletConnect.jsx';
import WalletDashboard from './wallet/WalletDashboard.jsx';
import HealthNFT from './wallet/HealthNFT.jsx';
import ExploreMarketplace from './marketplace/ExploreMarketplace.jsx';
import ProviderApplication from './provider/ProviderApplication.jsx';
import MyPractice from './provider/MyPractice.jsx';
import ProviderApprovals from './admin/ProviderApprovals.jsx';
import MyBookings from './booking/MyBookings.jsx';
import BookingManagement from './admin/BookingManagement.jsx';
import NotificationCenter from './NotificationCenter.jsx';
import GPSLedger from './gps/GPSLedger.jsx';
import ReferralHub from './gps/ReferralHub.jsx';
import RegenerativeTreasury from './gps/RegenerativeTreasury.jsx';
import GPSStats from './admin/GPSStats.jsx';
import GPSMapView from './gps/GPSMapView.jsx';
import PaymentModal from './gps/PaymentModal.jsx';
import IdentityCard from './passport/IdentityCard.jsx';
import WalletCard from './passport/WalletCard.jsx';
import LevelBadge from './passport/LevelBadge.jsx';
import ContributionLedger from './contributions/ContributionLedger.jsx';
import AuraAdmin from './clinic/AuraAdmin.jsx';
import toast from 'react-hot-toast';

/* ============================== DESIGN SYSTEM ============================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.luca{
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
  font-family:'IBM Plex Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
}
.luca *{box-sizing:border-box}
.luca .mono{font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace}
.luca .dp{font-family:'Space Grotesk',system-ui,sans-serif}

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
.brand-name{font-family:'Space Grotesk';font-weight:700;font-size:18px;color:#fff;letter-spacing:.12em;line-height:1}
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
.page-title{font-family:'Space Grotesk';font-weight:600;font-size:25px;letter-spacing:-.015em;color:var(--ink);line-height:1.1}
.page-sub{color:var(--muted);font-size:13.5px;margin-top:5px;max-width:560px}

/* cards & primitives */
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px;box-shadow:var(--shadow-sm)}
.card.lg{padding:22px;border-radius:var(--r-lg)}
.card.flat{box-shadow:none}
.card.tint{background:linear-gradient(180deg,#FBFEFC,#F4FAF7)}
.eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);font-weight:600}
.card-title{font-size:15px;font-weight:600;color:var(--ink)}
.stat{font-family:'Space Grotesk';font-weight:600;font-size:27px;letter-spacing:-.02em;color:var(--ink);line-height:1}
.stat .unit{font-size:13px;color:var(--muted-2);font-weight:500;margin-left:5px}
.divider{height:1px;background:var(--line);margin:14px 0}
.grid{display:grid;gap:18px}
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
  font-family:'Space Grotesk';flex:none;font-size:15px;letter-spacing:.02em}

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
.h1{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;font-size:30px;letter-spacing:-.02em;color:var(--ink)}
.h2{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:700;font-size:23px;letter-spacing:-.02em;color:var(--ink)}
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
.luca .msg-time{font-size:10px;color:var(--muted-2);margin-top:4px;text-align:right}
.luca .msg-time.ai-time{text-align:left}
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
/* Media library sticky player */
.luca .media-player{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:60;display:flex;align-items:center;gap:12px;background:var(--surface,#fff);border:1px solid var(--line,#E6EDEA);box-shadow:0 12px 40px rgba(10,40,40,.16);border-radius:16px;padding:10px 14px;width:min(680px,calc(100% - 48px))}
/* Floating LUCA widget */
.luca .luca-fab{position:fixed;right:22px;bottom:22px;z-index:9998;display:inline-flex;align-items:center;gap:9px;background:linear-gradient(150deg,#0E5C57,#0A413D);color:#E7F8F3;border:none;border-radius:999px;padding:8px 16px 8px 8px;cursor:pointer;box-shadow:0 10px 30px rgba(10,60,55,.35);font-family:inherit;transition:transform .15s,box-shadow .15s}
.luca .luca-fab:hover{transform:translateY(-2px);box-shadow:0 14px 38px rgba(10,60,55,.42)}
.luca .luca-fab-label{font-size:13.5px;font-weight:700;letter-spacing:.2px}
.luca .luca-widget{position:fixed;right:22px;bottom:22px;z-index:9999;width:380px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 44px);display:flex;flex-direction:column;background:var(--surface,#fff);border:1px solid var(--line,#E6EDEA);border-radius:20px;overflow:hidden;box-shadow:0 24px 70px rgba(10,40,40,.28)}
.luca .luca-widget-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;background:linear-gradient(150deg,#0E5C57,#0A413D)}
.luca .luca-widget-x{background:rgba(255,255,255,.14);border:none;color:#E7F8F3;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;cursor:pointer;flex:none}
.luca .luca-widget-x:hover{background:rgba(255,255,255,.24)}
.luca .luca-widget-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;background:var(--surface-2,#F7FAF9)}
.luca .luca-widget-foot{padding:12px 14px;border-top:1px solid var(--line,#E6EDEA);background:var(--surface,#fff)}
.luca .luca-widget-foot .btn.primary{padding:8px 12px}
@media(max-width:520px){.luca .luca-widget{right:12px;left:12px;width:auto}}
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
const Empty = ({ icon: Icon = Sparkles, title, sub }) => (
  <div className="empty col" style={{ alignItems: 'center', gap: 8 }}>
    <div className="chip mint" style={{ width: 48, height: 48 }}><Icon size={22} /></div>
    <div className="f6" style={{ color: 'var(--ink)' }}>{title}</div>
    {sub && <div className="small muted" style={{ maxWidth: 360 }}>{sub}</div>}
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
      group: 'Salud', color: '#36C9A9', items: [
        { id: 'health', label: 'Health Passport', icon: HeartPulse },
        { id: 'coach', label: 'LUCA Coach', icon: Bot },
        { id: 'journal', label: 'Journal', icon: BookOpen },
        { id: 'media', label: 'Media', icon: Headphones },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badgeKey: 'messages' },
      ],
    },
    {
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
        { id: 'users', label: 'User Management', icon: UserCog },
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
  groups.push({
    group: 'Sovereign', color: '#9FE7D6', items: [
      { id: 'gps-map', label: 'The Network', icon: MapPin },
      { id: 'contributions', label: 'Contributions', icon: Award },
      { id: 'identity', label: 'Identity & Data', icon: ShieldCheck },
    ],
  });
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
const TAB_META = {
  dashboard: { title: 'Dashboard', sub: 'Your steering wheel for health, value, and care — one sovereign view.' },
  explore: { title: 'Explore', sub: 'Discover trusted health & wellness providers near you — clinics, farms, healers, and more.' },
  health: { title: 'Health Passport', sub: 'Your 360° vitality, owned by you and exportable anytime.' },
  timeline: { title: 'Health Timeline', sub: 'Your complete health journey and trends — chronological and exportable.' },
  systimeline: { title: 'System Timeline', sub: 'Platform-wide activity, sign-ups, and usage patterns over time.' },
  coach: { title: 'LUCA Coach', sub: 'Heart-Centered Intelligence — a guide, never a diagnosis.' },
  journal: { title: 'Journal', sub: 'A private space to reflect. Capture how you feel, notice patterns, own your story.' },
  media: { title: 'Media Library', sub: 'Guided audio practices from Solaris practitioners — yours to keep and revisit.' },
  appointments: { title: 'Appointments', sub: 'Book care and track your visits across the Solaris network.' },
  'my-bookings': { title: 'My Bookings', sub: 'Your appointments with marketplace providers — upcoming, pending, and past.' },
  'booking-oversight': { title: 'Booking Oversight', sub: 'Monitor and resolve appointments across every provider on the platform.' },
  messages: { title: 'Secure Messages', sub: 'End-to-end encrypted conversations with your care network — only you can read them.' },
  wallet: { title: 'Economic Passport', sub: 'Your LOVE points, contributions, crypto wallets, and value flows.' },
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
  'gps-map': { title: 'The Network', sub: 'A living map of Solaris nodes and the health, wealth & sovereignty they reclaim.' },
  contributions: { title: 'Contributions', sub: 'Your attested contribution record and the network leaderboard. Levels reward what you give.' },
  identity: { title: 'Identity & Data', sub: 'Your sovereign identity, wallet, and one-click data export. You own all of it.' },
  'aura-admin': { title: 'Clinic Console', sub: "Aura Dental's operations — appointments, simulated payments, follow-ups, and GPS treasury." },
};

/* ============================== PATIENT — DASHBOARD ============================== */
function DashboardPage({ user, go }) {
  const [latest, setLatest] = useState(null);
  const [rewards, setRewards] = useState({ events: [], total: 0 });
  const [contribs, setContribs] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [recs, setRecs] = useState(null);
  const [recsLoading, setRecsLoading] = useState(true);
  const [loading, setLoading] = useState(true);

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

        {/* LUCA Recommends */}
        <LucaRecommends recs={recs} loading={recsLoading} go={go} user={user} vitality={vitality} focus={focus} />

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
            <SectionHead eyebrow="Latest check-in" title="Daily signals" action={<Btn variant="ghost sm" icon={Plus} onClick={() => go('health')}>Log</Btn>} />
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

/* ============================== PATIENT — HEALTH PASSPORT ============================== */
const SYS_SHORT = { bioelectrical: 'Bio', hydration: 'Hydr', circadian: 'Circ', microbiome: 'Micro', respiratory: 'Resp', neurological: 'Neuro', cardiovascular: 'Cardio', nutritional: 'Nutri' };
const ASPECT_ICONS = { physical: Activity, mental: Brain, emotional: Heart, spiritual: Sparkles };

function HealthPage() {
  const [data, setData] = useState(null);
  const [docs, setDocs] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

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
      <Card className="between" style={{ background: 'linear-gradient(180deg,#FBFEFC,#F4FAF7)' }}>
        <div className="row gap-3">
          <Chip icon={ShieldCheck} tone="gold" />
          <div>
            <div className="f6">Data sovereignty</div>
            <div className="small muted">FHIR-aligned and fully portable. Export the whole vault as a ZIP, anytime.</div>
            {exportMsg && <div className="tiny t-mint" style={{ marginTop: 4 }}>{exportMsg}</div>}
          </div>
        </div>
        <Btn variant="primary" icon={Download} onClick={exportVault} disabled={exporting}>{exporting ? 'Preparing…' : 'Export my vault'}</Btn>
      </Card>

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
          <SectionHead eyebrow="Progress" title="Recent check-ins" />
          {checkins.length ? checkins.slice(0, 8).map((c) => (
            <div key={c.id} className="list-row" style={{ padding: '10px 0' }}>
              <Chip icon={Calendar} tone="mint" sm />
              <div style={{ flex: 1 }}><div className="small f6">{fmtShort(c.checkin_date)}</div><div className="tiny muted">Energy {c.energy_score} · Mood {c.mood_score}</div></div>
              <span className="tiny muted2">{Number(c.sleep_hours).toFixed(1)}h</span>
            </div>
          )) : <Empty icon={Calendar} title="No check-ins yet" sub="Daily check-ins help LUCA track your vitality over time." />}
        </Card>
      </div>
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
function executeChipAction(suggestion, { go, setInput, send }) {
  const s = typeof suggestion === 'string' ? { label: suggestion, action: 'prefill_chat', target: null } : (suggestion || {});
  const { action, target, label } = s;
  switch (action) {
    case 'navigate': go(target || 'dashboard'); break;
    case 'start_checkin': go('health'); break;
    case 'start_assessment': go('health'); break;
    case 'open_listing': go('explore'); break;
    case 'play_audio': go('media'); break;
    case 'curate': go('explore'); break;
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

function CoachPage({ user, go }) {
  const { lucaMessages: messages, setLucaMessages: setMessages, lucaLoaded, loadLucaHistory } = useApp();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [latest, setLatest] = useState(null);
  const endRef = useRef(null);
  const loading = !lucaLoaded;

  useEffect(() => {
    let alive = true;
    loadLucaHistory();
    (async () => {
      const l = await api.getLatestAssessment().catch(() => null);
      if (alive) setLatest(l);
    })();
    return () => { alive = false; };
  }, [loadLucaHistory]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

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
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'I had trouble responding just now. Please try again in a moment.', created_at: new Date().toISOString() }]);
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
              {degraded
                ? <Pill tone="gold" icon={Clock}>Offline mode</Pill>
                : <Pill tone="mint" icon={Bot}>Online</Pill>}
            </div>
            <div className="tiny muted" style={{ marginTop: 1 }}>Heart-Centered Intelligence</div>
          </div>
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
                  {m.created_at && <div className={`msg-time ${isUser ? '' : 'ai-time'}`}>{msgTime(m.created_at)}</div>}
                  {!isUser && i === messages.length - 1 && !sending && (
                    <LucaChips suggestions={m.suggestions} onAction={(s) => executeChipAction(s, { go, setInput, send })} disabled={sending} />
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
          <div className="coach-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask LUCA anything..."
            />
            <Btn variant="primary" icon={Send} onClick={() => send()} disabled={sending || !input.trim()}>Send</Btn>
          </div>
          <div className="coach-disclaimer">LUCA guides and educates — never diagnoses or prescribes.</div>
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

function JournalPage({ user }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState('good');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getJournal().catch(() => ({ entries: [] }));
        if (alive) setEntries(r?.entries || []);
      } finally { alive && setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

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

  return (
    <div className="grid-2-1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 20, alignItems: 'start' }}>
      {/* Composer */}
      <Card className="lg">
        <SectionHead eyebrow="New entry" title={`How are you, ${firstName}?`} />
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
  );
}

/* ============================== PATIENT — MEDIA LIBRARY ============================== */
const fmtDuration = (s) => {
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

function MediaPage({ user, go }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    const r = await api.getAudioLibrary().catch(() => ({ tracks: [] }));
    setTracks(r?.tracks || []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => { await load(); if (alive) setLoading(false); })();
    return () => { alive = false; };
  }, [load]);

  const play = (t) => {
    if (!t.unlocked) return;
    setCurrent(t);
    setTimeout(() => { audioRef.current?.play?.().catch(() => {}); }, 60);
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

  const unlocked = tracks.filter((t) => t.unlocked);
  const locked = tracks.filter((t) => !t.unlocked);
  const practitioner = tracks.find((t) => t.practitioner_name);
  const freeLocked = locked.filter((t) => t.is_free).length;

  return (
    <div className="col gap-4" style={{ paddingBottom: current ? 96 : 0 }}>
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
              <Card><Empty icon={Music} title="No saved audio yet" sub="Add free guided practices below to start building your personal library." /></Card>
            ) : (
              <div className="col gap-3">
                {unlocked.map((t) => (
                  <TrackRow key={t.id} t={t} playing={current?.id === t.id} onPlay={() => play(t)} />
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

      {/* Sticky player */}
      {current && (
        <div className="media-player">
          <div className="row gap-3" style={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', flex: 'none', background: '#EBF3F0' }}>
              {current.cover_image_url && <img src={current.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="small f6" style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.title}</div>
              <div className="tiny muted">{current.practitioner_name || 'Solaris'}</div>
            </div>
          </div>
          <audio ref={audioRef} src={current.audio_url} controls style={{ height: 38, maxWidth: '55%' }} />
          <button className="icon-btn" onClick={() => setCurrent(null)} title="Close player"
            style={{ border: 'none', background: 'transparent', color: 'var(--muted,#8AA09C)', cursor: 'pointer', padding: 6 }}>
            <X size={18} />
          </button>
        </div>
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
    { label: 'Total users', value: stats.users, icon: Users, tone: 'teal' },
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
            )) : <tr><td colSpan={6}><Empty icon={Users} title="No users match your filters" /></td></tr>}
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
        <SectionHead eyebrow="Generative Prosperity System" title="See value flow through the ecosystem" />
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
      {hpTab === 'overview' && <ErrorBoundary><HealthPage /></ErrorBoundary>}
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

/* ============================== PAGE ROUTER ============================== */
/* ============================== LUCA FLOATING WIDGET ============================== */
function LucaWidget({ user, hidden, go }) {
  const { lucaMessages: messages, setLucaMessages: setMessages, lucaLoaded, loadLucaHistory } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const loading = open && !lucaLoaded;

  // Lazy-load the shared history the first time the panel is opened
  useEffect(() => {
    if (open) loadLucaHistory();
  }, [open, loadLucaHistory]);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending, open]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await api.sendLucaMessage(content);
      setMessages((m) => [...m, { role: 'assistant', content: res?.reply || '…', model: res?.model, suggestions: res?.suggestions || [], created_at: new Date().toISOString() }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'I had trouble responding just now. Please try again in a moment.', created_at: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  const firstName = user?.firstName || 'friend';
  if (hidden) return null;

  return (
    <>
      {!open && (
        <button className="luca-fab" onClick={() => setOpen(true)} aria-label="Ask LUCA">
          <LucaAvatar size="sm" />
          <span className="luca-fab-label">Ask LUCA</span>
        </button>
      )}
      {open && (
        <div className="luca-widget" role="dialog" aria-label="LUCA chat">
          <div className="luca-widget-head">
            <div className="row gap-2" style={{ alignItems: 'center', minWidth: 0 }}>
              <LucaAvatar size="sm" />
              <div style={{ minWidth: 0 }}>
                <div className="dp f7" style={{ fontSize: 14, color: '#fff' }}>LUCA</div>
                <div style={{ fontSize: 11, color: 'rgba(231,248,243,.7)' }}>Heart-Centered Intelligence</div>
              </div>
            </div>
            <button className="luca-widget-x" onClick={() => setOpen(false)} aria-label="Minimize"><X size={16} /></button>
          </div>

          <div className="luca-widget-body">
            {loading ? (
              <><Skel h={40} w="70%" /><Skel h={40} w="55%" style={{ alignSelf: 'flex-end' }} /></>
            ) : messages.length === 0 ? (
              <div className="col" style={{ gap: 10, alignItems: 'center', textAlign: 'center', padding: '18px 8px' }}>
                <LucaAvatar />
                <div className="small f6" style={{ color: 'var(--ink)' }}>How can I support you today, {firstName}?</div>
                <div className="tiny muted">I guide and educate — never diagnose.</div>
                <div className="luca-chips" style={{ justifyContent: 'center' }}>
                  {COACH_SUGGESTIONS.slice(0, 3).map((s, i) => (
                    <button key={s} className="luca-chip" onClick={() => send(s)} disabled={sending}
                      style={{ background: CHIP_BG[i % 3], color: CHIP_TEXT[i % 3], borderColor: CHIP_BORDER[i % 3] }}>
                      <Sparkles size={12} strokeWidth={2.4} />{s}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <div key={i} className={`msg-row ${isUser ? 'user' : 'ai'}`}>
                  {isUser ? <Avatar name={user?.fullName} size={26} /> : <LucaAvatar size="sm" />}
                  <div style={{ minWidth: 0, maxWidth: '84%' }}>
                    <div className={`msg-bubble ${isUser ? 'user' : 'ai'}`} style={{ fontSize: 13 }}>{m.content}</div>
                    {!isUser && i === messages.length - 1 && !sending && (
                      <LucaChips suggestions={m.suggestions} onAction={(s) => executeChipAction(s, { go, setInput, send })} disabled={sending} />
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

          <div className="luca-widget-foot">
            <div className="coach-input-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Ask LUCA anything..."
              />
              <button className="btn primary" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send"><Send size={15} strokeWidth={2.2} /></button>
            </div>
            <div className="tiny muted" style={{ textAlign: 'center', marginTop: 6 }}>LUCA guides and educates — never diagnoses or prescribes.</div>
          </div>
        </div>
      )}
    </>
  );
}

function TabPage({ tab, user, go, effectiveRole, onUnread, onBecomeProvider, onApprovalStats, onBookings }) {
  switch (tab) {
    case 'gps-map': return <ErrorBoundary><GPSMapView /></ErrorBoundary>;
    case 'contributions': return <ErrorBoundary><ContributionLedger user={user} /></ErrorBoundary>;
    case 'identity': return <ErrorBoundary><IdentityPage user={user} /></ErrorBoundary>;
    case 'aura-admin': return <ErrorBoundary><AuraAdmin /></ErrorBoundary>;
    case 'dashboard': return <ErrorBoundary><DashboardPage user={user} go={go} /></ErrorBoundary>;
    case 'explore': return <ErrorBoundary><ExploreMarketplace user={user} onBecomeProvider={onBecomeProvider} /></ErrorBoundary>;
    case 'health': return <HealthPassportPage user={user} go={go} />;
    case 'timeline': return <TimelinePage user={user} />;
    case 'coach': return <CoachPage user={user} go={go} />;
    case 'journal': return <ErrorBoundary><JournalPage user={user} /></ErrorBoundary>;
    case 'media': return <ErrorBoundary><MediaPage user={user} go={go} /></ErrorBoundary>;
    case 'appointments': return <AppointmentsPage user={user} />;
    case 'my-bookings': return <MyBookings user={user} onExplore={() => go('explore')} />;
    case 'booking-oversight': return <BookingManagement />;
    case 'messages': return <SecureChat user={user} onUnread={onUnread} />;
    case 'wallet': return <EconomicPassportPage user={user} />;
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
    default: return <DashboardPage user={user} go={go} />;
  }
}

/* ============================== MAIN SHELL ============================== */
export default function LucaPassport() {
  const { user, logout, refreshUser } = useApp();
  const realRole = user?.role || 'patient';
  const effectiveRole = normalizeSolarisRole(realRole);
  const role = legacyRoleFor(effectiveRole); // legacy role the base nav understands
  const isProvider = user?.isProvider === true;
  const nav = [...navForRole(role, isProvider), ...solarisNav(effectiveRole)];
  const [tab, setTab] = useState('dashboard');
  const [drawer, setDrawer] = useState(false);
  const [badges, setBadges] = useState({});
  const [showApplication, setShowApplication] = useState(false);
  const [appStatus, setAppStatus] = useState(null); // current user's latest application

  // close drawer on tab change
  const go = useCallback((id) => { setTab(id); setDrawer(false); }, []);

  // If the active tab isn't available for the (demo-switched) role, fall back to Dashboard.
  const validTabIds = nav.flatMap((g) => g.items.map((i) => i.id));
  useEffect(() => {
    if (!validTabIds.includes(tab)) setTab('dashboard');
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
        toast(`Welcome to LUCA Passport${first ? `, ${first}` : ''}! 🌿`, { icon: '🌿', duration: 4000 });
      }
    } catch { /* ignore */ }
  }, [user]);

  // Navigate from a notification (e.g. approval → My Practice).
  const handleNotificationNavigate = useCallback((n) => {
    if (!n) return;
    if (n.type === 'application_approved') go('my-practice');
    else if (n.type === 'application_rejected') setShowApplication(true);
    else if (n.type === 'message') go('messages');
    else if (n.type === 'booking') go(isProvider ? 'my-practice' : 'my-bookings');
  }, [go, isProvider]);

  const meta = TAB_META[tab] || { title: 'LUCA Passport', sub: '' };
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Member';

  return (
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
                <div className="brand-sub">Sovereign Passport</div>
              </div>
            </div>
          </div>

          <nav className="col" style={{ gap: 1 }}>
            {nav.map((grp) => (
              <div key={grp.group}>
                <div className="nav-label"><span className="dot" style={{ background: grp.color }} />{grp.group}</div>
                {grp.items.map((it) => {
                  const Icon = it.icon;
                  const count = it.badgeKey ? badges[it.badgeKey] : 0;
                  return (
                    <button key={it.id} className={`nav-item ${tab === it.id ? 'active' : ''}`} onClick={() => go(it.id)}>
                      <Icon size={17} strokeWidth={2} />
                      <span>{it.label}</span>
                      {count > 0 && <span className="badge">{count}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {!user?.isProvider && (
            appStatus?.status === 'pending' ? (
              <div className="become-provider pending" title="Your application is under review">
                <Clock size={16} strokeWidth={2} />
                <span>Application under review</span>
              </div>
            ) : (
              <button className="become-provider" onClick={() => { setShowApplication(true); setDrawer(false); }}>
                <Briefcase size={16} strokeWidth={2} />
                <span>{appStatus?.status === 'rejected' ? 'Reapply as Provider' : 'Become a Provider'}</span>
              </button>
            )
          )}

          {/* Account footer — avatar, name/email, and sign out at the very bottom */}
          <div style={{ marginTop: user?.isProvider ? 'auto' : 0, borderTop: '1px solid rgba(255,255,255,.1)', padding: '14px 16px' }}>
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
            <div className="search">
              <Search size={16} />
              <input placeholder="Search your passport, care, and value…" />
            </div>
            <NotificationCenter onNavigate={handleNotificationNavigate} />
            <Avatar name={displayName} size={39} />
          </header>

          <main className="page">
            <PageHead title={meta.title} sub={meta.sub}
              action={
                <div className="row gap-2" style={{ alignItems: 'center' }}>
                  <Pill tone="mint" icon={ShieldCheck}>{SOLARIS_ROLE_LABEL[effectiveRole] || roleLabel(role)}</Pill>
                </div>
              } />
            <TabPage tab={tab} user={user} go={go} effectiveRole={effectiveRole} onUnread={(n) => setBadges((b) => ({ ...b, messages: n }))} onBecomeProvider={() => setShowApplication(true)} onApprovalStats={(s) => setBadges((b) => ({ ...b, approvals: s.pending || 0 }))} onBookings={(n) => setBadges((b) => ({ ...b, bookings: n }))} />
          </main>
        </div>
      </div>

      {/* Floating LUCA assistant — available everywhere except the full Coach page */}
      <LucaWidget user={user} hidden={tab === 'coach'} go={go} />

      {showApplication && (
        <ProviderApplication
          user={user}
          onClose={() => setShowApplication(false)}
          onSubmitted={() => { setShowApplication(false); refreshUser?.(); }}
        />
      )}
    </div>
  );
}
