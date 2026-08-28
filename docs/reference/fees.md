# Platform fees

Programmable discloses fees as structured data so integrators do not have to infer behavior from a category, token name, or hook source.

## Platform recipient

The Programmable platform fee recipient is:

```text
0x4957f49620AFf3Adbbe8195a4f633E49cc93376c
```

The platform rate is:

```text
10 basis points
0.1 percent
1,000 parts per million
```

Read the manifest and record rather than copying these values into fee-verification logic. The machine-readable disclosure distinguishes verified Classic paths from retained exact Custom profiles. A rate and recipient without a bound deployed path are not proof of accrual or payment.

## Classic

Current official Classic market paths include the 10 bps Programmable share within the configured trading fee.

If the total configured Classic trading fee is `X`, the platform share is part of `X`; it is not an additional 10 bps charged above `X`.

The corresponding fee disclosure uses an included charge mode.

## Custom Fee-Enforced Launch Profile V2

The retained historical Custom Fee-Enforced Launch Profile V2 specifies an additive
`1,000 ppm` Programmable fee for successful swaps through one exact bound V2
pool on Ethereum Mainnet. The current machine descriptor keeps its exact
revision and hash with `productionLaunchAuthorized: false` and
`api.publiclyRoutable: false`; authenticated POST returns nonretryable
`409 CUSTOM_LAUNCH_V2_READ_ONLY`.

The fee basis is the gross amount of the unspecified pool currency for each
swap. Exact-input swaps account the output currency; exact-output swaps account
the input currency. This is not a static quote-currency rule and must not be
derived from `PoolKey.fee`. Fees accrue as PoolManager ERC-6909 claims in the
sealed profile vault and can be claimed only by the fixed reward wallet
`0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`; they are not transferred directly
on every swap.

The additive Programmable fee is separate from the liquidity-provider fee,
protocol fee, creator or custom-module fee, and network gas. A consumer must not
collapse those components into “10 bps total.”

Legacy Registry and GitHub submission intake are closed. The live Registry does not create a global partner fee: every published fee path stays bound to its provider, model, version, and verified market path. Custom Launch API V1 and V2 retain historical reads but no POST writes; only V3 profile `3.3.0` accepts fresh submissions. API availability does not prove that any specific launch accrued or paid a fee. A request hash, Router stamp, or successful HTTP response is not fee-payment evidence.

Never infer added-on-top behavior from `category: "custom"`; read `fees` and `verificationStatus` for the actual record. The top-level `customPublicSubmissions.chargeMode: added-on-top` compatibility field is scoped only to the legacy Fee-Enforced Isolated After-Swap profile and does not describe Direct Native Hook Graph V3.

There is no partner share in this fee-enforced launch profile.
The current FADE claim adapter is specific to FADE. It is not a generic fee
claim or buyback interface for V2 or arbitrary hooks.

See the [retained V2 profile guide](../guides/custom-fee-enforced-launch-profile-v2.md)
for the exact authorization and polling boundaries.

## Direct Native Hook Graph Profile V3

The active Revision 3 admission receipt declares `feeBehaviorClaim: false`.
Admission therefore does not certify that a deployed hook accrues, routes, or
pays a fee. Read the exact request and graph binding for the selected fee policy,
and require separate onchain evidence for accrual or claimability. LP fees,
project economics, the Programmable charge, and network gas remain separate
disclosures. Generic fee claiming and buyback management are not live.

For both directions and for additive or inclusive accounting,
`applicantSelectedHundredthsOfBip` is `0..100000`. The Programmable share is
the separate exact `1000`. The API server enforces this bound; clients cannot
widen it, and the bound does not prove actual fee behavior.

## Direct Native Hook Graph Profile V2

The retained historical V2 descriptor required `1,000` hundredths of a bip for Programmable
on each successful swap under the exact selected assessment base and fee
currency: `1,000 / 1,000,000 = 0.10% = 10 bps`. A launch selects either an
additive platform share or an inclusive selected total. The effective project
share and total therefore depend on that declared accounting mode; consumers
must not present every V2 launch as additive or every V2 launch as inclusive.

The LP fee, project economics, Programmable share, and gas are separate. A
platform-issued per-launch receipt binds the final graph and fee behavior before
authorization. It is not evidence that fees have accrued or are claimable.
Generic fee claiming and buyback management for arbitrary hooks remain not
live. See the [Direct Native Hook Graph V2 guide](../guides/direct-native-hook-graph-profile-v2.md).

## Direct Native Hook Graph Profile V1 preview

The Direct Native Hook Graph V1 contract reserves 1,000 hundredths of a bip
(10 bps) for Programmable inside the selected total hook fee, with recipient
`0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`. For each buy and sell direction,
the selected total may be `0` through `999999`, the effective total is
`max(selected total, 1000)`, and the project share is `effective total - 1000`.
Thus a `30000` (3.0%) selection yields `29000` project + `1000` Programmable =
`30000` total, not `31000`. The basis is executed gross quote-currency volume;
the two liabilities and their rounding remain separate.

The exact readback contract is
`PROGRAMMABLE_HUNDREDTHS_OF_BIP()` / `0x8a9585e4`,
`PROGRAMMABLE_FEE_OWNER()` / `0x21466b6a`,
`PROGRAMMABLE_FEE_POLICY_HASH()` / `0x677d6592`, and
`runtimeConfigurationHash()` / `0xca7751ad`.

This is a gated preview requirement, not current fee-accrual evidence. The
profile has no publicly routable V3 API, published supporting CLI, activated
permit-authority profile admission, finalized canary or feed projector, and
`productionLaunchAuthorized` is false. Exact source, build, runtime,
graph-composition, split/readback and settlement evidence are required before
activation. Generic fee claiming for arbitrary direct hooks and buybacks are not
live. See the [Direct Native Hook Graph V1 guide](../guides/direct-native-hook-graph-profile-v1.md).

## Partnership templates

Partner and template attribution do not imply that a market or fee path exists. A verified partner-attributed project with no qualifying official market path uses `feePolicy.mode: "no-qualifying-market"`, all shares remain zero, and no 20 bps fee is presented as active.

When an approved partnership template has an active fee-bearing official market path, it implements its fee split inside the partner-owned template:

```text
total partnership fee: 20 bps
partner share:          15 bps
Programmable share:      5 bps
Programmable recipient: 0x4957f49620AFf3Adbbe8195a4f633E49cc93376c
```

The two shares use the same clearly defined fee basis and together equal exactly 20 bps. The normal Native Custom 10 bps is **not** charged in addition.

If the partner template already charges its 15 bps share, that share remains unchanged and the partner adds the 5 bps Programmable share. If no partnership fee exists, the partner implements both shares. Programmable reviews the exact release and deployed behavior but does not modify a partner-owned template without authorization.

The partner recipient does not need to be copied into prose when it can be derived unambiguously from the reviewed source, immutable deployment configuration, or verified onchain state. Activation still requires the recipient to be evidenced.

Fail closed when:

- the 15 bps partner share or its recipient cannot be established;
- the 5 bps Programmable share or canonical recipient is absent;
- the total is not exactly 20 bps;
- the two shares use different or ambiguous fee bases;
- currency, rounding, accrual, or claim behavior is unclear;
- a recipient can be changed outside the reviewed authority policy;
- the Native Custom 10 bps is also charged;
- either party can claim the other party's share; or
- replay, double-claim, or reentrancy behavior is not safely bounded.

Each active fee-bearing partnership record must disclose partner ID and display name, lifecycle, recipient evidence, chain, template ID and version, repository and commit, public `runtimeCodeKeccak256` identities plus separately labeled `runtimeCodeSha256` evidence when present, the 20/15/5 split, Programmable recipient, charge mode, basis, currency, accrual, claim path, activation version and block, and pause or retirement state.

## Named partner status

No Basebit partnership source, recipient, approved template, runtime identity, Registry record, or live 15/5 fee path is currently published through the v2 manifest.

No Aion partnership source, recipient, approved template, runtime identity, Registry record, or live 15/5 fee path is currently published through the v2 manifest. A similarly named external codebase or a generic owner fee is not evidence of an Aion partnership or of the required 20 bps split.

Both remain integration blockers, not values to infer or placeholders to fill.

## Registry-backed `feePolicy`

This section describes the separate Custom Registry Generation 2 record model.
It is not the Custom Fee-Enforced Launch Profile V2 and does not activate that
profile.

The additive v2 Registry record uses `feePolicy.mode`:

| Mode | Required values |
| --- | --- |
| `native` | Conditional: `totalFeeBps: 10`, `programmableShareBps: 10`, `partnerShareBps: 0`, `normalProgrammableTenBpsApplied: true`, only when the exact launch carries verified official-market fee evidence |
| `partner-template` | Active fee-bearing partnership path: `totalFeeBps: 20`, `partnerShareBps: 15`, `programmableShareBps: 5`, `normalProgrammableTenBpsApplied: false` |
| `no-qualifying-market` | No qualifying fee path, including a partner-attributed project without one: all shares zero and no invented basis, currency, accrual, or claim path |

Both fee-bearing modes use `chargeMode: "verified-official-market-path-only"`. The no-market mode uses `chargeMode: "none-no-qualifying-market"`.

The manifest does not claim that every Custom launch charges 10 bps. Native
Custom fee behavior is conditional and must be established from the exact
launch's fee-certified official market path. When that evidence is absent,
keep the fee unavailable instead of inferring it from the launch category.

The policy also carries the Programmable and optional partner recipients, basis, currency, accrual, claim, rounding, verified market IDs, verification status and time, plus authority, evidence, recipient-control, and claim-isolation hashes. Validate those fields together; a correct rate with the wrong recipient or claim authority does not pass.

The immutable public fee semantics use `publicPolicyBindingHash`, a canonical `sha256:` digest under domain `programmable.custom-launch-public-fee-policy-binding.v3`; observation time and the binding field itself are excluded from its preimage. The frozen no-qualifying-market semantic vector yields:

```text
sha256:6ce49c7599693b5ff58a3c3d3858a2f2866a966d98cd0c06edb4f70a39e4bbaa
```

The corresponding onchain no-market fee-policy vector is a different Keccak-256/ABI commitment:

```text
0xdaf327c769377d80e700eafc75601c07fedc5c69176443f8aedbb2726b25eaae
```

Do not substitute one encoding or hash domain for the other.

These are release-candidate conformance vectors. They do not prove a deployed Registry, active market, accrued fee, or claimable balance.

## Scope

An active fee applies only to executed volume through the exact supported official Programmable market path described by a verified record. Public API availability does not make unrelated pools or transfers subject to the profile.

- No executed trade means no trading volume and no volume fee.
- A token transfer is not automatically a trade.
- A game reward, claim, mint, burn, bridge transfer, or refund is not automatically trading volume.
- An independently created third-party pool is outside the official path unless a future verified record explicitly says otherwise.

## Fee record

Each fee entry contains:

| Field | Meaning |
| --- | --- |
| `kind` | Platform, partnership, creator, builder, referral, or another fee role |
| `ratePpm` | Exact integer rate in parts per million |
| `rateBps` | Exact integer rate in basis points |
| `recipient` | Recipient address |
| `chargeMode` | Included or added on top |
| `basis` | Amount or volume used for the calculation |
| `assetAddress` | Accounted asset when known |
| `verificationStatus` | Whether the implementation path has been verified |

Use integer arithmetic. Do not convert a fee to binary floating point for settlement calculations.

For an active fee-bearing partnership-template path, consumers also need the effective total, partner and Programmable shares, currency, accrual destination, claim mechanism, and evidence tying those fields to the deployed runtime. If the active schema or record cannot express or prove those values, display the partnership fee as unverified and do not activate the fee path.

## Display guidance

A terminal should show:

- the total user-facing market fee when it can be derived from verified disclosures;
- the Programmable share separately when helpful;
- whether the share is included or added on top;
- the fee asset when known;
- both recipients and the 15/5 split for a verified partnership template;
- accrual and claim state only when backed by onchain evidence;
- an unavailable or unverified state when the path cannot be established.

Do not label a fee as collected, claimable, or paid solely because a policy is declared. Those states require corresponding verified onchain evidence.

## Operator claim inventory

The public Developer API does not authorize claims or return claim calldata.
Programmable's separate operator console rescans the reviewed onchain sources
at `https://claimhazard.vercel.app` and publishes its read-only discovery policy
at `https://claimhazard.vercel.app/claim-discovery.json`.

See [Protocol fee claim discovery](protocol-fee-claims.md) for the exact Classic,
fixed Stock-Paired, Custom Registry V1, wallet, atomic-batch, and fail-closed
boundaries. Custom Registry V2 remains unavailable until its exact Mainnet
release is finalized and published.

Custom Fee-Enforced Launch Profile V2 does not add generic claiming or buybacks.
Fee readback, launch finality, source verification, tradability and claim
capability remain separate states.
