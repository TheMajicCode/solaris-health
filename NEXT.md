# NEXT — running handoff log (append-only)

## Sprint B — Track B (M1–M3) · branch `agent/abacus-sovereign-sprint-v4`

Milestones M1–M3 built, verified, committed and pushed. M4–M8 intentionally
NOT started (separate later subtasks: A5 intake engine, A3 Intelligence
section, A4 Wompi/GPS, A2 §3 Nostr binding).

### M1 — Identity spine + rename · commit `a5f808f`
- Migration **026** (additive): `subject_id` on 26 domain tables + `users`,
  backfilled + indexed; `solaris_subjects.entity_type`; widened
  `solaris_identity_bindings.binding_type` CHECK to the full A2 set;
  `audit_logs.actor_subject_id + purpose + consent_scope`; re-backfilled
  subjects/email-bindings for users created since migration 023.
- `audit()` now records purpose + consent_scope + actor_subject_id.
- JWT carries `sub` = permanent Solaris public_ref (userId kept for compat).
- Domain writes (check-in) stamp subject_id.
- Rename sweep: "LUCA Passport" → "Digital Sovereign Passport" everywhere
  user-facing; admin "users" → "members".
- Tests: `identity-spine.test.js` (+3). Backend 147/147, frontend 32/32.

### M2 — Platform reliability · commit `a3ffff0`
- Structured LUCA JSON `{reply, suggestions:[{label,action,target}]}` with
  `JSON.parse` + graceful fallback, action from the typed A1 §5 enum — already
  in place from Sprint A; **added** rule-derived fallback chips
  (`buildTriggerSuggestions` in `luca-triggers.js`) so fallback suggestions come
  from fired A1 §6 rules first, then static defaults.
- Rule-based trigger engine in buildContext driving dashboard cards — verified.
- Widget + Coach share ONE persisted thread (AppContext + sessionStorage) —
  verified (Sprint A).
- Orientation grounding in SYSTEM_PROMPT (ORIENTATION_PACK) — verified.
- Idempotent seed + scoped **`npm run seed:reset -- --email=<email>`** that
  wipes only ONE member's journey data and reseeds them (keeps everyone else);
  `seed`/`seed:reset` npm scripts now point at the canonical `seed_solaris.js`.

### M3 — Member journey · commit `767d6f9`
- Role model (everyone a member; "Become a Practitioner" upgrade; existing
  practitioner accounts keep working) — verified in place.
- Passport hub actions ("Update my intake", "Add health data", "Book more
  tests" → Explore filtered to diagnostics) — verified in place.
- Daily check-in v2 (Mind/Body/Heart/Spirit sliders, rotating LUCA questions,
  weekly strip, habits, LOVE points + streaks, plus Sprint A sleep/water/meal)
  — verified in place.
- Explore "Curate for me" + curated rail — verified in place.
- Media player v2 (queue, seek, ±15s, playback speed, persistent mini-player,
  local file import) — verified in place (AudioProvider).
- Sign-out button bottom-left of the sidebar — verified in place.
- **NEW work (closing the cross-cutting invariant gap):** "Add health data"
  now stamps the four mandatory provenance columns on every shared fact.
  - Migration **027** (additive): `provenance_level (0–5 CHECK)`, `source`,
    `observed_at`, `consent_scope` on `health_documents` (subject_id from 026);
    backfill + index.
  - Backend `health-documents.js`: **de-identifies** the free text (emails,
    phones, long ID runs, the member's own name/email) BEFORE the AI call;
    stamps subject_id + provenance; accepts level/source/observedAt/
    consentScope. A member self-note = L0/self; a marked lab result = L4/self
    (pending verification).
  - `export.js` now serializes the provenance columns (vault roundtrip green).
  - Frontend: data-type selector (Personal note L0 / Lab result L4) + observed
    date; `ProvenanceBadge` (L0–L5) on each shared document.
  - Tests: `health-data-provenance.test.js` (+4).

### Final verification
- Backend `npm test` **151/151** (20 suites); frontend `npx vitest run`
  **32/32**; `npm run build` clean; roundtrip `node tests/roundtrip.cjs`
  9/9 structural assertions.
- `public/sw.js` cache bumped **solaris-v8 → solaris-v9**.
- `docker compose build frontend backend && docker compose up -d` — all
  containers healthy; migrations current ("No migrations to run"); seed
  restored demo data.
- Live site https://solaris-health.abacusai.cloud returns 200; login/session
  works; zero console errors on dashboard; trigger-driven cards render;
  "Curate for me" present; "Sovereign Passport" branding. Provenance verified
  end-to-end via live API: L4 stamped, email scrubbed from LUCA summary.

### Follow-ups / deferred
- M4–M8 not started by design (later subtasks).
- Provenance UI currently exposes L0 (note) and L4 (lab) self-submissions;
  L1–L3/L5 upgrade paths (observed/peer/institution/governed) arrive with the
  A3 Intelligence section (M5) and practitioner attestations.



---

## Sprint C — Track B (M4–M5) · branch `agent/abacus-sovereign-sprint-v4`

M4 (A5 intake engine + messages inbox) and M5 (A3 Intelligence section, beta)
built, verified, committed and pushed.

### M4 — Messages inbox + intake engine · commit `c6e3efa`
- Part A: foundational intake captured through the engine, stamped at **L2**
  (peer-attested) + subject_id, summarized into LUCA context.
- Part B: intake variants/templates + prefill collapse (answered fields fold
  into a compact recap).
- Bilingual EN/ES intake copy; 48h reminders for incomplete intake; messages
  inbox surface for LUCA-initiated prompts/nudges.

### M5 — Intelligence section (beta) · commit `bfdf4cd`
- Migration **029** (additive, applied live): `intelligence_exclusions`
  (subject_id, excluded_source, toggled_at; UNIQUE subject+source).
- `backend/src/lib/intelligence.js`: `EXCLUDABLE_SOURCES` (8), `NEVER_LIST` (5
  honest boundaries), `getExclusions`/`setExclusion` keyed by subject_id.
- `buildContext` refactor (`luca.js`): all 8 excludable sources emitted through
  one `emit()` helper — always records source + count for the view, injects text
  into the prompt only when NOT excluded. Chat handler loads exclusions first;
  `buildContext` exposed on the router.
- `backend/src/routes/intelligence.js` mounted at `/api/intelligence`:
  `GET /context` (Natural 7 shelves + Artificial "what LUCA can see now" with
  live counts/NEVER list/last AI call/fired rules/last 8 actions — no PHI +
  Enhanced 4 card types), `GET|PUT /exclusions` (per-source opt-out, validated,
  audited).
- Frontend: **Intelligence** tab (Salud, Brain icon); `IntelligencePage` +
  `SourceRow` toggles; `api.js` +3 methods.
- Tests: `intelligence.test.js` (+4) — 3 panes/warm empty states; no raw PHI in
  Artificial; exclusion persists + drops source from prompt; non-excludable
  source → 400.

### Final verification (Sprint C)
- Backend `npx jest --silent` **161/161** (+4); frontend `npx vitest run`
  **32/32**; `npx vite build` clean; roundtrip 9/9. Migrations current through
  **029**. `public/sw.js` **solaris-v9 → solaris-v10**. Docker rebuilt + up;
  `/api/health` ok. Live site 200; `/api/intelligence/context` returns 3 panes
  with real counts; exclusion toggle verified via live API + in-browser.

### Follow-ups / deferred
- **A3 §4.1 mandatory four provenance columns — full rollout DEFERRED.** Present
  on `health_documents` (M3) + foundational/intake tables (M4); NOT yet on
  `daily_checkins` / `journal_entries` — documented as beta scoping. Intelligence
  view shows best-available provenance per shelf meanwhile.
- Enhanced patterns are simple 7-day averages (hedged; need ≥3 check-ins).
- Artificial recentActions capped at last 8 receipts (metadata only, no PHI).
- Remaining Track B milestones (A4 Wompi/GPS, A2 §3 Nostr binding) not started
  — separate later subtasks.

## Sprint D — Track B (M6–M8) · branch `agent/abacus-sovereign-sprint-v4`

Sovereign payments + GPS shadow receipts + working Identity Key (Nostr).
Commit+push after every milestone.

### M6 — Payments MVP (Wompi sandbox) · commit `7d4b4f7`
- PaymentProvider port + Wompi-sandbox/mock adapters; idempotent webhook;
  A4 allocation ledger (`lib/payments/allocation-policy.js`,
  `gps:policy:aura-consultation:v0.1`; earned 9000 = aura 8600 + coord 400;
  envelope 1000 bps four buckets; largest-remainder; no referral leg); inbox
  receipt. Migration 030. Backend 164/164.

### M7 — GPS shadow receipts · commit `877c3f7`
- Migration 031 `gps_shadow_receipts`. `lib/gps-shadow.js` builds
  `gps-receipt/1.0` (A4 §3.4), invariants enforced, idempotent, SCHEDULED ≥ $500.
  `GET /api/gps/receipts(/:id)`; vault `payments/gps-receipts.jsonl`; member
  panel `PaymentReceipts.jsx`. Backend 166/166, frontend 32/32, roundtrip 9/9.

### M8 — Identity Key (Nostr) + NIP-05 + login · commit `31100df`
- Client-side BIP-39 → NIP-06 npub (`src/lib/identity-key.js`); nsec in
  sessionStorage only, never sent up. `POST /api/identity/nostr` stores public
  npub + NIP-05 handle (migration 032 `nostr_handles`). Working challenge/response
  login: `/api/auth/nostr/challenge` (single-use 5-min nonce) +
  `/api/auth/nostr/login` (BIP-340 Schnorr verify → JWT). `flows/Auth.jsx` now has
  a real create/existing Identity Key flow (replaced "coming soon").
  `.well-known/nostr.json` resolves handle→pubkey; lnurlp returns "not configured".
  Renamed "Nostr" → "Identity Key" in UI + ℹ️ info popover with exact sovereignty
  copy; `IdentityCard` generate/bind flow. Fixed latent M7 `PaymentReceipts` import
  build bug. Backend 170/170 (+4), frontend 32/32, roundtrip 9/9, vite build clean.

### Final verification (Sprint D)
- Migrations through 032. `sw.js` solaris-v10 → **v11**. Docker rebuilt + up;
  `/api/health` ok; live site 200. Live E2E: create → challenge → sign → login
  200 + JWT → bind npub+handle → `nostr.json` resolves → lnurlp "not configured".
  nginx `/.well-known/` proxied to backend. Test data cleaned up. Tag
  `sprint-d-complete`.

### Follow-ups / deferred
- Signing is direct (nsec in sessionStorage), not NIP-46 bunker (A2 §3.2.4 ideal;
  scope note says ship NIP-05 + npub first). Key never leaves device.
- Payments/GPS settlement simulated (Wompi sandbox; allocations SIMULATED).
  Lightning address returns "not configured".
- A4 payments policy runs alongside the legacy `lib/gps` engine; not merged.



---

## Sprint E — Quality Hardening

Nine items closing production-readiness gaps from a live-demo walkthrough
(branch `agent/abacus-sovereign-sprint-v4`, one commit + push per item):

- **0** Identity Key login button contrast — solid green + white text. `bd56b1a`
- **1** Postgres-backed rate-limit store (mig 033); preserves `trust proxy=2` +
  failed-attempts-only keying; test-mode memory fallback. `0c84c19`
- **2** Email adapter (Resend/SMTP/console), bilingual ES/EN, lazy nodemailer. `18a0726`
- **3** GPS shadow-receipt demo data — 3 SETTLED + 2 SCHEDULED, idempotent. `769c27c`
- **4** Provenance rollout (mig 034) to `daily_checkins` + `journal_entries`;
  Natural shelves show real source·level·date. `3e63b08`
- **5** Booking payment UI (mig 035) — `payment_intents.booking_id` +
  `bookings.payment_status`; `/checkout` takes `bookingId`, derives amount,
  validates ownership, marks pending→paid on webhook; BookingFlow "Pay to
  confirm" + BookingCard pills (Wompi sandbox). `23ef111`
- **6** Demo gaps — `seedAlejandroProfile()` (bookable integrative-nutrition
  profile: 3 services, Mon/Wed/Fri slots → appears in Explore + Curate) and
  `seedSarahAssessment()` (3 historical snapshots 30/60/90d → real vitality trend
  line, plus answer backfill). Idempotent; `--demo-gaps` flag + full seed. `78abac9`
- **7** Identity Key flow UX — verified complete (bundled into item 0).
- **8** Mobile — check-in sliders ≥44px touch target; Intelligence panes
  `minmax(min(320|280px,100%),1fr)` (no ≤375px overflow); booking modal padding
  + 96vh at ≤520px. `e7b072a`

### Final verification (Sprint E)
- Migrations through **035**. `sw.js` solaris-v11 → **v12**.
- Backend **183/183**, frontend **32/32**, roundtrip **9/9**, vite build clean.
- Docker frontend+backend+seed rebuilt; `up -d`; `/api/health` ok; live site 200.
- Verified live: alejandro bookable (active/approved, 3 services/3 slots); sarah
  has 4 trending responses (vitality 55→60→63→67).

### Gotcha
- The `seed` compose service runs a **full reset** on every `up`. It now includes
  the item-6 demo-gap functions, but the `seed` image must be rebuilt with
  `backend`/`frontend` — a stale seed image wipes the demo-gap data (hit + fixed
  during deploy by rebuilding `seed` and re-running `--demo-gaps`).

## Sprint F — Demo readiness & role-differentiated portals

- **1** Alejandro **Mon–Fri 09:00–17:00** availability template (upgraded from
  Mon/Wed/Fri) → 168 rolling bookable slots; rating 5.0/150. `a97fa0b`
- **2** Sarah zero dead-ends — health docs, inbox, most-recent detox journey,
  Alejandro as top nutritionist; deterministic guided-task provider
  (`journey.js` ORDER BY). `448bc88`
- **3** `AvailabilityManager.jsx` weekly grid editor (reuses existing
  `PUT /api/provider/availability/me`). `6f0a047`
- **4** Role-differentiated portals via `navForPersona`/`defaultTabFor`/`PORTAL`:
  member (green, unchanged) · practitioner (indigo Practitioner Portal) · admin
  (amber Solaris Admin). Patient-only chrome hidden for other personas. `6f0a047`
- **5** Finance — member `MemberPayments.jsx` (list + CSV, `9131a7c`),
  practitioner `PractitionerFinance.jsx` (earnings/90% split/payout sim),
  admin `AdminFinance.jsx` (reconciliation + settlement queue). `6f0a047`
- **6** Settings — `PractitionerSettings.jsx` + `AdminSettings.jsx`; member
  settings kept as-is (existing Identity & Data tab), no new member tab. `6f0a047`
- **7** Demo creds verified live (all `/api/auth/login` → 200): sarah/demo123,
  alejandro/demo123, admin/admin123 (+ elena, majd).

### New admin endpoints
- `GET /api/admin/finance`, `GET /api/admin/gps-settlements`,
  `PATCH /api/admin/gps-settlements/:id` (all `requireAdmin`; simulated).

### Adaptations
- Reused existing `PUT /api/provider/availability/me` (brief's
  `PUT /api/providers/:id/availability` does not exist).
- Member settings served by existing Identity & Data tab (no new tab).
- No migration 036 — payout form is a client-side simulation.

### Final verification (Sprint F)
- `sw.js` solaris-v12 → **v13**. Migrations unchanged (through 035).
- Backend **187/187** (new admin-finance suite), frontend **39/39** (new
  role-routing suite), roundtrip **9/9**, vite build clean.
- Rebuilt **frontend+backend only**, `up -d frontend backend`; live DB preserved.
- Live: `/api/health` 200; site 200; Alejandro days [1–5] + earnings 200; Sarah
  167 slots w/ Alejandro (42 dates); admin finance + gps-settlements 200.

### Gotcha
- **Do not rerun the `seed` service to deploy.** `alejandro@solaris.health` comes
  from `seed-demo-data.js`, not `seed_solaris.js`; a full `seed_solaris.js` reset
  truncates Solaris tables and only *looks up* Alejandro, so a naive rebuilt-seed
  `up` **wipes him**. Deploy by rebuilding only `frontend`+`backend`
  (`up -d frontend backend`), leaving `postgres`/`seed` untouched.



## Node K1.4.1 — Live-phone corrections · branch `agent/abacus-beta-v1-phone-regressions-k1-4-1`

Focused correction of K1.4. One scoped commit `ec11802c` off base `12d564e5`.
Frontend deployed to **Preview only**; Demo, Stable, and the shared backend
were left byte-for-byte unchanged.

### Defects corrected (A–G)
- **A** Next-Step reads the real Growth to-do pipeline (no placeholder copy).
- **B** Personalized journey falls back to a **device-local** To-do store when
  `/api/journeys/seed-plan` is absent — **no migration, no reseed** (endpoint
  stays 404 on Preview, verified).
- **C** Personalized steps emit only safe, non-destructive actions.
- **D** Branding: emblem-only splash, favicon not misrepresented, SW `v18 → v19`.
- **E** Signed-in Spanish: Next-Step CTA, approved-journey card, Growth to-dos,
  Habit tracker localized; en/es parity enforced; safety keys stay
  `REVIEW_PENDING`. Docs updated (`docs/beta-v1/SPANISH-REVIEW-NEEDED.md`).
- **F** 13 runtime tests F1–F13 added (27 in the K141 file). Full suite
  **590 passed / 81 files** (K1.4 floor 562; nothing lowered or deleted).
- **G** Live Preview verified: `/` 200, `/api/health` 200, seed-plan 404,
  SPA fallback 200; authenticated live screenshots captured at 360–430 px.

### Deploy method
- Immutable release dir `/opt/solaris-beta-preview/releases/ec11802c…/dist` +
  atomic swap of `/opt/solaris-beta-preview/current`; `nginx -t` + reload.
- Demo/Stable symlinks + bundle hashes unchanged; shared backend PID unchanged.

### Gotcha
- Do **not** commit or `rm` `.abacus.donotdelete` (stays modified in the tree).
- Preview shares the Demo DB + synthetic Express backend on 127.0.0.1:5055 —
  never migrate/reseed/mutate rows there; the device-local To-do store is the
  correct path when `seed-plan` 404s.
