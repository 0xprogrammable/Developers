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
- [ ] Accept the Programmable label only from an official manifest-listed source.
- [ ] For a full Registry-backed record, require `platformId: "programmable"`, `category: "custom"`, and `publicLabel: "Programmable Custom"` from the trusted projection.
- [ ] Deduplicate by `launchId`; key token assets by chain ID plus address, and project-only launches by `projectId` plus their authenticated asset graph.
- [ ] Keep provider, partner, template, model, hook, and market type as secondary attribution.
- [ ] Never trust name, symbol, logo, metadata tag, creator text, or a copied event as origin proof.
- [ ] Treat top-level `launchStampRouter` as a future-only trust root; never use it to backfill a historical Classic or Custom launch.
- [ ] Require the manifest chain ID, exact canonical Router address, Router start block, runtime-code hash, ABI hash, and a nonzero launch ID scoped with that chain and Router address.
- [ ] Resolve one finalized or caller-supplied canonical block. Bind every Router read to its hash with EIP-1898 and `requireCanonical: true`; if the client cannot do that, use one block number and require the same hash again after the last read.
- [ ] Use HTTPS for remote RPC endpoints. Permit plaintext HTTP only for loopback development endpoints.
- [ ] Assign a future class only from the stamp record: `LaunchKindV1.CustomGraph = 1` maps to Custom and `LaunchKindV1.Classic = 2` maps to Classic; reject `Invalid = 0`.
- [ ] Use token or `(PoolManager, PoolId)` for interoperable detection; never identify or classify Classic through its shared hook.
- [ ] Bind a v4 pool lookup to both its PoolManager address and PoolId; do not treat PoolId alone as a global identity.
- [ ] Filter discovery logs by both exact canonical Router address and manifest ABI `topic0`; reject a copied emitter.
- [ ] Treat direct Single Factory, Classic V3 Factory, and Graph Factory calls outside the Router as outside Router V1 provenance.
- [ ] Keep Router prelaunch fail-closed while its address, start block, runtime, authority, or production bindings are null.
- [ ] Treat stamped runtime code hashes as point-in-time evidence; independently resolve and revalidate current proxy implementation, beacon, admin, initialization, and upgrade authority state.

## Feed ingestion

- [ ] Backfill every page with `page.nextCursor`.
- [ ] Commit all represented records before persisting `page.resumeCursor`.
- [ ] Send the durable resume cursor as `after` for the next poll.
- [ ] Keep cursors opaque and scoped to API version, chain, and filter.
- [ ] Make retries, duplicate pages, corrections, and finality updates idempotent.
- [ ] Preserve the last good state on retryable `503`; do not convert incomplete coverage into an empty feed.
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
- [ ] For Native Custom, require the verified 10 bps Programmable fee only on the official market path.
- [ ] Keep partner/template attribution separate from fee state; allow `no-qualifying-market` with zero shares when no verified fee path exists.
- [ ] For an active fee-bearing partnership-template path, require exactly 20 bps on one defined basis: 15 bps partner plus 5 bps Programmable, with no extra Native Custom 10 bps.
- [ ] Verify recipient, currency, basis, charge mode, rounding, accrual, claim authority, and double-claim protections.
- [ ] Do not classify transfers, mints, burns, rewards, games, refunds, bridges, or unrelated pools as fee-bearing trades without path-specific evidence.

## Router V1 activation evidence

- [ ] Confirm the canonical Router chain, address, start block, ABI hash, topics, getter selectors, code verification, and runtime-code hash from public evidence.
- [ ] Confirm immutable EIP-1271 contract authority, Graph Factory and PoolManager addresses and runtime hashes; reject an EOA authority fallback.
- [ ] Confirm exactly one generic market-bearing atomic selector, with no route-specific overload: Custom Graph uses the immutable Graph Factory binding, while Classic V3 route and runtime are permit- and record-bound; Single Factory remains outside Router V1.
- [ ] Confirm frozen `LaunchKindV1.CustomGraph | Classic` record and event behavior with one canary of each class.
- [ ] Confirm token, `PoolManager + PoolId`, exclusive-component, `stampProof`, record and point-in-time code-hash results at finalized canonical blocks.
- [ ] Keep Router V1 prelaunch if any required activation evidence is absent.

## Registry and feed release evidence

- [ ] Confirm the registry chain, address, start block, ABI, topics, generation, code verification, and authorized writers from public evidence.
- [ ] Confirm approval-to-commit, reproducible-build, artifact, configuration, launch-wallet, and runtime bindings.
- [ ] Confirm a real Custom canary transaction, launch ID, Registry event, API record, and finality transition.
- [ ] Confirm cursor traversal cannot lose a launch inserted during pagination.
- [ ] Run schema, fixture, conformance, type, lint, build, security, link, and browser checks appropriate to your integration.
- [ ] Keep the affected Custom Registry or feed path prelaunch if any required external evidence is absent.

The public v2 surface publishes Registry generation 1 and its finalized project-only genesis canary. General intake remains prelaunch and must stay disabled independently of discovery.
