# Trading terminals and scanners

This document is the implementation contract for adding Programmable launches to a terminal, scanner, bot, or market-data platform.

## Public classification contract

Expose exactly two filters and labels:

| API value | Display label | Include |
| --- | --- | --- |
| `category=classic` | `Programmable Classic` | Current and historical Classic releases |
| `category=custom` | `Programmable Custom` | Launches accepted through the Custom Registry listed in the v2 manifest |

Do not expose internal model IDs as additional public categories. A Programmable label establishes recognized launch provenance. It is not a universal audit, safety, liquidity, or execution guarantee.

## Current Ethereum sources

Read launcher, hook, registry, event and start-block values from `GET /api/v2/manifest` in production. A complete Classic backfill includes every deployment whose discovery state is enabled, including historical releases. Do not copy a deployment address into consumer code or documentation derived from this guide.

The manifest records the historical Classic V2 hook and the current Classic V3 hook separately. New launches follow the current deployment; historical tokens remain associated with the deployment that emitted their launch event.

## Current Custom boundary

Programmable Custom intake and the Custom Registry are prelaunch. The v2 Custom feed is intentionally empty until the manifest publishes an evidenced registry address and start block.

Historical Stock-Paired launches are not Programmable Custom in v2. Do not import them from API v1, infer the label from a hook address, or assign the label from a provider name.

After registry activation, every accepted Custom launch uses the same `custom` category even when its token, hook, factory, provider, market and template contracts differ from every prior launch. Those values stay on the individual record. The terminal classification comes from the registry event and its normalized v2 record.

The baseline integration discovers every recognized launch. Charting, quotes, simulation, and execution are separate per-market capabilities and may be unavailable.

## Minimum integration

1. Fetch `/.well-known/programmable.json`.
2. Read `/api/v2/status` and `/api/v2/manifest`.
3. Backfill `/api/v2/launches` until `page.hasMore` is false.
4. Persist `launchId`, project and asset identities, provenance, timestamp, finality, markets, capabilities, and fees.
5. Use `page.nextCursor` to finish the current traversal, then persist `page.resumeCursor` and poll with `after`.
6. Reconcile finality and explicit reorg states.

Do not hard-code launcher or registry addresses. The manifest is what allows compatible deployments to appear without a client release.

For direct onchain consumers, apply this rule exactly:

1. `Programmable Classic` requires a launch event from an enabled Classic launcher in the v2 manifest.
2. `Programmable Custom` requires a launch event from the Custom Registry in the v2 manifest.
3. No token, hook, factory, frontend, provider API or metadata field can self-assign either label.

## New-launch card

A robust minimum card shows:

- project or token name as creator metadata;
- chain plus checksummed token or contract address when present;
- `Programmable Classic` or `Programmable Custom`;
- original onchain launch time;
- finality state;
- market state such as active, inactive, paused, or no registered market;
- a link to the launch transaction or provenance details.

Name, symbol, decimals, supply, and timestamp can be null or unavailable when enrichment fails. `token` can be null for a project-only launch. Keep the recognized launch visible using its project ID, chain, authenticated assets, launch ID, and the evidence that is present. Label incomplete fields rather than inventing values.

Do not show a launch as older because your indexer discovered it late. Sort by canonical launch block position and use the onchain timestamp when it is available.

When the feed status is `degraded`, canonical event coverage can still be complete while enrichment is incomplete. Ingest the records and preserve their partial provenance and unavailable fields. A retryable `503` from the launch-list route instead means the API is not publishing an incomplete event-log coverage boundary.

Use market kind, capabilities, and optional extensions for secondary details. This keeps filtering stable while allowing new designs.

## Verification and sell support

Current Classic V3 release evidence establishes a fixed supply of 1,000,000,000 tokens, no owner mint, blacklist, pause, or ERC20 transfer tax, permanently held one-sided Uniswap v4 liquidity, immutable directional fees, and a recorded mainnet buy, sell, and claim lifecycle.

Classic V3 has no token-level sell restriction. A terminal must still check current pool state, liquidity, quote, and simulation before enabling a trade. Do not translate the label into a generic `safe`, `audited`, `unruggable`, or `sellable` boolean.

Custom is a launch family rather than one mechanic. Preserve provider, factory, template, hook, source provenance, declared capabilities, market support, fee disclosure and release-specific review evidence as separate fields. Do not infer an audit or `Programmable Verified` from `category=custom`.

## Market presentation

`markets` may contain zero, one, or several entries.

### No market

When `markets` is empty:

- keep the project or token in the launch feed;
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

The v2 feed is read-only. It does not return transaction payloads or authorize execution, even when a support state is `available`.

## Fees

Read `fees` per record and market path.

- Classic currently includes the 10 bps Programmable share inside the configured trading fee.
- Future Native Custom official paths add 10 bps on top of the creator-defined market fee only when verified.
- Partner attribution does not imply an active fee. A partner-attributed project without a qualifying path uses zero shares; an active fee-bearing partnership-template path uses exactly 20 bps on one verified basis: 15 bps partner plus 5 bps Programmable, with no additional Native Custom 10 bps.

Never derive the charge mode from `category`, a partner name, or template metadata. Disable verified fee presentation when the rate, basis, currency, recipients, accrual, or claim path cannot be established.

## Recommended filters

Useful filters include:

- category: Classic or Custom;
- finality;
- review and deployment-binding state;
- market status;
- verified chart support;
- verified quote or execution support;
- token address;
- launch time.

Avoid a single `safe` filter. Provenance, finality, metadata trust, market support, and external dependencies are different facts.

## Acceptance cases

Test the client against repository fixtures for:

- Classic with one market;
- registered Custom with no market;
- registered Custom with several markets;
- registered Custom contract market without a pool;
- project-only Custom with `token: null` and authenticated contract assets;
- multiple primary and secondary tokens;
- unregistered external launch excluded from the feed;
- historical Stock-Paired launch excluded from v2;
- paused market;
- unknown future market kind;
- unknown capability and extension;
- duplicate page replay;
- observed launch later confirmed and finalized;
- observed launch later orphaned or absent after reconciliation;
- duplicate name and ticker at different addresses.
- Native Custom exact 10 bps, partner-attributed no-market with zero shares, and active partnership-template exact 20/15/5 bps without double charge;
- forged partner or template attribution and a changed recipient.

The integration is ready when every launch remains discoverable and unsupported features fail closed without breaking the feed.
