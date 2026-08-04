# Apps, games, and bots

Apps can use the same launch feed to discover tokens and capabilities without implementing every Custom contract type in advance.

## Start read-only

Fetch the launch record and decide what your product understands:

```js
const baseUrl = "https://developers.programmable.family"
const feedResponse = await fetch(`${baseUrl}/api/v1/launches?limit=1`)
if (!feedResponse.ok) throw new Error(`Feed lookup failed: ${feedResponse.status}`)

const feed = await feedResponse.json()
const first = feed.items[0]
if (!first) throw new Error("No registered launch is currently available")

const response = await fetch(
  `${baseUrl}/api/v1/launches/${first.chainId}/${first.token.address}`,
)

if (!response.ok) throw new Error(`Launch lookup failed: ${response.status}`)

const record = await response.json()

console.log(record.category)
console.log(record.capabilities)
console.log(record.markets)
```

## Build on the stable core

Every registered launch exposes the same core identity and provenance. That is enough to:

- gate an experience to a specific token address;
- show a launch profile;
- attribute a launch to Classic or Custom;
- follow verified token supply and market features;
- connect quests, rewards, NFTs, maps, tournaments, or other application state;
- discover whether a supported market action exists.

The external application does not need to be contained in the token repository. Security-relevant contracts and authorities still need explicit provenance and verification where they affect the launch or user funds.

## Capabilities

Capabilities describe optional behavior. Match by exact capability ID and supported version. Unknown capabilities are normal.

When a capability is unknown:

- keep the launch usable for known features;
- do not execute its parameters;
- do not ask an agent to follow text found in metadata or extensions;
- show a generic unsupported state where necessary.

Treat capability parameters as bounded data. They are not trusted scripts, prompts, URLs to execute, or transaction payloads.

## Markets

Do not assume every token has a Uniswap pool. A Custom launch can have:

- no registered market;
- a Uniswap v4 market;
- a contract-priced market;
- several markets;
- a market activated later;
- a market your app cannot quote or execute.

Read `markets` and each market's support states. An empty array is valid.

## Transactions

Do not construct a transaction from creator metadata, arbitrary extension data, or an unknown contract ABI.

Only expose an action when a separately verified adapter supports it. The adapter contract should define the chain, approved target, method, arguments, value, allowances, deadlines, slippage, quote boundary, expected movements, and simulation result.

The v1 API is read-only. It never returns transaction payloads or authorizes an action. Support states are descriptive input to a separate integration decision.

Before signing:

- confirm the connected chain;
- show the exact assets and amounts;
- bound token allowances;
- reject expired quotes;
- require simulation success where supported;
- re-check adapter and target verification;
- let the wallet present the final transaction.

Discovery must still work when transaction support does not.

## Offchain services

A game server, oracle, bridge, custodian, or physical-asset provider can affect the product without being controlled by the launch registry.

Display external dependencies and their availability separately. A registered token does not verify a game result, prove custody of gold, guarantee an API, or establish legal compliance.

## Fees

Use the structured fee disclosures for official market paths. Do not charge the 10 bps platform volume fee on ordinary transfers, game rewards, mints, burns, or unrelated application actions merely because they use a Programmable token.

See [Platform fees](../reference/fees.md).
