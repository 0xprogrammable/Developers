# Direct Native Hook Graph Profile V2

The Direct Native Hook Graph V2 descriptor is the retained historical discovery
contract for Custom Launch API V3 resources. New general-lane integrations use
[Revision 3](direct-native-hook-graph-profile-v3.md), and only metadata-bound
profile `3.3.0` accepts fresh submissions. Revision 2 remains part of the
`custom` category. It does not create a third public launch category and does
not change the retained V1 discovery or Custom Launch API V1/V2 contracts.

Resolve `directNativeHookGraphProfileV2` from `GET /api/v2/manifest` or
`GET /api/v2/status`. Its schema is
`programmable.direct-native-hook-graph-profile-discovery.v2`. Historical
resources remain readable, and exact old request bytes may be retried only under
their original compatibility contract. Revision 2 is not publicly routable for
fresh submissions. The authenticated current contract is the separate
[`custom-launch-v3.json`](https://programmable.market/openapi/custom-launch-v3.json)
OpenAPI document.

## What the retained profile describes

The profile describes one atomic, acyclic CREATE2 graph with 3–16 direct
targets. The project supplies exact token, hook, initializer, and optional
support-contract artifacts. Token, hook, and initializer roles are distinct.
Every target is bound to exact source bytes, Solidity Standard JSON, compiler
version and settings, constructor or initializer arguments, creation bytecode,
and runtime identity. A project-owned artifact means the project supplies and
binds that artifact; it is not a claim that Programmable controls its custody
or upgrade authority.

The hook permission mask is selected per launch. Every valid Uniswap v4 mask
from `0` through `16383` is representable, including zero permissions, provided
that callback dependencies are valid and the declared permissions, compiled
permissions, and low 14 bits of the mined hook address agree exactly. Static
pool fees and the `0x800000` dynamic-fee sentinel are supported.

This is broader than the retained V1 preview. It does not substitute a
Programmable hook for the project's hook. It still does not mean arbitrary
bytecode is automatically trusted: source/build/runtime binding, simulation,
admission, and the exact per-launch platform-fee conformance receipt were
mandatory for each exact historical resource. Those facts are not fresh-write
authority.

## Funding modes and wallet boundary

The selected funding mode is exactly one of:

- `none`, with zero deployment and initializer values;
- `wallet-transaction-value`, where the prepared Router transaction carries
  the exact native value reviewed by the controller wallet; or
- `eip-3009-receive-with-authorization`, where the wallet separately reviews
  and signs the exact USDC authorization before reviewing the Router
  transaction.

The wallet-bound API key authenticates historical reads and exact retries only. The CLI and API never
sign or broadcast a wallet transaction. Store the key in an encrypted secret or
`PROGRAMMABLE_API_KEY`; never put the key in a prompt, chat, config file, or
command argument.

## Liquidity is graph-specific

Pool initialization does not add concentrated liquidity, and trading volume
does not create a Uniswap LP position. A normal concentrated-liquidity launch
therefore starts with an empty pool until the project or another participant
supplies a position. The profile does not provide a generic liquidity lock or
withdrawal restriction.

The retained contract binds one explicit liquidity intent into the request hash:

- `external-concentrated-liquidity` records `liquidity_required`; launch finality
  does not claim the empty pool is tradeable.
- `launch-seeded-concentrated-liquidity` names the exact graph target that
  supplies a position and remains `assessment_required` until the seed,
  custody, withdrawal, buy, and sell checks have separate evidence.
- `hook-inventory-custom-accounting` names the exact hook inventory path,
  requires a swap return-delta permission, and remains `assessment_required`
  until settlement, solvency, backing, withdrawal, buy, and sell checks have
  separate evidence.

A request can only declare required checks; it cannot declare its own pass.
Older V3 request bytes without this field remain readable as the external
liquidity model, while current fresh V3.3 output uses its active contract.

A custom-accounting hook may validly start with zero classical LP only when its
exact graph already supplies and settles the inventory or backing required for
swaps. Volume may build backing only when that behavior is implemented in the
reviewed hook. Launch finality never proves liquidity, backing, solvency,
sellability, or a lock.

## Fee and conformance contract

For an exact conforming historical V2 graph, each successful bound pool swap
owed Programmable `1,000` hundredths of a bip:
`1,000 / 1,000,000 = 0.10% = 10 bps`. The project selects either an additive
platform share or an inclusive selected total, plus one of the published
assessment-base and fee-currency pairs. The LP fee, project economics,
Programmable charge, and network gas remain separate disclosures.

A platform-issued receipt binds the exact final graph commitment, runtime set,
initializer calldata, funding boundary, fee selection, and conformance vector
result. Applicant assertions cannot replace that receipt. A receipt is issued
per accepted launch; it is not a universal approval for a source repository,
hook name, permission mask, or future build.

Generic fee claiming and buyback management for arbitrary hooks are not live.
The reserved `fees:claim` and `buybacks:manage` scopes do not promise those
features.

## Historical CLI boundary

The immutable release asset remains available for exact historical reproduction:

```sh
npm install --global \
  https://github.com/0xprogrammable/PROGRAMMABLE/releases/download/programmable-launch-v3.0.0/programmable-launch-3.0.0.tgz
programmable-launch --version
```

The historical CLI exposes `pack`, `validate`, `submit`, and `status`, but
command presence is not current write authority. Do not create or repack a
fresh Revision 2 request. Use current V3.3 tooling for a fresh submission.
Existing resources may still be read by their exact request ID:

```sh
programmable-launch status REQUEST_UUID
```

An existing historical `authorized` resource is not fresh authorization and
does not let a client, CLI, or LLM create a new handoff. `finalized`, `failed`,
and `cancelled` are terminal. Finalized consistent
canonical-Router launches may be published in the Custom launch feed. A token
list entry additionally requires a recognized token identity. Pending requests
and prelaunch profile records are never feed identities.

## Read-only discovery boundary

This repository publishes read-only discovery data. Its descriptor names the
historical API and CLI contract but supplies no executable calldata and
authorizes no transaction. For a fresh V3.3 request, the API server, not a CLI,
LLM, or client, decides authorization after the exact static admission baseline
and pinned Router simulation. Under current profile `3.3.0`, missing or
unavailable runtime behavior evidence keeps the related claims unverified;
an authenticated executed negative blocks wallet handoff. That is not a
universal safety or fee-enforcement claim. Resolve live launch provenance
independently from canonical Router evidence in the Developer manifest.
