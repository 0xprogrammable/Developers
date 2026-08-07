import { readFile } from "node:fs/promises";
import { isIP } from "node:net";

import { readBoundedText } from "./bounded-body.js";
import { canonicalSha256, canonicalizeJson, parseCanonicalJson } from "./canonical.js";
import {
  CHAIN_ID,
  LAUNCH_SCHEMA_VERSION,
  PLATFORM_FEE,
  PLATFORM_ID,
  REQUEST_LIMITS,
} from "./constants.js";
import { deriveUniswapV4PoolId } from "./keccak.js";
import {
  normalizeRegistryCustomItemV3,
  REGISTRY_V3_FEED_SOURCE_ID,
  validateRegistryCustomFeedItemV3,
} from "./registry-v3.js";
import {
  normalizeRegistryCustomItemV4,
  REGISTRY_V4_ENVELOPE_SCHEMA,
  REGISTRY_V4_FEED_SOURCE_ID,
  validateRegistryCustomFeedItemV4,
} from "./registry-v4.js";

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const SIGNED_DECIMAL = /^(0|-?[1-9][0-9]*)$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,255}$/;
const OPEN_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const TOKEN = /^[A-Za-z0-9._~+\/-]{16,16384}$/;
const PROHIBITED_TEXT = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
const FEED_SCHEMA = "programmable.custom-launch-registry-feed.v1";
const RECORD_SCHEMA = "programmable.custom-launch-registry-record.v2";
const FEED_SOURCE_ID = "programmable-custom-launch-registry-v2";
const FEE_RECIPIENT = PLATFORM_FEE.beneficiary.toLowerCase();
const encoder = new TextEncoder();
const processCheckpointStore = createMemoryRegistryCheckpointStore();

const RECORD_KEYS = [
  "advertisesToken", "assetIdentitySetHash", "blockHash", "blockNumber",
  "category", "chainId", "chainProfileHash", "chainProfileId",
  "deploymentCalldataHash", "discoverableAssets", "discoverableMarkets",
  "executionMode", "feeAssessmentHash",
  "feeAssessmentObligationBindingHash", "feeObligation", "feeObligationHash",
  "feeObligationVerificationAuthorityHash", "feeObligationVerificationEvidenceHash",
  "finalityEvidenceHash", "finalityVerificationAuthorityHash", "finalizedAt",
  "finalizedLaunchBindingHash", "githubPrincipalHash", "grantBindingHash",
  "grantId", "launchArtifactCommitmentHash", "launchEventHash", "launchFamily",
  "launchId", "launchIdentity", "launchedAt",
  "launchRouteBindingHash", "launchRouteId", "launchTransactionId", "logIndex",
  "marketSetHash", "modelId", "origin", "permitConsumptionHash", "permitId",
  "platformId", "presentation", "presentationBindingHash", "presentationVersion",
  "projectId", "registryProjectionGeneration", "schemaVersion", "sourceKind",
  "sourceRecordBindingHash", "transactionIndex",
  "websiteProjectionGeneration",
].sort();

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function safeHeader(value, maximum = 512) {
  return typeof value === "string" && value.length >= 1 && value.length <= maximum &&
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function canonicalInstant(value) {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function safeDecimal(value, positive = false) {
  if (typeof value !== "string" || value.length > 78 || !DECIMAL.test(value)) return false;
  return !positive || value !== "0";
}

function safeInteger(value) {
  if (!safeDecimal(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function exactText(value, maximumBytes, { display = false } = {}) {
  return typeof value === "string" &&
    (display || (value.length > 0 && value.trim() === value)) &&
    encoder.encode(value).byteLength <= maximumBytes &&
    !PROHIBITED_TEXT.test(value);
}

function identity(value) {
  return exactKeys(value, ["namespace", "value"]) &&
    exactText(value.namespace, 256) && exactText(value.value, 1_024);
}

function evmContractNamespace(value, chainId) {
  return value === `eip155:${chainId}` || value === `eip155:${chainId}:contract`;
}

function tokenMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    value.schemaVersion !== "programmable.discoverable-launch-token-metadata.v2" ||
    value.source !== "finality-resolved-onchain" || !DIGEST.test(value.evidenceHash)) return false;
  if (value.status === "available") {
    return exactKeys(value, ["schemaVersion", "status", "source", "name", "symbol", "decimals", "evidenceHash"]) &&
      exactText(value.name, 256, { display: true }) &&
      exactText(value.symbol, 64, { display: true }) &&
      Number.isInteger(value.decimals) && value.decimals >= 0 && value.decimals <= 255;
  }
  return value.status === "unavailable" &&
    exactKeys(value, ["schemaVersion", "status", "source", "reason", "evidenceHash"]) &&
    ["onchain-read-unavailable", "non-standard-metadata", "invalid-metadata"].includes(value.reason);
}

function assetProvenance(value, assetIdentity) {
  if (value?.kind === "launch-produced") {
    return exactKeys(value, ["kind"]);
  }
  if (value?.kind === "protocol-external") {
    return exactKeys(value, ["kind", "relationship"]) &&
      exactText(value.relationship, 256);
  }
  if (value?.kind !== "adopted-external" || !exactKeys(value, [
    "kind", "relationship", "dependencyId", "capabilityId", "reviewedRole",
    "chainProfileId", "identity", "expectedRuntimeCodeKeccak256",
    "expectedRuntimeCodeSha256", "reviewEvidenceBindingHash",
    "interfaceEvidenceBindingHash", "stateObservationIds",
  ]) || !identity(value.identity) || value.identity.namespace !== assetIdentity.namespace ||
    value.identity.value !== assetIdentity.value || !HASH32.test(value.expectedRuntimeCodeKeccak256) ||
    value.expectedRuntimeCodeKeccak256 !== value.expectedRuntimeCodeKeccak256.toLowerCase() ||
    !DIGEST.test(value.expectedRuntimeCodeSha256) || !DIGEST.test(value.reviewEvidenceBindingHash) ||
    !DIGEST.test(value.interfaceEvidenceBindingHash) || !Array.isArray(value.stateObservationIds) ||
    value.stateObservationIds.length > 256 || !exactText(value.relationship, 256) ||
    !exactText(value.dependencyId, 256) || !exactText(value.capabilityId, 256) ||
    !exactText(value.reviewedRole, 256) || !exactText(value.chainProfileId, 256)) return false;
  const observations = value.stateObservationIds;
  return observations.every((id) => exactText(id, 256)) &&
    new Set(observations).size === observations.length;
}

function validateAssets(record) {
  if (!Array.isArray(record.discoverableAssets) || record.discoverableAssets.length < 1 ||
    record.discoverableAssets.length > 1_024) return null;
  const roles = new Set(["root", "primary-token", "secondary-token", "pool", "hook", "controller"]);
  const assets = new Map();
  const identities = new Set();
  let previousAssetId = null;
  for (const asset of record.discoverableAssets) {
    if (!exactKeys(asset, ["assetId", "role", "identity", "provenance", "identityEvidenceHash", "onchainMetadata", "onchainMetadataHash"]) ||
      !SAFE_ID.test(asset.assetId) || assets.has(asset.assetId) || !roles.has(asset.role) ||
      !identity(asset.identity) || !assetProvenance(asset.provenance, asset.identity) ||
      !DIGEST.test(asset.identityEvidenceHash) ||
      (asset.onchainMetadata === null) !== (asset.onchainMetadataHash === null) ||
      (asset.onchainMetadataHash !== null && !DIGEST.test(asset.onchainMetadataHash)) ||
      (asset.role === "primary-token" && asset.onchainMetadata === null) ||
      (!asset.role.endsWith("token") && asset.onchainMetadata !== null) ||
      (asset.onchainMetadata !== null && !tokenMetadata(asset.onchainMetadata)) ||
      (asset.onchainMetadata !== null && canonicalSha256(
        "programmable.discoverable-launch-token-metadata-hash.v2",
        asset.onchainMetadata,
      ) !== asset.onchainMetadataHash)) return null;
    if (previousAssetId !== null && Buffer.compare(encoder.encode(previousAssetId), encoder.encode(asset.assetId)) >= 0) return null;
    previousAssetId = asset.assetId;
    const identityKey = `${asset.identity.namespace.length}:${asset.identity.namespace}${asset.identity.value}`;
    if (identities.has(identityKey)) return null;
    identities.add(identityKey);
    assets.set(asset.assetId, asset);
  }
  const ordered = [...assets.values()];
  const roots = ordered.filter((asset) => asset.role === "root");
  if (roots.length !== 1 || roots[0].identity.namespace !== record.launchIdentity.namespace ||
    roots[0].identity.value !== record.launchIdentity.value ||
    roots[0].provenance.kind !== "launch-produced") return null;
  if (ordered.some((asset) => asset.role === "primary-token" && asset.provenance.kind !== "launch-produced")) return null;
  const primaryCount = ordered.filter((asset) =>
    asset.role === "primary-token" && asset.provenance.kind === "launch-produced",
  ).length;
  if ((record.advertisesToken && primaryCount !== 1) || (!record.advertisesToken && primaryCount !== 0)) return null;
  const setHash = canonicalSha256("programmable.discoverable-launch-asset-set-hash.v2", {
    schemaVersion: "programmable.discoverable-launch-asset-set.v2",
    advertisesToken: record.advertisesToken,
    assets: ordered,
  });
  return setHash === record.assetIdentitySetHash ? assets : null;
}

function validateV4(value, assets, market, record) {
  if (!exactKeys(value, [
    "poolId", "poolManager", "poolManagerReviewEvidenceBindingHash",
    "poolManagerInterfaceEvidenceBindingHash", "poolManagerRuntimeCodeKeccak256",
    "poolManagerRuntimeCodeSha256", "currency0AssetId", "currency1AssetId", "feeRaw",
    "dynamicFee", "tickSpacing", "hooksAssetId", "poolKeyEvidenceHash",
  ]) || !HASH32.test(value.poolId) || value.poolId !== value.poolId.toLowerCase() ||
    !identity(value.poolManager) || !evmContractNamespace(value.poolManager.namespace, record.chainId) ||
    !ADDRESS.test(value.poolManager.value) || value.poolManager.value !== value.poolManager.value.toLowerCase() ||
    !DIGEST.test(value.poolManagerReviewEvidenceBindingHash) ||
    !DIGEST.test(value.poolManagerInterfaceEvidenceBindingHash) ||
    !HASH32.test(value.poolManagerRuntimeCodeKeccak256) ||
    value.poolManagerRuntimeCodeKeccak256 !== value.poolManagerRuntimeCodeKeccak256.toLowerCase() ||
    !DIGEST.test(value.poolManagerRuntimeCodeSha256) ||
    !SAFE_ID.test(value.currency0AssetId) || !SAFE_ID.test(value.currency1AssetId) ||
    !safeDecimal(value.feeRaw) || typeof value.dynamicFee !== "boolean" ||
    typeof value.tickSpacing !== "string" || !SIGNED_DECIMAL.test(value.tickSpacing) ||
    (value.hooksAssetId !== null && !SAFE_ID.test(value.hooksAssetId)) ||
    !DIGEST.test(value.poolKeyEvidenceHash)) return false;
  const pool = assets.get(market.marketAssetId);
  const currency0 = assets.get(value.currency0AssetId);
  const currency1 = assets.get(value.currency1AssetId);
  const hook = value.hooksAssetId === null ? null : assets.get(value.hooksAssetId);
  const chainNamespace = `eip155:${record.chainId}`;
  const manager = [...assets.values()].find((asset) =>
    asset.role === "controller" && asset.identity.namespace === value.poolManager.namespace &&
    asset.identity.value === value.poolManager.value,
  );
  const fee = BigInt(value.feeRaw);
  const tick = BigInt(value.tickSpacing);
  const hookAddress = hook?.identity.value ?? "0x0000000000000000000000000000000000000000";
  let derivedPoolId;
  try {
    derivedPoolId = deriveUniswapV4PoolId({
      currency0: currency0?.identity.value,
      currency1: currency1?.identity.value,
      feeRaw: value.feeRaw,
      tickSpacing: value.tickSpacing,
      hooks: hookAddress,
    });
  } catch {
    return false;
  }
  return pool?.role === "pool" && pool.identity.namespace === `${chainNamespace}:uniswap-v4-pool-id` &&
    pool.identity.value === value.poolId && value.poolId === derivedPoolId &&
    evmContractNamespace(value.poolManager.namespace, record.chainId) && manager?.provenance.kind === "adopted-external" &&
    manager.provenance.relationship === "uniswap-v4-pool-manager" &&
    manager.provenance.dependencyId === "dependency:uniswap-v4-pool-manager" &&
    manager.provenance.capabilityId === "capability:uniswap-v4-pool-manager" &&
    manager.provenance.reviewedRole === "uniswap-v4-pool-manager" &&
    manager.provenance.chainProfileId === record.chainProfileId &&
    manager.provenance.reviewEvidenceBindingHash === value.poolManagerReviewEvidenceBindingHash &&
    manager.provenance.interfaceEvidenceBindingHash === value.poolManagerInterfaceEvidenceBindingHash &&
    manager.provenance.expectedRuntimeCodeKeccak256 === value.poolManagerRuntimeCodeKeccak256 &&
    manager.provenance.expectedRuntimeCodeSha256 === value.poolManagerRuntimeCodeSha256 &&
    currency0 && currency1 && currency0.assetId !== currency1.assetId &&
    evmContractNamespace(currency0.identity.namespace, record.chainId) &&
    evmContractNamespace(currency1.identity.namespace, record.chainId) &&
    currency0.identity.value === currency0.identity.value.toLowerCase() &&
    currency1.identity.value === currency1.identity.value.toLowerCase() &&
    new Set([currency0.assetId, currency1.assetId]).has(market.baseAssetId) &&
    new Set([currency0.assetId, currency1.assetId]).has(market.quoteAssetId) &&
    ADDRESS.test(currency0.identity.value) && ADDRESS.test(currency1.identity.value) &&
    BigInt(currency0.identity.value) < BigInt(currency1.identity.value) &&
    ((value.dynamicFee && fee === 0x800000n) || (!value.dynamicFee && fee <= 1_000_000n)) &&
    tick >= -8_388_608n && tick <= 8_388_607n &&
    (hook === null || (hook.role === "hook" && evmContractNamespace(hook.identity.namespace, record.chainId) &&
      ADDRESS.test(hook.identity.value) && hook.identity.value === hook.identity.value.toLowerCase()));
}

function marketVerification(value) {
  if (value?.status === "verified") {
    return exactKeys(value, ["status", "verifierAdapterId", "verifierBindingHash"]) &&
      OPEN_ID.test(value.verifierAdapterId) && DIGEST.test(value.verifierBindingHash);
  }
  return value?.status === "pending" &&
    exactKeys(value, ["status", "verifierAdapterId", "verifierBindingHash"]) &&
    value.verifierAdapterId === null && value.verifierBindingHash === null;
}

function validateMarkets(record, assets) {
  if (!Array.isArray(record.discoverableMarkets) || record.discoverableMarkets.length > 256 ||
    (!record.advertisesToken && record.discoverableMarkets.length !== 0)) return false;
  const seen = new Set();
  const marketAssets = new Set();
  let previousMarketId = null;
  for (const market of record.discoverableMarkets) {
    if (!exactKeys(market, ["marketId", "kind", "status", "marketAssetId", "baseAssetId", "quoteAssetId", "marketEvidenceHash", "verification", "uniswapV4"]) ||
      !SAFE_ID.test(market.marketId) || seen.has(market.marketId) || !OPEN_ID.test(market.kind) ||
      !["active", "paused", "closed", "verification_pending"].includes(market.status) ||
      !SAFE_ID.test(market.marketAssetId) || !SAFE_ID.test(market.baseAssetId) || !SAFE_ID.test(market.quoteAssetId) ||
      market.baseAssetId === market.quoteAssetId || !DIGEST.test(market.marketEvidenceHash) ||
      !marketVerification(market.verification) || marketAssets.has(market.marketAssetId) ||
      (previousMarketId !== null && Buffer.compare(encoder.encode(previousMarketId), encoder.encode(market.marketId)) >= 0)) return false;
    previousMarketId = market.marketId;
    seen.add(market.marketId);
    marketAssets.add(market.marketAssetId);
    const marketAsset = assets.get(market.marketAssetId);
    const base = assets.get(market.baseAssetId);
    const quote = assets.get(market.quoteAssetId);
    if (!marketAsset || base?.role !== "primary-token" || quote?.role !== "secondary-token" ||
      !["pool", "controller", "hook"].includes(marketAsset.role)) return false;
    if (market.kind === "uniswap-v4-pool") {
      if (market.verification.status !== "verified" ||
        market.verification.verifierAdapterId !== "uniswap-v4-pool-finality:v2" ||
        !validateV4(market.uniswapV4, assets, market, record) ||
        canonicalSha256("programmable.uniswap-v4-pool-finality-verifier-binding.v2", {
          poolManagerReviewEvidenceBindingHash: market.uniswapV4.poolManagerReviewEvidenceBindingHash,
          poolManagerInterfaceEvidenceBindingHash: market.uniswapV4.poolManagerInterfaceEvidenceBindingHash,
          poolManagerRuntimeCodeKeccak256: market.uniswapV4.poolManagerRuntimeCodeKeccak256,
          poolManagerRuntimeCodeSha256: market.uniswapV4.poolManagerRuntimeCodeSha256,
          poolKeyEvidenceHash: market.uniswapV4.poolKeyEvidenceHash,
        }) !== market.verification.verifierBindingHash) return false;
    } else if (market.uniswapV4 !== null || market.verification.status !== "pending" || market.status !== "verification_pending") return false;
  }
  return canonicalSha256("programmable.discoverable-launch-market-set-hash.v2", {
    schemaVersion: "programmable.discoverable-launch-market-set.v2",
    assetIdentitySetHash: record.assetIdentitySetHash,
    markets: record.discoverableMarkets,
  }) === record.marketSetHash;
}

function validateFee(record) {
  const fee = record.feeObligation;
  const keys = ["applicabilityPredicate", "chainId", "chainProfileHash", "chainProfileId", "claimSemantics",
    "enforcementModuleBindingHash", "enforcementModuleId", "enforcementRouteBindingHash", "enforcementRouteId",
    "feeAssessmentHash", "feeAssessmentObligationBindingHash", "feeBasis", "feeObligationHash", "qualifyingFlowBasis",
    "qualifyingFlowBasisBindingHash", "ratePpm", "recipient", "schemaVersion"];
  return exactKeys(fee, keys) && fee.schemaVersion === "programmable.launch-fee-obligation.v2" &&
    fee.feeAssessmentHash === record.feeAssessmentHash && fee.feeObligationHash === record.feeObligationHash &&
    fee.feeAssessmentObligationBindingHash === record.feeAssessmentObligationBindingHash &&
    fee.chainId === record.chainId && fee.chainProfileId === record.chainProfileId && fee.chainProfileHash === record.chainProfileHash &&
    fee.ratePpm === 1_000 && identity(fee.recipient) &&
    fee.recipient.namespace === `eip155:${record.chainId}` && fee.recipient.value.toLowerCase() === FEE_RECIPIENT &&
    fee.applicabilityPredicate === "all-qualifying-launch-flows" &&
    fee.feeBasis === "gross-qualifying-flow-volume" && fee.claimSemantics === "recipient-claimable-accrual" &&
    SAFE_ID.test(fee.qualifyingFlowBasis) && DIGEST.test(fee.qualifyingFlowBasisBindingHash) &&
    SAFE_ID.test(fee.enforcementRouteId) && DIGEST.test(fee.enforcementRouteBindingHash) &&
    SAFE_ID.test(fee.enforcementModuleId) && DIGEST.test(fee.enforcementModuleBindingHash);
}

function publicHttpsUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value ||
    encoder.encode(value).byteLength > 2_048 || PROHIBITED_TEXT.test(value)) return false;
  try {
    const url = new URL(value);
    return url.href === value && url.protocol === "https:" && url.username === "" &&
      url.password === "" && url.hostname !== "" && url.hostname !== "localhost" &&
      !url.hostname.endsWith(".localhost") && isIP(url.hostname) === 0 && url.port === "";
  } catch {
    return false;
  }
}

function presentationImageUrl(value) {
  if (publicHttpsUrl(value)) return true;
  return typeof value === "string" && encoder.encode(value).byteLength <= 2_048 &&
    (/^ipfs:\/\/(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|[bB][a-zA-Z2-7]{31,127})$/u.test(value) ||
      /^ar:\/\/[A-Za-z0-9_-]{43}$/u.test(value));
}

function validatePresentation(record) {
  const empty = record.presentationVersion === null &&
    record.presentationBindingHash === null && record.presentation === null;
  if (empty) return true;
  if (!safeDecimal(record.presentationVersion, true) ||
    !DIGEST.test(record.presentationBindingHash)) return false;
  const draft = record.presentation;
  if (!exactKeys(draft, ["description", "image", "links", "schemaVersion"]) ||
    draft.schemaVersion !== "programmable.launch-presentation-draft.v1" ||
    typeof draft.description !== "string" || draft.description !== draft.description.normalize("NFC") ||
    draft.description !== draft.description.trim() || /\r/u.test(draft.description) ||
    encoder.encode(draft.description).byteLength > 4_096 || PROHIBITED_TEXT.test(draft.description) ||
    !Array.isArray(draft.links) || draft.links.length > 32) return false;
  let previous = null;
  for (const link of draft.links) {
    if (!exactKeys(link, ["kind", "uri"]) ||
      !["website", "documentation", "x", "telegram", "discord", "github", "other"].includes(link.kind) ||
      !publicHttpsUrl(link.uri)) return false;
    const key = `${link.kind}\u0000${link.uri}`;
    if (previous !== null && Buffer.compare(encoder.encode(previous), encoder.encode(key)) >= 0) return false;
    previous = key;
  }
  if (draft.image === null) return true;
  const image = draft.image;
  return exactKeys(image, ["byteLength", "contentSha256", "height", "mediaType", "uri", "width"]) &&
    DIGEST.test(image.contentSha256) &&
    ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(image.mediaType) &&
    Number.isSafeInteger(image.byteLength) && image.byteLength >= 1 && image.byteLength <= 20 * 1_024 * 1_024 &&
    Number.isSafeInteger(image.width) && image.width >= 1 && image.width <= 8_192 &&
    Number.isSafeInteger(image.height) && image.height >= 1 && image.height <= 8_192 &&
    presentationImageUrl(image.uri);
}

export function validateRegistryCustomRecord(record) {
  if (!exactKeys(record, RECORD_KEYS) || record.schemaVersion !== RECORD_SCHEMA ||
    record.platformId !== PLATFORM_ID || record.origin !== PLATFORM_ID || record.category !== "custom" ||
    record.launchFamily !== "custom" || !OPEN_ID.test(record.modelId) ||
    !DIGEST.test(record.projectId) || !DIGEST.test(record.launchId) || !SAFE_ID.test(record.grantId) ||
    !DIGEST.test(record.grantBindingHash) || !DIGEST.test(record.githubPrincipalHash) ||
    !["browser-wallet-report", "legacy-executor"].includes(record.sourceKind) ||
    !DIGEST.test(record.finalizedLaunchBindingHash) ||
    !DIGEST.test(record.sourceRecordBindingHash) ||
    record.chainId !== String(CHAIN_ID) || !SAFE_ID.test(record.chainProfileId) || !DIGEST.test(record.chainProfileHash) ||
    !SAFE_ID.test(record.launchRouteId) || !DIGEST.test(record.launchRouteBindingHash) || !SAFE_ID.test(record.executionMode) ||
    !identity(record.launchIdentity) || typeof record.advertisesToken !== "boolean" ||
    !DIGEST.test(record.assetIdentitySetHash) || !DIGEST.test(record.marketSetHash) ||
    !HASH32.test(record.launchTransactionId) || !HASH32.test(record.blockHash) ||
    safeInteger(record.blockNumber) === null || safeInteger(record.transactionIndex) === null ||
    (record.logIndex !== null && safeInteger(record.logIndex) === null) ||
    (record.launchEventHash !== null && !DIGEST.test(record.launchEventHash)) ||
    !DIGEST.test(record.launchArtifactCommitmentHash) ||
    !DIGEST.test(record.deploymentCalldataHash) || !DIGEST.test(record.permitId) ||
    !DIGEST.test(record.permitConsumptionHash) ||
    !DIGEST.test(record.feeAssessmentHash) || !DIGEST.test(record.feeObligationHash) ||
    !DIGEST.test(record.feeAssessmentObligationBindingHash) ||
    !DIGEST.test(record.feeObligationVerificationAuthorityHash) || !DIGEST.test(record.feeObligationVerificationEvidenceHash) ||
    !DIGEST.test(record.finalityEvidenceHash) || !DIGEST.test(record.finalityVerificationAuthorityHash) ||
    !safeDecimal(record.registryProjectionGeneration) || !safeDecimal(record.websiteProjectionGeneration) ||
    !canonicalInstant(record.launchedAt) || !canonicalInstant(record.finalizedAt) ||
    Date.parse(record.finalizedAt) < Date.parse(record.launchedAt) ||
    record.projectId !== canonicalSha256("programmable.custom-launch-project-id.v2", {
      launchFamily: "custom", grantId: record.grantId, grantBindingHash: record.grantBindingHash,
    }) ||
    record.launchId !== canonicalSha256("programmable.custom-launch-id.v2", {
      launchFamily: "custom", projectId: record.projectId, chainId: record.chainId,
      launchIdentity: record.launchIdentity,
    }) || !validatePresentation(record)) return false;
  const assets = validateAssets(record);
  return assets !== null && validateMarkets(record, assets) && validateFee(record);
}

function exactHttpsUrl(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError(`${label} is invalid`); }
  if (url.protocol !== "https:" || url.hostname.endsWith(".example") || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/v2/custom-launch-feed")) {
    throw new TypeError(`${label} must be an exact HTTPS custom-feed URL`);
  }
  return url;
}

function exactHttpsEndpoint(value, label) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError(`${label} is invalid`); }
  if (url.protocol !== "https:" || url.hostname.endsWith(".example") || url.username || url.password || url.search || url.hash || url.pathname === "/") {
    throw new TypeError(`${label} must be an exact HTTPS endpoint`);
  }
  return url.href;
}

export function registryCustomFeedConfiguration(env = process.env) {
  const requiredNames = [
    "PROGRAMMABLE_REGISTRY_CUSTOM_FEED_URL", "PROGRAMMABLE_REGISTRY_CUSTOM_FEED_AUDIENCE",
    "PROGRAMMABLE_REGISTRY_CUSTOM_FEED_TARGET_BINDING", "PROGRAMMABLE_WORKLOAD_TOKEN_ENDPOINT",
    "PROGRAMMABLE_WORKLOAD_ISSUER", "PROGRAMMABLE_WORKLOAD_SUBJECT",
  ];
  const names = [
    ...requiredNames,
    "PROGRAMMABLE_WORKLOAD_SUBJECT_TOKEN",
    "PROGRAMMABLE_WORKLOAD_SUBJECT_TOKEN_FILE",
  ];
  const present = names.filter((name) => typeof env[name] === "string" && env[name].length > 0);
  if (present.length === 0) return null;
  if (!requiredNames.every((name) => present.includes(name))) {
    throw new TypeError("Registry custom-feed configuration is incomplete");
  }
  const hasInlineToken = typeof env.PROGRAMMABLE_WORKLOAD_SUBJECT_TOKEN === "string" && env.PROGRAMMABLE_WORKLOAD_SUBJECT_TOKEN.length > 0;
  const hasFileToken = typeof env.PROGRAMMABLE_WORKLOAD_SUBJECT_TOKEN_FILE === "string" && env.PROGRAMMABLE_WORKLOAD_SUBJECT_TOKEN_FILE.length > 0;
  if (hasInlineToken && hasFileToken) throw new TypeError("Configure exactly one Registry workload subject token source");
  const subjectToken = hasInlineToken
    ? { kind: "inline", value: env.PROGRAMMABLE_WORKLOAD_SUBJECT_TOKEN }
    : hasFileToken
      ? { kind: "file", value: env.PROGRAMMABLE_WORKLOAD_SUBJECT_TOKEN_FILE }
      : null;
  if (!subjectToken) throw new TypeError("Registry workload subject token is unavailable");
  const targetBindingHash = env.PROGRAMMABLE_REGISTRY_CUSTOM_FEED_TARGET_BINDING;
  if (!DIGEST.test(targetBindingHash)) throw new TypeError("Registry target binding is invalid");
  const audience = safeHeader(env.PROGRAMMABLE_REGISTRY_CUSTOM_FEED_AUDIENCE, 256);
  const issuer = safeHeader(env.PROGRAMMABLE_WORKLOAD_ISSUER, 256);
  const subject = safeHeader(env.PROGRAMMABLE_WORKLOAD_SUBJECT, 256);
  if (!audience || !issuer || !subject) throw new TypeError("Registry workload identity is invalid");
  return Object.freeze({
    feedUrl: exactHttpsUrl(env.PROGRAMMABLE_REGISTRY_CUSTOM_FEED_URL, "Registry feed URL").href,
    audience, targetBindingHash,
    tokenEndpoint: exactHttpsEndpoint(env.PROGRAMMABLE_WORKLOAD_TOKEN_ENDPOINT, "workload token endpoint"),
    issuer, subject, subjectToken,
  });
}

export function createMemoryRegistryCheckpointStore() {
  const checkpoints = new Map();
  return Object.freeze({
    async load(key) {
      const value = checkpoints.get(key);
      return value === undefined ? null : structuredClone(value);
    },
    async save(key, value) {
      checkpoints.set(key, structuredClone(value));
    },
  });
}

function checkpointKey(configuration) {
  return canonicalSha256("programmable.developer-registry-checkpoint-key.v1", {
    feedUrl: configuration.feedUrl,
    audience: configuration.audience,
    targetBindingHash: configuration.targetBindingHash,
  });
}

function validateCheckpoint(value) {
  if (value === null) return null;
  if (!exactKeys(value, ["highWaterGeneration", "records", "resumeCursor"]) ||
    !safeDecimal(value.highWaterGeneration) || !Array.isArray(value.records) ||
    value.records.length > REQUEST_LIMITS.registryMaximumLaunches ||
    typeof value.resumeCursor !== "string" || value.resumeCursor.length < 16 ||
    value.resumeCursor.length > 4_096) {
    throw new TypeError("Registry custom-feed checkpoint is invalid");
  }
  let expected = 1n;
  let schemaRank = 0;
  for (const item of value.records) {
    const currentSourceId = registryFeedSourceIdForItem(item);
    const currentSchemaRank = registryFeedSchemaRank(item);
    if (!safeDecimal(item.generation, true) ||
      BigInt(item.generation) !== expected ||
      currentSchemaRank < schemaRank ||
      !validateRegistryFeedItem(item, currentSourceId)) {
      throw new TypeError("Registry custom-feed checkpoint is invalid");
    }
    schemaRank = currentSchemaRank;
    expected += 1n;
  }
  if (expected - 1n !== BigInt(value.highWaterGeneration)) {
    throw new TypeError("Registry custom-feed checkpoint is incomplete");
  }
  return value;
}

function registryFeedSourceIdForItem(item) {
  if (item?.schemaVersion === REGISTRY_V4_ENVELOPE_SCHEMA) {
    return REGISTRY_V4_FEED_SOURCE_ID;
  }
  return "projectionDigest" in (item ?? {})
    ? REGISTRY_V3_FEED_SOURCE_ID
    : FEED_SOURCE_ID;
}

function registryFeedSchemaRank(item) {
  return {
    [FEED_SOURCE_ID]: 2,
    [REGISTRY_V3_FEED_SOURCE_ID]: 3,
    [REGISTRY_V4_FEED_SOURCE_ID]: 4,
  }[registryFeedSourceIdForItem(item)];
}

async function subjectToken(configuration) {
  const value = configuration.subjectToken.kind === "file"
    ? (await readFile(configuration.subjectToken.value, "utf8")).trim()
    : configuration.subjectToken.value;
  if (!TOKEN.test(value)) throw new TypeError("workload subject token is invalid");
  return value;
}

async function defaultAccessToken(configuration, request, signal, fetchImplementation) {
  const body = new URLSearchParams({
    audience: configuration.audience,
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    subject_token: await subjectToken(configuration),
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    authorization_details: canonicalizeJson([{ type: "programmable_projection_request_v2", ...request }]),
  });
  const response = await fetchImplementation(configuration.tokenEndpoint, {
    method: "POST", redirect: "error", cache: "no-store", credentials: "omit", signal,
    headers: {
      accept: "application/json", "content-type": "application/x-www-form-urlencoded",
      "x-programmable-workload-issuer": configuration.issuer,
      "x-programmable-workload-subject": configuration.subject,
    }, body,
  });
  if (response.status !== 200 || response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    throw new TypeError("workload token exchange failed");
  }
  const value = JSON.parse(await readBoundedText(response, 65_536, "workload token response"));
  if (!exactKeys(value, ["access_token", "expires_in", "token_type"]) ||
    !TOKEN.test(value.access_token) || value.token_type !== "Bearer" ||
    !Number.isSafeInteger(value.expires_in) || value.expires_in < 30 || value.expires_in > 600) {
    throw new TypeError("workload token response is invalid");
  }
  validateRequestBoundAccessToken(value.access_token, configuration, request);
  return value.access_token;
}

function decodeCanonicalJwtPart(value, maximumBytes) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError("workload token JWT encoding is invalid");
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length > maximumBytes || bytes.toString("base64url") !== value) {
    throw new TypeError("workload token JWT encoding is invalid");
  }
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return parseCanonicalJson(source);
}

function validateRequestBoundAccessToken(token, configuration, request) {
  const segments = token.split(".");
  if (segments.length !== 3 || !/^[A-Za-z0-9_-]{64,}$/.test(segments[2])) {
    throw new TypeError("workload token JWT is invalid");
  }
  const header = decodeCanonicalJwtPart(segments[0], 4_096);
  const payload = decodeCanonicalJwtPart(segments[1], 16_384);
  if (!exactKeys(header, ["alg", "kid", "typ"]) || header.alg !== "EdDSA" || header.typ !== "JWT" || !SAFE_ID.test(header.kid) ||
    !exactKeys(payload, ["aud", "exp", "iat", "iss", "jti", "lane", "method", "projectionKey", "schemaVersion", "sub", "targetBindingHash"]) ||
    payload.schemaVersion !== "programmable.projection-workload-access-token.v2" || payload.iss !== configuration.issuer ||
    payload.sub !== configuration.subject || payload.aud !== configuration.audience || payload.method !== request.method ||
    payload.lane !== request.lane || payload.targetBindingHash !== request.targetBindingHash ||
    payload.projectionKey !== request.projectionKey || !SAFE_ID.test(payload.jti) ||
    !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) {
    throw new TypeError("workload token JWT claims are invalid");
  }
  const now = Math.floor(Date.now() / 1_000);
  if (payload.iat > now || payload.exp <= now || payload.exp <= payload.iat || payload.exp - payload.iat > 600) {
    throw new TypeError("workload token JWT lifetime is invalid");
  }
}

function validateFeedPage(page, previous, now) {
  if (!exactKeys(page, ["schemaVersion", "source", "snapshot", "items", "page"]) || page.schemaVersion !== FEED_SCHEMA ||
    !exactKeys(page.source, ["sourceId", "status", "completeness", "freshness", "checkedAt", "latestAcceptedAt"]) ||
    ![
      FEED_SOURCE_ID,
      REGISTRY_V3_FEED_SOURCE_ID,
      REGISTRY_V4_FEED_SOURCE_ID,
    ].includes(page.source.sourceId) ||
    page.source.status !== "ready" ||
    page.source.completeness !== "complete" || page.source.freshness !== "current" ||
    !canonicalInstant(page.source.checkedAt) || (page.source.latestAcceptedAt !== null && !canonicalInstant(page.source.latestAcceptedAt)) ||
    !exactKeys(page.snapshot, ["highWaterGeneration", "indexedAt"]) || !safeDecimal(page.snapshot.highWaterGeneration) ||
    !canonicalInstant(page.snapshot.indexedAt) || !Array.isArray(page.items) || page.items.length > REQUEST_LIMITS.registryPageSize ||
    !exactKeys(page.page, ["nextCursor", "resumeCursor", "hasMore"]) ||
    (page.page.nextCursor !== null && (typeof page.page.nextCursor !== "string" || page.page.nextCursor.length < 16 || page.page.nextCursor.length > 4_096)) ||
    typeof page.page.resumeCursor !== "string" || page.page.resumeCursor.length < 16 || page.page.resumeCursor.length > 4_096 ||
    typeof page.page.hasMore !== "boolean" || page.page.hasMore !== (page.page.nextCursor !== null)) {
    throw new TypeError("Registry custom-feed page is invalid");
  }
  const checkedAt = Date.parse(page.source.checkedAt);
  const latestAcceptedAt = page.source.latestAcceptedAt === null
    ? null
    : Date.parse(page.source.latestAcceptedAt);
  if (page.snapshot.indexedAt !== page.source.checkedAt || checkedAt > now + 30_000 ||
    now - checkedAt > 120_000 || (latestAcceptedAt !== null && latestAcceptedAt > checkedAt)) {
    throw new TypeError("Registry custom feed is not current");
  }
  if (previous && (page.snapshot.highWaterGeneration !== previous.highWaterGeneration ||
    page.source.sourceId !== previous.sourceId ||
    page.source.latestAcceptedAt !== previous.latestAcceptedAt)) {
    throw new TypeError("Registry custom-feed snapshot changed during traversal");
  }
}

function validateRegistryFeedItem(item, sourceId) {
  const itemSourceId = registryFeedSourceIdForItem(item);
  if (sourceId !== FEED_SOURCE_ID && sourceId !== itemSourceId) return false;
  if (itemSourceId === REGISTRY_V4_FEED_SOURCE_ID) {
    return validateRegistryCustomFeedItemV4(item);
  }
  if (itemSourceId === REGISTRY_V3_FEED_SOURCE_ID) {
    return validateRegistryCustomFeedItemV3(item);
  }
  return exactKeys(item, ["generation", "projectionKey", "recordHash", "record"]) &&
    safeDecimal(item.generation, true) &&
    item.projectionKey === `custom:${item.record?.launchId}` &&
    DIGEST.test(item.recordHash) && validateRegistryCustomRecord(item.record) &&
    canonicalSha256(RECORD_SCHEMA, item.record) === item.recordHash;
}

export async function readRegistryCustomFeed(options = {}) {
  const configuration = options.configuration ?? registryCustomFeedConfiguration();
  if (configuration === null) {
    return { configured: false, records: [], source: null, snapshot: null };
  }
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const accessToken = options.accessToken ?? ((input) => defaultAccessToken(
    configuration, input.request, input.signal, fetchImplementation,
  ));
  const checkpointStore = options.checkpointStore ??
    (options.configuration === undefined ? processCheckpointStore : null);
  const stateKey = checkpointKey(configuration);
  const checkpoint = checkpointStore === null
    ? null
    : validateCheckpoint(await checkpointStore.load(stateKey));
  const records = checkpoint === null ? [] : [...checkpoint.records];
  let cursor = checkpoint?.resumeCursor ?? null;
  let previous = null;
  let expectedGeneration = BigInt(checkpoint?.highWaterGeneration ?? "0") + 1n;
  let schemaRank = records.length === 0
    ? 0
    : registryFeedSchemaRank(records.at(-1));
  const checkpointHighWater = expectedGeneration - 1n;
  const seenCursors = new Set();
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  for (let pageIndex = 0; pageIndex < REQUEST_LIMITS.registryMaximumPages; pageIndex += 1) {
    if (cursor !== null) {
      if (seenCursors.has(cursor)) throw new TypeError("Registry custom-feed cursor loop detected");
      seenCursors.add(cursor);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_LIMITS.registryTimeoutMs);
    try {
      const url = new URL(configuration.feedUrl);
      url.searchParams.set("limit", String(REQUEST_LIMITS.registryPageSize));
      if (cursor !== null) url.searchParams.set("cursor", cursor);
      const projectionKey = `feed:${canonicalSha256("programmable.custom-launch-registry-feed-request.v1", {
        path: url.pathname, cursor, limit: REQUEST_LIMITS.registryPageSize,
      })}`;
      const request = Object.freeze({
        schemaVersion: "programmable.projection-workload-token-request.v2",
        method: "GET", lane: "registry.custom-launched",
        targetBindingHash: configuration.targetBindingHash, projectionKey,
        idempotencyKey: null, requestDigest: null,
      });
      const bearer = await accessToken({ audience: configuration.audience, targetBindingHash: configuration.targetBindingHash, request, signal: controller.signal });
      if (!TOKEN.test(bearer)) throw new TypeError("Registry feed credential is invalid");
      const response = await fetchImplementation(url, {
        method: "GET", redirect: "error", cache: "no-store", credentials: "omit", signal: controller.signal,
        headers: {
          accept: "application/json", authorization: `Bearer ${bearer}`,
          "x-programmable-audience": configuration.audience,
          "x-programmable-target-binding": configuration.targetBindingHash,
          "x-programmable-projection-kind": "registry.custom-launched",
        },
      });
      if (response.status !== 200 || response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
        throw new TypeError("Registry custom feed is unavailable");
      }
      const page = parseCanonicalJson(await readBoundedText(response, REQUEST_LIMITS.registryResponseBytes, "Registry custom-feed response"));
      validateFeedPage(page, previous, now());
      if (BigInt(page.snapshot.highWaterGeneration) < checkpointHighWater) {
        throw new TypeError("Registry custom-feed snapshot rolled back");
      }
      previous ??= {
        highWaterGeneration: page.snapshot.highWaterGeneration,
        latestAcceptedAt: page.source.latestAcceptedAt,
        sourceId: page.source.sourceId,
        source: page.source,
        snapshot: page.snapshot,
      };
      for (const item of page.items) {
        const currentSchemaRank = registryFeedSchemaRank(item);
        if (!safeDecimal(item.generation, true) ||
          BigInt(item.generation) !== expectedGeneration ||
          currentSchemaRank < schemaRank ||
          !validateRegistryFeedItem(item, page.source.sourceId)) {
          throw new TypeError("Registry custom-feed item is invalid");
        }
        schemaRank = currentSchemaRank;
        expectedGeneration += 1n;
        records.push(item);
        if (records.length > REQUEST_LIMITS.registryMaximumLaunches) throw new TypeError("Registry custom feed exceeds launch limit");
      }
      if (!page.page.hasMore) {
        if (expectedGeneration - 1n !== BigInt(page.snapshot.highWaterGeneration)) {
          throw new TypeError("Registry custom feed is incomplete");
        }
        if (checkpointStore !== null) {
          await checkpointStore.save(stateKey, {
            highWaterGeneration: page.snapshot.highWaterGeneration,
            records,
            resumeCursor: page.page.resumeCursor,
          });
        }
        return { configured: true, records, source: page.source, snapshot: page.snapshot };
      }
      cursor = page.page.nextCursor;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new TypeError("Registry custom feed exceeds page limit");
}

function publicAsset(asset) {
  return {
    assetId: asset.assetId,
    role: asset.role,
    identity: { ...asset.identity },
    provenance: asset.provenance.kind === "adopted-external"
      ? {
          ...asset.provenance,
          identity: { ...asset.provenance.identity },
          stateObservationIds: [...asset.provenance.stateObservationIds],
        }
      : { ...asset.provenance },
    identityEvidenceHash: asset.identityEvidenceHash,
    onchainMetadata: asset.onchainMetadata === null ? null : { ...asset.onchainMetadata },
    onchainMetadataHash: asset.onchainMetadataHash,
  };
}

function evmAssetAddress(asset, chainId) {
  return asset?.role?.endsWith("token") &&
    evmContractNamespace(asset.identity?.namespace, chainId) &&
    ADDRESS.test(asset.identity.value) && asset.identity.value === asset.identity.value.toLowerCase()
    ? asset.identity.value
    : null;
}

function publicToken(record, assets) {
  if (!record.advertisesToken) return null;
  const primary = record.discoverableAssets.find((asset) =>
    asset.role === "primary-token" && asset.provenance.kind === "launch-produced",
  );
  const address = evmAssetAddress(primary, record.chainId);
  if (!primary || !address) throw new TypeError("advertised token has no EVM ERC-20 identity");
  const metadata = primary.onchainMetadata;
  const available = metadata?.status === "available";
  return {
    address,
    identityStatus: available ? "complete" : "partial",
    name: available ? metadata.name : null,
    symbol: available ? metadata.symbol : null,
    decimals: available ? metadata.decimals : null,
    totalSupplyRaw: null,
    supplyStatus: "unavailable",
    supplyAsOfBlock: null,
    metadata: {
      description: null,
      imageUrl: null,
      links: null,
      trustStatus: available ? "sanitized" : "unavailable",
    },
  };
}

function publicMarket(record, market, assets) {
  const base = assets.get(market.baseAssetId);
  const quote = assets.get(market.quoteAssetId);
  const marketAsset = assets.get(market.marketAssetId);
  const hook = market.uniswapV4?.hooksAssetId
    ? assets.get(market.uniswapV4.hooksAssetId)
    : null;
  const isV4 = market.kind === "uniswap-v4-pool";
  const verified = market.verification.status === "verified";
  return {
    marketId: market.marketId,
    kind: isV4 ? "uniswap-v4" : market.kind,
    status: isV4 ? market.status : "planned",
    sourceStatus: market.status,
    verificationStatus: verified ? "verified" : "verification-pending",
    verification: { ...market.verification },
    baseTokenAddress: evmAssetAddress(base, record.chainId),
    quoteTokenAddress: evmAssetAddress(quote, record.chainId),
    protocol: isV4 ? "uniswap-v4" : null,
    poolId: isV4 ? market.uniswapV4.poolId : null,
    poolAddress:
      marketAsset?.identity?.namespace === `eip155:${record.chainId}:contract` && ADDRESS.test(marketAsset.identity.value)
        ? marketAsset.identity.value
        : null,
    hookAddress: hook && ADDRESS.test(hook.identity.value) ? hook.identity.value : null,
    support: {
      discovery: "available", charting: "unknown", quote: "unavailable",
      simulation: "unavailable", execution: "unavailable",
    },
    adapter: null,
    metrics: {
      price: { status: "unavailable", value: null },
      liquidity: { status: "unavailable", value: null },
      volume24h: { status: "unavailable", value: null },
      updatedAt: null,
    },
    assetReferences: {
      marketAssetId: market.marketAssetId,
      baseAssetId: market.baseAssetId,
      quoteAssetId: market.quoteAssetId,
    },
    evidenceHash: market.marketEvidenceHash,
    uniswapV4: isV4 ? { ...market.uniswapV4, poolManager: { ...market.uniswapV4.poolManager } } : null,
  };
}

export function normalizeRegistryCustomItem(item) {
  if (item?.schemaVersion === REGISTRY_V4_ENVELOPE_SCHEMA) {
    return normalizeRegistryCustomItemV4(item);
  }
  if ("projectionDigest" in (item ?? {})) {
    return normalizeRegistryCustomItemV3(item);
  }
  if (!item || !validateRegistryCustomRecord(item.record) ||
    canonicalSha256(RECORD_SCHEMA, item.record) !== item.recordHash) {
    throw new TypeError("Registry custom launch item is invalid");
  }
  const record = item.record;
  const assets = new Map(record.discoverableAssets.map((asset) => [asset.assetId, asset]));
  const token = publicToken(record, assets);
  const markets = record.discoverableMarkets.map((market) => publicMarket(record, market, assets));
  const transactionIndex = safeInteger(record.transactionIndex);
  const logIndex = record.logIndex === null ? null : safeInteger(record.logIndex);
  const blockNumber = safeInteger(record.blockNumber);
  const sortIdentity = record.launchId.slice("sha256:".length);
  return {
    schemaVersion: LAUNCH_SCHEMA_VERSION,
    platformId: PLATFORM_ID,
    launchId: record.launchId,
    category: "custom",
    chainId: CHAIN_ID,
    token,
    assets: record.discoverableAssets.map(publicAsset),
    launch: {
      status: "live",
      origin: record.origin,
      modelId: record.modelId,
      modelVersion: null,
      publicSubmission: true,
      creatorAddress: null,
      transactionHash: record.launchTransactionId,
      blockNumber: record.blockNumber,
      blockHash: record.blockHash,
      transactionIndex,
      logIndex,
      timestamp: record.launchedAt,
      finality: "finalized",
    },
    verification: {
      sourceId: FEED_SOURCE_ID,
      launcherAddress: null,
      registryAddress: null,
      provenanceStatus: "verified",
      sourceUrl: null,
    },
    capabilities: [...new Set(record.discoverableMarkets.map((market) =>
      market.kind === "uniswap-v4-pool" ? "uniswap-v4" : market.kind,
    ))].map((id) => ({
      id,
      version: null,
      status: id === "uniswap-v4" ? "active" : "conditional",
      parameters: {},
    })),
    markets,
    fees: [{
      kind: "programmable-platform",
      ratePpm: record.feeObligation.ratePpm,
      rateBps: record.feeObligation.ratePpm / 100,
      recipient: record.feeObligation.recipient.value,
      chargeMode: "added-on-top",
      basis: record.feeObligation.qualifyingFlowBasis,
      assetAddress: markets[0]?.quoteTokenAddress ?? null,
      verificationStatus: "verified",
    }],
    extensions: {
      "programmable/registry-v2": {
        projectId: record.projectId,
        registryGeneration: item.generation,
        registryProjectionGeneration: record.registryProjectionGeneration,
        websiteProjectionGeneration: record.websiteProjectionGeneration,
        recordHash: item.recordHash,
        launchIdentity: { ...record.launchIdentity },
        launchRouteId: record.launchRouteId,
        launchRouteBindingHash: record.launchRouteBindingHash,
        executionMode: record.executionMode,
        assetIdentitySetHash: record.assetIdentitySetHash,
        marketSetHash: record.marketSetHash,
        finalityEvidenceHash: record.finalityEvidenceHash,
        finalizedAt: record.finalizedAt,
        sourceKind: record.sourceKind,
        sourceRecordBindingHash: record.sourceRecordBindingHash,
        finalizedLaunchBindingHash: record.finalizedLaunchBindingHash,
        presentationVersion: record.presentationVersion,
        presentationBindingHash: record.presentationBindingHash,
        presentation: record.presentation === null
          ? null
          : structuredClone(record.presentation),
      },
    },
    sortKey: `${String(blockNumber).padStart(16, "0")}:${String(transactionIndex).padStart(10, "0")}:${String(logIndex ?? 0).padStart(10, "0")}:${sortIdentity}`,
  };
}
