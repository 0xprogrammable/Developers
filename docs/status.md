# Integration status

This page explains the product state represented by v2. For live machine-readable state, use:

```text
GET https://developers.programmable.family/api/v2/status
GET https://developers.programmable.family/api/v2/manifest
```

This status page covers the unauthenticated read/discovery API. The separately hosted
[Custom Launch API V1](https://programmable.market/developers/custom-launch-api-v1.md)
keeps provenance reads and status live, but its POST surface is read-only: it
returns HTTP `409`, code `CUSTOM_LAUNCH_V1_READ_ONLY`, and is nonretryable. Its
machine readiness endpoint is [`https://api.programmable.market/readyz`](https://api.programmable.market/readyz).
The separate
[Custom Fee-Enforced Launch Profile V2](guides/custom-fee-enforced-launch-profile-v2.md)
is pinned for a private canary and is not publicly available. Its held machine
contract is published at
[`https://programmable.market/openapi/custom-launch-v2.json`](https://programmable.market/openapi/custom-launch-v2.json);
the OpenAPI document does not authorize a public write.

## Current availability

| Surface | Category | Network | State | Meaning |
| --- | --- | --- | --- | --- |
| Classic launch discovery | `classic` | Ethereum | Live | Current Classic launches can appear in the v2 feed |
| Router V1 launch provenance | `classic` or `custom` | Ethereum | Live | Direct stamps are recognized from block `25717612`; historical launches are not backfilled |
| Custom Launch API V1 | `custom` | Ethereum | Read-only writes | Reads/status are live; POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY` |
| Custom Fee-Enforced Launch Profile V2 | `custom` | Ethereum | Private canary / publicly unavailable | Exact RC artifacts are pinned; held writes return `503` with `Retry-After`; no deployed fee profile, finalized canary, public route, or production authorization |
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

Closed means the legacy Registry and GitHub submission routes are not accepted. Prelaunch refers only to a future Registry generation, provider integration, fixture, or fee path that is available for client development but not active. Custom Launch API V1 reads/status remain live, but its POST state is independently read-only. Fee-Enforced V2 is independently pinned for a private canary and remains publicly unavailable. In particular:

- future Custom examples are fixtures, not live assets;
- approval or submission records do not belong in the public launch feed;
- the Custom Registry must not be hard-coded from a draft;
- a Custom record appears as a launch only after the recognized onchain launch evidence exists;
- no fee path should be labeled onchain-verified before deployment and verification.

The v2 manifest reports `customRegistry.status: "live"`, `publicSubmissionsEnabled: false`, `publicSubmissionStatus: "closed"`, and the exact active address, generation, and start block. The filtered v2 Custom feed begins with the finalized project-only genesis canary. These values are the controlling public state; provider catalogs and intake drafts cannot override them.

The v2 status response also reports `customRegistryPublication`. The Gen1 canary sets `baselineReady` and can keep `publicationReady` true, but it never sets `sourceConfigured`, `sourceCurrent`, or `sourceReady`. Those source fields advance only for the authenticated, complete, current `programmable-custom-launch-registry-v3` applicant feed. `baselineLaunches` and `applicantLaunches` remain separate. Consumers must not interpret `custom.status: "live"` or the canary alone as proof that a new project is launchable.

Generation 1 is the manifest-published Custom Registry trust root. Its finalized project-only genesis canary is the immutable discovery baseline; legacy Registry and GitHub submission intake are closed. Generation 1 is not evidence that the stronger Generation 2 interface is deployed.

Custom Registry Generation 2 and Custom Fee-Enforced Launch Profile V2 are
different systems. The first is a future four-contract discovery trust root.
The second is a closed launch profile for an exact additive fee path. Neither
is live, neither creates a new category, and evidence for one cannot activate
the other.

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

The Developer v2 API is read-only. Support states describe verified availability; they do not return calldata, submit transactions, or authorize an action. Custom Launch API V1 POST is also read-only, and Fee-Enforced V2 remains held at its public write boundary.

The status of an API does not establish fee enforcement, an exact-source match,
a successful simulation, finality, tradability, claim support, or an audit. Read
each field independently and keep the Fee-Enforced V2 profile unavailable while
`productionLaunchAuthorized` is false.

## Ready, degraded, and unavailable

- `ready` means canonical event coverage and enrichment meet the feed's normal publication state.
- `degraded` means canonical event coverage or enrichment is incomplete, but recognized events remain visible with partial, unavailable, or null fields.
- `unavailable` means no current coverage boundary is available. Launch-list and token-list still return HTTP `200` with any recognized bounded records and explicit quality; absence is not authoritative.

Missing ERC-20 metadata, supply, or a block timestamp alone does not make a recognized event disappear. Do not interpret `partial` provenance or unavailable metadata as a security judgment.

## No partner implication

The API and documentation are available to terminals, scanners, wallets, indexers, bots, and apps. Publication does not mean that a named third party has already integrated or endorsed Programmable.

Likewise, a partner name in planning or research does not prove an approved partner, recipient, template, fee split, or live Registry path. Activation requires the exact evidence in the [launch provider guide](guides/launch-providers.md).
