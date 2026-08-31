#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstat, mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { parseJsonStrict } from "./lib/files.mjs";
import {
  PRODUCTION_ORIGIN, VERCEL_PRODUCTION_ORIGIN, assertVercelProjectBinding,
} from "./lib/vercel-release.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BYTES = 32 * 1024 * 1024;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/u;
const HOSTS = [PRODUCTION_ORIGIN, VERCEL_PRODUCTION_ORIGIN]
  .map((origin) => new URL(origin).hostname);

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function sameArgs(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

export function projectContext(environment) {
  const { VERCEL_TOKEN: token, VERCEL_ORG_ID: orgId,
    VERCEL_PROJECT_ID: projectId } = environment;
  requireValue(typeof token === "string" && token.length >= 16
    && !/[\s\x00-\x1f\x7f]/u.test(token)
    && /^team_[A-Za-z0-9]+$/u.test(orgId ?? "")
    && /^prj_[A-Za-z0-9]+$/u.test(projectId ?? ""),
  "Exact Vercel token, organization, and project are required");
  return { token, orgId, projectId };
}

export function stripBoundScope(argv, orgId) {
  const output = [];
  let seen = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--scope") {
      requireValue(!seen && argv[index + 1] === orgId,
        "Vercel scope must equal the protected organization");
      seen = true;
      index += 1;
    } else {
      requireValue(!argv[index].startsWith("--scope=")
        && !["--token", "--team", "--project", "--local-config", "--global-config"]
          .some((flag) => argv[index] === flag || argv[index].startsWith(`${flag}=`)),
      "Vercel context overrides are not allowed");
      output.push(argv[index]);
    }
  }
  return output;
}

export function createProjectApi(context, fetchImpl = fetch) {
  return async (resource, { method = "GET", body } = {}) => {
    const projectRoutes = [
      `/v9/projects/${context.projectId}`,
      `/v9/projects/${context.projectId}?rollbackInfo=true`,
      `/v9/projects/${context.projectId}/domains?limit=100`,
      `/v3/env/pull/${context.projectId}/production?source=vercel-cli%3Apull`,
    ];
    const readAllowed = projectRoutes.includes(resource)
      || HOSTS.some((host) => resource === `/v4/aliases/${host}`
        || resource === `/v13/deployments/${host}`)
      || /^\/v13\/deployments\/dpl_[A-Za-z0-9]+$/u.test(resource);
    const promotionPrefix = `/v10/projects/${context.projectId}/promote/`;
    requireValue((method === "GET" && body === undefined && readAllowed)
      || (method === "POST" && resource.startsWith(promotionPrefix)
        && DEPLOYMENT_ID.test(resource.slice(promotionPrefix.length))
        && JSON.stringify(body) === "{}"),
    "Vercel resource is outside the release project");
    const url = new URL(resource, "https://api.vercel.com");
    requireValue(url.origin === "https://api.vercel.com"
      && !url.searchParams.has("teamId") && !url.searchParams.has("slug"),
    "Vercel resource cannot override the protected organization");
    url.searchParams.set("teamId", context.orgId);
    let response;
    try {
      response = await fetchImpl(url, {
        method, redirect: "error", signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${context.token}`,
          Accept: "application/json", ...(body === undefined ? {}
            : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new TypeError(method === "POST"
        ? "Vercel promotion outcome unknown; use read-only recovery, never retry blindly"
        : "Vercel project request failed");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new TypeError(`Vercel project request returned HTTP ${response.status}; no retry performed`);
    }
    const chunks = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (reader) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          requireValue(size <= MAX_BYTES, "Vercel response exceeds the size bound");
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
    }
    if (size === 0) return { httpStatus: response.status };
    try {
      return parseJsonStrict(Buffer.concat(chunks).toString("utf8"), "Vercel response");
    } catch { throw new TypeError("Vercel returned invalid JSON"); }
  };
}

function assertProject(project, context) {
  requireValue(project?.id === context.projectId && project.accountId === context.orgId
    && typeof project.name === "string" && /^[A-Za-z0-9_-]+$/u.test(project.name),
  "Vercel project does not match the protected project and organization");
}

async function localLink(root, context) {
  const directory = path.join(root, ".vercel");
  const filename = path.join(directory, "project.json");
  const [directoryStat, fileStat] = await Promise.all([lstat(directory), lstat(filename)]);
  requireValue(directoryStat.isDirectory() && !directoryStat.isSymbolicLink()
    && fileStat.isFile() && !fileStat.isSymbolicLink() && fileStat.size <= MAX_BYTES,
  "Vercel link must be a bounded regular file");
  const link = parseJsonStrict(await readFile(filename, "utf8"), "Vercel project link");
  requireValue(link.orgId === context.orgId && link.projectId === context.projectId,
    "Vercel local project binding differs");
  return link;
}

export async function pullProject(root, context, api) {
  const project = await api(`/v9/projects/${context.projectId}`);
  assertProject(project, context);
  requireValue(project.rootDirectory === null || project.rootDirectory === ""
    || project.rootDirectory === undefined || project.rootDirectory === ".",
  "Vercel release requires the repository-root project");
  const pulled = await api(`/v3/env/pull/${context.projectId}/production?source=vercel-cli%3Apull`);
  requireValue(pulled?.env && typeof pulled.env === "object" && !Array.isArray(pulled.env),
    "Vercel production environment response is invalid");
  const entries = Object.entries(pulled.env).sort(([a], [b]) => a.localeCompare(b));
  requireValue(entries.every(([key, value]) => /^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)
    && typeof value === "string" && !value.includes("\0")),
  "Vercel production environment contains an invalid entry");
  const directory = path.join(root, ".vercel");
  await mkdir(directory, { mode: 0o700 });
  const settings = Object.fromEntries([
    "createdAt", "framework", "devCommand", "installCommand", "buildCommand",
    "outputDirectory", "rootDirectory", "directoryListing", "nodeVersion",
  ].filter((key) => project[key] !== undefined).map((key) => [key, project[key]]));
  if (project.analytics?.id && (!project.analytics.disabledAt
    || project.analytics.enabledAt > project.analytics.disabledAt)) {
    settings.analyticsId = project.analytics.id;
  }
  const link = { projectId: project.id, orgId: project.accountId,
    projectName: project.name, settings };
  const ignored = ["VERCEL_ANALYTICS_ID", "VERCEL_SPEED_INSIGHTS_ID", "VERCEL_WEB_ANALYTICS_ID"];
  // Match the pinned CLI env-pull representation; never print environment values.
  const envText = "# Source-bound Vercel production environment\n"
    + entries.filter(([key]) => !ignored.includes(key)).map(([key, value]) =>
      `${key}="${value.replaceAll("\n", "\\n").replaceAll("\r", "\\r")}"`).join("\n") + "\n";
  for (const [name, contents] of [["project.json", `${JSON.stringify(link, null, 2)}\n`],
    [".env.production.local", envText]]) {
    const handle = await open(path.join(directory, name), "wx", 0o600);
    try { await handle.writeFile(contents, "utf8"); } finally { await handle.close(); }
  }
}

function deploymentSelector(value) {
  if (DEPLOYMENT_ID.test(value ?? "")) return value;
  requireValue([PRODUCTION_ORIGIN, VERCEL_PRODUCTION_ORIGIN].includes(value),
    "Vercel deployment selector is not an approved ID or origin");
  return new URL(value).hostname;
}

async function readDeployment(selector, context, api) {
  const target = deploymentSelector(selector);
  const deployment = await api(`/v13/deployments/${target}`);
  assertVercelProjectBinding(deployment, context, context);
  requireValue(DEPLOYMENT_ID.test(deployment.id ?? "")
    && (!DEPLOYMENT_ID.test(target) || deployment.id === target),
  "Vercel deployment differs from the selected immutable ID");
  return deployment;
}

export async function runProjectCommand(argv, {
  root = ROOT, environment = process.env, fetchImpl = fetch,
  now = Date.now, wait = delay, execute = spawnSync,
} = {}) {
  const context = projectContext(environment);
  const [command, ...args] = stripBoundScope(argv, context.orgId);
  const api = createProjectApi(context, fetchImpl);
  if (command === "pull") {
    requireValue(sameArgs(args, ["--yes", "--environment=production"]),
      "Only the exact production project pull is allowed");
    await pullProject(root, context, api);
    return "Exact Vercel project binding and protected environment downloaded.\n";
  }
  await localLink(root, context);
  if (command === "build" || command === "deploy") {
    if (command === "build") {
      requireValue(sameArgs(args, ["--prod"]), "Only the exact production build is allowed");
    } else {
      const required = ["--prebuilt", "--target=production", "--skip-domain", "--yes", "--json"];
      requireValue(sameArgs(args.slice(0, required.length), required),
        "Only prebuilt production staging without domains is allowed");
      const metadata = args.slice(required.length);
      requireValue(metadata.length === 6 && metadata.every((value, index) => index % 2 === 0
        ? value === "--meta" : /^(programmableSourceRevision=[0-9a-f]{40}|programmableSourceTree=[0-9a-f]{40}|programmableReleaseMode=planned|programmableStageBundleDigest=sha256:[0-9a-f]{64})$/u.test(value)),
      "Vercel deployment metadata is invalid");
      const keys = metadata.filter((_, index) => index % 2 === 1).map((value) => value.split("=")[0]);
      requireValue(new Set(keys).size === 3 && keys.includes("programmableSourceRevision")
        && keys.includes("programmableSourceTree"), "Vercel source metadata is incomplete");
    }
    const version = JSON.parse(await readFile(path.join(root,
      "node_modules/vercel/package.json"), "utf8")).version;
    requireValue(version === "59.10.0", "Vercel CLI version differs from the reviewed version");
    const childEnv = { ...environment };
    delete childEnv.APP_PRINCIPAL_ENABLED;
    const result = execute(process.execPath, [path.join(root,
      "node_modules/vercel/dist/index.js"), command, ...args],
    { cwd: root, env: childEnv, stdio: "inherit" });
    requireValue(result.status === 0, "Vercel project build or deployment failed");
    return "";
  }
  if (command === "inspect") {
    requireValue(args.length === 5 && sameArgs(args.slice(1),
      ["--wait", "--timeout", "10m", "--json"]), "Vercel inspection arguments are invalid");
    const until = now() + 600_000;
    for (;;) {
      const value = await readDeployment(args[0], context, api);
      if (value.readyState === "READY") return `${JSON.stringify(value)}\n`;
      requireValue(["INITIALIZING", "BUILDING", "QUEUED"].includes(value.readyState)
        && now() < until, "Vercel deployment is not READY");
      await wait(1000);
    }
  }
  if (command === "api") {
    requireValue(args.length === 2 && args[1] === "--raw", "Only exact provider GET queries are allowed");
    const resource = args[0];
    requireValue(resource === `/v9/projects/${context.projectId}`
      || resource === `/v9/projects/${context.projectId}/domains?limit=100`
      || HOSTS.some((host) => resource === `/v4/aliases/${host}`)
      || /^\/v13\/deployments\/dpl_[A-Za-z0-9]+$/u.test(resource),
    "Provider query is outside the release project");
    const value = await api(resource);
    if (resource === `/v9/projects/${context.projectId}`) assertProject(value, context);
    if (resource.startsWith("/v13/deployments/")) {
      assertVercelProjectBinding(value, context, context);
      requireValue(value.id === resource.slice("/v13/deployments/".length),
        "Vercel deployment differs from the selected immutable ID");
    }
    return `${JSON.stringify(value)}\n`;
  }
  requireValue(command === "promote" && args.length === 2
    && DEPLOYMENT_ID.test(args[0]) && args[1] === "--yes",
  "Vercel project command is not allowed");
  const [project, deployment] = await Promise.all([
    api(`/v9/projects/${context.projectId}?rollbackInfo=true`),
    readDeployment(args[0], context, api),
  ]);
  assertProject(project, context);
  requireValue(deployment.target === "production" && deployment.readyState === "READY"
    && !project.rollingRelease, "Only the exact READY production deployment may be promoted");
  const requestedAt = now();
  // One request only. An unknown response is resolved by the existing recovery workflow.
  await api(`/v10/projects/${context.projectId}/promote/${deployment.id}`,
    { method: "POST", body: {} });
  for (;;) {
    const current = await api(`/v9/projects/${context.projectId}?rollbackInfo=true`);
    assertProject(current, context);
    const request = current.lastAliasRequest;
    requireValue(request?.toDeploymentId === deployment.id && request.type === "promote"
      && Number.isSafeInteger(request.requestedAt) && request.requestedAt >= requestedAt - 30_000
      && !current.rollingRelease, "Vercel promotion readback differs; use read-only recovery");
    if (request.jobStatus === "succeeded") return "Exact Vercel promotion completed; public readback remains required.\n";
    requireValue(["pending", "in-progress"].includes(request.jobStatus)
      && now() - requestedAt < 180_000, "Vercel promotion not confirmed; use read-only recovery");
    await wait(1000);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(await runProjectCommand(process.argv.slice(2))); }
  catch (error) {
    process.stderr.write(`${error instanceof TypeError ? error.message : "Vercel project operation failed"}\n`);
    process.exitCode = 1;
  }
}
