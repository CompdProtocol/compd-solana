# Clean Solana publication scope

This is a separate local Git repository prepared from the validated 68-file snapshot. The single unverified banner was omitted and its README image link removed, leaving a 67-file clean baseline. The expanded documentation suite adds files; the current inventory is recorded in [DOCUMENTATION-VALIDATION.json](DOCUMENTATION-VALIDATION.json). No website source, GSAP implementation, Flap implementation, node_modules, build artifacts, runtime state or private keys are included.

No historical commits, refs, tags, Git objects, remotes, hooks, worktree links or alternates are imported. The original source branch, existing repositories and their history remain unchanged. Historical documentation and commit identifiers are provenance text, not imported Git history. Legal notices are preserved, not assertions that historical code is included.

Executable source, tests, IDL, lockfiles and all six retained legal files are byte-identical to the validated candidate. Documentation-only adjustments describe the clean-repository scope. Prior six Rust and 29 Node test passes remain the source checkpoint; they are not new tests of a deployed system.

The owner confirmed Copyright (c) 2026 CompdProtocol and approved MIT only for original COMPD-owned source code. Third-party works, standalone documentation and artwork are excluded from the first-party grant. Dependencies retain their original licenses; no installed dependency implementations are bundled. The owner approved public source publication; that approval does not authorize mainnet operation.

The retained 14-entry dependency disclosure has seven high and seven moderate affected entries; five direct and nine transitive production entries, none development-only. All remain open. Publishing source with this disclosure is a different owner decision from approving operational use.

The source was published to [CompdProtocol/compd-solana](https://github.com/CompdProtocol/compd-solana) with initial commit [e3266736f2dbe5c442c6a0e4764d34f4c803bedc](https://github.com/CompdProtocol/compd-solana/commit/e3266736f2dbe5c442c6a0e4764d34f4c803bedc). No historical commits were imported and no mainnet deployment is claimed. The pre-publication checklist in OWNER-DECISIONS.md is awaiting the separately tracked [documentation correction](https://github.com/CompdProtocol/compd-solana/issues/1).
