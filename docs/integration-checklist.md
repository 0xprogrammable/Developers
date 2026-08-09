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
- [ ] For a Custom stamp, require the manifest chain ID, exact canonical stamp address, stamp start block, published getter or event ABI, and a nonzero launch ID scoped with that chain and stamp address.
- [ ] Bind a v4 pool lookup to both its PoolManager address and PoolId; do not treat PoolId alone as a global identity.
- [ ] Treat storage or logs from a copied stamp contract at any other address as non-Programmable.

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

## Release evidence

- [ ] Confirm the registry chain, address, start block, ABI, topics, generation, code verification, and authorized writers from public evidence.
- [ ] Confirm approval-to-commit, reproducible-build, artifact, configuration, launch-wallet, and runtime bindings.
- [ ] Confirm a real Custom canary transaction, launch ID, Registry event, API record, and finality transition.
- [ ] Confirm cursor traversal cannot lose a launch inserted during pagination.
- [ ] Run schema, fixture, conformance, type, lint, build, security, link, and browser checks appropriate to your integration.
- [ ] Keep Custom prelaunch if any required external evidence is absent.

The public v2 surface publishes Registry generation 1 and its finalized project-only genesis canary. General intake remains prelaunch and must stay disabled independently of discovery.
