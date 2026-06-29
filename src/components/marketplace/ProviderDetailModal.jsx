/**
 * ProviderDetailModal — full provider profile in an overlay.
 *  • Photo gallery carousel (cover + gallery photos).
 *  • Header: name, type, rating, badges, price, contact actions.
 *  • Sections: About, Services & pricing, Credentials, Reviews (+ write a review),
 *    Hours, and a mini Leaflet map.
 *  • Lets the signed-in user submit a rating/review and claim an unclaimed listing.
 *
 * Props:
 *   providerId  id to load
 *   user        current user (for review attribution)
 *   onClose     ()=>void
 *   onUpdated   ()=>void   — called after a review so the list can refresh
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  X, MapPin, Phone, Globe, Mail, Clock, ChevronLeft, ChevronRight, Loader2,
  Award, ShieldCheck, BadgeCheck, Check, Star, ExternalLink, Tag,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../../lib/api.js';
import RatingStars from './RatingStars.jsx';
import ProviderBadges, { TypeBadge, typeMeta } from './ProviderBadges.jsx';

const DAYS = [
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'],
  ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
];

function miniPin(accent) {
  const color = accent === 'gold' ? '#d4a52a' : accent === 'emerald' ? '#10b981' : '#0f766e';
  return L.divIcon({
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
    className: 'mv-divicon', iconSize: [22, 22], iconAnchor: [11, 20],
  });
}

export default function ProviderDetailModal({ providerId, user, onClose, onUpdated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [slide, setSlide] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await api.getProvider(providerId);
      setData(d);
    } catch (e) {
      setErr(e.message || 'Could not load provider');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => { load(); }, [load]);

  // Delay mounting the Leaflet map until the modal entrance animation/layout
  // settles — initializing Leaflet in a not-yet-laid-out container throws
  // "Invalid LatLng object: (NaN, NaN)".
  useEffect(() => {
    if (loading || !data) return;
    const t = setTimeout(() => setMapReady(true), 450);
    return () => clearTimeout(t);
  }, [loading, data]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const submitReview = async () => {
    if (!myRating) return;
    setSubmitting(true);
    try {
      await api.addProviderReview(providerId, { rating: myRating, review_text: myText.trim() || null });
      setSubmitted(true); setMyText(''); setMyRating(0);
      await load();
      onUpdated && onUpdated();
    } catch (e) {
      setErr(e.message || 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const p = data?.provider;
  const photos = data
    ? [p.cover_photo_url, ...(data.photos || []).map((x) => x.photo_url)]
        .filter((v, i, a) => v && a.indexOf(v) === i)
    : [];
  const accent = p ? typeMeta(p.provider_type).accent : 'teal';
  let hours = null;
  try { hours = p?.hours_of_operation ? (typeof p.hours_of_operation === 'string' ? JSON.parse(p.hours_of_operation) : p.hours_of_operation) : null; } catch { hours = null; }
  let specialties = [];
  try { specialties = p?.specialties ? (typeof p.specialties === 'string' ? JSON.parse(p.specialties) : p.specialties) : []; } catch { specialties = []; }

  return (
    <div className="pdm-overlay" onClick={onClose}>
      <div className="pdm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="pdm-close" onClick={onClose} aria-label="Close"><X size={20} /></button>

        {loading && <div className="pdm-loading"><Loader2 className="pdm-spin" size={28} /> Loading…</div>}
        {err && !loading && <div className="pdm-error">{err}</div>}

        {p && !loading && (
          <div className="pdm-scroll">
            {/* Gallery */}
            <div className="pdm-gallery">
              {photos.length > 0 ? (
                <>
                  <img src={photos[slide]} alt={p.business_name} className="pdm-gimg" />
                  {photos.length > 1 && (
                    <>
                      <button className="pdm-nav pdm-prev" onClick={() => setSlide((s) => (s - 1 + photos.length) % photos.length)}><ChevronLeft size={20} /></button>
                      <button className="pdm-nav pdm-next" onClick={() => setSlide((s) => (s + 1) % photos.length)}><ChevronRight size={20} /></button>
                      <div className="pdm-dots">
                        {photos.map((_, i) => (
                          <button key={i} className={`pdm-dot${i === slide ? ' on' : ''}`} onClick={() => setSlide(i)} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : <div className="pdm-gnoimg"><MapPin size={32} /></div>}
              {p.featured && <span className="pdm-feat"><Award size={13} /> Featured</span>}
            </div>

            {/* Header */}
            <div className="pdm-head">
              <div className="pdm-head-l">
                <TypeBadge type={p.provider_type} />
                <h2 className="pdm-name">{p.business_name}</h2>
                <div className="pdm-rate">
                  <RatingStars value={Number(p.rating) || 0} count={p.review_count} showValue size={17} />
                  {p.price_range && <span className="pdm-price">· {p.price_range}</span>}
                </div>
                <ProviderBadges provider={p} size={13} />
              </div>
            </div>

            {/* Contact actions */}
            <div className="pdm-actions">
              {p.phone && <a className="pdm-act" href={`tel:${p.phone}`}><Phone size={15} /> Call</a>}
              {p.website && <a className="pdm-act" href={p.website} target="_blank" rel="noreferrer"><Globe size={15} /> Website <ExternalLink size={11} /></a>}
              {p.email && <a className="pdm-act" href={`mailto:${p.email}`}><Mail size={15} /> Email</a>}
              {(p.latitude && p.longitude) && (
                <a className="pdm-act" href={`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=16/${p.latitude}/${p.longitude}`} target="_blank" rel="noreferrer">
                  <MapPin size={15} /> Directions <ExternalLink size={11} />
                </a>
              )}
            </div>

            <div className="pdm-grid">
              <div className="pdm-main">
                {/* About */}
                {p.description && (
                  <section className="pdm-sec">
                    <h3 className="pdm-h3">About</h3>
                    <p className="pdm-about">{p.description}</p>
                    {specialties.length > 0 && (
                      <div className="pdm-tags">
                        {specialties.map((s, i) => <span key={i} className="pdm-tag">{s}</span>)}
                      </div>
                    )}
                  </section>
                )}

                {/* Services */}
                {data.services?.length > 0 && (
                  <section className="pdm-sec">
                    <h3 className="pdm-h3"><Tag size={15} /> Services & pricing</h3>
                    <div className="pdm-services">
                      {data.services.map((s) => (
                        <div className="pdm-service" key={s.id}>
                          <div className="pdm-service-l">
                            <span className="pdm-service-n">{s.service_name}</span>
                            {s.description && <span className="pdm-service-d">{s.description}</span>}
                            <span className="pdm-service-m">
                              {s.category && <span className="pdm-service-cat">{s.category}</span>}
                              {s.duration_minutes && <span>· {s.duration_minutes} min</span>}
                            </span>
                          </div>
                          {s.price != null && <span className="pdm-service-p">${Number(s.price).toFixed(0)}</span>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Credentials */}
                {data.credentials?.length > 0 && (
                  <section className="pdm-sec">
                    <h3 className="pdm-h3"><ShieldCheck size={15} /> Credentials & trust</h3>
                    <div className="pdm-creds">
                      {data.credentials.map((c) => {
                        const Icon = c.credential_type === 'vtv_badge' ? ShieldCheck
                          : c.credential_type === 'award' ? Award
                          : c.credential_type === 'license' ? BadgeCheck : Check;
                        return (
                          <div className={`pdm-cred pdm-cred-${c.credential_type}`} key={c.id}>
                            <Icon size={16} />
                            <div>
                              <span className="pdm-cred-n">{c.credential_name}</span>
                              {c.issued_by && <span className="pdm-cred-by">{c.issued_by}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Reviews */}
                <section className="pdm-sec">
                  <h3 className="pdm-h3"><Star size={15} /> Reviews ({p.review_count || 0})</h3>

                  {user && (
                    <div className="pdm-writebox">
                      {submitted ? (
                        <div className="pdm-thanks"><Check size={16} /> Thanks for your review!</div>
                      ) : (
                        <>
                          <div className="pdm-write-top">
                            <span className="pdm-write-label">Rate your experience</span>
                            <RatingStars value={myRating} onChange={setMyRating} size={22} />
                          </div>
                          <textarea
                            className="pdm-textarea"
                            placeholder="Share details about your visit (optional)…"
                            value={myText}
                            onChange={(e) => setMyText(e.target.value)}
                            rows={2}
                          />
                          <button className="pdm-submit" disabled={!myRating || submitting} onClick={submitReview}>
                            {submitting ? <Loader2 className="pdm-spin" size={15} /> : 'Submit review'}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="pdm-reviews">
                    {data.reviews?.length > 0 ? data.reviews.map((r) => (
                      <div className="pdm-review" key={r.id}>
                        <div className="pdm-review-top">
                          <span className="pdm-review-author">{r.author_name || 'Member'}</span>
                          <RatingStars value={r.rating} size={13} />
                        </div>
                        {r.review_text && <p className="pdm-review-text">{r.review_text}</p>}
                      </div>
                    )) : <p className="pdm-empty">No reviews yet — be the first.</p>}
                  </div>
                </section>
              </div>

              {/* Sidebar */}
              <aside className="pdm-side">
                {(mapReady && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) && Number(p.latitude) !== 0) && (
                  <div className="pdm-mapbox">
                    <MapContainer center={[Number(p.latitude), Number(p.longitude)]} zoom={14} className="pdm-map"
                      scrollWheelZoom={false} zoomControl={false} dragging={false} doubleClickZoom={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                      <Marker position={[Number(p.latitude), Number(p.longitude)]} icon={miniPin(accent)} />
                    </MapContainer>
                  </div>
                )}
                <div className="pdm-info">
                  {p.address && <div className="pdm-info-row"><MapPin size={15} /><span>{p.address}{p.city ? `, ${p.city}` : ''}</span></div>}
                  {p.phone && <div className="pdm-info-row"><Phone size={15} /><span>{p.phone}</span></div>}
                  {p.website && <div className="pdm-info-row"><Globe size={15} /><a href={p.website} target="_blank" rel="noreferrer">{p.website.replace(/^https?:\/\//, '')}</a></div>}
                </div>
                {hours && (
                  <div className="pdm-hours">
                    <span className="pdm-hours-title"><Clock size={14} /> Hours</span>
                    {DAYS.map(([k, label]) => (
                      <div className="pdm-hours-row" key={k}>
                        <span>{label}</span><span className="pdm-hours-v">{hours[k] || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .pdm-overlay{position:fixed;inset:0;background:rgba(2,18,24,.55);backdrop-filter:blur(4px);z-index:4000;
  display:flex;align-items:flex-start;justify-content:center;padding:28px 16px;overflow-y:auto}
.luca .pdm{position:relative;width:100%;max-width:920px;background:var(--surface);border-radius:var(--r-lg);
  box-shadow:0 24px 70px rgba(2,18,24,.4);overflow:hidden;animation:pdmin .25s ease}
@keyframes pdmin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.luca .pdm-close{position:absolute;top:14px;right:14px;z-index:20;width:38px;height:38px;border-radius:50%;
  background:rgba(255,255,255,.92);border:none;cursor:pointer;display:grid;place-items:center;color:var(--ink);box-shadow:var(--shadow-sm);transition:all .15s}
.luca .pdm-close:hover{background:#fff;transform:scale(1.06)}
.luca .pdm-loading,.luca .pdm-error{padding:80px 20px;text-align:center;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:12px}
.luca .pdm-spin{animation:pdmspin 1s linear infinite}
@keyframes pdmspin{to{transform:rotate(360deg)}}
.luca .pdm-scroll{max-height:calc(100vh - 56px);overflow-y:auto}
.luca .pdm-gallery{position:relative;height:300px;background:var(--surface-2)}
.luca .pdm-gimg{width:100%;height:100%;object-fit:cover;display:block}
.luca .pdm-gnoimg{height:100%;display:grid;place-items:center;color:var(--muted)}
.luca .pdm-nav{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;
  background:rgba(255,255,255,.9);border:none;cursor:pointer;display:grid;place-items:center;color:var(--ink);box-shadow:var(--shadow-sm)}
.luca .pdm-prev{left:12px}.luca .pdm-next{right:12px}
.luca .pdm-nav:hover{background:#fff}
.luca .pdm-dots{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px}
.luca .pdm-dot{width:7px;height:7px;border-radius:50%;border:none;background:rgba(255,255,255,.55);cursor:pointer;padding:0}
.luca .pdm-dot.on{background:#fff;width:20px;border-radius:4px}
.luca .pdm-feat{position:absolute;top:14px;left:14px;display:inline-flex;align-items:center;gap:4px;
  background:linear-gradient(135deg,var(--gold),var(--gold-2));color:#3a2c05;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px}
.luca .pdm-head{padding:18px 24px 0}
.luca .pdm-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:25px;margin:8px 0 8px;color:var(--ink);line-height:1.15}
.luca .pdm-rate{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.luca .pdm-price{font-weight:700;color:var(--teal-d);font-family:'IBM Plex Mono',monospace}
.luca .pdm-actions{display:flex;flex-wrap:wrap;gap:9px;padding:16px 24px;border-bottom:1px solid var(--line)}
.luca .pdm-act{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--teal-d);
  text-decoration:none;border:1px solid var(--line);background:var(--surface-2);padding:8px 14px;border-radius:11px;transition:all .15s}
.luca .pdm-act:hover{border-color:var(--mint);background:var(--mint-soft)}
.luca .pdm-grid{display:grid;grid-template-columns:1fr 300px;gap:24px;padding:22px 24px 28px}
.luca .pdm-sec{margin-bottom:24px}
.luca .pdm-h3{display:flex;align-items:center;gap:7px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;margin:0 0 12px;color:var(--ink)}
.luca .pdm-about{font-size:14px;line-height:1.6;color:var(--muted);margin:0 0 12px}
.luca .pdm-tags{display:flex;flex-wrap:wrap;gap:6px}
.luca .pdm-tag{font-size:12px;font-weight:600;color:var(--mint-ink);background:var(--mint-soft);border:1px solid var(--mint-line);padding:4px 10px;border-radius:999px}
.luca .pdm-services{display:flex;flex-direction:column;gap:2px}
.luca .pdm-service{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.luca .pdm-service:last-child{border-bottom:none}
.luca .pdm-service-l{display:flex;flex-direction:column;gap:3px;min-width:0}
.luca .pdm-service-n{font-weight:700;font-size:14px;color:var(--ink)}
.luca .pdm-service-d{font-size:12.5px;color:var(--muted);line-height:1.4}
.luca .pdm-service-m{font-size:11.5px;color:var(--muted-2);display:flex;gap:5px;align-items:center}
.luca .pdm-service-cat{background:var(--surface-2);border-radius:6px;padding:1px 7px;font-weight:600}
.luca .pdm-service-p{font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:16px;color:var(--teal-d);white-space:nowrap}
.luca .pdm-creds{display:flex;flex-direction:column;gap:8px}
.luca .pdm-cred{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;border:1px solid var(--line);background:var(--surface-2)}
.luca .pdm-cred-vtv_badge{border-color:var(--gold);background:var(--gold-soft);color:var(--gold-ink)}
.luca .pdm-cred-award{border-color:var(--gold);background:#fff8ea;color:var(--gold-ink)}
.luca .pdm-cred>div{display:flex;flex-direction:column}
.luca .pdm-cred-n{font-weight:700;font-size:13px;color:var(--ink)}
.luca .pdm-cred-by{font-size:12px;color:var(--muted)}
.luca .pdm-writebox{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:14px;margin-bottom:16px}
.luca .pdm-write-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.luca .pdm-write-label{font-size:13px;font-weight:700;color:var(--ink)}
.luca .pdm-textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;font-family:inherit;font-size:13px;resize:vertical;background:var(--surface);color:var(--ink);outline:none}
.luca .pdm-textarea:focus{border-color:var(--mint)}
.luca .pdm-submit{margin-top:10px;background:var(--teal-d);color:#fff;border:none;border-radius:10px;padding:9px 18px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:7px}
.luca .pdm-submit:disabled{opacity:.5;cursor:not-allowed}
.luca .pdm-thanks{display:flex;align-items:center;gap:8px;color:var(--mint-ink);font-weight:700;font-size:14px;padding:6px}
.luca .pdm-reviews{display:flex;flex-direction:column;gap:14px}
.luca .pdm-review{border-bottom:1px solid var(--line);padding-bottom:13px}
.luca .pdm-review:last-child{border-bottom:none}
.luca .pdm-review-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}
.luca .pdm-review-author{font-weight:700;font-size:13px;color:var(--ink)}
.luca .pdm-review-text{font-size:13px;line-height:1.5;color:var(--muted);margin:0}
.luca .pdm-empty{font-size:13px;color:var(--muted)}
.luca .pdm-mapbox{height:180px;border-radius:var(--r-sm);overflow:hidden;border:1px solid var(--line);margin-bottom:14px}
.luca .pdm-map{height:100%;width:100%}
.luca .pdm-info{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.luca .pdm-info-row{display:flex;align-items:flex-start;gap:9px;font-size:13px;color:var(--muted);line-height:1.4}
.luca .pdm-info-row svg{color:var(--teal-d);flex-shrink:0;margin-top:1px}
.luca .pdm-info-row a{color:var(--teal-d);text-decoration:none}
.luca .pdm-hours{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:13px}
.luca .pdm-hours-title{display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;margin-bottom:9px;color:var(--ink)}
.luca .pdm-hours-row{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);padding:2px 0}
.luca .pdm-hours-v{font-weight:600;color:var(--ink)}
@media(max-width:760px){
  .luca .pdm-grid{grid-template-columns:1fr}
  .luca .pdm-gallery{height:230px}
  .luca .pdm-name{font-size:21px}
}
`;
