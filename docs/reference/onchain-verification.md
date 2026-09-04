# Direct onchain verification

Use this path when your indexer must reproduce Programmable provenance without trusting the hosted launch feed alone. The hosted API remains the easiest normalized source; direct verification is the independent evidence path.

## Current boundary

Ethereum (`chainId: 1`) has an active hosted read model and direct-chain discovery. Active Classic discovery consists only of historical V3 and current V4; Classic V1/V2 remain inactive manifest history. Custom Registry generation 1 is published separately in the v2 manifest. Deployment addresses and start blocks must be read from that manifest; public submissions remain disabled. Stock is not an active v2 discovery source. The v2 Custom feed contains only finalized approved Registry records, beginning with the project-only genesis canary.

Robinhood Chain (`chainId: 4663`) publishes live direct-chain provenance.
Require the chain manifest's live `directChainIntegration` and canonical
`launchStampRouter`, validate their runtime and evidence bindings, then follow
its finality policy. Its existing finalized launch vector is resolved through
`directChainIntegration.evidenceUrl`. The
[terminal guide](https://developers.programmable.family/robinhood-terminal-indexer)
defines the discovery and independent indexing path for every future
`CustomGraph` stamp, including individual custom hooks.

Robinhood's hosted read model and self-serve V4 API/CLI remain planned, with no
public write path promoted here. Its empty `unavailable` hosted feed remains
non-authoritative. A prepared binding or the
[V4 OpenAPI](https://programmable.market/openapi/custom-launch-v4.json) alone is
not onchain deployment evidence; use the actual released manifest roots.

Generation 1 is the manifest-published Custom Registry trust root and its finalized project-only genesis canary is the immutable discovery baseline. Legacy Registry and GitHub submission intake are closed. Custom Launch API V1 and V2 retain historical reads, but authenticated POST returns nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY` or `409 CUSTOM_LAUNCH_V2_READ_ONLY`; only V3 profile `3.3.0` accepts fresh submissions. An unreleased Generation 2 release candidate exists for Registry conformance testing, but it has no manifest-published Registry address, start block, or live topic set. Do not scan candidate ABIs, candidate events, or the draft interface in `proposals/custom-registry/` as though Generation 2 were deployed. Activate Generation 2 indexing only after the manifest publishes its evidenced deployment; until then, direct verification remains bound to the published Generation 1 entry.

Custom Registry Generation 2 is not Custom Fee-Enforced Launch Profile V2. The
fee-enforced profile is a separate retained historical path. Evidence
for either surface cannot activate the other.

The launch stamp Router is live on Ethereum. The manifest pins its exact address, start block, runtime hash, immutable production bindings, finality policy, finalized deployment evidence, and separate approved finalized `CustomGraph` and Classic V4 canaries. Route coverage is therefore `customGraphOnchainCanary: true` and `classicOnchainCanary: true`. Historical launches are not backfilled, and Router remains provenance and transport rather than a third public category.

## 2026-08-25 exact-source closeout

The sanitized [exact-source closeout release](https://github.com/programmablehq/Developers/releases/tag/exact-source-closeout-2026-08-25)
binds the five recovered Standard JSON inputs, constructor bytes, local runtime
reproduction, and provider receipts. Its classifications are deliberately
narrow:

- Router `0x8622DD5bAb44185f2A458ac90384Ac99248f8d56` and Graph deployer
  `0xB012e4A8F2c5FC4E8E4faCA9D5Ad6FfF13FBA887` reproduce exactly locally and
  have Etherscan `Exact Match`;
- FADE token `0x69d278968abf120f878f2e1e016ab615d3686c19` and FADE hook
  `0xd7451a039373f54e493deE42A751fEcBfAFBa0cc` reproduce exactly locally, but
  have no public-provider Exact Match in the snapshot;
- Position fee forwarder `0x4AB7b91fa65E7e406C0E6ca32E4eF63c0777BCe9` reproduces exactly locally,
  but has no provider Exact Match and shows Etherscan `Similar Match`;
- Sourcify reports `match`, not `exact_match`, for all five because these
  legacy deployments omit CBOR metadata; Blockscout remains partial; and the
  Etherscan API retries for the three non-exact targets were blocked by a
  missing provider API key.

Local exact reproduction, Sourcify `match`, Blockscout partial, Etherscan
Similar Match, and Etherscan Exact Match are separate states. None revises
launch finality or implies an audit.

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

## Independent evidence axes

Keep these conclusions separate and chain-qualified:

| Axis | Required evidence |
| --- | --- |
| Finality | Canonical chain block evidence plus the published finality policy; Robinhood V4 also binds its L2 checkpoint to Ethereum finality |
| Exact source verification | The versioned component result; Robinhood V4 reserves `exact_match` for the protected-source, hosted-build, compiler/settings, finalized-transaction and bytecode binding, with provider observations reported separately |
| Indexing | A complete current read-model traversal for the exact chain and deployment binding |
| Public visibility | A finalized record actually emitted by the public Developer feed |

Repository source, compilation, simulation, deployment, finality, provider
verification, indexing, and public visibility are related but distinct. No one
axis proves another, and none alone proves safety, liquidity, trading, or fee
behavior.

## Classic source verification

The hosted baseline is the canonical paginated `https://programmable.market/api/explore` catalog, accepted only when its schema, scope, evidence and identity commitments are internally consistent. Its currently observed Envio deployment is `production-6157d22`; a valid future deployment revision does not require client code changes. The retired legacy source that returned HTTP `410` is not a verification dependency. A direct onchain verifier independently scans only the enabled V3/V4 manifest entries.

For each enabled Classic V3 or V4 deployment:

1. Begin at its published `startBlock`; respect an `endBlock` or retired generation if present.
2. Select the matching versioned [event ABI](../../abis/README.md), derive the canonical event topic from its signature, and query logs using both the manifest-listed launcher address and that topic.
3. Decode the receipt with the matching versioned ABI.
4. Bind the record to `chainId`, transaction hash, block number, block hash, transaction index when available, and log index.
5. Fetch runtime bytecode from the launcher, compute `keccak256(runtime bytecode)`, encode it as `0x` bytes32, and compare it with `runtimeCodeKeccak256`. If `runtimeCodeSha256` is also present, validate it separately in `sha256:` form.
6. Derive the launch and asset identities according to the published schema; never use name, symbol, image, or creator text as identity.
7. Reconcile the normalized result with the API record and retain any evidence conflict for operator review.

Multiple enabled deployments can overlap. Deduplicate the normalized launch by chain ID plus `launchId`, not by whichever deployment your scanner encountered first. Retain chain ID plus Router address plus `launchId` for exact Router provenance. Refreshing the manifest is sufficient for a generic scanner to discover V4; no new hard-coded address or category is required.

## Launch stamp Router verification

Router V1 is a separate provenance path for Router-stamped Classic and Custom launches. It has no Registry lifecycle and does not change the evidence rules for historical records.

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

Router finality is not fee-policy finality. The existing PCAN canary's
`platformFee` values are a point-in-time configuration observation and do not
prove the Custom Fee-Enforced Launch Profile V2, its hook/vault path, or future
swap enforcement.

## Custom Fee-Enforced Launch Profile V2 verification

The V2 profile is retained for historical verification while its exact manifest
descriptor reports `productionLaunchAuthorized: false` and
`api.publiclyRoutable: false`. A verifier must use one finalized
canonical block and require all of the following to agree:

- the exact Router launch identity, profile hash, launch-intent hash and bound
  pool identity;
- the exact fee hook, vault, custom module and initializer runtime code hashes;
- a graph-bound composition hash covering those runtime identities, rather than
  self-reported profile getters alone;
- `1,000` ppm over denominator `1,000,000` and recipient
  `0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`;
- pinned permission mask `0x2044`;
- gross-unspecified-pool-currency basis and unspecified-pool-currency-per-swap
  asset mode;
- exact-input accounting in the output currency and exact-output accounting in
  the input currency;
- canonical PoolManager address
  `0x000000000004444c5dc75cB358380D2e3dE08A90`, runtime hash
  `0x785f1014552b7ce7d5fb7d0c970ca60edee94fd00425d7ca21609acac7ce1293`,
  and reciprocal hook/vault/pool bindings;
- the initial `sqrtPriceX96`, authorized initializer, actual hook and vault
  runtime code hashes, and complete composition hash;
- one exact pool ID enforced by the hook and an initialization authorization
  that rejects deterministic-address front-running;
- a sealed binding state with no remaining configuration authority;
- PoolManager ERC-6909 fee claims held in the sealed vault and claimable only
  by reward wallet `0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`;
- the release evidence for the exact permit-authorized Router transaction
  simulated at its recorded pinned block; and
- the two-provider Ethereum `finalized` checkpoint required before this launch
  may enter its terminal finalized state.

The readback proves only the exact bound pool and profile at that canonical
block. It does not prove arbitrary-pool coverage, future liveness, liquidity,
generic tradability, claim support, buybacks, a security audit, or a separate
custom module's business semantics. Post-finality source verification runs
asynchronously and may be labeled exact only after a real provider exact match;
its pending or unavailable state cannot block or reverse launch finality.
Source verification, launch finality and fee enforcement remain independently
reported states.

For Robinhood V4, `exact_match` requires `exactSourceAuthority` to be
`protected-hosted-build-finalized-transaction-bytecode` and an independent
`exactSourceBinding`. That binding covers the protected
source tree and source closure, hosted build artifact, standard JSON input,
compiler binary and settings, finalized creation transaction, and creation and
runtime bytecode. Sourcify V2 is retained separately in `providerObservation`
with classification `PARTIAL_NO_CBOR_EXACT_BYTES`, `match`, `creationMatch` and
`runtimeMatch` all set to `match`, `releaseAuthority: false`, and its own
`evidenceDigest`. Neither that observation nor a Blockscout observation alone
grants `exact_match`. The API resource follows the
[Custom Launch V4 source-verification status contract](https://programmable.market/schemas/custom-launch/v4/source-verification-status.json),
while the public feed follows the separate
[Developer V4 projection schema](https://developers.programmable.family/schemas/v2/custom-launch-source-verification-v4.schema.json).
The Developer feed retains this status separately from canonical-Router
provenance and finality. These contracts describe a separately gated hosted
read model for chain `4663`; publishing them does not grant exact source
verification to any component. The live direct-chain Router evidence has its
own deployment and finality boundary.

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

Apply this table per chain. A finalized Ethereum record does not promote the
Robinhood lane, and Robinhood's unavailable hosted feed cannot establish absence.

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

Router V1 activation binds one finalized deployment and two approved finalized route canaries. Read every exact value from the manifest rather than copying it into scanner code. The manifest publishes:

- the canonical chain, Router, start block, ABI and runtime hashes, event topics, getter selectors, finality policy, source/artifact binding, and immutable production bindings;
- exactly one generic market-bearing atomic selector, with no route-specific overload: `CustomGraph` uses the immutable Graph Factory binding, while Classic uses its permit- and record-bound route launcher; no Single Factory route exists;
- frozen `LaunchKindV1.CustomGraph | Classic` record and event semantics;
- the finalized PCAN `CustomGraph` vector at `/launchStampRouter/canaryEvidence`; and
- the finalized current Classic V4 vector at `/launchStampRouter/classicCanaryEvidence`.

The two vectors establish exact route coverage as `customGraphOnchainCanary: true` and `classicOnchainCanary: true`. Their source, deployment, lifecycle, component, pool, position, supply, and fee observations remain independently bound in the manifest. They do not replace per-launch stamp verification, backfill historical launches, establish current market state, or create a Router category.

Read [Programmable Verified](../concepts/programmable-verified.md), [Multi-chain discovery](../concepts/multi-chain.md), and [Production operations](../operations.md) before enabling a production scanner.
