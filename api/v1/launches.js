import { API_SCHEMA_VERSION, CHAIN_ID } from "../../server/constants.js";
import {
  feedStatusForCategory,
  isDatasetPublishable,
} from "../../server/dataset.js";
import { getV1Dataset } from "../../server/v1-frozen.js";
import {
  cursorScope,
  decodePageCursor,
  decodeResumeCursor,
  encodePageCursor,
  encodeResumeCursor,
  error,
  handleOptions,
  json,
  paginate,
  parseChainId,
  parseCategory,
  parseLimit,
  queryParametersAllowed,
  queryValue,
} from "../../server/http.js";
import { isV1PublicLaunch, publicLaunch } from "../../server/normalize.js";

const EMPTY_HIGH_WATER =
  "0000000000000000:0000000000:0000000000:0x0000000000000000000000000000000000000000";

function currentSnapshot(dataset) {
  const checkpoint = dataset.status.coverage.checkpoint;
  if (!checkpoint) return null;
  return {
    blockNumber: String(checkpoint.blockNumber),
    blockHash: checkpoint.blockHash,
    indexedAt: dataset.status.generatedAt,
    finality: checkpoint.finality,
  };
}

function publicSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    blockNumber: snapshot.blockNumber,
    blockHash: snapshot.blockHash,
    indexedAt: snapshot.indexedAt,
    finality: snapshot.finality,
  };
}

function registryGeneration(record) {
  const value = record.extensions?.["programmable/registry-v2"]?.registryGeneration;
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)
    ? value
    : null;
}

function greatestGeneration(left, right) {
  if (left === null) return right;
  if (right === null) return left;
  return BigInt(left) > BigInt(right) ? left : right;
}

function currentRegistryHighWater(dataset, scope) {
  if (scope === "classic") return null;
  const statusValue = dataset.status.customRegistry?.highWaterGeneration;
  return typeof statusValue === "string" && /^(0|[1-9]\d*)$/.test(statusValue)
    ? statusValue
    : "0";
}

function withinRegistryHighWater(record, highWaterGeneration) {
  const generation = registryGeneration(record);
  return generation === null || (
    highWaterGeneration !== null && BigInt(generation) <= BigInt(highWaterGeneration)
  );
}

function afterBoundary(record, sortHighWater, registryHighWaterGeneration) {
  const generation = registryGeneration(record);
  return record.sortKey > sortHighWater || (
    generation !== null &&
    registryHighWaterGeneration !== null &&
    BigInt(generation) > BigInt(registryHighWaterGeneration)
  );
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
  { category = null, limit, cursor = null, after = null },
) {
  const scope = cursorScope(category);
  const v1Records = dataset.records.filter(isV1PublicLaunch);
  const baseRecords = category
    ? v1Records.filter((record) => record.category === category)
    : v1Records;
  const newestSortKey = baseRecords[0]?.sortKey ?? EMPTY_HIGH_WATER;
  const currentRegistryGeneration = currentRegistryHighWater(dataset, scope);
  const highWater = cursor
    ? cursor.highWater
    : greatestSortKey(newestSortKey, after?.highWater);
  const traversalSnapshot = cursor?.snapshot ?? currentSnapshot(dataset);
  const lowerBound = cursor?.after ?? after?.highWater ?? null;
  const lowerRegistryBound = cursor?.afterRegistryHighWaterGeneration
    ?? after?.registryHighWaterGeneration
    ?? (scope === "classic" ? null : "0");
  const registryHighWaterGeneration = cursor?.registryHighWaterGeneration
    ?? greatestGeneration(
      currentRegistryGeneration,
      after?.registryHighWaterGeneration ?? null,
    );
  const traversalRecords = baseRecords.filter((record) =>
    record.sortKey <= highWater &&
    withinRegistryHighWater(record, registryHighWaterGeneration) &&
    (lowerBound === null || afterBoundary(record, lowerBound, lowerRegistryBound))
  );
  const page = paginate(traversalRecords, {
    limit,
    cursor: cursor?.position ?? null,
  });

  const resumeCursor = encodeResumeCursor(
    highWater,
    scope,
    registryHighWaterGeneration,
  );
  return {
    schemaVersion: API_SCHEMA_VERSION,
    status: feedStatusForCategory(dataset, category),
    snapshot: traversalSnapshot
      ? {
          ...publicSnapshot(traversalSnapshot),
          cursor: resumeCursor,
        }
      : null,
    items: page.selected.map(publicLaunch),
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
            ),
      resumeCursor,
      hasMore: page.pagination.hasMore,
    },
  };
}

export function createLaunchesHandler(loadDataset = getV1Dataset) {
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
  if (parseChainId(queryValue(req, "chainId"), CHAIN_ID) === null) {
    error(req, res, 400, "CHAIN_NOT_SUPPORTED", "Only Ethereum Mainnet is supported");
    return;
  }
  const scope = cursorScope(category);
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
    if (!isDatasetPublishable(dataset, category)) {
      error(
        req,
        res,
        503,
        "INDEX_COVERAGE_INCOMPLETE",
        category === "classic"
          ? "The Classic launch feed is waiting for complete chain coverage"
          : "The v1 launch feed is waiting for complete Classic chain coverage",
      );
      return;
    }
    const payload = launchFeedPayload(dataset, {
      category,
      limit,
      cursor,
      after,
    });

    json(
      req,
      res,
      200,
      payload,
      { apiStatus: feedStatusForCategory(dataset, category) },
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
