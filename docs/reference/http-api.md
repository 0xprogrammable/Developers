# HTTP API reference

Base URL:

```text
https://developers.programmable.family
```

The public v2 discovery API is read-only JSON. The repository OpenAPI document and JSON Schemas are the normative field-level references.

v2 is canonical for new integrations. API v1 remains a supported compatibility surface with its own schemas and cursors; do not mix records or cursors across the two major versions.

## Discovery document

### `GET /.well-known/programmable.json`

Stable bootstrap document for API version, status, manifest, schemas, documentation, and machine-readable resources.

Clients should begin here and cache the response according to HTTP headers.

Use only the URLs returned by the canonical discovery document. Do not place API keys, bearer tokens, or other credentials in URLs.

## Status

### `GET /api/v2/status`

Returns service lifecycle, supported chain state, indexer freshness, and the synchronization or finality boundary needed to interpret feed responses.

Use it to distinguish:

- live from prelaunch surfaces;
- current from stale projections;
- normal operation from a degraded service;
- observed or confirmed data from finalized progress.

Do not treat HTTP 200 alone as proof that every launch source or execution adapter is live.

The service separates Classic event coverage from the authenticated finalized Custom Registry. A feed can be `degraded` while still returning recognized launches with partial enrichment. Incomplete Classic event coverage or an unconfigured, incomplete, or non-current Custom Registry makes the affected aggregate route unavailable instead of returning a falsely complete list. `category=classic` remains independent from Custom Registry availability.

## Manifest

### `GET /api/v2/manifest`

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

The Website endpoint `https://programmable.family/api/custom-launch/registry/v1/manifest` is an operational presentation mirror, not a second integration trust root. Its schema and generation labels can differ from this Developer manifest. For terminal, wallet, indexer, bot, or direct-onchain integration, the discovery-selected `https://developers.programmable.family/api/v2/manifest` takes precedence. A conflict must pause trust advancement and alert an operator; it must not be resolved by merging fields from both documents.

The v2 Custom Registry state is live with public submissions disabled. Clients discover the active address, generation, start block, event set, ABI, and finality policy from the manifest; they must not infer that live discovery enables general submission intake.

Clients should reject an unexplained manifest rollback and alert on conflicting data for the same manifest version.

## Launch feed

### `GET /api/v2/launches`

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

`items` contains launch records. Official records carry `platformId: "programmable"`; `category` is exactly `classic | custom`, and `launch.modelId` carries the open-ended model. Classic derives those fields from a recognized deployment. Custom derives them only from the authenticated finalized Registry record; `launchRouteId` is retained separately and is never substituted for `modelId`. An item becomes public launch data only after the recognized finalized launch evidence exists; a submission or approval alone is not a launch.

`token` is an ERC-20 convenience view. It is `null` for a truthful project-only Custom launch. `assets` preserves the authenticated identity-first asset graph and its immutable launch-produced, protocol-external, or adopted-external provenance. Only a launch-produced primary token may populate `token`. `markets` is empty when no market is registered. Consumers must not manufacture a token, pair, or pool from the project launch identity. The token-list and token-address detail surfaces remain token-only projections and skip `token: null` records.

Registry `uniswap-v4-pool` evidence is mapped to the frozen public v1 market kind `uniswap-v4`, preserving the verifier and PoolManager authority bindings. Unknown authenticated market kinds remain visible with their pending verifier state as unsupported discovery data; they are never silently relabeled as a pair or executable market.

For authenticated Custom launches, `extensions["programmable/registry-v2"]` preserves the exact `sourceKind`, source/finality binding hashes, and the optional presentation snapshot. The presentation version, binding hash, and display-only draft are always all null or all present. Consumers must not use presentation content as launch, token, market, fee, or execution authority.

When event coverage is complete but metadata, supply, receipt, or block-timestamp enrichment is incomplete, the response can be `degraded`. The recognized item remains present and carries partial, unavailable, or null values. Consumers must not discard it or synthesize missing data.

When `page.hasMore` is true, continue the current traversal with:

```text
GET /api/v2/launches?cursor={urlEncodedCursor}
```

Cursors are opaque. Store and return them unchanged. Do not parse a cursor into application logic. The service binds both the chain ordering checkpoint and the authenticated Custom Registry generation so a newly accepted launch cannot be missed merely because its finalized block is older than the previous poll.

After the full traversal has been durably applied, persist `page.resumeCursor`. Begin the next incremental poll with:

```text
GET /api/v2/launches?after={urlEncodedResumeCursor}
```

Do not send `after` and `cursor` together. `page.nextCursor` continues one traversal; `page.resumeCursor` is the durable high-water checkpoint for a later poll. `snapshot.cursor` identifies the response snapshot boundary.

Implement replay-safe deduplication because retries and reorg reconciliation can repeat records. Never advance a durable resume cursor before the represented pages are committed.

## Launch by ID

### `GET /api/v2/launches/{launchId}`

Returns one launch by its globally scoped `launchId`. Use this route for project-only, multi-token, and multi-asset records as well as token-backed launches. URL-encode the complete opaque launch ID as one path segment and validate the response against the v2 launch schema.

Do not construct a launch ID from project name, symbol, creator metadata, or a market address. Obtain it from the canonical feed or Registry evidence.

## Launch by asset

### `GET /api/v2/launches/{chainId}/{tokenAddress}`

Returns the Programmable launch record for one chain and token address.

Example:

```text
GET /api/v2/launches/1/0x0000000000000000000000000000000000000000
```

The zero address is shown only as path syntax, not as a real token example.

Use a numeric chain ID and a valid EVM address. Address comparison should be case-insensitive after validation; display a checksummed form where appropriate.

This path is a convenience lookup for token-backed records. A project-only record has `token: null`; resolve it through the launch feed or launch-ID detail route with its `projectId` and authenticated `assets`. Do not substitute the zero address or a market contract for a missing token.

## Token list

### `GET /api/v2/token-list`

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

The current discovery document advertises only Ethereum Mainnet. A numeric `chainId` parameter does not make an unadvertised chain supported. See [Multi-chain discovery](../concepts/multi-chain.md).

## Read-only boundary

v2 never returns transaction payloads, calldata, approvals, or submission endpoints. Market support states can describe separately verified charting, quote, simulation, or execution availability, but this API neither authorizes nor constructs those actions.

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
| `503` | Required Classic coverage or authenticated Custom Registry completeness/freshness is unavailable | Preserve the last good state and retry later |

Do not turn a provider error into a security judgment about a token.

For completeness gating, incomplete Classic event coverage returns a retryable `503`. Custom and unfiltered launch/token-list requests also return `503` until the authenticated Registry reports `ready / complete / current`. A Classic-only request remains available with `category=classic`. A known detail record can still be returned during partial coverage; an unknown address returns `503` instead of a potentially false `404` until every source that could contain it is complete. Missing ERC-20 metadata or supply alone does not cause a coverage `503`.

## Caching and freshness

- Honor `Cache-Control`, `ETag`, and conditional requests.
- Use status and response snapshot fields to measure freshness.
- Do not use local receipt time as launch time.
- Keep the last verified manifest during a temporary outage, but surface staleness and never silently accept a rollback.
- Refresh the manifest separately from high-frequency launch polling.

## Schema validation

Public response schemas live in `schemas/v2/`:

- `status.schema.json`
- `manifest.schema.json`
- `launch-feed.schema.json`
- `launch.schema.json`
- `custom-launch-registry-record-v3.schema.json`, advertised by the v2 schema index as `canonical-custom-registry-record-v3`
- `custom-launch-registry-record-v4.schema.json`, the Generation 2 37-word producer record; it does not redefine v3
- `token-list.schema.json`
- `problem.schema.json`

Validate fixtures and representative live responses in continuous integration. Unknown optional fields, capability identifiers, and market kinds must remain forward compatible as described in [v2 compatibility](../concepts/compatibility.md).

For independent event and runtime verification, use [Direct onchain verification](onchain-verification.md). An HTTP 200 response is not a substitute for Registry deployment, canary, finality, or production evidence.
