# Hosted feed integration

This guide fetches a chain-qualified deployment manifest and normalized launch feed. It is read-only and requires no SDK or API key. Ethereum Mainnet (`chainId: 1`) has a live hosted read model. Robinhood Chain Mainnet (`chainId: 4663`) has a live direct-chain Router integration; its hosted read model remains planned. Use the [Robinhood terminal guide](https://developers.programmable.family/robinhood-terminal-indexer) for independent stamp verification and indexing.

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

The legacy route above is the Ethereum chain-1 alias. Resolve a selected chain
through its chain-qualified route:

```bash
curl -fsSL https://developers.programmable.family/api/v2/manifests/4663
```

The manifest is the integration source for active deployments, start blocks, categories, Custom Registry state, platform fee disclosure, API routes, and compatibility information. Read its arrays at runtime. Do not copy an individual contract address into permanent client code.

On Ethereum, active v2 Classic discovery is intentionally limited to the historical V3 release and the current V4 release. Classic V1 and V2 remain inactive history and Stock is excluded from active v2 discovery. Custom remains a separate source lane. The Router supplies provenance and transport evidence; it is not a third public category. Refreshing the manifest is sufficient for a generic Router-first integration to discover Ethereum Classic V4 without a client code or address update.

`https://developers.programmable.family/api/v2/manifest` is the canonical Developer integration inventory. The Website endpoint at `https://programmable.family/api/custom-launch/registry/v1/manifest` is an operational presentation mirror with its own schema; it must not override the Developer manifest. If the two disagree, retain the last trusted Developer manifest, stop accepting new deployment identities, and alert an operator.

The current Robinhood manifest publishes `directChainIntegration.status: "live"`
and a live `launchStampRouter`, while `programmable/read-model-v1` remains
planned. Read the complete manifest dynamically; never copy its roots into
consumer examples. The following selected planned manifest is an illustrative
negative example, not the current response. A client must reject these null
roots for direct-chain scanning:

```json
{
  "chainId": 4663,
  "caip2": "eip155:4663",
  "deployments": [],
  "customRegistry": {
    "status": "planned",
    "publicSubmissionsEnabled": false,
    "address": null,
    "startBlock": null
  },
  "launchStampRouter": {
    "status": "planned",
    "address": null,
    "startBlock": null,
    "runtimeCodeHash": null,
    "deploymentEvidence": null,
    "canaryEvidence": null
  },
  "customLaunchV4": {
    "status": "planned",
    "profile": null,
    "finalityPolicy": null
  },
  "extensions": {
    "programmable/read-model-v1": {
      "status": "planned",
      "absenceAuthoritative": false
    }
  }
}
```

Do not replace null roots in a planned response with prepared addresses. Fetch
the current manifest instead and validate its published direct-chain evidence.
The planned
[V4 OpenAPI](https://programmable.market/openapi/custom-launch-v4.json),
[V4 source-verification status contract](https://programmable.market/schemas/custom-launch/v4/source-verification-status.json),
and
[Developer source-verification projection schema](https://developers.programmable.family/schemas/v2/custom-launch-source-verification-v4.schema.json)
support client preparation; they do not activate public writes or prove a
deployment, finality, exact source match, indexing, visibility, or release.

## Verify the released Robinhood launch directly

From a clone of this repository, use Node.js 20 or later to run the
[Robinhood release verifier](../../examples/verify-robinhood-release.mjs). No
package installation is required:

```bash
PROGRAMMABLE_RPC_URL='<https-robinhood-rpc-url>' \
  node examples/verify-robinhood-release.mjs
```

It starts at public discovery, fetches the chain-4663 manifest, derives the
existing token from its finalized canary receipt, then checks the canonical
Router stamp, runtime, immutable bindings and component proofs. Successful
output includes `state: "stamped"`, `chainId: 4663`, `category: "custom"` and
`publicLabel: "Programmable Custom"`. Provider or evidence failures return an
indeterminate result instead of granting attribution.

Use an RPC that serves canonical finalized and historical hash-bound reads;
never substitute `latest`. For your own launch, the generic
[Node verifier](../../examples/verify-launch-stamp.mjs)
supports `PROGRAMMABLE_CHAIN_ID=4663`; the
[viem verifier](../../examples/verify-launch-stamp-viem.ts) accepts `chainId: 4663`.
These are read-only checks and require neither a wallet nor an API credential.

## 4. Fetch launches

```bash
curl -fsSL https://developers.programmable.family/api/v2/launches
```

The response has this stable root shape:

```text
schemaVersion  response schema version
status         feed lifecycle and availability
snapshot       response-wide upper boundary plus exact per-source boundaries
items          normalized launch records
page           cursor and hasMore state
```

Each item contains:

```text
schemaVersion  launch schema version
platformId     programmable for every official normalized record
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

Registry-backed records can also include `publicLabel`, `caip2`, `projectId`, `model`, `template`, `partner`, `provider`, `builder`, `approvalBinding`, `deploymentBinding`, `verifiedReview`, `feePolicy`, `finalityEvidence`, `presentation`, `registryOrigin`, `launchingWallet`, `postLaunchAuthorityInventory`, `lifecycle`, and `mechanisms`. These are additive v2 fields, not a new API major version.

The hosted v2 projector always supplies `platformId: "programmable"`, and the
typed client models that runtime guarantee as required. The additive v2 JSON
schema keeps the field optional for older producer fixtures, but constrains it
to the same constant whenever present. Consumers must still require it before
showing a Programmable label.

An empty `markets` array is valid. It means the launch currently has no registered market; it does not permit a client to fabricate a pool, price, liquidity, volume, chart, or swap action.

`status: "degraded"` can accompany valid recognized launch items when metadata, supply, or block-timestamp enrichment is incomplete. Preserve null and unavailable fields and inspect each record's `identityStatus`, `supplyStatus`, metadata trust, and `provenanceStatus`. Incomplete enrichment does not remove a recognized launch.

The snapshot's top-level block is the highest represented chain boundary, so an included launch is never newer than the response snapshot. Its finality remains conservative across the represented sources. Inspect `snapshot.sources.classicIndexer`, `snapshot.sources.customRegistry`, and `snapshot.sources.routerCustom` for the exact source vector, including a source that is behind the top-level boundary. Router Custom commitment changes intentionally replay Router identities during an `after` poll so a newly published identity with an older launch block cannot be skipped. Upsert by `chainId + launchId` and treat that replay as at-least-once delivery.

The hosted Classic baseline is read from the canonical paginated `https://programmable.market/api/explore` catalog and accepted only when its schema, scope, evidence and identity commitments are internally consistent. The current evidence reports Envio deployment `production-6157d22`, but legitimate deployment revisions do not require code changes. The retired legacy token source returns HTTP `410` and is not used. Consumers should still integrate through the Developer discovery and launch-feed URLs above rather than binding directly to that internal upstream.

If canonical event-log coverage is incomplete, launch-list and token-list return the recognized bounded subset with `status: "degraded"` or `"unavailable"`. Process present records, but do not interpret absence as deletion or complete history.

For the Robinhood hosted read-model lane, request the chain explicitly:

```bash
curl -fsSL 'https://developers.programmable.family/api/v2/launches?chainId=4663'
```

The current empty `status: "unavailable"` response is non-authoritative. It
means the chain read model is not released, not that the chain has no launches.

The repository helper keeps the chain and category attached to discovery,
status, every page cursor, and every later `after` poll:

```bash
PROGRAMMABLE_CHAIN_ID=4663 PROGRAMMABLE_CATEGORY=custom \
  sh examples/curl-quickstart.sh
```

Once a token address is present in a published launch, the same helper can
exercise the chain-qualified token lookup:

```bash
PROGRAMMABLE_CHAIN_ID=4663 PROGRAMMABLE_CATEGORY=custom \
PROGRAMMABLE_TOKEN_ADDRESS='<tokenAddress>' \
  sh examples/curl-quickstart.sh
```

These hosted-feed commands report non-authoritative Robinhood availability
until the hosted read model is separately promoted. This does not block the
live direct-chain integration. Its Router root, finality requirements and
finalized launch vector come from the same chain-qualified manifest.

For a short typed terminal integration, save this as `robinhood-read.ts` in the
repository root and run `npx tsx robinhood-read.ts`:

```ts
import { ProgrammableClient } from "./examples/programmable-client.ts"

const client = new ProgrammableClient()
const feed = await client.launches({ chainId: 4663, category: "custom", limit: 25 })

for (const item of feed.items) {
  if (item.platformId !== "programmable" || item.category !== "custom") continue
  console.log(item.chainId, item.launchId, item.token?.address ?? "project-only")
}
```

When promoted, this hosted V4 lane is deliberately narrow: it projects only finalized,
Router-stamped Programmable Custom resources accepted by the published chain
binding. It is not a directory of arbitrary Uniswap v4 hooks.

## 5. Consume the feed in JavaScript

This bounded reference performs a full backfill, rejects page-cursor loops, deduplicates replayed chain-scoped launch IDs, commits the traversal before advancing the durable cursor, then begins an incremental `after` poll. It keeps the same chain and category on the first request, every `cursor` continuation, and every later `after` poll. Requests use a 10-second timeout, at most three attempts, bounded `Retry-After`, and full-jitter exponential backoff. The in-memory commit function keeps the snippet runnable; replace that one function with a durable database transaction in production.

```js
const baseUrl = "https://developers.programmable.family"
const chainId = 1
const category = "custom"
const pollScope = { chainId, category }
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
  const recordsByKey = new Map()
  const traversedCursors = new Set()
  let request = after
    ? { ...pollScope, after, limit: 100 }
    : { ...pollScope, limit: 100 }
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
      if (String(record.chainId) !== String(chainId)) {
        throw new Error("Launch record escaped the requested chain scope")
      }
      // Retries and finality changes can replay a record. Chain scope prevents
      // the same opaque launch ID on another chain from overwriting it.
      recordsByKey.set(`${record.chainId}:${record.launchId}`, record)
    }

    if (feed.page.hasMore !== true) {
      if (feed.page.nextCursor !== null) {
        throw new Error("nextCursor present after the traversal boundary")
      }
      if (typeof resumeCursor !== "string" || resumeCursor.length === 0) {
        throw new Error("resumeCursor missing at the traversal boundary")
      }
      return { records: [...recordsByKey.values()], resumeCursor }
    }

    const nextCursor = feed.page.nextCursor
    if (typeof nextCursor !== "string" || nextCursor.length === 0) {
      throw new Error("nextCursor missing before the traversal boundary")
    }
    if (traversedCursors.has(nextCursor)) {
      throw new Error("Page cursor loop detected")
    }
    traversedCursors.add(nextCursor)
    request = { ...pollScope, cursor: nextCursor, limit: 100 }
  }

  throw new Error(`Traversal exceeded ${maximumPages} pages`)
}

async function commitRecordsAndCursor({ records, resumeCursor }) {
  // Replace this in-memory demo with one durable database transaction.
  for (const record of records) {
    durableRecords.set(`${record.chainId}:${record.launchId}`, record)
  }
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
  getJson("/api/v2/status", { chainId }),
  getJson(`/api/v2/manifests/${chainId}`),
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

Use the chain and launch ID returned by the feed for every record shape:

```text
GET https://developers.programmable.family/api/v2/chains/{chainId}/launches/{launchId}
```

URL-encode the complete launch ID as one path segment. This route covers project-only and multi-asset records. The older `/api/v2/launches/{launchId}` route is an Ethereum-only compatibility alias; new integrations should not use it.

For a token convenience lookup, use the detail route with an address returned by the feed:

```text
GET https://developers.programmable.family/api/v2/launches/{chainId}/{tokenAddress}
```

Use the numeric chain ID and token contract address exactly as identity inputs. Never identify a token by name or ticker alone.

## 7. Production rules

Before shipping:

- Validate responses against the repository JSON Schemas.
- Deduplicate normalized feed items by `chainId + launchId`; key Router provenance by `chainId + Router address + launchId`, and key assets by `chainId` and token address.
- Preserve project-only records with `token: null`; key them by chain, `projectId`, and `launchId`, and retain their authenticated `assets` graph.
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
- Keep unsupported Registry generations and provider paths inactive when their deployment evidence is absent. Legacy Registry and GitHub submission intake are closed; Custom Launch API V1 POST is read-only and returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY`.
- Treat Custom Launch API V2 as historical read-only: require `status: "read-only"`, `publiclyRoutable: false`, `productionLaunchAuthorized: false`, and authenticated POST `409 CUSTOM_LAUNCH_V2_READ_ONLY`. Only V3 profile `3.3.0` accepts fresh submissions.
- Partition checkpoints by API major version, chain, and filter scope.
- Require a chain's manifest and feed quality to be promoted independently. A live Ethereum refresh cannot promote Robinhood, and an empty unavailable Robinhood hosted feed is never an authoritative absence check.
- Track finality, exact source verification, indexing completeness, and public feed visibility as independent evidence. Do not infer one from another or infer trading support from any of them.
- Display `Programmable Verified` only from an effective structured review bound to the deployed revision.
- Keep partner attribution independent from fee state. A partner-attributed project without a verified fee path uses `no-qualifying-market` and zero shares; an active partnership-template fee path uses 20 bps split 15/5 with no extra Native Custom 10 bps.

## Next step

Use the dependency-free [JavaScript helper](../../examples/lib/programmable-client.mjs) or [typed client](../../examples/programmable-client.ts), then choose the guide for [terminals](../guides/terminals-and-scanners.md), [wallets](../guides/wallets.md), [indexers](../guides/indexers.md), or [apps](../guides/apps-and-games.md). Read [Operations](../operations.md) before running a persistent indexer.
