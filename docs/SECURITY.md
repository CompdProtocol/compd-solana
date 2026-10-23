# Security architecture

[README](../README.md) · [Program](PROTOCOL.md) · [Agent](AGENT.md) · [Dependency findings](DEPENDENCY-SECURITY.md)

The root [Security Policy](../SECURITY.md) defines responsible-disclosure expectations. This document maps actual implementation controls and residual trust; it is not an independent audit, certification or guarantee of loss prevention.

## Authority boundaries

| Operation | Required boundary | Residual trust |
|---|---|---|
| Treasury initialization/admin | Authority signer and authority-derived Treasury PDA | The authority selects immutable identities; no native multisig, timelock or rotation API |
| Revenue | Authority signature, exact receipt nonce, physical SOL deposit | Off-chain fee attribution is authority-attested; no DBC CPI proof |
| Strategy allocation | Authority, fixed executor, risk limits, unique Run PDA | Capital leaves custody and is exposed to executor/market risk |
| Settlement | Authority plus configured executor, bound open Run | The program sees returned SOL, not a complete trade cost-basis audit |
| Reserve release | Authority, selected bucket, fixed recipient | No on-chain linkage from release to external buyback completion |
| Reward root/funding | Authority, sequential Distribution PDA, reward-bucket funding | Eligibility and root construction are off-chain reviewed inputs |
| Holder claim | Holder signer, distribution-bound proof and unique index PDA | Program does not recheck current holder balance or snapshot fairness |
| External execution | Message/context/expiry-bound approval and allowed owner | A separate external wallet/process must preserve the approved transaction and custody |

## Custody and integer controls

[solvent and move_sol](../programs/compd-treasury/src/lib.rs) check rent-backed liquidity, checked lamport subtraction/addition and fixed account identity where required. [Ledger](../crates/accounting/src/lib.rs) uses bounded balances, wide multiplication intermediates, conservation of rounding and principal-before-profit settlement.

Liquid buckets and deployed principal are distinct. Pausing rejects new strategy allocations; it does not freeze deposits, settlement, reserve release or funded holder claims. A loss automatically sets paused. Treasury authority may explicitly unpause, so this is a permissioned control rather than irreversible loss shutdown.

## Replay and message integrity

Receipt, run and distribution nonces prevent replayed state transitions. Run.open prevents settling an already closed run. A Claimed PDA keyed by distribution and index prevents a second successful claim at the same index. Failed on-chain transactions roll back initialization and transfers together.

[Transaction envelopes](../packages/sdk/transactions.mjs) reject signed inputs and expose required signer public keys. External approval binds SHA-256 message hash, canonical context hash and block-height expiry; Ed25519 verification is not transaction signing. The execution authorization wrapper also checks freshness, owner and spend. Rebuilding a transaction/blockhash requires fresh approval.

[Receipt journals](../packages/agent/journal.mjs) reject conflicting duplicate evidence and commit receipt/bucket changes atomically. [Custody journals](../packages/agent/custody.mjs) require contiguous event sequences and matching decoded state. They do not repair gaps by inventing records.

## RPC and integration boundaries

RPC inputs may be wrong, stale, unavailable or numerically unsafe. Adapters bind configured genesis, official program ownership, pool/config/mint and expected transaction message. Fee receipts require successful finalized evidence and physical balance reconciliation. Claims with unexpected rent/balance effects fail for operator review.

Ordinary DBC verification uses several finalized reads, not an atomic state lock. The holder path uses a single-bank batch and supply reconciliation with an explicit 99-account limit. These controls do not protect against all compromised-RPC or external-wallet behavior. Mainnet configuration and independent review remain necessary.

## Dependency exposure

The unchanged [machine report](DEPENDENCY-AUDIT.json) contains 14 affected production-tree entries: seven high and seven moderate, five direct and nine transitive, none development-only. [Individual classifications](DEPENDENCY-SECURITY.md) remain zero FIX, seven MITIGATED BUT OPEN and seven OWNER RISK ACCEPTANCE REQUIRED.

Native bigint bindings are absent in the reviewed installation; selected RPC paths avoid affected streaming/parser or UUID APIs; untrusted TOML is not accepted by the Agent. These observations are installation/code-path mitigations, not patched packages or a clean audit. Installing with lifecycle scripts disabled helps preserve the reviewed native-binding state but does not repair all advisories.

Source-distribution acceptance is not acceptance for mainnet execution. No forced upgrade, audit suppression or weakened account constraint is justified by publication work.

## Reporting and repository hygiene

Use a verified private maintainer channel associated with the CompdProtocol account; if GitHub private vulnerability reporting is enabled, use that repository interface. No private-reporting service or mailbox is claimed configured. Do not publish exploit details in public issues before coordination, and do not send keys or unrelated personal information.

Provide affected source/commit, reproducible steps, expected/actual behavior, impact and a minimal proof without real funds. Never commit keypairs, seed phrases, runtime databases, secret environment files or privileged infrastructure settings. Public program IDs and test verification keys are not private signing material.

## Verification and open gates

The retained source checkpoint includes six Rust tests, 29 Node tests and SBF/IDL compilation. Native Anchor dispatch covers selected authorization/custody scenarios; it is not full SBF VM execution, an audit or production evidence.

No official mainnet deployment, live COMPD fee/holder distribution, signing backend or enabled Agent trading is evidenced. Development identity designation, independent key recovery, verified mainnet inputs, full adversarial execution coverage and [bounded integration review](BLOCKERS.md) precede operational approval. Publication documentation must not collapse those gates into a claim of security completion.
