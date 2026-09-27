# ECO-CLEAN-R1 — cleanup handoff

Date: 2026-09-27. Source candidate, not a deployment or production approval.

## Anchors and authority

- Base `main`: `abf507a9eeafcb7e7d534438ff231343bd221dbe`.
- Base tree: `f7d6b3cf0b09f96758ec7c785841451b53fd5d21`.
- Branch: `codex/eco-clean-r1-bitcoin-focus`.
- Scope and owner authorization: [contract](../contracts/CONTRACT-ECO-CLEAN-R1.md).
- WEB-R2-UI PR #7 is separate at `3e5687b7661c9f8b6fa7296ee5b2aa06937689e2`.
  This candidate does not contain or certify that work. Its tests therefore use
  the main baseline of 678 tests, not PR #7's reported 723-test baseline.
- Candidate digest and publication result belong in the external delivery
  manifest/PR, avoiding a self-referential hash in tracked files.

## Source findings and changes

The nested Crypto wallets hub remained reachable from the GPS page. Its EVM
dashboard called `signer.sendTransaction` through an injected provider, despite
demo wording. Its NFT controls simulated mint/transfer operations. The Economic
wallet invented balances for any `@solaris.health` address, and the profile wallet
invented a 2,100,000-sat opening balance and a copyable Lightning address.

The candidate removes those components, helpers, API wrappers and exclusive
ethers/Solana dependencies. The legacy registry operations return authenticated
410 responses, including the old Bitcoin watch-only proxy routes; the direct
Bitcoin adapter is separate and unchanged. GET `/api/wallet/me` remains an
owner-only read of historical address metadata. It marks records legacy/inactive;
it does not claim their prior `verified` field proves current ownership. Passport
status no longer treats those records as an active wallet identity connection.

The unsupported Spark public-address link form and its local-only Unlink control
are removed. Actual create/restore/adopt, encrypted vault, recovery, identity and
Bitcoin SDK remain. BTC/USDT, GPS, Self Care and Network navigation remain. WDK is
labelled planned; no USDT network, Breez integration, RGB issuance or new payment
capability is implemented. No database rows, migrations, keys or local storage
are deleted. Historical addresses are not included by the existing full-vault
export; the owner-only metadata endpoint is retained rather than claiming export
coverage that does not exist.

## Executed validation

Runtime: Node v24.19.0, npm 11.9.0. Installs disabled lifecycle scripts, audit and
funding calls. No application server, live RPC, database, seed or migration ran.

| Check | Result |
| --- | --- |
| Locked root installs at base and candidate | Exit 0 |
| Full frontend at unchanged main | 92 files / 678 tests passed, exit 0 |
| Full frontend at candidate | 93 files / 684 tests passed, exit 0 |
| Build at base and candidate | Both exit 0; existing large-chunk warning remains |
| Whole frontend lint at base | Exit 1: 265 problems, 35 errors / 230 warnings |
| Whole frontend lint at candidate | Exit 1: 247 problems, 34 errors / 213 warnings |
| Lint comparison by file, severity, message and rule | No new diagnostics; shifted line numbers ignored |
| Author-reported focused frontend checks | 37 passed and seven files lint clean; saved focused log is partial, so this row is not independently log-verified |
| Economic navigation retirement tests | 2 passed at candidate; same 2 failed against original source |
| Backend locked install | Exit 0 |
| Dedicated wallet/passport Jest suite | 59 passed, exit 0; real auth, mocked DB, no shared setup or force-exit |
| Targeted backend original-source control | 2 failed, 57 unselected, exit 1; `/chains` and passport legacy-status assertions |
| Changed backend route/test lint | Exit 0, zero problems |
| Whitespace check | Exit 0 |

Frontend count reconciliation: the retired WalletConnect suite's 14 feature tests
are replaced with 2 full-shell retirement tests; PreviewWallet grows from 6 to 22,
Spark card from 2 to 3, and the new WalletCard test adds 1. Net change is +6.
Existing wizard expectations only change the retired UTEXO label to WDK. Removing
old feature assertions is intentional retirement coverage, not a hidden failed
test or a lower quality threshold. Backend feature tests are similarly replaced
with explicit retirement, ownership, revocation and error-handling assertions.

Controls ran against original source with its original locked dependencies. The
frontend control failed because the old Crypto wallets entry remained visible.
Only the two safe backend control cases ran: the old `/chains` returned 200 and
passport status advertised an active Ethereum wallet. Old RPC/signing routes were
not exercised. These are mocked/synthetic tests, not live exploit probes.

Dependency comparison: 81 root and 6 backend lockfile package entries removed;
zero additions and zero surviving version, resolved URL or integrity changes.
Some retained dependency `dev` metadata changed after uninstall. No remaining
runtime imports of ethers, Solana SDK or deleted web3 helpers were found.

The partial author-focused log stops before its wizard test and summary; its
seven-file lint output was not retained there. The complete full-suite candidate
log independently shows all four focused files passing, and the retained whole
lint comparison finds no new diagnostics. No missing output is reconstructed.

Commands used include `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`,
`npm run build`, `npm run lint`, changed-file ESLint, and `git diff --check`.
Backend execution used `env -u DATABASE_URL -u PGSSL -u JWT_SECRET node
backend/node_modules/jest/bin/jest.js --config <dedicated-config> --runInBand`.
The supplied evidence pack retains logs and the dedicated Jest configurations;
absolute checkout paths must be adjusted when reproducing elsewhere.

## Review and limits

An author-uninvolved read-only reviewer inspected the complete application diff,
dependency removals, tests and logs, finding no blocking application defects.
The reviewer did not rerun suites. Final handoff review and exact candidate
identity are recorded separately in the evidence pack.

- Full backend database regression was not run. The earlier two intake fixture
  failures and schema-loader errors remain open; no all-green backend claim.
- No real-browser or physical-device acceptance was performed. Tests include
  simulated providers/charts and existing act/scroll/chart-size warnings.
- Missing context balances render unavailable, but the unchanged Spark adapter
  can convert missing SDK fields to zero before the UI sees them. Its context
  also has pre-existing asynchronous account-switch clearing risks. This task
  does not establish end-to-end observed-balance or account-switch correctness.
- The current mock health-device import and identity payment/GPS generator are
  still reachable. They need a separate removal slice preserving existing data
  and receipt history. Onboarding demo/fixture exposure needs a production-profile
  review. Do not delete payment safety flags or synthetic test fixtures.
- PR #7 remains a separate integration. No skipped Aikido check is a scan pass;
  no active CI or production readiness is inferred from local tests.
- No remote merge, deployment, service restart, migration, real-funds action or
  scheduled task is authorized by this cleanup. The domains will still show the
  old build until a later controlled deployment.

## Next work

Finalize PR #7 separately, reconcile any CHANGELOG overlap while preserving both
entries, then integrate this reviewed cleanup through a dedicated PR. Remove the
remaining member-facing fake health/payment generators in a separate contract.
Repair disposable test-database setup and fixtures before larger Maple/clinical
boundary changes. Safe isolated preview and runtime source convergence remain
prerequisites to a live release.

## Integration record — 2026-09-27

Appended after review. The sections above are kept unchanged as the record of
the pre-integration candidate at `abf507a9`.

- New base: `main` at `c3b587b0f0f0279e7b9bbf2ee8c7a5bc6bbd2912` (the PR #7 merge), tree
  `a85df00a7913560a0a3bbf56dfbaf3de93bd989f`, which contains WEB-R2-UI.
- The supplied reviewed patch (`db94e66a…`) was applied with
  `git apply --3way --index`. `CHANGELOG.md` was the only conflict. Both
  entries are kept verbatim, with this cleanup above WEB-R2-UI.
- Apart from that file and the two appended notes (this record and the
  contract's integration amendment), the other 27 cleanup paths are
  byte-identical to the reviewed candidate tree `85dba037…`. PR #7's
  component, tests, contract and handoff are unchanged. The scope equals the
  contract's 30-path allowlist.

Validation of the integrated tree used Node v22.22.2 and npm 10.9.7. Lifecycle
scripts, audit and fund calls were disabled. No application server, RPC,
database, seed or migration ran. Every command log ends with the command's
exit code; the two ESLint JSON outputs record theirs in separate files.

| Check | Result |
| --- | --- |
| Locked root install (`npm ci --ignore-scripts --no-audit --no-fund`) | Exit 0 |
| Full frontend at PR #7 base (`npx vitest run`) | 93 files / 723 tests passed, exit 0 |
| Full frontend at integrated tree | 94 files / 729 tests passed, exit 0 |
| Build (`npm run build`) | Exit 0; existing large-chunk warning remains |
| Whole frontend lint at PR #7 base | Exit 1: 262 problems, 35 errors / 227 warnings |
| Whole frontend lint at integrated tree | Exit 1: 244 problems, 34 errors / 210 warnings |
| Lint comparison by file, severity, rule and message | 0 new diagnostics; 18 removed, all in deleted or changed wallet files |
| Locked backend install | Exit 0 |
| Dedicated wallet/passport Jest suite | 59 passed, exit 0; real auth, mocked DB, no shared setup or force-exit |
| Changed backend route/test lint | Exit 0, zero problems |
| Full backend lint | Exit 0: 10 warnings, the same set as before this cleanup |
| Scope and whitespace (`git diff --cached --check`) | 30 allowlisted paths; exit 0 |

In the integrated run the changed test files report WalletConnect retirement 2,
PreviewWallet 22, Spark card 3, WalletCard 1 and OnboardingWizard 11, and
PR #7's trends suite 45. The backend suite ran with `DATABASE_URL`, `PGSSL` and
`JWT_SECRET` unset, using the supplied dedicated configuration with its
`rootDir` pointed at this checkout. The retirement controls against the original
source were not rerun. They were not affected by the integration.

The runs started after the patch was applied and the `CHANGELOG.md` working
copy was resolved, but before that resolution was staged and these notes were
written, so no run log records the final tree identity. Every file the runs
read was already in its final form. The later changes touch only this record
and the contract amendment, which no test, build or lint step reads. The PR #7
baseline runs used that checkout's existing dependencies, installed from the
same lockfile with `npm ci --ignore-scripts` for WEB-R2-UI on 2026-09-26
(exit 0, logged with that task's evidence).

The technical limits above still apply; merge authority comes from the
contract's integration amendment. Lint remains red from pre-existing errors. The
full backend database regression was not run. No real-browser check was done.
The inherited Spark adapter's zero coercion and account-switch clearing risks
remain. A skipped Aikido check is not a security scan. Not deployed.
