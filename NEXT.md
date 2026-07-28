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
