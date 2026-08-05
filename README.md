# Programmable Developer Platform

## One integration for every Programmable launch.

Discover, verify, and build on Programmable Classic and Custom launches through one versioned interface.

| Surface | Current state |
| --- | --- |
| Programmable Classic on Ethereum | Live |
| Existing first-party stock-paired records | Normalized as `custom`; availability comes from the manifest |
| Open Custom intake and Custom Registry | Prelaunch |

The public category is always `classic` or `custom`. A Custom launch may have no market, one market, or several markets. Every registered launch remains discoverable; charts, quotes, simulation, and execution are available only when a verified adapter declares support for that market. The v1 API is read-only: support states describe availability but never return transaction payloads or authorize execution.

[Read the documentation](docs/README.md) · [Start the five-minute quickstart](docs/quickstart.md) · [Check integration status](docs/status.md) · [Open the developer site](https://developers.programmable.family)

## Integrate in five minutes

No SDK or API key is required for the read-only quickstart.

```bash
curl -fsSL https://developers.programmable.family/.well-known/programmable.json
curl -fsSL https://developers.programmable.family/api/v1/status
curl -fsSL https://developers.programmable.family/api/v1/manifest
curl -fsSL https://developers.programmable.family/api/v1/launches
```

If status reports the Custom Registry unavailable, request
`/api/v1/launches?category=classic`; the unfiltered feed intentionally waits
for complete source coverage instead of silently omitting Custom launches.

```js
const baseUrl = "https://developers.programmable.family"

const [status, manifest, launches] = await Promise.all([
  fetch(`${baseUrl}/api/v1/status`).then(requireOk).then(response => response.json()),
  fetch(`${baseUrl}/api/v1/manifest`).then(requireOk).then(response => response.json()),
  fetch(`${baseUrl}/api/v1/launches`).then(requireOk).then(response => response.json()),
])

for (const record of launches.items) {
  console.log({
    platformId: record.platformId,
    launchId: record.launchId,
    category: record.category,
    chainId: record.chainId,
    token: record.token,
    marketCount: record.markets.length,
    finality: record.launch.finality,
  })
}

function requireOk(response) {
  if (!response.ok) throw new Error(`Programmable API returned ${response.status}`)
  return response
}
```

A conforming v1 client must:

1. Read active deployments from the manifest instead of hard-coding contract addresses.
2. Deduplicate launches by `launchId`. When `token` is present, identify that ERC-20 by `chainId` and token address; otherwise preserve the authenticated `assets` graph without inventing a token.
3. Accept `markets: []`; never invent a pool, price, volume, or trade route.
4. Treat capabilities and market types as extensible. Keep an unknown launch visible and hide unsupported features.
5. Use `page.nextCursor` only to finish the current traversal, then persist `page.resumeCursor` and send it back as `after` when polling.
6. Respect finality and reorg state instead of treating first observation as permanent.

The complete walkthrough is in the [quickstart](docs/quickstart.md).

## Choose what you are building

- **Trading terminal or scanner:** Follow the launch feed, label Classic and Custom, and expose only supported market features. [Open the terminal guide](docs/guides/terminals-and-scanners.md).
- **Wallet or explorer:** Resolve token metadata and verify Programmable provenance without trusting names or tickers as identity. [Open the wallet guide](docs/guides/wallets.md).
- **Indexer or data platform:** Backfill deterministically, resume with cursors, and handle observed blocks and reorgs. [Open the indexer guide](docs/guides/indexers.md).
- **App, game, or bot:** Discover launches and inspect verified capabilities without interpreting arbitrary contract metadata as instructions. [Open the app guide](docs/guides/apps-and-games.md).

## One stable v1 envelope

Every launch record uses the same top-level shape:

```text
schemaVersion
platformId
launchId
category
chainId
token
assets
launch
verification
capabilities
markets
fees
extensions
```

`platformId` is always `programmable` on records produced by the official projection. `category` is the durable `classic | custom` launch class, while `launch.modelId` carries the open-ended model. These fields come from verified launch provenance, never from a creator-editable token tag. `token` can be null for project-only launches; `assets` preserves their real identities.

The envelope is stable even when the product is unfamiliar. Market-specific information stays inside `markets`, optional capabilities advertise support, and namespaced extensions carry additional data without redefining trusted core fields.

Within v1, existing fields are not removed, renamed, or reinterpreted. New deployments appear through the manifest. New optional fields, capabilities, and market types are additive. Clients must ignore what they do not recognize and preserve the known launch identity. See [Compatibility](docs/concepts/compatibility.md).

## Source of truth and trust

Onchain launch provenance is authoritative. The API is a normalized projection designed for integration; it is not a substitute for the transaction, block, registry, and runtime evidence carried by a record.

Legacy indexer records can have partial provenance. Recognized onchain events remain discoverable when metadata, supply, or block-timestamp enrichment is unavailable; affected fields stay partial, unavailable, or null and the feed can report `degraded`. Incomplete event-log coverage is different: launch-list and token-list routes return a retryable `503` rather than presenting an incomplete list as complete.

Creator-supplied names, descriptions, images, and links are metadata. They do not inherit the trust level of launch provenance. Integrators should display metadata trust state, sanitize rich content, and keep the launch ID plus authenticated asset identities visible. A token address exists only when the record actually advertises a token.

Registration means that a launch can be traced to a recognized Programmable deployment. It is not an unconditional statement that a token, external service, market, or economic outcome is safe or independently audited.

Read [The data model](docs/concepts/data-model.md) and [Operations](docs/operations.md) before enabling production ingestion.

## Platform fee

The Programmable platform fee is 10 basis points, or 0.1%, on supported official Programmable market paths. The recipient is:

```text
0x4957f49620AFf3Adbbe8195a4f633E49cc93376c
```

- Current Classic paths include the 10 bps platform share within their configured trading fee.
- Future Custom paths add 10 bps on top of the creator-defined market fee only after that fee path is deployed and verified.
- A launch with no executed trade has no trading volume and therefore no volume fee.
- Normal token transfers, game rewards, and independently created third-party pools are outside this fee path.

Never infer fee behavior from `category`; read the manifest and each market's verified fee disclosure. See [Fees](docs/reference/fees.md).

## API and machine-readable resources

| Resource | Purpose |
| --- | --- |
| `GET /.well-known/programmable.json` | Stable discovery document |
| `GET /api/v1/status` | API, indexing, freshness, and lifecycle status |
| `GET /api/v1/manifest` | Active deployments, start blocks, fee policy, and endpoint discovery |
| `GET /api/v1/launches` | Paginated normalized launch feed |
| `GET /api/v1/launches/{chainId}/{tokenAddress}` | One asset's Programmable launch record |
| `GET /api/v1/token-list` | Wallet-friendly finalized token list |
| [`llms.txt`](llms.txt) | Compact agent index |
| [`llms-full.txt`](llms-full.txt) | Complete agent-oriented integration contract |

The [HTTP API reference](docs/reference/http-api.md) describes response handling and errors. JSON Schemas and the OpenAPI contract are normative machine-readable resources in this repository.

## Repository map

```text
docs/           Human-readable guides, concepts, reference, and operations
openapi/        OpenAPI description for the hosted v1 API
schemas/        JSON Schemas for every public response
deployments/    Reproducible deployment evidence and source records
abis/           Contract interfaces used for direct verification
fixtures/       Classic, Custom, no-market, multi-market, and forward-compatibility cases
examples/       Copy-paste integration examples
compatibility/  Frozen v1 consumer contract
scripts/        Build, conformance, and live-smoke commands
tests/          Offline schema, semantic, consumer, and server checks
llms.txt        Compact agent documentation index
llms-full.txt   Complete agent integration context
```

## Current boundaries

- Classic launch discovery is live on Ethereum.
- Existing first-party stock-paired records use the public `custom` category.
- Open Custom intake and the open Custom Registry are prelaunch. Examples of future open Custom launches are fixtures, not live assets.
- A registered launch is always discoverable. Chart, quote, simulation, and execution support remain explicit per market.
- No named terminal, scanner, wallet, or data provider is implied to have integrated Programmable.

Read the [FAQ](docs/faq.md) for common integration questions.

## Support and security

Use this repository's GitHub issues for documentation and integration problems. Do not post private keys, credentials, non-public source code, or user data. Follow the repository security policy for vulnerabilities.

## License

See [LICENSE](LICENSE).
