# Versioning and compatibility

This document defines the public compatibility contract for the Programmable Developer Platform.

## Release versions

Repository releases use Semantic Versioning and immutable Git tags in the form `vMAJOR.MINOR.PATCH`.

- **PATCH** releases correct documentation, examples, fixtures, or implementation defects without changing published behavior.
- **MINOR** releases add backward-compatible fields, endpoints, capabilities, examples, or tooling.
- **MAJOR** releases may introduce breaking changes and require an explicit migration.

The initial public release is `v1.0.0`. API v2 introduces the corrected Programmable Custom classification while API v1 remains available for compatibility.

API paths, schemas, and other machine-readable surfaces also expose their documented version. A repository release may update several surfaces without changing their major version when every change remains backward compatible.

A Custom Registry record generation is not an API major version. A future record-generation identifier can evolve inside the v2 integration only when the v2 envelope remains backward compatible and older public records keep their meaning. Do not call a Registry record generation “API v3.”

## Version 1 compatibility contract

Within version 1, Programmable may add:

- optional object fields;
- new endpoints and query parameters that are optional;
- new capability, market, or status values;
- new deployments, chains, contracts, and start blocks;
- new fixtures and conformance cases;
- clarifications that do not change existing behavior.

Within version 1, Programmable will not:

- remove or rename a published field or endpoint;
- change a field's type, unit, meaning, format, or nullability;
- make an optional field or parameter required;
- change the meaning of an existing identifier, timestamp, or status;
- change the documented distinction between a missing field, `null`, zero, and an empty collection;
- change pagination, ordering, finality, or reorg behavior incompatibly;
- move an existing deployment record to represent a different contract.

Consumers should ignore object fields they do not use and handle unknown optional enum, capability, market, and status values safely. Consumers should resolve current deployments through the published deployment data instead of hardcoding one contract address from an example.

New data does not by itself require a new API version. Additional launches, markets, capabilities, deployments, and supported chains are normal data updates when they follow the existing contract.

## What requires version 2

A change requires version 2 when a correct version 1 consumer could misread the result or stop functioning. Examples include:

- removing or renaming a field;
- changing an amount from one unit to another;
- changing an identifier's construction or scope;
- changing the response envelope or pagination model;
- making authentication mandatory on an existing public route;
- changing finality or reorg guarantees;
- assigning a new meaning to an existing value;
- making a previously optional input mandatory.

Version 2 will use a separate documented surface, such as a `/v2` API path and version 2 schema identifiers. It will not silently replace version 1 behavior.

Before any version 1 retirement, Programmable will publish:

- a version 2 specification;
- a migration guide;
- a changelog entry describing each breaking change;
- a public deprecation notice and retirement date;
- an overlap period in which integrators can validate the migration.

Version 1 has no retirement date unless an official release note states one.

## Version 2 classification contract

Version 2 is the default API for new integrations.

- `classic` means a launch authenticated through an enabled Classic launcher in the v2 manifest.
- `custom` means a Programmable Custom launch authenticated either by an accepted event from the Custom Registry in the v2 manifest or by a consistent finalized `CustomGraph` stamp from the exact canonical Router in that manifest.
- Historical Stock-Paired records are not part of the v2 Programmable Custom classification.
- Provider, factory, template, token, hook and market contracts may vary without changing the public Custom category.
- Partner and template attribution remain secondary provenance and never create another public category.
- `category` is the stable product taxonomy, not a substitute for provenance. Consumers must inspect `extensions["programmable/classification"].basis` and the corresponding Registry or Router evidence rather than infer Registry acceptance from `category: "custom"`.

Within version 2, those meanings are immutable. Registry and canonical-Router evidence are additive source-provenance paths under the unchanged `custom` category; neither reinterprets an existing record or authorizes a third category. A future change to either classification requires another major API version.

## Immutable releases

A published release tag is permanent. Maintainers must not force-move, delete, or reuse a public version tag. A correction after release receives a new patch version.

Integrators that require reproducible documentation or schemas should pin an immutable release tag or commit. The `main` branch represents current development and may advance between releases.

Release notes should identify the exact tag and commit. When release artifacts are attached, checksums should be published with them. Preview releases may use Semantic Versioning prerelease identifiers such as `v2.0.0-rc.1`; they are not stable production contracts.

## Deprecation

Deprecated behavior remains documented while it is supported. Deprecation notices must name the replacement, explain the migration, and state the earliest possible retirement date. A deprecation notice is not permission to break version 1 before that date.
