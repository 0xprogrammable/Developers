# Direct Native Hook Graph Profile V3

The Direct Native Hook Graph V3 descriptor is the active general lane for the
public Custom Launch API V3 on Ethereum Mainnet. Its identity is:

| Field | Value |
| --- | --- |
| Profile ID | `programmable.direct-native-hook-graph.v1` |
| Profile revision | `3` |
| Profile version | `3.3.0` |
| Profile schema | `programmable.direct-native-hook-graph-profile.v3` |
| Selection binding | `programmable.direct-native-hook-graph-profile-selection-binding.v3` |
| Public category | `custom` |

Resolve `directNativeHookGraphProfileV3` from `GET /api/v2/manifest` or
`GET /api/v2/status`. The Developer API remains read-only. Create and status
requests use the separately hosted authenticated API at
`https://api.programmable.market` and its versioned
[`custom-launch-v3.json`](https://programmable.market/openapi/custom-launch-v3.json)
contract. Use `api.openApiUrl` as the canonical absolute contract locator. The retained
`api.openApiPath` is compatibility data and must not be resolved against the
separate API `baseUrl`.

Revision 3 is additive. Only metadata-bound `3.3.0` accepts fresh admission.
Exact `3.2.0`, `3.1.0`, `3.0.0`, and `2.0.0` request bytes stay readable and
may be retried byte-for-byte under their original compatibility contracts; they
cannot be repacked or used for fresh admission. The only public categories
remain `classic` and `custom`. Legacy Registry and
GitHub submission intake are closed; neither is a fallback launch route.

## Self-serve capabilities and preflight

Use the separately hosted V3 API to discover support before creating a launch:

| Surface | Authentication | Effect |
| --- | --- | --- |
| `GET /v3/capabilities` | None | Publishes the current structural V3 support envelope |
| `POST /v3/custom-launches/preflight` | Wallet-bound API key | Classifies one exact request without consuming launch quota, allocating a nonce, or persisting a launch |

The preflight response uses
[`programmable.custom-launch-preflight.v1`](../../schemas/v2/custom-launch-preflight-v1.schema.json).
Its `disposition` is exactly `supported`, `supported_with_warnings`,
`needs_evidence`, or `unsupported`. `hardBlockFindingCodes`,
`needsEvidenceFindingCodes`, and `warningFindingCodes` are separate lists;
clients must not collapse them into one pass/fail flag. `staticBaseline` remains
the backend's separately versioned canonical report, while each `remediations`
entry uses the typed `programmable.custom-launch-remediation.v1` contract and
links back to the canonical remediation catalog and guide.

The response repeats the closed side-effect boundary:
`quotaConsumed: false`, `nonceAllocated: false`, `persisted: false`,
`walletSignatureRequiredLater: true`, and
`walletBroadcastByService: false`. The response body binds `requestHash` to the
server's domain-separated canonical JCS digest; the CLI separately retains the
raw request-byte SHA-256 for byte-race and retry-journal integrity. The response
also binds `profileRevision` and `serverTime`; the support request ID is returned in the
`X-Request-Id` response header. Report that header without including the API
key. A throttled or temporarily
unavailable request may return `429` or `503`. Honor `Retry-After` and retry only
the same exact request bytes when the response says the operation is retryable.

`evidenceTier` is one of `launch_mechanics_verified`,
`standard_swap_compatible`, `advanced_custom_accounting`, or
`governed_external_trust`. The tier names the evidence route that applies; it
does not rank projects, certify safety, or replace the returned finding lists.

The response also includes platform-authored `riskClassification`,
`behaviorEvidence`, and `productTruthAxes`. Static classification can make the
deployment axis `eligible`, but preflight keeps routing and featured placement
false. Behavior evidence lists the exact swap, liquidity, callback, fee, and,
when applicable, custom-accounting vectors. A missing runtime executor remains
`not_executed`; a client or agent cannot turn it into `verified`.

### Eligibility is not lifecycle evidence

The three `launchEligibility` booleans answer different preflight questions:

- `deployable` means the request may continue toward later build, admission,
  simulation, and wallet stages. It does not mean a contract is deployed.
- `routable` means the declared shape can use the V3 Router path subject to the
  remaining exact checks. It does not prove a production buy or sell.
- `featured` is a separate presentation decision. It is not implied by
  deployment, routing, verification, finality, or indexing.

Keep the six named product truth axes independent: `deployment`, `trading`,
`platform_fee_evidence`, `source_verification`, `indexing`, and `featured`.
Deployment requires a wallet-sent transaction and finality; trading requires
production route and market evidence; fee behavior requires exact deployed
accrual and routing evidence; source verification requires an exact
source/build/runtime match; indexing requires finalized canonical-Router
ingestion; featured placement remains a separate product decision. A positive
field on one axis establishes none of the others.

## Policy authority and resource lifecycle

Do not treat a local CLI result, copied policy prose, or an API key as the
launch decision. The authority boundary is:

1. the active `directNativeHookGraphProfileV3.platformAdmissionPolicy`
   descriptor publishes the machine-readable static admission contract;
2. an exact versioned Programmable Launch Policy commit or release may publish
   its reviewable authored source, but an unversioned repository branch does
   not select the live API or decide a request;
3. live `GET /v3/capabilities` and the V3 OpenAPI publish the current route and
   transport contract;
4. the CLI prepares and validates exact bytes locally but cannot authorize a
   request;
5. server-side preflight, exact-request admission, and the required pinned
   Router simulation produce the operational decision;
6. only the controller wallet may review, sign, and broadcast; and
7. finalized canonical-Router evidence, not an API status alone, permits feed
   indexing.

The V3 resource status vocabulary is `received`, `validating`,
`pending_review`, `action_required`, `prepared`, `simulating`,
`awaiting_funding_authorization`, `funding_authorization_verified`,
`authorized`, `submitted`, `finalized`, `failed`, and `cancelled`. This list is
the canonical vocabulary, not permission to invent transitions; follow the
returned resource and its V3 OpenAPI contract. `action_required` means repair
the exact request, repack, and submit new exact bytes. It is not manual
approval. `authorized` means an exact wallet handoff is available; it does not
mean signed, broadcast, or deployed. `submitted` is not finality. `finalized`,
`failed`, and `cancelled` are terminal.

The optional `lifecycleQueue.state` is worker progress, not the launch
resource `status`. Queue completion never upgrades a request to `authorized`,
`submitted`, or `finalized`.

## General graph lane

The project supplies its exact token, hook, initializer, and support-contract
artifacts in one atomic acyclic graph of 3–16 direct targets. Every valid
Uniswap v4 hook permission mask from `0` through `16383` is representable when
its callback dependencies, declared permissions, compiled permissions, and
mined hook-address bits agree.

That structural envelope includes project-owned token and hook artifacts, all
14 Uniswap v4 permissions, ERC-20 or native quote currency, and the existing
funding modes `none`, `wallet-transaction-value`, and
`eip-3009-receive-with-authorization`. The existing liquidity models remain
`external-concentrated-liquidity`, `launch-seeded-concentrated-liquidity`, and
`hook-inventory-custom-accounting`. Structural representation is not universal
compatibility: permission dependencies, currency ordering, settlement,
inventory, liquidity, fee, admission, and simulation checks still apply to the
exact request.

The request must bind the complete deterministic artifact closure, including:

- exact source bytes and Solidity Standard JSON;
- exact compiler version, settings, libraries, and outputs;
- constructor and initializer arguments;
- target manifest, graph links, values, and CREATE2 address locators; and
- creation and runtime identities for every target.

Profile `3.3.0` also requires a closed `projectMetadata` declaration. A fresh
pack supplies token name and symbol, a meaningful description, a non-null image
with its digest and media facts, plus canonical HTTPS website and X links:

```json
{
  "projectMetadata": {
    "schemaVersion": "programmable.project-metadata.v1",
    "token": {
      "name": "Example Token",
      "symbol": "EXAMPLE"
    },
    "presentation": {
      "schemaVersion": "programmable.launch-presentation-draft.v1",
      "description": "A specific description of the project and what it does.",
      "image": {
        "uri": "https://example.com/image.png",
        "contentSha256": "sha256:<64 lowercase hex>",
        "mediaType": "image/png",
        "byteLength": 12345,
        "width": 1200,
        "height": 1200
      },
      "links": [
        { "kind": "website", "uri": "https://example.com/" },
        { "kind": "x", "uri": "https://x.com/example" }
      ]
    }
  }
}
```

A non-null image declares exact `uri`, `contentSha256`, `mediaType`,
`byteLength`, `width`, and `height` values. Each link is exactly `{kind, uri}`.
Token names are limited to 64 UTF-8 bytes and symbols to 16 UTF-8 bytes. Image
URIs are canonical public HTTPS URLs without a query or fragment, canonical
`ipfs:` CIDs, or canonical `ar:` transaction URIs. Link URIs are canonical
public HTTPS URLs.
Allowed kinds are `website`, `documentation`, `x`, `telegram`, `discord`,
`github`, and `other`; at most 32 links are accepted. Link items are unique and
UTF-8 sorted by `kind + NUL + uri`. A URL alone does not bind image bytes: the
content digest, media type, byte length, and dimensions remain part of the
declaration.

The CLI derives `projectMetadataHash` with the
`programmable.project-metadata.v1` domain. It keeps the raw graph hash as
`unboundGraphBundleHash`, then derives the request `graphBundleHash` with the
`programmable.custom-graph-project-metadata.v1` domain over canonical JCS
`{graphBundleHash: <raw>, projectMetadataHash}`. The resulting graph hash,
request hash, prepared resource, onchain `launchId`, and wallet-reviewed Router
transaction therefore refer to the same declared metadata. Changing a name,
symbol, description, image, or link requires a new pack and changes the bound
launch identity.

The derived `tokenMetadataBinding` uses
`programmable.project-token-metadata-binding.v1`. It states whether `name` and
`symbol` are deterministically extractable from a constructor or initializer
argument, including the argument index and name, or marks the field
`not-deterministically-extractable`. Its `declarationBinding` is
`request-and-launch-id` and `postDeploymentReadback` is always `required`.
Hash binding proves what the controller reviewed; it is not proof that a
deployed token returns those values until the finalized onchain readback
succeeds.

Every V3 resource carries required immutable `launchProfileVersion` with exact
value `2.0.0`, `3.0.0`, `3.1.0`, `3.2.0`, or `3.3.0`. Its `projectMetadata` and
`projectMetadataHash` keys are always present: both are non-null for
metadata-bound `3.2.0` and `3.3.0`, and both are null for legacy `2.0.0`,
`3.0.0`, and `3.1.0` resources. Profile `3.2.0` keeps its legacy nullable-image
metadata contract; fresh `3.3.0` packs use the stricter complete policy.
The metadata-bound `3.2.0` and `3.3.0` prepared artifacts carry
`projectMetadata`, `projectMetadataHash`, and `unboundGraphBundleHash`;
pre-`3.2.0` legacy prepared artifacts omit those three exact fields. A prepared
artifact does not carry a separate
`launchProfileVersion`; read it from the immutable resource.

Exact legacy request bytes remain readable and retryable only when resubmitted
byte-for-byte under their original compatibility contracts. New `3.3.0` packs must
not omit metadata or rely on a later editable metadata submission.

### Finalized metadata snapshot

Indexers and presentation clients can read the separate unauthenticated,
finalized-only snapshot:

```sh
curl --fail --get \
  --data-urlencode 'limit=10' \
  https://api.programmable.market/v3/finalized-custom-launches
```

`limit` is `1` through `25` and defaults to `10`; `cursor` is an opaque value
returned by the previous page. Each parameter may appear at most once. Invalid
pagination returns `400 INVALID_PAGINATION`; temporary source unavailability
returns `503 CUSTOM_LAUNCH_V3_UNAVAILABLE`. A successful response uses
`programmable.finalized-custom-launch-metadata-list.v1`, orders items by
`createdAt` descending and then `resourceId` descending, and returns
`nextCursor` or `null`. Follow every cursor to complete that bounded snapshot.

Each `programmable.finalized-custom-launch-metadata.v1` item includes:

- `routerLaunchId`, chain, Router, token, hook, PoolManager, and pool ID;
- exact `projectMetadata` and `projectMetadataHash`;
- request, launch-intent, bound graph, raw graph, and artifact hashes;
- declared-versus-observed token name and symbol with `matching`, `mismatch`,
  or `unavailable` readback status; and
- finalized transaction, block, log, confirmation-depth, and persisted
  finalized-checkpoint evidence.

The endpoint emits only finalized profile `3.3.0` rows with a complete metadata
ledger. It never emits pending or legacy requests, controller addresses, API
keys, or request bytes. `resourceId` is a pagination/resource coordinate, not
Router identity. Join and key records by the finalized `routerLaunchId` and
matching Router event token, hook, and pool evidence. Router evidence remains
authoritative if creator presentation is absent, unavailable, or unsuitable
for display.

The response cache policy is `public, max-age=15, stale-while-revalidate=300`.
The source API returns no last-known-good snapshot on a source failure. A
consumer that keeps a bounded last-known-good view must label its source and
age explicitly and must never use absence from a degraded page as evidence
that a finalized Router launch does not exist.

This is a general project-hook lane, not a universal approval for a hook name,
repository, source revision, or future build. Each exact launch request has its
own admission and Router simulation.

## Deterministic admission baseline

Revision 3 replaces the Revision 2 fee-proof admission step with
`platformAdmissionPolicy`. Its core decision fields are shown below; resolve
the complete role-aware blocking rules from the machine descriptor:

```json
{
  "schemaVersion": "programmable.direct-native-platform-admission-policy.v1",
  "mode": "deterministic-exact-source-graph-static-baseline-v1",
  "receiptSchemaVersion": "programmable.platform-admission-receipt.v1",
  "engineId": "programmable.direct-native-static-admission",
  "engineVersion": "1.0.0",
  "exactSourceCompilerGraphBindingRequired": true,
  "staticBaselineGateVersion": "1.0.0",
  "noBlockingFindingDisposition": "router-simulation-eligible",
  "blockingFindingDisposition": "action-required",
  "routerSimulationRequiredBeforeAuthorization": true,
  "receiptAuthority": "platform-only",
  "assurance": "launch-admission-only",
  "safetyClaim": false,
  "feeBehaviorClaim": false
}
```

Profile `3.3.0` retains exactly seven objective static hard blocks:

- runtime `CALLCODE`, runtime `SELFDESTRUCT`, or an exact source
  self-destruct surface on any target;
- a definitively missing or invalid PoolManager callback guard;
- a literal callback guard bound to the wrong PoolManager; or
- an enabled hook permission whose callback implementation is missing.

Proxy or upgrade surfaces, `DELEGATECALL`, mint, tax, pause, blocklist,
transfer-control, external-dependency, liquidity-custody, transfer-fee,
runtime-child-contract, incomplete-analysis, and review-required callback
findings are not categorical `3.3.0` deployment blocks. They remain visible in
`needsEvidenceFindingCodes` and select the applicable evidence tier. Return
delta permissions and `hook-inventory-custom-accounting` require the advanced
behavior vector set covering delta solvency, backing, refunds, and withdrawal.
This evidence-only treatment is not approval: unresolved evidence keeps
trading, platform-fee conformance, and feature placement unverified.

The full report hash and every finding remain bound to the admission evidence.
There are no project-specific exceptions. A project does not receive a clean
or safe label merely because the seven hard-block codes are absent.

`no_blocking_static_finding` produces only the verdict
`admitted_to_router_simulation`. It does not authorize a transaction. The
platform must then execute the exact prepared Router launch transaction as a
pinned Ethereum `eth_call`. Authorization requires that exact simulation to
succeed. A different request, graph, compiler output, Router transaction, or
wallet value requires new evidence.

## What admission does not prove

The Revision 3 receipt is launch-admission evidence only. It is not a security audit.
It provides no liquidity or tradeability guarantee. It is also not:

- a claim that the contracts are safe;
- a honeypot-free guarantee;
- proof that a token can be bought or sold in production;
- proof of liquidity, backing, solvency, vesting, or a liquidity lock;
- proof of the actual fee behavior of the deployed hook; or
- proof of launch finality, source verification, or market support.

Router simulation is one deterministic preflight against one exact state and
transaction. It is not production-outcome evidence and cannot predict later
admin actions, market conditions, third-party liquidity, or integrations.

## Platform fee accounting

Each Revision 3 request selects and binds one of two platform-fee accounting
modes. `additive-platform-share` adds the Programmable `1,000 / 1,000,000`
share to the project-selected fee. `inclusive-selected-total` treats the
selected total as inclusive and reserves the same Programmable share inside
that total. Integrators must read the selected mode, assessment base, fee
currency, rounding, and claim mode from the exact request; they must not infer
added-on-top behavior from the `custom` category.

The machine descriptor publishes both allowed accounting modes, the 10 bps
Programmable share, assessment pairs, and claim modes. The older top-level
`customPublicSubmissions.chargeMode: added-on-top` field is scoped only to the
legacy Fee-Enforced Isolated After-Swap profile. It does not describe Revision
3. The admission receipt deliberately declares `feeBehaviorClaim: false`, so
separate onchain evidence is still required for actual accrual or payment.

Pool initialization creates no concentrated liquidity, and trading volume does
not create a Uniswap LP position. A normal pool needs a project or third-party
position. A zero-classical-LP custom-accounting design is possible only when
the exact hook graph supplies and settles its own inventory or backing. The
platform does not infer that behavior from admission or finality.

Any required Programmable fee selection remains a separate, exact request and
graph binding. `feeBehaviorClaim: false` means the admission receipt does not
certify that production trades accrue, route, or pay that fee. Fee accrual and
claimability require their own onchain evidence. Generic fee claiming for
arbitrary hooks and generic buyback management are not live.

## API credential and wallet boundary

Existing wallet-bound keys remain compatible. Approved partner roots and their
bounded one-level subkeys authenticate the same V3 capabilities, preflight,
create, list, and single-resource routes and receive the same admission policy,
requirements, and Router simulation. Store any credential only in
`PROGRAMMABLE_API_KEY` or an encrypted secret store. Never paste it into a
prompt, chat, source file, config file, screenshot, or command argument.

A partner root holding `partner-subkeys:manage` may list, issue, rotate, and
revoke only its own children. A child cannot manage credentials or delegate a
second level. Child scopes and budgets cannot exceed the root, and child expiry
cannot exceed root expiry. A new or rotated secret is delivered only in that
issue or rotation response. Partner attribution is derived by the server from
the authenticated principal, fixed for the finalized launch, and cannot be
caller-supplied. It is not a verification, safety, approval, or fee claim.

No API credential, CLI, or agent can waive security or approval checks, sign,
or broadcast. At `authorized`, the
controller wallet separately verifies the chain ID, sender, exact production
Router, value, selector, and calldata before it signs and broadcasts. Only
finalized, consistent canonical-Router evidence may create a Custom feed
identity. Token-list publication additionally requires a recognized token
identity.

The authorized resource supplies a wallet-handoff URL with an explicit expiry.
Treat both as response data for that exact request: reject an expired handoff,
do not convert it into a reusable credential, and keep the API key out of the
wallet context. Opening the handoff does not authorize a transaction; the
controller wallet still reviews and signs, and the service never broadcasts on
its behalf.

Authenticated single-resource responses can include `lifecycleQueue` using
[`programmable.custom-launch-lifecycle-queue.v3`](../../schemas/v2/custom-launch-lifecycle-queue-v3.schema.json).
Its state, generation, bounded retry delay, expiry, and stable error code are
operational polling metadata only. Poll the returned single-resource `GET`
path. Queue completion is not onchain finality, and a queue retry does not
change launch status by itself. This field belongs to the authenticated launch
resource; it is not added to the Developer launch or token-list feeds.

## Existing-project agent integration

Agents must resolve `api.agentIntegration` from the active Revision 3
descriptor instead of relying on project-specific instructions. It publishes
the existing-project guide and the canonical machine-readable remediation
catalog:

```json
{
  "remediationCatalogSchemaVersion": "programmable.custom-launch-agent-remediation-catalog.v1",
  "remediationCatalogUrl": "https://programmable.market/policies/custom-launch-agent-remediation-v1.json",
  "existingProjectGuideUrl": "https://programmable.market/docs/developers/custom-launch#existing-project-integration",
  "packConfigSchemaUrl": "https://programmable.market/schemas/custom-launch/v3/pack-config.json",
  "packConfigSchemaSha256": "sha256:40ec776b04f9a4cd4f0fc50b977c2b9954d25205133251bb1c9d2e7a400dc074"
}
```

When a submitted resource has status `action_required`, the agent must read its
stable finding codes and resolve them against that catalog. It must apply the
catalogued source or configuration changes, rebuild the exact artifacts, run
`pack` and `validate` again, and submit a new exact request. `action_required`
is not a manual approval queue, project allowlist, or invitation to use the
closed Registry or GitHub submission intake. An API key authenticates this
self-serve flow but does not waive admission rules or provide wallet authority.
Run quota-free preflight before creating a durable request. Resolve hard blocks,
missing evidence, and warnings by their separate code arrays and typed
remediations; never rewrite a hard block as a warning or treat a warning-free
response as a security claim.

New EIP-3009 launch configs use four static ABI paths:
`nonceArgumentPath`, `rArgumentPath`, `sArgumentPath`, and `vArgumentPath`.
Each path starts at a top-level initializer argument and may descend through
static tuples or fixed-size static arrays. Paths contain 1–16 zero-based
indices in the range 0–255. The CLI derives and validates the four distinct
zero leaves as `bytes32`, `bytes32`, `bytes32`, and `uint8`, then emits
`programmable.eip3009-authorization-patch.v2` with exact fields
`schemaVersion`, `targetId`, `unsignedInitializerCalldataSha256`,
`initializerCalldataLengthBytes`, `authorizationEncoding`, and the four paths.
Its encoding is
`eip3009-nonce-r-s-v-abi-leaves`. Applicant byte offsets are not accepted.
The platform fills the final nonce and wallet signature only after the unsigned
launch intent is fixed. Legacy `programmable.eip3009-signature-patch.v1`
descriptors remain compatible for exact retries; new requests use v2.

## CLI contract

Revision 3 uses public CLI contract version `3.3.6`, with exactly four commands:

```text
pack
validate
submit
status
```

The immutable `3.3.6` release locator is
`https://github.com/0xprogrammable/PROGRAMMABLE/releases/tag/programmable-launch-v3.3.6`.
The discovery descriptor reports `releaseLocatorStatus: published` and
`supportStatus: live`. Resolve release assets and their verification material
from that immutable locator at installation time; do not reuse an older
release's checksum or install a similarly named package from a registry.

The normal flow remains:

```text
pack -> validate -> submit -> status -> separate wallet review and signature
```

`finalized`, `failed`, and `cancelled` are terminal. Pending requests and
profile descriptors are not launch or token-list identities.
