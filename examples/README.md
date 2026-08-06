# Reference consumers

These dependency-free Node.js examples show the smallest safe integration with the Programmable developer API. They
discover current deployment information from the manifest, preserve unknown fields and open asset, capability, or market
types, and treat a missing token or market differently from a missing launch.

They do not quote, simulate, construct, sign, or submit transactions. A feed verification state is provenance data, not
an audit or a recommendation.

The shared client retries transient network, rate-limit, and server failures up to three times. It honors a bounded
`Retry-After` value and never changes an opaque cursor between attempts. Override the per-attempt timeout with
`PROGRAMMABLE_REQUEST_TIMEOUT_MS` or the retry count with `PROGRAMMABLE_RETRY_ATTEMPTS`.

## Run against the public API

Node.js 20 or later is required.

```sh
node examples/terminal-scanner.mjs
node examples/wallet-provenance.mjs 0x0000000000000000000000000000000000000000 1
node examples/indexer-cursor.mjs
node examples/app-capabilities.mjs
node examples/app-capabilities.mjs uniswap-v4:swap
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
| [`indexer-cursor.mjs`](indexer-cursor.mjs) | Separates page traversal from a durable high-water cursor and avoids checkpointing degraded data |
| [`app-capabilities.mjs`](app-capabilities.mjs) | Detects declared capabilities and preserves project assets plus unknown future types |
| [`curl-quickstart.sh`](curl-quickstart.sh) | Fetches the manifest and paginated launch feed with curl |

For a durable local indexer checkpoint, choose a path explicitly:

```sh
PROGRAMMABLE_CURSOR_FILE=/tmp/programmable-cursor.json node examples/indexer-cursor.mjs
```

The indexer sends the saved `resumeCursor` as `after` when polling. `nextCursor` is used only to continue the current
page traversal; the two cursor roles are never substituted for one another.

Store the complete launch record, not only the fields your current interface renders. New optional fields then remain
available without forcing an immediate consumer release. Treat a stale or degraded response as incomplete: retain
existing records, retry, and do not interpret absence as deletion.

`programmable-client.ts` deliberately types the stable core and preserves additive fields as `unknown`. Compile it with
your application's TypeScript configuration and validate returned documents against the published JSON Schemas before
persisting them.
