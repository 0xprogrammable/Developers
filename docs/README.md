# Programmable Developer Platform documentation

Programmable exposes one versioned, unauthenticated integration surface for discovering Classic and Custom launches.
Use these docs to verify origin and decide which market features your product can safely expose.

## Choose the API surface

| Goal | Surface |
| --- | --- |
| Discover launches and verify provenance | [Developer read API](../README.md), no API key required |
| Prepare and track a public Custom launch | [Custom Launch API guide](https://programmable.market/docs/developers/custom-launch), using a wallet key from [API key management](https://programmable.market/developers/api-keys) or an approved partner root/subkey credential; wallet signing stays separate |
| Build a partner or agent launch frontend | [Launch providers](guides/launch-providers.md), keeping the bounded one-level partner credential server-side, using the same V3 policy, and accepting only immutable server-derived attribution |
| Generate a Custom Launch V1 client | [Canonical V1 OpenAPI](https://programmable.market/openapi/custom-launch-v1.json), preserving the read-only POST boundary |
| Verify a historical fee-enforced V2 resource | [Custom Fee-Enforced Launch Profile V2](guides/custom-fee-enforced-launch-profile-v2.md) and its [V2 OpenAPI](https://programmable.market/openapi/custom-launch-v2.json) |
| Integrate the active V3 general direct-hook lane | [Direct Native Hook Graph Profile V3](guides/direct-native-hook-graph-profile-v3.md), with exact graph binding, deterministic static admission and mandatory Router simulation |
| Keep a Revision 2 integration compatible | [Direct Native Hook Graph Profile V2](guides/direct-native-hook-graph-profile-v2.md), retained for exact 3–16-target graphs, all valid v4 masks and three funding modes |
| Inspect the retained V3 preview | [Direct Native Hook Graph Profile V1](guides/direct-native-hook-graph-profile-v1.md), preserved unchanged for discovery compatibility |
| Resolve the current launch requirements | [Programmable Launch Policy](https://github.com/0xprogrammable/Launch-Policy) |

The Custom Launch API is separately hosted at `https://api.programmable.market`. V1 and V2 retain historical reads,
but their authenticated POST routes return nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY` or
`409 CUSTOM_LAUNCH_V2_READ_ONLY`. Only V3 profile `3.3.0` accepts fresh submissions while the controller wallet
reviews and signs an authorized exact transaction separately. The V1 and V2 schemas remain in their canonical OpenAPI
contracts instead of being copied into this read/discovery repository.

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
- [Custom Fee-Enforced Launch Profile V2](guides/custom-fee-enforced-launch-profile-v2.md)
- [Direct Native Hook Graph Profile V3](guides/direct-native-hook-graph-profile-v3.md)
- [Direct Native Hook Graph Profile V2](guides/direct-native-hook-graph-profile-v2.md)
- [Direct Native Hook Graph Profile V1](guides/direct-native-hook-graph-profile-v1.md)
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

Classic launch discovery and Custom Registry generation 1 are live on Ethereum. Custom Launch API V1 and V2 retain historical reads, but authenticated POST is read-only and returns nonretryable HTTP 409; only V3 profile `3.3.0` accepts fresh submissions. The active Direct Native Hook Graph Revision 3 accepts exact 3–16-target project token and hook graphs and all valid v4 permission masks. The API server, not a CLI, LLM, or client, decides authorization and may expose a wallet handoff only after server-verified exact-request behavior, applicable platform-fee, declared-liquidity-model, admission, and Router-simulation evidence passes. That does not make an arbitrary hook safe or prove universal fee enforcement. Legacy Registry and GitHub submission intake are closed. The separate `launchStampRouter` trust root is live for Router-stamped Classic and Custom launches from block `25717612`; historical coins are not backfilled. Historical Stock-Paired records are not part of the v2 Custom classification. Every recognized v2 launch remains discoverable through one envelope even when coverage or enrichment quality is degraded; charts, quotes, simulation and execution are present only when a verified adapter declares support.

For live machine-readable state, read `GET https://developers.programmable.family/api/v2/status` and the deployment manifest instead of relying on prose.

Files under `proposals/` are non-normative design inputs, not deployed ABIs or integration endpoints.
