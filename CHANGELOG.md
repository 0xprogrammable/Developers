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

No unreleased changes.

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
