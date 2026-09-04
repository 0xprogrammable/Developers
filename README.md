<img src="public/assets/brand/programmable-github-mark-loop.gif" alt="Programmable GitHub mark" width="640">

# Programmable developer docs

Documentation, API contracts and read-only examples for integrating Programmable
launches on Ethereum and Robinhood Chain.

[Documentation index](docs/README.md) · [Quickstart](docs/quickstart.md) · [Examples](examples/README.md)

## Start here

| Task | Guide |
| --- | --- |
| Index Custom launches on Robinhood Chain | [Robinhood terminal integration](docs/guides/robinhood-terminal-indexer.md) |
| Add Programmable labels to a terminal | [Trading terminals and scanners](docs/guides/terminals-and-scanners.md) |
| Verify a token or pool directly onchain | [Launch stamp reference](docs/reference/launch-stamp.md) |
| Read and follow the hosted launch feed | [Hosted feed integration](docs/reference/hosted-feed.md) |
| Build an API launch integration | [V3 profile guide](docs/guides/direct-native-hook-graph-profile-v3.md) |

The [Robinhood guide is also published as a webpage](https://developers.programmable.family/robinhood-terminal-indexer)
and as [Markdown for agents](https://developers.programmable.family/robinhood-terminal-indexer.md).

## Chain support

| Chain | Availability |
| --- | --- |
| Ethereum · `1` | Classic and Custom Router stamps. Hosted read model published; check feed quality. Public launch API: V3 profile `3.3.0`. |
| Robinhood · `4663` | Custom Router stamps. Hosted read model and public V4 API / CLI planned. |

Read the [current status](docs/status.md) and each chain's manifest before
integrating. Deployment addresses, start blocks and runtime hashes come from
that manifest. A live Router does not establish hosted-feed or launch-API availability.

## Verify a Robinhood launch

Requires Node.js 20 or later and an RPC that supports finalized, historical
block-hash reads. No package installation or Programmable API key is required.

```sh
git clone https://github.com/programmablehq/Developers.git
cd Developers
PROGRAMMABLE_RPC_URL=https://rpc-robinhood.blockmachine.io \
  node examples/verify-robinhood-release.mjs
```

The example verifies the existing finalized launch referenced by the manifest.
A successful result includes `state: "stamped"`, `category: "custom"` and
`publicLabel: "Programmable Custom"`. An incomplete verification returns
`indeterminate`; it is not evidence that a token is absent.

For another token, use the [generic stamp verifier](examples/README.md#verify-a-token-or-pool).
For continuous indexing, follow the [Robinhood integration guide](docs/guides/robinhood-terminal-indexer.md#index-launches).

## Read API and contracts

The Developer v2 API is read-only and requires no authentication.
Start from [discovery](https://developers.programmable.family/.well-known/programmable.json)
and select the chain before fetching its manifest or feed.

| Resource | Endpoint |
| --- | --- |
| Chain manifest | `/api/v2/manifests/{chainId}` |
| Chain status | `/api/v2/status?chainId={chainId}` |
| Launch feed | `/api/v2/launches?chainId={chainId}` |
| Token list | `/api/v2/token-list?chainId={chainId}` |

The `/api/v2/manifest` alias refers to Ethereum. See the
[HTTP reference](docs/reference/http-api.md) for queries, pagination and errors.

- [Read API OpenAPI](openapi/programmable-v2.yaml)
- [JSON Schemas](schemas/v2/)
- [Router ABI](abis/programmable-launch-stamp-router-v1.json)
- [Deployment evidence](deployments/)

## Interpret a launch

The public categories are `classic` and `custom`. A recognized launch remains
visible when metadata, market data or trading support is unavailable.

A canonical Router stamp establishes launch provenance. It does not establish
an audit, safety, liquidity, sellability or fee behavior. Historical launches
are not backfilled by Router V1. The same verification applies to future stamped
Custom launches by any developer; individual hook contracts do not need an allowlist.

Use the [data model](docs/concepts/data-model.md) for record fields,
[platform fees](docs/reference/fees.md) for fee accounting, and
[Protocol fee claim discovery](docs/reference/protocol-fee-claims.md) for claim eligibility.

## Repository structure

| Directory | Contents |
| --- | --- |
| [docs/](docs/README.md) | Guides, concepts, references and compatibility notes |
| [examples/](examples/README.md) | Runnable curl, JavaScript and TypeScript examples |
| [abis/](abis/README.md), [openapi/](openapi/), [schemas/](schemas/) | Machine-readable contracts |
| [deployments/](deployments/), [fixtures/](fixtures/) | Deployment evidence and conformance cases |
| [tests/](tests/) | Contract and consumer checks |

Agents can start with [llms.txt](llms.txt); [llms-full.txt](llms-full.txt) contains
the detailed integration reference. API launch requests use a separate
[Custom Launch API](https://programmable.market/docs/developers/custom-launch).
The controller wallet reviews, signs and broadcasts separately.

## Contribute

```sh
npm ci --ignore-scripts
npm run build
npm run check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for changes and
[GitHub issues](https://github.com/programmablehq/Developers/issues) for documentation
or integration problems. Report vulnerabilities through [SECURITY.md](SECURITY.md).

[License](LICENSE)
