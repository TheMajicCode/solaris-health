# ECO-CLEAN-R1 — retire legacy multi-chain and fabricated wallet demos

Date: 2026-09-27. Implementation authority: Majd's current instruction to scan and
remove obsolete Ethereum/Solana and prototype/demo wallet work, preserving the
current Bitcoin-focused Economic Passport. This contract records that approved
cleanup before implementation. A draft candidate and independent review precede
publication; this task does not authorize merge, deployment or live data changes.

## Base and ownership

- Repository: TheMajicCode/solaris-health.
- Base main: `abf507a9eeafcb7e7d534438ff231343bd221dbe`.
- Base tree: `f7d6b3cf0b09f96758ec7c785841451b53fd5d21`.
- Branch: `codex/eco-clean-r1-bitcoin-focus`, clean isolated checkout.
- PR #7 remains separate at `3e5687b7661c9f8b6fa7296ee5b2aa06937689e2`.
- Current owner direction and docs/ECONOMIC-PASSPORT-ARCHITECTURE.md govern product
  scope; older accepted documents remain discoverable as dated evidence.

## Outcome and boundaries

Remove the reachable MetaMask/Phantom/Ethereum/Polygon/Solana hub, its browser
signing and sending code, simulated Health NFT mint/transfer UI, and exclusive
helpers/dependencies. Retire the legacy wallet connection, signature, balance and
history endpoints with authenticated 410 responses before any wallet SQL or RPC.
Retain only the owner-scoped read of historical address metadata at GET /me.
The current Spark wallet reads directly through its adapter; this legacy registry
does not accept Spark addresses. No secrets are moved.

Remove invented wallet balances selected by email suffix and the member profile's
simulated opening balance/mock Lightning address. Preserve BTC and USDT cards,
GPS, Self Care and Network, real enabled Spark state, encrypted local vault and
recovery code. Unconnected or missing context balances are unknown, not a claimed
zero. This does not repair the existing upstream adapter's missing-field-to-zero
coercion; it remains a separate follow-up and a limit on balance provenance.
Correct the old UTEXO future-provider label to the selected WDK direction without
claiming a shipped integration or choosing a USDT network.

Breez/WDK/MoonPay integration, RGB issuance, GPS payments, live funds and broad
clinical removal are not implemented here. Keep payment-disabled/simulation
disclosures and synthetic test fixtures; do not erase historical migrations,
stored records, accepted contracts, localStorage, signing keys or recovery paths.
Remove the unsupported optional Spark public-address linking UI, including its
misleading local-only Unlink action. Wallet setup/recovery/adoption is unchanged.

## Exact changed-path allowlist

- src/components/LucaPassport.jsx
- src/components/wallet/WalletConnect.jsx (delete)
- src/components/wallet/WalletDashboard.jsx (delete)
- src/components/wallet/HealthNFT.jsx (delete)
- src/components/wallet/TransactionHistory.jsx (delete)
- src/lib/web3-utils.js (delete)
- src/__tests__/WalletConnect.test.jsx (replace with retirement coverage)
- src/components/economic/PreviewWallet.jsx
- src/__tests__/previewWallet.test.jsx
- src/components/passport/WalletCard.jsx
- src/__tests__/walletCardTruth.test.jsx (new)
- src/components/SparkWalletCard.jsx
- src/__tests__/sparkOnboardingCard.test.jsx
- src/__tests__/OnboardingWizard.test.jsx (existing UTEXO copy assertion only)
- src/lib/api.js
- package.json
- package-lock.json
- backend/src/lib/web3.js (delete)
- backend/src/routes/wallet.js
- backend/tests/wallet.test.js
- backend/src/routes/passport.js
- backend/.env.example
- backend/package.json
- backend/package-lock.json
- docs/API.md
- README.md
- docs/CURRENT-STATE.md
- docs/beta-v1/contracts/CONTRACT-ECO-CLEAN-R1.md
- docs/beta-v1/handoffs/HANDOFF-ECO-CLEAN-R1.md (new)
- CHANGELOG.md

## Acceptance and verification

- Economic navigation retains Wallet/GPS/Self Care/Network but cannot render the
  removed hub or invoke an injected EVM/Solana provider. No runtime imports of
  the removed modules/SDKs remain; lockfiles remove exclusive dependencies.
- Every email receives the same honest unconnected state; no minted token IDs,
  invented balances, copyable fake addresses or demo NFT actions remain on these
  wallet surfaces. A connected context Bitcoin balance, including zero, remains
  distinguishable from missing context data. This does not establish provenance
  of zeros already supplied by the unchanged adapter. USDT stays unconnected.
- Existing vault creation/restore/adoption tests and Economic navigation tests
  pass. No wallet data format/storage/keys change.
- All legacy endpoints except GET /me return authenticated 410 without wallet
  SQL or RPC, including old Bitcoin watch-only proxies. Unauthenticated requests
  remain denied and real JWT revocation checks remain active. Historical rows are
  readable only to their owner; passport status labels them historical metadata,
  not an active wallet/identity method. No active Bitcoin adapter is removed.
- Focused route tests use a mocked database and dedicated Jest configuration,
  excluding legacy tests/setup.js and database fallbacks. No live RPC, database,
  seed or migration is needed. Relevant controls demonstrate old support fails
  the new retirement expectations; obsolete-feature tests are explicitly replaced.
- Lockfile installs with lifecycle scripts disabled, full frontend suite/build,
  changed-file lint, whitespace, dependency/import scans and independent review.
  Record exact commands/results and distinguish baseline failures. Any unavailable
  full database regression remains a limitation, not an inferred pass.

## Data, deployment and rollback

This is source cleanup only. No runtime service or database is touched. Existing
wallet address/history tables are retained for later reviewed retention/export
work. A rollback is a reviewed revert, not a reset, seed or key substitution.
Restoring the old frontend also restores the old browser transaction path.

## Integration amendment — 2026-09-27

Appended after review; the sections above are unchanged. Majd's instruction of
2026-09-27 reads: "I authorize the source changes, normal branch
commits/pushes, pull requests and merges described below once reviewed and
verified. No deployment, restart, migration, seed, live database operation,
real-funds action, force-push or scheduled agent." It covers finalizing
WEB-R2-UI PR #7 first, then integrating this reviewed cleanup into current
`main` through a dedicated PR and merging it once reviewed and verified. It
replaces the earlier "does not authorize merge" wording, here and in the
handoff, for this integration only. Everything that sentence excludes remains
unauthorized.

- Integration base: `main` after the PR #7 merge, commit
  `c3b587b0f0f0279e7b9bbf2ee8c7a5bc6bbd2912`, tree `a85df00a7913560a0a3bbf56dfbaf3de93bd989f`
  (PR #7's reviewed head `3e5687b7661c9f8b6fa7296ee5b2aa06937689e2`).
- The supplied reviewed patch (SHA-256 `db94e66a…`) is applied with Git
  three-way application. Its only conflict is `CHANGELOG.md`, where both
  `[Unreleased]` entries are kept verbatim with this cleanup above WEB-R2-UI.
  PR #7's component, tests, contract and handoff are unchanged.
- The path allowlist above is unchanged, and the integrated candidate touches
  exactly those 30 paths. Wallet keys, encrypted vaults, recovery, historical
  records and migrations remain out of scope and unchanged.
