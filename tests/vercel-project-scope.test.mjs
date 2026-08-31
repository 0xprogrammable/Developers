import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createProjectApi, projectContext, runProjectCommand, stripBoundScope }
  from "../scripts/vercel-project-scope.mjs";

const environment = { VERCEL_TOKEN: "test-project-token-never-log",
  VERCEL_ORG_ID: "team_expected", VERCEL_PROJECT_ID: "prj_expected" };
const context = projectContext(environment);
const project = { id: context.projectId, accountId: context.orgId,
  name: "programmable-developers", rootDirectory: null, framework: null,
  nodeVersion: "24.x", buildCommand: "npm run build", outputDirectory: "public" };
const deployment = { id: "dpl_expected", projectId: context.projectId,
  ownerId: context.orgId, target: "production", readyState: "READY",
  url: "programmable-developers-example.vercel.app", createdAt: 1,
  alias: [] };

async function fixture(t, { linked = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "developers-project-scope-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  if (linked) {
    await mkdir(path.join(root, ".vercel"));
    await writeFile(path.join(root, ".vercel/project.json"), JSON.stringify({
      orgId: context.orgId, projectId: context.projectId, projectName: project.name,
    }));
  }
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: new URL(url), options });
    assert.equal(url.origin, "https://api.vercel.com");
    assert.equal(url.searchParams.get("teamId"), context.orgId);
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, `Bearer ${context.token}`);
    if (url.pathname.startsWith("/v13/deployments/")) return Response.json(deployment);
    if (url.pathname === `/v9/projects/${context.projectId}`) return Response.json(project);
    if (url.pathname.startsWith("/v3/env/pull/")) return Response.json({ env: {
      PUBLIC_VALUE: "fixture-value", PRIVATE_VALUE: "test-private-value-never-log",
    } });
    throw new Error("unexpected endpoint");
  };
  return { root, requests, fetchImpl, environment };
}

test("only matching protected scope is removed; account and context overrides fail closed", () => {
  assert.deepEqual(stripBoundScope(["pull", "--scope", context.orgId, "--yes"], context.orgId),
    ["pull", "--yes"]);
  for (const args of [["pull", "--scope", "team_other"],
    ["pull", "--scope", context.orgId, "--scope", context.orgId],
    ["pull", "--scope=team_expected"], ["deploy", "--token=unexpected"],
    ["deploy", "--project", "prj_other"], ["deploy", "--global-config", "/tmp/config"]]) {
    assert.throws(() => stripBoundScope(args, context.orgId));
  }
  assert.throws(() => projectContext({ ...environment, VERCEL_PROJECT_ID: "" }));
});

test("project-only pull binds owner and project and writes protected files without printing values", async (t) => {
  const f = await fixture(t, { linked: false });
  const output = await runProjectCommand(["pull", "--yes", "--environment=production",
    "--scope", context.orgId], f);
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests.some(({ url }) => /\/(teams|user)(\/|$)/u.test(url.pathname)), false);
  assert.doesNotMatch(output, /test-private-value|test-project-token/u);
  const link = JSON.parse(await readFile(path.join(f.root, ".vercel/project.json"), "utf8"));
  assert.equal(link.projectId, context.projectId);
  assert.equal(link.orgId, context.orgId);
  assert.equal(link.settings.buildCommand, project.buildCommand);
  for (const name of ["project.json", ".env.production.local"]) {
    assert.equal((await stat(path.join(f.root, ".vercel", name))).mode & 0o777, 0o600);
  }
  assert.equal((await stat(path.join(f.root, ".vercel"))).mode & 0o777, 0o700);
  assert.match(await readFile(path.join(f.root, ".vercel/.env.production.local"), "utf8"),
    /PRIVATE_VALUE="test-private-value-never-log"/u);
});

test("project mismatch stops before environment access or local writes", async (t) => {
  const f = await fixture(t, { linked: false });
  let count = 0;
  f.fetchImpl = async () => { count += 1; return Response.json({ ...project, accountId: "team_other" }); };
  await assert.rejects(runProjectCommand(["pull", "--yes", "--environment=production"], f));
  assert.equal(count, 1);
  await assert.rejects(stat(path.join(f.root, ".vercel")), { code: "ENOENT" });
});

test("inspect and raw deployment readback preserve exact provider identity", async (t) => {
  const f = await fixture(t);
  const inspected = await runProjectCommand(["inspect", deployment.id, "--wait",
    "--timeout", "10m", "--json", "--scope", context.orgId], f);
  assert.deepEqual(JSON.parse(inspected), deployment);
  const raw = await runProjectCommand(["api", `/v13/deployments/${deployment.id}`, "--raw"], f);
  assert.deepEqual(JSON.parse(raw), deployment);
  f.fetchImpl = async () => Response.json({ ...deployment, ownerId: "team_other" });
  await assert.rejects(runProjectCommand(["inspect", deployment.id, "--wait",
    "--timeout", "10m", "--json"], f), /not bound/u);
});

test("provider transport cannot query accounts, other projects, foreign hosts, or arbitrary mutations", async () => {
  let requests = 0;
  const api = createProjectApi(context, async () => { requests += 1; return Response.json({}); });
  for (const resource of ["/v2/user", "/teams/team_expected", "/v9/projects/prj_other",
    "https://example.test/v9/projects/prj_expected", "/v9/projects/prj_expected?teamId=team_other",
    "/v13/deployments/../user"]) await assert.rejects(api(resource));
  await assert.rejects(api(`/v9/projects/${context.projectId}`, { method: "DELETE" }));
  await assert.rejects(api(`/v10/projects/${context.projectId}/promote/dpl_expected`,
    { method: "POST", body: { unexpected: true } }));
  assert.equal(requests, 0);
});

test("provider errors and redirects fail closed without secret or response-body logging", async () => {
  for (const status of [302, 401, 403, 500]) {
    const api = createProjectApi(context, async () => new Response(context.token, { status }));
    await assert.rejects(api(`/v9/projects/${context.projectId}`), (error) =>
      !error.message.includes(context.token) && error.message.includes(String(status)));
  }
});

test("build and prebuilt stage delegate only to the pinned CLI with explicit project env and no account scope", async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, "node_modules/vercel"), { recursive: true });
  await writeFile(path.join(f.root, "node_modules/vercel/package.json"), '{"version":"59.10.0"}');
  const calls = [];
  f.execute = (binary, args, options) => { calls.push({ binary, args, options }); return { status: 0 }; };
  f.environment = { ...environment, APP_PRINCIPAL_ENABLED: "unwanted" };
  await runProjectCommand(["build", "--prod", "--scope", context.orgId], f);
  await runProjectCommand(["deploy", "--prebuilt", "--target=production", "--skip-domain",
    "--yes", "--json", "--scope", context.orgId,
    "--meta", `programmableSourceRevision=${"a".repeat(40)}`,
    "--meta", `programmableSourceTree=${"b".repeat(40)}`,
    "--meta", "programmableReleaseMode=planned"], f);
  assert.equal(calls.length, 2);
  for (const { args, options } of calls) {
    assert.equal(args.includes("--scope"), false);
    assert.equal(args.some((arg) => arg.includes(context.token)), false);
    assert.equal(options.env.VERCEL_PROJECT_ID, context.projectId);
    assert.equal(options.env.APP_PRINCIPAL_ENABLED, undefined);
  }
  await assert.rejects(runProjectCommand(["deploy", "--prod", "--yes"], f));
  assert.equal(calls.length, 2);
});

test("promotion is exact-project READY production only and sends one POST followed by readback", async (t) => {
  const f = await fixture(t);
  let posts = 0;
  const baseFetch = f.fetchImpl;
  f.now = () => 100_000;
  f.fetchImpl = async (url, options) => {
    if (options.method === "POST") {
      posts += 1;
      assert.equal(url.pathname, `/v10/projects/${context.projectId}/promote/${deployment.id}`);
      assert.equal(options.body, "{}");
      return new Response(null, { status: 200 });
    }
    if (posts && url.pathname === `/v9/projects/${context.projectId}`) return Response.json({
      ...project, lastAliasRequest: { type: "promote", toDeploymentId: deployment.id,
        requestedAt: 100_000, jobStatus: "succeeded" },
    });
    return baseFetch(url, options);
  };
  assert.match(await runProjectCommand(["promote", deployment.id, "--yes"], f), /completed/u);
  assert.equal(posts, 1);
  f.fetchImpl = async (url, options) => {
    if (options.method === "POST") { posts += 1; throw new Error(context.token); }
    return baseFetch(url, options);
  };
  await assert.rejects(runProjectCommand(["promote", deployment.id, "--yes"], f),
    /outcome unknown; use read-only recovery/u);
  assert.equal(posts, 2);
});

test("preview, non-ready, foreign-project and changed-ID deployments never authorize promotion", async (t) => {
  for (const change of [{ target: "preview" }, { readyState: "BUILDING" },
    { projectId: "prj_other" }, { id: "dpl_other" }]) {
    const f = await fixture(t);
    let posts = 0;
    f.fetchImpl = async (url, options) => {
      if (options.method === "POST") posts += 1;
      return Response.json(url.pathname.startsWith("/v13/deployments/")
        ? { ...deployment, ...change } : project);
    };
    await assert.rejects(runProjectCommand(["promote", deployment.id, "--yes"], f));
    assert.equal(posts, 0);
  }
});
