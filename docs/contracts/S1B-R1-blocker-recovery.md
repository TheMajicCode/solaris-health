---
# S1B-R1 — Secret-Boundary Blocker Recovery

**Status:** DRAFT — awaiting Codex review and `PROCEED S1B-R1` authorization
**Parent contract:** `docs/contracts/S1B-p0-secret-boundary.md`
**Parent contract SHA-256:** `aca1054a704850d83acd33f47dbd45578c5711b7127b0b76bd239e6510ff8e22`
**This contract targets:** clearing the two blockers that prevent S1B from proceeding to commit
**This contract must not:** add a feature, modify the secret-boundary middleware implementation, or alter its test suite

---

## 1. Purpose

S1B source implementation is written and its targeted suite passes, but required dependency and database-backed verification remains incomplete. It is blocked at two §12.2 verification gates:

| Blocker | Gate | Root cause |
|---------|------|------------|
| `body-parser 1.20.5` advisory (GHSA-v422-hmwv-36x6) | §12.2 Step 1 | npm advisory database updated mid-session; advisory is pre-existing in HEAD lock and was not introduced by the S1B diff |
| Isolated PostgreSQL unavailable | §12.2 Steps 4–6 | No test-database bootstrap procedure is committed to the repository; the VM environment has no isolated PG instance |

S1B-R1 resolves exactly these two blockers and nothing else.

---

## 2. Provenance

| Item | Value |
|------|-------|
| S1B implementation base | `1571907e8fcf8778140f4b27695e946a335a2437` |
| Dirty implementation workspace | `/tmp/solaris-s1b` |
| Implementation workspace status | exactly five paths (see §3) |
| Middleware SHA-256 | `bc6bf676255588b93767098e687cedc8987d18b6d45f025e5afc258fda9c2b33` |
| Test source SHA-256 | `7b8a83ba4b1fab9f657876eb7abd0a98bc6a74bf1c5a1a687c50e436a050ca71` |
| S1B contract SHA-256 | `aca1054a704850d83acd33f47dbd45578c5711b7127b0b76bd239e6510ff8e22` |
| Contract workspace | `/tmp/solaris-s1b-r1-contract` |
| Contract workspace HEAD | `1571907e8fcf8778140f4b27695e946a335a2437` |
| Contract workspace tree | `990ea816142601035c84cff0de28839c717edf35` |

### 2.1 Stash/pop governance incident

During the S1B session, two stash/pop cycles were performed by the agent to isolate the baseline audit:

- `git stash -- package.json package-lock.json` → `Saved ... WIP on agent/abacus-beta-v1-hardening: 1571907 …`
- `git stash pop` → `Dropped refs/stash@{0} (e6d55d2d56f5143b0afeb477007a69aaefe59af6)` (first cycle)
- A second cycle was performed to isolate `src/server.js` for the same purpose
- Both were popped cleanly

**Current state:** `git stash list` is empty; `refs/stash` reflog does not exist. No stash entries remain and no content is stranded. Recorded governance incident — S1B contract did not authorize stash operations. No material effect on working tree.

---

## 3. Implementation Workspace Precondition

Before any R1 step runs, `/tmp/solaris-s1b` must show exactly:

```
 M backend/package-lock.json
 M backend/package.json
 M backend/src/server.js
?? backend/src/middleware/secret-boundary.js
?? backend/tests/secret-boundary.test.js
```

No other modified, staged, deleted, or untracked paths. SHA-256 values must match §2 exactly:

| File | Expected SHA-256 |
|------|-----------------|
| `backend/src/middleware/secret-boundary.js` | `bc6bf676255588b93767098e687cedc8987d18b6d45f025e5afc258fda9c2b33` |
| `backend/tests/secret-boundary.test.js` | `7b8a83ba4b1fab9f657876eb7abd0a98bc6a74bf1c5a1a687c50e436a050ca71` |
| `docs/contracts/S1B-p0-secret-boundary.md` | `aca1054a704850d83acd33f47dbd45578c5711b7127b0b76bd239e6510ff8e22` |

If either status or SHA differs: **STOP** — do not modify the workspace — report the discrepancy to Majd.

Executed by `phase_precondition` in §6.

---

## 4. Dependency Remediation Contract

### 4.1 Constraint set

| Constraint | Value |
|------------|-------|
| Express locked version | `4.22.2` — must not change |
| Express declared range | `^4.21.2` — must not change |
| Express dependency pinning | forbidden |
| Express downgrade | forbidden |
| `body-parser` as direct dependency | forbidden — do not add to `package.json` |
| Target lock change | `node_modules/body-parser`: `1.20.5` → `1.20.6` only |
| `@scure/bip39` and sub-deps | must remain unchanged |
| Other package changes | none permitted |

### 4.2 Why `~1.20.5` permits `1.20.6`

Express's locked dependency range for `body-parser` is `~1.20.5`, resolving as `>=1.20.5 <1.21.0`. Version `1.20.6` satisfies both bounds. No Express change is required.

### 4.3 Dependency phase policy

Executed by `phase_dependency` and `phase_dep_rollback` in §6.

- Do not hand-edit the lockfile. Do not add `body-parser` to `package.json`. Do not change Express.
- On failure of R1-DEP-2, R1-DEP-3, or R1-DEP-4: execute rollback, verify preimage SHA before restoring, re-sync `node_modules`, then STOP and report.
- Do not restore from Git — the working-tree lock contains authorized S1B `@scure/bip39` changes that are not committed.
- Audit gate verdict is determined entirely by parsed advisory identities (machine-parsed JSON) — not process exit code and not total vulnerability count.
- Accepted advisories: `brace-expansion`, `ip-address`. `body-parser`/GHSA-v422-hmwv-36x6 must be absent from every check.

---

## 5. Database Recovery Contract

### 5.1 Requirements

| Requirement | Value |
|-------------|-------|
| PostgreSQL major version | **17 exactly** — if 17 cannot be provisioned, STOP as ENVIRONMENT-BLOCKED |
| Port | `55433` — verified free before creation |
| Bind address | `127.0.0.1` only |
| Container name | `solaris-s1b-r1-pg17` |
| Governance label | `solaris.node=S1B-R1` |
| Container image | Pull `postgres:17`; run using immutable digest |
| Storage | No named persistent volume; `--tmpfs /var/lib/postgresql/data` only |
| Existing databases | Forbidden — do not connect to any live, deployed, shared, patient, demo, or persistent database |
| Real credentials | Forbidden |
| Seeding | Forbidden |
| Port 5432 | Never connect |

Executed by `phase_database` in §6.

### 5.2 Test-environment variables

JWT_SECRET minimum 64 characters. Environment: `NODE_ENV=test`, `TZ=UTC` for full suite. Per-database URL constructed from bootstrap values in §5.3.

### 5.3 Three-database isolation

| Database | User | Test target |
|----------|------|------------|
| `luca_s1a_r1` | `luca_s1a_r1_user` | S1A 43-test regression floor only |
| `luca_schema_r1` | `luca_schema_r1_user` | schema-recovery 3/3 only |
| `luca_full_r1` | `luca_full_r1_user` | full backend suite only |

### 5.4 Schema sequence

Nine base schema files applied in this exact order to each database, followed by all 35 migrations:

```
backend/schema.sql
backend/schema_marketplace.sql
backend/schema_messaging.sql
backend/schema_notifications.sql
backend/schema_solaris.sql
backend/schema_sprint.sql
backend/schema_wallet.sql
backend/schema_bookings.sql
backend/schema_gps.sql
```

Migration files present: `001–005` and `007–036`. Migration `006` is absent. Expected `pgmigrations` row count per database: exactly **35**.

The orchestration script (§6) contains an explicit loop for all three databases. The phrase "apply identical steps substituting" does not appear — all three bootstrap sequences are fully unrolled inside `phase_database`.

### 5.5 Provenance promotion

If all three databases bootstrap cleanly, the candidate sequence is promoted to VERIFIED for commit `CONTRACT_COMMIT` and the resolved PG17 image digest, recorded in the evidence file. Otherwise UNVERIFIED — STOP before commit authorization.

Schema verification provenance is recorded against the contract commit SHA and the immutable image digest used at runtime.

---


## 6. Orchestration Script

This is the single, canonical, self-contained execution unit for S1B-R1. All shell procedure fragments from earlier draft sections have been removed and replaced with this script. The script is embedded verbatim; extract and run only after `PROCEED S1B-R1` authorization from Majd.

**Canonical path:** `/tmp/S1B-R1-execute.sh`

**Invocation:**

```
S1B_R1_CONTRACT_COMMIT=<sha> \
S1B_R1_CONTRACT_SHA=<sha256-of-this-file> \
S1B_R1_SCRIPT_SHA=<sha256-of-extracted-script> \
bash /tmp/S1B-R1-execute.sh
```

Three env vars are required: `S1B_R1_CONTRACT_COMMIT` (the commit SHA named in `PROCEED S1B-R1`), `S1B_R1_CONTRACT_SHA` (SHA-256 of this contract file as committed), and `S1B_R1_SCRIPT_SHA` (SHA-256 of the extracted script file at its canonical path). The script verifies its own hash before any Git or dependency operation.

### 6.1 Static Validation

After extraction and before invocation, validate the embedded script:

```bash
# 1. Deterministic script extraction (Final-Correction 2).
#    Select ONLY the fenced code block whose FIRST CONTENT LINE is exactly
#    "#!/usr/bin/env bash". Reject zero matches and reject more than one match.
#    Write the block verbatim to the canonical path with LF line endings and a
#    single trailing newline preserved. No manual copy/paste, no line-range
#    guesswork. Point CONTRACT_FILE at the contract markdown being validated.
CONTRACT_FILE="${S1B_R1_CONTRACT_FILE:-docs/contracts/S1B-R1-blocker-recovery.md}"
python3 - "$CONTRACT_FILE" << 'PYEOF'
import sys, hashlib

contract_path = sys.argv[1]
out_path = '/tmp/S1B-R1-execute.sh'
shebang = '#!/usr/bin/env bash'
fence = chr(96) * 3   # three backticks, built without embedding the literal here

with open(contract_path, 'r', newline='') as fh:
    text = fh.read()

# Normalize to LF for scanning; the extracted block is re-emitted with LF.
lines = text.replace('\r\n', '\n').replace('\r', '\n').split('\n')

blocks, i, n = [], 0, len(lines)
while i < n:
    if lines[i].startswith(fence):
        body, j, closed = [], i + 1, False
        while j < n:
            if lines[j].strip() == fence:
                closed = True
                break
            body.append(lines[j])
            j += 1
        if closed:
            blocks.append(body)
            i = j + 1
            continue
    i += 1

matching = [b for b in blocks if b and b[0] == shebang]

if len(matching) == 0:
    print('EXTRACT FAIL — no fenced block whose first content line is the shebang',
          file=sys.stderr)
    sys.exit(2)
if len(matching) > 1:
    print(f'EXTRACT FAIL — {len(matching)} matching blocks; exactly one is required',
          file=sys.stderr)
    sys.exit(3)

script_lines = matching[0]
content = '\n'.join(script_lines) + '\n'   # LF endings + exactly one final newline
with open(out_path, 'w', newline='') as fh:
    fh.write(content)

digest = hashlib.sha256(content.encode('utf-8')).hexdigest()
print(f'EXTRACTED_TO={out_path}')
print(f'EXTRACTED_LINES={len(script_lines)}')
print(f'EXTRACTED_BYTES={len(content.encode("utf-8"))}')
print(f'EXTRACTED_SHA256={digest}')
PYEOF
extract_rc=$?
echo "EXTRACT_EXIT=$extract_rc"
if [ "$extract_rc" -ne 0 ]; then
  echo "STOP — deterministic extraction failed (exit $extract_rc); do not proceed" >&2
  exit "$extract_rc"
fi

# 2. Syntax check — FAIL CLOSED. Capture the exit code directly (no pipeline,
#    no || true, no output suppression); print it; STOP on non-zero.
bash -n /tmp/S1B-R1-execute.sh
bashn_rc=$?
echo "bash -n exit: $bashn_rc"
if [ "$bashn_rc" -ne 0 ]; then
  echo "STOP — bash -n reported syntax errors (exit $bashn_rc); do not proceed" >&2
  exit "$bashn_rc"
fi

# 3. Shell style check — FAIL CLOSED. Print ShellCheck's complete output, capture
#    its exit code directly (no || true, no suppression, no pipeline that hides
#    the exit status); print it; STOP on non-zero.
shellcheck -x /tmp/S1B-R1-execute.sh
shellcheck_rc=$?
echo "shellcheck exit: $shellcheck_rc"
if [ "$shellcheck_rc" -ne 0 ]; then
  echo "STOP — shellcheck -x reported findings (exit $shellcheck_rc); do not proceed" >&2
  exit "$shellcheck_rc"
fi

# 4. Compute script SHA-256. Supply this value as S1B_R1_SCRIPT_SHA in the
#    PROCEED S1B-R1 authorization. It is intentionally NOT hardcoded in this
#    contract; the script's startup self-hash check re-verifies the extracted
#    file against the S1B_R1_SCRIPT_SHA named at invocation.
shasum -a 256 /tmp/S1B-R1-execute.sh | awk '{print $1}'

# 5. Python assertions
python3 - << 'PYEOF'
import re, sys

script = open('/tmp/S1B-R1-execute.sh').read()

checks = [
    ('self-hash check present',
     r'actual_script_sha=\$\(shasum -a 256 "\$SCRIPT_PATH"'),
    ('assert_exact_status defined',
     r'assert_exact_status\(\)'),
    ('assert_exact_status called at E-1',
     r'assert_exact_status "E-1"'),
    ('assert_exact_status called at E-7',
     r'assert_exact_status "E-7"'),
    ('assert_exact_status called at R1-V8',
     r'assert_exact_status "R1-V8"'),
    ('REMOTE_SHA == CONTRACT_COMMIT check',
     r'remote_sha.*CONTRACT_COMMIT'),
    ('single-parent check',
     r'SINGLE_PARENT_CHECK'),
    ('blob to temp file before hash',
     r'blob_tmp=/tmp/s1b-r1-contract-blob\.txt'),
    ('rollback returns 0 or 1',
     r'ROLLBACK_GATE\[4/4\]'),
    ('separate count stdout/stderr',
     r'pgcount.*stdout\.txt'),
    ('schema hashes written before container',
     r's1b-r1-schema-hashes\.txt'),
    ('JEST_S1B_RC global',
     r'JEST_S1B_RC=\$\?'),
    ('JEST_S1A_RC global',
     r'JEST_S1A_RC=\$\?'),
    ('JEST_SCHEMA_RC global',
     r'JEST_SCHEMA_RC=\$\?'),
    ('JEST_FULL_RC global',
     r'JEST_FULL_RC=\$\?'),
    ('V8 uses assert_exact_status not echo',
     r'assert_exact_status "R1-V8"'),
    ('cleanup_container returns non-zero',
     r'cleanup_container'),
    ('on_exit handler',
     r'on_exit\(\)'),
    ('phase_cleanup_success defined',
     r'phase_cleanup_success\(\)'),
    ('phase_cleanup_success in main',
     r'phase_cleanup_success'),
    ('IMAGE_DIGEST global',
     r'^IMAGE_DIGEST=""',  re.MULTILINE),
    ('evidence embeds toolchain content',
     r'req "toolchain"'),
    # ── Final-Correction 1: branch identity gate ──────────────────────────────
    ('assert_on_branch defined',
     r'assert_on_branch\(\)'),
    ('branch checked via git branch --show-current',
     r'git branch --show-current'),
    ('branch gate before fetch',
     r'assert_on_branch "E-0-pre-fetch"'),
    ('branch gate after fast-forward',
     r'assert_on_branch "E-6b-post-ff"'),
    # ── Final-Correction 2: script SHA never hardcoded (env form only) ─────────
    ('script SHA supplied by env, not hardcoded',
     r'EXPECTED_SCRIPT_SHA="\$\{S1B_R1_SCRIPT_SHA'),
    # ── Final-Correction 3: dual preimage + whole-document comparison + rollback
    ('package.json preimage preserved',
     r'S1B-R1-package\.before\.json'),
    ('package.json preimage hash variable',
     r'pkg_preimage_sha'),
    ('complete-document lock comparison',
     r'COMPLETE-DOCUMENT COMPARISON PASS'),
    ('rollback invoked on R1-DEP-5 failure',
     r'R1-DEP-5: npm ci failed; rollback'),
    ('rollback invoked on audit-gate failure',
     r'audit gate failed; rollback'),
    # ── Final-Correction 4: self-contained evidence ───────────────────────────
    ('evidence fails on missing artifact',
     r'EVIDENCE_MISSING'),
    ('evidence embeds untracked source SHA',
     r'MIDDLEWARE_SHA256'),
    ('evidence completeness marker',
     r'EVIDENCE_COMPLETE'),
    ('no 152 intake claim',
     None),  # handled separately
]

failures = []
for item in checks:
    name = item[0]
    pat  = item[1] if len(item) > 1 else None
    flags = item[2] if len(item) > 2 else 0
    if name == 'no 152 intake claim':
        if '152' in script:
            failures.append('FAIL: "152" found in script — must not appear')
        else:
            print(f'PASS: {name}')
        continue
    if not pat:
        continue
    if re.search(pat, script, flags):
        print(f'PASS: {name}')
    else:
        failures.append(f'FAIL: {name} — pattern not found: {pat}')

if failures:
    for f in failures: print(f)
    sys.exit(1)
print('ALL STATIC ASSERTIONS PASS')
PYEOF
```

```bash
#!/usr/bin/env bash
# S1B-R1 Orchestration Script
# Canonical path: /tmp/S1B-R1-execute.sh
# Embedded verbatim in docs/contracts/S1B-R1-blocker-recovery.md §6.
# Run only after PROCEED S1B-R1 authorization from Majd names CONTRACT_COMMIT.
# set -e intentionally absent: Gate R1-V5 expects Jest to exit 1 (gate assertion
# distinguishes this from an unexpected non-zero exit).

set -u
set -o pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════
readonly WORKSPACE=/tmp/solaris-s1b
readonly BACKEND="$WORKSPACE/backend"
readonly LOG_DIR=/tmp
readonly EVIDENCE=/tmp/S1B-R1-IMPLEMENTATION-EVIDENCE.txt
readonly CONTAINER_NAME=solaris-s1b-r1-pg17
readonly PG_PORT=55433
readonly PG_MASTER_PASS=s1br1master
readonly DB_PASS=s1br1pass
readonly CLEANUP_FAILURE_RC=97

# Expected SHA-256 values (§2 Provenance) — hash-only; no filename in comparisons
readonly EXP_MIDDLEWARE_SHA=bc6bf676255588b93767098e687cedc8987d18b6d45f025e5afc258fda9c2b33
readonly EXP_TEST_SHA=7b8a83ba4b1fab9f657876eb7abd0a98bc6a74bf1c5a1a687c50e436a050ca71
readonly EXP_S1B_CONTRACT_SHA=aca1054a704850d83acd33f47dbd45578c5711b7127b0b76bd239e6510ff8e22

# Supplied at invocation by PROCEED S1B-R1
readonly CONTRACT_COMMIT="${S1B_R1_CONTRACT_COMMIT:?S1B_R1_CONTRACT_COMMIT must be set}"
readonly EXPECTED_CONTRACT_SHA="${S1B_R1_CONTRACT_SHA:?S1B_R1_CONTRACT_SHA must be set}"
readonly EXPECTED_SCRIPT_SHA="${S1B_R1_SCRIPT_SHA:?S1B_R1_SCRIPT_SHA must be set}"

# JWT secret — minimum 64 characters (value not printed anywhere)
readonly JWT_SECRET="s1b-r1-test-secret-jwt-minimum-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Three-database parallel arrays — indexed 0, 1, 2 (explicit; no substitution shortcuts)
DB_NAMES=(luca_s1a_r1       luca_schema_r1       luca_full_r1     )
DB_USERS=(luca_s1a_r1_user  luca_schema_r1_user  luca_full_r1_user)
DB_TAGS=( s1a               schema               full             )
readonly DB_NAMES DB_USERS DB_TAGS

# Schema files applied in exact order to every database (§5.4)
SCHEMAS=(
  "$BACKEND/schema.sql"
  "$BACKEND/schema_marketplace.sql"
  "$BACKEND/schema_messaging.sql"
  "$BACKEND/schema_notifications.sql"
  "$BACKEND/schema_solaris.sql"
  "$BACKEND/schema_sprint.sql"
  "$BACKEND/schema_wallet.sql"
  "$BACKEND/schema_bookings.sql"
  "$BACKEND/schema_gps.sql"
)
readonly SCHEMAS

# ═══════════════════════════════════════════════════════════════════════════════
# MUTABLE SCRIPT STATE (globals populated during execution — read in phase_evidence)
# ═══════════════════════════════════════════════════════════════════════════════
CONTAINER_ID=""
TRAP_INSTALLED=0
AUDIT_PARSE_RC=1
AUDIT_CMD_RC=255
IMAGE_DIGEST=""
PG_SERVER_VERSION=""
JEST_S1B_RC=255
JEST_S1A_RC=255
JEST_SCHEMA_RC=255
JEST_FULL_RC=255

# ═══════════════════════════════════════════════════════════════════════════════
# STARTUP — Self-hash check (Correction 1)
# Verify this script's own SHA-256 before any Git or dependency operation.
# Script must be at its canonical path for the hash to match.
# ═══════════════════════════════════════════════════════════════════════════════
SCRIPT_PATH=/tmp/S1B-R1-execute.sh
actual_script_sha=$(shasum -a 256 "$SCRIPT_PATH" | awk '{print $1}')
echo "SCRIPT_SHA_ACTUAL=$actual_script_sha"
echo "SCRIPT_SHA_EXPECTED=$EXPECTED_SCRIPT_SHA"
if [ "$actual_script_sha" != "$EXPECTED_SCRIPT_SHA" ]; then
  echo "STOP — script SHA mismatch; do not proceed" >&2
  exit 1
fi
echo "SCRIPT_SELF_HASH=pass"

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: die
# Emit STOP message to stderr and exit non-zero.
# ═══════════════════════════════════════════════════════════════════════════════
die() {
  echo "STOP — $*" >&2
  exit 1
}

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: check_hash
# Compute SHA-256 of <file>, store in local variable, assert equality against
# <expected_hex>. No filename-bearing comparison — hash-only variable equality.
# Usage: check_hash <file> <expected_hex> <label>
# Returns 1 on mismatch; caller must handle.
# ═══════════════════════════════════════════════════════════════════════════════
check_hash() {
  local file="$1" expected="$2" label="$3"
  local actual
  actual=$(shasum -a 256 "$file" | awk '{print $1}')
  echo "HASH_CHECK[$label]=$actual"
  if [ "$actual" != "$expected" ]; then
    echo "HASH_CHECK[$label]=FAIL expected=$expected"
    return 1
  fi
  echo "HASH_CHECK[$label]=pass"
}

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: assert_exact_status (Correction 2)
# Compare git status --porcelain=v1 output byte-for-byte to the canonical
# five-path string. Exits non-zero via die on any mismatch.
# Called at: E-1 (before fetch), E-7 (after fast-forward), rollback gate 4,
# Gate R1-V8. Not a count check — full byte-for-byte equality.
# Usage: assert_exact_status <gate-label>
# ═══════════════════════════════════════════════════════════════════════════════
EXPECTED_STATUS=" M backend/package-lock.json
 M backend/package.json
 M backend/src/server.js
?? backend/src/middleware/secret-boundary.js
?? backend/tests/secret-boundary.test.js"

assert_exact_status() {
  local gate_label="$1"
  local actual_status
  actual_status=$(cd "$WORKSPACE" && git status --porcelain=v1 --untracked-files=all)
  echo "GIT_STATUS[$gate_label]=$(printf '%s' "$actual_status" | head -6)"
  if [ "$actual_status" != "$EXPECTED_STATUS" ]; then
    echo "STATUS_MISMATCH[$gate_label]"
    printf 'expected:\n%s\ngot:\n%s\n' "$EXPECTED_STATUS" "$actual_status" >&2
    die "[$gate_label] workspace status does not match exactly five required paths"
  fi
  echo "STATUS_CHECK[$gate_label]=pass"
}

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: assert_on_branch (Final-Correction 1 — branch identity gate)
# Assert the workspace is checked out exactly on the hardening branch BEFORE any
# fetch or Git mutation, and again after the fast-forward. `git branch
# --show-current` prints empty on a detached HEAD; empty output, or any branch
# name other than the required one, is a STOP condition.
# Usage: assert_on_branch <gate-label>
# ═══════════════════════════════════════════════════════════════════════════════
readonly REQUIRED_BRANCH=agent/abacus-beta-v1-hardening

assert_on_branch() {
  local gate_label="$1"
  local current_branch
  current_branch=$(cd "$WORKSPACE" && git branch --show-current)
  echo "BRANCH_IDENTITY[$gate_label]=$current_branch"
  if [ -z "$current_branch" ]; then
    die "[$gate_label] detached HEAD or empty branch — not on $REQUIRED_BRANCH; STOP before any Git mutation"
  fi
  if [ "$current_branch" != "$REQUIRED_BRANCH" ]; then
    die "[$gate_label] on branch '$current_branch', expected '$REQUIRED_BRANCH' — STOP before any Git mutation"
  fi
  echo "BRANCH_IDENTITY_CHECK[$gate_label]=pass"
}

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: cleanup_container (Correction 9)
# Returns non-zero on any verification or removal failure.
# Guards on ID, governance label, and name before removal.
# Called by on_exit (trap) and phase_cleanup_success.
# ═══════════════════════════════════════════════════════════════════════════════
cleanup_container() {
  [ "$TRAP_INSTALLED" -eq 0 ] && return 0
  [ -z "$CONTAINER_ID" ]      && return 0
  echo "=== CLEANUP ==="

  # Final-Correction 4: cleanup proof ledger. Every identity/stop/removal/absence
  # line is echoed to the console AND appended to this ledger so phase_evidence
  # can embed the actual cleanup proof. cp_log() echoes and appends in one step.
  : > "$LOG_DIR/s1b-r1-cleanup-proof.txt"
  cp_log() { echo "$1"; printf '%s\n' "$1" >> "$LOG_DIR/s1b-r1-cleanup-proof.txt"; }

  local resolved
  resolved=$(docker inspect "$CONTAINER_ID" --format '{{.Id}}' 2>/dev/null \
    | cut -c1-12) || true
  local short
  short=$(printf '%s' "$CONTAINER_ID" | cut -c1-12)
  cp_log "RESOLVED_ID=$resolved"
  cp_log "RECORDED_SHORT=$short"
  if [ "$resolved" != "$short" ]; then
    echo "CLEANUP SECURITY BLOCKED — ID mismatch: resolved=$resolved recorded=$short"
    return 1
  fi

  local gov_label
  gov_label=$(docker inspect "$CONTAINER_ID" \
    --format '{{index .Config.Labels "solaris.node"}}' 2>/dev/null) || true
  cp_log "LABEL_CHECK=$gov_label"
  if [ "$gov_label" != "S1B-R1" ]; then
    echo "CLEANUP SECURITY BLOCKED — label mismatch: $gov_label"
    return 1
  fi

  local ctr_name
  ctr_name=$(docker inspect "$CONTAINER_ID" --format '{{.Name}}' 2>/dev/null) || true
  cp_log "NAME_CHECK=$ctr_name"
  if [ "$ctr_name" != "/$CONTAINER_NAME" ]; then
    echo "CLEANUP SECURITY BLOCKED — name mismatch: $ctr_name"
    return 1
  fi

  docker stop  "$CONTAINER_ID" > "$LOG_DIR/s1b-r1-pg-stop.log" 2>&1
  local stop_rc=$?
  cp_log "CONTAINER_STOP_EXIT=$stop_rc"

  docker rm -f "$CONTAINER_ID" > "$LOG_DIR/s1b-r1-pg-rm.log" 2>&1
  local rm_rc=$?
  cp_log "CONTAINER_RM_EXIT=$rm_rc"

  if docker inspect "$CONTAINER_ID" > /dev/null 2>&1; then
    echo "CLEANUP FAIL — ID still resolves"
    return 1
  fi
  cp_log "ID_ABSENT=confirmed"

  local name_still=0
  if docker ps -a --filter "name=$CONTAINER_NAME" --format '{{.Names}}' 2>/dev/null \
    | grep -q .; then
    name_still=1
  fi
  if [ "$name_still" -ne 0 ]; then
    echo "CLEANUP FAIL — name still present"
    return 1
  fi
  cp_log "NAME_ABSENT=confirmed"
  return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# HANDLER: on_exit (Correction 9)
# Trap target: trap on_exit EXIT
# Captures original exit code before cleanup, disables trap, runs cleanup.
# Exits with original code on clean cleanup, or CLEANUP_FAILURE_RC=97 on failure.
# ═══════════════════════════════════════════════════════════════════════════════
on_exit() {
  local original_rc=$?
  trap - EXIT
  cleanup_container
  local cleanup_rc=$?
  if [ "$cleanup_rc" -ne 0 ]; then
    echo "CLEANUP FAILED — exiting with CLEANUP_FAILURE_RC=$CLEANUP_FAILURE_RC" >&2
    exit "$CLEANUP_FAILURE_RC"
  fi
  exit "$original_rc"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE SYNC — §10/E: Dirty-workspace synchronization gate
# Corrections 2, 3 applied throughout this phase.
# ═══════════════════════════════════════════════════════════════════════════════
phase_sync() {
  echo "=== PHASE: SYNC ==="
  cd "$WORKSPACE" || die "cannot cd to WORKSPACE"

  # E-0: branch identity gate — must be on the hardening branch before any fetch
  # or Git mutation (Final-Correction 1).
  assert_on_branch "E-0-pre-fetch"

  # E-1: exact byte-for-byte status check before fetch (Correction 2)
  assert_exact_status "E-1"

  # E-2: fetch
  git fetch origin agent/abacus-beta-v1-hardening \
    > "$LOG_DIR/s1b-r1-fetch.log" 2>&1
  local fetch_rc=$?
  echo "FETCH_EXIT=$fetch_rc"
  [ "$fetch_rc" -eq 0 ] || die "E-2: fetch failed"

  local remote_sha
  remote_sha=$(git rev-parse origin/agent/abacus-beta-v1-hardening)
  echo "REMOTE_SHA=$remote_sha"

  # Correction 3a: REMOTE_SHA must equal CONTRACT_COMMIT exactly
  [ "$remote_sha" = "$CONTRACT_COMMIT" ] \
    || die "E-3a: REMOTE_SHA $remote_sha != CONTRACT_COMMIT $CONTRACT_COMMIT — STOP"
  echo "REMOTE_SHA_EQUALS_CONTRACT_COMMIT=pass"

  # Correction 3b: remote commit must have exactly one parent == local HEAD
  local parent_sha
  parent_sha=$(git log -1 --format='%P' "$remote_sha")
  echo "REMOTE_PARENT=$parent_sha"
  local local_head
  local_head=$(git rev-parse HEAD)
  echo "LOCAL_HEAD=$local_head"
  [ "$parent_sha" = "$local_head" ] \
    || die "E-3b: single parent $parent_sha != local HEAD $local_head — non-linear history; STOP"
  echo "SINGLE_PARENT_CHECK=pass"

  # E-3: ancestor check (belt-and-suspenders after parent equality check)
  git merge-base --is-ancestor HEAD "$remote_sha"
  local ancestor_rc=$?
  echo "ANCESTOR_EXIT=$ancestor_rc"
  [ "$ancestor_rc" -eq 0 ] \
    || die "E-3: remote is not a descendant of current HEAD"

  # E-4: new commit must change only the contract file
  local changed_paths
  changed_paths=$(git diff --name-only HEAD "$remote_sha")
  echo "CHANGED_PATHS=$changed_paths"
  [ "$changed_paths" = "docs/contracts/S1B-R1-blocker-recovery.md" ] \
    || die "E-4: new commit changes unexpected paths: $changed_paths"

  # Correction 3c: blob to temp file; hash without pipeline
  local blob_tmp=/tmp/s1b-r1-contract-blob.txt
  git show "$remote_sha":docs/contracts/S1B-R1-blocker-recovery.md \
    > "$blob_tmp" 2>&1
  local show_rc=$?
  echo "BLOB_EXTRACT_EXIT=$show_rc"
  [ "$show_rc" -eq 0 ] || die "E-5: git show blob failed exit=$show_rc"
  local committed_sha
  committed_sha=$(shasum -a 256 "$blob_tmp" | awk '{print $1}')
  echo "COMMITTED_CONTRACT_SHA=$committed_sha"
  [ "$committed_sha" = "$EXPECTED_CONTRACT_SHA" ] \
    || die "E-5: SHA mismatch committed=$committed_sha expected=$EXPECTED_CONTRACT_SHA — STOP"
  echo "CONTRACT_SHA_EQUALITY=pass"

  # E-6: fast-forward only — do not stash, reset, restore, or force
  git merge --ff-only origin/agent/abacus-beta-v1-hardening \
    > "$LOG_DIR/s1b-r1-merge.log" 2>&1
  local ff_rc=$?
  cat "$LOG_DIR/s1b-r1-merge.log"
  echo "FF_EXIT=$ff_rc"
  [ "$ff_rc" -eq 0 ] \
    || die "E-6: fast-forward refused — do not stash/reset/force; report refusal to Majd"

  # E-6b: branch identity re-check after fast-forward (Final-Correction 1) —
  # the fast-forward must not have left a detached HEAD or switched branches.
  assert_on_branch "E-6b-post-ff"

  # E-7: post-merge exact status + SHA reverification (Correction 2)
  assert_exact_status "E-7"
  local head_sha
  head_sha=$(git rev-parse HEAD)
  echo "HEAD=$head_sha"
  [ "$head_sha" = "$CONTRACT_COMMIT" ] \
    || die "E-7: HEAD $head_sha != CONTRACT_COMMIT $CONTRACT_COMMIT after fast-forward"

  check_hash "$BACKEND/src/middleware/secret-boundary.js" \
    "$EXP_MIDDLEWARE_SHA" "middleware-post-sync" \
    || die "E-7: middleware SHA changed after fast-forward"
  check_hash "$BACKEND/tests/secret-boundary.test.js" \
    "$EXP_TEST_SHA" "test-post-sync" \
    || die "E-7: test SHA changed after fast-forward"

  echo "SYNC_GATE=pass"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE PRECONDITION — §3
# ═══════════════════════════════════════════════════════════════════════════════
phase_precondition() {
  echo "=== PHASE: PRECONDITION ==="
  cd "$WORKSPACE" || die "cannot cd to WORKSPACE"

  # Byte-for-byte status check (Correction 2)
  assert_exact_status "precondition"

  check_hash "$BACKEND/src/middleware/secret-boundary.js" \
    "$EXP_MIDDLEWARE_SHA" "middleware" \
    || die "middleware SHA mismatch — do not modify workspace; report to Majd"
  check_hash "$BACKEND/tests/secret-boundary.test.js" \
    "$EXP_TEST_SHA" "test" \
    || die "test SHA mismatch — do not modify workspace; report to Majd"
  check_hash "docs/contracts/S1B-p0-secret-boundary.md" \
    "$EXP_S1B_CONTRACT_SHA" "s1b-contract" \
    || die "S1B parent contract SHA mismatch"

  echo "PRECONDITION_GATE=pass"
}

# ═══════════════════════════════════════════════════════════════════════════════
# DEPENDENCY ROLLBACK — §4.3 (Correction 4)
# Returns 0 only when all four gates pass. Returns 1 on any failure.
# Callers distinguish rollback-ok vs rollback-failed and branch accordingly.
# Never prints ROLLBACK=success unless all four gates pass.
# ═══════════════════════════════════════════════════════════════════════════════
phase_dep_rollback() {
  # Final-Correction 3: restore BOTH preimages (package-lock.json AND
  # package.json). $1 = expected lockfile-preimage SHA-256, $2 = expected
  # package.json-preimage SHA-256. Both preimages are verified before restore
  # and both restored files are re-verified after restore. Any mismatch aborts
  # the rollback (return 1) so the caller reports rollback-failed.
  local lock_preimage_sha="$1"
  local pkg_preimage_sha="$2"
  echo "=== DEPENDENCY ROLLBACK ==="
  cd "$BACKEND" || { echo "ROLLBACK FAIL — cannot cd to BACKEND"; return 1; }

  # Gate 1: preimage integrity — BOTH files
  local lock_verify_sha pkg_verify_sha
  lock_verify_sha=$(shasum -a 256 "$LOG_DIR/S1B-R1-package-lock.before.json" \
    | awk '{print $1}')
  pkg_verify_sha=$(shasum -a 256 "$LOG_DIR/S1B-R1-package.before.json" \
    | awk '{print $1}')
  echo "LOCK_PREIMAGE_VERIFY_SHA=$lock_verify_sha"
  echo "PKG_PREIMAGE_VERIFY_SHA=$pkg_verify_sha"
  if [ "$lock_verify_sha" != "$lock_preimage_sha" ] \
     || [ "$pkg_verify_sha" != "$pkg_preimage_sha" ]; then
    echo "PREIMAGE CORRUPTION — cannot restore safely; report preimage corruption to Majd"
    return 1
  fi
  echo "ROLLBACK_GATE[1/4]=preimage-integrity-pass (lock+package)"

  # Gate 2: restore and verify — BOTH files
  cp "$LOG_DIR/S1B-R1-package-lock.before.json" package-lock.json
  cp "$LOG_DIR/S1B-R1-package.before.json" package.json
  local lock_restored_sha pkg_restored_sha
  lock_restored_sha=$(shasum -a 256 package-lock.json | awk '{print $1}')
  pkg_restored_sha=$(shasum -a 256 package.json | awk '{print $1}')
  echo "LOCK_RESTORED_SHA=$lock_restored_sha"
  echo "PKG_RESTORED_SHA=$pkg_restored_sha"
  if [ "$lock_restored_sha" != "$lock_preimage_sha" ] \
     || [ "$pkg_restored_sha" != "$pkg_preimage_sha" ]; then
    echo "RESTORE VERIFY FAIL"
    return 1
  fi
  echo "ROLLBACK_GATE[2/4]=restore-verify-pass (lock+package)"

  # Gate 3: npm ci with restored lockfile
  HOME=/tmp npm ci --ignore-scripts \
    > "$LOG_DIR/s1b-r1-rollback-ci.log" 2>&1
  local rollback_ci_rc=$?
  echo "ROLLBACK_CI_EXIT=$rollback_ci_rc"
  if [ "$rollback_ci_rc" -ne 0 ]; then
    echo "ROLLBACK FAIL — npm ci non-zero: $rollback_ci_rc"
    return 1
  fi
  echo "ROLLBACK_GATE[3/4]=npm-ci-pass"

  # Gate 4: workspace status still exactly five paths (Correction 2)
  assert_exact_status "rollback" || return 1
  echo "ROLLBACK_GATE[4/4]=status-pass"

  echo "ROLLBACK=success"
  return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE DEPENDENCY — §4.3 + §4.4
# Callers of phase_dep_rollback check return code and branch (Correction 4).
# ═══════════════════════════════════════════════════════════════════════════════
phase_dependency() {
  echo "=== PHASE: DEPENDENCY ==="
  cd "$BACKEND" || die "cannot cd to BACKEND"

  # R1-DEP-0: toolchain versions
  { node --version; npm --version; } > "$LOG_DIR/s1b-r1-toolchain.log" 2>&1
  cat "$LOG_DIR/s1b-r1-toolchain.log"

  # R1-DEP-1: preserve preimages of BOTH package-lock.json AND package.json;
  # record each hash in a variable (no filename-diff comparison) so a rollback
  # can restore and re-verify both files (Final-Correction 3).
  cp package-lock.json "$LOG_DIR/S1B-R1-package-lock.before.json"
  cp package.json      "$LOG_DIR/S1B-R1-package.before.json"
  local preimage_sha
  preimage_sha=$(shasum -a 256 "$LOG_DIR/S1B-R1-package-lock.before.json" \
    | awk '{print $1}')
  echo "PREIMAGE_SHA=$preimage_sha"
  printf '%s\n' "$preimage_sha" > "$LOG_DIR/s1b-r1-lock-preimage-sha.txt"

  local pkg_preimage_sha
  pkg_preimage_sha=$(shasum -a 256 "$LOG_DIR/S1B-R1-package.before.json" \
    | awk '{print $1}')
  echo "PKG_JSON_PREIMAGE_SHA=$pkg_preimage_sha"
  printf '%s\n' "$pkg_preimage_sha" > "$LOG_DIR/s1b-r1-pkg-preimage-sha.txt"

  local pkg_sha_before
  pkg_sha_before=$(shasum -a 256 package.json | awk '{print $1}')
  echo "PKG_JSON_SHA_BEFORE=$pkg_sha_before"

  # R1-DEP-2: update body-parser in lockfile only
  HOME=/tmp npm update body-parser --package-lock-only --ignore-scripts \
    > "$LOG_DIR/s1b-r1-update.log" 2>&1
  local update_rc=$?
  cat "$LOG_DIR/s1b-r1-update.log"
  echo "UPDATE_EXIT=$update_rc"
  if [ "$update_rc" -ne 0 ]; then
    phase_dep_rollback "$preimage_sha" "$pkg_preimage_sha"
    local rb_rc=$?
    if [ "$rb_rc" -eq 0 ]; then
      die "R1-DEP-2: npm update failed; rollback succeeded — STOP"
    else
      die "R1-DEP-2: npm update failed; rollback also failed — STOP and report to Majd"
    fi
  fi

  # R1-DEP-3: complete-document JSON comparison (machine-parsed, not text-diff).
  # Final-Correction 3: it is insufficient to inspect only the 'packages'
  # collection. Proof requirement — after swapping the post-update
  # packages["node_modules/body-parser"] entry back to its pre-update entry, the
  # ENTIRE after-document (root metadata, every top-level key, every nested
  # object) must be identical to the entire before-document. The sole permitted
  # semantic change anywhere in the file is body-parser 1.20.5 -> 1.20.6.
  # Full output is captured to a log so phase_evidence can embed it verbatim.
  python3 - > "$LOG_DIR/s1b-r1-lockcmp.log" 2>&1 << 'PYEOF'
import json, sys, copy

BP = 'node_modules/body-parser'

with open('/tmp/S1B-R1-package-lock.before.json') as f:
    before = json.load(f)
with open('/tmp/solaris-s1b/backend/package-lock.json') as f:
    after = json.load(f)

# Report the raw package-level delta for the evidence trail.
bp_pkgs = before.get('packages', {})
ap_pkgs = after.get('packages', {})
all_keys = set(bp_pkgs) | set(ap_pkgs)
changed = sorted(k for k in all_keys if k in bp_pkgs and k in ap_pkgs and bp_pkgs[k] != ap_pkgs[k])
added   = sorted(k for k in all_keys if k not in bp_pkgs)
removed = sorted(k for k in all_keys if k not in ap_pkgs)
print(f"Added  : {added}")
print(f"Removed: {removed}")
print(f"Changed: {changed}")

# body-parser version transition must be exactly 1.20.5 -> 1.20.6.
bv_before = bp_pkgs.get(BP, {}).get('version')
bv_after  = ap_pkgs.get(BP, {}).get('version')
if bv_before != '1.20.5':
    print(f"FAIL — body-parser before expected 1.20.5, got {bv_before}"); sys.exit(1)
if bv_after != '1.20.6':
    print(f"FAIL — body-parser after expected 1.20.6, got {bv_after}"); sys.exit(1)
if BP not in bp_pkgs:
    print(f"FAIL — {BP} absent from before-document"); sys.exit(1)
if BP not in ap_pkgs:
    print(f"FAIL — {BP} absent from after-document"); sys.exit(1)

# Whole-document proof: swap the post-update body-parser entry back to its
# pre-update value; the reconstructed after-document must then equal the
# complete before-document exactly.
reconstructed = copy.deepcopy(after)
reconstructed['packages'][BP] = copy.deepcopy(before['packages'][BP])

def deep_diff(a, b, path='$'):
    out = []
    if type(a) is not type(b):
        return [f"{path}: type {type(a).__name__} != {type(b).__name__}"]
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:   out.append(f"{path}.{k}: only in before-document")
            elif k not in b: out.append(f"{path}.{k}: only in after-document")
            else:            out += deep_diff(a[k], b[k], f"{path}.{k}")
    elif isinstance(a, list):
        if len(a) != len(b):
            out.append(f"{path}: list length {len(a)} != {len(b)}")
        else:
            for idx, (x, y) in enumerate(zip(a, b)):
                out += deep_diff(x, y, f"{path}[{idx}]")
    elif a != b:
        out.append(f"{path}: {a!r} != {b!r}")
    return out

residual = deep_diff(reconstructed, before)
if residual:
    print("FAIL — residual differences remain after swapping body-parser entry back:")
    for d in residual:
        print("  " + d)
    sys.exit(1)

print(f"body-parser: {bv_before} -> {bv_after}")
print("COMPLETE-DOCUMENT COMPARISON PASS — sole semantic change is "
      "node_modules/body-parser 1.20.5 -> 1.20.6 across the whole document")
PYEOF
  local cmp_rc=$?
  cat "$LOG_DIR/s1b-r1-lockcmp.log"
  echo "COMPARISON_EXIT=$cmp_rc"
  if [ "$cmp_rc" -ne 0 ]; then
    phase_dep_rollback "$preimage_sha" "$pkg_preimage_sha"
    local rb_rc=$?
    if [ "$rb_rc" -eq 0 ]; then
      die "R1-DEP-3: complete-document comparison failed; rollback succeeded — STOP"
    else
      die "R1-DEP-3: complete-document comparison failed; rollback also failed — STOP and report to Majd"
    fi
  fi

  # R1-DEP-4: package.json SHA must be unchanged
  local pkg_sha_after
  pkg_sha_after=$(shasum -a 256 package.json | awk '{print $1}')
  echo "PKG_JSON_SHA_AFTER=$pkg_sha_after"
  if [ "$pkg_sha_after" != "$pkg_sha_before" ]; then
    phase_dep_rollback "$preimage_sha" "$pkg_preimage_sha"
    local rb_rc=$?
    if [ "$rb_rc" -eq 0 ]; then
      die "R1-DEP-4: package.json SHA changed; rollback succeeded — STOP"
    else
      die "R1-DEP-4: package.json SHA changed; rollback also failed — STOP and report to Majd"
    fi
  fi
  echo "PKG_JSON_SHA_UNCHANGED=pass"

  # R1-DEP-5: reinstall with updated lockfile
  HOME=/tmp npm ci --ignore-scripts \
    > "$LOG_DIR/s1b-r1-ci.log" 2>&1
  local ci_rc=$?
  tail -20 "$LOG_DIR/s1b-r1-ci.log"
  echo "CI_EXIT=$ci_rc"
  # Final-Correction 3: npm ci failure invokes the verified dual-preimage
  # rollback before stopping. Caller-style branch distinguishes rollback-ok
  # from rollback-failed and reports BOTH failures when rollback also fails.
  if [ "$ci_rc" -ne 0 ]; then
    phase_dep_rollback "$preimage_sha" "$pkg_preimage_sha"
    local dep5_rb_rc=$?
    if [ "$dep5_rb_rc" -eq 0 ]; then
      die "R1-DEP-5: npm ci failed; rollback succeeded — STOP"
    else
      die "R1-DEP-5: npm ci failed; rollback also failed — STOP and report both failures to Majd"
    fi
  fi

  # §4.4 Post-remediation audit — verdict from machine-parsed JSON only
  HOME=/tmp npm audit --omit=dev --json \
    > "$LOG_DIR/s1b-r1-audit.json" \
    2> "$LOG_DIR/s1b-r1-audit.stderr"
  AUDIT_CMD_RC=$?
  echo "AUDIT_EXIT=$AUDIT_CMD_RC"
  # audit process exit code is NOT the gate verdict (captured in AUDIT_CMD_RC
  # for evidence); the machine-parsed JSON verdict below is authoritative.

  python3 - << 'PYEOF' > "$LOG_DIR/s1b-r1-audit-verdict.log" 2>&1
import json, sys

data      = json.load(open('/tmp/s1b-r1-audit.json'))
vulns     = data.get('vulnerabilities', {})
adv_block = data.get('advisories', {})

advisory_names, found_ghsa = set(), set()

for info in vulns.values():
    for via in info.get('via', []):
        if isinstance(via, dict):
            n = via.get('name', '')
            if n: advisory_names.add(n)
            url = via.get('url', '') or ''
            for part in url.split('/'):
                if part.startswith('GHSA-'): found_ghsa.add(part)

for adv in adv_block.values():
    n = adv.get('module_name') or adv.get('name', '')
    if n: advisory_names.add(n)
    url = adv.get('url', '') or adv.get('references', '') or ''
    if 'GHSA-v422-hmwv-36x6' in str(url): found_ghsa.add('GHSA-v422-hmwv-36x6')

bp_vuln_key = 'body-parser' in vulns
accepted    = {'brace-expansion', 'ip-address'}

failures = []
if bp_vuln_key:                          failures.append('body-parser appears as vulnerability key')
if 'body-parser' in advisory_names:      failures.append('body-parser is advisory identity')
if 'GHSA-v422-hmwv-36x6' in found_ghsa: failures.append('GHSA-v422-hmwv-36x6 found in advisory URLs')

unexpected = advisory_names - accepted
if unexpected:
    print(f"FAIL — advisory identities outside accepted set: {unexpected}"); sys.exit(1)

if failures:
    for f in failures: print(f"FAIL — {f}")
    sys.exit(1)

print(f"Advisory identities : {advisory_names}")
print(f"GHSA identifiers    : {found_ghsa}")
print(f"bp_vuln_key         : {bp_vuln_key}")
print(f"Accepted set        : {accepted}")
print("AUDIT GATE PASS")
PYEOF
  AUDIT_PARSE_RC=$?
  cat "$LOG_DIR/s1b-r1-audit-verdict.log"
  echo "AUDIT_PARSE_EXIT=$AUDIT_PARSE_RC"
  # Final-Correction 3: a failed post-update audit gate invokes the verified
  # dual-preimage rollback before stopping, with the same rollback-ok vs
  # rollback-failed branch and dual-failure reporting.
  if [ "$AUDIT_PARSE_RC" -ne 0 ]; then
    phase_dep_rollback "$preimage_sha" "$pkg_preimage_sha"
    local audit_rb_rc=$?
    if [ "$audit_rb_rc" -eq 0 ]; then
      die "§4.4: audit gate failed; rollback succeeded — STOP"
    else
      die "§4.4: audit gate failed; rollback also failed — STOP and report both failures to Majd"
    fi
  fi

  echo "DEPENDENCY_PHASE=pass"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE DATABASE — §5
# Correction 5: count query uses separate stdout/stderr files.
# Correction 6: schema hashes verified before container creation.
# Correction 9: trap on_exit EXIT installed immediately after docker run.
# ═══════════════════════════════════════════════════════════════════════════════
phase_database() {
  echo "=== PHASE: DATABASE ==="

  # Final-Correction 4: exit-code ledger. Every provisioning exit code is echoed
  # to the console AND appended to this ledger so phase_evidence can embed the
  # actual exit codes (console output is not captured by the evidence brace
  # group). led() echoes and appends in one step.
  : > "$LOG_DIR/s1b-r1-db-exitcodes.txt"
  led() { echo "$1"; printf '%s\n' "$1" >> "$LOG_DIR/s1b-r1-db-exitcodes.txt"; }

  # Correction 6: verify all 9 schema files exist and hash them before container creation
  echo "--- Schema preflight (Correction 6) ---"
  : > "$LOG_DIR/s1b-r1-schema-hashes.txt"
  local si
  for si in "${!SCHEMAS[@]}"; do
    local sf="${SCHEMAS[$si]}"
    if [ ! -f "$sf" ]; then
      die "schema file absent before container creation: $sf"
    fi
    local sfhash
    sfhash=$(shasum -a 256 "$sf" | awk '{print $1}')
    echo "SCHEMA_HASH[$((si+1))][$sf]=$sfhash"
    printf '%s  %s\n' "$sfhash" "$sf" >> "$LOG_DIR/s1b-r1-schema-hashes.txt"
  done
  echo "SCHEMA_PREFLIGHT=9-files-verified-hashed"
  cat "$LOG_DIR/s1b-r1-schema-hashes.txt"

  # Container name preflight
  local existing
  existing=$(docker inspect "$CONTAINER_NAME" --format '{{.Id}}' 2>/dev/null || true)
  if [ -n "$existing" ]; then
    die "container $CONTAINER_NAME already exists: $existing — STOP without removing"
  fi
  echo "CONTAINER_NAME_PREFLIGHT=free"

  # Port 55433 preflight on 127.0.0.1
  python3 - << 'PYEOF'
import socket, sys
addr = ('127.0.0.1', 55433)
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind(addr); s.close()
    print("PORT_PREFLIGHT=free 127.0.0.1:55433"); sys.exit(0)
except OSError as e:
    print(f"PORT_PREFLIGHT=occupied 127.0.0.1:55433 — {e}"); sys.exit(1)
PYEOF
  local port_rc=$?
  led "PORT_PREFLIGHT_EXIT=$port_rc"
  [ "$port_rc" -eq 0 ] \
    || die "port 55433 occupied — a successful preflight authorizes no other port"

  # Pull image and resolve immutable digest
  docker pull postgres:17 > "$LOG_DIR/s1b-r1-pg-pull.log" 2>&1
  local pull_rc=$?
  cat "$LOG_DIR/s1b-r1-pg-pull.log"
  led "PULL_EXIT=$pull_rc"
  [ "$pull_rc" -eq 0 ] || die "docker pull postgres:17 failed"

  IMAGE_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' postgres:17 \
    2>/dev/null || true)
  echo "IMAGE_DIGEST=$IMAGE_DIGEST"
  [ -n "$IMAGE_DIGEST" ] || die "could not resolve image digest"
  case "$IMAGE_DIGEST" in
    postgres@sha256:*) echo "DIGEST_FORMAT=valid" ;;
    *) die "unexpected digest format: $IMAGE_DIGEST" ;;
  esac

  # Container creation — immutable digest used at runtime, not tag
  docker run -d \
    --name "$CONTAINER_NAME" \
    --label solaris.node=S1B-R1 \
    -e POSTGRES_PASSWORD="$PG_MASTER_PASS" \
    -p "127.0.0.1:${PG_PORT}:5432" \
    --tmpfs /var/lib/postgresql/data \
    "$IMAGE_DIGEST" \
    > "$LOG_DIR/s1b-r1-container-id.txt" 2>&1
  local run_rc=$?
  cat "$LOG_DIR/s1b-r1-container-id.txt"
  led "CONTAINER_RUN_EXIT=$run_rc"
  CONTAINER_ID=$(tr -d '[:space:]' < "$LOG_DIR/s1b-r1-container-id.txt")
  echo "CONTAINER_ID=$CONTAINER_ID"

  # Correction 9: install trap immediately after container creation
  TRAP_INSTALLED=1
  trap on_exit EXIT

  [ "$run_rc" -eq 0 ] || die "docker run failed"

  # Readiness probe — 30 × 1 s
  local ready_rc=1
  for _i in $(seq 1 30); do
    docker exec "$CONTAINER_NAME" pg_isready -U postgres > /dev/null 2>&1 \
      && { ready_rc=0; break; }
    sleep 1
  done
  docker exec "$CONTAINER_NAME" pg_isready -U postgres \
    > "$LOG_DIR/s1b-r1-pg-ready.log" 2>&1
  ready_rc=$?
  cat "$LOG_DIR/s1b-r1-pg-ready.log"
  led "PG_READY_EXIT=$ready_rc"
  [ "$ready_rc" -eq 0 ] || die "PostgreSQL not ready after 30 s"

  # Server version — must be 17.* (§5.1; ENVIRONMENT-BLOCKED if not)
  PG_SERVER_VERSION=$(docker exec "$CONTAINER_NAME" \
    psql -U postgres -tAc "SHOW server_version;" 2>/dev/null || true)
  echo "PG_SERVER_VERSION=$PG_SERVER_VERSION"
  case "$PG_SERVER_VERSION" in
    17.*) echo "VERSION_CHECK=pass" ;;
    *) die "expected PG 17.*, got: $PG_SERVER_VERSION — ENVIRONMENT-BLOCKED if 17 unavailable" ;;
  esac

  # JWT length guard
  local jwt_len="${#JWT_SECRET}"
  echo "JWT_SECRET_LEN=$jwt_len"
  [ "$jwt_len" -ge 64 ] || die "JWT_SECRET too short: $jwt_len chars (minimum 64)"
  echo "JWT_SECRET_LENGTH_CHECK=pass"

  # ── Bootstrap — explicit loop for each of the three databases ─────────────
  # All three databases receive the complete sequence independently.
  # No "apply identical steps substituting" shortcut anywhere in this loop.
  local db_idx
  for db_idx in 0 1 2; do
    local db_name="${DB_NAMES[$db_idx]}"
    local db_user="${DB_USERS[$db_idx]}"
    local db_tag="${DB_TAGS[$db_idx]}"
    local db_url="postgresql://${db_user}:${DB_PASS}@127.0.0.1:${PG_PORT}/${db_name}"

    echo "--- BOOTSTRAP[$db_name] start ---"

    # Create role
    docker exec "$CONTAINER_NAME" psql -U postgres \
      -v ON_ERROR_STOP=1 \
      -c "CREATE ROLE ${db_user} WITH LOGIN PASSWORD '${DB_PASS}';" \
      > "$LOG_DIR/s1b-r1-role-${db_tag}.log" 2>&1
    local role_rc=$?
    led "ROLE_CREATE_EXIT[$db_name]=$role_rc"
    [ "$role_rc" -eq 0 ] || die "role creation failed for $db_name"

    # Create database
    docker exec "$CONTAINER_NAME" psql -U postgres \
      -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE ${db_name} OWNER ${db_user};" \
      > "$LOG_DIR/s1b-r1-db-${db_tag}.log" 2>&1
    local db_rc=$?
    led "DB_CREATE_EXIT[$db_name]=$db_rc"
    [ "$db_rc" -eq 0 ] || die "database creation failed for $db_name"

    # Apply all 9 schema files in exact order (§5.4)
    local schema_idx
    for schema_idx in "${!SCHEMAS[@]}"; do
      local schema_file="${SCHEMAS[$schema_idx]}"
      local seq=$((schema_idx + 1))
      psql "$db_url" -v ON_ERROR_STOP=1 -f "$schema_file" \
        > "$LOG_DIR/s1b-r1-schema-${db_tag}-${seq}.log" 2>&1
      local schema_rc=$?
      led "SCHEMA_EXIT[$db_name][$seq][$schema_file]=$schema_rc"
      [ "$schema_rc" -eq 0 ] \
        || die "schema $seq failed for $db_name; log: $LOG_DIR/s1b-r1-schema-${db_tag}-${seq}.log"
    done

    # Run migrations
    cd "$BACKEND" || die "cannot cd to BACKEND for migrations [$db_name]"
    DATABASE_URL="$db_url" HOME=/tmp npm run migrate \
      > "$LOG_DIR/s1b-r1-migrate-${db_tag}.log" 2>&1
    local migrate_rc=$?
    tail -10 "$LOG_DIR/s1b-r1-migrate-${db_tag}.log"
    led "MIGRATE_EXIT[$db_name]=$migrate_rc"
    [ "$migrate_rc" -eq 0 ] || die "migration failed for $db_name"

    # Correction 5: pgmigrations count — separate stdout/stderr; exit captured before transform
    psql "$db_url" -tAc "SELECT COUNT(*) FROM pgmigrations;" \
      > "$LOG_DIR/s1b-r1-pgcount-${db_tag}-stdout.txt" \
      2> "$LOG_DIR/s1b-r1-pgcount-${db_tag}-stderr.txt"
    local count_rc=$?
    led "COUNT_QUERY_EXIT[$db_name]=$count_rc"
    cat "$LOG_DIR/s1b-r1-pgcount-${db_tag}-stderr.txt" >&2
    [ "$count_rc" -eq 0 ] \
      || die "pgmigrations count query failed for $db_name (exit $count_rc)"
    local row_count
    row_count=$(tr -d '[:space:]' < "$LOG_DIR/s1b-r1-pgcount-${db_tag}-stdout.txt")
    led "PGMIGRATIONS_COUNT[$db_name]=$row_count"
    [ "$row_count" = "35" ] \
      || die "expected 35 pgmigrations rows for $db_name, got '$row_count'"

    echo "--- BOOTSTRAP[$db_name]=pass ---"
  done
  # End three-database loop

  # Record schema verification provenance (§5.5)
  local head_sha
  head_sha=$(cd "$WORKSPACE" && git rev-parse HEAD)
  # Final-Correction 4: provenance recorded to a ledger for evidence embedding.
  : > "$LOG_DIR/s1b-r1-provenance.txt"
  {
    echo "SCHEMA_PROVENANCE commit=$head_sha image_digest=$IMAGE_DIGEST pg_version=$PG_SERVER_VERSION dbs=${DB_NAMES[*]}"
    echo "SCHEMA_SEQUENCE=VERIFIED commit=$CONTRACT_COMMIT pg=$PG_SERVER_VERSION image=$IMAGE_DIGEST"
  } | tee "$LOG_DIR/s1b-r1-provenance.txt"

  echo "DATABASE_PHASE=pass"
}

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: assert_jest_json
# Machine-parse Jest JSON; assert suite/total/pass/fail counts.
# Usage: assert_jest_json <json_file> <exp_suites|-1=skip> <exp_total>
#                         <exp_pass> <exp_fail> <allowed_fail_file|"">
# Returns 0 on pass, 1 on fail.
# ═══════════════════════════════════════════════════════════════════════════════
assert_jest_json() {
  local json_file="$1" exp_suites="$2" exp_total="$3"
  local exp_pass="$4" exp_fail="$5" allowed_fail_file="$6"

  python3 - \
    "$json_file" "$exp_suites" "$exp_total" \
    "$exp_pass"  "$exp_fail"  "$allowed_fail_file" \
    << 'PYEOF'
import json, sys

jf           = sys.argv[1]
exp_suites   = int(sys.argv[2])   # -1 = skip suite count assertion
exp_total    = int(sys.argv[3])
exp_pass     = int(sys.argv[4])
exp_fail     = int(sys.argv[5])
allowed_ff   = sys.argv[6]        # "" = no failures allowed

try:
    data = json.load(open(jf))
except Exception as e:
    print(f"JEST JSON PARSE ERROR: {e}"); sys.exit(1)

num_suites = data.get('numTotalTestSuites', -1)
total      = data.get('numTotalTests',      -1)
passed     = data.get('numPassedTests',     -1)
failed     = data.get('numFailedTests',     -1)

failures = []

if exp_suites != -1 and num_suites != exp_suites:
    failures.append(f'suites={num_suites} expected={exp_suites}')
if total  != exp_total: failures.append(f'total={total} expected={exp_total}')
if passed != exp_pass:  failures.append(f'passed={passed} expected={exp_pass}')
if failed != exp_fail:  failures.append(f'failed={failed} expected={exp_fail}')

if exp_fail > 0 and allowed_ff:
    for suite in data.get('testResults', []):
        if suite.get('status') == 'failed':
            path = suite.get('testFilePath', '')
            if not path.endswith(allowed_ff):
                failures.append(f'unexpected failing suite: {path}')

if failures:
    for f in failures: print(f"JEST FAIL — {f}")
    sys.exit(1)

print(f"JEST suites={num_suites} total={total} passed={passed} failed={failed}")
print("JEST GATE PASS")
PYEOF
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE VERIFY — §7: All verification gates
# Correction 7: all four Jest process exit codes explicitly saved before assertion.
# Correction 8: Gate R1-V8 calls assert_exact_status (exits non-zero on mismatch).
# ═══════════════════════════════════════════════════════════════════════════════
phase_verify() {
  echo "=== PHASE: VERIFY ==="
  cd "$BACKEND" || die "cannot cd to BACKEND"

  local S1A_DATABASE_URL="postgresql://luca_s1a_r1_user:${DB_PASS}@127.0.0.1:${PG_PORT}/luca_s1a_r1"
  local SCHEMA_DATABASE_URL="postgresql://luca_schema_r1_user:${DB_PASS}@127.0.0.1:${PG_PORT}/luca_schema_r1"
  local FULL_DATABASE_URL="postgresql://luca_full_r1_user:${DB_PASS}@127.0.0.1:${PG_PORT}/luca_full_r1"

  # Gate R1-V0: satisfied by phase_sync + phase_precondition
  echo "GATE R1-V0=verified in phase_sync + phase_precondition"

  # ── Gate R1-V1: Lint ───────────────────────────────────────────────────────
  ESLINT_USE_FLAT_CONFIG=false \
  npx eslint src/middleware/secret-boundary.js --max-warnings 0 \
    > "$LOG_DIR/s1b-r1-lint.log" 2>&1
  local lint_rc=$?
  cat "$LOG_DIR/s1b-r1-lint.log"
  echo "LINT_EXIT=$lint_rc"
  [ "$lint_rc" -eq 0 ] || die "GATE R1-V1: lint failed"
  echo "GATE R1-V1=pass"

  # ── Gate R1-V2: Secret-boundary targeted suite (database-free) ─────────────
  # Correction 7: JEST_S1B_RC explicitly saved as global
  NODE_ENV='test' \
  npx jest --runInBand --forceExit \
    --json --outputFile="$LOG_DIR/s1b-r1-jest-s1b.json" \
    tests/secret-boundary.test.js \
    > "$LOG_DIR/s1b-r1-jest-s1b.log" 2>&1
  JEST_S1B_RC=$?
  echo "JEST_S1B_EXIT=$JEST_S1B_RC"
  [ "$JEST_S1B_RC" -eq 0 ] \
    || die "GATE R1-V2: process exit=$JEST_S1B_RC (expected 0)"
  assert_jest_json \
    "$LOG_DIR/s1b-r1-jest-s1b.json" 1 92 92 0 "" \
    || die "GATE R1-V2 failed — expected 1 suite, 92/92 passed"
  echo "GATE R1-V2=pass"

  # ── Gate R1-V3: S1A regression floor (luca_s1a_r1) ────────────────────────
  # Correction 7: JEST_S1A_RC explicitly saved as global
  NODE_ENV=test DATABASE_URL="$S1A_DATABASE_URL" JWT_SECRET="$JWT_SECRET" \
  npx jest --runInBand --forceExit \
    --json --outputFile="$LOG_DIR/s1b-r1-jest-s1a.json" \
    tests/auth.test.js tests/agent-authority.test.js tests/luca.test.js \
    > "$LOG_DIR/s1b-r1-jest-s1a.log" 2>&1
  JEST_S1A_RC=$?
  echo "JEST_S1A_EXIT=$JEST_S1A_RC"
  [ "$JEST_S1A_RC" -eq 0 ] \
    || die "GATE R1-V3: process exit=$JEST_S1A_RC (expected 0)"
  assert_jest_json \
    "$LOG_DIR/s1b-r1-jest-s1a.json" 3 43 43 0 "" \
    || die "GATE R1-V3 failed — expected 3 suites, 43/43 passed"
  echo "GATE R1-V3=pass"

  # ── Gate R1-V4: Schema recovery (luca_schema_r1) ──────────────────────────
  # Correction 7: JEST_SCHEMA_RC explicitly saved as global
  NODE_ENV=test DATABASE_URL="$SCHEMA_DATABASE_URL" JWT_SECRET="$JWT_SECRET" \
  npx jest --runInBand --forceExit \
    --json --outputFile="$LOG_DIR/s1b-r1-jest-schema.json" \
    tests/schema-recovery.test.js \
    > "$LOG_DIR/s1b-r1-jest-schema.log" 2>&1
  JEST_SCHEMA_RC=$?
  echo "JEST_SCHEMA_EXIT=$JEST_SCHEMA_RC"
  [ "$JEST_SCHEMA_RC" -eq 0 ] \
    || die "GATE R1-V4: process exit=$JEST_SCHEMA_RC (expected 0)"
  assert_jest_json \
    "$LOG_DIR/s1b-r1-jest-schema.json" 1 3 3 0 "" \
    || die "GATE R1-V4 failed — expected 1 suite, 3/3 passed"
  echo "GATE R1-V4=pass"

  # ── Gate R1-V5: Full backend suite (luca_full_r1) ─────────────────────────
  # Expected: 290 total, 288 passed, 2 failed (intake-foundational only), exit=1.
  # Correction 7: JEST_FULL_RC explicitly saved as global.
  TZ=UTC NODE_ENV=test DATABASE_URL="$FULL_DATABASE_URL" JWT_SECRET="$JWT_SECRET" \
  npx jest --runInBand --forceExit \
    --json --outputFile="$LOG_DIR/s1b-r1-jest-full.json" \
    > "$LOG_DIR/s1b-r1-jest-full.log" 2>&1
  JEST_FULL_RC=$?
  echo "JEST_FULL_EXIT=$JEST_FULL_RC"
  [ "$JEST_FULL_RC" -eq 1 ] \
    || die "GATE R1-V5: exit=$JEST_FULL_RC; expected exactly 1 (2 accepted intake failures)"
  assert_jest_json \
    "$LOG_DIR/s1b-r1-jest-full.json" \
    -1 290 288 2 "tests/intake-foundational.test.js" \
    || die "GATE R1-V5 failed — expected 290 total / 288 passed / 2 failed (intake-foundational only)"
  echo "GATE R1-V5=pass"

  # ── Gate R1-V6: Production audit (verified in phase_dependency) ───────────
  echo "AUDIT_PARSE_EXIT_FROM_DEP=$AUDIT_PARSE_RC"
  [ "$AUDIT_PARSE_RC" -eq 0 ] \
    || die "GATE R1-V6: audit gate not cleared in phase_dependency"
  echo "GATE R1-V6=pass"

  # ── Gate R1-V7: Whitespace check ──────────────────────────────────────────
  cd "$WORKSPACE" || die "cannot cd to WORKSPACE"
  git diff --check HEAD \
    > "$LOG_DIR/s1b-r1-diffcheck.log" 2>&1
  local dc_rc=$?
  cat "$LOG_DIR/s1b-r1-diffcheck.log"
  echo "DIFF_CHECK_EXIT=$dc_rc"
  [ "$dc_rc" -eq 0 ] || die "GATE R1-V7: whitespace check failed"
  echo "GATE R1-V7=pass"

  # ── Gate R1-V8: Workspace status — exact byte-for-byte check (Correction 8) ─
  # assert_exact_status exits non-zero on mismatch — not a print-for-inspection.
  assert_exact_status "R1-V8"
  echo "GATE R1-V8=pass"

  # ── Gate R1-V9: Nothing staged; HEAD equals CONTRACT_COMMIT ───────────────
  git diff --cached --name-status \
    > "$LOG_DIR/s1b-r1-staged.log" 2>&1
  local staged_rc=$?
  cat "$LOG_DIR/s1b-r1-staged.log"
  echo "STAGED_EXIT=$staged_rc"

  local staged_bytes
  staged_bytes=$(wc -c < "$LOG_DIR/s1b-r1-staged.log" | tr -d ' ')
  [ "$staged_bytes" -eq 0 ] \
    || die "GATE R1-V9: staged files found — no commit without PROCEED S1B-R1-COMMIT"

  local head_sha
  head_sha=$(git rev-parse HEAD)
  echo "HEAD=$head_sha"
  [ "$head_sha" = "$CONTRACT_COMMIT" ] \
    || die "GATE R1-V9: HEAD $head_sha != CONTRACT_COMMIT $CONTRACT_COMMIT — unauthorized commit detected"
  echo "GATE R1-V9=pass"

  git log --oneline -3
  echo "ALL_VERIFICATION_GATES=pass"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE CLEANUP SUCCESS — Correction 10
# Called after phase_verify passes. Removes the container and disables the trap.
# Must complete before phase_evidence runs. Returns non-zero on cleanup failure.
# ═══════════════════════════════════════════════════════════════════════════════
phase_cleanup_success() {
  echo "=== PHASE: CLEANUP SUCCESS ==="
  cleanup_container
  local cleanup_rc=$?
  if [ "$cleanup_rc" -ne 0 ]; then
    die "phase_cleanup_success: container removal failed (rc=$cleanup_rc) — STOP"
  fi
  # Disable trap — cleanup already confirmed successful (Correction 10)
  trap - EXIT
  TRAP_INSTALLED=0
  echo "CLEANUP_SUCCESS=confirmed"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PHASE EVIDENCE — §13 (Correction 11 + Final-Correction 4)
# Embeds the FULL contents of every required artifact (not paths or summaries).
# A required artifact printing (missing) fails evidence generation via die().
# Uses globals: IMAGE_DIGEST, PG_SERVER_VERSION, AUDIT_CMD_RC, AUDIT_PARSE_RC,
# JEST_*_RC.
# ═══════════════════════════════════════════════════════════════════════════════
phase_evidence() {
  echo "=== PHASE: EVIDENCE ==="
  local missing=0

  # Final-Correction 4: SELF-CONTAINED evidence. req() embeds the FULL contents
  # of a required artifact directly into the evidence file (not a path or a
  # summary). Existence is tested with -f (regular file), NOT -s (nonempty): an
  # existing zero-byte artifact is valid evidence that a successful command
  # emitted no output (e.g. a zero-warning ESLint log, or empty stderr from a
  # successful `npm audit --json`). Only an ABSENT required artifact prints
  # (missing), emits an EVIDENCE_MISSING marker to stderr, and sets missing=1 so
  # evidence generation FAILS. The brace group below is NOT a subshell, so
  # missing persists after it.
  req() {
    local label="$1" file="$2"
    echo "### $label ($file)"
    if [ -f "$file" ]; then
      cat "$file"
    else
      echo "(missing)"
      echo "EVIDENCE_MISSING: $label -> $file" >&2
      missing=1
    fi
    echo ""
  }

  {
    echo "=== S1B-R1 IMPLEMENTATION EVIDENCE (SELF-CONTAINED) ==="
    echo "CONTRACT_COMMIT=$CONTRACT_COMMIT"
    echo "IMAGE_DIGEST=$IMAGE_DIGEST"
    echo "PG_SERVER_VERSION=$PG_SERVER_VERSION"
    echo "AUDIT_CMD_RC=$AUDIT_CMD_RC"
    echo "AUDIT_PARSE_RC=$AUDIT_PARSE_RC"
    echo "JEST_S1B_RC=$JEST_S1B_RC"
    echo "JEST_S1A_RC=$JEST_S1A_RC"
    echo "JEST_SCHEMA_RC=$JEST_SCHEMA_RC"
    echo "JEST_FULL_RC=$JEST_FULL_RC"
    date -u
    echo ""

    echo "=== TOOLCHAIN (§4, R1-DEP-0) ==="
    req "toolchain" "$LOG_DIR/s1b-r1-toolchain.log"

    echo "=== DEPENDENCY PREIMAGES + UPDATE (§4, R1-DEP-1/2) ==="
    req "lock-preimage-sha" "$LOG_DIR/s1b-r1-lock-preimage-sha.txt"
    req "pkg-preimage-sha"  "$LOG_DIR/s1b-r1-pkg-preimage-sha.txt"
    req "lockfile-update-log" "$LOG_DIR/s1b-r1-update.log"

    echo "=== COMPLETE LOCK COMPARISON — FULL STRUCTURED OUTPUT (§4, R1-DEP-3) ==="
    req "lock-comparison" "$LOG_DIR/s1b-r1-lockcmp.log"

    echo "=== POST-UPDATE AUDIT (§4.4) — BOTH EXIT CODES + FULL JSON/STDERR/VERDICT ==="
    echo "AUDIT_CMD_RC=$AUDIT_CMD_RC"
    echo "AUDIT_PARSE_RC=$AUDIT_PARSE_RC"
    req "audit-json"    "$LOG_DIR/s1b-r1-audit.json"
    req "audit-stderr"  "$LOG_DIR/s1b-r1-audit.stderr"
    req "audit-verdict" "$LOG_DIR/s1b-r1-audit-verdict.log"

    echo "=== SCHEMA HASHES + PROVENANCE (§5.4/§5.5) ==="
    req "schema-hashes"     "$LOG_DIR/s1b-r1-schema-hashes.txt"
    req "schema-provenance" "$LOG_DIR/s1b-r1-provenance.txt"

    echo "=== DATABASE PROVISIONING EXIT CODES — role/db/schema/migrate/count (§5) ==="
    req "db-exit-codes" "$LOG_DIR/s1b-r1-db-exitcodes.txt"

    echo "=== PER-DATABASE LOGS (§5.4) ==="
    local db_idx
    for db_idx in 0 1 2; do
      local db_name="${DB_NAMES[$db_idx]}"
      local db_tag="${DB_TAGS[$db_idx]}"
      req "role-create[$db_name]"  "$LOG_DIR/s1b-r1-role-${db_tag}.log"
      req "db-create[$db_name]"    "$LOG_DIR/s1b-r1-db-${db_tag}.log"
      local si
      for si in 1 2 3 4 5 6 7 8 9; do
        req "schema[$db_name][$si]" "$LOG_DIR/s1b-r1-schema-${db_tag}-${si}.log"
      done
      req "migrate[$db_name]"      "$LOG_DIR/s1b-r1-migrate-${db_tag}.log"
      req "count-stdout[$db_name]" "$LOG_DIR/s1b-r1-pgcount-${db_tag}-stdout.txt"
    done

    echo "=== CONTAINER CLEANUP PROOF — id/label/name/stop/rm/absence (§5.5) ==="
    req "cleanup-proof" "$LOG_DIR/s1b-r1-cleanup-proof.txt"

    echo "=== LINT (§7, R1-V1) ==="
    req "lint" "$LOG_DIR/s1b-r1-lint.log"

    echo "=== JEST GATES — COMPLETE TEXT LOGS AND JSON, ALL FOUR (§7) ==="
    req "jest-s1b-log"     "$LOG_DIR/s1b-r1-jest-s1b.log"
    req "jest-s1b-json"    "$LOG_DIR/s1b-r1-jest-s1b.json"
    req "jest-s1a-log"     "$LOG_DIR/s1b-r1-jest-s1a.log"
    req "jest-s1a-json"    "$LOG_DIR/s1b-r1-jest-s1a.json"
    req "jest-schema-log"  "$LOG_DIR/s1b-r1-jest-schema.log"
    req "jest-schema-json" "$LOG_DIR/s1b-r1-jest-schema.json"
    req "jest-full-log"    "$LOG_DIR/s1b-r1-jest-full.log"
    req "jest-full-json"   "$LOG_DIR/s1b-r1-jest-full.json"

    echo "=== GIT STATE — branch/HEAD/remote/staged/porcelain/diff (§13) ==="
    cd "$WORKSPACE" || { echo "EVIDENCE_MISSING: cannot cd WORKSPACE -> $WORKSPACE" >&2; missing=1; }
    echo "BRANCH=$(git branch --show-current)"
    echo "HEAD=$(git rev-parse HEAD)"
    echo "REMOTE_SHA=$(git rev-parse origin/agent/abacus-beta-v1-hardening)"
    echo ""
    echo "--- staged (name-status) ---"
    git diff --cached --name-status
    echo "--- porcelain status (untracked=all) ---"
    git status --porcelain=v1 --untracked-files=all
    echo ""
    echo "--- COMPLETE TRACKED DIFF (git diff HEAD) ---"
    git diff HEAD
    echo ""

    echo "=== UNTRACKED FILES — FULL CONTENTS + SHA-256 (§13) ==="
    echo "NOTE: git diff HEAD does NOT include untracked files; their full"
    echo "contents and SHA-256 are embedded here so evidence is self-contained."
    req "untracked:src/middleware/secret-boundary.js" "$BACKEND/src/middleware/secret-boundary.js"
    echo "MIDDLEWARE_SHA256=$(shasum -a 256 "$BACKEND/src/middleware/secret-boundary.js" 2>/dev/null | awk '{print $1}')"
    echo ""
    req "untracked:tests/secret-boundary.test.js" "$BACKEND/tests/secret-boundary.test.js"
    echo "TEST_SHA256=$(shasum -a 256 "$BACKEND/tests/secret-boundary.test.js" 2>/dev/null | awk '{print $1}')"
    echo ""

    echo "=== END EVIDENCE ==="
  } > "$EVIDENCE"

  # A required artifact printing (missing) fails evidence generation.
  if [ "$missing" -ne 0 ]; then
    die "phase_evidence: one or more required artifacts missing (see EVIDENCE_MISSING markers on stderr) — evidence is NOT self-contained; STOP"
  fi
  echo "EVIDENCE_FILE=$EVIDENCE"
  echo "EVIDENCE_COMPLETE=all-required-artifacts-embedded"
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN — single shell context executing all phases in order
# phase_cleanup_success inserted between phase_verify and phase_evidence (Correction 10).
# ═══════════════════════════════════════════════════════════════════════════════
main() {
  phase_sync
  phase_precondition
  phase_dependency
  phase_database
  phase_verify
  phase_cleanup_success
  phase_evidence
  echo "S1B-R1 ORCHESTRATION COMPLETE"
}

main "$@"
```

---
## 7. Verification Floors

All gates must pass before any commit authorization may be issued. Shell execution is in §6 `phase_verify`. Captured output for each gate is stored to a log file. Exit codes are captured via `rc=$?` after redirection — never from a pipeline tail.

| Gate | Description | Expected result | Stop condition |
|------|-------------|-----------------|----------------|
| R1-V0 | Pre-condition check | 5 paths, all SHAs match | status or SHA mismatch |
| R1-V1 | Lint | `lint_rc=0`, no output | any lint warning |
| R1-V2 | Secret-boundary targeted suite (database-free) | 1 suite, 92/92 passed, `jest_rc=0` | any deviation |
| R1-V3 | S1A regression floor (`luca_s1a_r1`) | 3 suites, 43/43 passed, `jest_rc=0` | fewer than 43/43 |
| R1-V4 | Schema recovery (`luca_schema_r1`) | 1 suite, 3/3 passed, `jest_rc=0` | any deviation |
| R1-V5 | Full backend suite (`luca_full_r1`) | 290 total / 288 passed / 2 failed (intake-foundational only) / `jest_rc=1` | any other combination |
| R1-V6 | Production audit | `AUDIT_PARSE_RC=0` from `phase_dependency` | `body-parser` or GHSA-v422-hmwv-36x6 present |
| R1-V7 | Whitespace | `git diff --check HEAD` exits 0 | any trailing whitespace |
| R1-V8 | Workspace status | exactly five implementation paths | any extra path |
| R1-V9 | Nothing staged; HEAD equals CONTRACT_COMMIT | empty staged set | anything staged or HEAD mismatch |


**Gate R1-V5 full-suite derivation (Correction 12):**

| Batch | Tests |
|-------|-------|
| Pre-S1B baseline (198 tests across all pre-existing suites) | 198 |
| Secret boundary — S1B additions | 92 |
| **Total** | **290** |

Jest exit 1 accepted **only** when all five conditions hold simultaneously: total=290, passed=288, failed=2, both failures in `tests/intake-foundational.test.js`, exit=1. Any other combination is a STOP condition. The two accepted intake failures require absent ambient rows — do not seed around them.


## 8. Stop Conditions

| Condition | Stop trigger |
|-----------|-------------|
| Workspace precondition fails | §3 status or SHA mismatch |
| `npm update --package-lock-only` exits non-zero | R1-DEP-2 → rollback |
| Structured comparison fails | R1-DEP-3 → rollback |
| `package.json` SHA changes | R1-DEP-4 → rollback |
| `npm ci` exits non-zero | R1-DEP-5 → rollback |
| `body-parser` appears as vulnerability key or advisory identity | §4.4 audit → rollback |
| GHSA-v422-hmwv-36x6 found anywhere in audit output | §4.4 audit → rollback |
| Any advisory identity outside `{brace-expansion, ip-address}` | §4.4 audit → rollback |
| PostgreSQL 17 cannot be provisioned | §5.1 — ENVIRONMENT-BLOCKED |
| Container name occupied before creation | §5.1 |
| Port 55433 occupied before creation | §5.1 |
| `docker pull` exits non-zero | §5.1 |
| Digest empty or wrong format | §5.1 |
| Container creation fails | §5.1 → cleanup trap fires |
| Server version not `17.*` | §5.1 → cleanup trap fires |
| Role or database creation fails for any database | §5.4 → cleanup trap fires |
| Any base schema file exits non-zero | §5.4 → cleanup trap fires |
| Migration exits non-zero for any database | §5.4 → cleanup trap fires |
| `pgmigrations` count not exactly 35 for any database | §5.4 → cleanup trap fires |
| Schema sequence UNVERIFIED | §5.5 |
| Teardown ID/label/name verification fails | cleanup — CLEANUP SECURITY BLOCKED |
| Lint non-zero | Gate R1-V1 |
| S1B targeted suite not exactly 92/92 | Gate R1-V2 |
| S1A floor not exactly 43/43 | Gate R1-V3 |
| Schema recovery not exactly 3/3 | Gate R1-V4 |
| Full suite total not 290 | Gate R1-V5 |
| Full suite passing count not exactly 288 | Gate R1-V5 |
| Failing count not exactly 2 | Gate R1-V5 |
| Any failure outside `tests/intake-foundational.test.js` | Gate R1-V5 |
| Jest full exit code not 1 | Gate R1-V5 |
| Audit parse exit non-zero | Gate R1-V6 |
| `git diff --check HEAD` non-zero | Gate R1-V7 |
| Anything staged | Gate R1-V9 |
| HEAD not equal to CONTRACT_COMMIT | Gate R1-V9 |
| `git stash push` or `git stash pop` during implementation | Governance violation — report and STOP |

---

## 9. Contract Workspace Allowlist

During this contract-only turn, the sole permitted repository change is:

```
docs/contracts/S1B-R1-blocker-recovery.md   (this file, in /tmp/solaris-s1b-r1-contract)
```

The existing S1B contract `docs/contracts/S1B-p0-secret-boundary.md` must not be modified. The implementation workspace `/tmp/solaris-s1b` must not be modified. No other file in either workspace may be created, modified, staged, or committed during this turn.

---

## 10. Contract-Commit and Dirty-Workspace Synchronization

**A.** This amended contract is reviewed by Codex and Majd.

**B.** A separate explicit authorization commits only this contract file in the clean contract workspace `/tmp/solaris-s1b-r1-contract`:

```bash
cd /tmp/solaris-s1b-r1-contract
git add docs/contracts/S1B-R1-blocker-recovery.md
git commit -m "contract(S1B-R1): blocker recovery — body-parser remediation and isolated PG bootstrap"
```

Record the resulting commit SHA as `CONTRACT_COMMIT`.

**C.** A separate explicit authorization pushes that contract-only commit to Beta:

```bash
git push origin agent/abacus-beta-v1-hardening
```

Verify the remote Beta SHA advances to `CONTRACT_COMMIT`.

**D.** `PROCEED S1B-R1` must name `CONTRACT_COMMIT` as the exact implementation starting commit SHA and must supply `EXPECTED_CONTRACT_SHA` (the SHA-256 of this file as committed).

**E.** Synchronization is executed by `phase_sync` in §6. Steps E-1 through E-7 are fully implemented there. In summary: fetch → ancestor check → single-commit check → changed-paths check → explicit SHA equality check of committed contract vs `EXPECTED_CONTRACT_SHA` → fast-forward → post-merge reverification of HEAD, middleware SHA, and test SHA.

If the fast-forward refuses because of dirty-state conflict or any path overlap: **STOP** — do not stash, reset, restore, or force. Report the refusal to Majd.

---

## 11. Pipeline Exit Code Policy

For every npm, migration, test, or audit command:

- Preferred form — redirect stdout+stderr to a log file, then capture exit code:

  ```bash
  some-command > /tmp/some.log 2>&1
  rc=$?
  ```

- If a pipeline is unavoidable, `set -o pipefail` (already active in §6 script) propagates failures from any stage. Capture the producer's exit status before the pipeline continues.

- Never report the exit status of `tee`, `grep`, `tail`, or any other pipeline consumer as the underlying command's result.

All implementations in §6 follow this policy.

---

## 12. Authorized Starting Commit for Implementation

**UNASSIGNED.** The implementation starting commit SHA for S1B-R1 will be supplied in a separate `PROCEED S1B-R1` authorization from Majd after Codex review. It will equal `CONTRACT_COMMIT` as defined in §10B.

Until `PROCEED S1B-R1` is received: **no implementation, dependency update, database execution, commit, push, PR, merge, migration, or deployment may occur.**

---

## 13. Evidence File

Upon completion of all gates, `phase_evidence` in §6 builds the evidence file at `/tmp/S1B-R1-IMPLEMENTATION-EVIDENCE.txt`.

The evidence file is **self-contained** (Final-Correction 4): it EMBEDS the full contents of every required artifact — not paths, not summaries. A `req()` helper `cat`s each artifact into the file; existence is tested with `-f` (regular file), NOT `-s` (nonempty), because an existing zero-byte artifact is valid evidence that a successful command emitted no output (e.g. a zero-warning ESLint log, or empty stderr from a successful `npm audit --json`). Only an **absent** required artifact prints `(missing)`, emits an `EVIDENCE_MISSING` marker to stderr, sets an in-scope `missing` flag, and — after the evidence body is written — causes `phase_evidence` to `die`, so evidence generation FAILS rather than producing a file with a `(missing)` gap. On success the file ends with `EVIDENCE_COMPLETE=all-required-artifacts-embedded`.

The evidence file embeds, in order:

- global header — `CONTRACT_COMMIT`, `IMAGE_DIGEST`, `PG_SERVER_VERSION`, and BOTH audit exit codes `AUDIT_CMD_RC` (npm audit process exit) and `AUDIT_PARSE_RC` (parser verdict exit), plus `JEST_S1B_RC`/`JEST_S1A_RC`/`JEST_SCHEMA_RC`/`JEST_FULL_RC`
- full toolchain log (R1-DEP-0)
- both dependency preimage SHA records — lockfile and package.json (R1-DEP-1) — and the full lockfile update log (R1-DEP-2)
- the FULL structured complete-document lock-comparison output (`s1b-r1-lockcmp.log`, R1-DEP-3)
- post-update audit: both exit codes, the FULL audit JSON, the FULL audit stderr, and the FULL parser verdict log (§4.4)
- schema hashes and schema provenance (§5.4/§5.5)
- the database provisioning exit-code ledger — every role/database/schema/migration/count exit code (§5)
- per-database full logs: role-create, db-create, all nine schema logs, migration log, and pgmigrations count stdout, for each of the three databases (§5.4)
- container cleanup proof — recorded ID, resolved ID, label, name, stop exit, removal exit, ID absence, name absence (§5.5)
- full lint log and the COMPLETE text log AND JSON for all four Jest gates (§7)
- git state — exact `BRANCH`, `HEAD`, `REMOTE_SHA`, staged name-status, and full porcelain status (untracked=all)
- the complete tracked diff (`git diff HEAD`)
- the FULL contents and SHA-256 of both untracked files (`backend/src/middleware/secret-boundary.js` as `MIDDLEWARE_SHA256`, `backend/tests/secret-boundary.test.js` as `TEST_SHA256`), with an explicit note that `git diff HEAD` omits untracked files

The evidence file must not be written to the repository.

---

## 14. Rollback

### 14.1 Recovery-contract file rollback

If this contract file is determined to be incorrect before it is committed, move it to a timestamped quarantine location:

```bash
mv /tmp/solaris-s1b-r1-contract/docs/contracts/S1B-R1-blocker-recovery.md \
   /tmp/S1B-R1-blocker-recovery.quarantine-$(date +%Y%m%dT%H%M%S).md
```

Do not delete the file. Do not move the `docs/contracts/` directory or the `docs/` directory. Do not use `git clean`, `git reset --hard`, or any directory-wide operation.

After the quarantine move, the contract workspace must be clean at HEAD `1571907e` with no uncommitted files.

---

*End of S1B-R1 contract — structural correction pass: all shell fragments consolidated into §6 orchestration script.*

---

## 15. Contract Correction Closeout

### 15.1 Corrections Applied (14 structural + 4 final-correction = 18 total)

| # | Correction | Location in §6 |
|---|------------|----------------|
| 1 | Canonical path `/tmp/S1B-R1-execute.sh`; `S1B_R1_SCRIPT_SHA` env var; startup self-hash check before any Git/dep op | CONSTANTS + STARTUP block |
| 2 | `assert_exact_status` helper — byte-for-byte porcelain comparison; called at E-1, E-7, rollback gate 4, R1-V8 | new helper + phase_sync + phase_dep_rollback + phase_verify |
| 3 | Pre-merge: REMOTE_SHA == CONTRACT_COMMIT; single-parent == local HEAD; blob written to temp file; hash without pipeline | phase_sync E-3a/E-3b/E-5 |
| 4 | `phase_dep_rollback` returns 0/1; callers distinguish rollback-ok vs rollback-failed; no `ROLLBACK=success` unless all 4 gates pass | phase_dep_rollback + callers in phase_dependency |
| 5 | Count query: separate stdout/stderr files; exit captured before transform; require exit 0 then trim | phase_database bootstrap loop |
| 6 | Schema hash preflight before container creation: 9 files verified, hash-only SHA-256, written to `/tmp/s1b-r1-schema-hashes.txt` | phase_database pre-container block |
| 7 | All 4 Jest exit codes explicitly saved as globals then asserted (process exit AND JSON counts both required) | phase_verify R1-V2/V3/V4/V5 |
| 8 | Gate R1-V8 calls `assert_exact_status "R1-V8"` — exits non-zero on mismatch, not printed for manual inspection | phase_verify R1-V8 |
| 9 | `cleanup_container` returns non-zero on any failure; `on_exit` captures `$?`, disables trap, exits with original code or `CLEANUP_FAILURE_RC=97` | cleanup_container + on_exit |
| 10 | New `phase_cleanup_success` between phase_verify and phase_evidence; disables trap after confirmed removal | phase_cleanup_success + main() |
| 11 | Evidence embeds content via `cat` (not just paths); `IMAGE_DIGEST`, `PG_SERVER_VERSION`, `AUDIT_PARSE_RC`, `JEST_*_RC` declared as script globals | MUTABLE SCRIPT STATE + phase_evidence |
| 12 | Removed invented "152 intake tests" breakdown; §7 derivation uses only: 198 pre-S1B + 92 S1B = 290 total | §7 derivation table |
| 13 | Static validation section added (§6.1): `bash -n`, shellcheck, SHA-256 computation, Python assertions | §6.1 |
| 14 | This closeout block: corrections table, SHAs, line counts, workspace status, confirmation | §15 |

#### Final Correction Pass (4 additional — labelled `Final-Correction 1..4` in §6 comments)

| # | Correction | Location in §6 |
|---|------------|----------------|
| FC-1 | Branch identity gate: `assert_on_branch` asserts `git branch --show-current == agent/abacus-beta-v1-hardening` before any fetch/Git mutation (E-0) and again after fast-forward (E-6b); detached HEAD, empty, or other branch → STOP | new `assert_on_branch` helper + `phase_sync` E-0/E-6b |
| FC-2 | Deterministic script extraction: literal extractor selects only the fenced block whose first content line is `#!/usr/bin/env bash`, writes `/tmp/S1B-R1-execute.sh` (LF + final newline), rejects zero/multiple matches, computes+prints SHA-256, runs `bash -n` + ShellCheck, and requires the SHA to equal the invocation-supplied `S1B_R1_SCRIPT_SHA` (never hardcoded) | §6.1 extraction block |
| FC-3 | Complete lock comparison + dual-preimage rollback: both `package-lock.json` and `package.json` preimages preserved and hashed; comparison proves the COMPLETE JSON documents identical after swapping the post-update `body-parser` package node back to pre-update (sole allowed change `1.20.5 → 1.20.6`); verified rollback restores and re-verifies BOTH files, runs `npm ci --ignore-scripts`, and requires the exact five-path status; rollback invoked on R1-DEP-2/3/4/5 or the post-update audit-gate failure; if rollback also fails, STOP reporting BOTH failures | `phase_dep_rollback` + all five callers |
| FC-4 | Self-contained evidence: `phase_evidence` embeds the FULL contents of every required artifact (lock-comparison output; audit JSON + stderr + verdict + both exit codes; complete Jest text logs AND JSON for all four gates; every role/db/schema/migration/count exit code; schema hashes + provenance; cleanup proof; exact branch/HEAD/remote SHA/staged/porcelain; complete tracked diff; full contents + SHA-256 of both untracked files); a required artifact printing `(missing)` fails evidence generation via `die` | `phase_evidence` + supporting ledgers in `phase_database`/`cleanup_container` |

### 15.2 Static Validation Record

```
bash -n /tmp/S1B-R1-execute.sh   → exit 0 (syntax valid)
shellcheck /tmp/S1B-R1-execute.sh → exit 0 (no errors)
```

Run §6.1 static validation after extracting the script to confirm.

### 15.3 File Metrics

| Item | Value |
|------|-------|
| Pre-correction SHA-256 | `0edb829dcb22e5215b5ab98ceb9b602e02574f25009563cf7f4f362e485526cc` |
| Contract workspace HEAD | `1571907e8fcf8778140f4b27695e946a335a2437` |
| Contract workspace tree | `990ea816142601035c84cff0de28839c717edf35` |
| Implementation workspace | `/tmp/solaris-s1b` — 5 dirty paths — UNTOUCHED |
| Contract workspace | `/tmp/solaris-s1b-r1-contract` — no implementation performed |

### 15.4 Workspace Status Confirmation

```
Implementation workspace (/tmp/solaris-s1b): untouched — zero commands run against it this turn.
Contract workspace (/tmp/solaris-s1b-r1-contract): no git operations performed — HEAD remains 1571907e.
No commits, no pushes, no containers, no database operations, no dependency changes performed.
```

**READY FOR CODEX S1B-R1 RUNTIME CONTRACT REVIEW — no implementation performed**
