# Indexers and data platforms

Use the hosted API when the selected chain has a released read model. Independent indexers derive recognized records from the deployments and contract events published by the manifest. On Robinhood chain 4663, direct-chain verification and indexing are live while the hosted read model remains planned.

Both paths must use the same identities and lifecycle rules.

## Hosted feed path

1. Bootstrap from `/.well-known/programmable.json`.
2. Select a published chain and fetch `/api/v2/manifests/{chainId}`. The
   unparameterized manifest remains the Ethereum alias.
3. Store the highest accepted `manifestVersion` per chain.
4. Check `/api/v2/status?chainId={chainId}` for freshness and lifecycle.
5. Fetch `/api/v2/launches?chainId={chainId}` with any category filter you need. Repeat that exact chain and category on every `page.nextCursor` continuation.
6. Upsert records by the launch's chain-bound identity.
7. Key token assets by chain ID and address; key project-only records by `projectId` and `launchId` and preserve their asset graph.
8. After the traversal is durably applied, store `page.resumeCursor` with its API-major, chain, and category scope. Repeat the same chain and category when using it as `after` for the next incremental poll.
9. Process finality changes and any `orphaned` correction the API returns.
10. Reconcile non-final records periodically from a prior finalized boundary.

Cursors are opaque. Return them unchanged and never move them to another chain or category scope. A replayed page must be harmless.

The Developer service obtains its hosted Classic baseline from the canonical paginated `https://programmable.market/api/explore` catalog. It accepts that catalog only with the expected schema, identity, scope, and Envio deployment `production-6157d22` binding. The retired legacy token source returns HTTP `410` and is no longer used. Downstream consumers should continue to use the Developer feed, which exposes the validated normalized projection and its source boundary.

Active v2 Classic discovery contains the historical V3 release and current V4 release only. V1 and V2 remain inactive manifest history, and Stock is excluded from active v2 discovery. Custom is ingested separately through its Registry and canonical-Router evidence lanes. The Router is provenance and transport infrastructure, not a public launch category.

For applicant ingestion, require `customRegistryPublication.expectedSourceId === customRegistryPublication.observedSourceId`, `sourceConfigured`, `sourceCurrent`, and `sourceReady`. The current Generation 1 source is `programmable-custom-launch-registry-v3`; do not substitute the Website v1 presentation mirror or merge it with the Developer manifest. Treat `baselineLaunches` as canary coverage and `applicantLaunches` as the separate real-applicant count.

Router Custom discovery is an independent lane. Require `routerCustom.status === "current"` and equal verified and published identity counts before treating absence as authoritative. A `last-known-good` Router snapshot remains ingestible, but it must not be merged into Registry applicant coverage or used to produce a final deletion or 404 conclusion.

Robinhood chain 4663 publishes a live `directChainIntegration` and canonical
`launchStampRouter`. Resolve the Router address, start block, runtime hash,
ABI, deployment evidence and finalized launch vector from its chain manifest.
Its direct-chain path does not depend on a Programmable hosted indexer. The
Developer read model remains planned and returns non-authoritative
`unavailable` quality until its separate promotion.

The separate backend V4 finalized metadata route is
`GET https://api.programmable.market/v4/chains/4663/finalized-custom-launches`.
Use it only as optional metadata enrichment after validating its current
response and joining each item to canonical Router evidence. Follow every
opaque cursor. A successful backend response does not promote the Developer
hosted read model, and a failure does not invalidate an independently verified
stamp. Never substitute the Ethereum V3 finalized ledger.

Hosted promotion additionally requires its code-pinned finalized deployment
descriptor, profile, complete Router/PermitAuthority/GraphFactory/PoolManager
runtime tuple, finality policy and source/indexer evidence. A merely
well-shaped manifest is not release authority for that hosted projection.

The staged adapter validates
`programmable.custom-launch-onchain-evidence.v3`. When promoted, it accepts only
resources with exact `platformId: "programmable"` and `category: "custom"`, a
successful Robinhood L2 receipt after the Router start block, the route event
before the launch event, the exact Ethereum rollup and sequencer inbox, and two
matching finalized-checkpoint readbacks from the published trust domains. The
top-level V3 block and hash are the Ethereum finalized checkpoint; ordering,
`launch.*`, `asOfBlock`, and `asOfBlockHash` use the nested Robinhood
`l2Inclusion` coordinates. A later evidence re-observation does not rewrite the
original `finalizedAt`.

Validate the V4 list schema, `chainId`, CAIP-2 identity, every opaque cursor and
the final `quality` counts before accepting a snapshot. The public extension
retains the deployment digest and compact L2-posting-finalized evidence, not the
complete deployment descriptor. It projects a token address only when
`projectMetadata.tokenMetadataBinding.tokenTargetId` matches exactly one
authenticated source-verification component. Name and symbol remain
creator-declared, identity stays `partial`, and supply stays unavailable until
separate onchain evidence exists. The token-address detail route may return
that partial record; the token list remains complete-identity-only.

The overall Developer scope remains finalized, Router-stamped Programmable
Classic and Custom launches on published chains. This backend V4 adapter is the
Custom half of that scope; the existing Classic projectors remain unchanged.
Neither path is an all-Uniswap-v4-hooks index. A source failure can fall back
only to the last accepted snapshot for the same chain and exact deployment
binding, and that fallback is degraded.

A `degraded` feed still contains recognized events when canonical event coverage or enrichment is incomplete. Store partial provenance, null identity fields, unavailable supply, and null timestamps without dropping the record. Launch-list and token-list return the bounded recognized subset with HTTP `200` and explicit quality; never interpret an absent record in a degraded or unavailable response as deletion.

## Finalized metadata and partner-attribution join

Consumers that need the public project card can read the separate
unauthenticated Ethereum metadata route,
`GET https://api.programmable.market/v3/finalized-custom-launches`. Robinhood
uses `/v4/chains/4663/finalized-custom-launches` and its V4 schema; never mix
those chain-bound ledgers.
Follow every opaque `nextCursor` until it is null; a single page is not a
complete snapshot. Store the canonical declaration fields separately:

- immutable `launchProfileVersion`;
- `projectMetadata.token.name` and `.symbol`;
- `projectMetadata.presentation.description`;
- the image URI, content SHA-256, media type, byte length, width, and height;
- exactly one `website` link and one `x` link for current complete profiles;
- `projectMetadataHash`; and
- optional `partnerAttribution`.

Interpret the metadata contract from `launchProfileVersion`, never from field
presence. Historical finalized records may predate the complete-metadata requirement.
Keep them visible and preserve a missing image, website, or X link as null; do
not repair history with scraped or guessed values.

The declared name and symbol become onchain-readback evidence only when
`tokenMetadataReadback.status` is `matching`. Persist `mismatch` or
`unavailable` without overwriting either declared or observed values. Validate
`partnerAttribution` against
`programmable.launch-partner-attribution.v1`, recompute its domain-framed
snapshot digest, and render the same object as `launchedVia` if desired. The
attribution comes from the authenticated partner principal, not the create
body; it is not safety or economic-partner evidence. Accept it only from the
official response joined to that launch. The digest detects a changed snapshot
but does not authenticate an arbitrary copied object by itself.

Join the metadata ledger by `routerLaunchId`, then require the same chain,
token, hook, PoolManager, and pool ID from the canonical Router record. Retain
the Router transaction hash, block number, block hash, log index, and finalized
checkpoint as onchain evidence. `resourceId`, presentation content, and
`projectMetadataHash` do not replace this join.

This route makes clean ingestion possible; it cannot force GMGN, Dexscreener,
FOMO, or any other provider to index a launch, refresh its card, or assign a
`safe` label. Provider indexing state and provider-specific risk labels must
come from that provider's own API or verified observation and remain separate
from Programmable provenance.

## Direct onchain path

Use the manifest's enabled deployment arrays and the separate live
`launchStampRouter` entry, each with its own start block. An empty Classic
`deployments` array on Robinhood does not disable its live Router source. Do
not assume one launcher or Registry represents all versions. For Ethereum
Classic, scan only enabled historical V3 and current V4 deployment ranges; do
not revive inactive V1/V2 or any Stock range.

For Robinhood, require `directChainIntegration.status: "live"`, verify its
published deployment and existing finalized launch vector, then backfill the
exact Router emitter and all advertised event topics with bounded
`eth_getLogs` ranges. Resolve a canonical `finalized` block once; never use the
latest head as durable finality. Verify candidate records and their token,
pool and exclusive-component getters at the same block, with matching
`stampProof` and recorded component runtime hashes. Prefer hash-bound
EIP-1898 reads; otherwise re-read the block hash after the complete check.
An explicit block must be a finalized ancestor under the published policy.

Future individual custom hooks need no allowlist or per-hook integration:
verify each launch's canonical `CustomGraph = 1` stamp and retain its exact
component set. The terminal label is `Programmable Custom`, with
`platformId: "programmable"` and `category: "custom"`. Unknown hook behavior
keeps market capabilities unavailable without erasing provenance. Poolless
recognized Registry/project records stay discoverable, while this Router V1
market-bearing route must satisfy its recorded pool invariant. Never invent a
pool for a different recognized launch shape.

Persist the finalized checkpoint only after all records and event coordinates
are durable. Deduplicate events by chain ID, transaction hash and log index;
deduplicate Router launches by chain ID, Router and launch ID. Replay an
overlap when switching from backfill to polling or subscriptions, and rewind
to the last common canonical boundary on any block-hash disagreement. The
[Robinhood terminal guide](https://developers.programmable.family/robinhood-terminal-indexer)
provides the public verification sequence.

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

Custom Registry generation 1 is live. Read its exact address, start block, canonical event topics, ABI, and finality requirement from the manifest, and use the finalized genesis canary as the first lifecycle record. Legacy Registry and GitHub submission intake are closed. Custom Launch API V1 and V2 retain historical reads while authenticated POST returns nonretryable HTTP 409; only V3 profile `3.3.0` accepts fresh submissions. Index a resulting launch only after recognized finalized Router evidence exists. Follow the complete [direct onchain verification guide](../reference/onchain-verification.md).

## Ordering and identity

Use canonical block position for deterministic ordering:

```text
block number -> transaction index -> log index
```

Do not use API receipt time, database insertion time, or token metadata timestamps.

Use:

- chain ID plus Router address plus Router `launchId` for Router launch deduplication;
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

This manifest-driven loop is the compatibility mechanism for Classic V4: a generic Router-first consumer refreshes the manifest and begins the newly enabled range without a code release or copied-address update. The live Router evidence reports `classicOnchainCanary: true`; require the exact manifest-bound Classic canary evidence rather than inferring coverage from that boolean alone.

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
