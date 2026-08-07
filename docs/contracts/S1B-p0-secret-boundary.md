# Contract S1B-P0-SECRET-BOUNDARY

**Node:** `S1B-P0-SECRET-BOUNDARY`
**Sprint:** Beta V1 Hardening
**Closes:** P0-03 (RELEASE-LEDGER.md §P0 — GLOBAL SECRET-SHAPED BODY GUARD ABSENT)
**Authorities:** CONTEXT.md rule 5; IBC §9; G0-governance.md §6.3
**Status:** READY FOR CODEX RE-REVIEW — implementation requires explicit `PROCEED S1B`

---

## 1. Base Branch / Commit / Clean-Worktree Precondition

The implementer MUST verify ALL of the following before touching any source file.
If any value differs, Git status cannot be obtained, or the environment reports
file-descriptor exhaustion, STOP WITHOUT WRITING.

```bash
git branch --show-current
# → agent/abacus-beta-v1-hardening

git rev-parse HEAD
# → 41b0cf363a6b43bbb16667b9c4339f322ecca356

git cat-file -p HEAD | grep tree
# → tree 91b68f5ee036489827f8fdea74db0fe69dafdedd

git status --porcelain=v1 --untracked-files=all
# → ?? docs/contracts/S1B-p0-secret-boundary.md    (contract only — no other changes)

git diff --check HEAD
# → (no output)
```

Remote branch pre-conditions (both must resolve to `41b0cf36...`):

```bash
git ls-remote origin refs/heads/agent/abacus-sovereign-sprint-v4
git ls-remote origin refs/heads/agent/abacus-beta-v1-hardening
# both: 41b0cf363a6b43bbb16667b9c4339f322ecca356
```

Do not carry either stale SHA from any prior document:
- `7b8843a9367cebb5ebb0a64c74f597a6c4ac2879` — rejected earlier node
- `7b8843a9367cebb5ebb0a64c74f597a6c4ac2789` — typo variant

---

## 2. Authoritative Basis

This contract is derived from a fresh clean checkout at commit `41b0cf36…` plus
the following governance documents read in order:

1. `AGENTS.md`
2. `.abacusai/skills/solaris-sovereign-sprint/SKILL.md`
3. `docs/beta-v1/README.md`
4. `docs/beta-v1/CONTEXT.md`
5. `docs/beta-v1/WORKFLOW.md`
6. `docs/beta-v1/RELEASE-LEDGER.md`
7. `docs/beta-v1/IDENTITY-BINDING-CONTRACT.md` §§8–9 and acceptance scenario D
8. `docs/contracts/G0-governance.md` §§6.3 and 7.1
9. `docs/contracts/S1A-p0-fail-closed.md`

Normative rules binding this node (quoted verbatim):

- CONTEXT.md rule 4: *"The server never generates, receives, stores, or logs an nsec, raw 64-hex private key, mnemonic, seed phrase, or Spark wallet secret."*
- CONTEXT.md rule 5: *"Every body-bearing endpoint rejects secret-shaped material before business handlers with typed 400 SECRET_MATERIAL_REJECTED, without echoing, hashing, or logging the submitted value."*
- IBC §9: *"Reject with 400 SECRET_MATERIAL_REJECTED if any recursively inspected key or string value is: a case-insensitive forbidden key name such as nsec, mnemonic, seedPhrase, privateKey, or secretKey; an nsec1... value; exactly 64 hex characters; a 12/15/18/21/24-word sequence whose normalized words all belong to the configured mnemonic wordlist."*
- G0 §6.3: *"On detection: return 400 SECRET_MATERIAL_REJECTED; call no business handler; log nothing about the submitted value, field name, word count, or hash; audit only: actor/subject if known, endpoint, request ID, time, result, coarse detectedShape."*

---

## 3. Current Behavior — Evidence at Commit `41b0cf36`

### 3A. Guard absent (P0-03)

Middleware stack at `backend/src/server.js` (VERIFIED):

| Line | Middleware | Body access |
|------|-----------|-------------|
| 107 | `makeGlobalLimiter()` | None |
| 109 | `express.json({ limit: '2mb' })` | **Sole body parser — parses `application/json` only** |
| 113 | `makeLoginLimiter()` at `/api/auth/login` | Runs after parse |
| 114 | `makeRegisterLimiter()` at `/api/auth/register` | Runs after parse |
| 123–131 | `READ_ONLY_MODE` check | Runs after parse |
| 251–299 | All 48 route modules mounted | First consumers of `req.body` |
| 304 | Global error handler | Logs `req.path`, `req.method`, `req.user.userId` — NOT `req.body` |

No middleware exists between lines 109 and 251 that inspects `req.body` for
secret-shaped material. A client may POST a JSON body containing an nsec, raw private
key, mnemonic-shaped string, or forbidden field name; it will reach business handlers
unimpeded.

### 3B. Route inventory (VERIFIED at `41b0cf36`)

- 48 route JavaScript files (41 top-level in `routes/`, 3 in `routes/admin/`, 4 in `routes/provider/`)
- 48 route `require()` statements in `server.js`
- 107 `router.post | router.put | router.patch | router.delete` declarations across those 48 files
- Which of the 107 declarations actually read `req.body` is UNVERIFIED at this contract stage; "107 body-bearing" is not proven individually. The global guard covers all 107 regardless.

### 3C. Only body parser

`express.json({ limit: '2mb' })` at line 109 is the only body parser. No `express.urlencoded`, no `multer`, no `raw`/`text` body parser, no route-local parser was found. The guard need only handle `typeof req.body === 'object' && req.body !== null` (the only shape `express.json` produces for valid JSON).

### 3D. Audit helper (VERIFIED)

`backend/src/lib/helpers.js:43` exports `audit({ actorId, action, resourceType, resourceId, newValues, oldValues, result, reason, ip, purpose, consentScope })`.

- `module.exports = { award, shapeUser, audit }` — `clientIp` is **NOT** exported.
- The helper is best-effort: its `catch` swallows errors and logs `console.error('audit log failed:', ...)`. It never throws. A failed write does not propagate.
- `resourceId` column in `audit_logs` is `UUID`. `crypto.randomUUID()` (Node.js built-in, no import) produces a compliant value.

### 3E. Dependency verification (VERIFIED)

- Root `package.json`: `"@scure/bip39": "^1.6.0"`
- Root lockfile pins `1.6.0`; integrity: `sha512-+lF0BbL...`
- `src/lib/identity-key.js` (frontend ESM): imports `{ wordlist } from '@scure/bip39/wordlists/english'`
- `backend/package.json`: `@scure/bip39` is **absent** from dependencies
- `@scure/bip39 1.6.0` npm exports map (VERIFIED from registry):
  - `require('@scure/bip39/wordlists/english')` → `./wordlists/english.js` (CommonJS)
  - CJS compatibility confirmed; backend runtime is CommonJS

The rejected contract's claim that no `bip39` package exists in the repository is
**false**. The package is declared at the root; the backend isolate does not declare it.
The corrected implementation adds it as an explicit backend production dependency.

---

## 4. Outcome and Non-Goals

### 4.1 Outcome

Implement one new global pre-business-handler middleware that rejects any `application/json`
request body containing secret-shaped material before any route handler executes.
No route, migration, frontend, CI, or environment file changes.

The closed finding is **P0-03**: *GLOBAL SECRET-SHAPED BODY GUARD ABSENT*.

### 4.2 Explicit Non-Goals

| What | Why |
|------|-----|
| Scanning response bodies or outbound AI prompts | PHI egress for AI-bound text is handled by `lib/phi-boundary.js` |
| Sanitising or stripping secret material from the body | Guard must REJECT, not silently fix a client error |
| Adding a word-count-only heuristic for mnemonic detection | Disqualified: would fire on every 12-word sentence in journal/LUCA entries |
| Using root-package hoisting for the wordlist | Must never depend on hoisted modules; backend installs its own |
| Embedding a hand-written 2,048-word list | Prohibited; only `@scure/bip39` wordlist is authorised |
| Scanning `multipart/form-data` or `urlencoded` bodies | No such parser is mounted; no such body shape reaches the guard |
| Blocking `Content-Type` other than `application/json` | Express.json leaves `req.body` undefined for non-JSON; guard no-ops on non-object body |
| New environment variables or feature flags | Guard is always active; no flag |
| JWT lifetime, PHI-egress, or identity-binding changes | Separate contracts: P0-01, P0-02, P1-02 |
| Commits, pushes, PRs, merges, migrations, deploys | Contract-only until `PROCEED S1B` is received |
| Logging or auditing IP addresses, user-agents, or field names | Explicitly prohibited by IBC §9 and G0 §6.3 |

---

## 5. Collision Audit — All Detection Shapes

Every body field across `backend/src/routes/**/*.js` at commit `41b0cf36` was
checked. The audit was conducted by grep of `req.body` destructuring and field references.

### 5A. nsec bech32 value detection — CLEAR

Pattern: case-insensitive prefix `nsec1`.

No route body field carries a value starting with `nsec1`. The `npub` field
(`routes/auth.js:174,191`, `routes/identity.js:26`) carries a `npub1…` bech32 public key —
the `nsec` shape is its complement, which the server explicitly never receives (CONTEXT.md rule 4).

**Verdict: CLEAR — no collision.**

### 5B. Raw 64-hex value detection — CLEAR

Pattern: exactly 64 case-insensitive hexadecimal characters.

The only candidate was `sig` in `POST /api/auth/nostr/login` (`routes/auth.js:193`).
Inspection of `lib/nostr.js:61` confirms the server validates `sigHex` against
`/^[0-9a-f]{128}$/i` — a BIP-340 Schnorr signature is **64 bytes = 128 hex characters**,
not 64. EVM `signature` in `routes/wallet.js:188` is a 65-byte ECDSA signature
(`ethers.verifyMessage`) — 130+ hex characters with `0x` prefix. No body field carries
exactly 64 hex characters.

**Verdict: CLEAR — no collision. The guard may safely reject any standalone 64-hex string value.**

### 5C. Forbidden key name detection — CLEAR

Canonical forbidden names (after normalization — see §6B):
`nsec`, `mnemonic`, `seedphrase`, `privatekey`, `secretkey`

After case-folding and stripping ASCII whitespace, `_`, and `-`, none of the key names
used in any route body destructuring normalizes to any of these five strings. The
`password` key name (`routes/auth.js:57,131`) does not normalize to any of the five.

**Verdict: CLEAR — no collision for any of the five normalized keys.**

### 5D. Mnemonic word-list value detection — NEW SHAPE (no prior baseline)

A BIP39 mnemonic is 12/15/18/21/24 whitespace-separated words, all from the 2,048-word
English BIP39 wordlist. No existing route field is expected to carry such a value by design.
The detection does not require valid BIP39 checksum — it uses wordlist membership only.

**Verdict: CLEAR — no legitimate route body field carries a BIP39-shaped value.**

### 5E. Collision Summary Table

| Detection shape | Pattern | Collision found | Verdict |
|----------------|---------|-----------------|---------|
| nsec bech32 value | `value.toLowerCase().startsWith('nsec1')` | None | **CLEAR** |
| Raw 64-hex private key | `/^[0-9a-f]{64}$/i` (exact) | None (Nostr sig=128 hex, EVM sig=130+ hex) | **CLEAR** |
| Forbidden key: `nsec` | normalise → `nsec` | None | **CLEAR** |
| Forbidden key: `mnemonic` | normalise → `mnemonic` | None | **CLEAR** |
| Forbidden key: `seedphrase` | normalise → `seedphrase` | None | **CLEAR** |
| Forbidden key: `privatekey` | normalise → `privatekey` | None | **CLEAR** |
| Forbidden key: `secretkey` | normalise → `secretkey` | None | **CLEAR** |
| Mnemonic word-list value | 12/15/18/21/24 words, all in BIP39 EN wordlist | None | **CLEAR** |

---

## 6. New File: `backend/src/middleware/secret-boundary.js`

### 6A. Traversal Algorithm — Iterative with Cycle Protection

The guard performs a **fully recursive inspection** of every own enumerable key and
string value in the parsed JSON tree, including nested objects and arrays at any depth.

To prevent call-stack exhaustion on deeply nested JSON bodies within the existing 2 MB
parser limit, traversal is **iterative** (explicit stack, not recursive function calls).

To prevent cycles (possible in hand-crafted unit-test objects, not from `express.json`
parsing), a `Set` of visited object/array references is maintained per traversal call.

Traversal algorithm (pseudocode):

```
function scanBody(root):
  visited = new Set()
  stack = [root]
  while stack is not empty:
    node = stack.pop()
    if node is object or array:
      if visited.has(node): continue   // cycle protection
      visited.add(node)
      for each own enumerable entry (key, value) of node:
        // Pass 1: key normalization and match
        if node is object:
          normalizedKey = normalize(key)
          if FORBIDDEN_NORMALIZED_KEYS.has(normalizedKey):
            return { detectedShape: 'forbidden_key_name' }
        // Pass 2: string value tests
        if typeof value === 'string':
          trimmed = value.trim()
          if trimmed.toLowerCase().startsWith('nsec1'):
            return { detectedShape: 'nsec' }
          if HEX64_RE.test(trimmed):
            return { detectedShape: 'raw_hex' }
          if isMnemonicShaped(trimmed):
            return { detectedShape: 'mnemonic' }
        // Descend into nested objects and arrays
        if value is object or array (non-null):
          stack.push(value)
  return null  // no detection
```

The traversal returns **only** a `{ detectedShape }` object or `null`. It never
returns the matched key, the matched value, the word count, or any derivative.

### 6B. Key Normalization

For every key string in a traversed object:

1. Convert to lowercase.
2. Remove all ASCII whitespace characters (`\s`), underscores (`_`), and hyphens (`-`).
3. Compare only against the following five canonical strings:

| Canonical | Example raw forms that normalize to it |
|-----------|----------------------------------------|
| `nsec` | `nsec`, `NSEC`, `n_sec`, `n-sec` |
| `mnemonic` | `mnemonic`, `MNEMONIC`, `Mnemonic` |
| `seedphrase` | `seedPhrase`, `seed_phrase`, `SEED_PHRASE`, `seed-phrase`, `SeedPhrase` |
| `privatekey` | `privateKey`, `private_key`, `PRIVATE_KEY`, `private-key`, `PrivateKey` |
| `secretkey` | `secretKey`, `secret_key`, `SECRET_KEY`, `secret-key`, `SecretKey` |

**Do not add:** `seed`, `privkey`, `priv_key`, `key`, `secret`, `phrase`, or any alias
not in this table. These were explicitly excluded by the node authorization.

Implementation:

```js
function normalizeKey(k) {
  return String(k).toLowerCase().replace(/[\s_-]/g, '');
}
const FORBIDDEN_NORMALIZED_KEYS = new Set([
  'nsec', 'mnemonic', 'seedphrase', 'privatekey', 'secretkey',
]);
```

### 6C. String Value Detection

Applied to every string value at any nesting depth after trimming surrounding whitespace.
Applied to all string fields including `password` — the key name may be legitimate, but
a `password` value containing raw 64-hex, nsec1-prefixed, or mnemonic-shaped material
is still rejected.

#### nsec bech32

```js
const trimmed = value.trim();
if (trimmed.toLowerCase().startsWith('nsec1')) → detectedShape: 'nsec'
```

- Does not validate the bech32 alphabet or checksum before rejecting.
- A malformed `NSEC1xyz` value is still rejected (shape detection, not validity check).
- Case-insensitive (`NSEC1…`, `Nsec1…`).

#### Raw 64-hex private key

```js
const HEX64_RE = /^[0-9a-fA-F]{64}$/;
if (HEX64_RE.test(trimmed)) → detectedShape: 'raw_hex'
```

- Exactly 64 hexadecimal characters, case-insensitive (A–F or a–f).
- 63-character and 65-character hex strings are NOT matched.
- No current legitimate endpoint sends exactly 64 hex characters (see §5B).

#### Mnemonic word-list

```js
function isMnemonicShaped(s) {
  const words = s.trim().toLowerCase().replace(/\s+/g, ' ').split(' ');
  if (![12, 15, 18, 21, 24].includes(words.length)) return false;
  return words.every(w => WORDLIST_SET.has(w));
}
```

Where `WORDLIST_SET` is a `Set` built once at module load time from the 2,048-word
array exported by `require('@scure/bip39/wordlists/english').wordlist`.

- Does not require a valid BIP39 checksum.
- Does not use word count alone — every word must be in the wordlist.
- Mnemonic whitespace is normalized: leading/trailing whitespace trimmed; internal
  runs of whitespace collapsed to a single space before splitting.

### 6D. No-Op Conditions

The guard calls `next()` immediately without any scan if ANY of the following hold:

- `req.body` is `undefined`
- `req.body` is `null`
- `typeof req.body !== 'object'`
- `Array.isArray(req.body) && req.body.length === 0`
- `!Array.isArray(req.body) && Object.keys(req.body).length === 0`

### 6E. Logging and Audit Rules (normative — no deviation permitted)

On detection, the following apply in order:

**What must NEVER be logged or audited:**
- Request body (any field, any value)
- Submitted string value
- Value hash
- Matched field name
- Word count
- IP address
- User-agent
- Any detection rule detail beyond the coarse shape

**Coarse `detectedShape` permitted values:** `'nsec'` | `'raw_hex'` | `'mnemonic'` | `'forbidden_key_name'`

**`console.warn` is prohibited.** Do not emit any `console.warn` or `console.log` on detection.

**Audit call:**

```js
const crypto = require('crypto');
const { audit } = require('../lib/helpers');

// On detection:
const requestId = crypto.randomUUID();
await audit({
  actorId:      req.user?.userId ?? null,
  action:       'identity.secret_material.rejected',
  resourceType: 'request',
  resourceId:   requestId,
  result:       'blocked',
  reason:       detectedShape,   // one of the four coarse values only
  purpose:      'operations',
  consentScope: 'private',
  // newValues: omitted
  // oldValues: omitted
  // ip: omitted — IP storage is outside the accepted event contract
});
```

**Await semantics:** The `audit()` call is awaited with a `.catch` guard. If the audit
write fails, the middleware still returns the 400 response and does NOT call `next()`.
`setImmediate` fire-and-forget is NOT used — the audit attempt must be invoked before
the response is returned.

```js
await audit({ … }).catch(err =>
  console.error('[secret-boundary] audit write failed:', err.message)
);
return res.status(400).json({
  error:   'SECRET_MATERIAL_REJECTED',
  message: 'Secret key or recovery phrase material is not accepted.',
});
```

**Audit COLLIDES check:** The existing `audit()` interface (action, resourceType, resourceId,
result, reason) can represent the safe event described above without storing any prohibited
field. No modification to `lib/helpers.js` is needed or permitted. If the schema were to
reject the action string or the UUID resourceId, that constitutes a stop condition — do not
silently add `helpers.js` to the allowlist; report to Majd.

### 6F. Full Module Structure (normative pseudocode — implementer writes production code)

```
'use strict';
/**
 * secret-boundary.js
 * Global pre-business-handler guard. Rejects any request body containing
 * secret-shaped material before any route handler executes.
 *
 * Contract: docs/contracts/S1B-p0-secret-boundary.md
 * Closes:   P0-03 — GLOBAL SECRET-SHAPED BODY GUARD ABSENT
 *
 * Detection:
 *   1. Forbidden key name (normalised: nsec, mnemonic, seedphrase, privatekey, secretkey)
 *   2. nsec1-prefixed string value (case-insensitive, no bech32 validation)
 *   3. Exactly 64 hex-character string value
 *   4. BIP39-shaped string value (12/15/18/21/24 words, all in EN wordlist)
 *
 * Traversal: iterative (explicit stack), cycle-protected, full depth.
 *
 * Failure modes:
 *   - Audit write fails: middleware still rejects; next() never called.
 *   - req.body is not a plain object or array: guard is a no-op (next()).
 *   - Cycle in traversal input: cycle-protection Set prevents infinite loop.
 */

const crypto = require('crypto');
const { audit } = require('../lib/helpers');
const { wordlist } = require('@scure/bip39/wordlists/english');

// Built once at module load — O(1) membership lookup
const WORDLIST_SET = new Set(wordlist);

const FORBIDDEN_NORMALIZED_KEYS = new Set([
  'nsec', 'mnemonic', 'seedphrase', 'privatekey', 'secretkey',
]);
const HEX64_RE = /^[0-9a-fA-F]{64}$/;
const VALID_MNEMONIC_LENGTHS = new Set([12, 15, 18, 21, 24]);

function normalizeKey(k) {
  return String(k).toLowerCase().replace(/[\s_-]/g, '');
}

function isMnemonicShaped(s) {
  const words = s.trim().toLowerCase().replace(/\s+/g, ' ').split(' ');
  if (!VALID_MNEMONIC_LENGTHS.has(words.length)) return false;
  return words.every(w => WORDLIST_SET.has(w));
}

function detectSecretMaterial(root) {
  if (root === null || typeof root !== 'object') return null;
  const visited = new Set();
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    const isArr = Array.isArray(node);
    const entries = isArr ? node.entries() : Object.entries(node);
    for (const [key, value] of entries) {
      // Key check (objects only, not array indices)
      if (!isArr && typeof key === 'string') {
        if (FORBIDDEN_NORMALIZED_KEYS.has(normalizeKey(key)))
          return { detectedShape: 'forbidden_key_name' };
      }
      // String value checks
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.toLowerCase().startsWith('nsec1'))
          return { detectedShape: 'nsec' };
        if (HEX64_RE.test(trimmed))
          return { detectedShape: 'raw_hex' };
        if (isMnemonicShaped(trimmed))
          return { detectedShape: 'mnemonic' };
      }
      // Recurse into nested objects and arrays
      if (value !== null && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return null;
}

module.exports = async function secretBoundary(req, res, next) {
  const body = req.body;
  if (body === null || body === undefined || typeof body !== 'object') return next();
  if (Array.isArray(body) && body.length === 0) return next();
  if (!Array.isArray(body) && Object.keys(body).length === 0) return next();

  const hit = detectSecretMaterial(body);
  if (!hit) return next();

  const requestId = crypto.randomUUID();
  await audit({
    actorId:      req.user?.userId ?? null,
    action:       'identity.secret_material.rejected',
    resourceType: 'request',
    resourceId:   requestId,
    result:       'blocked',
    reason:       hit.detectedShape,
    purpose:      'operations',
    consentScope: 'private',
  }).catch(err =>
    console.error('[secret-boundary] audit write failed:', err.message)
  );
  return res.status(400).json({
    error:   'SECRET_MATERIAL_REJECTED',
    message: 'Secret key or recovery phrase material is not accepted.',
  });
};
```

---

## 7. Dependency: `@scure/bip39` in Backend

### 7.1 Current state (VERIFIED)

- Root `package.json` declares `"@scure/bip39": "^1.6.0"` (production dependency).
- Root lockfile pins `1.6.0`.
- `backend/package.json` does **not** declare `@scure/bip39`.
- The backend is a standalone isolated CommonJS package.

### 7.2 Required action

Add `@scure/bip39` as an **exact** production dependency to `backend/package.json`:

```json
"@scure/bip39": "1.6.0"
```

And update `backend/package-lock.json` via the backend package manager only:

```bash
cd backend
npm install @scure/bip39@1.6.0 --save-exact --omit=dev
```

### 7.3 CJS import (VERIFIED from npm registry)

```js
// CommonJS — works from backend runtime
const { wordlist } = require('@scure/bip39/wordlists/english');
```

The `@scure/bip39 1.6.0` exports map confirms:
- `require('@scure/bip39/wordlists/english')` → `./wordlists/english.js` (CJS)
- `import` path → `./esm/wordlists/english.js` (ESM)

Backend is CommonJS. The CJS path is valid. This must be confirmed with a Node.js
require probe in the implementation step before the guard is committed:

```bash
cd backend
node -e "const {wordlist} = require('@scure/bip39/wordlists/english'); \
  console.log('wordlist length:', wordlist.length, 'first:', wordlist[0], 'last:', wordlist[wordlist.length-1])"
# expected: wordlist length: 2048   first: abandon   last: zoo
```

### 7.4 Wordlist membership — not `validateMnemonic`

Use `WORDLIST_SET.has(word)` — not `validateMnemonic` (which also checks BIP39 checksum).
The guard rejects any 12/15/18/21/24-word string whose words are ALL in the wordlist,
regardless of whether the checksum byte is valid. The purpose is shape detection, not
cryptographic validation.

### 7.5 Backend production dependency audit

After `npm install`, run:

```bash
cd backend
npm audit --omit=dev > /tmp/s1b-audit.log 2>&1
audit_rc=$?
cat /tmp/s1b-audit.log | tail -10
echo "AUDIT_EXIT=$audit_rc"
```

Baseline at `41b0cf36` (VERIFIED): `3 vulnerabilities (1 low, 2 high)` — `brace-expansion` (low + high) and `ip-address` (high).

The addition of `@scure/bip39 1.6.0` must introduce zero new vulnerabilities. If the
audit count increases, STOP and report the delta before committing.

---

## 8. Middleware Position in `backend/src/server.js`

Current line 109 (VERIFIED):

```js
app.use(express.json({ limit: '2mb' })); // base64 doc uploads (reduced from 15mb)
```

After `PROCEED S1B`, insert immediately after line 109:

```js
const secretBoundary = require('./middleware/secret-boundary');
app.use(secretBoundary);
```

This produces the following middleware order (relevant excerpt):

```
makeGlobalLimiter()                         ← line 107 (unchanged)
express.json({ limit: '2mb' })              ← line 109 (unchanged)
secretBoundary                              ← NEW — before login/register limiters
makeLoginLimiter() at /api/auth/login       ← line 113 (unchanged)
makeRegisterLimiter() at /api/auth/register ← line 114 (unchanged)
READ_ONLY_MODE check                        ← line 123 (unchanged)
... 48 route modules ...                    ← lines 251–299 (unchanged)
global error handler                        ← line 304 (unchanged)
```

The guard must run before `makeLoginLimiter` so that a secret-shaped body cannot be
used to derive a limiter key from body field values. It must run after `express.json`
because `req.body` is only populated after the parser runs.

---

## 9. Exact Response Specification

```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error":   "SECRET_MATERIAL_REJECTED",
  "message": "Secret key or recovery phrase material is not accepted."
}
```

Rules:
- Status: always `400`.
- `error`: exactly `"SECRET_MATERIAL_REJECTED"` — machine-readable typed code.
- `message`: exactly `"Secret key or recovery phrase material is not accepted."` — no trailing "by this endpoint".
- No `detectedShape`, `rule`, `field`, `key`, `value`, `word_count`, `requestId`, or any other field.
- No `requestId` is returned to the client — the server-generated UUID exists only in the audit record.
- No `console.warn` or `console.log` is emitted on detection.

---

## 10. Exact Implementation Allowlist

Only these six files may differ from commit `41b0cf36` after implementation:

| # | Path | Change |
|---|------|--------|
| 1 | `backend/package.json` | Add `"@scure/bip39": "1.6.0"` to `dependencies` |
| 2 | `backend/package-lock.json` | Updated by `npm install` in the backend directory |
| 3 | `backend/src/middleware/secret-boundary.js` | **CREATE** — the guard |
| 4 | `backend/src/server.js` | **PATCH** — 2 lines added after line 109 |
| 5 | `backend/tests/secret-boundary.test.js` | **CREATE** — all acceptance tests |
| 6 | `docs/contracts/S1B-p0-secret-boundary.md` | This file (already written) |

No route file, migration, frontend file, `.env`, CI, deployment, or other test file
may be touched. Any path outside these six is a stop condition.

---

## 11. Acceptance Tests

All middleware unit tests run offline with `NODE_ENV=test`. The `audit()` function is
mocked. The mock Express app mounts `secretBoundary` directly — `server.js` is not
required by the unit-test file.

Mnemonic sequences in tests must be constructed from real BIP39 English wordlist words
(all from `@scure/bip39/wordlists/english`) and need not have valid BIP39 checksum.

### 11A. Pass Cases — guard must call `next()`, return no 400

**GIVEN** any of the following request bodies  
**WHEN** the middleware processes the request  
**THEN** `next()` is called exactly once, no 400 is returned, `audit()` is not called

| Label | Body |
|-------|------|
| Empty object | `{}` |
| Null body (non-JSON request) | `body = undefined` |
| Normal login | `{ email: 'a@b.com', password: 'hunter2' }` |
| Nostr login — npub + nonce + sig (128 hex) | `{ npub: 'npub1qqqsyqcyq5rq...', nonce: 'abc', sig: 'a'.repeat(128) }` |
| Nostr challenge — npub only | `{ npub: 'npub1zutz...' }` |
| LUCA chat message | `{ content: 'How is my sleep this week?' }` |
| Journal entry — prose | `{ content: 'Long productive day. Feeling rested.' }` |
| Wallet EVM signature | `{ chain: 'ethereum', address: '0xABC', message: 'Login...', signature: '0x' + 'a'.repeat(130) }` |
| Health document description | `{ description: 'Blood test from Dr. Smith', filename: 'labs.pdf' }` |
| 63-character hex string | `{ k: 'a'.repeat(63) }` |
| 65-character hex string | `{ k: 'a'.repeat(65) }` |
| Non-wordlist word in 12-word string | `{ content: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon notaword' }` |
| 11-word all-wordlist string | `{ content: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon' }` |
| 13-word all-wordlist string | `{ content: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about about' }` |

### 11B. Fail Cases — guard must return 400, never call `next()`

**GIVEN** any of the following request bodies  
**WHEN** the middleware processes the request  
**THEN** `res.status(400).json({ error: 'SECRET_MATERIAL_REJECTED', message: '...' })` is called, `next()` is never called, `audit()` is called with `action: 'identity.secret_material.rejected'` and `reason` equal to the indicated `detectedShape`

#### Forbidden key name — Pass 1

| Label | Body | `detectedShape` |
|-------|------|-----------------|
| `nsec` lowercase | `{ nsec: 'anything' }` | `forbidden_key_name` |
| `NSEC` uppercase | `{ NSEC: 'anything' }` | `forbidden_key_name` |
| `n_sec` snake | `{ n_sec: 'anything' }` | `forbidden_key_name` |
| `n-sec` kebab | `{ n-sec: 'anything' }` | `forbidden_key_name` |
| `mnemonic` | `{ mnemonic: 'anything' }` | `forbidden_key_name` |
| `MNEMONIC` | `{ MNEMONIC: 'x' }` | `forbidden_key_name` |
| `seedPhrase` camelCase | `{ seedPhrase: 'anything' }` | `forbidden_key_name` |
| `seed_phrase` snake | `{ seed_phrase: 'anything' }` | `forbidden_key_name` |
| `SEED_PHRASE` caps | `{ SEED_PHRASE: 'anything' }` | `forbidden_key_name` |
| `seed-phrase` kebab | `{ 'seed-phrase': 'anything' }` | `forbidden_key_name` |
| `SeedPhrase` PascalCase | `{ SeedPhrase: 'anything' }` | `forbidden_key_name` |
| `privateKey` camelCase | `{ privateKey: 'anything' }` | `forbidden_key_name` |
| `private_key` snake | `{ private_key: 'anything' }` | `forbidden_key_name` |
| `PRIVATE_KEY` caps | `{ PRIVATE_KEY: 'x' }` | `forbidden_key_name` |
| `private-key` kebab | `{ 'private-key': 'x' }` | `forbidden_key_name` |
| `PrivateKey` Pascal | `{ PrivateKey: 'x' }` | `forbidden_key_name` |
| `secretKey` camelCase | `{ secretKey: 'anything' }` | `forbidden_key_name` |
| `secret_key` snake | `{ secret_key: 'anything' }` | `forbidden_key_name` |
| `SECRET_KEY` caps | `{ SECRET_KEY: 'x' }` | `forbidden_key_name` |
| `secret-key` kebab | `{ 'secret-key': 'x' }` | `forbidden_key_name` |
| `SecretKey` Pascal | `{ SecretKey: 'x' }` | `forbidden_key_name` |
| Nested `nsec` one level | `{ data: { nsec: 'value' } }` | `forbidden_key_name` |
| Nested `privateKey` two levels | `{ a: { b: { privateKey: 'x' } } }` | `forbidden_key_name` |
| Forbidden key in array element | `{ items: [{ nsec: 'x' }] }` | `forbidden_key_name` |
| Top-level array with forbidden key | `[{ nsec: 'x' }]` (body is array) | `forbidden_key_name` |

#### nsec bech32 value — Pass 2

| Label | Body | `detectedShape` |
|-------|------|-----------------|
| nsec in arbitrary field | `{ identity: 'nsec1qqqsyqcyq5rq...' }` | `nsec` |
| nsec uppercase bypass | `{ identity: 'NSEC1QQQSYQCYQ5RQ...' }` | `nsec` |
| nsec mixed case | `{ identity: 'Nsec1qqqsyqcyq5rq...' }` | `nsec` |
| nsec trimmed with leading space | `{ content: ' nsec1abc...' }` | `nsec` |
| nsec in `content` free-text field | `{ content: 'nsec1abcdefghijk...' }` | `nsec` |
| nsec in `password` value | `{ password: 'nsec1abcdef...' }` | `nsec` |
| Malformed nsec1 (invalid bech32 chars) | `{ k: 'nsec1INVALID!@@#$' }` | `nsec` |
| nsec in nested value | `{ payload: { key: 'nsec1zzz...' } }` | `nsec` |
| nsec in nested array element | `{ data: ['nsec1zzz...'] }` | `nsec` |

#### Raw 64-hex value — Pass 3

| Label | Body | `detectedShape` |
|-------|------|-----------------|
| 64 lowercase hex in arbitrary field | `{ k: 'a'.repeat(64) }` | `raw_hex` |
| 64 uppercase hex | `{ k: 'A'.repeat(64) }` | `raw_hex` |
| 64 mixed-case hex | `{ k: 'aAbBcCdD'.repeat(8) }` | `raw_hex` |
| 64 hex in `data` field | `{ data: '0f1e2d3c4b5a6978' + '8796a5b4c3d2e1f0' + 'deadbeef12345678' + 'abcdef0123456789' }` | `raw_hex` |
| 64 hex in `password` value | `{ password: 'a'.repeat(64) }` | `raw_hex` |
| 64 hex trimmed with surrounding whitespace | `{ k: '  ' + 'a'.repeat(64) + '  ' }` | `raw_hex` |
| 64 hex nested | `{ meta: { key: 'f'.repeat(64) } }` | `raw_hex` |
| 64 hex in array | `{ keys: ['a'.repeat(64)] }` | `raw_hex` |

#### Mnemonic word-list value — Pass 4

BIP39 test mnemonics (all words from `@scure/bip39/wordlists/english`; checksum may be invalid):

| Label | Body | `detectedShape` |
|-------|------|-----------------|
| 12 valid-wordlist words | `{ recovery: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' }` | `mnemonic` |
| 15 valid-wordlist words | 15 words all in BIP39 EN wordlist | `mnemonic` |
| 18 valid-wordlist words | 18 words all in BIP39 EN wordlist | `mnemonic` |
| 21 valid-wordlist words | 21 words all in BIP39 EN wordlist | `mnemonic` |
| 24 valid-wordlist words | 24 words all in BIP39 EN wordlist | `mnemonic` |
| 12-word checksum-invalid (all wordlist) | 12 wordlist words with invalid BIP39 checksum | `mnemonic` |
| Mnemonic in `content` free-text | `{ content: '<12 wordlist words>' }` | `mnemonic` |
| Mnemonic in `password` value | `{ password: '<12 wordlist words>' }` | `mnemonic` |
| Mnemonic nested in object | `{ a: { phrase: '<12 wordlist words>' } }` | `mnemonic` |
| Mnemonic in array element | `{ items: ['<12 wordlist words>'] }` | `mnemonic` |

### 11C. Anti-Falsifiers (guard must NOT do these in any case)

| Requirement | How to verify |
|-------------|---------------|
| Must not log any body value | Assert no body value appears in captured `console` output |
| Must not log any field name on detection | Assert mocked `console` calls contain no key names from the body |
| Must not echo body value in 400 response | Assert 400 response body does not contain the submitted value |
| Must not store body value or field name in `audit()` call | Assert mocked `audit()` is called with no `newValues`, no `oldValues`, no field from the body |
| Must not call `next()` after rejecting | Assert `next` spy is never called when a fail case fires |
| Must not throw an unhandled exception | Assert no exception propagates from the middleware for any test input |
| Audit failure must still produce 400, never call `next()` | Mock `audit` to throw; assert 400 still returned, `next` not called |
| Legitimate npub (128 hex Nostr sig) must not be rejected | Explicitly assert the Nostr login body passes |
| EVM signature (130+ hex) must not be rejected | Explicitly assert the wallet verify body passes |
| Nested object with no forbidden key/value must pass | `{ data: { content: 'hello' } }` → `next()` called |
| `Object.create(null)` body must not throw | Cycle protection Set handles prototype-less objects |

### 11D. Spy Tests

**GIVEN** a request that triggers detection  
**WHEN** the middleware runs  
**THEN** a login-limiter spy confirms the limiter function is NOT called (guard fires before the limiter would run)

**GIVEN** a request that triggers detection  
**WHEN** the middleware runs  
**THEN** a route-handler spy confirms the handler is NOT called

### 11E. Cycle-Safety Test

**GIVEN** a body object containing a direct self-reference (e.g. `const body = {}; body.self = body`)  
**WHEN** the middleware processes the request  
**THEN** the traversal terminates without throwing a stack overflow or infinite loop

### 11F. Deep-Nesting Test

**GIVEN** a body with 500 levels of nesting containing a forbidden key at the leaf  
**WHEN** the middleware processes the request  
**THEN** the forbidden key is detected and 400 is returned without call-stack exhaustion

### 11G. Backend CJS Import Test

**GIVEN** the backend runtime environment after `npm install @scure/bip39@1.6.0`  
**WHEN** `const { wordlist } = require('@scure/bip39/wordlists/english')` is executed  
**THEN** `wordlist.length === 2048`, `wordlist[0] === 'abandon'`, `wordlist[2047] === 'zoo'`

This MUST be verified by the implementation step before the guard is committed:

```bash
cd backend
node -e "const {wordlist}=require('@scure/bip39/wordlists/english'); \
  console.log(wordlist.length, wordlist[0], wordlist[wordlist.length-1])"
# expected: 2048 abandon zoo
```

### 11H. Legitimate 64-Hex Regression Cases

These must be added and preserved as permanent regression guards. If a future commit
introduces a body field with a legitimate 64-hex value, these tests will fail, alerting
the team:

**GIVEN** `POST /api/auth/nostr/login` with body `{ npub: 'npub1...', nonce: 'xyz', sig: '<128-hex>' }`  
**THEN** guard passes (128 hex != 64 hex; no match)

**GIVEN** `POST /api/wallet/verify-signature` with body `{ chain: 'ethereum', address: '0xABC', message: 'Login...', signature: '0x' + 'a'.repeat(130) }`  
**THEN** guard passes (EVM sig is 130 hex + '0x' prefix; no match)

---

## 12. Verification Commands and Environment Class

### 12.1 Pre-implementation preconditions (contract phase — run now)

```bash
WORKSPACE=/tmp/solaris-s1b   # clean clone at 41b0cf36
cd "$WORKSPACE"

git branch --show-current
# → agent/abacus-beta-v1-hardening

git rev-parse HEAD
# → 41b0cf363a6b43bbb16667b9c4339f322ecca356

git cat-file -p HEAD | grep tree
# → tree 91b68f5ee036489827f8fdea74db0fe69dafdedd

git status --porcelain=v1 --untracked-files=all
# → ?? docs/contracts/S1B-p0-secret-boundary.md

git diff --check HEAD
# → (no output)
```

### 12.2 Implementation-phase commands (run after `PROCEED S1B`)

**Step 0 — CJS wordlist probe:**

```bash
cd "$WORKSPACE/backend"
HOME=/tmp npm install @scure/bip39@1.6.0 --save-exact --omit=dev
node -e "const {wordlist}=require('@scure/bip39/wordlists/english'); \
  console.log(wordlist.length, wordlist[0], wordlist[wordlist.length-1])"
# expected: 2048 abandon zoo
```

If this fails or the import throws, STOP. Do not commit. Report the CommonJS
incompatibility to Majd.

**Step 1 — Dependency audit delta:**

```bash
cd "$WORKSPACE/backend"
HOME=/tmp npm audit --omit=dev > /tmp/s1b-audit.log 2>&1
audit_rc=$?
cat /tmp/s1b-audit.log | tail -10
echo "AUDIT_EXIT=$audit_rc"
# baseline: 3 vulnerabilities (1 low, 2 high)
# acceptable: same count or fewer; any increase is a stop condition
```

**Step 2 — Lint:**

```bash
cd "$WORKSPACE/backend"
npx eslint src/middleware/secret-boundary.js --max-warnings 0 > /tmp/s1b-lint.log 2>&1
lint_rc=$?
cat /tmp/s1b-lint.log
echo "LINT_EXIT=$lint_rc"
# expected: LINT_EXIT=0
```

**Step 3 — S1B targeted tests (offline):**

```bash
cd "$WORKSPACE/backend"
NODE_ENV=test \
npx jest --runInBand --forceExit tests/secret-boundary.test.js \
  > /tmp/s1b-jest-targeted.log 2>&1
jest_rc=$?
tail -30 /tmp/s1b-jest-targeted.log
echo "JEST_EXIT=$jest_rc"
# expected: all pass, JEST_EXIT=0
```

**Step 4 — S1A security regression floor (43/43 required):**

```bash
cd "$WORKSPACE/backend"
NODE_ENV=test DATABASE_URL=$TEST_DATABASE_URL JWT_SECRET=test-secret-64chars-minimum \
npx jest --runInBand --forceExit \
  tests/auth.test.js tests/agent-authority.test.js tests/luca.test.js \
  > /tmp/s1b-jest-s1a.log 2>&1
jest_rc=$?
tail -20 /tmp/s1b-jest-s1a.log
echo "JEST_EXIT=$jest_rc"
# expected: 3 suites, 43 tests, 43 passed, JEST_EXIT=0
# regression below 43/43 is a stop condition
```

**Step 5 — Schema recovery (3/3 required):**

```bash
NODE_ENV=test DATABASE_URL=$TEST_DATABASE_URL JWT_SECRET=test-secret-64chars-minimum \
npx jest --runInBand --forceExit tests/schema-recovery.test.js \
  > /tmp/s1b-jest-schema.log 2>&1
jest_rc=$?
tail -10 /tmp/s1b-jest-schema.log
echo "JEST_EXIT=$jest_rc"
# expected: 1 suite, 3 tests, 3 passed, JEST_EXIT=0
```

**Step 6 — Full backend suite (196/198 floor, 2 known intake failures):**

```bash
NODE_ENV=test DATABASE_URL=$TEST_DATABASE_URL JWT_SECRET=test-secret-64chars-minimum \
npx jest --runInBand --forceExit \
  > /tmp/s1b-jest-full.log 2>&1
jest_rc=$?
tail -20 /tmp/s1b-jest-full.log
echo "JEST_EXIT=$jest_rc"
# accepted baseline: >= 26 suites, >= 196 tests passed, exactly 2 known failures
# (intake fixture-dependent tests)
# any regression below 196 passed or any new failure beyond the 2 known is a stop condition
# do not declare unit tests sufficient if isolated PostgreSQL is unavailable:
# mark "BLOCKED BY ISOLATED POSTGRES" and stop before commit authorization
```

**Step 7 — `git diff --check`:**

```bash
cd "$WORKSPACE"
git diff --check HEAD
# expected: no output (no whitespace errors in tracked changes)
```

**Step 8 — Allowlist validation (complete porcelain status):**

```bash
cd "$WORKSPACE"
git status --porcelain=v1 --untracked-files=all
```

Expected output after implementation (exact paths — any additional path is a stop condition):

```
 M backend/package.json
 M backend/package-lock.json
 M backend/src/server.js
?? backend/src/middleware/secret-boundary.js
?? backend/tests/secret-boundary.test.js
?? docs/contracts/S1B-p0-secret-boundary.md
```

A grep over `git diff --stat` is NOT sufficient allowlist validation. Only the full
porcelain output is authoritative.

**Step 9 — Verify `server.js` patch is exactly 2 lines added:**

```bash
git diff HEAD -- backend/src/server.js | grep '^+' | grep -v '^+++' | wc -l
# expected: 2
```

---

## 13. Stop Conditions

Implementation MUST stop and report to Majd if any of the following are true:

| Condition | Action |
|-----------|--------|
| `git rev-parse HEAD` ≠ `41b0cf363a6b43bbb16667b9c4339f322ecca356` | STOP — stale workspace |
| `git cat-file -p HEAD | grep tree` ≠ `tree 91b68f5ee036489827f8fdea74db0fe69dafdedd` | STOP — stale workspace |
| Starting `git status --porcelain=v1` has any entry other than the contract file | STOP — dirty worktree |
| Git status cannot be obtained (fd exhaustion or other error) | STOP — do not proceed with manual checks |
| `node -e "require('@scure/bip39/wordlists/english')"` throws after install | STOP — CJS incompatibility |
| `wordlist.length ≠ 2048` or `wordlist[0] ≠ 'abandon'` or `wordlist[2047] ≠ 'zoo'` | STOP — wrong wordlist |
| `npm audit --omit=dev` introduces new vulnerabilities vs. baseline 3 (1 low, 2 high) | STOP — dependency regression |
| A body field is found with a legitimate exactly-64-hex value (collision) | STOP — re-audit required |
| Targeted S1B tests do not all pass | STOP — no commit |
| S1A security regression: fewer than 43/43 passing | STOP — do not commit |
| Schema recovery: fewer than 3/3 passing | STOP — do not commit |
| Full suite: fewer than 196 tests passing, or new failures beyond the 2 known | STOP — do not commit |
| Isolated PostgreSQL unavailable | Mark `BLOCKED BY ISOLATED POSTGRES`; stop before commit authorization |
| `audit()` interface cannot represent the safe event without prohibited data | STOP — mark `COLLIDES`; do not add `helpers.js` to allowlist |
| Any allowlisted file was modified since this contract was written | STOP — re-verify |
| Any implementation path is outside the six-file allowlist | STOP — amend contract first |
| Lint exits non-zero | STOP |

---

## 14. Rollback

This node creates three new files and modifies three existing files. No migration is applied.
No schema changes.

Before commit, rollback is deletion of this clean clone or reversal of the six-path diff.

After an accepted commit, rollback is a normal revert of that one commit on
`agent/abacus-beta-v1-hardening`. The revert removes the middleware registration from
`server.js`, removes the dependency from `backend/package.json` and `backend/package-lock.json`,
and leaves the guard file and test file in place as tombstoned untracked files (move them to
`/tmp` quarantine if required by a subsequent node contract).

Do not force-push.

---

## 15. No-Migration / No-Deploy / No-Frontend Statement

- **Zero database migrations.** `audit_logs` already has `resourceId UUID` and `result_reason TEXT`; both columns accept the values the guard writes. No schema change.
- **Zero frontend changes.** The guard is purely server-side.
- **Zero new environment variables.** The guard is unconditionally active.
- **Zero deployment steps** beyond the normal container rebuild cycle.
- **No commit, push, PR, merge, or deploy** until `PROCEED S1B` is received and all verification commands pass.

---

## 16. Residual Risks

| Risk | Severity | Deferred to |
|------|---------|-------------|
| **PHI/health context to external AI (P0-01 open).** This node closes P0-03 only. PHI egress from LUCA routes remains blocked on a separate provenance-based classification contract. | High | P0-01 contract (D43) |
| **Practitioner consent gate (P0-02 open).** Unchanged by this node. | High | P0-02 contract |
| **Top-level array body.** If a client sends a JSON array as the root body (uncommon), `express.json` will populate `req.body` as an Array. The guard traversal handles arrays via `Array.isArray` check; key normalization is skipped for array indices. This is correct behavior and is covered by the array-body acceptance test. | Low | N/A |
| **Actor ID is null for unauthenticated requests.** The guard runs before `authMiddleware`. `actorId: req.user?.userId ?? null` is correct for unauthenticated requests; audit entry will have null actor. | None | N/A |
| **Newly introduced body fields.** A future endpoint that legitimately uses a body field whose value happens to be exactly 64 hex characters will be blocked. The 64-hex regression test set (§11H) will catch this at test time. | Low | Per-endpoint contract amendment |
| **`ip` parameter omitted.** IBC §11 explicitly excludes IP address from the audit event. The `ip_address` column in `audit_logs` will be NULL for S1B rejection events. This is intentional and accepted. | None | N/A |

---

## 17. Data Flow After Implementation

```
Client POST /api/<any>   Content-Type: application/json
  Body: { [...any JSON tree...] }
          │
          ▼
  makeGlobalLimiter()              ← no body access
          │
          ▼
  express.json({ limit: '2mb' })  ← populates req.body (or leaves undefined)
          │
          ▼
  secretBoundary (NEW)
    ├── req.body not plain object/array → next()     [no-op]
    ├── Iterative traversal with cycle protection:
    │     Pass 1 (every object key): forbidden normalized key?
    │       → await audit(…) + 400 SECRET_MATERIAL_REJECTED
    │     Pass 2 (every string value): starts with nsec1?
    │       → await audit(…) + 400 SECRET_MATERIAL_REJECTED
    │     Pass 3 (every string value): exactly 64 hex?
    │       → await audit(…) + 400 SECRET_MATERIAL_REJECTED
    │     Pass 4 (every string value): BIP39-shaped?
    │       → await audit(…) + 400 SECRET_MATERIAL_REJECTED
    └── no match → next()
          │
          ▼
  makeLoginLimiter() / makeRegisterLimiter()  ← only reached if no detection
          │
          ▼
  READ_ONLY_MODE check
          │
          ▼
  Route handler (business logic)  ← only reached if no detection
```
