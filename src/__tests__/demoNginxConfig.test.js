/**
 * Durable demo nginx template (correction §3) — the committed vhost for
 * demo.solarishealth.app must serve the demo release path, not the stable one,
 * so the demo site can never silently fall back to stable content.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const conf = readFileSync(resolve(here, '../../deploy/demo-solarishealth-app.conf'), 'utf8');

describe('committed demo-solarishealth-app.conf', () => {
  it('points the demo root at the demo release, never the stable one', () => {
    expect(conf).toMatch(/root\s+\/opt\/solaris-beta-demo\/current\/dist;/);
    expect(conf).not.toMatch(/root\s+\/opt\/solaris-beta\/current\/dist;/);
  });

  it('serves the demo.solarishealth.app hostname', () => {
    expect(conf).toMatch(/server_name\s+demo\.solarishealth\.app;/);
  });
});
