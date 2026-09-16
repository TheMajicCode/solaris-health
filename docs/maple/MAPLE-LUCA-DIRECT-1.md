# MAPLE-LUCA-DIRECT-1 — owner-scoped private LUCA via Maple

Additive, reversible integration of Maple's TEE-backed inference behind the
existing LUCA member chat, gated to an explicit server-side owner allowlist.
No architecture change, no DB migration, no change to any other AI consumer.

## What changed (source)
- `backend/src/lib/ai/maple.js` (new) — Maple provider adapter.
  - Contract: `complete({system, prompt, context}) -> string`; id `maple:<model>`
    (so `phi-boundary.isExternalProvider()` treats it as remote — a loopback
    proxy is still remote inference, never labelled on-device/local).
  - Non-stream `POST {baseUrl}/chat/completions`, per-request `Authorization: Bearer`.
  - Bounds: input ≤ 16000 chars, output ≤ 256 tokens (capped), request deadline
    (`LUCA_AI_TIMEOUT_MS`, default 20000 ms), AbortController + external signal
    cancellation.
  - Errors are class-only (`maple_timeout`, `maple_proxy_status_<code>`,
    `maple_request_failed`, `maple_input_too_large`, `maple_no_api_key`); raw
    provider bodies are drained and discarded, never surfaced. NEVER falls back
    to any other provider.
- `backend/src/routes/luca.js` (edited) — owner-scoped routing on `POST /messages`:
  - `parseOwnerAllowlist(env)` / `isMapleOwner(userId, env)` read
    `LUCA_MAPLE_OWNER_USER_IDS` (comma-separated ids). Empty/unset ⇒ Maple
    disabled for everyone; every other member keeps the existing shared
    AIProvider path byte-for-byte.
  - Identity comes from the authenticated session (`req.user.userId`) only;
    body-supplied owner flags / userId are ignored.
  - On the Maple (owner) path: Passport health-context and derived triggers are
    NOT assembled (context sent to the enclave is `''`); only the member's own
    typed message is sent, identifier-redacted via `redactForExternalAI`.
  - On ANY Maple failure: a truthful degraded reply is returned and flagged
    (`degraded: maple_timeout|maple_unavailable|maple_error`); the request is
    NEVER re-sent to mock/RouteLLM/OpenAI/Anthropic or any other cloud.
  - `getAIProvider()` is not globally redirected; practitioner/recommendation
    and all non-member consumers are unchanged.
- `backend/test/maple/*` (new) — adapter unit/negative tests, owner-allowlist
  tests, and route-level integration tests (all stubbed; no DB/network).

## Runtime env (in `/etc/solaris-beta-demo/backend.env`, root 0600 — values not committed)
```
LUCA_MAPLE_API_KEY=<secret, supplied at runtime; never in source/logs/git>
LUCA_MAPLE_BASE_URL=http://127.0.0.1:8788/v1
LUCA_MAPLE_MODEL=llama3-3-70b
LUCA_MAPLE_OWNER_USER_IDS=            # EMPTY = disabled for all (owner id not yet resolved)
LUCA_MAPLE_MAX_TOKENS=256
```
To enable for the verified owner: set `LUCA_MAPLE_OWNER_USER_IDS=<owner user id>`
then `sudo systemctl restart solaris-beta-demo-backend.service`.

## Maple proxy (Stage A) — pinned, supervised, loopback-only
- Repo: https://github.com/MaplePrivacyLabs/Maple  (proxy under `/proxy`)
- Pinned release tag **v3.4.1** (release commit `0d861839ee8bc4cfbfbf5843a9f5c3379a99a705`)
- Asset `maple-proxy-linux-x86_64.tar.gz`
  SHA-256 `79684284cfb09d5b00cfd7296ba34b225b5b709c68bcb6788e6a4b4d34ad0b0a`
  (verified against release manifest `maple-proxy-release-final.sha256`).
- Binary version: `maple-proxy 0.4.0`; deps maple-sdk 4.0.0, axum 0.8.9,
  tokio 1.52.1, reqwest 0.12.28, rustls 0.23.45.
- systemd unit `solaris-maple-proxy.service` (User=ubuntu non-root; NoNewPrivileges,
  ProtectSystem=strict, RestrictAddressFamilies AF_INET/AF_INET6).
- Bind **127.0.0.1:8788** (loopback only; not published to the internet).
- `MAPLE_BACKEND_URL=https://enclave.trymaple.ai` (real HTTPS production backend),
  `MAPLE_PCR0_ENVIRONMENT=production` (production attestation; TLS/attestation
  NOT disabled), `MAPLE_ENABLE_CORS=false`, `MAPLE_DEBUG=false`,
  default `MAPLE_API_KEY` UNSET (backend supplies per-request bearer),
  `MAPLE_CACHE_NAMESPACE_ROOT` in root-owned 0600 `/etc/solaris-maple-proxy/proxy.env`,
  timeouts 300s.

## Backend deploy (Stage C/E)
- New release `/opt/solaris-beta/releases/maple-luca-direct-1/backend`, a copy of
  the running release `f7768043262c534fc974192fece56890560bc6e4` (incl node_modules)
  with only the two source files above changed. Migrations unchanged at 001..038
  (37 files); the fail-closed `npm run migrate` pre-start step is a proven no-op.
- Unit `solaris-beta-demo-backend.service` `WorkingDirectory` repointed to the new
  release absolute path (the prior unit pointed at `/opt/solaris-beta/current/backend`,
  which is a frontend-only release and would fail CHDIR on restart).
- Checkpoint + rollback: `/home/ubuntu/maple-notes/checkpoint/` (prior unit file,
  prior backend source tarball, ROLLBACK.md).

## Verification
- `node --test backend/test/maple/` → 20/20 pass.
- REAL adapter smoke against the live proxy (deployed `maple.js` + real key):
  model-list (13 models, `llama3-3-70b` present) + EN + ES inference (cap 256),
  both non-empty. Adapter id `maple:llama3-3-70b`.
- Service healthy (`/api/health` 200, database+migrations ok) across two restarts;
  live process confirmed running the new release with the Maple env loaded.

## Known boundaries (must resolve before opening to more users)
- The Solaris backend + local proxy handle readable prompts/responses
  before/after Maple's protected processing; this does not make the host unable
  to read them.
- A shared proxy/account can share Maple's KV-cache namespace across users; a
  per-user key does not by itself isolate it. Acceptable for owner-only use;
  document + resolve cache-isolation/retention before multi-user rollout.
- Automatic Passport health-context is intentionally OFF on the Maple path; only
  typed owner text is used.

## Follow-up fix — dedicated no-context system prompt (prevent fabricated metrics)
Live ES owner smoke revealed the model **fabricating** specific health numbers
(e.g. an invented "hidratación media de 6/10"). Root cause: the Maple path sends
NO Passport context (`context=''`, correct for PHI minimization) but was still
passing the shared `SYSTEM_PROMPT`, which asserts a `[PASSPORT CONTEXT]` block is
present ("USE THIS DATA. It is real ... Never say you can't see their health
data"). With no data present, the model hallucinated plausible figures — unsafe.

Fix (owner path only): added `MAPLE_SYSTEM_PROMPT` (+ `MAPLE_ORIENTATION`) in
`backend/src/routes/luca.js`, used ONLY on the `mapleOwner` branch. It:
- keeps LUCA's identity (warm/sovereign/grounded; brief 2–4 short paragraphs;
  non-clinical; never diagnose/prescribe; route clinical concerns to a
  licensed practitioner);
- explicitly states NO Passport data is available this turn and forbids
  referencing/citing/estimating/inventing any specific metric (vitality,
  Mind/Body/Heart/Spirit, check-ins, dates, streaks, LOVE points, bookings,
  journey progress); tells LUCA to keep guidance general and, if asked about
  specific numbers, to say it can't see Passport data on this private channel
  and point to the relevant app section;
- keeps the SAME strict JSON envelope (`{reply, suggestions:[{label,action,target}]}`,
  2–3 suggestions) so `parseLucaResponse`/suggestion handling are unchanged, but
  drops `open_listing` from the allowed actions (no practitioner directory is
  provided on this path).

The shared (non-owner) path still uses `SYSTEM_PROMPT`, byte-for-byte unchanged.
Verified: `node --test backend/test/maple/` → 20/20 pass; `/api/health` 200 after
`systemctl restart solaris-beta-demo-backend.service`. Deployed release file
`/opt/solaris-beta/releases/maple-luca-direct-1/backend/src/routes/luca.js` kept
in sync with the committed source.
