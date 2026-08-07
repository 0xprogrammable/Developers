# Production operations

The hosted API requires `PROGRAMMABLE_CURSOR_SIGNING_KEY` as a protected deployment secret containing 32–1,024 UTF-8
bytes. Never commit, log, publish, or place its value in an example. Keep the same value across every instance serving
the v2 cursor surface. Rotation invalidates outstanding page and resume cursors, so it requires coordinated
compatibility and operations handling, including an explicit migration or major-version plan rather than an
unannounced secret change.

This guide covers the behavior a durable integration needs beyond a successful first request.

## Custom Registry workload identity

Custom ingestion is server-to-server and fail-closed. Production must inject the exact Registry feed URL, audience,
target-binding hash, workload issuer and subject, token-exchange endpoint, and a secret-manager-provided subject token.
The API obtains a fresh request-bound credential for every Registry page. That credential binds the exact `GET`,
lane, target, path, opaque cursor, and page limit; it is never sent to a browser or written into a public manifest.

Do not configure a placeholder URL or static Registry bearer token. When the deployment overlay is absent or the
Registry does not report `ready / complete / current`, Custom and unfiltered feeds return retryable `503`. The
Classic-only feed remains available through `category=classic` when its chain coverage is complete.

## Bootstrap sequence

1. Fetch `/.well-known/programmable.json`.
2. Fetch `/api/v2/status`.
3. Fetch and validate `/api/v2/manifest`.
4. Compare `manifestVersion` with the highest version previously accepted.
5. Backfill `/api/v2/launches`.
6. Use `page.nextCursor` to complete the current traversal.
7. After all represented pages are durably applied, store `page.resumeCursor` and use it as `after` for the next incremental poll.
8. Store the response snapshot for reconciliation.
9. Poll or refresh according to response headers.
10. Reconcile from a finalized boundary periodically.

Do not enable an execution feature merely because discovery is healthy.

Partition checkpoints by API major version, chain, and filter scope. Never send a cursor obtained from v1, another chain, or another category filter to a v2 traversal.

## Freshness

Measure freshness from the status and snapshot data, not only from HTTP availability.

Track:

- API lifecycle;
- manifest generation time and version;
- indexed block number and hash;
- finalized block progress;
- distance from current network head;
- last successful feed page;
- schema-validation failures;
- adapter-specific status;
- onchain block time to indexer observation latency;
- indexer observation to API publication latency; and
- API publication to website or downstream ingestion latency.

If the projection is stale, keep the last known data with a visible stale state. Do not relabel stale data as current. A `degraded` feed with complete event coverage can still publish recognized launches; enrichment gaps remain explicit on each record.

Publish measured latency distributions and their observation window when making realtime claims. Do not promise same-second discovery without production evidence.

## Finality

Recent launches may appear before Ethereum finalizes their block. Products that value immediate discovery can show `observed` or `confirmed` launches with a pending indicator. Durable token lists and irreversible downstream actions should use `finalized` records.

Finality is a lifecycle, not a boolean assumption. Persist state changes.

## Reorgs

A reorg can replace a recently observed block. A correct integration:

- binds observations to block hashes;
- stops cursor advancement on canonical disagreement;
- rewinds to a known common boundary;
- replays events idempotently;
- removes displaced records from active views;
- retains an explicit local correction record and consumes `orphaned` state where the API supplies one;
- never changes the historical launch time to the reprocessing time.

The schema permits `orphaned`, but do not assume the current API emits a complete historical tombstone stream. Reconcile non-final launches against later snapshots. Test an observed launch that later disappears, not only the normal finalized path.

## Pagination and idempotency

- Treat cursors as opaque.
- Use `page.nextCursor` only to continue the same traversal.
- Store `page.resumeCursor` only after the represented traversal has been durably applied.
- Send that resume cursor as `after` on the next incremental poll.
- Upsert launch records by `launchId`.
- Make repeated pages harmless.
- Store a present ERC-20 as chain ID plus address; store project-only identity as `projectId`, `launchId`, and authenticated asset namespace/value references.
- Store each market by `marketId`.
- Preserve record or revision state needed for corrections.
- Apply Registry corrections and revocations as append-only transitions.

## Caching

Honor standard HTTP cache headers.

- The discovery document and manifest can usually be cached longer than the launch feed.
- Use ETags and conditional requests where supplied.
- Do not place a CDN's response time into `launchedAt` or equivalent product data.
- Keep the last trusted manifest through a brief outage, but surface age and never accept a silent rollback.

## Retries

Read-only GET requests are safe to retry with bounded exponential backoff and jitter.

- Do not retry unchanged `400` requests.
- Honor `Retry-After` for `429` and maintenance responses.
- Retry transient `500` and `503` responses a bounded number of times.
- Keep a dead-letter or operator-visible state for persistent schema or provenance conflicts.
- Do not turn an API failure into a negative security label for the affected token.

## Degraded behavior

| Failure | Safe behavior |
| --- | --- |
| Status unavailable | Keep last data, mark freshness unknown, pause cursor advancement if necessary |
| Manifest unavailable | Use last trusted manifest for read-only display, mark stale, do not accept new deployments |
| Classic event-log coverage incomplete | Affected launch-list and token-list routes return retryable `503`; retain the last durable cursor |
| Custom Registry unconfigured, incomplete, stale, or invalid | Custom and unfiltered routes return retryable `503`; Classic-only remains independently available |
| Enrichment degraded | Ingest recognized launches and preserve partial, unavailable, or null metadata, supply, provenance, and timestamp fields |
| Launch page unavailable for another transient failure | Retry without losing the last durable cursor |
| Unknown schema major | Stop automatic ingestion and require an upgrade |
| Unknown optional field or market type | Keep launch visible; hide unsupported feature |
| Adapter unavailable | Preserve discovery; disable its chart, quote, simulation, or execution feature |
| Metadata unavailable | Show chain and address; do not remove the launch |
| Supply unavailable | Preserve null supply and its status; do not display zero |
| Provenance partial | Display available evidence; do not relabel it verified or unsafe |
| Provenance conflict | Stop automatic trust advancement and surface the conflict |
| One chain unavailable | Keep other healthy chains ingesting; mark the affected chain incomplete |
| Registry generation change | Backfill from the new published start block while retaining the retired generation's historical range |

## Metadata handling

- Escape text and Unicode controls.
- Fetch remote content through SSRF-safe infrastructure.
- Reject active HTML and unsafe image types.
- Bound redirects, byte size, decompression, and dimensions.
- Keep metadata availability separate from launch provenance.
- Treat every external link as untrusted.

## Monitoring

Alert on:

- stale indexed head or finalized head;
- manifest rollback or same-version conflict;
- unexpected deployment runtime changes;
- schema validation failures;
- repeated cursor loops;
- reorg depth above the expected operating range;
- duplicate or conflicting launch identity;
- unsupported Custom records being dropped;
- verified adapter drift or failure;
- fee recipient or rate mismatch in a verified path;
- one partnership share accruing to or claimable by the other party;
- onchain-to-indexer, indexer-to-API, or API-to-product latency outside the measured operating range.

## Release checks

Before releasing an integration:

1. Run all repository fixtures and conformance tests.
2. Reproduce at least one live Classic record from chain data.
3. Confirm Custom fixtures never appear as live open-registry launches.
4. Verify no-market, multi-market, unknown-market, and paused-market rendering.
5. Test pagination replay and cursor recovery.
6. Test observed-to-confirmed-to-finalized and observed-to-orphaned or absent-after-reconciliation transitions.
7. Test metadata failure without losing launch identity.
8. Test adapter failure without losing discovery.
9. Confirm the fee display distinguishes included from added-on-top.
10. Confirm no partner integration or safety claim is inferred by the UI.
11. Restore from a durable checkpoint and prove the backfill plus incremental handoff loses no records.
12. Exercise resource limits with at least 100,000 simulated launches, bounded payloads, cursor replay, and an insertion during pagination.
13. For partner attribution, test no-qualifying-market with zero shares; for active fee-bearing partnership templates, test exact 20 bps total, 15/5 allocation, common basis, currency, rounding, accrual, claim separation, double claim, and reentrancy behavior.
