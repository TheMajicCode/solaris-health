# Spanish (es) Review Needed — NODE K1.3

This node performed a **targeted** Spanish localization pass over high-traffic
signed-in chrome. Spanish remains a labeled **preview** locale
(`VITE_SPANISH_PREVIEW`). The items below still require **native/legal review**
before Spanish can be promoted out of preview. Nothing here is claimed to be
legally or clinically reviewed.

## 1. Safety / legal / clinical / consent copy — REVIEW_PENDING (intentional)

The four safety keys stay pinned to the `__REVIEW_PENDING__` sentinel in
`src/lib/i18n/es.js` **by design** — they must NOT be machine-translated. At
runtime `resolveSafe()` / `SafetyText` render the reviewed **English** text plus
an explicit "translation under review" notice (never a silent Spanish guess):

- `safety.consentToShare` — consent to share info with a practitioner
- `safety.notMedicalAdvice` — "organizational support only, not medical/legal/financial advice"
- `safety.crisis` — crisis / self-harm escalation
- `safety.dataUse` — privacy / data-use ("never used to train models")

**Action for reviewer:** have a qualified bilingual legal/clinical reviewer
author Spanish for these four, then replace the sentinel values in `es.js`. The
i18n parity test (`i18n.locale.test.jsx`) enforces that these stay sentinel
until that review happens.

## 2. Chrome localized in this node (done)

- Bottom-nav labels (member + practitioner) via `BOTTOM_NAV_LABEL_KEYS` →
  `nav.*` (home, dashboard, explore, health, journey, coach, communications,
  growth, journal, media, messages, bookings, economic, clients, more).
- Communications binder folders: "With Others" / "With Yourself" titles + subs
  (`comm.withOthers*`, `comm.withYourself*`) and the SubTabs item labels
  (Messages / Journal / Growth / Media).
- Account/profile menu (`menu.myProfile`, `menu.settings`, `menu.identityData`,
  `action.signOut`).
- Language switcher button/popover aria-label + title (`lang.label`).
- Dashboard LUCA recommendation cards, Messages filter chips (All/Bookings/
  Unread), Coach panel three-state chrome (from earlier phases).

## 3. Remaining English chrome (not yet translated — honest gaps)

Full app localization is **out of scope** for this node. The following areas
still contain hardcoded English and need a dedicated localization pass with
native review:

- Explore/marketplace: filter labels, sort options, Map/List toggle text,
  provider-detail section headings, booking flow step copy.
- Health Passport / My Bookings detail copy, Settings/Preferences panels
  (Privacy & Sharing labels), Journal/Growth/Media in-page copy.
- LUCA Coach conversation body microcopy beyond the localized chrome; LUCA
  Intelligence transparency labels beyond `luca.whyThis/assumptions/unknowns`.
- Practitioner portal screens (My Practice, client/appointment management).
- Long-form empty/error/permission/validation state bodies beyond the shared
  `empty.*` / `error.*` keys already present.
- Provider-authored content (names, bios, listing descriptions) intentionally
  stays in the author's language — NOT a translation gap.

## 4. Notes

- No ordinary chrome was left English **within the areas this node touched** —
  every string edited here has an `es` value and passes the parity test.
- Spanish onboarding/auth flows from K1.2 are preserved and were not modified.



---

# NODE K1.4.1 — Live-phone signed-in Spanish correction

K1.4.1 was a focused correction of the K1.4 live-phone pass. On the signed-in
Dashboard the "Your Next Step" card, the approved-journey ("Personalized /
Curated Journey") card, and the Growth To-do + Habit tracker surfaces still had
**hardcoded English mixed into a Spanish page**. Those are the exact strings the
member sees after approving a personalized journey, so the mix was the most
visible remaining gap. All of them are now localized through `tl()` with real
`es` values (not machine sentinels), and en/es parity is enforced.

## Chrome localized in K1.4.1 (done, real Spanish)

- **Next Step card CTA** — the call-to-action verb now resolves from a
  translatable `ctaKey` on each `todoDestination` branch: `cta.checkin`,
  `cta.openJournal`, `cta.play`, `cta.view`, `cta.viewBooking`, `cta.go`,
  `cta.openGrowth`; plus `nextStep.journey_todo.eyebrow`.
- **Approved-journey card** — every previously hardcoded line:
  `journey.approved.syncedMeta`, `.localMeta`, `.onDate`, `.stepsCount`,
  `.ownRhythm`, `.cadenceRhythm`, `.stepsSuffix`, `.autonomy`, `.fallbackTail`,
  `.savedOnDevice`, `.seeBelow`, `.sync`, `.syncing`, `.dismissAria`.
- **Growth To-do list** — `growth.planEyebrow`, `.todoTitle`, `.doneCount`,
  `.markDone`, `.markNotDone`, `.remove`, `.curatedFrom`, `.emptyHint`,
  `.emptyTitle`, `.emptySub`, `.addGoalPlaceholder`, `.add`; cadence labels
  `journey.todosToday` / `journey.todosWeek` / `journey.todosMonth`.
- **Habit tracker** — `habit.eyebrow`, `.title`, `.todayCount`, `.emptyTitle`,
  `.emptySub`, `.removeHabit`, `.addPlaceholder`.

A runtime test (`nodeK141LivePhoneCorrections.test.jsx`, F11) asserts each of
these keys exists in **both** catalogs, that the Spanish value is neither the
English source nor the `__REVIEW_PENDING__` sentinel, and that en/es stay at full
parity. F12 asserts the splash/welcome use the emblem-only asset with a single
wordmark; F13 asserts the account/language popovers stack above Explore chrome at
360 / 390 / 430 px.

## Still English after K1.4.1 (unchanged honest gaps)

The section-3 list above still stands — Explore/marketplace filter & sort copy,
provider-detail headings, booking-flow step copy, Health Passport / My Bookings
detail bodies, Settings/Preferences panels, LUCA Coach conversation microcopy,
the practitioner portal, and long-form empty/error/permission/validation bodies
beyond the shared `empty.*` / `error.*` keys. Full app localization remains a
dedicated future pass with native review. The four SAFETY_KEYS stay pinned to
`__REVIEW_PENDING__` by design and render reviewed English with an explicit
"translation under review" notice.
