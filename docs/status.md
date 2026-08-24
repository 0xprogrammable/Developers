# Integration status

This page explains the product state represented by v2. For live machine-readable state, use:

```text
GET https://developers.programmable.family/api/v2/status
GET https://developers.programmable.family/api/v2/manifest
```

This status page covers the unauthenticated read/discovery API. The separately hosted
[Custom Launch API](https://programmable.market/developers/custom-launch-api-v1.md) uses wallet-bound authentication to
prepare Router actions; Registry submission state does not describe that API's availability.

## Current availability

| Surface | Category | Network | State | Meaning |
| --- | --- | --- | --- | --- |
| Classic launch discovery | `classic` | Ethereum | Live | Current Classic launches can appear in the v2 feed |
| Router V1 future-launch provenance | `classic` or `custom` | Ethereum | Live | Direct stamps are recognized from block `25717612`; historical launches are not backfilled |
| Custom Registry submission intake | `custom` | Ethereum | Prelaunch | Registry-based public submissions are not a live launch source; the Custom Launch API is separate |
| Custom Registry | `custom` | Ethereum | Live discovery | Generation 1 is active; Registry-based public submission intake remains prelaunch |
| Historical Stock-Paired records | — | Ethereum | Excluded from v2 | Available only through the v1 compatibility API |
| Basebit partnership template | `custom` if activated | Not published | Unverified / prelaunch | No authoritative partner source, recipient, accepted template, Registry record, or live fee path is published |
| Aion partnership template | `custom` if activated | Not published | Unverified / prelaunch | No authoritative partner recipient, accepted template, Registry record, or live fee path is published; similarly named code is not evidence |
| Other networks | — | — | Not declared | Support exists only when a network appears as active in the manifest |

## What `custom` means today

`custom` requires recognized Custom Registry evidence or a consistent canonical Router `CustomGraph` stamp. It is not a generic label for every launch outside Classic and does not imply market support.

After registry activation, different providers, factories, templates, token contracts and hook contracts all use the same `custom` category. Their particular behavior is described by provenance, markets, capabilities, verification, fees and extensions rather than additional public categories.

## Router V1 status

The manifest publishes Router V1 as `live` at `0x8622DD5bAb44185f2A458ac90384Ac99248f8d56` from block `25717612`, with runtime Keccak-256 `0x40e27ecf201761d5eb66bc4f2d5c6124831ef078d7baf458ca5f41b1a8108546` and `64` finality confirmations. Its approved finalized onchain canary covers `CustomGraph`. No separate Classic onchain canary is published; a future Classic launch is recognized only from a consistent stamp written by the same live Router. This is origin evidence, not a safety, audit, liquidity, tradability, or terminal-support claim.

## What prelaunch means

Prelaunch on this page refers to a Registry or provider launch source that is available for client development but not active. It does not describe the separate Custom Launch API. In particular:

- future Custom examples are fixtures, not live assets;
- approval or submission records do not belong in the public launch feed;
- the Custom Registry must not be hard-coded from a draft;
- a Custom record appears as a launch only after the recognized onchain launch evidence exists;
- no fee path should be labeled onchain-verified before deployment and verification.

The v2 manifest reports `customRegistry.status: "live"`, `publicSubmissionsEnabled: false`, and the exact active address, generation, and start block. The filtered v2 Custom feed begins with the finalized project-only genesis canary. These values are the controlling public state; provider catalogs and intake drafts cannot override them.

The v2 status response also reports `customRegistryPublication`. The Gen1 canary sets `baselineReady` and can keep `publicationReady` true, but it never sets `sourceConfigured`, `sourceCurrent`, or `sourceReady`. Those source fields advance only for the authenticated, complete, current `programmable-custom-launch-registry-v3` applicant feed. `baselineLaunches` and `applicantLaunches` remain separate. Consumers must not interpret `custom.status: "live"` or the canary alone as proof that a new project is launchable.

Generation 1 is the manifest-published Custom Registry trust root. Its finalized project-only genesis canary is the immutable discovery baseline; Registry-based public submission intake remains prelaunch. Generation 1 is not evidence that the stronger Generation 2 interface is deployed.

The local Generation 2 release candidate currently snapshots the four-contract Registry, PartnerFactory Registry, fee-policy verifier, atomic registrar, 15-event integration set, and 37-word v4 producer commitment. It is undeployed and not final ABI authority. The Public Registry root is still changing its execution-policy, route, and market-data-source binding contract; final ABI, topics, event count, Solidity hash preimages, artifact hashes, and artifact-set hash will therefore differ. After the final Public commit, Developer must replace the candidate artifacts byte-for-byte and rerun Contract → Approval → Read Model → Developer parity before Generation 2 activation.

Registry-based public submission intake remains prelaunch until a reproducible Generation 2 deployment publishes exact addresses, runtime hashes, start block, final ABI and event-set hash, authorized roles, Approval-producer parity, a real canary record, and complete/fresh read-model coverage. The v4 schema and validator do not authorize ingestion by themselves. Candidate artifacts never change `publicSubmissionsEnabled` and do not enter `registryGenerations`.

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

The v2 API is read-only. Support states describe verified availability; they do not return calldata, submit transactions, or authorize an action. The separate Custom Launch API owns launch preparation under its own live OpenAPI contract.

## Ready, degraded, and unavailable

- `ready` means canonical event coverage and enrichment meet the feed's normal publication state.
- `degraded` means canonical event coverage is complete enough to publish, but some enrichment is incomplete. Recognized events remain visible with partial, unavailable, or null fields.
- `unavailable` means the route cannot publish a complete event-coverage boundary. Launch-list and token-list requests return a retryable `503` rather than presenting an incomplete list as complete.

Missing ERC-20 metadata, supply, or a block timestamp alone does not make a recognized event disappear. Do not interpret `partial` provenance or unavailable metadata as a security judgment.

## No partner implication

The API and documentation are available to terminals, scanners, wallets, indexers, bots, and apps. Publication does not mean that a named third party has already integrated or endorsed Programmable.

Likewise, a partner name in planning or research does not prove an approved partner, recipient, template, fee split, or live Registry path. Activation requires the exact evidence in the [launch provider guide](guides/launch-providers.md).
