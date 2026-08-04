# Contributing

Thank you for helping improve the Programmable Developer Platform. Contributions may cover documentation, schemas, examples, fixtures, conformance tests, or corrections to published integration behavior.

## Before you start

Search the documentation and existing issues before opening a new issue. For a small correction, you can open a pull request directly. Open an issue first when a change would:

- alter the meaning of a published field;
- add or change an identifier, unit, status, or lifecycle rule;
- affect finality, reorg handling, pagination, or ordering;
- introduce a new integration surface;
- require a breaking change.

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md) and use the repository's private security reporting route.

## Make a change

1. Fork the repository and create a focused branch from `main`.
2. Keep the change limited to one clear purpose.
3. Update documentation, machine-readable definitions, fixtures, and tests together when they describe the same behavior.
4. Run the checks documented in the repository and record the results in the pull request.
5. Explain the user-facing effect and any compatibility considerations.

Clear commit messages are preferred. A pull request should be understandable without relying on private discussions.

## Compatibility checklist

Version 1 changes must follow [VERSIONING.md](VERSIONING.md). Before submitting a schema or API change, confirm that it:

- does not remove or rename a published field;
- does not change a field's type, unit, meaning, or nullability;
- does not make an optional field required;
- treats new fields and capabilities as additive;
- preserves existing identifier and timestamp semantics;
- gives consumers a safe way to handle unknown optional values;
- includes representative fixtures and conformance coverage.

If the change cannot satisfy these rules, propose it for the next major version instead of changing version 1 in place.

## Documentation standards

Write in plain English and use the same term for the same concept throughout the repository. Examples must distinguish live data from illustrative or prelaunch data. Never present a planned deployment, third-party listing, partnership, endorsement, or integration as live without public evidence.

Use chain IDs and contract addresses in technical examples. Do not use a token name or ticker as a unique identifier.

## Sensitive information

Never commit private keys, seed phrases, API keys, access tokens, production credentials, personal data, or unpublished deployment information. Use placeholders and `.env.example` where configuration examples are needed.

## Pull request review

Maintainers review contributions for correctness, compatibility, security, and clarity. A pull request may require changes before it is accepted. Opening a pull request does not guarantee inclusion or a release date.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
