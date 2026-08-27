# Integration status

This page explains the product state represented by v2. For live machine-readable state, use:

```text
GET https://developers.programmable.family/api/v2/status
GET https://developers.programmable.family/api/v2/manifest
```

This status page covers the unauthenticated read/discovery API. The separately hosted
[Custom Launch API V2 and V3](https://programmable.market/docs/developers/custom-launch)
accepts wallet-bound public launch requests on Ethereum Mainnet. Its machine readiness
endpoint is [`https://api.programmable.market/readyz`](https://api.programmable.market/readyz),
and its canonical contracts are the versioned
[`V2`](https://programmable.market/openapi/custom-launch-v2.json) and
[`V3`](https://programmable.market/openapi/custom-launch-v3.json) OpenAPI documents.
V1 reads and status remain compatible; V1 POST remains read-only and returns nonretryable
`409 CUSTOM_LAUNCH_V1_READ_ONLY`.

In the v2 status response, `customLaunchApi` is the retained V1 compatibility
object. `currentCustomLaunchCreate` is the additive current V3 write pointer;
it identifies the live create, capabilities, preflight, readiness, and OpenAPI
URLs without granting admission or wallet authority.

## Current availability

| Surface | Category | Network | State | Meaning |
| --- | --- | --- | --- | --- |
| Classic launch discovery | `classic` | Ethereum | Live | Current Classic launches can appear in the v2 feed |
| Router V1 launch provenance | `classic` or `custom` | Ethereum | Live | Direct stamps are recognized from block `25717612`; historical launches are not backfilled |
| Custom Launch API V2 | `custom` | Ethereum | Public | Wallet-bound API keys may prepare and track deterministic launches; the controller wallet reviews and signs separately |
| Direct Native Hook Graph Profile V3 / Custom Launch API V3 | `custom` | Ethereum | Public | Active general lane with exact source/compiler/graph binding, deterministic static admission, and mandatory exact Router simulation before authorization |
| V3 capabilities and preflight | `custom` | Ethereum | Public / authenticated | Public capability discovery plus authenticated quota-free classification; no launch quota, nonce, persistence, wallet signature, broadcast, deployment, or feed record is created |
| Direct Native Hook Graph Profile V2 / Custom Launch API V3 | `custom` | Ethereum | Retained compatible | Revision 2 remains published for compatible exact-graph clients |
| Direct Native Hook Graph Profile V1 | `custom` if activated | Ethereum | Retained gated preview | Preserved unchanged for discovery compatibility; it does not override the active V3 or compatible V2 descriptor |
| Custom Launch API V1 | `custom` | Ethereum | Read-only writes | Reads/status remain compatible; POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY` |
| Legacy Registry and GitHub submission intake | `custom` | Ethereum | Closed | No legacy or V1 write path is open |
| Custom Registry | `custom` | Ethereum | Live discovery | Generation 1 is active for finalized approved discovery; legacy intake is closed |
| Historical Stock-Paired records | — | Ethereum | Excluded from v2 | Available only through the v1 compatibility API |
| Basebit partnership template | `custom` if activated | Not published | Unverified / prelaunch | No authoritative partner source, recipient, accepted template, Registry record, or live fee path is published |
| Aion partnership template | `custom` if activated | Not published | Unverified / prelaunch | No authoritative partner recipient, accepted template, Registry record, or live fee path is published; similarly named code is not evidence |
| Other networks | — | — | Not declared | Support exists only when a network appears as active in the manifest |

## What `custom` means today

`custom` requires recognized Custom Registry evidence or a consistent canonical Router `CustomGraph` stamp. It is not a generic label for every launch outside Classic and does not imply market support.

After registry activation, different providers, factories, templates, token contracts and hook contracts all use the same `custom` category. Their particular behavior is described by provenance, markets, capabilities, verification, fees and extensions rather than additional public categories.

## Router V1 status

The manifest publishes Router V1 as `live` at `0x8622DD5bAb44185f2A458ac90384Ac99248f8d56` from block `25717612`, with runtime Keccak-256 `0x40e27ecf201761d5eb66bc4f2d5c6124831ef078d7baf458ca5f41b1a8108546` and `64` finality confirmations. Its approved finalized onchain canary covers `CustomGraph`. No separate Classic onchain canary is published; a future Classic launch is recognized only from a consistent stamp written by the same live Router. This is origin evidence, not a safety, audit, liquidity, tradability, or terminal-support claim.

## What closed and prelaunch mean

Closed means the legacy Registry and GitHub submission routes are not accepted. It does not close the separate authenticated Custom Launch API V2 or V3. Prelaunch refers only to a future Registry generation, provider integration, fixture, or fee path that is available for client development but not active. V1 reads/status remain live, but V1 POST is independently read-only. In particular:

- future Custom examples are fixtures, not live assets;
- approval or submission records do not belong in the public launch feed;
- the Custom Registry must not be hard-coded from a draft;
- a Custom record appears as a launch only after the recognized onchain launch evidence exists;
- no fee path should be labeled onchain-verified before deployment and verification.

The v2 manifest reports `customRegistry.status: "live"`,
`customRegistry.publicSubmissionsEnabled: false`, and
`publicCategories.custom.publicSubmissionStatus: "closed"` for the legacy
Registry and GitHub intake, plus separately live public Custom Launch API V2
and V3 profiles. The
filtered v2 Custom feed begins with the finalized project-only genesis canary.
These values are the controlling public state; provider catalogs and intake
drafts cannot override them.

The v2 status response also reports `customRegistryPublication`. The Gen1 canary sets `baselineReady` and can keep `publicationReady` true, but it never sets `sourceConfigured`, `sourceCurrent`, or `sourceReady`. Those source fields advance only for the authenticated, complete, current `programmable-custom-launch-registry-v3` applicant feed. `baselineLaunches` and `applicantLaunches` remain separate. Consumers must not interpret `custom.status: "live"` or the canary alone as proof that a new project is launchable.

`routerCustom` is a separate quality boundary for finalized canonical-Router identities. `current` plus equal verified and published counts permits authoritative absence checks. `last-known-good` preserves recognized identities but degrades Custom and combined feeds, so consumers must retry an absent detail lookup instead of treating it as a final 404.

Generation 1 is the manifest-published Custom Registry trust root. Its finalized project-only genesis canary is the immutable discovery baseline; legacy Registry and GitHub submission intake are closed. Generation 1 is not evidence that the stronger Generation 2 interface is deployed.

Custom Registry Generation 2 and Custom Fee-Enforced Launch Profile V2 are
different systems. The first is a future four-contract discovery trust root.
The second is the public production launch profile for one exact additive fee
path. Generation 2 remains inactive; the V2 profile is live. Neither creates a
new category, and evidence for one cannot activate the other.

## Direct Native Hook Graph V3 general lane

`directNativeHookGraphProfileV3` is the additive active descriptor under
`programmable.direct-native-hook-graph-profile-discovery.v3`. It keeps the
unchanged profile ID `programmable.direct-native-hook-graph.v1`, advances the
revision to `3` and current version to `3.3.0`. Only `3.3.0` accepts fresh
admission. Exact `3.2.0`, `3.1.0`, `3.0.0`, and `2.0.0` bytes remain readable
and retryable only byte-for-byte under their original policies. The only public categories
remain `classic` and `custom`.

The separate V3 service publishes unauthenticated `GET /v3/capabilities` and
authenticated quota-free `POST /v3/custom-launches/preflight`. Preflight uses
`programmable.custom-launch-preflight.v1`, does not allocate a nonce or persist
a launch, and cannot sign or broadcast. Hard blocks, missing evidence, and
warnings remain separately typed. The response exposes all six independent
product truth axes plus platform-owned behavior evidence; no client can declare
an unexecuted vector verified. Its deployable, routable, and featured flags do
not establish deployment, trading, fee behavior, verification, indexing, or
featured placement; each later state requires its own evidence. A wallet
handoff appears only later with an explicit URL and expiry.

Policy publication and enforcement are separate. The active
`directNativeHookGraphProfileV3.platformAdmissionPolicy` is the public machine
contract for static admission. An exact versioned Launch Policy commit or
release may provide its authored source; an unversioned repository branch does
not select the live API or decide a request. Live V3 capabilities and OpenAPI
publish the current transport contract. The CLI is a
preparation tool. Server-side preflight, request-specific admission, and exact
Router simulation decide whether the request reaches `authorized`. The
controller wallet alone signs and broadcasts, and canonical Router finality
alone permits feed indexing. `authorized` is not signed or deployed,
`submitted` is not finalized, and `lifecycleQueue.state` is not the launch
resource status.

Revision 3 accepts project-supplied token, hook, initializer, and support
artifacts in exact 3–16-target direct graphs and represents every valid v4 hook
permission mask. The deterministic baseline binds exact source bytes, compiler
input and output, settings, graph, creation bytes, and runtime identities.
New profile `3.3.0` packs also require a closed `projectMetadata` declaration.
Its digest is bound into the returned graph hash and launch identity before the
controller reviews the Router transaction. This establishes the exact name,
symbol, meaningful presentation, image digest and media facts, HTTPS website,
and X URL that were declared for that
launch. It does not establish that the finalized token returns the declared
name or symbol; `programmable.project-token-metadata-binding.v1` requires a
separate post-deployment readback. Images, descriptions, and links remain
creator-supplied display data and cannot authorize wallet or API actions.
Every V3 resource carries immutable `launchProfileVersion`. Its always-present
`projectMetadata` and `projectMetadataHash` keys are non-null for metadata-bound
`3.2.0` and `3.3.0`; both are null for retained `2.0.0`, `3.0.0`, and `3.1.0`
resources. Profile `3.2.0` keeps its legacy nullable-image metadata contract;
fresh `3.3.0` packs use the stricter complete policy.
The unauthenticated `/v3/finalized-custom-launches` snapshot exposes only
finalized profile `3.3.0` metadata ledgers and their declared-versus-observed
token readback state. It excludes pending and legacy resources, controllers,
credentials, and request bytes. Snapshot metadata never overrides canonical
Router identity or turns presentation into safety, liquidity, tradeability, or
featured-placement evidence.
The seven `3.3.0` hard blocks are runtime `CALLCODE`, runtime or source
self-destruct, definitively missing or invalid PoolManager callback
authentication, a literal wrong PoolManager, and a missing enabled callback.
Proxy or upgrade surfaces, `DELEGATECALL`, mint, tax, pause, liquidity custody,
and return-delta/custom-accounting designs require exact evidence instead of a
categorical rejection. Zero hard blocks only make the exact request eligible
for later Router simulation; they do not verify runtime behavior.

Authorization requires the exact prepared Router launch transaction to succeed
as a pinned Ethereum simulation. Neither the static result nor simulation is a
security audit, honeypot-free guarantee, liquidity or tradeability proof, or
fee-behavior certification. Generic claiming for arbitrary hooks and generic
buybacks are not live. See the [Revision 3 contract](guides/direct-native-hook-graph-profile-v3.md).

## Direct Native Hook Graph V2 compatible profile

`directNativeHookGraphProfileV2` is the retained compatible descriptor under
`programmable.direct-native-hook-graph-profile-discovery.v2`. It preserves the
only public categories, `classic` and `custom`, and leaves the V1 descriptor
unchanged. It describes the separate authenticated Custom Launch API V3 route;
the Developer API itself remains read-only.

V2 accepts an atomic acyclic graph of 3–16 exact targets with distinct project
token, hook, and initializer roles. All valid v4 hook permission masks from
`0` through `16383` are supported when callback dependencies, compiled
permissions, and hook address bits agree. Funding is exactly one of `none`,
exact native wallet transaction value, or a separately wallet-signed EIP-3009
authorization. A project submission is not universal approval: every accepted
launch requires exact source/build/runtime binding, simulation, admission, and
a platform-issued conformance receipt bound to that final graph.

Pool initialization does not add concentrated liquidity and trading volume does
not create an LP position. A normal pool stays empty until someone supplies a
position. A custom-accounting graph may begin with zero classical LP only when
its reviewed hook supplies and settles the required inventory or backing.
Finality does not prove liquidity, backing, solvency, sellability, or a lock.

Only finalized consistent canonical-Router launches enter the Custom launch
feed, and token-list publication additionally requires a token identity. Pending
requests and profile descriptors never create feed records. See the
[production profile contract](guides/direct-native-hook-graph-profile-v2.md).

## Direct Native Hook Graph V1 preview

`directNativeHookGraphProfileV1` is an optional, machine-readable preview
descriptor under
`programmable.direct-native-hook-graph-profile-discovery.v1`, not the V3 request
profile object and not a live launch surface. It reserves a future `custom` profile for
one direct project-owned v4 hook inside an atomic acyclic profile graph of 3–16
targets. The underlying GraphFactory accepts 1–16 and the current Router accepts
2–16, but this funding profile requires distinct token, hook and initializer
roles plus one exclusive component per target/result index; the initializer role
uses the existing `other` component kind. The contract covers an exact constrained per-launch set of
v4 hook permissions, ERC-20/ERC-20 and native/ERC-20 PoolKeys, a pre-signature
`fundingIntentHash`, and two separately reviewed wallet signatures. The frozen
platform share is 10 bps inside the selected total hook fee, not 10 bps added
above it; the recipient remains explicit.

The descriptor is fail-closed: `status: "gated"`,
`productionLaunchAuthorized: false`, its candidate V3 API support `integration-pending`, the
CLI candidate `not-published`, and exact profile admission under the existing
immutable permit authority is pending. The current
launch and token-list feeds publish no prelaunch record for it. Production V3
clients use `directNativeHookGraphProfileV3` or the retained compatible
`directNativeHookGraphProfileV2`; neither live descriptor
retroactively activates V1. Generic fee claiming and buybacks remain not live. See the
[versioned preview contract](guides/direct-native-hook-graph-profile-v1.md).

The local Generation 2 release candidate currently snapshots the four-contract Registry, PartnerFactory Registry, fee-policy verifier, atomic registrar, 15-event integration set, and 37-word v4 producer commitment. It is undeployed and not final ABI authority. The Public Registry root is still changing its execution-policy, route, and market-data-source binding contract; final ABI, topics, event count, Solidity hash preimages, artifact hashes, and artifact-set hash will therefore differ. After the final Public commit, Developer must replace the candidate artifacts byte-for-byte and rerun Contract → Approval → Read Model → Developer parity before Generation 2 activation.

Generation 2 remains inactive until a reproducible deployment publishes exact addresses, runtime hashes, start block, final ABI and event-set hash, authorized roles, Approval-producer parity, a real canary record, and complete/fresh read-model coverage. The v4 schema and validator do not authorize ingestion by themselves. Candidate artifacts never change the closed legacy intake, `publicSubmissionsEnabled`, or `registryGenerations`.

## Feature support

Every registered launch is discoverable. Feature availability is separate:

| Feature | Requirement |
| --- | --- |
| Identity and launch provenance | Registered launch record |
| Programmable Verified | Effective structured review bound to the exact deployed revision |
| Token metadata | Metadata available, with its trust state preserved |
| Market discovery | Registered market record |
| Chart and volume | Verified activity normalizer or adapter |
| Quote | Verified quote adapter declared by the record |
| Simulation | Verified simulation adapter declared by the record |
| Execution | Verified execution adapter declared by the record and a separate supported client flow |

If a requirement is not met, keep the launch visible and mark that feature unavailable. Do not infer support from contract names, metadata text, category, or an unfamiliar market type.

The Developer v2 API is read-only. Support states describe verified availability; they do not return calldata, submit transactions, or authorize an action. The separate Custom Launch API V2 or V3 may prepare an exact transaction, but only the controller wallet may review, sign and broadcast it. V1 POST remains read-only.

The status of an API does not establish fee enforcement, an exact-source match,
a successful simulation, finality, tradability, claim support, or an audit. Read
each field independently. API availability does not prove fee accrual, payment,
claimability, continuing liquidity or an independent audit.

## Ready, degraded, and unavailable

- `ready` means canonical event coverage and enrichment meet the feed's normal publication state.
- `degraded` means canonical event coverage or enrichment is incomplete, but recognized events remain visible with partial, unavailable, or null fields.
- `unavailable` means no current coverage boundary is available. Launch-list and token-list still return HTTP `200` with any recognized bounded records and explicit quality; absence is not authoritative.

Missing ERC-20 metadata, supply, or a block timestamp alone does not make a recognized event disappear. Do not interpret `partial` provenance or unavailable metadata as a security judgment.

## No partner implication

The API and documentation are available to terminals, scanners, wallets, indexers, bots, and apps. Publication does not mean that a named third party has already integrated or endorsed Programmable.

Likewise, a partner name in planning or research does not prove an approved partner, recipient, template, fee split, or live Registry path. Activation requires the exact evidence in the [launch provider guide](guides/launch-providers.md).
