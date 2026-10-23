# Meteora DBC adapter

Uses the installed official SDK and its IDL; no copied account offsets or hand-written Meteora instructions. Supports standard SPL mint, SOL quote and standard creator fee claims before migration. Mint and freeze authority must be disabled. Transfer-hook/Token-2022 pools and all migrating/migrated states stop collection.

`discover` queries pools by creator and filters the mint; it returns candidates, not an automatic selection. `verify` binds one owner-configured pool/config/mint/creator, program ownership, cluster genesis, quote mint and creator fee rights. `tokenAccount` derives and validates a standard SPL associated token account.

`prepareClaim` builds an unsigned quote-only claim, checks payer fee balance and requests simulation. It never signs or broadcasts. `confirmedReceipt` compares the finalized transaction message to the exact prepared message, checks the IDL-defined claim instruction, decodes a unique matching Anchor event-CPI and reconciles physical SOL receipt. It refuses missing evidence, base-token claims, multiple events, precision loss and unexplained rent/balance changes.

RPC reads across accounts are not an atomic bank snapshot; chain state can change between verification and external submission. Actual transaction constraints and finalized reconciliation are separate controls. No COMPD pool or mint has been supplied, so live discovery/simulation has not been performed. `migration.mjs` supports verified DBC-to-DAMM-v2 position-fee preparation with current NFT ownership and finalized migration-instruction binding, followed by separate asset reconciliation. It rejects DAMM v1 or unproven ownership. No live COMPD migration evidence is configured.

See [Meteora integration reference](../../docs/METEORA-DBC.md) for the complete source-mapped reference.
