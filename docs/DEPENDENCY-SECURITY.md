# Runtime dependency review

[Security architecture](SECURITY.md) · [Main README](../README.md)

Reviewed against the retained [audit evidence](DEPENDENCY-AUDIT.json) and package-lock.json on 2026-10-23. The audit JSON is an unchanged historical machine report, not a newly run audit. No dependency or lockfile changed during this review.

## Classification

FIX means a compatible remediation has been demonstrated and validated for that entry. MITIGATED BUT OPEN means the installed vulnerable dependency remains, but the reviewed execution path avoids or limits the affected APIs. OWNER RISK ACCEPTANCE REQUIRED means releasing the current high-severity dependency chain needs an explicit decision or further compatible remediation. These are release-review dispositions, not proof of exploitability or safety. Acceptance does not repair a dependency and must not authorize mainnet operation by implication.

14 affected entries: 7 high, 7 moderate; 5 direct production dependencies and 9 transitive dependencies. No entries are development-only. Four underlying advisory-bearing packages propagate findings through the SDK tree; wrapper entries are not independent vulnerabilities.

| Package / installed version | Scope / severity | Disposition | Evidence and remaining action |
|---|---|---|---|
| @coral-xyz/anchor 0.31.1 | Direct production / high | OWNER RISK ACCEPTANCE REQUIRED | Inherits TOML, borsh and web3 findings. Explicit Program instances avoid workspace loading in the Agent; TOML still ships. Recorded audit offers no fix. |
| @coral-xyz/borsh 0.31.1 | Transitive / moderate | MITIGATED BUT OPEN | Inherits web3 peer finding, rather than a separate borsh advisory. Audit says fixAvailable=true but provides no target; this is not a verified compatible fix for the pinned graph. Do not count it resolved. |
| @meteora-ag/cp-amm-sdk 1.5.1 | Direct production / high | OWNER RISK ACCEPTANCE REQUIRED | Inherits Anchor, SPL Token and web3 findings. Actual SDK is used; no clean compatible replacement established. |
| @meteora-ag/dynamic-bonding-curve-sdk 2.0.0 | Direct production / high | OWNER RISK ACCEPTANCE REQUIRED | Same inherited chain; official DBC interface use does not eliminate vulnerable dependencies. Recorded audit offers no fix. |
| @solana/buffer-layout-utils 0.3.0 | Transitive / high | OWNER RISK ACCEPTANCE REQUIRED | Inherits native bigint-buffer and web3 findings. Native binding is absent here, not guaranteed absent on another installation. Suggested SPL 0.1.8 downgrade is breaking. |
| @solana/spl-token 0.4.15 | Direct production / high | OWNER RISK ACCEPTANCE REQUIRED | Inherits buffer-layout-utils, group, metadata and web3 findings. Compatible 0.4.14 to 0.4.15 update already applied; suggested 0.1.8 downgrade rejected as incompatible. |
| @solana/spl-token-group 0.0.7 | Transitive / moderate | MITIGATED BUT OPEN | Inherits web3/Jayson findings. Standard-token application scope does not remove this installed package. Suggested SPL downgrade is breaking. |
| @solana/spl-token-metadata 0.1.6 | Transitive / moderate | MITIGATED BUT OPEN | Inherits web3/Jayson findings; no independent advisory here. No safe graph fix demonstrated. |
| @solana/web3.js 1.98.4 | Direct production / moderate | MITIGATED BUT OPEN | Imports jayson/lib/client/browser, not its streaming server. Recorded audit proposes major 3.1.1, not a compatible patch. |
| bigint-buffer 1.1.5 | Transitive / high | OWNER RISK ACCEPTANCE REQUIRED | Native toBigIntLE buffer overflow. No .node binary found in this installation; JS fallback used. Lifecycle scripts were disabled when installing. Native re-enablement invalidates this mitigation; no patched compatible package established. |
| jayson 4.3.0 | Transitive / moderate | MITIGATED BUT OPEN | Browser client uses JSON.parse and UUID v4; installed server/streaming dependencies remain affected. Suggested web3 major upgrade is outside this change. |
| stream-json 1.9.1 | Transitive / moderate | MITIGATED BUT OPEN | Recorded parser/filter DoS and Assembler prototype pollution advisories. Reviewed RPC client uses JSON.parse, not these APIs; no claim the package is fixed. Jayson requires ^1.9.1; forced 3.x override is not compatible evidence. |
| toml 3.0.0 | Transitive / high | OWNER RISK ACCEPTANCE REQUIRED | Recursion, prototype pollution and resource-consumption advisories. Anchor workspace helper parses local Anchor.toml; Agent does not accept untrusted TOML. Recorded audit offers no fix; later-version fixes for some advisories do not clear all recorded ranges. |
| uuid 8.3.2 | Transitive / moderate | MITIGATED BUT OPEN | Advisory concerns v3/v5/v6 supplied-buffer APIs; Jayson browser imports v4. Patched >=11.1.1 is a major change beyond this graph. |

Classification totals: FIX 0; MITIGATED BUT OPEN 7; OWNER RISK ACCEPTANCE REQUIRED 7. No suppression, forced upgrade, override or source patch applied.

## Evidence and limits

- package-lock.json records exact installed versions and production scope; the root has no devDependencies. A package used only in a tooling code path can still be an installed production dependency.
- node_modules/@solana/web3.js/lib/index.cjs.js imports jayson/lib/client/browser.
- node_modules/jayson/lib/client/browser/index.js imports uuid.v4 and handles response text with JSON.parse.
- node_modules/@coral-xyz/anchor/dist/cjs/workspace.js calls toml.parse on Anchor.toml. Reviewed Agent code constructs explicit Program instances and uses JSON input.
- node_modules/bigint-buffer/dist/node.js attempts a native binding and falls back to JavaScript. No native .node artifact was found in that package during this review. This is installation-specific, not a durable source-level guarantee.

Compatible fixes previously applied: SPL Token 0.4.15 and patched bn.js 5.2.5; prior npm audit fix without --force left these 14 entries. Neither limited runtime reachability nor npm's boolean fixAvailable is a complete remediation.

Source publication can disclose these residual risks without enabling execution. Owner acceptance of this source-release risk is separate from approving any operational use. Mainnet use still requires independent security review and validated deployment-specific controls.

Underlying advisories: [bigint-buffer](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg), [UUID](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Full parser advisory URLs and affected ranges are preserved in the unchanged audit JSON.
