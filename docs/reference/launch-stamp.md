# Launch stamp router verification

The launch stamp router is an onchain provenance interface for future Programmable launches. A successful lookup answers one question: was this token, hook, v4 pool, or launch-owned component created through the canonical Programmable launch router?

It does not state that a contract is audited, safe, liquid, sellable, supported by a router, or suitable for a transaction.

## Deployment state

`launchStampRouter` in the version 2 manifest is currently `prelaunch`. Its `address`, `startBlock`, `runtimeCodeHash`, final ABI hash, permit authority, factory binding, PoolManager binding, event descriptors, getter descriptors, and atomic selector are `null` until one deployment is verified and activated.

While any required activation field is `null`, integrations must return `unavailable`. Do not replace a null with a value from a pull request, test fixture, frontend, chat, draft deployment, or copied contract.

## Scope

Router V1 covers only launches executed after its published start block:

- future Programmable Classic launches;
- future Programmable Custom launches; and
- one v4 market bound as `PoolManager + PoolId` for each stamped launch.

Historical Classic or Custom coins are not backfilled and do not acquire a router stamp. The old launch path, a direct Foundation factory call, a matching ticker, or an existing Programmable label is not a Router V1 stamp.

Both future labels use the same canonical router as their provenance source. The stamp record's frozen `LaunchKindV1` value selects the class: `Classic` or `CustomGraph`. If that value is absent, unknown, or inconsistent, preserve the launch-origin result but do not guess a Classic or Custom class.

Universal terminal detection uses the token getter or the `(PoolManager, PoolId)` getter and then reads the stamp record. The Classic hook is shared by many launches, so a hook lookup must never be used to identify or classify a Classic launch. A Custom launch-owned hook may be verified through the exclusive-component getter, but token or pool lookup remains the interoperable path.

## Trust root

Start with the official discovery document and follow its manifest URL:

```text
https://developers.programmable.family/.well-known/programmable.json
-> manifestUrl
-> launchStampRouter
```

The accepted router identity is:

```text
manifest chainId + launchStampRouter.address + launchStampRouter.startBlock
```

The manifest also pins the router runtime-code hash and ABI URL/hash. Validate those bindings before enabling lookups. Never derive a router address from an event topic, factory address, token metadata, application response, or transaction calldata.

After a nonzero lookup, the complete provenance identity is `chainId + Router address + launchId`. The start block bounds which Router events and records belong to this generation; it is not a substitute for the launch ID.

The Custom Registry, hosted launch feed, an indexer, Supabase, and the permit service are not detection dependencies. They may carry separate product data, but they do not replace or extend the router trust root.

## Consumer outcomes

Return one of these states without collapsing operational uncertainty into a negative result:

| State | Meaning | Label behavior |
| --- | --- | --- |
| `unavailable` | Router is prelaunch, required manifest data is null, or the selected chain is not active | Do not assign a router-derived label |
| `not-stamped` | A valid lookup at the canonical router returned `bytes32(0)` | Do not assign a router-derived label |
| `stamped` | The canonical router returned a nonzero launch ID and its record is consistent | Record Programmable launch provenance; classify only from `record.kind` |
| `indeterminate` | RPC, manifest, ABI, runtime, block, decoding, or cross-check evidence is incomplete or inconsistent | Keep existing asset data, but do not assign or remove a label based on this attempt |

`not-stamped` is valid only after a successful canonical lookup. A timeout, pruned block, malformed response, chain mismatch, or unavailable finalized block is `indeterminate`, not `not-stamped`.

## Point lookup algorithm

Use the same concrete block for every call in one verification:

1. Fetch and validate the official discovery document and version 2 manifest.
2. Require `launchStampRouter.status` to be `live` or, for historical reads within its published range, `retired`.
3. Require non-null router address, start block, runtime-code hash, ABI hash, event descriptors, and getter descriptors.
4. Call `eth_chainId` and require exact equality with the manifest chain ID.
5. Resolve the finalized block or a caller-supplied canonical block to a concrete block number and hash. Do not mix multiple `latest` reads.
6. Require the concrete block to be at or after `startBlock` and, for a retired generation, at or before `endBlock` when scanning new stamps.
7. Fetch router bytecode at that block and compare its EVM Keccak-256 hash with `runtimeCodeHash`.
8. Call the manifest-advertised router getter for the token or `PoolManager + PoolId`. A hook or component getter may corroborate an exclusive Custom component, but is not a universal lookup path.
9. If the result is zero, return `not-stamped`.
10. If the result is nonzero, read the stamp record at the same block and cross-check the queried identity, launch ID, market identity, nonzero stamp hash, and recognized `LaunchKindV1` value.
11. Map `LaunchKindV1.Classic` to `Programmable Classic` and `LaunchKindV1.CustomGraph` to `Programmable Custom`. Do not infer class from a hook name, token metadata, factory call, or previous platform record.

The final manifest and ABI publish the exact signatures, selectors, return layout, event topics, indexed fields, component-kind values, and `LaunchKindV1` encoding. Until those fields are non-null and artifact-matched, this algorithm intentionally stops at `unavailable`.

The dependency-light JSON-RPC example and the viem example implement this sequence:

- [JSON-RPC verifier](../../examples/verify-launch-stamp.mjs)
- [viem verifier](../../examples/verify-launch-stamp-viem.ts)

## Bulk discovery

Bulk consumers may call `eth_getLogs` without a Programmable-hosted indexer. Use all of these constraints together:

- `address` equals the exact manifest router address;
- `topic0` equals the manifest event topic derived from the pinned ABI;
- `fromBlock` equals the published router start block;
- `toBlock` respects the router end block if the generation is retired; and
- accepted logs are persisted with block hash, transaction hash, transaction index, and log index.

Apply an explicit finality and reorg policy. A log with the correct topic from any other emitter is not Programmable provenance. For high-assurance ingestion, cross-check the direct getter and record at the log block before advancing a durable checkpoint.

## Atomic launch path

Router V1 has exactly one market-bearing state-changing selector and no route-specific overload. It executes the permit-bound route selected by `LaunchKindV1` and writes the stamp in one transaction; any failed validation reverts both operations.

The write path is deliberately separate from detection:

- `CustomGraph` uses the Router's immutable Graph Factory binding;
- `Classic` uses the exact Classic V3 route and runtime committed by the permit and stamp record rather than a Router immutable;
- the permit authority is a nonzero contract and signatures are checked through EIP-1271;
- there is no EOA authority fallback;
- the EIP-712 permit binds chain, router, launch wallet, route, factory call, value, expected result, stamp request, nonce, and validity window; and
- replayed permits or nonces are rejected.

A direct call to the Single Factory is outside Router V1. Direct calls to the Classic V3 Factory or Graph Factory outside the router are also outside Router V1. None creates canonical router state, even if it deploys byte-identical contracts.

Terminals do not need a permit, authority API, factory response, Registry record, or backend response to verify an existing stamp. They read the canonical router only.

## Runtime-code evidence

The component runtime-code hash records code observed when the atomic stamp was written. Comparing it with current `EXTCODEHASH` or `keccak256(eth_getCode(...))` can detect shell-code drift.

This is point-in-time evidence. For a proxy or beacon, a matching shell hash does not prove the current implementation, beacon, admin, initialization state, or upgrade authority. Resolve and review current proxy state separately. That review does not change the historical router-origin result.

## Unsupported in Router V1

Do not assign a Router V1 label to:

- any launch before the manifest start block;
- historical launches that predate Router V1;
- Single Factory launches;
- direct Classic V3 Factory or Graph Factory launches that bypass the router;
- a Classic classification derived from the shared Classic hook;
- post-hoc or staged self-attestations;
- a copied router, event, ABI, website, signature, or metadata field;
- a pool identified by `PoolId` without its PoolManager; or
- a token whose lookup is unavailable, zero, malformed, or inconsistent.

These boundaries are provenance rules only. Trading terminals remain responsible for their own security analysis, market support, simulation, routing, and transaction policy.
