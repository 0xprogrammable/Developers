# Multi-chain discovery

The integration is chain-aware and designed to add EVM networks without requiring a new terminal category or a client release for each launch. A chain is active only when it is advertised by the canonical discovery and manifest surfaces.

## Current status

Ethereum Mainnet has live hosted and direct-chain discovery. Robinhood Chain
Mainnet, chain ID `4663` / `eip155:4663`, publishes live direct-chain provenance
through `/api/v2/manifests/4663`. Its `directChainIntegration` and
`launchStampRouter` bind the canonical Router, start block, runtime identity,
deployment proof, finality policy and an existing finalized launch. External
terminals can verify and index stamps independently of the hosted read model.

Robinhood's `programmable/read-model-v1` remains planned; its launch and token
feeds are empty `unavailable` projections with non-authoritative absence.
`customRegistry.publicSubmissionsEnabled` is `false`, and the V4 API, CLI and
public write path remain planned. A live direct-chain release does not promote
those surfaces. Base, BNB Chain, Arbitrum and other EVM networks are not
published through this API.

Read each capability's own status. A planned Router must never be scanned as
live, and a live Router does not establish hosted feed completeness.

The planned V4 machine contracts are available for review and client
preparation:

- [Custom Launch V4 OpenAPI](https://programmable.market/openapi/custom-launch-v4.json)
- [Custom Launch V4 source-verification status contract](https://programmable.market/schemas/custom-launch/v4/source-verification-status.json)
- [Developer V4 source-verification projection schema](https://developers.programmable.family/schemas/v2/custom-launch-source-verification-v4.schema.json)

Their availability does not establish a live endpoint, deployment, exact
source match, indexer, public launch record, trading path, or release.

## Identity

Use both forms for their intended purpose:

- numeric EVM `chainId` for the public API path and record;
- CAIP-2, such as `eip155:<chainId>`, for globally scoped storage and cross-chain interchange.

An ERC-20 is identified by chain plus contract address. The same address on two chains is two different assets. A Router launch is deduplicated by chain ID plus Router address plus Router `launchId`, and a market by its chain-scoped `marketId`.

Never key an asset by symbol, name, logo, creator, template, or address alone.

## Discovery sequence

1. Fetch `/.well-known/programmable.json`.
2. Read the advertised chain list and lifecycle state.
3. Resolve `/api/v2/manifests/{chainId}` for each selected chain. Treat the
   legacy `/api/v2/manifest` route only as the Ethereum chain-1 alias.
4. Validate chain ID, CAIP-2, manifest version, deployments, registry generations, start blocks, and endpoints.
5. Backfill the chain feed from its published boundary.
6. Store cursors with API major version, chain scope, and filter scope.
7. Refresh discovery and manifests independently from high-frequency feed polling.

Do not reuse a cursor across API versions, chains, or filter scopes.

The shared launch and token-list endpoints accept `chainId`. Omitting it keeps
the existing Ethereum behavior. Supplying a planned chain never falls back to
Ethereum, and supplying an unpublished chain returns `CHAIN_NOT_SUPPORTED`.

Fetch the current manifest for live Router roots and
`directChainIntegration.evidenceUrl`; do not copy them into consumer code.
The following selected planned manifest is an illustrative negative example,
not the current Robinhood response. Its null Router roots must fail closed:

```json
{
  "chainId": 4663,
  "caip2": "eip155:4663",
  "deployments": [],
  "customRegistry": {
    "publicSubmissionsEnabled": false,
    "address": null,
    "startBlock": null
  },
  "launchStampRouter": {
    "status": "planned",
    "address": null,
    "startBlock": null,
    "runtimeCodeHash": null,
    "deploymentEvidence": null
  },
  "customLaunchV4": {
    "status": "planned",
    "profile": null,
    "finalityPolicy": null
  },
  "extensions": {
    "programmable/read-model-v1": {
      "status": "planned",
      "absenceAuthoritative": false
    }
  }
}
```

This is a selected-field example, not a substitute for fetching and validating
the complete manifest.

## Per-chain registry generations

Each Custom Registry generation is chain-specific. Its address on one network proves nothing on another network. A valid generation needs:

- chain ID and CAIP-2 identity;
- registry version or generation;
- contract address and start block;
- verified source and manifest `runtimeCodeKeccak256` identity encoded as `0x` bytes32;
- event ABI and topics;
- authorized writers;
- lifecycle, retirement, correction, and revocation rules; and
- a finality policy appropriate to the chain.

The same `platformId` and public categories remain stable across chains. Provider, template, model, market, and partner attribution remain additional provenance.

## Chain-specific finality

Do not copy Ethereum confirmation counts to every network. Read the published finality boundary and status for the selected chain. Preserve `observed`, `confirmed`, `finalized`, and `orphaned` transitions independently per chain.

If one chain is stale or unavailable, keep other healthy chains ingesting. Do not report a global complete state when a requested chain is incomplete.

Backend finalized-feed snapshots and last-known-good caches are scoped by chain.
A successful Ethereum refresh cannot make Robinhood healthy, and a Robinhood
failure cannot downgrade Ethereum. Treat a planned or degraded chain's missing
record as unknown, never as deletion.

For V4, accept only `programmable.custom-launch-list.v4` pages whose quality is
`ready`, exhaust every opaque cursor, and require the published row count to
match the complete traversal. Every resource must remain internally bound to
the manifest's chain deployment digest, profile digest, finality-policy digest,
Router address and runtime hash. The V3 evidence model separately carries the
Robinhood L2 inclusion, Ethereum batch posting, and Ethereum finalized
checkpoint. Only a successful Router-stamped L2 launch with terminal
`ethereum_finalized` evidence is projected; the public launch position comes
from L2, while the compact extension retains the L1 finality proof. A failed
refresh may reuse the last accepted snapshot for that same chain and exact
deployment binding, but the response becomes `last-known-good`/degraded and its
absence is not authoritative.

The adapter is not a general Uniswap v4 hook crawler. A hook enters this lane
only as part of a finalized Programmable resource stamped by the manifest-bound
Router on a published chain. Arbitrary v4 hooks remain outside the Developer
launch classification.

Promotion is evidence-bound, not shape-based. The live Robinhood direct-chain
release pins its Router, immutable bindings, runtime code, finalized deployment
and existing finalized launch evidence. Clients verify those published roots
through RPC under `directChainIntegration.finality`. Its `rpc-finalized` mode
requires a canonical finalized boundary; an explicit block must be its
finalized ancestor. This mode does not claim the hosted V4 adapter's separate
L2-posting and two-provider Ethereum-checkpoint proof.

Hosted V4 promotion still requires its exact deployment/profile/finality
bindings and complete source/indexer release evidence. A syntactically valid
`live` object cannot activate that source, and the direct-chain release does
not inherit Envio promotion authority.

## Independent evidence axes

Treat these outcomes independently for each chain:

| Axis | Required evidence |
| --- | --- |
| Finality | The chain-specific policy and canonical checkpoint; Robinhood V4 additionally requires its bound L2 checkpoint and Ethereum-finality evidence |
| Exact source verification | The versioned component status; Robinhood V4 `exact_match` requires the protected-source, hosted-build, compiler/settings, finalized-transaction and bytecode binding, not a Sourcify V2 observation alone |
| Indexing | A complete cursor traversal with current `ready` quality for the exact chain and deployment binding |
| Public visibility | A record actually published by the public chain-qualified feed |

A finalized transaction can remain pending source verification and absent from
an incomplete index. An exact source match does not prove finality, indexing,
or publication. Publication does not prove trading, liquidity, fee behavior,
or safety. Robinhood publishes direct-chain deployment and finalized launch evidence; hosted indexing, public feed visibility and per-component source verification retain their own states.

## Safe client behavior

- Treat unknown advertised chains as discoverable but disable chain-specific features your client cannot support.
- Keep registered launches visible when their market kind is unknown.
- Resolve explorer and RPC metadata from trusted configuration, not creator links.
- Validate address format using the chain family before normalization.
- Partition caches, checkpoints, deduplication, and reorg recovery by chain.
- Never infer that a provider or template approved on one chain is approved on another.

See [v2 compatibility](compatibility.md), [Direct onchain verification](../reference/onchain-verification.md), and [Production operations](../operations.md).
