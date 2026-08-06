# Minimal API integration

This guide fetches the current deployment manifest and the normalized launch feed. It is read-only and requires no SDK or API key.

## 1. Discover the API

Use the well-known document as the stable entry point:

```bash
curl -fsSL https://developers.programmable.family/.well-known/programmable.json
```

It points to the current v2 API, schemas, manifest, documentation, and operational status. Cache it according to its response headers and refresh it periodically.

Treat the well-known document as the stable bootstrap. v2 is canonical for new integrations; v1 is a separate supported compatibility surface and its cursors must not be sent to v2.

## 2. Check status

```bash
curl -fsSL https://developers.programmable.family/api/v2/status
```

Check status before a backfill or realtime ingestion run. Use the reported lifecycle, indexed block, finality, and freshness information to distinguish a healthy feed from a stale or prelaunch surface.

## 3. Fetch the deployment manifest

```bash
curl -fsSL https://developers.programmable.family/api/v2/manifest
```

The manifest is the integration source for active deployments, start blocks, categories, Custom Registry state, platform fee disclosure, API routes, and compatibility information. Read its arrays at runtime. Do not copy an individual contract address into permanent client code.

## 4. Fetch launches

```bash
curl -fsSL https://developers.programmable.family/api/v2/launches
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
launchId       stable identity derived from Classic provenance or committed by the Custom Registry
category       classic or custom
chainId        EVM chain ID
token          token identity and metadata state
assets         authenticated asset and contract graph when supplied
launch         original launch transaction and block provenance
verification   registry, runtime, and finality evidence
capabilities   declared and verified feature support
markets        zero, one, or several markets
fees           verified fee disclosures
extensions     bounded namespaced additions
```

Registry-backed records can also include `platformId`, `publicLabel`, `caip2`, `projectId`, `model`, `template`, `partner`, `builder`, `approvalBinding`, `deploymentBinding`, `verifiedReview`, `feePolicy`, `finalityEvidence`, `presentation`, `registryOrigin`, `launchingWallet`, `postLaunchAuthorityInventory`, `lifecycle`, and `mechanisms`. These are additive v2 fields, not a new API major version.

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

const status = await getJson("/api/v2/status")
const manifest = await getJson("/api/v2/manifest")
let page = await getJson("/api/v2/launches")
let resumeCursor = page.page.resumeCursor ?? page.snapshot?.cursor ?? null

for (;;) {
  for (const record of page.items) {
    const assetKey = record.token
      ? `${record.chainId}:${record.token.address.toLowerCase()}`
      : `project:${record.projectId ?? record.launchId}`

    renderLaunch({
      assetKey,
      launchId: record.launchId,
      category: record.category,
      token: record.token,
      assets: record.assets ?? [],
      markets: record.markets,
      capabilities: record.capabilities,
      verification: record.verification,
    })
  }

  // nextCursor is only for completing this traversal.
  if (!page.page.hasMore || page.page.nextCursor === null) break
  page = await getJson(`/api/v2/launches?cursor=${encodeURIComponent(page.page.nextCursor)}`)
  resumeCursor = page.page.resumeCursor ?? resumeCursor
}

// Persist resumeCursor only after the full traversal above is durably applied.
// The next incremental poll begins after that high-water checkpoint.
const updates = resumeCursor
  ? await getJson(`/api/v2/launches?after=${encodeURIComponent(resumeCursor)}`)
  : await getJson("/api/v2/launches")

function renderLaunch(record) {
  console.log(record)
}
```

The example deliberately does not construct transactions. The v2 API is strictly read-only. Discovery is universal; support states can report whether a separately verified market adapter supports charting, quote, simulation, or execution, but they do not authorize a transaction or return transaction payloads.

In production, verify that the URLs selected from the discovery document stay on the canonical HTTPS origins your integration permits. Never copy credentials into a URL.

## 6. Fetch one launch

Use the launch ID returned by the feed for every record shape:

```text
GET https://developers.programmable.family/api/v2/launches/{launchId}
```

URL-encode the complete launch ID as one path segment. This route covers project-only and multi-asset records.

For a token convenience lookup, use the detail route with an address returned by the feed:

```text
GET https://developers.programmable.family/api/v2/launches/{chainId}/{tokenAddress}
```

Use the numeric chain ID and token contract address exactly as identity inputs. Never identify a token by name or ticker alone.

## 7. Production rules

Before shipping:

- Validate responses against the repository JSON Schemas.
- Deduplicate feed items by `launchId`; key assets by `chainId` and token address.
- Preserve project-only records with `token: null`; key them by `projectId` and `launchId`, and retain their authenticated `assets` graph.
- Preserve the onchain launch timestamp rather than the time your service first observed the record.
- Accept a null timestamp, partial identity or provenance, and unavailable supply without dropping a recognized launch.
- Treat a degraded response as usable but incomplete enrichment; do not convert null into zero or guessed metadata.
- Treat `observed` and `confirmed` records as non-final. If a later poll marks a launch `orphaned`, apply that correction idempotently; otherwise reconcile non-final records against later snapshots.
- Keep registered launches visible when a market or capability is unknown; do not invent another category.
- Accept multiple primary or secondary tokens, contract markets, and open asset roles without selecting an invented canonical token.
- Ignore unsupported capabilities, market types, and namespaced extensions.
- Do not render a chart or trade button without the corresponding verified support.
- Treat creator metadata and external links as untrusted display data.
- Map only `classic` to `Programmable Classic` and `custom` to `Programmable Custom`; keep partner, template, model, hook, and market kind as secondary data.
- Keep Custom inactive while the manifest reports a prelaunch Registry, null address or start block, or disabled public submissions.
- Partition checkpoints by API major version, chain, and filter scope.
- Display `Programmable Verified` only from an effective structured review bound to the deployed revision.
- Keep partner attribution independent from fee state. A partner-attributed project without a verified fee path uses `no-qualifying-market` and zero shares; an active partnership-template fee path uses 20 bps split 15/5 with no extra Native Custom 10 bps.

## Next step

Use the dependency-free [JavaScript helper](../examples/lib/programmable-client.mjs) or [typed client](../examples/programmable-client.ts), then choose the guide for [terminals](guides/terminals-and-scanners.md), [wallets](guides/wallets.md), [indexers](guides/indexers.md), or [apps](guides/apps-and-games.md). Read [Operations](operations.md) before running a persistent indexer.
