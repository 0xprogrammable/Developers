# Frequently asked questions

## Do terminals need a second integration when open Custom launches activate?

No mandatory client change is expected for a conforming v2 integration. Custom activation appears through the same discovery document, manifest, launch envelope and categories.

The client must read deployment arrays dynamically, accept unknown optional values, support `markets: []`, and use feature support rather than a fixed list of market designs.

## Is Custom live?

No. Custom Registry discovery is live, but general Custom intake remains prelaunch. The v2 Custom feed contains only finalized approved Registry records.

Future Custom fixtures are examples, not live registry launches. Historical Stock-Paired records are not Programmable Custom in v2.

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

## What does registration prove?

It establishes the launch provenance represented by the record: recognized source, transaction, block, token, and verification state.

It does not guarantee price performance, liquidity, offchain services, metadata truth, legal status, or the absence of every possible risk.

## Is every launch audited or guaranteed safe?

No unconditional audited, safe, or unruggable claim is made. Use the specific provenance, finality, runtime, adapter, and dependency evidence exposed by the record.

`Programmable Verified` is narrower: it means the launch was reviewed under the published policy and cryptographically bound to the exact deployed revision. It does not collapse authorities, dependencies, market support, metadata, finality, or external audits into `safe: true`.

## Is metadata verified?

Not by default. Names, symbols, descriptions, images, and links are creator-supplied display data unless a specific status says otherwise. Keep chain and address visible and sanitize remote content.

## What does partial provenance mean?

Some canonical evidence is unavailable. Legacy indexer records can be partial because they do not contain every event coordinate needed for full verification. A newly recognized onchain event can also be partial when receipt or block enrichment is missing. Partial is an evidence state, not an unsafe verdict.

## Does missing metadata remove a launch?

No. A recognized onchain event remains discoverable when name, symbol, decimals, supply, metadata, or block timestamp cannot be enriched. Fields remain null or unavailable, token identity can be partial, and the feed can be degraded. Integrators should show the chain and token address and avoid guessed replacements.

## When does the feed return 503?

For completeness gating, launch-list and token-list routes return a retryable `503` when Classic event coverage is incomplete. Custom and unfiltered routes also require the authenticated Registry to be current and complete; `category=classic` remains independent. Missing metadata or supply alone produces degraded enrichment rather than hiding recognized launches. During partial coverage, a known detail record can still be returned; an unknown address is not treated as a definitive `404` until coverage is complete.

## How does the 0.1% fee work?

Current Classic official paths include the 10 bps Programmable share within the configured trading fee. Future verified Native Custom official paths add 10 bps on top of the creator-defined market fee. Read each verified fee disclosure rather than deriving economics from the category.

The recipient is `0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`.

Partner attribution does not by itself activate a fee. Without a qualifying official market path, a partner-attributed project uses zero shares. An active fee-bearing partnership-template path uses exactly 20 bps on one basis: 15 bps partner plus 5 bps Programmable, and it does not also charge the Native Custom 10 bps. No Basebit or Aion live partner path or recipient is currently verified by the public v2 manifest.

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

No. The integration is public for any provider to adopt. A named provider should be described as integrated only after that provider confirms it.

## What should an unknown future market look like?

Keep the token and provenance visible, label it as Custom, show only understood lifecycle information, and mark unsupported features unavailable. Do not reject the entire launch or guess how to trade it.
