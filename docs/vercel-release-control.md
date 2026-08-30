# Chain 4663 Vercel release control

Robinhood Chain publication is a two-phase release. A finalized chain deployment is necessary, but
it is not public-write authority. The workflow never treats a successful build, dark deployment,
postdeployment bundle, indexer deployment, HTTP response, or Vercel API call as permission to
change `developers.programmable.family`.

The only workflow entry point is the protected `Vercel release control` manual workflow on
`programmablehq/Developers` `refs/heads/main`. Pull requests and pushes cannot stage, promote, or
roll back. Repository-owned `vercel.json` sets `git.deploymentEnabled:false`, so merging either
evidence phase cannot cause Vercel for Git to build or alias the commit outside this control plane.
All Vercel mutations use the repository-locked CLI version and the configured project;
no workflow accepts a caller-selected project, scope, evidence path, artifact name, or deployment
URL.

## Planned/docs source readback

`operation: verify-planned` is the non-mutating path for a docs or planned/null release. It locally
builds and checks the exact current protected `main`, but it never creates a Vercel deployment,
changes an alias, enables a write route, or selects a Robinhood stage or promotion bundle. The
canonical stage and promotion files must both remain absent.

The operation runs only after an intentionally selected public deployment already exists. That
deployment must bind the exact protected source using these Vercel metadata fields:

```text
programmableSourceRevision=<exact protected main commit>
programmableSourceTree=<exact protected main tree>
programmableReleaseMode=planned
```

It must not carry `programmableStageBundleDigest` or `programmablePromotionBundleDigest`. The
workflow resolves `developers.programmable.family` through the configured Vercel project, verifies
those source bindings, checks the public chain-4663 manifest, status, launch feed, and token list in
`planned` mode without a protection bypass, then re-queries the alias and requires the deployment ID
to remain unchanged. The resulting readback artifact proves only the planned/null public contract:
no public submissions, unavailable empty Robinhood feeds, null deployment roots, and
`publicWrites:false`. It grants no Phase-A, Phase-B, deployment, alias, or write authority.

`operation: deploy-planned` is the owner-authorized docs/planned publication path. It accepts no
deployment ID, URL, phase bundle, prior run, protection bypass, provider configuration, or onchain
input. The safe dispatch input is exactly:

```text
operation: deploy-planned
stage_run_id: <blank>
previous_promotion_run_id: <blank>
promotion_run_id: <blank>
```

The job checks the exact current protected `main` revision and tree, clears both phase selectors,
requires both canonical phase files to be absent, and repeats the locked build and repository
checks. It then builds Vercel production bytes from that checkout and creates one production-target
candidate with `--skip-domain` and only the three planned source metadata fields above. The generated
candidate must remain unaliased and pass the full chain-4663 planned smoke directly, without a
protection bypass. A protected or otherwise unreadable candidate fails before any alias mutation;
the workflow does not alter Vercel protection or other provider configuration to make it pass.

Immediately before mutation, the workflow rechecks protected `main` and provider-requeries the same
source-bound, unaliased candidate. It also requires the current public deployment ID to remain the
same one captured before candidate creation. Only the checked candidate ID is passed to
`vercel promote`. The public
origin must then resolve to the same ID, pass the same planned smoke without bypass, and still resolve
to that ID after the smoke. The previous public deployment and all candidate/public readbacks are
retained as evidence for manual recovery. This path publishes read-only docs and planned/null API
state only; it cannot activate Robinhood, enable submissions, introduce deployment roots, configure
an indexer, or inherit Phase-A/Phase-B authority.

The release toolchain pins `vercel@59.10.0` as a development dependency and invokes only that
checked-in lockfile resolution through `node_modules/.bin/vercel`. The package overrides are limited
to remediated versions inside that exact Vercel distribution, including builder adapters shipped by
the CLI even when this repository does not select those frameworks. They close the full audited
transitive closure rather than silently accepting an advisory in a release runner; `npm ci`, a
zero-finding `npm audit`, the exact CLI version check, and the workflow contract tests are mandatory
before provider access. The eventual dark-stage provider query and chain-4663 smoke remain runtime
evidence and are never inferred from those local checks.

## Required GitHub environment and owner identity

Read-only repository governance has exactly one established release owner: CODEOWNERS names
`@hazarxyz` (GitHub account id `258789013`) for every path. There is no established distinct release reviewer or
release-review team. The workflow therefore does not invent an impossible
second-party approval. The tradeoff is explicit: this is a single-owner control plane, so the
authenticated manual dispatch is the owner authorization; it is not an independent four-eyes
review.

The existing `production` environment (GitHub environment id `19441858925`) is the only environment
used by the release jobs. Before the workflow is usable, an owner must configure it for
protected branches only, with custom branch policies off and administrator bypass disabled. It must not add a
required-reviewer rule unless repository governance first establishes a distinct canonical reviewer.
The workflow reads the environment back from GitHub immediately before promotion or rollback and
rejects any other id, branch policy, admin-bypass state, or an invented required-reviewer gate.

`production` must make `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and
`VERCEL_AUTOMATION_BYPASS_SECRET` available as environment secrets. There are no required
environment variables. The Vercel token must belong to the pinned organization/project, and the
bypass value must be the dedicated `automation-bypass` entry that the provider proof observes;
neither value may appear in an artifact, command argument, or committed file.

Every job pins both the original workflow actor and any re-run triggering actor to
`@hazarxyz`/`258789013`. The authorization step reads back the current `workflow_dispatch` run and
requires that same owner identity, run and attempt, protected `main` source revision/tree, and the
current production-environment configuration. A collaborator cannot dispatch or re-run a release.
Until the environment policy and secrets are configured, the workflow stops before a Vercel
mutation.

## Phase A: protected dark stage

The source commit for `operation: stage` must contain the canonical, non-symlinked Git file:

```text
release/robinhood-chain-4663/programmable-stage-bundle.json
```

This immutable Phase-A bundle must be the closed PROGRAMMABLE postdeployment result. It binds the
chain, source, finality, capture, and backend asset handoff while retaining all of these release
boundaries:

```text
state: closed-awaiting-backend-readiness
releaseReady: false
publicAuthorization: false
publicWrites: false
```

Phase A can create one production-target Vercel deployment only with `--skip-domain`. The deployment
must have no production alias, must be protected by Vercel Authentication, and must pass the exact
chain-4663 smoke through the scoped automation bypass. The sealed stage receipt continues to carry
`publicAuthorization:false` and `publicWrites:false`. Do not copy or overwrite the stage bundle at
the promotion path.

## Phase B: reviewed evidence-only commit

After the backend is live and independently ready and the indexer provider deployment has passed its
audit, a separate signed, protected pull request adds exactly four files to the staged source tree:

```text
release/robinhood-chain-4663/programmable-promotion-bundle.json
docs/operations/releases/robinhood-chain-4663/robinhood-mainnet-indexer-release-identity.json
docs/operations/releases/robinhood-chain-4663/robinhood-mainnet-indexer-deployment-receipt.json
docs/operations/releases/robinhood-chain-4663/robinhood-mainnet-indexer-release-audit.json
```

The first file is the only accepted PROGRAMMABLE Phase-B closure. It must bind the canonical
`programmablehq/PROGRAMMABLE` protected production revision and tree, its signed/attested producer
provenance, backend runtime readiness, and the separate Fly control-plane receipt. A standalone
backend JSON file, workflow input, downloaded caller-selected artifact, untracked copy, symlink, or
environment value cannot satisfy promotion.

The other three files are exact tracked copies of the protected Indexer evidence. Their producer,
run, attempt, artifact, source revision/tree, deployment receipt, and audit digests are cross-bound.
The transfer is byte preserving: Indexer artifact-root `release-identity.json` maps to the tracked
release-identity path above, `provider-deployment.json` maps to the tracked deployment-receipt path,
and `release-audit.json` maps to the tracked release-audit path. Renaming a destination does not
permit reserialization or a schema rename. The audit must carry the native protected-production run
proof, the separately owner-verified exact branch-protection snapshot, a fresh bounded evidence
window, and a protected publication timestamp no more than 24 hours after the audit. The Indexer
audit remains `publicAuthorization:false`; it does not grant Developers authority.

Before creating that signed evidence-only Developers pull request, the owner separately verifies the
Indexer artifact ZIP digest and all three GitHub artifact attestations against the exact producer
repository, production ref, source digest, publisher workflow, and GitHub-hosted runner provenance.
That authenticated import check is a separate evidence axis: the Developers workflow binds only the
reviewed tracked bytes, Git blobs, protected producer preimage, and signed four-file source
transition, and does not claim that its repository-scoped token reverified cross-repository private
attestation data.

The workflow proves that the Phase-B commit descends from the staged commit, the diff adds only
those four paths, and a clean Vercel rebuild has the same byte digest as the dark stage. Any source,
configuration, dependency, or output change requires a new Phase-A stage.

## Owner-authorized promote

`operation: promote` first revalidates the tracked Phase-B bundle and Indexer evidence, the selected
stage workflow/artifact, the current public deployment, the protected staged deployment, and a fresh
chain-4663 smoke. The promotion plan is still non-authorizing.

The alias mutation runs only in the protected `production` environment after the current manual run
is read back as an exact canonical-owner `workflow_dispatch`. Both the prepared plan and owner
dispatch observation expire after 30 minutes.
The authorization receipt binds the canonical owner, workflow run and attempt, exact source commit/tree,
Phase-A stage digest, Phase-B promotion digest, Indexer evidence, Vercel project/environment,
selected deployment, current deployment, and build digest. Immediately before mutation, the
workflow re-queries both Vercel deployments, re-proves generated-URL protection, and repeats the
protected stage smoke. That fresh smoke and protection proof are sealed into the pre-mutation
state; the smoke must be no more than five minutes older than the sealed promotion receipt.

After `vercel promote`, the public origin must pass the same chain-4663 smoke without a protection
bypass. A successful alias change without that receipt and smoke is not a completed release.

## Owner-authorized rollback

Rollback is another protected manual operation, not an automatic fallback. Its plan binds the exact
current promotion receipt and artifact, current deployment, prior deployment, prior mode, and prior
promotion bundle when the target was live. The exact owner dispatch grants one fresh
mutation only. The workflow re-queries current and target deployments, re-proves protection and
smokes the exact target, seals both observations into the pre-mutation state, promotes that target
deployment, and smokes the public origin again without bypass.

A rollback to the planned release must restore the planned/null chain-4663 behavior: unavailable
feeds, zero public items, no public submissions, and no live metadata. A rollback to an older live
release must use that release's own immutable Phase-B bundle. Evidence from the failed release is
never reinterpreted as authority for the rollback target.

## Operator boundary

The workflow does not create upstream deployment evidence, configure GitHub branch protection or
environments, deploy the backend or indexer, change Vercel project settings, push commits, or forge
an owner dispatch. Those are separate owner/control-plane actions. Missing protected provenance,
backend readiness, Fly receipt, indexer evidence, stage protection, exact owner-dispatch evidence,
or smoke evidence stops the transition closed.
