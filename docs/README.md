# Programmable Developer Platform documentation

Programmable exposes one versioned integration surface for Classic and Custom launches. Use these docs to discover launches, verify their origin, and decide which market features your product can safely expose.

## Start here

1. [Current integration status](status.md)
2. [Five-minute quickstart](quickstart.md)
3. [The launch data model](concepts/data-model.md)
4. [v1 compatibility rules](concepts/compatibility.md)
5. [Production operations](operations.md)

## Choose an integration path

- [Trading terminals and scanners](guides/terminals-and-scanners.md)
- [Wallets and explorers](guides/wallets.md)
- [Indexers and data platforms](guides/indexers.md)
- [Apps, games, and bots](guides/apps-and-games.md)

## Reference

- [HTTP API](reference/http-api.md)
- [Platform fees](reference/fees.md)
- [OpenAPI 3.1 contract](../openapi/programmable-v1.yaml)
- [JSON Schemas](../schemas/v1/)
- [Read-only examples](../examples/)
- [FAQ](faq.md)
- [`llms.txt`](../llms.txt)
- [`llms-full.txt`](../llms-full.txt)

## Product status in one paragraph

Classic launch discovery is live on Ethereum. Existing first-party stock-paired records are normalized as `custom` so integrators need only the public `classic | custom` distinction. Open Custom intake and the open Custom Registry are prelaunch. Every registered launch is discoverable through the v1 envelope; charts, quotes, simulation, and execution are present only when a verified adapter declares support.

For live machine-readable state, read `GET https://developers.programmable.family/api/v1/status` and the deployment manifest instead of relying on prose.
