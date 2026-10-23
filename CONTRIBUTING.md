# Contributing to COMPD

COMPD — The Compounder · Built to Compound.

This Solana-native source snapshot is under publication review. Original COMPD-owned source code is MIT licensed within [the stated scope](LICENSE-SCOPE.md). Preserve third-party notices; no third-party ownership or broader documentation/artwork rights are implied.

Start with [architecture](docs/ARCHITECTURE.md), [program requirements](docs/PROTOCOL.md), [Meteora integration](docs/METEORA-DBC.md), [Agent](docs/AGENT.md), [Holder Rewards](docs/HOLDER-REWARDS.md) and [blockers](docs/BLOCKERS.md). Check existing issues and PRs before starting; explain the exact defect and smallest useful fix. Use a focused branch and include reproduction steps, expected/actual results and validation evidence.

For JavaScript changes, use Node 24+, `npm ci --ignore-scripts`, `npm run check` and `npm test`. For financial changes, cover u64 limits, rounding conservation, principal recovery, loss handling and failure atomicity. For Rust, run the accounting tests, program/IDL build and local adversarial account-constraint tests. Report checks that cannot be run; Node tests are not Rust execution evidence.

Do not activate trading, sign/broadcast transactions, deploy programs or change production configuration through a source contribution. Keep all credentials and runtime databases outside Git. The website is not included in this repository. Preserve attribution and [historical notices](docs/DEPENDENCIES.md).

Follow [SECURITY.md](SECURITY.md) for vulnerability reports. Never post secrets or exploit details in public issues. Keep PRs limited to the verified change and do not claim upstream affiliation or completed independent audit.
