# Launch stamp Router verification

`ProgrammableLaunchStampRouterV1` is an onchain provenance interface for future Programmable launches. A valid lookup establishes that a token, v4 pool, or exclusive launch component was created through the canonical Router.

It does not state that a contract is audited, safe, liquid, sellable, tradable, supported by a terminal, or suitable for a transaction.

## Deployment state

The frozen Router V1 interface is published, but `launchStampRouter.status` is currently `prelaunch`. The ABI, ABI hash, artifact identity, events, indexed fields, getter selectors, enum values, EIP-712 permit type, and atomic selector are fixed in the manifest.

The deployment-specific fields remain `null`: Router address, start block, end block, runtime-code hash, finality confirmations, permit-authority binding, Graph Factory binding, and PoolManager binding. While any required activation field is `null`, consumers must return `unavailable`. Never fill a null from a pull request, test fixture, frontend, chat, draft deployment, or copied contract.

## Scope

Router V1 covers only launches executed through the activated Router at or after its published start block:

- future Programmable Classic launches;
- future Programmable Custom launches; and
- one v4 market identified by `PoolManager + PoolId` per stamped launch.

Historical Classic or Custom coins are not backfilled. Single Factory launches and direct Classic V3 or Graph Factory calls do not create Router provenance.

Both labels derive from the same canonical Router record:

| Solidity value | Integer | Consumer class |
| --- | ---: | --- |
| `LaunchKindV1.Invalid` | `0` | Reject |
| `LaunchKindV1.CustomGraph` | `1` | `Programmable Custom` |
| `LaunchKindV1.Classic` | `2` | `Programmable Classic` |

Universal discovery uses `launchIdByToken` or `launchIdByPool`, followed by `launchStamp`. The Classic hook is shared infrastructure and must never identify or classify a Classic launch. A Custom launch-owned hook can be an exclusive component, but token or pool lookup is the interoperable path.

## Trust root

Start at the official discovery document:

```text
https://developers.programmable.family/.well-known/programmable.json
-> manifestUrl
-> launchStampRouter
```

The Router trust tuple is:

```text
manifest chainId + launchStampRouter.address + launchStampRouter.startBlock
```

The manifest additionally pins the Router runtime-code hash, ABI URL, and published ABI-file SHA-256. Validate them before any lookup. Do not derive the Router address from a topic, factory address, token metadata, API response, transaction calldata, or copied deployment.

After a nonzero lookup, provenance identity is `chainId + Router address + launchId`. The Custom Registry, hosted launch feed, an indexer, Supabase, a server, and the permit service are not detection dependencies.

## Frozen interface

Normative ABI: [`abis/ethereum/programmable-launch-stamp-router-v1.json`](../../abis/ethereum/programmable-launch-stamp-router-v1.json)

| Binding | Value |
| --- | --- |
| Contract | `ProgrammableLaunchStampRouterV1` |
| Source commit | `0a7134bbb912222639627fb9078df2f8dd3a6c38` |
| Source tree | `24ffb0c6b04af7993254560b4f03608de8f52231` |
| ABI extraction path | `out/ProgrammableLaunchStampRouterV1.sol/ProgrammableLaunchStampRouterV1.json` |
| Published ABI SHA-256 | `bb4e728e9f9c850eb01f928e8a798ac206a82e241a8d93b3b3c686635c88ed86` |

The ABI hash is over the exact published file bytes, not normalized JSON. The Forge artifact path is an extraction reference. Its generated container is not tracked and its raw hash is intentionally not a trust field; parity is the exact `.abi` plus every `methodIdentifiers` entry at the pinned source commit and tree.

### Read selectors

| Manifest key | Signature | Selector | Result |
| --- | --- | --- | --- |
| `chainId` | `CHAIN_ID()` | `0x85e1f4d0` | chain ID |
| `permitAuthority` | `PERMIT_AUTHORITY()` | `0xc3a3d03c` | address |
| `permitAuthorityRuntimeCodeHash` | `PERMIT_AUTHORITY_RUNTIME_CODE_HASH()` | `0xa497c61c` | bytes32 |
| `graphFactory` | `GRAPH_FACTORY()` | `0x1cc9e5ce` | address |
| `graphFactoryRuntimeCodeHash` | `GRAPH_FACTORY_RUNTIME_CODE_HASH()` | `0x92989a00` | bytes32 |
| `poolManager` | `POOL_MANAGER()` | `0x62308e85` | address |
| `poolManagerRuntimeCodeHash` | `POOL_MANAGER_RUNTIME_CODE_HASH()` | `0x38d831c4` | bytes32 |
| `token` | `launchIdByToken(address)` | `0x1dad847c` | launch ID |
| `pool` | `launchIdByPool(address,bytes32)` | `0x361df6f3` | launch ID |
| `component` | `launchIdByComponent(address)` | `0x58c5e373` | launch ID |
| `componentRuntimeCodeHash` | `componentRuntimeCodeHash(address)` | `0xc892d353` | bytes32 |
| `record` | `launchStamp(bytes32)` | `0x4c9e4764` | stamp record |
| `stampProof` | `stampProof(address)` | `0x174b9f9d` | launch ID, stamp hash |

There is no `launchIdByHook` getter. `launchIdByComponent` resolves only components recorded with exclusive scope; shared infrastructure is not a launch identity.

### Events

| Event signature | Indexed inputs | `topic0` |
| --- | --- | --- |
| `ProgrammableLaunchStampedV1(bytes32,address,address,address,bytes32,bytes32)` | `launchId`, `token`, `hook` | `0x6cf479a102f1eebc9244f48f8d68f6aa52b4c5a4516318df58ba46614a5b14f2` |
| `ProgrammableLaunchRouteStampedV1(bytes32,uint8,bytes32,bytes32,bytes32)` | `launchId`, `kind`, `routePayloadHash` | `0x45e7cc355b63ca67d6278a0d8d23470ce2a0741a9c60283d7dee712df7a877a5` |
| `ProgrammableComponentStampedV1(bytes32,address,uint8,bytes32)` | `launchId`, `component`, `kind` | `0x8147265e7396d6400cee8d049456a1f7438fdfbe2a7c81c976d51ba67e52ff4b` |

The non-indexed launch fields are `poolManager`, `poolId`, and `stampHash`. The non-indexed route fields are `expectedResultHash` and `permitDigest`. The non-indexed component field is `runtimeCodeHash`.

### Stamp record

`launchStamp(bytes32 launchId)` returns one `StampRecordV1` tuple in this order:

| Index | Field | Type |
| ---: | --- | --- |
| 0 | `kind` | `uint8` |
| 1 | `launchWallet` | `address` |
| 2 | `token` | `address` |
| 3 | `hook` | `address` |
| 4 | `poolManager` | `address` |
| 5 | `poolId` | `bytes32` |
| 6 | `poolKeyHash` | `bytes32` |
| 7 | `componentSetHash` | `bytes32` |
| 8 | `routePayloadHash` | `bytes32` |
| 9 | `routeLauncher` | `address` |
| 10 | `routeLauncherRuntimeCodeHash` | `bytes32` |
| 11 | `expectedResultHash` | `bytes32` |
| 12 | `permitDigest` | `bytes32` |
| 13 | `stampHash` | `bytes32` |

For an address-based lookup, `stampProof(address)` must return the same nonzero `launchId` and the record's `stampHash`.

## Consumer outcomes

| State | Meaning |
| --- | --- |
| `unavailable` | Router is prelaunch, the chain is inactive, or required manifest activation data is null |
| `not-stamped` | A valid canonical lookup returned `bytes32(0)` |
| `stamped` | A nonzero lookup and its record, proof, identity, and bindings are consistent |
| `indeterminate` | RPC, ABI, runtime, block, decoding, or cross-check evidence is incomplete or inconsistent |

Only a successful canonical zero lookup is `not-stamped`. A timeout, pruned block, malformed response, chain mismatch, or unavailable finalized block is `indeterminate`.

## Deterministic point lookup

Use the same concrete block for all reads in one result:

1. Fetch the official discovery document and manifest.
2. Require status `live`, or `retired` for a historical read within the published range.
3. Require the complete trust tuple, deployment bindings, runtime hash, ABI hash, event descriptors, and getter descriptors.
4. Require `eth_chainId` to equal the manifest `chainId`.
5. Resolve a finalized block or a caller-supplied canonical block to a concrete block number and hash. Do not mix `latest` reads.
6. Enforce `startBlock` and, if retired, `endBlock`.
7. Read Router code at that block and require its EVM Keccak-256 to equal `runtimeCodeHash`.
8. Hash the fetched ABI bytes with SHA-256; validate every advertised selector, topic, and indexed layout against that ABI.
9. At the same block, call `CHAIN_ID`, all six immutable binding getters, and `eth_getCode` for the permit authority, Graph Factory, and PoolManager. Require exact manifest address and runtime-hash matches.
10. Call `launchIdByToken(token)` or `launchIdByPool(poolManager,poolId)`. Use `launchIdByComponent(component)` only for an explicitly exclusive component.
11. If the result is zero, return `not-stamped`.
12. Read `launchStamp(launchId)` at the same block. Require a recognized nonzero `kind`, the queried token or pool identity, the immutable PoolManager, and nonzero commitment fields.
13. For a token or component, require `stampProof(address)` to match both `launchId` and `stampHash`.
14. For `CustomGraph`, require the record's route launcher and runtime hash to match the immutable Graph Factory binding. For `Classic`, retain the permit-bound route launcher and runtime from the record; do not invent a Classic immutable.
15. Classify only from `record.kind`.

Runnable implementations:

- [dependency-light JSON-RPC verifier](../../examples/verify-launch-stamp.mjs)
- [viem verifier](../../examples/verify-launch-stamp-viem.ts)

## Bulk discovery

For `eth_getLogs`, use all of the following:

- `address` equals the exact manifest Router address;
- `topic0` equals one of the manifest topics derived from the pinned ABI;
- `fromBlock` is the Router start block;
- `toBlock` respects the Router end block when retired; and
- each stored log retains block hash, transaction hash, transaction index, and log index.

Apply an explicit confirmation and reorg policy. A log with the correct topic from any other emitter is not Programmable provenance. Cross-check point getters and the record at the log's concrete block before advancing a durable checkpoint.

## Atomic write path

Router V1 exposes exactly one payable market-bearing entry point:

```text
launchAndStampV1(
  (uint256,address,address,uint8,bytes32,bytes32,bytes32,bytes32,uint64,uint64,uint256),
  (bytes32,address,bytes32,(address,address,uint24,int24,address),bytes32,(uint8,address,bytes32,uint8,uint8)[]),
  bytes,
  bytes
) -> bytes32 stampHash

selector: 0xe5f6b8cd
```

The route execution and stamp write are atomic. `CustomGraph` uses the immutable Graph Factory. `Classic` uses the exact permit- and record-bound Classic route. The permit authority must be a nonzero EIP-1271 contract; there is no EOA authority fallback.

EIP-712 domain:

```text
name: ProgrammableLaunchStampRouter
version: 1
primaryType: ProgrammableLaunchPermitV1
```

Exact permit type:

```text
ProgrammableLaunchPermitV1(uint256 chainId,address router,address launchWallet,uint8 kind,bytes32 routePayloadHash,bytes32 expectedResultHash,bytes32 stampRequestHash,bytes32 nonce,uint64 validAfter,uint64 deadline,uint256 value)
```

Type hash:

```text
0x5147473bd302ad67f9ef14ef9262d1b0f8d4f7155081bc8c508195b647413761
```

Direct calls to the Classic V3 Factory or Graph Factory outside the Router do not write canonical provenance. Single Factory is outside Router V1.

## Revert interface

The full ABI is normative. Router V1 publishes these custom errors:

```text
ComponentAlreadyStamped(address,bytes32)
DuplicateOrUnsortedComponent(address,address)
FactoryResultMismatch(uint8,uint256)
InvalidArrayLength(uint8,uint256,uint256)
InvalidBinding(uint8)
InvalidComponent(address,bytes32,bytes32)
InvalidPermitSignature()
InvalidShortString()
LaunchAlreadyStamped(bytes32)
NonCanonicalRoutePayload()
NonceAlreadyUsed(address,bytes32)
PermitAlreadyUsed(bytes32)
PermitOutsideValidityWindow(uint256,uint256,uint256)
PoolAlreadyInitialized(address,bytes32)
PoolAlreadyStamped(address,bytes32,bytes32)
ReentrancyGuardReentrantCall()
ResidualLaunchValue(uint256,uint256)
StringTooLong(string)
UnauthorizedLaunchWallet(address,address)
UnsupportedLaunchKind(uint8)
```

Consumers that decode errors must derive selectors from the pinned ABI and preserve unknown errors.

## Runtime-code limitations

Component and route runtime-code hashes record code observed when the stamp was written. A point-in-time match can detect shell-code drift, but for a proxy or beacon it does not establish the current implementation, beacon, admin, initialization state, or upgrade authority. Resolve those separately without changing the historical Router-origin result.

## Unsupported in Router V1

Do not assign a Router V1 label to:

- a launch before `startBlock` or a historical launch not executed through Router V1;
- Single Factory or direct Classic V3/Graph Factory launches;
- a Classic launch inferred from the shared Classic hook;
- a post-hoc self-attestation;
- a copied Router, event, ABI, website, signature, or metadata field;
- a pool identified by `PoolId` without its PoolManager; or
- an unavailable, zero, malformed, or inconsistent lookup.

These are provenance rules. Terminals retain their own security, market-support, simulation, routing, and transaction policies.
