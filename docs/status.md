# Integration status

This page explains the product state represented by v2. For live machine-readable state, use:

```text
GET https://developers.programmable.family/api/v2/status
GET https://developers.programmable.family/api/v2/manifest
```

## Current availability

| Surface | Category | Network | State | Meaning |
| --- | --- | --- | --- | --- |
| Classic launch discovery | `classic` | Ethereum | Live | Current Classic launches can appear in the v2 feed |
| Programmable Custom intake | `custom` | Ethereum | Prelaunch | Approved submissions are not yet a live launch source |
| Custom Registry | `custom` | Ethereum | Live discovery | Generation 1 is active; general public intake remains prelaunch |
| Historical Stock-Paired records | — | Ethereum | Excluded from v2 | Available only through the v1 compatibility API |
| Basebit partnership template | `custom` if activated | Not published | Unverified / prelaunch | No authoritative partner source, recipient, accepted template, Registry record, or live fee path is published |
| Aion partnership template | `custom` if activated | Not published | Unverified / prelaunch | No authoritative partner recipient, accepted template, Registry record, or live fee path is published; similarly named code is not evidence |
| Other networks | — | — | Not declared | Support exists only when a network appears as active in the manifest |

## What `custom` means today

`custom` is reserved for accepted Custom Registry launches. It is not a generic label for every launch outside Classic and it does not imply that Custom intake is live.

After registry activation, different providers, factories, templates, token contracts and hook contracts all use the same `custom` category. Their particular behavior is described by provenance, markets, capabilities, verification, fees and extensions rather than additional public categories.

## What prelaunch means

Prelaunch means the integration contract is available for client development, but that launch source is not yet active. In particular:

- future Custom examples are fixtures, not live assets;
- approval or submission records do not belong in the public launch feed;
- the Custom Registry must not be hard-coded from a draft;
- a Custom record appears as a launch only after the recognized onchain launch evidence exists;
- no fee path should be labeled onchain-verified before deployment and verification.

The v2 manifest reports `customRegistry.status: "live"`, `publicSubmissionsEnabled: false`, and the exact active address, generation, and start block. The filtered v2 Custom feed begins with the finalized project-only genesis canary. These values are the controlling public state; provider catalogs and intake drafts cannot override them.

Generation 1 is the manifest-published Custom trust root. Its finalized project-only genesis canary is the immutable discovery baseline; general Custom intake remains prelaunch. Generation 1 is not evidence that the stronger Generation 2 interface is deployed.

The local Generation 2 release candidate defines the stronger four-contract Registry, PartnerFactory Registry, fee-policy verifier, and atomic registrar trust root plus the 15-event integration set and 37-word v4 producer commitment. It is undeployed contract and integration evidence, not a live trust root. General Custom intake remains prelaunch until a reproducible Generation 2 deployment publishes exact addresses, runtime hashes, start block, ABI and event-set hash, authorized roles, Approval-producer parity, and a real canary record. The v4 contract-record schema and validator do not by themselves authorize public ingestion: the Approval producer must emit that exact record and the read model must verify it before projection. Candidate artifacts never change `publicSubmissionsEnabled` and do not enter `registryGenerations`.

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

The v2 API is read-only. Support states describe verified availability; they do not return calldata, submit transactions, or authorize an action.

## Ready, degraded, and unavailable

- `ready` means canonical event coverage and enrichment meet the feed's normal publication state.
- `degraded` means canonical event coverage is complete enough to publish, but some enrichment is incomplete. Recognized events remain visible with partial, unavailable, or null fields.
- `unavailable` means the route cannot publish a complete event-coverage boundary. Launch-list and token-list requests return a retryable `503` rather than presenting an incomplete list as complete.

Missing ERC-20 metadata, supply, or a block timestamp alone does not make a recognized event disappear. Do not interpret `partial` provenance or unavailable metadata as a security judgment.

## No partner implication

The API and documentation are available to terminals, scanners, wallets, indexers, bots, and apps. Publication does not mean that a named third party has already integrated or endorsed Programmable.

Likewise, a partner name in planning or research does not prove an approved partner, recipient, template, fee split, or live Registry path. Activation requires the exact evidence in the [launch provider guide](guides/launch-providers.md).
