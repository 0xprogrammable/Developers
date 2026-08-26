import { API_V2_SCHEMA_VERSION } from "../../server/constants.js";
import {
  feedStatusV2,
  getV2Dataset,
  publicLaunchV2,
} from "../../server/v2-dataset.js";
import {
  cursorScopeV2,
  decodePageCursor,
  decodeResumeCursor,
  encodePageCursor,
  encodeResumeCursor,
  error,
  handleOptions,
  json,
  paginate,
  parseEvmChainId,
  parseCategory,
  parseLimit,
  queryParametersAllowed,
  queryValue,
} from "../../server/http.js";

const EMPTY_HIGH_WATER =
  "0000000000000000:0000000000:0000000000:0x0000000000000000000000000000000000000000";
const ROUTER_IDENTITY_COMMITMENT_PATTERN = /^sha256:[0-9a-f]{64}$/;
const FINALITY_RANK = new Map([
  ["observed", 0],
  ["confirmed", 1],
  ["finalized", 2],
]);

function routerSourceBoundary(dataset, category) {
  if (category === "classic") return null;
  const router = dataset.status.routerCustom;
  if (router === null || router === undefined) return null;
  if (
    typeof router.asOfBlock !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(router.asOfBlock) ||
    !/^0x[0-9a-fA-F]{64}$/.test(router.asOfBlockHash ?? "") ||
    !ROUTER_IDENTITY_COMMITMENT_PATTERN.test(
      router.sourceIdentityCommitment ?? "",
    )
  ) {
    throw new Error("v2 Router source boundary is invalid");
  }
  return {
    blockNumber: router.asOfBlock,
    blockHash: router.asOfBlockHash,
    finality: "finalized",
    identityCommitment: router.sourceIdentityCommitment,
  };
}

function currentSnapshot(
  dataset,
  category,
  registryHighWaterGeneration,
  routerSource,
) {
  const checkpoint = dataset.status.coverage.checkpoint;
  const candidates = [];
  const classicSource = checkpoint
    ? {
        blockNumber: String(checkpoint.blockNumber),
        blockHash: checkpoint.blockHash,
        finality: checkpoint.finality,
      }
    : null;
  if (checkpoint) {
    candidates.push(classicSource);
  }
  if (routerSource) {
    candidates.push({
      blockNumber: routerSource.blockNumber,
      blockHash: routerSource.blockHash,
      finality: routerSource.finality,
    });
  }
  if (candidates.length === 0) return null;
  if (candidates.some((candidate) => !FINALITY_RANK.has(candidate.finality))) {
    throw new Error("v2 source finality is invalid");
  }
  candidates.sort((left, right) => {
    const leftBlock = BigInt(left.blockNumber);
    const rightBlock = BigInt(right.blockNumber);
    return leftBlock < rightBlock ? -1 : leftBlock > rightBlock ? 1 : 0;
  });
  const selected = candidates.at(-1);
  const sameBoundary = candidates.filter((candidate) =>
    candidate.blockNumber === selected.blockNumber);
  if (sameBoundary.some((candidate) =>
    candidate.blockHash.toLowerCase() !== selected.blockHash.toLowerCase())) {
    throw new Error("v2 source boundaries conflict at the same block");
  }
  const conservativeFinality = candidates.reduce(
    (lowest, candidate) =>
      FINALITY_RANK.get(candidate.finality) < FINALITY_RANK.get(lowest)
        ? candidate.finality
        : lowest,
    "finalized",
  );
  return {
    blockNumber: selected.blockNumber,
    blockHash: selected.blockHash,
    indexedAt: dataset.status.generatedAt,
    finality: conservativeFinality,
    customRegistryHighWaterGeneration: registryHighWaterGeneration,
    sources: {
      classicIndexer: classicSource,
      customRegistry: category === "classic"
        ? null
        : { highWaterGeneration: registryHighWaterGeneration },
      routerCustom: routerSource,
    },
  };
}

function registryGeneration(record) {
  const value = record.lifecycle?.registryGeneration;
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)
    ? value
    : null;
}

function greatestGeneration(left, right) {
  if (left === null) return right;
  if (right === null) return left;
  return BigInt(left) > BigInt(right) ? left : right;
}

function currentRegistryHighWater(dataset, category = null) {
  if (category === "classic") return "0";
  const sourceValue = dataset.status.customRegistry?.highWaterGeneration;
  let highest = typeof sourceValue === "string" && /^(0|[1-9]\d*)$/.test(sourceValue)
    ? sourceValue
    : "0";
  for (const record of dataset.records) {
    const generation = registryGeneration(record);
    if (generation !== null && BigInt(generation) > BigInt(highest)) {
      highest = generation;
    }
  }
  return highest;
}

function withinRegistryHighWater(record, highWaterGeneration) {
  const generation = registryGeneration(record);
  return generation === null || BigInt(generation) <= BigInt(highWaterGeneration);
}

function isRouterCustomRecord(record) {
  return Boolean(record.extensions?.["programmable/router-stamp-v1"]);
}

function afterBoundary(
  record,
  sortHighWater,
  registryHighWaterGeneration,
  routerReplay,
) {
  const generation = registryGeneration(record);
  return record.sortKey > sortHighWater ||
    (generation !== null && BigInt(generation) > BigInt(registryHighWaterGeneration)) ||
    (routerReplay && isRouterCustomRecord(record));
}

function greatestSortKey(left, right) {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

/**
 * Builds a stable feed traversal from already-decoded cursors.
 *
 * A page cursor freezes both the page-one high-water mark and its snapshot.
 * A polling cursor is monotonic: a temporary source rollback cannot move a
 * consumer's durable checkpoint backwards.
 */
export function launchFeedPayload(
  dataset,
  { category = null, chainId = null, limit, cursor = null, after = null },
) {
  const scope = cursorScopeV2(category, chainId);
  const baseRecords = dataset.records.filter(
    (record) =>
      (category === null || record.category === category) &&
      (chainId === null || record.chainId === chainId),
  );
  const newestSortKey = baseRecords[0]?.sortKey ?? EMPTY_HIGH_WATER;
  const currentGeneration = currentRegistryHighWater(dataset, category);
  const currentRouterSource = routerSourceBoundary(dataset, category);
  const currentRouterCommitment = category === "classic"
    ? undefined
    : currentRouterSource?.identityCommitment ?? null;
  if (cursor && currentRouterCommitment !== undefined) {
    const frozenRouterSource = cursor.snapshot?.sources?.routerCustom;
    if (
      !cursor.snapshot?.sources ||
      (frozenRouterSource?.identityCommitment ?? null) !==
        currentRouterCommitment
    ) {
      throw new Error("v2 Router source changed during page traversal");
    }
  }
  const highWater = cursor
    ? cursor.highWater
    : greatestSortKey(newestSortKey, after?.highWater);
  const traversalSnapshot = cursor?.snapshot ?? currentSnapshot(
    dataset,
    category,
    currentGeneration,
    currentRouterSource,
  );
  const lowerBound = cursor?.after ?? after?.highWater ?? null;
  const lowerRegistryBound = cursor?.afterRegistryHighWaterGeneration ??
    after?.registryHighWaterGeneration ??
    "0";
  const registryHighWaterGeneration = cursor?.registryHighWaterGeneration ??
    greatestGeneration(currentGeneration, after?.registryHighWaterGeneration ?? null);
  const routerReplay = cursor?.routerReplay ?? Boolean(
    lowerBound !== null &&
      currentRouterCommitment !== undefined &&
      after?.routerIdentityCommitment !== currentRouterCommitment,
  );
  const traversalRecords = baseRecords.filter(
    (record) =>
      record.sortKey <= highWater &&
      withinRegistryHighWater(record, registryHighWaterGeneration) &&
      (lowerBound === null ||
        afterBoundary(
          record,
          lowerBound,
          lowerRegistryBound,
          routerReplay,
        )),
  );
  const page = paginate(traversalRecords, {
    limit,
    cursor: cursor?.position ?? null,
  });

  const resumeCursor = currentRouterCommitment === undefined
    ? encodeResumeCursor(
        highWater,
        scope,
        registryHighWaterGeneration,
      )
    : encodeResumeCursor(
        highWater,
        scope,
        registryHighWaterGeneration,
        currentRouterCommitment,
      );
  return {
    schemaVersion: API_V2_SCHEMA_VERSION,
    status: feedStatusV2(dataset, category),
    snapshot: traversalSnapshot
      ? {
          ...traversalSnapshot,
          cursor: resumeCursor,
        }
      : null,
    items: page.selected.map(publicLaunchV2),
    page: {
      nextCursor:
        page.pagination.nextPosition === null
          ? null
          : encodePageCursor(
              highWater,
              page.pagination.nextPosition,
              scope,
              traversalSnapshot,
              lowerBound,
              registryHighWaterGeneration,
              lowerRegistryBound,
              currentRouterCommitment === undefined ? undefined : routerReplay,
            ),
      resumeCursor,
      hasMore: page.pagination.hasMore,
    },
  };
}

export function createLaunchesHandler(loadDataset = getV2Dataset) {
  return async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    error(req, res, 405, "METHOD_NOT_ALLOWED", "Only GET is supported");
    return;
  }
  if (
    !queryParametersAllowed(req, ["after", "category", "chainId", "cursor", "limit"])
  ) {
    error(req, res, 400, "INVALID_QUERY", "Query parameters are invalid or repeated");
    return;
  }

  const category = parseCategory(queryValue(req, "category"));
  if (category === undefined) {
    error(req, res, 400, "INVALID_CATEGORY", "category must be classic or custom");
    return;
  }
  const limit = parseLimit(queryValue(req, "limit"));
  if (limit === null) {
    error(req, res, 400, "INVALID_LIMIT", "limit must be from 1 to 100");
    return;
  }
  const chainId = parseEvmChainId(queryValue(req, "chainId"));
  if (chainId === undefined) {
    error(req, res, 400, "INVALID_CHAIN_ID", "chainId must be a positive EVM chain id");
    return;
  }
  const scope = cursorScopeV2(category, chainId);
  const cursor = decodePageCursor(queryValue(req, "cursor"));
  const after = decodeResumeCursor(queryValue(req, "after"));
  if (cursor === undefined || after === undefined) {
    error(req, res, 400, "INVALID_CURSOR", "cursor and after must be opaque API cursors");
    return;
  }
  if (cursor && after) {
    error(req, res, 400, "CURSOR_CONFLICT", "Use cursor for pagination or after for polling, not both");
    return;
  }
  if ((cursor && cursor.scope !== scope) || (after && after.scope !== scope)) {
    error(
      req,
      res,
      400,
      "CURSOR_SCOPE_MISMATCH",
      "Use a cursor with the same category filter that created it",
    );
    return;
  }

  try {
    const dataset = await loadDataset();
    if (
      chainId !== null &&
      !dataset.status.supportedChainIds?.includes(chainId)
    ) {
      error(req, res, 400, "CHAIN_NOT_SUPPORTED", "chainId is not active in the manifest");
      return;
    }
    const payload = launchFeedPayload(dataset, {
      category,
      chainId,
      limit,
      cursor,
      after,
    });

    json(
      req,
      res,
      200,
      payload,
      { apiStatus: feedStatusV2(dataset, category) },
    );
  } catch {
    error(
      req,
      res,
      503,
      "LAUNCH_FEED_UNAVAILABLE",
      "The launch feed could not be produced",
    );
  }
  };
}

export default createLaunchesHandler();
