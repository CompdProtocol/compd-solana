# Publication review — 2026-10-23

Clean-repository addendum: the original branch review below is retained as provenance. This new local repository contains no historical commits, website assets or Flap source. Historical GSAP/Flap clearance applies to the originals, not to importing their history here. The owner approved the first-party MIT identity/scope in LICENSE-SCOPE.md. Source publication is pending disclosed dependency-risk acceptance and explicit remote publication approval; mainnet remains NOT READY. See [clean scope](PUBLICATION-TREE.md).

Export addendum: this isolated candidate omits apps/ and all historical Flap executable source, preserving notices. Its MIT LICENSE was subsequently approved for original COMPD-owned source code only. The following review describes the original history-preserving branch; see [publication tree](PUBLICATION-TREE.md) for snapshot scope and [owner decisions](OWNER-DECISIONS.md).

**Repository publication: BLOCKED pending third-party rights evidence and owner release decisions. Mainnet operation: NOT READY, independently of publication.**

This review updates the prior checkpoint without changing executable source, dependencies, website, keys or history. The retained [validation record](VALIDATION.json) remains the build/test evidence. The [individual dependency review](DEPENDENCY-SECURITY.md) interprets the unchanged [audit JSON](DEPENDENCY-AUDIT.json).

## Repository-publication requirements

| Item | Status | Exact remaining requirement |
|---|---|---|
| Three.js 0.186.1 | RESOLVED for preserved license text | Full MIT notice in apps/src/vendor/three.LICENSE matches pinned npm LICENSE after newline normalization. Preserve bundle notices; custom subset is not asserted to be an identical upstream build. |
| forge-std / OpenZeppelin | RESOLVED for restored notices | Four retained historical notice/license blobs match historical Git bytes. Keep the existing dual-license and copyright notices. |
| Active Meteora SDK license copies | RESOLVED for copied notices | Both retained MIT texts match installed pinned packages. This does not grant rights to unrelated on-chain source or remove transitive license obligations when packaging dependencies. |
| GSAP / ScrollTrigger 3.15.0 | UNAVAILABLE AUTHORITATIVE TERMS | Both assets match pinned npm release text after newline normalization and preserve proprietary headers. The npm package contains no standalone license. Both official Standard License URLs redirect to an offline page. Obtain applicable redistribution terms or written upstream clarification. Owner acceptance alone cannot invent permission. |
| Historical Flap files | PARTIALLY RESOLVED | Pinned VaultBase.sol explicitly identifies The Flap Team as author; MIT SPDX is present. This verifies authorship attribution, not a copyright-holder/year notice or the complete missing project-level license text. Obtain authoritative clarification; do not manufacture copyright text. |
| COMPD first-party license | OWNER POLICY DECISION | A root license is not a GitHub publication prerequisite. Owner may choose a license they have rights to grant or explicitly publish without a reuse license. Do not call the latter open source or imply unrestricted reuse. No root LICENSE created. |
| Dependency risk disclosure | REVIEWED, OPEN | 14 affected production-tree entries remain. No finding is fixed by a code-path limitation. Owner must choose source release with disclosed residual risks or defer for remediation; this does not authorize mainnet execution. |
| Historical author privacy | NO NEW CONFIRMED SENSITIVE EXPOSURE IN TARGETED CHECK | See below. Ordinary upstream authorship and GitHub service metadata are not secrets and must not be removed as cosmetic cleanup. |

### Authoritative licensing references

- [Pinned GSAP source](https://github.com/greensock/GSAP/tree/3.15.0), [standard terms](https://gsap.com/standard-license/), [alternate official terms URL](https://gsap.com/community/standard-license/). Both terms URLs were checked on 2026-10-23; neither returned the substantive license. Third-party template-shop terms and summaries were excluded.
- [Pinned Flap VaultBase.sol](https://raw.githubusercontent.com/flap-sh/FlapVaultExample/5949cc7eb99bcb5ac5f679cc710ae456e627f12a/src/flap/VaultBase.sol): MIT SPDX and original author annotation. Existing pinned recursive-tree evidence contains dependency licenses but no project-level LICENSE/NOTICE/COPYING. Do not apply later main-branch changes retroactively.
- [GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository): public source and open-source licensing are distinct. Third-party rights remain independent of COMPD's choice.

Historical Flap paths (deleted from the proposed active tree, retained in Git history): packages/protocol/src/flap/IPortal.sol, IVaultFactory.sol, IVaultPortal.sol, IVaultSchemasV1.sol, VaultBase.sol, VaultBaseV2.sol, VaultBaseV3.sol and VaultFactoryBaseV2.sol. The directory prefix applies to each listed basename. Removal from HEAD does not erase redistribution history.

## Historical identity review

The 67 commits reachable through local refs were inspected for author/committer identities. The observed identities are COMPD project identities and GitHub's service identity, not evidence of a personal identity leak. A first-pass non-approved-identity count included service metadata and must not be reported as 61 personal-author exposures.

A targeted reachable-blob check found no matches for the previously reported personal account handle or Windows local-profile paths. No sensitive values are reproduced here. This is a scoped identity-path review, not a renewed full secret audit or a proof about all server-retained/unreachable commits.

Author-bearing historical paths that must be preserved include:

- apps/src/vendor/gsap.min.js and apps/src/vendor/ScrollTrigger.min.js: original third-party author/copyright headers.
- apps/src/vendor/three.LICENSE and historical packages/protocol/lib/forge-std/LICENSE-MIT, LICENSE-APACHE and packages/protocol/vendor/openzeppelin-contracts-upgradeable/LICENSE: upstream license attribution.
- Historical packages/protocol/src/flap/VaultBase.sol: upstream team author annotation.
- docs/legal/packages/protocol/ contains retained original licensing notices, not a new private-person disclosure.

These are ordinary public upstream attribution, not a basis for deleting required notices. Earlier identity-exposure evidence for the separate compd-protocol/interface/agent repositories remains outside this branch's remediation scope. No assertion is made that old GitHub commit URLs or unreachable objects disappeared. If the owner identifies another specific personal name/address to check, compare it locally without republishing it. No history rewrite is recommended on the current evidence.

## Mainnet-operational requirements — not publication blockers

Public Program ID candidate: `69oLCEtauvko4xyBAVWg2tBHswnCJ9v6DkDfQLjQdwVT`.
Existing keys and encrypted local backup remain unchanged. Prior derivation and in-memory recovery passed; this review did not open, display, export or regenerate private keys. The ignored files are excluded from publication. Independent disaster-recovery backup and owner designation are deployment gates, not a reason to hide otherwise releasable source. No deployment claim is made.

Operational gates remain: verified mainnet mint/pool/config and authority inputs; independent recoverable key custody; deployment-specific approvals; full SBF/validator execution and adversarial testing; independent security review; dependency-risk remediation/acceptance for actual use; and validation of supported migration, holder-snapshot and reconciliation limits. The 35 local tests do not establish production readiness. No source-release decision substitutes for these gates.

## Validation scope and preserved checkpoint

- Existing workspace compilation, Anchor SBF/IDL build, six Rust tests and 29 Node tests passed. No functional source change warrants repeating them in this documentation-only review.
- Repository-review checks: individual audit-entry/lockfile classification; installed runtime import inspection; targeted historical identity paths; Markdown links/fences; whitespace; before/after non-document file hashes.
- No commit, push, public repository mutation, history rewrite, key generation, signing, broadcast, deployment or fund transfer.

## Owner actions

See the short [owner decision checklist](OWNER-DECISIONS.md). Missing GSAP/Flap rights evidence cannot be replaced by a generic risk waiver. Stop publication approval until that evidence or an explicitly authorized alternative distribution scope resolves it.
