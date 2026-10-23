# Remaining release and operational gates

## Completed locally

- Official Rust, Agave, Anchor and SBF toolchains configured; native workspace check/tests, SBF build and real IDL generation pass.
- DBC strategy quote/swap interfaces and protected-minimum buyback/burn preparation with owner authorization, spend/slippage and risk constraints.
- Standard SPL holder snapshot aggregation, supply reconciliation, pool exclusions, deterministic Merkle allocations and funded claim reconciliation.
- Ordered custody-event journaling and reconciliation against real IDL account data and rent-backed SOL balances.
- Verified DAMM v2 migration/position ownership checks and unsigned position-fee collection, with separate asset confirmation.

## Mainnet operational gates and deliberate limits

Items 2–8 below govern operational use, not permission to publish source. Item 1 is a disclosed source-release risk requiring a separate owner decision. Item 9 concerns publication rights and the candidate license. See [publication scope](PUBLICATION-TREE.md) and [owner checklist](OWNER-DECISIONS.md).

1. **Dependency security:** 14 affected runtime package entries remain (7 high, 7 moderate), including the added DAMM SDK wrapper. The compatible SPL Token patch and non-force fixes were applied. No compatible fix removes all underlying advisories. See DEPENDENCY-SECURITY.md for code-path exposure, not a clean-audit claim.
2. **Official identity and live evidence:** only an owner-authorized local development program ID exists. No verified mainnet COMPD mint/pool/config, Treasury, authority/executor, migration transaction or position NFT is configured. No live simulation or transaction validation occurred.
3. **Program verification scope:** tests execute native Anchor dispatch, not a complete SBF VM/validator adversarial suite. SBF compilation/IDL success does not establish independent security review. Expand tests for all settlement, allocation, reward and failure-rollback paths before operational approval. Upstream macro cfg/deprecation warnings remain visible.
4. **Custody trust:** on-chain deposits still rely on treasury-authority fee attribution; there is no trustless DBC CPI collector. External receipts, deposits, strategy principal and mixed post-migration assets remain distinct. Unclassified SOL donations are not automatically revenue.
5. **Snapshot bound:** current atomic-bank RPC snapshot supports at most 99 token accounts plus mint. Larger holder sets are rejected, not partially distributed. A reviewed larger atomic snapshot backend is required if exceeded. Exclusions and roots require owner review; off-curve/frozen/excluded holdings receive no claim allocation.
6. **Execution scope:** unsigned standard DBC exact-input interfaces are implemented, not a general exchange router or autonomous trading service. Owner-approved assets/pools, executor funding and fresh account state are required. Buyback burns protected minimum output, with excess tokens left for explicit later handling. No signing/broadcast path exists by design.
7. **Migration bounds:** only verified legacy DBC-to-DAMM-v2 migration evidence and owned positions are supported. No DAMM v1 or unproven position collection. Mixed fees are not counted as SOL-only revenue; realized conversion requires a separate authorized workflow.
8. **Receipt strictness:** unexpected ATA rent, ambiguous balance effects, unsafe RPC lamport precision, missing events, interrupted cycle recovery and sequence gaps require explicit review/backfill rather than guessed revenue.
9. **Legal/publication gates:** first-party licensing and retained historical attribution/redistribution decisions remain unresolved. Website files stay unchanged and excluded from this build.

No deployment, transaction signing, broadcasting, transfers, commits or pushes occurred. Local development key generation was explicitly authorized and private material remains ignored. This is a local source handoff, not production approval.
