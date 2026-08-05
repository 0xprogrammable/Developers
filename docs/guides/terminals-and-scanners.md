# Trading terminals and scanners

Use the v1 launch feed to add a single Programmable source to new-launch lists, token pages, and discovery tools.

The baseline integration discovers and verifies every registered launch. Charting, quotes, simulation, and execution are separate per-market features and may be unavailable.

## Minimum integration

1. Fetch `/.well-known/programmable.json`.
2. Read `/api/v1/status` and `/api/v1/manifest`.
3. Backfill `/api/v1/launches` until `page.hasMore` is false.
4. Require `platformId === "programmable"`, then persist `launchId`, category, model, chain, optional token, authenticated assets, provenance, timestamp, finality, markets, capabilities, and fees.
5. Use `page.nextCursor` to finish the current traversal, then persist `page.resumeCursor` and poll with `after`.
6. Reconcile finality and explicit reorg states.

Do not hard-code launcher or registry addresses. The manifest is what allows compatible deployments to appear without a client release.

Do not detect Programmable launches from a token name, symbol, website, contract string, or mutable tag. The official feed assigns `platformId: "programmable"` only after matching a trusted launcher event or authenticated finalized Registry record. Use `category` for exactly Classic versus Custom and `launch.modelId` for the open-ended model.

## New-launch card

A robust minimum card shows:

- token name, symbol, and checksummed address when `token` is present;
- otherwise the launch ID and authenticated project asset identities;
- verified `platformId: "programmable"` provenance;
- `Programmable Classic` or `Programmable Custom`;
- original onchain launch time;
- finality state;
- market state such as active, inactive, paused, or no registered market;
- a link to the launch transaction or provenance details.

The whole `token` view can be null for a project-only Custom launch. Name, symbol, decimals, supply, and timestamp can also be null or unavailable when enrichment fails. Keep the recognized launch visible using chain, launch ID, authenticated assets, and the evidence that is present. Label incomplete fields rather than inventing values.

Do not show a launch as older because your indexer discovered it late. Sort by canonical launch block position and use the onchain timestamp when it is available.

When the feed status is `degraded`, canonical event coverage can still be complete while enrichment is incomplete. Ingest the records and preserve their partial provenance and unavailable fields. A retryable `503` from the launch-list route instead means the API is not publishing an incomplete event-log coverage boundary.

## Classic and Custom

Render only two public labels:

- `Programmable Classic`
- `Programmable Custom`

Do not expose internal model IDs as additional launch categories. Existing first-party stock-paired records are Custom. Future hooks and other unfamiliar designs are also Custom.

Use market kind, capabilities, and optional extensions for secondary details. This keeps filtering stable while allowing new designs.

## Market presentation

`markets` may contain zero, one, or several entries.

### No market

When `markets` is empty:

- keep the launch in the feed, including `token: null` project-only records;
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
