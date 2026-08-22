/**
 * Node E4 — non-secret release identifiers on /api/health.
 *
 * The health probe must expose a `channel` and `build` label so a deployed
 * channel (e.g. an isolated preview backend) can be distinguished from the
 * shared backend WITHOUT leaking any credential. Both are opaque, env-driven,
 * and default to a non-secret literal. These fields are set before the DB
 * check, so they are present on both the 200 (ready) and 503 (degraded) paths.
 */
const request = require('supertest');
const app = require('../src/server');

describe('GET /api/health non-secret release identifiers', () => {
  const originalChannel = process.env.SOLARIS_CHANNEL;
  const originalBuild = process.env.SOLARIS_BUILD_ID;
  afterEach(() => {
    if (originalChannel === undefined) delete process.env.SOLARIS_CHANNEL;
    else process.env.SOLARIS_CHANNEL = originalChannel;
    if (originalBuild === undefined) delete process.env.SOLARIS_BUILD_ID;
    else process.env.SOLARIS_BUILD_ID = originalBuild;
  });

  test('defaults to non-secret "shared"/"unversioned" when env is unset', async () => {
    delete process.env.SOLARIS_CHANNEL;
    delete process.env.SOLARIS_BUILD_ID;
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body.channel).toBe('shared');
    expect(res.body.build).toBe('unversioned');
  });

  test('echoes env-provided channel/build labels', async () => {
    process.env.SOLARIS_CHANNEL = 'preview-isolated';
    process.env.SOLARIS_BUILD_ID = 'e4j-rc-v1';
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body.channel).toBe('preview-isolated');
    expect(res.body.build).toBe('e4j-rc-v1');
  });

  test('labels never contain credential-looking material', async () => {
    process.env.SOLARIS_CHANNEL = 'preview-isolated';
    process.env.SOLARIS_BUILD_ID = 'e4j-rc-v1';
    const res = await request(app).get('/api/health');
    const blob = JSON.stringify(res.body);
    expect(blob).not.toMatch(/postgres(ql)?:\/\//i);
    expect(blob).not.toMatch(/password|secret|jwt|nsec|mnemonic/i);
  });
});
