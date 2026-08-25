# Launch stamp Router verification

`ProgrammableLaunchStampRouterV1` is an onchain provenance interface for Router-stamped Programmable launches. A valid lookup establishes that the exact canonical Router atomically executed and stamped the recorded launch. It also establishes that the recorded v4 pool was uninitialized before route execution and initialized before the stamp was written.

It does not universally prove that each Classic component was newly created. It does not establish current pool state or current liquidity, and it does not state that a contract is audited, safe, sellable, tradable, supported by a terminal, or suitable for a transaction.

## Deployment state

The frozen Router V1 interface and one Ethereum deployment are published. The contract at `0x8622DD5bAb44185f2A458ac90384Ac99248f8d56` was mined in block `25717612` and observed finalized at block `25717634`. The manifest's `deploymentEvidence` object pins the transaction, both block hashes, runtime identities, immutable getter observations, and evidence hashes. Its `verificationStatus: finalized-verified` describes those deployment, runtime, and getter observations; it is not an Explorer source-publication status.

Router V1 is live on Ethereum for stamps written at or after block `25717612`. The manifest requires `64` confirmations for an explicit block-number read. Historical launches are not backfilled.

### Active manifest tuple

| Field | Value |
| --- | --- |
| `status` | `live` |
| Manifest `chainId` | `1` |
| `address` | `0x8622DD5bAb44185f2A458ac90384Ac99248f8d56` |
| `startBlock` | `25717612` |
| `endBlock` | `null` |
| `runtimeCodeHash` | `0x40e27ecf201761d5eb66bc4f2d5c6124831ef078d7baf458ca5f41b1a8108546` |
| `abiUrl` | `https://developers.programmable.family/abis/ethereum/programmable-launch-stamp-router-v1.json` |
| `abiSha256` | `sha256:bb4e728e9f9c850eb01f928e8a798ac206a82e241a8d93b3b3c686635c88ed86` |
| `finalityConfirmations` | `64` |
| `bindings.permitAuthority` | `0x755509eA6e3F5Ec1aA2E797bb68f1B87DD8b886b` |
| `bindings.permitAuthorityRuntimeCodeHash` | `0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c` |
| `bindings.graphFactory` | `0xB012e4A8F2c5FC4E8E4faCA9D5Ad6FfF13FBA887` |
| `bindings.graphFactoryRuntimeCodeHash` | `0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8` |
| `bindings.poolManager` | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| `bindings.poolManagerRuntimeCodeHash` | `0x785f1014552b7ce7d5fb7d0c970ca60edee94fd00425d7ca21609acac7ce1293` |

### Finalized deployment evidence

| Field | Value |
| --- | --- |
| Address | `0x8622DD5bAb44185f2A458ac90384Ac99248f8d56` |
| Deployment transaction | `0x3bc086661555c10040feb3fceb23d33003e22ca033e65cfae72592119ee8d486` |
| Deployment block | `25717612` |
| Deployment block hash | `0x8e4512193217c2171624657717d32dbfe9896455e553cadc192fbfe32d3278bc` |
| Finalized observation block | `25717634` |
| Finalized observation block hash | `0x4177a280cd7e43da181bf1d73900eb2431c26d5fe933a5ed0e583370064cbd6e` |
| Finality depth at observation | `22` blocks |
| Runtime length | `23013` bytes |
| Runtime Keccak-256 | `0x40e27ecf201761d5eb66bc4f2d5c6124831ef078d7baf458ca5f41b1a8108546` |
| Runtime SHA-256 | `0b0e89074bff270bd5bf80ca9642f748dca1857d1ab643cbce65f4f663937ec7` |
| Getter bundle SHA-256 | `6e6e8a93193bbe2f79f98594a1af32c27bae0746f8297dd13592d9608e2feb20` |
| Complete evidence SHA-256 | `f9786ebfb74c96a3c225567ad324f0fbecfd8520b8d8addec85ba58cd67e19ff` |

The getter bundle records `CHAIN_ID = 1`, permit authority `0x755509eA6e3F5Ec1aA2E797bb68f1B87DD8b886b`, Graph Factory `0xB012e4A8F2c5FC4E8E4faCA9D5Ad6FfF13FBA887`, and PoolManager `0x000000000004444c5dc75cB358380D2e3dE08A90`, together with their runtime-code hashes. The active manifest bindings match these observations exactly.

### Finalized PCAN test vector

Activation is bound to the finalized deployment evidence above and one approved finalized Router canary. This is the finalized PCAN test vector. `PCAN` is its human-readable token symbol, not an additional launch or trust identifier. The machine-readable vector is `launchStampRouter.canaryEvidence` in `GET https://developers.programmable.family/api/v2/manifest` (JSON Pointer `/launchStampRouter/canaryEvidence`). The published onchain route coverage is exact: `CustomGraph` is covered; no separate Classic onchain canary is published.

| Field | Value |
| --- | --- |
| `finality` | `finalized` |
| `routeCoverage.customGraphOnchainCanary` | `true` |
| `routeCoverage.classicOnchainCanary` | `false` |
| `source.sourceRepository` | `https://github.com/0xprogrammable/programmable` |
| `source.sourceCommit` | `b3cfed41bb841ae8d6188dbb815eddb5e1440218` |
| `source.commitSubject` | `Add graph launch stamp canary` |
| `transactionHash` | `0xc07b4e70233534a1d4f435ffc9a636ed5f542f4aedcde35052c58224f378b612` |
| `blockNumber` | `25717953` |
| `blockHash` | `0x97827b6586f0dca00e44801acc529c3961b4c693988dfc9f4b2bb4c3d94632ba` |
| `launchId` | `0x5a52180427785716bff0a36218dde89f0459db265d0c2bdfcfde81a8fe733c92` |
| `stampHash` | `0x06cb71b38d9b8b1dd1ffcdb00f31c774be36f5473979c3831d5fd0c96cdaa579` |
| `launchKind` | `1` (`CustomGraph`) |
| `components.initializer` | `0x87B108848B444bC44A01734D62C7be4a2fA64983` |
| `components.token` | `0x9DEeB39D2590b0cAD5fc473F755C5F97Dcc8f7cE` |
| `components.hook` | `0xEBa46f25DfF528141dE5317109Acb5A989296044` |
| `pool.poolManager` | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| `pool.poolId` | `0x5c5a3ebee6840640642ba2bea526621a4962d2c89c388c36a2edb4725802a229` |
| `pool.activeLiquidity` | `31618002430832353916` |
| `lpPosition.positionManager` | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` |
| `lpPosition.tokenId` | `367610` |
| `lpPosition.owner` | `0x2Bb333d48DFAF1596D9036671d2E43168994249E` |
| `platformFee.feePips` | `1000` |
| `platformFee.recipient` | `0x4957f49620AFf3Adbbe8195a4f633E49cc93376c` |
| `tokenTotalSupply` | `1000000000000000000000000` |
| `evidenceFileSha256` | `sha256:1325d1333b6df9545cb87048e2b8d1c57a63af5b6790c329c0e95157a0d16d2c` |
| `evidenceLineSha256` | `sha256:615a20b31f454afb020a8fa83653c7685328e3f12ad58d3ac11ddab2d02968b5` |

Each published component proof returns the same launch ID and stamp hash:

| `stampProofs[].component` | `stampProofs[].launchId` | `stampProofs[].stampHash` |
| --- | --- | --- |
| `0x87B108848B444bC44A01734D62C7be4a2fA64983` | `0x5a52180427785716bff0a36218dde89f0459db265d0c2bdfcfde81a8fe733c92` | `0x06cb71b38d9b8b1dd1ffcdb00f31c774be36f5473979c3831d5fd0c96cdaa579` |
| `0x9DEeB39D2590b0cAD5fc473F755C5F97Dcc8f7cE` | `0x5a52180427785716bff0a36218dde89f0459db265d0c2bdfcfde81a8fe733c92` | `0x06cb71b38d9b8b1dd1ffcdb00f31c774be36f5473979c3831d5fd0c96cdaa579` |
| `0xEBa46f25DfF528141dE5317109Acb5A989296044` | `0x5a52180427785716bff0a36218dde89f0459db265d0c2bdfcfde81a8fe733c92` | `0x06cb71b38d9b8b1dd1ffcdb00f31c774be36f5473979c3831d5fd0c96cdaa579` |

The canary source commit is separate from the deployed Router artifact source commit `0a7134bbb912222639627fb9078df2f8dd3a6c38`; it does not replace the Router artifact binding. The two evidence SHA-256 values are supplied handoff digests, not files downloaded and recomputed in this repository.

The liquidity, LP position, fee, and supply fields are observations at canary block `25717953`. They do not establish current liquidity, safety, audit status, sellability, tradability, route support, or third-party integration. The frozen Router source and tests cover both launch kinds through the same live ABI, but only `CustomGraph` has the published onchain canary. A future Classic launch qualifies only when the live Router writes a consistent `LaunchKindV1.Classic` stamp.

### Guarantee and product boundary

Only a launch with a consistent record written by the exact canonical Router on chain `1` at or after `startBlock` is Programmable through Router V1. The record proves that the Router atomically executed and stamped that launch, with the recorded pool uninitialized before route execution and initialized before the stamp. It does not universally prove that every Classic component was newly created. The same ABI, bytecode, event topics, metadata, logo, signer, or factory result from any other emitter does not qualify. Direct Classic V3 Factory, Graph Factory, and Single Factory calls outside the Router do not qualify.

Publication makes this verification contract available to terminals; it does not mean GMGN, Axiom, FOMO, or another named terminal has integrated it automatically. The separately documented [Custom Launch API V1](https://programmable.market/developers/custom-launch-api-v1.md) currently exposes no write path: POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY`, and the closed GitHub approval flow must not be revived. These docs define read-only detection and verification; an API key is never wallet signing or broadcast authority.

Generic discovery of the PCAN token or v4 pool through GMGN's `uniswap_v4` and `poolId` fields is ordinary token and pool discovery. It is not verification of the canonical Router stamp and does not show that GMGN integrated the Programmable label. Treat third-party market metrics as third-party observations, not canonical onchain evidence. Verify provenance through the Router and read current pool state separately through PoolManager or StateView.

## Scope

Router V1 covers only launches executed through the live Router at or after its published start block:

- Programmable Classic launches with a valid Router stamp;
- Programmable Custom launches with a valid Router stamp; and
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
| Hosted ABI URL | `https://developers.programmable.family/abis/ethereum/programmable-launch-stamp-router-v1.json` |
| Source commit | `0a7134bbb912222639627fb9078df2f8dd3a6c38` |
| Source tree | `24ffb0c6b04af7993254560b4f03608de8f52231` |
| ABI extraction path | `out/ProgrammableLaunchStampRouterV1.sol/ProgrammableLaunchStampRouterV1.json` |
| Published ABI SHA-256 | `sha256:bb4e728e9f9c850eb01f928e8a798ac206a82e241a8d93b3b3c686635c88ed86` |

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
| `unavailable` | Router is not live for the requested block, the chain is inactive, or required manifest activation data is incomplete |
| `not-stamped` | A valid canonical lookup returned `bytes32(0)` |
| `stamped` | A nonzero lookup and its record, proof, identity, and bindings are consistent |
| `indeterminate` | RPC, ABI, runtime, block, decoding, or cross-check evidence is incomplete or inconsistent |

Only a successful canonical zero lookup is `not-stamped`. A timeout, pruned block, malformed response, chain mismatch, or unavailable finalized block is `indeterminate`.

## Deterministic point lookup

Bind all reads in one result to one canonical block:

1. Fetch the official discovery document and manifest.
2. Require status `live`, or `retired` for a historical read within the published range.
3. Require the complete trust tuple, finalized canary evidence, deployment bindings, runtime hash, ABI hash, event descriptors, and getter descriptors.
4. Require `eth_chainId` to equal the manifest `chainId`.
5. Resolve a finalized block or a caller-supplied canonical block to a concrete block number and hash. For an explicit block-number read, require the manifest's `64` confirmations. Do not mix `latest` reads. Use EIP-1898 `{ blockHash, requireCanonical: true }` for every `eth_getCode` and `eth_call` when the provider supports it. Otherwise use the resolved number for every read, then fetch that height again and require the closing hash to equal the opening hash before returning `stamped` or `not-stamped`.
6. Enforce `startBlock` and, if retired, `endBlock`.
7. Read Router code at that block and require its EVM Keccak-256 to equal `runtimeCodeHash`.
8. Hash the fetched ABI bytes with SHA-256; validate every advertised selector, topic, and indexed layout against that ABI.
9. At the same canonical block, call `CHAIN_ID`, all six immutable binding getters, and `eth_getCode` for the permit authority, Graph Factory, and PoolManager. Require exact manifest address and runtime-hash matches.
10. Call `launchIdByToken(token)` or `launchIdByPool(poolManager,poolId)`. Use `launchIdByComponent(component)` only for an explicitly exclusive component.
11. If the result is zero, return `not-stamped`.
12. Read `launchStamp(launchId)` at the same canonical block. Require a recognized nonzero `kind`, the queried token or pool identity, the immutable PoolManager, and nonzero commitment fields.
13. For a token or component, require `stampProof(address)` to match both `launchId` and `stampHash`.
14. For `CustomGraph`, require the record's route launcher and runtime hash to match the immutable Graph Factory binding. For `Classic`, retain the permit-bound route launcher and runtime from the record; do not invent a Classic immutable.
15. Complete the closing block-hash check when number-bound reads were used. Classify only from `record.kind`.

Remote RPC URLs must use HTTPS. Plaintext HTTP is accepted only for loopback development endpoints.

Runnable implementations:

- [dependency-light JSON-RPC verifier](../../examples/verify-launch-stamp.mjs)
- [viem verifier](../../examples/verify-launch-stamp-viem.ts)

## Onchain backfill and live follow

Use one gap-free sequence for Router events:

1. Resolve the manifest and verify the Router identity, runtime, ABI URL, ABI SHA-256, events, getters, bindings, and finality policy.
2. Backfill `eth_getLogs` from `startBlock` in bounded chunks. Filter by the exact manifest Router address and the complete manifest `topic0` set; respect `endBlock` if the Router is retired.
3. Persist block number and hash, transaction hash and index, and log index for every candidate. Use those coordinates as the idempotency key.
4. At the same canonical block, cross-check the relevant `launchIdByToken`, `launchIdByPool`, or exclusive `launchIdByComponent` result, then `launchStamp`; use `stampProof` for address-based token or component checks.
5. Advance a durable checkpoint only through the finalized boundary. Apply the manifest's `64` confirmations to an explicit block-number boundary, or use the canonical finalized block.
6. Replay an overlap window on every run. Deduplicate identical coordinates and apply corrections idempotently.
7. If a stored block hash no longer matches, orphan affected observations, rewind to the last common finalized checkpoint, and replay before advancing.
8. After backfill reaches the finalized boundary, begin polling or a subscription from the overlapping checkpoint. Reconcile subscription results through the same log and getter checks so the backfill-to-live handoff has no gap.

A log with the correct topic from any other emitter is not Programmable provenance. A subscription is transport, not evidence; never advance the durable finalized checkpoint from an unverified notification alone.

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
