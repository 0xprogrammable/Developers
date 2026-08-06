# Multi-chain discovery

The integration is chain-aware and designed to add EVM networks without requiring a new terminal category or a client release for each launch. A chain is active only when it is advertised by the canonical discovery and manifest surfaces.

## Current status

Ethereum Mainnet is the only active chain in the current well-known document. Base, BNB Chain, Arbitrum, and other EVM networks are not live through this API unless a later discovery document explicitly lists them.

Architecture readiness is not production support. Do not preconfigure a planned chain as live.

## Identity

Use both forms for their intended purpose:

- numeric EVM `chainId` for the public API path and record;
- CAIP-2, such as `eip155:<chainId>`, for globally scoped storage and cross-chain interchange.

An ERC-20 is identified by chain plus contract address. The same address on two chains is two different assets. A launch is deduplicated by its globally scoped `launchId`, and a market by its chain-scoped `marketId`.

Never key an asset by symbol, name, logo, creator, template, or address alone.

## Discovery sequence

1. Fetch `/.well-known/programmable.json`.
2. Read the advertised chain list and lifecycle state.
3. Resolve the current manifest for each active chain.
4. Validate chain ID, CAIP-2, manifest version, deployments, registry generations, start blocks, and endpoints.
5. Backfill the chain feed from its published boundary.
6. Store cursors with API major version, chain scope, and filter scope.
7. Refresh discovery and manifests independently from high-frequency feed polling.

Do not reuse a cursor across API versions, chains, or filter scopes.

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

## Safe client behavior

- Treat unknown advertised chains as discoverable but disable chain-specific features your client cannot support.
- Keep registered launches visible when their market kind is unknown.
- Resolve explorer and RPC metadata from trusted configuration, not creator links.
- Validate address format using the chain family before normalization.
- Partition caches, checkpoints, deduplication, and reorg recovery by chain.
- Never infer that a provider or template approved on one chain is approved on another.

See [v2 compatibility](compatibility.md), [Direct onchain verification](../reference/onchain-verification.md), and [Production operations](../operations.md).
