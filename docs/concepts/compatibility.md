# v1 compatibility

The v1 contract is designed so terminals and applications can integrate Classic and Custom once. New deployments and unfamiliar market designs should not require a mandatory client rewrite.

This is a compatibility promise, not a claim that software will never change.

## What remains stable within v1

- Existing core fields are not removed.
- Existing field names and types are not changed.
- Existing meanings are not reinterpreted.
- `category` remains `classic | custom`.
- A launch remains valid with `markets: []`.
- Breaking changes use a new major API path rather than silently changing `/api/v1`.

## What can be added

- optional fields;
- new capability identifiers and versions;
- new market kinds;
- new namespaced extensions;
- new active deployments in the manifest;
- new networks declared by a future manifest;
- new verified adapters and feature support.

These additions must not make an existing valid v1 record invalid for a conforming consumer.

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

## Deployment changes

The stable discovery document points to the active v1 manifest. The manifest publishes deployment arrays, activation state, and start blocks. When Programmable activates another compatible deployment, integrators that read these arrays automatically discover it.

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

Open Custom intake and the open Custom Registry are prelaunch. Their later activation is represented by manifest state and new launch records. It does not require a new public category or a different launch schema.

Existing first-party stock-paired records already normalize as `custom`. This lets clients test Custom presentation without representing future open Custom fixtures as live assets.

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
- chain ID and token address;
- launch transaction, block, timestamp, and finality;
- manifest version used during verification;
- markets and support state;
- fee verification state;
- unknown capability and extension identifiers.

This makes migrations and re-verification possible without guessing what an older client discarded.
