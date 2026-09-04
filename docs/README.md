# Documentation

Choose a guide for your task. Use the references for field definitions and the
chain manifest for current deployment data.

## Get started

- [Quickstart](quickstart.md) — choose a chain and make the first read-only request.
- [Integration status](status.md) — direct verification, hosted feeds and launch-API availability.
- [Examples](../examples/README.md) — runnable consumers and stamp verifiers.

## Integrate launches

| Task | Guide |
| --- | --- |
| Index Robinhood Custom launches | [Robinhood terminal integration](guides/robinhood-terminal-indexer.md) |
| Add launch labels and market features | [Trading terminals and scanners](guides/terminals-and-scanners.md) |
| Store and follow launch records | [Indexers and data platforms](guides/indexers.md) |
| Display token identity and provenance | [Wallets and explorers](guides/wallets.md) |
| Read capabilities for an application | [Apps, games and bots](guides/apps-and-games.md) |
| Build a launch provider integration | [Launch providers](guides/launch-providers.md) |

The Robinhood guide is also available on the
[developer site](https://developers.programmable.family/robinhood-terminal-indexer)
and as [plain Markdown](https://developers.programmable.family/robinhood-terminal-indexer.md).

## Understand the records

- [Data model](concepts/data-model.md) — launches, tokens, assets, markets and capabilities.
- [Multi-chain discovery](concepts/multi-chain.md) — chain selection and deployment identity.
- [Programmable Verified](concepts/programmable-verified.md) — the scope of a structured review.
- [Compatibility](concepts/compatibility.md) — additive fields and unknown values.
- [FAQ](faq.md) — common integration questions.

## Reference

| Reference | Contents |
| --- | --- |
| [HTTP API](reference/http-api.md) | Endpoints, filters, response fields, errors and caching |
| [Hosted feed integration](reference/hosted-feed.md) | Complete traversal, durable cursors, retries and partial data |
| [Launch stamp Router](reference/launch-stamp.md) | Canonical stamps, getters, proofs, finality and test vectors |
| [Onchain verification](reference/onchain-verification.md) | Deployment, event and runtime verification |
| [Platform fees](reference/fees.md) | Fee policies, accounting and evidence |
| [Protocol fee claim discovery](reference/protocol-fee-claims.md) | Claim inventory, eligibility and wallet boundary |

Machine-readable contracts: [OpenAPI](../openapi/), [JSON Schemas](../schemas/),
[ABIs](../abis/README.md) and [deployment evidence](../deployments/).

## Launch API

The Custom Launch API is hosted separately from the Developer read API.
Start with the [launch guide](https://programmable.market/docs/developers/custom-launch)
and the [current availability](status.md#launch-api-versions).
An API credential does not sign or broadcast a wallet transaction.

| Contract | Use |
| --- | --- |
| [Direct Native Hook Graph V3](guides/direct-native-hook-graph-profile-v3.md) | Current Ethereum profile `3.3.0` |
| [Robinhood V4 OpenAPI](https://programmable.market/openapi/custom-launch-v4.json) | Planned chain-4663 API contract |
| [Programmable Launch Policy](https://github.com/programmablehq/Launch-Policy) | Versioned launch requirements |

Robinhood source verification has a separate
[API status contract](https://programmable.market/schemas/custom-launch/v4/source-verification-status.json)
and [Developer projection schema](https://developers.programmable.family/schemas/v2/custom-launch-source-verification-v4.schema.json).
Their publication does not prove an exact source match for a deployment.

## Operate an integration

- [Production checklist](integration-checklist.md)
- [Operations](operations.md)
- [Support](../SUPPORT.md) and [security reporting](../SECURITY.md)

## Compatibility and historical profiles

Use these references for existing integrations and resources. Their publication
does not enable a fresh launch through a retired or preview profile.

- [Developer API v1 to v2 migration](migrations/v1-to-v2.md)
- [Custom Launch API V1](https://programmable.market/developers/custom-launch-api-v1.md)
- [Fee-Enforced Launch Profile V2](guides/custom-fee-enforced-launch-profile-v2.md)
- [Direct Native Hook Graph V2](guides/direct-native-hook-graph-profile-v2.md)
- [Direct Native Hook Graph V1 preview](guides/direct-native-hook-graph-profile-v1.md)

## Repository maintenance

- [Contributing](../CONTRIBUTING.md), [versioning](../VERSIONING.md) and [changelog](../CHANGELOG.md)
- [Vercel release procedure](vercel-release-control.md)
- [Announcement drafts](social-posts.md)
- [Agent index](../llms.txt) and [full agent reference](../llms-full.txt)

Files under [proposals/](../proposals/) are design proposals, not deployed contracts.
