/**
 * providerMedia — FRONTEND-ONLY deterministic media resolver for the
 * investor-demo marketplace.
 *
 * The backend marketplace API returns providers whose `cover_photo_url` and
 * `profile_photo_url` are null (no media column is seeded). Rather than
 * change the backend/DB/seeds, this module maps each provider's STABLE id
 * (UUID, the same id booking uses) to a set of curated LOCAL image assets that
 * ship in `public/media/providers/<media-key>/`. No provider id is changed and
 * no second provider dataset is created — this is a pure presentation overlay.
 *
 * All returned URLs are ROOT-RELATIVE (`/media/...`, served by Vite/nginx from
 * `public/`). No resolver ever returns a remote (http/https) URL for demo
 * providers, so nothing hotlinks at runtime.
 *
 * Assets are AI-generated (synthetic) — see public/media/providers/manifest.json
 * and nodeC-license-manifest for provenance. Because they are simulated, every
 * demo provider is flagged via isSimulated() so the UI can label it honestly.
 */

const BASE = '/media/providers';

// provider UUID -> media descriptor. Generated from the deterministic audit of
// the 21 investor-demo providers (see nodeC-media-completeness). Do NOT edit ids.
export const MEDIA_BY_ID = {
  '8d20d1e3-9a44-482d-a2ea-f4895536a245': { mediaKey: 'aguas-termales-spa', type: 'spa', featured: true, practitioner: false, assets: ["cover", "g1", "g2"] },
  '58bb7334-14a7-488e-a640-965b8d7ae62a': { mediaKey: 'sonrisa-dental-studio', type: 'dentist', featured: true, practitioner: false, assets: ["cover", "g1", "g2"] },
  '38429428-e2de-48c5-8f86-f1ad7abfa6b9': { mediaKey: 'espacio-calma-psicologia', type: 'therapist', featured: true, practitioner: true, assets: ["cover", "portrait", "g1"] },
  'b75a1c72-4247-41e8-b363-cebd9c823fde': { mediaKey: 'dr-mateo-reyes', type: 'doctor', featured: true, practitioner: true, assets: ["cover", "portrait", "g1"] },
  '6ecd4a48-3484-4d08-b13c-c5d24ecfc65a': { mediaKey: 'raices-wellness-studio', type: 'wellness', featured: true, practitioner: false, assets: ["cover", "g1", "g2"] },
  '46e69b84-195c-431f-8e87-2daca63bd8ac': { mediaKey: 'nutrir-vida', type: 'nutritionist', featured: false, practitioner: true, assets: ["cover", "portrait", "g1"] },
  'bd8f4f59-06bb-45d0-8bd9-5c88011b31e4': { mediaKey: 'serenidad-spa', type: 'spa', featured: false, practitioner: false, assets: ["cover", "g1"] },
  '463387e1-8faa-4a3b-9cef-ed775667628a': { mediaKey: 'taller-respira', type: 'workshop', featured: false, practitioner: false, assets: ["cover", "g1"] },
  '9036d652-6fbd-4ce8-9568-2103a03fdd1d': { mediaKey: 'clinica-vida-integral', type: 'doctor', featured: false, practitioner: true, assets: ["cover", "portrait", "g1"] },
  '6e2d9727-1d3c-454f-8f8e-f7100fc1b8ee': { mediaKey: 'fuerza-funcional-gym', type: 'gym', featured: false, practitioner: false, assets: ["cover", "g1"] },
  '6a02cd86-5344-45d1-9c51-15b30e5c9b0c': { mediaKey: 'mindful-therapy-collective', type: 'therapist', featured: false, practitioner: true, assets: ["cover", "portrait", "g1"] },
  '6dd62a63-218f-4978-81a1-b7a0e6e74a87': { mediaKey: 'dentalcare-antigua', type: 'dentist', featured: false, practitioner: false, assets: ["cover", "g1"] },
  '3b9eb081-e3a5-4078-a47d-121b3998bc4f': { mediaKey: 'finca-el-roble', type: 'farm', featured: false, practitioner: false, assets: ["cover", "g1"] },
  'b6636e91-3fde-46be-940e-bf6a2bd05700': { mediaKey: 'clinica-holistica-amanecer', type: 'clinic', featured: false, practitioner: false, assets: ["cover", "g1"] },
  '2d0d0680-65e3-4448-a0e4-a38870fb2c08': { mediaKey: 'pura-vida-wellness', type: 'wellness', featured: false, practitioner: false, assets: ["cover", "g1"] },
  '476fba40-5c3a-4b03-809c-54b19ac877a2': { mediaKey: 'centro-medico-aurora', type: 'doctor', featured: false, practitioner: true, assets: ["cover", "portrait", "g1"] },
  '9f324be8-1557-4d26-9814-a8273defd629': { mediaKey: 'cocina-consciente', type: 'workshop', featured: false, practitioner: false, assets: ["cover", "g1"] },
  '074c8999-08eb-4e6c-9e38-19a14c0d8319': { mediaKey: 'movimiento-studio', type: 'gym', featured: false, practitioner: false, assets: ["cover", "g1"] },
  '95f604ba-185f-436d-9f7d-66d133ab87a7': { mediaKey: 'balance-nutricion', type: 'nutritionist', featured: false, practitioner: true, assets: ["cover", "portrait", "g1"] },
  '661d1727-e01b-4a3c-b7f4-706925eb2988': { mediaKey: 'centro-salud-ceiba', type: 'clinic', featured: false, practitioner: false, assets: ["cover", "g1"] },
  'bb49cb31-a669-4cd3-ae83-e8f34c9eab03': { mediaKey: 'granja-la-cosecha', type: 'farm', featured: false, practitioner: false, assets: ["cover", "g1"] },
};

// Human-readable labels for alt text, keyed by provider_type.
const TYPE_LABEL = {
  spa: 'spa', dentist: 'dental studio', therapist: 'therapy practice',
  doctor: 'integrative medicine practice', wellness: 'wellness studio',
  nutritionist: 'nutrition practice', workshop: 'wellness workshop space',
  gym: 'fitness studio', clinic: 'health clinic', farm: 'organic farm',
};

function entry(provider) {
  if (!provider || !provider.id) return null;
  return MEDIA_BY_ID[provider.id] || null;
}

function assetUrl(mediaKey, asset, small) {
  return `${BASE}/${mediaKey}/${asset}${small ? '-sm' : ''}.webp`;
}

/** Stable media key for a provider (or null if not a demo provider). */
export function providerMediaKey(provider) {
  const e = entry(provider);
  return e ? e.mediaKey : null;
}

/** True when the provider is one of the simulated demo profiles. */
export function isSimulated(provider) {
  return !!entry(provider);
}

/**
 * Full-size cover. Prefers real backend media when present (future real data),
 * else the local synthetic cover, else null.
 */
export function providerCover(provider) {
  if (provider?.cover_photo_url) return provider.cover_photo_url;
  const e = entry(provider);
  return e ? assetUrl(e.mediaKey, 'cover', false) : null;
}

/** Thumbnail cover (card / marker preview). */
export function providerCoverSm(provider) {
  if (provider?.cover_photo_url) return provider.cover_photo_url;
  const e = entry(provider);
  return e ? assetUrl(e.mediaKey, 'cover', true) : null;
}

/**
 * Practitioner portrait (for practitioner-type providers). Prefers real backend
 * profile photo, else the local synthetic portrait, else null.
 */
export function providerProfile(provider) {
  if (provider?.profile_photo_url) return provider.profile_photo_url;
  const e = entry(provider);
  if (e && e.assets.includes('portrait')) return assetUrl(e.mediaKey, 'portrait', false);
  return null;
}

/** Small square portrait (avatar). */
export function providerProfileSm(provider) {
  if (provider?.profile_photo_url) return provider.profile_photo_url;
  const e = entry(provider);
  if (e && e.assets.includes('portrait')) return assetUrl(e.mediaKey, 'portrait', true);
  return null;
}

/**
 * Ordered gallery of full-size images for the detail modal / gallery surface:
 * cover first, then secondary venue shots, then the practitioner portrait last.
 * Optionally merges backend photo URLs (kept first when present).
 */
export function providerGallery(provider, backendPhotos) {
  const e = entry(provider);
  const out = [];
  if (Array.isArray(backendPhotos)) for (const u of backendPhotos) if (u) out.push(u);
  if (e) {
    out.push(assetUrl(e.mediaKey, 'cover', false));
    for (const a of e.assets) {
      if (a === 'cover' || a === 'portrait') continue;
      out.push(assetUrl(e.mediaKey, a, false));
    }
    if (e.assets.includes('portrait')) out.push(assetUrl(e.mediaKey, 'portrait', false));
  }
  // de-dupe, preserve order
  return out.filter((v, i, a) => v && a.indexOf(v) === i);
}

/** Accessible alt text for a provider image. kind: 'cover'|'portrait'|'gallery'. */
export function providerAlt(provider, kind) {
  const name = provider?.business_name || 'Provider';
  const label = TYPE_LABEL[provider?.provider_type] || 'wellness provider';
  if (kind === 'portrait') return `Portrait of the practitioner at ${name}`;
  if (kind === 'gallery') return `Photo of ${name}, a ${label}`;
  return `${name} — ${label} cover photo`;
}
