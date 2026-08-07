# Programmable Verified

`Programmable Verified` is a review and deployment-binding state. It is separate from the `Programmable Classic` or `Programmable Custom` origin label.

## Definition

> Reviewed against the published Programmable security policy and cryptographically bound to the exact deployed contract revision.

This definition does not mean guaranteed safe, risk-free, unruggable, independently audited, liquid, correctly priced, or supported for trading. An external audit is disclosed only when the record identifies the auditor, report, exact scope, version, and deployment relationship.

## Independent trust axes

Do not collapse these states into `safe: true`:

| Axis | Question it answers |
| --- | --- |
| Origin | Did the launch come from an enabled Classic launcher or the canonical Custom Registry? |
| Review | Was an exact source revision reviewed under a published policy? |
| Source binding | Which repository, commit, paths, and source commitment were reviewed? |
| Build binding | Which reproducible build procedure and build commitment produced the artifacts? |
| Artifact binding | Which creation bytecode, ABI, metadata, and configuration hashes were approved? |
| Runtime binding | Does deployed runtime bytecode match the approved artifact on this chain and address? |
| Deployment binding | Do launch wallet, transaction, block, log, chain, and initialization match the approval? |
| Finality | Is the evidence observed, confirmed, finalized, or orphaned? |
| Authorities | Who can upgrade, pause, mint, seize, configure fees, withdraw, or change external dependencies? |
| Dependencies | Which oracles, bridges, routers, offchain services, or external contracts affect behavior? |
| Market support | Are discovery, charting, quote, simulation, and execution supported separately? |
| Fee verification | Are rate, basis, currency, recipients, accrual, and claim paths evidenced? |
| Metadata trust | Which names, descriptions, images, and links are creator-supplied? |
| Effective status | Has the review been superseded or revoked? |

Origin can be verified while a review is absent. A review can exist before launch while deployment binding is still pending. Runtime matching does not prove current oracle health, liquidity, economic value, or the safety of an unrelated market.

## Required review record

A public review record must identify:

- policy version and policy commitment;
- repository, immutable commit, reviewed source paths, and source commitment;
- build environment, reproducibility result, and build commitment;
- artifact, constructor, initializer, and configuration commitments plus public `runtimeCodeKeccak256` values encoded as `0x` bytes32; separately published `runtimeCodeSha256` evidence uses the `sha256:` form;
- chain ID, contract addresses, launch wallet, transaction, block, and log coordinates;
- proxy, implementation, upgrade, ownership, role, pause, custody, mint, burn, blocklist, withdrawal, and fee authorities;
- external contracts, routers, oracles, bridges, offchain services, and trust assumptions;
- review scope, findings, dispositions, residual risks, review time, and reviewer type;
- market and fee evidence included in scope;
- deployment-match result and finality;
- superseding record, correction, and revocation state; and
- exact external audit evidence when an independent audit claim is made.

Missing evidence stays missing. Do not substitute a repository URL for a commit, a verified explorer page for a reproducible build, or matching source for matching runtime and configuration.

## Approval is not launch

Approval binds a proposed release. It does not make a public launch record.

The launch becomes eligible only after the user deploys the approved revision through the authorized path and the system verifies the resulting chain, contracts, runtime code, initialization, configuration, wallet, transaction, and registry evidence. A changed commit, artifact, bytecode, template, chain, configuration, authority, or launch wallet does not inherit the earlier result.

For proxies, verify the proxy runtime, implementation runtime, initialized implementation address, admin or upgrade authority, and any mechanism that can change them. Re-check the effective review state after an upgrade.

## Findings and lifecycle

Findings remain structured evidence rather than a single pass/fail marketing claim. Record severity, affected component, status, disposition, and residual condition. A review can be:

- pending;
- passed within stated scope;
- passed with disclosed residual findings;
- failed;
- superseded; or
- revoked.

Revocation removes the active Verified presentation but does not erase the earlier record. A new review or deployment cannot silently overwrite it.

The additive v2 record uses `verifiedReview.status: "verified" | "superseded" | "revoked"`. `deploymentBinding.runtimeMatch: "exact"` is the exact-runtime state, while `verification.approvalMatch` and `verification.runtimeMatch` use `matched`, `mismatch`, `unavailable`, or `revoked`. `finalityEvidence.status` remains a separate `observed`, `confirmed`, `finalized`, or `orphaned` state.

Show the Verified presentation only when the review is `verified`, the deployment runtime binding is `exact`, approval and runtime verification are `matched`, the evidence applies to the displayed chain and addresses, and no effective supersession or revocation exists. A mismatch, unavailable binding, or orphaned deployment fails closed for the badge without erasing the origin record.

## Integrator display

Display origin and review separately:

```text
Programmable Custom
Programmable Verified · policy <version> · deployed revision matched
Finality: confirmed
Upgrade authority: disclosed
External dependencies: 2
```

When the structured review record is absent or incomplete, omit the Verified badge and show the available provenance and finality instead. Do not infer Verified from `category`, registry inclusion, a GitHub approval, schema validation, or a successful simulation.

## Current status

The public v2 Custom Registry is live and its project-only genesis canary proves the finalized lifecycle. Provider catalogs and draft fixtures are still not approval records: every future live Custom record must carry its own exact source, runtime, review, fee, and finality bindings.

See [Direct onchain verification](../reference/onchain-verification.md), [Security policy](../../SECURITY.md), and [Platform fees](../reference/fees.md).
