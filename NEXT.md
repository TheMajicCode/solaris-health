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
