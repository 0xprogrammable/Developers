# Support

The Programmable Developer Platform is supported in public through this GitHub repository. GitHub Issues are for integration support only; legacy Registry and GitHub launch submission intake are closed.

For Custom Launch API availability, check [`https://api.programmable.market/readyz`](https://api.programmable.market/readyz). The authenticated API and its readiness endpoint are separate from this unauthenticated read API.

## Ask a question or report a problem

Use [GitHub Issues](https://github.com/programmablehq/Developers/issues) for:

- integration questions;
- documentation corrections;
- API, schema, fixture, or conformance problems;
- reproducible data discrepancies;
- feature requests.

Search existing issues before opening a new one. Include enough information to reproduce the problem:

- the repository release, commit, API version, or schema version;
- the chain ID and relevant contract addresses;
- the endpoint, request, or fixture involved;
- the error `requestId`, numeric HTTP `status`, and ISO `timestamp`;
- the expected and observed result;
- transaction hashes, block numbers, and log indexes when relevant;
- a minimal code sample with all secrets removed.

Do not post private keys, seed phrases, API keys, access tokens, Authorization headers, personal data, or other credentials. Redact the complete credential value rather than masking only part of it.

## Report a security issue

Do not disclose suspected vulnerabilities in a public issue. Read [SECURITY.md](SECURITY.md) and use the repository's **Security** tab to submit a private vulnerability report when that option is available.

If private reporting is temporarily unavailable, open a public issue containing only a request for a private security contact. Do not include vulnerability details in that issue.

## Scope

This repository covers Programmable's public integration specifications, data surfaces, examples, and conformance tooling. It does not provide trading, investment, legal, tax, custody, or token-project support.

Documentation in this repository does not mean that a third-party terminal, wallet, explorer, scanner, or data provider has integrated or endorsed Programmable. Verified integrations must be supported by public evidence from the relevant provider.

Support is provided on a best-effort basis. No response time, implementation date, listing, or integration outcome is guaranteed.
