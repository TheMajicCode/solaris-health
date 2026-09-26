# Solaris

**A new architecture for life. Built around the person.**

Health begins long before an appointment. It grows from the food we eat, the land that sustains us, the relationships we trust, and the choices we are free to make. Yet our health stories can become scattered across records, accounts and institutions, leaving us to reconnect the pieces. Solaris begins with a different foundation: the person, and their right to carry their identity, knowledge and care forward throughout their life.

We are building an open health ecosystem connecting people, practitioners and communities through holistic healthcare, regenerative agriculture, personal intelligence and shared economic opportunity. Its foundation is identity first and local first: technology designed around the person, with independent access and recovery paths for their core health records.

**Solaris is an open-source company by conviction. We are committed to releasing all Solaris-developed software under open-source licenses.** We believe progress in healthcare should become a foundation others can inspect, improve and build upon. This repository is available under the [MIT License](LICENSE).

Our engineering requirement is explicit:

> No external protocol, company, relay, signer, wallet, AI model, storage provider or interoperability partner may become necessary for the user to retain access to their identity and core health data.

That requirement includes Solaris itself. It is a design commitment to prove through working software and recovery tests. Read [the full vision](docs/VISION.md) for how open infrastructure, person-controlled intelligence and GPS contribution sharing fit together.

This repository develops the web part of that ecosystem. The intended experience connects a user-controlled Health Passport with an Economic Passport while keeping health records, payment authority and public identity separate. LUCA is the intelligence layer attached to a person's identity and limited by their permission.

**Status: development/beta.** This repository contains the React/Vite web application and Express/PostgreSQL backend, including legacy features being evaluated for retention. It is not a production-readiness certification. The source and roadmap review below is dated **24 September 2026**; deployed behavior requires separate release evidence.

Start with [Current state](docs/CURRENT-STATE.md), [Economic Passport architecture](docs/ECONOMIC-PASSPORT-ARCHITECTURE.md), and [Contributing](CONTRIBUTING.md).

## Product direction

| Surface | Intended responsibility |
| --- | --- |
| Public web | Discovery, practitioner/practice profiles, marketplace information, reviews, verification status and search visibility. Practitioner membership of a practice, clinic, venue or registered business is a target product rule requiring implementation. |
| Health Passport / mobile vault | Local health records, user-controlled sharing, private guidance and progress attestations. Android work is maintained separately in [Solaris-andriod](https://github.com/TheMajicCode/Solaris-andriod); this web review does not establish its current build acceptance. |
| Economic Passport | User-controlled payment connections, private contribution receipts and optional public proof. Wallet integration and recovery must be demonstrated before real-funds use. |
| Clinic companion / future Solaris node | Consented communication with patients, practice operations and eventually a clinic-owned stack. P2P transport, self-hosting and local AI remain separate delivery milestones. |

The web is moving toward a discovery and coordination role. Existing web health routes have **not** yet been removed or isolated by a discovery-only server profile. Verification work includes practitioner/business evidence, reviews, the planned VTV approach and optional Self integration; an identity check alone does not establish professional credentials.

## Payment and contribution direction

These are the owner's selected direction and proposed integrations, not a list of shipped features:

| Component | Intended role / evidence status |
| --- | --- |
| **Breez SDK–Spark** | Preferred Bitcoin (“digital gold”) integration candidate. Existing direct Spark code in this repository is not evidence of a completed Breez integration. |
| **Tether WDK + MoonPay** | Planned digital-dollar and balance top-up integration. The USD₮ network/token and supported ramp markets remain to be selected and tested. |
| **Second Bark / Ark** | Alternative Bitcoin adapter if the first SatsPath integration or recovery tests justify it. No switch is assumed. |
| **SatsPath** | Founder-reported collaboration/co-creation and intended first GPS pilot. Its API, payment lifecycle and reported Second integration need technical evidence. |
| **Alby, Nostr and BTC Map** | Proposed wallet connectivity, optional public contribution proofs and merchant discovery. No formal partnership or working two-way sync is asserted. |
| **RGB** | Research/prototype path for proposed LOVE and GPS assets and optional credential representations. No production issuance, passport NFT or interoperability with the selected wallets is established. |

GPS is Solaris's proposed contribution policy and receipt layer. It may use settled payments or user-consented progress attestations to authorize rewards. It does not require exposing health records with a payment. **Sats rewards are funded Bitcoin payouts; RGB cannot mint sats.** LOVE/GPS asset issuance is a separate design with its own authority, supply, recovery and transfer rules. Existing in-app points are not proof of an issued RGB asset.

Any public contribution trail is optional and separately approved by the user. An npub, wallet or transferable NFT must not become authority to read someone's health records. See the [architecture and primary references](docs/ECONOMIC-PASSPORT-ARCHITECTURE.md) for the proposed boundaries and staged implementation.

## What the inspected source establishes

- React/Vite frontend, Express API, PostgreSQL persistence and an AI-provider abstraction.
- WEB-R1 [PR #3](https://github.com/TheMajicCode/solaris-health/pull/3) merged: LUCA context reads are restricted to the authenticated account. This is source integration, not evidence of deployment.
- Legacy wallet screens and direct Spark adapters remain. The Health NFT screen simulates mint/transfer behavior; older cross-chain and NFT descriptions are not current product promises.
- Payment routes inspected in this review are disabled; GPS allocation records are simulated. New payment SDKs and RGB rewards are not established by the inspected source/manifests.
- Export includes selected, bounded records. Complete export, restore and device-to-device data continuity are not established.
- Maple work is on a separate, diverged branch and has unresolved review findings. Private provider use, local inference and offline fallback are different capabilities; none should be inferred from a provider label.

Known authorization, consent, AI-boundary, messaging/recovery and deployment issues remain. The [current-state register](docs/CURRENT-STATE.md) records the evidence and repair order.

## Development and delivery

```sh
git clone https://github.com/TheMajicCode/solaris-health.git
cd solaris-health
```

Read [AGENTS.md](AGENTS.md), the [bounded workflow](docs/beta-v1/WORKFLOW.md) and [Contributing](CONTRIBUTING.md) before running scripts or changing code. Use a task branch and a disposable development database. Local configuration must not point to the shared hosted database. Never treat legacy seed/deploy scripts as a development prerequisite.

The inspected main tree has no active `.github/workflows` directory; `ci-workflows/` contains drafts. Recorded test runs are documented with their limitations in [Current state](docs/CURRENT-STATE.md). There is no passing CI badge claimed here.

The intended workflow is Claude Code for bounded changes, GitHub for reviewable source, and separately controlled Abacus testing/deployment. A GitHub merge alone is not proof that a domain runs the change. [Historical architecture](docs/ARCHITECTURE.md), [release ledger](docs/beta-v1/RELEASE-LEDGER.md) and accepted contracts remain available as dated records.

## License

[MIT](LICENSE).
