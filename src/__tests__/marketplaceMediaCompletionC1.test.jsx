/**
 * Node C — Marketplace media completion validation.
 *
 * Guards the FRONTEND-ONLY synthetic media overlay for the 21 investor-demo
 * providers (src/lib/providerMedia.js + public/media/providers/**):
 *   • every demo provider resolves a cover
 *   • every referenced local asset actually exists on disk
 *   • no resolver ever returns a remote (http/https) URL — no runtime hotlinks
 *   • featured providers expose >=3 gallery images
 *   • practitioner providers expose a portrait (file present)
 *   • alt text is always non-empty
 *   • cards/detail render with accessible image names and a demo indicator,
 *     and image clicks never block Open on the card.
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MEDIA_BY_ID, providerCover, providerCoverSm, providerProfile, providerProfileSm,
  providerGallery, providerAlt, providerMediaKey, isSimulated,
} from '../lib/providerMedia.js';

const PUBLIC = path.resolve(process.cwd(), 'public');
const localExists = (url) => fs.existsSync(path.join(PUBLIC, url.replace(/^\//, '')));
const isRemote = (url) => /^https?:\/\//i.test(url);

const ids = Object.keys(MEDIA_BY_ID);
const prov = (id) => ({ id, business_name: MEDIA_BY_ID[id].mediaKey, provider_type: MEDIA_BY_ID[id].type });

describe('providerMedia — inventory', () => {
  it('maps exactly 21 demo providers', () => {
    expect(ids.length).toBe(21);
  });

  it('every demo provider resolves a cover that exists locally and is not remote', () => {
    for (const id of ids) {
      const p = prov(id);
      const cover = providerCover(p);
      const coverSm = providerCoverSm(p);
      expect(cover, `cover ${id}`).toBeTruthy();
      expect(isRemote(cover)).toBe(false);
      expect(isRemote(coverSm)).toBe(false);
      expect(localExists(cover), `missing ${cover}`).toBe(true);
      expect(localExists(coverSm), `missing ${coverSm}`).toBe(true);
    }
  });

  it('every referenced gallery asset exists locally and is never remote', () => {
    for (const id of ids) {
      const g = providerGallery(prov(id));
      expect(g.length).toBeGreaterThan(0);
      for (const u of g) {
        expect(isRemote(u), `remote url ${u}`).toBe(false);
        expect(localExists(u), `missing ${u}`).toBe(true);
      }
    }
  });

  it('featured providers expose at least 3 gallery images', () => {
    for (const id of ids) {
      if (!MEDIA_BY_ID[id].featured) continue;
      expect(providerGallery(prov(id)).length, `featured ${id}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('remaining venues expose a cover + at least one secondary image', () => {
    for (const id of ids) {
      if (MEDIA_BY_ID[id].featured) continue;
      expect(providerGallery(prov(id)).length, `venue ${id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('practitioner providers expose a portrait that exists locally', () => {
    for (const id of ids) {
      if (!MEDIA_BY_ID[id].practitioner) continue;
      const p = prov(id);
      const full = providerProfile(p);
      const sm = providerProfileSm(p);
      expect(full, `portrait ${id}`).toBeTruthy();
      expect(isRemote(full)).toBe(false);
      expect(localExists(full), `missing ${full}`).toBe(true);
      expect(localExists(sm), `missing ${sm}`).toBe(true);
    }
  });

  it('alt text is always a non-empty string', () => {
    for (const id of ids) {
      const p = prov(id);
      for (const kind of ['cover', 'portrait', 'gallery']) {
        const a = providerAlt(p, kind);
        expect(typeof a).toBe('string');
        expect(a.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('all demo providers are flagged simulated; unknown ids are not', () => {
    for (const id of ids) expect(isSimulated(prov(id))).toBe(true);
    expect(isSimulated({ id: 'not-a-demo-id' })).toBe(false);
    expect(providerMediaKey({ id: 'not-a-demo-id' })).toBe(null);
  });

  it('prefers real backend media over the synthetic overlay when present', () => {
    const id = ids[0];
    const REAL_COVER = 'REAL-BACKEND-COVER-VALUE';
    const REAL_FACE = 'REAL-BACKEND-PROFILE-VALUE';
    const p = { id, cover_photo_url: REAL_COVER, profile_photo_url: REAL_FACE, provider_type: MEDIA_BY_ID[id].type };
    // When real backend data is supplied the resolver returns it verbatim.
    expect(providerCover(p)).toBe(REAL_COVER);
    expect(providerProfile(p)).toBe(REAL_FACE);
  });

  it('map preview uses the small (compact) cover variant', () => {
    const p = prov(ids[0]);
    expect(providerCoverSm(p)).toMatch(/-sm\.webp$/);
    expect(providerCover(p)).toMatch(/cover\.webp$/);
  });
});

describe('ProviderListingCard — media integration', () => {
  it('renders a cover image with accessible alt text and a demo indicator, and image click still opens the card', async () => {
    const { default: ProviderListingCard } = await import('../components/marketplace/ProviderListingCard.jsx');
    const p = { ...prov(ids[0]), rating: 4.7, review_count: 20, city: 'Antigua' };
    const onOpen = vi.fn();
    render(<ProviderListingCard provider={p} onOpen={onOpen} onHover={() => {}} active={false} priority />);
    const imgs = screen.getAllByRole('img');
    const img = imgs.find((el) => (el.getAttribute('src') || '').startsWith('/media/providers/'));
    expect(img).toBeTruthy();
    expect(img.getAttribute('alt')?.trim().length).toBeGreaterThan(0);
    expect(img.getAttribute('src')).toMatch(/^\/media\/providers\//);
    expect(screen.getByText('Demo')).toBeInTheDocument();
    // Clicking the image bubbles to the card's onOpen (not blocked).
    fireEvent.click(img);
    expect(onOpen).toHaveBeenCalled();
  });
});
