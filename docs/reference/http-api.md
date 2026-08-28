# HTTP API reference

Base URL:

```text
https://developers.programmable.family
```

The public v2 discovery API is read-only JSON. The repository OpenAPI document and JSON Schemas are the normative field-level references.

v2 is canonical for new integrations. API v1 remains a supported compatibility surface with its own schemas and cursors; do not mix records or cursors across the two major versions.

## Discovery document

### `GET /.well-known/programmable.json`

Stable bootstrap document for API version, status, manifest, schemas, documentation, and machine-readable resources.

Clients should begin here and cache the response according to HTTP headers.

Use only the URLs returned by the canonical discovery document. Do not place API keys, bearer tokens, or other credentials in URLs.

## Status

### `GET /api/v2/status`

Returns service lifecycle, supported chain state, indexer freshness, the synchronization or finality boundary needed to interpret feed responses, the `customLaunchApi` V1 compatibility state, the additive `currentCustomLaunchCreate` V3 write pointer and its exact `partnerCredentials` contract, the exact retained Custom Launch API V2 historical-profile descriptor, the retained gated Direct Native Hook Graph V1 preview, the historical-read/exact-retry V2 descriptor, and the active additive Direct Native Hook Graph V3 general-lane descriptor. API readiness is not fee-accrual, source-exact, finality, tradability, claim, or audit evidence.

Use it to distinguish:

- live from prelaunch surfaces;
- current from stale projections;
- normal operation from a degraded service;
- observed or confirmed data from finalized progress.

Do not treat HTTP 200 alone as proof that every launch source or execution adapter is live.

The service separates Classic event coverage from the authenticated finalized Custom Registry. A feed can be `degraded` or `unavailable` while still returning recognized bounded records. These quality values make incomplete Classic coverage or an unconfigured, incomplete, or non-current Custom Registry explicit without hiding known identities.

The hosted Classic baseline is the validated paginated `https://programmable.market/api/explore` catalog. Acceptance requires consistent schema, scope, evidence and identity commitments; the current evidence reports Envio deployment `production-6157d22` without pinning availability to that release id. The retired legacy token source returns HTTP `410` and is not used. Active v2 Classic coverage is historical V3 plus current V4 only; V1/V2 remain inactive history and Stock is excluded. Custom remains a separate lane.

The response's optional `customRegistryPublication` object exposes the publication gate used by the launch and token-list routes. `publicationReady` is the complete route gate. `baselineReady` describes only the immutable Gen1 canary, while `sourceConfigured`, `sourceCurrent`, and `sourceReady` separately describe the authenticated applicant source. `expectedSourceId` and `observedSourceId` make the active producer generation explicit. `baselineLaunches` and `applicantLaunches` are separate, so the canary never inflates the applicant count. `activeGeneration`, `requiresLiveSource`, and `publishedRegistries` describe the manifest-selected Registry boundary. A `null` object means the status was produced before dataset projection and must not be treated as source readiness.

The optional `routerCustom` object reports the independent canonical-Router identity lane. It exposes the exact source boundary, source identity commitment, validated snapshot digest, and verified versus published identity counts. `last-known-good` keeps recognized identities readable but makes the Custom and combined feeds `degraded`; a missing identity is not authoritative until this lane returns to `current` with matching counts.

`customLaunchApi.writeStatus: read-only` describes V1 compatibility only. New
clients use `currentCustomLaunchCreate`, then follow its V3 capabilities,
preflight, readiness, OpenAPI, and single-resource status contracts. The
pointer is discovery data; it does not waive server admission or authorize a
wallet action. V2 authenticated POST is also read-only and returns nonretryable
`409 CUSTOM_LAUNCH_V2_READ_ONLY`. Wallet keys remain compatible. Approved partner roots and their
bounded one-level subkeys use those same contracts and policies; only the root
can manage credentials, and neither root nor child can sign, broadcast, bypass
admission, or provide caller-selected attribution. Root history aggregates
attributed root and child launches; each child sees only its stable lineage,
rotation preserves that lineage, and a distinct child starts an isolated one.
Partner metadata policy matches wallet-key policy. Wallet keys bind the
controller to the key wallet; partner requests select the controller in the
exact request, and that wallet still reviews, signs, and broadcasts. Partner
roots are provisioned only through the authenticated Website BFF and the
server-configured Privy-user/wallet allowlist; clients cannot self-authorize.

## Manifest

### `GET /api/v2/manifest`

Returns:

```text
schemaVersion
platformId
manifestVersion
generatedAt
chainId
network
publicCategories
deployments
customRegistry
launchStampRouter
customFeeEnforcedLaunchProfileV2
directNativeHookGraphProfileV1
directNativeHookGraphProfileV2
directNativeHookGraphProfileV3
platformFee
endpoints
compatibility
```

The manifest is the canonical integration inventory for active and prelaunch deployments. Read deployment arrays and lifecycle state. Never hard-code a single registry or launcher address as the entire Programmable source.

For Classic, process only manifest deployments whose discovery state is enabled. The current enabled set is historical V3 and current V4; inactive V1/V2 entries are retained as history, not scan instructions, and no Stock release belongs to active v2 discovery. Refreshing this manifest lets a generic Router-first consumer discover V4 without changing its code or copying a deployment address.

`launchStampRouter.canaryEvidence.routeCoverage.classicOnchainCanary` is `true` for the live release. Treat it as a summary only: verify the separate exact Classic canary evidence, its Router binding, source deployment, canonical block, transaction, launch kind, and component commitments before accepting the coverage claim. Router remains provenance and transport infrastructure, not a third public category.

`generatedAt` is the publication time of that exact static manifest revision. It is not the current chain head, an indexer freshness signal, or a replacement for the status and finality fields.

The Website endpoint `https://programmable.family/api/custom-launch/registry/v1/manifest` is an operational presentation mirror, not a second integration trust root. Its schema and generation labels can differ from this Developer manifest. For terminal, wallet, indexer, bot, or direct-onchain integration, the discovery-selected `https://developers.programmable.family/api/v2/manifest` takes precedence. A conflict must pause trust advancement and alert an operator; it must not be resolved by merging fields from both documents.

The v2 Custom Registry state is live with Registry-based public submissions disabled. Clients discover the active address, generation, start block, event set, ABI, finality policy, and operation-specific authority sets from the manifest. For Generation 1, `authorizedWriters` and `operationAuthorities.registered` identify registration writers; `operationAuthorities.finalized` independently identifies finalizers. A registration writer is not a finalizer merely because both operations emit from the Registry. Clients must not infer that live discovery enables Registry submission intake or use this state to determine availability of the separate Custom Launch API.

`directNativeHookGraphProfileV3` is the optional additive active general-lane
descriptor for Custom Launch API V3. It keeps `category: custom`, binds
project-supplied token, hook, initializer, and support artifacts in exact
acyclic graphs of 3–16 direct targets, and represents every valid v4 permission
mask. Its `platformAdmissionPolicy` binds exact source/compiler/graph evidence
to a deterministic role-aware static baseline. A code blocks only for its
published target roles; every unmatched finding stays bound and visible as a
warning, with no project-specific exception. Blocking findings produce
`action_required`; zero blocking findings only make the exact request eligible
for mandatory pinned Router launch simulation. The API server, not a CLI, LLM,
or client, decides authorization after the exact static admission baseline and
pinned Router simulation. Missing or unavailable runtime behavior evidence
leaves the related behavior, trading, liquidity, and fee claims unverified; an
authenticated executed negative blocks wallet handoff with
`BEHAVIOR_EVIDENCE_NOT_VERIFIED`. This is not
an audit or an arbitrary-hook safety, honeypot, liquidity,
tradeability, or fee-behavior guarantee. The descriptor names authenticated
V3 surface, but this Developer API returns no executable calldata and
authorizes no transaction. Its `api.agentIntegration` object links the
canonical machine-readable remediation catalog and existing-project guide.
Agents resolve `action_required` finding codes there, rebuild and resubmit a new
exact request; there is no project allowlist or legacy GitHub fallback. The
linked pack-config schema defines the additive
`programmable.eip3009-authorization-patch.v2` contract: static
`nonceArgumentPath`, `rArgumentPath`, `sArgumentPath`, and `vArgumentPath`
values identify the four authorization leaves while v1 remains readable for
exact retries. Only fresh profile `3.3.0` requests carry required
`programmable.project-metadata.v1` and its `projectMetadataHash`. The CLI keeps
the raw graph digest in `unboundGraphBundleHash` and publishes a metadata-bound
`graphBundleHash`. The prepared resource repeats both hashes, the exact
metadata, and `programmable.project-token-metadata-binding.v1`; finalized token
name and symbol still require `postDeploymentReadback: required`. These fields
describe reviewed launch input. They do not make descriptions, images, links,
or token reads platform-verified and cannot be used as calldata or wallet
authority.

The active `directNativeHookGraphProfileV3.platformAdmissionPolicy` is the
machine-readable static admission contract. An exact versioned Launch Policy
commit or release may provide its authored source; an unversioned repository
branch neither selects the live API nor decides a request. Live capabilities
and V3 OpenAPI define the current transport. Local CLI checks, LLM output, and
client reports are preparatory. The API server alone decides authorization
from the required exact-request evidence;
the controller wallet alone signs and broadcasts. `authorized` is not signed,
`submitted` is not finalized, and worker `lifecycleQueue.state` never replaces
the launch resource status.

The canonical Custom Launch V3 resource always includes immutable
`launchProfileVersion` with value `2.0.0`, `3.0.0`, `3.1.0`, `3.2.0`, `3.3.0`,
or prepared `3.4.0`.
Required `projectMetadata` and `projectMetadataHash` keys are non-null for
metadata-bound `3.2.0` and `3.3.0`, and null for retained `2.0.0`, `3.0.0`, and
`3.1.0`. Profile `3.2.0` retains its legacy nullable-image metadata contract;
fresh `3.3.0` packs use the stricter complete policy. The prepared artifact has
no separate `launchProfileVersion`; metadata-bound artifacts carry metadata,
metadata hash, and `unboundGraphBundleHash`, while pre-`3.2.0` legacy artifacts
omit those three fields. The canonical conditional schema stays in the public
Custom Launch V3 OpenAPI and is not redefined here.

The same descriptor publishes `api.selfServe.finalizedMetadata` and
`api.agentIntegration.finalizedMetadataUrl`. They identify unauthenticated
`GET https://api.programmable.market/v3/finalized-custom-launches`, whose
canonical operation is `listFinalizedCustomLaunchMetadataV3` in the Custom
Launch V3 OpenAPI contract. The opaque-cursor response is backed by the
`finalized-v3-project-metadata-ledger`, with a maximum page size of 25. It
contains finalized metadata-bearing V3 rows under their original contracts,
including retained `3.2.0` and current `3.3.0` rows. It contains no pending
request, metadata-absent historical resource, controller, credential, or request bytes. Complete
all pages of its `launches` array. Every page also requires `schemaVersion`,
`generatedAt`, `nextCursor`, and `quality`. `quality.status` is `complete` when
every source row was published and `partial` when invalid finalized rows were
quarantined; `publishedRowCount + quarantinedRowCount = sourceRowCount`, with
one row-indexed `FINALIZED_ROW_QUARANTINED` diagnostic per quarantined row.
Then join by `routerLaunchId` and matching canonical Router event identities.
`resourceId` is not Router provenance and presentation data does not establish
onchain token identity, safety, liquidity, or tradeability.

Every item carries its originating immutable `launchProfileVersion`. Read that
field before applying profile-specific metadata requirements; presence or
absence of an image or link is not a profile-version signal.

Read the canonical display declaration from `projectMetadata`: name, symbol,
description, image facts, website, and X. Only a `matching`
`tokenMetadataReadback.status` establishes that the observed onchain name and
symbol match the declaration. Current submissions require the complete public
metadata envelope, but historical finalized entries remain present when older
image or link fields are null.

For a legacy record, the Developer projection may fill missing image or link
fields from a separately labeled
`programmable/platform-curated-legacy-presentation-v1` extension. That overlay
is accepted only for its exact chain, token, Router launch ID, stamp, hook,
pool, and runtime evidence. It never changes the signed `projectMetadata`, its
hash, or the creator-declared description; clients that need provenance per
field must inspect both extensions.

An item may add server-owned `partnerAttribution` using
`programmable.launch-partner-attribution.v1`. It is derived from the
authenticated partner API principal and is never accepted from the create
request. Validate its `snapshotDigest` before projecting the same object as
`launchedVia`. It is distinct from economic `partner` and Registry `provider`
fields, and makes no claim about fees, safety, liquidity, tradeability, or
external provider indexing. GMGN-, Dexscreener-, or FOMO-style ingestion and
provider-specific `safe` labels are not guaranteed.

`directNativeHookGraphProfileV2` remains the historical-read/exact-retry Revision 2 descriptor.
It binds project-owned token and hook artifacts in exact acyclic graphs of
3–16 direct targets, covers every valid v4 permission mask, and supports
`none`, exact wallet transaction value, or EIP-3009 funding. Its exact
per-launch conformance receipt remains required. Normal v4 pool
initialization creates no liquidity; a zero-classical-LP model is valid only
when the exact custom-accounting graph supplies and settles its own inventory
or backing. Finalized Router evidence does not prove liquidity, backing,
solvency, a lock, or tradability.

`directNativeHookGraphProfileV1` is an optional v2 discovery descriptor for a
future Custom Launch API V3 direct-hook graph path. The descriptor schema is
`programmable.direct-native-hook-graph-profile-discovery.v1`, separate from the
V3 request profile schema `programmable.direct-native-hook-graph-profile.v1`.
Its transport request is
`programmable.custom-launch-create-request.v3`. The planned collection is
`/v3/custom-launches`. Wallet review is an explicit resource-provided handoff,
not a public administrative route. V1 remains
not publicly routable. The V1 descriptor's planned OpenAPI and CLI state
remain unpublished even though production V3 is now published under the
additive V2 and V3 descriptors. V1 `productionLaunchAuthorized` is false, admission under the existing immutable
permit authority and the fixed signature-patch evidence are pending, and a
per-launch initializer is a direct stamped target rather than a separate trust
root. Clients may inspect the V1 contract but must not construct or submit a
request from it; fresh clients use `directNativeHookGraphProfileV3`, while the
retained `directNativeHookGraphProfileV2` is historical-read/exact-retry only. An older v2 discovery response
may omit the optional field; that omission does not affect `classic`, `custom`,
Custom Launch API V1 compatibility, or the retained read-only V2 profile.

Clients should reject an unexplained manifest rollback and alert on conflicting data for the same manifest version.

## Launch feed

### `GET /api/v2/launches`

Returns a normalized, cursor-paginated launch feed:

```text
schemaVersion
status
snapshot
items
page.nextCursor
page.resumeCursor
page.hasMore
```

`items` contains launch records. Official records carry `platformId: "programmable"`; `category` is exactly `classic | custom`, and `launch.modelId` carries the open-ended model. Classic derives those fields from an enabled V3 or V4 deployment. Custom derives them from either an authenticated finalized Registry record or a consistent finalized `CustomGraph` stamp from the exact canonical Router. Stock and inactive Classic V1/V2 sources do not enter active v2 discovery. `extensions["programmable/classification"].basis` distinguishes those source-provenance paths; `category: "custom"` alone must never be interpreted as Registry acceptance. `launchRouteId` is retained separately and is never substituted for `modelId`. An item becomes public launch data only after the recognized finalized launch evidence exists; a submission or approval alone is not a launch.

The gated Direct Native Hook Graph profile creates no prelaunch item in this
feed or the token list. Its planned mechanism and extension identifiers are
descriptive preview data only. Publication requires profile activation followed
by a finalized consistent canonical-Router launch and an enabled projector;
profile documentation, an API key, source review or a prepared graph is not
launch provenance.

The active V3 and retained historical V2 descriptors follow the same provenance
boundary without the preview gate: only a finalized consistent canonical-Router launch may enter the launch
feed. Token-list projection additionally requires a recognized token identity.
Submission, conformance, authorization, or wallet preparation alone never
creates a public launch record.

Router-backed records report their fee policy as unavailable unless separate exact evidence exists. The semantic exception for an absent Registry fee policy is granted only when the record's complete entry digest and source-boundary digest are members of the accepted Router snapshot. A copied Router-shaped JSON object or a self-declared source commitment does not qualify.

For a finalized Router identity, the Developer feed may join creator-declared
display metadata from the Custom Launch API finalized ledger. The join requires
the exact launch ID, Router, token, hook, PoolManager, pool ID, transaction,
block, and log index, plus a recomputed `projectMetadataHash`. The feed keeps
the immutable source binding in
`extensions["programmable/finalized-project-metadata-v1"]` and labels projected
description, image, and links `creator-declared`. Missing, malformed, or
mismatched metadata remains null without hiding or weakening the raw Router
provenance.

`token` is an ERC-20 convenience view. It is `null` for a truthful project-only Custom launch. `assets` preserves the authenticated identity-first asset graph and its immutable launch-produced, protocol-external, or adopted-external provenance. Only a launch-produced primary token may populate `token`. `markets` is empty when no market is registered. Consumers must not manufacture a token, pair, or pool from the project launch identity. The token-list and token-address detail surfaces remain token-only projections and skip `token: null` records.

Registry `uniswap-v4-pool` evidence is mapped to the frozen public v1 market kind `uniswap-v4`, preserving the verifier and PoolManager authority bindings. Unknown authenticated market kinds remain visible with their pending verifier state as unsupported discovery data; they are never silently relabeled as a pair or executable market.

For authenticated Custom launches, `extensions["programmable/registry-v2"]` preserves the exact `sourceKind`, source/finality binding hashes, and the optional presentation snapshot. The presentation version, binding hash, and display-only draft are always all null or all present. Consumers must not use presentation content as launch, token, market, fee, or execution authority.

Finalized partner-launched Custom records may add `launchedVia`. Its exact
object is the immutable read projection of the Custom Launch API
`partnerAttribution` snapshot. It is allowed only with complete canonical token
display metadata and finalized Custom provenance; existing records without it
remain valid v2 records.

When event coverage, metadata, supply, receipt, or block-timestamp enrichment is incomplete, the response is `degraded` or `unavailable`. Recognized items remain present and carry partial, unavailable, or null values. Consumers must not discard them, synthesize missing data, or interpret absence as an authoritative deletion.

When `page.hasMore` is true, continue the current traversal with:

```text
GET /api/v2/launches?cursor={urlEncodedCursor}
```

Cursors are opaque. Store and return them unchanged. Do not parse a cursor into application logic. The service binds both the chain ordering checkpoint and the authenticated Custom Registry generation so a newly accepted launch cannot be missed merely because its finalized block is older than the previous poll.

After the full traversal has been durably applied, persist `page.resumeCursor`. Begin the next incremental poll with:

```text
GET /api/v2/launches?after={urlEncodedResumeCursor}
```

Do not send `after` and `cursor` together. `page.nextCursor` continues one traversal; `page.resumeCursor` is the durable high-water checkpoint for a later poll. `snapshot.cursor` identifies the response snapshot boundary.

Implement replay-safe deduplication because retries and reorg reconciliation can repeat records. Never advance a durable resume cursor before the represented pages are committed.

## Launch by ID

### `GET /api/v2/launches/{launchId}`

Returns one launch by its globally scoped `launchId`. Use this route for project-only, multi-token, and multi-asset records as well as token-backed launches. URL-encode the complete opaque launch ID as one path segment and validate the response against the v2 launch schema.

Do not construct a launch ID from project name, symbol, creator metadata, or a market address. Obtain it from the canonical feed, Registry evidence, or a verified canonical-Router stamp.

## Launch by asset

### `GET /api/v2/launches/{chainId}/{tokenAddress}`

Returns the Programmable launch record for one chain and token address.

Example:

```text
GET /api/v2/launches/1/0x0000000000000000000000000000000000000000
```

The zero address is shown only as path syntax, not as a real token example.

Use a numeric chain ID and a valid EVM address. Address comparison should be case-insensitive after validation; display a checksummed form where appropriate.

This path is a convenience lookup for token-backed records. A project-only record has `token: null`; resolve it through the launch feed or launch-ID detail route with its `projectId` and authenticated `assets`. Do not substitute the zero address or a market contract for a missing token.

## Token list

### `GET /api/v2/token-list`

Returns a wallet-friendly token-list compatibility projection. Use the launch feed when you need full provenance, market support, fee data, non-final records, or reorg state.

A token list is a convenience projection of finalized records with complete token identity. Its top-level `status` reports `ready`, `degraded`, or `unavailable`. A recognized launch with partial identity remains available in the launch feed but is not promoted into the compatibility token list until identity is complete. Token identity remains chain ID plus contract address.

Finalized canonical-Router Custom tokens are included independently from Custom Registry availability. The Router stamp establishes provenance and the pool identity recorded at launch; it does not establish current market support, current supply, or one universal fee policy. Those fields remain unavailable unless separately verified, and the token-list projection never infers a fee from the `custom` category.

## Query parameters

The launch feed supports:

- `chainId` to select a supported chain;
- `category=classic|custom` to filter the public category;
- `limit` for bounded page size;
- `cursor` to continue the current traversal;
- `after` to begin an incremental poll after a durable resume cursor.

Treat server limits and cursor contents as opaque. The token-list endpoint supports `chainId`.

The current discovery document advertises only Ethereum Mainnet. A numeric `chainId` parameter does not make an unadvertised chain supported. See [Multi-chain discovery](../concepts/multi-chain.md).

## Read-only boundary

v2 never returns transaction payloads, calldata, approvals, or submission endpoints. Market support states can describe separately verified charting, quote, simulation, or execution availability, but this API neither authorizes nor constructs those actions.

## Response handling

Successful responses use JSON. Error responses follow the repository problem schema and include a stable machine-readable type, human-readable detail, `requestId`, numeric HTTP `status`, and ISO timestamp. Support reports should include those three diagnostic fields and must never include an API key or Authorization header.

Clients should handle at least:

| Status | Meaning | Client behavior |
| --- | --- | --- |
| `200` | Successful response, possibly with degraded or unavailable data quality | Validate, process recognized records, and inspect the body status |
| `304` | Cached representation remains current | Reuse the cached body associated with the ETag |
| `400` | Invalid input or cursor | Correct the request; do not retry unchanged |
| `404` | No registered launch for that asset | Show not found; do not call it unsafe |
| `405` | Method not supported | Use the documented read-only GET method |
| `429` | Rate limited | Honor `Retry-After` and back off |
| `503` | A transient failure prevented the response from being produced | Preserve the last good state, honor `Retry-After`, and retry later |

Do not turn a provider error into a security judgment about a token.

Launch-list and token-list do not convert coverage gaps into a blanket `503`; they return recognized bounded records with explicit quality. A known detail record can still be returned during partial coverage, while an unknown detail address returns `503` instead of a potentially false `404` until every source that could contain it is complete. Missing ERC-20 metadata, market enrichment, or supply never hides a recognized launch.

## Caching and freshness

- Honor `Cache-Control`, `ETag`, and conditional requests.
- Use status and response snapshot fields to measure freshness.
- Do not use local receipt time as launch time.
- Keep the last verified manifest during a temporary outage, but surface staleness and never silently accept a rollback.
- Refresh the manifest separately from high-frequency launch polling.

## Schema validation

Public response schemas live in `schemas/v2/`:

- `status.schema.json`
- `manifest.schema.json`
- `launch-feed.schema.json`
- `launch.schema.json`
- `launch-partner-attribution-v1.schema.json`
- `custom-launch-registry-record-v3.schema.json`, advertised by the v2 schema index as `canonical-custom-registry-record-v3`
- `custom-launch-registry-record-v4.schema.json`, the Generation 2 37-word producer record; it does not redefine v3
- `token-list.schema.json`
- `problem.schema.json`

Validate fixtures and representative live responses in continuous integration. Unknown optional fields, capability identifiers, and market kinds must remain forward compatible as described in [v2 compatibility](../concepts/compatibility.md).

For independent event and runtime verification, use [Direct onchain verification](onchain-verification.md). An HTTP 200 response is not a substitute for Registry deployment, canary, finality, or production evidence.
