# Chain 4663 Vercel release control

Robinhood Chain publication is a two-phase release. A finalized chain deployment is necessary, but
it is not public-write authority. The workflow never treats a successful build, dark deployment,
postdeployment bundle, indexer deployment, HTTP response, or Vercel API call as permission to
change either formal production domain: `developers.programmable.market` or
`developers.programmable.family`.

The normal workflow entry point is the protected `Vercel release control` manual workflow on
`programmablehq/Developers` `refs/heads/main`. A separate protected `Vercel release recovery`
manual workflow can only complete or verify one immutable intent artifact from an interrupted
normal run; it cannot stage or create a candidate. Pull requests and pushes cannot stage, promote,
roll back, or recover. Repository-owned `vercel.json` sets `git.deploymentEnabled:false`, so merging either
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
workflow resolves `developers.programmable.market` through the configured Vercel project, verifies
those source bindings, requires both formal domains on the same production deployment, and queries
the Vercel alias records for both formal domains. Each record must bind the same exact deployment
and project with no redirect or deletion. The workflow checks both production origins in
`planned` mode without a protection bypass, requires equal chain-4663 manifest digests, then repeats
the provider capture and requires the deployment ID to remain unchanged. The resulting readback
artifact proves only the planned/null public contract:
no public submissions, unavailable empty Robinhood feeds, null deployment roots, and
`publicWrites:false`. It grants no Phase-A, Phase-B, deployment, alias, or write authority.

`operation: deploy-planned` is the owner-authorized docs/planned publication path. It accepts no
deployment ID, URL, phase bundle, prior run, caller-supplied protection bypass, provider
configuration, or onchain input. It is an external Vercel deployment and alias mutation even though
the Robinhood contract remains `publicWrites:false`. The safe dispatch input is exactly:

```text
operation: deploy-planned
stage_run_id: <blank>
previous_promotion_run_id: <blank>
promotion_run_id: <blank>
```

The job checks the exact current protected `main` revision and tree, clears both phase selectors,
requires both canonical phase files to be absent, and repeats the locked build and repository
checks. It then builds Vercel production bytes from that checkout and creates one production-target
candidate with `--skip-domain` and only the three planned source metadata fields above. Before that
first provider mutation, the job freshly reads the current GitHub `workflow_dispatch` run and
`production` environment and seals the exact canonical owner, run, attempt, source revision/tree,
environment id `19441858925`, protected-main-only branch policy, and disabled administrator bypass.
Any provider response with `can_admins_bypass:true`, a different environment id, or a broader branch
policy therefore stops the job before candidate creation.

Both `developers.programmable.market` and `developers.programmable.family` are verified Production
Domains of the same locked Vercel project. Provider capture always selects
`developers.programmable.market`, re-reads the selected deployment by immutable provider ID, requires
that deployment record to list `developers.programmable.market`, and obtains the project's domain
inventory. The inventory must list both formal domains exactly once as verified Production Domains,
with `gitBranch:null` and `customEnvironmentId:null`. Vercel's deployment record does not currently
list `.family`, so `.family` is instead resolved directly and must select the same immutable
deployment. Separate `/v4/aliases` queries must bind both `developers.programmable.market` and
`developers.programmable.family` to that exact deployment ID and project ID with `redirect:null`
and `deletedAt:null`. Only after both alias queries does capture re-resolve `.market`, closing the
evidence window against concurrent drift. The aggregate
binding seals the generated `.vercel.app` origin, organization, project, both domain proofs, and
observation times under canonical digests. Candidate captures by ID receive none of this
production-domain authority and must still prove that they carry neither formal production domain.

The generated candidate may retain Vercel-generated preview aliases, but it must carry neither
formal production domain and must remain protected. Provider inspection must prove an
unauthenticated 302/303/307/308 redirect to the canonical Vercel authentication service and the
project setting `prod_deployment_urls_and_all_previews`. Only the candidate smoke step receives the
dedicated scoped `VERCEL_AUTOMATION_BYPASS_SECRET`, and it uses `--protection-bypass true` against the
provider-verified, credential-free `.vercel.app` origin. The provider inspection never receives that
secret, the secret is never written to evidence, and the workflow never weakens or changes project
protection. The public `developers.programmable.family` origin is always smoked with
`--protection-bypass false`.

Immediately before alias mutation, the workflow rechecks protected `main`, provider-requeries the
same source-bound candidate without formal production domains and its protection, repeats the authenticated candidate smoke,
and requires the current public deployment ID to remain the one captured before candidate creation.
Before this final boundary it seals and uploads an immutable
`programmable.developers.vercel-public-mutation-intent.v1` artifact that binds the exact old and
target deployment IDs, complete two-domain production binding, source, project, owner authorization, candidate
protection, and smoke. In the same shell step as `vercel promote`, it then freshly reads and validates
the raw GitHub run and production environment again, freshly resolves both formal production domains,
re-queries the target and protection, repeats the smoke, and enforces the five-minute chronology. The
second authorization binds the exact current source, current public deployment, candidate,
protection evidence, and planned smoke. Only that authorization-bound candidate ID is passed to
`vercel promote`. A durable planned-readiness object binds the final candidate protection and smoke,
fresh authorization, post-authorization two-domain production binding, immutable intent, and
confirmation time. That same provider capture also reads the protected project after authorization,
requires Rolling Releases to be disabled, and rejects any `lastAliasRequest` whose state is
`pending` or `in-progress`; any `succeeded` request must target the same deployment that the fresh
production binding returned. Its timestamp and digest are sealed into readiness before the CLI call.
The planned receipt binds that readiness digest. Both formal production domains must then bind the
exact candidate, while the public `.family` origin must pass the planned smoke without bypass with
the same manifest digest as the immutable candidate. A repeated provider and alias capture must
still select that ID after the smoke. The previous public deployment and all
candidate/public readbacks plus a `programmable.developers.vercel-planned-deploy-receipt.v1` are
retained as evidence for manual recovery. This path publishes
read-only docs and planned/null API state only; it cannot activate Robinhood, enable submissions,
introduce deployment roots, configure an indexer, or inherit Phase-A/Phase-B authority.

New planned-deploy authorizations emit schema v2 and seal the aggregate two-domain production
binding. Read-only inspection remains compatible with both historical v1 layouts: the earlier layout
that bound the then-public `.family` alias directly, and the later layout that added a
`currentPublicResolution`. Their original exact field sets, family-alias rule, and v1 digest namespace
remain unchanged; neither legacy reader can emit or authorize a new v1 artifact.

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
The workflow reads the environment back from GitHub before every `deploy-planned` Vercel mutation
and immediately before promotion, rollback, or a recovery boundary. The raw provider readback and
canonical production-origin resolution occur again inside the same shell step as every public
routing mutation. It rejects any other id, branch policy, admin-bypass
state, or an invented required-reviewer gate.

`production` must make `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and
`VERCEL_AUTOMATION_BYPASS_SECRET` available as environment secrets. There are no required
environment variables. The Vercel token must belong to the pinned organization/project, and the
bypass value must be the dedicated `automation-bypass` entry that the provider proof observes;
neither value may appear in an artifact, command argument, or committed file.
The combined final-boundary steps copy the GitHub token, Vercel token, and bypass secret into
non-exported shell variables and immediately unset their exported aliases. Each credential is then
scoped only to the command that needs it: GitHub bearer headers, Vercel provider/CLI calls, or the
protected candidate smoke respectively.

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
must have neither formal production domain, must be protected by Vercel Authentication, and pass the
exact chain-4663 smoke through the scoped
automation bypass. Immediately before sealing the receipt, the workflow independently resolves the
two-domain production binding through Vercel and requires it to select a different immutable deployment.
The creation-time deployment `alias` array remains descriptive metadata only; it is never accepted
as proof that the stage is or is not public. The sealed stage receipt binds that production binding
and continues to carry `publicAuthorization:false` and `publicWrites:false`. Do not copy or overwrite
the stage bundle at the promotion path. New stage receipts emit schema v3 and reject either formal
production domain on the staged deployment while binding the current two-domain production state.
The reader retains the exact v1 and v2 field sets for digest-valid historical receipts,
which predate the `.market` domain becoming a formal production domain and therefore rejected only
the public `.family` domain in v1; no legacy schema is reinterpreted or emitted.

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
chain-4663 smoke. The promotion plan is still non-authorizing. New promotion and rollback plans emit
schema v3, reject both formal production domains on their staged target, bind the two-domain
production state, and cryptographically bind the exact prior receipt/run/archive lineage. Their
readers preserve the original exact v1 and v2 layouts solely for digest-valid historical evidence.

The alias mutation runs only in the protected `production` environment after the current manual run
is read back as an exact canonical-owner `workflow_dispatch`. Both the prepared plan and owner
dispatch observation expire after 30 minutes.
The authorization receipt binds the canonical owner, workflow run and attempt, exact source commit/tree,
Phase-A stage digest, Phase-B promotion digest, Indexer evidence, Vercel project/environment,
selected deployment, current deployment, and build digest. Immediately before mutation, the
workflow re-queries both Vercel deployments, re-proves generated-URL protection, and repeats the
protected stage smoke. That fresh smoke and protection proof are sealed into the pre-mutation
state together with a fresh production binding proving that both formal domains still select the
approved current deployment and not the target. The smoke and binding must be no more than five
minutes older than the sealed promotion receipt.

Before `vercel promote`, the normal run also uploads its exact plan, authorization, pre-mutation
state, target evidence, bundle, and `programmable.developers.vercel-public-mutation-intent.v1` as an
immutable Actions artifact. The final mutation step does not trust those timestamps alone: it
re-reads raw `workflow_dispatch` and `production` environment state, resolves both production domains,
re-queries target protection, repeats target smoke, creates a new authorization and pre-mutation
state, and validates their old/target identities and chronology against the immutable intent before
the CLI is invoked. It also seals the complete final authorization, pre-mutation state,
post-authorization production binding, and confirmation time as
`programmable.developers.vercel-public-mutation-readiness.v1`; the promotion receipt binds both that
readiness digest and the immutable intent digest. The post-authorization provider capture also
requires Rolling Releases to be disabled and no pending or in-progress `lastAliasRequest`; the
provider mutation-control object is timestamped, digested, and bound into readiness. A succeeded
last request must resolve to the same public deployment regardless of when it was requested.

After `vercel promote`, both formal production domains must bind the selected deployment and the
public `.family` origin must pass the same chain-4663 smoke without a protection bypass. Its manifest
must equal the exact immutable selected-deployment smoke. The workflow then repeats the full provider
capture and seals the post-smoke production binding into the v3 promotion receipt. Rollback uses the
same ordering and seals the same evidence in its v3 terminal receipt. New promotion receipts also
bind their immutable intent/readiness digests and exact previous production lineage. The parsers
retain the exact historical v1 and v2 field sets, but all new terminal evidence is v3. A successful alias change without
that receipt, alias binding, and smoke is not a completed release.

## Owner-authorized rollback

Rollback is another protected manual operation, not an automatic fallback. Its plan binds the exact
current promotion receipt and artifact, current deployment, prior deployment, prior mode, and prior
promotion bundle when the target was live. The exact owner dispatch grants one fresh
mutation only. The workflow re-queries current and target deployments, re-proves protection and
smokes the exact target, seals both observations plus the current production binding into the
pre-mutation state, durably uploads the immutable rollback intent, then repeats the raw owner,
environment, two-domain production, target-protection, and target-smoke reads in the same shell step as the
mutation. It promotes that target deployment only after the immediate readiness validator succeeds,
and smokes the public origin again without
bypass. The rollback receipt then binds a fresh post-smoke two-domain production binding to the exact
restored deployment together with the immutable intent and final mutation-readiness digests. No
rollback decision interprets a deployment record's alias array as current routing authority.

A rollback to the planned release must restore the planned/null chain-4663 behavior: unavailable
feeds, zero public items, no public submissions, and no live metadata. A rollback to an older live
release must use that release's own immutable Phase-B bundle. Evidence from the failed release is
never reinterpreted as authority for the rollback target.

## Recovery-only completion

The `Vercel release recovery` workflow accepts only `deploy-planned`, `promote`, or `rollback`, plus
the exact normal run ID and attempt that uploaded
`developers-vercel-mutation-intent-<run>-<attempt>`. It downloads that exact immutable artifact,
authenticates the interrupted canonical producer run/attempt and the unique, unexpired artifact
metadata, downloads the raw Actions ZIP by its unique artifact ID, verifies the ZIP SHA-256 against
GitHub's artifact digest, and requires its exact `public-mutation-intent.json` bytes to match the
canonical intent. That provenance binds the exact intent digest, requires the embedded workflow run and
attempt to match the dispatch, and recreates the intent from all
of its authorization, plan, pre-mutation, bundle, protection, and smoke inputs, and requires a
byte-identical result. A valid intent from another operation, target, or artifact therefore cannot
be substituted.

Recovery first reads the complete two-domain production binding and classifies its deployment against the intent as exactly
`old`, exactly `target`, or a third state. It re-queries the exact target, protection, and smoke and
freshly validates the raw recovery `workflow_dispatch`, protected `main`, canonical owner, production
environment id, protected-branches-only policy, and `can_admins_bypass:false`. It then uploads an
immutable `programmable.developers.vercel-public-mutation-recovery-attempt.v1` artifact before any
possible routing mutation. At the final boundary it queries that exact recovery-run artifact,
verifies its unique ID, provider digest, raw ZIP digest, exact `recovery-attempt.json` bytes, and
provider creation/update/expiry timestamps, then binds
`programmable.developers.vercel-public-mutation-recovery-attempt-provenance.v1` into final readiness.
At the final boundary, the workflow repeats every provider and owner
read. It re-proves target protection and target smoke, freshly authorizes the raw recovery run and
environment, and only then resolves both formal production domains again. The readiness contract binds
that post-authorization production binding, the same post-authorization project query proving Rolling
Releases disabled and no pending or in-progress `lastAliasRequest`; any succeeded request must target
the same deployment as the production binding. It enforces the complete five-minute
chronology, seals
`programmable.developers.vercel-public-mutation-recovery-readiness.v1`, and applies this closed state
machine:

```text
exact old state    -> one exact-target `vercel promote`, then verified receipt
exact target state -> no Vercel mutation, only verified completion and receipt
any third state    -> hard stop
```

Within one recovery execution, an `old` classification permits at most one exact-target CLI
mutation and a `target` classification permits none; every rerun reclassifies from a fresh provider
production binding. This workflow-local guarantee is not a global exactly-once or ABA guarantee and
is not an atomic Vercel compare-and-swap: a write by another Vercel actor after the
last resolution and before the CLI call cannot be excluded by repository code. The shared workflow
concurrency group prevents sibling release jobs, while external Vercel writes remain an explicit
operator boundary. Target-to-old reversal, old-to-third drift, evidence older than five minutes,
reversed chronology, a substituted artifact, or an unprotected/foreign owner run stops closed.
Recovery never deploys a replacement candidate, guesses an alias, or intentionally mutates a
classified third state. It does not use an unauthenticated local marker as a retry lock; durable,
content-bound intent and attempt artifacts are the recovery authority. Recovered planned publication yields the same planned
receipt contract; recovered rollback yields a dedicated recovery receipt; recovered promotion
yields `programmable.developers.vercel-recovered-promotion-receipt.v1` under the canonical
`developers-vercel-promotion-<recovery-run>-<attempt>` artifact name, so a later rollback can select
and validate it exactly like a normal promotion artifact while preserving the distinct recovery
source identity. Every recovered planned, promotion, and rollback receipt embeds its exact intent,
authenticated attempt, final readiness, and full production smoke. Their parsers revalidate that
lineage, owner authorization, old/target classification, post-smoke production binding, exact target
manifest, smoke, and five-minute readiness-to-seal chronology rather than accepting digest-shaped
fields alone.
The next normal promotion and rollback paths accept either the canonical release workflow or the
canonical recovery workflow as the producer of a prior promotion artifact, and bind the exact run,
attempt, actor, source revision/tree, workflow reference, receipt, and artifact before continuing.
Rollback preparation also downloads the raw promotion artifact by its provider ID, verifies its ZIP
digest against GitHub metadata, and binds the exact `promotion-receipt.json` bytes into the rollback
plan, which embeds and independently reparses that receipt.

## Operator boundary

The workflow does not create upstream deployment evidence, configure GitHub branch protection or
environments, deploy the backend or indexer, change Vercel project settings, push commits, or forge
an owner dispatch. Those are separate owner/control-plane actions. Missing protected provenance,
backend readiness, Fly receipt, indexer evidence, stage protection, exact owner-dispatch evidence,
or smoke evidence stops the transition closed.
