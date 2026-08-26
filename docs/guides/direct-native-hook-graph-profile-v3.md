# Direct Native Hook Graph Profile V3

The Direct Native Hook Graph V3 descriptor is the active general lane for the
public Custom Launch API V3 on Ethereum Mainnet. Its identity is:

| Field | Value |
| --- | --- |
| Profile ID | `programmable.direct-native-hook-graph.v1` |
| Profile revision | `3` |
| Profile version | `3.0.0` |
| Profile schema | `programmable.direct-native-hook-graph-profile.v3` |
| Selection binding | `programmable.direct-native-hook-graph-profile-selection-binding.v3` |
| Public category | `custom` |

Resolve `directNativeHookGraphProfileV3` from `GET /api/v2/manifest` or
`GET /api/v2/status`. The Developer API remains read-only. Create and status
requests use the separately hosted authenticated API at
`https://api.programmable.market` and its versioned
[`custom-launch-v3.json`](https://programmable.market/openapi/custom-launch-v3.json)
contract.

Revision 3 is additive. Revision 2 remains published and compatible, and the
only public categories remain `classic` and `custom`. Legacy Registry and
GitHub submission intake are closed; neither is a fallback launch route.

## General graph lane

The project supplies its exact token, hook, initializer, and support-contract
artifacts in one atomic acyclic graph of 3–16 direct targets. Every valid
Uniswap v4 hook permission mask from `0` through `16383` is representable when
its callback dependencies, declared permissions, compiled permissions, and
mined hook-address bits agree.

The request must bind the complete deterministic artifact closure, including:

- exact source bytes and Solidity Standard JSON;
- exact compiler version, settings, libraries, and outputs;
- constructor and initializer arguments;
- target manifest, graph links, values, and CREATE2 address locators; and
- creation and runtime identities for every target.

This is a general project-hook lane, not a universal approval for a hook name,
repository, source revision, or future build. Each exact launch request has its
own admission and Router simulation.

## Deterministic admission baseline

Revision 3 replaces the Revision 2 fee-proof admission step with
`platformAdmissionPolicy`. Its core decision fields are shown below; resolve
the complete role-aware blocking rules from the machine descriptor:

```json
{
  "schemaVersion": "programmable.direct-native-platform-admission-policy.v1",
  "mode": "deterministic-exact-source-graph-static-baseline-v1",
  "receiptSchemaVersion": "programmable.platform-admission-receipt.v1",
  "engineId": "programmable.direct-native-static-admission",
  "engineVersion": "1.0.0",
  "exactSourceCompilerGraphBindingRequired": true,
  "staticBaselineGateVersion": "1.0.0",
  "noBlockingFindingDisposition": "router-simulation-eligible",
  "blockingFindingDisposition": "action-required",
  "routerSimulationRequiredBeforeAuthorization": true,
  "receiptAuthority": "platform-only",
  "assurance": "launch-admission-only",
  "safetyClaim": false,
  "feeBehaviorClaim": false
}
```

The machine descriptor publishes role-aware blocking rules. Incomplete analysis
blocks any target. Unresolved v4 callback authentication blocks the hook. A
mutable blocklist, transfer restriction, public mint, or pause surface blocks
the token. Proxy, upgrade, self-destruct, `CALLCODE`, `DELEGATECALL`, or
`SELFDESTRUCT` findings block when they apply to the token or hook.

Every static finding that does not match one of those code-and-role rules is a
bound, visible warning rather than an automatic block. That includes runtime
`CREATE` or `CREATE2`, generic mutable admin surfaces, mutable tax or fee
surfaces, non-token pause surfaces, and the listed opcode findings on other
support roles. The full report hash and every warning remain bound to the
admission evidence. There are no project-specific exceptions. A project does
not receive a clean or safe label merely because the blocking list is empty.

`no_blocking_static_finding` produces only the verdict
`admitted_to_router_simulation`. It does not authorize a transaction. The
platform must then execute the exact prepared Router launch transaction as a
pinned Ethereum `eth_call`. Authorization requires that exact simulation to
succeed. A different request, graph, compiler output, Router transaction, or
wallet value requires new evidence.

## What admission does not prove

The Revision 3 receipt is launch-admission evidence only. It is not a security audit.
It provides no liquidity or tradeability guarantee. It is also not:

- a claim that the contracts are safe;
- a honeypot-free guarantee;
- proof that a token can be bought or sold in production;
- proof of liquidity, backing, solvency, vesting, or a liquidity lock;
- proof of the actual fee behavior of the deployed hook; or
- proof of launch finality, source verification, or market support.

Router simulation is one deterministic preflight against one exact state and
transaction. It is not production-outcome evidence and cannot predict later
admin actions, market conditions, third-party liquidity, or integrations.

## Platform fee accounting

Each Revision 3 request selects and binds one of two platform-fee accounting
modes. `additive-platform-share` adds the Programmable `1,000 / 1,000,000`
share to the project-selected fee. `inclusive-selected-total` treats the
selected total as inclusive and reserves the same Programmable share inside
that total. Integrators must read the selected mode, assessment base, fee
currency, rounding, and claim mode from the exact request; they must not infer
added-on-top behavior from the `custom` category.

The machine descriptor publishes both allowed accounting modes, the 10 bps
Programmable share, assessment pairs, and claim modes. The older top-level
`customPublicSubmissions.chargeMode: added-on-top` field is scoped only to the
legacy Fee-Enforced Isolated After-Swap profile. It does not describe Revision
3. The admission receipt deliberately declares `feeBehaviorClaim: false`, so
separate onchain evidence is still required for actual accrual or payment.

Pool initialization creates no concentrated liquidity, and trading volume does
not create a Uniswap LP position. A normal pool needs a project or third-party
position. A zero-classical-LP custom-accounting design is possible only when
the exact hook graph supplies and settles its own inventory or backing. The
platform does not infer that behavior from admission or finality.

Any required Programmable fee selection remains a separate, exact request and
graph binding. `feeBehaviorClaim: false` means the admission receipt does not
certify that production trades accrue, route, or pay that fee. Fee accrual and
claimability require their own onchain evidence. Generic fee claiming for
arbitrary hooks and generic buyback management are not live.

## API key and wallet boundary

A wallet-bound API key authenticates `pack`, validation submission, and status
requests. Store it only in `PROGRAMMABLE_API_KEY` or an encrypted secret store.
Never paste a key into a prompt, chat, source file, config file, screenshot, or
command argument.

The API key, CLI, and agent never sign or broadcast. At `authorized`, the
controller wallet separately verifies the chain ID, sender, exact production
Router, value, selector, and calldata before it signs and broadcasts. Only
finalized, consistent canonical-Router evidence may create a Custom feed
identity. Token-list publication additionally requires a recognized token
identity.

## CLI contract

Revision 3 requires CLI contract version `3.1.0`, with exactly four commands:

```text
pack
validate
submit
status
```

At the revision represented by this document, the immutable `3.1.0` release
locator has not been published. The discovery descriptor therefore reports
`releaseLocatorStatus: pending-publication` and deliberately does not guess a
GitHub tag or tarball URL. Do not install a similarly named package from a
registry. Use the V3 OpenAPI directly until the descriptor publishes the
immutable release URL, or keep CLI `3.0.0` requests on the retained Revision 2
contract.

Once the locator is published, the normal flow remains:

```text
pack -> validate -> submit -> status -> separate wallet review and signature
```

`finalized`, `failed`, and `cancelled` are terminal. Pending requests and
profile descriptors are not launch or token-list identities.
