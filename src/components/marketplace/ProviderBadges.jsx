/**
 * Provider trust badges + type metadata shared across the marketplace UI.
 *  - PROVIDER_TYPES: canonical list (id, label, icon, accent) used by filters,
 *    cards and the onboarding flow.
 *  - typeMeta(id): lookup helper.
 *  - <ProviderBadges/>: renders VTV / Verified / Featured pills for a provider.
 *  - <TypeBadge/>: a single provider-type chip with its icon.
 */
import React from 'react';
import {
  Building2, Stethoscope, Smile, Apple, Brain, Sparkles, Dumbbell,
  Flower2, Leaf, Hammer, BadgeCheck, ShieldCheck, Award,
} from 'lucide-react';

export const PROVIDER_TYPES = [
  { id: 'clinic', label: 'Clinic', icon: Building2, accent: 'teal' },
  { id: 'doctor', label: 'Doctor', icon: Stethoscope, accent: 'teal' },
  { id: 'dentist', label: 'Dentist', icon: Smile, accent: 'teal' },
  { id: 'nutritionist', label: 'Nutritionist', icon: Apple, accent: 'emerald' },
  { id: 'therapist', label: 'Therapist', icon: Brain, accent: 'gold' },
  { id: 'wellness', label: 'Wellness', icon: Sparkles, accent: 'gold' },
  { id: 'gym', label: 'Gym & Fitness', icon: Dumbbell, accent: 'teal' },
  { id: 'spa', label: 'Spa & Recovery', icon: Flower2, accent: 'gold' },
  { id: 'farm', label: 'Organic Farm', icon: Leaf, accent: 'emerald' },
  { id: 'workshop', label: 'Workshop', icon: Hammer, accent: 'emerald' },
];

const TYPE_MAP = Object.fromEntries(PROVIDER_TYPES.map((t) => [t.id, t]));

export function typeMeta(id) {
  return TYPE_MAP[id] || { id, label: id, icon: Building2, accent: 'teal' };
}

export function TypeBadge({ type, size = 13 }) {
  const t = typeMeta(type);
  const Icon = t.icon;
  return (
    <span className={`pb-type pb-${t.accent}`}>
      <Icon size={size} />
      {t.label}
      <style>{CSS}</style>
    </span>
  );
}

export default function ProviderBadges({ provider, size = 13, compact = false }) {
  if (!provider) return null;
  return (
    <span className="pb-row">
      {provider.vtv_certified && (
        <span className="pb-badge pb-vtv" title="VTV-certified verified true value provider">
          <ShieldCheck size={size} /> {!compact && 'VTV'}
        </span>
      )}
      {provider.verified && (
        <span className="pb-badge pb-verified" title="Identity & credentials verified">
          <BadgeCheck size={size} /> {!compact && 'Verified'}
        </span>
      )}
      {provider.featured && (
        <span className="pb-badge pb-featured" title="Featured provider">
          <Award size={size} /> {!compact && 'Featured'}
        </span>
      )}
      <style>{CSS}</style>
    </span>
  );
}

const CSS = `
.luca .pb-row{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.luca .pb-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;
  padding:3px 8px;border-radius:999px;line-height:1;letter-spacing:.01em}
.luca .pb-vtv{background:linear-gradient(135deg,var(--gold-soft),#fff6e0);color:var(--gold-ink);border:1px solid var(--gold)}
.luca .pb-verified{background:var(--mint-soft);color:var(--mint-ink);border:1px solid var(--mint-line)}
.luca .pb-featured{background:rgba(15,118,110,.08);color:var(--teal-d);border:1px solid rgba(15,118,110,.25)}
.luca .pb-type{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;
  padding:4px 10px;border-radius:999px;line-height:1}
.luca .pb-teal{background:rgba(15,118,110,.08);color:var(--teal-d);border:1px solid rgba(15,118,110,.2)}
.luca .pb-emerald{background:var(--mint-soft);color:var(--mint-ink);border:1px solid var(--mint-line)}
.luca .pb-gold{background:var(--gold-soft);color:var(--gold-ink);border:1px solid var(--gold)}
`;
