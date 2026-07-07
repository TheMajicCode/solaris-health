# LUCA Passport V1 — Abacus Build Execution Playbook

## Purpose

This playbook helps build LUCA Passport V1 quickly inside Abacus.AI as a hosted prototype/MVP while keeping the architecture ready to migrate toward Nostr, Lightning/NWC, WDK, QVAC, Pear, Observer Protocol, and local-first Solaris nodes.

The goal is not to build the final sovereign infrastructure immediately. The goal is to create a working, beautiful, testable V1 that proves the whole LUCA experience with mock data and clean adapter layers.

---

## Core Product Definition

**LUCA Passport V1** is the dashboard hub for the Solaris ecosystem.

It combines:

- Sovereign identity
- Health Passport
- Social Passport
- Wallet + GPS contribution flow
- Credentials and badges
- Private vault
- AI assistant
- Agent Hub
- Contribution Ledger
- Aura/Solaris trusted network

V1 should be cloud-hosted for speed but architected as a bridge toward local-first infrastructure.

---

## Non-Negotiable Safety Rules

1. Do not enter real patient private data into the prototype.
2. Do not enter real nsec/private keys.
3. Do not implement real wallet custody in Abacus.
4. Use mock wallet balances and mock GPS flows first.
5. Health data is private by default.
6. Public social/reputation data can later sync to Nostr.
7. AI can suggest, draft, and summarize, but users approve sensitive actions.
8. Engineers must review any Nostr signing, Lightning/NWC, WDK, encryption, or health data code before production.

---

## Recommended Abacus Build Sequence

### Session 1 — Create the UI shell

Paste the Master Prompt into Abacus and ask it to build:

- App shell
- Sidebar navigation
- Dashboard page
- Mock data
- Reusable card components
- Clean visual design
- Responsive layout

### Session 2 — Add all main pages

Ask Abacus to add:

- Identity Passport
- Health Passport
- Social Passport
- Wallet + GPS
- Credentials
- Agent Hub
- Contribution Ledger
- Private Vault
- Network
- Settings

### Session 3 — Add database schema and role modes

Ask Abacus to create mock database tables for:

- users
- roles
- profiles
- health_records
- appointments
- credentials
- badges
- wallet_transactions
- gps_contributions
- agents
- agent_permissions
- network_members
- vault_items
- activity_events

Add role switcher:

- Patient
- Practitioner
- Clinic Admin
- Farmer/Vendor
- Solaris Admin
- Builder/Contributor

### Session 4 — Add AI assistant behavior

Ask Abacus to make the AI Assistant context-aware:

- Patient mode: explain care journey, next appointment, documents needed
- Practitioner mode: summarize patient tasks, pending credentials
- Clinic mode: show daily appointments, payments, follow-ups
- Farmer mode: show orders, contribution score, payments
- Solaris mode: show network onboarding, contribution ledger, GPS flows

### Session 5 — Add integration placeholders

Ask Abacus to add visible “Connect” sections for:

- Nostr identity
- NIP-05
- Lightning/NWC
- Tether WDK
- QVAC local AI
- Pear P2P sync
- Observer Agent DID/VAC
- Local Solaris node

These should be placeholders only, not real integrations yet.

### Session 6 — Test the demo with mock stories

Use these test stories:

1. Patient receives treatment plan from Aura.
2. Practitioner gets verified by Solaris.
3. Farmer receives payment from community order.
4. Aura issues a credential to a patient.
5. LUCA agent suggests next action.
6. Solaris admin reviews GPS contribution ledger.
7. Builder receives proof-of-contribution badge.

---

## Master Prompt for Abacus

Paste this into Abacus as the first build prompt:

```text
Build LUCA Passport V1 as a polished hosted web app prototype.

LUCA Passport V1 is the dashboard hub for the Solaris ecosystem. It is a sovereign identity, health passport, social passport, wallet, contribution, and AI-agent dashboard for humans, patients, practitioners, clinics, farmers, communities, and AI agents.

Important product philosophy:
This V1 is hosted in the cloud for speed, but it must be architected as a bridge toward local-first sovereign infrastructure. Use mock adapters now so that later we can replace modules with Nostr identity, Lightning/NWC, Tether WDK wallet infrastructure, QVAC local AI, Pear Runtime P2P sync, Observer agent credentials, and a local mini-PC/Solaris node.

Build the first version with mock data and a real database/auth if available. Do not implement real private keys, real wallet custody, or real patient medical integrations yet.

Core screens:
1. Dashboard
2. Identity Passport
3. Health Passport
4. Social Passport
5. Wallet + GPS
6. Credentials
7. Agent Hub
8. Contribution Ledger
9. Private Vault
10. Network
11. Settings

Design style:
Premium, clean, futuristic, health-tech + sovereign-tech dashboard. Use a light background, soft gradients, rounded cards, modern icons, elegant typography, and responsive layout. It should look investor-ready and patient-friendly.

Dashboard:
Create a layout similar to a premium SaaS command center. Include cards for:
- User profile: Majd Faiz, @majd.alharharah, npub shortened, NIP-05 majd@luca.health, Lightning address majd@luca.pay, role tags Builder, Clinic Owner, Solaris Member.
- Wallet: sats balance, USD equivalent, send, receive, connect wallet, mini chart, recent activity.
- Reputation: Proof-of-Work Index, reviews, referrals, zaps received, completed programs, community score.
- Health Journey: current care plan, next appointment, treatment timeline, active goals.
- Credentials: Verified Identity, Aura Clinic Owner, Solaris Member, Verified Practitioner Network, Regenerative Supporter, Bitcoin Enabled.
- Private Vault: health records, notes, documents, appointments, preferences, AI memory.
- Trusted Connections: Aura Clinic, Dr. Carolina, Solaris, Farmer Network, Patient Group.
- AI Assistant: next best actions and chat-style guidance.
- Recent Activity: referral reward, credential issued, appointment completed, farmer payment sent, zap received.

Identity Passport:
Show Nostr identity placeholder, public key, NIP-05, linked wallet, recovery education, verification status, roles, trusted devices, connected relays, public profile preview, and key safety reminders.

Health Passport:
Show private health profile, dental treatment history, appointments, active care plan, documents, practitioner notes, consent permissions, health goals, “share with practitioner” button, and FHIR-inspired fields. Make it clear that health data is private by default and not published publicly.

Social Passport:
Show public profile, trusted network, proof-of-contribution feed, badges, reviews, zaps, referrals, public posts, community memberships, and filters for Heal, Learn, Earn, Build, Refer, Support.

Wallet + GPS:
Show mock Lightning wallet connection, NWC placeholder, future WDK placeholder, balance, transactions, GPS split simulator, referral rewards, clinic payments, farmer payments, contribution rewards, and value-flow visualization.

Credentials:
Show badge grid and credential list. Include mock credential issuer, credential status, public/private visibility, expiration, verification level, and issuer notes. Include credentials for Aura Patient, Solaris Member, Practitioner Verified, Farmer Verified, Health Journey Participant, Community Contributor, and LUCA Agent Verified.

Agent Hub:
Show AI agent cards:
- LUCA Personal Agent
- Aura Clinic Agent
- Solaris Coordinator Agent
- Practitioner Assistant
- Farmer Market Agent
- Content Agent
- Finance/GPS Agent

Each agent card should include owner, purpose, permissions, trust score, Observer DID placeholder, wallet permission status, QVAC local AI placeholder, recent actions, approve/revoke buttons, and audit trail.

Contribution Ledger:
Show chronological proof-of-contribution events. Each event has category, issuer/verifier, timestamp, reward impact, public/private status, GPS value score, and source. Include examples: completed appointment, referred patient, attended workshop, purchased regenerative food, published educational content, verified practitioner, supported open-source build.

Private Vault:
Show local-first private storage sections: health records, identity docs, practitioner files, AI memory, notes, consent history, encrypted backups, export data. Emphasize “Your data. Your control.”

Network:
Show ecosystem map of Aura, Solaris, practitioners, patients, farmers, builders, local businesses, communities, and AI agents.

Settings:
Show profile settings, privacy controls, relay settings, wallet permissions, agent permissions, notification settings, export data, developer mode, and migration path to local node.

Technical architecture:
Create clean modules/adapters:
- IdentityProvider: mock now, Nostr later
- WalletProvider: mock now, NWC/WDK later
- AIProvider: cloud now, QVAC/local later
- SocialProvider: mock now, Nostr later
- DataProvider: Abacus database now, local encrypted vault/Pear later
- AgentProvider: mock now, Observer/QVAC later

Build reusable components, clean mock data, and clear routing. Make the app fully navigable and visually impressive. Include placeholder notices where real integrations will be added later.
```

---

## Iteration Prompts

### Improve Visual Quality

```text
Improve the visual design to look more premium, calm, and investor-ready. Keep the light dashboard aesthetic, rounded cards, subtle gradients, clean spacing, and professional typography. Make the dashboard feel like a polished product from a world-class health-tech and sovereign-tech startup.
```

### Add Role Switcher

```text
Add a role switcher in the top bar with these demo roles: Patient, Practitioner, Clinic Admin, Farmer/Vendor, Solaris Admin, Builder. When the role changes, update the cards, suggested actions, recent activity, and visible modules to match that role.
```

### Add Database Schema

```text
Create a database schema or mock data model for LUCA Passport V1 with tables/collections for users, roles, profiles, health_records, appointments, credentials, badges, wallet_transactions, gps_contributions, agents, agent_permissions, network_members, vault_items, activity_events, and audit_logs. Add seed data for Majd, Aura Clinic, Dr. Carolina, Solaris, a patient, a farmer, and a practitioner.
```

### Add AI Assistant

```text
Make the AI Assistant panel context-aware. It should show next best actions based on the selected role and current dashboard state. It should include suggested buttons and explain actions in simple language. It must never diagnose, never spend money, never publish, and never share private data without approval.
```

### Add Integration Roadmap Screen

```text
Add a Developer Roadmap screen that shows future integrations as modules: Nostr identity, NIP-05, NWC Lightning wallet, Tether WDK, QVAC local AI, Pear P2P sync, Observer Agent DID/VAC, FHIR-aligned health records, and local Solaris node. Each module should show status: Mock, Planned, In Progress, or Ready.
```

---

## Manual QA Checklist

### Visual QA

- Sidebar works.
- All pages load.
- Cards are readable.
- Mobile view does not break.
- Dashboard looks premium.
- Role switcher changes content.
- No scary technical jargon on patient screens.

### Product QA

- Patient can understand care journey.
- Practitioner can see assigned tasks.
- Clinic admin can see appointments and credentials.
- Farmer/vendor can see payments and orders.
- Solaris admin can see network and GPS flow.
- Builder can see proof-of-contribution.

### Safety QA

- No real private keys.
- No real wallet custody.
- No real patient data.
- Health data is marked private.
- Agent actions require approval.
- Export/delete data options exist.
- Integration placeholders are clearly labeled.

### Demo QA

Demo should tell this story:

1. Majd logs into LUCA Passport.
2. He sees identity, wallet, reputation, health, and social passport.
3. Aura issues a credential.
4. A patient completes an appointment.
5. A farmer receives a GPS-related payment event.
6. LUCA AI suggests the next best action.
7. Solaris admin sees the contribution ledger.
8. The roadmap shows migration to Nostr, Lightning, WDK, QVAC, Pear, Observer, and local node.

---

## When to Bring an Engineer

Bring an engineer before:

- Nostr login or signing
- NIP-07 / NIP-46 implementation
- Lightning/NWC connection
- WDK wallet proof-of-concept
- QVAC local AI proof-of-concept
- Pear P2P sync
- Observer agent verification
- Encryption
- Health records production use
- Anything involving private keys, payments, or patient data

---

## First Real Pilot Test

Use 6 fake/live-safe profiles:

1. Majd — Builder / Clinic Owner / Solaris Member
2. Aura Clinic — Organization
3. Dra. Carolina — Practitioner
4. Sample Patient — Aura Patient
5. Sample Farmer — Regenerative Vendor
6. Solaris Coordinator — Admin

Do not use real private health details. Use fictional or anonymized data.

---

## Output Goal

At the end of the Abacus build, you should have:

- A public demo URL
- A working dashboard
- Role-based user flows
- Mock data
- Clear migration roadmap
- Screenshots for pitch deck
- Demo script for investors/partners
- A build that can be handed to an engineer for Nostr/Lightning/local-first integration

---

## Sources Reviewed

- Abacus AI Agent Apps How-to: https://abacus.ai/help/chatllm-ai-super-assistant/deepagent-apps
- Abacus AI SuperComputer: https://supercomputer.abacus.ai/
- Abacus AI Agent Tasks: https://abacus.ai/help/chatllm-ai-super-assistant/deepagent-tasks
- Nostr NIPs: https://github.com/nostr-protocol/nips
- Nostr Wallet Connect / NIP-47: https://nips.nostr.com/47
- Nostr Basic Protocol / NIP-01: https://nips.nostr.com/1
- QVAC / Tether GitHub: https://github.com/tetherto/qvac
- WDK Build with AI: https://docs.wdk.tether.io/start-building/build-with-ai/
