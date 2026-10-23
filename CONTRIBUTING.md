# Contributing to COMPD

COMPD — The Compounder · Built to Compound.

The active implementation is Solana-native. Original COMPD-owned source code is MIT licensed within [LICENSE-SCOPE.md](LICENSE-SCOPE.md); third-party work and standalone documentation retain their separate rights. Source publication does not authorize deployment or mainnet use.

## Start here

Read [architecture](docs/ARCHITECTURE.md), [program requirements](docs/PROTOCOL.md), [Meteora integration](docs/METEORA-DBC.md), [Agent](docs/AGENT.md) and [Holder Rewards](docs/HOLDER-REWARDS.md). Check existing issues and pull requests before starting. Discuss changes to financial rules, custody or authority boundaries before implementation.

## Development environment

Use Node.js 24+ and the Rust/Anchor toolchain described in [local build requirements](docs/PROTOCOL.md#local-build-and-validation). The validated source checkpoint used Rust 1.89.0, Anchor CLI 0.31.1, Agave 4.3.2 and SBF platform-tools 1.57. Tool binaries and private development keys are not included. The Windows helper is an earlier local layout, not an installer.

```sh
npm ci --ignore-scripts
npm run check
npm test
cargo check --workspace
cargo test --workspace
anchor build
```

Run checks relevant to the change and report exact commands/results, including anything unavailable locally. Follow the documented development identity requirements; do not silently replace the checked-in Program ID or commit generated keys. These commands compile/test; they do not deploy. Node tests are not Rust execution evidence, and a successful build is not an independent audit.

## Issues and pull requests

For ordinary defects, [open an issue](https://github.com/CompdProtocol/compd-solana/issues/new) with exact file references, reproduction steps, expected/actual behavior and relevant tool versions. Documentation reports should identify the incorrect statement and its source evidence. Do not include credentials, runtime database contents or sensitive infrastructure details.

Use a focused branch and the smallest useful diff. In a pull request, explain the problem, resulting behavior, validation and any remaining limitation. Preserve unrelated work; avoid formatting churn, generated artifacts and dependency upgrades unrelated to the fix. For documentation-only changes, check links, headings, examples and Mermaid syntax where relevant.

Financial or authorization changes need tests for u64 limits, rounding conservation, principal recovery, loss handling, replay prevention and rollback as applicable. Preserve fixed-recipient, signer and custody protections. Never weaken controls merely to make tests pass.

## Security reports

Follow [SECURITY.md](SECURITY.md), not a public bug issue, for vulnerabilities. GitHub private vulnerability reporting is currently disabled for this repository. Use an independently verified private maintainer channel; if none is available, request a private reporting route without disclosing the vulnerability. No private contact address is advertised here.

Do not post exploit details, private keys or seed phrases in public issues or pull requests. Do not activate trading, sign/broadcast transactions, deploy programs or change production configuration through a source contribution. The website is outside this repository.

## Licensing and attribution

Preserve [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), original copyright/license texts and [dependency disclosures](docs/DEPENDENCY-SECURITY.md). Do not claim ownership of upstream code or assume the first-party MIT grant overrides third-party terms. Identify the origin and applicable license of any proposed external material; do not add it without verifiable permission. Standalone documentation is outside the current first-party code grant, so clarify reuse/contribution permission before importing others' prose.

Do not fabricate chain evidence, affiliations, audits or activity. Source contributions and dependency-risk disclosure do not imply mainnet operational approval.
