# Programmable Developer Platform documentation

Programmable exposes one versioned, unauthenticated integration surface for discovering Classic and Custom launches.
Use these docs to verify origin and decide which market features your product can safely expose.

## Choose the API surface

| Goal | Surface |
| --- | --- |
| Discover launches and verify provenance | [Developer read API](../README.md), no API key required |
| Prepare a new Custom launch | [Custom Launch API guide](https://programmable.market/developers/custom-launch-api-v1.md), using a wallet-bound API key from [API key management](https://programmable.market/developers/api-keys) |
| Generate a Custom launch client | [Canonical live OpenAPI](https://programmable.market/openapi/custom-launch-v1.json) |
| Resolve the current launch requirements | [Programmable Launch Policy](https://github.com/0xprogrammable/Launch-Policy) |

The Custom Launch API is separately hosted at `https://api.programmable.market`. It validates and prepares a Router
action but does not sign or broadcast the wallet transaction. Its schemas remain in the canonical live OpenAPI contract
instead of being copied into this read/discovery repository.

The versioned launch requirements likewise remain owned by Programmable Launch Policy instead of being duplicated here.

## Start here

1. [Current integration status](status.md)
2. [Minimal API integration](quickstart.md)
3. [The launch data model](concepts/data-model.md)
4. [v2 compatibility rules](concepts/compatibility.md)
5. [Programmable Verified](concepts/programmable-verified.md)
6. [Direct onchain verification](reference/onchain-verification.md)
7. [Launch stamp Router verification](reference/launch-stamp.md)
8. [Protocol fee claim discovery](reference/protocol-fee-claims.md)
9. [Production operations](operations.md)
10. [Production integration checklist](integration-checklist.md)

## Choose an integration path

- [Trading terminals and scanners](guides/terminals-and-scanners.md)
- [Launch providers](guides/launch-providers.md)
- [Wallets and explorers](guides/wallets.md)
- [Indexers and data platforms](guides/indexers.md)
- [Apps, games, and bots](guides/apps-and-games.md)

## Reference

- [HTTP API](reference/http-api.md)
- [Platform fees](reference/fees.md)
- [Protocol fee claim discovery](reference/protocol-fee-claims.md)
- [Direct onchain verification](reference/onchain-verification.md)
- [Launch stamp Router verification](reference/launch-stamp.md)
- [Multi-chain discovery](concepts/multi-chain.md)
- [Programmable Verified](concepts/programmable-verified.md)
- [OpenAPI 3.1 contract](../openapi/programmable-v2.yaml)
- [JSON Schemas](../schemas/v2/)
- [Read-only examples](../examples/)
- [FAQ](faq.md)
- [Preview and Live post drafts](social-posts.md)
- [`llms.txt`](../llms.txt)
- [`llms-full.txt`](../llms-full.txt)

## Product status in one paragraph

Classic launch discovery and Custom Registry generation 1 are live on Ethereum. Registry-based public submission intake remains prelaunch; that state is independent from the authenticated Custom Launch API. The separate `launchStampRouter` trust root is live for Router-stamped Classic and Custom launches from block `25717612`; historical coins are not backfilled. Its finalized onchain canary covers `CustomGraph`, with no separate Classic onchain canary. Historical Stock-Paired records are not part of the v2 Custom classification. Every registered v2 launch is discoverable through one envelope; charts, quotes, simulation and execution are present only when a verified adapter declares support.

For live machine-readable state, read `GET https://developers.programmable.family/api/v2/status` and the deployment manifest instead of relying on prose.

Files under `proposals/` are non-normative design inputs, not deployed ABIs or integration endpoints.
