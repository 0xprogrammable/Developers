# Direct onchain verification

Use this path when your indexer must reproduce Programmable provenance without trusting the hosted launch feed alone. The hosted API remains the easiest normalized source; direct verification is the independent evidence path.

## Current boundary

Ethereum is the only active chain in the current discovery document. Classic deployments and Custom Registry generation 1 are published in the v2 manifest. The Registry address and start block must be read from that manifest; public submissions remain disabled. The v2 Custom feed contains only finalized approved Registry records, beginning with the project-only genesis canary.

Generation 1 is the manifest-published Custom Registry trust root and its finalized project-only genesis canary is the immutable discovery baseline. Registry-based public submission intake remains prelaunch; this does not describe the separate Custom Launch API. An unreleased Generation 2 release candidate exists for conformance testing, but it has no manifest-published Registry address, start block, or live topic set. Do not scan candidate ABIs, candidate events, or the draft interface in `proposals/custom-registry/` as though Generation 2 were deployed. Activate Generation 2 indexing only after the manifest publishes its evidenced deployment; until then, direct verification remains bound to the published Generation 1 entry.

The future-launch Router is live on Ethereum at `0x8622DD5bAb44185f2A458ac90384Ac99248f8d56` from block `25717612`. The manifest pins runtime Keccak-256 `0x40e27ecf201761d5eb66bc4f2d5c6124831ef078d7baf458ca5f41b1a8108546`, immutable production bindings, a `64`-confirmation policy, finalized deployment evidence, and one approved finalized `CustomGraph` canary. No separate Classic onchain canary is published. Historical launches are not backfilled.

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

For Generation 1, authenticate the operation caller against the matching manifest entry rather than one generic writer list. `registered` uses the canonical `WRITER_ROLE` and the atomic registrar `0xcc916e5200d2626edfd918dc219bc4296629e997`; `finalized` uses the distinct `FINALIZER_ROLE` and `0x2bb333d48dfaf1596d9036671d2e43168994249e`. A finalization projection attributed to the registrar, or a registration projection attributed only to the finalizer, must be rejected.

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

## Future launch Router verification

Router V1 is a separate provenance path for future Classic and future Custom launches. It has no Registry lifecycle and does not change the evidence rules for historical records.

Accept Router provenance only when all of these checks pass:

- the chain is advertised by the official discovery document;
- top-level `launchStampRouter` is `live`, or `retired` for a read inside its published block range;
- the Router address, start block, runtime-code hash, ABI hash, event descriptors and getter descriptors are non-null and internally consistent;
- the finalized canary evidence and immutable production bindings are complete and internally consistent;
- `eth_chainId` equals the manifest chain ID;
- the selected finalized or caller-supplied canonical block is resolved once; every `eth_getCode` and `eth_call` is bound to its hash with EIP-1898, or number-bound reads are bracketed by an unchanged opening and closing block hash;
- remote RPC transport uses HTTPS; plaintext HTTP is limited to loopback development;
- Router bytecode at that block matches the manifest runtime-code hash;
- a direct token or `PoolManager + PoolId` lookup at the canonical Router returns a nonzero launch ID; hook or component lookups are corroborating evidence only for an exclusive Custom component;
- the stamp record at the same block agrees with the query and the complete identity `chainId + Router address + launchId`;
- any discovery log has the exact Router emitter and manifest ABI `topic0`; and
- a caller-supplied block number has at least the manifest's `64` confirmations, or the read uses the canonical finalized block; and
- the block satisfies the consumer's reorg policy.

The same consistent Router record proves atomic Router execution and stamping for both future public labels; it does not universally prove that each Classic component was newly created. Read the stamp record at the same block: `LaunchKindV1.Classic` maps to `Programmable Classic`, and `LaunchKindV1.CustomGraph` maps to `Programmable Custom`. If the value is absent, unknown, or inconsistent, preserve the Router evidence but do not guess a class. The Classic hook is shared and must never identify or classify one launch.

A pull request, permit, approval response, factory response, webhook, token tag, copied event, matching logo, creator field, direct Graph Factory call, or Single Factory call cannot create Router provenance. This check requires an Ethereum RPC endpoint but no Programmable server, database, Registry, indexer, or Supabase project. See [Launch stamp router verification](launch-stamp.md).

The Router records point-in-time provenance. A matching recorded component shell-code hash does not prove the current implementation, beacon, admin, initialization state, or upgrade authority. It also does not establish safety, audit status, liquidity, sellability, route support, or third-party integration.

## Separate Custom Registry verification

The existing Custom Registry and its candidate future generations are a different evidence surface. They are not Router V1 detection dependencies.

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

These Registry checks need an Ethereum RPC endpoint but no hosted Programmable indexer. Repository, build, review, authority, and deployment commitments remain separate evidence for products that want deeper Registry verification.

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

These commitment domains support deeper Registry and read-model verification. A terminal performing only the Router provenance check does not need to reconstruct them.

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

## Router impersonation-resistant checklist

Before displaying a Router-derived Programmable label, require:

- official discovery origin;
- advertised chain ID and CAIP-2 identity;
- exact canonical Router address and published start block;
- Router runtime and ABI hashes matching the manifest;
- either a nonzero direct getter response with a consistent stamp record, or a valid event from that exact Router plus a direct point-lookup cross-check;
- one canonical block used for all reads, with hash-bound EIP-1898 requests or an unchanged closing header check;
- a nonzero launch ID scoped with chain ID and Router address; and
- the recognized record value (`CustomGraph = 1` or `Classic = 2`) before assigning a class.

If one required input is unavailable, malformed, or inconsistent, keep independently known asset data but mark Router provenance `indeterminate` or `unavailable`. Do not convert operational uncertainty into `not-stamped`, and do not guess a class.

## Published Router V1 activation evidence

Router V1 activation binds one finalized deployment and one approved finalized Router canary. The manifest publishes:

- chain `1`, canonical Router `0x8622DD5bAb44185f2A458ac90384Ac99248f8d56`, start block `25717612`, ABI, ABI hash, event topics, getter selectors, runtime Keccak-256 `0x40e27ecf201761d5eb66bc4f2d5c6124831ef078d7baf458ca5f41b1a8108546`, and `64` finality confirmations;
- the Router source/artifact binding at commit `0a7134bbb912222639627fb9078df2f8dd3a6c38`, the exact deployed runtime, and immutable EIP-1271 permit-authority, Graph Factory, and PoolManager bindings;
- exactly one generic market-bearing atomic selector, with no route-specific overload: `CustomGraph` uses the immutable Graph Factory binding, while the Classic V3 route and runtime are permit- and record-bound; no Single Factory route exists;
- frozen `LaunchKindV1.CustomGraph | Classic` record and event semantics; and
- finalized `CustomGraph` canary transaction `0xc07b4e70233534a1d4f435ffc9a636ed5f542f4aedcde35052c58224f378b612`, launch ID `0x5a52180427785716bff0a36218dde89f0459db265d0c2bdfcfde81a8fe733c92`, and successful token, `PoolManager + PoolId`, exclusive-component, `stampProof`, stamp-record, and point-in-time code-hash cross-checks.

The canary source commit `b3cfed41bb841ae8d6188dbb815eddb5e1440218` is separate from the deployed Router source commit and does not replace it. Route coverage is `CustomGraph` onchain canary `true` and Classic onchain canary `false`. The frozen source and tests cover Classic behavior through the same live ABI, but a future Classic launch has onchain provenance only when the live Router writes a consistent `LaunchKindV1.Classic` stamp. Canary liquidity, LP position, fee, and supply values are block-specific observations, not current market or safety claims.

Read [Programmable Verified](../concepts/programmable-verified.md), [Multi-chain discovery](../concepts/multi-chain.md), and [Production operations](../operations.md) before enabling a production scanner.
