# COMPD SDK

`accounting.mjs` exposes integer-only revenue/profit splits with checked u64 bounds. `treasury.mjs` derives program PDAs, produces holder commitment hashes, and prepares treasury instructions using a real build-generated Anchor IDL supplied by the caller. No synthetic IDL is checked in.

`transactions.mjs` serializes unsigned messages into expiring envelopes and verifies external Ed25519 approval of the exact hash/expiry payload. It has no signing, secret storage, wallet generation or broadcasting API. Approval must be requested again whenever a blockhash/message changes.

`holders.mjs` supplies atomic-bank standard SPL snapshots, deterministic Merkle trees and funded distribution reconciliation. The latter derives claim PDAs and reads them together with the distribution in one finalized bank; it does not accept invented payment history. Both workflows explicitly reject larger-than-supported atomic batches.

The checked-in IDL under `idl/` is generated from the actual local development program and validated against the source/config public ID. It is not a mainnet deployment artifact. Client PDA resolver metadata is disabled; all SDK builders derive and supply addresses explicitly.

See [Holder snapshot and claim lifecycle](../../docs/HOLDER-REWARDS.md) for the complete source-mapped reference.
