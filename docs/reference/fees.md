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

## Future Custom

Future official Custom market paths add the 10 bps Programmable platform fee on top of the creator-defined market fee, but only after that specific fee path is deployed and verified.

If the creator-defined market fee is `X`, the supported official path charges `X + 10 bps`.

Open Custom intake and the open Custom Registry are currently prelaunch. A fixture or draft must not claim that a future Custom fee path is already onchain-verified.

Never infer added-on-top behavior from `category: "custom"`; read `fees` and `verificationStatus` for the actual record.

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
| `kind` | Platform, creator, builder, referral, or another fee role |
| `ratePpm` | Exact integer rate in parts per million |
| `rateBps` | Exact integer rate in basis points |
| `recipient` | Recipient address |
| `chargeMode` | Included or added on top |
| `basis` | Amount or volume used for the calculation |
| `assetAddress` | Accounted asset when known |
| `verificationStatus` | Whether the implementation path has been verified |

Use integer arithmetic. Do not convert a fee to binary floating point for settlement calculations.

## Display guidance

A terminal should show:

- the total user-facing market fee when it can be derived from verified disclosures;
- the Programmable share separately when helpful;
- whether the share is included or added on top;
- the fee asset when known;
- an unavailable or unverified state when the path cannot be established.

Do not label a fee as collected, claimable, or paid solely because a policy is declared. Those states require corresponding verified onchain evidence.
