![Programmable night garden](public/assets/brand/programmable-developers-og.png)

# Programmable developer reference

Read-only contracts and verification rules for detecting Programmable launches.

## Start here

| Resource | Use |
| --- | --- |
| [Live manifest](https://developers.programmable.family/api/v2/manifest) | Resolve the active chain, Router, start block, runtime hash, ABI hash, events, getters, finality policy, and PCAN canary |
| [Router ABI](https://developers.programmable.family/abis/ethereum/programmable-launch-stamp-router-v1.json) | Decode Router events and point-lookup results |
| [Launch stamp specification](docs/reference/launch-stamp.md) | Implement backfill, live follow, reorg handling, and direct verification |
| [Terminal guide](docs/guides/terminals-and-scanners.md) | Map verified launches to terminal labels and supported market features |
| [Onchain verification](docs/reference/onchain-verification.md) | Reproduce provenance without trusting the hosted launch feed |
| [Integration checklist](docs/integration-checklist.md) | Test failure states before production ingestion |

The manifest is the deployment authority. Do not copy an address, topic, start block, or runtime hash from token metadata or a third-party API.

## Router-first integration

`ProgrammableLaunchStampRouterV1` is the trust root for future Programmable Classic and Programmable Custom launches on Ethereum. Detection requires the official manifest, an Ethereum RPC endpoint, and the canonical Router.

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
| `LaunchKindV1.CustomGraph` (`1`) | `Programmable Custom` | Future Custom launches stamped by the canonical Router |
| `LaunchKindV1.Classic` (`2`) | `Programmable Classic` | Future Classic launches stamped by the canonical Router |
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

## Hosted API

The hosted API is an optional normalized read model for existing Classic and Custom records, metadata, markets, and support states. It is not a Router verification dependency.

```bash
curl -fsSL https://developers.programmable.family/.well-known/programmable.json
curl -fsSL https://developers.programmable.family/api/v2/status
curl -fsSL https://developers.programmable.family/api/v2/manifest
curl -fsSL https://developers.programmable.family/api/v2/launches
curl -fsSL https://developers.programmable.family/api/v2/token-list
```

No SDK or API key is required. The v2 API is read-only and never authorizes a transaction. Follow discovery URLs, finish every cursor traversal, deduplicate by `launchId`, preserve unknown launch shapes, and never infer chart, quote, simulation, or execution support from provenance alone. See the [API quickstart](docs/quickstart.md) and [HTTP reference](docs/reference/http-api.md).

Fee data is market-path evidence, not a category default. The Native Programmable policy is 10 basis points, or 0.1%, on supported official market paths, with recipient `0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`. Read the [fee reference](docs/reference/fees.md) before displaying a rate or claimable amount.

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

Use [GitHub issues](https://github.com/0xprogrammable/developers/issues) for public documentation or integration problems. Follow [SECURITY.md](SECURITY.md) for vulnerabilities. Do not post credentials, private source, or user data.

## License

See [LICENSE](LICENSE).
