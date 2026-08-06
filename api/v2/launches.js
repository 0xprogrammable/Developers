import { API_V2_SCHEMA_VERSION, CHAIN_ID } from "../../server/constants.js";
import {
  feedStatus,
  isDatasetPublishable,
} from "../../server/dataset.js";
import { getV2Dataset } from "../../server/v2-dataset.js";
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
  recordsAfter,
} from "../../server/http.js";
import { publicLaunch } from "../../server/normalize.js";

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
  const baseRecords = category
    ? dataset.records.filter((record) => record.category === category)
    : dataset.records;
  const newestSortKey = baseRecords[0]?.sortKey ?? EMPTY_HIGH_WATER;
  const highWater = cursor
    ? cursor.highWater
    : greatestSortKey(newestSortKey, after?.highWater);
  const traversalSnapshot = cursor?.snapshot ?? currentSnapshot(dataset);
  const lowerBound = cursor?.after ?? after?.highWater ?? null;
  const traversalRecords = recordsAfter(
    baseRecords.filter((record) => record.sortKey <= highWater),
    lowerBound,
  );
  const page = paginate(traversalRecords, {
    limit,
    cursor: cursor?.position ?? null,
  });

  const resumeCursor = encodeResumeCursor(highWater, scope);
  return {
    schemaVersion: API_V2_SCHEMA_VERSION,
    status: feedStatus(dataset.status.status),
    snapshot: traversalSnapshot
      ? {
          ...traversalSnapshot,
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
    if (!isDatasetPublishable(dataset)) {
      error(
        req,
        res,
        503,
        "INDEX_COVERAGE_INCOMPLETE",
        "The launch feed is waiting for complete chain coverage",
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
      { apiStatus: feedStatus(dataset.status.status) },
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
