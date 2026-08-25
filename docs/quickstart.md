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

`https://developers.programmable.family/api/v2/manifest` is the canonical Developer integration inventory. The Website endpoint at `https://programmable.family/api/custom-launch/registry/v1/manifest` is an operational presentation mirror with its own schema; it must not override the Developer manifest. If the two disagree, retain the last trusted Developer manifest, stop accepting new deployment identities, and alert an operator.

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

Registry-backed records can also include `platformId`, `publicLabel`, `caip2`, `projectId`, `model`, `template`, `partner`, `provider`, `builder`, `approvalBinding`, `deploymentBinding`, `verifiedReview`, `feePolicy`, `finalityEvidence`, `presentation`, `registryOrigin`, `launchingWallet`, `postLaunchAuthorityInventory`, `lifecycle`, and `mechanisms`. These are additive v2 fields, not a new API major version.

An empty `markets` array is valid. It means the launch currently has no registered market; it does not permit a client to fabricate a pool, price, liquidity, volume, chart, or swap action.

`status: "degraded"` can accompany valid recognized launch items when metadata, supply, or block-timestamp enrichment is incomplete. Preserve null and unavailable fields and inspect each record's `identityStatus`, `supplyStatus`, metadata trust, and `provenanceStatus`. Incomplete enrichment does not remove a recognized launch.

If canonical event-log coverage is incomplete, launch-list and token-list return the recognized bounded subset with `status: "degraded"` or `"unavailable"`. Process present records, but do not interpret absence as deletion or complete history.

## 5. Consume the feed in JavaScript

This bounded reference performs a full backfill, rejects page-cursor loops, deduplicates replayed launch IDs, commits the traversal before advancing the durable cursor, then begins an incremental `after` poll. Requests use a 10-second timeout, at most three attempts, bounded `Retry-After`, and full-jitter exponential backoff. The in-memory commit function keeps the snippet runnable; replace that one function with a durable database transaction in production.

```js
const baseUrl = "https://developers.programmable.family"
const retryableStatuses = new Set([408, 429, 500, 502, 503, 504])
const maximumPages = 1_000
const durableRecords = new Map()
let durableResumeCursor = null

async function getJson(path, search = {}) {
  const url = new URL(path, baseUrl)
  for (const [key, value] of Object.entries(search)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value))
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response
    try {
      response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      })
    } catch (error) {
      if (attempt === 3) throw error
      await wait(retryDelayMs(null, attempt))
      continue
    }

    if (response.ok) return response.json()

    const problem = await response.json().catch(() => null)
    if (!retryableStatuses.has(response.status) || attempt === 3) {
      throw new Error(problem?.detail ?? `Request failed with ${response.status}`)
    }
    await wait(retryDelayMs(response.headers.get("retry-after"), attempt))
  }
}

async function ingestTraversal(after = null) {
  const recordsByLaunchId = new Map()
  const traversedCursors = new Set()
  let request = after ? { after, limit: 100 } : { limit: 100 }
  let resumeCursor = null

  for (let pageCount = 0; pageCount < maximumPages; pageCount += 1) {
    const feed = await getJson("/api/v2/launches", request)
    if (!Array.isArray(feed.items) || !feed.page ||
        typeof feed.page !== "object" || Array.isArray(feed.page)) {
      throw new Error("Invalid launch-feed envelope")
    }

    const pageResumeCursor = feed.page.resumeCursor ?? null
    if (resumeCursor && pageResumeCursor && resumeCursor !== pageResumeCursor) {
      throw new Error("resumeCursor changed during one traversal")
    }
    resumeCursor ??= pageResumeCursor

    for (const record of feed.items) {
      if (typeof record.launchId !== "string" || record.launchId.length === 0) {
        throw new Error("Launch record is missing launchId")
      }
      // Upsert by launchId: retries and finality changes can replay a record.
      recordsByLaunchId.set(record.launchId, record)
    }

    if (feed.page.hasMore !== true) {
      if (feed.page.nextCursor !== null) {
        throw new Error("nextCursor present after the traversal boundary")
      }
      if (typeof resumeCursor !== "string" || resumeCursor.length === 0) {
        throw new Error("resumeCursor missing at the traversal boundary")
      }
      return { records: [...recordsByLaunchId.values()], resumeCursor }
    }

    const nextCursor = feed.page.nextCursor
    if (typeof nextCursor !== "string" || nextCursor.length === 0) {
      throw new Error("nextCursor missing before the traversal boundary")
    }
    if (traversedCursors.has(nextCursor)) {
      throw new Error("Page cursor loop detected")
    }
    traversedCursors.add(nextCursor)
    request = { cursor: nextCursor, limit: 100 }
  }

  throw new Error(`Traversal exceeded ${maximumPages} pages`)
}

async function commitRecordsAndCursor({ records, resumeCursor }) {
  // Replace this in-memory demo with one durable database transaction.
  for (const record of records) durableRecords.set(record.launchId, record)
  durableResumeCursor = resumeCursor
}

function retryDelayMs(retryAfter, attempt) {
  const seconds = Number(retryAfter)
  if (retryAfter && Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 5_000)
  }
  if (retryAfter) {
    const dateDelay = Date.parse(retryAfter) - Date.now()
    if (Number.isFinite(dateDelay) && dateDelay > 0) return Math.min(dateDelay, 5_000)
  }
  const ceiling = Math.min(250 * 2 ** (attempt - 1), 2_000)
  return Math.floor(Math.random() * (ceiling + 1))
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

const [status, manifest] = await Promise.all([
  getJson("/api/v2/status"),
  getJson("/api/v2/manifest"),
])

const backfill = await ingestTraversal()
await commitRecordsAndCursor(backfill)

// A later poll starts after the last fully committed high-water checkpoint.
const updates = await ingestTraversal(durableResumeCursor)
await commitRecordsAndCursor(updates)

console.log({ status: status.status, manifestVersion: manifest.manifestVersion })
console.log({ storedLaunches: durableRecords.size, resumeCursor: durableResumeCursor })
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
- Treat a degraded or unavailable response as a bounded partial view; keep recognized records, do not convert null into zero, and do not interpret absence as deletion.
- Treat `observed` and `confirmed` records as non-final. If a later poll marks a launch `orphaned`, apply that correction idempotently; otherwise reconcile non-final records against later snapshots.
- Keep registered launches visible when a market or capability is unknown; do not invent another category.
- Accept multiple primary or secondary tokens, contract markets, and open asset roles without selecting an invented canonical token.
- Ignore unsupported capabilities, market types, and namespaced extensions.
- Do not render a chart or trade button without the corresponding verified support.
- Treat creator metadata and external links as untrusted display data.
- Map only `classic` to `Programmable Classic` and `custom` to `Programmable Custom`; keep partner, template, model, hook, and market kind as secondary data.
- Keep unsupported Registry generations and provider paths inactive when their deployment evidence is absent. Route new preparation to the live Custom Launch API; legacy Registry and GitHub submission intake are closed.
- Partition checkpoints by API major version, chain, and filter scope.
- Display `Programmable Verified` only from an effective structured review bound to the deployed revision.
- Keep partner attribution independent from fee state. A partner-attributed project without a verified fee path uses `no-qualifying-market` and zero shares; an active partnership-template fee path uses 20 bps split 15/5 with no extra Native Custom 10 bps.

## Next step

Use the dependency-free [JavaScript helper](../examples/lib/programmable-client.mjs) or [typed client](../examples/programmable-client.ts), then choose the guide for [terminals](guides/terminals-and-scanners.md), [wallets](guides/wallets.md), [indexers](guides/indexers.md), or [apps](guides/apps-and-games.md). Read [Operations](operations.md) before running a persistent indexer.
