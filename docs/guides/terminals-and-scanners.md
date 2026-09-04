# Trading terminals and scanners

This document is the implementation contract for adding Programmable launches to a terminal, scanner, bot, or market-data platform.

## Public classification contract

Expose exactly two filters and labels:

| API value | Display label | Include |
| --- | --- | --- |
| `category=classic` | `Programmable Classic` | Enabled historical V3 and current V4 releases |
| `category=custom` | `Programmable Custom` | Launches accepted through the manifest-listed Custom Registry or finalized with `CustomGraph` by the canonical Router |

Do not expose internal model IDs or Router as additional public categories. Router is provenance and transport infrastructure. A Programmable label establishes recognized launch provenance. It is not a universal audit, safety, liquidity, or execution guarantee.

## Current Ethereum sources

Read launcher, hook, registry, event and start-block values from `GET /api/v2/manifest` in production. A complete Classic backfill includes every deployment whose discovery state is enabled: historical V3 and current V4 only. Classic V1/V2 remain inactive history, and Stock is excluded from active v2 discovery. Do not copy a deployment address into consumer code or documentation derived from this guide.

The manifest records historical V3 and current V4 separately. New launches follow V4; historical V3 tokens remain associated with the deployment that emitted their launch event. A generic Router-first consumer discovers the V4 range by refreshing the manifest, without changing code or copying a new address.

## Current Custom boundary

Custom Registry discovery is live and the v2 Custom feed publishes finalized approved records. Legacy Registry and GitHub submission intake are closed. Custom Launch API V1 and V2 historical reads remain compatible, but authenticated POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY` or `409 CUSTOM_LAUNCH_V2_READ_ONLY`; only V3 profile `3.3.0` accepts fresh submissions.

Stock launches are excluded from active v2 discovery and are not Programmable Custom. Do not import them from API v1, infer the label from a hook address, or assign the label from a provider name.

Every recognized Custom launch uses the same `custom` category even when its token, hook, factory, provider, market and template contracts differ from every prior launch. Those values stay on the individual record. Registry records derive the classification from the accepted Registry event; Router records derive it from a consistent finalized `CustomGraph` stamp. Neither lane may infer the label from metadata.

This is a Programmable launch integration, not an all-hooks index. Include only
finalized records produced by the manifest-listed Registry or stamped by the
manifest-bound Programmable Router on a published chain. The existence of
Uniswap v4 bytecode, callbacks, a pool, or a hook address alone is never a
classification signal.

The baseline integration discovers every recognized launch. Charting, quotes, simulation, and execution are separate per-market capabilities and may be unavailable.

## Chain selection and release state

Ethereum Mainnet (`chainId: 1`) has an active Developer read model. Robinhood
Chain Mainnet (`chainId: 4663`) publishes live direct-chain Router provenance,
with its hosted read model still planned. Require the exact manifest's live
`directChainIntegration` and Router deployment evidence to start independent
scanning. A hosted HTTP `200` with `unavailable` quality does not establish
index completeness or negate a directly verified launch.

Select a chain from `/.well-known/programmable.json`, then fetch its manifest
and chain-qualified status. Follow the
[Robinhood terminal integration](https://developers.programmable.family/robinhood-terminal-indexer)
for chain 4663. Keep chain and category attached to every hosted cursor
continuation or `after` poll. A planned Router cannot be scanned as live; an
unavailable hosted feed cannot establish absence. Neither live provenance nor
feed health alone enables charting or trading. See
[Indexers and data platforms](indexers.md) for cursor and checkpoint rules.

## Minimum integration

1. Fetch `/.well-known/programmable.json`.
2. Select one advertised chain and read `/api/v2/status?chainId={chainId}` plus `/api/v2/manifests/{chainId}`.
3. Backfill `/api/v2/launches?chainId={chainId}` until `page.hasMore` is false, preserving the chain and category scope on every page.
4. Persist `launchId`, project and asset identities, provenance, timestamp, finality, markets, capabilities, and fees.
5. Use `page.nextCursor` to finish the current traversal, then persist `page.resumeCursor` and poll with `after`.
6. Reconcile finality and explicit reorg states.

Do not hard-code launcher or registry addresses. The manifest is what allows compatible deployments to appear without a client release.

For direct onchain consumers, keep the enabled deployment sources and the live
launch-stamp Router source separate. Ethereum publishes exact finalized canary
evidence for both `CustomGraph` and Classic. Robinhood publishes its own
Custom finalized launch evidence at `directChainIntegration.evidenceUrl`.
Verify the exact chain-bound evidence and canonical boundary; never copy
Ethereum route-coverage claims to Robinhood.

1. Existing and historical `Programmable Classic` records require a launch event from an enabled Classic launcher in the v2 manifest.
2. Registry-backed `Programmable Custom` records require the published Custom Registry evidence described by the current v2 feed contract.
3. Router V1 launches require a nonzero direct lookup or a valid launch event from the exact top-level `launchStampRouter` address in the v2 manifest. Router V1 does not backfill historical launches.
4. Router-stamped `Programmable Classic` and `Programmable Custom` labels share that one Router trust root. Read the stamp record after a token or `(PoolManager, PoolId)` lookup: `LaunchKindV1.CustomGraph = 1` maps to Custom and `LaunchKindV1.Classic = 2` maps to Classic; reject `Invalid = 0`. Do not guess the class from token metadata, a hook, or a factory call.

The Ethereum hosted v2 launch feed also projects finalized canonical-Router Custom token identities through the Website's bounded Router snapshot, after recomputing its canonical identity commitment and validating its manifest binding, ordering, uniqueness, and finality boundary. A separate digest-pinned last-known-good snapshot survives source outages. This projection is independent from Custom Registry freshness. It preserves token and recorded pool identity when enrichment is missing, but leaves current market support, supply, and fee policy unavailable unless another exact evidence source establishes them. While only last-known-good data is available, the feed stays degraded and absence is not authoritative.

For an interoperable Router point lookup, use the manifest-advertised getter for a token or `PoolManager + PoolId`. Scope every nonzero launch ID with the manifest chain ID and Router address. The Classic hook is shared, so its address must never identify or classify one Classic launch. `launchIdByComponent` may corroborate an exclusive component; for every address-based lookup, require `stampProof` to return the same launch ID and stamp hash. Resolve one finalized or caller-supplied canonical block to a number and hash. Prefer EIP-1898 hash-bound reads with `requireCanonical: true`; otherwise re-read that height after the complete verification and require the hash to be unchanged. Use HTTPS for a remote RPC endpoint; plaintext HTTP is suitable only for loopback development. The lookup needs no Programmable server, database, Registry, or indexer. See [Launch stamp Router verification](../reference/launch-stamp.md).

Logs qualify only when both the emitter and `topic0` exactly match the manifest-bound Router and ABI. A copied event from another address, direct Classic launcher or Graph Factory calls, and every Single Factory call are outside Router V1 provenance.

For a direct onchain Router index, backfill `eth_getLogs` from the manifest `startBlock` in finality-bounded chunks, filtered by the exact Router emitter and complete topic set. Persist block hash, transaction hash and index, and log index. Verify every candidate through the matching token, pool, or exclusive-component getter plus `launchStamp` at the same canonical block; require `stampProof` for address-based token and component checks. Advance only a durable finalized checkpoint, replay an overlap idempotently, orphan and rewind on a block-hash change, then poll or subscribe from the overlapping checkpoint so the backfill-to-live handoff has no gap. A subscription notification alone is not provenance. The complete sequence and finalized PCAN test vector are in [Launch stamp Router verification](../reference/launch-stamp.md).

The stamp is point-in-time provenance. For proxy or beacon components, a matching recorded shell code hash does not establish the current implementation, admin, beacon, initialization state, or upgrade authority. Resolve and revalidate those independently under the terminal's current security policy. A stamp does not establish safety, audit status, liquidity, sellability, or execution support.

Only consistent records from the exact canonical Router qualify through Router V1. Publishing this interface does not mean GMGN, Axiom, FOMO, or another named terminal has integrated it automatically. The separately documented Custom Launch API V3 profile `3.3.0` accepts fresh submissions; V1 and V2 retain historical reads only. This terminal integration surface remains read-only and the closed GitHub approval flow must not be revived.

GMGN's generic `uniswap_v4` and `poolId` discovery can identify the PCAN token or pool as an ordinary market. It does not verify the canonical Router stamp or show that GMGN integrated the Programmable label. Do not treat third-party market metrics as canonical onchain evidence. Verify the stamp through the Router, and read current pool state separately through PoolManager or StateView.

Dexscreener-style token or pair discovery has the same boundary: a discovered
market is not proof of the Programmable Router launch, complete project
metadata, partner attribution, or a provider risk label. FOMO, GMGN,
Dexscreener, Axiom, and other providers control their own ingestion and
labelling. Programmable cannot guarantee indexing, refresh timing, or a
provider-specific `safe` result.

## New-launch card

A robust minimum card shows:

- project or token name as creator metadata;
- chain plus checksummed token or contract address when present;
- `Programmable Classic` or `Programmable Custom`;
- original onchain launch time;
- finality state;
- market state such as active, inactive, paused, or no registered market;
- a link to the launch transaction or provenance details.

For finalized profile-metadata cards, read name, symbol, description, image,
website, and X from the finalized metadata ledger and join it to the exact
Router launch ID and onchain identities. Current profiles are complete before
launch; an older finalized record can legitimately have null presentation
fields. Show a placeholder for those missing fields rather than scraping or
inventing them.

When the record carries an exact
`programmable.launch-partner-attribution.v1` snapshot, render its partner name
and optional website as `Launched via …`. The Custom Launch API source field is
`partnerAttribution`; the additive Developer launch projection is
`launchedVia`. Do not accept either from creator metadata, and do not translate
it into the economic `partner` field, Registry `provider` status, audit, safety,
liquidity, or terminal-index status.

Name, symbol, decimals, supply, and timestamp can be null or unavailable when enrichment fails. `token` can be null for a project-only launch. Keep the recognized launch visible using its project ID, chain, authenticated assets, launch ID, and the evidence that is present. Label incomplete fields rather than inventing values.

Do not show a launch as older because your indexer discovered it late. Sort by canonical launch block position and use the onchain timestamp when it is available.

When the feed status is `degraded`, canonical event coverage or enrichment is incomplete. Ingest recognized records, preserve partial provenance and unavailable fields, and do not treat absence as an authoritative deletion. The launch-list route returns these bounded records with HTTP `200`; `503` is reserved for a transient failure that prevents the response from being produced.

Use market kind, capabilities, and optional extensions for secondary details. This keeps filtering stable while allowing new designs.

## Verification and sell support

Classic V3 release evidence establishes a fixed supply of 1,000,000,000 tokens, no owner mint, blacklist, pause, or ERC20 transfer tax, permanently held one-sided Uniswap v4 liquidity, immutable directional fees, and a recorded mainnet buy, sell, and claim lifecycle. Treat V4 as a distinct manifest release and evaluate its own published evidence rather than extending V3 claims by version inference.

Classic V3 has no token-level sell restriction. A terminal must still check the applicable release evidence plus current pool state, liquidity, quote, and simulation before enabling a trade. Do not translate the label into a generic `safe`, `audited`, `unruggable`, or `sellable` boolean.

Custom is a launch family rather than one mechanic. Preserve provider, factory, template, hook, source provenance, declared capabilities, market support, fee disclosure and release-specific review evidence as separate fields. Do not infer an audit or `Programmable Verified` from `category=custom`.

### Unknown provider or template

Suppose a future record names template ID `future-auction-v99` and carries `provider.id: "future-provider-v99"` with `provider.verificationStatus: "display-only"`. Keep the launch visible as `Programmable Custom`, and optionally display `Future Provider · future-auction-v99` as secondary attribution. Preserve namespaced provider extensions for later clients, but do not use the provider or template name to upgrade origin, partner status, fee verification, review status, charting, quotes, simulation, or execution. Only a provider record marked `registry-bound` with its evidence hash is authenticated provider provenance; even that status does not independently prove fees, review, or market support.

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
- The public Custom Fee-Enforced V2 profile specifies an additive 1,000 ppm on the gross unspecified pool-currency amount for each successful swap through the exact bound pool.
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
- every Stock launch excluded from active v2 discovery;
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
