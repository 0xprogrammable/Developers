![Programmable night garden](public/assets/brand/programmable-developers-readme.png)

# Programmable developer reference

Unauthenticated read and discovery contracts for detecting and verifying Programmable launches. Custom Launch API V1
and V2 historical reads remain available, while authenticated POST is read-only and returns nonretryable
`409 CUSTOM_LAUNCH_V1_READ_ONLY` or `409 CUSTOM_LAUNCH_V2_READ_ONLY`. Only metadata-bound V3 profile `3.3.0`
accepts fresh submissions for exact project token and hook artifacts on Ethereum Mainnet.
Robinhood Chain Mainnet (`eip155:4663`) is now discoverable through a separate
V4 manifest, but its deployment, write API, CLI release and public read model
remain `planned`; no Robinhood launch or live indexing claim is made here.

## Choose the API surface

| Surface | Authentication | Purpose | Canonical contract |
| --- | --- | --- | --- |
| Developer read API at `developers.programmable.family` | None | Discover launches, resolve deployments and verify provenance | [Read API OpenAPI](openapi/programmable-v2.yaml) |
| Custom Launch API V4 for Robinhood Chain | Existing Programmable bearer credential when promoted | Chain-bound `pack`, `validate`, `submit`, `status` contract with separate wallet signing | [Robinhood manifest](https://developers.programmable.family/api/v2/manifests/4663); currently `planned`, with a [byte-pinned V4 OpenAPI mirror](openapi/custom-launch-v4.json) of the expected release contract |
| Custom Launch API V3 at `api.programmable.market` | Wallet key or approved partner root/subkey bearer credential | Pack, validate, submit and track a 3–16-target project-owned token and hook graph; the wallet reviews and signs separately | [V3 profile guide](docs/guides/direct-native-hook-graph-profile-v3.md) and [V3 OpenAPI](https://programmable.market/openapi/custom-launch-v3.json) |
| Custom Launch API V2 compatibility at `api.programmable.market` | Wallet-bound bearer API key | Read historical V2 resources; authenticated POST returns nonretryable `409 CUSTOM_LAUNCH_V2_READ_ONLY` | [V2 OpenAPI](https://programmable.market/openapi/custom-launch-v2.json) |
| Custom Launch API V1 compatibility | Wallet-bound bearer API key | Inspect existing V1 provenance reads and request status; V1 POST is read-only | [V1 compatibility guide](https://programmable.market/developers/custom-launch-api-v1.md) and [V1 OpenAPI](https://programmable.market/openapi/custom-launch-v1.json) |

Create or revoke a wallet-bound key on the [API key management page](https://programmable.market/developers/api-keys).
Approved partners use a root credential or one bounded child level on the same V3 routes and under the same admission
policy. A root with `partner-subkeys:manage` may issue, list, rotate, or revoke its own subkeys; children cannot manage
credentials, exceed root scopes, budgets, or expiry, or create another level. Root history aggregates every attributed
root and subkey launch, while a subkey sees only its stable lineage; rotation preserves that lineage, and issuing a
distinct subkey starts a separate one. A revoked credential cannot authenticate. Store every credential in an encrypted
secret or `PROGRAMMABLE_API_KEY`, never in a prompt or chat. No API credential can sign, broadcast, bypass policy or
supply its own attribution. Wallet keys require the connected controller to match their wallet binding; partner requests
select the controller wallet in the exact request. That controller still reviews, signs, and broadcasts separately.
Partner metadata requirements are identical to wallet-key requirements. Partner roots are provisioned only through the
authenticated Website BFF and the server-configured Privy-user/wallet allowlist; a client cannot self-authorize.
Launch create, resource, and status schemas remain owned by their respective OpenAPI contracts. This read/discovery
repository publishes only the standalone V3 preflight response contract needed for capability discovery. Resolve the
active write entry from `extensions["programmable.custom-launch-api"].currentCreate` in discovery or
`currentCustomLaunchCreate` in status, then read live V3 capabilities, OpenAPI,
the exact `partnerCredentials` contract, and `directNativeHookGraphProfileV3.platformAdmissionPolicy`. An exact versioned
[Programmable Launch Policy](https://github.com/programmablehq/Launch-Policy) commit or release can provide the reviewable
authored source, but its unversioned default branch does not select the live API or decide a request. A CLI, LLM, or
client-side report only prepares or describes bytes and cannot authorize a launch. The API server alone makes the
operational decision from the exact static admission baseline and pinned Router simulation. Current profile `3.3.0`
does not treat configuration as execution evidence: missing, unconfigured, or unavailable runtime behavior evidence
keeps behavior, trading, liquidity, and fee claims unverified but does not itself block wallet handoff. An authenticated
executed negative behavior result blocks handoff with `BEHAVIOR_EVIDENCE_NOT_VERIFIED`. This boundary does not make an
arbitrary hook safe or prove that every hook or market universally enforces or pays a fee. A worker-private permit may
exist solely for the pinned Router simulation. Public `simulating` and `failed` output keeps permit and wallet-transaction
fields null.
For fresh V3.3 requests, the server caps `applicantSelectedHundredthsOfBip` at `100000` for both directions and
accounting modes; the exact Programmable share is separately fixed at `1000`.

## Start here

| Resource | Use |
| --- | --- |
| [Ethereum manifest alias](https://developers.programmable.family/api/v2/manifest) | Preserve the existing chain-1 integration; this is an alias for `/api/v2/manifests/1` |
| [Per-chain manifests](https://developers.programmable.family/api/v2/manifests/1) | Bind deployment and feed discovery to the selected `chainId`; chain 4663 is published separately and remains planned |
| [Chain-neutral Router ABI](https://developers.programmable.family/abis/programmable-launch-stamp-router-v1.json) | Decode the published Router interface without implying that one chain's deployment address applies to another |
| [Launch stamp specification](docs/reference/launch-stamp.md) | Implement backfill, live follow, reorg handling, and direct verification |
| [Terminal guide](docs/guides/terminals-and-scanners.md) | Map verified launches to terminal labels and supported market features |
| [Onchain verification](docs/reference/onchain-verification.md) | Reproduce provenance without trusting the hosted launch feed |
| [Protocol fee claim discovery](docs/reference/protocol-fee-claims.md) | Understand the operator claim inventory, refresh behavior, wallet boundary, and fail-closed Custom admission rules |
| [Integration checklist](docs/integration-checklist.md) | Test failure states before production ingestion |
| [Custom Launch API guide](https://programmable.market/docs/developers/custom-launch) | Prepare and track a fresh V3.3 launch while keeping server authorization and wallet signing separate |
| [Custom Launch V3 OpenAPI](https://programmable.market/openapi/custom-launch-v3.json) | Generate a client for the general project-owned token and hook graph route |
| [Custom Launch V4 OpenAPI mirror](openapi/custom-launch-v4.json) | Generate against the planned chain-4663 API without treating the mirrored contract as deployment, availability, or write authority |
| [Custom Launch V4 pack-config schema](schemas/custom-launch/v4/pack-config.json) | Validate the planned CLI input contract; the wallet still reviews, signs, and broadcasts separately |
| [Custom Launch V2 OpenAPI](https://programmable.market/openapi/custom-launch-v2.json) | Preserve historical V2 reads and the authenticated read-only POST boundary |
| [Custom Launch V1 compatibility](https://programmable.market/openapi/custom-launch-v1.json) | Preserve existing V1 reads/status and the V1 read-only POST boundary |
| [Custom Fee-Enforced Launch Profile V2](docs/guides/custom-fee-enforced-launch-profile-v2.md) | Interpret the retained historical profile, its exact fee semantics, and its read-only write boundary |
| [Direct Native Hook Graph Profile V1](docs/guides/direct-native-hook-graph-profile-v1.md) | Inspect the gated V3 preview contract for a direct project hook, a 3–16-target profile over the Router's 2–16 and GraphFactory's 1–16 limits, constrained v4 permissions, two-stage funding and an inclusive 10-bps platform split |
| [Direct Native Hook Graph Profile V3](docs/guides/direct-native-hook-graph-profile-v3.md) | Integrate the active general V3 lane for exact project graphs, deterministic static admission, mandatory Router simulation, and explicit non-guarantees |
| [Direct Native Hook Graph Profile V2](docs/guides/direct-native-hook-graph-profile-v2.md) | Read retained Revision 2 resources and preserve exact-byte retry compatibility without creating a fresh V2 request |
| [Programmable Launch Policy](https://github.com/programmablehq/Launch-Policy) | Resolve the current versioned requirements without relying on copied policy text |

The manifest is the deployment authority. Do not copy an address, topic, start block, or runtime hash from token metadata or a third-party API.

## Router-first integration

`ProgrammableLaunchStampRouterV1` is the trust root for Router-stamped Programmable Classic and Programmable Custom launches only on chains whose exact manifest marks that Router `live`. Ethereum is live. Robinhood is planned and publishes null Programmable deployment fields, so consumers must not scan or classify Robinhood launches yet.

1. Fetch the live manifest and require a complete `launchStampRouter` entry for the selected chain.
2. Verify the Router runtime and hosted ABI hashes before decoding data.
3. Backfill the exact manifest-listed events from `startBlock`, then follow new blocks with the published finality and reorg policy.
4. Extract `launchId`, token, hook, `PoolManager`, and `poolId` from the Router event.
5. At one canonical block, cross-check `launchIdByToken` or `launchIdByPool`, then read `launchStamp` and `stampProof`.
6. Assign a public label only after every required identity and proof agrees.

```js
const chainId = 1
const manifestUrl = `https://developers.programmable.family/api/v2/manifests/${chainId}`
const manifest = await fetch(manifestUrl).then(requireOk).then((response) => response.json())
const router = manifest.launchStampRouter

if (manifest.chainId !== chainId || manifest.caip2 !== `eip155:${chainId}` || router?.status !== "live") {
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

## Finalized Router vectors

Use the Finalized PCAN vector to smoke-test a terminal implementation:

| Field | Value |
| --- | --- |
| Transaction | [`0xc07b4e70…378b612`](https://etherscan.io/tx/0xc07b4e70233534a1d4f435ffc9a636ed5f542f4aedcde35052c58224f378b612) |
| Token | [`0x9DEeB39D…cc8f7cE`](https://etherscan.io/token/0x9DEeB39D2590b0cAD5fc473F755C5F97Dcc8f7cE) |
| Pool ID | `0x5c5a3ebee6840640642ba2bea526621a4962d2c89c388c36a2edb4725802a229` |
| Launch ID | `0x5a52180427785716bff0a36218dde89f0459db265d0c2bdfcfde81a8fe733c92` |
| Launch kind | `CustomGraph` (`1`) |

The manifest publishes this complete Custom vector at JSON Pointer `/launchStampRouter/canaryEvidence` and the separate finalized Classic V4 vector at `/launchStampRouter/classicCanaryEvidence`. Together they set `classicOnchainCanary` and `customGraphOnchainCanary` to `true`. The [Router reference](docs/reference/launch-stamp.md#finalized-pcan-test-vector) defines both evidence boundaries; neither vector creates a third public category.

## Guarantee boundary

A valid stamp establishes that the exact canonical Router atomically executed and stamped the recorded launch. It also establishes that the recorded v4 pool was uninitialized before route execution and initialized before the stamp was written.

It does not establish current liquidity, safety, audit status, sellability, tradability, terminal support, or economic outcome. Historical launches are not backfilled. Direct calls to a Factory outside the Router do not create Router provenance. Publication of this contract does not mean a named terminal has integrated the label.

## Unauthenticated read API

The hosted read API is an optional normalized model for active Classic V3/V4, Registry Custom, and finalized canonical-Router records. Its Classic baseline is the canonical paginated `https://programmable.market/api/explore` catalog, accepted through its schema, scope, evidence and identity commitments; it currently reports Envio deployment `production-6157d22`. Legitimate indexer release updates therefore do not require a Developer API code change. The retired legacy source that returned HTTP `410` is not used. Classic V1/V2 remain inactive manifest history, and Stock is excluded from active v2 discovery. Router identities follow a bounded current source whose canonical commitment is recomputed before publication, with a separate digest-pinned last-known-good snapshot for outages. V4 chain feeds additionally require complete `programmable.custom-launch-list.v4` pagination, `ready` backend quality, exact manifest deployment/profile/finality bindings, and terminal `ethereum_finalized` Router evidence. Last-known-good snapshots are keyed by chain and exact deployment binding. The feed reports degraded quality while only the fallback is available; absence is not authoritative in that state. Missing supply, fee, or market state remains unavailable rather than inferred. The hosted API is not a Router verification dependency.

Generic integrations should refresh the manifest and scan every enabled release instead of pinning launcher addresses. That existing flow discovers Classic V4 without a client code or address-list change; `launchStampRouter` remains provenance and transport, not a public category.

```bash
curl -fsSL https://developers.programmable.family/.well-known/programmable.json
curl -fsSL https://developers.programmable.family/api/v2/status
curl -fsSL https://developers.programmable.family/api/v2/manifest
curl -fsSL https://developers.programmable.family/api/v2/manifests/4663
curl -fsSL https://developers.programmable.family/api/v2/launches
curl -fsSL 'https://developers.programmable.family/api/v2/launches?chainId=4663'
curl -fsSL https://developers.programmable.family/api/v2/token-list
```

No SDK or API key is required for this Developer read API. The Developer v2 API is read-only and never authorizes a transaction. Follow discovery URLs, finish every cursor traversal, deduplicate by `launchId`, preserve unknown launch shapes, and never infer chart, quote, simulation, or execution support from provenance alone. See the [API quickstart](docs/quickstart.md) and [HTTP reference](docs/reference/http-api.md). The separate authenticated Custom Launch API retains V1 and V2 historical reads while rejecting their POST writes with nonretryable HTTP 409. Only V3 profile `3.3.0` accepts fresh submissions.

For an existing Custom project, resolve `directNativeHookGraphProfileV3.api.agentIntegration` from the manifest. It links the canonical [agent remediation catalog](https://programmable.market/policies/custom-launch-agent-remediation-v1.json), pack-config schema, and existing-project guide. A returned `action_required` status means the exact source or configuration must be repaired, repacked, validated, and resubmitted through the API; it is not a manual allowlist or legacy GitHub submission path. New EIP-3009 integrations use `programmable.eip3009-authorization-patch.v2`, whose static ABI paths identify the nonce, `r`, `s`, and `v` leaves without applicant-supplied byte offsets. Exact v1 retries remain compatible.

Before creating a V3 launch, read public `GET https://api.programmable.market/v3/capabilities`, then use authenticated quota-free `POST /v3/custom-launches/preflight`. Only metadata-bound profile `3.3.0` accepts fresh submissions. Exact `3.2.0`, `3.1.0`, `3.0.0`, and `2.0.0` bytes remain readable and may be retried byte-for-byte only; they cannot be repacked or admitted as fresh submissions. The [`programmable.custom-launch-preflight.v1`](schemas/v2/custom-launch-preflight-v1.schema.json) response keeps hard blocks, missing evidence, and warnings separate; exposes platform-authored behavior evidence and all six product truth axes; consumes no launch quota, allocates no nonce, persists nothing, and never signs or broadcasts. `deployable`, `routable`, and `featured` are independent preflight eligibility fields, not proof of deployment, trading, fee behavior, source verification, indexing, or featured placement. Only the API server may authorize the exact request after the static admission baseline and pinned Router simulation; current missing or unavailable behavior evidence remains an explicit unverified claim state, while an authenticated executed negative blocks wallet handoff. Authenticated resources can expose a bounded [`lifecycleQueue`](schemas/v2/custom-launch-lifecycle-queue-v3.schema.json) projection for single-resource polling; queue state is not launch finality and is not a Developer feed field.

The durable resource vocabulary is `received`, `validating`, `pending_review`,
`action_required`, `prepared`, `simulating`,
`awaiting_funding_authorization`, `funding_authorization_verified`,
`authorized`, `submitted`, `finalized`, `failed`, and `cancelled`.
`action_required` means repair, repack, and submit new exact bytes;
`authorized` still requires separate wallet review and signature; `submitted`
is not finality. Only `finalized`, `failed`, and `cancelled` are terminal.

Every new `3.3.0` pack declares `projectMetadata` with token `name` and
`symbol`, a meaningful presentation description, an exact non-null image object
with its byte digest and media facts, and canonical HTTPS website and X links.
The CLI derives `projectMetadataHash`, preserves the
raw graph digest as `unboundGraphBundleHash`, and returns a metadata-bound
`graphBundleHash`; the prepared resource, `launchId`, and wallet-reviewed
Router transaction keep that declaration bound. This is reviewed creator
metadata, not verified onchain token metadata: finalized name and symbol still
require the declared `postDeploymentReadback`. Images and links remain
untrusted display data and never authorize calldata, a transaction, or an
external account action.

Every V3 resource also carries immutable `launchProfileVersion`. Its required
`projectMetadata` and `projectMetadataHash` keys are non-null for metadata-bound
`3.2.0`, `3.3.0`, and prepared `3.4.0`; both are null on retained `2.0.0`,
`3.0.0`, and `3.1.0` resources. Profile `3.2.0` retains its legacy metadata
contract, including a nullable image, while `3.3.0` and `3.4.0` use the stricter
complete metadata policy above. Profile `3.4.0` is not a fresh-write profile.
The canonical resource condition remains in the public V3 OpenAPI rather than
being redefined by this read/discovery repository.

Unauthenticated
`GET https://api.programmable.market/v3/finalized-custom-launches` exposes the
cursor-paginated `finalized-v3-project-metadata-ledger` snapshot for indexers
and presentation clients. It includes finalized metadata-bearing V3 rows under
their original contracts, including retained `3.2.0` and current `3.3.0` rows,
plus immutable `launchProfileVersion`, exact Router identity, bound hashes,
declared metadata, token readback state, and finality evidence; it excludes
pending requests, metadata-absent historical resources, controller addresses,
credentials, and request bytes. Every page has required `schemaVersion`,
`generatedAt`, `launches`, `nextCursor`, and `quality` fields. `quality.status`
is `complete` when every source row was published and `partial` when invalid
finalized rows were quarantined; its counts and row-indexed diagnostics make
that boundary explicit. Complete every page and keep Router evidence
authoritative. A declared
presentation is not a safety, tradeability, or onchain token-identity claim.
Current submissions require name, symbol, description, an image with immutable
byte facts, one website, and one canonical X profile; historical finalized
records with older missing presentation fields remain visible. Partner calls
may add immutable server-derived `partnerAttribution`, projected by the
Developer launch schema as `launchedVia`. Neither callers nor creator metadata
can choose that attribution, and it is not an economic partner, provider,
safety, liquidity, or external-indexing claim.

An exact-identity platform-curated legacy presentation may fill historical
image or link gaps without rewriting the signed project metadata. Its
namespaced extension keeps the overlay, identity, runtime evidence, and image
digest separate from creator-declared metadata.

Fee data is market-path evidence, not a category default. Current verified Classic paths and the public fee-enforced Custom profiles have different charge modes. The Custom V2 profile specifies an additive 10 basis points, or 0.1%, on the gross unspecified pool-currency amount for each successful swap through the exact bound pool, with recipient `0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`. Its sealed vault holds PoolManager ERC-6909 claims that only the fixed reward wallet can claim. Direct Native Hook Graph V2 supports an exact per-launch additive or inclusive 10-bps platform share and requires a conformance receipt before authorization. The retained V1 preview reserves 10 bps inside the selected total hook fee but remains gated and is not fee-accrual evidence. Generic fee claiming and buybacks are not live. Read the [fee reference](docs/reference/fees.md) before displaying a rate or claimable amount.

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

Use [GitHub issues](https://github.com/programmablehq/Developers/issues) for public documentation or integration problems. Follow [SECURITY.md](SECURITY.md) for vulnerabilities. Do not post credentials, private source, or user data.

## License

See [LICENSE](LICENSE).
