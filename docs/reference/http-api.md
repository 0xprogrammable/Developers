# HTTP API reference

Base URL:

```text
https://developers.programmable.family
```

The public v1 discovery API is read-only JSON. The repository OpenAPI document and JSON Schemas are the normative field-level references.

## Discovery document

### `GET /.well-known/programmable.json`

Stable bootstrap document for API version, status, manifest, schemas, documentation, and machine-readable resources.

Clients should begin here and cache the response according to HTTP headers.

## Status

### `GET /api/v1/status`

Returns service lifecycle, supported chain state, indexer freshness, and the synchronization or finality boundary needed to interpret feed responses.

Use it to distinguish:

- live from prelaunch surfaces;
- current from stale projections;
- normal operation from a degraded service;
- observed or confirmed data from finalized progress.

Do not treat HTTP 200 alone as proof that every launch source or execution adapter is live.

The service separates canonical event coverage from enrichment. A feed can be `degraded` while still returning recognized launches with partial provenance, unavailable token supply, or null metadata and timestamps. Incomplete event-log coverage makes launch-list and token-list publication unavailable instead of returning a falsely complete list.

## Manifest

### `GET /api/v1/manifest`

Returns:

```text
schemaVersion
platformId
manifestVersion
generatedAt
chainId
network
publicCategories
deployments
customRegistry
platformFee
endpoints
compatibility
```

The manifest is the canonical integration inventory for active and prelaunch deployments. Read deployment arrays and lifecycle state. Never hard-code a single registry or launcher address as the entire Programmable source.

Clients should reject an unexplained manifest rollback and alert on conflicting data for the same manifest version.

## Launch feed

### `GET /api/v1/launches`

Returns a normalized, cursor-paginated launch feed:

```text
schemaVersion
status
snapshot
items
page.nextCursor
page.resumeCursor
page.hasMore
```

`items` contains launch records. Official records carry `platformId: "programmable"`; `category` is exactly `classic | custom`, and `launch.modelId` carries the open-ended model. These values come from trusted provenance rather than token metadata. An item becomes public launch data only after the recognized onchain launch evidence exists; a submission or approval alone is not a launch.

When event coverage is complete but metadata, supply, receipt, or block-timestamp enrichment is incomplete, the response can be `degraded`. The recognized item remains present and carries partial, unavailable, or null values. Consumers must not discard it or synthesize missing data.

When `page.hasMore` is true, continue the current traversal with:

```text
GET /api/v1/launches?cursor={urlEncodedCursor}
```

Cursors are opaque. Store and return them unchanged. Do not parse a cursor into application logic.

After the full traversal has been durably applied, persist `page.resumeCursor`. Begin the next incremental poll with:

```text
GET /api/v1/launches?after={urlEncodedResumeCursor}
```

Do not send `after` and `cursor` together. `page.nextCursor` continues one traversal; `page.resumeCursor` is the durable high-water checkpoint for a later poll. `snapshot.cursor` identifies the response snapshot boundary.

Implement replay-safe deduplication because retries and reorg reconciliation can repeat records. Never advance a durable resume cursor before the represented pages are committed.

## Launch by asset

### `GET /api/v1/launches/{chainId}/{tokenAddress}`

Returns the Programmable launch record for one chain and token address.

Example:

```text
GET /api/v1/launches/1/0x0000000000000000000000000000000000000000
```

The zero address is shown only as path syntax, not as a real token example.

Use a numeric chain ID and a valid EVM address. Address comparison should be case-insensitive after validation; display a checksummed form where appropriate.

## Token list

### `GET /api/v1/token-list`

Returns a wallet-friendly token-list compatibility projection. Use the launch feed when you need full provenance, market support, fee data, non-final records, or reorg state.

A token list is a convenience projection of finalized records with complete token identity. A recognized launch with partial identity remains available in the launch feed but is not promoted into the compatibility token list until identity is complete. Token identity remains chain ID plus contract address.

## Query parameters

The launch feed supports:

- `chainId` to select a supported chain;
- `category=classic|custom` to filter the public category;
- `limit` for bounded page size;
- `cursor` to continue the current traversal;
- `after` to begin an incremental poll after a durable resume cursor.

Treat server limits and cursor contents as opaque. The token-list endpoint supports `chainId`.

## Read-only boundary

v1 never returns transaction payloads, calldata, approvals, or submission endpoints. Market support states can describe separately verified charting, quote, simulation, or execution availability, but this API neither authorizes nor constructs those actions.

## Response handling

Successful responses use JSON. Error responses follow the repository problem schema and include a stable machine-readable type plus human-readable detail.

Clients should handle at least:

| Status | Meaning | Client behavior |
| --- | --- | --- |
| `200` | Successful response | Validate and process |
| `304` | Cached representation remains current | Reuse the cached body associated with the ETag |
| `400` | Invalid input or cursor | Correct the request; do not retry unchanged |
| `404` | No registered launch for that asset | Show not found; do not call it unsafe |
| `405` | Method not supported | Use the documented read-only GET method |
| `429` | Rate limited | Honor `Retry-After` and back off |
| `503` | Event-log coverage incomplete or the route could not be produced | Preserve the last good state and retry later |

Do not turn a provider error into a security judgment about a token.

For completeness gating, incomplete event-log coverage returns a retryable `503` from the launch-list and token-list routes. A known detail record can still be returned during partial coverage; an unknown address returns `503` instead of a potentially false `404` until coverage is complete. Missing ERC-20 metadata or supply alone does not cause a coverage `503`.

## Caching and freshness

- Honor `Cache-Control`, `ETag`, and conditional requests.
- Use status and response snapshot fields to measure freshness.
- Do not use local receipt time as launch time.
- Keep the last verified manifest during a temporary outage, but surface staleness and never silently accept a rollback.
- Refresh the manifest separately from high-frequency launch polling.

## Schema validation

Public response schemas live in `schemas/v1/`:

- `status.schema.json`
- `manifest.schema.json`
- `launch-feed.schema.json`
- `launch.schema.json`
- `token-list.schema.json`
- `problem.schema.json`

Validate fixtures and representative live responses in continuous integration. Unknown optional fields, capability identifiers, and market kinds must remain forward compatible as described in [v1 compatibility](../concepts/compatibility.md).
