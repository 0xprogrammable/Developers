import { readFile } from "node:fs/promises";

import { readBoundedJson } from "./bounded-body.js";
import { canonicalSha256 } from "./canonical.js";
import { compareLaunchesDescending } from "./normalize.js";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const PROHIBITED_TEXT =
  /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;

export const ROUTER_CUSTOM_SOURCE = "canonical-launch-stamp-router";
export const ROUTER_CUSTOM_SOURCE_URL =
  "https://programmable.market/api/indexers/v1/router-custom-identities";
const ROUTER_CUSTOM_SNAPSHOT_CAPTURE_URL =
  "https://programmable.market/api/explore?limit=100&page=1&sort=newest";
const ROUTER_CUSTOM_SNAPSHOT_SCHEMA =
  "programmable.router-custom-identity-snapshot.v1";
const ROUTER_CUSTOM_PROVENANCE_SCHEMA =
  "programmable.launch-stamp-provenance.v1";
const ROUTER_CUSTOM_MODEL = "custom-graph";
const ROUTER_CUSTOM_MODEL_VERSION = "programmable-launch-stamp-router-v1";
const ROUTER_CUSTOM_VERIFICATION_URL =
  "https://raw.githubusercontent.com/0xprogrammable/developers/main/docs/reference/launch-stamp.md";
const EXPECTED_BUNDLED_SNAPSHOT_SHA256 =
  "sha256:25f47a745c4704af13787340dc855ad13a9e3eb12023352c88b0befc2d93d771";
const EXPECTED_SNAPSHOT_BOUNDARY = Object.freeze({
  generatedAt: "2026-08-25T16:20:39.656Z",
  asOfBlock: "25833303",
  asOfBlockHash:
    "0x8a41eb9adef78cdf523beff49f0b8d19225394991ff3e7be1bb8d24e34e7cdce",
  sourceIdentityCommitment:
    "sha256:c2aa49cf9435465fd1071741bed6977ab2217af2ebc7c4310963b9cf9dd7eab1",
});
const EXPECTED_ENTRY_SHA256_BY_LAUNCH_ID = new Map([
  [
    "0x6d6ed0e1e69a7cd6afa177e3454c9e32eed61cbd3f855ee56aff1915a6776fc2",
    "sha256:9b68c3022ee38d1d4de93a963acadaa3c93ef703bcbf25f9fec4bd73f6f7aa41",
  ],
  [
    "0x5a52180427785716bff0a36218dde89f0459db265d0c2bdfcfde81a8fe733c92",
    "sha256:933b7e8090a4f8731c844644b589c63a37b45b82ac46be65a52b1ca146f4156c",
  ],
]);
const ROUTER_CUSTOM_SOURCE_RESPONSE_BYTES = 16 * 1_024 * 1_024;
const ROUTER_CUSTOM_SOURCE_TIMEOUT_MS = 6_000;
const ROUTER_CUSTOM_CACHE_MS = 15_000;
// Only records produced after validating the complete source commitment receive
// this non-serializable capability. A source-shaped object cannot self-assign it.
const TRUSTED_CURRENT_ROUTER_RECORD = Symbol("trusted-current-router-record");

let bundledSnapshotPromise = null;
let cache = null;
let cachePromise = null;
// The Website source owns the durable append-only snapshot. Retain the newest
// accepted copy inside a warm Developers process as an additional fail-closed
// guard and as a short-lived LKG if the next source read fails.
let lastAcceptedSourceSnapshot = null;

function sameHex(left, right) {
  return typeof left === "string" && typeof right === "string" &&
    left.toLowerCase() === right.toLowerCase();
}

function safeText(value, maximum) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum ||
    value.trim() !== value || PROHIBITED_TEXT.test(value)) return null;
  return value;
}

function safeInstant(value) {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value
    ? value
    : null;
}

function safeDecimal(value) {
  return typeof value === "string" && value.length <= 78 && DECIMAL.test(value)
    ? value
    : null;
}

function safeIndex(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function exactRouterBinding(manifest) {
  const router = manifest?.launchStampRouter;
  const runtimeCodeHash = router?.runtimeCodeHash;
  if (
    manifest?.chainId !== 1 ||
    !router ||
    router.status !== "live" ||
    !ADDRESS.test(router.address ?? "") ||
    !HASH32.test(runtimeCodeHash ?? "") ||
    !safeDecimal(router.startBlock) ||
    router.endBlock !== null ||
    !Number.isSafeInteger(router.finalityConfirmations) ||
    router.finalityConfirmations < 1 ||
    router.finalityConfirmations > 255 ||
    router.events?.launchStamped?.topic0 !==
      "0x6cf479a102f1eebc9244f48f8d68f6aa52b4c5a4516318df58ba46614a5b14f2" ||
    router.enumValues?.launchKind?.customGraph !== 1 ||
    !ADDRESS.test(router.bindings?.graphFactory ?? "") ||
    !HASH32.test(router.bindings?.graphFactoryRuntimeCodeHash ?? "") ||
    !ADDRESS.test(router.bindings?.poolManager ?? "") ||
    !HASH32.test(router.bindings?.poolManagerRuntimeCodeHash ?? "")
  ) {
    throw new Error("Router Custom manifest binding is unavailable");
  }
  return {
    chainId: manifest.chainId,
    address: router.address,
    runtimeCodeHash,
    startBlock: router.startBlock,
    finalityConfirmations: router.finalityConfirmations,
    graphFactory: router.bindings.graphFactory,
    graphFactoryRuntimeCodeHash: router.bindings.graphFactoryRuntimeCodeHash,
    poolManager: router.bindings.poolManager,
  };
}

function canonicalRouterEntry(raw, binding, boundary, requirePinned = true) {
  const blockNumber = safeDecimal(raw?.blockNumber);
  const finalizedAtBlockNumber = safeDecimal(raw?.finalizedAtBlockNumber);
  const transactionIndex = safeIndex(raw?.transactionIndex);
  const logIndex = safeIndex(raw?.logIndex);
  const tokenDecimals = raw?.tokenDecimals === null
    ? null
    : safeIndex(raw?.tokenDecimals);
  const tokenName = raw?.tokenName === null
    ? null
    : safeText(raw?.tokenName, 256);
  const tokenSymbol = raw?.tokenSymbol === null
    ? null
    : safeText(raw?.tokenSymbol, 64);
  const launchedAt = safeInstant(raw?.launchedAt);
  if (
    !exactKeys(raw, [
      "chainId", "routerAddress", "routerRuntimeCodeHash", "routerStartBlock",
      "finalityConfirmations", "finalizedAtBlockNumber", "launchId",
      "stampHash", "transactionHash", "blockNumber", "blockHash",
      "transactionIndex", "logIndex", "launchedAt", "launchWallet",
      "tokenAddress", "tokenName", "tokenSymbol", "tokenDecimals",
      "hookAddress", "poolManagerAddress", "poolId", "routeLauncherAddress",
      "routeLauncherRuntimeCodeHash",
    ]) ||
    raw.chainId !== binding.chainId ||
    !sameHex(raw.routerAddress, binding.address) ||
    !sameHex(raw.routerRuntimeCodeHash, binding.runtimeCodeHash) ||
    raw.routerStartBlock !== binding.startBlock ||
    raw.finalityConfirmations !== binding.finalityConfirmations ||
    blockNumber === null || finalizedAtBlockNumber === null ||
    BigInt(blockNumber) < BigInt(binding.startBlock) ||
    BigInt(finalizedAtBlockNumber) <
      BigInt(blockNumber) + BigInt(binding.finalityConfirmations) ||
    BigInt(finalizedAtBlockNumber) > BigInt(boundary.asOfBlock) ||
    !HASH32.test(raw.launchId ?? "") || !HASH32.test(raw.stampHash ?? "") ||
    !HASH32.test(raw.transactionHash ?? "") ||
    !HASH32.test(raw.blockHash ?? "") ||
    transactionIndex === null || logIndex === null || launchedAt === null ||
    !ADDRESS.test(raw.launchWallet ?? "") ||
    !ADDRESS.test(raw.tokenAddress ?? "") ||
    (raw.tokenName !== null && tokenName === null) ||
    (raw.tokenSymbol !== null && tokenSymbol === null) ||
    (raw.tokenDecimals !== null && tokenDecimals === null) ||
    (tokenDecimals !== null && tokenDecimals > 255) ||
    !ADDRESS.test(raw.hookAddress ?? "") ||
    !sameHex(raw.poolManagerAddress, binding.poolManager) ||
    !HASH32.test(raw.poolId ?? "") ||
    !sameHex(raw.routeLauncherAddress, binding.graphFactory) ||
    !sameHex(
      raw.routeLauncherRuntimeCodeHash,
      binding.graphFactoryRuntimeCodeHash,
    )
  ) {
    throw new Error("Router Custom identity is not bound to the active Router");
  }
  const entry = structuredClone(raw);
  const expectedEntrySha256 = EXPECTED_ENTRY_SHA256_BY_LAUNCH_ID.get(
    entry.launchId.toLowerCase(),
  );
  const entrySha256 = canonicalSha256(
    "programmable.router-custom-identity-entry.v1",
    entry,
  );
  if (requirePinned && expectedEntrySha256 !== entrySha256) {
    throw new Error("Router Custom identity is not in the pinned snapshot");
  }
  return Object.freeze({ ...entry, entrySha256 });
}

function validateIdentitySet(entries) {
  if (!Array.isArray(entries) ||
    entries.length !== EXPECTED_ENTRY_SHA256_BY_LAUNCH_ID.size) {
    throw new Error("Router Custom identity set has an unexpected size");
  }
  const launchIds = new Set();
  const tokenAddresses = new Set();
  for (const entry of entries) {
    const launchId = entry.launchId.toLowerCase();
    const token = entry.tokenAddress.toLowerCase();
    if (launchIds.has(launchId) || tokenAddresses.has(token)) {
      throw new Error("Router Custom identity set contains duplicates");
    }
    launchIds.add(launchId);
    tokenAddresses.add(token);
  }
  if ([...EXPECTED_ENTRY_SHA256_BY_LAUNCH_ID.keys()].some(
    (launchId) => !launchIds.has(launchId),
  )) {
    throw new Error("Router Custom identity set is incomplete");
  }
  return entries;
}

async function bundledSnapshot(manifest) {
  bundledSnapshotPromise ??= readFile(
    new URL("../snapshots/router-custom-identities.v1.json", import.meta.url),
    "utf8",
  ).then((source) => JSON.parse(source));
  const snapshot = structuredClone(await bundledSnapshotPromise);
  const snapshotSha256 = canonicalSha256(
    ROUTER_CUSTOM_SNAPSHOT_SCHEMA,
    snapshot,
  );
  const binding = exactRouterBinding(manifest);
  const asOfBlock = safeDecimal(snapshot?.asOfBlock);
  const generatedAt = safeInstant(snapshot?.generatedAt);
  if (
    snapshotSha256 !== EXPECTED_BUNDLED_SNAPSHOT_SHA256 ||
    !exactKeys(snapshot, [
      "schemaVersion", "source", "sourceUrl", "status", "generatedAt",
      "asOfBlock", "asOfBlockHash", "finalityConfirmations",
      "sourceIdentityCommitment", "entries",
    ]) ||
    snapshot.schemaVersion !== ROUTER_CUSTOM_SNAPSHOT_SCHEMA ||
    snapshot.source !== ROUTER_CUSTOM_SOURCE ||
    snapshot.sourceUrl !== ROUTER_CUSTOM_SNAPSHOT_CAPTURE_URL ||
    snapshot.status !== "last-known-good" ||
    generatedAt !== EXPECTED_SNAPSHOT_BOUNDARY.generatedAt ||
    asOfBlock !== EXPECTED_SNAPSHOT_BOUNDARY.asOfBlock ||
    !sameHex(snapshot.asOfBlockHash, EXPECTED_SNAPSHOT_BOUNDARY.asOfBlockHash) ||
    snapshot.finalityConfirmations !== binding.finalityConfirmations ||
    snapshot.sourceIdentityCommitment !==
      EXPECTED_SNAPSHOT_BOUNDARY.sourceIdentityCommitment ||
    !SHA256.test(snapshot.sourceIdentityCommitment ?? "") ||
    !Array.isArray(snapshot.entries)
  ) {
    throw new Error("Bundled Router Custom snapshot is invalid");
  }
  const entries = validateIdentitySet(
    snapshot.entries.map((entry) =>
      canonicalRouterEntry(entry, binding, { asOfBlock })),
  );
  return Object.freeze({
    status: "last-known-good",
    generatedAt,
    asOfBlock,
    asOfBlockHash: snapshot.asOfBlockHash.toLowerCase(),
    sourceIdentityCommitment: snapshot.sourceIdentityCommitment,
    snapshotSha256,
    verifiedIdentityCount: entries.length,
    entries,
  });
}

function sourceBoundary(snapshot, binding) {
  const generatedAt = safeInstant(snapshot?.generatedAt);
  const asOfBlock = safeDecimal(snapshot?.asOfBlock);
  if (
    snapshot?.schemaVersion !== ROUTER_CUSTOM_SNAPSHOT_SCHEMA ||
    snapshot?.source !== ROUTER_CUSTOM_SOURCE ||
    !["current", "last-known-good"].includes(snapshot?.status) ||
    generatedAt === null || asOfBlock === null ||
    BigInt(asOfBlock) < BigInt(binding.startBlock) ||
    !HASH32.test(snapshot?.asOfBlockHash ?? "") ||
    snapshot?.finalityConfirmations !== binding.finalityConfirmations ||
    !SHA256.test(snapshot?.identityCommitment ?? "") ||
    !Array.isArray(snapshot?.entries) || snapshot.entries.length > 10_000
  ) {
    throw new Error("Router Custom current snapshot boundary is invalid");
  }
  return {
    status: snapshot.status,
    generatedAt,
    asOfBlock,
    asOfBlockHash: snapshot.asOfBlockHash.toLowerCase(),
    sourceIdentityCommitment: snapshot.identityCommitment,
  };
}

function compareSourceEntries(left, right) {
  const leftStamp = left.launchStampProvenance;
  const rightStamp = right.launchStampProvenance;
  const blockOrder = BigInt(leftStamp.blockNumber) - BigInt(rightStamp.blockNumber);
  if (blockOrder !== 0n) return blockOrder < 0n ? -1 : 1;
  if (leftStamp.transactionIndex !== rightStamp.transactionIndex) {
    return leftStamp.transactionIndex - rightStamp.transactionIndex;
  }
  if (leftStamp.launchLogIndex !== rightStamp.launchLogIndex) {
    return leftStamp.launchLogIndex - rightStamp.launchLogIndex;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function sourceEntry(raw, binding, boundary) {
  const category = raw?.launchCategoryProvenance;
  const provenance = raw?.launchStampProvenance;
  const components = provenance?.components;
  const matchingExclusiveComponent = (kind, address) =>
    Array.isArray(components) && components.some((component) =>
      component?.kind === kind && component.scope === "exclusive" &&
      sameHex(component.address, address) &&
      sameHex(component.exclusiveProof?.launchId, provenance.launchId) &&
      sameHex(component.exclusiveProof?.stampHash, provenance.stampHash));
  if (
    raw?.exploreKind !== "token" ||
    raw?.id !== `1:${String(raw?.tokenAddress).toLowerCase()}` ||
    raw?.launchModel !== ROUTER_CUSTOM_MODEL ||
    raw?.launchModelVersion !== ROUTER_CUSTOM_MODEL_VERSION ||
    raw?.liquidityPath !== "programmable-v4" ||
    raw?.totalSwapFeeBps !== null ||
    [
      "buyHookFeeBps", "sellHookFeeBps", "creatorFeeBps",
      "buyCreatorFeeBps", "sellCreatorFeeBps", "growthFeeBps",
      "programmableFeeBps", "launcherFeeBps", "transferTaxBps",
    ].some((field) => Object.hasOwn(raw, field)) ||
    category?.schemaVersion !==
      "programmable.explore-launch-category-provenance.v1" ||
    category.category !== "custom" || category.source !== ROUTER_CUSTOM_SOURCE ||
    provenance?.schemaVersion !== ROUTER_CUSTOM_PROVENANCE_SCHEMA ||
    provenance.kind !== ROUTER_CUSTOM_MODEL ||
    provenance.chainId !== binding.chainId ||
    !sameHex(provenance.routerAddress, binding.address) ||
    !sameHex(provenance.routerRuntimeCodeHash, binding.runtimeCodeHash) ||
    provenance.routerStartBlock !== binding.startBlock ||
    provenance.finalityConfirmations !== binding.finalityConfirmations ||
    !sameHex(category.routerAddress, binding.address) ||
    !sameHex(category.launchId, provenance.launchId) ||
    !sameHex(category.stampHash, provenance.stampHash) ||
    !sameHex(category.transactionHash, provenance.transactionHash) ||
    !sameHex(category.blockHash, provenance.blockHash) ||
    String(category.blockNumber) !== provenance.blockNumber ||
    category.transactionIndex !== provenance.transactionIndex ||
    category.logIndex !== provenance.launchLogIndex ||
    !sameHex(raw.creatorAddress, provenance.launchWallet) ||
    !sameHex(raw.launchTransactionHash, provenance.transactionHash) ||
    String(raw.launchBlockNumber) !== provenance.blockNumber ||
    raw.launchTransactionIndex !== provenance.transactionIndex ||
    raw.launchLogIndex !== provenance.launchLogIndex ||
    !sameHex(raw.tokenAddress, provenance.tokenProof?.tokenAddress) ||
    !sameHex(provenance.tokenProof?.launchId, provenance.launchId) ||
    !sameHex(provenance.tokenProof?.stampHash, provenance.stampHash) ||
    !sameHex(raw.hookAddress, provenance.poolKey?.hooks) ||
    !sameHex(raw.poolId, provenance.poolId) ||
    !sameHex(provenance.poolProof?.launchId, provenance.launchId) ||
    !sameHex(provenance.poolProof?.stampHash, provenance.stampHash) ||
    !sameHex(provenance.poolProof?.poolId, provenance.poolId) ||
    !sameHex(provenance.poolProof?.poolManagerAddress, binding.poolManager) ||
    !matchingExclusiveComponent("token", raw.tokenAddress) ||
    !matchingExclusiveComponent("hook", raw.hookAddress)
  ) {
    throw new Error("Router Custom current snapshot entry is inconsistent");
  }
  return canonicalRouterEntry({
    chainId: provenance.chainId,
    routerAddress: provenance.routerAddress,
    routerRuntimeCodeHash: provenance.routerRuntimeCodeHash,
    routerStartBlock: provenance.routerStartBlock,
    finalityConfirmations: provenance.finalityConfirmations,
    finalizedAtBlockNumber: provenance.finalizedAtBlockNumber,
    launchId: provenance.launchId,
    stampHash: provenance.stampHash,
    transactionHash: provenance.transactionHash,
    blockNumber: provenance.blockNumber,
    blockHash: provenance.blockHash,
    transactionIndex: provenance.transactionIndex,
    logIndex: provenance.launchLogIndex,
    launchedAt: raw.launchedAt,
    launchWallet: provenance.launchWallet,
    tokenAddress: raw.tokenAddress,
    tokenName: raw.name ?? null,
    tokenSymbol: raw.symbol ?? null,
    tokenDecimals: raw.tokenDecimals ?? null,
    hookAddress: raw.hookAddress,
    poolManagerAddress: provenance.poolManagerAddress,
    poolId: provenance.poolId,
    routeLauncherAddress: provenance.routeLauncherAddress,
    routeLauncherRuntimeCodeHash: provenance.routeLauncherRuntimeCodeHash,
  }, binding, boundary, false);
}

async function currentSource(manifest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTER_CUSTOM_SOURCE_TIMEOUT_MS);
  try {
    const response = await fetch(ROUTER_CUSTOM_SOURCE_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "programmable-developer-api/2",
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Router Custom source returned HTTP ${response.status}`);
    }
    const payload = await readBoundedJson(
      response,
      ROUTER_CUSTOM_SOURCE_RESPONSE_BYTES,
      "Router Custom source response",
    );
    if (!exactKeys(payload, [
      "schemaVersion", "source", "status", "generatedAt", "asOfBlock",
      "asOfBlockHash", "finalityConfirmations", "identityCommitment", "entries",
    ])) {
      throw new Error("Router Custom source envelope is invalid");
    }
    const binding = exactRouterBinding(manifest);
    const boundary = sourceBoundary(payload, binding);
    const computedCommitment = canonicalSha256(
      ROUTER_CUSTOM_SNAPSHOT_SCHEMA,
      {
        chainId: binding.chainId,
        source: payload.source,
        asOfBlock: payload.asOfBlock,
        asOfBlockHash: payload.asOfBlockHash.toLowerCase(),
        finalityConfirmations: payload.finalityConfirmations,
        entries: payload.entries,
      },
    );
    if (computedCommitment !== payload.identityCommitment) {
      throw new Error("Router Custom source commitment is invalid");
    }
    for (let index = 1; index < payload.entries.length; index += 1) {
      if (compareSourceEntries(payload.entries[index - 1], payload.entries[index]) >= 0) {
        throw new Error("Router Custom source entries are not canonically ordered");
      }
    }
    const entries = validateCurrentIdentitySet(
      payload.entries.map((entry) => sourceEntry(entry, binding, boundary)),
    );
    return {
      ...boundary,
      snapshotSha256: canonicalSha256(
        "programmable.router-custom-source-snapshot.v1",
        payload,
      ),
      verifiedIdentityCount: entries.length,
      entries,
      trustedCurrent: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function validateCurrentIdentitySet(entries) {
  if (!Array.isArray(entries) || entries.length > 10_000) {
    throw new Error("Router Custom current identity set exceeds its bound");
  }
  const launches = new Set();
  const tokens = new Set();
  const pools = new Set();
  const events = new Set();
  for (const entry of entries) {
    const launch = entry.launchId.toLowerCase();
    const token = entry.tokenAddress.toLowerCase();
    const pool = `${entry.poolManagerAddress.toLowerCase()}:${entry.poolId.toLowerCase()}`;
    const event = `${entry.transactionHash.toLowerCase()}:${entry.logIndex}`;
    if (
      launches.has(launch) || tokens.has(token) || pools.has(pool) ||
      events.has(event)
    ) {
      throw new Error("Router Custom current identity set contains duplicates");
    }
    launches.add(launch);
    tokens.add(token);
    pools.add(pool);
    events.add(event);
  }
  return entries;
}

function immutableEntryBinding(entry) {
  return canonicalSha256("programmable.router-custom-immutable-identity.v1", {
    chainId: entry.chainId,
    routerAddress: entry.routerAddress.toLowerCase(),
    routerRuntimeCodeHash: entry.routerRuntimeCodeHash.toLowerCase(),
    routerStartBlock: entry.routerStartBlock,
    finalityConfirmations: entry.finalityConfirmations,
    launchId: entry.launchId.toLowerCase(),
    stampHash: entry.stampHash.toLowerCase(),
    transactionHash: entry.transactionHash.toLowerCase(),
    blockNumber: entry.blockNumber,
    blockHash: entry.blockHash.toLowerCase(),
    transactionIndex: entry.transactionIndex,
    logIndex: entry.logIndex,
    launchWallet: entry.launchWallet.toLowerCase(),
    tokenAddress: entry.tokenAddress.toLowerCase(),
    tokenDecimals: entry.tokenDecimals,
    hookAddress: entry.hookAddress.toLowerCase(),
    poolManagerAddress: entry.poolManagerAddress.toLowerCase(),
    poolId: entry.poolId.toLowerCase(),
    routeLauncherAddress: entry.routeLauncherAddress.toLowerCase(),
    routeLauncherRuntimeCodeHash: entry.routeLauncherRuntimeCodeHash.toLowerCase(),
  });
}

function lastKnownGoodSnapshot(snapshot) {
  return snapshot.status === "last-known-good"
    ? snapshot
    : { ...snapshot, status: "last-known-good" };
}

function selectSnapshot(fallback, current) {
  const fallbackBlock = BigInt(fallback.asOfBlock);
  const currentBlock = BigInt(current.asOfBlock);
  if (currentBlock < fallbackBlock) return fallback;
  if (
    currentBlock === fallbackBlock &&
    (current.asOfBlockHash !== fallback.asOfBlockHash ||
      current.sourceIdentityCommitment !== fallback.sourceIdentityCommitment)
  ) {
    throw new Error("Router Custom sources conflict at one boundary");
  }
  const currentByLaunch = new Map(
    current.entries.map((entry) => [entry.launchId.toLowerCase(), entry]),
  );
  const exactPinnedFallback = fallback.snapshotSha256 ===
    EXPECTED_BUNDLED_SNAPSHOT_SHA256;
  for (const fallbackEntry of fallback.entries) {
    const currentEntry = currentByLaunch.get(fallbackEntry.launchId.toLowerCase());
    if (
      !currentEntry ||
      currentEntry.tokenAddress.toLowerCase() !==
        fallbackEntry.tokenAddress.toLowerCase() ||
      (exactPinnedFallback &&
        currentEntry.entrySha256 !== fallbackEntry.entrySha256) ||
      immutableEntryBinding(currentEntry) !== immutableEntryBinding(fallbackEntry)
    ) {
      throw new Error("Router Custom current source is not an immutable superset");
    }
  }
  return current;
}

function recordFromEntry(entry, snapshot) {
  const unavailableMetric = { status: "unavailable", value: null };
  const tokenIdentityComplete = entry.tokenName !== null &&
    entry.tokenSymbol !== null && entry.tokenDecimals !== null;
  const pinnedEntry = EXPECTED_ENTRY_SHA256_BY_LAUNCH_ID.get(
    entry.launchId.toLowerCase(),
  ) === entry.entrySha256;
  const evidenceSnapshot = pinnedEntry
    ? {
        snapshotSha256: EXPECTED_BUNDLED_SNAPSHOT_SHA256,
        sourceIdentityCommitment:
          EXPECTED_SNAPSHOT_BOUNDARY.sourceIdentityCommitment,
        generatedAt: EXPECTED_SNAPSHOT_BOUNDARY.generatedAt,
        asOfBlock: EXPECTED_SNAPSHOT_BOUNDARY.asOfBlock,
        asOfBlockHash: EXPECTED_SNAPSHOT_BOUNDARY.asOfBlockHash,
      }
    : snapshot;
  const record = {
    schemaVersion: "2.0.0",
    platformId: "programmable",
    publicLabel: "Programmable Custom",
    launchId: entry.launchId.toLowerCase(),
    category: "custom",
    chainId: entry.chainId,
    caip2: `eip155:${entry.chainId}`,
    projectId: null,
    model: { id: ROUTER_CUSTOM_MODEL, version: ROUTER_CUSTOM_MODEL_VERSION },
    token: {
      address: entry.tokenAddress,
      identityStatus: tokenIdentityComplete ? "complete" : "partial",
      name: entry.tokenName,
      symbol: entry.tokenSymbol,
      decimals: entry.tokenDecimals,
      totalSupplyRaw: null,
      supplyStatus: "unavailable",
      supplyAsOfBlock: null,
      metadata: {
        description: null, imageUrl: null, links: null, trustStatus: "unavailable",
      },
    },
    launch: {
      status: "live",
      origin: "first-party",
      modelId: ROUTER_CUSTOM_MODEL,
      modelVersion: ROUTER_CUSTOM_MODEL_VERSION,
      publicSubmission: false,
      creatorAddress: entry.launchWallet,
      transactionHash: entry.transactionHash.toLowerCase(),
      blockNumber: entry.blockNumber,
      blockHash: entry.blockHash.toLowerCase(),
      transactionIndex: entry.transactionIndex,
      logIndex: entry.logIndex,
      timestamp: entry.launchedAt,
      finality: "finalized",
    },
    verification: {
      sourceId: ROUTER_CUSTOM_MODEL_VERSION,
      launcherAddress: entry.routerAddress,
      registryAddress: null,
      provenanceStatus: "verified",
      sourceUrl: ROUTER_CUSTOM_VERIFICATION_URL,
    },
    capabilities: [],
    markets: [{
      marketId: `uniswap-v4:${entry.poolId.toLowerCase()}`,
      kind: "uniswap-v4",
      status: "unknown",
      baseTokenAddress: entry.tokenAddress,
      quoteTokenAddress: null,
      protocol: "uniswap-v4",
      poolId: entry.poolId.toLowerCase(),
      poolAddress: null,
      hookAddress: entry.hookAddress,
      poolManagerAddress: entry.poolManagerAddress,
      support: {
        discovery: "available", charting: "unknown", quote: "unknown",
        simulation: "unknown", execution: "unknown",
      },
      adapter: null,
      metrics: {
        price: unavailableMetric,
        liquidity: unavailableMetric,
        volume24h: unavailableMetric,
        updatedAt: null,
      },
    }],
    fees: [],
    extensions: {
      "programmable/router-stamp-v1": {
        schemaVersion: ROUTER_CUSTOM_PROVENANCE_SCHEMA,
        snapshotSchemaVersion: ROUTER_CUSTOM_SNAPSHOT_SCHEMA,
        snapshotSha256: evidenceSnapshot.snapshotSha256,
        entrySha256: entry.entrySha256,
        sourceIdentityCommitment: evidenceSnapshot.sourceIdentityCommitment,
        snapshotGeneratedAt: evidenceSnapshot.generatedAt,
        snapshotAsOfBlock: evidenceSnapshot.asOfBlock,
        snapshotAsOfBlockHash: evidenceSnapshot.asOfBlockHash,
        chainId: entry.chainId,
        routerAddress: entry.routerAddress,
        routerRuntimeCodeHash: entry.routerRuntimeCodeHash,
        routerStartBlock: entry.routerStartBlock,
        launchKind: ROUTER_CUSTOM_MODEL,
        launchId: entry.launchId.toLowerCase(),
        stampHash: entry.stampHash.toLowerCase(),
        transactionHash: entry.transactionHash.toLowerCase(),
        blockNumber: entry.blockNumber,
        blockHash: entry.blockHash.toLowerCase(),
        transactionIndex: entry.transactionIndex,
        logIndex: entry.logIndex,
        launchedAt: entry.launchedAt,
        launchWallet: entry.launchWallet,
        tokenAddress: entry.tokenAddress,
        poolManagerAddress: entry.poolManagerAddress,
        poolId: entry.poolId.toLowerCase(),
        hookAddress: entry.hookAddress,
        routeLauncherAddress: entry.routeLauncherAddress,
        routeLauncherRuntimeCodeHash: entry.routeLauncherRuntimeCodeHash,
        finalityConfirmations: entry.finalityConfirmations,
        finalizedAtBlockNumber: entry.finalizedAtBlockNumber,
        feePolicyStatus: "unavailable",
      },
    },
  };
  const block = entry.blockNumber.padStart(16, "0");
  const transaction = String(entry.transactionIndex).padStart(10, "0");
  const log = String(entry.logIndex).padStart(10, "0");
  const result = {
    ...record,
    sortKey: `${block}:${transaction}:${log}:${entry.tokenAddress.toLowerCase()}`,
  };
  if (snapshot.trustedCurrent === true) {
    Object.defineProperty(result, TRUSTED_CURRENT_ROUTER_RECORD, {
      value: true,
      enumerable: false,
      writable: false,
    });
  }
  return result;
}

function pinnedEntryFromRecord(record) {
  const extension = record.extensions["programmable/router-stamp-v1"];
  const market = record.markets[0];
  return {
    chainId: record.chainId,
    routerAddress: extension.routerAddress,
    routerRuntimeCodeHash: extension.routerRuntimeCodeHash,
    routerStartBlock: extension.routerStartBlock,
    finalityConfirmations: extension.finalityConfirmations,
    finalizedAtBlockNumber: extension.finalizedAtBlockNumber,
    launchId: record.launchId,
    stampHash: extension.stampHash,
    transactionHash: record.launch.transactionHash,
    blockNumber: record.launch.blockNumber,
    blockHash: record.launch.blockHash,
    transactionIndex: record.launch.transactionIndex,
    logIndex: record.launch.logIndex,
    launchedAt: record.launch.timestamp,
    launchWallet: record.launch.creatorAddress,
    tokenAddress: record.token.address,
    tokenName: record.token.name,
    tokenSymbol: record.token.symbol,
    tokenDecimals: record.token.decimals,
    hookAddress: market.hookAddress,
    poolManagerAddress: market.poolManagerAddress,
    poolId: market.poolId,
    routeLauncherAddress: extension.routeLauncherAddress,
    routeLauncherRuntimeCodeHash: extension.routeLauncherRuntimeCodeHash,
  };
}

export function hasExactRouterStampedCustomRecordShape(record) {
  const extension = record?.extensions?.["programmable/router-stamp-v1"];
  const market = record?.markets?.[0];
  const pinnedEntrySha256 = typeof record?.launchId === "string"
    ? EXPECTED_ENTRY_SHA256_BY_LAUNCH_ID.get(record.launchId.toLowerCase())
    : null;
  let computedEntrySha256 = null;
  try {
    computedEntrySha256 = extension && market
      ? canonicalSha256(
          "programmable.router-custom-identity-entry.v1",
          pinnedEntryFromRecord(record),
        )
      : null;
  } catch {
    return false;
  }
  return Boolean(
    record?.schemaVersion === "2.0.0" &&
      record.platformId === "programmable" &&
      record.publicLabel === "Programmable Custom" &&
      record.category === "custom" && record.chainId === 1 &&
      record.caip2 === "eip155:1" && record.projectId === null &&
      record.model?.id === ROUTER_CUSTOM_MODEL &&
      record.model?.version === ROUTER_CUSTOM_MODEL_VERSION &&
      ["complete", "partial"].includes(record.token?.identityStatus) &&
      ADDRESS.test(record.token?.address ?? "") &&
      (record.token.name === null || safeText(record.token.name, 256) !== null) &&
      (record.token.symbol === null || safeText(record.token.symbol, 64) !== null) &&
      (record.token.decimals === null || (
        safeIndex(record.token.decimals) !== null && record.token.decimals <= 255
      )) &&
      record.token.identityStatus === (
        record.token.name !== null && record.token.symbol !== null &&
        record.token.decimals !== null ? "complete" : "partial"
      ) &&
      record.token.totalSupplyRaw === null &&
      record.token.supplyStatus === "unavailable" &&
      record.token.supplyAsOfBlock === null &&
      record.token.metadata?.description === null &&
      record.token.metadata?.imageUrl === null &&
      record.token.metadata?.links === null &&
      record.token.metadata?.trustStatus === "unavailable" &&
      record.launch?.status === "live" && record.launch.origin === "first-party" &&
      record.launch.modelId === ROUTER_CUSTOM_MODEL &&
      record.launch.modelVersion === ROUTER_CUSTOM_MODEL_VERSION &&
      record.launch.publicSubmission === false &&
      ADDRESS.test(record.launch.creatorAddress ?? "") &&
      HASH32.test(record.launch.transactionHash ?? "") &&
      safeDecimal(record.launch.blockNumber) !== null &&
      HASH32.test(record.launch.blockHash ?? "") &&
      safeIndex(record.launch.transactionIndex) !== null &&
      safeIndex(record.launch.logIndex) !== null &&
      safeInstant(record.launch.timestamp) !== null &&
      record.launch.finality === "finalized" &&
      record.verification?.sourceId === ROUTER_CUSTOM_MODEL_VERSION &&
      sameHex(record.verification.launcherAddress, extension?.routerAddress) &&
      record.verification.registryAddress === null &&
      record.verification.provenanceStatus === "verified" &&
      record.verification.sourceUrl === ROUTER_CUSTOM_VERIFICATION_URL &&
      Array.isArray(record.capabilities) && record.capabilities.length === 0 &&
      Array.isArray(record.markets) && record.markets.length === 1 &&
      market.marketId === `uniswap-v4:${extension.poolId}` &&
      market.kind === "uniswap-v4" && market.status === "unknown" &&
      sameHex(market.baseTokenAddress, record.token.address) &&
      market.quoteTokenAddress === null && market.protocol === "uniswap-v4" &&
      sameHex(market.poolId, extension.poolId) && market.poolAddress === null &&
      sameHex(market.hookAddress, extension.hookAddress) &&
      sameHex(market.poolManagerAddress, extension.poolManagerAddress) &&
      market.support?.discovery === "available" &&
      market.support?.charting === "unknown" &&
      market.support?.quote === "unknown" &&
      market.support?.simulation === "unknown" &&
      market.support?.execution === "unknown" && market.adapter === null &&
      market.metrics?.price?.status === "unavailable" &&
      market.metrics.price.value === null &&
      market.metrics?.liquidity?.status === "unavailable" &&
      market.metrics.liquidity.value === null &&
      market.metrics?.volume24h?.status === "unavailable" &&
      market.metrics.volume24h.value === null &&
      market.metrics.updatedAt === null &&
      Array.isArray(record.fees) && record.fees.length === 0 &&
      record.feePolicy === undefined &&
      exactKeys(extension, [
        "schemaVersion", "snapshotSchemaVersion", "snapshotSha256",
        "entrySha256", "sourceIdentityCommitment", "snapshotGeneratedAt",
        "snapshotAsOfBlock", "snapshotAsOfBlockHash", "chainId",
        "routerAddress", "routerRuntimeCodeHash", "routerStartBlock",
        "launchKind", "launchId", "stampHash", "transactionHash",
        "blockNumber", "blockHash", "transactionIndex", "logIndex",
        "launchedAt", "launchWallet", "tokenAddress", "poolManagerAddress",
        "poolId", "hookAddress", "routeLauncherAddress",
        "routeLauncherRuntimeCodeHash", "finalityConfirmations",
        "finalizedAtBlockNumber", "feePolicyStatus",
      ]) &&
      extension.schemaVersion === ROUTER_CUSTOM_PROVENANCE_SCHEMA &&
      extension.snapshotSchemaVersion === ROUTER_CUSTOM_SNAPSHOT_SCHEMA &&
      SHA256.test(extension.snapshotSha256 ?? "") &&
      SHA256.test(extension.entrySha256 ?? "") &&
      computedEntrySha256 === extension.entrySha256 &&
      SHA256.test(extension.sourceIdentityCommitment ?? "") &&
      safeInstant(extension.snapshotGeneratedAt) !== null &&
      safeDecimal(extension.snapshotAsOfBlock) !== null &&
      HASH32.test(extension.snapshotAsOfBlockHash ?? "") &&
      (!pinnedEntrySha256 || (
        extension.snapshotSha256 === EXPECTED_BUNDLED_SNAPSHOT_SHA256 &&
        extension.entrySha256 === pinnedEntrySha256 &&
        computedEntrySha256 === pinnedEntrySha256 &&
        extension.sourceIdentityCommitment ===
          EXPECTED_SNAPSHOT_BOUNDARY.sourceIdentityCommitment &&
        extension.snapshotGeneratedAt === EXPECTED_SNAPSHOT_BOUNDARY.generatedAt &&
        extension.snapshotAsOfBlock === EXPECTED_SNAPSHOT_BOUNDARY.asOfBlock &&
        sameHex(extension.snapshotAsOfBlockHash,
          EXPECTED_SNAPSHOT_BOUNDARY.asOfBlockHash)
      )) &&
      extension.chainId === record.chainId &&
      extension.launchKind === ROUTER_CUSTOM_MODEL &&
      sameHex(extension.launchId, record.launchId) &&
      HASH32.test(extension.stampHash ?? "") &&
      sameHex(extension.transactionHash, record.launch.transactionHash) &&
      extension.blockNumber === record.launch.blockNumber &&
      sameHex(extension.blockHash, record.launch.blockHash) &&
      extension.transactionIndex === record.launch.transactionIndex &&
      extension.logIndex === record.launch.logIndex &&
      extension.launchedAt === record.launch.timestamp &&
      sameHex(extension.launchWallet, record.launch.creatorAddress) &&
      sameHex(extension.tokenAddress, record.token.address) &&
      safeDecimal(extension.routerStartBlock) !== null &&
      Number.isSafeInteger(extension.finalityConfirmations) &&
      extension.finalityConfirmations > 0 &&
      safeDecimal(extension.finalizedAtBlockNumber) !== null &&
      BigInt(extension.finalizedAtBlockNumber) >=
        BigInt(extension.blockNumber) + BigInt(extension.finalityConfirmations) &&
      BigInt(extension.finalizedAtBlockNumber) <=
        BigInt(extension.snapshotAsOfBlock) &&
      extension.feePolicyStatus === "unavailable"
  );
}

function isPinnedFallbackRecord(record) {
  const extension = record?.extensions?.["programmable/router-stamp-v1"];
  const expectedEntrySha256 = typeof record?.launchId === "string"
    ? EXPECTED_ENTRY_SHA256_BY_LAUNCH_ID.get(record.launchId.toLowerCase())
    : null;
  return Boolean(
    expectedEntrySha256 &&
      extension?.snapshotSha256 === EXPECTED_BUNDLED_SNAPSHOT_SHA256 &&
      extension.entrySha256 === expectedEntrySha256 &&
      extension.sourceIdentityCommitment ===
        EXPECTED_SNAPSHOT_BOUNDARY.sourceIdentityCommitment &&
      extension.snapshotGeneratedAt === EXPECTED_SNAPSHOT_BOUNDARY.generatedAt &&
      extension.snapshotAsOfBlock === EXPECTED_SNAPSHOT_BOUNDARY.asOfBlock &&
      sameHex(extension.snapshotAsOfBlockHash,
        EXPECTED_SNAPSHOT_BOUNDARY.asOfBlockHash)
  );
}

export function isTrustedRouterStampedCustomRecord(record) {
  return Boolean(
    hasExactRouterStampedCustomRecordShape(record) &&
      (record?.[TRUSTED_CURRENT_ROUTER_RECORD] === true ||
        isPinnedFallbackRecord(record)),
  );
}

export function carryRouterCustomTrust(source, target) {
  if (source?.[TRUSTED_CURRENT_ROUTER_RECORD] === true) {
    Object.defineProperty(target, TRUSTED_CURRENT_ROUTER_RECORD, {
      value: true,
      enumerable: false,
      writable: false,
    });
  }
  return target;
}

export function isRouterStampedCustom(record, manifest) {
  if (!isTrustedRouterStampedCustomRecord(record)) return false;
  const extension = record.extensions["programmable/router-stamp-v1"];
  let binding;
  try {
    binding = exactRouterBinding(manifest);
  } catch {
    return false;
  }
  return Boolean(
    extension.chainId === binding.chainId &&
      sameHex(extension.routerAddress, binding.address) &&
      sameHex(extension.routerRuntimeCodeHash, binding.runtimeCodeHash) &&
      extension.routerStartBlock === binding.startBlock &&
      extension.finalityConfirmations === binding.finalityConfirmations &&
      sameHex(extension.poolManagerAddress, binding.poolManager) &&
      sameHex(extension.routeLauncherAddress, binding.graphFactory) &&
      sameHex(extension.routeLauncherRuntimeCodeHash,
        binding.graphFactoryRuntimeCodeHash)
  );
}

export async function readRouterCustomRecords(manifest) {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const fallback = await bundledSnapshot(manifest);
    let baseline = fallback;
    if (lastAcceptedSourceSnapshot) {
      baseline = selectSnapshot(fallback, lastAcceptedSourceSnapshot);
    }
    let snapshot = lastKnownGoodSnapshot(baseline);
    try {
      snapshot = selectSnapshot(baseline, await currentSource(manifest));
      lastAcceptedSourceSnapshot = snapshot;
    } catch {
      snapshot = lastKnownGoodSnapshot(baseline);
    }
    const value = {
      status: snapshot.status,
      generatedAt: snapshot.generatedAt,
      asOfBlock: snapshot.asOfBlock,
      asOfBlockHash: snapshot.asOfBlockHash,
      sourceIdentityCommitment: snapshot.sourceIdentityCommitment,
      snapshotSha256: snapshot.snapshotSha256,
      verifiedIdentityCount: snapshot.verifiedIdentityCount,
      records: snapshot.entries
        .map((entry) => recordFromEntry(entry, snapshot))
        .sort(compareLaunchesDescending),
    };
    cache = { value, expiresAt: Date.now() + ROUTER_CUSTOM_CACHE_MS };
    return value;
  })().finally(() => {
    cachePromise = null;
  });
  return cachePromise;
}

export function resetRouterCustomCacheForTest(options = {}) {
  bundledSnapshotPromise = null;
  cache = null;
  cachePromise = null;
  if (options.preserveAcceptedSource !== true) {
    lastAcceptedSourceSnapshot = null;
  }
}
