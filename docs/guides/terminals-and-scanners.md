# Trading terminals and scanners

This document is the implementation contract for adding Programmable launches to a terminal, scanner, bot, or market-data platform.

## Public classification contract

Expose exactly two filters and labels:

| API value | Display label | Include |
| --- | --- | --- |
| `category=classic` | `Programmable Classic` | Current and historical Classic releases |
| `category=custom` | `Programmable Custom` | Listed first-party Custom launches and, after registry activation, registered Custom hooks |

Do not expose internal model IDs as additional public categories. A Programmable label establishes recognized launch provenance. It is not a universal audit, safety, liquidity, or execution guarantee.

## Current Ethereum sources

Read launcher, hook, coordinator, event and start-block values from `GET /api/v1/manifest` in production. A complete backfill includes every deployment whose discovery state is enabled, including historical releases. Do not copy a deployment address into consumer code or documentation derived from this guide.

The manifest records the historical Classic V2 hook and the current Classic V3 hook separately. New launches follow the current deployment; historical tokens remain associated with the deployment that emitted their launch event.

Stock Paired coordinators can also emit `StockPairedEthTokenLaunched` with topic `0x3cbc0759c7c8dbace314ab27d7865532835458ca67ba12308949012593d5cc36`. Treat this as coordinator evidence, not a third category.

## Current Custom boundary

Existing first-party Stock Paired records are live as `custom`. Public Custom submission and the open Custom Registry are prelaunch. A future Custom hook enters the same `custom` feed only after recognized onchain launch evidence exists. Until then, do not synthesize or pre-register it.

The baseline integration discovers every recognized launch. Charting, quotes, simulation, and execution are separate per-market capabilities and may be unavailable.

## Minimum integration

1. Fetch `/.well-known/programmable.json`.
2. Read `/api/v1/status` and `/api/v1/manifest`.
3. Backfill `/api/v1/launches` until `page.hasMore` is false.
4. Persist `launchId`, chain and token address, provenance, timestamp, finality, markets, capabilities, and fees.
5. Use `page.nextCursor` to finish the current traversal, then persist `page.resumeCursor` and poll with `after`.
6. Reconcile finality and explicit reorg states.

Do not hard-code launcher or registry addresses. The manifest is what allows compatible deployments to appear without a client release.

## New-launch card

A robust minimum card shows:

- token name and symbol as creator metadata;
- checksummed token address and chain;
- `Programmable Classic` or `Programmable Custom`;
- original onchain launch time;
- finality state;
- market state such as active, inactive, paused, or no registered market;
- a link to the launch transaction or provenance details.

Name, symbol, decimals, supply, and timestamp can be null or unavailable when enrichment fails. Keep the recognized launch visible using chain, token address, launch ID, and the evidence that is present. Label incomplete fields rather than inventing values.

Do not show a launch as older because your indexer discovered it late. Sort by canonical launch block position and use the onchain timestamp when it is available.

When the feed status is `degraded`, canonical event coverage can still be complete while enrichment is incomplete. Ingest the records and preserve their partial provenance and unavailable fields. A retryable `503` from the launch-list route instead means the API is not publishing an incomplete event-log coverage boundary.

Use market kind, capabilities, and optional extensions for secondary details. This keeps filtering stable while allowing new designs.

## Verification and sell support

Current Classic V3 release evidence establishes a fixed supply of 1,000,000,000 tokens, no owner mint, blacklist, pause, or ERC20 transfer tax, permanently held one-sided Uniswap v4 liquidity, immutable directional fees, and a recorded mainnet buy, sell, and claim lifecycle.

Classic V3 has no token-level sell restriction. A terminal must still check current pool state, liquidity, quote, and simulation before enabling a trade. Do not translate the label into a generic `safe`, `audited`, `unruggable`, or `sellable` boolean.

Custom is a launch family rather than one mechanic. Preserve source provenance, declared capabilities, market support, fee disclosure, and any release-specific audit evidence as separate fields. Do not infer an audit from `category=custom`.

## Market presentation

`markets` may contain zero, one, or several entries.

### No market

When `markets` is empty:

- keep the token in the launch feed;
- show `No registered market` or equivalent;
- omit price, liquidity, volume, chart, quote, and trade controls;
- never invent a pool or substitute another contract address.

### Several markets

When several markets exist:

- key each by `marketId`;
- use a declared primary choice only if the schema provides one;
- otherwise present a market selector or a deterministic documented policy;
- never merge incompatible price or volume sources into one number without a verified normalizer.

### Unknown market

When `kind` is unknown:

- keep the launch visible;
- show a generic Custom market label;
- use explicit support states;
- hide unsupported chart, quote, simulation, and execution controls;
- do not decode arbitrary metadata as a transaction route.

## Charts and volume

Display chart and volume data only when market support declares verified charting and the adapter provides a defined activity normalizer.

Do not treat all ERC-20 transfers as trades. Rewards, claims, burns, mints, bridges, refunds, liquidity movement, and game settlement can transfer tokens without representing market volume.

When charting is unavailable, say `Chart unavailable for this market`. Do not show zero volume unless verified data says the volume is zero.

## Quotes and execution

Discovery does not authorize a transaction.

Enable quote, simulation, or execution only when the corresponding market support state and a separately verified adapter permit it. A terminal flow should bind the chain, target contract, method, amounts, allowance, deadline, slippage, quote block, and simulation result according to that adapter's contract.

If support is absent or stale, keep the market discoverable and disable the action.

The v1 feed is read-only. It does not return transaction payloads or authorize execution, even when a support state is `available`.

## Fees

Read `fees` per record and market path.

- Classic currently includes the 10 bps Programmable share inside the configured trading fee.
- Future Custom official paths add 10 bps on top of the creator-defined market fee only when verified.
- Existing first-party records categorized Custom may have deployment-specific fee behavior.

Never derive the charge mode from `category`.

## Recommended filters

Useful filters include:

- category: Classic or Custom;
- finality;
- market status;
- verified chart support;
- verified quote or execution support;
- token address;
- launch time.

Avoid a single `safe` filter. Provenance, finality, metadata trust, market support, and external dependencies are different facts.

## Acceptance cases

Test the client against repository fixtures for:

- Classic with one market;
- Custom first-party stock-paired record;
- Custom with no market;
- Custom with several markets;
- Custom contract market without a pool;
- paused market;
- unknown future market kind;
- unknown capability and extension;
- duplicate page replay;
- observed launch later confirmed and finalized;
- observed launch later orphaned or absent after reconciliation;
- duplicate name and ticker at different addresses.

The integration is ready when every launch remains discoverable and unsupported features fail closed without breaking the feed.
