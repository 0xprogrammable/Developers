# Programmable Developer Platform documentation

Programmable exposes one versioned integration surface for Classic and Custom launches. Use these docs to discover launches, verify their origin, and decide which market features your product can safely expose.

## Start here

1. [Current integration status](status.md)
2. [Minimal API integration](quickstart.md)
3. [The launch data model](concepts/data-model.md)
4. [v2 compatibility rules](concepts/compatibility.md)
5. [Production operations](operations.md)

## Choose an integration path

- [Trading terminals and scanners](guides/terminals-and-scanners.md)
- [Launch providers](guides/launch-providers.md)
- [Wallets and explorers](guides/wallets.md)
- [Indexers and data platforms](guides/indexers.md)
- [Apps, games, and bots](guides/apps-and-games.md)

## Reference

- [HTTP API](reference/http-api.md)
- [Platform fees](reference/fees.md)
- [OpenAPI 3.1 contract](../openapi/programmable-v2.yaml)
- [JSON Schemas](../schemas/v2/)
- [Read-only examples](../examples/)
- [Prelaunch Custom Registry proposal](../proposals/custom-registry/)
- [FAQ](faq.md)
- [`llms.txt`](../llms.txt)
- [`llms-full.txt`](../llms-full.txt)

## Product status in one paragraph

Classic launch discovery is live on Ethereum. Programmable Custom is reserved for accepted Custom Registry launches, and that registry is prelaunch. Historical Stock-Paired records are not part of the v2 Custom classification. Every registered v2 launch is discoverable through one envelope; charts, quotes, simulation and execution are present only when a verified adapter declares support.

For live machine-readable state, read `GET https://developers.programmable.family/api/v2/status` and the deployment manifest instead of relying on prose.
