# Aura Review Queue V1 — Full Answer

I created the next practical build layer: **Aura Review Queue V1**.

This builds directly on the Aura Brain V1 code repo. It adds a local browser-based staff review queue where Aura staff can open AI-assisted patient drafts, see missing information, review safety flags, edit the response, approve/reject/mark as needs-more-info, and preserve a local audit trail.

## What was built

- Local-only review queue UI
- Python standard-library local server
- Runs on `127.0.0.1:8787`
- Draft cards for every file in `out/drafts/`
- Detailed draft review page
- Editable final patient reply
- Human reviewer field
- Review decision field
- Reviewer notes field
- Copy-to-clipboard workflow
- Local review snapshots in `out/reviews/`
- Local audit log entries in `out/audit/action_log.jsonl`
- Tests for the review queue storage layer
- AI upload context for future coding agents
- Claude Code prompt for improving the review UI
- Staff manual and quick-start docs

## What it does not do

This version intentionally does **not** send messages automatically.

It does not connect to WhatsApp, Gmail, SMS, Meta, Twilio, CRMs, or any third-party API. This is deliberate. The goal is to create the safest first operational layer: draft locally, review locally, approve locally, copy manually.

## How to run it

From inside the repo:

```bash
python3 scripts/run_demo.py
python3 scripts/run_review_queue.py
```

Then open:

```text
http://127.0.0.1:8787
```

## Main files to open first

```text
00_START_HERE/AI_UPLOAD_CONTEXT_REVIEW_QUEUE.md
12_review_queue/QUICK_START.md
12_review_queue/REVIEW_QUEUE_MANUAL.md
scripts/run_review_queue.py
src/aura_brain/review_queue/store.py
src/aura_brain/review_queue/server.py
10_prompts/CLAUDE_CODE_PROMPT_REVIEW_QUEUE.md
```

## Tests run

```bash
python3 scripts/run_demo.py
python3 -m unittest discover tests
```

Result:

```text
Ran 6 tests in 0.016s
OK
```

## Why this is the correct next step

Before importing real patient leads or connecting communication channels, Aura needs a human approval layer. This review queue becomes the safety checkpoint between AI drafting and real clinic operations.

It keeps the LUCA/Aura build aligned with the sovereignty-first principles:

- Local-first
- Identity-first future path
- Human-in-the-loop
- Audit-first
- No hidden cloud dependency
- No automatic action without explicit human approval
- Modular enough to later connect WhatsApp, CRM, Nostr identity, or local model inference

## Next best step

The next best step is to build the **Aura Lead Import Pipeline V1**.

That pipeline should take leads from CSV, website form exports, WhatsApp manual exports, or copied patient messages and convert them into the exact local JSONL format the Aura Brain already understands.

The goal: Aura staff can drop a lead file into an inbox folder, run one command, and the local system generates drafts into the review queue without cloud dependencies or automatic sending.
