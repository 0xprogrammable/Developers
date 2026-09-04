# Quickstart

Verify a Programmable launch or read the hosted feed. Both paths are read-only;
neither requires a Programmable API key or a wallet.

## Choose a chain

| Chain | First integration |
| --- | --- |
| Robinhood Chain Mainnet · `4663` | [Verify a Router stamp](#verify-a-robinhood-launch) |
| Ethereum Mainnet · `1` | [Read the hosted feed](#read-the-ethereum-feed) or [verify a Router stamp](reference/launch-stamp.md) |

Robinhood's direct-chain integration is live. Its hosted read model and public
self-serve V4 API/CLI remain planned. Check [integration status](status.md) before
using a path in production.

## Discover the contracts

```sh
curl -fsSL https://developers.programmable.family/.well-known/programmable.json
```

Select the entry with the required `chainId`, then fetch its `manifestUrl`.
Resolve addresses, start blocks, ABIs and runtime hashes from that manifest.
The `/api/v2/manifest` compatibility alias always refers to Ethereum.

## Verify a Robinhood launch

Requires Node.js 20 or later and an RPC that supports finalized, historical
block-hash reads. No package installation is required.

```sh
git clone https://github.com/programmablehq/Developers.git
cd Developers
PROGRAMMABLE_RPC_URL=https://rpc-robinhood.blockmachine.io \
  node examples/verify-robinhood-release.mjs
```

This verifies the existing finalized launch referenced by the chain-4663
manifest. It checks the canonical Router, its runtime and immutable bindings,
and the token's launch stamp and component proofs.

A successful result includes:

```json
{
  "state": "stamped",
  "category": "custom",
  "publicLabel": "Programmable Custom"
}
```

This is a result excerpt. If a required read or check cannot complete, the
verifier returns `indeterminate`. Use a suitable RPC and retry; do not treat
that result as an absent token or substitute `latest` for finality.

To verify another token, replace `<token-address>` below:

```sh
PROGRAMMABLE_CHAIN_ID=4663 \
PROGRAMMABLE_RPC_URL=https://rpc-robinhood.blockmachine.io \
  node examples/verify-launch-stamp.mjs token '<token-address>'
```

The [Robinhood terminal guide](guides/robinhood-terminal-indexer.md) explains
continuous indexing. The [Router reference](reference/launch-stamp.md) specifies
the complete verification algorithm and finalized test vectors.

## Read the Ethereum feed

Check chain status, fetch its manifest, then request the first page:

```sh
curl -fsSL 'https://developers.programmable.family/api/v2/status?chainId=1'
curl -fsSL https://developers.programmable.family/api/v2/manifests/1
curl -fsSL 'https://developers.programmable.family/api/v2/launches?chainId=1&limit=25'
```

The response contains `status`, `snapshot`, `items` and `page`. Check its quality
alongside the records. HTTP `200` does not establish a complete index.

1. Process `items`, preserving null fields and recognized launches with no market.
2. Continue with `page.nextCursor` while `page.hasMore` is true. Keep the same
   chain and filters on every request.
3. Persist `page.resumeCursor` only after the traversal and records are durably
   committed. Use it as `after` for the next incremental poll.
4. Treat degraded or unavailable coverage as incomplete. An absent record is
   not evidence of deletion.

The [hosted feed reference](reference/hosted-feed.md) contains the complete
JavaScript ingestion example, bounded retries, durable checkpoints and failure
handling. The [example directory](../examples/README.md) contains runnable consumers.

## Before production

Use the [integration checklist](integration-checklist.md). Preserve the distinction
between launch provenance and current metadata, liquidity, fees or execution support.
A `Programmable Custom` label requires verified canonical evidence.

To prepare and submit a launch, use the separate [Custom Launch API guide](https://programmable.market/docs/developers/custom-launch).
Its [Robinhood V4 OpenAPI](https://programmable.market/openapi/custom-launch-v4.json)
remains a planned contract. Source verification uses the
[API status contract](https://programmable.market/schemas/custom-launch/v4/source-verification-status.json)
and [Developer projection schema](https://developers.programmable.family/schemas/v2/custom-launch-source-verification-v4.schema.json).
The controller wallet reviews, signs and broadcasts separately.
