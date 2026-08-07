# Solaris Web App V1 — build spec for rocket.new

**Version 1.0 · 2026-08-04.** The single attachment for the Rocket build. Everything a builder needs that is not in the code.

**Scope:** member Passport + LUCA + practitioner portal + Spark hot wallet. **No Clinic OS.**

---

## PART 1 — What in the Abacus build is real, and what is theatre

Audited directly 2026-08-04. **This is the "features still simulated" item from the master plan's Phase 1.** A builder porting this must know which behaviour to preserve and which to replace.

### ✅ REAL — port the behaviour, rewrite the code

| Feature | Evidence |
|---|---|
| **npub sign-in, end to end** | Real BIP-340 Schnorr (`lib/nostr.js:57`, `@noble/curves`). CSPRNG nonce, 5-min TTL, nonce deleted **before** verify (`auth.js:176,193`). Client keygen + signing (`src/lib/identity-key.js:58,78`). **Secret key never reaches the server.** |
| Email/password auth + JWT | bcrypt, `expiresIn: '7d'` (`middleware/auth.js:19`) |
| Identity spine | `subject_id VARCHAR(40)` on 26 tables, `solaris_identity_bindings` with `'nostr'` already allowed (`023`, `026`) |
| AI provider seam | Real HTTP to Anthropic / OpenAI-compatible (`lib/ai/index.js`, 212 lines) |
| PHI de-identification | `lib/phi-boundary.js` — real regex redaction + sensitivity classification |
| Audit logging | `audit_logs` with actor / purpose / consent scope |
| Rate limiting | `lib/rate-limits.js` + migration `033` |
| Email delivery | Resend, with nodemailer/SMTP fallback (`lib/mailer.js`) |
| Patients · plans · procedures · drafts · documents | Real CRUD, real Postgres |
| AI execution receipts | `ai_execution_receipts`, migration `019` |

### 🟡 SIMULATED **on purpose** — keep simulated in V1, label it in the UI

**These are correct as-is.** They exist to prove a shape before real money moves. Do not "fix" them.

| Feature | What it does | Where |
|---|---|---|
| **GPS shadow receipts** | Computes and records what *would* be allocated. `settled_cents: 0`, `status: 'SIMULATED'`. **Moves zero money by design.** Enforces the invariant that four buckets sum exactly to eligible value. | `lib/gps-shadow.js` |
| **Payment simulation** | `POST /api/payments/simulate` — simulated split, mock proof hashes, animated-receipt data. Header states: *"All values are simulated. No real money moves."* | `routes/payments-sim.js` |
| Wompi checkout | Fiat rail, sandbox only until the legal gate passes | `adapters/WompiAdapter.js` |

**UI requirement: every simulated surface carries a visible label.** The master plan's own store checklist forbids "unlabeled simulations" — this is a rejection risk, not a nicety.

### 🔴 MOCK — **delete, do not port**

| Thing | Why it must go |
|---|---|
| `POST /api/auth/nostr-mock` (`auth.js:259`) | Mints `npub1mock…` — **not a real key.** Those accounts can never sign in via the real path. Dead identities that look live. |
| `mockNsec()` / `mockNpubFromSeed()` (`auth.js:246,249`) | Fake key generators |
| **`users.nostr_nsec_encrypted_mock` column** | A server column shaped to hold a secret key. Contradicts hard rule 7 even holding fake data. **Drop the column.** |
| `key_custody='app_managed'` | Second custody model with no gate between it and `'self'`. V1 is `'self'` only. |

**No migration path.** A mock npub has no private key, so nothing can be derived from it. Affected accounts re-key at first login.

### ⚠️ Two live issues in the real npub path — fix in the Rocket build

1. **The secret key sits in browser `sessionStorage`** (`identity-key.js:23,86`). The author picked the lesser evil over `localStorage` and said so in a comment. It is still a raw key any script on the page can read, and unlike a password it cannot be reset. **V1 must offer NIP-07 extension and NIP-46 remote signer, with in-memory-only as the fallback.**
2. **Derivation uses NIP-06** (`m/44'/1237'/0'/0/0`), which the NIPs repo marks `unrecommended` ("prefer a single nsec"). Decision 72 is open and this is now a change to *shipped* code with a re-keying cost.

---

## PART 2 — The three onboarding screens

**New. These exist nowhere in the current code.** They sit between the existing welcome screen and the Heal/Learn/Earn loop.

```
[Welcome: "You are not broken. Solaris helps you listen to your body."]
        ↓
[1 · Reclaim Your Health]   ← identity key is generated HERE
        ↓
[2 · Reclaim Your Wealth]
        ↓
[3 · Reclaim Your Sovereignty]
        ↓
[Human Journey Loop: Heal · Learn · Earn]
        ↓
[App]
```

**Design direction — CORRECTED 2026-08-04 by reading `src/index.css`.**

> 🔴 **Every prior description of the Solaris palette in our docs was WRONG.** The master plan and every spec derived from it said *"warm pale-mint canvas, dark teal structure, generous white cards."* **The shipped UI is a DARK theme.** Majd has confirmed he loves the actual UI, so the code is the source of truth and the written direction is the error.

**The real palette — VERIFIED from `src/index.css`, 24 CSS custom properties:**

```css
--surface: #0c1322;                    /* deep navy-black — the canvas */
--surface-container-lowest: #0a101d;
--surface-container-low: #151b2b;
--surface-container: #191f2f;
--surface-container-high: #232a3a;
--surface-container-highest: #2e3545;
--surface-bright: #32394a;

--primary: #4edea3;                    /* mint green — the signature */
--primary-container: #10b981;
--secondary: #4fdbc8;                  /* teal */
--tertiary: #ffb95f;                   /* gold */
--tertiary-deep: #e29100;

--on-surface: #dce2f8;                 /* text on dark */
--on-surface-variant: #bbcabf;
--outline: #86948a;
--outline-variant: #3c4a42;
--error: #ffb4ab;

--radius-sm: 0.6rem;  --radius-md: 1.25rem;
--radius-lg: 1.75rem; --radius-xl: 2.25rem;

--font-serif: 'Noto Serif', Georgia, serif;
--font-sans: 'Inter', -apple-system, sans-serif;
--ease: cubic-bezier(0.22, 1, 0.36, 1);
```

**Motion is already defined and is exactly the "breathing" quality wanted:** `--ease: cubic-bezier(0.22,1,0.36,1)` on 0.4–0.6s transitions, with `@keyframes fadeUp` (opacity + 14px rise) and `fadeIn`. **Reproduce these values, do not invent new ones.**

**The component vocabulary already exists** as 40+ named classes in `index.css`: `app-frame · card · card-high · card-low · glass · btn · btn-ghost · btn-tertiary · chip · pill · eyebrow · display · serif · gold · mint · ring-glow · ring-wrap · floaty · fade-in · fade-up · bottom-nav · nav-item · nav-ico · top-bar · wordmark · sol-bg · divider · field-label`. **These names are the design system. Keep them.**

⚠️ **There is no Tailwind config.** Styling is CSS custom properties plus **540 inline `style={{}}` objects across 539 lines** in `LucaPassport.jsx`. Extracting `index.css` alone captures roughly half the design — **the inline styles must be read too.** The upside: plain CSS variables port to Next.js `globals.css` directly, with no Tailwind translation layer.

**Not a generic onboarding carousel.** Motion should feel like breathing — slow, deliberate, never bouncy. Respect `prefers-reduced-motion`; every animation needs a static fallback that still reads.

### The save panel — identical on Screen 1 and Screen 2

**One pattern, learned once, applied twice.** Full reasoning: `IDENTITY-PATHWAY-CONFIRMED.md` §8.

```
  [ Copy ]     [ Download ]     [ Protect with passkey ]
                                 ↑ only when WebAuthn largeBlob is available

  [ Download encrypted backup ]  ← user picks a passphrase; file can go anywhere

  ☐ I have saved this. I understand nobody can recover it for me.
     └── BLOCKING. Spot-check 3 random words/characters before Continue enables.
```

| Control | Ship? | Note |
|---|---|---|
| Copy to clipboard | ✅ | Warn that other apps can read the clipboard |
| Download plain file | ✅ | `Blob` + anchor |
| **Encrypted backup file** | ✅ | Passphrase-encrypted **on device**. This is what replaces "save to Google Drive" — the user can then put the *encrypted* file in Drive, iCloud, email, USB, anywhere. |
| ~~Save raw secret to Google Drive~~ | ❌ **Never** | Puts an unencrypted private key in a third party's cloud, on the exact screen that promises the opposite. |
| Passkey (`largeBlob`) | 🟡 progressive | **VERIFIED 2026-08-04:** Chrome on macOS/Linux/Win11/ChromeOS ✅ · Chrome on Win10 + **Android** ❌ · Safari iOS/iPadOS/macOS 17+ ✅ · Firefox ❌. Cannot be polyfilled. **Feature-detect and offer it when present; never make it the only path.** |

### Screen 1 · Reclaim Your Health

> **Reclaim Your Health**
> You own your data. Secure and private on your device — and it leaves with you, carried by your identity key.

**This screen generates the keypair.** It is the only place in V1 where a key is created.

Sequence:
1. Copy + motion (a form resolving into a key, or data gathering to a centre — designer's call)
2. **Generate keypair client-side.** `@noble/curves` schnorr. Server never sees the secret.
3. Show the **nsec once**, with copy-to-clipboard and a download option
4. **Blocking confirmation** — the user must actively confirm they have saved it. Not a checkbox buried in text; a deliberate action.
5. Register only the npub with the backend

**The backup message — display this, or Majd's edit of it:**

> **This is your key. Not a password — a key.**
>
> It proves this identity is yours, here and anywhere else in Solaris and beyond. Nobody can reset it for you, because nobody else has it. That is the point, and it is the responsibility.
>
> **Write it down on paper.** Not a screenshot, not a notes app.
>
> **Then make a second copy and keep it somewhere a fire or flood would not take with the first.** A copy in a second place is not paranoia; it is the whole plan.
>
> Losing this key means losing this identity and everything under it.

> 🔴 **CORRECTED 2026-08-04 — the previous version of this message was a security flaw, caught by Codex.**
>
> It said: *"give a copy to 3 or 4 people you would trust with your life."* **A complete `nsec` is not a backup — it is full account access.** Anyone holding one can sign in as the member anywhere in Solaris, sign as them on any Nostr app, and at Tier 2 sign consent grants and move value. Handing out four copies creates **four additional full account holders**, none of whom agreed to that responsibility, and any one of whom can be compromised.
>
> **Majd's instinct is right — spread it across people who love you.** The implementation was wrong.
>
> **The correct primitive is Shamir Secret Sharing:** split the key into *N* shares where any *K* reconstruct it. **3-of-5** means no single holder can do anything alone, but any three can help the member recover. That is exactly the intuition, done safely. **Ships as a V2 recovery feature** — mature libraries exist, but it adds onboarding complexity at the moment we are already handling two secrets.
>
> **The V1 approximation, available today at no cost:** give trusted people the **passphrase-encrypted backup file** and keep the passphrase yourself. Each holder has something useless alone. Combined with the **recovery-designate binding** (already specced), that covers most of the loss cases without creating impersonators.
>
> **Majd — the copy above still needs your voice.** You said you had original wording; it is not in my context. Replace it, but **do not reinstate "give them a copy of the key."**

> ⚠️ **Majd — this is my reconstruction.** You said you'd sent me the exact wording in an earlier chat; it is not in my current context. **Replace this block with your original before it ships.** I would rather flag the gap than pass off my version as yours.

### Screen 2 · Reclaim Your Wealth

> **Reclaim Your Wealth**
> With the best tool for measuring energy and respecting value creation known to humanity.

**This screen creates the Spark wallet.** Self-custodial — the seed phrase is the user's, and so is the responsibility.

**Spark SDK, VERIFIED 2026-08-04** from `github.com/buildonspark/spark` — `sdks/js/packages/spark-sdk/README.md`:

```ts
import { SparkWallet } from "@buildonspark/spark-sdk";

// Generates a NEW mnemonic and returns it — this is the onboarding path
const { wallet, mnemonic } = await SparkWallet.initialize({
  options: { network: "MAINNET" },   // "REGTEST" for testing
});
```

Runs in **Browser, Node and React Native** — same SDK for B4 web and B3 mobile.

Sequence:
1. Copy + motion — value flowing, energy becoming form. Restrained.
2. `SparkWallet.initialize()` → returns `{ wallet, mnemonic }`
3. **Show the mnemonic once.** Copy-to-clipboard + download.
4. **Blocking confirmation** — a deliberate action, same gate as Screen 1. Consider a 3-word spot-check rather than a checkbox.
5. Store the Spark address; **the mnemonic never touches the server.**

**The seed-phrase message — display this, or Majd's edit:**

> **This is your money. Self-custodial means exactly that.**
>
> These words *are* the wallet. Anyone who has them has the funds. Nobody — not Solaris, not Spark — can recover them for you or freeze them for anyone else.
>
> **Write them down on paper, in order.** Not a screenshot. Not a notes app. Not a photo.
>
> Store the paper somewhere a fire or a flood would not take along with everything else. A second copy in a second place is not paranoia; it is the whole plan.
>
> **This is a spending wallet.** Keep in it what you would carry in your pocket — not what you would keep in a vault.

> ⚠️ **Majd — replace with your wording if you have it.** Same flag as Screen 1: this is my reconstruction, not your original.

---

### ⚠️ TWO SECRETS IN NINETY SECONDS — an open decision, and it is the same one as D72

**As specified, onboarding hands the user two separate secrets back to back:** an `nsec` on Screen 1, a 12/24-word mnemonic on Screen 2.

**The known failure mode: asked to save two secrets in a row, most people save neither.** The second one feels like a repeat of the first, attention is already spent, and both get "I'll do it later."

**There is a real alternative, and Spark supports it.** The same README shows `initialize()` also accepts a mnemonic you supply:

```ts
const { wallet } = await SparkWallet.initialize({
  mnemonicOrSeed: "your twelve word mnemonic phrase here ...",
  options: { network: "MAINNET" },
});
```

| | **A — Two independent secrets** *(as currently specified)* | **B — One mnemonic, two derivations** |
|---|---|---|
| User saves | nsec **and** a seed phrase | **one seed phrase** |
| Identity key | standalone nsec | BIP-39 → NIP-06 `m/44'/1237'/0'/0/0` |
| Spark wallet | Spark-generated mnemonic | same BIP-39 mnemonic passed to `mnemonicOrSeed` |
| Compromise blast radius | identity **or** money | identity **and** money |
| Portability | nsec imports into any Nostr client | depends on NIP-06, which is marked `unrecommended` |
| Matches existing code? | no — a change | **yes** — `src/lib/identity-key.js` already derives via BIP-39 → NIP-06 |

**Cryptographically B is sound.** Different derivation paths produce different keys; the documented hazard was ever only *one key doing two jobs*, which neither option does.

**This is the same question as Decision 72** (`IDENTITY-CONVERGENCE.md` §7), still open. Answering it here answers both.

**My read:** B halves the backup burden and matches what is already built, at the cost of a single point of failure and a dependency on an `unrecommended` NIP. A is cleaner in principle and asks more of the user at the exact moment they have least patience.

**Majd decides. Do not let a builder pick this by default.** Until he rules, build Screen 2 as specified (Option A) and keep the mnemonic-passing path one line away.

### Screen 3 · Reclaim Your Sovereignty

> **Reclaim Your Sovereignty**
> We are all nodes of sovereign humans and machines, co-creating an open and empowering ecosystem.

Motion: a single node connecting outward into a living network. This is the screen that earns the word "sovereign" — it should feel like joining something, not finishing a form.

### Then: the Human Journey Loop

**Heal · Learn · Earn** — the existing loop screen, unchanged.

---

## PART 3 — What V1 must contain

| Area | Requirement |
|---|---|
| **Identity** | npub sign-in (real) · NIP-07 + NIP-46 support · email+password **and OAuth (whatever Rocket offers cheapest)** as co-equal bindings · **never npub-only for patients** (Decision 61) |
| **Binding UI** | Passport shows: permanent Solaris ID · identity key with tier + **[Unpair]/[Rotate]** · sign-in methods with [Add]/[Remove] · recovery designate. Pattern borrowed from Buzz's *"Identity Connected"*. **`DELETE` on the last usable binding returns 409** — unpair must never lock a user out. |
| **Passport** | Identity · data sources · consent · who-can-see · data locations · export · recovery · AI boundaries |
| **LUCA** | Persistent contextual assistant · typed actions from an allowlist · confirmation on sensitive actions · **non-diagnostic by construction** · AI receipt per response |
| **Practitioner portal** | Clients · consent-scoped Passport view · bookings · availability · profile · earnings |
| **Wallet** | **Spark** self-custodial hot wallet (`@buildonspark/spark-sdk`) — **created in onboarding Screen 2**, seed phrase shown once, never sent to the server |
| **Payments** | GPS shadow receipts stay simulated **and labelled** |

### Hard rules the generated code must never violate

1. **The server never generates or receives an `nsec` or mnemonic.** Reject at the boundary any request body containing `nsec1…`, a raw 64-hex private key, or mnemonic-shaped input. Never log it. *(Codex's addition — detecting only `nsec1…` is incomplete.)*
2. **No PHI** in logs, invoices, payment metadata, or any third-party payload.
3. **AI may draft, summarise, translate, educate, organise. It may never diagnose, prescribe, or decide** clinically, legally or financially.
4. **Human approval, logged**, on anything patient-facing or money-moving.
5. **One canonical API and Postgres.** No second database. No Supabase, no Firebase, no parallel auth.
6. **Every simulated feature is visibly labelled** in the UI.

---

## PART 4 — What Rocket can and cannot inherit

**🔴 VERIFIED 2026-08-04 — Rocket REFUSES the repo outright.** Majd attempted the clone. Rocket's exact response:

> *"This Git repository is not supported, as it does not contain a Next.js application. We detected a Vite + React application (using 'vite' and 'react' in package.json) instead. Rocket supports Next.js + TypeScript projects only."*

**There is no sync path. Do not attempt one again.** This was ASSERTED on 2026-08-03 and is now VERIFIED by the vendor's own error.

**What this means concretely:**
- Rocket starts a **new, empty Next.js + TypeScript project**. The Abacus repo is **reference material attached as files**, never an import.
- **The Express/Postgres Core API stays exactly where it is.** Rocket builds a *client* against it. Nobody rebuilds 48 route modules.
- **Prerequisite nobody has done yet:** the Core API must be **deployed and reachable** (Render/Railway per the master plan) before the Rocket app can call anything real. Until then Rocket works against synthetic adapters.

| Transfers | Must be rebuilt |
|---|---|
| Database schema (35 migrations) | Every React component |
| API route shapes and contracts | All routing (state-based → Next.js) |
| Business logic and rules | The 5,498-line `LucaPassport.jsx` — **extract behaviour, never copy the file** |
| LUCA action registry | All styling |
| The identity/auth *flow* | — |

**The Core API stays where it is.** Rocket builds a Next.js client against it. It does not rebuild the backend.

### Files to attach to Rocket as context

> 🔴 **SUPERSEDED 2026-08-04 — D36. The list below is wrong and cannot be executed.**
> **Rocket projects support a maximum of 5 context sources**, counting uploaded files, Drive links and Notion pages together — VERIFIED at `docs.rocket.new/getting-started/project/context/file-uploads`. This list names eight, and four of them are source-code files, which Rocket does not accept as context at all (MD · PDF · XLSX · CSV · images only).
> **The replacement is the `solaris-portal/` scaffold repo**, which carries the whole spec in `/docs/` as repo files with no count limit. The 5 upload slots are a secondary channel — see `ROCKET-SCAFFOLD-PLAN.md` §Context strategy.

**Original list, kept for the record:**

1. **This file**
2. `backend/migrations/` — all 35, for the schema
3. `backend/src/routes/auth.js` — the real npub flow to reproduce
4. `backend/src/lib/nostr.js` — the verification contract
5. `src/lib/identity-key.js` — client keygen/signing to port
6. `backend/src/routes/luca.js` — the LUCA action registry
7. `AGENT-OS/sovereign-stack/IDENTITY-CONVERGENCE.md` — why `subject_id` is the spine
8. `openapi.yaml` — **once Codex produces it**

**Do not attach:** `LucaPassport.jsx` (5,498 lines — it will get copied), any `.env`, any patient file.

---

## PART 5 — Build order in Rocket

**One vertical slice per prompt. Never "build everything."** If a prompt changes more than one slice, adds a datastore, or rewrites something working — stop and revert to the last accepted tag.

1. Shell · design tokens · routing · API client
2. **The three onboarding screens** — real client-side keygen (Screen 1) **and real Spark wallet creation (Screen 2)** ← the differentiator, build it early
3. npub sign-in + email binding + session
4. Passport: identity → sources → consent → export
5. LUCA: thread → typed actions → confirmation → receipt
6. Practitioner portal: clients → consent-scoped view → bookings
7. Wallet surface — balance, receive, send, Lightning invoice (the wallet itself already exists from Screen 2)
8. GPS shadow receipts, labelled

Every slice ships with: loading · empty · error · offline · retry · permission-denied · expired-session · revoked-consent.
