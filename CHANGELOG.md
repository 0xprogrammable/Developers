# Changelog

## 2.0.0 - 2026-08-06

- Make API v2 the canonical integration for new consumers.
- Define `Programmable Classic` from enabled Classic launcher events.
- Reserve `Programmable Custom` for accepted Custom Registry events.
- Exclude historical Stock-Paired records from the v2 Custom classification.
- Keep API v1 available for compatibility and publish a migration guide.
- Add v2 endpoints, schemas, OpenAPI, fixtures and conformance tests.

All notable changes to the Programmable Developer Platform are recorded here.

This project follows [Semantic Versioning](https://semver.org/) and the compatibility rules in [VERSIONING.md](VERSIONING.md).

## [Unreleased]

- Publish stable prelaunch Generation 2 event-set and release-candidate metadata URLs without adding them to the live manifest.
- Add the optional provider-attribution schema and fail-closed trust semantics.
- Add a bounded full-traversal JavaScript reference and define Developer-manifest precedence over the Website operational mirror.
- Add direct onchain verification, Programmable Verified, multi-chain, and production integration guides.
- Document the additive Registry-backed v2 project, multi-asset, approval, deployment, review, fee, finality, authority, lifecycle, and presentation fields plus launch-ID detail lookup.
- Define Native Custom and partnership-template fee semantics, including the exact 20 bps total and 15/5 partner/Programmable split without an additional Native Custom fee.
- Document the current Basebit and Aion evidence blockers without presenting either integration as live.
- Add project-only-safe JavaScript examples and a typed v2 client covering discovery, feed, launch-ID, token, and token-list access.
- Add conditional Preview and Live release-post drafts.
- Correct the security support table to include canonical API v2 while retaining v1 compatibility support.
- Document the live operator claim console and its separate read-only discovery policy, wallet boundary, atomic batching, reviewed source inventory, and fail-closed Custom admission rules.

## [1.1.0] - 2026-08-05

- Add authenticated, request-bound finalized Custom Registry ingestion with fail-closed completeness and freshness.
- Add identity-first assets and truthful `token: null` project-only launches without fabricating pairs or pools.
- Preserve trusted Programmable origin, open-ended model identity, and canonical public Uniswap v4 market taxonomy.

## [1.0.0] - 2026-08-04

### Added

- Initial public release of the Programmable Developer Platform.
- Versioned integration specifications for Programmable Classic and Programmable Custom launches.
- Reference documentation for launch discovery, markets, capabilities, and onchain verification.
- Machine-readable schemas, API definitions, examples, fixtures, and conformance checks for integrators.
- Versioning, contribution, support, security, and licensing guidance.

[Unreleased]: https://github.com/0xprogrammable/developers/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/0xprogrammable/developers/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/0xprogrammable/developers/releases/tag/v1.0.0
