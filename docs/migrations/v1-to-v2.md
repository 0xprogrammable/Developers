# Migrate from API v1 to v2

API v2 is the canonical integration for new terminals, scanners, bots and launch providers.

## Why v2 exists

API v1 classified historical first-party Stock-Paired launches as `custom`. Programmable no longer uses that model as its public Custom category.

API v2 gives `custom` one precise meaning: a launch accepted through the canonical Programmable Custom Registry. Stock-Paired records remain available only through v1 compatibility endpoints and are not `Programmable Custom` in v2.

## Classification contract

| API value | Display label | Required evidence |
| --- | --- | --- |
| `classic` | `Programmable Classic` | Event from a Classic launcher listed in the v2 manifest |
| `custom` | `Programmable Custom` | Event from the Custom Registry listed in the v2 manifest |

Provider names, factories, hook addresses, token addresses and template versions may differ for every Custom launch. They are record-level provenance, not additional terminal categories.

## Endpoint changes

| v1 | v2 |
| --- | --- |
| `/api/v1/status` | `/api/v2/status` |
| `/api/v1/manifest` | `/api/v2/manifest` |
| `/api/v1/launches` | `/api/v2/launches` |
| `/api/v1/launches/{chainId}/{tokenAddress}` | `/api/v2/launches/{chainId}/{tokenAddress}` |
| `/api/v1/token-list` | `/api/v2/token-list` |
| `/openapi/programmable-v1.yaml` | `/openapi/programmable-v2.yaml` |
| `/schemas/v1/` | `/schemas/v2/` |

The pagination model, response shape and read-only security boundary remain the same. Cursors are version-specific. Start a fresh v2 backfill; do not send a v1 cursor to a v2 endpoint.

## Required migration

1. Read `/.well-known/programmable.json` and use its v2 URLs.
2. Start a new v2 backfill and persist the v2 `resumeCursor`.
3. Map only `classic` and `custom` to the two exact display labels above.
4. Remove v1 Stock-Paired records from any Programmable Custom filter.
5. Resolve Classic launchers and the Custom Registry from the v2 manifest.
6. Keep the Custom filter visible but empty while `custom.status` is `prelaunch`.
7. Enable a Custom record only when its registry provenance is `verified`.

## Availability

Classic discovery is live. The Custom Registry is prelaunch, so v2 currently returns no Custom records. This is intentional. A future registry address and start block will appear in the manifest before the first Custom record is published.

API v1 remains supported and has no retirement date. New integrations should use v2.
