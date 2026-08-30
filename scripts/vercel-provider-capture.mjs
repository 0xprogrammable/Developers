#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRODUCTION_ORIGIN,
  assertVercelDeploymentMetadata,
  assertVercelProjectBinding,
  createVercelPublicDeploymentResolution,
  createStageProtectionEvidence,
  normalizeVercelDeployment,
  releaseSource,
  releaseTarget,
} from "./lib/vercel-release.mjs";
import { parseJsonStrict } from "./lib/files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERCEL = path.join(ROOT, "node_modules", ".bin", "vercel");
const MAX_BYTES = 32 * 1024 * 1024;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/u;

function fail(message) {
  throw new TypeError(message);
}

function argumentsMap(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--") ||
      values.has(key)) {
      fail(`invalid provider-capture option near ${key ?? "<end>"}`);
    }
    values.set(key, value);
  }
  const allowed = [
    "--selector", "--output", "--protection-output", "--source-revision", "--source-tree",
    "--stage-bundle-digest", "--release-mode",
  ];
  for (const key of values.keys()) {
    if (!allowed.includes(key)) fail(`unsupported provider-capture option ${key}`);
  }
  const selector = values.get("--selector");
  const output = values.get("--output");
  if (!selector || !output) fail("--selector and --output are required");
  if (selector !== PRODUCTION_ORIGIN && !DEPLOYMENT_ID.test(selector)) {
    fail("--selector must be the public origin or a Vercel deployment ID");
  }
  const releaseMode = values.get("--release-mode") ?? null;
  if (releaseMode !== null && releaseMode !== "planned") {
    fail("--release-mode may select only planned readback");
  }
  const source = ["--source-revision", "--source-tree", "--stage-bundle-digest"]
    .map((key) => values.get(key));
  if (releaseMode === "planned") {
    if (!source[0] || !source[1] || source[2]) {
      fail("planned readback requires source revision and tree without a phase bundle digest");
    }
  } else if (source.some(Boolean) && !source.every(Boolean)) {
    fail("stage source revision, tree, and Phase-A bundle digest are all-or-none");
  }
  if (values.has("--protection-output") && !DEPLOYMENT_ID.test(selector)) {
    fail("protection evidence requires an immutable Vercel deployment ID");
  }
  return {
    selector,
    output,
    protectionOutput: values.get("--protection-output"),
    source,
    releaseMode,
  };
}

async function boundedJson(file, label) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.size > MAX_BYTES) {
    fail(`${label} must be a bounded regular JSON file`);
  }
  try {
    return parseJsonStrict(await readFile(file, "utf8"), label);
  } catch {
    fail(`${label} is not valid JSON`);
  }
}

async function writeJson(file, value) {
  const absolute = path.resolve(file);
  const handle = await open(absolute, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

function vercelJson(args, label) {
  let stdout;
  try {
    stdout = execFileSync(VERCEL, args, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: MAX_BYTES,
      env: process.env,
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch {
    fail(`${label} failed`);
  }
  try {
    return parseJsonStrict(stdout, label);
  } catch {
    fail(`${label} did not return JSON`);
  }
}

const { selector, output, protectionOutput, source, releaseMode } =
  argumentsMap(process.argv.slice(2));
const token = process.env.VERCEL_TOKEN;
const orgId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;
if (!token || !orgId || !projectId) fail("Vercel token, organization, and project are required");
// Vercel reads VERCEL_TOKEN from the inherited environment. Keep the secret out
// of the child process argument vector while retaining an explicit scope.
const auth = ["--scope", orgId];
const inspect = vercelJson([
  "inspect", selector, "--wait", "--timeout", "10m", "--json", ...auth,
], "Vercel deployment inspection");
const deploymentId = inspect.id;
if (!DEPLOYMENT_ID.test(deploymentId)) fail("Vercel inspection returned an invalid deployment ID");
const api = vercelJson([
  "api", `/v13/deployments/${deploymentId}`, "--raw", ...auth,
], "Vercel deployment API query");
const link = await boundedJson(path.join(ROOT, ".vercel", "project.json"),
  "Vercel project link");
const target = releaseTarget(orgId, projectId);
assertVercelProjectBinding(api, link, target);
const deployment = normalizeVercelDeployment({ inspectOutput: inspect, apiOutput: api });
if (releaseMode === "planned") {
  if (DEPLOYMENT_ID.test(selector) && deployment.aliases.length !== 0) {
    fail("planned candidate must remain unaliased until its public smoke succeeds");
  }
  assertVercelDeploymentMetadata(api, {
    source: releaseSource(source[0], source[1]),
    releaseMode,
  });
} else if (source.every(Boolean)) {
  assertVercelDeploymentMetadata(api, {
    source: releaseSource(source[0], source[1]),
    stageBundleDigest: source[2],
  });
}
const publicResolution = selector === PRODUCTION_ORIGIN
  ? createVercelPublicDeploymentResolution({
    origin: selector,
    deployment,
    target,
    checkedAt: new Date().toISOString(),
  })
  : undefined;
await writeJson(output, {
  target,
  deployment,
  ...(publicResolution ? { publicResolution } : {}),
});

if (protectionOutput) {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    fail("provider protection capture must not receive the automation bypass secret");
  }
  const projectProtection = vercelJson([
    "api", `/v9/projects/${projectId}`, "--raw", ...auth,
  ], "Vercel project protection query");
  const response = await fetch(`${deployment.url}/api/v2/status?chainId=4663`, {
    headers: { accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const evidence = createStageProtectionEvidence({
    deployment,
    projectId,
    projectProtection,
    response: {
      status: response.status,
      location: response.headers.get("location"),
      server: response.headers.get("server"),
      vercelId: response.headers.get("x-vercel-id"),
    },
    checkedAt: new Date().toISOString(),
  });
  await response.body?.cancel();
  await writeJson(protectionOutput, evidence);
}

process.stdout.write(`Provider capture sealed for ${deployment.id}; no public mutation performed.\n`);
