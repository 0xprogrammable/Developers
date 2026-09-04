import path from "node:path";
import { assertCanonicalJson, listFiles, readJson, REPOSITORY_ROOT } from "./lib/files.mjs";
import { createSchemaRegistry, assertValid } from "./lib/schema.mjs";
import {
  assertNoFindings,
  validateLaunchSemantics,
  validateManifestSemantics,
} from "./lib/semantics.mjs";
import {
  assertCoreContract,
  compareDeploymentManifests,
  compareV1Schemas,
} from "./lib/compatibility.mjs";
import { hardcodedDeploymentFindings } from "./lib/source-scan.mjs";
import {
  CANONICAL_PROMOTION_BUNDLE_PATH,
  CANONICAL_STAGE_BUNDLE_PATH,
  frozenEthereumV3Identity,
  parsePromotionBundle,
  parseStageBundle,
  validateLiveRobinhoodManifest,
  validatePlannedRobinhoodManifest,
} from "./lib/vercel-release.mjs";
import { execFileSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";

const registry = await createSchemaRegistry();
const v2Registry = await createSchemaRegistry("v2");
const MAX_RELEASE_BUNDLE_BYTES = 32 * 1024 * 1024;

async function canonicalTrackedBundlePresent(relativePath) {
  const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
  let metadata;
  try {
    metadata = await lstat(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (!metadata.isFile() || metadata.size > MAX_RELEASE_BUNDLE_BYTES) {
    throw new Error(
      `${relativePath} must be a regular non-symlink file no larger than ${MAX_RELEASE_BUNDLE_BYTES} bytes`,
    );
  }
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", relativePath], {
      cwd: REPOSITORY_ROOT,
      stdio: "ignore",
    });
  } catch {
    throw new Error(`${relativePath} must be tracked by Git`);
  }
  return true;
}

const testFiles = await listFiles(
  path.join(REPOSITORY_ROOT, "tests"),
  (file) => file.endsWith(".test.mjs"),
);
if (testFiles.length === 0) throw new Error("No tests/*.test.mjs files found");
const jsonRoots = [
  "schemas",
  "fixtures",
  "compatibility",
  "deployments",
  "event-sets",
  "snapshots",
  "specifications",
];
let jsonCount = 0;
for (const root of jsonRoots) {
  const files = await listFiles(
    path.join(REPOSITORY_ROOT, root),
    (file) => file.endsWith(".json"),
  );
  for (const file of files) {
    await assertCanonicalJson(file);
    jsonCount += 1;
  }
}
for (const abi of [
  "programmable-custom-registry-v1.json",
  "programmable-launch-stamp-router-v1.json",
]) {
  await assertCanonicalJson(
    path.join(REPOSITORY_ROOT, "abis", "ethereum", abi),
  );
  jsonCount += 1;
}

const launchValidator = registry.validator("launch.schema.json");
const launchFiles = await listFiles(
  path.join(REPOSITORY_ROOT, "fixtures", "v1", "launches"),
  (file) => file.endsWith(".json"),
);
for (const file of launchFiles) {
  const launch = await readJson(file);
  assertValid(launchValidator, launch, path.relative(REPOSITORY_ROOT, file));
  assertNoFindings(
    validateLaunchSemantics(launch),
    path.relative(REPOSITORY_ROOT, file),
  );
}

const v2LaunchValidator = v2Registry.validator("launch.schema.json");
const v2LaunchFiles = await listFiles(
  path.join(REPOSITORY_ROOT, "fixtures", "v2", "launches"),
  (file) => file.endsWith(".json"),
);
for (const file of v2LaunchFiles) {
  const launch = await readJson(file);
  assertValid(v2LaunchValidator, launch, path.relative(REPOSITORY_ROOT, file));
  assertNoFindings(
    validateLaunchSemantics(launch),
    path.relative(REPOSITORY_ROOT, file),
  );
}

const feedValidator = registry.validator("launch-feed.schema.json");
for (const file of await listFiles(
  path.join(REPOSITORY_ROOT, "fixtures", "v1", "feeds"),
  (candidate) => candidate.endsWith(".json"),
)) {
  assertValid(feedValidator, await readJson(file), path.relative(REPOSITORY_ROOT, file));
}

const v2FeedValidator = v2Registry.validator("launch-feed.schema.json");
for (const file of await listFiles(
  path.join(REPOSITORY_ROOT, "fixtures", "v2", "feeds"),
  (candidate) => candidate.endsWith(".json"),
)) {
  assertValid(
    v2FeedValidator,
    await readJson(file),
    path.relative(REPOSITORY_ROOT, file),
  );
}

const manifest = await readJson(path.join(REPOSITORY_ROOT, "deployments", "ethereum.json"));
assertValid(registry.validator("manifest.schema.json"), manifest, "deployments/ethereum.json");
assertNoFindings(validateManifestSemantics(manifest), "deployments/ethereum.json");

const v2Manifest = await readJson(
  path.join(REPOSITORY_ROOT, "deployments", "ethereum-v2.json"),
);
assertValid(
  v2Registry.validator("manifest.schema.json"),
  v2Manifest,
  "deployments/ethereum-v2.json",
);
assertNoFindings(validateManifestSemantics(v2Manifest), "deployments/ethereum-v2.json");
const robinhoodV2Manifest = await readJson(
  path.join(REPOSITORY_ROOT, "deployments", "robinhood-v2.json"),
);
assertValid(
  v2Registry.validator("manifest.schema.json"),
  robinhoodV2Manifest,
  "deployments/robinhood-v2.json",
);
assertNoFindings(
  validateManifestSemantics(robinhoodV2Manifest),
  "deployments/robinhood-v2.json",
);
const configuredStageBundlePath = (process.env.ROBINHOOD_STAGE_BUNDLE_PATH ?? "").trim();
const configuredPromotionBundlePath =
  (process.env.ROBINHOOD_PROMOTION_BUNDLE_PATH ?? "").trim();
const stageBundlePresent = await canonicalTrackedBundlePresent(CANONICAL_STAGE_BUNDLE_PATH);
const promotionBundlePresent =
  await canonicalTrackedBundlePresent(CANONICAL_PROMOTION_BUNDLE_PATH);
if (configuredStageBundlePath && configuredStageBundlePath !== CANONICAL_STAGE_BUNDLE_PATH) {
  throw new Error(`Robinhood Phase A requires ${CANONICAL_STAGE_BUNDLE_PATH}`);
}
if (configuredPromotionBundlePath &&
  configuredPromotionBundlePath !== CANONICAL_PROMOTION_BUNDLE_PATH) {
  throw new Error(`Robinhood Phase B requires ${CANONICAL_PROMOTION_BUNDLE_PATH}`);
}
if (configuredStageBundlePath && configuredPromotionBundlePath) {
  throw new Error("Robinhood checks may select only one release phase");
}
if (robinhoodV2Manifest.customLaunchV4?.status === "planned") {
  if (configuredStageBundlePath) {
    throw new Error(
      "Phase A cannot be selected while the Robinhood read model is planned",
    );
  }
  if (configuredPromotionBundlePath || promotionBundlePresent) {
    throw new Error(
      "A Robinhood Phase-B bundle may not exist for a planned/null read model",
    );
  }
  validatePlannedRobinhoodManifest(robinhoodV2Manifest);
  if (stageBundlePresent) {
    const stageBundle = await readJson(path.join(
      REPOSITORY_ROOT,
      CANONICAL_STAGE_BUNDLE_PATH,
    ));
    parseStageBundle(stageBundle);
  }
} else {
  const releasePhase = configuredStageBundlePath
    ? "stage"
    : configuredPromotionBundlePath
      ? "promotion"
      : promotionBundlePresent
        ? "promotion"
        : stageBundlePresent
          ? "stage"
          : null;
  if (releasePhase === null || (releasePhase === "stage" && !stageBundlePresent) ||
    (releasePhase === "promotion" && !promotionBundlePresent)) {
    throw new Error(
      "Live Robinhood metadata requires its tracked canonical phase bundle",
    );
  }
  if (releasePhase === "stage" && promotionBundlePresent) {
    throw new Error("Phase A cannot be selected after the immutable Phase-B bundle exists");
  }
  const releaseBundlePath = releasePhase === "stage"
    ? CANONICAL_STAGE_BUNDLE_PATH
    : CANONICAL_PROMOTION_BUNDLE_PATH;
  const releaseBundle = await readJson(path.join(REPOSITORY_ROOT, releaseBundlePath));
  validateLiveRobinhoodManifest(
    robinhoodV2Manifest,
    releasePhase === "stage"
      ? parseStageBundle(releaseBundle)
      : parsePromotionBundle(releaseBundle),
  );
}
frozenEthereumV3Identity(v2Manifest);
if (v2Manifest.deployments.some((deployment) => deployment.modelId !== "classic")) {
  throw new Error("Version 2 deployment inventory must remain Classic-only; Custom discovery uses its separate Registry and Router roots");
}
const activeClassicDeployments = v2Manifest.deployments
  .filter((deployment) => deployment.discovery === "enabled")
  .map((deployment) => deployment.deploymentId)
  .sort();
if (
  JSON.stringify(activeClassicDeployments) !==
  JSON.stringify(["ethereum-classic-v3", "ethereum-classic-v4"])
) {
  throw new Error("Version 2 active Classic discovery must contain only V3 and V4");
}

const v2Core = await readJson(
  path.join(REPOSITORY_ROOT, "compatibility", "core-v2.json"),
);
if (
  v2Core.classification?.classic?.label !== "Programmable Classic" ||
  v2Core.classification?.custom?.label !== "Programmable Custom" ||
  v2Core.classification?.custom?.requiredEvidence !==
    "programmable-custom-registry-event-or-canonical-launch-stamp-router" ||
  !v2Core.excludedModels?.includes("stock-paired")
) {
  throw new Error("Version 2 classification contract is incomplete");
}

const core = await readJson(path.join(REPOSITORY_ROOT, "compatibility", "core-v1.json"));
const compatibilityFindings = assertCoreContract(
  core,
  registry.schemas.get("launch.schema.json"),
  registry.schemas.get("launch-feed.schema.json"),
);
if (compatibilityFindings.length > 0) {
  throw new Error(`Compatibility contract failed: ${compatibilityFindings.join("; ")}`);
}

const hardcoded = await hardcodedDeploymentFindings();
if (hardcoded.length > 0) throw new Error(hardcoded.join("; "));

const requestedCompatibilityBase = (
  process.env.COMPATIBILITY_BASE_SHA ??
  process.env.GITHUB_BASE_SHA ??
  ""
).trim();
const compatibilityBase = /^0{40}$/.test(requestedCompatibilityBase)
  ? null
  : requestedCompatibilityBase || null;
if (compatibilityBase) {
  try {
    execFileSync("git", ["cat-file", "-e", `${compatibilityBase}^{commit}`], {
      cwd: REPOSITORY_ROOT,
      stdio: "ignore",
    });
  } catch {
    throw new Error(`Compatibility base commit is unavailable: ${compatibilityBase}`);
  }
  const drift = [];
  for (const file of registry.files) {
    const relative = path.relative(REPOSITORY_ROOT, file);
    let previous;
    try {
      previous = JSON.parse(
        execFileSync("git", ["show", `${compatibilityBase}:${relative}`], {
          cwd: REPOSITORY_ROOT,
          encoding: "utf8",
        }),
      );
    } catch {
      continue;
    }
    const current = JSON.parse(await readFile(file, "utf8"));
    drift.push(
      ...compareV1Schemas(previous, current).map(
        (finding) => `${relative}: ${finding}`,
      ),
    );
  }
  try {
    const previousManifest = JSON.parse(
      execFileSync(
        "git",
        ["show", `${compatibilityBase}:deployments/ethereum.json`],
        { cwd: REPOSITORY_ROOT, encoding: "utf8" },
      ),
    );
    drift.push(
      ...compareDeploymentManifests(previousManifest, manifest).map(
        (finding) => `deployments/ethereum.json: ${finding}`,
      ),
    );
  } catch {
    // The initial public release has no historical deployment manifest.
  }
  if (drift.length > 0) {
    throw new Error(`Breaking v1 compatibility drift:\n${drift.join("\n")}`);
  }
}

process.stdout.write(
  `Conformance OK: ${registry.files.length + v2Registry.files.length} schemas, ${launchFiles.length + v2LaunchFiles.length} launch fixtures, ${testFiles.length} test files, ${jsonCount} canonical JSON files\n`,
);
