# User Guide

A walkthrough of **LUCA Passport** for each role. Try it live at
**[solaris-health.abacusai.cloud](https://solaris-health.abacusai.cloud)**.

## Table of Contents

- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Patient guide](#patient-guide)
- [Practitioner guide](#practitioner-guide)
- [Admin guide](#admin-guide)
- [Owning your data](#owning-your-data)
- [FAQ](#faq)

---

## Getting started

1. Open the app and choose **Sign up** or **Log in**.
2. New patients are guided through the cinematic **Solaris Method** onboarding.
3. After onboarding you land on your **LUCA Passport** — your sovereign health hub.

---

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Patient | `sarah@solaris.health` | `demo123` |
| Practitioner | `elena@solaris.health` | `demo123` |
| Admin | `admin@solaris.health` | `demo123` |

---

## Patient guide

### 1. Onboarding & the Solaris Method
A guided questionnaire scores your **4 Aspects of Being** and **8 Body Systems**,
producing a **360° Vitality Score**, a radar profile, your top focus areas, and a set
of LUCA-suggested starter habits. You may upload labs or photos during intake.

### 2. Your Health Passport
The home of your record:
- **Vitality ring** and **aspects/systems radar** at a glance.
- **Daily check-ins** — log energy, mood, sleep, hydration, and movement.
- **Documents** — your uploaded files.

### 3. Health Timeline
Every event — appointments, vitals, assessments, coach chats, rewards, documents —
merged into one chronological view. Filter by type, date range, or search; events are
clustered by day and paginated.

### 4. Trends
Interactive charts of your metrics over time (7/30/90 days or all). See averages,
ranges, and change deltas to spot what's improving.

### 5. LUCA — your AI concierge
Chat with LUCA for non-diagnostic guidance on sleep, hydration, stress, your scores,
and finding the right practitioner. LUCA never diagnoses — it guides, educates, and
connects.

### 6. Wallet & identity
Connect wallets on **Ethereum, Polygon, Solana, or Bitcoin**:
- Link via a browser wallet (MetaMask, Phantom) or paste an address.
- **Verify ownership** by signing a message (EVM) — no gas, no transaction.
- View live balances and a **Health NFT** identity card; set a primary wallet.

### 7. Rewards (LOVE points)
Earn LOVE points as you engage: account creation (+10), completing your assessment
(+50), finishing onboarding (+25), daily check-ins (+5), and booking requests (+30).

---

## Practitioner guide

Log in as a practitioner to access the **Practitioner Portal**:
- **Profile** — set up your practice profile and specialties.
- **Listings** — appear in the care marketplace.
- **Bookings** — review and respond to incoming booking requests.

---

## Admin guide

Log in as an admin to access the **Admin Console**:
- **Overview** — platform statistics.
- **Users** — browse all accounts.
- **Listings** — approve or update marketplace listings.
- **Bookings** — see all booking activity across the platform.

---

## Owning your data

LUCA Passport is built so you can **take your data with you**. Use the **export**
feature to download a portable vault containing your identity, assessment,
conversation history, contributions, credentials, and an event log — in an open
Markdown + JSONL format that other compatible systems can ingest. Your optional
**DID** and **Nostr npub** identity travel with the export.

---

## FAQ

**Does LUCA give medical advice?**
No. LUCA is a non-diagnostic wellness concierge. Always consult a qualified
professional for medical concerns.

**Is connecting a wallet risky?**
Ownership verification uses a *signature* (`personal_sign`), which never moves funds
or costs gas. The app only reads public balances.

**Can I delete my account?**
Accounts support soft deletion; contact an administrator for full data removal.

**What if the AI service is unavailable?**
LUCA degrades gracefully to an offline rule-based mode, so chat keeps working.
