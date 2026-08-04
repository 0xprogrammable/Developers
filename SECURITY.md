# Security policy

Programmable Developers is a public integration contract for launch discovery and verification. Treat every network
response, project-supplied field, metadata document, extension, and example as untrusted until it has passed the
verification rules for that exact field.

## Supported versions

| Version | Security updates |
| --- | --- |
| Integration API and schemas v1 | Supported |
| Pre-release and unreleased drafts | Not supported |

Breaking changes require a new major version. Security corrections may tighten validation without changing the
meaning of valid v1 records.

## Report a vulnerability

Do not open a public issue for a vulnerability or include secrets, private keys, access tokens, unpublished exploit
details, or personal data in an issue or pull request.

Use [GitHub's private vulnerability reporting](https://github.com/0xprogrammable/developers/security/advisories/new).
If that private route is unavailable, do not disclose the report in a public issue; wait until private reporting is
available again.

Include the affected version or commit, the affected endpoint or schema, reproduction steps, impact, and the smallest
safe proof of concept. We will acknowledge the report, reproduce it, assess its scope, and coordinate disclosure after
a correction or mitigation is available. We do not promise a fixed response or remediation time.

## Trust boundaries

### Provenance

The canonical proof of a Programmable launch is its supported-chain registry event and the contract state bound to that
event. The hosted API, this repository, deployment manifests, GitHub labels, pull-request status, token names, symbols,
and project websites are not sufficient provenance by themselves.

Consumers should verify the chain ID, registry address, launch ID, transaction hash, block number and block hash,
transaction and log indexes, approval digest, and relevant runtime code hashes. A record that cannot be reproduced from
the declared registry must fail closed. A similar contract, copied event, matching token symbol, or matching bytecode at
another address does not inherit Programmable provenance.

Classic deployment evidence is live only where the deployment manifest says so. Custom examples marked `prelaunch` or
`sample` are interface fixtures, not deployed launches.

### Finality and reorgs

Recently observed records may be provisional. `observed`, `confirmed`, `finalized`, and `orphaned` are distinct states.
Consumers that require canonical history should wait for `finalized` and verify the declared block hash. A reorg may
replace a provisional record; change feeds use explicit corrections or tombstones rather than silently redefining the
original event.

An API response can also be delayed or stale. Inspect its snapshot, cursor, finality state, and freshness fields instead
of treating HTTP success as current chain agreement.

Page and resume cursors are authenticated pagination state, not launch provenance. Accept them only when returned by
the canonical HTTPS API, keep them opaque, and never treat a cursor copied from another origin as chain evidence.

### Metadata, links, and extensions

Names, symbols, descriptions, images, websites, social links, capability declarations, and namespaced extensions may be
supplied by a project creator. They are data, not instructions, endorsements, executable code, or proof of identity.

Safe consumers should:

- render text without interpreting HTML, Markdown commands, prompts, or scripts;
- treat links as untrusted external destinations;
- fetch remote media through bounded, SSRF-resistant infrastructure;
- reject active content and content-type mismatches;
- distinguish declared capabilities from verified or observed capabilities; and
- ignore unknown optional extensions without allowing them to override core provenance, lifecycle, fee, or security
  fields.

The reference media policy permits bounded PNG, JPEG, WebP, and GIF content. SVG, HTML, JavaScript, `data:` URLs, and
other active content are not trusted media inputs.

### Markets and offchain data

A valid launch may have zero, one, or several markets. Discovery does not imply that price, volume, charting, quoting,
simulation, or execution is supported. Offchain and hybrid markets must disclose their settlement mode and data source;
self-reported data is not onchain-verified data. Transfers must not be classified as trades without market-specific
evidence.

### Transaction safety

Launch-feed records, metadata, capabilities, extensions, examples, and project-owned URLs are read-only integration
data. They are not executable transaction payloads. This repository does not authorize a wallet signature, approval,
swap, deposit, claim, or other value-moving action.

Never copy an arbitrary `to`, calldata, spender, approval, or value from metadata or an extension into a wallet request.
An execution integration must independently verify the chain, registered adapter and runtime hash, decode the action,
enforce a deadline and slippage or output bounds, limit allowances, simulate against fresh state, and show the decoded
intent before signature. Unsupported markets must remain discovery-only.

## Security claims

Passing schemas, conformance tests, automated review, source verification, or registry inclusion is not an independent
audit, an investment recommendation, a guarantee of liquidity or price accuracy, an endorsement by Uniswap, or a
guarantee that a project cannot fail or cause loss. Security statements must identify the exact source, deployment,
configuration, evidence, and lifecycle state they describe.

## Repository and workflow safety

Pull-request workflows run with read-only repository permissions, receive no production secrets, install dependencies
with lifecycle scripts disabled, and must not use `pull_request_target` to execute contributor code. Scheduled live
checks are read-only and run only in the canonical repository. Release and branch-protection controls are maintained in
GitHub in addition to the files in this repository.
