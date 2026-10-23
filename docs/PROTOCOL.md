# Anchor treasury program

[README](../README.md) · [Architecture](ARCHITECTURE.md) · [Rewards](HOLDER-REWARDS.md) · [Security](SECURITY.md)

Sources: [program](../programs/compd-treasury/src/lib.rs), [integer ledger](../crates/accounting/src/lib.rs), [SDK builders](../packages/sdk/treasury.mjs), [generated IDL](../packages/sdk/idl/compd_treasury.json).

## Account model and PDA domains

All integers below are unsigned; balances/nonces/IDs are `u64`, active run count is `u8`.

| Account | PDA seeds | Stored state |
|---|---|---|
| Treasury | `treasury`, authority public key | Authority, mint, executor, fixed buyback/reserve recipients; strategy/buyback/rewards/reserve/deployed; event/receipt/run/distribution nonces; runs, paused and bump |
| Run | `run`, treasury public key, run ID little-endian | Treasury, ID, principal and open flag |
| Distribution | `distribution`, treasury public key, distribution ID little-endian | Treasury, root and remaining funded SOL |
| Claimed | `claimed`, distribution public key, index little-endian | Empty typed replay marker; discriminator and account existence identify a consumed index |

The program allocates each account with its Anchor discriminator and `InitSpace`. Treasury administrative contexts enforce both its PDA and `has_one=authority`. Run settlement checks program ownership and `has_one=treasury`; it does not rederive the run PDA in the settlement context. Claims use a typed Distribution account and distribution-bound leaf, not a fresh derivation of the Distribution PDA. Do not claim every context repeats every seed check.

## Instruction reference

| Instruction and arguments | Context / authorization | State and physical effect |
|---|---|---|
| `initialize(mint, executor, buyback, reserve)` | Initialize: mutable authority signer/payer, new Treasury PDA, System Program | Reject default input identities; initialize fixed bindings and treasury bump. No launch/pool validation or funding is performed. |
| `receive_revenue(nonce, amount)` | Deposit: authority signer, bound Treasury, System Program | Require positive amount and next receipt nonce; transfer SOL authority to Treasury; credit revenue buckets; increment receipt nonce; emit Revenue/Custody. |
| `allocate(id, amount)` | Allocate: authority signer/payer, bound Treasury, fixed executor SystemAccount, new Run PDA, System Program | Require next run nonce; apply ledger risk policy; debit liquid strategy/add deployed principal; create open Run; transfer SOL to executor; emit Custody. |
| `settle(returned)` | Settle: authority signer, fixed executor signer, bound Treasury and Run, System Program | Require open run; transfer positive returned SOL from executor; recover principal, allocate positive profit or pause on loss; close run flag; emit Custody. Zero return is permitted and records a loss. |
| `pause(paused)` | Admin: authority signer and bound Treasury | Set pause flag; no SOL movement and no Custody snapshot. The flag blocks new allocation only. |
| `release_reserve(buyback, amount)` | Release: authority signer, bound Treasury, recipient SystemAccount | Positive amount; choose buyback or protocol bucket; checked debit and fixed-recipient equality; transfer SOL and emit Custody. No swap/burn occurs. |
| `create_distribution(id, root, amount)` | CreateDistribution: authority signer/payer, bound Treasury, new Distribution PDA, System Program | Next distribution ID, positive amount, nonzero root; debit rewards; fund Distribution; increment nonce; emit Custody/RewardFunded. |
| `claim(index, amount, proof)` | Claim: holder signer/payer, typed Distribution, new Claimed PDA, System Program | Positive amount, at most 32 proof nodes; verify leaf/root, checked remaining debit and SOL payment to holder; emit RewardPaid. |

Immutable identities have no update/rotation API. There is no close/reclaim, root-replacement, claim-expiry, arbitrary SPL-custody or trustless DBC-collection instruction. The authority is a single signer requirement in this program; no native multisig or timelock is implemented.

## Allocation models

| Source | Strategy Capital | Buyback Reserve | Holder Rewards | Protocol Reserve |
|---|---:|---:|---:|---:|
| Revenue | 35% | 15% | 0% | 50% |
| Positive realized strategy profit | 65% | 15% | 10% | 10% |

`split` computes the first three buckets by floor division, then sets Protocol Reserve to `amount - strategy - buyback - rewards`. Nominal reserve shares therefore also receive rounding dust. For example, 101 lamports of revenue split to 35 / 15 / 0 / 51; 101 lamports of profit split to 65 / 15 / 10 / 11. These are arithmetic examples, not transaction evidence.

Rust multiplies in `u128`, bounds stored balances to `u64` and uses checked additions/subtractions. The JavaScript mirror uses `BigInt` with explicit `u64` bounds. `Ledger.credit` constructs and validates the next state before replacing the old ledger. A failed on-chain instruction reverts all effects.

## Strategy accounting and settlement

`capital = strategy + deployed`. An allocation must be positive, at most 10% of capital; resulting deployed principal must be at most 30%; there must be fewer than three active runs and the ledger must not be paused. Available strategy balance must cover the amount. These limits exclude the other reserve buckets.

Settlement subtracts recorded principal from deployed, decrements active runs and credits `min(returned, principal)` back to liquid strategy. Only `returned - principal` when positive enters the profit model. A shortfall records the actual loss and pauses allocation. The program does not inspect market PnL, cost basis of external token lots or the cause of returned funds.

## Custody invariants

`liquid = strategy + buyback + rewards + reserve` must fit `u64`. Treasury lamports must cover liquid plus rent exemption; deployed principal is not falsely included in liquid custody. `move_sol` checks subtraction, destination addition and the source rent floor. SPL positions held by an executor remain outside program custody.

An unexplained SOL donation may leave surplus lamports but is not a bucket credit. `reconcileCustody` reports such surplus as unclassified. Distribution claim payments similarly preserve account rent; off-chain reward reconciliation expects exact rent plus remaining funding and rejects unexplained surplus.

## Events and reconciliation

| Event | Meaning |
|---|---|
| Revenue | Deposit nonce and amount |
| Custody | Treasury, sequence, kind, reference, amount and all bucket/deployed balances |
| RewardFunded | Distribution, root and funded amount |
| RewardPaid | Distribution, index, holder, paid amount and remaining funding |

Custody kinds are 0 revenue, 1 allocation, 2 settlement, 3 buyback release, 4 protocol release and 5 distribution funding. The event sequence increments for these operations, not initialize, pause or holder claims. Claims have their own payment event and replay marker. [Custody tooling](../packages/agent/custody.mjs) checks sequence continuity and rent-backed account state.

## Errors

The `Fault` enum defines `Accounting` (overflow, insufficient buckets/rent or insolvency), `Identity` (unexpected binding), `Replay` (nonce/state or distribution-input failure), `Risk` (allocation policy) and `Proof` (amount/proof failure). Anchor additionally rejects signer, owner, seed, address, init and `has_one` constraint violations; System Program transfer errors can propagate. Error names are not a promise to distinguish every invalid-input cause uniquely.

## Local build and validation

Root manifests are [Cargo.toml](../Cargo.toml), [package.json](../package.json) and [Anchor.toml](../Anchor.toml). The source checkpoint used Rust/Cargo 1.89.0, Anchor CLI 0.31.1, Agave 4.3.2 and SBF platform-tools 1.57.

```sh
cargo check --workspace
cargo test --workspace
anchor build
npm ci --ignore-scripts
npm run check
npm test
```

These commands are build/test commands, not deployment commands. Install the official tools separately; this clean repository includes neither tool binaries nor `.tooling/`. The [Windows helper](../scripts/dev-tools.ps1) describes an earlier portable installation layout; it is not an installer and should only be sourced if those paths already exist. A normal configured toolchain does not need that helper.

Prior validation: six Rust tests (four accounting, one native Anchor dispatch test with six scenarios, one generated-ID test), 29 Node tests, SBF compilation and real IDL generation. Dispatch coverage is focused on reserve authorization/custody; it is not a complete validator/SBF execution suite. Results are retained checkpoint evidence, not a fresh clean-checkout execution claim.

The existing development public ID appears consistently in source, localnet config, IDL and tests. No corresponding private keys are distributed. An owner-authorized local setup must make the existing development identity available securely for build steps that require it; do not silently generate a replacement ID, reuse a creator wallet as the program ID or treat a build-generated key as an official deployment identity.

Anchor client PDA resolver metadata is disabled because of the selected macro/parser combination. Runtime seeds, bumps, `has_one`, signers and safety lint remain enabled; SDK builders supply every PDA explicitly. No mainnet provider or deployment command is supplied.
