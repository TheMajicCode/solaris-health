# GPS Protocol Notes — Source of Truth for the Solaris GPS Showcase

**Source:** `GPS_Protocol_Document_Suite_v1.0.zip` (15 documents, Version 1.0, Status: Working Draft, July 2026 — "Prepared for Solaris, LUCA and the GPS contributor ecosystem").
These notes summarize what the suite actually specifies. Where the current UI conflicts with the suite, **the suite wins**.

> The suite itself notes: "GPS itself remains a proposed protocol until implemented and independently reviewed." Everything in the app is therefore a **simulation / shadow-mode showcase** and must be labeled as such.

---

## 1. What GPS is

- **Name:** "Global Prosperous Split" / **GPS Protocol** (approved external names; also "regenerative value routing", "Economic Passport", "GPS Value Atlas"). Avoid "Great Pyramid Scheme", "tax", "guaranteed passive income", "10% platform commission".
- **One-liner (whitepaper):** "A Lightning-native, identity-aware and agent-ready protocol for regenerative value routing."
- **Core narrative (Communications Guide §1):** "GPS helps a single payment reward the people and systems that made the value possible — automatically, transparently and within a clear limit." The story begins with a user benefit, not with middleware.
- **Open protocol vs Solaris service (Terminology §3):** "The protocol can be implemented independently; Solaris offers a governed implementation." No one party controls GPS.

## 2. The economic model — the numbers the UI must show

### 2.1 Value math (whitepaper)
```
gross_value − refunds − statutory taxes − excluded pass-throughs
  = eligible_value
  = earned_value_pool + GPS_ecosystem_envelope
```

### 2.2 The constitutional 10% cap
- Constitution §5: "The default GPS ecosystem envelope MUST NOT exceed 10% of eligible value." (`gps_envelope_bps: 1000`)
- "The ten canonical domains organize allocations but do not each require one percent."
- Recursion "divides an existing entitlement; it MUST NOT increase the global envelope."
- Comms Guide §5: "The 10% is a maximum standard envelope, not ten mandatory one-percent donations… The preview and receipt show the actual distribution."

### 2.3 The Aura pilot split (whitepaper §19.1) — Solaris default profile
This is the **90/10 model** the app's showcase uses. The suite calls it "an illustrative launch profile, not the universal GPS standard."

| Share | % of eligible value | Purpose (suite wording) |
|---|---|---|
| Provider / clinic earned value | **90.00%** | "Contracted consultation delivery and operations." |
| Solaris coordination within GPS | 4.00% | "Journey coordination, support, software and protocol operations." |
| Regenerative health | 1.50% | "Prevention and patient assistance." |
| Referral and community lineage | 1.00% | Verified onboarding / community lineage. |
| User sovereignty | 1.00% | "Savings/reward in the user passport." |
| Infrastructure and open technology | 1.00% | Nodes, open-source, protocol commons. |
| Local/community or user-selected cause | 1.00% | Place-based public goods or chosen cause. |
| Education / intelligence | 0.50% | Education, LUCA / knowledge commons. |

**Hero fact for the showcase: the provider always receives 90% — the GPS envelope is capped at 10%.**

### 2.4 Money representation
- Terminology §4: "Percentages are stored as integer basis points or millisatoshis, never floating-point money."
- Rounding: "largest remainder" — "deterministic rounding method that preserves the total after integer denomination conversion."
- IDs use stable prefixes: `gps:policy:`, `gps:receipt:`, `gps:category:`, `gps:identity:`.

## 3. Ten canonical domains (Category Registry §2)

Stable dashboard taxonomy — "A category is not a wallet. It is a policy namespace with purpose, eligibility, evidence and limits."

1. User Sovereignty and Personal Prosperity
2. Referral and Community Lineage
3. Sovereign Infrastructure and Node Operators
4. Open Technology, Protocol and Security Commons
5. LUCA, Community Intelligence and Knowledge Commons
6. Regenerative Land, Agriculture, Food, Water and Energy
7. Social, Environmental and Public-Benefit Causes
8. Education and Human Development
9. Regenerative Health Fund
10. Local Community and Place-Based Public Goods

"A category with no qualified contribution may receive zero; its unused budget is redistributed under the policy's normalization rule, not sent to a hidden default recipient."

## 4. Identity above endpoints

- Constitution §6: "Identity is stable above replaceable payment endpoints."
- Solaris ID = "the durable identity and permission graph above wallet endpoints"; it resolves replaceable `payment_endpoints` (lightning_address, NWC, Spark). "Never make an address the identity"; address rotation must not erase contribution history.
- Comms Guide §6: "your Solaris ID can point to a replaceable Lightning address or wallet connection." Lightning today; Spark and Taproot Assets described as "separate future adapters."
- **App implication:** the user's GPS end address defaults to Solaris-managed recipients until the user sets their own endpoint (honest "coming soon" — no real wallet integration yet).

## 5. Settlement (Settlement & Failure Policy)

- "Instant settlement is the default. Intentional float, batching for platform profit and undisclosed netting are prohibited." (Constitution §5)
- Canonical states: PREPARED → PRIMARY_PENDING → PRIMARY_RECEIVED → OUTPUT_SENDING → **SETTLED** | PENDING_RETRY | FALLBACK_REQUIRED | REFUND_PENDING | REFUNDED | DISPUTED | CLOSED.
- "Never represent an attempted output as settled. Never appropriate a failed output." A pending entitlement is **recipient-owned** ("Pending is a failed settlement state, not an investment, deposit or float strategy").
- Fallback hierarchy ends with: "Never default to Solaris general revenue."

## 6. Receipts (Receipt Schema — `gps-receipt/1.0`)

"A GPS receipt is the truth surface of the protocol. It records what was promised, what was attempted, what settled, what remains pending and which evidence supports the transaction. It must never claim a public-good outcome merely because a payment was made."

**Required top-level fields:** `receipt_version`, `receipt_id`, `issuer_id`, `transaction_id`, `created_at` (UTC), `policy {id, version, hash}`, `context_hash`, `eligible_value {asset, amount}`, `earned_value_summary`, `gps_envelope {bps, amount}`, `allocations[]`, `fees`, `settlement_summary {settled, pending, refunded, disputed}`, `evidence_refs`, `privacy_profile`, `signatures`, `corrections` (optional).

**Allocation entry:** `allocation_id`, `recipient_identity_id`, `endpoint_id`, `canonical_category_id`, `role`, `entitlement_msat`, `settled_msat`, `fee_msat`, `status`, `proof_ref`, `evidence_refs`.

**Privacy profiles:** PRIVATE, COUNTERPARTY, PSEUDONYMOUS, PUBLIC_AGGREGATE, TREASURY_TRANSPARENT.

**Corrections:** "Receipts are append-only. A refund, reversal, identity correction, settlement retry or dispute resolution creates a new signed correction receipt that references the original."

**Human-readable receipt must show:** what was purchased + eligible-value basis; provider/earned-value summary; GPS envelope total and category visualization; named recipients where permitted; successful/pending/failed outputs; fees and who paid them; why the policy selected these allocations; privacy and correction status.

Example IDs from the suite: `receipt_version: "gps-receipt/1.0"`, `receipt_id: "gps:receipt:01…"`, `issuer_id: "gps:identity:solaris"`, `policy: {"id":"gps:policy:aura:v0.1","version":"0.1","hash":"…"}`, `eligible_value: {"asset":"BTC","amount_msat":100000000}`, `gps_envelope: {"bps":1000,"amount_msat":10000000}`.

## 7. Auto-configuration (deterministic, AI recommends only)

- "It must produce the same output for the same inputs, policy versions and rounding method." Algorithm `gps-score-v0.1`.
- Scoring weights: direct relevance 20%, measured usage 18%, criticality 15%, evidence quality 15%, outcome impact 10%, user intent 8%, locality 5%, need/scarcity 5%, reliability 4%.
- "AI recommendations cannot silently change production allocation logic." Use "transparent policy with AI recommendations", never "AI decides what everyone deserves".

## 8. Recursion / anti-pyramid safety (Recursive Routing Safety)

- Launch limits: max depth 2; max 32 graph edges; max cascade 20% (2000 bps) of a recipient's entitlement; default retain 90% (min 80%); cycles rejected; policy frozen at invoice creation; "no silent confiscation" of tiny outputs.
- Referrals: "One direct referral + one community lineage at launch." "Do not pay merely because a person recruited another compensated recruiter." Avoid "downline/upline/levels" language.

## 9. Contribution recognition (levels 0–5)

0 Self-claimed (no automatic payment) → 1 System-observed → 2 Peer-attested → 3 Institution-verified → 4 Regulated (license/credential) → 5 Steward (charter authority). "Recognition follows relevant contribution, not status alone."

## 10. Rights, privacy, treasuries, disputes (for surrounding UI copy)

- **Rights (Constitution §3):** identity, consent, receipt, privacy, appeal, economic ("entitlements are not silently converted into platform revenue"), safety, exit rights.
- **Privacy:** "Transparent value routing without transparent private lives." Health records local/consented; precise location "not retained by default"; public reporting aggregated/pseudonymous. Sensitive personal and health data are not required on a public ledger.
- **Treasuries:** purpose-bound restricted balances under charters; "Unspent funds remain restricted; they do not become general Solaris revenue." Individual entitlements normally paid directly; pooling only when necessary.
- **Disputes:** "Receipts are preserved and corrected, not erased"; parties get reasons and an appeal path; only the disputed amount may be held.

## 11. Approved user-facing language (Communications Guide)

- User/patient lead message: "Your payment completes your service and transparently nourishes the people, community and infrastructure supporting your journey."
- Recommended Solaris checkout language (whitepaper): "This transaction includes a 10% Solaris GPS ecosystem allocation. It transparently supports the coordination, people, infrastructure and regenerative systems that power your journey."
- Say "Lightning-native", "instant-first Lightning settlement", "GPS ecosystem allocation", "verified contributor", "regenerative receive policy", "progressive sovereignty".
- FAQ truths: not a tax; not MLM; user can change causes/community for future invoices; personal details private by default; "Does AI control my wallet? No."; failed payouts become recipient-owned pending with retries; "Does 10% always go outside Solaris? The receipt shows the exact split."
- Impact claims ladder: payment proof ≠ delivery ≠ output ≠ outcome ≠ causal impact — "Blockchain proves impact" is a prohibited claim.

## 12. What the Solaris implementation must reflect (decisions)

1. **90% provider share is the hero fact** everywhere GPS is explained (replaces the previous 85/5/5/5 mock).
2. **All GPS percentages, recipients and labels come from one config seam** — `backend/src/lib/gps/protocol-config.js` (mock adapter for the future real protocol adapter) exposed at `GET /api/gps/policy`, mirrored by `src/lib/gps-policy.js` with a static fallback.
3. **Receipts in the UI follow `gps-receipt/1.0` shape** (policy id/version/hash, context hash, eligible value, envelope bps, allocations with category ids and status, settlement summary, privacy profile) — simulated, clearly labeled, no PHI.
4. **Identity-first framing:** the passport identity holds GPS configuration; end address = "Solaris default — set your own (coming soon)".
5. **Everything simulated:** shadow-mode allocations, illustrative values, "Working Draft v1.0" policy references — no real Lightning payments.
