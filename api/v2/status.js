import { feedStatus } from "../../server/dataset.js";
import {
  developerManifestV2,
  getV2Dataset,
  serviceStatusV2,
} from "../../server/v2-dataset.js";
import {
  error,
  handleOptions,
  json,
  queryParametersAllowed,
} from "../../server/http.js";

export default async function handler(req, res) {
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
    const [dataset, manifest] = await Promise.all([
      getV2Dataset(),
      developerManifestV2(),
    ]);
    json(
      req,
      res,
      200,
      serviceStatusV2(dataset.status, manifest),
      {
      cacheControl: "public, max-age=0, s-maxage=10, stale-while-revalidate=30",
      apiStatus: feedStatus(dataset.status.status),
      },
    );
  } catch {
    error(
      req,
      res,
      503,
      "STATUS_UNAVAILABLE",
      "The developer API status could not be produced",
    );
  }
}
