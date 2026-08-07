# Launch providers

This document defines how an external launch system can make its accepted launches discoverable as `Programmable Custom` without creating a provider-specific terminal integration.

## Status

This is a **prelaunch integration specification**. The open Programmable Custom Registry is not deployed. No registry address, ABI, or write endpoint in this document is live until it appears in `GET /api/v2/manifest` with deployment evidence.

## Public classification

Every accepted partner launch uses:

```text
API category: custom
Terminal label: Programmable Custom
```

The provider name, template and version are provenance details. They do not create additional public categories. Terminals can optionally show provider attribution beneath the stable Programmable label.

The label is not embedded in the token contract and a provider cannot self-assign it. Programmable publishes the label only after the canonical registry has authenticated the launch path and emitted the registration event.

## Provenance requirement

A user opening the Programmable frontend, a successful provider API response, a webhook, or a later metadata submission does not prove that a token was launched through Programmable.

Canonical provenance requires one of two atomic paths:

### Programmable adapter

1. An approved Programmable adapter calls the provider factory.
2. The adapter obtains the created project assets, contracts, hooks, controllers, and markets from the call result or emitted logs.
3. The adapter validates the provider factory, template, public `runtimeCodeKeccak256` identities, configuration, and returned addresses.
4. The adapter registers the launch before the same transaction completes.

### Provider factory callback

1. An allowlisted provider factory creates the launch.
2. That factory calls the Programmable registry from inside the same transaction.
3. The registry resolves the caller to one approved provider and factory policy.
4. The registry validates the submitted template and records the launch.

Do not use an unauthenticated public registration method. Do not accept an arbitrary transaction hash as proof: a registry cannot establish the contents of a historical receipt merely because a caller supplied its hash.

## Provider handoff package

Provide the following before an adapter or factory is approved.

| Area | Required information |
| --- | --- |
| Identity | Provider ID, legal or operational contact, supported chain IDs |
| Deployments | Factory, template registry, implementation and admin addresses |
| Source | Verified source URLs, ABI, deployment transaction, start block |
| Runtime | Public `runtimeCodeKeccak256` (`0x` bytes32) for every approved factory and implementation; separate `runtimeCodeSha256` (`sha256:`) evidence when supplied |
| Template | Stable ID, version, configuration hash and upgrade policy |
| Launch output | Receipt mapping for project, zero or more tokens and contracts, hooks, controllers, pools or markets, creator and external launch ID |
| Hook policy | PoolManager, hook flags, router assumptions, callbacks, return deltas and external calls |
| Economics | All fee rates, recipients, caps, charge modes and withdrawal authority |
| Market support | Discovery, charting, quote, simulation and execution support separately |
| Evidence | Unit, fuzz, invariant and fork tests; audit scope; mainnet example; negative cases |
| Operations | Incident contact, pause or suspension process and version migration plan |

API credentials remain private between backend systems. Never put a provider API key, secret or bearer token in a browser bundle, registry event, public fixture or support issue.

## What changes and what stays stable

Provider contracts may differ on every integration. Token and hook addresses normally differ on every launch. The terminal contract does not depend on any of those addresses remaining constant.

| Scope | Stable | May change |
| --- | --- | --- |
| Terminal classification | `custom` and `Programmable Custom` | Never |
| Provider identity | Approved provider ID | New provider requires onboarding |
| Template | Approved template ID and immutable version | New version requires review |
| Runtime | Approved factory and implementation `runtimeCodeKeccak256` identities | Any code change requires review |
| Launch | Registry event shape and uniqueness rules | Token, hook, market, creator and configuration |

After activation, terminals poll one feed. They do not add a new contract list for every provider or launch.

## Per-launch requirements

Every accepted launch must produce one authenticated Registry finalization event through an approved atomic or staged path. For an atomic launch, that event occurs in the same transaction as deployment and initialization. For a staged launch, it occurs only after every required deployment and configuration value has been verified. The Registry record must bind:

- the approved provider, factory, template and template version;
- the project ID and authenticated asset graph, including zero, one, or several tokens and contracts;
- deployed hooks, controllers, or external dependencies when they exist;
- canonical pool, contract-market, or asset-referenced market identities when markets exist;
- the creator or beneficiary established by the launch path;
- a configuration hash covering behavior and economic parameters;
- the registry transaction, block, log index and finality used by indexers.

If any required value cannot be established, the launch remains unclassified. A later support message, webhook or metadata edit does not upgrade it to Programmable Custom.

## Approval is not launch

The approval path binds one exact candidate release:

```text
approved repository revision
→ reproducible build
→ wallet launch through the authorized Programmable path
→ actual deployment artifacts and configuration
→ runtime-code comparison
→ canonical Custom Registry event
→ Developer API projection
```

Approval alone produces no public launch record. Registration is allowed only when the launched chain, commit, source commitment, build commitment, artifacts, configuration, contracts, `runtimeCodeKeccak256` identities, launch wallet, transaction, and review evidence match the approved candidate.

A changed commit, artifact, runtime, configuration, chain, template, authority, or launch wallet does not inherit the earlier approval or `Programmable Verified` state.

For atomic integrations, deployment, initialization, and registration succeed or revert together. A staged integration remains private or pending until a final registration binds every required deployment and configuration value. A partially completed deployment must not appear as a public launch.

## Partnership-template fee policy

A partnership template owns and implements its fee logic. Programmable verifies the exact release but does not rewrite partner-owned source without authorization. Partner attribution can exist without a qualifying fee path; in that state the record uses `no-qualifying-market` and zero shares.

An accepted partnership fee path requires exactly:

```text
total:        20 bps
partner:      15 bps
Programmable:  5 bps
```

The Programmable recipient is the canonical address published in the manifest. Both shares use the same defined basis. The normal Native Custom 10 bps must not be added on top of the 20 bps partnership fee.

If the reviewed template already has the partner's 15 bps, the partner keeps it and adds the 5 bps Programmable share. If no fee path exists, the partner implements both shares. The partner recipient may be derived from reviewed code, immutable deployment configuration, or verified onchain state, but it must be unambiguous before activation.

Fail closed if either share or recipient is unverified, the total differs from 20 bps, the basis or currency differs between shares, a recipient can drift outside the reviewed authority policy, Native Custom 10 bps is also charged, or one party can claim the other's accrual.

Document exact fee currency, charge mode, rounding, accrual, withdrawal or claim mechanism, pause behavior, retirement behavior, and evidence against replay, double claim, and reentrancy. See [Platform fees](../reference/fees.md).

No Basebit or Aion provider release, recipient, template, Registry record, or live 15/5 fee path is currently evidenced by the public v2 manifest. Do not treat similarly named code, generic owner-fee logic, or research input as partner activation evidence.

## Registry ABI authority

No Custom Registry ABI is published as live. Files under `proposals/` are design inputs only; they are not a normative interface, a deployed ABI, or permission to submit a transaction.

After deployment, integrators must obtain the exact versioned Registry ABI and event topics through the public manifest and its immutable evidence links. Accept logs only from the manifest-listed chain, Registry generation, address, start block, and event set.

The eventual Registry record must support projects with no token, one token, or multiple assets and markets. Do not build against a token-only draft event or infer a Registry interface from a fixture. Until the manifest publishes the real ABI, direct Custom ingestion remains disabled.

## Provider-neutral Generation 2 binding

Generation 2 does not reserve special code paths for Basebit, Aion, or any future provider. Any nonzero `providerId` must be backed by an active authorization in the manifest-bound PartnerFactory Registry. That authorization binds the exact chain and Registry generation, provider, model and version, template and version, model repository revision, factory repository revision, factory address and runtime, launch runtime set, `configurationHash`, `permissionsHash`, fee-policy hash, validity window, and evidence hash.

The launch registration must repeat the matching provider, model, template, market path, configuration, permissions, source revision, runtime set, and fee-policy commitments. A copied template identifier, self-declared provider ID, correct factory on a different chain, changed runtime, or changed configuration fails closed.

For any authorized nonzero provider with a qualifying fee-bearing market path, the structural policy is exactly:

- `totalFeeBps: 20`;
- partner share `15`;
- Programmable share `5` to `0x4957f49620AFf3Adbbe8195a4f633E49cc93376c`;
- `nativeCustomFeeBps: 0`;
- one currency, charge mode, basis, and rounding rule for both shares; and
- distinct recipients and claim rights.

This rule is provider-neutral. Programmable verifies the provider-owned template; it does not rewrite that template. Native Custom remains exactly 10 bps on its verified official market path. A no-qualifying-market record carries zero fee economics. Paused, retired, unverifiable, overlaid, or internally inconsistent policies are rejected.

## Registry invariants

- Each authenticated token asset can be bound to at most one canonical launch per chain.
- A `launchId` cannot be replayed.
- Only an approved adapter or factory can register.
- An approved caller is bound to one provider ID and reviewed runtime code.
- A template version cannot silently change implementation or configuration semantics.
- Registration records are immutable provenance.
- Corrections and revocations are append-only state transitions that preserve the original event.
- Suspending a provider or template blocks future registrations but does not erase historical events.
- Provider approval, template review, audit evidence and market support remain separate states.
- Unknown or unsupported markets remain discoverable and fail closed for charting or execution.

## Hook review

For Uniswap v4 templates, the handoff must list every enabled hook permission. Reviewers verify at minimum:

- every callback authenticates the expected PoolManager;
- the callback `sender` is not mistaken for the end user;
- router restrictions and hook data assumptions are explicit;
- external calls and reentrancy surfaces are bounded;
- delta accounting settles to zero;
- upgrade, owner and fee authorities are disclosed;
- token-level transfer, pause, blocklist and mint controls are disclosed;
- `beforeSwapReturnDelta` is disabled unless its custom-accounting design is specifically reviewed and audited.

The `custom` category does not imply that these checks passed. Template-specific evidence and any `Programmable Verified` review must be carried and rendered separately.

## Feed projection

After a Registry deployment is live and a partner launch is canonically registered, the v2 feed can project it as `observed`, then advance it through `confirmed` and `finalized` or correct it to `orphaned`:

```text
platformId: programmable
category: custom
publicLabel: Programmable Custom
projectId: <Registry-bound project ID>
model: <model ID and version>
template: <reviewed template, repository, commit, runtimes and evidence>
partner: <verified partner identity, recipient, lifecycle and evidence>
registryOrigin: <chain, Registry generation, transaction, block and log evidence>
approvalBinding: <repository revision, build, artifacts and configuration>
deploymentBinding: <launch wallet, contracts, runtime and evidence>
verifiedReview: <policy, findings, authorities, dependencies and effective state>
feePolicy.mode: partner-template
feePolicy.totalFeeBps: 20
feePolicy.partnerShareBps: 15
feePolicy.programmableShareBps: 5
feePolicy.normalProgrammableTenBpsApplied: false
finalityEvidence: <observed, confirmed, finalized or orphaned evidence>
```

This is a semantic excerpt, not a fixture or an active record. Every value remains prelaunch until the Registry is deployed. Never replace nulls with guessed addresses or partner data; use the normative JSON Schema for the complete field contract.

## Terminal behavior

Terminals ingest every registered launch through `/api/v2/launches?category=custom`. They do not need a provider-specific discovery integration.

The minimum display is:

- `Programmable Custom` label;
- chain plus project ID and authenticated token or contract addresses;
- launch time and finality;
- provider attribution when present;
- supported market actions only.

Do not convert provider registration into a universal `safe`, `audited`, `sellable` or `unruggable` flag. Pool state, liquidity, quotes, simulation and template-specific evidence remain separate checks.

## Acceptance checklist

A provider integration is ready for activation only when:

1. the handoff package is complete;
2. factory and implementation `runtimeCodeKeccak256` identities match the reviewed release;
3. positive and negative receipt mappings pass;
4. duplicate, replay and unauthorized registration tests pass;
5. hook permissions and economic controls are documented;
6. mainnet-fork launch, buy and sell simulations pass where trading is supported;
7. the registry deployment and start block are published in the manifest;
8. a live canary appears as `category=custom` in the feed;
9. unsupported market features fail closed;
10. the terminal fixtures and machine-readable docs match the live record;
11. any active fee-bearing partnership-template path proves the exact 20 bps total, 15/5 split, recipients, common basis, currency, accrual, and claims with no additional Native Custom fee, while a no-qualifying-market record keeps every share at zero; and
12. the deployed review record remains effective, not superseded or revoked.

Until all twelve conditions are satisfied, keep the provider integration prelaunch.
