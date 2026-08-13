# Protocol fee claim discovery

Programmable's operator claim console is available at:

```text
https://claimhazard.vercel.app
```

Its public, read-only discovery policy is:

```text
https://claimhazard.vercel.app/claim-discovery.json
```

The policy describes how the console finds supported fee sources. It is not a
transaction, signature, approval, or replacement for direct onchain checks.
The Developer API remains read-only and does not return claim calldata.

## Operator boundary

The only supported reward wallet is:

```text
0x4957f49620AFf3Adbbe8195a4f633E49cc93376c
```

Anyone can open the public page. The console permits a claim only when the
connected account equals that address. The claim contracts also bind the
authorized caller or recipient; access to the website alone conveys no claim
authority.

The primary action rescans before it asks the wallet to send anything. All
eligible calls must be submitted as one atomic EIP-5792 `wallet_sendCalls`
batch. If the wallet cannot provide atomic batching, the console fails closed
and sends no partial sequence.

## Current discovery coverage

| Inventory | Discovery rule | Future behavior |
| --- | --- | --- |
| Classic V3 and V2 | Replay the exact canonical launcher event from its published start block, then claim through the version's aggregate fee hook | New launches from the same canonical launcher are found on the next scan |
| Classic V1 | Query the frozen legacy aggregate fee hook | No per-coin enumeration is required for the aggregate claim |
| Stock-Paired | Use the fixed reviewed release inventory: 11 current and 7 legacy claim legs | No new Stock-Paired assets are auto-added |
| Custom Registry V1 | Replay the complete canonical Registry event history and verify current state before admitting a finalized standard source | New finalized standard sources with the supported 5 or 10 bps Programmable share are found on the next scan |
| Custom Registry V2 | Not active | Remains `HOLD` until an exact Mainnet deployment and finalized release binding are published |

An arbitrary contract, metadata label, token name, hook address, API response,
or unfinalized Registry entry cannot add a claim. Unknown or mismatched sources
block the common claim rather than being skipped silently.

## Launch visibility and claim eligibility are separate

The Developer v2 launch feed is the canonical public inventory for recognized
Classic and Custom launches. Consumers must traverse every cursor page and
must not drop a recognized launch because metadata, a pool, charting, or an
execution adapter is unavailable.

Claim eligibility is narrower. The claim console independently verifies the
specific launcher, Registry, runtime, fee share, recipient, lifecycle, and
finality requirements described by its discovery policy. A launch can be
visible in the Developer feed while having no currently claimable Programmable
fees.

Historical Stock-Paired records remain outside the v2 Custom classification,
but their fixed reviewed fee legs can still appear in the operator console.

## Refresh behavior

`Nur scannen` refreshes the inventory without asking the wallet to send a
transaction. `Scannen & alles claimen` performs the same fresh scan and then
requests one atomic wallet confirmation when at least one supported claim is
eligible.

A refresh automatically includes a new Classic launch from the currently
canonical launcher and a new finalized standard Custom Registry V1 source. A
new launcher generation, Registry generation, fee model, or arbitrary Custom
hook requires a reviewed discovery-policy update before it can become
claimable.

## Integration rule

Do not use the operator console or its discovery policy as launch provenance.
For public launch identity, use the canonical Developer manifest, launch feed,
and direct onchain verification rules. Do not use the Developer API or its
records to construct or authorize a transaction.
