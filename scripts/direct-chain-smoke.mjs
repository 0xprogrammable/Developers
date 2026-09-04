#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readBoundedBytes } from "../server/bounded-body.js";
import { canonicalizeJson, canonicalSha256 } from "../server/canonical.js";
import { keccak256 } from "../server/keccak.js";
import { parseJsonStrict } from "./lib/files.mjs";

export const DIRECT_CHAIN_SMOKE_SCHEMA =
  "programmable.developers.chain-4663-direct-chain-smoke.v1";
export const DIRECT_CHAIN_MANIFEST_DOMAIN =
  "programmable.developers.chain-4663-direct-chain-manifest.v1";
export const DIRECT_CHAIN_EVIDENCE_DOMAIN =
  "programmable.developers.chain-4663-direct-chain-evidence.v1";
const MANIFEST_PATH = "deployments/robinhood-v2.json";
const EVIDENCE_PATH = "deployments/robinhood-direct-chain-evidence-v1.json";
const PUBLIC_ORIGIN = "https://developers.programmable.family";
const FEED_URL = "https://api.programmable.market/v4/chains/4663/finalized-custom-launches";
const PUBLIC_LAUNCH_ID = "b451a50f-026b-4e68-9c16-68e41c318076";
const MAX_BYTES = 5 * 1024 * 1024;
const FEED_PAGE_SIZE = 25;
const TIMEOUT_MS = 15_000;
const HASH = /^0x[0-9a-f]{64}$/iu;
const ADDRESS = /^0x[0-9a-f]{40}$/iu;
const QUANTITY = /^0x(?:0|[1-9a-f][0-9a-f]*)$/iu;
const same = (left, right) => canonicalizeJson(left) === canonicalizeJson(right);
const sameHex = (left, right) => typeof left === "string" && typeof right === "string" &&
  left.toLowerCase() === right.toLowerCase();
const assert = (condition, message) => { if (!condition) throw new TypeError(message); };
const quantity = (value) => `0x${BigInt(value).toString(16)}`;
const word = (value) => value.slice(2).padStart(64, "0").toLowerCase();

export function parseDirectChainArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    assert(["--mode", "--protection-bypass", "--output"].includes(key) &&
      typeof value === "string" && !value.startsWith("--") && !values.has(key),
    "invalid direct-chain smoke arguments");
    values.set(key, value);
  }
  assert((values.get("--mode") ?? "direct-chain") === "direct-chain",
    "direct-chain smoke cannot prove another release mode");
  const bypass = values.get("--protection-bypass") ?? "false";
  assert(["true", "false"].includes(bypass), "--protection-bypass must be true or false");
  assert(values.get("--output"), "--output is required");
  return { protectionBypass: bypass === "true", output: values.get("--output") };
}

function checkedUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError(`${label} is not a URL`); }
  assert((url.protocol === "https:" || (url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) &&
    !url.username && !url.password && !url.hash, `${label} must be credential-free HTTPS`);
  return url;
}

export function directChainOrigin(value) {
  const url = checkedUrl(value, "PROGRAMMABLE_API_BASE");
  assert(!url.search && ["/", "/api/v2", "/api/v2/"].includes(url.pathname),
    "PROGRAMMABLE_API_BASE must be an origin or /api/v2");
  return url.origin;
}

export async function fetchDirectChainJson(url, {
  fetchImpl = fetch, headers = {}, body, label = "response", maximumBytes = MAX_BYTES,
} = {}) {
  const target = checkedUrl(url, label);
  const response = await fetchImpl(target.href, {
    method: body === undefined ? "GET" : "POST",
    headers: { accept: "application/json", ...(body === undefined ? {} :
      { "content-type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  assert(response.ok, `${label} HTTP ${response.status}`);
  assert(/^application\/(?:problem\+)?json\b/iu.test(
    response.headers.get("content-type") ?? ""), `${label} is not JSON`);
  const bytes = await readBoundedBytes(response, maximumBytes, label);
  return parseJsonStrict(new TextDecoder("utf-8", { fatal: true }).decode(bytes), label);
}

function recent(value, now, label) {
  const elapsed = now - Date.parse(value);
  assert(Number.isFinite(elapsed) && elapsed >= -60_000 && elapsed <= 20 * 60_000,
    `${label} is stale or has an invalid timestamp`);
}

function validatePublication(manifest, status, evidence) {
  const integration = manifest.directChainIntegration;
  assert(manifest.chainId === 4663 && manifest.caip2 === "eip155:4663" &&
    manifest.platformId === "programmable" &&
    integration?.schemaVersion === "programmable.direct-chain-integration.v1" &&
    integration.status === "live" && integration.platformId === "programmable" &&
    integration.category === "custom" && integration.publicLabel === "Programmable Custom" &&
    integration.indexing === "direct-chain" && integration.publicWrites === false &&
    integration.hostedIndexer === "unavailable" &&
    integration.evidenceUrl === `${PUBLIC_ORIGIN}/${EVIDENCE_PATH}` &&
    integration.finality?.mode === "rpc-finalized" &&
    integration.finality.explicitBlockRequiresFinalizedAncestor === true,
  "manifest does not publish the exact read-only direct-chain integration");
  assert(manifest.launchStampRouter?.status === "live" &&
    manifest.customLaunchV4?.status === "planned" &&
    manifest.publicCategories?.custom?.discoveryStatus === "live",
  "manifest confuses direct-chain discovery and hosted runtime activation");
  assert(status.chainId === 4663 && status.caip2 === "eip155:4663" &&
    status.service === "degraded" && status.custom?.status === "live" &&
    status.feeds?.launches === "unavailable" && status.feeds?.tokenList === "unavailable" &&
    same(status.directChainIntegration, integration),
  "status does not preserve the unavailable hosted indexer boundary");
  assert(manifest.chains?.find((entry) => entry.chainId === 4663)?.finalizedFeedUrl === FEED_URL,
    "manifest finalized feed is not the chain-scoped Robinhood feed");
  assert(evidence.schemaVersion === "programmable.robinhood-direct-chain-evidence.v1" &&
    evidence.chainId === 4663 && evidence.platformId === "programmable" &&
    evidence.category === "custom" && evidence.publicLabel === "Programmable Custom" &&
    evidence.launch?.publicLaunchId === PUBLIC_LAUNCH_ID &&
    sameHex(evidence.deployment?.routerAddress, manifest.launchStampRouter.address) &&
    sameHex(evidence.deployment?.runtimeCodeHash, manifest.launchStampRouter.runtimeCodeHash) &&
    evidence.deployment.blockNumber === manifest.launchStampRouter.startBlock,
  "published evidence differs from the manifest Router identity");
  for (const key of ["finality", "transactionHash", "blockNumber", "blockHash", "launchId"]) {
    assert(evidence.launch[key] === manifest.launchStampRouter.canaryEvidence?.[key],
      `published evidence canary ${key} differs from the manifest`);
  }
}

async function readFinalizedLaunch({ manifest, evidence, readJson, now }) {
  const canary = evidence.launch;
  let cursor = null;
  const seen = new Set();
  for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
    const url = new URL(FEED_URL);
    url.searchParams.set("limit", String(FEED_PAGE_SIZE));
    if (cursor !== null) url.searchParams.set("cursor", cursor);
    const page = await readJson(url.href, { label: "finalized launch feed" });
    assert(page.schemaVersion === "programmable.custom-launch-list.v4" &&
      page.apiVersion === "v4" && page.chainId === "4663" && page.caip2 === "eip155:4663" &&
      page.quality?.status === "ready" && page.quality.quarantinedRowCount === 0 &&
      Array.isArray(page.launches) && page.launches.length <= FEED_PAGE_SIZE,
    "finalized launch feed is not ready and chain-scoped");
    recent(page.generatedAt, now(), "finalized launch feed");
    const launch = page.launches.find((entry) => entry.launchId === PUBLIC_LAUNCH_ID);
    if (launch) {
      const onchain = launch.onchain;
      const inclusion = onchain?.l2Inclusion;
      assert(launch.schemaVersion === "programmable.finalized-custom-launch-metadata.v4" &&
        launch.platformId === "programmable" && launch.category === "custom" &&
        launch.chainId === "4663" && launch.caip2 === "eip155:4663" &&
        Number.isFinite(Date.parse(launch.finalizedAt)) && onchain?.terminal === true &&
        sameHex(onchain.router, manifest.launchStampRouter.address) &&
        sameHex(onchain.routerRuntimeCodeHash, manifest.launchStampRouter.runtimeCodeHash) &&
        sameHex(onchain.routerLaunchId, canary.launchId) &&
        sameHex(onchain.transactionHash, canary.transactionHash) &&
        inclusion?.chainId === "4663" && inclusion.blockNumber === canary.blockNumber &&
        sameHex(inclusion.blockHash, canary.blockHash) &&
        sameHex(inclusion.transactionHash, canary.transactionHash) &&
        inclusion.receiptStatus === "success",
      "finalized feed launch differs from the published finalized canary");
      return launch;
    }
    if (page.nextCursor === null) break;
    assert(typeof page.nextCursor === "string" &&
      /^[A-Za-z0-9_-]{16,512}$/u.test(page.nextCursor) && !seen.has(page.nextCursor),
    "finalized feed cursor is invalid or repeated");
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  throw new TypeError("published finalized canary was not found within the bounded feed scan");
}

export async function verifyDirectChainState({ manifest, evidence, rpc }) {
  const router = manifest.launchStampRouter;
  const canary = evidence.launch;
  assert(ADDRESS.test(router.address) && HASH.test(router.runtimeCodeHash) &&
    canary?.finality === "finalized" && HASH.test(canary.launchId) &&
    HASH.test(canary.stampHash) && HASH.test(canary.transactionHash) &&
    HASH.test(canary.blockHash) && /^(0|[1-9][0-9]*)$/u.test(canary.blockNumber) &&
    ADDRESS.test(canary.components?.token) && ADDRESS.test(canary.components?.hook),
  "published Router and canary evidence is incomplete");
  assert(BigInt(await rpc("eth_chainId", [])) === 4663n, "RPC chain identity differs");
  const finalized = await rpc("eth_getBlockByNumber", ["finalized", false]);
  assert(finalized && QUANTITY.test(finalized.number) && HASH.test(finalized.hash) &&
    BigInt(finalized.number) >= BigInt(canary.blockNumber) &&
    BigInt(canary.blockNumber) >= BigInt(router.startBlock),
  "canary is outside the finalized Router range");
  const canaryBlock = await rpc("eth_getBlockByNumber", [quantity(canary.blockNumber), false]);
  assert(canaryBlock && BigInt(canaryBlock.number) === BigInt(canary.blockNumber) &&
    sameHex(canaryBlock.hash, canary.blockHash), "canary block is not canonical");
  // Prefer hash-bound reads. A provider without EIP-1898 may use its finalized
  // tag only while the finalized checkpoint stays exactly unchanged throughout.
  let block = { blockHash: finalized.hash, requireCanonical: true };
  let code;
  try { code = await rpc("eth_getCode", [router.address, block]); }
  catch {
    const before = await rpc("eth_getBlockByNumber", ["finalized", false]);
    assert(before && sameHex(before.hash, finalized.hash) && before.number === finalized.number,
      "finalized checkpoint changed before tagged state verification");
    block = "finalized";
    code = await rpc("eth_getCode", [router.address, block]);
  }
  const call = async (signature, words = []) => {
    const data = keccak256(new TextEncoder().encode(signature)).slice(0, 10) + words.join("");
    const result = await rpc("eth_call", [{ to: router.address, data }, block]);
    assert(typeof result === "string" && /^0x(?:[0-9a-f]{64})+$/iu.test(result),
      `${signature} returned malformed ABI words`);
    return result.toLowerCase();
  };
  assert(typeof code === "string" && /^0x(?:[0-9a-f]{2})+$/iu.test(code) &&
    keccak256(Buffer.from(code.slice(2), "hex")) === router.runtimeCodeHash.toLowerCase(),
  "Router finalized runtime code hash differs");
  assert(BigInt(await call("CHAIN_ID()")) === 4663n, "Router immutable chain identity differs");
  for (const [name, signature] of [["permitAuthority", "PERMIT_AUTHORITY()"],
    ["graphFactory", "GRAPH_FACTORY()"], ["poolManager", "POOL_MANAGER()"]]) {
    assert(ADDRESS.test(router.bindings?.[name]), `Router ${name} binding is missing`);
    assert(await call(signature) === `0x${word(router.bindings[name])}`,
      `Router ${name} immutable binding differs`);
  }
  assert(await call("launchIdByToken(address)", [word(canary.components.token)]) ===
    canary.launchId.toLowerCase(), "Router token mapping differs");
  const record = (await call("launchStamp(bytes32)", [word(canary.launchId)])).slice(2)
    .match(/.{64}/gu);
  assert(record.length === 14 && BigInt(`0x${record[0]}`) === 1n &&
    record[2] === word(canary.components.token) && record[3] === word(canary.components.hook) &&
    record[4] === word(router.bindings.poolManager) && `0x${record[13]}` ===
      canary.stampHash.toLowerCase(), "Router stamp record differs from the Custom canary");
  for (const component of [canary.components.token, canary.components.hook]) {
    assert(await call("launchIdByComponent(address)", [word(component)]) ===
      canary.launchId.toLowerCase(), "Router component mapping differs");
    assert(await call("stampProof(address)", [word(component)]) ===
      `0x${word(canary.launchId)}${word(canary.stampHash)}`,
    "Router component stamp proof differs");
  }
  const receipt = await rpc("eth_getTransactionReceipt", [canary.transactionHash]);
  assert(receipt?.status === "0x1" && sameHex(receipt.transactionHash, canary.transactionHash) &&
    BigInt(receipt.blockNumber) === BigInt(canary.blockNumber) &&
    sameHex(receipt.blockHash, canary.blockHash) && Array.isArray(receipt.logs),
  "canary receipt is missing, failed, or not canonical");
  const matching = receipt.logs.filter((log) => sameHex(log.address, router.address) &&
    sameHex(log.topics?.[0], router.events.launchStamped.topic0) &&
    sameHex(log.topics?.[1], canary.launchId));
  assert(matching.length === 1 && matching[0].removed !== true &&
    matching[0].topics.length === 4 && matching[0].topics[2].toLowerCase() ===
      `0x${word(canary.components.token)}` && matching[0].topics[3].toLowerCase() ===
      `0x${word(canary.components.hook)}` &&
    matching[0].data.toLowerCase() === `0x${word(router.bindings.poolManager)}${record[5]}${record[13]}`,
  "canonical receipt lacks the exact Programmable Custom stamp event");
  const rechecked = await rpc("eth_getBlockByNumber", [
    block === "finalized" ? "finalized" : finalized.number, false,
  ]);
  assert(rechecked && sameHex(rechecked.hash, finalized.hash) &&
    rechecked.number === finalized.number,
    "finalized read block changed during verification");
}

export async function runDirectChainSmoke({
  apiBase, expectedManifest, expectedEvidence, protectionBypass = false,
  bypassSecret, rpcUrl = "https://rpc-robinhood.blockmachine.io", fetchImpl = fetch,
  now = Date.now,
}) {
  const origin = directChainOrigin(apiBase);
  assert(!protectionBypass || (new URL(origin).hostname.endsWith(".vercel.app") &&
    typeof bypassSecret === "string" && bypassSecret.length > 0),
  "protection bypass requires a generated Vercel origin and configured secret");
  const headers = protectionBypass ? { "x-vercel-protection-bypass": bypassSecret } : {};
  const readJson = (url, options = {}) => fetchDirectChainJson(url, { fetchImpl, ...options });
  const [manifest, status, evidence] = await Promise.all([
    readJson(`${origin}/api/v2/manifests/4663`, { headers, label: "public manifest" }),
    readJson(`${origin}/api/v2/status?chainId=4663`, { headers, label: "public status" }),
    readJson(`${origin}/${EVIDENCE_PATH}`, { headers, label: "public direct-chain evidence" }),
  ]);
  assert(same(manifest, expectedManifest), "public manifest differs from exact tracked source");
  assert(same(evidence, expectedEvidence), "public evidence differs from exact tracked source");
  validatePublication(manifest, status, evidence);
  // This unavailable hosted projection uses the pinned manifest timestamp.
  // Current availability is proved separately by the fresh backend feed and RPC.
  assert(status.checkedAt === manifest.generatedAt &&
    Number.isFinite(Date.parse(status.checkedAt)) && Date.parse(status.checkedAt) <= now() + 60_000,
  "public unavailable status timestamp differs from the pinned manifest");
  await readFinalizedLaunch({ manifest, evidence, readJson, now });
  checkedUrl(rpcUrl, "RPC URL");
  let id = 0;
  const rpc = async (method, params) => {
    const requestId = ++id;
    const response = await readJson(rpcUrl, { label: `RPC ${method}`,
      body: { jsonrpc: "2.0", id: requestId, method, params } });
    assert(response?.jsonrpc === "2.0" && response.id === requestId &&
      !response.error && Object.hasOwn(response, "result"), `RPC ${method} failed`);
    return response.result;
  };
  await verifyDirectChainState({ manifest, evidence, rpc });
  const value = {
    schemaVersion: DIRECT_CHAIN_SMOKE_SCHEMA, mode: "direct-chain", origin,
    chainId: "4663", caip2: "eip155:4663",
    manifestDigest: canonicalSha256(DIRECT_CHAIN_MANIFEST_DOMAIN, manifest),
    evidenceDigest: canonicalSha256(DIRECT_CHAIN_EVIDENCE_DOMAIN, evidence),
    publicWrites: false, hostedIndexer: "unavailable", finalizedFeedStatus: "ready",
    launchId: PUBLIC_LAUNCH_ID, checkedAt: new Date(now()).toISOString(),
  };
  return { ...value, smokeDigest: canonicalSha256(DIRECT_CHAIN_SMOKE_SCHEMA, value) };
}

async function exactTrackedJson(root, relativePath) {
  const filename = path.join(root, relativePath);
  const metadata = await lstat(filename);
  assert(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size <= MAX_BYTES,
    `${relativePath} must be a bounded tracked regular file`);
  const source = await readFile(filename, "utf8");
  const tracked = execFileSync("git", ["show", `HEAD:${relativePath}`],
    { cwd: root, encoding: "utf8", maxBuffer: MAX_BYTES, stdio: ["ignore", "pipe", "pipe"] });
  assert(source === tracked, `${relativePath} differs from tracked HEAD`);
  return parseJsonStrict(source, relativePath);
}

async function main() {
  const options = parseDirectChainArguments(process.argv.slice(2));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const [expectedManifest, expectedEvidence] = await Promise.all([
    exactTrackedJson(root, MANIFEST_PATH), exactTrackedJson(root, EVIDENCE_PATH),
  ]);
  const receipt = await runDirectChainSmoke({
    ...options, expectedManifest, expectedEvidence,
    apiBase: process.env.PROGRAMMABLE_API_BASE,
    bypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    rpcUrl: process.env.PROGRAMMABLE_RPC_URL,
  });
  const handle = await open(path.resolve(options.output), "wx", 0o600);
  try { await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`, "utf8"); }
  finally { await handle.close(); }
  process.stdout.write(`Chain 4663 direct-chain smoke OK at ${receipt.origin}; ` +
    `launch=${receipt.launchId}; digest=${receipt.smokeDigest}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
