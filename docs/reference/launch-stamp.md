# Verify “Launched on Programmable” directly onchain

The Programmable launch stamp is a provenance check. It answers one question:

> Was this token, hook, v4 pool, or component registered by the official Programmable launch path?

The point lookup requires an Ethereum RPC endpoint, but no Programmable API, database, server, SDK, or indexer. Bulk discovery can scan the same canonical contract logs directly.

## Current state

Custom Registry generation 1 is live and manifest-listed. The launch stamp is still **prelaunch**: its integration ABI, event topics, and getter selectors are published for implementation, while its canonical address and start block remain `null`. Until the v2 manifest marks the stamp live with an evidenced address and start block, stamp integrations must return `unavailable` and must not derive the Programmable label from stamp state.

Never replace a prelaunch stamp `null` with an address or block copied from a pull request, fixture, chat, frontend, or draft contract.

## Trust root

Begin with the official discovery document and follow its manifest URL:

```text
https://developers.programmable.family/.well-known/programmable.json
→ manifestUrl
→ customRegistry
```

The manifest supplies the complete source identity:

- EVM `chainId` and CAIP-2 chain identity;
- the canonical Registry and stamp addresses;
- the first block that may contain a valid Registry record or stamp;
- lifecycle status;
- the versioned ABI, event topics, and getter selectors.

The Registry address, stamp address, and their start blocks live only in the manifest. The current Registry identity is published there; the stamp identity remains `null` until activation. Consumer examples intentionally contain none of them. The stamp contract answers identity lookups; the parent Registry supplies the current launch lifecycle.

## The non-spoofable rule

A contract is a Programmable launch only when the lookup succeeds against the exact canonical stamp address published for that chain. Current lifecycle state is read from the exact parent Registry address in the same manifest.

An attacker can copy the contract name, getter names, event names, event topics, ABI, logo, metadata, or website. Those copies do not matter: storage and logs at another address are not Programmable provenance. A creator signature, backend response, webhook, or self-declared marker is not a substitute for canonical stamp state.

For a log-based integration, require all of the following:

1. RPC chain ID equals the manifest chain ID.
2. Stamp log address equals `customRegistry.launchStamp.address` after address normalization.
3. Block number is at or after `customRegistry.launchStamp.startBlock` and inside the generation lifecycle.
4. `topic0` and decoded values match the manifest-linked ABI.
5. The returned `launchId` is nonzero and is scoped together with the manifest chain ID and stamp address.
6. Current lifecycle is read separately from the parent Registry.

Checking only an event signature or only a function on the launched contract is unsafe and non-conforming.

The deployed stamp is writable only by its immutable Atomic Registrar. During the atomic launch it checks the parent Registry record, execution-policy capability, complete v4 PoolKey, runtime code hashes, and the approval-bound stamp hash. It recomputes the PoolId from the PoolKey and rejects duplicate launch IDs, tokens, hooks, launch-owned components, and `PoolManager + PoolId` identities. A copied contract can reproduce this code, but its different address is outside the manifest trust root.

The two discovery events are:

- `ProgrammableLaunchStampedV1`, binding launch ID, token, hook, PoolManager, PoolId, and stamp hash;
- `ProgrammableComponentStampedV1`, binding a launch-owned component, its kind, and observed runtime code hash.

Read the remaining pool-key, component-set, capability, and stamp commitments through the manifest-advertised `launchStamp(bytes32)` and component getters.

## Point lookups

The manifest advertises versioned getters for four identity checks:

| Query | Inputs | Result |
| --- | --- | --- |
| Token or primary contract | contract address | `launchId` or zero |
| Hook | hook address | chain-scoped `launchId` or zero |
| v4 pool | PoolManager address plus `PoolId` | `launchId` or zero |
| Component | component address | chain-scoped `launchId` or zero |

Uniswap v4 pools live inside a singleton PoolManager and do not have an individual pool-contract address. Always bind `PoolManager + PoolId`; do not use a `PoolId` alone unless a future deployed stamp contract immutably binds exactly one PoolManager and the manifest says so.

Token, hook, and additional launch-owned component addresses are globally single-assignment within one stamp contract. Shared dependencies such as PoolManager, routers, and factories are not launch-owned components and must not be submitted to the component lookup.

`launchId == bytes32(0)` means the queried token, hook, pool, or component is not stamped by that stamp generation. A nonzero result establishes Programmable launch provenance. Treat the complete identity as `chainId + stamp address + launchId`; a bare launch ID is not a global identity. This provenance does not by itself establish an audit, safety, liquidity, price, sellability, router support, or economic outcome.

The ABI also exposes `componentRuntimeCodeHash(address)`. An integrator may compare the recorded value with `EXTCODEHASH` or `eth_getCode` evidence to detect later runtime drift. That is a separate integrity check, not part of the origin label.

## Minimal verification algorithm

```text
fetch official discovery document
fetch its manifest
assert RPC chainId == manifest.chainId
assert customRegistry.status == live
assert customRegistry.launchStamp.status == live
assert stamp address, stamp startBlock, ABI and selected getter are published
eth_call selected getter at customRegistry.launchStamp.address
if launchId is zero: not a Programmable launch
else: Launched on Programmable
read current lifecycle from customRegistry.launchStamp.lifecycle at customRegistry.address
```

Use the [dependency-free example](../../examples/verify-launch-stamp.mjs) for token, hook, pool, and component lookups.

## Bulk discovery

A terminal that wants every new launch can call `eth_getLogs` against exactly the manifest stamp address, from exactly the published stamp start block, using the published launch and component topics. It may keep its own checkpoint and finality policy. No Programmable-hosted indexer is required.

The hosted launch feed remains an optional normalized convenience for metadata and broad discovery. It is not the trust root for the onchain stamp.

Stamp provenance is append-only. A later Registry lifecycle of `revoked` remains historical evidence that the launch occurred through Programmable, while signaling that the launch is no longer in an active accepted state. Keep origin and current lifecycle as separate fields.

## Display language

Conforming display copy:

- `Launched on Programmable`
- `Programmable Custom`

Do not derive the label from a ticker, image, hook callback, arbitrary creator metadata, or a copied stamp implementation. Do not expand the provenance label into `safe`, `audited`, `sellable`, `risk-free`, or another claim not made by this interface.
