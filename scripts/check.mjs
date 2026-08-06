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
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const registry = await createSchemaRegistry();
const v2Registry = await createSchemaRegistry("v2");
const testFiles = await listFiles(
  path.join(REPOSITORY_ROOT, "tests"),
  (file) => file.endsWith(".test.mjs"),
);
if (testFiles.length === 0) throw new Error("No tests/*.test.mjs files found");
const jsonRoots = ["schemas", "fixtures", "compatibility", "deployments"];
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
if (v2Manifest.deployments.some((deployment) => deployment.modelId !== "classic")) {
  throw new Error("Version 2 manifest may only list Classic deployments before Custom Registry activation");
}

const v2Core = await readJson(
  path.join(REPOSITORY_ROOT, "compatibility", "core-v2.json"),
);
if (
  v2Core.classification?.classic?.label !== "Programmable Classic" ||
  v2Core.classification?.custom?.label !== "Programmable Custom" ||
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
