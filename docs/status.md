# Integration status

Check each chain's status and manifest before indexing. The manifest defines
published deployment identities; the status response describes feed availability
and coverage at the time of the request.

```sh
curl -fsSL 'https://developers.programmable.family/api/v2/status?chainId=1'
curl -fsSL https://developers.programmable.family/api/v2/manifests/1
curl -fsSL 'https://developers.programmable.family/api/v2/status?chainId=4663'
curl -fsSL https://developers.programmable.family/api/v2/manifests/4663
```

## Current availability

| Surface | Ethereum · `1` | Robinhood · `4663` |
| --- | --- | --- |
| Direct Router verification | Live: Classic and Custom stamps | Live: Custom stamps |
| Developer hosted read model | Published; inspect response quality | Planned; unavailable |
| Public Custom launch API | V3 profile `3.3.0` | V4 API / CLI planned |

For Robinhood (`chainId: 4663`), the direct-chain integration is live while
public writes remain unavailable. Require `directChainIntegration.status: "live"`
and a complete live `launchStampRouter` entry. Follow the manifest's `evidenceUrl`
and finality policy before accepting a launch.

The hosted Robinhood feed can return HTTP `200` with `status: "unavailable"`.
That empty result means "unknown", not "no launches exist". Independent Router
verification does not depend on that hosted feed. Optional finalized metadata
is described in the [indexer guide](guides/indexers.md).

## Launch API versions

These are separate from the read-only Developer v2 API.

| Chain and contract | State |
| --- | --- |
| Ethereum (`chainId: 1`), Custom Launch API V1 and V2 | Historical reads; authenticated POST is read-only |
| Ethereum, V3 profile `3.3.0` | Accepts fresh submissions with server admission and separate wallet signing |
| Ethereum, Direct Native Hook Graph V2 | Historical reads and exact-byte retries; no fresh requests |
| Ethereum, Direct Native Hook Graph V1 | Retained gated preview; not publicly routable through V1 |
| Robinhood (`4663`), Custom Launch API V4 | Planned; public writes and CLI activation unavailable |

V1 and V2 POST requests return nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY`
and `409 CUSTOM_LAUNCH_V2_READ_ONLY`, respectively. Resolve the active write
pointer from discovery `currentCreate` or status `currentCustomLaunchCreate`.
The status field `customLaunchApi` is the retained V1 compatibility object.

Use the [V3 profile guide](guides/direct-native-hook-graph-profile-v3.md) for
current requests and the [V2](guides/direct-native-hook-graph-profile-v2.md) or
[V1 preview](guides/direct-native-hook-graph-profile-v1.md) reference for retained
resources. An API credential cannot sign or broadcast a wallet transaction.

The [Robinhood V4 OpenAPI](https://programmable.market/openapi/custom-launch-v4.json),
[source-verification status contract](https://programmable.market/schemas/custom-launch/v4/source-verification-status.json)
and [Developer projection schema](https://developers.programmable.family/schemas/v2/custom-launch-source-verification-v4.schema.json)
are published contracts. Their presence does not activate public writes or
establish an exact source match for a deployment.

## Discovery coverage

Ethereum Classic discovery includes historical V3 and current V4 releases.
Classic V1/V2 remain inactive history; Stock-Paired records are excluded from
active v2 discovery. Read the enabled deployments from the manifest instead
of maintaining an address list.

Custom Registry Generation 1 provides finalized discovery. Legacy Registry
and GitHub submission intake are closed. Generation 2 remains inactive;
a candidate interface or fixture does not establish deployment.

Router V1 publishes separate Ethereum finalized examples for CustomGraph and
Classic V4, and a Custom example for Robinhood. Each launch requires its own
consistent stamp. Historical launches are not backfilled by Router V1.
See the [Router reference](reference/launch-stamp.md) for exact evidence.

The public categories remain `classic` and `custom`. The Custom label requires
manifest-listed Registry evidence or a canonical Router `CustomGraph` stamp.
Hook addresses and creator metadata cannot assign it.

## Feed quality

| State | Consumer behavior |
| --- | --- |
| `ready` | Process the published records and inspect their per-source boundaries. |
| `degraded` | Preserve recognized records and missing fields; retry incomplete coverage. |
| `unavailable` | No current complete coverage boundary is available; absence is not authoritative. |

Inspect `customRegistryPublication` and `routerCustom` independently. Registry
canary coverage is separate from applicant coverage; a last-known-good Router
snapshot is separate from a current complete one. The [HTTP reference](reference/http-api.md)
defines these fields and the requirements for authoritative absence.

## Evidence and feature support

| Evidence | What it establishes |
| --- | --- |
| Finality | A chain-qualified finalized checkpoint and canonical block evidence |
| Exact source verification | An accepted source, build, transaction and bytecode binding for the exact component |
| Indexing | Complete, current traversal and quality evidence for the selected chain |
| Public visibility | Publication of the finalized record through the public feed |

These states are independent. A launch stamp establishes provenance, not
current liquidity, fees, sellability, an audit or support in a third-party terminal.

Keep a recognized launch visible when metadata or market features are unavailable.
Charts, quotes, simulation and execution require their own verified adapters.
See [terminal integration](guides/terminals-and-scanners.md) and the
[data model](concepts/data-model.md) for display rules.

Named partner support also requires published evidence. Planning notes or a
partner name do not establish an approved template, recipient or fee path;
see [platform fees](reference/fees.md).
