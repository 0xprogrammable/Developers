#!/usr/bin/env node

import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";

import { readBoundedBytes } from "../server/bounded-body.js";
import { canonicalSha256 } from "../server/canonical.js";
import {
  createRouterCustomAcceptedMembership,
  readRouterCustomRecords,
} from "../server/router-custom.js";
import {
  createSmokeReceipt,
  parsePromotionBundle,
  parseStageBundle,
  validateLiveRobinhoodManifest,
  validatePlannedRobinhoodManifest,
} from "./lib/vercel-release.mjs";
import { parseJsonStrict } from "./lib/files.mjs";
import { assertValid, createSchemaRegistry } from "./lib/schema.mjs";
import {
  assertNoFindings,
  validateFeedSemantics,
  validateLaunchSemantics,
  validateManifestSemantics,
} from "./lib/semantics.mjs";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_JSON_BYTES = 32 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

function fail(message) {
  throw new TypeError(message);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--") ||
      values.has(key)) {
      fail(`invalid chain-4663 smoke option near ${key ?? "<end>"}`);
    }
    values.set(key, value);
  }
  for (const key of values.keys()) {
    if (!["--mode", "--bundle-phase", "--bundle", "--protection-bypass", "--output"]
      .includes(key)) {
      fail(`unsupported chain-4663 smoke option ${key}`);
    }
  }
  const mode = values.get("--mode");
  if (!["planned", "live"].includes(mode)) fail("--mode must be planned or live");
  const bundle = values.get("--bundle");
  const bundlePhase = values.get("--bundle-phase");
  if ((mode === "live") !== Boolean(bundle)) {
    fail("--bundle is required exactly when --mode is live");
  }
  if (mode === "live" && !["stage", "promotion"].includes(bundlePhase)) {
    fail("--bundle-phase must be stage or promotion when --mode is live");
  }
  if (mode === "planned" && bundlePhase !== undefined) {
    fail("--bundle-phase is forbidden when --mode is planned");
  }
  const output = values.get("--output");
  if (!output) fail("--output is required");
  const protectionBypass = values.get("--protection-bypass") ?? "false";
  if (!["true", "false"].includes(protectionBypass)) {
    fail("--protection-bypass must be true or false");
  }
  if (mode === "planned" && protectionBypass === "true") {
    fail("planned/public smoke may not use a Vercel protection bypass");
  }
  if (mode === "live" && bundlePhase === "stage" && protectionBypass !== "true") {
    fail("a Phase-A bundle may be used only for a protected dark-stage smoke");
  }
  return {
    mode,
    bundlePhase: bundlePhase ?? null,
    bundle,
    protectionBypass: protectionBypass === "true",
    output,
  };
}

async function readJson(file, label) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.size > MAX_JSON_BYTES) {
    fail(`${label} must be a bounded regular file`);
  }
  try {
    return parseJsonStrict(await readFile(file, "utf8"), label);
  } catch {
    fail(`${label} is not strict JSON`);
  }
}

async function writeJson(file, value) {
  const handle = await open(path.resolve(file), "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
}

function apiRoot(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("PROGRAMMABLE_API_BASE must be an absolute HTTPS URL");
  }
  const loopbackHttp = parsed.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  if ((parsed.protocol !== "https:" && !loopbackHttp) || parsed.username ||
    parsed.password || parsed.search || parsed.hash || !parsed.hostname) {
    fail("PROGRAMMABLE_API_BASE must be a credential-free HTTPS origin or loopback URL");
  }
  const normalizedPath = parsed.pathname.replace(/\/+$/u, "") || "/";
  if (normalizedPath !== "/" && normalizedPath !== "/api/v2") {
    fail("PROGRAMMABLE_API_BASE path must be / or /api/v2");
  }
  return { origin: parsed.origin, apiBase: `${parsed.origin}/api/v2` };
}

function bypassHeaders(enabled, origin) {
  if (!enabled) return {};
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret || !new URL(origin).hostname.endsWith(".vercel.app")) {
    fail("protection bypass requires a verified Vercel generated deployment origin and secret");
  }
  return { "x-vercel-protection-bypass": secret };
}

async function boundedJson(apiBase, requestPath, validator, headers) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}${requestPath}`, {
        headers: { accept: "application/json", ...headers },
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!/^application\/(?:problem\+)?json\b/iu.test(contentType)) {
        throw new Error(`unexpected content-type ${contentType || "<missing>"}`);
      }
      const bytes = await readBoundedBytes(response, MAX_BYTES, `${requestPath} response`);
      const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const value = parseJsonStrict(source, `${requestPath} response`);
      assertValid(validator, value, requestPath);
      if (!response.headers.get("cache-control") || !response.headers.get("etag")) {
        throw new Error(`${requestPath} is missing Cache-Control or ETag`);
      }
      return { response, value };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw new Error(
    `${requestPath} failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message ?? "unknown"}`,
  );
}

function apiStatus(result, label, expected) {
  const actual = result.response.headers.get("x-programmable-status");
  if (actual !== expected) {
    fail(`${label} x-programmable-status ${actual ?? "<missing>"} differs from ${expected}`);
  }
}

function assertRecent(value, label, maximumAgeMs) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) fail(`${label} is not a timestamp`);
  const age = Date.now() - timestamp;
  if (age < -60_000 || age > maximumAgeMs) {
    fail(`${label} is outside the allowed freshness window`);
  }
}

const { mode, bundlePhase, bundle: bundlePath, protectionBypass, output } =
  parseArguments(process.argv.slice(2));
const configuredBase = process.env.PROGRAMMABLE_API_BASE;
if (!configuredBase) fail("PROGRAMMABLE_API_BASE is required");
const { origin, apiBase } = apiRoot(configuredBase);
const requestHeaders = bypassHeaders(protectionBypass, origin);
const bundle = bundlePath ? await readJson(bundlePath, `${bundlePhase} bundle`) : undefined;
const promotion = bundle
  ? (bundlePhase === "stage" ? parseStageBundle(bundle) : parsePromotionBundle(bundle))
  : undefined;
const registry = await createSchemaRegistry("v2");

const [manifestResult, statusResult, feedResult, tokenResult] = await Promise.all([
  boundedJson(apiBase, "/manifests/4663", registry.validator("manifest.schema.json"),
    requestHeaders),
  boundedJson(apiBase, "/status?chainId=4663", registry.validator("status.schema.json"),
    requestHeaders),
  boundedJson(apiBase, "/launches?chainId=4663&limit=100",
    registry.validator("launch-feed.schema.json"), requestHeaders),
  boundedJson(apiBase, "/token-list?chainId=4663",
    registry.validator("token-list.schema.json"), requestHeaders),
]);

assertNoFindings(validateManifestSemantics(manifestResult.value), "chain-4663 smoke manifest");
assertNoFindings(validateFeedSemantics(feedResult.value), "chain-4663 smoke feed");

if (mode === "live") {
  validateLiveRobinhoodManifest(manifestResult.value, promotion);
  apiStatus(manifestResult, "manifest", "ready");
  apiStatus(statusResult, "status", "ready");
  apiStatus(feedResult, "launches", "ready");
  apiStatus(tokenResult, "token-list", "ready");
  if (statusResult.value.service !== "operational" ||
    statusResult.value.custom?.status !== "live" ||
    statusResult.value.customLaunchV4?.status !== "live" ||
    statusResult.value.customLaunchV4?.chainDeploymentDescriptorDigest !==
      promotion.descriptorDigest ||
    statusResult.value.feeds?.launches !== "ready" ||
    statusResult.value.feeds?.tokenList !== "ready" ||
    statusResult.value.routerCustom?.status !== "current" ||
    statusResult.value.routerCustom?.verifiedIdentityCount !==
      statusResult.value.routerCustom?.publishedIdentityCount ||
    feedResult.value.status !== "ready" || tokenResult.value.status !== "ready") {
    fail("chain-4663 public read model is not fully live and current");
  }
  if (!feedResult.value.snapshot || feedResult.value.snapshot.finality !== "finalized" ||
    !feedResult.value.snapshot.sources?.routerCustom ||
    BigInt(feedResult.value.snapshot.sources.routerCustom.blockNumber) <
      BigInt(promotion.startBlock)) {
    fail("chain-4663 feed lacks a finalized Router snapshot at or after activation");
  }
  assertRecent(statusResult.value.checkedAt, "chain-4663 status.checkedAt", 20 * 60_000);
  assertRecent(feedResult.value.snapshot.indexedAt,
    "chain-4663 launches.snapshot.indexedAt", 20 * 60_000);
  const accepted = await readRouterCustomRecords(manifestResult.value);
  const membership = createRouterCustomAcceptedMembership(
    accepted.records,
    manifestResult.value,
    { transportBoundary: feedResult.value.snapshot.sources.routerCustom },
  );
  for (const [index, launch] of feedResult.value.items.entries()) {
    if (launch.chainId !== 4663 || launch.launch?.finality !== "finalized") {
      fail(`chain-4663 launch ${index} is not finalized on chain 4663`);
    }
    assertNoFindings(validateLaunchSemantics(launch, {
      acceptedRouterCustomMembership: membership,
    }), `chain-4663 launch ${index}`);
  }
  if (tokenResult.value.tokens.some((token) => token.chainId !== 4663)) {
    fail("chain-4663 token list contains a cross-chain token");
  }
} else {
  validatePlannedRobinhoodManifest(manifestResult.value);
  apiStatus(manifestResult, "manifest", "unavailable");
  apiStatus(statusResult, "status", "unavailable");
  apiStatus(feedResult, "launches", "unavailable");
  apiStatus(tokenResult, "token-list", "unavailable");
  if (statusResult.value.service === "operational" ||
    statusResult.value.custom?.status !== "planned" ||
    statusResult.value.customLaunchV4?.status !== "planned" ||
    statusResult.value.feeds?.launches !== "unavailable" ||
    statusResult.value.feeds?.tokenList !== "unavailable" ||
    statusResult.value.customRegistryPublication?.publicSubmissionsEnabled !== false ||
    statusResult.value.customRegistryPublication?.publicationReady !== false ||
    feedResult.value.status !== "unavailable" || feedResult.value.items.length !== 0 ||
    tokenResult.value.status !== "unavailable" || tokenResult.value.tokens.length !== 0) {
    fail("planned chain-4663 read model exposed live or writable state");
  }
}

const receipt = createSmokeReceipt({
  mode,
  origin,
  ...(bundle ? { bundlePhase, bundle } : {}),
  manifestDigest: canonicalSha256(
    mode === "live"
      ? "programmable.developers.chain-4663-live-manifest.v1"
      : "programmable.developers.chain-4663-planned-manifest.v1",
    manifestResult.value,
  ),
  manifestStatus: manifestResult.value.customLaunchV4.status,
  service: statusResult.value.service,
  launchFeedStatus: feedResult.value.status,
  tokenListStatus: tokenResult.value.status,
  launchCount: feedResult.value.items.length,
  tokenCount: tokenResult.value.tokens.length,
  checkedAt: new Date().toISOString(),
});
await writeJson(output, receipt);
process.stdout.write(
  `Chain 4663 ${mode} smoke OK at ${origin}; launches=${receipt.launchCount}; ` +
  `tokens=${receipt.tokenCount}; digest=${receipt.smokeDigest}\n`,
);
