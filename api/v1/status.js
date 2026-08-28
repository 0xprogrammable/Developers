import { feedStatus } from "../../server/dataset.js";
import { getV1Dataset, v1ServiceStatus } from "../../server/v1-frozen.js";
import {
  error,
  handleOptions,
  json,
  queryParametersAllowed,
} from "../../server/http.js";

export function createStatusHandler(loadDataset = getV1Dataset) {
  return async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    error(req, res, 405, "METHOD_NOT_ALLOWED", "Only GET is supported");
    return;
  }
  if (!queryParametersAllowed(req, [])) {
    error(req, res, 400, "INVALID_QUERY", "This endpoint does not accept query parameters");
    return;
  }

  try {
    const dataset = await loadDataset();
    json(req, res, 200, v1ServiceStatus(dataset.status), {
      cacheControl: "public, max-age=0, s-maxage=10, stale-while-revalidate=30",
      apiStatus: feedStatus(dataset.status.status),
    });
  } catch {
    error(
      req,
      res,
      503,
      "STATUS_UNAVAILABLE",
      "The developer API status could not be produced",
    );
  }
  };
}

export default createStatusHandler();
