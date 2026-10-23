# Dependency provenance and licensing

- `@meteora-ag/dynamic-bonding-curve-sdk` 2.0.0: official SDK, https://github.com/MeteoraAg/dynamic-bonding-curve-sdk. Inspected reference revision `3a965ec0c0a527c2be3c48b8b479366705bf4926`; tests additionally check the installed SDK's actual IDL event and instruction fields. Rust/on-chain DBC licenses are separate; this implementation calls the SDK and copies no DBC on-chain source.
- `@coral-xyz/anchor` 0.31.1 and `anchor-lang` 0.31.1: selected stable client/program family, https://github.com/coral-xyz/anchor/tree/v0.31.1. Native Rust, SBF and IDL compilation pass.
- `@solana/web3.js` 1.98.4 and `@solana/spl-token` 0.4.15: official Solana transaction/SPL clients, used for unsigned preparation and account validation.
- `@meteora-ag/cp-amm-sdk` 1.5.1: official Meteora DAMM v2 position-fee API, https://github.com/MeteoraAg/damm-v2-sdk. Actual installed IDL is checked in tests; no on-chain DAMM source is copied.
- `bn.js` 5.2.5: SDK boundary integers; compatible patch chosen after audit. Internal financial accounting uses BigInt/u64, never floating-point lamport arithmetic.
- Node.js 24+: built-in SQLite, cryptography, test runner; no hosted database, paid API or subscription required.

`package-lock.json` records resolved npm dependencies and registry integrity. Packages were installed with lifecycle scripts disabled. A native bigint optimization was not built; the package reports its pure-JavaScript fallback. Do not interpret this as a treasury test failure.

The latest captured `npm audit` report is [DEPENDENCY-AUDIT.json](DEPENDENCY-AUDIT.json). Advisories remain in the Anchor/Solana dependency tree, including bigint-buffer and parsers. These are runtime dependencies, not merely test tooling. No major-version downgrade/upgrade is applied to suppress audit output. There is no claim of a clean dependency audit or safe mainnet execution. Native bigint bindings remain disabled here, but that does not resolve all JavaScript dependency advisories.

Retained historical notices are under `docs/legal/`, copied byte-for-byte from the previous repository tree. Flap attribution and GSAP redistribution questions in those notices remain unresolved where stated; archiving code does not retroactively resolve historical distribution obligations. The untouched website snapshot retains its own vendor notices and restrictions. COMPD first-party licensing still awaits owner approval; no root LICENSE is invented.

Official interface references:
- https://github.com/MeteoraAg/dynamic-bonding-curve-sdk/blob/3a965ec0c0a527c2be3c48b8b479366705bf4926/packages/dynamic-bonding-curve/src/services/creator.ts
- https://github.com/MeteoraAg/dynamic-bonding-curve-sdk/blob/3a965ec0c0a527c2be3c48b8b479366705bf4926/packages/dynamic-bonding-curve/src/services/state.ts
- https://www.anchor-lang.com/docs/features/events
- https://github.com/coral-xyz/anchor/blob/v0.31.1/lang/src/event.rs

See [runtime exposure review](DEPENDENCY-SECURITY.md) and [build/test scope](PROTOCOL.md).

Exact MIT license files for the installed official DBC and DAMM SDK packages are retained under `docs/legal/active/`. The four historical notice blobs remain unchanged.
