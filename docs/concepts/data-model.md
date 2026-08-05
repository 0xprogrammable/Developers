# Launch data model

The v1 model separates a launch from its markets. This lets the same integration represent a Classic pool, a Custom hook, a contract-priced market, multiple markets, or a token with no active market.

## Identity

Use three different identities for three different jobs:

- **Platform identity:** `platformId`, always `programmable` in the official projection
- **Asset identity:** namespace plus value from `assets[].identity`; for an advertised ERC-20, this also has the `chainId` plus `token.address` convenience view
- **Launch identity:** `launchId`, derived from canonical chain and event provenance for current first-party launches or issued by the authenticated finalized Registry
- **Market identity:** `market.marketId`

Names and tickers are display metadata. They are not unique identifiers.

An asset may have one recognized Programmable launch and zero, one, or several registered markets. A market may become active after the launch. Do not collapse these identities into a pool address.

## Launch record

Every record has the same top-level keys:

| Field | Purpose |
| --- | --- |
| `schemaVersion` | Version of the launch-record schema |
| `platformId` | Stable `programmable` platform identity assigned by the trusted projection |
| `launchId` | Stable Programmable launch identity derived from canonical provenance or issued by a future Registry |
| `category` | `classic` or `custom` |
| `chainId` | EVM chain ID |
| `token` | ERC-20 convenience identity and metadata, or null for project-only launches |
| `assets` | Optional authenticated identity-first asset graph |
| `launch` | Launch model, transaction, block, timestamp, and finality |
| `verification` | Recognized source, launcher or registry, and provenance state |
| `capabilities` | Extensible declared or verified product features |
| `markets` | Zero, one, or several normalized markets |
| `fees` | Fee disclosures with verification state |
| `extensions` | Bounded namespaced additional data |

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

Key a present token by chain and address. A project-only record uses `token: null`; preserve its `assets` identities and never derive a token from `launchIdentity`. Treat name and symbol as untrusted display values. Preserve raw integer values and apply decimals only for presentation.

A recognized launch event stays discoverable when an ERC-20 metadata or supply call fails. In that case, identity can be `partial`, individual fields remain null, supply can be `unavailable`, and metadata trust can be `unavailable`. Do not fill those values with guesses or remove the launch.

## Asset provenance

Each authenticated Registry asset carries an immutable `provenance` union:

- `launch-produced` means the finalized launch created the asset;
- `protocol-external` identifies a protocol dependency and its relationship;
- `adopted-external` binds the exact reviewed dependency identity, runtime-code hashes, capability and role, review/interface evidence, and state observations.

Only one `launch-produced` `primary-token` may create the public `token` convenience view. An external or adopted token never becomes a newly launched coin merely because a project references it. Preserve provenance exactly and do not replace the evidence fields with creator labels.

## Launch provenance

`launch` contains the public lifecycle and original onchain evidence:

| Field | Meaning |
| --- | --- |
| `status` | Current launch lifecycle state |
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

`platformId`, `category`, and `launch.modelId` are provenance fields. The official producer derives them from the matched deployment or authenticated finalized Registry record; it never accepts them from creator-editable token metadata.

Authenticated Custom records also expose source and presentation lineage under `extensions["programmable/registry-v2"]`. `sourceKind` is exactly `browser-wallet-report` or `legacy-executor`. Presentation is an all-or-nothing snapshot: `presentationVersion`, `presentationBindingHash`, and `presentation` are either all null or all present. Presentation contains display-only description, image, and links; it cannot change platform identity, category, model, token identity, contracts, markets, or fees.

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

## Categories

v1 has exactly two public categories:

- `classic`
- `custom`

Do not create public categories for every tokenomic or market design. Existing first-party stock-paired launches normalize as `custom`. Future hooks, auctions, games, contract markets, and designs not yet named also remain `custom`; their actual behavior belongs in capabilities and markets.

## Capabilities

Each capability contains:

| Field | Meaning |
| --- | --- |
| `id` | Extensible capability identifier |
| `version` | Capability contract version |
| `status` | `active`, `conditional`, or `inactive` |
| `parameters` | Bounded capability-specific data |

Capability identifiers are open to future additions. Unknown IDs must not hide or invalidate a launch. Display the known core record, ignore unsupported capability behavior, and preserve the raw capability if your storage model allows it.

Capability data is feature detection, not executable code. Never treat metadata, extension text, or capability parameters as agent instructions or transaction calldata.

## Markets

Each market contains:

| Field | Meaning |
| --- | --- |
| `marketId` | Stable market identity |
| `kind` | Extensible market type |
| `status` | Current market lifecycle state |
| `sourceStatus` | Authenticated source lifecycle when public support is conservatively downgraded |
| `verificationStatus` | Whether the public market mapping is verified, unverified, or verification-pending |
| `verification` | Source verifier status plus its adapter ID and binding hash, or an explicit pending value |
| `baseTokenAddress` / `quoteTokenAddress` | Market currencies when they are EVM ERC-20 identities; otherwise null |
| `protocol` | Protocol or settlement family |
| `poolId` / `poolAddress` | Pool identifiers when the market has a pool |
| `hookAddress` | Hook address when applicable |
| `support` | Separate discovery, charting, quote, simulation, and execution support |
| `adapter` | Verified normalization or action adapter when available |

`markets: []` is valid. It means there is no registered market in this record. Keep the launch discoverable and omit market-only UI.

A market can exist without a pool. In that case, pool fields remain absent or null according to the schema. Never create a synthetic pair or substitute the market contract as a pool address.

Unknown market kinds use a generic fallback:

1. Show launch provenance and the authenticated asset identities; show token data only when present.
2. Label the market as Custom or unsupported rather than guessing its mechanics.
3. Read the explicit `support` states.
4. Hide charts, quotes, simulation, or execution that lack verified support.
5. Continue accepting future optional fields.

The authenticated source status `verification_pending` remains visible as `sourceStatus`; the conservative public lifecycle is `planned`. A verified Uniswap v4 record also preserves its PoolManager review, interface, runtime-code, and pool-key evidence bindings.

## Feature support is independent

Market support is not one boolean. Treat these separately:

- discovery
- charting
- quote
- simulation
- execution

For example, a contract market may be discoverable and chartable but not executable through a terminal. A token with no market remains discoverable but has no market features.

Each axis is `available`, `unavailable`, or `unknown`. These states are descriptive. v1 never returns transaction payloads, and `available` does not itself authorize an action.

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

## Extensions

Extensions allow future and project-specific data without changing core v1 meanings. They are deliberately subordinate to the core record.

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
- Keep the launch ID and authenticated asset identities visible; keep token address and chain visible when a token exists.

Registration does not make external APIs, games, or offchain assets trustworthy. It only establishes the provenance represented by the verified record.
