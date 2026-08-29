#!/usr/bin/env node

import { open } from "node:fs/promises";
import path from "node:path";

import { readBoundedBytes } from "../server/bounded-body.js";
import {
  validateGitHubArtifactEvidence,
  validateGitHubRunEvidence,
} from "./lib/vercel-release.mjs";
import { parseJsonStrict } from "./lib/files.mjs";

const REPOSITORY = "programmablehq/Developers";
const RUN_ID = /^[1-9][0-9]*$/u;

function fail(message) {
  throw new TypeError(message);
}

function options(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--") ||
      values.has(key)) fail(`invalid GitHub evidence option near ${key ?? "<end>"}`);
    values.set(key, value);
  }
  const allowed = ["--run-id", "--run-attempt", "--artifact-name", "--run-output",
    "--artifact-output"];
  for (const key of values.keys()) {
    if (!allowed.includes(key)) fail(`unsupported GitHub evidence option ${key}`);
  }
  const result = Object.fromEntries(allowed.map((key) => [key.slice(2), values.get(key)]));
  if (Object.values(result).some((value) => !value) || !RUN_ID.test(result["run-id"]) ||
    !RUN_ID.test(result["run-attempt"])) fail("all GitHub evidence options are required");
  return result;
}

async function writeJson(file, value) {
  const handle = await open(path.resolve(file), "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2026-03-10",
    },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) fail(`GitHub evidence request failed with HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json\b/iu.test(contentType)) {
    fail("GitHub evidence response is not JSON");
  }
  const bytes = await readBoundedBytes(response, 16 * 1024 * 1024,
    "GitHub evidence response");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return parseJsonStrict(source, "GitHub evidence response");
}

const input = options(process.argv.slice(2));
const token = process.env.GITHUB_TOKEN;
if (!token) fail("GITHUB_TOKEN is required for read-only Actions evidence");
const base = `https://api.github.com/repos/${REPOSITORY}/actions/runs/${input["run-id"]}`;
const runRaw = await githubJson(base, token);
const run = validateGitHubRunEvidence(runRaw, {
  runId: input["run-id"],
  runAttempt: input["run-attempt"],
});
const artifactsRaw = await githubJson(`${base}/artifacts?per_page=100`, token);
const artifact = validateGitHubArtifactEvidence(artifactsRaw, {
  name: input["artifact-name"],
  runId: run.runId,
  runAttempt: run.runAttempt,
  sourceRevision: run.sourceRevision,
});
await writeJson(input["run-output"], run);
await writeJson(input["artifact-output"], artifact);
process.stdout.write(`GitHub run ${run.runId}/${run.runAttempt} evidence sealed read-only.\n`);
