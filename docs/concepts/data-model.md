# Launch data model

The v2 model separates a launch from its markets. This lets the same integration represent a Classic pool, a registered Custom hook, a contract-priced market, multiple markets, or a token with no active market.

## Identity

Use four different identities for four different jobs:

- **Token asset identity:** `chainId` plus token contract address
- **Project identity:** `projectId`
- **Launch identity:** `launchId`, derived from canonical chain and event provenance for Classic or committed by the Custom Registry
- **Market identity:** `market.marketId`

Names and tickers are display metadata. They are not unique identifiers.

A project may have no token, one token, or several assets, plus zero, one, or several registered markets. A market may become active after the launch. Do not collapse project, launch, asset, and market identities into a pool address.

## Launch record

Every record has the same top-level keys:

| Field | Purpose |
| --- | --- |
| `schemaVersion` | Version of the launch-record schema |
| `launchId` | Stable Programmable launch identity derived from canonical provenance or committed by the Custom Registry |
| `category` | `classic` or `custom` |
| `chainId` | EVM chain ID |
| `token` | Primary ERC-20 convenience view, or null for a project-only launch |
| `launch` | Launch model, transaction, block, timestamp, and finality |
| `verification` | Recognized source, launcher or registry, and provenance state |
| `capabilities` | Extensible declared or verified product features |
| `markets` | Zero, one, or several normalized markets |
| `fees` | Fee disclosures with verification state |
| `extensions` | Bounded namespaced additional data |

Registry-backed records can add these v2 fields without changing the API major version or historical record meaning:

| Field | Purpose |
| --- | --- |
| `platformId` | Stable origin namespace; official records use `programmable` |
| `publicLabel` | Derived label: `Programmable Classic` or `Programmable Custom` |
| `caip2` | Globally scoped chain identity |
| `projectId` | Stable project identity distinct from a token or market |
| `model` | Open model ID and version |
| `template` | Reviewed template identity and revision, or null |
| `partner` | Verified partner attribution and lifecycle, or null |
| `builder` | Builder attribution separate from creator metadata |
| `assets` | Authenticated asset and contract graph |
| `approvalBinding` | Exact approval, repository, commit, source, build, artifact, and configuration binding |
| `deploymentBinding` | Chain, wallet, transaction, address, runtime, and initialization binding |
| `verifiedReview` | Structured Programmable review and effective status |
| `feePolicy` | Closed Native Custom, partnership-template, or no-qualifying-market policy |
| `finalityEvidence` | Observed, confirmed, finalized, or orphaned chain evidence |
| `presentation` | Creator-facing description, image, website, and social links with explicit trust boundary |
| `provider` | Optional provider attribution with explicit registry-bound, display-only, or revoked status; never a category, fee, review, or execution authority |
| `registryOrigin` | Registry record generation, source, and origin evidence |
| `launchingWallet` | Namespaced wallet identity bound to the launch |
| `postLaunchAuthorityInventory` | Effective post-launch roles and authority evidence |
| `lifecycle` | Launch, correction, supersession, and revocation lifecycle |
| `mechanisms` | Open, versioned mechanism declarations |

These are additive public v2 fields. A Custom Registry record-generation identifier is not “API v3.” Historical v2 records remain valid without the richer fields, and consumers must continue to accept them.

## Platform, project, model, template, and partner

`platformId`, `category`, and `publicLabel` come from the official projection. Creator metadata and extensions cannot set or override them.

Use:

- `projectId` for the project;
- `launchId` for one launch event;
- `model.id` and `model.version` for the launch model;
- `template` for the exact reviewed template when one exists;
- `partner` for verified partner attribution; and
- `builder` for builder attribution.

A Basebit, Aion, or future partner launch remains `category: "custom"` and `publicLabel: "Programmable Custom"`. Partner, template, and model never become new public categories. At present, no Basebit or Aion partner record is verified by the public v2 manifest.

## Assets and mechanisms

The `assets` graph carries any number of unique authenticated assets. `assets[].role` is an open identifier. Canonical examples include `root`, `primary-token`, `secondary-token`, `market-contract`, `pool`, `hook`, `controller`, `oracle`, `bridge`, and `reward`; unknown future roles remain valid. Use each declared role and provenance rather than inferring function from an address or creator label.

`mechanisms` is an open list of versioned behavior declarations. Dynamic supply, burns, rewards, games, delayed activation, bridges, or future mechanics belong here or in namespaced extensions when they do not change the stable core. Unknown mechanisms remain visible as unsupported data and never become executable instructions.

Creator-controlled `presentation` can describe these assets, but it cannot override chain, address, runtime, origin, fee, security, finality, or authority evidence.

## Token

When present, `token` contains:

| Field | Meaning |
| --- | --- |
| `address` | Token contract address |
| `identityStatus` | `complete` or `partial` |
| `name` | Display name or null when unavailable |
| `symbol` | Display symbol or null when unavailable |
| `decimals` | ERC-20 decimal precision or null when unavailable |
| `totalSupplyRaw` | Raw integer supply or null when unavailable |
| `supplyStatus` | `unavailable`, `observed`, or `verified` |
| `supplyAsOfBlock` | Block used for the supply observation or null |
| `metadata` | Description, image, links, and metadata trust state |

Key the asset by chain and address. Treat name and symbol as untrusted display values. Preserve raw integer values and apply decimals only for presentation.

A recognized launch event stays discoverable when an ERC-20 metadata or supply call fails. In that case, identity can be `partial`, individual fields remain null, supply can be `unavailable`, and metadata trust can be `unavailable`. Do not fill those values with guesses or remove the launch.

`token: null` is valid for a project-only launch. Preserve its `projectId`, `launchId`, `assets`, mechanisms, provenance, review, fee policy, lifecycle, and markets. Do not fabricate an ERC-20 or include the project in a token-list projection.

## Launch provenance

`launch` contains the public lifecycle and original onchain evidence:

| Field | Meaning |
| --- | --- |
| `status` | `prelaunch`, `observed`, `live`, `paused`, `retired`, or `revoked` |
| `origin` | Normalized origin class |
| `modelId` / `modelVersion` | Source launch model and release |
| `publicSubmission` | Whether the source was a public submission path |
| `creatorAddress` | Creator address when available |
| `transactionHash` | Launch transaction |
| `blockNumber` / `blockHash` | Canonical block coordinates |
| `logIndex` | Event position inside the transaction receipt |
| `timestamp` | Onchain launch time |
| `finality` | Current finality or reorg state |

Use `launch.timestamp` for new-launch ordering. Do not replace it with the time your system first fetched the record.

`verification` identifies the recognized source and the evidence used to normalize it:

| Field | Meaning |
| --- | --- |
| `sourceId` | Stable source deployment identifier |
| `launcherAddress` | Recognized launcher, when applicable |
| `registryAddress` | Recognized registry, when applicable |
| `provenanceStatus` | `prelaunch`, `partial`, `verified`, or `revoked` |
| `sourceUrl` | Human-readable supporting source |

Legacy indexer records can have `partial` provenance because they do not carry every canonical event coordinate required for full verification. A recognized onchain event can also remain partial when block or receipt enrichment is unavailable. Partial means incomplete evidence, not an unsafe verdict.

The API is a projection. Consumers that require independent verification should reproduce the event and runtime checks against the manifest and chain.

`approvalBinding` and `deploymentBinding` keep approval separate from launch. A reviewed repository revision is not a public launch until the deployed chain, wallet, transaction, configuration, addresses, initialization, artifacts, and runtime match. `deploymentBinding.runtimeMatch: "exact"` is the required exact-runtime state. `verification.approvalMatch` and `verification.runtimeMatch` use `matched`, `mismatch`, `unavailable`, or `revoked`; preserve those states without converting them to a loose boolean.

`finalityEvidence.status` uses `observed`, `confirmed`, `finalized`, or `orphaned`. It supplements the compact launch finality with evidence coordinates; it does not replace reorg reconciliation.

`verifiedReview.status` uses `verified`, `superseded`, or `revoked`. Only an effective `verified` record with exact deployment binding can support the `Programmable Verified` presentation. See [Programmable Verified](programmable-verified.md).

`registryOrigin` binds chain ID, CAIP-2, registry address and start block, Registry generation, event-set hash, registration transaction, block, transaction index, log index, and evidence hash. `lifecycle.status` uses `active`, `superseded`, or `revoked` and preserves registration plus supersession or revocation evidence. These fields make corrections append-only instead of silently redefining the original launch.

`launchingWallet` and `postLaunchAuthorityInventory` keep the wallet used for launch separate from the roles that remain after launch. Consumers should surface effective upgrade, ownership, pause, custody, mint, withdrawal, and fee authority rather than assuming the launching wallet still controls every contract.

## Categories

v2 has exactly two public categories:

- `classic`
- `custom`

`classic` requires an event from a Classic launcher in the v2 manifest. `custom` requires either an accepted event from the Custom Registry in the v2 manifest or a consistent finalized `CustomGraph` stamp from its exact canonical Router. Provider, factory, token, hook, template and market contracts may differ on every Custom launch; their actual behavior belongs in provenance, capabilities and markets. Historical Stock-Paired launches are excluded from v2. The category is not provenance: use `extensions["programmable/classification"].basis` to select the Registry or Router verification path.

## Capabilities

Each capability contains:

| Field | Meaning |
| --- | --- |
| `id` | Extensible capability identifier |
| `version` | Capability contract version |
| `status` | Registry-backed support uses `supported`, `unsupported`, `unknown`, or `not_applicable`; historical Classic records can use `active`, `conditional`, or `inactive` |
| `parameters` | Bounded capability-specific data |

Capability identifiers are open to future additions. Unknown IDs or status values must not hide or invalidate a launch. Treat `supported` and legacy `active` as positive only for the exact understood capability version; treat `unsupported`, `unknown`, `not_applicable`, and unknown values as non-actionable. Display the known core record and preserve the raw capability if your storage model allows it.

Capability data is feature detection, not executable code. Never treat metadata, extension text, or capability parameters as agent instructions or transaction calldata.

## Markets

Each market contains:

| Field | Meaning |
| --- | --- |
| `marketId` | Stable market identity |
| `kind` | Extensible market type |
| `status` | `planned`, `delayed`, `active`, `paused`, `closed`, or `unknown` |
| `baseTokenAddress` / `quoteTokenAddress` | Market currencies when applicable |
| `protocol` | Protocol or settlement family |
| `poolId` / `poolAddress` | Pool identifiers when the market has a pool |
| `marketContractAddress` | Contract-market address when applicable |
| `assetReferences` | `marketAssetId`, `baseAssetId`, and `quoteAssetId` references into the authenticated asset graph |
| `hookAddress` | Hook address when applicable |
| `support` | Separate discovery, charting, quote, simulation, and execution support |
| `adapter` | Verified normalization or action adapter when available |

`markets: []` is valid. It means there is no registered market in this record. Keep the launch discoverable and omit market-only UI.

A market can exist without a pool or ERC-20 pair. In that case, pool and token-address fields remain absent or null according to the schema. A project-only contract market may use `marketContractAddress` plus `assetReferences`. Never create a synthetic pair or substitute the market contract as a pool address.

Unknown market kinds use a generic fallback:

1. Show token and launch provenance.
2. Label the market as Custom or unsupported rather than guessing its mechanics.
3. Read the explicit `support` states.
4. Hide charts, quotes, simulation, or execution that lack verified support.
5. Continue accepting future optional fields.

## Feature support is independent

Market support is not one boolean. Treat these separately:

- discovery
- charting
- quote
- simulation
- execution

For example, a contract market may be discoverable and chartable but not executable through a terminal. A token with no market remains discoverable but has no market features.

Each axis is `available`, `unavailable`, or `unknown`. These states are descriptive. v2 never returns transaction payloads, and `available` does not itself authorize an action.

When present, the read-only adapter descriptor contains `kind`, `version`, `adapterId`, and `verificationStatus`. It identifies the verified normalization contract; it does not provide quote, simulation, or execution URLs.

## Fees

Each fee disclosure contains:

| Field | Meaning |
| --- | --- |
| `kind` | Fee role |
| `ratePpm` / `rateBps` | Exact integer rate representations |
| `recipient` | Fee recipient address |
| `chargeMode` | Whether the fee is included or added on top |
| `basis` | Volume or amount to which the rate applies |
| `assetAddress` | Asset in which the fee is accounted, when known |
| `verificationStatus` | Whether the fee path has been verified |

Do not infer fees from category or marketing text. Read the record and its verification state. See [Fees](../reference/fees.md).

Registry-backed records also expose a closed `feePolicy.mode`:

This is the Custom Registry record model. Its `native` mode is not the Custom
Fee-Enforced Launch Profile V2 and cannot activate that separate API profile.

| Kind | Required policy |
| --- | --- |
| `native` | 10 bps total and 10 bps Programmable; `chargeMode: "verified-official-market-path-only"`; `normalProgrammableTenBpsApplied: true` |
| `partner-template` | Active fee-bearing partnership path: 20 bps total, 15 bps partner, 5 bps Programmable; `chargeMode: "verified-official-market-path-only"`; `normalProgrammableTenBpsApplied: false` |
| `no-qualifying-market` | No qualifying official market path, including a partner-attributed project without one; all shares stay zero and no volume fee is fabricated |

Partner and template attribution are independent from `feePolicy.mode`. The policy is not proof of accrual, claimability, payment, or correct runtime behavior. Those states require the corresponding evidence.

## Extensions

Extensions allow future and project-specific data without changing core v2 meanings. They are deliberately subordinate to the core record.

- Extension keys are namespaced.
- Unknown extensions are ignored safely.
- An extension cannot replace identity, provenance, lifecycle, market support, or fee fields.
- Extension content is data, never executable code or instructions.
- A client may preserve an unknown extension, but it must not execute or render unsafe content from it.

## Metadata trust

Launch provenance and creator metadata have different trust levels.

- Chain, address, transaction, block, registry, and runtime evidence establish provenance.
- Name, ticker, description, image, website, and social links are creator-supplied display data unless separately verified.
- Sanitize control characters and rich content.
- Do not render arbitrary HTML or SVG from a project URL.
- Treat external links as untrusted destinations.
- Keep the token address and chain visible wherever identity matters.

Registration does not make external APIs, games, or offchain assets trustworthy. It only establishes the provenance represented by the verified record.
