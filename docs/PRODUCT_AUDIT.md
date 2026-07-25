# Solaris Health — Product Audit

**Date:** 25 July 2026 · **Live at:** https://solaris-health.abacusai.cloud
**Written in plain language.** Every "working" claim below says *how it was verified* — nothing here is assumed.

How things were verified in this audit:

- **Backend test suite** — 137 automated tests, all passing (`cd backend && npx jest`).
- **Frontend test suite** — 32 automated tests, all passing (`npx vitest run`).
- **Live smoke test** — 18-step script that registers, logs in, chats with LUCA, books, exports, etc. against the running server: 18/18 passing (`backend/scripts/smoke-test.js`).
- **Live API sweep** — 61-check script that hits every mounted API route as a member, a practitioner and an anonymous visitor (`backend/scripts/api-sweep.js`).
- **Manual browser check** — logged in as the demo member, viewed the dashboard, held a real AI conversation with LUCA, saw the notification bell and badge.

---

## 1 · What works today (and how we know)

### Accounts & identity
- **Register / login / logout** — smoke test + live curls; login was re-verified 15 times in a row after the rate-limit fix (all succeeded).
- **Login rate limiting done right** — only *failed* attempts count (10 per 15 min per person); a blocked account never locks out other people on the same network. Verified live: 10 bad passwords → polite "try again in 15 minutes" message with a proper Retry-After; a different account still logged in fine.
- **Solaris ID** — every user has a permanent `sol_…` identity with replaceable bindings (email is stored hash-only). Verified by jest identity suite + live `/api/identity/me`.
- **Data export ("own your data")** — any member can download their whole record as a portable vault (`/api/export/me?format=zip`). Verified live (real ZIP returned) and by 13 serialization tests including a lossless round-trip. Now also includes notification history.

### LUCA companion
- **AI chat** — real model-backed replies, verified live in the browser and by smoke test. Non-diagnostic by design; PHI-boundary tests (8) prove restricted identifiers never reach an external AI provider.
- **Kill switch** — LUCA can be paused/re-enabled by the owner; state change now also drops a note in the notification center. Verified by agent-authority tests + API sweep.
- **AI execution receipts** — every AI call leaves a provenance receipt (hashes, model, consent basis — no raw prompts). Verified by ai-receipts tests and present in the vault export.

### Health features
- **Assessment, journal, habits, health documents, audio library** — all exercised by the smoke test and included in the vault export (each has its own serializer test).
- **Health timeline & trends** — jest suites (timeline, trends) passing.

### Marketplace & care
- **Practitioner directory** — browsable live (38 seeded profiles).
- **Bookings** — request → practitioner confirm/decline → member notified; reschedule, cancel, availability slots. Verified by API sweep as both roles. Fixed this sprint: a malformed booking ID now returns a clean 404 instead of a server error.
- **Secure messaging** — end-to-end encrypted messages and attachments between member and practitioner. Verified by API sweep (keys, contacts, conversations, send, read, typing). New this sprint: the recipient now gets an in-app + push notification ("You have a new secure message" — never the content, which stays encrypted).
- **Consent requests** — grant/revoke flows verified by API sweep; consent decisions trigger notifications.

### Notifications (new this sprint)
- **In-app center** — bell + unread badge + panel with filters, mark-read, mark-all, live toasts. Existed before; verified in browser.
- **Web push** — opt-in only (a quiet toggle inside the bell panel; the app never nags on page load). Privacy rule enforced by code *and* by test: push bodies are fixed generic sentences, never message or health content. iPhone users get an honest "Add to Home Screen" hint instead of a broken toggle; if permission is blocked, the in-app center keeps working. Verified by 9 new backend tests (subscription lifecycle, upsert, revoke, PHI safety).

### Rewards & GPS
- **Reward events / contributions** — recorded and exported; verified by smoke test + export tests.
- **GPS allocation engine** — the split logic (member / practitioner / community / treasury) is fully covered by jest gps-allocation and gps-policy tests. *Note:* the live database currently has zero GPS transactions, so explain/dispute screens couldn't be exercised with real data — they are test-verified only.

### Platform & safety
- **Tenant/PHI isolation** — 8 boundary tests prove one user can never read another's data through the AI path.
- **Read-only sovereignty mode, schema recovery, wallet stubs** — jest suites passing.
- **Admin** — provider application review (approve/reject with notifications) verified by tests + sweep.

---

## 2 · Still to build (honest list)

Each item has a one-line next step.

| What's missing | Next step |
|---|---|
| **Real Lightning settlement** — GPS splits are simulated; no sats actually move | Integrate NWC (Nostr Wallet Connect) or Spark against the existing `gps_end_address` field, behind a feature flag |
| **DID / npub sign-to-bind** — identity bindings exist but aren't cryptographically proven | Add a challenge-signature flow: server issues a nonce, user signs with their nostr key, binding flips to `verified` |
| **Nostr login** — the login screen shows it honestly as "coming soon" | Build on top of sign-to-bind above; login = prove control of a bound npub |
| **Clinic / organisation bindings** — only personal bindings exist | Add an `organization` binding type + admin UI to attach practitioners to a clinic |
| **Online payment in booking flow** — marked "coming soon" in the UI | Wire the booking deposit to the same Lightning rail as GPS settlement |
| **Community treasury voting** — treasury page shows governance as "coming soon" | Start with simple one-member-one-vote proposals stored in Postgres |
| **Practitioner self-onboarding** — application exists; guided profile setup does not | Build a post-approval wizard (services, availability, bio) |
| **Admin tooling** — provider review exists; user management/audit browsing don't | Add an admin users table view + audit-log search |
| **Real email delivery** — email notifications print to the console (placeholder) | Plug an SMTP/provider adapter into `lib/notification-provider.js` |
| **Demo data gaps** — `alejandro@solaris.health` has no practitioner profile; `sarah` has an assessment reward but no assessment answers | Extend the seed script; both currently degrade gracefully in the UI |

---

## 3 · Improvements, ranked by impact

**Done this sprint (quick wins):**
1. ✅ **Login rate limiting fixed** — the #1 user-facing bug. Only failed attempts count; friendly retry message; chatty app traffic no longer trips the global limit (raised to a sane ceiling).
2. ✅ **Booking lookup hardening** — malformed IDs return 404, not a 500.
3. ✅ **Dr. Elena linked to her practitioner profile** — her availability/practice pages now work with real data.
4. ✅ **Message notifications** — recipients finally learn a message arrived without polling the inbox.
5. ✅ **Push notifications** — opt-in, PHI-safe, iOS-honest.

**Next, in order of impact:**
1. **Persist rate-limit state in Postgres/Redis** — limits currently reset on every deploy (in-memory store). Low effort, prevents abuse windows.
2. **Real email adapter** — booking confirmations by email are table stakes for a health service.
3. **Seed a few GPS transactions in demo data** — the explain/dispute screens are the product's most distinctive story and currently can't be demoed live.
4. **Practitioner onboarding wizard** — unblocks growing the supply side without manual SQL (see the Elena fix above, which was done by hand).
5. **Mobile polish of the booking flow** — functional but dense on small screens.
6. **Search in the notification center** once volume grows.

---

*Everything in section 1 was verified on 25 July 2026 against the live deployment or the automated suites named at the top. Sections 2–3 are the honest gap list — none of those items are partially hidden behind fake buttons; where a feature isn't ready, the UI says "coming soon" plainly.*
