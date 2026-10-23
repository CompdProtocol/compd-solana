# COMPD Solana Agent

The Agent observes a configured Solana cluster through its official JSON-RPC interface, validates Meteora DBC pool identity, and journals attributed creator-fee receipts. Eight-hour UTC cycles are deduplicated in SQLite. Observation failure is recorded; interrupted cycles require explicit recovery before retry.

## Modules

- `lifecycle.mjs`: cycle identity, market freshness and strategy risk qualification.
- `scheduler.mjs`: abortable eight-hour scheduler; does not trade.
- `journal.mjs`: atomic receipt accounting, replay/conflict protection, durable plans and recovery state.
- `receipts.mjs`: finalize and record a claim; verify an externally supplied message approval.
- `cli.mjs`: one observation cycle from an owner-supplied JSON file.

Public input fields: `rpcUrl` (HTTPS), independently verified `genesisHash`, `mint`, `creator`, `pool`, `config`, `receiver`, `payer`, and a private local `journalPath`. No example uses a fabricated COMPD mint, signer or treasury. No launch inputs are configured. Do not store signer credentials or database files in Git.

After validation and owner configuration, `npm run agent -- observe /absolute/path/to/public-inputs.json` performs observation only. This command was not run against mainnet during implementation. The library scheduler is available to an owner-controlled process; no service is installed or enabled.

DBC reserve observations are market data, not executable quotes. They are marked unqualified, and risk policy rejects unverified/stale inputs. `execution.mjs` obtains fresh official DBC quotes, applies explicit asset/pool admission and treasury risk/spend limits, and prepares unsigned swaps or protected-minimum buyback burns. `custody.mjs` separately verifies ordered program events against rent-backed treasury accounts. The Agent holds no signing authority and contains no signing or broadcast function.

Off-chain receipt buckets describe SOL received at the configured receiver. They do not establish on-chain Treasury PDA balances. On-chain deposits and realized-profit settlement remain separate authorized actions.

See [architecture](../../docs/ARCHITECTURE.md), [protocol](../../docs/PROTOCOL.md) and [remaining blockers](../../docs/BLOCKERS.md).

Holder snapshots and funded proof reconciliation are in `packages/sdk/holders.mjs`. Migration position-fee preparation and per-asset confirmation are in `packages/meteora-dbc/migration.mjs`. All require verified owner inputs; no mode signs or broadcasts.

See [Agent lifecycle and operations](../../docs/AGENT.md) for the complete source-mapped reference.
