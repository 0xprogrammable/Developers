import {
  feedStatusV2,
  getV2Dataset,
  isV2DatasetPublishable,
  publicLaunchV2,
} from "../../../server/v2-dataset.js";
import {
  error,
  handleOptions,
  json,
  queryParametersAllowed,
  routeValue,
} from "../../../server/http.js";

const LAUNCH_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,255}$/;

export function createLaunchIdDetailHandler(loadDataset = getV2Dataset) {
  return async function handler(req, res) {
    if (handleOptions(req, res)) return;
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      error(req, res, 405, "METHOD_NOT_ALLOWED", "Only GET is supported");
      return;
    }
    if (!queryParametersAllowed(req, ["launchId"])) {
      error(
        req,
        res,
        400,
        "INVALID_QUERY",
        "Query parameters are invalid or repeated",
      );
      return;
    }

    const launchId = routeValue(req, "launchId");
    if (typeof launchId !== "string" || !LAUNCH_ID.test(launchId)) {
      error(req, res, 400, "INVALID_LAUNCH_ID", "launchId is invalid");
      return;
    }

    try {
      const dataset = await loadDataset();
      const launch = dataset.records.find((record) => record.launchId === launchId);
      if (!launch && !isV2DatasetPublishable(dataset, "custom")) {
        error(
          req,
          res,
          503,
          "INDEX_COVERAGE_INCOMPLETE",
          "Launch lookup is waiting for complete Custom Registry coverage",
        );
        return;
      }
      if (!launch) {
        error(
          req,
          res,
          404,
          "LAUNCH_NOT_FOUND",
          "No Programmable launch was found for this launchId",
        );
        return;
      }
      json(req, res, 200, publicLaunchV2(launch), {
        apiStatus: feedStatusV2(dataset, launch.category),
      });
    } catch {
      error(
        req,
        res,
        503,
        "LAUNCH_UNAVAILABLE",
        "The launch record could not be produced",
      );
    }
  };
}

export default createLaunchIdDetailHandler();
