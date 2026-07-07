# Aura Brain V1 Code Repo — Full Answer

I created the first actual working local-first code repo for the Aura/LUCA sovereignty build.

## What this is

**Aura Brain V1** is a local-first, identity-first, consent-first, audit-first, human-approved intake agent demo for Aura Holistic Dental Clinic.

It processes fake patient leads and creates:

- structured case summaries
- likely treatment interest categories
- missing information questions
- safety/escalation flags
- WhatsApp-style draft replies
- local audit logs
- human approval status

Nothing is sent externally. No cloud AI is called. No real patient data is included.

## Why this is the right next step

The vision of LUCA/Solaris can become very large: identity, wallets, Nostr, DID, health passport, agentic web, local AI, payments, P2P infrastructure, clinic operating systems, and community nodes. The safest way to make it real is to start with one narrow workflow that proves the pattern.

The workflow is:

**lead → consent check → local knowledge → bounded agent → draft → missing info → safety flag → audit log → human approval.**

That pattern can later expand into WhatsApp, CRM, calendar, local LLMs, QVAC-style edge AI, MCP tools, DID credentials, and Lightning/Spark payments without rebuilding the core philosophy.

## How to run it

```bash
cd aura-brain-v1
python3 scripts/run_demo.py
```

Run tests:

```bash
python3 -m unittest discover tests
```

Generated files appear in:

```text
out/drafts/
out/audit/action_log.jsonl
```

## Most important files

Start here:

```text
00_START_HERE/AI_UPLOAD_CONTEXT.md
```

Agent boundaries:

```text
05_agents/aura_intake_agent/AGENT_CARD.md
05_agents/aura_intake_agent/SYSTEM_PROMPT.md
```

Safety and permissions:

```text
08_security/THREAT_MODEL.md
08_security/PERMISSION_MANIFEST.md
08_security/DATA_MAP.md
```

Working code:

```text
src/aura_brain/intake_agent.py
scripts/run_demo.py
tests/test_intake_agent.py
```

## What to build next

The next best step is a **local review queue UI**.

Instead of reading the generated Markdown draft files manually, Aura staff should see a simple local page with:

- new leads
- AI summary
- missing information
- safety flags
- draft reply
- approve / reject / edit status
- no sending yet

This keeps the next build useful but still safe.

## What not to build yet

Do not connect real WhatsApp sending yet. Do not import real patients yet. Do not connect cloud AI yet. Do not build a full CRM yet. Do not build payments yet.

First prove that the human review workflow is useful inside the clinic.
