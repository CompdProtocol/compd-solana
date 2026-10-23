# Third-party scope and notices

The scoped first-party MIT grant does not relicense any third-party material. No website libraries or historical Flap source are included in this snapshot. This clean repository imports no historical commits; original repositories and their separate historical obligations remain unchanged.

| Retained material | Verified license | Redistribution requirements / boundary |
|---|---|---|
| docs/legal/active/meteora-dbc-sdk-LICENSE, docs/legal/active/meteora-damm-v2-LICENSE | MIT, exact pinned installed-package notices | Preserve the original copyright and permission text with substantial upstream code copies. SDK implementation is installed as a dependency, not vendored here. |
| docs/legal/packages/protocol/lib/forge-std/LICENSE-MIT and LICENSE-APACHE | Original dual MIT / Apache-2.0 presentation | Texts retained byte-for-byte. Historical source keeps its original notices. Under MIT retain copyright/permission; under Apache retain license, applicable notices, mark modifications and include applicable NOTICE attribution. No forge implementation is included in this snapshot. |
| docs/legal/packages/protocol/vendor/openzeppelin-contracts-upgradeable/LICENSE | MIT, original pinned notice | Preserve original copyright/permission with redistributed substantial copies. No OpenZeppelin implementation is included in this snapshot. |
| docs/legal/packages/protocol/THIRD_PARTY_NOTICES.md | Historical provenance/attribution record | Preserve as historical evidence; its discussion of Flap is not a new license grant. |
| package-lock.json / Cargo.lock dependency references | Each installed dependency has its own terms | Lockfiles are not vendored implementations. Do not infer all dependency licenses from MIT at the root; bundling/installing packages or producing redistributable artifacts has separate notice requirements. |

GSAP Standard License redistribution terms remain unverified because the official terms endpoint is unavailable. Flap's pinned MIT SPDX and team author annotation do not establish a missing copyright/year notice. Those issues remain with the original repositories; no affected source or historical commits are copied into this clean repository. No permission is invented and no required notice is removed.

Sources: [Meteora DBC](https://github.com/MeteoraAg/dynamic-bonding-curve-sdk), [Meteora DAMM](https://github.com/MeteoraAg/damm-v2-sdk), [Apache redistribution terms](https://www.apache.org/licenses/LICENSE-2.0), [MIT](https://spdx.org/licenses/MIT.html). Pinned-package and historical blob comparisons are recorded in docs/PUBLICATION-REVIEW.md.
