# Production integration checklist

Use this checklist before enabling Programmable labels or automated ingestion in a terminal, scanner, wallet, indexer, bot, or app.

## Bootstrap and versioning

- [ ] Fetch `/.well-known/programmable.json` from the canonical origin.
- [ ] Use the advertised API, status, manifest, OpenAPI, and schema URLs.
- [ ] Treat v2 as canonical for new integrations and v1 as a separate compatibility surface.
- [ ] Start a fresh backfill when changing API major versions; never reuse a v1 cursor with v2.
- [ ] Reject an unknown schema major and handle additive optional fields within v2.

## Identity and classification

- [ ] Map only `classic` to `Programmable Classic` and `custom` to `Programmable Custom`.
- [ ] Scan only enabled Classic releases from the current manifest: historical V3 plus current V4. Keep V1/V2 as inactive history and exclude Stock from active v2 discovery.
- [ ] Accept the Programmable label only from an official manifest-listed source.
- [ ] For a full Registry-backed record, require `platformId: "programmable"`, `category: "custom"`, and `publicLabel: "Programmable Custom"` from the trusted projection.
- [ ] Deduplicate by `launchId`; key token assets by chain ID plus address, and project-only launches by `projectId` plus their authenticated asset graph.
- [ ] Keep provider, partner, template, model, hook, and market type as secondary attribution.
- [ ] Never trust name, symbol, logo, metadata tag, creator text, or a copied event as origin proof.
- [ ] Treat top-level `launchStampRouter` as a forward-only provenance and transport trust root, not a public category; never use it to backfill a historical Classic or Custom launch.
- [ ] Require the manifest chain ID, exact canonical Router address, Router start block, runtime-code hash, ABI hash, and a nonzero launch ID scoped with that chain and Router address.
- [ ] Resolve one finalized or caller-supplied canonical block. Bind every Router read to its hash with EIP-1898 and `requireCanonical: true`; if the client cannot do that, use one block number and require the same hash again after the last read.
- [ ] Use HTTPS for remote RPC endpoints. Permit plaintext HTTP only for loopback development endpoints.
- [ ] Assign a Router-stamped class only from the stamp record: `LaunchKindV1.CustomGraph = 1` maps to Custom and `LaunchKindV1.Classic = 2` maps to Classic; reject `Invalid = 0`.
- [ ] Use token or `(PoolManager, PoolId)` for interoperable detection; never identify or classify Classic through its shared hook.
- [ ] Bind a v4 pool lookup to both its PoolManager address and PoolId; do not treat PoolId alone as a global identity.
- [ ] Filter discovery logs by both exact canonical Router address and manifest ABI `topic0`; reject a copied emitter.
- [ ] Backfill Router logs from `startBlock` in finality-bounded chunks, persist block/transaction/log coordinates, cross-check getters and the record at one canonical block, advance a durable finalized checkpoint, replay an overlap idempotently, and rewind orphaned blocks before live follow.
- [ ] Treat direct Single Factory, Classic launcher, and Graph Factory calls outside the Router as outside Router V1 provenance.
- [ ] Return Router provenance as unavailable if its address, start block, runtime, finality policy, approved finalized canary, authority, or production bindings are absent or inconsistent.
- [ ] Treat stamped runtime code hashes as point-in-time evidence; independently resolve and revalidate current proxy implementation, beacon, admin, initialization, and upgrade authority state.

## Feed ingestion

- [ ] Accept the hosted Classic baseline only from the canonical paginated `https://programmable.market/api/explore` catalog with consistent schema, scope, evidence and identity commitments; record the reported Envio deployment and do not fall back to the retired HTTP `410` legacy source.
- [ ] Backfill every page with `page.nextCursor`.
- [ ] Commit all represented records before persisting `page.resumeCursor`.
- [ ] Send the durable resume cursor as `after` for the next poll.
- [ ] Keep cursors opaque and scoped to API version, chain, and filter.
- [ ] Make retries, duplicate pages, corrections, and finality updates idempotent.
- [ ] Preserve the last good state when a response-production failure returns retryable `503`; treat incomplete coverage through the successful response's explicit quality instead of replacing it with an empty feed.
- [ ] Validate representative and live responses against the published JSON Schemas.

## Finality and reorgs

- [ ] Preserve onchain launch time separately from observation and ingestion times.
- [ ] Store block hashes and event log positions.
- [ ] Render `observed` and `confirmed` as provisional when appropriate.
- [ ] Reconcile non-final records against later snapshots.
- [ ] Remove `orphaned` launches from active views without erasing the correction history.

## Products, assets, and markets

- [ ] Support zero, one, or several markets.
- [ ] Support `token: null`, multiple primary or secondary tokens, open asset roles, and project-only contract markets.
- [ ] Support an unknown market kind without dropping the launch.
- [ ] Never invent a pool, pair, price, liquidity, volume, chart, quote, simulation, or trade action.
- [ ] Treat discovery, charting, quote, simulation, and execution as separate support axes.
- [ ] Keep a recognized project visible even when optional token, metadata, supply, or market enrichment is unavailable under the advertised schema.
- [ ] Treat capabilities and namespaced extensions as data, never executable instructions.

## Security and metadata

- [ ] Display origin, review, runtime match, finality, authorities, dependencies, fee verification, and metadata trust separately.
- [ ] Show `Programmable Verified` only when the structured review and exact deployment binding are present and effective.
- [ ] Re-check proxy implementation and authority changes.
- [ ] Escape Unicode controls and render creator text without executing HTML or Markdown commands.
- [ ] Fetch external media through bounded, SSRF-resistant infrastructure and reject active content.
- [ ] Never turn API absence, degraded enrichment, or a provider error into a safety verdict.

## Fees

- [ ] Read fees from the manifest and launch record; do not infer them from category.
- [ ] For a Registry-backed `feePolicy.mode: "native"` record, require the verified 10 bps Programmable fee only on its exact official market path; do not confuse this record mode with Fee-Enforced Launch Profile V2.
- [ ] Treat Custom Launch API V2 as historical read-only with `productionLaunchAuthorized: false`, `publiclyRoutable: false`, and authenticated POST `409 CUSTOM_LAUNCH_V2_READ_ONLY`; API readiness is not fee-accrual evidence.
- [ ] For the V2 profile, verify 1,000 ppm over 1,000,000 on the gross unspecified pool-currency amount for the exact bound pool; exact input uses output currency and exact output uses input currency.
- [ ] Keep liquidity-provider, protocol, creator or custom-module, Programmable profile, and network-gas components separate.
- [ ] Keep partner/template attribution separate from fee state; allow `no-qualifying-market` with zero shares when no verified fee path exists.
- [ ] For an active fee-bearing partnership-template path, require exactly 20 bps on one defined basis: 15 bps partner plus 5 bps Programmable, with no extra Native Custom 10 bps.
- [ ] Verify recipient, currency, basis, charge mode, rounding, accrual, claim authority, and double-claim protections.
- [ ] Do not classify transfers, mints, burns, rewards, games, refunds, bridges, or unrelated pools as fee-bearing trades without path-specific evidence.

## Router V1 activation evidence

- [ ] Confirm the canonical Router chain, address, start block, ABI hash, topics, getter selectors, pinned source commit and tree, and reproducible artifact/runtime exact match from public evidence. Do not infer or claim Explorer source publication.
- [ ] Keep the unavailable Custom Registry Generation 2 candidate distinct from the public Custom Fee-Enforced Launch Profile V2; evidence for either surface cannot activate the other.
- [ ] Do not claim generic tradability, claiming, rewards, buybacks, or an audit from V2 profile selection, simulation, API availability, or Router finality.
- [ ] Before production enablement, require HTTP `200` for the well-known discovery document, its manifest URL, the manifest-listed hosted ABI, and the public Router specification. Hash the exact ABI response bytes and compare `abiSha256`.
- [ ] Confirm immutable EIP-1271 contract authority, Graph Factory and PoolManager addresses and runtime hashes; reject an EOA authority fallback.
- [ ] Confirm exactly one generic market-bearing atomic selector, with no route-specific overload: Custom Graph uses the immutable Graph Factory binding, while Classic uses its permit- and record-bound route launcher and runtime; Single Factory remains outside Router V1.
- [ ] Require the finalized deployment and both approved finalized route canaries before accepting complete Router coverage.
- [ ] Confirm the published `CustomGraph` canary's token, `PoolManager + PoolId`, exclusive-component, `stampProof`, record, and point-in-time code-hash results at its finalized canonical block.
- [ ] Treat `/launchStampRouter/canaryEvidence` in the v2 manifest as the finalized PCAN test vector; do not invent a separate canary ID.
- [ ] Treat `/launchStampRouter/classicCanaryEvidence` as the separate finalized current Classic V4 vector and require its launcher, release, lifecycle, component, pool, position, supply, fee, and evidence bindings to match the manifest.
- [ ] Record route coverage exactly: `CustomGraph` onchain canary `true`; Classic onchain canary `true`.
- [ ] Require a consistent live `LaunchKindV1.Classic` stamp for every Router-derived Classic classification; the Classic V4 canary does not backfill V3 or prove another launch.
- [ ] Apply the manifest's `64`-confirmation policy to explicit block-number reads, or use the canonical finalized block.
- [ ] Do not present named-terminal adoption as live without separate published evidence. Treat Custom Launch API V1 and V2 POST as read-only (`409 CUSTOM_LAUNCH_V1_READ_ONLY` or `409 CUSTOM_LAUNCH_V2_READ_ONLY`, nonretryable), use their retained descriptors only for historical reads, and do not revive a GitHub approval flow.

## Registry and feed release evidence

- [ ] Confirm the registry chain, address, start block, ABI, topics, generation, code verification, and authorized writers from public evidence.
- [ ] Confirm approval-to-commit, reproducible-build, artifact, configuration, launch-wallet, and runtime bindings.
- [ ] Confirm a real Custom canary transaction, launch ID, Registry event, API record, and finality transition.
- [ ] Confirm cursor traversal cannot lose a launch inserted during pagination.
- [ ] Run schema, fixture, conformance, type, lint, build, security, link, and browser checks appropriate to your integration.
- [ ] Keep the affected Custom Registry or feed path prelaunch if any required external evidence is absent.

The public v2 surface publishes Registry generation 1 and its finalized project-only genesis canary. Legacy Registry and GitHub submission intake are closed and stay disabled independently of discovery. Custom Launch API V1 and V2 retain historical reads while authenticated POST returns nonretryable HTTP 409; only V3 profile `3.3.0` accepts fresh submissions.
