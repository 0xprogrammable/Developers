import { readFile } from "node:fs/promises";

import {
  API_SCHEMA_VERSION,
  CHAIN_ID,
  FINALITY_CONFIRMATIONS,
  LAUNCH_DISCOVERY_FILTER,
  LEGACY_SOURCE_URL,
  RELEASE_BY_LAUNCHER,
  RELEASES,
  REQUEST_LIMITS,
} from "./constants.js";
import { readLegacyFeed } from "./legacy.js";
import {
  EXPECTED_REGISTRY_CUSTOM_FEED_SOURCE_ID,
  normalizeRegistryCustomItem,
  readRegistryCustomFeed,
  registryCustomFeedConfiguration,
} from "./registry.js";
import {
  compareLaunchesDescending,
  decodeLaunchLog,
  normalizeGapLaunch,
  normalizeLegacyToken,
  publicLaunch,
  readErc20Metadata,
} from "./normalize.js";
import {
  readBlock,
  readFinalizedBlock,
  readHeadBlock,
  readLogs,
  toQuantity,
} from "./rpc.js";

let cache = null;
let cachePromise = null;
let manifestPromise = null;

function shortError(error) {
  if (error?.name === "AbortError") return "request timed out";
  if (!(error instanceof Error)) return "unknown failure";
  return error.message
    .replace(/https?:\/\/\S+/g, "RPC provider")
    .replace(
      /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, worker),
  );
  return output;
}

function freshness(snapshotBlock, headBlock, snapshotMatchesChain) {
  if (snapshotBlock === null || headBlock === null) return "unavailable";
  if (snapshotMatchesChain === false || snapshotBlock > headBlock) return "inconsistent";
  const lag = headBlock - snapshotBlock;
  if (lag <= 120) return "fresh";
  if (lag <= 720) return "delayed";
  return "stale";
}

async function readGroupLogs(group, fromBlock, toBlock, preferredProvider) {
  const filter = {
    address: group.addresses.length === 1 ? group.addresses[0] : group.addresses,
    fromBlock: toQuantity(fromBlock),
    toBlock: toQuantity(toBlock),
    topics: [group.topics ?? group.topic],
  };
  try {
    return await readLogs(filter, preferredProvider);
  } catch (groupError) {
    if (group.addresses.length === 1) throw groupError;
    const collected = [];
    let provider = preferredProvider;
    for (const address of group.addresses) {
      const result = await readLogs({ ...filter, address }, provider);
      provider = result.provider;
      collected.push(...result.logs);
    }
    return { logs: collected, provider };
  }
}

async function scanGroup(group, fromBlock, toBlock, preferredProvider) {
  const logs = [];
  const errors = [];
  let scannedThrough = fromBlock - 1;
  let provider = preferredProvider;

  for (
    let chunkFrom = fromBlock;
    chunkFrom <= toBlock;
    chunkFrom += REQUEST_LIMITS.rpcLogRange
  ) {
    const chunkTo = Math.min(
      toBlock,
      chunkFrom + REQUEST_LIMITS.rpcLogRange - 1,
    );
    try {
      const result = await readGroupLogs(group, chunkFrom, chunkTo, provider);
      logs.push(...result.logs);
      provider = result.provider;
      scannedThrough = chunkTo;
    } catch (error) {
      errors.push({
        fromBlock: chunkFrom,
        toBlock: chunkTo,
        reason: shortError(error),
      });
      break;
    }
  }
  return { logs, errors, scannedThrough, provider };
}

async function scanGap(fromBlock, toBlock, preferredProvider) {
  if (fromBlock > toBlock) {
    return {
      logs: [],
      errors: [],
      scannedThrough: toBlock,
      provider: preferredProvider,
    };
  }
  return scanGroup(
    LAUNCH_DISCOVERY_FILTER,
    fromBlock,
    toBlock,
    preferredProvider,
  );
}

async function enrichGapLogs(logs, preferredProvider) {
  const errors = [];
  const decodeErrors = [];
  const decoded = [];
  for (const log of logs) {
    try {
      const launch = decodeLaunchLog(log);
      if (launch) {
        decoded.push(launch);
      } else {
        const release = RELEASE_BY_LAUNCHER.get(
          String(log?.address).toLowerCase(),
        );
        if (
          release &&
          String(log?.topics?.[0]).toLowerCase() === release.launchTopic
        ) {
          decodeErrors.push({
            reason: `recognized ${release.deploymentId} launch log could not be decoded`,
          });
        }
      }
    } catch (error) {
      decodeErrors.push({
        reason: `launch log decode failed: ${shortError(error)}`,
      });
    }
  }

  decoded.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    if (a.transactionIndex !== b.transactionIndex) {
      return a.transactionIndex - b.transactionIndex;
    }
    return a.logIndex - b.logIndex;
  });
  const bounded = decoded.slice(0, REQUEST_LIMITS.maximumGapLaunches);
  const truncated = decoded.length > bounded.length;

  const blockNumbers = [...new Set(bounded.map((launch) => launch.blockNumber))];
  const blocks = new Map();
  await mapWithConcurrency(
    blockNumbers,
    REQUEST_LIMITS.metadataConcurrency,
    async (blockNumber) => {
      try {
        blocks.set(blockNumber, await readBlock(blockNumber, preferredProvider));
      } catch (error) {
        errors.push({
          blockNumber,
          reason: `block timestamp unavailable: ${shortError(error)}`,
        });
      }
    },
  );

  const records = await mapWithConcurrency(
    bounded,
    REQUEST_LIMITS.metadataConcurrency,
    async (launch) => {
      const block = blocks.get(launch.blockNumber) ?? {
        blockHash: launch.blockHash,
        timestamp: launch.blockTimestamp,
      };
      const metadata = await readErc20Metadata(
        launch.tokenAddress,
        preferredProvider,
        launch.blockNumber,
      );
      const record = normalizeGapLaunch(launch, metadata, block);
      const missing = [];
      if (record.token.identityStatus !== "complete") missing.push("identity");
      if (record.token.supplyStatus === "unavailable") missing.push("supply");
      if (record.launch.timestamp === null) missing.push("block timestamp");
      if (missing.length > 0) {
        errors.push({
          blockNumber: launch.blockNumber,
          reason: `${missing.join(", ")} enrichment is incomplete for ${launch.tokenAddress}`,
        });
      }
      return record;
    },
  );
  return { records, errors, decodeErrors, truncated };
}

function mergeRecords(legacyRecords, gapRecords, registryRecords = []) {
  const records = new Map();
  for (const record of legacyRecords) {
    records.set(`${record.chainId}:${record.token.address.toLowerCase()}`, record);
  }
  for (const gapRecord of gapRecords) {
    const key = `${gapRecord.chainId}:${gapRecord.token.address.toLowerCase()}`;
    const existing = records.get(key);
    if (existing) {
      records.set(key, {
        ...gapRecord,
        token: {
          ...gapRecord.token,
          name: existing.token.name ?? gapRecord.token.name,
          symbol: existing.token.symbol ?? gapRecord.token.symbol,
          decimals: existing.token.decimals ?? gapRecord.token.decimals,
          metadata: existing.token.metadata,
        },
        markets: existing.markets.length > 0 ? existing.markets : gapRecord.markets,
      });
    } else {
      records.set(key, gapRecord);
    }
  }
  for (const registryRecord of registryRecords) {
    records.set(`registry:${registryRecord.launchId}`, registryRecord);
  }
  return [...records.values()].sort(compareLaunchesDescending);
}

async function buildDataset() {
  const generatedAt = new Date().toISOString();
  let registryConfiguration = null;
  let registryConfigurationError = null;
  try {
    registryConfiguration = registryCustomFeedConfiguration();
  } catch (error) {
    registryConfigurationError = error;
  }
  const [legacyResult, headResult, finalizedResult, registryResult] = await Promise.allSettled([
    readLegacyFeed(),
    readHeadBlock(),
    readFinalizedBlock(),
    registryConfigurationError === null
      ? readRegistryCustomFeed()
      : Promise.reject(registryConfigurationError),
  ]);
  const legacy = legacyResult.status === "fulfilled" ? legacyResult.value : null;
  const head = headResult.status === "fulfilled" ? headResult.value : null;
  const finalized =
    finalizedResult.status === "fulfilled" ? finalizedResult.value : null;
  const registry =
    registryResult.status === "fulfilled" ? registryResult.value : null;
  const errors = [];
  if (!legacy) errors.push({ source: "legacy", reason: shortError(legacyResult.reason) });
  if (!head) errors.push({ source: "chain-head", reason: shortError(headResult.reason) });
  if (!finalized) {
    errors.push({
      source: "chain-finality",
      reason: shortError(finalizedResult.reason),
    });
  }
  if (!registry) {
    errors.push({
      source: "custom-registry",
      reason: shortError(registryResult.reason),
    });
  }

  let snapshotMatchesChain = null;
  if (legacy?.snapshot && head) {
    try {
      const snapshotBlock = await readBlock(
        legacy.snapshot.blockNumber,
        head.provider,
      );
      snapshotMatchesChain =
        !legacy.snapshot.blockHash ||
        snapshotBlock.blockHash?.toLowerCase() ===
          legacy.snapshot.blockHash.toLowerCase();
      if (!snapshotMatchesChain) {
        errors.push({
          source: "legacy",
          reason: "source snapshot hash does not match Ethereum",
        });
      }
    } catch (error) {
      errors.push({
        source: "legacy-snapshot-verification",
        reason: shortError(error),
      });
    }
  }

  const headBlock = head?.blockNumber ?? null;
  const scanBlock =
    headBlock === null ? null : Math.max(0, headBlock - FINALITY_CONFIRMATIONS);
  const finalizedBlock = finalized?.blockNumber ?? null;
  const snapshotBlock = legacy?.snapshot?.blockNumber ?? null;
  const desiredGapFrom =
    snapshotBlock === null
      ? Math.min(...RELEASES.map((release) => release.startBlock))
      : snapshotBlock + 1;
  const boundedGapFrom =
    scanBlock === null
      ? null
      : Math.max(
          desiredGapFrom,
          scanBlock - REQUEST_LIMITS.maximumGapBlocks + 1,
        );
  const gapTruncated = boundedGapFrom !== null && boundedGapFrom > desiredGapFrom;

  let gapScan = {
    logs: [],
    errors: [],
    scannedThrough: snapshotBlock ?? 0,
    provider: head?.provider ?? null,
  };
  let enrichedGap = {
    records: [],
    errors: [],
    decodeErrors: [],
    truncated: false,
  };
  if (boundedGapFrom !== null && scanBlock !== null) {
    gapScan = await scanGap(boundedGapFrom, scanBlock, head.provider);
    enrichedGap = await enrichGapLogs(gapScan.logs, gapScan.provider);
  }
  errors.push(
    ...gapScan.errors.map((error) => ({ source: "gap-fill", ...error })),
    ...enrichedGap.decodeErrors.map((error) => ({
      source: "gap-decode",
      ...error,
    })),
    ...enrichedGap.errors.map((error) => ({ source: "gap-enrichment", ...error })),
  );

  const coverageBlockNumber = Math.max(
    snapshotMatchesChain === false ? 0 : snapshotBlock ?? 0,
    gapScan.scannedThrough ?? 0,
  );
  let coverageBlock = null;
  if (coverageBlockNumber > 0 && head) {
    try {
      coverageBlock = await readBlock(coverageBlockNumber, head.provider);
    } catch (error) {
      errors.push({
        source: "coverage-checkpoint",
        reason: shortError(error),
      });
    }
  }

  const legacyRecords = (legacy?.tokens ?? [])
    .map(normalizeLegacyToken)
    .filter(Boolean);
  let registryRecords = [];
  if (registry?.configured) {
    try {
      registryRecords = registry.records.map(normalizeRegistryCustomItem);
    } catch (error) {
      errors.push({ source: "custom-registry-normalization", reason: shortError(error) });
      registryRecords = [];
    }
  }
  const records = mergeRecords(legacyRecords, enrichedGap.records, registryRecords).map((record) => ({
    ...record,
    launch: {
      ...record.launch,
      finality:
        record.launch.publicSubmission === true &&
        record.verification.sourceId === "programmable-custom-launch-registry-v2"
          ? "finalized"
          : record.launch.blockNumber === null
          ? null
          : finalizedBlock !== null && record.launch.blockNumber <= finalizedBlock
            ? "finalized"
            : scanBlock !== null && record.launch.blockNumber <= scanBlock
              ? "confirmed"
              : "observed",
    },
  }));
  const sourceFreshness = freshness(
    snapshotBlock,
    headBlock,
    snapshotMatchesChain,
  );
  const eventCoverageComplete =
    legacy !== null &&
    snapshotBlock !== null &&
    snapshotMatchesChain === true &&
    scanBlock !== null &&
    gapScan.scannedThrough >= scanBlock &&
    gapScan.errors.length === 0 &&
    enrichedGap.decodeErrors.length === 0 &&
    !gapTruncated &&
    !enrichedGap.truncated;
  const enrichmentComplete = enrichedGap.errors.length === 0;
  const registryConfigured = registry?.configured === true ||
    registryConfiguration !== null;
  const registryReady = Boolean(
    registry?.configured &&
      registry.expectedSourceId === EXPECTED_REGISTRY_CUSTOM_FEED_SOURCE_ID &&
      registry.source?.sourceId === registry.expectedSourceId &&
      registry.source?.status === "ready" &&
      registry.source?.completeness === "complete" &&
      registry.source?.freshness === "current" &&
      registryRecords.length === registry.records.length,
  );

  let status = "degraded";
  if (
    head &&
    legacy &&
    eventCoverageComplete &&
    enrichmentComplete &&
    sourceFreshness === "fresh"
  ) {
    status = "ready";
  } else if (
    head &&
    legacy &&
    eventCoverageComplete &&
    enrichmentComplete &&
    (sourceFreshness === "delayed" || sourceFreshness === "stale")
  ) {
    status = "ready-gap-filled";
  } else if (head && legacy && eventCoverageComplete) {
    status = "degraded-enrichment";
  } else if (records.length > 0) {
    status = "partial";
  }

  const counts = {
    total: records.length,
    classic: records.filter((record) => record.category === "classic").length,
    custom: records.filter((record) => record.category === "custom").length,
  };
  const publicStatus = {
    schemaVersion: API_SCHEMA_VERSION,
    generatedAt,
    status,
    chainId: CHAIN_ID,
    source: {
      url: LEGACY_SOURCE_URL,
      statusReported: legacy?.reportedStatus ?? null,
      schemaVersion: legacy?.schemaVersion ?? null,
      snapshot: legacy?.snapshot ?? null,
      snapshotMatchesChain,
      freshness: sourceFreshness,
      lagBlocks:
        snapshotBlock === null || headBlock === null
          ? null
          : Math.max(0, headBlock - snapshotBlock),
    },
    chain: {
      headBlock,
      scanBlock,
      finalizedBlock,
      scanConfirmations: FINALITY_CONFIRMATIONS,
      finalizedBlockHash: finalized?.blockHash ?? null,
      provider: head?.provider ?? null,
    },
    coverage: {
      status: eventCoverageComplete
        ? "complete"
        : head
          ? "partial"
          : "unavailable",
      fromBlock: boundedGapFrom,
      toBlock:
        scanBlock === null
          ? null
          : Math.min(scanBlock, gapScan.scannedThrough),
      checkpoint:
        coverageBlock === null ||
        typeof coverageBlock.blockHash !== "string" ||
        !/^0x[0-9a-fA-F]{64}$/.test(coverageBlock.blockHash)
          ? null
          : {
              blockNumber: coverageBlock.blockNumber,
              blockHash: coverageBlock.blockHash,
              timestamp:
                Number.isSafeInteger(coverageBlock.timestamp) &&
                coverageBlock.timestamp >= 0
                  ? new Date(coverageBlock.timestamp * 1_000).toISOString()
                  : null,
              finality:
                finalizedBlock !== null &&
                coverageBlock.blockNumber <= finalizedBlock
                  ? "finalized"
                  : scanBlock !== null && coverageBlock.blockNumber <= scanBlock
                    ? "confirmed"
                    : "observed",
            },
      gapFill: {
        requestedFromBlock: desiredGapFrom,
        scannedFromBlock: boundedGapFrom,
        requestedToBlock: scanBlock,
        scannedThroughBlock: gapScan.scannedThrough,
        logsFound: gapScan.logs.length,
        launchesAdded: enrichedGap.records.length,
        truncated: gapTruncated || enrichedGap.truncated,
      },
      enrichment: {
        status: enrichmentComplete ? "complete" : "degraded",
        diagnostics: enrichedGap.errors.length,
      },
    },
    customRegistry: {
      configured: registryConfigured,
      expectedSourceId:
        registry?.expectedSourceId ?? registryConfiguration?.expectedSourceId ??
        EXPECTED_REGISTRY_CUSTOM_FEED_SOURCE_ID,
      status: registryReady
        ? "ready"
        : !registryConfigured && registryConfigurationError === null
          ? "unconfigured"
          : "unavailable",
      sourceId: registry?.source?.sourceId ?? null,
      completeness: registry?.source?.completeness ?? null,
      freshness: registry?.source?.freshness ?? null,
      checkedAt: registry?.source?.checkedAt ?? null,
      latestAcceptedAt: registry?.source?.latestAcceptedAt ?? null,
      highWaterGeneration: registry?.snapshot?.highWaterGeneration ?? null,
      indexedAt: registry?.snapshot?.indexedAt ?? null,
      launches: registryRecords.length,
    },
    counts,
    errors,
  };

  return { records, status: publicStatus };
}

export async function getDataset() {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (cachePromise) return cachePromise;

  cachePromise = buildDataset()
    .then((value) => {
      cache = { value, expiresAt: Date.now() + REQUEST_LIMITS.cacheMs };
      return value;
    })
    .finally(() => {
      cachePromise = null;
    });
  return cachePromise;
}

export function feedStatus(status) {
  if (status === "ready" || status === "ready-gap-filled") return "ready";
  if (status === "partial" || status === "degraded-enrichment") {
    return "degraded";
  }
  return "unavailable";
}

export function feedStatusForCategory(dataset, category = null) {
  if (!isDatasetPublishable(dataset, category)) return "unavailable";
  return feedStatus(dataset.status.status);
}

export function isDatasetPublishable(dataset, category = null) {
  const classicReady = Boolean(
    dataset && dataset.status?.coverage?.status === "complete" && dataset.status?.coverage?.checkpoint,
  );
  return classicReady;
}

export function serviceStatus(status) {
  const classicAvailable = Boolean(
    status.coverage?.status === "complete" && status.coverage?.checkpoint,
  );
  const classicFeed = classicAvailable ? feedStatus(status.status) : "unavailable";
  const customFeed = status.customRegistry?.status === "ready" ? "ready" : "unavailable";
  const feeds = classicFeed;
  return {
    schemaVersion: API_SCHEMA_VERSION,
    service:
      feeds === "ready" ? "operational" : "degraded",
    checkedAt: status.generatedAt,
    chainId: CHAIN_ID,
    classic: {
      status: classicAvailable ? "live" : "unavailable",
      note: "Classic V1, V2, and V3 launches are discoverable when event coverage is complete.",
    },
    custom: {
      status: customFeed === "ready" ? "live" : "unavailable",
      note: customFeed === "ready"
        ? "Authenticated finalized Registry launches and existing first-party Custom launches are discoverable in API v2."
        : "The frozen v1 feed remains available for Classic and legacy first-party records; Registry launches require API v2.",
    },
    feeds: {
      manifest: "ready",
      launches: feeds,
      tokenList: feeds,
    },
    source: status.source,
    chain: status.chain,
    coverage: status.coverage,
    customRegistry: status.customRegistry,
    counts: status.counts,
    errors: status.errors,
  };
}

export async function developerManifest() {
  manifestPromise ??= readFile(
    new URL("../deployments/ethereum.json", import.meta.url),
    "utf8",
  ).then((source) => JSON.parse(source));
  return structuredClone(await manifestPromise);
}

export function publicRecords(records) {
  return records.map(publicLaunch);
}
