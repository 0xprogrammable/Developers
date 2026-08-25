# Indexers and data platforms

The hosted API is the simplest integration. Teams that need independent verification can reproduce the same normalized records from the deployments and contract events published by the manifest.

Both paths must use the same identities and lifecycle rules.

## Hosted feed path

1. Bootstrap from `/.well-known/programmable.json`.
2. Store the highest accepted `manifestVersion`.
3. Check `/api/v2/status` for freshness and lifecycle.
4. Fetch `/api/v2/launches` and use `page.nextCursor` to complete the current traversal.
5. Upsert records by `launchId`.
6. Key token assets by chain ID and address; key project-only records by `projectId` and `launchId` and preserve their asset graph.
7. After the traversal is durably applied, store `page.resumeCursor` and use it as `after` for the next incremental poll.
8. Process finality changes and any `orphaned` correction the API returns.
9. Reconcile non-final records periodically from a prior finalized boundary.

Cursors are opaque. Return them unchanged. A replayed page must be harmless.

For applicant ingestion, require `customRegistryPublication.expectedSourceId === customRegistryPublication.observedSourceId`, `sourceConfigured`, `sourceCurrent`, and `sourceReady`. The current Generation 1 source is `programmable-custom-launch-registry-v3`; do not substitute the Website v1 presentation mirror or merge it with the Developer manifest. Treat `baselineLaunches` as canary coverage and `applicantLaunches` as the separate real-applicant count.

Router Custom discovery is an independent lane. Require `routerCustom.status === "current"` and equal verified and published identity counts before treating absence as authoritative. A `last-known-good` Router snapshot remains ingestible, but it must not be merged into Registry applicant coverage or used to produce a final deletion or 404 conclusion.

A `degraded` feed still contains recognized events when canonical event coverage or enrichment is incomplete. Store partial provenance, null identity fields, unavailable supply, and null timestamps without dropping the record. Launch-list and token-list return the bounded recognized subset with HTTP `200` and explicit quality; never interpret an absent record in a degraded or unavailable response as deletion.

## Direct onchain path

Use the manifest's deployment arrays and start blocks. Do not assume one launcher or registry represents all versions.

For each recognized event, retain enough evidence to reproduce ordering and detect reorgs:

- chain ID;
- source deployment ID and address;
- transaction hash and transaction index;
- block number and block hash;
- log index;
- launch ID;
- token address when a primary token exists;
- project ID and authenticated asset references when the launch is project-only;
- runtime and provenance verification state where provided.

Pair related events according to the documented deployment contract. An event with the right name from an unrecognized contract is not a Programmable launch.

Legacy indexer records can carry `provenanceStatus: "partial"` because their normalized source lacks some canonical event coordinates. Preserve that state and do not silently promote it to verified.

Custom Registry generation 1 is live. Read its exact address, start block, canonical event topics, ABI, and finality requirement from the manifest, and use the finalized genesis canary as the first lifecycle record. Legacy Registry and GitHub submission intake are closed. Custom Launch API V2 is the separate authenticated public preparation path; V1 reads/status remain compatible and V1 POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY`. Index a resulting launch only after recognized finalized Router evidence exists. Follow the complete [direct onchain verification guide](../reference/onchain-verification.md).

## Ordering and identity

Use canonical block position for deterministic ordering:

```text
block number -> transaction index -> log index
```

Do not use API receipt time, database insertion time, or token metadata timestamps.

Use:

- `launchId` for launch deduplication;
- `projectId` for project identity;
- chain ID plus asset address or stable asset ID for asset identity;
- `marketId` for a market;
- chain ID plus transaction hash plus log index for an event.

## Finality

A recent Ethereum launch can appear before finalization. Preserve its reported state instead of converting every observed block into a permanent record.

Product behavior should follow the exact schema values:

- `observed`: show promptly with a pending indicator;
- `confirmed`: included under the API's confirmation policy but not finalized;
- `finalized`: eligible for durable finalized projections such as token lists;
- `orphaned`: remove from active views and retain a local correction record.

The API schema permits `orphaned`, but clients must not assume that the current feed provides a complete historical tombstone stream. Reconcile `observed` and `confirmed` records against later snapshots. Finality can advance or a non-final observation can be reorganized.

## Reorg handling

On block-hash disagreement:

1. Stop advancing the affected cursor.
2. Find the last common canonical boundary.
3. Re-read logs from that boundary.
4. Mark displaced events and launches according to schema lifecycle when the API supplies that state; otherwise reconcile them locally.
5. Reapply canonical events idempotently.
6. Preserve an explicit local correction record instead of silently deleting history.

Never mutate the original launch timestamp to the reprocessing time.

## Manifest changes

Treat manifest versions as monotonic. On a newer valid manifest:

- add active deployment ranges;
- backfill from each declared start block;
- preserve records from older recognized deployments;
- apply activation or retirement state;
- record which manifest version supported verification.

For a new chain, create a distinct backfill, cursor scope, and reorg state. Do not reuse a cursor or finality policy from another network. See [Multi-chain discovery](../concepts/multi-chain.md).

An unexplained rollback or conflicting manifest with the same version should stop automatic advancement and alert an operator.

## Markets and activity

A launch can have no markets, several markets, or a non-pool market. Store markets separately from assets.

Do not normalize every token transfer into a trade. Chart and volume production requires a verified market adapter or activity normalizer. Without one, store the launch and market identity but mark chart data unavailable.

## Freshness

Monitor:

- API lifecycle and status;
- indexed block and block hash;
- finalized progress;
- distance from the network head;
- manifest age and version;
- cursor stalls;
- reorg corrections;
- schema-validation failures;
- adapter availability.
- onchain-to-indexer and indexer-to-API latency.

An HTTP 200 response can still contain stale or prelaunch state. Use the status payload and response snapshot.

## Recovery

Keep enough raw evidence to rebuild projections. Back up:

- last trusted manifest and digest;
- last finalized cursor or block boundary;
- raw recognized event coordinates;
- normalized launch revisions;
- schema versions;
- reconciliation logs.

Test restoration and backfill before depending on the feed for public new-launch alerts.

At scale, include at least 100,000 simulated launches, an insertion during a multi-page traversal, cursor replay, bounded retry behavior, and reorg recovery in the test corpus.
