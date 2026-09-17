'use strict';
/**
 * Unit + negative tests for the Maple provider adapter (src/lib/ai/maple.js).
 * These use a local fake HTTP server — NO network, NO real Maple, NO DB.
 * They assert the privacy/boundary contract: bounded size, deadline,
 * cancellation, class-only errors (no raw provider body), and that the adapter
 * NEVER falls back to another provider (it only ever returns a string or throws).
 */
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

const {
  createMapleAI,
  createMapleProvider,
  mapleMaxOutputTokens,
  MapleIncompleteError,
  MAX_INPUT_CHARS,
  DEFAULT_MAX_OUTPUT_TOKENS,
} = require('../../src/lib/ai/maple');

function startServer(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      resolve({ srv, baseUrl: `http://127.0.0.1:${port}/v1` });
    });
  });
}

test('createMapleProvider throws maple_no_api_key when key absent (no fallback)', () => {
  assert.throws(
    () => createMapleProvider({ LUCA_MAPLE_BASE_URL: 'http://127.0.0.1:1/v1' }),
    (e) => e.message === 'maple_no_api_key' && e.code === 'MAPLE_NO_KEY'
  );
});

test('id is maple:<model> so it reads as an EXTERNAL provider', () => {
  const ai = createMapleAI({ baseUrl: 'http://127.0.0.1:1/v1', model: 'llama3-3-70b', apiKey: 'x' });
  assert.strictEqual(ai.id, 'maple:llama3-3-70b');
});

test('success path returns trimmed assistant content', async () => {
  const secret = 'SECRETKEY-should-never-appear';
  const { srv, baseUrl } = await startServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      // key is sent as bearer, never echoed back
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '  hola mundo  ' } }] }));
    });
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'llama3-3-70b', apiKey: secret });
    const out = await ai.complete({ system: 's', prompt: 'p', context: '' });
    assert.strictEqual(out, 'hola mundo');
  } finally {
    srv.close();
  }
});

test('non-2xx yields class-only error with NO raw provider body leaked', async () => {
  const { srv, baseUrl } = await startServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'UPSTREAM_SENSITIVE_DETAIL', trace: 'do-not-leak' }));
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'm', apiKey: 'x' });
    await assert.rejects(
      () => ai.complete({ system: 's', prompt: 'p' }),
      (e) => {
        assert.strictEqual(e.message, 'maple_proxy_status_500');
        assert.ok(!/UPSTREAM_SENSITIVE_DETAIL/.test(e.message));
        assert.ok(!/do-not-leak/.test(e.message));
        return true;
      }
    );
  } finally {
    srv.close();
  }
});

test('deadline exceeded yields maple_timeout (request is aborted)', async () => {
  const { srv, baseUrl } = await startServer((req, res) => {
    // never respond within the deadline
    setTimeout(() => {
      try { res.end('{}'); } catch (_) {}
    }, 3000);
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'm', apiKey: 'x', timeoutMs: 120 });
    await assert.rejects(
      () => ai.complete({ system: 's', prompt: 'p' }),
      (e) => e.message === 'maple_timeout'
    );
  } finally {
    srv.close();
  }
});

test('external signal abort cancels the in-flight request', async () => {
  const { srv, baseUrl } = await startServer((req, res) => {
    setTimeout(() => { try { res.end('{}'); } catch (_) {} }, 3000);
  });
  try {
    const controller = new AbortController();
    const ai = createMapleAI({ baseUrl, model: 'm', apiKey: 'x', timeoutMs: 60000, signal: controller.signal });
    const p = ai.complete({ system: 's', prompt: 'p' });
    setTimeout(() => controller.abort(), 80);
    await assert.rejects(() => p, (e) => e.message === 'maple_timeout');
  } finally {
    srv.close();
  }
});

test('oversized input is rejected before egress (maple_input_too_large)', async () => {
  let hit = false;
  const { srv, baseUrl } = await startServer((req, res) => {
    hit = true;
    res.writeHead(200); res.end(JSON.stringify({ choices: [{ message: { content: 'x' } }] }));
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'm', apiKey: 'x' });
    const huge = 'a'.repeat(MAX_INPUT_CHARS + 1);
    await assert.rejects(
      () => ai.complete({ system: 's', prompt: huge }),
      (e) => e.message === 'maple_input_too_large'
    );
    assert.strictEqual(hit, false, 'must NOT have contacted the proxy');
  } finally {
    srv.close();
  }
});

test('output tokens are capped at 256 (bounded usage)', () => {
  assert.strictEqual(mapleMaxOutputTokens({ LUCA_MAPLE_MAX_TOKENS: '999' }), 256);
  assert.strictEqual(mapleMaxOutputTokens({ LUCA_MAPLE_MAX_TOKENS: '64' }), 64);
  assert.strictEqual(mapleMaxOutputTokens({}), DEFAULT_MAX_OUTPUT_TOKENS);
});

test('the request actually sends max_tokens<=256 and stream:false', async () => {
  let seen = null;
  const { srv, baseUrl } = await startServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen = JSON.parse(body);
      res.writeHead(200); res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
    });
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'llama3-3-70b', apiKey: 'x', maxOutputTokens: 256 });
    await ai.complete({ system: 's', prompt: 'p' });
    assert.strictEqual(seen.stream, false);
    assert.ok(seen.max_tokens <= 256);
    assert.strictEqual(seen.model, 'llama3-3-70b');
  } finally {
    srv.close();
  }
});

// ── Item 2/4: finish_reason, blank, and provenance (completeDetailed) ────────

test('finish_reason:length => MapleIncompleteError(maple_incomplete_length), not sliced', async () => {
  const { srv, baseUrl } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      model: 'llama3-3-70b',
      choices: [{ finish_reason: 'length', message: { content: '{"reply":"this was cut o' } }],
    }));
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'llama3-3-70b', apiKey: 'x' });
    await assert.rejects(
      () => ai.complete({ system: 's', prompt: 'p' }),
      (e) => e instanceof MapleIncompleteError && e.code === 'maple_incomplete_length'
    );
  } finally {
    srv.close();
  }
});

test('unsupported finish_reason (content_filter) => MapleIncompleteError(maple_incomplete)', async () => {
  const { srv, baseUrl } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ finish_reason: 'content_filter', message: { content: 'blocked' } }] }));
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'm', apiKey: 'x' });
    await assert.rejects(
      () => ai.complete({ system: 's', prompt: 'p' }),
      (e) => e instanceof MapleIncompleteError && e.code === 'maple_incomplete'
    );
  } finally {
    srv.close();
  }
});

test('blank content (finish_reason:stop) => MapleIncompleteError(maple_blank)', async () => {
  const { srv, baseUrl } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '   ' } }] }));
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'm', apiKey: 'x' });
    await assert.rejects(
      () => ai.complete({ system: 's', prompt: 'p' }),
      (e) => e instanceof MapleIncompleteError && e.code === 'maple_blank'
    );
  } finally {
    srv.close();
  }
});

test('finish_reason:stop is accepted as a complete reply', async () => {
  const { srv, baseUrl } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'llama3-3-70b', choices: [{ finish_reason: 'stop', message: { content: 'done' } }] }));
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'llama3-3-70b', apiKey: 'x' });
    const out = await ai.complete({ system: 's', prompt: 'p' });
    assert.strictEqual(out, 'done');
  } finally {
    srv.close();
  }
});

test('completeDetailed captures the PROVIDER-REPORTED model + finishReason', async () => {
  const { srv, baseUrl } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'llama3-3-70b-actual', choices: [{ finish_reason: 'stop', message: { content: 'hi' } }] }));
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'llama3-3-70b', apiKey: 'x' });
    const d = await ai.completeDetailed({ system: 's', prompt: 'p' });
    assert.strictEqual(d.text, 'hi');
    assert.strictEqual(d.model, 'llama3-3-70b-actual');
    assert.strictEqual(d.finishReason, 'stop');
  } finally {
    srv.close();
  }
});

test('completeDetailed reports model:null when upstream omits it (never invented)', async () => {
  const { srv, baseUrl } = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'hi' } }] }));
  });
  try {
    const ai = createMapleAI({ baseUrl, model: 'llama3-3-70b', apiKey: 'x' });
    const d = await ai.completeDetailed({ system: 's', prompt: 'p' });
    assert.strictEqual(d.model, null);
  } finally {
    srv.close();
  }
});
