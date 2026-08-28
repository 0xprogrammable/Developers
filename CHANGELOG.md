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

- Reconcile the public Custom Launch contract: retain V1 and V2 historical reads while making authenticated POST nonretryable HTTP 409, accept fresh submissions only through V3 profile `3.3.0`, publish server-authoritative behavior, fee-path, and liquidity evidence gates for wallet handoff, and cap applicant-selected V3 fee rates at `100000` hundredths of a bip per direction and accounting mode while keeping the exact Programmable share at `1000`.
- Publish wallet-compatible V3 bearer authentication and the exact bounded partner-root/subkey contract through manifest, discovery, status, OpenAPI, human docs, and LLM surfaces without granting signing, broadcast, attribution-selection, security-bypass, or approval-bypass authority.
- Add the immutable authenticated-partner attribution schema and optional v2 `launchedVia` projection, document complete current-profile metadata and finalized metadata ingestion, and keep external indexing and `safe` labels explicitly outside the guarantee.
- Publish the immutable checksum-bound CLI `3.3.5` locator and bind it to tarball SHA-256 `d9df0c0bb4d492d0303bc849ea74b2a337dc5aef217c954192ad5c14576039ca`, pack-config schema SHA-256 `a81d6745a520766d8f1dc4bb04e5180c2b97e1157994d4987bdce53778313c60`, and Custom Launch V3 OpenAPI `3.3.5` SHA-256 `07d55af9cd34bf30e89655f7ffc676eb4245678ac80b1217c8ad0e2cb23eed51`; retain the prior CLI `3.3.3` entry below as release history.
- Bind required profile `3.2.0` project name, symbol, presentation, image digest, and sorted links through `projectMetadataHash`, metadata-bound `graphBundleHash`, prepared resources, launch IDs, and wallet review while retaining metadata-absent `3.1.0`, `3.0.0`, and `2.0.0` resources and keeping finalized token readback and untrusted presentation data as separate evidence boundaries.
- Publish profile `3.2.0` with seven objective hard blocks, exact `3.1.0` and `3.0.0` read/retry compatibility, evidence-only treatment for complex governance/accounting/liquidity surfaces, platform-authored behavior evidence, six independent product truth axes, and bounded authenticated lifecycle-queue polling metadata without changing Developer feed records.
- Publish public V3 capability discovery and authenticated quota-free preflight discovery, including the standalone `programmable.custom-launch-preflight.v1` response schema, typed remediation, explicit no-persistence/no-wallet side effects, and separate deployable, routable, featured, deployment, trading, fee, verification, and indexing boundaries.
- Publish additive Direct Native Hook Graph Profile Revision 3 discovery for the live Custom Launch API V3 general lane: exact source/compiler/graph binding, blocking-versus-warning static indicators, mandatory exact Router simulation before authorization, live checksum-bound CLI `3.3.3` release discovery with bound project metadata and pre-wallet EIP-3009 nonce-cycle diagnostics, retained Revision 2 compatibility, and explicit non-audit, non-honeypot, non-liquidity, non-tradeability, and non-fee-behavior guarantees.
- Publish a separately identified Direct Native Hook Graph Profile Discovery V1 schema, manifest/status descriptor and integration guide as a fail-closed Custom Launch API V3 preview for profile version `1.0.0`: 3–16 direct targets over the Router's 2–16 and GraphFactory's 1–16 limits, distinct token/hook/initializer roles over `token|hook|other` component kinds, static LP fees no higher than `999999`, constrained v4 permission sets, ERC-20/native currencies, the two-stage `fundingIntentHash` flow, the full V3 selection binding and an inclusive selected-total 10-bps platform split; V1/V2 and the two public categories remain compatible while V3 API, CLI, permit-authority profile admission and feed support stay gated pending integration-owner activation.
- Clarify the additive v2 Custom source-provenance contract: accepted manifest-bound Registry evidence and consistent finalized canonical-Router `CustomGraph` evidence share the unchanged `custom` category while retaining distinct classification bases; API v1 is unchanged.
- Project finalized canonical-Router Custom token identities through the v2 launch feed and token list, with a bounded last-known-good snapshot and unavailable rather than invented market, supply, and fee data.
- Keep v2 launch-list and token-list readable across retired legacy-source and incomplete-coverage states, with explicit degraded or unavailable quality and preserved recognized identities.
- Publish the live Custom Launch API readiness link and mark legacy Registry and GitHub submission intake closed across discovery, manifest, OpenAPI, support, and agent documentation.
- Add support-safe problem timestamps and expose `Retry-After` alongside request IDs without including credentials.
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
