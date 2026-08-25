# v2 compatibility

The v2 contract is designed so terminals and applications can integrate Classic and Custom once. New deployments and unfamiliar market designs should not require a mandatory client rewrite.

This is a compatibility promise, not a claim that software will never change.

## What remains stable within v2

- Existing core fields are not removed.
- Existing token-bearing record shapes and field meanings are not changed. v1.1 widens the required `token` key to allow null only for newly representable project-only launches and adds optional `assets`.
- Existing meanings are not reinterpreted.
- `category` remains `classic | custom`.
- A launch remains valid with `markets: []`.
- `classic` always means an enabled Classic launcher event.
- `custom` always means an accepted Custom Registry event.
- Breaking changes use a new major API path rather than silently changing `/api/v2`.

## What can be added

- optional fields;
- new capability identifiers and versions;
- new market kinds;
- new namespaced extensions;
- new active deployments in the manifest;
- new networks declared by a future manifest;
- new Custom Registry generations and retired historical ranges;
- new verified adapters and feature support.

These additions must not make an existing valid v2 record invalid for a conforming consumer.

## Consumer requirements

A conforming client must:

1. Read the deployment manifest instead of hard-coding deployment arrays.
2. Ignore unknown optional fields.
3. Accept unknown capability IDs and market kinds.
4. Keep an unknown launch visible through its known identity and provenance.
5. Hide unsupported market functions rather than guessing.
6. Accept zero, one, or several markets.
7. Treat missing, null, unavailable, and zero according to the schema rather than as interchangeable values.
8. Use `page.nextCursor` only for the current traversal and `page.resumeCursor` as the durable high-water cursor for the next `after` poll.
9. Handle repeated pages and events idempotently.
10. Respect finality changes and explicit reorg or orphan states.
11. Validate records against the schema version they declare.
12. Partition cursors and checkpoints by API major version, chain, and filter scope.
13. Accept `token: null` and use `projectId`, `launchId`, plus authenticated `assets` for project-only records.

## Deployment changes

The stable discovery document points to the active v2 manifest. The manifest publishes deployment arrays, registry state and start blocks. When Programmable activates another compatible deployment, integrators that read these values automatically discover it.

Do not:

- embed one launcher or registry address as the whole product identity;
- assume the first deployment remains the only deployment;
- infer Custom availability from a draft address;
- accept a manifest with a lower version than one your system has already trusted without operator review.

## Unknown-type fallback

When a client encounters an unknown market or capability:

```text
show launch identity and provenance
show category = custom
show market lifecycle if understood
mark unknown behavior unsupported
hide chart, quote, simulation, and execution without verified support
continue ingesting later records
```

An unknown value is not itself an error or security finding. It is an instruction to fall back to the stable core envelope.

## Custom activation

Custom Registry discovery is live while legacy Registry and GitHub submission intake are closed. Any future Registry contract change remains independent from public category and launch-schema compatibility. The separately hosted Custom Launch API V1 keeps provenance reads and status live, but POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY`. Custom Fee-Enforced Launch Profile V2 is a different private-canary release candidate that remains publicly unavailable and whose held writes return `503` with `Retry-After`.

Historical Stock-Paired records are not part of v2. Custom test fixtures use explicit registry provenance and remain separate from live data until a registry deployment is published.

A Registry record generation is not an API major version. It can be projected through v2 only when the public v2 envelope remains backward compatible and historical record meanings do not change. A prelaunch Registry generation identifier is not evidence that its contract or feed is live.

## Breaking changes

A change is breaking when an existing conforming consumer cannot safely process a response it could process before. Examples include removing a field, changing its type, changing identity rules, or making a previously optional relationship mandatory.

Breaking changes require:

- a new major API path;
- new schemas and fixtures;
- migration documentation;
- a published support window for the previous major version;
- a changelog entry and conformance update.

## Recommended client storage

Store the original response or enough normalized data to preserve:

- schema version;
- launch ID;
- project ID when present;
- chain ID and token address when present;
- authenticated assets and their open roles;
- CAIP-2 identity when present;
- launch transaction, block, timestamp, and finality;
- manifest version used during verification;
- markets and support state;
- fee verification state;
- unknown capability and extension identifiers.

This makes migrations and re-verification possible without guessing what an older client discarded.

## Version 1 compatibility

API v1 remains available for existing consumers and retains its original Stock-Paired classification. New integrations should use v2. Do not merge v1 Stock-Paired results into the v2 Programmable Custom filter. See [Migrate from API v1 to v2](../migrations/v1-to-v2.md).
