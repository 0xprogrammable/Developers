# Reference consumers

These dependency-free Node.js examples show the smallest safe integration with the Programmable developer API. They
discover current deployment information from the manifest, preserve unknown fields and open asset, capability, or market
types, and treat a missing token or market differently from a missing launch.

They do not quote, simulate, construct, sign, or submit transactions. A feed verification state is provenance data, not
an audit or a recommendation.

The shared client retries transient network, rate-limit, and server failures up to three times. It honors a bounded
`Retry-After` value and never changes an opaque cursor between attempts. Override the per-attempt timeout with
`PROGRAMMABLE_REQUEST_TIMEOUT_MS` or the retry count with `PROGRAMMABLE_RETRY_ATTEMPTS`.

Launch-list and token-list can return HTTP `200` with `degraded` or `unavailable` quality. Process recognized records,
keep their unavailable fields explicit, and do not treat an absent record in such a response as deletion.

## Run against the public API

Node.js 20 or later is required.

```sh
node examples/terminal-scanner.mjs
node examples/wallet-provenance.mjs 0x0000000000000000000000000000000000000000 1
node examples/indexer-cursor.mjs
node examples/app-capabilities.mjs
node examples/app-capabilities.mjs uniswap-v4:swap
node examples/profile-discovery.mjs
node examples/finalized-metadata-indexer.mjs
sh examples/curl-quickstart.sh
```

The zero address above is only command syntax. Replace it with the token address you want to inspect. No deployment or
registry address is hardcoded by any example.

## Run against local fixtures

Point every consumer at a local HTTP fixture server without changing source code:

```sh
PROGRAMMABLE_API_BASE=http://127.0.0.1:8787 node examples/terminal-scanner.mjs
PROGRAMMABLE_API_BASE=http://127.0.0.1:8787 node examples/app-capabilities.mjs
PROGRAMMABLE_API_BASE=http://127.0.0.1:8787 sh examples/curl-quickstart.sh
```

The server only needs to expose `GET /api/v2/manifest` and `GET /api/v2/launches`.

## Examples

| File | Integration pattern |
| --- | --- |
| [`lib/programmable-client.mjs`](lib/programmable-client.mjs) | Dependency-free JavaScript fetch, retry, normalization, and provenance helpers used by the runnable examples |
| [`programmable-client.ts`](programmable-client.ts) | Small typed client for discovery, status, manifest, feed pagination, launch-ID lookup, token lookup, and token-list access |
| [`terminal-scanner.mjs`](terminal-scanner.mjs) | Shows token and project-only Classic or Custom launches with zero, one, or several markets |
| [`wallet-provenance.mjs`](wallet-provenance.mjs) | Finds a token and compares its declared registry with the live manifest |
| [`indexer-cursor.mjs`](indexer-cursor.mjs) | Selects a per-chain manifest, separates page traversal from a chain-scoped durable high-water cursor, and avoids checkpointing degraded data |
| [`app-capabilities.mjs`](app-capabilities.mjs) | Detects declared capabilities and preserves project assets plus unknown future types |
| [`profile-discovery.mjs`](profile-discovery.mjs) | Reads the live Direct Native Hook Graph V2 descriptor without constructing a request or wallet transaction |
| [`finalized-metadata-indexer.mjs`](finalized-metadata-indexer.mjs) | Completes the external finalized-metadata cursor, preserves legacy missing fields, separates declared metadata from onchain name/symbol readback, validates partner attribution, and emits exact Router evidence without price, liquidity, safety, or provider-index claims |
| [`verify-launch-stamp.mjs`](verify-launch-stamp.mjs) | Dependency-light JSON-RPC verification for a Router-stamped Classic or Custom token, v4 pool, or exclusive component at the manifest-listed Router |
| [`verify-launch-stamp-viem.ts`](verify-launch-stamp-viem.ts) | Equivalent Router point lookup with viem and the same concrete-block, runtime, and record checks |
| [`curl-quickstart.sh`](curl-quickstart.sh) | Fetches the manifest, explicit status and paginated launch feed with curl |

## Live Router lookup

Verify a token or primary contract stamped at or after Router start block `25717612` directly through Ethereum JSON-RPC:

```sh
PROGRAMMABLE_RPC_URL=https://your-rpc.example \
  node examples/verify-launch-stamp.mjs token 0x1111111111111111111111111111111111111111
```

The examples discover the canonical Router address, start block, runtime hash, ABI hash, finality policy, finalized canary evidence, immutable bindings, event layouts, atomic selector, and getter descriptors from top-level `launchStampRouter`. They contain no Programmable deployment address and return `unavailable` when the Router is inactive or its required manifest evidence is incomplete. Token and exclusive-component lookups take one address; a v4 pool lookup takes its PoolManager plus PoolId. Historical launches are outside Router V1.

Both public labels use the same Router stamp. `LaunchKindV1.CustomGraph = 1` maps to `Programmable Custom`; `LaunchKindV1.Classic = 2` maps to `Programmable Classic`; `Invalid = 0` is rejected. Universal detection uses token or `(PoolManager, PoolId)`. The shared Classic hook never identifies one Classic launch, and the examples never infer a class from metadata, a hook, or a factory call. Address-based lookups also cross-check `stampProof`. The published finalized canary covers `CustomGraph`; no separate Classic onchain canary is published. A future Classic label still requires a consistent live Router stamp.

Install `viem` in an existing TypeScript project to use the typed variant:

```sh
npm install viem
```

For a durable local indexer checkpoint, choose a path explicitly:

```sh
PROGRAMMABLE_CURSOR_FILE=/tmp/programmable-cursor.json node examples/indexer-cursor.mjs
```

Set `PROGRAMMABLE_CHAIN_ID=4663` to inspect the planned Robinhood lane. It
currently returns empty `unavailable` quality and does not advance a durable
checkpoint; omitting the variable preserves Ethereum behavior.

The indexer sends the saved `resumeCursor` as `after` when polling. `nextCursor` is used only to continue the current
page traversal; the two cursor roles are never substituted for one another.

Store the complete launch record, not only the fields your current interface renders. New optional fields then remain
available without forcing an immediate consumer release. Treat a stale or degraded response as incomplete: retain
existing records, retry, and do not interpret absence as deletion.

`programmable-client.ts` deliberately types the stable core and preserves additive fields as `unknown`. Compile it with
your application's TypeScript configuration and validate returned documents against the published JSON Schemas before
persisting them.
