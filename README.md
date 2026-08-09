# Programmable integration reference

**Integrate once. Discover every Programmable launch.**

Public, read-only contracts and ingestion rules for trading terminals, launch trackers, scanners, wallets, indexers, bots, and apps.

## Terminal labels

Use exactly these two public labels:

| API category | Terminal label | Current boundary |
| --- | --- | --- |
| `classic` | `Programmable Classic` | Current and historical Classic releases |
| `custom` | `Programmable Custom` | Launches accepted through the canonical Custom Registry |

| Surface | Current state |
| --- | --- |
| Programmable Classic on Ethereum | Live |
| Programmable Custom Registry discovery | Live on Ethereum |
| Programmable Custom public intake | Prelaunch |

The public category is always `classic` or `custom`. Provider names, factories, hook addresses and template versions remain per-launch provenance. They never create additional terminal categories. A Custom launch may have no market, one market, or several markets. The v2 API is read-only: support states describe availability but never return transaction payloads or authorize execution.

A full Registry-backed Custom record uses `platformId: "programmable"`, `category: "custom"`, and `publicLabel: "Programmable Custom"`. These values come from the trusted projection, never creator metadata.

[Minimal API example](docs/quickstart.md) · [Terminal guide](docs/guides/terminals-and-scanners.md) · [Future launch Router](docs/reference/launch-stamp.md) · [Direct onchain verification](docs/reference/onchain-verification.md) · [Integration checklist](docs/integration-checklist.md) · [Developer site](https://developers.programmable.family)

## Minimal API consumer

No SDK or API key is required.

```bash
curl -fsSL https://developers.programmable.family/.well-known/programmable.json
curl -fsSL https://developers.programmable.family/api/v2/status
curl -fsSL https://developers.programmable.family/api/v2/manifest
curl -fsSL https://developers.programmable.family/api/v2/launches
```

If status reports the Custom Registry unavailable, request
`/api/v1/launches?category=classic`; the unfiltered feed intentionally waits
for complete source coverage instead of silently omitting Custom launches.

```js
const baseUrl = "https://developers.programmable.family"

const [status, manifest, launches] = await Promise.all([
  fetch(`${baseUrl}/api/v2/status`).then(requireOk).then(response => response.json()),
  fetch(`${baseUrl}/api/v2/manifest`).then(requireOk).then(response => response.json()),
  fetch(`${baseUrl}/api/v2/launches`).then(requireOk).then(response => response.json()),
])

for (const record of launches.items) {
  console.log({
    platformId: record.platformId,
    launchId: record.launchId,
    projectId: record.projectId ?? null,
    category: record.category,
    chainId: record.chainId,
    token: record.token,
    assetCount: record.assets?.length ?? 0,
    marketCount: record.markets.length,
    finality: record.finalityEvidence?.status ?? record.launch.finality,
  })
}

function requireOk(response) {
  if (!response.ok) throw new Error(`Programmable API returned ${response.status}`)
  return response
}
```

That short snippet inspects only the first page. Production consumers should use the [bounded full-traversal reference](docs/quickstart.md#5-consume-the-feed-in-javascript), which includes replay deduplication, page and retry limits, timeout, jitter, `Retry-After`, cursor-loop rejection, durable commit ordering, and the next `after` poll.

A conforming v2 client must:

1. Read active deployments from the manifest instead of hard-coding contract addresses.
2. Deduplicate launches by `launchId`. When `token` is present, identify that ERC-20 by `chainId` and address; otherwise preserve `projectId`, `launchId`, and the authenticated `assets` graph without inventing a token.
3. Accept `markets: []`; never invent a pool, price, volume, or trade route.
4. Treat capabilities and market types as extensible. Keep an unknown launch visible and hide unsupported features.
5. Use `page.nextCursor` only to finish the current traversal, then persist `page.resumeCursor` and send it back as `after` when polling.
6. Respect finality and reorg state instead of treating first observation as permanent.

The complete terminal contract is in [Trading terminals and scanners](docs/guides/terminals-and-scanners.md).

## Choose what you are building

- **Trading terminal or scanner:** Follow the launch feed, label Classic and Custom, and expose only supported market features. [Open the terminal guide](docs/guides/terminals-and-scanners.md).
- **Launch provider:** Connect a reviewed external factory to the live Custom Registry without creating a provider-specific terminal category. [Open the provider guide](docs/guides/launch-providers.md).
- **Wallet or explorer:** Resolve token metadata and verify Programmable provenance without trusting names or tickers as identity. [Open the wallet guide](docs/guides/wallets.md).
- **Indexer or data platform:** Backfill deterministically, resume with cursors, and handle observed blocks and reorgs. [Open the indexer guide](docs/guides/indexers.md).
- **App, game, or bot:** Discover launches and inspect verified capabilities without interpreting arbitrary contract metadata as instructions. [Open the app guide](docs/guides/apps-and-games.md).

## One stable v2 envelope

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

`platformId` is always `programmable` on records produced by the official projection. `category` is the durable `classic | custom` launch class, while the model remains open-ended. These fields come from verified launch provenance, never from a creator-editable token tag.

Full Registry-backed records also carry `publicLabel`, `caip2`, `projectId`, model, template, partner, optional provider attribution, builder, approval and deployment bindings, structured review, fee policy, finality evidence, presentation, Registry origin, launching wallet, post-launch authorities, lifecycle, and mechanisms. Historical v2 records need not carry the richer fields. Their addition does not create “API v3”; the v2 envelope and historical record meanings remain stable.

`provider` is the normative optional location for launch-provider attribution. `verificationStatus: "registry-bound"` is valid only with its Registry evidence hash. `display-only` provider data and unfamiliar provider extensions may be shown as secondary attribution, but they never establish Programmable identity, partner status, fee verification, template approval, security review, or executable support.

`token` can be null for a project-only launch. `assets` can preserve multiple tokens, contracts, hooks, controllers, oracles, bridges, rewards, and unknown future roles. Markets can refer to those assets without fabricating an ERC-20 pair or pool.

The envelope is stable even when the product is unfamiliar. Market-specific information stays inside `markets`, optional capabilities advertise support, and namespaced extensions carry additional data without redefining trusted core fields.

Within v2, existing fields are not removed, renamed, or reinterpreted. New Classic deployments and an activated Custom Registry appear through the manifest. New optional fields, capabilities, and market types are additive. Clients must ignore what they do not recognize and preserve the known launch identity. See [Compatibility](docs/concepts/compatibility.md).

## Source of truth and trust

Onchain launch provenance is authoritative. The API is a normalized projection designed for integration; it is not a substitute for the transaction, block, registry, and runtime evidence carried by a record.

Legacy indexer records can have partial provenance. Recognized onchain events remain discoverable when metadata, supply, or block-timestamp enrichment is unavailable; affected fields stay partial, unavailable, or null and the feed can report `degraded`. Incomplete event-log coverage is different: launch-list and token-list routes return a retryable `503` rather than presenting an incomplete list as complete.

Creator-supplied names, descriptions, images, and links are metadata. They do not inherit the trust level of launch provenance. Integrators should display metadata trust state, sanitize rich content, and keep chain, launch ID, and authenticated project and asset identities visible. A token address exists only when the record actually advertises a token.

Registration means that a launch can be traced to a recognized Programmable deployment. It is not an unconditional statement that a token, external service, market, or economic outcome is safe or independently audited.

Read [The data model](docs/concepts/data-model.md) and [Operations](docs/operations.md) before enabling production ingestion.

## Fee policies

The Native Programmable platform fee is 10 basis points, or 0.1%, on supported official Programmable market paths. The recipient is:

```text
0x4957f49620AFf3Adbbe8195a4f633E49cc93376c
```

- Current Classic paths include the 10 bps platform share within their configured trading fee.
- Native Custom paths add 10 bps on top of the creator-defined market fee only after that fee path is deployed and verified.
- An active fee-bearing partnership-template path implements exactly 20 bps in the partner template: 15 bps for the partner and 5 bps for Programmable. It does not also add the Native Custom 10 bps.
- A launch with no executed trade has no trading volume and therefore no volume fee.
- Normal token transfers, game rewards, and independently created third-party pools are outside this fee path.

Partner attribution is independent of market and fee state. A verified partner-attributed project with no qualifying official market path uses `feePolicy.mode: "no-qualifying-market"` and zero shares; it does not pretend that 20 bps is active. An active fee-bearing partnership-template path remains disabled until the template proves one fee basis, both recipients, the exact split, currency, accrual, claim rights, and protection against one party claiming the other's share. No Basebit or Aion partner recipient or live fee path is currently published through the v2 manifest.

Never infer fee behavior from `category`, partner name, or template metadata; read the manifest and each market's verified fee disclosure. See [Fees](docs/reference/fees.md).

## API and machine-readable resources

| Resource | Purpose |
| --- | --- |
| `GET /.well-known/programmable.json` | Stable discovery document |
| `GET /api/v2/status` | API, indexing, freshness, and lifecycle status |
| `GET /api/v2/manifest` | Active deployments, start blocks, fee policy, and endpoint discovery |
| `GET /api/v2/launches` | Paginated normalized launch feed |
| `GET /api/v2/launches/{launchId}` | One launch by globally scoped launch ID, including project-only and multi-asset records |
| `GET /api/v2/launches/{chainId}/{tokenAddress}` | One asset's Programmable launch record |
| `GET /api/v2/token-list` | Wallet-friendly finalized token list |
| [`llms.txt`](llms.txt) | Compact agent index |
| [`llms-full.txt`](llms-full.txt) | Complete agent-oriented integration contract |

The [HTTP API reference](docs/reference/http-api.md) describes response handling and errors. JSON Schemas and the OpenAPI contract are normative machine-readable resources in this repository.

Use [Direct onchain verification](docs/reference/onchain-verification.md) to reproduce provenance and [Programmable Verified](docs/concepts/programmable-verified.md) to keep review, deployment binding, finality, authorities, dependencies, market support, and metadata trust separate.

## Validation commands

Run the offline repository gates before opening a pull request:

```bash
npm ci
npm run build
npm run check
```

Run the bounded read-only production smoke only when live verification is intentional:

```bash
PROGRAMMABLE_API_BASE=https://developers.programmable.family npm run smoke:live
```

The live smoke proves that the currently published HTTP surface answers and conforms to its expected baseline. It does not prove that an unreleased Registry, launch-ID route, Custom canary, deployment, or fee path is live.

## Repository map

```text
docs/           Human-readable guides, concepts, reference, and operations
openapi/        OpenAPI descriptions for the hosted APIs
schemas/        JSON Schemas for every public response
deployments/    Reproducible deployment evidence and source records
abis/           Contract interfaces used for direct verification
fixtures/       Classic, Custom, no-market, multi-market, and forward-compatibility cases
examples/       Copy-paste integration examples
proposals/      Non-normative prelaunch design inputs; never deployed ABI authority
compatibility/  Frozen public consumer contracts
scripts/        Build, conformance, and live-smoke commands
tests/          Offline schema, semantic, consumer, and server checks
llms.txt        Compact agent documentation index
llms-full.txt   Complete agent integration context
```

## Current boundaries

- Classic launch discovery is live on Ethereum.
- Custom Registry discovery is live on Ethereum Mainnet. General Custom intake remains prelaunch; the v2 Custom feed publishes only finalized, exact-revision Registry records.
- The separate Router V1 trust root for future Classic and future Custom launches remains prelaunch. Its manifest deployment fields are null, and it does not cover historical coins.
- Historical Stock-Paired records are not part of the v2 Programmable Custom classification. They remain available only on compatibility API v1.
- Ethereum Mainnet is the only currently advertised chain. Multi-chain support becomes live per chain only through the well-known document and manifest.
- No Basebit or Aion partnership, template, recipient, Registry record, or live fee path is currently verified by the public v2 surface.
- A registered launch is always discoverable. Chart, quote, simulation, and execution support remain explicit per market.
- No named terminal, scanner, wallet, or data provider is implied to have integrated Programmable.

Read the [FAQ](docs/faq.md) for common integration questions and use the [production integration checklist](docs/integration-checklist.md) before release.

Existing v1 consumers can follow the [v1 to v2 migration guide](docs/migrations/v1-to-v2.md). API v1 remains supported and has no retirement date.

## Support and security

Use this repository's GitHub issues for documentation and integration problems. Do not post private keys, credentials, non-public source code, or user data. Follow the repository security policy for vulnerabilities.

## License

See [LICENSE](LICENSE).
