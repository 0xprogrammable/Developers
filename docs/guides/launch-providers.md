# Launch providers

This document defines how an external launch system can make its accepted launches discoverable as `Programmable Custom` without creating a provider-specific terminal integration.

## Status

Custom Registry generation 1 is live for finalized approved launch discovery. The exact address, start block, ABI, event set, and finality requirement are published by `GET /api/v2/manifest`. Legacy Registry and GitHub submission intake are closed and `publicSubmissionsEnabled` remains `false`; this does not close the separate authenticated Custom Launch API V3. V1 and V2 resources remain readable under their compatibility contracts, but their authenticated POST routes return nonretryable `409 CUSTOM_LAUNCH_V1_READ_ONLY` or `409 CUSTOM_LAUNCH_V2_READ_ONLY`. Only V3 profile `3.3.0` accepts fresh requests. Clients retry only statuses marked retryable by the current V3 OpenAPI, honor `Retry-After`, and replay the exact idempotency-bound request bytes.

## Partner API principal and downstream agents

An approved partner root and, at most, one delegated subkey level authenticate
to the same canonical V3 endpoints and are evaluated by the same server-side
policy. Neither identity receives a partner-specific route, admission
exception, or public category. A subkey cannot delegate again, manage another
subkey, change the root identity, or bypass the root's policy boundary.

Only a root holding `partner-subkeys:manage` can list, issue, rotate, or revoke
its own children. Child scopes and budgets cannot exceed the root, and child
expiry cannot exceed root expiry. A secret is returned only by the initial
issue or rotation response. Neither root nor child can sign or broadcast a
wallet transaction, bypass security or approval, or choose public attribution.

The root can read every partner-attributed launch made by the root or its
children. A child can read only its own stable lineage. Rotating a child secret
preserves that lineage; issuing a distinct child starts an isolated lineage.
Revoked credentials cannot authenticate. Permit reissue disposition is available
only to wallet credentials. Partner launch metadata follows the same complete
policy as wallet-key launches.

Wallet-key launches require the controller to equal the key's wallet binding.
Partner calls select the controller wallet in the exact request; that wallet
must still review, sign, and broadcast the prepared transaction. Partner roots
are created only through the authenticated Website BFF and the server-configured
Privy-user/wallet allowlist. A client, partner frontend, or subkey cannot
self-authorize a root.

Keep partner credentials in the partner backend. They are authentication
material, not public metadata. A framework or agent builder may place its own
layer in front of that backend, but every call reaching Programmable resolves
to the authenticated root principal and the server applies the canonical V3
policy to the exact request.

The launch request cannot set `partnerAttribution`, `launchedVia`, a partner ID,
or a partner display name. On a successful finalized launch, the server takes
an immutable snapshot of the authenticated principal:

```json
{
  "schemaVersion": "programmable.launch-partner-attribution.v1",
  "partnerId": "example-partner",
  "name": "Example Partner",
  "website": "https://partner.example/",
  "attributionSource": "authenticated-partner-api-key",
  "attributionVersion": 1,
  "snapshotDigest": "sha256:<64 lowercase hex>"
}
```

The Custom Launch API publishes that optional object as
`partnerAttribution`; the Developer launch model can project the identical
object as `launchedVia`. The UI may render `Launched via Example Partner`.
Credential rotation, revocation, or a later partner-profile edit must not
rewrite an already finalized snapshot. A partner's internal subkey cannot
choose a different public attribution or escalate its Programmable authority.
The digest detects mutation of a snapshot received from the official read
surface; it is not a signature that authenticates a copied object in isolation.

This display attribution is separate from the existing economic `partner`
record and Registry `provider` evidence. It establishes neither a fee split nor
template approval, security review, liquidity, tradability, third-party
indexing, or a `safe` label.

## Required public metadata, independent mechanics

Current partner and direct Custom submissions provide a canonical public
envelope before launch: token name, symbol, non-empty description, image bytes
with their digest and media facts, one website, and one canonical X profile
URL. The exact write contract remains the Custom Launch V3 OpenAPI; this
Developer API only documents and projects finalized read data.

These requirements describe the project card, not the hook's behavior. They do
not restrict valid v4 permission masks, custom accounting, settlement design,
token mechanics, market count, or whether a conventional liquidity position
exists. Older recognized launches with incomplete presentation remain
discoverable with null or unavailable fields; consumers must not invent the
missing image or social links.

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

The generation 1 Registry ABI is published at `https://developers.programmable.family/abis/ethereum/programmable-custom-registry-v1.json`; its canonical event set and hash specification are published beside it. Files under `proposals/` remain design inputs only; they are not the normative deployed interface or permission to submit a transaction.

Integrators must obtain the exact versioned Registry ABI and event topics through the public manifest and its immutable evidence links. Accept logs only from the manifest-listed chain, Registry generation, address, start block, and event set.

The Registry record supports projects with no token, one token, or multiple assets and markets. Do not build against a token-only draft event or infer a Registry interface from a fixture. Direct ingestion is enabled only for the exact live generation published by the manifest.

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
launchedVia: <optional immutable authenticated-partner snapshot>
```

This is a semantic excerpt, not a fixture or an active record. Every value remains prelaunch until the Registry is deployed. Never replace nulls with guessed addresses or partner data; use the normative JSON Schema for the complete field contract.

## Terminal behavior

Terminals ingest every registered launch through `/api/v2/launches?category=custom`. They do not need a provider-specific discovery integration.

The minimum display is:

- `Programmable Custom` label;
- chain plus project ID and authenticated token or contract addresses;
- launch time and finality;
- provider attribution when present;
- `Launched via <partner name>` when `launchedVia` is present and its snapshot digest is valid;
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
