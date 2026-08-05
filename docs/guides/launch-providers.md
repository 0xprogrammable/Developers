# Launch providers

This document defines how an external launch system can make its accepted launches discoverable as `Programmable Custom` without creating a provider-specific terminal integration.

## Status

This is a **prelaunch integration specification**. The open Programmable Custom Registry is not deployed. No registry address, ABI, or write endpoint in this document is live until it appears in `GET /api/v1/manifest` with deployment evidence.

## Public classification

Every accepted partner launch uses:

```text
API category: custom
Terminal label: Programmable Custom
```

The provider name, template and version are provenance details. They do not create additional public categories. Terminals can optionally show provider attribution beneath the stable Programmable label.

## Provenance requirement

A user opening the Programmable frontend, a successful provider API response, a webhook, or a later metadata submission does not prove that a token was launched through Programmable.

Canonical provenance requires one of two atomic paths:

### Programmable adapter

1. An approved Programmable adapter calls the provider factory.
2. The adapter obtains the created token, hook and market from the call result or emitted logs.
3. The adapter validates the provider factory, template, runtime code and returned addresses.
4. The adapter registers the launch before the same transaction completes.

### Provider factory callback

1. An allowlisted provider factory creates the launch.
2. That factory calls the Programmable registry from inside the same transaction.
3. The registry resolves the caller to one approved provider and factory policy.
4. The registry validates the submitted template and records the launch.

Do not use an unauthenticated public registration method. Do not accept an arbitrary transaction hash as proof: a registry cannot establish the contents of a historical receipt merely because a caller supplied its hash.

## Provider handoff package

Provide the following before an adapter or factory is approved.

| Area | Required information |
| --- | --- |
| Identity | Provider ID, legal or operational contact, supported chain IDs |
| Deployments | Factory, template registry, implementation and admin addresses |
| Source | Verified source URLs, ABI, deployment transaction, start block |
| Runtime | Runtime code hash for every approved factory and implementation |
| Template | Stable ID, version, configuration hash and upgrade policy |
| Launch output | Receipt mapping for token, hook, pool or market, creator and external launch ID |
| Hook policy | PoolManager, hook flags, router assumptions, callbacks, return deltas and external calls |
| Economics | All fee rates, recipients, caps, charge modes and withdrawal authority |
| Market support | Discovery, charting, quote, simulation and execution support separately |
| Evidence | Unit, fuzz, invariant and fork tests; audit scope; mainnet example; negative cases |
| Operations | Incident contact, pause or suspension process and version migration plan |

API credentials remain private between backend systems. Never put a provider API key, secret or bearer token in a browser bundle, registry event, public fixture or support issue.

## Draft registry interface

The review interface is kept under [`proposals/custom-registry`](../../proposals/custom-registry/IProgrammableCustomRegistryV1.sol). It is not a deployed ABI.

```solidity
interface IProgrammableCustomRegistryV1 {
    event ProgrammableCustomLaunchRegistered(
        bytes32 indexed launchId,
        bytes32 indexed providerId,
        address indexed token,
        address factory,
        address hook,
        bytes32 marketId,
        bytes32 templateId,
        bytes32 templateVersion,
        bytes32 configurationHash,
        address creator
    );
}
```

### Field rules

| Field | Rule |
| --- | --- |
| `launchId` | Deterministic unique ID committed by the registry |
| `providerId` | Stable `bytes32` provider identifier bound to approved factories |
| `token` | Created token address; unique within the registry on that chain |
| `factory` | Actual authenticated provider factory, not a frontend or API account |
| `hook` | Deployed hook, or zero only when the reviewed template has no hook |
| `marketId` | Canonical pool or market identifier; zero only when no market exists |
| `templateId` | Stable mechanic identifier, independent of marketing name |
| `templateVersion` | Immutable reviewed version identifier |
| `configurationHash` | Commitment to launch parameters that affect behavior or economics |
| `creator` | End-user or beneficiary identity established by the launch path |

Chain ID, registry address, block, transaction hash and log index come from the event location. They are not duplicated as caller-controlled event fields.

## Registry invariants

- A token can be registered once per chain.
- A `launchId` cannot be replayed.
- Only an approved adapter or factory can register.
- An approved caller is bound to one provider ID and reviewed runtime code.
- A template version cannot silently change implementation or configuration semantics.
- Registration records are immutable provenance.
- Suspending a provider or template blocks future registrations but does not erase historical events.
- Provider approval, template review, audit evidence and market support remain separate states.
- Unknown or unsupported markets remain discoverable and fail closed for charting or execution.

## Hook review

For Uniswap v4 templates, the handoff must list every enabled hook permission. Reviewers verify at minimum:

- every callback authenticates the expected PoolManager;
- the callback `sender` is not mistaken for the end user;
- router restrictions and hook data assumptions are explicit;
- external calls and reentrancy surfaces are bounded;
- delta accounting settles to zero;
- upgrade, owner and fee authorities are disclosed;
- token-level transfer, pause, blocklist and mint controls are disclosed;
- `beforeSwapReturnDelta` is disabled unless its custom-accounting design is specifically reviewed and audited.

The `custom` category does not imply that these checks passed. Template-specific evidence must be carried and rendered separately.

## Feed projection

After a registry deployment is live and a partner launch is finalized, the v1 feed projects it as a normal launch record:

```json
{
  "category": "custom",
  "launch": {
    "origin": "partner-provider",
    "modelId": "provider-template",
    "modelVersion": "1"
  },
  "verification": {
    "sourceId": "provider/example-template-v1",
    "registryAddress": "0x...",
    "provenanceStatus": "verified"
  },
  "extensions": {
    "programmable/provider": {
      "providerId": "example-provider",
      "factoryAddress": "0x...",
      "templateId": "example-template",
      "templateVersion": "1",
      "configurationHash": "0x..."
    }
  }
}
```

These values are illustrative until the registry is deployed. Never replace prelaunch nulls with guessed addresses.

## Terminal behavior

Terminals ingest the launch through the same `/api/v1/launches?category=custom` feed used for other Custom records. They do not need a provider-specific discovery integration.

The minimum display is:

- `Programmable Custom` label;
- chain and token address;
- launch time and finality;
- provider attribution when present;
- supported market actions only.

Do not convert provider registration into a universal `safe`, `audited`, `sellable` or `unruggable` flag. Pool state, liquidity, quotes, simulation and template-specific evidence remain separate checks.

## Acceptance checklist

A provider integration is ready for activation only when:

1. the handoff package is complete;
2. factory and implementation code hashes match the reviewed release;
3. positive and negative receipt mappings pass;
4. duplicate, replay and unauthorized registration tests pass;
5. hook permissions and economic controls are documented;
6. mainnet-fork launch, buy and sell simulations pass where trading is supported;
7. the registry deployment and start block are published in the manifest;
8. a live canary appears as `category=custom` in the feed;
9. unsupported market features fail closed;
10. the terminal fixtures and machine-readable docs match the live record.

Until all ten conditions are satisfied, keep the provider integration prelaunch.
