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

Read the manifest and record rather than copying these values into fee-verification logic. The machine-readable disclosure binds the active policy to the deployment and market path.

## Classic

Current official Classic market paths include the 10 bps Programmable share within the configured trading fee.

If the total configured Classic trading fee is `X`, the platform share is part of `X`; it is not an additional 10 bps charged above `X`.

The corresponding fee disclosure uses an included charge mode.

## Native Custom

Native Custom means an official Programmable Custom launch that is not using an approved partnership-template fee policy.

Future official Native Custom market paths add the 10 bps Programmable platform fee on top of the creator-defined market fee, but only after that specific fee path is deployed and verified.

If the creator-defined market fee is `X`, the supported official path charges `X + 10 bps`.

General Custom intake remains prelaunch. The live Registry does not create a global partner fee: every published fee path stays bound to its provider, model, version, and verified market path. A fixture or draft must not claim that a future fee path is already onchain-verified.

Never infer added-on-top behavior from `category: "custom"`; read `fees` and `verificationStatus` for the actual record.

There is no partner share in the Native Custom policy.

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

The additive v2 Registry record uses `feePolicy.mode`:

| Mode | Required values |
| --- | --- |
| `native` | `totalFeeBps: 10`, `programmableShareBps: 10`, `partnerShareBps: 0`, `normalProgrammableTenBpsApplied: true` |
| `partner-template` | Active fee-bearing partnership path: `totalFeeBps: 20`, `partnerShareBps: 15`, `programmableShareBps: 5`, `normalProgrammableTenBpsApplied: false` |
| `no-qualifying-market` | No qualifying fee path, including a partner-attributed project without one: all shares zero and no invented basis, currency, accrual, or claim path |

Both fee-bearing modes use `chargeMode: "verified-official-market-path-only"`. The no-market mode uses `chargeMode: "none-no-qualifying-market"`.

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

The fee applies to executed volume through the supported official Programmable market path described by the verified record.

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
