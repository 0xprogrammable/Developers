# Five-minute quickstart

This guide fetches the current deployment manifest and the normalized launch feed. It is read-only and requires no SDK or API key.

## 1. Discover the API

Use the well-known document as the stable entry point:

```bash
curl -fsSL https://developers.programmable.family/.well-known/programmable.json
```

It points to the current v1 API, schemas, manifest, documentation, and operational status. Cache it according to its response headers and refresh it periodically.

## 2. Check status

```bash
curl -fsSL https://developers.programmable.family/api/v1/status
```

Check status before a backfill or realtime ingestion run. Use the reported lifecycle, indexed block, finality, and freshness information to distinguish a healthy feed from a stale or prelaunch surface.

## 3. Fetch the deployment manifest

```bash
curl -fsSL https://developers.programmable.family/api/v1/manifest
```

The manifest is the integration source for active deployments, start blocks, categories, Custom Registry state, platform fee disclosure, API routes, and compatibility information. Read its arrays at runtime. Do not copy an individual contract address into permanent client code.

## 4. Fetch launches

```bash
curl -fsSL https://developers.programmable.family/api/v1/launches
```

The response has this stable root shape:

```text
schemaVersion  response schema version
status         feed lifecycle and availability
snapshot       block/finality boundary used for this response
items          normalized launch records
page           cursor and hasMore state
```

Each item contains:

```text
schemaVersion  launch schema version
launchId       stable identity derived from canonical provenance or issued by a future Registry
category       classic or custom
chainId        EVM chain ID
token          token identity and metadata state
launch         original launch transaction and block provenance
verification   registry, runtime, and finality evidence
capabilities   declared and verified feature support
markets        zero, one, or several markets
fees           verified fee disclosures
extensions     bounded namespaced additions
```

An empty `markets` array is valid. It means the launch currently has no registered market; it does not permit a client to fabricate a pool, price, liquidity, volume, chart, or swap action.

`status: "degraded"` can accompany valid recognized launch items when metadata, supply, or block-timestamp enrichment is incomplete. Preserve null and unavailable fields and inspect each record's `identityStatus`, `supplyStatus`, metadata trust, and `provenanceStatus`. Incomplete enrichment does not remove a recognized launch.

If canonical event-log coverage is incomplete, the launch feed and token list are not published as complete results; retryable requests return `503` instead.

## 5. Consume the feed in JavaScript

```js
const baseUrl = "https://developers.programmable.family"

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: "application/json" },
  })

  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new Error(problem?.detail ?? `Request failed with ${response.status}`)
  }

  return response.json()
}

const status = await getJson("/api/v1/status")
const manifest = await getJson("/api/v1/manifest")
let page = await getJson("/api/v1/launches")
let resumeCursor = page.page.resumeCursor ?? page.snapshot?.cursor ?? null

for (;;) {
  for (const record of page.items) {
    const assetKey = `${record.chainId}:${record.token.address.toLowerCase()}`

    renderLaunch({
      assetKey,
      launchId: record.launchId,
      category: record.category,
      token: record.token,
      markets: record.markets,
      capabilities: record.capabilities,
      verification: record.verification,
    })
  }

  // nextCursor is only for completing this traversal.
  if (!page.page.hasMore || page.page.nextCursor === null) break
  page = await getJson(`/api/v1/launches?cursor=${encodeURIComponent(page.page.nextCursor)}`)
  resumeCursor = page.page.resumeCursor ?? resumeCursor
}

// Persist resumeCursor only after the full traversal above is durably applied.
// The next incremental poll begins after that high-water checkpoint.
const updates = resumeCursor
  ? await getJson(`/api/v1/launches?after=${encodeURIComponent(resumeCursor)}`)
  : await getJson("/api/v1/launches")

function renderLaunch(record) {
  console.log(record)
}
```

The example deliberately does not construct transactions. The v1 API is strictly read-only. Discovery is universal; support states can report whether a separately verified market adapter supports charting, quote, simulation, or execution, but they do not authorize a transaction or return transaction payloads.

## 6. Fetch one token

Use the detail route with an address returned by the feed:

```text
GET https://developers.programmable.family/api/v1/launches/{chainId}/{tokenAddress}
```

Use the numeric chain ID and token contract address exactly as identity inputs. Never identify a token by name or ticker alone.

## 7. Production rules

Before shipping:

- Validate responses against the repository JSON Schemas.
- Deduplicate feed items by `launchId`; key assets by `chainId` and token address.
- Preserve the onchain launch timestamp rather than the time your service first observed the record.
- Accept a null timestamp, partial identity or provenance, and unavailable supply without dropping a recognized launch.
- Treat a degraded response as usable but incomplete enrichment; do not convert null into zero or guessed metadata.
- Treat `observed` and `confirmed` records as non-final. If a later poll marks a launch `orphaned`, apply that correction idempotently; otherwise reconcile non-final records against later snapshots.
- Keep unknown launches visible with a generic Custom presentation.
- Ignore unsupported capabilities, market types, and namespaced extensions.
- Do not render a chart or trade button without the corresponding verified support.
- Treat creator metadata and external links as untrusted display data.

## Next step

Choose the guide for [terminals](guides/terminals-and-scanners.md), [wallets](guides/wallets.md), [indexers](guides/indexers.md), or [apps](guides/apps-and-games.md). Read [Operations](operations.md) before running a persistent indexer.
