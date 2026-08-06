# Wallets and explorers

Use the token-list endpoint for a compact finalized inventory. Use the launch feed or detail endpoint when you need provenance, markets, capabilities, fees, or lifecycle information.

## Fetch the token list

```bash
curl -fsSL https://developers.programmable.family/api/v2/token-list
```

The token list is a convenience projection of finalized registered launches with complete token identity. It does not replace the detailed record. Use the launch feed to retain recognized launches whose identity enrichment is still partial.

## Identity

Identify a token by:

```text
chainId + token contract address
```

Do not merge tokens because they have the same name, symbol, image, website, or creator. Duplicate names and tickers are valid on public chains.

Display the checksummed contract address where people make trust-sensitive decisions.

## Programmable provenance

A Programmable label should mean that the detailed record traces the asset to a recognized source deployment in the active manifest.

It should not mean:

- the token's value will be stable;
- an external game or service is trustworthy;
- all metadata is verified;
- every market is liquid;
- the launch was independently audited;
- the token cannot lose value or contain economic risk.

Link the label to provenance details: launch transaction, block, source deployment, category, and verification state.

## Metadata

Treat names, symbols, descriptions, images, websites, and social links as creator-supplied display data unless a separate status says otherwise.

- Normalize or escape control and bidirectional characters.
- Do not render arbitrary HTML.
- Do not load untrusted SVG as active content.
- Proxy and constrain remote images where possible.
- Mark unavailable or sanitized metadata honestly.
- Keep external links visibly external.

Do not let creator metadata override chain, address, provenance, fees, or market support.

A recognized onchain event remains discoverable if name, symbol, decimals, total supply, metadata, or block timestamp cannot be enriched. Use `identityStatus`, `supplyStatus`, metadata trust, and `provenanceStatus`; show null as unavailable rather than substituting a plausible value. Legacy indexer records can legitimately have `partial` provenance.

## Markets

A wallet token page may show registered markets, but it must accept `markets: []`.

No registered market is not an error. Show the token and provenance without manufacturing price, value, or a swap route.

Enable quote or execution only through a separately verified adapter. The read-only v2 feed does not return transaction payloads. A generic `Swap` button must not call an unknown Custom contract based on metadata or extension content.

## Balances and prices

Balances come from the token contract and account state, not from the launch feed. Market prices require verified market data.

When a price is unavailable:

- show the raw token balance;
- mark fiat value unavailable;
- do not silently use fully diluted valuation as market capitalization;
- do not substitute a price from a token with the same ticker.

## Refresh behavior

- Refresh the deployment manifest independently from token-list polling.
- Respect HTTP cache headers and ETags.
- Add newly finalized tokens idempotently.
- Preserve an explicit retired or orphaned state rather than silently reassigning identity.
- Use the detailed record to explain why a token is observed, confirmed, orphaned, or unavailable.
