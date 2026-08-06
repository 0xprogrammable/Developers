import { developerManifestV2 } from "../../server/v2-dataset.js";
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
    json(req, res, 200, await developerManifestV2(), {
      cacheControl: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      apiStatus: "ready",
    });
  } catch {
    error(
      req,
      res,
      503,
      "MANIFEST_UNAVAILABLE",
      "The integration manifest could not be produced",
    );
  }
}
