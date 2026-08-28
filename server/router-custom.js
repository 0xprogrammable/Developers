import { readFile } from "node:fs/promises";

import { readBoundedJson } from "./bounded-body.js";
import { canonicalSha256 } from "./canonical.js";
import { compareLaunchesDescending } from "./normalize.js";
import {
  ethCall,
  parseQuantity,
  readBlock,
  readFinalizedBlock,
  readHeadBlock,
  readLogs,
  rpcCall,
  toQuantity,
} from "./rpc.js";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const QUANTITY = /^0x(?:0|[1-9a-f][0-9a-f]*)$/i;
const PROHIBITED_TEXT =
  /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;

export const ROUTER_CUSTOM_SOURCE = "canonical-launch-stamp-router";
export const ROUTER_CUSTOM_SOURCE_URL =
  "https://programmable.market/api/indexers/v1/router-custom-identities";
export const FINALIZED_CUSTOM_METADATA_SOURCE_URL =
  "https://api.programmable.market/v3/finalized-custom-launches";
const ROUTER_CUSTOM_SNAPSHOT_CAPTURE_URL =
  "https://programmable.market/api/explore?limit=100&page=1&sort=newest";
const ROUTER_CUSTOM_SNAPSHOT_SCHEMA =
  "programmable.router-custom-identity-snapshot.v1";
const ROUTER_CUSTOM_PROVENANCE_SCHEMA =
  "programmable.launch-stamp-provenance.v1";
const FINALIZED_CUSTOM_METADATA_PROJECTION_SCHEMA =
  "programmable.finalized-project-metadata-projection.v1";
const FINALIZED_CUSTOM_METADATA_EXTENSION =
  "programmable/finalized-project-metadata-v1";
const PLATFORM_CURATED_LEGACY_PRESENTATION_SCHEMA =
  "programmable.platform-curated-legacy-presentation.v1";
const PLATFORM_CURATED_LEGACY_PRESENTATION_EXTENSION =
  "programmable/platform-curated-legacy-presentation-v1";
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
const SHARD_PLATFORM_CURATED_LEGACY_PRESENTATION = Object.freeze({
  identity: Object.freeze({
    chainId: 1,
    tokenAddress: "0xFAce73B63787960282f2d4682d3752Beb25271Ad",
    launchId:
      "0xe253f3bd22fcb3d6cb20b9d408287e30f0f1aeeb56426b779425c35fd6411de9",
    stampHash:
      "0x55fbb83ac4599303b146cb4a2f7c1c906d8b3e9fe4fbbe5bf9cf44e905cc3ce0",
    hookAddress: "0x07a16735325723fEa4f4a52ED5E9da687766A0Cc",
    poolManagerAddress: "0x000000000004444c5dc75cB358380D2e3dE08A90",
    poolId:
      "0x9c74d6183b1ee526a62db562a81da3bf579b5bd6bff5066ae985265a7028e010",
    routerRuntimeCodeHash:
      "0x40e27ecf201761d5eb66bc4f2d5c6124831ef078d7baf458ca5f41b1a8108546",
    routeLauncherRuntimeCodeHash:
      "0xd23692fae59331592048e71a96d4963e170ee56e449683dc9f7fa3f9470018b8",
  }),
  runtimeEvidence: Object.freeze({
    tokenRuntimeCodeHash:
      "0xb2737fd93f2ff31e850e2be773e6e7a92a239b28091be1d4b122ff864cd7aae8",
    hookRuntimeCodeHash:
      "0x168f82b0d458a35676522562489b2fec71929e4717c3d98b4893ef63e69e8da6",
  }),
  presentation: Object.freeze({
    imageUrl: "https://programmable.market/brand/projects/shard-token-v1.png",
    imageContentSha256:
      "sha256:01311db4e3af189d4b383b7a0f63c615adfcf959c552b2a61df5e5597768fb91",
    links: Object.freeze({
      website: "https://shards.gallery/",
      x: "https://x.com/ShardsToken",
    }),
  }),
});
const ROUTER_CUSTOM_SOURCE_RESPONSE_BYTES = 16 * 1_024 * 1_024;
const ROUTER_CUSTOM_SOURCE_TIMEOUT_MS = 6_000;
const FINALIZED_CUSTOM_METADATA_RESPONSE_BYTES = 4 * 1_024 * 1_024;
const FINALIZED_CUSTOM_METADATA_TIMEOUT_MS = 6_000;
const FINALIZED_CUSTOM_METADATA_MAXIMUM_PAGES = 400;
const ROUTER_CUSTOM_CACHE_MS = 15_000;
const ROUTER_CUSTOM_FINALIZED_HEAD_MAXIMUM_LAG_BLOCKS = 256;
const ROUTER_CUSTOM_FINALIZED_SCAN_MAXIMUM_BLOCKS = 250_000;
const ROUTER_CUSTOM_FINALIZED_SCAN_CHUNK_BLOCKS = 10_000;
// Only records produced after validating the complete source commitment receive
// this non-serializable capability. A source-shaped object cannot self-assign it.
const TRUSTED_CURRENT_ROUTER_RECORD = Symbol("trusted-current-router-record");
const TRUSTED_FINALIZED_CUSTOM_METADATA = Symbol(
  "trusted-finalized-custom-metadata",
);
const ACCEPTED_ROUTER_MEMBERSHIP = Symbol("accepted-router-membership");

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

function curatedLegacyPresentationEvidence(identity) {
  const expected = SHARD_PLATFORM_CURATED_LEGACY_PRESENTATION;
  if (
    identity?.chainId !== expected.identity.chainId ||
    !sameHex(identity.tokenAddress, expected.identity.tokenAddress) ||
    !sameHex(identity.launchId, expected.identity.launchId) ||
    !sameHex(identity.stampHash, expected.identity.stampHash) ||
    !sameHex(identity.hookAddress, expected.identity.hookAddress) ||
    !sameHex(identity.poolManagerAddress, expected.identity.poolManagerAddress) ||
    !sameHex(identity.poolId, expected.identity.poolId) ||
    !sameHex(
      identity.routerRuntimeCodeHash,
      expected.identity.routerRuntimeCodeHash,
    ) ||
    !sameHex(
      identity.routeLauncherRuntimeCodeHash,
      expected.identity.routeLauncherRuntimeCodeHash,
    )
  ) return null;
  const unsigned = {
    schemaVersion: PLATFORM_CURATED_LEGACY_PRESENTATION_SCHEMA,
    source: "platform-curated-legacy-presentation",
    identity: structuredClone(expected.identity),
    runtimeEvidence: structuredClone(expected.runtimeEvidence),
    presentation: structuredClone(expected.presentation),
  };
  return {
    ...unsigned,
    evidenceHash: canonicalSha256(
      PLATFORM_CURATED_LEGACY_PRESENTATION_SCHEMA,
      unsigned,
    ),
  };
}

function exactCuratedLegacyPresentation(record) {
  const extension = record?.extensions?.[
    PLATFORM_CURATED_LEGACY_PRESENTATION_EXTENSION
  ];
  if (extension === undefined) return null;
  const router = record?.extensions?.["programmable/router-stamp-v1"];
  const market = record?.markets?.[0];
  const expected = curatedLegacyPresentationEvidence({
    chainId: record?.chainId,
    tokenAddress: record?.token?.address,
    launchId: record?.launchId,
    stampHash: router?.stampHash,
    hookAddress: market?.hookAddress,
    poolManagerAddress: market?.poolManagerAddress,
    poolId: market?.poolId,
    routerRuntimeCodeHash: router?.routerRuntimeCodeHash,
    routeLauncherRuntimeCodeHash: router?.routeLauncherRuntimeCodeHash,
  });
  if (expected === null) return null;
  try {
    return canonicalSha256(
      PLATFORM_CURATED_LEGACY_PRESENTATION_SCHEMA,
      extension,
    ) === canonicalSha256(
      PLATFORM_CURATED_LEGACY_PRESENTATION_SCHEMA,
      expected,
    ) ? extension : null;
  } catch {
    return null;
  }
}

function withCuratedLegacyPresentation(metadata, evidence) {
  if (evidence === null) return metadata;
  return {
    ...metadata,
    imageUrl: evidence.presentation.imageUrl,
    links: structuredClone(evidence.presentation.links),
    trustStatus: "sanitized",
  };
}

function canonicalHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0 &&
      parsed.username === "" && parsed.password === "" &&
      parsed.href === value;
  } catch {
    return false;
  }
}

function canonicalPublicImageUri(value) {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value);
    return ["https:", "ipfs:", "ar:"].includes(parsed.protocol) &&
      parsed.username === "" && parsed.password === "" &&
      parsed.href === value;
  } catch {
    return false;
  }
}

function canonicalProjectTokenStaticBinding(value) {
  if (!exactKeys(value, ["argumentIndex", "argumentName", "staticSource"])) {
    return false;
  }
  if (value.staticSource === "not-deterministically-extractable") {
    return value.argumentIndex === null && value.argumentName === null;
  }
  return ["constructor-argument", "initializer-argument"].includes(
    value.staticSource,
  ) && Number.isSafeInteger(value.argumentIndex) && value.argumentIndex >= 0 &&
    safeText(value.argumentName, 256) !== null;
}

function canonicalProjectTokenMetadataBinding(value) {
  return Boolean(
    exactKeys(value, [
      "declarationBinding", "name", "postDeploymentReadback",
      "schemaVersion", "standardReadModel", "symbol", "tokenTargetId",
    ]) &&
      value.schemaVersion === "programmable.project-token-metadata-binding.v1" &&
      safeText(value.tokenTargetId, 128) !== null &&
      value.declarationBinding === "request-and-launch-id" &&
      exactKeys(value.standardReadModel, ["name", "symbol"]) &&
      typeof value.standardReadModel.name === "boolean" &&
      typeof value.standardReadModel.symbol === "boolean" &&
      canonicalProjectTokenStaticBinding(value.name) &&
      canonicalProjectTokenStaticBinding(value.symbol) &&
      value.postDeploymentReadback === "required"
  );
}

function canonicalPresentationImage(value) {
  return value === null || Boolean(
    exactKeys(value, [
      "byteLength", "contentSha256", "height", "mediaType", "uri", "width",
    ]) &&
      canonicalPublicImageUri(value.uri) &&
      SHA256.test(value.contentSha256 ?? "") &&
      ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        value.mediaType,
      ) &&
      Number.isSafeInteger(value.byteLength) && value.byteLength >= 1 &&
      value.byteLength <= 20 * 1024 * 1024 &&
      Number.isSafeInteger(value.width) && value.width >= 1 &&
      value.width <= 8_192 && Number.isSafeInteger(value.height) &&
      value.height >= 1 && value.height <= 8_192
  );
}

function canonicalPresentation(value) {
  if (!exactKeys(value, ["description", "image", "links", "schemaVersion"]) ||
    value.schemaVersion !== "programmable.launch-presentation-draft.v1" ||
    typeof value.description !== "string" || value.description.length > 4_096 ||
    value.description.normalize("NFC") !== value.description ||
    value.description.trim() !== value.description ||
    PROHIBITED_TEXT.test(value.description) ||
    !canonicalPresentationImage(value.image) || !Array.isArray(value.links) ||
    value.links.length > 32) {
    return false;
  }
  const seen = new Set();
  for (const link of value.links) {
    if (!exactKeys(link, ["kind", "uri"]) ||
      !["website", "documentation", "x", "telegram", "discord", "github", "other"]
        .includes(link.kind) || !canonicalHttpsUrl(link.uri)) {
      return false;
    }
    const key = `${link.kind}\u0000${link.uri}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function canonicalProjectMetadata(value, expectedHash) {
  if (!exactKeys(value, [
    "presentation", "schemaVersion", "token", "tokenMetadataBinding",
  ]) || value.schemaVersion !== "programmable.project-metadata.v1" ||
    !exactKeys(value.token, ["name", "symbol"]) ||
    safeText(value.token.name, 64) === null ||
    safeText(value.token.symbol, 16) === null ||
    !canonicalPresentation(value.presentation) ||
    !canonicalProjectTokenMetadataBinding(value.tokenMetadataBinding)) {
    return false;
  }
  try {
    return canonicalSha256("programmable.project-metadata.v1", value) ===
      expectedHash;
  } catch {
    return false;
  }
}

function canonicalTokenMetadataReadback(value, projectMetadata) {
  const observedText = (text, maximum) => text === null || (
    typeof text === "string" && text.length <= maximum &&
    text.normalize("NFC") === text && !PROHIBITED_TEXT.test(text)
  );
  if (!exactKeys(value, [
    "declared", "observed", "observedAt", "observedAtBlockNumber", "status",
  ]) || !["matching", "mismatch", "unavailable"].includes(value.status) ||
    !exactKeys(value.declared, ["name", "symbol"]) ||
    value.declared.name !== projectMetadata.token.name ||
    value.declared.symbol !== projectMetadata.token.symbol ||
    !exactKeys(value.observed, ["name", "symbol"]) ||
    !observedText(value.observed.name, 1_024) ||
    !observedText(value.observed.symbol, 256) ||
    !(value.observedAtBlockNumber === null ||
      safeDecimal(value.observedAtBlockNumber) !== null) ||
    !(value.observedAt === null || safeInstant(value.observedAt) !== null)) {
    return false;
  }
  return value.status !== "matching" || (
    value.observed.name === value.declared.name &&
    value.observed.symbol === value.declared.symbol &&
    value.observedAtBlockNumber !== null && value.observedAt !== null
  );
}

function projectedTokenMetadata(projectMetadata) {
  const presentation = projectMetadata.presentation;
  const description = presentation.description.length > 0 &&
      presentation.description.length <= 2_000
    ? presentation.description
    : null;
  const imageUrl = presentation.image &&
      canonicalHttpsUrl(presentation.image.uri)
    ? presentation.image.uri
    : null;
  const links = {};
  const ambiguousKinds = new Set();
  const mappedKinds = new Map([
    ["website", "website"], ["x", "x"], ["telegram", "telegram"],
    ["documentation", "documentation"], ["github", "github"],
  ]);
  for (const link of presentation.links) {
    const key = mappedKinds.get(link.kind);
    if (!key) continue;
    if (Object.hasOwn(links, key)) {
      delete links[key];
      ambiguousKinds.add(key);
    } else if (!ambiguousKinds.has(key)) {
      links[key] = link.uri;
    }
  }
  const projectedLinks = Object.keys(links).length > 0 ? links : null;
  return {
    description,
    imageUrl,
    links: projectedLinks,
    trustStatus: description !== null || imageUrl !== null || projectedLinks !== null
      ? "creator-declared"
      : "unavailable",
  };
}

function exactRouterBinding(manifest) {
  const router = manifest?.launchStampRouter;
  const runtimeCodeHash = router?.runtimeCodeHash;
  const getter = (name, signature, selector) =>
    router?.getters?.[name]?.signature === signature &&
    router.getters[name].selector === selector;
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
    !getter("chainId", "CHAIN_ID()", "0x85e1f4d0") ||
    !getter("graphFactory", "GRAPH_FACTORY()", "0x1cc9e5ce") ||
    !getter(
      "graphFactoryRuntimeCodeHash",
      "GRAPH_FACTORY_RUNTIME_CODE_HASH()",
      "0x92989a00",
    ) ||
    !getter("poolManager", "POOL_MANAGER()", "0x62308e85") ||
    !getter(
      "poolManagerRuntimeCodeHash",
      "POOL_MANAGER_RUNTIME_CODE_HASH()",
      "0x38d831c4",
    ) ||
    !getter("token", "launchIdByToken(address)", "0x1dad847c") ||
    !getter("pool", "launchIdByPool(address,bytes32)", "0x361df6f3") ||
    !getter("record", "launchStamp(bytes32)", "0x4c9e4764") ||
    !getter("stampProof", "stampProof(address)", "0x174b9f9d") ||
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
    launchStampedTopic: router.events.launchStamped.topic0,
    customGraphKind: router.enumValues.launchKind.customGraph,
    graphFactory: router.bindings.graphFactory,
    graphFactoryRuntimeCodeHash: router.bindings.graphFactoryRuntimeCodeHash,
    poolManager: router.bindings.poolManager,
    poolManagerRuntimeCodeHash: router.bindings.poolManagerRuntimeCodeHash,
    getters: Object.freeze({
      chainId: router.getters.chainId.selector,
      graphFactory: router.getters.graphFactory.selector,
      graphFactoryRuntimeCodeHash:
        router.getters.graphFactoryRuntimeCodeHash.selector,
      poolManager: router.getters.poolManager.selector,
      poolManagerRuntimeCodeHash:
        router.getters.poolManagerRuntimeCodeHash.selector,
      token: router.getters.token.selector,
      pool: router.getters.pool.selector,
      record: router.getters.record.selector,
      stampProof: router.getters.stampProof.selector,
    }),
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
    // The snapshot cursor bounds launch events, while finalizedAtBlockNumber
    // independently proves the required confirmation depth was observed.
    BigInt(blockNumber) > BigInt(boundary.asOfBlock) ||
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

function abiWords(value, count, label) {
  if (
    typeof value !== "string" ||
    value.length !== 2 + count * 64 ||
    !/^0x[0-9a-f]+$/i.test(value)
  ) {
    throw new Error(`${label} is not canonical ABI data`);
  }
  return Array.from({ length: count }, (_, index) =>
    `0x${value.slice(2 + index * 64, 2 + (index + 1) * 64).toLowerCase()}`);
}

function abiAddress(word, label) {
  if (!/^0x0{24}[0-9a-f]{40}$/i.test(word)) {
    throw new Error(`${label} is not a canonical ABI address`);
  }
  return `0x${word.slice(-40).toLowerCase()}`;
}

function abiSafeInteger(word, label) {
  const value = BigInt(word);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return number;
}

function encodedAddress(address) {
  if (!ADDRESS.test(address)) throw new Error("Router address input is invalid");
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function decodedLaunchLog(raw, binding) {
  if (
    !raw || typeof raw !== "object" ||
    !sameHex(raw.address, binding.address) ||
    !Array.isArray(raw.topics) || raw.topics.length !== 4 ||
    !sameHex(raw.topics[0], binding.launchStampedTopic) ||
    !HASH32.test(raw.topics[1] ?? "") ||
    raw.removed === true ||
    !QUANTITY.test(raw.blockNumber ?? "") ||
    !QUANTITY.test(raw.transactionIndex ?? "") ||
    !QUANTITY.test(raw.logIndex ?? "") ||
    !HASH32.test(raw.blockHash ?? "") ||
    !HASH32.test(raw.transactionHash ?? "")
  ) {
    throw new Error("Router Custom launch log is malformed");
  }
  const data = abiWords(raw.data, 3, "Router Custom launch log data");
  return Object.freeze({
    launchId: raw.topics[1].toLowerCase(),
    tokenAddress: abiAddress(raw.topics[2], "Router launch token"),
    hookAddress: abiAddress(raw.topics[3], "Router launch hook"),
    poolManagerAddress: abiAddress(data[0], "Router launch PoolManager"),
    poolId: data[1],
    stampHash: data[2],
    transactionHash: raw.transactionHash.toLowerCase(),
    blockNumber: String(parseQuantity(raw.blockNumber)),
    blockHash: raw.blockHash.toLowerCase(),
    transactionIndex: parseQuantity(raw.transactionIndex),
    logIndex: parseQuantity(raw.logIndex),
  });
}

function launchLogKey(log) {
  return `${log.transactionHash}:${log.logIndex}`;
}

function decodedStampRecord(value) {
  const words = abiWords(value, 14, "Router launchStamp result");
  return Object.freeze({
    kind: abiSafeInteger(words[0], "Router launch kind"),
    launchWallet: abiAddress(words[1], "Router launch wallet"),
    tokenAddress: abiAddress(words[2], "Router launch token"),
    hookAddress: abiAddress(words[3], "Router launch hook"),
    poolManagerAddress: abiAddress(words[4], "Router launch PoolManager"),
    poolId: words[5],
    poolKeyHash: words[6],
    componentSetHash: words[7],
    routePayloadHash: words[8],
    routeLauncherAddress: abiAddress(words[9], "Router route launcher"),
    routeLauncherRuntimeCodeHash: words[10],
    expectedResultHash: words[11],
    permitDigest: words[12],
    stampHash: words[13],
  });
}

async function readStampRecord(binding, launchId, blockNumber, provider) {
  return decodedStampRecord(await ethCall(
    binding.address,
    `${binding.getters.record}${launchId.slice(2)}`,
    provider,
    blockNumber,
  ));
}

function requireCustomRecordMatchesLog(record, log, binding) {
  if (
    record.kind !== binding.customGraphKind ||
    !sameHex(record.tokenAddress, log.tokenAddress) ||
    !sameHex(record.hookAddress, log.hookAddress) ||
    !sameHex(record.poolManagerAddress, log.poolManagerAddress) ||
    !sameHex(record.poolManagerAddress, binding.poolManager) ||
    !sameHex(record.poolId, log.poolId) ||
    !sameHex(record.stampHash, log.stampHash) ||
    !sameHex(record.routeLauncherAddress, binding.graphFactory) ||
    !sameHex(
      record.routeLauncherRuntimeCodeHash,
      binding.graphFactoryRuntimeCodeHash,
    ) ||
    [
      record.poolKeyHash,
      record.componentSetHash,
      record.routePayloadHash,
      record.expectedResultHash,
      record.permitDigest,
      record.stampHash,
    ].some((value) => value === `0x${"0".repeat(64)}`)
  ) {
    throw new Error("Router Custom finalized record does not match its launch log");
  }
}

async function finalizedCustomLaunchLogs(binding, finalized) {
  const checkpoint = Number(BigInt(EXPECTED_SNAPSHOT_BOUNDARY.asOfBlock));
  if (finalized.blockNumber < checkpoint) {
    throw new Error("Router finalized boundary regressed behind the trust checkpoint");
  }
  const gap = finalized.blockNumber - checkpoint;
  if (gap > ROUTER_CUSTOM_FINALIZED_SCAN_MAXIMUM_BLOCKS) {
    throw new Error("Router finalized scan requires a refreshed trust checkpoint");
  }
  const logs = [];
  for (
    let fromBlock = checkpoint + 1;
    fromBlock <= finalized.blockNumber;
    fromBlock += ROUTER_CUSTOM_FINALIZED_SCAN_CHUNK_BLOCKS
  ) {
    const toBlock = Math.min(
      finalized.blockNumber,
      fromBlock + ROUTER_CUSTOM_FINALIZED_SCAN_CHUNK_BLOCKS - 1,
    );
    const response = await readLogs({
      address: binding.address,
      fromBlock: toQuantity(fromBlock),
      toBlock: toQuantity(toBlock),
      topics: [binding.launchStampedTopic],
    }, finalized.provider);
    logs.push(...response.logs.map((raw) => decodedLaunchLog(raw, binding)));
  }
  const unique = new Set();
  const records = new Map();
  const custom = [];
  for (const log of logs) {
    const key = launchLogKey(log);
    if (unique.has(key)) throw new Error("Router finalized scan returned duplicates");
    unique.add(key);
    const record = await readStampRecord(
      binding,
      log.launchId,
      finalized.blockNumber,
      finalized.provider,
    );
    if (record.kind !== binding.customGraphKind) continue;
    requireCustomRecordMatchesLog(record, log, binding);
    records.set(log.launchId, record);
    custom.push(log);
  }
  return { logs: custom, records };
}

async function requireFinalizedSourceEntry(entry, log, record, binding, finalized) {
  if (
    entry.launchId.toLowerCase() !== log.launchId ||
    !sameHex(entry.tokenAddress, log.tokenAddress) ||
    !sameHex(entry.hookAddress, log.hookAddress) ||
    !sameHex(entry.poolManagerAddress, log.poolManagerAddress) ||
    !sameHex(entry.poolId, log.poolId) ||
    !sameHex(entry.stampHash, log.stampHash) ||
    !sameHex(entry.transactionHash, log.transactionHash) ||
    entry.blockNumber !== log.blockNumber ||
    !sameHex(entry.blockHash, log.blockHash) ||
    entry.transactionIndex !== log.transactionIndex ||
    entry.logIndex !== log.logIndex ||
    !sameHex(entry.launchWallet, record.launchWallet) ||
    BigInt(entry.blockNumber) + BigInt(binding.finalityConfirmations) >
      BigInt(finalized.blockNumber)
  ) {
    throw new Error("Router Custom source entry lacks exact finalized evidence");
  }

  const receiptResponse = await rpcCall(
    "eth_getTransactionReceipt",
    [entry.transactionHash],
    { preferredProvider: finalized.provider },
  );
  const receipt = receiptResponse.result;
  if (
    !receipt || receipt.status !== "0x1" ||
    !sameHex(receipt.to, binding.address) ||
    !sameHex(receipt.transactionHash, entry.transactionHash) ||
    !sameHex(receipt.blockHash, entry.blockHash) ||
    String(parseQuantity(receipt.blockNumber)) !== entry.blockNumber ||
    parseQuantity(receipt.transactionIndex) !== entry.transactionIndex ||
    !Array.isArray(receipt.logs)
  ) {
    throw new Error("Router Custom launch receipt is not successful and canonical");
  }
  const receiptLog = receipt.logs
    .filter((raw) =>
      sameHex(raw?.address, binding.address) &&
      sameHex(raw?.topics?.[0], binding.launchStampedTopic))
    .map((raw) => decodedLaunchLog(raw, binding))
    .find((candidate) => launchLogKey(candidate) === launchLogKey(log));
  if (!receiptLog || receiptLog.launchId !== log.launchId) {
    throw new Error("Router Custom launch receipt does not contain the stamped event");
  }

  const tokenLaunchId = await ethCall(
    binding.address,
    `${binding.getters.token}${encodedAddress(entry.tokenAddress)}`,
    finalized.provider,
    finalized.blockNumber,
  );
  const stampProof = abiWords(await ethCall(
    binding.address,
    `${binding.getters.stampProof}${encodedAddress(entry.tokenAddress)}`,
    finalized.provider,
    finalized.blockNumber,
  ), 2, "Router stampProof result");
  if (
    !sameHex(tokenLaunchId, entry.launchId) ||
    !sameHex(stampProof[0], entry.launchId) ||
    !sameHex(stampProof[1], entry.stampHash)
  ) {
    throw new Error("Router Custom token lookup does not match the finalized stamp");
  }

  const launchBlock = await readBlock(
    Number(BigInt(entry.blockNumber)),
    finalized.provider,
  );
  if (
    !sameHex(launchBlock.blockHash, entry.blockHash) ||
    launchBlock.timestamp === null ||
    new Date(launchBlock.timestamp * 1_000).toISOString() !== entry.launchedAt
  ) {
    throw new Error("Router Custom launch timestamp is not canonical");
  }
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
    // This is a transport-integrity check only. Publication authority comes
    // from the finalized Router logs, record getter, token proof and receipt.
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
    const finalized = await readFinalizedBlock();
    const head = await readHeadBlock();
    const chainId = await rpcCall("eth_chainId", [], {
      preferredProvider: finalized.provider,
    });
    if (
      parseQuantity(chainId.result) !== binding.chainId ||
      !HASH32.test(finalized.blockHash ?? "") ||
      head.blockNumber < finalized.blockNumber ||
      head.blockNumber - finalized.blockNumber >
        ROUTER_CUSTOM_FINALIZED_HEAD_MAXIMUM_LAG_BLOCKS
    ) {
      throw new Error("Router Custom finalized freshness is unavailable");
    }
    const sourceBlockNumber = Number(BigInt(boundary.asOfBlock));
    if (
      !Number.isSafeInteger(sourceBlockNumber) ||
      sourceBlockNumber > head.blockNumber ||
      (boundary.status === "current" &&
        head.blockNumber - sourceBlockNumber >
          ROUTER_CUSTOM_FINALIZED_HEAD_MAXIMUM_LAG_BLOCKS)
    ) {
      throw new Error("Router Custom source freshness is invalid");
    }
    const sourceBlock = await readBlock(sourceBlockNumber, finalized.provider);
    if (!sameHex(sourceBlock.blockHash, boundary.asOfBlockHash)) {
      throw new Error("Router Custom source boundary is not canonical");
    }

    const chain = await finalizedCustomLaunchLogs(binding, finalized);
    const additions = entries.filter((entry) =>
      !EXPECTED_ENTRY_SHA256_BY_LAUNCH_ID.has(entry.launchId.toLowerCase()));
    if (
      additions.some((entry) =>
        BigInt(entry.blockNumber) <= BigInt(EXPECTED_SNAPSHOT_BOUNDARY.asOfBlock)) ||
      additions.length !== chain.logs.length
    ) {
      throw new Error("Router Custom source is not the complete finalized suffix");
    }
    const sourceByLaunch = new Map(
      additions.map((entry) => [entry.launchId.toLowerCase(), entry]),
    );
    for (const log of chain.logs) {
      const entry = sourceByLaunch.get(log.launchId);
      const record = chain.records.get(log.launchId);
      if (!entry || !record) {
        throw new Error("Router Custom source omitted a finalized launch");
      }
      await requireFinalizedSourceEntry(
        entry,
        log,
        record,
        binding,
        finalized,
      );
    }
    const closing = await readBlock(finalized.blockNumber, finalized.provider);
    if (!sameHex(closing.blockHash, finalized.blockHash)) {
      throw new Error("Router Custom finalized boundary changed during verification");
    }
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
    launchedAt: entry.launchedAt,
    launchWallet: entry.launchWallet.toLowerCase(),
    tokenAddress: entry.tokenAddress.toLowerCase(),
    hookAddress: entry.hookAddress.toLowerCase(),
    poolManagerAddress: entry.poolManagerAddress.toLowerCase(),
    poolId: entry.poolId.toLowerCase(),
    routeLauncherAddress: entry.routeLauncherAddress.toLowerCase(),
    routeLauncherRuntimeCodeHash: entry.routeLauncherRuntimeCodeHash.toLowerCase(),
  });
}

function preservesOptionalMetadata(previous, next) {
  return ["tokenName", "tokenSymbol", "tokenDecimals"].every((field) =>
    previous[field] === null || previous[field] === next[field]);
}

function lastKnownGoodSnapshot(snapshot) {
  return snapshot.status === "last-known-good"
    ? snapshot
    : { ...snapshot, status: "last-known-good" };
}

function selectSnapshot(fallback, current) {
  const fallbackBlock = BigInt(fallback.asOfBlock);
  const currentBlock = BigInt(current.asOfBlock);
  if (currentBlock < fallbackBlock) {
    throw new Error("Router Custom current source regressed behind its accepted boundary");
  }
  if (
    currentBlock === fallbackBlock &&
    current.asOfBlockHash !== fallback.asOfBlockHash
  ) {
    throw new Error("Router Custom sources conflict at one boundary");
  }
  const currentByLaunch = new Map(
    current.entries.map((entry) => [entry.launchId.toLowerCase(), entry]),
  );
  for (const fallbackEntry of fallback.entries) {
    const currentEntry = currentByLaunch.get(fallbackEntry.launchId.toLowerCase());
    if (
      !currentEntry ||
      currentEntry.tokenAddress.toLowerCase() !==
        fallbackEntry.tokenAddress.toLowerCase() ||
      immutableEntryBinding(currentEntry) !== immutableEntryBinding(fallbackEntry) ||
      !preservesOptionalMetadata(fallbackEntry, currentEntry)
    ) {
      throw new Error("Router Custom current source is not an immutable superset");
    }
  }
  return current;
}

function canonicalFinalizedCheckpoint(value) {
  if (!exactKeys(value, [
    "blockHash", "blockNumber", "observations", "quorumSize", "schemaVersion",
  ]) ||
    value.schemaVersion !==
      "programmable.ethereum-finalized-checkpoint-quorum.v1" ||
    safeDecimal(value.blockNumber) === null ||
    !HASH32.test(value.blockHash ?? "") || value.quorumSize !== 2 ||
    !Array.isArray(value.observations) || value.observations.length !== 2) {
    return false;
  }
  return value.observations.every((observation, index) =>
    exactKeys(observation, [
      "commonBlockHash", "finalizedBlockHash", "finalizedBlockNumber", "provider",
    ]) && observation.provider === (index === 0 ? "primary" : "secondary") &&
      safeDecimal(observation.finalizedBlockNumber) !== null &&
      HASH32.test(observation.finalizedBlockHash ?? "") &&
      HASH32.test(observation.commonBlockHash ?? "") &&
      sameHex(observation.commonBlockHash, value.blockHash)
  );
}

function canonicalFinalizedMetadataFinality(value, entry) {
  return Boolean(
    exactKeys(value, [
      "blockHash", "blockNumber", "confirmationDepth", "finalizedCheckpoint",
      "logIndex", "requiredConfirmationDepth", "state", "transactionHash",
    ]) && value.state === "finalized" &&
      sameHex(value.transactionHash, entry.transactionHash) &&
      value.blockNumber === entry.blockNumber &&
      sameHex(value.blockHash, entry.blockHash) &&
      value.logIndex === entry.logIndex &&
      safeDecimal(value.confirmationDepth) !== null &&
      value.requiredConfirmationDepth === String(entry.finalityConfirmations) &&
      BigInt(value.confirmationDepth) >=
        BigInt(value.requiredConfirmationDepth) &&
      canonicalFinalizedCheckpoint(value.finalizedCheckpoint)
  );
}

function projectedFinalizedMetadataFinality(value, entry) {
  return Boolean(
    exactKeys(value, [
      "blockHash", "blockNumber", "logIndex", "requiredConfirmationDepth",
      "state", "transactionHash",
    ]) && value.state === "finalized" &&
      sameHex(value.transactionHash, entry.transactionHash) &&
      value.blockNumber === entry.blockNumber &&
      sameHex(value.blockHash, entry.blockHash) &&
      value.logIndex === entry.logIndex &&
      value.requiredConfirmationDepth === String(entry.finalityConfirmations)
  );
}

function canonicalFinalizedMetadataBindings(value) {
  return Boolean(
    exactKeys(value, [
      "artifactHash", "graphBundleHash", "launchIntentHash", "requestHash",
      "unboundGraphBundleHash",
    ]) && Object.values(value).every((digest) => SHA256.test(digest ?? ""))
  );
}

function finalizedMetadataEvidenceFromItem(item, entry) {
  const required = [
    "bindings", "chainId", "createdAt", "finality", "finalizedAt", "hook",
    "poolId", "poolManager", "projectMetadata", "projectMetadataHash",
    "resourceId", "router", "routerLaunchId", "schemaVersion", "token",
    "tokenMetadataReadback",
  ];
  const keys = Object.keys(item ?? {}).sort();
  const acceptedKeys = [
    [...required].sort(),
    [...required, "partnerAttribution"].sort(),
  ];
  if (!item || typeof item !== "object" || Array.isArray(item) ||
    !acceptedKeys.some((expected) =>
      keys.length === expected.length &&
      keys.every((key, index) => key === expected[index])) ||
    item.schemaVersion !== "programmable.finalized-custom-launch-metadata.v1" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(item.resourceId ?? "") ||
    item.chainId !== String(entry.chainId) ||
    !sameHex(item.routerLaunchId, entry.launchId) ||
    !sameHex(item.router, entry.routerAddress) ||
    !sameHex(item.token, entry.tokenAddress) ||
    !sameHex(item.hook, entry.hookAddress) ||
    !sameHex(item.poolManager, entry.poolManagerAddress) ||
    !sameHex(item.poolId, entry.poolId) ||
    !SHA256.test(item.projectMetadataHash ?? "") ||
    !canonicalProjectMetadata(item.projectMetadata, item.projectMetadataHash) ||
    !canonicalFinalizedMetadataBindings(item.bindings) ||
    !canonicalTokenMetadataReadback(
      item.tokenMetadataReadback,
      item.projectMetadata,
    ) ||
    !canonicalFinalizedMetadataFinality(item.finality, entry) ||
    safeInstant(item.createdAt) === null || safeInstant(item.finalizedAt) === null ||
    Date.parse(item.finalizedAt) < Date.parse(item.createdAt)) {
    return null;
  }
  if (item.tokenMetadataReadback.status === "matching" && (
    (entry.tokenName !== null &&
      item.tokenMetadataReadback.observed.name !== entry.tokenName) ||
    (entry.tokenSymbol !== null &&
      item.tokenMetadataReadback.observed.symbol !== entry.tokenSymbol)
  )) {
    return null;
  }
  return {
    schemaVersion: FINALIZED_CUSTOM_METADATA_PROJECTION_SCHEMA,
    sourceUrl: FINALIZED_CUSTOM_METADATA_SOURCE_URL,
    resourceId: item.resourceId,
    identity: {
      chainId: item.chainId,
      routerLaunchId: item.routerLaunchId.toLowerCase(),
      router: item.router,
      token: item.token,
      hook: item.hook,
      poolManager: item.poolManager,
      poolId: item.poolId.toLowerCase(),
    },
    projectMetadata: structuredClone(item.projectMetadata),
    projectMetadataHash: item.projectMetadataHash,
    bindings: structuredClone(item.bindings),
    tokenMetadataReadback: structuredClone(item.tokenMetadataReadback),
    finality: {
      state: item.finality.state,
      transactionHash: item.finality.transactionHash,
      blockNumber: item.finality.blockNumber,
      blockHash: item.finality.blockHash,
      logIndex: item.finality.logIndex,
      requiredConfirmationDepth: item.finality.requiredConfirmationDepth,
    },
    createdAt: item.createdAt,
    finalizedAt: item.finalizedAt,
  };
}

function metadataEntryFromRecord(record) {
  const extension = record?.extensions?.["programmable/router-stamp-v1"];
  const market = record?.markets?.[0];
  if (!extension || !market) return null;
  return {
    chainId: record.chainId,
    routerAddress: extension.routerAddress,
    launchId: record.launchId,
    transactionHash: record.launch.transactionHash,
    blockNumber: record.launch.blockNumber,
    blockHash: record.launch.blockHash,
    logIndex: record.launch.logIndex,
    tokenAddress: record.token.address,
    tokenName: record.token.name,
    tokenSymbol: record.token.symbol,
    hookAddress: market.hookAddress,
    poolManagerAddress: market.poolManagerAddress,
    poolId: market.poolId,
    finalityConfirmations: extension.finalityConfirmations,
  };
}

function exactFinalizedMetadataEvidence(record, evidence) {
  if (!exactKeys(evidence, [
    "bindings", "createdAt", "finality", "finalizedAt", "identity",
    "projectMetadata", "projectMetadataHash", "resourceId", "schemaVersion",
    "sourceUrl", "tokenMetadataReadback",
  ]) || evidence.schemaVersion !== FINALIZED_CUSTOM_METADATA_PROJECTION_SCHEMA ||
    evidence.sourceUrl !== FINALIZED_CUSTOM_METADATA_SOURCE_URL ||
    !exactKeys(evidence.identity, [
      "chainId", "hook", "poolId", "poolManager", "router", "routerLaunchId",
      "token",
    ])) {
    return false;
  }
  const entry = metadataEntryFromRecord(record);
  if (!entry || evidence.identity.chainId !== String(entry.chainId) ||
    !sameHex(evidence.identity.routerLaunchId, entry.launchId) ||
    !sameHex(evidence.identity.router, entry.routerAddress) ||
    !sameHex(evidence.identity.token, entry.tokenAddress) ||
    !sameHex(evidence.identity.hook, entry.hookAddress) ||
    !sameHex(evidence.identity.poolManager, entry.poolManagerAddress) ||
    !sameHex(evidence.identity.poolId, entry.poolId) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(evidence.resourceId ?? "") ||
    !SHA256.test(evidence.projectMetadataHash ?? "") ||
    !canonicalProjectMetadata(
      evidence.projectMetadata,
      evidence.projectMetadataHash,
    ) || !canonicalFinalizedMetadataBindings(evidence.bindings) ||
    !canonicalTokenMetadataReadback(
      evidence.tokenMetadataReadback,
      evidence.projectMetadata,
    ) || !projectedFinalizedMetadataFinality(evidence.finality, entry) ||
    safeInstant(evidence.createdAt) === null ||
    safeInstant(evidence.finalizedAt) === null ||
    Date.parse(evidence.finalizedAt) < Date.parse(evidence.createdAt)) {
    return false;
  }
  return evidence.tokenMetadataReadback.status !== "matching" || (
    (entry.tokenName === null ||
      evidence.tokenMetadataReadback.observed.name === entry.tokenName) &&
    (entry.tokenSymbol === null ||
      evidence.tokenMetadataReadback.observed.symbol === entry.tokenSymbol)
  );
}

function canonicalMetadataDigest(evidence) {
  return canonicalSha256(FINALIZED_CUSTOM_METADATA_PROJECTION_SCHEMA, evidence);
}

function metadataBinding(record) {
  const attached = record?.[TRUSTED_FINALIZED_CUSTOM_METADATA] ?? null;
  const projected = record?.extensions?.[FINALIZED_CUSTOM_METADATA_EXTENSION] ?? null;
  if (attached === null && projected === null) return { valid: true, digest: null };
  if (attached !== null && !exactFinalizedMetadataEvidence(record, attached)) {
    return { valid: false, digest: null };
  }
  if (projected !== null && !exactFinalizedMetadataEvidence(record, projected)) {
    return { valid: false, digest: null };
  }
  const attachedDigest = attached === null ? null : canonicalMetadataDigest(attached);
  const projectedDigest = projected === null
    ? null
    : canonicalMetadataDigest(projected);
  if (attachedDigest !== null && projectedDigest !== null &&
    attachedDigest !== projectedDigest) {
    return { valid: false, digest: null };
  }
  return { valid: true, digest: attachedDigest ?? projectedDigest };
}

function routerIdentityShapeRecord(record) {
  const evidence = record?.extensions?.[FINALIZED_CUSTOM_METADATA_EXTENSION];
  if (evidence !== undefined &&
    !exactFinalizedMetadataEvidence(record, evidence)) return null;
  const curated = exactCuratedLegacyPresentation(record);
  if (
    record?.extensions?.[PLATFORM_CURATED_LEGACY_PRESENTATION_EXTENSION] !==
      undefined && curated === null
  ) return null;
  const projected = withCuratedLegacyPresentation(
    evidence === undefined
      ? {
          description: null,
          imageUrl: null,
          links: null,
          trustStatus: "unavailable",
        }
      : projectedTokenMetadata(evidence.projectMetadata),
    curated,
  );
  try {
    if (canonicalSha256("programmable.router-custom-display-metadata.v1", projected) !==
      canonicalSha256(
        "programmable.router-custom-display-metadata.v1",
        record.token.metadata,
      )) {
      return null;
    }
  } catch {
    return null;
  }
  return {
    ...record,
    token: {
      ...record.token,
      metadata: {
        description: null,
        imageUrl: null,
        links: null,
        trustStatus: "unavailable",
      },
    },
  };
}

function canonicalFinalizedMetadataQuality(value, publishedPageRows) {
  if (!exactKeys(value, [
    "diagnostics", "publishedRowCount", "quarantinedRowCount",
    "sourceRowCount", "status",
  ]) || !["complete", "partial"].includes(value.status)) return false;
  const counts = [
    value.sourceRowCount,
    value.publishedRowCount,
    value.quarantinedRowCount,
  ];
  if (counts.some((count) =>
    !Number.isSafeInteger(count) || count < 0 || count > 25) ||
    value.publishedRowCount !== publishedPageRows ||
    value.publishedRowCount + value.quarantinedRowCount !==
      value.sourceRowCount ||
    !Array.isArray(value.diagnostics) || value.diagnostics.length > 25 ||
    value.diagnostics.length !== value.quarantinedRowCount ||
    (value.status === "complete") !== (value.quarantinedRowCount === 0)) {
    return false;
  }
  const rows = new Set();
  return value.diagnostics.every((diagnostic) => {
    if (!exactKeys(diagnostic, ["code", "rowIndex"]) ||
      diagnostic.code !== "FINALIZED_ROW_QUARANTINED" ||
      !Number.isSafeInteger(diagnostic.rowIndex) || diagnostic.rowIndex < 0 ||
      diagnostic.rowIndex > 24 ||
      diagnostic.rowIndex >= value.sourceRowCount ||
      rows.has(diagnostic.rowIndex)) return false;
    rows.add(diagnostic.rowIndex);
    return true;
  });
}

async function finalizedMetadataByLaunch(entries) {
  const wanted = new Map(
    entries.map((entry) => [entry.launchId.toLowerCase(), entry]),
  );
  const found = new Map();
  const seenCursors = new Set();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    FINALIZED_CUSTOM_METADATA_TIMEOUT_MS,
  );
  let cursor = null;
  try {
    for (let page = 0; page < FINALIZED_CUSTOM_METADATA_MAXIMUM_PAGES; page += 1) {
      const url = new URL(FINALIZED_CUSTOM_METADATA_SOURCE_URL);
      url.searchParams.set("limit", "25");
      if (cursor !== null) url.searchParams.set("cursor", cursor);
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "programmable-developer-api/2",
        },
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `Finalized Custom metadata source returned HTTP ${response.status}`,
        );
      }
      const payload = await readBoundedJson(
        response,
        FINALIZED_CUSTOM_METADATA_RESPONSE_BYTES,
        "Finalized Custom metadata response",
      );
      if (!exactKeys(payload, [
        "generatedAt", "launches", "nextCursor", "quality", "schemaVersion",
      ]) ||
        payload.schemaVersion !==
          "programmable.finalized-custom-launch-metadata-list.v1" ||
        safeInstant(payload.generatedAt) === null ||
        !Array.isArray(payload.launches) || payload.launches.length > 25 ||
        !canonicalFinalizedMetadataQuality(
          payload.quality,
          payload.launches.length,
        ) ||
        !(payload.nextCursor === null || (
          typeof payload.nextCursor === "string" &&
          payload.nextCursor.length >= 1 && payload.nextCursor.length <= 512 &&
          !PROHIBITED_TEXT.test(payload.nextCursor)
        ))) {
        throw new Error("Finalized Custom metadata envelope is invalid");
      }
      for (const item of payload.launches) {
        const launchId = typeof item?.routerLaunchId === "string"
          ? item.routerLaunchId.toLowerCase()
          : null;
        const entry = wanted.get(launchId);
        if (!entry) continue;
        const evidence = finalizedMetadataEvidenceFromItem(item, entry);
        if (!evidence || found.has(launchId)) {
          throw new Error("Finalized Custom metadata identity is invalid");
        }
        found.set(launchId, evidence);
      }
      if (payload.nextCursor === null) return found;
      if (seenCursors.has(payload.nextCursor)) {
        throw new Error("Finalized Custom metadata cursor repeated");
      }
      seenCursors.add(payload.nextCursor);
      cursor = payload.nextCursor;
    }
    throw new Error("Finalized Custom metadata pagination exceeded its bound");
  } finally {
    clearTimeout(timeout);
  }
}

function recordFromEntry(entry, snapshot) {
  const unavailableMetric = { status: "unavailable", value: null };
  const tokenIdentityComplete = entry.tokenName !== null &&
    entry.tokenSymbol !== null && entry.tokenDecimals !== null;
  const curatedPresentation = curatedLegacyPresentationEvidence({
    chainId: entry.chainId,
    tokenAddress: entry.tokenAddress,
    launchId: entry.launchId,
    stampHash: entry.stampHash,
    hookAddress: entry.hookAddress,
    poolManagerAddress: entry.poolManagerAddress,
    poolId: entry.poolId,
    routerRuntimeCodeHash: entry.routerRuntimeCodeHash,
    routeLauncherRuntimeCodeHash: entry.routeLauncherRuntimeCodeHash,
  });
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
      metadata: withCuratedLegacyPresentation({
        description: null,
        imageUrl: null,
        links: null,
        trustStatus: "unavailable",
      }, curatedPresentation),
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
      ...(curatedPresentation === null
        ? {}
        : {
            [PLATFORM_CURATED_LEGACY_PRESENTATION_EXTENSION]:
              curatedPresentation,
          }),
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
  record = routerIdentityShapeRecord(record);
  if (record === null) return false;
  const extension = record?.extensions?.["programmable/router-stamp-v1"];
  const market = record?.markets?.[0];
  const pinnedEntrySha256 = typeof record?.launchId === "string"
    ? EXPECTED_ENTRY_SHA256_BY_LAUNCH_ID.get(record.launchId.toLowerCase())
    : null;
  const pinnedEvidenceWithoutSnapshot = Boolean(
    pinnedEntrySha256 && extension &&
      extension.entrySha256 === pinnedEntrySha256 &&
      extension.sourceIdentityCommitment ===
        EXPECTED_SNAPSHOT_BOUNDARY.sourceIdentityCommitment &&
      extension.snapshotGeneratedAt === EXPECTED_SNAPSHOT_BOUNDARY.generatedAt &&
      extension.snapshotAsOfBlock === EXPECTED_SNAPSHOT_BOUNDARY.asOfBlock &&
      sameHex(extension.snapshotAsOfBlockHash,
        EXPECTED_SNAPSHOT_BOUNDARY.asOfBlockHash),
  );
  const coherentPinnedEvidence = extension?.snapshotSha256 ===
    EXPECTED_BUNDLED_SNAPSHOT_SHA256
    ? pinnedEvidenceWithoutSnapshot
    : !pinnedEvidenceWithoutSnapshot;
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
      coherentPinnedEvidence &&
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
      BigInt(extension.blockNumber) <=
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
      (record?.extensions?.[FINALIZED_CUSTOM_METADATA_EXTENSION] === undefined ||
        record?.[TRUSTED_FINALIZED_CUSTOM_METADATA] !== undefined) &&
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

function routerMembershipDigest(record) {
  if (!hasExactRouterStampedCustomRecordShape(record)) return null;
  const metadata = metadataBinding(record);
  if (!metadata.valid) return null;
  const extension = record.extensions["programmable/router-stamp-v1"];
  return canonicalSha256(
    "programmable.router-custom-accepted-membership.v1",
    {
      launchId: record.launchId.toLowerCase(),
      entrySha256: extension.entrySha256,
      snapshotSha256: extension.snapshotSha256,
      sourceIdentityCommitment: extension.sourceIdentityCommitment,
      snapshotGeneratedAt: extension.snapshotGeneratedAt,
      snapshotAsOfBlock: extension.snapshotAsOfBlock,
      snapshotAsOfBlockHash: extension.snapshotAsOfBlockHash.toLowerCase(),
      finalizedProjectMetadata: metadata.digest,
    },
  );
}

function routerEntryMembershipDigest(record) {
  if (!hasExactRouterStampedCustomRecordShape(record)) return null;
  const metadata = metadataBinding(record);
  if (!metadata.valid) return null;
  const extension = record.extensions["programmable/router-stamp-v1"];
  return canonicalSha256(
    "programmable.router-custom-accepted-entry.v1",
    {
      launchId: record.launchId.toLowerCase(),
      entrySha256: extension.entrySha256,
      finalizedProjectMetadata: metadata.digest,
    },
  );
}

function matchesTransportBoundary(record, boundary) {
  const extension = record?.extensions?.["programmable/router-stamp-v1"];
  return Boolean(
    boundary?.finality === "finalized" &&
      extension?.snapshotAsOfBlock === boundary.blockNumber &&
      sameHex(extension?.snapshotAsOfBlockHash, boundary.blockHash) &&
      extension?.sourceIdentityCommitment === boundary.identityCommitment,
  );
}

export function createRouterCustomAcceptedMembership(
  records,
  manifest,
  { transportBoundary = null } = {},
) {
  const accepted = new Set();
  const acceptedEntries = new Set();
  for (const record of records ?? []) {
    if (!isRouterStampedCustom(record, manifest)) continue;
    const digest = routerMembershipDigest(record);
    if (digest) accepted.add(digest);
    const entryDigest = routerEntryMembershipDigest(record);
    if (entryDigest) acceptedEntries.add(entryDigest);
  }
  const membership = {
    accepts(record) {
      const digest = routerMembershipDigest(record);
      if (digest !== null && accepted.has(digest)) return true;
      // A feed response may retain one accepted snapshot while the upstream
      // Router cursor advances. Keep the identity exact and bind the older
      // evidence envelope to the boundary published by that feed response.
      const entryDigest = routerEntryMembershipDigest(record);
      return entryDigest !== null && acceptedEntries.has(entryDigest) &&
        matchesTransportBoundary(record, transportBoundary);
    },
  };
  Object.defineProperty(membership, ACCEPTED_ROUTER_MEMBERSHIP, {
    value: true,
    enumerable: false,
    writable: false,
  });
  return Object.freeze(membership);
}

export function isAcceptedRouterStampedCustomRecord(record, membership = null) {
  if (isTrustedRouterStampedCustomRecord(record)) return true;
  return Boolean(
    membership?.[ACCEPTED_ROUTER_MEMBERSHIP] === true &&
      membership.accepts(record),
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
  const evidence = source?.[TRUSTED_FINALIZED_CUSTOM_METADATA] ?? null;
  if (evidence !== null && exactFinalizedMetadataEvidence(source, evidence)) {
    const copy = structuredClone(evidence);
    const curated = exactCuratedLegacyPresentation(source);
    target.token = {
      ...target.token,
      metadata: withCuratedLegacyPresentation(
        projectedTokenMetadata(copy.projectMetadata),
        curated,
      ),
    };
    target.extensions = {
      ...target.extensions,
      [FINALIZED_CUSTOM_METADATA_EXTENSION]: copy,
    };
    Object.defineProperty(target, TRUSTED_FINALIZED_CUSTOM_METADATA, {
      value: copy,
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
    const records = snapshot.entries
      .map((entry) => recordFromEntry(entry, snapshot))
      .sort(compareLaunchesDescending);
    try {
      const metadata = await finalizedMetadataByLaunch(snapshot.entries);
      for (const record of records) {
        const evidence = metadata.get(record.launchId.toLowerCase());
        if (!evidence || !exactFinalizedMetadataEvidence(record, evidence)) continue;
        Object.defineProperty(record, TRUSTED_FINALIZED_CUSTOM_METADATA, {
          value: evidence,
          enumerable: false,
          writable: false,
        });
      }
    } catch {
      // Display metadata is optional enrichment. Exact Router identities stay
      // visible and retain explicit unavailable fields when this source fails.
    }
    const value = {
      status: snapshot.status,
      generatedAt: snapshot.generatedAt,
      asOfBlock: snapshot.asOfBlock,
      asOfBlockHash: snapshot.asOfBlockHash,
      sourceIdentityCommitment: snapshot.sourceIdentityCommitment,
      snapshotSha256: snapshot.snapshotSha256,
      verifiedIdentityCount: snapshot.verifiedIdentityCount,
      records,
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
