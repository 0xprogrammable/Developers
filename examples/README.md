# Examples

Read-only consumers for launch discovery, hosted feeds and onchain stamp
verification. The `.mjs` examples require Node.js 20 or later and no package
installation. The TypeScript stamp verifier uses `viem`.

Run commands from the repository root. Choose the chain explicitly when using
a chain-aware consumer; omitting it preserves the Ethereum default.

## Verify the published Robinhood launch

```sh
PROGRAMMABLE_RPC_URL=https://rpc-robinhood.blockmachine.io \
  node examples/verify-robinhood-release.mjs
```

[verify-robinhood-release.mjs](verify-robinhood-release.mjs) discovers the chain
manifest and derives the existing token from its finalized Router receipt.
It verifies the Router runtime, immutable bindings, launch ID, stamp hash and
component proofs. No new launch, API key or wallet is required.

Use an RPC that serves canonical finalized and historical block-hash reads.
An incomplete verification returns `indeterminate`; it does not grant attribution
or establish that the token is absent.

## Verify a token or pool

Replace `<token-address>` with the address to inspect:

```sh
PROGRAMMABLE_CHAIN_ID=4663 \
PROGRAMMABLE_RPC_URL=https://rpc-robinhood.blockmachine.io \
  node examples/verify-launch-stamp.mjs token '<token-address>'
```

Use `PROGRAMMABLE_CHAIN_ID=1` and an Ethereum RPC for Ethereum.
The [generic verifier](verify-launch-stamp.mjs) also accepts a pool query:

```sh
PROGRAMMABLE_CHAIN_ID=4663 \
PROGRAMMABLE_RPC_URL=https://rpc-robinhood.blockmachine.io \
  node examples/verify-launch-stamp.mjs pool '<pool-manager>' '<pool-id>'
```

Resolve the PoolManager and pool ID from verified launch evidence. The verifier
resolves Router addresses, start blocks, ABI hashes, runtime identities and
finality policy from the selected chain manifest.

CustomGraph (`1`) maps to `Programmable Custom`; Classic (`2`) maps to
`Programmable Classic`. Invalid or inconsistent records receive no label.
The shared Classic hook cannot identify an individual launch. Address-based
lookups also require the matching `stampProof`.

Ethereum publishes finalized Custom and Classic V4 examples; Robinhood publishes
a finalized Custom example. Router V1 covers only launches stamped within its
published block range. See the [Router reference](../docs/reference/launch-stamp.md).

For an existing TypeScript project, use
[verify-launch-stamp-viem.ts](verify-launch-stamp-viem.ts) with `viem` installed.
Pass `chainId: 4663` for Robinhood and an archive-capable RPC. These helpers
perform reads only.

## Read a hosted feed

```sh
PROGRAMMABLE_CHAIN_ID=1 sh examples/curl-quickstart.sh
PROGRAMMABLE_CHAIN_ID=1 node examples/indexer-cursor.mjs
node examples/terminal-scanner.mjs
```

The hosted Robinhood read model remains planned. Requests for chain `4663`
can return `unavailable` quality and must not advance a durable checkpoint.
Use direct stamp verification for the live Robinhood integration.

For a persistent checkpoint, select a writable path:

```sh
PROGRAMMABLE_CHAIN_ID=1 \
PROGRAMMABLE_CURSOR_FILE=/tmp/programmable-cursor.json \
  node examples/indexer-cursor.mjs
```

`nextCursor` continues a page traversal. Commit its records before persisting
`resumeCursor`, then send that value as `after` when polling. Keep chain and
filter scope unchanged. See the [hosted feed reference](../docs/reference/hosted-feed.md)
for the complete algorithm.

## Example directory

| File | Purpose |
| --- | --- |
| [verify-robinhood-release.mjs](verify-robinhood-release.mjs) | Verify the Robinhood launch referenced by the live manifest |
| [verify-launch-stamp.mjs](verify-launch-stamp.mjs) | Verify a token, pool or exclusive component through JSON-RPC |
| [verify-launch-stamp-viem.ts](verify-launch-stamp-viem.ts) | TypeScript stamp-verification helper using viem |
| [curl-quickstart.sh](curl-quickstart.sh) | Fetch chain status, manifest and a paginated feed |
| [indexer-cursor.mjs](indexer-cursor.mjs) | Follow a chain-scoped feed with a durable checkpoint |
| [terminal-scanner.mjs](terminal-scanner.mjs) | Display recognized launches and their available markets |
| [wallet-provenance.mjs](wallet-provenance.mjs) | Resolve token metadata and compare Registry provenance |
| [app-capabilities.mjs](app-capabilities.mjs) | Read declared capabilities and preserve unknown types |
| [finalized-metadata-indexer.mjs](finalized-metadata-indexer.mjs) | Follow the separate Ethereum V3 finalized-metadata ledger |
| [profile-discovery.mjs](profile-discovery.mjs) | Inspect the historical, read-only Direct Native Hook Graph V2 descriptor |
| [programmable-client.ts](programmable-client.ts) | Typed read API client for use in an existing TypeScript project |
| [lib/programmable-client.mjs](lib/programmable-client.mjs) | Fetch, retry and normalization helpers used by the JavaScript examples |

## Run against fixtures

Override the API base to use a local fixture server:

```sh
PROGRAMMABLE_API_BASE=http://127.0.0.1:8787 \
PROGRAMMABLE_CHAIN_ID=1 sh examples/curl-quickstart.sh
```

Serve the routes used by the selected consumer: discovery, the chain-qualified
manifest, status and launch feed, plus any requested token or launch detail.
Fixtures do not establish live deployment or feed availability.

The shared client bounds retries and honors `Retry-After`. Configure
`PROGRAMMABLE_REQUEST_TIMEOUT_MS` and `PROGRAMMABLE_RETRY_ATTEMPTS` when needed.
Preserve unknown fields, null metadata and recognized launches with no market.
A degraded response does not establish deletion.
