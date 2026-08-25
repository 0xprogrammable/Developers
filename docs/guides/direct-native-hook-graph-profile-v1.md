# Direct Native Hook Graph Profile V1

The Direct Native Hook Graph Profile is a versioned preview contract for a
future Programmable Custom launch path. It describes how a project-owned
Uniswap v4 hook could remain the pool's direct hook while Programmable binds
the complete deployment graph, funding, fee policy and launch provenance.

It is not live. Resolve `directNativeHookGraphProfileV1` from the current
[V2 manifest](https://developers.programmable.family/api/v2/manifest) and
[V2 status](https://developers.programmable.family/api/v2/status). That
read-only object uses discovery schema
`programmable.direct-native-hook-graph-profile-discovery.v1`; it is not the V3
request profile schema `programmable.direct-native-hook-graph-profile.v1`.
Profile version `1.0.0`, revision 1 is intentionally fail-closed:

- `status` is `gated`;
- `releaseStage` is `preview`;
- `productionLaunchAuthorized` is `false`;
- Custom Launch API V3 is `integration-pending` and not publicly routable;
- the `3.0.0-rc.1` CLI candidate is not a published supporting release;
- the existing immutable Router permit authority defaults to deny and has not admitted this profile; and
- launch-feed and token-list publication are `gated`.

Do not construct or submit a transaction for this profile. A public document,
API key, product decision, source review or successful local build does not
replace the missing production activation evidence.

## Stable product category

This profile remains `category: "custom"`. It does not add a third public
category and does not change the Developer v2 discovery contract, Custom Launch
API V1 compatibility, or the public Custom Launch API V2 production profile. After
activation, a recognized finalized launch would still be labeled
`Programmable Custom`; the profile would appear as secondary mechanism and
namespaced-extension data.

`native` in the profile name means that the project hook is the PoolManager's
direct hook, rather than an isolated module behind a different fee hook. It
does not mean that every pool must use native ETH.

## Planned V3 API and CLI boundary

Profile V1 is planned for Custom Launch API V3. The candidate identifiers are:

| Contract | Candidate value |
| --- | --- |
| Create request | `programmable.custom-launch-create-request.v3` |
| Resource | `programmable.custom-launch.v3` |
| Route ID | `custom-launch:create:v3` |
| Collection | `/v3/custom-launches` |
| Funding-signature handoff | `POST /v3/wallet-admin/custom-launches/{launchId}/funding-authorization` |
| Funding OpenAPI operation | `custom-launch-v3.json#/paths/~1v3~1wallet-admin~1custom-launches~1%7BlaunchId%7D~1funding-authorization/post` |
| Pack config | `programmable.launch-pack-config.v3` |

They are not public endpoints yet. The planned
`https://programmable.market/openapi/custom-launch-v3.json` contract is not
published, `api.publiclyRoutable` is false, and the API remains
`integration-pending`. The currently published `@programmable/launch` release
is `2.0.1`; the `3.0.0-rc.1` candidate is not a published supporting release.
`minimumSupportingVersion` therefore remains `null`.

The planned command vocabulary remains `pack`, `validate`, `submit` and
`status`. Those names describe the intended lifecycle, not present support.
The profile may be marked routable only after the request schema, backend route
and a supporting CLI release are published together.

An API key authenticates a wallet-bound caller. It never signs, broadcasts or
authorizes funds. The wallet flow has two separately reviewed signatures: the
exact EIP-3009 funding authorization first, then the final transaction to the
exact Programmable Router. The API key, CLI and agent may prepare or verify
bytes, but may sign neither stage and may broadcast neither stage.

The retired Registry and GitHub submission paths remain closed. They are not a
fallback for this preview.

## Direct graph contract

A future request is limited to one acyclic atomic CREATE2 graph:

| Property | Preview contract |
| --- | --- |
| GraphFactory target range | 1 through 16 |
| Router target range | 2 through 16 |
| Executable V3 profile target range | 3 through 16 |
| Direct v4 hook targets | Exactly one |
| Required distinct target roles | Token, hook and funding initializer |
| Router proof boundary | Exactly one expected output and one exclusive component for every target/result index |
| Component kinds | `token`, `hook`, `other`; the initializer role uses `other` |
| Address linking | Typed constructor and initializer address locators |
| Source binding | Exact creation bytecode, constructor arguments, initializer calldata and runtime hashes |
| Execution | Every target deploys and initializes, or the whole transaction reverts |

Target count does not imply safety or compatibility. The future packager and
backend must verify graph topology, CREATE2 addresses, runtime identities,
constructor dependencies, initializer ordering, value totals and the exact
PoolManager binding before preparing a wallet transaction.

The existing immutable Router permit authority at
`0x755509eA6e3F5Ec1aA2E797bb68f1B87DD8b886b`, runtime code hash
`0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c`,
is the one admission trust root. This profile does not require a separately deployed or fixed initializer
trust root. Each initializer is a direct stamped target and must be bound for
that launch by exact source, compiler input/output, creation and runtime code,
the signature-patch descriptor, final calldata and simulation. Admission
defaults to deny, requires an exact per-launch review, grants no universal hook
approval and never accepts self-reported configuration as sufficient evidence.
The required `reviewAdmission` hashes cover repository, commit, tree, compiler
input/output, target manifest, hook and initializer creation/runtime code, fee
conformance, security review and the resulting review-admission commitment.

## Variable Uniswap v4 permissions

Revision 1 reserves all fourteen Uniswap v4 permission names as a per-launch
exact set:

- `beforeInitialize` and `afterInitialize`;
- `beforeAddLiquidity` and `afterAddLiquidity`;
- `beforeRemoveLiquidity` and `afterRemoveLiquidity`;
- `beforeSwap` and `afterSwap`;
- `beforeDonate` and `afterDonate`;
- `beforeSwapReturnDelta` and `afterSwapReturnDelta`; and
- `afterAddLiquidityReturnDelta` and `afterRemoveLiquidityReturnDelta`.

A request may select a constrained fee-capable subset of two through fourteen permissions,
but not an arbitrary power set. `beforeSwapReturnDelta` requires `beforeSwap`,
`afterSwapReturnDelta` requires `afterSwap`, `afterAddLiquidityReturnDelta`
requires `afterAddLiquidity`, and `afterRemoveLiquidityReturnDelta` requires
`afterRemoveLiquidity`. Uniswap v4 can accept a nonzero zero-flag hook address
for a dynamic-fee pool, but that shape is not fee-capable under this profile.
The profile requires at least the before-swap action/return pair or the
after-swap action/return pair. The compiled hook, declared set and low fourteen
hook-address permission bits must match exactly. Return-delta permissions are
not blanket-approved: each selected delta path still requires exact accounting,
settlement, backing, bounds, no-op, partial-fill and adversarial review.
“Variable permissions” does not mean arbitrary unchecked callbacks. The current
candidate supports only the `programmable-volume-fee-v2@2.0.0`
`standard-amm` reference kernel at mask `0x20cc`. That reference is itself
unaudited and undeployed; exact source revision, compiler build and runtime
hashes remain mandatory in each review admission. A different runtime or mask
is a different exact review and remains fail-closed until variable/custom
conformance is implemented.

## ERC-20 and native currencies

The preview contract covers ERC-20/ERC-20 and native/ERC-20 pools. Uniswap v4's
native currency is represented by
`0x0000000000000000000000000000000000000000` and is allowed only as
`currency0`. `currency0 < currency1`, the currencies must be distinct, and the
token and quote currency must each equal one PoolKey currency. The complete
PoolKey and derived PoolId must be exact. A static `lpFeePips` value is limited
to `0` through `999999`; `1000000` is invalid. Native/native is not supported.

### Two-stage funding authorization

Pool currency support and launch funding are separate. The V3 candidate uses
mainnet USDC `receiveWithAuthorization` with descriptor
`programmable.funding-authorization-descriptor.v1`; it does not require an
unlimited allowance or a prior `approve` transaction.

Before any funding signature exists, the packager computes:

```text
fundingDomainHash = keccak256(utf8("programmable.direct-native-hook-graph.funding-intent.v1"))
fundingIntentHash = keccak256(abi.encode(
  fundingDomainHash,
  chainId,
  USDC,
  Router,
  GraphFactory,
  routeNamespace,
  routeNonce,
  bytes32(launchIntentHash),
  from,
  predictedInitializer,
  exactValue,
  validAfter,
  validBefore
))
nonceDomainHash = keccak256(utf8("programmable.direct-native-hook-graph.funding-nonce.v1"))
nonce = keccak256(abi.encode(nonceDomainHash, fundingIntentHash))
```

The ABI types are exactly
`bytes32,uint256,address,address,address,bytes32,bytes32,bytes32,address,address,uint256,uint256,uint256`.
`launchIntentHash` transitively binds the source descriptor and manifest,
verification bundle, graph template, PoolKey, hook, currency, target roles and
an exact initializer signature-patch descriptor. The funding signature's `v`,
`r` and `s`, plus `initializerCalldataHash`, `graphCommitment` and
`permitDigest`, are excluded from this pre-signature hash, avoiding a circular
preimage.

The first wallet signature is the exact mainnet-USDC EIP-3009 typed
authorization with `to` equal to the predicted initializer. The candidate
resource then waits in `awaiting_funding_authorization`. A future wallet BFF
would submit one strict 65-byte signature to the planned V3 funding endpoint;
the server must verify the stored digest, USDC domain and wallet signer, insert
only the launch-intent-bound fixed `v`/`r`/`s` descriptor slots, and only then
compute final initializer calldata, graph commitment, artifact, permit and
transaction. The wallet separately reviews and signs that final Router
transaction. The signature-patch schema and runtime are not yet published, so
the profile remains gated. The initializer stays a per-launch direct stamped
target; it is not a new fixed trust root.

## Inclusive Programmable fee

The profile reserves 1,000 hundredths of a bip—10 basis points or 0.1%—for
Programmable inside the selected total hook fee. It is not an additional charge
above that total. The Programmable recipient is:

`0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`

Each selection binds a target ID, selected buy and sell totals from `0` through
`999999` hundredths of a bip, the frozen fee fields and the readback selectors.
The full `programmable.direct-native-hook-graph-profile-selection-binding.v1`
object contains `schemaVersion`, `profileId`, `profileRevision`, `targetRoles`,
`routeNamespace`, `routeNonce`, `hookPermissionMask`, `predictedInitializer`,
`poolKey`, `expectedPoolId`, `fundingSignaturePatch` and `platformFeeBinding`.
The last object uses `selectedBuyHundredthsOfBip` and
`selectedSellHundredthsOfBip`; fields with an extra `Total` segment are not part
of this contract.
For each direction:

```text
effective total = max(selected total, 1000)
Programmable     = 1000
project          = effective total - 1000
```

For example, a selected 3.0% total is `30000`: `29000` project + `1000`
Programmable = `30000` total, not `31000`. The basis is executed gross quote-
currency volume. Project and Programmable liabilities and rounding remain
separate even though both shares are inside one effective total.

The exact JSON selector keys, readback getters and selectors are:

| JSON key | Getter | Selector |
| --- | --- | --- |
| `programmableHundredthsOfBip` | `PROGRAMMABLE_HUNDREDTHS_OF_BIP()` | `0x8a9585e4` |
| `programmableFeeOwner` | `PROGRAMMABLE_FEE_OWNER()` | `0x21466b6a` |
| `programmableFeePolicyHash` | `PROGRAMMABLE_FEE_POLICY_HASH()` | `0x677d6592` |
| `runtimeConfigurationHash` | `runtimeConfigurationHash()` | `0xca7751ad` |

Exact source, build, runtime, graph composition, fee-split and settlement
evidence must prove the path before activation. LP fee, Uniswap protocol fee
and network gas are separate values and must be displayed separately.

Publishing this required fee contract does not prove that any preview hook
currently accrues or settles it. Generic fee claiming for arbitrary hooks and
buybacks are not live.

## Discovery and feed contract

Preview profiles do not create launch records. While this profile is gated:

- the launch feed publishes no record merely because a project targets it;
- the token list publishes no prelaunch profile entry;
- existing Classic and Custom records remain unchanged and discoverable; and
- clients must not infer support from `category: "custom"`.

After activation, publication still requires a finalized launch through the
then-current canonical Router, exact profile evidence and a current feed
projector. The planned secondary identifiers are mechanism
`direct-native-hook-graph` and extension
`programmable/direct-native-hook-graph-v1`. They are read-only data, never
executable wallet instructions.

## Activation gate

Only the integration owner may change the profile from preview to production,
and only after all manifest-listed activation requirements have evidence. At a
minimum that includes:

1. a published V3 OpenAPI/request schema and enabled V3 backend routes;
2. a published supporting V3 CLI version;
3. funding-intent, nonce and launch-intent parity across CLI, API and initializer;
4. a published and runtime-verified fixed signature-patch schema;
5. profile admission configured under the existing immutable permit authority,
   with exact per-launch source/build/runtime/review bindings for the initializer;
6. an exact canonical V2 fee-kernel match, while variable/custom conformance
   remains fail-closed;
7. constrained permission dependencies plus ERC-20/native currency preflight;
8. the inclusive selected-total fee split bound and read back exactly;
9. a successful finalized canary; and
10. a feed projector that publishes only finalized recognized launches.

Product support is not an independent security audit. Activation must continue
to report source matching, security review, audit, simulation, deployment,
finality, indexing, routing and availability as separate evidence states.
