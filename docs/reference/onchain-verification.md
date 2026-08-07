# Direct onchain verification

Use this path when your indexer must reproduce Programmable provenance without trusting the hosted launch feed alone. The hosted API remains the easiest normalized source; direct verification is the independent evidence path.

## Current boundary

Ethereum is the only active chain in the current discovery document. Classic deployments and Custom Registry generation 1 are published in the v2 manifest. The Registry address and start block must be read from that manifest; public submissions remain disabled. The v2 Custom feed contains only finalized approved Registry records, beginning with the project-only genesis canary.

Generation 1 is the manifest-published Custom trust root and its finalized project-only genesis canary is the immutable discovery baseline. General Custom intake remains prelaunch. An unreleased Generation 2 release candidate exists for conformance testing, but it has no manifest-published Registry address, start block, or live topic set. Do not scan candidate ABIs, candidate events, or the draft interface in `proposals/custom-registry/` as though Generation 2 were deployed. Activate Generation 2 indexing only after the manifest publishes its evidenced deployment; until then, direct verification remains bound to the published Generation 1 entry.

## Trust root

Start from the canonical HTTPS discovery document:

```text
GET https://developers.programmable.family/.well-known/programmable.json
```

For every advertised chain:

1. Follow its manifest URL or the current manifest endpoint.
2. Check the chain ID and CAIP-2 identity.
3. Read every enabled deployment or registry generation; do not assume the first entry is current.
4. Use the exact contract address, start block, lifecycle, event ABI or signature, and `runtimeCodeKeccak256` evidence published for that generation.
5. Reject an unexplained manifest rollback or two different payloads carrying the same manifest version.

An event name or topic is not sufficient. The log must come from the exact manifest-listed contract on the exact chain.

## Classic source verification

For each enabled Classic deployment:

1. Begin at its published `startBlock`; respect an `endBlock` or retired generation if present.
2. Select the matching versioned [event ABI](../../abis/README.md), derive the canonical event topic from its signature, and query logs using both the manifest-listed launcher address and that topic.
3. Decode the receipt with the matching versioned ABI.
4. Bind the record to `chainId`, transaction hash, block number, block hash, transaction index when available, and log index.
5. Fetch runtime bytecode from the launcher, compute `keccak256(runtime bytecode)`, encode it as `0x` bytes32, and compare it with `runtimeCodeKeccak256`. If `runtimeCodeSha256` is also present, validate it separately in `sha256:` form.
6. Derive the launch and asset identities according to the published schema; never use name, symbol, image, or creator text as identity.
7. Reconcile the normalized result with the API record and retain any evidence conflict for operator review.

Multiple enabled deployments can overlap. Deduplicate the normalized launch by `launchId`, not by whichever deployment your scanner encountered first.

## Custom Registry verification

After activation, a Custom launch is Programmable only when all of these checks pass:

- the chain is advertised by the official discovery document;
- the registry generation is live in the manifest;
- the log address equals that generation's registry address;
- the block is at or after its start block and inside its lifecycle range;
- the event topic and decoded fields match the published ABI;
- the launch ID is unique and has not been replayed;
- the approval, repository revision, build, artifacts, deployment configuration, launch wallet, and deployed runtime are bound by the registry evidence;
- the EVM `keccak256(runtime bytecode)` identities and configured authorities match the reviewed release;
- the record has not been corrected, superseded, or revoked; and
- the block has the finality state your product requires.

A pull request, approval result, provider API response, webhook, token tag, copied event, matching logo, or creator field cannot create the `Programmable Custom` label.

### Generation 2 contract set

Generation 2 is a four-contract trust root, not one address inferred from an event name:

| Manifest role | Required verification |
| --- | --- |
| `registry` | Exact chain, generation `2`, address, start block, runtime-code Keccak-256, Registry ABI, writers, and Registry event emitters |
| `partnerFactoryRegistry` | Exact address and runtime; authorized provider factory configuration and source events |
| `feePolicyVerifier` | Exact address and runtime; native and provider-template structural fee policy |
| `atomicRegistrar` | Exact address and runtime; atomic launch/registration evidence |

All four identities must be present and mutually consistent before the generation is live. For every launch record, verify the Registry event against the `registry` identity and reconcile any provider factory authorization against the exact `partnerFactoryRegistry` identity. A same-named contract, copied event, or correct runtime on the wrong chain or Registry generation does not qualify.

The Generation 2 integration event set contains 15 events across the Registry, PartnerFactory Registry, and atomic registrar. The manifest binds every event to its emitter role. The fee-policy verifier has no discovery event and is authenticated through its contract identity and the Registry binding. Derive topics from the published ABI and compare the complete canonical event-set hash; do not accept a partial topic list.

## Commitment domains

Keep the immutable Registry commitment separate from the mutable read-model projection:

| Evidence | Public contract |
| --- | --- |
| Producer record | `schemaVersion: "programmable.custom-launch-registry-record.v3"` |
| Registered record | `registeredRecordCommitment` is the exact onchain Keccak-256/ABI commitment encoded as `0x` bytes32; `registryOrigin.registeredRecordHash` must equal it |
| Producer envelope | `envelopeDigest` uses `sha256:` with domain `programmable.custom-launch-registry-envelope-digest.v3`; it covers the current observation envelope and is distinct from the immutable Registry commitment |
| Read-model record | `schemaVersion: "programmable.custom-launch-projection-record.v3"` |
| Projection | `projectionDigest` uses `sha256:` with the exact projection schema ID as its domain |

A new observation, finality state, correction, or revocation can change `envelopeDigest`, the projection, and `projectionDigest` without changing `registeredRecordCommitment` or `registryOrigin.registeredRecordHash`. Never compare a `sha256:` envelope or projection digest as though it were the bytes32 Registry commitment, and never let a projection update rewrite immutable registration evidence.

The public Custom `launchId` uses the `sha256:` form while its Registry event binding carries the corresponding raw bytes32 identity. Require a byte-for-byte mapping between the two representations; do not hash either representation again or accept a caller-supplied string that merely looks similar.

Validate the complete registration receipt against the manifest-published event set for that Registry generation. One registration-looking log without its required binding evidence is not a complete launch proof.

The compatibility producer `programmable.custom-launch-registry-record.v3` remains frozen at its published 34-word contract seam. It must not be silently reinterpreted for Generation 2. Generation 2 uses `programmable.custom-launch-registry-record.v4`, whose exact 37-word commitment preimage adds `configurationHash`, `permissionsHash`, and `marketPathId`, replaces the old partner-specific slot with provider-neutral `providerId`, and retains model and template IDs plus versions. The v4 validator recomputes:

- the Generation 2 fee-policy hash;
- the provider-factory `configurationHash` where a provider is present;
- approval and review-deployment bindings;
- the six registered-record component hashes;
- `registeredRecordCommitment`; and
- the launch identity/registration binding.

An indexer must reject a record if any recomputed value differs. This producer-record version is independent of the public HTTP API major version.

## Atomic and staged launches

For an atomic launch, deployment, initialization, verification-required configuration, and registration must succeed in the same transaction or revert together.

For a staged launch, do not publish launch status merely because one deployment transaction succeeded. The Registry must publish an explicit workflow-finalization registration after every required contract, configuration, and runtime binding has been verified. Record the earlier steps as evidence, not as a public launch. That registered event can then enter the separate chain-finality lifecycle as `observed`.

## Registry generations, corrections, and revocations

Treat each registry deployment as a versioned generation with its own chain, address, start block, ABI, topic set, writers, and lifecycle. Never move an existing generation entry to a different contract.

Apply corrections and revocations as append-only state transitions:

- preserve the original event coordinates;
- record the correcting or revoking transaction and reason code;
- stop granting active verified presentation when the effective state is revoked;
- do not erase historical provenance; and
- replay the same transition idempotently.

When a generation retires, stop accepting later registrations from it but retain its historical range.

## Finality and reorgs

The onchain block timestamp is the launch time. Your observation time is operational telemetry and must not replace it.

Use the public lifecycle distinctly:

| State | Meaning | Consumer behavior |
| --- | --- | --- |
| `observed` | Seen in a currently canonical block | Show as provisional if your product supports early discovery |
| `confirmed` | Reached the configured confirmation policy | Continue to reconcile by block hash |
| `finalized` | Reached the published finalized boundary | Eligible for finalized-only projections |
| `orphaned` | Its original block is no longer canonical | Remove from active views and apply the correction idempotently |

Persist block hashes, not only heights. On disagreement, stop advancing the durable cursor, rewind to a common finalized boundary, and replay.

## Impersonation-resistant checklist

Before displaying a Programmable label, require:

- official discovery origin;
- advertised chain ID and CAIP-2 identity;
- exact deployment or registry generation;
- exact event address and topic;
- valid transaction, block hash, and log position;
- expected public `runtimeCodeKeccak256` identity;
- valid launch ID and non-replay state;
- effective correction and revocation state; and
- an API category consistent with the onchain source.

If one required input is unavailable, keep any independently known asset visible but label Programmable provenance `unknown`, `partial`, or unavailable. Do not guess.

## Activation evidence still required for Custom

Direct Custom indexing remains blocked until all of the following are public and mutually consistent:

- registry chain, address, start block, generation, ABI, and event topics;
- verified contract source and public `runtimeCodeKeccak256` identity, with any `runtimeCodeSha256` evidence labeled distinctly;
- authorized writer policy and replay rules;
- approval-to-deployment binding;
- one real Custom canary transaction and launch ID;
- the matching API record; and
- finality, correction, retirement, and revocation behavior.

Read [Programmable Verified](../concepts/programmable-verified.md), [Multi-chain discovery](../concepts/multi-chain.md), and [Production operations](../operations.md) before enabling a production scanner.
