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
  createPlannedDeployReceipt,
  createPreMutationState,
  createPromotionPlan,
  createPromotionReceipt,
  createPublicAuthorization,
  createPublicMutationIntent,
  createPublicMutationRecoveryAttempt,
  createPublicMutationRecoveryReadiness,
  createRecoveredPromotionReceipt,
  createRecoveredRollbackReceipt,
  createRollbackPlan,
  createRollbackReceipt,
  createStageReceipt,
  frozenEthereumV3Identity,
  hashBuildOutput,
  normalizeVercelDeployment,
  parseIndexerPromotionEvidence,
  parsePlannedDeployAuthorization,
  parsePlannedDeployReceipt,
  parsePlannedPublicMutationReadiness,
  parsePromotionBundle,
  parsePromotionPlan,
  parsePromotionReceipt,
  parsePublicAuthorization,
  parsePublicMutationIntent,
  parsePublicMutationIntentProvenance,
  parsePublicMutationRecoveryAttempt,
  parsePublicMutationRecoveryReadiness,
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
  releaseRecoveryWorkflow,
  validateLiveRobinhoodManifest,
  validateGitHubRunEvidence,
  validateGitHubArtifactEvidence,
  validateGitHubOwnerDispatchAuthorization,
  validatePublicMutationIntentProvenance,
  validatePublicMutationRecoveryAttemptProvenance,
  validatePlannedPublicMutationReadiness,
  validatePreMutationReadiness,
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
const MAX_ARTIFACT_ARCHIVE_BYTES = 128 * 1024 * 1024;

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

async function readArtifactArchive(file, label = "GitHub artifact archive") {
  const absolute = path.resolve(file);
  const metadata = await lstat(absolute);
  if (!metadata.isFile() || metadata.size < 1 ||
    metadata.size > MAX_ARTIFACT_ARCHIVE_BYTES) {
    fail(`${label} must be a regular ZIP file no larger than ${MAX_ARTIFACT_ARCHIVE_BYTES} bytes`);
  }
  return readFile(absolute);
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

function recoveryWorkflowIdentity(options) {
  return releaseRecoveryWorkflow({
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
    "--current-production-deployment", "--protection-evidence", "--staged-smoke",
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
  const currentProductionCapture = await readJson(
    required(options, "--current-production-deployment"),
    "current production Vercel binding",
  );
  const build = await hashBuildOutput(required(options, "--build-root"));
  const receipt = createStageReceipt({
    bundle,
    manifest,
    ethereumManifest,
    deployment: normalized.deployment,
    currentProductionBinding: currentProductionCapture.productionBinding,
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
    "--previous-promotion-run-evidence", "--previous-promotion-artifact-evidence",
    "--previous-promotion-artifact-archive",
    "--source-revision", "--source-tree",
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
      Boolean(optional(options, "--previous-promotion-run-evidence")) ||
    (previousMode === "live") !==
      Boolean(optional(options, "--previous-promotion-artifact-evidence")) ||
    (previousMode === "live") !==
      Boolean(optional(options, "--previous-promotion-artifact-archive"))) {
    fail("previous promotion receipt, run, artifact, and archive are required exactly for a live prior release");
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
  const previousCapture = await readJson(required(options, "--previous-deployment"),
    "previous production deployment");
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
      previousPromotionRun: parseGitHubRunEvidence(await readJson(
        required(options, "--previous-promotion-run-evidence"),
        "previous promotion workflow run evidence",
      )),
      previousPromotionArtifact: parseGitHubArtifactEvidence(await readJson(
        required(options, "--previous-promotion-artifact-evidence"),
        "previous promotion artifact evidence",
      )),
      previousPromotionArtifactArchive: await readArtifactArchive(
        required(options, "--previous-promotion-artifact-archive"),
        "previous promotion artifact archive",
      ),
    } : {}),
    ...(previousBundlePath
      ? { previousBundle: await readJson(previousBundlePath, "previous promotion bundle") }
      : {}),
    previousSmoke: await readJson(required(options, "--previous-smoke"),
      "previous production smoke receipt"),
    previousDeployment: previousCapture.deployment,
    previousProductionBinding: previousCapture.productionBinding,
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
    "--selected-smoke", "--pre-mutation-state", "--intent", "--mutation-readiness",
    "--promoted-at", "--output",
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
    intent: await readJson(required(options, "--intent"), "promotion mutation intent"),
    mutationReadiness: await readJson(required(options, "--mutation-readiness"),
      "promotion mutation readiness"),
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
    "--promotion-run-evidence", "--promotion-artifact-evidence",
    "--promotion-artifact-archive", "--prepared-at",
    "--output", ...workflowFlags(),
  ]);
  const promotionReceipt = await readJson(required(options, "--promotion-receipt"),
    "promotion receipt");
  const bundle = await readJson(required(options, "--bundle"), "promotion bundle");
  const previousBundlePath = optional(options, "--previous-bundle");
  const currentCapture = await readJson(required(options, "--current-deployment"),
    "current production deployment");
  const input = {
    promotionReceipt,
    promotionRun: parseGitHubRunEvidence(await readJson(
      required(options, "--promotion-run-evidence"), "promotion workflow run evidence",
    )),
    promotionArtifact: parseGitHubArtifactEvidence(await readJson(
      required(options, "--promotion-artifact-evidence"), "promotion artifact evidence",
    )),
    promotionArtifactArchive: await readArtifactArchive(
      required(options, "--promotion-artifact-archive"),
      "promotion artifact archive",
    ),
    bundle,
    ...(previousBundlePath
      ? { previousBundle: await readJson(previousBundlePath, "previous promotion bundle") }
      : {}),
    currentSmoke: await readJson(required(options, "--current-smoke"),
      "current production smoke receipt"),
    currentDeployment: currentCapture.deployment,
    currentProductionBinding: currentCapture.productionBinding,
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
    "--intent", "--mutation-readiness", "--output",
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
    intent: await readJson(required(options, "--intent"), "rollback mutation intent"),
    mutationReadiness: await readJson(required(options, "--mutation-readiness"),
      "rollback mutation readiness"),
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

async function preMutationReadinessCommand(options) {
  assertOnly(options, [
    "--operation", "--plan", "--authorization", "--pre-mutation-state",
    "--selected-smoke", "--selected-bundle", "--current-deployment", "--confirmed-at",
    "--intent", "--intent-authorization", "--intent-pre-mutation-state",
    "--intent-selected-smoke", "--mutation-control", "--output",
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
    "final current production deployment");
  const readiness = validatePreMutationReadiness({
    operation,
    plan,
    authorization: await readJson(required(options, "--authorization"),
      "public authorization"),
    intent: await readJson(required(options, "--intent"), "public mutation intent"),
    intentAuthorization: await readJson(required(options, "--intent-authorization"),
      "intent public authorization"),
    intentPreMutationState: await readJson(required(options, "--intent-pre-mutation-state"),
      "intent pre-mutation state"),
    intentSelectedSmoke: await readJson(required(options, "--intent-selected-smoke"),
      "intent selected deployment smoke"),
    preMutationState: await readJson(required(options, "--pre-mutation-state"),
      "pre-mutation state"),
    selectedSmoke: await readJson(required(options, "--selected-smoke"),
      "selected deployment smoke receipt"),
    ...(selectedBundlePath
      ? { selectedBundle: await readJson(selectedBundlePath, "selected promotion bundle") }
      : {}),
    currentDeployment: currentCapture.deployment,
    currentProductionBinding: currentCapture.productionBinding,
    mutationControl: await readJson(required(options, "--mutation-control"),
      "Vercel mutation control"),
    confirmedAt: required(options, "--confirmed-at"),
  });
  await writeJson(required(options, "--output"), readiness);
}

async function plannedMutationReadinessCommand(options) {
  assertOnly(options, [
    "--authorization", "--current-deployment", "--confirmed-at", "--intent",
    "--intent-authorization", "--intent-selected-smoke", "--candidate-smoke",
    "--mutation-control", "--output",
  ]);
  const currentCapture = await readJson(required(options, "--current-deployment"),
    "final planned current production deployment");
  const readiness = validatePlannedPublicMutationReadiness({
    authorization: await readJson(required(options, "--authorization"),
      "planned public mutation authorization"),
    intent: await readJson(required(options, "--intent"), "planned public mutation intent"),
    intentAuthorization: await readJson(required(options, "--intent-authorization"),
      "intent planned authorization"),
    intentSelectedSmoke: await readJson(required(options, "--intent-selected-smoke"),
      "intent planned candidate smoke"),
    candidateSmoke: await readJson(required(options, "--candidate-smoke"),
      "final planned candidate smoke"),
    currentDeployment: currentCapture.deployment,
    currentProductionBinding: currentCapture.productionBinding,
    mutationControl: await readJson(required(options, "--mutation-control"),
      "Vercel mutation control"),
    confirmedAt: required(options, "--confirmed-at"),
  });
  await writeJson(required(options, "--output"), readiness);
}

async function publicMutationIntentCommand(options) {
  assertOnly(options, [
    "--operation", "--plan", "--authorization", "--pre-mutation-state",
    "--selected-smoke", "--selected-bundle", "--created-at", "--output",
  ]);
  const operation = required(options, "--operation");
  if (!["deploy-planned", "promote", "rollback"].includes(operation)) {
    fail("--operation must be deploy-planned, promote, or rollback");
  }
  const live = operation !== "deploy-planned";
  const planPath = optional(options, "--plan");
  const statePath = optional(options, "--pre-mutation-state");
  const bundlePath = optional(options, "--selected-bundle");
  if (live !== Boolean(planPath) || live !== Boolean(statePath)) {
    fail("--plan and --pre-mutation-state are required exactly for promote or rollback");
  }
  const plan = planPath ? await readJson(planPath, "public mutation plan") : undefined;
  const bundleRequired = operation === "promote" ||
    (operation === "rollback" && parseRollbackPlan(plan).rollbackTarget.mode === "live");
  if (bundleRequired !== Boolean(bundlePath)) {
    fail("--selected-bundle is required exactly for a live mutation target");
  }
  const intent = createPublicMutationIntent({
    operation,
    ...(plan ? { plan } : {}),
    authorization: await readJson(required(options, "--authorization"),
      "public mutation authorization"),
    ...(statePath ? {
      preMutationState: await readJson(statePath, "public mutation pre-mutation state"),
    } : {}),
    selectedSmoke: await readJson(required(options, "--selected-smoke"),
      "public mutation selected smoke"),
    ...(bundlePath ? {
      selectedBundle: await readJson(bundlePath, "public mutation selected bundle"),
    } : {}),
    createdAt: required(options, "--created-at"),
  });
  await writeJson(required(options, "--output"), intent);
}

async function mutationIntentProvenanceCommand(options) {
  assertOnly(options, [
    "--workflow-run", "--artifacts", "--artifact-archive", "--intent", "--run-id",
    "--run-attempt", "--output",
  ]);
  const provenance = validatePublicMutationIntentProvenance({
    workflowRun: await readJson(required(options, "--workflow-run"),
      "public mutation intent producer run"),
    artifacts: await readJson(required(options, "--artifacts"),
      "public mutation intent artifact listing"),
  }, {
    runId: required(options, "--run-id"),
    runAttempt: required(options, "--run-attempt"),
    intent: await readJson(required(options, "--intent"), "public mutation intent"),
    artifactArchive: await readArtifactArchive(required(options, "--artifact-archive")),
  });
  await writeJson(required(options, "--output"), provenance);
}

async function validateMutationIntentProvenanceCommand(options) {
  assertOnly(options, ["--provenance", "--intent"]);
  parsePublicMutationIntentProvenance(
    await readJson(required(options, "--provenance"),
      "public mutation intent provenance"),
    { intent: await readJson(required(options, "--intent"), "public mutation intent") },
  );
}

function requireRecoveryEnvironment() {
  if (process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
    process.env.GITHUB_REF_PROTECTED !== "true" ||
    process.env.RELEASE_CONTROL_ENVIRONMENT !== "production") {
    fail("recovery requires a protected manual Developers production environment");
  }
}

async function recoveryInputs(options) {
  requireRecoveryEnvironment();
  const source = checkedOutSource(options);
  const workflow = recoveryWorkflowIdentity(options);
  const authorizedAt = required(options, "--authorized-at");
  const ownerDispatchAuthorization = validateGitHubOwnerDispatchAuthorization({
    workflowRun: await readJson(required(options, "--workflow-run"),
      "recovery GitHub owner-dispatch workflow run"),
    environment: await readJson(required(options, "--environment"),
      "recovery GitHub production environment"),
  }, { workflow, source, observedAt: authorizedAt });
  const currentCapture = await readJson(required(options, "--current-deployment"),
    "recovery current public deployment");
  return {
    intent: await readJson(required(options, "--intent"), "public mutation intent"),
    intentProvenance: await readJson(required(options, "--intent-provenance"),
      "public mutation intent provenance"),
    source,
    workflow,
    ownerDispatchAuthorization,
    currentDeployment: currentCapture.deployment,
    currentProductionBinding: currentCapture.productionBinding,
    targetDeployment: (await readJson(required(options, "--target-deployment"),
      "recovery target deployment")).deployment,
    targetProtectionEvidence: await readJson(
      required(options, "--target-protection-evidence"),
      "recovery target protection evidence",
    ),
    targetSmoke: await readJson(required(options, "--target-smoke"),
      "recovery target smoke"),
    ...(optional(options, "--selected-bundle") ? {
      selectedBundle: await readJson(optional(options, "--selected-bundle"),
        "recovery selected bundle"),
    } : {}),
    authorizedAt,
  };
}

function recoveryInputFlags() {
  return [
    "--intent", "--intent-provenance", "--current-deployment", "--target-deployment",
    "--target-protection-evidence", "--target-smoke", "--selected-bundle",
    "--workflow-run", "--environment", "--authorized-at", "--source-revision",
    "--source-tree", ...workflowFlags(),
  ];
}

async function recoveryAttemptCommand(options) {
  assertOnly(options, [...recoveryInputFlags(), "--output"]);
  const input = await recoveryInputs(options);
  const intent = parsePublicMutationIntent(input.intent);
  if ((intent.targetMode === "live") !== Boolean(input.selectedBundle)) {
    fail("--selected-bundle is required exactly for a live recovery target");
  }
  await writeJson(required(options, "--output"),
    createPublicMutationRecoveryAttempt(input));
}

async function recoveryAttemptProvenanceCommand(options) {
  assertOnly(options, [
    "--artifacts", "--artifact-archive", "--attempt", "--source-revision",
    "--source-tree", "--output", ...workflowFlags(),
  ]);
  const provenance = validatePublicMutationRecoveryAttemptProvenance(
    await readJson(required(options, "--artifacts"),
      "recovery attempt artifact listing"),
    {
      attempt: await readJson(required(options, "--attempt"), "durable recovery attempt"),
      artifactArchive: await readArtifactArchive(required(options, "--artifact-archive")),
      source: checkedOutSource(options),
      workflow: recoveryWorkflowIdentity(options),
    },
  );
  await writeJson(required(options, "--output"), provenance);
}

async function recoveryReadinessCommand(options) {
  assertOnly(options, [
    ...recoveryInputFlags(), "--attempt", "--attempt-provenance", "--mutation-control",
    "--confirmed-at", "--output",
  ]);
  const input = await recoveryInputs(options);
  const intent = parsePublicMutationIntent(input.intent);
  if ((intent.targetMode === "live") !== Boolean(input.selectedBundle)) {
    fail("--selected-bundle is required exactly for a live recovery target");
  }
  await writeJson(required(options, "--output"), createPublicMutationRecoveryReadiness({
    ...input,
    attempt: await readJson(required(options, "--attempt"), "durable recovery attempt"),
    attemptProvenance: await readJson(required(options, "--attempt-provenance"),
      "durable recovery attempt provenance"),
    mutationControl: await readJson(required(options, "--mutation-control"),
      "Vercel mutation control"),
    confirmedAt: required(options, "--confirmed-at"),
  }));
}

async function plannedDeployReceiptCommand(options) {
  assertOnly(options, [
    "--intent", "--authorization", "--mutation-readiness", "--recovery-attempt",
    "--recovery-readiness", "--production-deployment", "--production-smoke",
    "--completed-at", "--output",
  ]);
  const production = await readJson(required(options, "--production-deployment"),
    "planned public production deployment");
  const recoveryAttemptPath = optional(options, "--recovery-attempt");
  const recoveryReadinessPath = optional(options, "--recovery-readiness");
  const authorizationPath = optional(options, "--authorization");
  const mutationReadinessPath = optional(options, "--mutation-readiness");
  if (Boolean(recoveryAttemptPath) !== Boolean(recoveryReadinessPath)) {
    fail("planned recovery attempt and readiness must be supplied together");
  }
  if (Boolean(recoveryReadinessPath) === Boolean(authorizationPath) ||
    Boolean(recoveryReadinessPath) === Boolean(mutationReadinessPath)) {
    fail("planned receipt requires exactly normal authorization/readiness or recovery evidence");
  }
  await writeJson(required(options, "--output"), createPlannedDeployReceipt({
    intent: await readJson(required(options, "--intent"), "planned mutation intent"),
    ...(recoveryReadinessPath ? {
      recoveryAttempt: await readJson(recoveryAttemptPath, "planned recovery attempt"),
      recoveryReadiness: await readJson(recoveryReadinessPath, "planned recovery readiness"),
    } : {
      authorization: await readJson(authorizationPath,
        "planned deploy authorization"),
      mutationReadiness: await readJson(mutationReadinessPath,
        "planned mutation readiness"),
    }),
    productionDeployment: production.deployment,
    productionBinding: production.productionBinding,
    productionSmoke: await readJson(required(options, "--production-smoke"),
      "planned production smoke"),
    completedAt: required(options, "--completed-at"),
  }));
}

async function recoveredPromotionReceiptCommand(options) {
  assertOnly(options, [
    "--intent", "--plan", "--intent-authorization", "--intent-pre-mutation-state",
    "--intent-selected-smoke", "--bundle", "--recovery-attempt", "--recovery-readiness",
    "--production-deployment", "--production-smoke", "--promoted-at", "--output",
  ]);
  const production = await readJson(required(options, "--production-deployment"),
    "recovered promoted production deployment");
  await writeJson(required(options, "--output"), createRecoveredPromotionReceipt({
    intent: await readJson(required(options, "--intent"), "promotion mutation intent"),
    plan: await readJson(required(options, "--plan"), "promotion plan"),
    intentAuthorization: await readJson(required(options, "--intent-authorization"),
      "intent promotion authorization"),
    intentPreMutationState: await readJson(required(options, "--intent-pre-mutation-state"),
      "intent promotion pre-mutation state"),
    intentSelectedSmoke: await readJson(required(options, "--intent-selected-smoke"),
      "intent promotion selected smoke"),
    bundle: await readJson(required(options, "--bundle"), "promotion bundle"),
    recoveryAttempt: await readJson(required(options, "--recovery-attempt"),
      "promotion recovery attempt"),
    recoveryReadiness: await readJson(required(options, "--recovery-readiness"),
      "promotion recovery readiness"),
    productionDeployment: production.deployment,
    productionBinding: production.productionBinding,
    productionSmoke: await readJson(required(options, "--production-smoke"),
      "recovered promotion production smoke"),
    promotedAt: required(options, "--promoted-at"),
  }));
}

async function recoveredRollbackReceiptCommand(options) {
  assertOnly(options, [
    "--intent", "--plan", "--intent-authorization", "--intent-pre-mutation-state",
    "--intent-selected-smoke", "--previous-bundle", "--recovery-attempt",
    "--recovery-readiness", "--production-deployment", "--production-smoke",
    "--rolled-back-at", "--output",
  ]);
  const plan = await readJson(required(options, "--plan"), "rollback plan");
  const previousBundlePath = optional(options, "--previous-bundle");
  if ((parseRollbackPlan(plan).rollbackTarget.mode === "live") !==
    Boolean(previousBundlePath)) {
    fail("--previous-bundle is required exactly for a recovered live rollback");
  }
  const production = await readJson(required(options, "--production-deployment"),
    "recovered rollback production deployment");
  await writeJson(required(options, "--output"), createRecoveredRollbackReceipt({
    intent: await readJson(required(options, "--intent"), "rollback mutation intent"),
    plan,
    intentAuthorization: await readJson(required(options, "--intent-authorization"),
      "intent rollback authorization"),
    intentPreMutationState: await readJson(required(options, "--intent-pre-mutation-state"),
      "intent rollback pre-mutation state"),
    intentSelectedSmoke: await readJson(required(options, "--intent-selected-smoke"),
      "intent rollback selected smoke"),
    ...(previousBundlePath ? {
      previousBundle: await readJson(previousBundlePath, "previous promotion bundle"),
    } : {}),
    recoveryAttempt: await readJson(required(options, "--recovery-attempt"),
      "rollback recovery attempt"),
    recoveryReadiness: await readJson(required(options, "--recovery-readiness"),
      "rollback recovery readiness"),
    productionDeployment: production.deployment,
    productionBinding: production.productionBinding,
    productionSmoke: await readJson(required(options, "--production-smoke"),
      "recovered rollback production smoke"),
    rolledBackAt: required(options, "--rolled-back-at"),
  }));
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
  } else if (kind === "mutation-intent") {
    result = parsePublicMutationIntent(value);
  } else if (kind === "recovery-attempt") {
    result = parsePublicMutationRecoveryAttempt(value);
  } else if (kind === "recovery-readiness") {
    result = parsePublicMutationRecoveryReadiness(value);
  } else if (kind === "planned-deploy-receipt") {
    result = parsePlannedDeployReceipt(value);
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
  ["create-public-mutation-intent", publicMutationIntentCommand],
  ["create-mutation-intent-provenance", mutationIntentProvenanceCommand],
  ["validate-mutation-intent-provenance", validateMutationIntentProvenanceCommand],
  ["validate-pre-mutation-readiness", preMutationReadinessCommand],
  ["validate-planned-mutation-readiness", plannedMutationReadinessCommand],
  ["create-recovery-attempt", recoveryAttemptCommand],
  ["create-recovery-attempt-provenance", recoveryAttemptProvenanceCommand],
  ["create-recovery-readiness", recoveryReadinessCommand],
  ["create-planned-deploy-receipt", plannedDeployReceiptCommand],
  ["create-recovered-promotion-receipt", recoveredPromotionReceiptCommand],
  ["create-recovered-rollback-receipt", recoveredRollbackReceiptCommand],
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
