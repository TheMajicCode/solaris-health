# S1B-R2 — Booking-Only Gate (Online Payments Disabled)

Contract-before-code node for Solaris Beta V1. This document specifies a
**booking-only gate**: the member journey completes a booking WITHOUT any online
payment, Wompi and every online-checkout rail are disabled by default, and the
real payment code is **code-unreachable** in this release. This is a
**contract**, not an implementation. No code in this node is edited, staged,
committed, pushed, deployed, or tested by authoring this file.

---

## 0. Provenance and pins

- **Starting commit (Beta):** `bff148d4031930899431e2dc0225148519cfa60e`
- **Branch:** `agent/abacus-beta-v1-hardening`
- **Tree:** `c179b790eb232e2a7900a26661aaf71d3423ba1d`
- **Repository:** `github.com/TheMajicCode/solaris-health`
- **Frontend root:** repository root `src/` (Vite/React). **Backend root:** `backend/`.
- **Two-ladder source hierarchy** (per `AGENTS.md` / `docs/beta-v1/WORKFLOW.md`):
  running code at `bff148d` is authoritative over prose; a human product
  decision is authoritative over running code. Where this contract and the code
  disagree, the code is described as *current behavior* and this contract states
  the *desired behavior* to be reached by the future implementation node.

### 0.1 Governing product decision

**Majd, 2026-08-08 — Solaris Beta V1 is BOOKING-ONLY.**

- Wompi and all online checkout are DISABLED. No Wompi checksum exception is
  implemented or requested.
- A booking MUST complete WITHOUT payment.
- GPS payment/receipt demonstrations MAY remain ONLY where visibly labelled
  "Simulated".
- Spark is separate/optional and is NOT part of this node. UTEXO remains
  "Coming Soon" and is NOT part of this node.

This decision sits at the top of the source ladder for this node and overrides
any "REAL-WHEN-CONFIGURED" language in `docs/beta-v1/RELEASE-LEDGER.md` about the
Wompi gross-checkout path.

---

## 1. Scope, non-goals, and required outcomes

### 1.1 What this node does

Freeze Beta V1 into a state where the ONLY money-adjacent surfaces that reach a
member are (a) a booking that needs no payment and (b) clearly-labelled
*Simulated* GPS receipt/allocation demonstrations. All online-payment
entrypoints are made code-unreachable and fail closed.

### 1.2 Non-goals (explicit non-implementation statement)

This node does **NOT** implement, enable, or design:

- **Spark** — separate/optional, out of scope.
- **UTEXO** — remains "Coming Soon", out of scope.
- **Onboarding** — out of scope.
- **Any payment provider** — no new provider, no Wompi activation, no live
  rail, no second/parallel payment path. Wompi stays code-unreachable.
- No new authentication system, no new database, no new external dependency.

### 1.3 Required implementation outcomes (the 14 gate points)

The future implementation node MUST satisfy all of the following. Each is
testable; §7 binds each to acceptance tests.

1. `ONLINE_PAYMENTS_ENABLED` defaults to **false**. Absence, empty, malformed,
   or unknown values are treated as false (fail-closed).
2. Wompi credentials alone can **NEVER** activate online payments. Presence of
   `WOMPI_*` env vars, or `PAYMENT_PROVIDER=wompi`, must not enable a live rail.
3. The real Wompi adapter and the real payment router are **CODE-UNREACHABLE in
   Beta V1**. Even `ONLINE_PAYMENTS_ENABLED=true` combined with
   `PAYMENT_PROVIDER=wompi` and complete `WOMPI_*` credentials MUST NOT make
   Wompi reachable in this release. There is no runtime-verifiable "authorization
   record"; the gate is a hard-disabled constant in this release (§4, §15).
4. When payments are disabled, the checkout and webhook entrypoints STOP before
   any provider call or database write and return a **typed disabled response**.
5. The member booking journey never creates a checkout, never opens Wompi, never
   waits for payment, and never displays a payment-pending state.
6. A successful booking reaches the existing booking confirmation / request
   state WITHOUT payment.
7. Wompi buttons, badges, wallet choices, and configuration claims are ABSENT
   from the Beta UI.
8. Practitioner earnings / payment areas are hidden or explicitly "Coming Soon"
   and are never populated with invented financial data.
9. GPS receipts / payment demos MAY remain ONLY behind a simulated surface with
   a persistent, visible "Simulated" label.
10. Dormant future Wompi code NEVER receives PHI, booking notes, symptoms,
    health context, or secret material. No third-party email/notification payload
    carries PHI (§3.2.1, §6.2).
11. Existing tests are **rewritten** to express the booking-only decision. Do
    NOT skip or delete failing tests to make the suite green. `payments.test.js`
    preserves EXACTLY SEVEN backend tests (§5, §7, §10).
12. Vault-export and GPS-receipt tests use explicitly **simulated fixtures**
    rather than a Wompi webhook.
13. NO new dependency, database table, migration, payment provider, second
    database, or parallel auth system.
14. NO change to the five existing S1B implementation paths unless this contract
    explicitly proves overlap unavoidable AND defines a preimage-preserving
    recovery procedure. (See §9.3 — no overlap is anticipated.)

---

## 2. Architecture frame (hexagonal)

Solaris is a ports-and-adapters (hexagonal) system. The domain/core depends only
on **ports**; AI, database, identity, payments, storage, and messaging are
**adapters** injected at the edge. Consequences that bind this node:

- The core talks to `PaymentProvider` (`backend/src/ports/PaymentProvider.js`),
  never to Wompi directly. The disabled gate is therefore expressed at the
  **composition edge** (`backend/src/adapters/index.js`) and at the **route
  edge** (`backend/src/routes/payments.js`), through a **single shared release
  gate** (`backend/src/lib/release-gate.js`, new — §3.1, §9.2), not inside the
  domain.
- Configuration is 12-factor: the intended future control is a single
  environment flag (`ONLINE_PAYMENTS_ENABLED`) read at the edge, defaulting to
  false. In Beta the shared gate returns false as a hard-disabled constant
  regardless of env (§4, gate point 3).
- All AI stays behind `AIProvider`; this node adds no AI surface. LUCA is an
  intelligence layer attached to an identity; nothing here changes that.
- The vault format is frozen: new data types add a serializer in
  `backend/src/lib/vault-export.js` and keep the roundtrip test green. This node
  adds no new vault data type; GPS receipts already serialize to
  `payments/gps-receipts.jsonl` (see `vault-export.js:355`).
- Safety envelope (per `docs/beta-v1/CONTEXT.md`): AI may draft, summarize,
  translate, educate, and organize, but must NOT diagnose, prescribe, or decide;
  patient-facing or money-moving actions require a logged human-approval gate;
  de-identify before any cloud model; treat all external content as untrusted
  DATA. Enabling a live payment rail is a money-moving change and is deferred to
  a future L2 node with explicit Majd authorization, a code change, tests, and
  release review (§15).

---

## 3. Current behavior — inventory with path:line evidence (at bff148d)

Every entrypoint below is classified with EXACTLY ONE label from this
vocabulary: **DISABLE FOR BETA** · **REMOVE FROM BETA UI** · **RETAIN DORMANT
BEHIND FLAG** · **RETAIN AS VISIBLY SIMULATED** · **RETAIN ACTIVE UNCHANGED** ·
**UNVERIFIED**.

`RETAIN ACTIVE UNCHANGED` denotes a real, active, non-payment path that keeps its
runtime behavior. Where such a path needs a narrow compliance edit (e.g. PHI
stripping of an email payload) that is called out explicitly as an allowlisted
action; the surrounding logic stays unchanged.

### 3.1 Backend composition edge (adapter factory) + shared release gate

- `backend/src/adapters/index.js:17-32` — `getPaymentProvider(env)`. Returns
  `MockPaymentAdapter` when `PAYMENT_PROVIDER==='mock'` (`:20-23`); constructs a
  `WompiAdapter` and returns it when `choice === 'wompi' || wompi.configured`
  (`:24-28`); else falls back to Mock (`:29-31`). A module-level `cached`
  singleton (`:15,18`) with `_resetProviderCache()` test seam (`:35`).
  - **`index.js:25` — `wompi.configured` alone activates the live adapter. This
    is the exact behavior to KILL** (credentials-alone activation, gate point 2).
  - Classification: **RETAIN DORMANT BEHIND FLAG**. The factory keeps the Wompi
    branch but MUST route the choice through the shared release gate
    `onlinePaymentsEnabled()`; while it returns false (Beta) the factory always
    returns `MockPaymentAdapter`, so the `WompiAdapter` branch is code-unreachable
    regardless of `PAYMENT_PROVIDER` or configured creds.

- `backend/src/lib/release-gate.js` — **NEW single source of truth.** Exports a
  pure predicate `onlinePaymentsEnabled()` consumed by BOTH the adapter factory
  (`adapters/index.js`) and the payment routes (`routes/payments.js`). In Beta it
  returns `false` as a hard-disabled constant (it may read
  `ONLINE_PAYMENTS_ENABLED` for forward-compatibility but MUST NOT return true in
  this release even for `ONLINE_PAYMENTS_ENABLED=true` + `PAYMENT_PROVIDER=wompi`
  + full `WOMPI_*`). Grep for `ONLINE_PAYMENTS` / `release-gate` across
  `backend/src` at `bff148d` returns nothing — this module does not yet exist and
  must be introduced. Do NOT duplicate different gate logic between factory and
  routes.
  - Classification: **RETAIN DORMANT BEHIND FLAG** (new gate module).

- `backend/src/adapters/WompiAdapter.js:25-115` — the only live adapter.
  Reads `WOMPI_PUBLIC_KEY/PRIVATE_KEY/EVENTS_SECRET/INTEGRITY_SECRET/BASE_URL/
  CHECKOUT_URL` from env (`:28-34`); `get configured()` = `Boolean(publicKey &&
  eventsSecret)` (`:37-39`); `createCheckout` builds hosted URL and throws 503
  when not configured (`:45-68`); `verifyWebhook` SHA-256 checksum
  (`:70-87`); `getStatus` (`:89-106`); `refund` returns `NOT_ENABLED` (`:108-114`).
  - Classification: **RETAIN DORMANT BEHIND FLAG**. Not deleted; code-unreachable
    while the shared gate returns false because the factory never injects it.

- `backend/src/adapters/MockPaymentAdapter.js:11-78` — offline adapter;
  `buildSignedEvent` (`:30-55`) mints a locally-signed event for tests.
  - Classification: **RETAIN AS VISIBLY SIMULATED**. It is the only adapter the
    factory may return in Beta; used by the simulated surface and by tests.

- `backend/src/adapters/stubs.js` — OpenNode / LucaLightning / Oobit /
  BankTransfer adapters, all throw "not enabled" (501); never wired.
  - Classification: **RETAIN DORMANT BEHIND FLAG** (documentation stubs).

- `backend/src/ports/PaymentProvider.js:24-39` — the abstract port; all four
  methods throw "not implemented". Keep unchanged.
  - Classification: **RETAIN DORMANT BEHIND FLAG** (port; core contract).

### 3.2 Backend route edge

Mounts (per `backend/src/server.js`): `app.use('/api/payments', paymentsRoutes)`
(`server.js:287`) and `app.use('/api/payments', paymentsSimRoutes)`
(`server.js:288`); `app.use('/api/bookings', bookingsRoutes)` (`server.js:274`);
`app.use('/api/gps', gpsRoutes)` (`server.js:284`).

- `backend/src/routes/payments.js` (mounted at `/api/payments`, `server.js:287`):
  - `POST /checkout` (`:36`, `authMiddleware`). Validates purpose (`:44-46`),
    resolves subject (`:48-49`), validates booking ownership and derives price
    (`:54-71`), idempotency reuse (`:73-89`), **INSERTs `payment_intents`
    status `created`** (`:99-106`), **UPDATEs `bookings.payment_status='pending'`**
    (`:108-110`), **calls `provider.createCheckout(...)`** (`:113-124`), writes
    `payment_events` (`:134-138`), audits (`:139-143`), returns **201 with
    `checkoutUrl`** (`:145-155`).
    - Classification: **DISABLE FOR BETA**. When `onlinePaymentsEnabled()` is
      false this handler MUST return the typed disabled response (§5) BEFORE
      `:99` (before any DB write) and before any `provider.createCheckout` call.
  - `confirmPaidIntent(intent, providerFeeCents)` (`:166-227`). Replay-safe
    transition to `paid` (`:167-176`); writes `allocations` with
    `settlement_status='SIMULATED'` via `computeAllocations` (`:178-188`);
    confirms appointment/booking (`:191-200`); M7 GPS shadow-receipt hook
    (`:202-208`); PHI-free receipt notification (`:210-218`); audit (`:220-224`).
    It is exported at `payments.js:366` and its ONLY caller is this file's
    `POST /webhook` (`:275`). It is **NOT** invoked by `payments-sim.js`.
    - Classification: **RETAIN AS VISIBLY SIMULATED**. Allocations are already
      `SIMULATED`. In Beta its sole caller (the webhook) is disabled, so at
      runtime `confirmPaidIntent` is reachable only from tests.
  - `POST /webhook` (`:232`, public, no auth). Verifies signature (`:233-239`),
    logs the event regardless of validity (`:255-261`), returns 200 with
    `invalid_signature` when unverified (`:263-266`), confirms on `APPROVED` via
    `confirmPaidIntent` (`:271-277`), fails on DECLINED/ERROR/VOIDED (`:278-286`).
    - Classification: **DISABLE FOR BETA**. When `onlinePaymentsEnabled()` is
      false this handler MUST return the typed disabled response (§5) BEFORE
      `provider.verifyWebhook` and before any DB write. When the five S1B files
      are present (Phase C composite), the global S1B secret-boundary middleware
      still runs first (§6.2, AT-4B).
  - `GET /intents` (`:297`, auth) and `GET /intents/:id` (`:319`, auth) —
    read-only receipts; `shapeIntent` (`:336-363`) always adds `simulated:true`
    and a `simulatedNote` (`:360-361`) and nulls `checkoutUrl` unless pending
    (`:352`).
    - Classification: **RETAIN AS VISIBLY SIMULATED**.

- `backend/src/routes/payments-sim.js` (mounted at `/api/payments`,
  `server.js:288`; header "All values are simulated. No real money moves.",
  `payments-sim.js:10`):
  - `POST /simulate` (`:63`, auth) — docstring accepts
    `{ orgId, amountSats, description?, treatmentPlanId? }` (`:4`); destructures
    `treatmentPlanId` (`:65`) and a free-text `description`; INSERTs `payments`
    status `simulated_settled` (`:96-97`) **storing the caller-supplied
    `description` in `payments.description`** and returning it; credits simulated
    wallet (`:114-135`); **when `treatmentPlanId` is supplied, UPDATEs
    `treatment_plans SET status='paid'`** (`:134-136`); returns `simulated:true`
    (`:141-162`). `GET /mine` then exposes the stored free-text `p.description`.
    - **Defect to fix (Correction 2):** a *simulated* payment MUST NEVER mutate
      real clinical/financial status AND MUST NEVER carry free-text metadata that
      could contain PHI. The implementation node MUST:
      - accept ONLY the functional fields `orgId` and `amountSats`;
      - remove BOTH `description` AND `treatmentPlanId` from the docstring (`:4`)
        and from destructuring (`:65`);
      - ignore any legacy supplied `description` and `treatmentPlanId` and NEVER
        persist either supplied value;
      - store and return EXACTLY the fixed string `Simulated GPS demonstration`
        as the payment description;
      - make `GET /mine` expose that fixed safe description, NOT arbitrary
        historical `p.description`;
      - remove the `treatment_plans` UPDATE (`:134-136`).
      No patient note, symptom, service, treatment, diagnosis, or other PHI can
      enter simulated payment metadata. Simulated wallet balances and receipts
      remain, explicitly named and visibly labelled simulated.
    - **Atomicity mandate (Correction 3):** the retained simulated write set MUST
      be atomic. The implementation node MUST:
      - acquire ONE client from `db.pool` and perform EVERY related mutation on
        that SAME client;
      - issue `BEGIN` before the first mutation; `COMMIT` ONLY after the payment
        row, the receipt row, the payment-receipt link, AND the simulated wallet
        credit have ALL succeeded; `ROLLBACK` after ANY failure; `release()` the
        client in a `finally` block;
      - NEVER update a booking, appointment, or treatment plan on this path;
      - store and return ONLY the fixed description `Simulated GPS demonstration`,
        and keep the visible simulated label.
      Durable replay/idempotency protection for these writes is NOT solved by R2
      when it requires a schema change; record that deferral exactly as
      `BETA RELEASE BLOCKER — DATA INTEGRITY NODE REQUIRED`. A process-memory
      set/cache MUST NOT be used as an idempotency substitute.
    - Classification: **RETAIN AS VISIBLY SIMULATED**.
  - `GET /mine` (`:172`, auth) — payer's simulated payments + receipts; exposes
    the fixed safe description `Simulated GPS demonstration`, never arbitrary
    stored free text.
    - Classification: **RETAIN AS VISIBLY SIMULATED**.

- `backend/src/routes/bookings.js`:
  - `POST /request` (`:123`, auth). Reads `auto_confirm_bookings` on the
    provider (`:139,:172`), sets `status = autoConfirm ? 'confirmed' :
    'pending'` (`:173`), writes `booking_status_history` (`:194`), and returns
    **201 with `booking`, `reference`, `autoConfirmed`** (`:237`). **No checkout
    call anywhere in this route** — the booking already completes without
    payment.
  - Also `GET /me` (`:249`), `GET /mine` (`:272`), reschedule (`:395`), etc.
    - Classification: **RETAIN ACTIVE UNCHANGED**. This is the canonical
      booking-completes-without-payment path (gate points 5,6); its booking logic
      is unchanged. The `vars` argument is dropped entirely from every
      `sendBookingEmail` caller in this file (see §3.2.1), which is the only
      allowlisted edit to this file.

### 3.2.1 Active booking email path — PHI hardening (Correction 1)

- `backend/src/routes/bookings.js`:
  - Imports the mailer: `const { sendBookingEmail } = require('../lib/booking-emails')`
    (`:14`).
  - After COMMIT it fetches patient identity `SELECT full_name, email` (`:207`),
    sets `patientName`/`serviceName` (`:208-209`).
  - **Provider email** `booking_request` passes PHI-bearing vars
    `{ patientName, serviceName, date, startTime, endTime, notes: booking.patient_notes }`
    (`:219-222`).
  - **Patient email** `booking_confirmed` passes
    `{ businessName, serviceName, date, startTime, endTime, address }` (`:231-234`).
  - **Cancelled email** `booking_cancelled` passes
    `{ recipientName, byWhom, serviceName, date, startTime, reason }` (`:347-349`).
- `backend/src/routes/provider/bookings.js`:
  - Imports the same mailer: `const { sendBookingEmail } = require('../../lib/booking-emails')`.
  - **Provider-side confirm** `booking_confirmed` passes
    `{ businessName, serviceName, date, startTime, endTime, address }` (`:144`).
  - **Decline / cancel** `booking_declined` | `booking_cancelled` passes
    `{ patientName, recipientName, byWhom, serviceName, date, startTime, reason }`
    (`:161`).
  - **Complete** `booking_completed` passes
    `{ patientName, businessName, serviceName }` (`:174`).
- `backend/src/lib/booking-emails.js`:
  - `TEMPLATES` (`:29-121`). `booking_request` (`:31-44`) renders `Patient:`,
    `Service:`, `Date:`, `Time:`, and `Notes:` (`:35-39`) — patient identity,
    service, appointment time, and free-text notes/symptoms. `booking_confirmed`
    (`:47-63`) renders provider, service, date/time, and `Location:` (`:55`).
    Other templates similarly embed identity/service/time.
  - `sendBookingEmail(...)` (`:127-159`) renders the template, **console-logs the
    full body** (`:140-147`), and **persists the PHI-bearing body into the
    `email_notifications` table** (`:149-153`, status `'logged'`). In this build
    email is "logged, not delivered"; the PHI nonetheless lands in logs and the
    DB row.
- Tests:
  - `backend/tests/mailer.test.js` covers the SEPARATE delivery adapter
    `backend/src/lib/mailer.js` and already asserts a PHI boundary on *delivered*
    content (`describe('PHI boundary — delivered content is de-identified')`,
    `mailer.test.js:49-78`, PHI token list `:52`).
  - There is **no** test asserting that `booking-emails.js` payloads are PHI-free.
- Required behavior (the future node MUST specify/implement):
  - **All SIX booking templates** — `booking_request`, `booking_confirmed`,
    `booking_declined`, `booking_cancelled`, `booking_reminder`,
    `booking_completed` — collapse to ONE fully neutral message with NO
    per-event variation:
    - Subject becomes exactly: `Secure notification`
    - Body becomes exactly (single line, no line break inside the string):
      `You have a new secure notification. Sign in to Solaris to view it.`
  - No words such as *booking, appointment, patient, practitioner, provider,
    service, cancellation, reminder, completed, date, time, address, reason,
    visit,* or *care* may appear in an outbound subject or body.
  - Every `sendBookingEmail` caller — in BOTH `bookings.js` AND
    `provider/bookings.js` — MUST pass NO `vars` object at all: the `vars`
    argument is dropped entirely from every call site (no `patientName`,
    `serviceName`, `date`, `startTime`, `endTime`, `notes`, `businessName`,
    `address`, `reason`, `recipientName`, `byWhom`, or any other
    booking/appointment context is supplied — the argument itself is removed,
    which is strictly stronger than passing a PHI-free `vars`).
  - The persisted `email_notifications.template` value MUST be the neutral
    constant `secure_notification`, NOT a `booking_*` event name.
  - Ordinary application logs MUST NOT contain the recipient email, user ID,
    template/event name, subject, body, booking ID, or any other booking detail.
    If a status log line is retained, it may contain ONLY fixed neutral text and
    a request ID.
  - Error logging MUST be fixed/redacted and MUST NOT print provider or database
    error detail that could carry payload data.
  - Detailed booking information remains available ONLY inside authenticated
    Solaris (do NOT remove the secure in-app booking detail / notifications); the
    secure in-app surface is unchanged and stays authenticated. The authenticated
    in-app notification channel (`createNotification`) is a SEPARATE local channel
    and MUST NOT be weakened, neutralized, or stripped of context by this node —
    only the outbound email channel is neutralized.
  - Add acceptance test(s) proving PHI-free, fully neutral email payloads across
    all six templates AND every route caller in BOTH `bookings.js` and
    `provider/bookings.js`, INCLUDING a NEGATIVE CALLER ASSERTION proving that no
    `sendBookingEmail` invocation supplies a `vars` argument after implementation
    (§7 AT-11).
  - Classification: **RETAIN ACTIVE UNCHANGED** (emails still fire) with an
    allowlisted neutralizing edit to `booking-emails.js` templates and the removal
    of the `vars` argument from every `sendBookingEmail` caller in BOTH
    `bookings.js` and `provider/bookings.js`.

### 3.3 Other backend surfaces

- `backend/src/routes/admin.js:74-119` — finance reconciliation, read-only view
  over `payment_intents`, labelled "SIMULATED — Wompi sandbox + GPS shadow
  ledger".
  - Classification: **RETAIN AS VISIBLY SIMULATED** (read-only; label must not
    imply a live Wompi rail — see §3.4 UI wording).

- `backend/src/routes/gps.js` — `GET /policy` (`:61`), `GET /receipts` (`:69`),
  `GET /receipts/:id` (`:111`), `GET /my-ledger` (`:131`), `GET /my-earnings`
  (`:167`), `GET /treasury` (`:214`), `/treasury/breakdown` (`:250`). Shadow
  receipts are SIMULATED with `settled_cents=0`.
  - Classification: **RETAIN AS VISIBLY SIMULATED**.

- `backend/src/lib/payments/allocation-policy.js` — `POLICY_ID`
  `'gps:policy:aura-consultation:v0.1'` (`:28`), `POLICY_HASH` (`:51-52`),
  `computeAllocations(eligibleCents)` (`:61`). Pure function; used by
  `confirmPaidIntent` and by tests.
  - Classification: **RETAIN AS VISIBLY SIMULATED** (pure allocation math over
    simulated value; unchanged).

- `backend/src/lib/vault-export.js` — `buildVaultExport(record)` (`:40`) emits
  `payments/gps-receipts.jsonl` (`:355`) and `payments/README.md` (`:359`);
  `VAULT_SCHEMA_VERSION` exported (`:455`). Vault format frozen.
  - Classification: **RETAIN AS VISIBLY SIMULATED** (serializer unchanged; the
    receipt fixtures feeding it become explicitly simulated — gate point 12).

### 3.4 Frontend edge (repo-root `src/`)

- `src/lib/api.js`: `requestBooking` → `POST /bookings/request` (`:349`);
  `simulatePayment` → `POST /payments/simulate` (`:456`); `getMyPayments` →
  `GET /payments/mine` (`:457`); **`createCheckout` → `POST /payments/checkout`
  (`:460`)**; `getPaymentIntents` (`:461`); `getPaymentIntent(id)` (`:462`).
  - Classification: **REMOVE FROM BETA UI**. `createCheckout` (`:460`) MUST be
    **removed entirely** — no dormant client method is retained.
    `simulatePayment`/`getMyPayments`/`getPaymentIntents` are
    **RETAIN AS VISIBLY SIMULATED**.

- `src/components/booking/BookingFlow.jsx`:
  - Payment imports: `CreditCard, ExternalLink` (`:18`) and `ValueFlowViz`
    (`:23`).
  - Payment state: `paying` (`:42`) and `payStatus` (`:43`).
  - `payNow()` (`:118-141`) calls `api.createCheckout(...)` (`:122`) and
    `window.open(r.checkoutUrl, '_blank', 'noopener')` (`:128`), sets
    `payStatus='pending'` (`:129`).
  - Review step: `Service price` / `Total` rows (`:236-237`); the
    booking-embedded GPS block "🌱 How your payment flows" (`:240`) with promised
    allocation percentages ("90% goes to your practitioner … every dollar is
    transparently shared", `:242`) and promised "LOVE rewards" (`:243`) and
    `<ValueFlowViz total={price} compact />` (`:245`); "pay securely online to
    confirm — or settle in person." (`:250`) vs "No payment needed to request
    this session." (`:251`).
  - Confirmation step (`:257-301`): booking is already requested/confirmed at
    this step (`result` exists, reference `:261`) BEFORE any payment; promised
    LOVE rewards copy (`:272-275`); the `price > 0` pay block (`:276-295`) with
    pending/paid/failed badges (`:278-286`), the "Pay $X to confirm" button
    (`:287-292`), and the note "Secure sandbox checkout via Wompi. Solaris never
    stores your card." (`:293`).
  - Classification: **REMOVE FROM BETA UI**. Remove the payment imports (`:18`
    payment icons, `:23` ValueFlowViz), the payment state (`:42-43`), `payNow`
    (`:118-141`), the booking-embedded ValueFlowViz + "How your payment flows"
    block + promised allocation percentages + promised LOVE rewards
    (`:239-246`, `:272-275`), and the entire `price > 0` pay block (`:276-295`)
    including the Wompi note (`:293`). KEEP the listed service price but relabel
    it "Listed price". ADD exactly: `Solaris does not collect online payment in
    this release. Any payment arrangements happen separately with the
    practitioner.` Booking success (pending or confirmed) remains independent of
    payment (gate points 5,6).

- `src/components/gps/MemberPayments.jsx`:
  - File header "the member's own payment history ("My Payments")" (`:2`);
    heading `<Receipt /> My Payments` (`:73`); subtitle with persistent
    "Simulated — no funds have moved." (`:75`); empty state "No payments yet.
    When you book and pay for care, each payment and its GPS split will appear
    here — ready to export anytime." (`:126`).
  - Classification: **RETAIN AS VISIBLY SIMULATED**. Replace the "My Payments"
    heading with "Simulated Value Receipts" (or equivalent); replace the "When you
    book and pay…" empty state with an honest simulated empty state (no promise
    that booking triggers a payment); keep the persistent "Simulated" label
    (`:75`).

- `src/components/practitioner/PractitionerFinance.jsx`:
  - Simulated banner "Live payouts are coming soon — no real money moves yet."
    (`:87`); payout-method form (`:139-163`) with a **`<option value="wompi">
    Wompi wallet</option>`** (`:146`) and "Simulated — live payouts coming soon"
    (`:139,:163`).
  - Classification: **RETAIN AS VISIBLY SIMULATED**. Remove the Wompi payout
    option (`:146`). The earnings summary must not display invented financial
    data — values must be derived only from real visit data labelled Simulated,
    or the area shows "Coming Soon" with no numbers (gate point 8).

- `src/components/admin/AdminFinance.jsx:95` — "Simulated finance. Payments run
  against the Wompi sandbox and GPS settlement is a shadow ledger — no real money
  moves."
  - Classification: **RETAIN AS VISIBLY SIMULATED** with a wording fix: drop the
    "Wompi sandbox" claim (payments are disabled, not running against a sandbox);
    keep the "Simulated … no real money moves" framing.

- `src/components/admin/AdminSettings.jsx:79` — `<InfoRow label="Payments"
  value="Wompi sandbox (simulated)" tone={C.amber} />`.
  - Classification: **REMOVE FROM BETA UI**. This is a config claim about Wompi.
    Change the value to reflect the booking-only gate, e.g. "Disabled
    (booking-only)".

- `src/components/gps/PaymentModal.jsx` (Correction 2):
  - The GPS demonstration modal. Props default `orgName='Aura Dental'`,
    `planLabel='Dental Restoration'`; `pay()` calls
    `api.simulatePayment({ orgId, amountSats, description: `${orgName} — ${planLabel}` })`
    (`:66`); UI shows a "Treatment plan" label (`:84`), a "Pay {sats}" button
    (`:97`), transient "Signing invoice & computing value split..." (`:106`), and
    "Payment settled — value distributed" (`:120`).
  - Classification: **RETAIN AS VISIBLY SIMULATED**. Keep the GPS demonstration
    but make it persistently and visibly SIMULATED. The call MUST send ONLY
    `orgId` and `amountSats` to `api.simulatePayment` — DROP the `description`
    argument (`:66`); never send `orgName`, `planLabel`, treatment-plan text, or
    any free-form description. Rename the button "Pay" → "Generate simulated
    receipt"; replace "Signing invoice & computing value split..." with
    "Generating demonstration"; remove the "Treatment plan" label and all wording
    implying a real payment or invoice signing. The modal MUST state clearly that
    no real funds move and no payment is collected.

- `src/components/gps/GPSEarnings.jsx` (Correction 2):
  - Earnings view: "Total earned" with "Settled" / "Paid & reconciled" framing
    (`:82-84`), per-booking "Settled" / "Pending" badges, and a "Direct payouts"
    block (`:209-211`); row-level "Simulated" badges exist but there is NO
    page/section-level simulated indicator.
  - Classification: **RETAIN AS VISIBLY SIMULATED** — retain ONLY as a visibly
    simulated preview. Remove all claims that funds are settled, paid, reconciled,
    or continuously withdrawn (drop the "Paid & reconciled" and "Settled" framing).
    "Direct payouts" and any wallet withdrawal MUST be shown visibly as
    "Coming Soon". A "Simulated" status MUST be visible at the PAGE/SECTION level,
    not only on individual rows.

- `src/components/booking/BookingCard.jsx` (Correction 2):
  - Renders the listed price and real booking status, but also a provider
    "· you earn $X" line (`:125`) and patient payment-status pills including
    "✓ Paid" (`PAY_STATUS`, `:38`, `:129-131`).
  - Classification: **RETAIN ACTIVE UNCHANGED** with an allowlisted
    payment-implying edit. Keep the listed price and the real booking status.
    REMOVE the provider "· you earn $X" line (`:125`) and REMOVE the patient
    payment-status pills including "✓ Paid" (`PAY_STATUS`, `:38`, `:129-131`).
    The card MUST NOT imply that Solaris collected or settled any payment.

- **Payment-adjacent UI inventory (Correction 2):** the FULL literal
  payment-adjacent frontend inventory — every runtime file under `src/` matching
  the grep terms
  `wompi|checkout|payment|pay|payout|earnings|earned|settled|settlement|invoice|simulated|simulation|simulatePayment`
  — is preserved verbatim in the review artifact
  (`S1B-R2-PRODUCTION-GATE-REVIEW.txt`). Every candidate in that inventory is
  classified candidate-by-candidate in the behavioral ledger of §3.4.1 — its
  runtime status, the reachability proof, exact `path:line` evidence, exactly ONE
  behavioral classification, and whether a persistent visible Simulated/Coming-Soon
  label already renders on its surface. That behavioral ledger is DISTINCT from the
  §9.2 implementation allowlist: §3.4.1 classifies EVERY candidate (LIVE,
  DEAD/UNMOUNTED, SUPPORT/TEST, or UNVERIFIED), whereas §9.2 lists ONLY the files
  the implementation node is permitted to edit together with their exact tests — so
  a candidate can be classified in §3.4.1 without appearing in §9.2 (e.g. a
  DEAD/UNMOUNTED page, a support/test file, or a live surface already compliant
  because it renders a persistent visible Simulated label). A candidate is marked
  `UNVERIFIED` in the ledger only when its behavior cannot be classified from
  source. The following unchanged
  consumers are named for inventory completeness and require NO edit (their source
  does not contradict the booking-only Beta): `src/components/LucaPassport.jsx`,
  `src/components/provider/MyPractice.jsx`,
  `src/components/booking/MyBookings.jsx`,
  `src/components/provider/ProviderBookings.jsx`. If any other live component is
  later found to contradict the booking-only Beta, its exact path MUST be reported
  and added.

### 3.4.1 Candidate-by-candidate UI behavioral ledger

This ledger classifies EVERY path in the full payment-adjacent candidate inventory
(31 paths). It is the behavioral inventory referenced by §3.4; it is DISTINCT from
the §9.2 implementation allowlist (which lists only the files the future node may
edit). Each entry records seven fields: (1) exact path; (2) runtime status —
`LIVE` | `DEAD/UNMOUNTED` | `SUPPORT/TEST` | `UNVERIFIED`; (3) for LIVE, the direct
importer/mount/consumer proving reachability; (4) exact `path:line` evidence;
(5) exactly ONE behavioral classification from {`LIVE — COMPLIANT VISIBLY
SIMULATED`, `LIVE — MISLEADING, CHANGE REQUIRED`, `LIVE — NON-PAYMENT FALSE
POSITIVE`, `DEAD/UNMOUNTED`, `SUPPORT/TEST`, `UNVERIFIED`}; (6) whether a persistent
visible Simulated/Coming-Soon label renders on the RENDERED surface (re-grepped
from the JSX; a source comment is NOT visible-UI evidence); (7) either the reason
it stays unchanged OR the exact runtime path + exact test path added to §9.2.

The application shell is `src/main.jsx`, which imports and renders
`Assessment` (`:7`), `LucaPassport` (`:8`, the main passport shell), and
`FindPractitioner` (`:9`). `src/components/LucaPassport.jsx` is the shell that
imports and case-renders the passport surfaces below; reachability of a
LucaPassport child is proven by its `import` line plus its case-render line in
`LucaPassport.jsx`.

Count decision: beyond the LIVE payment surfaces ALREADY on the §9.2 allowlist,
exactly **5** additional LIVE files render misleading payment claims with no
persistent visible Simulated/Coming-Soon label (`admin/GPSStats.jsx`,
`contributions/ContributionLedger.jsx`, `gps/GPSLedger.jsx`,
`gps/RegenerativeTreasury.jsx`, `gps/ReferralHub.jsx`). 5 ≤ 5, so they are ABSORBED
into §9.2 (each with an exact runtime path + exact test path and a required
persistent visible Simulated label plus a test asserting the label renders) rather
than deferred to a separate UI-truthfulness node.

**Group A — LIVE, already on the §9.2 allowlist (edits scheduled):**

1. `src/lib/api.js` — LIVE — imported by 16 `src/components/**` modules (e.g.
   `src/components/booking/BookingFlow.jsx:122` `api.createCheckout`) — evidence
   `src/lib/api.js:459-460` (`createCheckout` → `POST /payments/checkout`, Wompi
   hosted checkout) — **LIVE — MISLEADING, CHANGE REQUIRED** — visible Simulated
   label on rendered surface: N/A (support library, no rendered surface) — on §9.2:
   runtime `src/lib/api.js` (remove `createCheckout` entirely); the consuming UI is
   covered by `BookingFlow.jsx` + its AT-8 test.
2. `src/components/booking/BookingFlow.jsx` — LIVE — imported+rendered by
   `src/components/marketplace/ProviderDetailModal.jsx:20,:362`, which is
   imported+rendered by `src/components/marketplace/ExploreMarketplace.jsx:18,:351`
   (mounted in the passport shell) — evidence `:118` `payNow`, `:122`
   `api.createCheckout(...)`, `:128` `window.open(r.checkoutUrl,...)`, `:288` live
   "Pay" button — **LIVE — MISLEADING, CHANGE REQUIRED** — visible Simulated label:
   NO (0 `simulat` occurrences) — on §9.2: runtime
   `src/components/booking/BookingFlow.jsx`; test
   `src/components/booking/BookingFlow.test.jsx` (AT-8).
3. `src/components/gps/PaymentModal.jsx` — LIVE — `LucaPassport.jsx:55` (rendered
   as the payment modal) — evidence `:66` sends `description` to
   `api.simulatePayment`; invoice/"Pay" wording — **LIVE — MISLEADING, CHANGE
   REQUIRED** — visible Simulated label: PARTIAL (5 `simulat` occurrences; wording
   still implies a real invoice/payment) — on §9.2: runtime
   `src/components/gps/PaymentModal.jsx`; test
   `src/components/gps/PaymentModal.test.jsx`.
4. `src/components/gps/GPSEarnings.jsx` — LIVE — `src/components/provider/MyPractice.jsx:21,:81`
   — evidence `:82-84` "Total earned"/"Paid & reconciled"/"Settled", `:209-211`
   "Direct payouts" — **LIVE — MISLEADING, CHANGE REQUIRED** — visible Simulated
   label: PARTIAL (row-level only; 7 `simulat` occurrences; NO page/section-level
   label) — on §9.2: runtime `src/components/gps/GPSEarnings.jsx`; test
   `src/components/gps/GPSEarnings.test.jsx`.
5. `src/components/booking/BookingCard.jsx` — LIVE — `src/components/provider/ProviderBookings.jsx:18,:129`
   and `src/components/booking/MyBookings.jsx:17` — evidence `:125` provider "· you
   earn $X", `:38,:129-131` "✓ Paid" `PAY_STATUS` pills — **LIVE — MISLEADING,
   CHANGE REQUIRED** — visible Simulated label: NO (0 `simulat`) — on §9.2: runtime
   `src/components/booking/BookingCard.jsx`; test
   `src/components/booking/BookingCard.test.jsx`.
6. `src/components/gps/MemberPayments.jsx` — LIVE — `LucaPassport.jsx:45` — evidence
   payment-history heading/labels (3 `simulat` occurrences, not page-level) —
   **LIVE — MISLEADING, CHANGE REQUIRED** — visible Simulated label: PARTIAL — on
   §9.2: runtime `src/components/gps/MemberPayments.jsx` (rename to "Simulated Value
   Receipts"; honest simulated empty state); covered without a new dedicated test
   file per §9.2.
7. `src/components/practitioner/PractitionerFinance.jsx` — LIVE — `LucaPassport.jsx:52`
   — evidence Wompi wallet option + earnings (13 `simulat` occurrences) — **LIVE —
   MISLEADING, CHANGE REQUIRED** — visible Simulated label: PARTIAL (remove Wompi
   wallet; earnings must be labelled Simulated/"Coming Soon") — on §9.2: runtime
   `src/components/practitioner/PractitionerFinance.jsx`.
8. `src/components/admin/AdminSettings.jsx` — LIVE — `LucaPassport.jsx:50` —
   evidence Payments row value "Wompi sandbox" (2 `simulat` occurrences) — **LIVE —
   MISLEADING, CHANGE REQUIRED** — visible Simulated label: NO for the Wompi row —
   on §9.2: runtime `src/components/admin/AdminSettings.jsx`.
9. `src/components/admin/AdminFinance.jsx` — LIVE — `LucaPassport.jsx:49` — evidence
   "Wompi sandbox" wording (3 `simulat` occurrences) — **LIVE — MISLEADING, CHANGE
   REQUIRED** — visible Simulated label: PARTIAL (keep "Simulated" framing, drop
   "Wompi sandbox") — on §9.2: runtime `src/components/admin/AdminFinance.jsx`.

**Group B — LIVE, MISLEADING, CHANGE REQUIRED — 5 files ABSORBED into §9.2 by this
amendment (each with an exact runtime + test path; each requires a persistent
visible Simulated/Coming-Soon label and a test asserting the label renders):**

10. `src/components/admin/GPSStats.jsx` — LIVE — `LucaPassport.jsx:48` (case-render
    `:5187` `gps-economy`, `:5221`) — evidence `:6` "live feed of recent GPS
    settlements", `:124` "No contributor earnings yet…", `:140` "Recent
    settlements", `:142` "No GPS settlements yet. Completed bookings will appear
    here." — **LIVE — MISLEADING, CHANGE REQUIRED** — visible Simulated label: NO
    (0 `simulat` occurrences) — on §9.2: runtime `src/components/admin/GPSStats.jsx`;
    test `src/components/admin/GPSStats.test.jsx`.
11. `src/components/contributions/ContributionLedger.jsx` — LIVE — `LucaPassport.jsx:59`
    (case-render `:5169` `contributions`) — evidence `:96` "envelope (up to 10% of
    every payment) rewards when it routes value back to builders." — **LIVE —
    MISLEADING, CHANGE REQUIRED** — visible Simulated label: NO (0 `simulat`) — on
    §9.2: runtime `src/components/contributions/ContributionLedger.jsx`; test
    `src/components/contributions/ContributionLedger.test.jsx`.
12. `src/components/gps/GPSLedger.jsx` — LIVE — `LucaPassport.jsx:42` (case-render
    `:3926` `ledger`) — evidence `:60` "90% of every payment goes to your
    practitioner, always…", `:74` "LOVE earned", `:101,:170-171` real
    "Settled"/"Pending" transaction statuses — **LIVE — MISLEADING, CHANGE
    REQUIRED** — visible Simulated label: NO (0 `simulat`) — on §9.2: runtime
    `src/components/gps/GPSLedger.jsx`; test `src/components/gps/GPSLedger.test.jsx`.
13. `src/components/gps/RegenerativeTreasury.jsx` — LIVE — `LucaPassport.jsx:47`
    (case-render `:4946`, `:5186` `treasury`) — evidence `:63` "grows with every
    booking. 2.5% of each transaction is planted here", `:115` "90% of every
    payment… The Regenerative Treasury (2.5% of each payment)… Every transaction
    plants a seed." (`:143` "Coming soon" applies ONLY to governance voting, not to
    the payment claims) — **LIVE — MISLEADING, CHANGE REQUIRED** — visible Simulated
    label: NO (0 `simulat`) — on §9.2: runtime
    `src/components/gps/RegenerativeTreasury.jsx`; test
    `src/components/gps/RegenerativeTreasury.test.jsx`.
14. `src/components/gps/ReferralHub.jsx` — LIVE — `LucaPassport.jsx:46` (case-render
    `:3927` `referrals`) — evidence `:66` "Earn 1% of any booking from someone you
    refer", `:88` "Rewards earned", `:89` "Total earned" (real money values), `:97`
    "You earn 1% every time they book care." — **LIVE — MISLEADING, CHANGE
    REQUIRED** — visible Simulated label: NO (0 `simulat`) — on §9.2: runtime
    `src/components/gps/ReferralHub.jsx`; test
    `src/components/gps/ReferralHub.test.jsx`.

**Group C — LIVE, COMPLIANT VISIBLY SIMULATED (persistent visible label already
renders; no edit required):**

15. `src/components/clinic/AuraAdmin.jsx` — LIVE — `LucaPassport.jsx:60`
    (case-render `:5171` `aura-admin`) — evidence `:71` "Payments (simulated)",
    `:72` treasury "(simulated)", `:153` "Community commons balance (simulated)" —
    **LIVE — COMPLIANT VISIBLY SIMULATED** — visible Simulated label: YES — no edit
    (source does not contradict booking-only Beta).
16. `src/components/gps/PaymentReceipts.jsx` — LIVE — `LucaPassport.jsx:44`
    (case-render `:4934`) — evidence `:84` "Simulated — no funds have moved. This
    shows how Solaris will route value when live.", `:114` "All figures are
    simulated in this pilot." — **LIVE — COMPLIANT VISIBLY SIMULATED** — visible
    Simulated label: YES — no edit.
17. `src/components/passport/WalletCard.jsx` — LIVE — `LucaPassport.jsx:57`
    (case-render `:4492`) — evidence `:51` "All values simulated", `:56` "sats
    (simulated)", `:72` "No simulated transactions yet." — **LIVE — COMPLIANT
    VISIBLY SIMULATED** — visible Simulated label: YES — no edit.
18. `src/components/wallet/HealthNFT.jsx` — LIVE — `LucaPassport.jsx:34`
    (case-render `:3907`) — evidence `:90` "simulated for demonstration; on-chain
    contract integration … is on the roadmap", `:164` "This is a simulated transfer
    for the demo." — **LIVE — COMPLIANT VISIBLY SIMULATED** — visible Simulated
    label: YES — no edit (no-tokens rule; do not expand scope).
19. `src/components/practitioner/PractitionerSettings.jsx` — LIVE — `LucaPassport.jsx:53`
    (case-render `:5203` `prac-settings`) — evidence `:149` "Payout methods and
    simulated earnings live in the Finance tab. Live payouts are coming soon." —
    **LIVE — COMPLIANT VISIBLY SIMULATED** — visible Simulated/Coming-Soon label:
    YES — no edit.
20. `src/components/gps/GPSMapView.jsx` — LIVE — `LucaPassport.jsx:54` (case-render
    `:5168` `gps-map`) — evidence `:129` "Percent reclaimed for this community
    (simulated)" — **LIVE — COMPLIANT VISIBLY SIMULATED** — visible Simulated label:
    YES (non-payment community map) — no edit.
21. `src/components/gps/GpsExplainer.jsx` — LIVE — `LucaPassport.jsx:43`
    (case-render `:4928`) — evidence 10 `simulat` occurrences incl. explanatory
    "clearly labeled simulated" copy; numbers sourced from `src/lib/gps-policy.js`
    config seam — **LIVE — COMPLIANT VISIBLY SIMULATED** — visible Simulated label:
    YES — no edit.

**Group D — LIVE, NON-PAYMENT FALSE POSITIVE / unchanged consumer (grep matched
navigation/routing or non-payment copy; no standalone misleading payment claim; no
edit required):**

22. `src/flows/Assessment.jsx` — LIVE — `src/main.jsx:7` — evidence: grep for
    `payment|pay|checkout|settle` returns NOTHING in this file — **LIVE —
    NON-PAYMENT FALSE POSITIVE** — visible Simulated label: N/A (no payment
    surface) — no edit.
23. `src/components/LucaPassport.jsx` — LIVE — `src/main.jsx:8` (the passport shell)
    — evidence: its own matches are navigation/routing labels and case dispatch;
    every payment surface it renders is an independently-classified child above —
    **LIVE — NON-PAYMENT FALSE POSITIVE** (container/router) — visible Simulated
    label: N/A — no edit (named unchanged consumer in §3.4).
24. `src/components/provider/MyPractice.jsx` — LIVE — reachable via the passport
    provider surface; imports+renders `GPSEarnings` (`:21,:81`) — evidence: no
    standalone payment claim of its own (delegates to the classified child) — **LIVE
    — NON-PAYMENT FALSE POSITIVE** (consumer) — visible Simulated label: N/A — no
    edit (named unchanged consumer in §3.4).
25. `src/components/provider/ProviderBookings.jsx` — LIVE — imports+renders
    `BookingCard` (`:18,:129`) — evidence: no standalone payment claim of its own
    (delegates to the classified child) — **LIVE — NON-PAYMENT FALSE POSITIVE**
    (consumer) — visible Simulated label: N/A — no edit (named unchanged consumer in
    §3.4).

**Group E — SUPPORT/LIB or SUPPORT/TEST (no rendered surface; no edit required):**

26. `src/lib/gps-policy.js` — SUPPORT/LIB — the protocol config seam imported by
    `src/components/gps/GpsExplainer.jsx:24`, `src/components/LucaPassport.jsx:28`,
    and `src/__tests__/GpsExplainer.test.jsx:16` — evidence: exports
    `STATIC_GPS_POLICY`, `splitAmount`, etc.; no rendered strings — **SUPPORT/TEST**
    (library) — visible Simulated label: N/A — no edit.
27. `src/__tests__/GpsExplainer.test.jsx` — SUPPORT/TEST — a Vitest test module (not
    a runtime entrypoint) — evidence `:16` imports from `src/lib/gps-policy.js` —
    **SUPPORT/TEST** — visible Simulated label: N/A — no edit.

**Group F — DEAD/UNMOUNTED (zero importers; not reachable at runtime; no edit
required):**

28. `src/pages/Admin.jsx` — DEAD/UNMOUNTED — evidence: grep for `pages/Admin`
    across `src/` returns no importer — **DEAD/UNMOUNTED** — visible Simulated
    label: N/A (never rendered) — no edit.
29. `src/pages/Explore.jsx` — DEAD/UNMOUNTED — evidence: grep for `pages/Explore`
    returns no importer — **DEAD/UNMOUNTED** — visible Simulated label: N/A — no
    edit.
30. `src/pages/Practitioner.jsx` — DEAD/UNMOUNTED — evidence: grep for
    `pages/Practitioner` returns no importer — **DEAD/UNMOUNTED** — visible
    Simulated label: N/A — no edit.
31. `src/pages/Profile.jsx` — DEAD/UNMOUNTED — evidence: grep for `pages/Profile`
    returns no importer — **DEAD/UNMOUNTED** — visible Simulated label: N/A — no
    edit.

The passport shell reaches `ExploreMarketplace`, `AdminFinance`, `AdminSystemPage`,
and `AdminSettings` through `LucaPassport.jsx` (component imports), NOT through the
`src/pages/*` files — which is why the four `src/pages/*` files above are
DEAD/UNMOUNTED even though similarly-named live surfaces exist.

### 3.5 Tests

- `backend/tests/payments.test.js` (243 lines, **exactly 7 `test(...)` blocks**:
  `:58`, `:71`, `:92`, `:161`, `:173`, `:219`, `:232`). Sets
  `PAYMENT_PROVIDER='mock'` (`:27`) and `WOMPI_EVENTS_SECRET='test_events_secret'`
  (`:28`). Covers: allocation policy invariants (`:58`), checkout idempotency
  (`:71`), webhook confirms once + rejects bad signature via
  `MockPaymentAdapter.buildSignedEvent` (`:100-101,:207-208`), `GET gps/receipts`
  SIMULATED with `settled_cents===0` (`:158`), booking checkout derives price +
  confirms (`:173`), checkout rejects non-owner booking (`:219`), and **shadow
  receipt serializes into the vault export** `payments/gps-receipts.jsonl`
  (`:232-239`).
  - Classification: **DISABLE FOR BETA** at the intent level — this file MUST be
    **rewritten** (gate point 11) while **preserving EXACTLY SEVEN backend
    tests** so the accepted backend arithmetic does not drift (§10). The rewrite:
    checkout and webhook assert the typed disabled response (AT-3/AT-4); the
    booking-confirms-without-payment path is asserted directly (AT-5); the
    allocation-policy unit test is retained (AT-6); the vault-export and
    GPS-receipt assertions use an explicitly simulated fixture (a
    directly-inserted simulated intent/receipt), NOT a Wompi webhook (AT-7). Do
    NOT delete or `.skip` tests to go green.

- `backend/tests/schema-recovery.test.js` — **exactly 3 `test(...)` blocks**
  (`:89`, `:95`, `:106`) verifying core-journey tables + migration-referenced
  tables + receipt columns exist. Used as the schema-recovery baseline (§10).
  - Classification: **RETAIN ACTIVE UNCHANGED**.

- `backend/tests/export.test.js`, `gps-allocations.test.js`, `gps-policy.test.js`
  — related vault/GPS tests.
  - Classification: **RETAIN AS VISIBLY SIMULATED** (adjust only if they depend
    on a webhook-driven fixture; prefer simulated fixtures).

- `backend/tests/mailer.test.js` — delivery-adapter PHI boundary (`:49-78`);
  **exactly 8 `test(...)` blocks**. AT-11 EXTENDS one existing block (no new
  block), so the count stays 8 and the backend total stays 198.
  - Classification: **RETAIN ACTIVE UNCHANGED** (extended, not weakened, by the
    new booking-emails PHI assertions AT-11).

- **S1A security regression floor** (per `docs/beta-v1/WORKFLOW.md`): every node
  keeps `backend/tests/auth.test.js`, `backend/tests/agent-authority.test.js`,
  and `backend/tests/luca.test.js` green — **exactly 43/43 pass, Jest exit 0**.
  This node adds no exception.

### 3.6 Environment

- `grep` for `ONLINE_PAYMENTS` / `release-gate` across `backend/src` returns
  nothing — the flag and the shared gate module **do not yet exist** and must be
  introduced by the implementation node.
- `backend/.env.example` contains no Wompi/payment lines (only
  `LUCA_AI_PROVIDER=` at `:21`); root `.env.example` likewise has none. The
  implementation node MUST add `ONLINE_PAYMENTS_ENABLED=false` to
  `backend/.env.example` with a comment that online payments are **hard-disabled**
  in Beta and that enabling them in a future release requires a new L2 contract
  and explicit Majd authorization — **not a configuration change alone** (§15).

---

## 4. Desired behavior

1. A single shared release gate `backend/src/lib/release-gate.js` exports
   `onlinePaymentsEnabled()`. Both the adapter factory and the payment routes
   consume it — no duplicated gate logic. In Beta it returns `false`
   (hard-disabled constant); `ONLINE_PAYMENTS_ENABLED` defaults false and
   false/missing/malformed/unknown values remain disabled.
2. `getPaymentProvider` returns `MockPaymentAdapter` in Beta unconditionally,
   because `onlinePaymentsEnabled()` is false. The `WompiAdapter` branch is
   code-unreachable regardless of `PAYMENT_PROVIDER` or `WOMPI_*` credentials —
   **even when `ONLINE_PAYMENTS_ENABLED=true`** in this release (gate point 3).
3. `POST /api/payments/checkout` and `POST /api/payments/webhook` short-circuit
   to a typed disabled response (§5) before any provider call or DB write, gated
   by the same `onlinePaymentsEnabled()`.
4. The member booking flow (`BookingFlow.jsx`) requests a booking and shows the
   confirmation/requested state with no pay button, no `window.open`, no
   payment-pending badge, no promised allocation percentages, no promised LOVE
   rewards, and no Wompi copy; the price shows only as "Listed price".
5. Simulated GPS receipt/allocation surfaces remain, each carrying a persistent,
   visible "Simulated" label; a simulated payment never mutates real booking,
   appointment, or treatment-plan status.
6. Practitioner/admin financial surfaces are labelled Simulated or "Coming Soon"
   and never show invented numbers; no Wompi wallet option or sandbox claim.
7. Dormant Wompi code paths never receive PHI or secret material; no third-party
   email payload carries PHI (§6.2).

---

## 5. Typed API responses

When `onlinePaymentsEnabled()` is false (the Beta default), the disabled
entrypoints MUST return this exact shape and MUST NOT touch the provider or the
database first:

```json
{
  "error": "Online payments are disabled for this release.",
  "code": "ONLINE_PAYMENTS_DISABLED",
  "enabled": false
}
```

- `POST /api/payments/checkout` → HTTP **403** with the body above. No
  `payment_intents` INSERT, no `bookings.payment_status` UPDATE, no
  `provider.createCheckout` call.
- `POST /api/payments/webhook` → HTTP **200** with the body above (200 so no
  external retrier is provoked, consistent with the existing always-200 webhook
  convention at `payments.js:263-266`). No `provider.verifyWebhook` call, no
  `payment_events` INSERT, no `confirmPaidIntent` (AT-4A). **When the five S1B
  files are present (Phase C composite), the global S1B secret-boundary
  middleware runs first** (§6.2, AT-4B): a secret-shaped body is rejected with
  `400 SECRET_MATERIAL_REJECTED` before this handler executes. The clean Phase B
  R2 workspace does not contain that middleware, so its seven-test
  `payments.test.js` asserts only the AT-4A disabled `200`.
- The typed code `ONLINE_PAYMENTS_DISABLED` is stable and asserted by tests,
  including the complete body (`error`, `code`, `enabled`).
- The disabled response carries no PHI, no booking notes, and no secret material
  (it is a static object).

Unchanged real endpoints keep their existing contracts: `POST
/api/bookings/request` → `201 { booking, reference, autoConfirmed }`
(`bookings.js:237`); `GET /api/payments/intents` and `/api/payments/simulate`
keep `simulated:true` in every row.

The rewritten `payments.test.js` preserves **exactly seven** backend tests (§3.5,
§7, §10).

---

## 6. Actor / data classification, PHI and secret-boundary analysis

### 6.1 Actors and data

- **Member (patient):** requests a booking; sees confirmation + Simulated GPS
  receipts. Never sees a pay button or Wompi surface.
- **Practitioner:** sees Simulated earnings / "Coming Soon" payouts; no Wompi
  wallet option.
- **Admin:** sees Simulated reconciliation (read-only); no live-rail claims.
- **Provider webhook (Wompi):** in Beta, cannot reach live logic — the webhook
  entrypoint is disabled and returns the typed response (after the S1B boundary).
- **Data classes:** booking notes / "reason for visit" (`BookingFlow.jsx:217-219`;
  persisted as `booking.patient_notes` and passed to the mailer at
  `bookings.js:221`) are **PHI by provenance**; payment intents/allocations are
  financial-simulation data; `WOMPI_*` values are **secret material**.

### 6.2 PHI and secret-boundary analysis (gate point 10)

- The dormant Wompi adapter must NEVER receive PHI. Today `createCheckout` is
  called with `description` and `metadata.customerEmail` only
  (`payments.js:117-124`); booking notes/symptoms are NOT passed. The
  implementation node MUST preserve this: even in a future release, no PHI
  (notes, symptoms, health context) may cross into `WompiAdapter` — only the
  minimal non-PHI checkout fields.
- **Third-party email payloads must be PHI-free.** `booking-emails.js` templates
  currently embed patient identity, service, date/time, address, and free-text
  notes (§3.2.1) and persist them to `email_notifications`. The implementation
  node MUST collapse ALL SIX templates to the single neutral subject/body in
  §3.2.1 (subject `Secure notification`; body
  `You have a new secure notification. Sign in to Solaris to view it.`), pass no
  `vars` object at all — the `vars` argument is dropped entirely from every
  `sendBookingEmail` caller in BOTH `bookings.js` and `provider/bookings.js` — and
  persist `template='secure_notification'`; detailed booking info stays inside
  authenticated Solaris only.
- Secret material (`WOMPI_*`) stays in env only, read at the edge
  (`WompiAdapter.js:28-34`); never logged, never returned in a response, never
  placed in the vault export.
- **Secret-boundary precedence.** The global S1B middleware
  (`backend/src/middleware/secret-boundary.js`, mounted in
  `backend/src/server.js`) runs BEFORE the payment routes. A secret-looking
  inbound body is rejected with typed `400 SECRET_MATERIAL_REJECTED` and never
  persisted. The disabled-payments handler MUST NOT weaken or bypass that
  boundary; the disabled `200` applies only to non-secret-shaped bodies
  (AT-4A). The secret-material rejection boundary (AT-4B) is exercised only in
  the Phase C composite workspace, where the five preserved S1B files are
  present; it is not asserted against the clean R2 workspace.
- De-identify before any cloud model; no AI surface is added here.

---

## 7. Acceptance tests (GIVEN / WHEN / THEN)

All backend tests run under Jest against a deterministic, isolated PostgreSQL
(§8). Every test below must be expressed in `backend/tests/payments.test.js`
(rewritten, preserving exactly seven test blocks) or an adjacent test file;
none may be `.skip`-ed to pass. Specifically: AT-4A lives in
`backend/tests/payments.test.js` (the clean-R2 non-secret disabled-200 case);
AT-4B lives in the Phase C composite suite (the secret-material rejection case),
not in the clean-R2 `payments.test.js`; AT-10 asserts the simulated-payment
behavior in `backend/tests/payments.test.js`; AT-11 EXTENDS an existing test
block in `backend/tests/mailer.test.js` (it does not add a block, so the backend
total remains exactly 198). The frontend component test (AT-8) is a new Vitest +
Testing Library file at `src/components/booking/BookingFlow.test.jsx`.

**AT-1 — Flag defaults off.**
GIVEN no `ONLINE_PAYMENTS_ENABLED` in the environment,
WHEN `getPaymentProvider()` is resolved (after `_resetProviderCache()`),
THEN it returns a `MockPaymentAdapter` instance (never `WompiAdapter`), because
`onlinePaymentsEnabled()` is false.

**AT-2 — Credentials cannot activate Wompi.**
GIVEN `WOMPI_PUBLIC_KEY` and `WOMPI_EVENTS_SECRET` are set AND
`PAYMENT_PROVIDER='wompi'` AND `ONLINE_PAYMENTS_ENABLED` is unset/false,
WHEN `getPaymentProvider()` is resolved,
THEN it returns `MockPaymentAdapter` (gate point 2).

**AT-2b — Hard-disabled even with the flag on (gate point 3).**
GIVEN `ONLINE_PAYMENTS_ENABLED='true'` AND `PAYMENT_PROVIDER='wompi'` AND
complete `WOMPI_*` credentials,
WHEN `getPaymentProvider()` is resolved AND `POST /api/payments/checkout` is
called,
THEN `getPaymentProvider()` STILL returns `MockPaymentAdapter` AND checkout STILL
returns the typed disabled `403` — the Wompi path is code-unreachable in Beta.
Also assert malformed values (`'yes'`, `'1'`, `' TRUE '`, `''`) all resolve
disabled.

**AT-3 — Checkout disabled, fail-closed, no side effects.**
GIVEN the gate is false and an authenticated member with a valid booking,
WHEN `POST /api/payments/checkout` is called with a non-secret body,
THEN the response is `403` with the COMPLETE body
`{"error":"Online payments are disabled for this release.","code":"ONLINE_PAYMENTS_DISABLED","enabled":false}`,
AND no `payment_intents` row is inserted, AND `bookings.payment_status` is
unchanged, AND no provider method was invoked.

**AT-4A — Webhook disabled in the clean R2 workspace (Phase B).**
GIVEN the gate is false AND the clean Phase B R2 workspace (which does NOT
contain the five uncommitted S1B files, so the global secret boundary is not
present),
WHEN `POST /api/payments/webhook` is called with a **non-secret** body (valid or
invalid signature),
THEN the response is `200` with the COMPLETE body
`{"error":"Online payments are disabled for this release.","code":"ONLINE_PAYMENTS_DISABLED","enabled":false}`,
AND no provider method (`verifyWebhook`) is called, AND no database write occurs,
AND no `payment_events` row is inserted, AND `confirmPaidIntent` is not invoked.
This is one of the seven clean `payments.test.js` tests and MUST NOT assert the
Phase C secret-boundary `400`.

**AT-4B — Secret-boundary precedence in the composite workspace (Phase C).**
GIVEN the preserved five S1B files ARE present (the global S1B secret-boundary
middleware is mounted),
WHEN `POST /api/payments/webhook` is called with a **secret-shaped** body,
THEN the S1B middleware returns `400 SECRET_MATERIAL_REJECTED` FIRST, the
disabled payment handler never runs, and no provider call or database write
occurs. This composite expectation is exercised ONLY in Phase C (§15) and is NOT
added to the clean R2 seven-test `payments.test.js`.

**AT-5 — Booking completes without payment.**
GIVEN an authenticated member and a bookable service,
WHEN `POST /api/bookings/request` is called,
THEN the response is `201 { booking, reference, autoConfirmed }` and the booking
reaches `pending` or `confirmed` per `auto_confirm_bookings`, with no checkout
created and no `payment_intents` row (gate points 5,6).

**AT-6 — Allocation policy unit test retained.**
GIVEN `computeAllocations(eligibleCents)`,
WHEN invoked,
THEN the four-bucket / envelope ≤ 10% / exact-sum / no-referral-leg invariants
hold (preserving `payments.test.js:58`).

**AT-7 — Simulated GPS receipt serializes into the vault export (simulated
fixture).**
GIVEN a directly-inserted **simulated** payment intent + SIMULATED allocations
(NOT produced by a Wompi webhook),
WHEN `buildVaultExport(record)` runs,
THEN `payments/gps-receipts.jsonl` is present and every receipt line has
`status==='SIMULATED'` and `settled_cents===0` (gate points 9,12).

**AT-8 — Booking UI has no payment surface (real component test).**
GIVEN the Beta build,
WHEN `BookingFlow.jsx` is rendered through the checkout/confirmation steps under
Vitest + Testing Library,
THEN there is no "Pay to confirm" button, no `window.open` call, no
payment-pending badge, no "How your payment flows" block, no promised allocation
percentages, and no promised LOVE rewards; the "Listed price" and the exact copy
"Solaris does not collect online payment in this release. Any payment
arrangements happen separately with the practitioner." are present. The §10 repo
grep guard is **supplementary**, not a substitute for this component test.

**AT-9 — Security regression floor.**
GIVEN the S1A floor,
WHEN `auth.test.js`, `agent-authority.test.js`, `luca.test.js` run,
THEN all pass unchanged.

**AT-10 — Simulation does not mutate real status or store free-text PHI
(Correction 2).**
GIVEN a booking, an appointment, and a treatment plan with known
status/payment_status columns, snapshotted before the call,
WHEN `POST /api/payments/simulate` is called with a body that ALSO carries a
legacy free-text `description` containing PHI tokens AND a valid
`treatmentPlanId`,
THEN afterward EVERY real booking/appointment/treatment-plan status column is
byte-identical to the pre-call snapshot (zero mutations); the stored payment
description equals EXACTLY `Simulated GPS demonstration`; the `POST /simulate`
response and every `GET /mine` row expose that fixed description; and NONE of the
submitted PHI tokens is stored, logged, or returned. Only explicitly-simulated
wallet balances and receipts change, and they remain labelled simulated.
AND (atomicity, Correction 3) GIVEN the same endpoint with a DETERMINISTIC
failure injected after at least ONE write has been issued on the transaction
client but BEFORE the write set completes, WHEN `POST /api/payments/simulate` is
called, THEN after the forced `ROLLBACK` there are ZERO new `payments` rows, ZERO
new receipt rows, ZERO new payment-receipt links, and ZERO change to any
simulated wallet balance (every affected count/balance is byte-identical to the
pre-call snapshot); the transaction client is released; and no real
booking/appointment/treatment-plan row is touched.

**AT-11 — Booking emails are fully neutral and PHI-free (Correction 1).**
GIVEN a booking whose patient name, service, date, time, address, and notes are
known PHI tokens,
WHEN each of the six templates (`booking_request`, `booking_confirmed`,
`booking_declined`, `booking_cancelled`, `booking_reminder`,
`booking_completed`) is built and persisted,
THEN for EVERY template: the rendered subject equals exactly
`Secure notification`; the rendered body equals exactly
`You have a new secure notification. Sign in to Solaris to view it.`; the subject
and body contain NONE of the PHI tokens and none of the appointment-context words
listed in §3.2.1;
the persisted `email_notifications` row has `template === 'secure_notification'`
and its persisted subject/body equal the exact neutral strings; and the spied
`console` methods are NEVER called with the recipient email, template/event
name, subject, body, or any PHI token.
AND the test covers EVERY route caller of `sendBookingEmail` across BOTH
`backend/src/routes/bookings.js` (call sites `:219`, `:231`, `:347`) and
`backend/src/routes/provider/bookings.js` (call sites `:144`, `:161`, `:174`),
asserting each still fires and each produces only the neutral subject/body/
template.
AND it includes a NEGATIVE CALLER ASSERTION proving that NO `sendBookingEmail`
invocation supplies a `vars` argument after implementation — i.e. every call site
in both files invokes `sendBookingEmail` with the `vars` argument removed
entirely (arity/argument check, not merely a PHI-free object).
This test EXTENDS one existing `backend/tests/mailer.test.js` test block (it does
NOT add a new `test(...)` block), so the backend total remains EXACTLY 198.

---

## 8. Deterministic, isolated PostgreSQL requirements

The implementation node's tests MUST run against a throwaway PostgreSQL that is
byte-reproducible and never shared:

1. **Isolation:** a dedicated ephemeral database/schema per test run (e.g. a
   disposable container or a uniquely-named schema), torn down afterward. Never
   the shared `default` database and never a developer's local data.
2. **Deterministic bootstrap — exact schema ordering.** EXACTLY 35 numbered
   migration files exist: `001`–`005` and `007`–`036` are present; `006` is
   absent (there is no gap to fill — the sequence legitimately skips it). After a
   successful `npm run migrate`, the `pgmigrations` table MUST contain EXACTLY 35
   rows. These numbered migrations assume a base schema created by the split
   `schema*.sql` files. A bare database with only the numbered migrations fails at
   migration 001 with `relation "luca_messages" does not exist`. Therefore the
   test bootstrap MUST apply the base `schema*.sql` files first, in EXACTLY this
   numbered order, each BEFORE `npm run migrate`:
   1. `schema.sql`
   2. `schema_marketplace.sql`
   3. `schema_messaging.sql`
   4. `schema_notifications.sql`
   5. `schema_solaris.sql` (creates `luca_messages`)
   6. `schema_sprint.sql`
   7. `schema_wallet.sql`
   8. `schema_bookings.sql`
   9. `schema_gps.sql`

   Each base file MUST be applied with `psql -v ON_ERROR_STOP=1`, with its own
   captured exit code checked before proceeding, and ALL nine MUST complete before
   `npm run migrate` runs. Any non-zero exit from a base file or a final
   `pgmigrations` row count other than 35 is a STOP condition (§11).
3. **Fixtures are simulated:** payment intents, allocations, and GPS receipts
   used by tests are inserted directly and marked SIMULATED; no test invokes a
   live or sandbox Wompi endpoint, and no test opens a network socket to Wompi.
4. **Determinism:** fixed seeds/ids where randomness would otherwise leak into
   assertions; time-dependent assertions run under `TZ=UTC` (§10) and use
   injected clocks or tolerate NOW().
5. **No new database or table** is created by this node's schema (gate point 13);
   tests reuse existing tables (`payment_intents`, `allocations`, `bookings`,
   `payments`, `payment_events`, `treatment_plans`, `email_notifications`) only.

---

## 9. Exact expected path status and implementation allowlist

### 9.1 Fresh-workspace state for THIS contract node

This node writes exactly one new untracked file. Expected porcelain in the
contract workspace:

```
?? docs/contracts/S1B-R2-booking-only-gate.md
```

Nothing staged, nothing committed, nothing pushed. HEAD stays at
`bff148d4031930899431e2dc0225148519cfa60e`.

### 9.2 Implementation allowlist (for the FUTURE node — declared AFTER the inventory)

The future implementation node is permitted to touch ONLY these paths, each with
the classification established in §3:

| Path | Action | Classification |
| --- | --- | --- |
| `backend/src/lib/release-gate.js` (new) | single source of truth; `onlinePaymentsEnabled()` returns false in Beta | RETAIN DORMANT BEHIND FLAG |
| `backend/src/adapters/index.js` | route the Wompi branch through `onlinePaymentsEnabled()` (false ⇒ branch code-unreachable) | RETAIN DORMANT BEHIND FLAG |
| `backend/src/routes/payments.js` | checkout + webhook return typed disabled response before any provider call / DB write, gated by `onlinePaymentsEnabled()` | DISABLE FOR BETA |
| `backend/src/routes/payments-sim.js` | accept ONLY `orgId` + `amountSats`; remove `description` AND `treatmentPlanId` from docstring + destructuring; ignore any legacy supplied values; store + return the fixed string `Simulated GPS demonstration`; wrap payment + receipt + payment-receipt link + simulated wallet credit in ONE `db.pool` client transaction (BEGIN/COMMIT-all-or-ROLLBACK, `release()` in `finally`); never mutate a booking/appointment/treatment plan; keep simulated surface labelled | RETAIN AS VISIBLY SIMULATED |
| `backend/src/routes/bookings.js` | drop the `vars` argument entirely from every `sendBookingEmail` caller (booking logic unchanged) | RETAIN ACTIVE UNCHANGED |
| `backend/src/routes/provider/bookings.js` | drop the `vars` argument entirely from every `sendBookingEmail` caller (`:144`, `:161`, `:174`); booking logic unchanged | RETAIN ACTIVE UNCHANGED |
| `backend/src/lib/booking-emails.js` | replace all six PHI-laden templates with the single neutral `secure_notification` payload (exact subject/body per §3.2.1); persisted `template` = `secure_notification` | RETAIN ACTIVE UNCHANGED |
| `backend/tests/payments.test.js` | rewrite to booking-only + simulated fixtures; preserve exactly 7 test blocks | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `backend/.env.example` | add `ONLINE_PAYMENTS_ENABLED=false` with hard-disabled comment | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/lib/api.js` | remove `createCheckout` entirely | REMOVE FROM BETA UI |
| `src/components/booking/BookingFlow.jsx` | remove payment imports/state/`payNow`/pay block/embedded ValueFlowViz + promised %/LOVE; "Listed price" + exact no-online copy | REMOVE FROM BETA UI |
| `src/components/gps/MemberPayments.jsx` | rename heading to "Simulated Value Receipts"; honest simulated empty state; keep Simulated label | RETAIN AS VISIBLY SIMULATED |
| `src/components/practitioner/PractitionerFinance.jsx` | remove Wompi wallet option; earnings labelled Simulated/"Coming Soon" | RETAIN AS VISIBLY SIMULATED |
| `src/components/admin/AdminSettings.jsx` | change Payments row value away from "Wompi sandbox" | REMOVE FROM BETA UI |
| `src/components/admin/AdminFinance.jsx` | drop "Wompi sandbox" wording; keep "Simulated" framing | RETAIN AS VISIBLY SIMULATED |
| `src/components/gps/PaymentModal.jsx` | send ONLY `orgId` + `amountSats` to `api.simulatePayment` (drop the `description` argument at `:66`; never send `orgName`/`planLabel`/plan text); button "Pay" → "Generate simulated receipt"; "Signing invoice & computing value split..." → "Generating demonstration"; remove "Treatment plan" label + all real-payment/invoice-signing wording; state no real funds move and no payment is collected; persistently visibly SIMULATED | RETAIN AS VISIBLY SIMULATED |
| `src/components/gps/PaymentModal.test.jsx` (new) | add the Vitest + Testing Library component test for the simulated modal (payload = `orgId`+`amountSats` only; simulated wording) | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/components/gps/GPSEarnings.jsx` | remove "Paid & reconciled"/"Settled" framing and any settled/paid/reconciled/withdrawn claims; "Direct payouts" + wallet withdrawal shown visibly "Coming Soon"; Simulated status visible at PAGE/SECTION level, not only rows | RETAIN AS VISIBLY SIMULATED |
| `src/components/gps/GPSEarnings.test.jsx` (new) | add the Vitest + Testing Library component test for the simulated earnings preview (no settled/paid claims; page-level Simulated) | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/components/booking/BookingCard.jsx` | keep listed price + real booking status; REMOVE provider "· you earn $X" (`:125`); REMOVE patient payment-status pills incl "✓ Paid" (`PAY_STATUS`, `:38`, `:129-131`); card must not imply Solaris collected/settled payment | RETAIN ACTIVE UNCHANGED |
| `src/components/booking/BookingCard.test.jsx` (new) | add the Vitest + Testing Library component test (price + status kept; no payout/paid pill) | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `backend/tests/mailer.test.js` | extend an existing test block to assert the six neutral `secure_notification` payloads across every route caller in `bookings.js` + `provider/bookings.js` plus the negative caller assertion (no `vars` argument supplied) (AT-11); do NOT add a block, so the backend total stays 198 | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/components/booking/BookingFlow.test.jsx` (new) | add the Vitest + Testing Library booking-flow component test (AT-8) | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/components/admin/GPSStats.jsx` | neutralize the misleading real-settlement/earnings copy ("live feed of recent GPS settlements" `:6`; "Recent settlements" `:140`; "No GPS settlements yet. Completed bookings will appear here." `:142`; "No contributor earnings yet…" `:124`) and add a PERSISTENT visible page/section-level Simulated label so the surface never implies real settlements/earnings | RETAIN AS VISIBLY SIMULATED |
| `src/components/admin/GPSStats.test.jsx` (new) | add the Vitest + Testing Library component test asserting the persistent visible Simulated label renders and no "settlements/earnings" copy implies real funds | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/components/contributions/ContributionLedger.jsx` | neutralize the misleading "envelope (up to 10% of every payment) rewards…" claim (`:96`) so it cannot imply real payment routing, and add a PERSISTENT visible Simulated/Coming-Soon label | RETAIN AS VISIBLY SIMULATED |
| `src/components/contributions/ContributionLedger.test.jsx` (new) | add the Vitest + Testing Library component test asserting the persistent visible Simulated/Coming-Soon label renders and the "every payment" reward claim is not presented as live | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/components/gps/GPSLedger.jsx` | neutralize the misleading "90% of every payment goes to your practitioner, always…" (`:60`), "LOVE earned" (`:74`), and real "Settled"/"Pending" transaction statuses (`:101,:170-171`) so the surface never implies real settled payments, and add a PERSISTENT visible Simulated label | RETAIN AS VISIBLY SIMULATED |
| `src/components/gps/GPSLedger.test.jsx` (new) | add the Vitest + Testing Library component test asserting the persistent visible Simulated label renders and no transaction row is presented as a real settled payment | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/components/gps/RegenerativeTreasury.jsx` | neutralize the misleading "grows with every booking. 2.5% of each transaction is planted here" (`:63`) and "90% of every payment… The Regenerative Treasury (2.5% of each payment)… Every transaction plants a seed." (`:115`) so the surface never implies real per-payment fund flows, and add a PERSISTENT visible Simulated label (the existing `:143` "Coming soon" covers ONLY governance voting) | RETAIN AS VISIBLY SIMULATED |
| `src/components/gps/RegenerativeTreasury.test.jsx` (new) | add the Vitest + Testing Library component test asserting the persistent visible Simulated label renders and the per-payment treasury claims are not presented as live | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/components/gps/ReferralHub.jsx` | neutralize the misleading "Earn 1% of any booking from someone you refer" (`:66`), "Rewards earned"/"Total earned" real money values (`:88-89`), and "You earn 1% every time they book care." (`:97`) so the surface never implies real referral earnings, and add a PERSISTENT visible Simulated/Coming-Soon label | RETAIN AS VISIBLY SIMULATED |
| `src/components/gps/ReferralHub.test.jsx` (new) | add the Vitest + Testing Library component test asserting the persistent visible Simulated/Coming-Soon label renders and referral earnings are not presented as real | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |
| `src/__tests__/BookingOnlyExistingSurfaces.test.jsx` (new) | add ONE combined Vitest + Testing Library test that gives direct component coverage to the four allowlisted UI surfaces that otherwise lack a dedicated test file — `MemberPayments`, `PractitionerFinance`, `AdminSettings`, `AdminFinance`. It MUST render each of the four components with bounded API mocks (no live network) and assert RENDERED user-facing behavior (Testing Library queries against the DOM, NOT grep of source text): (a) `MemberPayments` displays `Simulated Value Receipts`, displays a persistent visible `Simulated` label, does NOT display `My Payments`, and does not claim that booking/paying for care creates a real payment; (b) `PractitionerFinance` shows no Wompi wallet option, shows a persistent visible `Simulated` or `Coming Soon` status, does not imply live payouts, and does not invent financial values when source data is absent; (c) `AdminSettings` shows the Payments row as `Disabled (booking-only)` (the exact approved equivalent already used in this contract) with no `Wompi sandbox` claim; (d) `AdminFinance` shows a persistent visible `Simulated` status, no `Wompi sandbox` claim, and nothing implying real funds moved or settled | SUPPORT FILE — NOT A RUNTIME ENTRYPOINT |

Paths NOT on this list (e.g. `WompiAdapter.js`, `MockPaymentAdapter.js`,
`stubs.js`, `PaymentProvider.js`, `gps.js`, `admin.js`, `allocation-policy.js`,
`vault-export.js`) are **retained unchanged**. The Wompi adapter is deliberately
NOT edited — it is made code-unreachable via the shared release gate, not
deleted. Re-enabling it is **NOT a configuration flip**: it requires a new L2
contract, explicit Majd authorization, a code change, tests, and release review
(§15).

**Exact test-count facts.** `backend/tests/payments.test.js` contains EXACTLY 7
test blocks. `backend/tests/mailer.test.js` contains EXACTLY 8 test blocks; AT-11
EXTENDS one of those existing blocks and does NOT add a block. The clean Phase B
full backend suite is EXACTLY 198 total, 196 passed, 2 failed, Jest exit 1, with
the two failures ONLY in `tests/intake-foundational.test.js`.

### 9.3 Non-overlap with the five S1B implementation paths (gate point 14)

The five existing S1B implementation paths are: `package.json`,
`package-lock.json`, `src/server.js` (the S1B secret-boundary work),
`src/middleware/secret-boundary.js`, `tests/secret-boundary.test.js` (backend
paths under `backend/`). **None of these appears in the allowlist in §9.2.** The
`backend/src/server.js` mount lines (`:274,:284,:287,:288`) are read-only evidence
here and are NOT edited. Therefore overlap is **not** unavoidable; gate point
14's recovery clause is **N/A** for this node.

Defensive recovery procedure (stated in case a future refactor is later proven to
require touching a shared path): capture the exact preimage
(`git show <approved-preimage>:<path>` and `sha256sum`) of every shared path
BEFORE any edit; make only additive, reversible changes; after the change, prove
the preimage is recoverable by restoring ONLY the named path from the approved
preimage with `git restore --source=<approved-preimage> --worktree -- <path>` and
re-checking `sha256sum`; if the preimage cannot be preserved, STOP and escalate
to Majd rather than proceed. Never use `git checkout <sha> -- <path>`, `git
clean`, `git reset`, or a whole-directory operation (§12).

---

## 10. Regression-test commands (complete, with true exit-code capture)

Requirements for EVERY command block below: (1) redirect both stdout and stderr to
ONE preserved log file with `> "$LOG/<name>.log" 2>&1` (no `tee`, no pipe) and keep
that SINGLE preserved copy — do NOT re-print the log during execution; each full
log is included ONCE in the evidence bundle. (2) Capture the tested command's exit
code IMMEDIATELY with `rc=$?` on the very next line (the command is redirected,
never piped, so `$?` is the tested command's OWN status — no `${PIPESTATUS[0]}`
needed), preserved SEPARATELY from any parser's status. (3) For Jest suites, read exact suite/test counts and
failing-file identity from a `jest --json --outputFile=<file>` machine-readable
report via a small CHECKED parser — NEVER infer counts from a human-readable
summary; the parser's own success/failure is captured separately from the command
exit code. (4) `grep` is SUPPLEMENTARY only, never the primary proof. (5) Compare
code/counts/failure-files explicitly and exit non-zero on any mismatch.

Chat/console output carries ONLY the concise verdict, counts, exit codes,
mismatches, hashes, and attachment names; the full inventories, diffs, and
complete logs live in the portable review artifact, not in chat.

**Forbidden patterns** (MUST NOT appear anywhere in the implementation node's
scripts, and do not appear in this contract's blocks): `command ; echo $?`
(exit-hiding one-liner); any pipeline whose final command masks the tested
command's exit; a grep guard that always exits zero; `|| true`; reporting only a
tail as complete evidence; a redundant `cat` of a log already written by `tee`;
inferring pass/fail counts from a human-readable summary instead of the `--json`
report.

**Expected results in a clean R2 implementation workspace** (any different
total / passing / failing / failure-file / exit code is a STOP condition, §11):

- Targeted payment tests: exactly **7/7 pass, Jest exit 0**.
- Schema recovery: exactly **3/3 pass, Jest exit 0**.
- Targeted mailer tests: exactly **8/8 pass, Jest exit 0**.
- S1A security regression floor (auth + agent-authority + luca): exactly
  **43/43 pass, Jest exit 0**.
- Full backend under `TZ=UTC`: exactly **198 total, 196 pass, 2 fail**, both
  failures in `tests/intake-foundational.test.js`, **Jest exit 1**.
- Complete frontend suite: build + lint **exit 0**; the passing count MAY
  increase but MUST NOT decrease versus the machine-readable pre-change baseline
  file recorded from the clean R2 checkout; and the EXACTLY 10 required component
  tests (`PaymentModal.test.jsx`, `GPSEarnings.test.jsx`, `BookingCard.test.jsx`,
  `BookingFlow.test.jsx`, the five FOURTH-amendment tests `GPSStats.test.jsx`,
  `ContributionLedger.test.jsx`, `GPSLedger.test.jsx`,
  `RegenerativeTreasury.test.jsx`, `ReferralHub.test.jsx`, plus the FIFTH-amendment
  combined test `BookingOnlyExistingSurfaces.test.jsx`) MUST be present and
  passing.

**PHASE B0 — pre-edit frontend baseline (run FIRST, on the clean R2 checkout,
BEFORE any source edit).** This produces the machine-readable baseline that the
post-edit comparison (PHASE B1, step 7 of the main script) depends on. If a
trustworthy baseline cannot be produced AND parsed, STOP and do not begin editing.

```bash
# ============================================================================
# PHASE B0 — PRE-EDIT FRONTEND BASELINE. From the repo root, on the CLEAN R2
# checkout, BEFORE ANY source edit. Exit codes are captured immediately on the
# next line (redirect, never pipe). No `tee`.
# ============================================================================
set -o pipefail

# (1) unique evidence dir OUTSIDE the repo; capture mktemp's exit code immediately
#     and STOP (fail closed) if it failed OR did not produce a directory
BASE=$(mktemp -d /tmp/r2-frontend-baseline.XXXXXX)
mrc=$?
if [ "$mrc" -ne 0 ] || [ ! -d "$BASE" ]; then echo "STOP: could not create unique baseline evidence dir (mktemp rc=$mrc)"; exit 1; fi
echo "baseline evidence dir: $BASE"

# (2) probe the installed Vitest; check BOTH exit codes before relying on the tool
npx vitest --version > "$BASE/vitest-version.log" 2>&1
vrc=$?
echo "vitest --version rc=$vrc"
if [ "$vrc" -ne 0 ]; then echo "STOP: vitest --version rc=$vrc"; exit 1; fi
npx vitest run --help > "$BASE/vitest-help.log" 2>&1
hrc=$?
echo "vitest run --help rc=$hrc"
if [ "$hrc" -ne 0 ]; then echo "STOP: vitest run --help rc=$hrc"; exit 1; fi

# (3) select ONLY the flags THIS Vitest proves it supports (never assume flags)
if grep -q -- "--reporter" "$BASE/vitest-help.log" && grep -q -- "--outputFile" "$BASE/vitest-help.log"; then
  BASELINE_JSON="$BASE/web-baseline.json"
  RUN_ARGS="run --reporter=json --outputFile=$BASELINE_JSON"
else
  echo "STOP: this Vitest lacks --reporter/--outputFile; define a CHECKED parser over the COMPLETE preserved text log ($BASE/web-baseline.log) and document that limitation in the review artifact before editing"; exit 1
fi

# (4) run the COMPLETE frontend suite -> machine-readable baseline file
npx vitest $RUN_ARGS > "$BASE/web-baseline.log" 2>&1
# (5) capture the Vitest exit code IMMEDIATELY, preserved separately from the parser.
#     FAIL CLOSED: a non-green pre-edit baseline MUST NOT authorize implementation.
brc=$?
echo "vitest baseline run rc=$brc"
if [ "$brc" -ne 0 ]; then echo "STOP: pre-edit frontend baseline suite is NOT green (vitest rc=$brc); do NOT begin editing"; exit 1; fi

# (6)+(7) parse + verify the baseline file; record test-file count, passed/failed/
#         total, failing-file identities, baseline-file SHA-256, command exit code,
#         and parser exit code. The parser FAILS CLOSED (non-zero) unless the JSON
#         proves a NON-EMPTY, fully GREEN suite: testResults is a non-empty array;
#         numPassedTests/numFailedTests/numTotalTests are finite numbers;
#         numFailedTests === 0; numTotalTests > 0; numPassedTests === numTotalTests.
#         A valid JSON file from a failing OR empty suite MUST NOT authorize editing.
node -e '
  const fs=require("fs");
  let j; try { j=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); }
  catch(e){ console.error("PARSE_FAIL"); process.exit(2); }
  const files=j.testResults;
  if (!Array.isArray(files)) { console.error("VALIDATE_FAIL: testResults is not an array"); process.exit(3); }
  if (files.length <= 0) { console.error("VALIDATE_FAIL: testResults is empty"); process.exit(3); }
  const p=j.numPassedTests, f=j.numFailedTests, t=j.numTotalTests;
  if (![p,f,t].every(n=>Number.isFinite(n))) { console.error("VALIDATE_FAIL: pass/fail/total not all finite numbers"); process.exit(3); }
  if (f !== 0) { console.error(`VALIDATE_FAIL: numFailedTests=${f} (expected 0)`); process.exit(3); }
  if (!(t > 0)) { console.error(`VALIDATE_FAIL: numTotalTests=${t} (expected > 0)`); process.exit(3); }
  if (p !== t) { console.error(`VALIDATE_FAIL: numPassedTests=${p} !== numTotalTests=${t}`); process.exit(3); }
  const failing=[...new Set(files.filter(r=>(r.numFailingTests||0)>0||r.status==="failed").map(r=>r.name))].sort();
  console.log(`testfiles=${files.length} passed=${p} failed=${f} total=${t}`);
  console.log(`failing=${failing.join("|")}`);
' "$BASELINE_JSON" > "$BASE/baseline-parsed.txt" 2>"$BASE/baseline-parse.err"
prc=$?
echo "baseline parser rc=$prc"
if [ "$prc" -ne 0 ]; then echo "STOP: baseline JSON not a non-empty green suite (see $BASE/baseline-parse.err); do NOT begin editing"; exit 1; fi
cat "$BASE/baseline-parsed.txt"

# baseline-file SHA-256 recorded + pinned to a stable path for PHASE B1
sha256sum "$BASELINE_JSON" > "$BASE/web-baseline.json.sha256"
cp "$BASE/web-baseline.json.sha256" /tmp/r2-frontend-baseline.sha256
echo "$BASELINE_JSON" > /tmp/r2-frontend-baseline.path
echo "baseline command exit code: $brc / parser exit code: $prc"
cat "$BASE/web-baseline.json.sha256"

# (8) baseline file + its SHA-256 remain in $BASE (OUTSIDE the repo). (9) If any
#     step above STOPped, no source has been edited — fix the tooling first so a
#     trustworthy baseline exists before implementation begins.
echo "PHASE B0 complete; baseline=$BASELINE_JSON"
```

**Main regression script (run AFTER implementation).** Every tested command
redirects stdout+stderr to ONE preserved log and captures its OWN exit code on the
next line with `rc=$?` (no `tee`, no pipe); only a concise "name + rc + parsed
result" is printed while the full logs stay on disk in `$LOG`.

```bash
# ============================================================================
# MAIN REGRESSION SCRIPT — from the repo root, AFTER implementation.
# ============================================================================
set -o pipefail
# unique evidence dir OUTSIDE the repo; capture mktemp's exit code immediately and
# STOP (fail closed) if it failed OR did not produce a directory
LOG=$(mktemp -d /tmp/r2-regression-logs.XXXXXX)
lrc=$?
if [ "$lrc" -ne 0 ] || [ ! -d "$LOG" ]; then echo "STOP: could not create unique regression log dir (mktemp rc=$lrc)"; exit 1; fi

# CHECKED parser: reads a Jest --json report and prints one line
# "<numFailedTests> <numPassedTests> <numTotalTests>" then a second line with the
# comma-joined sorted set of failing test-file basenames (tests/NAME.test.js).
# Exits 2 if the JSON is unreadable. It NEVER sees the command exit code — the
# tested command's rc is captured separately by the caller.
read_jest_json() {  # $1 = json file
  node -e '
    const fs=require("fs");
    let j; try { j=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); }
    catch(e){ console.error("PARSE_FAIL"); process.exit(2); }
    const failing=[...new Set((j.testResults||[])
      .filter(r=>(r.numFailingTests||0)>0||r.status==="failed")
      .map(r=>r.name.replace(/^.*\/(tests\/[^/]+)$/,"$1")))].sort();
    console.log(`${j.numFailedTests} ${j.numPassedTests} ${j.numTotalTests}`);
    console.log(failing.join(","));
  ' "$1"
}

# --- Backend, from repo root, after the isolated PostgreSQL of §8 is bootstrapped
cd backend
npm ci > "$LOG/npm-ci.log" 2>&1
rc=$?
echo "npm-ci rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: npm ci rc=$rc"; exit 1; fi

# 1) Targeted payment tests — expect 0 failed / 7 passed / 7 total, Jest exit 0
npx jest tests/payments.test.js --runInBand --json --outputFile="$LOG/payments.json" > "$LOG/payments.log" 2>&1
rc=$?
echo "payments rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: payments rc=$rc (expected 0)"; exit 1; fi
COUNTS=$(read_jest_json "$LOG/payments.json"); prc=$?
if [ "$prc" -ne 0 ]; then echo "STOP: could not parse payments.json"; exit 1; fi
if [ "$(printf '%s\n' "$COUNTS" | head -1)" != "0 7 7" ]; then
  echo "STOP: payments not 0 failed / 7 passed / 7 total (got $(printf '%s\n' "$COUNTS" | head -1))"; exit 1; fi
echo "payments OK: 0 failed / 7 passed / 7 total"

# 2) Schema recovery — expect 0 failed / 3 passed / 3 total, Jest exit 0
npx jest tests/schema-recovery.test.js --runInBand --json --outputFile="$LOG/schema.json" > "$LOG/schema.log" 2>&1
rc=$?
echo "schema rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: schema rc=$rc (expected 0)"; exit 1; fi
COUNTS=$(read_jest_json "$LOG/schema.json"); prc=$?
if [ "$prc" -ne 0 ]; then echo "STOP: could not parse schema.json"; exit 1; fi
if [ "$(printf '%s\n' "$COUNTS" | head -1)" != "0 3 3" ]; then
  echo "STOP: schema not 0 failed / 3 passed / 3 total (got $(printf '%s\n' "$COUNTS" | head -1))"; exit 1; fi
echo "schema OK: 0 failed / 3 passed / 3 total"

# 2a) Targeted mailer tests — expect 0 failed / 8 passed / 8 total, Jest exit 0
#     (AT-11 EXTENDS an existing block; total mailer blocks stay 8)
npx jest tests/mailer.test.js --runInBand --json --outputFile="$LOG/mailer.json" > "$LOG/mailer.log" 2>&1
rc=$?
echo "mailer rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: mailer rc=$rc (expected 0)"; exit 1; fi
COUNTS=$(read_jest_json "$LOG/mailer.json"); prc=$?
if [ "$prc" -ne 0 ]; then echo "STOP: could not parse mailer.json"; exit 1; fi
if [ "$(printf '%s\n' "$COUNTS" | head -1)" != "0 8 8" ]; then
  echo "STOP: mailer not 0 failed / 8 passed / 8 total (got $(printf '%s\n' "$COUNTS" | head -1))"; exit 1; fi
echo "mailer OK: 0 failed / 8 passed / 8 total"

# 2b) S1A security regression floor (auth + agent-authority + luca) — expect
#     0 failed / 43 passed / 43 total, Jest exit 0
npx jest tests/auth.test.js tests/agent-authority.test.js tests/luca.test.js \
  --runInBand --json --outputFile="$LOG/s1a-floor.json" > "$LOG/s1a-floor.log" 2>&1
rc=$?
echo "s1a-floor rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: s1a-floor rc=$rc (expected 0)"; exit 1; fi
COUNTS=$(read_jest_json "$LOG/s1a-floor.json"); prc=$?
if [ "$prc" -ne 0 ]; then echo "STOP: could not parse s1a-floor.json"; exit 1; fi
if [ "$(printf '%s\n' "$COUNTS" | head -1)" != "0 43 43" ]; then
  echo "STOP: s1a-floor not 0 failed / 43 passed / 43 total (got $(printf '%s\n' "$COUNTS" | head -1))"; exit 1; fi
echo "s1a-floor OK: 0 failed / 43 passed / 43 total"

# 3) Full backend under TZ=UTC — expect 2 failed / 196 passed / 198 total, Jest
#    exit 1, both failures ONLY in tests/intake-foundational.test.js
TZ=UTC npx jest --runInBand --json --outputFile="$LOG/backend-all.json" > "$LOG/backend-all.log" 2>&1
rc=$?
echo "backend-all rc=$rc"
if [ "$rc" -ne 1 ]; then echo "STOP: backend-all rc=$rc (expected 1)"; exit 1; fi
COUNTS=$(read_jest_json "$LOG/backend-all.json"); prc=$?
if [ "$prc" -ne 0 ]; then echo "STOP: could not parse backend-all.json"; exit 1; fi
if [ "$(printf '%s\n' "$COUNTS" | head -1)" != "2 196 198" ]; then
  echo "STOP: backend-all not 2 failed / 196 passed / 198 total (got $(printf '%s\n' "$COUNTS" | head -1))"; exit 1; fi
FAILFILES=$(printf '%s\n' "$COUNTS" | sed -n '2p')
echo "backend-all failing files: $FAILFILES"
if [ "$FAILFILES" != "tests/intake-foundational.test.js" ]; then
  echo "STOP: failures outside tests/intake-foundational.test.js"; exit 1; fi
echo "backend-all OK: 2 failed / 196 passed / 198 total (only intake-foundational)"

# 4) Vault roundtrip must stay green (frozen format)
node tests/roundtrip.js > "$LOG/roundtrip.log" 2>&1
rc=$?
echo "roundtrip rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: roundtrip rc=$rc (expected 0)"; exit 1; fi

# --- Frontend, from repo root
cd ..
npm ci > "$LOG/web-npm-ci.log" 2>&1
rc=$?
echo "web-npm-ci rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: web npm ci rc=$rc"; exit 1; fi

# 5) Frontend build — expect exit 0
npm run build > "$LOG/web-build.log" 2>&1
rc=$?
echo "web-build rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: web build rc=$rc (expected 0)"; exit 1; fi

# 6) Frontend lint — expect exit 0
npm run lint > "$LOG/web-lint.log" 2>&1
rc=$?
echo "web-lint rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: web lint rc=$rc (expected 0)"; exit 1; fi

# 7) PHASE B1 — POST-EDIT COMPLETE FRONTEND SUITE. Same suite + SAME reporter as
#    PHASE B0; a SEPARATE post-edit result file; test + parser exit codes captured
#    separately; compared against the stored pre-edit baseline.
# Re-probe the tool at the point of use (redirect + explicit exit codes)
npx vitest --version > "$LOG/vitest-version.log" 2>&1
vrc=$?
echo "vitest --version rc=$vrc"
if [ "$vrc" -ne 0 ]; then echo "STOP: vitest --version rc=$vrc"; exit 1; fi
npx vitest run --help > "$LOG/vitest-help.log" 2>&1
hrc=$?
echo "vitest run --help rc=$hrc"
if [ "$hrc" -ne 0 ]; then echo "STOP: vitest run --help rc=$hrc"; exit 1; fi

# locate the PHASE B0 baseline recorded on the clean checkout
BASELINE_JSON=$(cat /tmp/r2-frontend-baseline.path)
if [ ! -f "$BASELINE_JSON" ]; then echo "STOP: PHASE B0 baseline missing ($BASELINE_JSON); rerun PHASE B0 on the clean checkout"; exit 1; fi

# verify the stored baseline SHA-256 is UNCHANGED since PHASE B0
sha256sum -c /tmp/r2-frontend-baseline.sha256 > "$LOG/web-baseline-sha-check.log" 2>&1
src=$?
echo "baseline sha256 verify rc=$src"
if [ "$src" -ne 0 ]; then echo "STOP: stored frontend baseline changed since PHASE B0"; exit 1; fi

# run the SAME suite, SAME reporter, into a SEPARATE post-edit result file
npx vitest run --reporter=json --outputFile="$LOG/web-test.json" > "$LOG/web-test.log" 2>&1
rc=$?
echo "web-test rc=$rc"
if [ "$rc" -ne 0 ]; then echo "STOP: web test rc=$rc (expected 0)"; exit 1; fi

# Compare post-edit vs the stored baseline (parser status captured SEPARATELY from
# rc): no previously-passing test may become failing, the passed count MUST NOT
# decrease, and every newly-required component test MUST be present and passing. If
# this Vitest lacks a usable JSON reporter, DO NOT fall back to a human summary —
# define a CHECKED parser over the COMPLETE preserved text log and state that
# limitation in the review artifact.
node -e '
  const fs=require("fs");
  const rd=f=>JSON.parse(fs.readFileSync(f,"utf8"));
  let base,cur; try { base=rd(process.argv[1]); cur=rd(process.argv[2]); }
  catch(e){ console.error("PARSE_FAIL"); process.exit(2); }
  const pass=j=>j.numPassedTests ?? 0;
  if (pass(cur) < pass(base)) {
    console.error(`STOP: frontend passing decreased ${pass(base)} -> ${pass(cur)}`); process.exit(1); }
  const failingNow=new Set((cur.testResults||[]).filter(r=>(r.numFailingTests||0)>0||r.status==="failed").map(r=>r.name));
  const passingBefore=(base.testResults||[]).filter(r=>(r.numFailingTests||0)===0&&r.status!=="failed").map(r=>r.name);
  for (const n of passingBefore) {
    if (failingNow.has(n)) { console.error(`STOP: previously-passing test now failing ${n}`); process.exit(1); } }
  const need=["PaymentModal.test.jsx","GPSEarnings.test.jsx","BookingCard.test.jsx","BookingFlow.test.jsx","GPSStats.test.jsx","ContributionLedger.test.jsx","GPSLedger.test.jsx","RegenerativeTreasury.test.jsx","ReferralHub.test.jsx","BookingOnlyExistingSurfaces.test.jsx"];
  for (const n of need) {
    const hit=(cur.testResults||[]).find(r=>r.name.endsWith(n));
    if (!hit) { console.error(`STOP: missing new component test ${n}`); process.exit(1); }
    if ((hit.numFailingTests||0)>0 || hit.status==="failed") {
      console.error(`STOP: new component test failing ${n}`); process.exit(1); }
  }
  console.log(`frontend OK: passed ${pass(base)} -> ${pass(cur)}; no regressions; all ${need.length} required component tests present & green`);
' "$BASELINE_JSON" "$LOG/web-test.json"
prc=$?
if [ "$prc" -ne 0 ]; then echo "STOP: frontend baseline comparison failed (prc=$prc)"; exit 1; fi

# 8) Supplementary grep guard (NOT a substitute for AT-8). Capture rc explicitly.
grep -RnaE "createCheckout|Wompi|wompi|Pay \\\$|window\\.open\\(.*checkout" src/components > "$LOG/ui-guard.log"
rc=$?
echo "ui-guard rc=$rc (0 = matches found = FAIL; 1 = clean)"
if [ "$rc" -ne 1 ]; then echo "STOP: Wompi UI surface present in src/components"; exit 1; fi

echo "ALL REGRESSION CHECKS PASSED WITH EXPECTED CODES/COUNTS"
```

Tests must NOT be skipped or deleted to reach these results (gate point 11).

---

## 11. Stop conditions

The implementation node MUST STOP and escalate (not work around) if any of:

- Reaching the booking-only outcome would require editing a path outside the §9.2
  allowlist, OR any of the five S1B paths (§9.3).
- Reaching a green suite would require deleting or `.skip`-ing a test, or would
  change `payments.test.js` away from exactly seven tests.
- Any regression result deviates from §10: targeted payments ≠ 7/7 exit 0;
  schema recovery ≠ 3/3 exit 0; full backend ≠ 198 total / 196 pass / 2 fail /
  exit 1; a failing file other than `tests/intake-foundational.test.js`; a
  frontend build/lint non-zero exit; or a decrease in the frontend passing count.
- The shared release gate cannot be made hard-disabled (any config alone could
  flip it on in Beta).
- A test would need a live or sandbox Wompi network call to pass.
- Any PHI or secret material would have to flow into a payment code path or a
  third-party email payload.
- The simulated write set cannot be made atomic on ONE `db.pool` transaction
  client, OR AT-10's deterministic failure injection leaves any partial payment /
  receipt / link row or a changed simulated wallet balance after `ROLLBACK`, OR
  durable idempotency would require a schema change inside R2 (record it as the
  deferred `BETA RELEASE BLOCKER — DATA INTEGRITY NODE REQUIRED`, never a
  process-memory substitute).
- Any `sendBookingEmail` caller in `bookings.js` or `provider/bookings.js` would
  still supply a `vars` argument after implementation.
- The base-schema bootstrap (§8.2) cannot be reproduced deterministically, or the
  `pgmigrations` row count after migration is not exactly 35.
- Any request to implement Spark, UTEXO, onboarding, or a live payment provider
  appears — all are explicitly out of scope (§1.2, §15).

---

## 12. Rollback and quarantine procedure

Per `docs/beta-v1/WORKFLOW.md`:

- **Additive/reversible only.** The gate defaults false and is hard-disabled in
  Beta; enabling online payments later is a future L2 node (§15), not a rollback.
- **Before the R2 commit (safe worktree cleanup):** print the exact status first
  (`git status --porcelain=v1 --untracked-files=all`). Restore ONLY the NAMED
  tracked R2 paths from the approved preimage with
  `git restore --source=<approved-preimage> --worktree -- <explicit path> [...]`.
  Move ONLY R2-created UNTRACKED files into a timestamped private quarantine
  directory, e.g. `Q="$(mktemp -d /tmp/r2-quarantine.XXXXXX)"; mv <explicit
  untracked path> "$Q"/`. NEVER delete, NEVER `git clean`, NEVER `git reset`,
  NEVER move a whole directory, and NEVER touch the protected S1B workspace
  `/tmp/solaris-s1b`.
- **After the R2 commit:** rollback is ONE explicit `git revert` of the single R2
  implementation commit. Because the change is gate + UI-removal + test-rewrite +
  PHI-stripping with no schema/migration/dependency change (gate point 13),
  `git revert` restores the prior behavior with no data migration; no
  `payment_intents`/`allocations` data is destroyed.
- **Quarantine (post-merge defect):** the gate is already false, guaranteeing the
  disabled path; if necessary route `/api/payments/checkout` and `/webhook` to
  the typed disabled response unconditionally while the fix is prepared. No secret
  rotation is required because no secret was exposed by this node.
- **Vault safety:** the vault format is frozen and unchanged; roundtrip must stay
  green before and after rollback.

---

## 13. Residual risks

1. **Latent live path.** The `WompiAdapter` remains in the tree; a future edit to
   the shared gate could expose it. Mitigation: `onlinePaymentsEnabled()` returns
   false as a hard-disabled constant in Beta; AT-1/AT-2/AT-2b assert that neither
   credentials nor `ONLINE_PAYMENTS_ENABLED=true` can activate it; enabling it is
   deferred to a new L2 node (§15).
2. **UI drift.** A future component could re-import a checkout call. Mitigation:
   `createCheckout` is removed entirely from `src/lib/api.js`; the AT-8 component
   test plus the §10 grep guard catch a reappearing Wompi surface.
3. **Simulated-label erosion.** A refactor could drop a "Simulated" label.
   Mitigation: `shapeIntent` sets `simulated:true` server-side
   (`payments.js:360-361`); tests assert the label/flag.
4. **Simulation mutating real data.** The legacy `treatmentPlanId` path could
   creep back. Mitigation: AT-10 snapshots and asserts zero real-status
   mutations.
5. **PHI in emails.** Templates could regress to embedding PHI. Mitigation: AT-11
   asserts exact generic payloads and PHI-token absence.
6. **Schema-bootstrap fragility.** The `schema*.sql` base ordering (§8.2) could
   break CI. Mitigation: §8.2 fixes the exact nine-file base order, requires each
   file to run under `ON_ERROR_STOP=1` with its own captured exit code before
   `npm run migrate`, and requires the `pgmigrations` row count to be exactly 35
   (35 files: `001`–`005` and `007`–`036`; `006` absent) after migration.
7. **Copy implying a live rail.** Admin/practitioner copy mentioning "Wompi
   sandbox" could mislead. Mitigation: §3.4 wording fixes remove those claims.
8. **Partial simulated write.** A mid-sequence failure could leave a payment row
   without its receipt/link or a wrong simulated wallet balance. Mitigation: the
   §3.2 atomicity mandate wraps the whole set in ONE `db.pool` transaction
   (all-or-nothing) and AT-10's deterministic failure injection asserts zero
   partial rows and zero balance change after `ROLLBACK`. Durable
   replay/idempotency remains a
   `BETA RELEASE BLOCKER — DATA INTEGRITY NODE REQUIRED` (§16), not solved by R2
   and never approximated with a process-memory set/cache.
9. **Payment-adjacent UI implying real settlement.** Retained GPS/earnings/card
   surfaces could imply Solaris collected or settled money. Mitigation: §3.4
   makes `PaymentModal.jsx` and `GPSEarnings.jsx` persistently, page-level
   Simulated (no settled/paid/reconciled claims; "Coming Soon" payouts) and
   `BookingCard.jsx` drops the "you earn"/"✓ Paid" surfaces; the full
   payment-adjacent inventory is classified in §9.2 and preserved in the review
   artifact.

---

## 14. Explicit non-implementation statement

This node does NOT implement Spark, does NOT implement UTEXO (it remains "Coming
Soon"), does NOT implement onboarding, and does NOT implement or enable any
payment provider or live payment rail. It disables online payments, makes the
Wompi path code-unreachable behind a hard-disabled shared release gate, and
specifies a booking journey that completes without payment. It is a contract
only: authoring it changes no application code, installs no dependency, creates
no database/table/migration/container, and performs no stage, commit, push, PR,
merge, deploy, or test run.

---

## 15. Contract lifecycle (execution order and workspace separation)

This contract is authored in a read-only contract workspace and is NOT
implemented here. Execution proceeds in three separately-authorized phases.

### Phase A — Contract

- Landing this contract as a commit requires SEPARATE authorization (a distinct
  turn/approval). This turn does NOT stage, commit, or push.
- The approved contract commit MUST be a **DIRECT CHILD of
  `bff148d4031930899431e2dc0225148519cfa60e`**.
- It MUST change EXACTLY the contract path
  `docs/contracts/S1B-R2-booking-only-gate.md` and nothing else.
- Its committed blob SHA-256 MUST match the separately authorized value.

### Phase B — R2 implementation

- Use a NEW, clean implementation workspace cloned from the APPROVED contract
  commit (its blob/commit verified). Do NOT implement R2 inside
  `/tmp/solaris-s1b` (the protected S1B workspace) or inside this contract
  workspace.
- Touch ONLY the corrected R2 allowlist (§9.2).
- Only AT-4A (the clean-R2 non-secret disabled-`200` case) is exercised here; the
  clean Phase B `payments.test.js` retains exactly seven test blocks and MUST NOT
  add the Phase C secret-boundary (AT-4B) expectation.
- Produce the expected §10 results: payments `7/7` exit 0; schema recovery `3/3`
  exit 0; targeted mailer `8/8` exit 0; S1A security regression floor (auth +
  agent-authority + luca) `43/43` exit 0; full backend suite EXACTLY
  **198 total, 196 passed, 2 failed, Jest exit 1**, with the two failures ONLY in
  `tests/intake-foundational.test.js`; frontend build/lint 0; frontend passing
  count not decreased.
- Review independently and land R2 as its OWN code commit. The five dirty S1B
  files are NEVER combined into the R2 implementation commit.
- The R2 commit is reviewable but NOT deployable to Beta until Phase C succeeds.

### Phase C — Resume S1B

- ONLY after R2 is independently accepted and remote Beta advances, fetch and
  fast-forward `/tmp/solaris-s1b`.
- BEFORE and AFTER the fast-forward, verify the five S1B paths and their byte
  hashes (`sha256sum`) are unchanged.
- With the five preserved S1B files now present, AT-4B (the secret-material
  `400 SECRET_MATERIAL_REJECTED` boundary) becomes exercisable in this composite
  workspace.
- Run BOTH gates: (a) the S1B 92-test targeted suite, and (b) the composite
  full-suite gate. Expected composite full-suite result: **290 total, 288 pass,
  2 fail**, both ONLY in `tests/intake-foundational.test.js`, **Jest exit 1**.
  Any deviation in either gate is a STOP and leaves Beta deployment blocked.
- NEVER combine the five dirty S1B files into the R2 implementation commit; the
  S1B workspace remains its own change set.

### Future live-payments node (out of scope here)

Enabling any live payment rail (Wompi or otherwise) requires a NEW L2 contract,
explicit Majd authorization, a code change, tests, and release review. It is NOT
a configuration flip and NOT part of R2.

---

## 16. R2 NODE ACCEPTANCE IS NOT BETA RELEASE APPROVAL

R2 is classified **Q3** (it touches PHI egress boundaries, payment-adjacent
behavior, and persisted financial simulation). Accordingly, R2 node acceptance is
NOT Beta release approval. R2 MAY be reviewed and landed as its own commit while
Beta deployment remains BLOCKED on the separately-scheduled nodes listed below.

These are explicit Beta release blockers / follow-on hardening nodes. They are
NOT implementation additions to R2 and MUST NOT be silently absorbed into the R2
allowlist (§9.2):

1. **Database-enforced booking concurrency** plus a simultaneous-booking test
   proving no double-book under concurrent requests.
2. **Durable idempotency / replay protection** for the simulated writes
   (`BETA RELEASE BLOCKER — DATA INTEGRITY NODE REQUIRED`; requires a schema
   change — a process-memory set/cache is NOT an acceptable substitute).
3. **Bounded cursor pagination plus supporting indexes** for the retained
   payment/receipt history surfaces.
4. **Shared-store or trusted-edge global rate limiting** before a second app
   replica is added.
5. **Test isolation closed to a genuinely green 198/198 backend baseline** (the
   two `tests/intake-foundational.test.js` failures resolved, not tolerated).
6. **Automated CI plus a pinned Node/npm runtime.**
7. **Production CSP and explicit production CORS configuration.**
8. **Production dependency-advisory disposition** (audit resolved/accepted).
9. **Critical E2E coverage** for authentication, consent, booking, secret
   rejection, and revoked/expired states.
10. **Backup/restore plus migration rollback proof.**

Each blocker is scheduled as its own node with its own authorization and review;
none may be folded into R2 to make R2 appear release-ready.
