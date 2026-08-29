# Custom Fee-Enforced Launch Profile V2

This guide describes the retained Custom Launch API V2 profile and historical
resources on Ethereum Mainnet. It is not a fresh-write route. Authenticated
`POST /v2/custom-launches` returns nonretryable
`409 CUSTOM_LAUNCH_V2_READ_ONLY`; only V3 profile `3.3.0` accepts fresh submissions.

Read the current machine state from
`customFeeEnforcedLaunchProfileV2` in both:

```text
GET https://developers.programmable.family/api/v2/status
GET https://developers.programmable.family/api/v2/manifest
```

The descriptor is fail closed with `status: "read-only"`,
`api.publiclyRoutable: false`, and `productionLaunchAuthorized: false`.
Historical reads remain available. Never infer this exact fee profile from the
`custom` category alone or apply it to an arbitrary hook or market.

## Keep the four version names separate

| Name | Current state | Meaning |
| --- | --- | --- |
| Developer API v2 | Live and read-only | Discovers Classic and Custom launches |
| Custom Launch API V1 | Historical reads live; POST read-only | Authenticated POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY`; it does not enforce the V2 fee profile |
| Custom Registry Generation 2 | Unavailable release candidate | A separate four-contract future discovery trust root |
| Custom Launch API V2 / profile revision 3 | Historical read-only | Existing resources remain readable; authenticated POST returns nonretryable `409 CUSTOM_LAUNCH_V2_READ_ONLY` |
| Custom Launch API V3 profile `3.3.0` | Fresh submissions | The only currently admitted fresh-submission profile, subject to API-server authorization and separate controller-wallet review |

None of these names creates another public category. The only public launch
categories remain `classic` and `custom`.

## Retained historical contract

The retained launch-profile identifier is
`programmable.fee-enforced-isolated-after-swap.zero-delta.v1`, revision `3`,
profile version `2.0.0`.

The historical CLI contract used package name `@programmable/launch` and exposed
the four commands `pack`, `validate`, `submit`, and `status`. Command presence is
not current write authority. Its V2 contracts are:

```text
config schema:       programmable.launch-pack-config.v2
create request:      programmable.custom-launch-create-request.v2
agent attestation:   programmable.agent-launch-attestation.v2
collection path:     /v2/custom-launches
single-resource:     /v2/custom-launches/{requestId}
```

V2 requires an exact server-published `launchProfile`, per-target `runtimeImmutables`, a
`verificationBundle`, `launchProfileHash`, and `launchIntentHash`. These
bindings do not by themselves prove a successful compilation, a deployed
runtime, a provider exact-source match, or fee enforcement.

The retained graph has five roles: `token`, `customModule`, `feeVault`,
`feeHook`, and `poolInitializer`. The custom module is isolated behind the
fee hook's bounded `afterSwap` callback. Arbitrary callbacks are not allowed,
the maximum custom return delta is exactly `0`, and `customDeltaAccount` is the
explicit zero address `0x0000000000000000000000000000000000000000`.
There is no `launchWallet` coupling. This is not an arbitrary-hook profile.

The retained CLI artifact is version `2.0.1`, distributed as an immutable GitHub release at
`https://github.com/programmablehq/PROGRAMMABLE/releases/tag/programmable-launch-v2.0.1`.
Install the immutable release asset directly:

```sh
npm install --global https://github.com/programmablehq/PROGRAMMABLE/releases/download/programmable-launch-v2.0.1/programmable-launch-2.0.1.tgz
```

The CLI distribution state is `github-release`; it is not an npm registry
publication. The retained machine contract is
`https://programmable.market/openapi/custom-launch-v2.json`. `pack` and
`validate` can reproduce historical bytes; `status` can read an existing
resource. `submit` cannot create or replay a V2 request because authenticated
POST is read-only. A cached package, CLI result, LLM, or guessed endpoint cannot
override the server boundary.

Custom Launch API V1 and V2 are read-only for writes. Their authenticated POST
routes return HTTP `409` with `CUSTOM_LAUNCH_V1_READ_ONLY` or
`CUSTOM_LAUNCH_V2_READ_ONLY`; neither response is retryable. Historical GET
resources remain available under their compatibility contracts.

## Exact fee semantics

The profile adds exactly `1,000` parts per million, equal to `10` basis points
or `0.10%`, for each successful swap through the exact bound V2 pool. The
denominator is `1,000,000`. It does not charge other pools or every market for
the same token.

The fee basis is the gross amount of the unspecified pool currency. The fee
asset therefore depends on the swap mode:

| Swap mode | Fee asset |
| --- | --- |
| Exact input | Output currency |
| Exact output | Input currency |

This is not a permanent “quote token” rule and it is not the Uniswap pool fee
in `PoolKey.fee`. The profile is additive to other independently configured
economics. Display and account for these separately:

- liquidity-provider fee;
- protocol fee;
- creator or custom-module fee;
- Programmable's 1,000 ppm profile fee; and
- network gas.

The Programmable recipient is
`0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`. Fees settle as PoolManager
ERC-6909 claims held in the sealed profile vault; only that fixed reward wallet
can claim them. This is not a direct ERC-20 or native transfer on every swap.
The pinned permission mask is `0x2044`, adding the initialization guard to the
two fee callbacks.

The pinned production literals are:

```text
launchProfileHash: sha256:fd2d738117c4c69304efb49c75d402d2e8b8968832fd2e27548c3d9814c5c9ee
contractPolicyId:  0xb7ff874d418bc714d0ec6c36a2df03ea6251bc8b6eb125adc4f5b6b4899d2517
```

They identify one exact production profile. A client must reject any other
profile revision or hash.

## Exact retained artifacts

The canonical compiler is solc `0.8.26+commit.8a97fa7a`, Cancun EVM,
optimizer enabled with `1,000` runs, `viaIR: false`, and metadata settings
`bytecodeHash: "ipfs"` plus `appendCBOR: true`. The canonical compiler-settings
hash is
`0xd8985cd6554daab2848a8df4d90f9d5e0d81f15d062ee04bcd8414f292ccaf43`.

| Role | Creation bytecode Keccak-256 | Runtime Keccak-256 |
| --- | --- | --- |
| `token` | `0x71660c7252993788cbab7c257ce654622c5661611623c4cb288f68f157d1b25d` | `0xf98eb029ee9c1face4b56fafd83612be8b813bf15a402a959ac107de8b203eef` |
| `feeVault` | `0x0167ff8e72e4739491a8fbf1647cc4f583986f3a43ce16ae5289dd149b9a040c` | `0xf2cbc21a3f07c05909d664ba8d8b66fe6576eb8a5d016faa53e31e73ed6acbd4` |
| `feeHook` | `0x6cd2dbd66351cf83194fb942ace4b4f4356c9499d567619b15a922d5cad730b3` | `0x0a461fa65d04305fa2e583d9a6fba369b3b2ff66aa5856f56d0782c2ff72e19c` |
| `poolInitializer` | `0xf6e047132a68eb0692f314975b45af88c6dd873ab7ecaa7b0c3c84a490b9454c` | `0x4df0f570bc27f05baa99ad297e4b7666d15f3101f43ba2e2863ce026432f43e4` |

The vault row is the materialized runtime after its canonical immutable
PoolManager and Graph Factory bindings; its unmaterialized runtime-template
hash remains separately published in the machine descriptor. A request's
custom-module runtime is separately exact-source-bound and is not replaced by
one shared runtime.

Every V2 request and readback must bind:

- the exact per-launch pool ID and initial `sqrtPriceX96`;
- the authorized initializer;
- canonical Mainnet PoolManager
  `0x000000000004444c5dc75cB358380D2e3dE08A90` and runtime hash
  `0x785f1014552b7ce7d5fb7d0c970ca60edee94fd00425d7ca21609acac7ce1293`;
- actual hook and vault runtime code hashes; and
- one composition hash covering the complete deployed profile.

None of those per-launch bindings may be satisfied by self-reporting getters
alone.

## Historical evidence and authorization boundary

The historical V2 profile required the following evidence as one consistent
release:

1. the CLI package and the public authenticated API/OpenAPI contract;
2. exact pinned profile artifacts and request-hash domains;
3. closure of the remaining public-production security-review gates;
4. canonical PoolManager identity and runtime, canonical hook and vault runtime
   identities, and a composition hash bound by the graph rather than supplied
   only by self-reporting getters;
5. atomic authorization that prevents a third party from initializing the
   deterministic pool first, plus enforcement of the one exact pool ID by the
   hook;
6. a successful simulation of the exact pinned launch transaction;
7. a two-provider Ethereum `finalized` checkpoint before a future request may
   become finalized;
8. global V2 admission caps in addition to per-principal quotas;
9. exact fee-path configuration binding; and
10. a durable post-finality source-verification worker whose provider outcome
    cannot block or reverse launch finality.

The current descriptor is historical and read-only:
`productionLaunchAuthorized: false` and `api.publiclyRoutable: false`. No CLI,
LLM, client, request hash, profile match, or local test can authorize a V2
write or wallet handoff. API readiness and historical profile conformance do
not prove fee accrual or payment, continuing liquidity, claim support, market
support, safety, or an independent audit.

## Status polling

Use the single-resource route as the canonical polling path:

```text
GET /v2/custom-launches/{requestId}
```

The list route may perform a bounded opportunistic reconciliation of pending
records before returning. It is useful for history, but it is not guaranteed to
advance every pending item and does not replace single-resource polling.

An existing historical `authorized` response is still only a wallet handoff. The controller wallet
must independently verify the exact chain, sender, Router, value, selector and
calldata, then separately approve any broadcast. An API key is not signing
authority.

## Source and product boundaries

A required verification bundle binds exact source bytes, Standard JSON compiler
input, compiler settings, libraries and constructor arguments into the launch
intent. “Source verified” is true only after the server records a real provider
exact match. Launch finality must never be blocked or reversed by an Explorer
outage. The legacy five-address closeout described in the
[onchain verification reference](../reference/onchain-verification.md) is a
different evidence set and must not be presented as a Rev3 profile canary.

The V2 profile does not claim:

- a security audit or universal safety;
- current liquidity or continuing tradability;
- support by any terminal or router;
- generic fee claiming for arbitrary hooks;
- generic creator rewards;
- buybacks; or
- correctness of a separate custom module beyond its exact bounded interface.

The current FADE claim adapter is specific to FADE and is not evidence of a
generic claim or buyback surface for V2 or arbitrary hooks.

Launch provenance, fee enforcement, source exact match, finality, market
support, claim capability and audit status remain separate evidence axes.
