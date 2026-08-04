# Integration status

This page explains the product state represented by v1. For live machine-readable state, use:

```text
GET https://developers.programmable.family/api/v1/status
GET https://developers.programmable.family/api/v1/manifest
```

## Current availability

| Surface | Category | Network | State | Meaning |
| --- | --- | --- | --- | --- |
| Classic launch discovery | `classic` | Ethereum | Live | Current Classic launches can appear in the v1 feed |
| Existing first-party stock-paired records | `custom` | Ethereum | Live where listed by the manifest | These records use the public Custom category even though open Custom intake is not live |
| Open Custom intake | `custom` | Ethereum | Prelaunch | Public submissions are not yet a live launch source |
| Open Custom Registry | `custom` | Ethereum | Prelaunch | No open-registry address should be assumed until the manifest marks it active |
| Other networks | — | — | Not declared | Support exists only when a network appears as active in the manifest |

## What `custom` means today

`custom` is the durable public category for launches outside Classic. It is not itself a market type and it does not imply that open Custom intake is live.

Existing first-party stock-paired launches normalize to `custom`. Future open Custom launches will use the same category and the same v1 envelope. Their particular behavior is described by markets, capabilities, verification, fees, and extensions rather than by adding more public launch categories.

## What prelaunch means

Prelaunch means the integration contract is available for client development, but that launch source is not yet active. In particular:

- future Custom examples are fixtures, not live assets;
- approval or submission records do not belong in the public launch feed;
- the Custom Registry must not be hard-coded from a draft;
- a Custom record appears as a launch only after the recognized onchain launch evidence exists;
- no fee path should be labeled onchain-verified before deployment and verification.

## Feature support

Every registered launch is discoverable. Feature availability is separate:

| Feature | Requirement |
| --- | --- |
| Identity and launch provenance | Registered launch record |
| Token metadata | Metadata available, with its trust state preserved |
| Market discovery | Registered market record |
| Chart and volume | Verified activity normalizer or adapter |
| Quote | Verified quote adapter declared by the record |
| Simulation | Verified simulation adapter declared by the record |
| Execution | Verified execution adapter declared by the record and a separate supported client flow |

If a requirement is not met, keep the launch visible and mark that feature unavailable. Do not infer support from contract names, metadata text, category, or an unfamiliar market type.

The v1 API is read-only. Support states describe verified availability; they do not return calldata, submit transactions, or authorize an action.

## Ready, degraded, and unavailable

- `ready` means canonical event coverage and enrichment meet the feed's normal publication state.
- `degraded` means canonical event coverage is complete enough to publish, but some enrichment is incomplete. Recognized events remain visible with partial, unavailable, or null fields.
- `unavailable` means the route cannot publish a complete event-coverage boundary. Launch-list and token-list requests return a retryable `503` rather than presenting an incomplete list as complete.

Missing ERC-20 metadata, supply, or a block timestamp alone does not make a recognized event disappear. Do not interpret `partial` provenance or unavailable metadata as a security judgment.

## No partner implication

The API and documentation are available to terminals, scanners, wallets, indexers, bots, and apps. Publication does not mean that a named third party has already integrated or endorsed Programmable.
