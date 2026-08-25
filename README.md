![Programmable night garden](public/assets/brand/programmable-developers-readme.png)

# Programmable developer reference

Unauthenticated read and discovery contracts for detecting and verifying Programmable launches. The authenticated
Custom Launch API V1 keeps provenance reads and status live, but POST is read-only and returns nonretryable
`409 CUSTOM_LAUNCH_V1_READ_ONLY`. Custom Fee-Enforced Launch Profile V2 is a separate pinned
private-canary release candidate that remains publicly unavailable; held writes return `503` with `Retry-After`.

## Choose the API surface

| Surface | Authentication | Purpose | Canonical contract |
| --- | --- | --- | --- |
| Developer read API at `developers.programmable.family` | None | Discover launches, resolve deployments and verify provenance | [Read API OpenAPI](openapi/programmable-v2.yaml) |
| Custom Launch API V1 at `api.programmable.market` | Wallet-bound bearer API key | Inspect provenance reads and request status; POST is read-only | [Custom Launch API guide](https://programmable.market/developers/custom-launch-api-v1.md) and [V1 OpenAPI](https://programmable.market/openapi/custom-launch-v1.json) |
| Custom Fee-Enforced Launch Profile V2 | Private canary; not publicly available | Exact RC artifacts for an additive 1,000 ppm fee path are pinned; production authorization remains false | [Canary RC guide](docs/guides/custom-fee-enforced-launch-profile-v2.md) and [held V2 OpenAPI](https://programmable.market/openapi/custom-launch-v2.json) |

Create or revoke a wallet-bound key on the [API key management page](https://programmable.market/developers/api-keys).
An API key cannot sign or broadcast a transaction. V1 POST does not prepare an action while the surface is read-only.
The V1 request and response schemas remain owned by the V1 OpenAPI contract;
the separate held V2 contract is published at
`https://programmable.market/openapi/custom-launch-v2.json`. Neither is
duplicated in this read/discovery repository. Read the current versioned requirements in
[Programmable Launch Policy](https://github.com/0xprogrammable/Launch-Policy); this repository does not copy those policy
bytes.

## Start here

| Resource | Use |
| --- | --- |
| [Live manifest](https://developers.programmable.family/api/v2/manifest) | Resolve the active chain, Router, start block, runtime hash, ABI hash, events, getters, finality policy, and PCAN canary |
| [Router ABI](https://developers.programmable.family/abis/ethereum/programmable-launch-stamp-router-v1.json) | Decode Router events and point-lookup results |
| [Launch stamp specification](docs/reference/launch-stamp.md) | Implement backfill, live follow, reorg handling, and direct verification |
| [Terminal guide](docs/guides/terminals-and-scanners.md) | Map verified launches to terminal labels and supported market features |
| [Onchain verification](docs/reference/onchain-verification.md) | Reproduce provenance without trusting the hosted launch feed |
| [Protocol fee claim discovery](docs/reference/protocol-fee-claims.md) | Understand the operator claim inventory, refresh behavior, wallet boundary, and fail-closed Custom admission rules |
| [Integration checklist](docs/integration-checklist.md) | Test failure states before production ingestion |
| [Custom Launch API guide](https://programmable.market/developers/custom-launch-api-v1.md) | Inspect the separate authenticated V1 read/status contract and its read-only POST state |
| [Custom Launch API OpenAPI](https://programmable.market/openapi/custom-launch-v1.json) | Generate a client from the canonical V1 contract without treating POST as available |
| [Held Custom Launch V2 OpenAPI](https://programmable.market/openapi/custom-launch-v2.json) | Inspect the pinned V2 machine contract without treating the held `503` route as public |
| [Custom Fee-Enforced Launch Profile V2](docs/guides/custom-fee-enforced-launch-profile-v2.md) | Read the exact RC fee semantics, evidence gates and unavailable status |
| [Programmable Launch Policy](https://github.com/0xprogrammable/Launch-Policy) | Resolve the current versioned requirements without relying on copied policy text |

The manifest is the deployment authority. Do not copy an address, topic, start block, or runtime hash from token metadata or a third-party API.

## Router-first integration

`ProgrammableLaunchStampRouterV1` is the trust root for Router-stamped Programmable Classic and Programmable Custom launches on Ethereum. Detection requires the official manifest, an Ethereum RPC endpoint, and the canonical Router.

1. Fetch the live manifest and require a complete `launchStampRouter` entry for the selected chain.
2. Verify the Router runtime and hosted ABI hashes before decoding data.
3. Backfill the exact manifest-listed events from `startBlock`, then follow new blocks with the published finality and reorg policy.
4. Extract `launchId`, token, hook, `PoolManager`, and `poolId` from the Router event.
5. At one canonical block, cross-check `launchIdByToken` or `launchIdByPool`, then read `launchStamp` and `stampProof`.
6. Assign a public label only after every required identity and proof agrees.

```js
const manifestUrl = "https://developers.programmable.family/api/v2/manifest"
const manifest = await fetch(manifestUrl).then(requireOk).then((response) => response.json())
const router = manifest.launchStampRouter

if (manifest.chainId !== 1 || router?.status !== "live") {
  throw new Error("Programmable Router is not live for this chain")
}

function requireOk(response) {
  if (!response.ok) throw new Error(`Programmable manifest returned ${response.status}`)
  return response
}
```

Production consumers must also validate the manifest-published runtime hash, ABI SHA-256, event descriptors, getter selectors, immutable bindings, and canonical block policy. The [launch stamp specification](docs/reference/launch-stamp.md) contains the complete algorithm and copy-paste verifier examples.

## Public labels

| Router value | Public label | Scope |
| --- | --- | --- |
| `LaunchKindV1.CustomGraph` (`1`) | `Programmable Custom` | Custom launches stamped by the canonical Router |
| `LaunchKindV1.Classic` (`2`) | `Programmable Classic` | Classic launches stamped by the canonical Router |
| Unknown, zero, or inconsistent | No Programmable label | Preserve independently known asset data and report provenance as unavailable or indeterminate |

The Classic hook is shared infrastructure and cannot identify one launch. Use token or `PoolManager + poolId` as the interoperable lookup path. Use component lookup only as corroborating evidence for an exclusive component.

## Finalized PCAN vector

Use the finalized PCAN canary to smoke-test a terminal implementation:

| Field | Value |
| --- | --- |
| Transaction | [`0xc07b4e70…378b612`](https://etherscan.io/tx/0xc07b4e70233534a1d4f435ffc9a636ed5f542f4aedcde35052c58224f378b612) |
| Token | [`0x9DEeB39D…cc8f7cE`](https://etherscan.io/token/0x9DEeB39D2590b0cAD5fc473F755C5F97Dcc8f7cE) |
| Pool ID | `0x5c5a3ebee6840640642ba2bea526621a4962d2c89c388c36a2edb4725802a229` |
| Launch ID | `0x5a52180427785716bff0a36218dde89f0459db265d0c2bdfcfde81a8fe733c92` |
| Launch kind | `CustomGraph` (`1`) |

The manifest publishes the complete vector at JSON Pointer `/launchStampRouter/canaryEvidence`. The [PCAN reference](docs/reference/launch-stamp.md#finalized-pcan-test-vector) includes the stamp hash, component proofs, block evidence, and exact guarantee boundary.

## Guarantee boundary

A valid stamp establishes that the exact canonical Router atomically executed and stamped the recorded launch. It also establishes that the recorded v4 pool was uninitialized before route execution and initialized before the stamp was written.

It does not establish current liquidity, safety, audit status, sellability, tradability, terminal support, or economic outcome. Historical launches are not backfilled. Direct calls to a Factory outside the Router do not create Router provenance. Publication of this contract does not mean a named terminal has integrated the label.

## Unauthenticated read API

The hosted read API is an optional normalized model for existing Classic, Registry Custom, and finalized canonical-Router records. Router identities follow a bounded current source whose canonical commitment is recomputed before publication, with a separate digest-pinned last-known-good snapshot for outages. The feed reports degraded quality while only the fallback is available; absence is not authoritative in that state. Missing supply, fee, or market state remains unavailable rather than inferred. The hosted API is not a Router verification dependency.

```bash
curl -fsSL https://developers.programmable.family/.well-known/programmable.json
curl -fsSL https://developers.programmable.family/api/v2/status
curl -fsSL https://developers.programmable.family/api/v2/manifest
curl -fsSL https://developers.programmable.family/api/v2/launches
curl -fsSL https://developers.programmable.family/api/v2/token-list
```

No SDK or API key is required. The v2 API is read-only and never authorizes a transaction. Follow discovery URLs, finish every cursor traversal, deduplicate by `launchId`, preserve unknown launch shapes, and never infer chart, quote, simulation, or execution support from provenance alone. See the [API quickstart](docs/quickstart.md) and [HTTP reference](docs/reference/http-api.md). The separate authenticated [Custom Launch API V1](https://programmable.market/developers/custom-launch-api-v1.md) currently exposes live provenance reads/status but no write path.

Fee data is market-path evidence, not a category default. Current verified Classic paths and future fee-enforced Custom paths have different charge modes. The canary-stage Custom V2 profile specifies an additive 10 basis points, or 0.1%, on the gross unspecified pool-currency amount for each successful swap through the exact bound pool, with recipient `0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`; it is not public. Its sealed vault holds PoolManager ERC-6909 claims that only the fixed reward wallet can claim. Read the [fee reference](docs/reference/fees.md) before displaying a rate or claimable amount.

The separate [operator claim console](https://claimhazard.vercel.app) rescans the exact reviewed Classic, fixed Stock-Paired, and finalized standard Custom Registry V1 sources before requesting one atomic wallet batch. Its [claim discovery reference](docs/reference/protocol-fee-claims.md) documents what is automatically included and what remains fail-closed. It does not expand the read-only Developer API into a transaction API.

## Repository map

```text
docs/           Human-readable guides and reference
abis/           Canonical interfaces for direct verification
openapi/        OpenAPI 3.1 contracts
schemas/        JSON Schemas for public responses
deployments/    Deployment and source evidence
fixtures/       Conformance and failure cases
examples/       Read-only integration examples
tests/          Offline contract and consumer checks
```

## Validate a change

```bash
npm ci
npm run build
npm run check
```

Run the bounded production smoke only when live verification is intentional:

```bash
PROGRAMMABLE_API_BASE=https://developers.programmable.family npm run smoke:live
```

Use [GitHub issues](https://github.com/0xprogrammable/Developers/issues) for public documentation or integration problems. Follow [SECURITY.md](SECURITY.md) for vulnerabilities. Do not post credentials, private source, or user data.

## License

See [LICENSE](LICENSE).
