# Migrate from API v1 to v2

API v2 is the canonical integration for new terminals, scanners, bots and launch providers.

## Why v2 exists

API v1 classified historical first-party Stock-Paired launches as `custom`. Programmable no longer uses that model as its public Custom category.

API v2 gives `custom` one precise product meaning: a Programmable Custom launch authenticated by an accepted canonical Custom Registry event or a consistent finalized canonical-Router `CustomGraph` stamp. Stock-Paired records remain available only through v1 compatibility endpoints and are not `Programmable Custom` in v2.

## Classification contract

| API value | Display label | Required evidence |
| --- | --- | --- |
| `classic` | `Programmable Classic` | Event from a Classic launcher listed in the v2 manifest |
| `custom` | `Programmable Custom` | Accepted event from the Custom Registry listed in the v2 manifest, or a consistent finalized `CustomGraph` stamp from its exact canonical Router |

Provider names, factories, hook addresses, token addresses and template versions may differ for every Custom launch. They are record-level provenance, not additional terminal categories. Use `extensions["programmable/classification"].basis` to select the Registry or Router verification path; `category: "custom"` alone never proves Registry acceptance.

## Endpoint changes

| v1 | v2 |
| --- | --- |
| `/api/v1/status` | `/api/v2/status` |
| `/api/v1/manifest` | `/api/v2/manifest` |
| `/api/v1/launches` | `/api/v2/launches` |
| No launch-ID detail route | `/api/v2/launches/{launchId}` |
| `/api/v1/launches/{chainId}/{tokenAddress}` | `/api/v2/launches/{chainId}/{tokenAddress}` |
| `/api/v1/token-list` | `/api/v2/token-list` |
| `/openapi/programmable-v1.yaml` | `/openapi/programmable-v2.yaml` |
| `/schemas/v1/` | `/schemas/v2/` |

The pagination model, response shape and read-only security boundary remain the same. Cursors are version-specific. Start a fresh v2 backfill; do not send a v1 cursor to a v2 endpoint.

## Required migration

1. Read `/.well-known/programmable.json` and use its v2 URLs.
2. Start a new v2 backfill and persist the v2 `resumeCursor`.
3. Deduplicate by `launchId` and use the launch-ID detail route for project-only or multi-asset records.
4. Preserve `token: null`, authenticated assets, and zero, one, or several markets without fabricating a token or pool.
5. Map only `classic` and `custom` to the two exact display labels above.
6. Remove v1 Stock-Paired records from any Programmable Custom filter.
7. Resolve Classic launchers, the Custom Registry and the canonical Router from the v2 manifest.
8. Keep the Custom filter visible when no matching records are returned; inspect response quality and do not treat a degraded or unavailable absence as deletion.
9. Enable a Custom record only when its declared Registry or Router provenance path has complete accepted evidence.

## Availability

Classic discovery and Custom Registry generation 1 are live. V2 returns only finalized approved Custom Registry records. Legacy Registry and GitHub submission intake are closed and represented separately by `publicSubmissionsEnabled: false`. Custom Launch API V1 and V2 historical reads remain compatible, but authenticated POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY` or `409 CUSTOM_LAUNCH_V2_READ_ONLY`. Only V3 profile `3.3.0` accepts fresh submissions.

API v1 remains supported and has no retirement date. New integrations should use v2.
