# Frequently asked questions

## Do terminals need a second integration when open Custom launches activate?

No mandatory client change is expected for a conforming v2 integration. Custom activation appears through the same discovery document, manifest, launch envelope and categories.

The client must read deployment arrays dynamically, accept unknown optional values, support `markets: []`, and use feature support rather than a fixed list of market designs.

## Is Custom live?

Yes, through metadata-bound profile `3.3.0` on the separate authenticated [Custom Launch API V3](https://programmable.market/docs/developers/custom-launch) on Ethereum Mainnet. Existing wallet keys remain compatible; approved partner roots and bounded one-level subkeys use the same V3 routes and server-side policy. No credential signs, broadcasts, bypasses admission, or supplies attribution. The API server, not a CLI, LLM, or client, decides authorization after the exact static admission baseline and pinned Router simulation. Missing or unavailable runtime behavior evidence keeps claims unverified rather than proving behavior; an authenticated executed negative blocks handoff. This does not make arbitrary hooks safe or universally fee-enforced. Custom Launch API V1 and V2 retain historical reads, but authenticated POST returns nonretryable HTTP 409. Custom Registry discovery is live; legacy Registry and GitHub submission intake are closed.

Future Custom fixtures are examples, not live registry launches. Stock-Paired records are excluded from active v2 discovery; the frozen v1 compatibility contract is not an input to the v2 feed.

## Can every Custom launch be displayed?

Every registered launch can be discovered and shown through the stable core envelope.

That includes project-only launches with `token: null`, multiple tokens or contracts, no market, several markets, and unknown future asset roles. A token list can omit a project-only launch while the general feed retains it.
A client must retain authenticated identities in `assets` and must not invent a token contract to display a project-only launch.

## Can every Custom launch be charted or traded?

No. Charting, quotes, simulation, and execution require corresponding verified adapter support. Unsupported markets remain discoverable without fabricated data or transaction routes.

## What if a launch has no liquidity pool?

`markets` can be empty, and a non-pool market can omit pool fields. Display the launch and its provenance. Do not invent a pair, price, liquidity, volume, or swap button.

## What if a launch has several markets?

Store each by `marketId` and present a market selector or a documented deterministic choice. Do not merge incompatible price or volume sources without a verified normalizer.

## Why only Classic and Custom?

Those categories answer which Programmable launch family produced the record. Tokenomics and market mechanics are extensible and belong in capabilities, markets, and namespaced extensions. Adding a public category for every new idea would make integrations brittle.

## How do I identify a token?

Use chain ID plus token contract address. Use `launchId` to identify the Programmable launch. Names and tickers are not unique.

If `token` is null, the launch does not advertise a token. Use `projectId`, `launchId`, and `assets[].identity`; do not turn a project or market contract into a token address.

## Should I hard-code the launcher or registry address?

No. Read active deployment arrays and start blocks from `/api/v2/manifest`. This is how compatible deployments are added without a mandatory client update.

## Do I need to change my indexer for Classic V4?

Not if it already refreshes the manifest and scans every enabled release. Active Classic discovery now consists of historical V3 plus current V4; V1/V2 remain inactive history. A generic manifest-driven client discovers V4 without a code or pinned-address change.

The hosted feed uses the canonical paginated `https://programmable.market/api/explore` catalog and validates its schema, scope, evidence and identity commitments. The current catalog reports Envio deployment `production-6157d22`, but a legitimate deployment revision does not require a code update. It no longer depends on the retired legacy source that returned HTTP `410`. Stock is excluded, and Custom remains a separate category and provenance path.

## Is Router a third launch category?

No. `launchStampRouter` is a provenance and transport trust root. Its stamped kind maps a verified launch to the existing `classic` or `custom` category. The manifest now publishes finalized exact canary evidence for both `CustomGraph` and Classic V4, but that does not create a `router` category or replace per-launch verification.

## What does registration prove?

It establishes the launch provenance represented by the record: recognized source, transaction, block, token, and verification state.

It does not guarantee price performance, liquidity, offchain services, metadata truth, legal status, or the absence of every possible risk.

## Is every launch audited or guaranteed safe?

No unconditional audited, safe, or unruggable claim is made. Use the specific provenance, finality, runtime, adapter, and dependency evidence exposed by the record.

`Programmable Verified` is narrower: it means the launch was reviewed under the published policy and cryptographically bound to the exact deployed revision. It does not collapse authorities, dependencies, market support, metadata, finality, or external audits into `safe: true`.

## Is metadata verified?

Not by default. Names, symbols, descriptions, images, and links are creator-supplied display data unless a specific status says otherwise. Keep chain and address visible and sanitize remote content.

## What does partial provenance mean?

Some canonical evidence is unavailable. Older compatibility records can be partial because they do not contain every event coordinate needed for full verification. A newly recognized onchain event can also be partial when receipt or block enrichment is missing. Partial is an evidence state, not an unsafe verdict.

## Does missing metadata remove a launch?

No. A recognized onchain event remains discoverable when name, symbol, decimals, supply, metadata, or block timestamp cannot be enriched. Fields remain null or unavailable, token identity can be partial, and the feed can be degraded. Integrators should show the chain and token address and avoid guessed replacements.

## When does the feed return 503?

Launch-list and token-list routes do not turn incomplete source coverage into a blanket `503`. They return the recognized bounded records they can establish and mark feed quality `degraded` or `unavailable` as appropriate. A retryable `503` is reserved for a failure that prevents the response itself from being produced. Missing metadata, market enrichment, or supply produces degraded quality rather than hiding recognized launches. During partial coverage, a known detail record can still be returned; an unknown address is not treated as a definitive `404` until coverage is complete.

## How does the 0.1% fee work?

Current Classic official paths include the 10 bps Programmable share within the configured trading fee. The retained historical Custom Fee-Enforced V2 profile specifies an additive 1,000 ppm on the gross amount of the unspecified pool currency for each successful swap through its exact bound pool. That profile does not make unrelated hooks or markets fee-enforced. Exact input accounts the output currency; exact output accounts the input currency. The sealed vault holds PoolManager ERC-6909 claims that only the fixed reward wallet can claim. Read each verified fee disclosure rather than deriving economics from the category.

The recipient is `0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`.

Partner attribution does not by itself activate a fee. Without a qualifying official market path, a partner-attributed project uses zero shares. An active fee-bearing partnership-template path uses exactly 20 bps on one basis: 15 bps partner plus 5 bps Programmable, and it does not also charge the Native Custom 10 bps. No Basebit or Aion live partner path or recipient is currently verified by the public v2 manifest.

Liquidity-provider fees, protocol fees, creator or custom-module fees, the
Programmable profile fee, and network gas are separate components. Neither API
availability nor a declared policy proves onchain enforcement, exact source,
finality, tradability, claim support, buybacks, or an audit.

## Is Custom Registry Generation 2 the fee-enforced API?

No. Custom Registry Generation 2 is an unavailable four-contract discovery
trust root. Custom Fee-Enforced Launch Profile V2 is the separate retained
historical profile. Developer API v2 is the live read-only discovery API major.
Custom Launch API V1 and V2 historical reads remain available, while authenticated
POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY` or
`409 CUSTOM_LAUNCH_V2_READ_ONLY`. Only V3 profile `3.3.0` accepts fresh submissions.
All use only the existing `classic` and `custom` categories.

## Does the fee apply to transfers or a third-party pool?

The platform volume fee applies to the supported official Programmable market path. Ordinary transfers, rewards, mints, burns, and independently created third-party pools are outside that path unless a future verified record explicitly says otherwise.

## When does a new launch appear?

A launch can appear after its recognized onchain event is indexed. It retains the original onchain timestamp and may initially be `observed` or `confirmed` before becoming `finalized`. Approval or submission alone is not a public launch.

## What happens during a reorg?

The finality state can change. The schema permits an `orphaned` correction, but consumers should also reconcile non-final records against later snapshots rather than assuming the current feed is a complete tombstone history. Apply all updates idempotently.

## Do I need an SDK?

No. The read-only v2 API uses JSON over HTTP. OpenAPI, JSON Schemas, fixtures, and examples are available for generated or hand-written clients.

## Is Programmable live on Base, BNB Chain, or Arbitrum?

Not through the current public discovery document. Ethereum Mainnet is the only advertised active chain. A future EVM chain becomes supported only when the well-known document and chain manifest publish it with evidenced deployments or Registry generations.

## Does publication mean GMGN, Photon, Axiom, FOMO, or another terminal already supports Programmable?

No. The integration is public for any provider to adopt. Generic GMGN `uniswap_v4` and `poolId` discovery is ordinary token and pool listing, not verification of the canonical Router stamp or confirmation that GMGN integrated the Programmable label. Third-party market metrics are not canonical onchain evidence; verify provenance through the Router and read current pool state separately through PoolManager or StateView. Describe a named provider as integrated only after that provider confirms it.

## Do Custom launches still use GitHub approval pull requests?

No. Legacy Registry and GitHub submission intake are closed. Use metadata-bound
profile `3.3.0` on the authenticated [Custom Launch API V3](https://programmable.market/docs/developers/custom-launch).
V1 and V2 historical reads remain compatible, but authenticated POST returns
nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY` or `409 CUSTOM_LAUNCH_V2_READ_ONLY`.
An API key is never wallet signing, broadcast, or authorization authority.

## What should an unknown future market look like?

Keep the token and provenance visible, label it as Custom, show only understood lifecycle information, and mark unsupported features unavailable. Do not reject the entire launch or guess how to trade it.
