// Node K1.3 §Phase 7 — PWA / favicon / splash / media artwork branding.
// Structural assertions on the shipped manifest, service worker, HTML head and
// generated icon files. Pixel/alpha inspection of the PNGs is done by reading
// the PNG headers (IHDR color type) — color type 6 == truecolour+alpha.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const P = (rel) => resolve(ROOT, rel);

function pngColorType(path) {
  const b = readFileSync(path);
  // PNG signature 8 bytes, then IHDR: length(4)+"IHDR"(4)+width(4)+height(4)+bitdepth(1)+colortype(1)
  return b[25]; // color type byte
}

describe('Node K1.3 §Phase 7 — manifest icon purposes', () => {
  const manifest = JSON.parse(readFileSync(P('public/manifest.json'), 'utf8'));
  const purposes = manifest.icons.map((i) => i.purpose);

  it('declares separate "any" and "maskable" icons (never combined)', () => {
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
    expect(purposes.every((p) => p === 'any' || p === 'maskable')).toBe(true);
    expect(purposes.some((p) => p.includes(' '))).toBe(false); // no "any maskable"
  });

  it('provides 192 and 512 for both any and maskable', () => {
    const bySize = (purpose) => manifest.icons.filter((i) => i.purpose === purpose).map((i) => i.sizes).sort();
    expect(bySize('any')).toEqual(['192x192', '512x512']);
    expect(bySize('maskable')).toEqual(['192x192', '512x512']);
  });

  it('uses a branded deep-navy/teal background color', () => {
    expect(manifest.background_color.toLowerCase()).toBe('#0b2e33');
  });
});

describe('Node K1.3 §Phase 7 — service worker v17', () => {
  const sw = readFileSync(P('public/sw.js'), 'utf8');
  it('bumps the Solaris cache to v17', () => {
    expect(sw).toMatch(/CACHE_NAME\s*=\s*'solaris-v17'/);
    expect(sw).not.toMatch(/'solaris-v16'/);
  });
  it('precaches the new branding assets', () => {
    expect(sw).toContain('/icons/icon-maskable-192.png');
    expect(sw).toContain('/icons/icon-maskable-512.png');
    expect(sw).toContain('/icons/apple-touch-icon.png');
    expect(sw).toContain('/favicon.svg');
  });
  it('notification icon uses the branded Solaris mark, not a lightning/ico', () => {
    expect(sw).not.toContain("icon: '/favicon.ico'");
    expect(sw).toMatch(/icon:\s*'\/icons\/icon-maskable-192\.png'/);
  });
});

describe('Node K1.3 §Phase 7 — HTML head links', () => {
  const html = readFileSync(P('index.html'), 'utf8');
  it('references the branded apple-touch-icon (no white circle asset)', () => {
    expect(html).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
  });
  it('keeps favicon links (svg + png) pointing at the Solaris mark', () => {
    expect(html).toContain('href="/favicon.svg"');
    expect(html).toContain('href="/favicon.png"');
  });
});

describe('Node K1.3 §Phase 7 — favicon no longer the purple lightning', () => {
  const svg = readFileSync(P('public/favicon.svg'), 'utf8');
  it('contains no purple lightning fill', () => {
    expect(svg).not.toMatch(/863bff/i);
    expect(svg).not.toMatch(/7e14ff/i);
  });
});

describe('Node K1.3 §Phase 7 — generated icon files exist and any-icons are transparent', () => {
  const files = [
    'public/icons/icon-192.png', 'public/icons/icon-512.png',
    'public/icons/icon-maskable-192.png', 'public/icons/icon-maskable-512.png',
    'public/icons/apple-touch-icon.png', 'public/icons/media-artwork-512.png',
    'public/icons/splash-logo-512.png', 'public/favicon.png',
  ];
  it('all branding files exist', () => {
    for (const f of files) expect(existsSync(P(f)), f).toBe(true);
  });
  it('the transparent "any" icons carry an alpha channel (PNG color type 6)', () => {
    expect(pngColorType(P('public/icons/icon-192.png'))).toBe(6);
    expect(pngColorType(P('public/icons/icon-512.png'))).toBe(6);
  });
});
