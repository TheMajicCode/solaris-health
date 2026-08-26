// NODE K1.4 §5 — Source-quality branding regeneration.
// These assertions go beyond the K1.3 structural checks: they prove the shipped
// marks are HIGH RESOLUTION (real pixel dimensions read from the PNG IHDR), that
// the maskable icon is a full-bleed deep-teal field with NO white circle, and
// that every reference uses the new versioned (-v2) filenames behind cache v19.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const P = (rel) => resolve(ROOT, rel);

// Minimal PNG IHDR reader: signature(8) + len(4) + "IHDR"(4) + width(4) + height(4)
function pngInfo(path) {
  const b = readFileSync(path);
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  const colorType = b[25];
  return { width, height, colorType };
}

// Read the TOP-LEFT RGBA pixel of a color-type-6 PNG. For pixel (0,0) every PNG
// filter (None/Sub/Up/Average/Paeth) references only left/up/up-left samples,
// which are all zero at the origin, so the reconstructed pixel equals the raw
// filtered bytes regardless of the filter chosen — no full un-filtering needed.
function topLeftRGBA(path) {
  const b = readFileSync(path);
  let off = 8; // skip signature
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(b.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len; // len(4)+type(4)+data(len)+crc(4)
  }
  const raw = inflateSync(Buffer.concat(idat));
  // raw[0] = scanline 0 filter byte; raw[1..4] = R,G,B,A of pixel (0,0)
  return { r: raw[1], g: raw[2], b: raw[3], a: raw[4] };
}

describe('K1.4 §5 — versioned filenames + cache v19', () => {
  const sw = readFileSync(P('public/sw.js'), 'utf8');
  const manifest = JSON.parse(readFileSync(P('public/manifest.json'), 'utf8'));
  const html = readFileSync(P('index.html'), 'utf8');

  it('service worker cache is v18 (never still v17)', () => {
    expect(sw).toMatch(/CACHE_NAME\s*=\s*'solaris-v19'/);
    expect(sw).not.toMatch(/'solaris-v18'/);
  });

  it('manifest references only versioned -v2 icons', () => {
    for (const icon of manifest.icons) {
      expect(icon.src, icon.src).toMatch(/-v2\.png$/);
    }
  });

  it('HTML head + service worker reference no stale un-versioned assets', () => {
    for (const stale of [
      'href="/favicon.png"', 'href="/favicon-32.png"',
      '/icons/icon-192.png', '/icons/icon-512.png',
      '/icons/apple-touch-icon.png', '/solaris-logo.png',
    ]) {
      expect(html.includes(stale), `html:${stale}`).toBe(false);
      expect(sw.includes(`'${stale}'`), `sw:${stale}`).toBe(false);
    }
  });
});

describe('K1.4 §5 — high-resolution marks from the 2048 master', () => {
  it('splash/onboarding mark is >= 1024px (never a small app icon upscaled)', () => {
    const f = P('public/icons/splash-logo-1024-v2.png');
    expect(existsSync(f)).toBe(true);
    const { width, height } = pngInfo(f);
    expect(Math.min(width, height)).toBeGreaterThanOrEqual(1024);
  });

  it('the large in-app displayed logo is >= 1024px', () => {
    const f = P('public/solaris-logo-v2.png');
    expect(existsSync(f)).toBe(true);
    const { width, height, colorType } = pngInfo(f);
    expect(Math.min(width, height)).toBeGreaterThanOrEqual(1024);
    expect(colorType).toBe(6); // transparent
  });

  it('"any" PWA icons are transparent (color type 6) at 192 and 512', () => {
    expect(pngInfo(P('public/icons/icon-192-v2.png')).colorType).toBe(6);
    expect(pngInfo(P('public/icons/icon-512-v2.png')).colorType).toBe(6);
  });
});

describe('K1.4 §5 — maskable icon is a full-bleed deep-teal field, no white circle', () => {
  it('maskable corners are opaque Solaris deep-teal (#0B2E33), never white/transparent', () => {
    for (const f of ['public/icons/icon-maskable-192-v2.png', 'public/icons/icon-maskable-512-v2.png']) {
      const px = topLeftRGBA(P(f));
      expect(px.a, `${f} alpha`).toBe(255);                 // full-bleed, not transparent
      expect(Math.abs(px.r - 11), `${f} R`).toBeLessThanOrEqual(3);   // #0B
      expect(Math.abs(px.g - 46), `${f} G`).toBeLessThanOrEqual(3);   // #2E
      expect(Math.abs(px.b - 51), `${f} B`).toBeLessThanOrEqual(3);   // #33
      // Not a white circle / white field.
      expect(px.r > 200 && px.g > 200 && px.b > 200, `${f} white`).toBe(false);
    }
  });

  it('the transparent "any" icon corner is fully transparent (no baked field)', () => {
    expect(topLeftRGBA(P('public/icons/icon-512-v2.png')).a).toBe(0);
  });

  it('separate any + maskable purposes at both sizes (unchanged K1.3 contract)', () => {
    const manifest = JSON.parse(readFileSync(P('public/manifest.json'), 'utf8'));
    const any = manifest.icons.filter((i) => i.purpose === 'any').map((i) => i.sizes).sort();
    const mask = manifest.icons.filter((i) => i.purpose === 'maskable').map((i) => i.sizes).sort();
    expect(any).toEqual(['192x192', '512x512']);
    expect(mask).toEqual(['192x192', '512x512']);
  });
});
