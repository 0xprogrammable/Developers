#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, mkdir, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH,
  CANONICAL_INDEXER_RELEASE_AUDIT_PATH,
  CANONICAL_INDEXER_RELEASE_IDENTITY_PATH,
  CANONICAL_PROMOTION_BUNDLE_PATH,
  CANONICAL_STAGE_BUNDLE_PATH,
  PRODUCTION_ORIGIN,
  assertVercelDeploymentMetadata,
  assertVercelProjectBinding,
  createEvidenceOnlySourceTransition,
  createPlannedDeployAuthorization,
  createPreMutationState,
  createPromotionPlan,
  createPromotionReceipt,
  createPublicAuthorization,
  createRollbackPlan,
  createRollbackReceipt,
  createStageReceipt,
  frozenEthereumV3Identity,
  hashBuildOutput,
  normalizeVercelDeployment,
  parseIndexerPromotionEvidence,
  parsePlannedDeployAuthorization,
  parsePromotionBundle,
  parsePromotionPlan,
  parsePromotionReceipt,
  parsePublicAuthorization,
  parseGitHubArtifactEvidence,
  parseGitHubRunEvidence,
  parseRollbackPlan,
  parseRollbackReceipt,
  parseSmokeReceipt,
  parseStageBundle,
  parseStageReceipt,
  parseStageProtectionEvidence,
  releaseSource,
  releaseTarget,
  releaseWorkflow,
  validateLiveRobinhoodManifest,
  validateGitHubRunEvidence,
  validateGitHubArtifactEvidence,
  validateGitHubOwnerDispatchAuthorization,
  validatePlannedRobinhoodManifest,
} from "./lib/vercel-release.mjs";
import { assertValid, createSchemaRegistry } from "./lib/schema.mjs";
import { assertNoFindings, validateManifestSemantics } from "./lib/semantics.mjs";
import { parseJsonStrict } from "./lib/files.mjs";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const MAX_JSON_BYTES = 32 * 1024 * 1024;

function fail(message) {
  throw new TypeError(message);
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!command || command.startsWith("--")) fail("a release-control command is required");
  const options = new Map();
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      fail(`invalid release-control option near ${flag ?? "<end>"}`);
    }
    if (options.has(flag)) fail(`release-control option ${flag} was repeated`);
    options.set(flag, value);
  }
  return { command, options };
}

function required(options, name) {
  const value = options.get(name);
  if (!value) fail(`${name} is required`);
  return value;
}

function optional(options, name) {
  return options.get(name);
}

function assertOnly(options, allowed) {
  for (const name of options.keys()) {
    if (!allowed.includes(name)) fail(`unsupported release-control option ${name}`);
  }
}

async function readJson(file, label = "JSON input") {
  const absolute = path.resolve(file);
  const metadata = await lstat(absolute);
  if (!metadata.isFile() || metadata.size > MAX_JSON_BYTES) {
    fail(`${label} must be a regular JSON file no larger than ${MAX_JSON_BYTES} bytes`);
  }
  let value;
  try {
    value = parseJsonStrict(await readFile(absolute, "utf8"), label);
  } catch {
    fail(`${label} is not strict JSON`);
  }
  return value;
}

async function writeJson(file, value) {
  const absolute = path.resolve(file);
  await mkdir(path.dirname(absolute), { recursive: true });
  const handle = await open(absolute, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

function checkedOutSource(options) {
  const revision = required(options, "--source-revision");
  const tree = required(options, "--source-tree");
  const head = execFileSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  }).trim();
  const headTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
  }).trim();
  if (revision !== head || tree !== headTree) {
    fail("release source identity differs from the exact checked-out HEAD and tree");
  }
  return releaseSource(revision, tree);
}

function providedSource(options) {
  return releaseSource(
    required(options, "--source-revision"),
    required(options, "--source-tree"),
  );
}

function verifyEvidenceOnlyTransition(stagedSource, promotionSource, buildOutputDigest) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", stagedSource.revision,
      promotionSource.revision], { cwd: REPOSITORY_ROOT, stdio: "ignore" });
  } catch {
    fail("staged source is not an ancestor of the reviewed promotion source");
  }
  const diff = execFileSync("git", [
    "diff", "--name-status", "--no-renames",
    `${stagedSource.revision}..${promotionSource.revision}`,
  ], { cwd: REPOSITORY_ROOT, encoding: "utf8" }).trim();
  const changes = diff === "" ? [] : diff.split("\n").map((line) => {
    const [status, changedPath, ...rest] = line.split("\t");
    if (rest.length > 0 || status !== "A" || !changedPath) {
      fail("promotion source may only add the canonical Phase-B and Indexer evidence files");
    }
    return changedPath;
  });
  const expected = [
    CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH,
    CANONICAL_INDEXER_RELEASE_AUDIT_PATH,
    CANONICAL_INDEXER_RELEASE_IDENTITY_PATH,
    CANONICAL_PROMOTION_BUNDLE_PATH,
  ];
  if (JSON.stringify(changes) !== JSON.stringify(expected)) {
    fail("promotion source must add exactly the Phase-B bundle and three Indexer evidence files");
  }
  return createEvidenceOnlySourceTransition({
    stagedSource,
    promotionSource,
    addedPaths: changes,
    buildOutputDigest,
  });
}

function protectedTarget(options) {
  return releaseTarget(
    required(options, "--org-id"),
    required(options, "--project-id"),
  );
}

function workflowIdentity(options) {
  return releaseWorkflow({
    repository: required(options, "--repository"),
    workflowRef: required(options, "--workflow-ref"),
    runId: required(options, "--run-id"),
    runAttempt: required(options, "--run-attempt"),
    actor: required(options, "--actor"),
    actorId: required(options, "--actor-id"),
  });
}

function workflowFlags() {
  return [
    "--repository", "--workflow-ref", "--run-id", "--run-attempt", "--actor", "--actor-id",
  ];
}

async function validateManifest(manifest) {
  const registry = await createSchemaRegistry("v2");
  assertValid(registry.validator("manifest.schema.json"), manifest,
    "chain-4663 release manifest");
  assertNoFindings(validateManifestSemantics(manifest),
    "chain-4663 release manifest");
}

async function exactTrackedJson(options, flag, expectedPath, label) {
  const repositoryRoot = await realpath(required(options, "--repository-root"));
  if (repositoryRoot !== await realpath(REPOSITORY_ROOT)) {
    fail("--repository-root must identify the checked-out Developers repository");
  }
  const relative = required(options, flag);
  if (relative !== expectedPath) {
    fail(`${flag} must be the canonical tracked path ${expectedPath}`);
  }
  const absolute = path.join(repositoryRoot, ...relative.split("/"));
  const resolved = await realpath(absolute);
  if (resolved !== absolute) fail(`${label} may not be a symlink`);
  const metadata = await lstat(absolute);
  if (!metadata.isFile() || metadata.size > MAX_JSON_BYTES) {
    fail(`${label} must be a regular JSON file no larger than ${MAX_JSON_BYTES} bytes`);
  }
  const bytes = await readFile(absolute);
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", relative], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });
  } catch {
    fail(`${label} must be tracked by the release source commit`);
  }
  const reviewed = execFileSync("git", ["show", `HEAD:${relative}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: MAX_JSON_BYTES,
  });
  if (!bytes.equals(reviewed)) fail(`${label} differs from the checked-out HEAD blob`);
  const gitBlob = execFileSync("git", ["rev-parse", `HEAD:${relative}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  if (!/^[0-9a-f]{40}$/u.test(gitBlob)) fail(`${label} Git blob is invalid`);
  let value;
  try {
    value = parseJsonStrict(bytes.toString("utf8"), label);
  } catch {
    fail(`${label} is not strict JSON`);
  }
  const canonicalBytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (!bytes.equals(canonicalBytes)) fail(`${label} is not canonical pretty JSON`);
  return {
    value,
    artifact: {
      path: relative,
      gitBlob,
      sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    },
  };
}

async function exactTrackedPromotionBundle(options, flag = "--bundle") {
  return (await exactTrackedJson(options, flag, CANONICAL_PROMOTION_BUNDLE_PATH,
    "canonical promotion bundle")).value;
}

async function exactTrackedStageBundle(options, flag = "--bundle") {
  return (await exactTrackedJson(options, flag, CANONICAL_STAGE_BUNDLE_PATH,
    "canonical stage bundle")).value;
}

async function exactTrackedIndexerEvidence(options) {
  const entries = [
    ["releaseIdentity", "--indexer-release-identity",
      CANONICAL_INDEXER_RELEASE_IDENTITY_PATH, "Indexer release identity"],
    ["deploymentReceipt", "--indexer-deployment-receipt",
      CANONICAL_INDEXER_DEPLOYMENT_RECEIPT_PATH, "Indexer deployment receipt"],
    ["releaseAudit", "--indexer-release-audit",
      CANONICAL_INDEXER_RELEASE_AUDIT_PATH, "Indexer release audit"],
  ];
  const values = {};
  const artifacts = {};
  for (const [name, flag, expectedPath, label] of entries) {
    const tracked = await exactTrackedJson(options, flag, expectedPath, label);
    values[name] = tracked.value;
    artifacts[name] = tracked.artifact;
  }
  return { ...values, artifacts };
}

async function validateBundleCommand(options) {
  assertOnly(options, [
    "--phase", "--repository-root", "--bundle", "--manifest", "--ethereum-manifest", "--output",
  ]);
  const phase = required(options, "--phase");
  if (!["stage", "promotion"].includes(phase)) fail("--phase must be stage or promotion");
  const bundle = phase === "stage"
    ? await exactTrackedStageBundle(options)
    : await exactTrackedPromotionBundle(options);
  const manifest = await readJson(required(options, "--manifest"), "Robinhood manifest");
  const ethereum = await readJson(required(options, "--ethereum-manifest"), "Ethereum manifest");
  await validateManifest(manifest);
  const release = phase === "stage" ? parseStageBundle(bundle) : parsePromotionBundle(bundle);
  validateLiveRobinhoodManifest(manifest, release);
  const v3 = frozenEthereumV3Identity(ethereum);
  const summary = {
    state: phase === "stage"
      ? "validated-non-authorizing-stage-input"
      : "validated-ready-promotion-input",
    publicAuthorization: false,
    publicWrites: false,
    chainId: "4663",
    phase,
    bundleDigest: release.bundleDigest,
    chainDeploymentDescriptorDigest: release.descriptorDigest,
    sourceRevision: release.developers.sourceRevision,
    sourceTree: release.developers.sourceTree,
    ethereumV3IdentityDigest: v3.digest,
  };
  await writeJson(required(options, "--output"), summary);
}

async function validatePlannedCommand(options) {
  assertOnly(options, ["--manifest", "--ethereum-manifest", "--output"]);
  const manifest = await readJson(required(options, "--manifest"), "Robinhood manifest");
  const ethereum = await readJson(required(options, "--ethereum-manifest"), "Ethereum manifest");
  await validateManifest(manifest);
  validatePlannedRobinhoodManifest(manifest);
  const v3 = frozenEthereumV3Identity(ethereum);
  await writeJson(required(options, "--output"), {
    state: "validated-planned-non-live",
    publicAuthorization: false,
    publicWrites: false,
    chainId: "4663",
    ethereumV3IdentityDigest: v3.digest,
  });
}

async function normalizedDeployment(options, { requireDeploy = false } = {}) {
  const deployPath = optional(options, "--deploy-json");
  if (requireDeploy && !deployPath) fail("--deploy-json is required");
  return normalizeVercelDeployment({
    ...(deployPath ? { deployOutput: await readJson(deployPath, "Vercel deploy output") } : {}),
    inspectOutput: await readJson(required(options, "--inspect-json"), "Vercel inspect output"),
    apiOutput: await readJson(required(options, "--api-json"), "Vercel deployment API output"),
  });
}

async function normalizeDeploymentCommand(options) {
  assertOnly(options, [
    "--deploy-json", "--inspect-json", "--api-json", "--link-json", "--org-id", "--project-id",
    "--source-revision", "--source-tree", "--stage-bundle-digest", "--output",
  ]);
  const deployment = await normalizedDeployment(options);
  const api = await readJson(required(options, "--api-json"), "Vercel deployment API output");
  const link = await readJson(required(options, "--link-json"), "Vercel project link");
  const target = assertVercelProjectBinding(api, link, protectedTarget(options));
  if (options.has("--source-revision")) {
    assertVercelDeploymentMetadata(api, {
      source: providedSource(options),
      stageBundleDigest: required(options, "--stage-bundle-digest"),
    });
  }
  await writeJson(required(options, "--output"), { target, deployment });
}

async function stageReceiptCommand(options) {
  assertOnly(options, [
    "--repository-root", "--bundle", "--manifest", "--ethereum-manifest", "--deployment",
    "--protection-evidence", "--staged-smoke",
    "--build-root",
    "--source-revision", "--source-tree", "--org-id", "--project-id", "--staged-at", "--output",
    ...workflowFlags(),
  ]);
  const bundle = await exactTrackedStageBundle(options);
  const manifest = await readJson(required(options, "--manifest"), "Robinhood manifest");
  const ethereumManifest = await readJson(
    required(options, "--ethereum-manifest"), "Ethereum manifest",
  );
  await validateManifest(manifest);
  const normalized = await readJson(required(options, "--deployment"),
    "normalized Vercel deployment");
  const build = await hashBuildOutput(required(options, "--build-root"));
  const receipt = createStageReceipt({
    bundle,
    manifest,
    ethereumManifest,
    deployment: normalized.deployment,
    protectionEvidence: await readJson(required(options, "--protection-evidence"),
      "Vercel stage protection evidence"),
    stagedSmoke: await readJson(required(options, "--staged-smoke"),
      "Vercel dark-stage smoke receipt"),
    buildOutputDigest: build.digest,
    source: checkedOutSource(options),
    target: protectedTarget(options),
    workflow: workflowIdentity(options),
    stagedAt: required(options, "--staged-at"),
  });
  await writeJson(required(options, "--output"), receipt);
}

async function validateStageCommand(options) {
  assertOnly(options, [
    "--receipt", "--bundle", "--org-id", "--project-id", "--deployment",
    "--protection-evidence", "--staged-smoke", "--run-evidence", "--artifact-evidence",
    "--output",
  ]);
  const normalized = await readJson(required(options, "--deployment"),
    "provider-requeried staged deployment");
  const runEvidence = parseGitHubRunEvidence(await readJson(
    required(options, "--run-evidence"), "selected stage workflow run evidence",
  ));
  const artifactEvidence = parseGitHubArtifactEvidence(await readJson(
    required(options, "--artifact-evidence"), "selected stage artifact evidence",
  ));
  const freshProtection = parseStageProtectionEvidence(await readJson(
    required(options, "--protection-evidence"), "fresh stage protection evidence",
  ), { deployment: normalized.deployment });
  if (freshProtection.projectProtection.projectId !== required(options, "--project-id")) {
    fail("fresh stage protection evidence differs from the protected Vercel project");
  }
  const receipt = parseStageReceipt(
    await readJson(required(options, "--receipt"), "stage receipt"),
    {
      bundle: await readJson(required(options, "--bundle"), "Phase-A stage bundle"),
      source: releaseSource(runEvidence.sourceRevision, runEvidence.sourceTree),
      target: protectedTarget(options),
      deployment: normalized.deployment,
      workflowRun: {
        repository: runEvidence.repository,
        workflowRef: runEvidence.workflowRef,
        runId: runEvidence.runId,
        runAttempt: runEvidence.runAttempt,
        actor: runEvidence.actor,
        actorId: runEvidence.actorId,
      },
      stagedSmoke: await readJson(required(options, "--staged-smoke"),
        "selected stage dark-stage smoke receipt"),
    },
  );
  if (artifactEvidence.artifactName !==
      `developers-vercel-stage-${runEvidence.runId}-${runEvidence.runAttempt}` ||
    artifactEvidence.runId !== runEvidence.runId ||
    artifactEvidence.runAttempt !== runEvidence.runAttempt ||
    artifactEvidence.sourceRevision !== runEvidence.sourceRevision) {
    fail("selected stage artifact evidence differs from the selected workflow run");
  }
  await writeJson(required(options, "--output"), {
    stageReceiptDigest: receipt.stageReceiptDigest,
    deploymentId: receipt.deployment.id,
    deploymentUrl: receipt.deployment.url,
    stageBundleDigest: receipt.stageBundleDigest,
    source: receipt.source,
    workflow: receipt.workflow,
    artifactEvidence,
    freshProtectionEvidenceDigest: freshProtection.protectionEvidenceDigest,
  });
}

async function validateGitHubRunCommand(options) {
  assertOnly(options, [
    "--file", "--run-id", "--run-attempt", "--source-revision", "--output",
  ]);
  const evidence = validateGitHubRunEvidence(
    await readJson(required(options, "--file"), "GitHub workflow run evidence"),
    {
      runId: required(options, "--run-id"),
      runAttempt: required(options, "--run-attempt"),
      ...(optional(options, "--source-revision")
        ? { sourceRevision: optional(options, "--source-revision") }
        : {}),
    },
  );
  await writeJson(required(options, "--output"), evidence);
}

async function validateGitHubArtifactCommand(options) {
  assertOnly(options, [
    "--file", "--name", "--run-id", "--run-attempt", "--source-revision", "--output",
  ]);
  const evidence = validateGitHubArtifactEvidence(
    await readJson(required(options, "--file"), "GitHub Actions artifact listing"),
    {
      name: required(options, "--name"),
      runId: required(options, "--run-id"),
      runAttempt: required(options, "--run-attempt"),
      sourceRevision: required(options, "--source-revision"),
    },
  );
  await writeJson(required(options, "--output"), evidence);
}

async function promotionPlanCommand(options) {
  assertOnly(options, [
    "--stage-receipt", "--stage-bundle", "--promotion-bundle", "--staged-smoke",
    "--stage-artifact-smoke", "--stage-protection-evidence",
    "--previous-mode", "--previous-bundle",
    "--previous-smoke", "--previous-deployment", "--previous-promotion-receipt",
    "--previous-promotion-artifact-evidence", "--source-revision", "--source-tree",
    "--stage-run-evidence", "--stage-artifact-evidence", "--staged-deployment", "--build-root",
    "--repository-root", "--indexer-release-identity", "--indexer-deployment-receipt",
    "--indexer-release-audit", "--org-id", "--project-id", "--prepared-at", "--output",
    ...workflowFlags(),
  ]);
  const previousMode = required(options, "--previous-mode");
  if (!["planned", "live"].includes(previousMode)) fail("--previous-mode must be planned or live");
  const previousBundlePath = optional(options, "--previous-bundle");
  if ((previousMode === "live") !== Boolean(previousBundlePath)) {
    fail("--previous-bundle is required exactly when --previous-mode is live");
  }
  if ((previousMode === "live") !== Boolean(optional(options, "--previous-promotion-receipt")) ||
    (previousMode === "live") !==
      Boolean(optional(options, "--previous-promotion-artifact-evidence"))) {
    fail("previous promotion receipt and artifact are required exactly for a live prior release");
  }
  const stageBundle = await exactTrackedStageBundle(options, "--stage-bundle");
  const promotionBundle = await exactTrackedPromotionBundle(options, "--promotion-bundle");
  const indexerEvidence = await exactTrackedIndexerEvidence(options);
  parseIndexerPromotionEvidence({ ...indexerEvidence, bundle: promotionBundle });
  const stageReceipt = await readJson(required(options, "--stage-receipt"), "stage receipt");
  const parsedStage = parseStageReceipt(stageReceipt, {
    bundle: stageBundle,
    target: protectedTarget(options),
    stagedSmoke: await readJson(required(options, "--stage-artifact-smoke"),
      "stage artifact dark-stage smoke receipt"),
  });
  const source = checkedOutSource(options);
  const currentBuild = await hashBuildOutput(required(options, "--build-root"));
  const sourceTransition = verifyEvidenceOnlyTransition(
    parsedStage.source, source, currentBuild.digest,
  );
  const input = {
    stageReceipt,
    stageBundle,
    promotionBundle,
    indexerEvidence,
    stageRunEvidence: parseGitHubRunEvidence(await readJson(
      required(options, "--stage-run-evidence"), "stage workflow run evidence",
    )),
    stageArtifact: parseGitHubArtifactEvidence(await readJson(
      required(options, "--stage-artifact-evidence"), "stage artifact evidence",
    )),
    stagedProviderDeployment: (await readJson(
      required(options, "--staged-deployment"), "fresh staged provider deployment",
    )).deployment,
    sourceTransition,
    currentBuildOutputDigest: currentBuild.digest,
    stagedSmoke: await readJson(required(options, "--staged-smoke"), "staged smoke receipt"),
    stageProtectionEvidence: await readJson(
      required(options, "--stage-protection-evidence"), "fresh stage protection evidence",
    ),
    previousMode,
    ...(previousMode === "live" ? {
      previousPromotionReceipt: await readJson(
        required(options, "--previous-promotion-receipt"), "previous promotion receipt",
      ),
      previousPromotionArtifact: parseGitHubArtifactEvidence(await readJson(
        required(options, "--previous-promotion-artifact-evidence"),
        "previous promotion artifact evidence",
      )),
    } : {}),
    ...(previousBundlePath
      ? { previousBundle: await readJson(previousBundlePath, "previous promotion bundle") }
      : {}),
    previousSmoke: await readJson(required(options, "--previous-smoke"),
      "previous production smoke receipt"),
    previousDeployment: (await readJson(required(options, "--previous-deployment"),
      "previous production deployment")).deployment,
    source,
    target: protectedTarget(options),
    workflow: workflowIdentity(options),
    preparedAt: required(options, "--prepared-at"),
  };
  await writeJson(required(options, "--output"), createPromotionPlan(input));
}

async function authorizeCommand(options) {
  assertOnly(options, [
    "--operation", "--plan", "--workflow-run", "--environment", "--authorized-at",
    "--output",
    ...workflowFlags(),
  ]);
  const operation = required(options, "--operation");
  if (!["promote", "rollback"].includes(operation)) {
    fail("--operation must be promote or rollback");
  }
  if (process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    process.env.GITHUB_REF_PROTECTED !== "true" ||
    process.env.RELEASE_CONTROL_ENVIRONMENT !== "production") {
    fail("public authorization requires a protected manual Developers production environment");
  }
  const plan = await readJson(required(options, "--plan"), `${operation} plan`);
  const parsedPlan = operation === "promote"
    ? parsePromotionPlan(plan)
    : parseRollbackPlan(plan);
  const planAge = Date.now() - Date.parse(parsedPlan.preparedAt);
  if (planAge < 0 || planAge > 30 * 60_000) {
    fail("release plan is older than the 30-minute owner-authorization window");
  }
  const authorization = createPublicAuthorization({
    operation,
    plan,
    workflow: workflowIdentity(options),
    ownerDispatchAuthorization: validateGitHubOwnerDispatchAuthorization({
      workflowRun: await readJson(required(options, "--workflow-run"),
        "GitHub owner-dispatch workflow run"),
      environment: await readJson(required(options, "--environment"),
        "GitHub production environment"),
    },
      {
        workflow: workflowIdentity(options),
        source: parsedPlan.source,
        observedAt: required(options, "--authorized-at"),
      },
    ),
    authorizedAt: required(options, "--authorized-at"),
  });
  await writeJson(required(options, "--output"), authorization);
}

async function authorizePlannedDeployCommand(options) {
  assertOnly(options, [
    "--mutation", "--workflow-run", "--environment", "--authorized-at",
    "--source-revision", "--source-tree", "--org-id", "--project-id",
    "--current-deployment", "--candidate-deployment", "--candidate-protection-evidence",
    "--candidate-smoke", "--output",
    ...workflowFlags(),
  ]);
  if (process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    process.env.GITHUB_REF_PROTECTED !== "true" ||
    process.env.RELEASE_CONTROL_ENVIRONMENT !== "production") {
    fail("planned deploy authorization requires a protected manual Developers production environment");
  }
  const mutation = required(options, "--mutation");
  if (!["create-candidate", "promote-candidate"].includes(mutation)) {
    fail("--mutation must be create-candidate or promote-candidate");
  }
  const source = checkedOutSource(options);
  const workflow = workflowIdentity(options);
  const authorizedAt = required(options, "--authorized-at");
  const candidateOptions = [
    "--candidate-deployment", "--candidate-protection-evidence", "--candidate-smoke",
  ].map((name) => optional(options, name));
  if (mutation === "create-candidate" && candidateOptions.some(Boolean)) {
    fail("candidate evidence is forbidden before candidate creation");
  }
  if (mutation === "promote-candidate" && !candidateOptions.every(Boolean)) {
    fail("candidate deployment, protection, and smoke evidence are required before promotion");
  }
  const ownerDispatchAuthorization = validateGitHubOwnerDispatchAuthorization({
    workflowRun: await readJson(required(options, "--workflow-run"),
      "GitHub owner-dispatch workflow run"),
    environment: await readJson(required(options, "--environment"),
      "GitHub production environment"),
  }, { workflow, source, observedAt: authorizedAt });
  const currentCapture = await readJson(
    required(options, "--current-deployment"), "current public Vercel deployment",
  );
  const currentDeployment = currentCapture.deployment;
  const authorization = createPlannedDeployAuthorization({
    mutation,
    source,
    target: protectedTarget(options),
    currentDeployment,
    currentProductionBinding: currentCapture.productionBinding,
    ...(mutation === "promote-candidate" ? {
      candidateDeployment: (await readJson(candidateOptions[0],
        "planned Vercel candidate deployment")).deployment,
      candidateProtectionEvidence: await readJson(candidateOptions[1],
        "planned Vercel candidate protection evidence"),
      candidateSmoke: await readJson(candidateOptions[2],
        "planned Vercel candidate smoke"),
    } : {}),
    ownerDispatchAuthorization,
    workflow,
    authorizedAt,
  });
  await writeJson(required(options, "--output"), authorization);
}

async function promotionReceiptCommand(options) {
  assertOnly(options, [
    "--plan", "--authorization", "--bundle", "--production-deployment", "--production-smoke",
    "--selected-smoke", "--pre-mutation-state", "--promoted-at", "--output",
    ...workflowFlags(),
  ]);
  const bundle = await readJson(required(options, "--bundle"), "promotion bundle");
  const productionCapture = await readJson(required(options, "--production-deployment"),
    "production deployment");
  const receipt = createPromotionReceipt({
    plan: await readJson(required(options, "--plan"), "promotion plan"),
    authorization: await readJson(required(options, "--authorization"),
      "public authorization"),
    bundle,
    context: { bundle },
    preMutationState: await readJson(required(options, "--pre-mutation-state"),
      "promotion pre-mutation state"),
    selectedSmoke: await readJson(required(options, "--selected-smoke"),
      "fresh selected promotion smoke receipt"),
    productionDeployment: productionCapture.deployment,
    productionBinding: productionCapture.productionBinding,
    productionSmoke: await readJson(required(options, "--production-smoke"),
      "production smoke receipt"),
    workflow: workflowIdentity(options),
    promotedAt: required(options, "--promoted-at"),
  });
  await writeJson(required(options, "--output"), receipt);
}

async function rollbackPlanCommand(options) {
  assertOnly(options, [
    "--promotion-receipt", "--bundle", "--previous-bundle", "--current-smoke",
    "--current-deployment", "--target-smoke", "--target-deployment",
    "--target-protection-evidence", "--org-id", "--project-id",
    "--promotion-artifact-evidence", "--prepared-at", "--output", ...workflowFlags(),
  ]);
  const promotionReceipt = await readJson(required(options, "--promotion-receipt"),
    "promotion receipt");
  const bundle = await readJson(required(options, "--bundle"), "promotion bundle");
  const previousBundlePath = optional(options, "--previous-bundle");
  const input = {
    promotionReceipt,
    promotionArtifact: parseGitHubArtifactEvidence(await readJson(
      required(options, "--promotion-artifact-evidence"), "promotion artifact evidence",
    )),
    bundle,
    ...(previousBundlePath
      ? { previousBundle: await readJson(previousBundlePath, "previous promotion bundle") }
      : {}),
    currentSmoke: await readJson(required(options, "--current-smoke"),
      "current production smoke receipt"),
    currentDeployment: (await readJson(required(options, "--current-deployment"),
      "current production deployment")).deployment,
    targetSmoke: await readJson(required(options, "--target-smoke"),
      "rollback target smoke receipt"),
    targetDeployment: (await readJson(required(options, "--target-deployment"),
      "rollback target deployment")).deployment,
    targetProtectionEvidence: await readJson(
      required(options, "--target-protection-evidence"),
      "rollback target protection evidence",
    ),
    target: protectedTarget(options),
    workflow: workflowIdentity(options),
    preparedAt: required(options, "--prepared-at"),
  };
  await writeJson(required(options, "--output"), createRollbackPlan(input));
}

async function rollbackReceiptCommand(options) {
  assertOnly(options, [
    "--plan", "--authorization", "--previous-bundle", "--production-deployment",
    "--production-smoke", "--selected-smoke", "--pre-mutation-state", "--rolled-back-at",
    "--output",
    ...workflowFlags(),
  ]);
  const plan = await readJson(required(options, "--plan"), "rollback plan");
  const parsedPlan = parseRollbackPlan(plan);
  const previousBundlePath = optional(options, "--previous-bundle");
  if ((parsedPlan.rollbackTarget.mode === "live") !== Boolean(previousBundlePath)) {
    fail("--previous-bundle is required exactly for a live rollback target");
  }
  const productionCapture = await readJson(required(options, "--production-deployment"),
    "rolled-back production deployment");
  const receipt = createRollbackReceipt({
    plan,
    authorization: await readJson(required(options, "--authorization"),
      "public authorization"),
    ...(previousBundlePath
      ? { previousBundle: await readJson(previousBundlePath, "previous promotion bundle") }
      : {}),
    preMutationState: await readJson(required(options, "--pre-mutation-state"),
      "rollback pre-mutation state"),
    selectedSmoke: await readJson(required(options, "--selected-smoke"),
      "fresh selected rollback smoke receipt"),
    productionDeployment: productionCapture.deployment,
    productionBinding: productionCapture.productionBinding,
    productionSmoke: await readJson(required(options, "--production-smoke"),
      "post-rollback smoke receipt"),
    workflow: workflowIdentity(options),
    rolledBackAt: required(options, "--rolled-back-at"),
  });
  await writeJson(required(options, "--output"), receipt);
}

async function preMutationStateCommand(options) {
  assertOnly(options, [
    "--operation", "--plan", "--current-deployment", "--selected-deployment",
    "--selected-protection-evidence", "--selected-smoke", "--selected-bundle",
    "--checked-at", "--output",
  ]);
  const operation = required(options, "--operation");
  if (!["promote", "rollback"].includes(operation)) {
    fail("--operation must be promote or rollback");
  }
  const plan = await readJson(required(options, "--plan"), "release plan");
  const parsedPlan = operation === "promote"
    ? parsePromotionPlan(plan)
    : parseRollbackPlan(plan);
  const selectedBundlePath = optional(options, "--selected-bundle");
  const requiresBundle = operation === "promote" || parsedPlan.rollbackTarget.mode === "live";
  if (requiresBundle !== Boolean(selectedBundlePath)) {
    fail("--selected-bundle is required exactly for a live selected deployment");
  }
  const currentCapture = await readJson(required(options, "--current-deployment"),
    "fresh current production deployment");
  const state = createPreMutationState({
    operation,
    plan,
    currentDeployment: currentCapture.deployment,
    currentProductionBinding: currentCapture.productionBinding,
    selectedDeployment: (await readJson(required(options, "--selected-deployment"),
      "fresh selected deployment")).deployment,
    selectedProtectionEvidence: await readJson(
      required(options, "--selected-protection-evidence"),
      "fresh selected deployment protection evidence",
    ),
    selectedSmoke: await readJson(required(options, "--selected-smoke"),
      "fresh selected deployment smoke receipt"),
    ...(selectedBundlePath
      ? { selectedBundle: await readJson(selectedBundlePath, "selected promotion bundle") }
      : {}),
    checkedAt: required(options, "--checked-at"),
  });
  await writeJson(required(options, "--output"), state);
}

async function inspectCommand(options) {
  assertOnly(options, ["--kind", "--file", "--bundle-phase", "--bundle", "--output"]);
  const kind = required(options, "--kind");
  const value = await readJson(required(options, "--file"), kind);
  const bundlePath = optional(options, "--bundle");
  const bundle = bundlePath ? await readJson(bundlePath, "promotion bundle") : undefined;
  let result;
  if (kind === "stage-bundle") result = parseStageBundle(value);
  else if (kind === "promotion-bundle") result = parsePromotionBundle(value);
  else if (kind === "stage") result = parseStageReceipt(value, { bundle });
  else if (kind === "promotion-plan") result = parsePromotionPlan(value, { bundle });
  else if (kind === "authorization-promote") {
    result = parsePublicAuthorization(value, { operation: "promote" });
  } else if (kind === "authorization-rollback") {
    result = parsePublicAuthorization(value, { operation: "rollback" });
  } else if (kind === "authorization-deploy-planned") {
    result = parsePlannedDeployAuthorization(value);
  } else if (kind === "promotion") result = parsePromotionReceipt(value, { bundle });
  else if (kind === "rollback-plan") result = parseRollbackPlan(value, { bundle });
  else if (kind === "rollback") result = parseRollbackReceipt(value);
  else if (kind === "smoke-live") {
    result = parseSmokeReceipt(value, {
      expectedMode: "live",
      expectedBundlePhase: required(options, "--bundle-phase"),
      bundle,
    });
  } else if (kind === "smoke-planned") {
    result = parseSmokeReceipt(value, { expectedMode: "planned" });
  } else fail("--kind is unsupported");
  await writeJson(required(options, "--output"), result);
}

async function fieldCommand(options) {
  assertOnly(options, ["--file", "--path"]);
  const value = await readJson(required(options, "--file"), "field input");
  const segments = required(options, "--path").split(".");
  if (segments.some((segment) => !/^[A-Za-z][A-Za-z0-9]*$/u.test(segment))) {
    fail("--path contains an invalid field name");
  }
  let selected = value;
  for (const segment of segments) selected = selected?.[segment];
  if (!["string", "number", "boolean"].includes(typeof selected)) {
    fail("selected field is not a scalar");
  }
  process.stdout.write(`${String(selected)}\n`);
}

const { command, options } = parseArguments(process.argv.slice(2));
const commands = new Map([
  ["validate-bundle", validateBundleCommand],
  ["validate-planned", validatePlannedCommand],
  ["normalize-deployment", normalizeDeploymentCommand],
  ["create-stage-receipt", stageReceiptCommand],
  ["validate-stage", validateStageCommand],
  ["validate-github-run", validateGitHubRunCommand],
  ["validate-github-artifact", validateGitHubArtifactCommand],
  ["create-promotion-plan", promotionPlanCommand],
  ["authorize", authorizeCommand],
  ["authorize-planned-deploy", authorizePlannedDeployCommand],
  ["create-promotion-receipt", promotionReceiptCommand],
  ["create-pre-mutation-state", preMutationStateCommand],
  ["create-rollback-plan", rollbackPlanCommand],
  ["create-rollback-receipt", rollbackReceiptCommand],
  ["inspect", inspectCommand],
  ["field", fieldCommand],
]);
const handler = commands.get(command);
if (!handler) fail(`unknown release-control command ${command}`);
await handler(options);

if (command !== "field") {
  process.stdout.write(
    `Release control ${command} OK; no authority was inferred from HTTP success or bundle finality.\n`,
  );
}
