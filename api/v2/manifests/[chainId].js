import { developerManifestV2 } from "../../../server/v2-dataset.js";
import {
  error,
  handleOptions,
  json,
  parseEvmChainId,
  queryParametersAllowed,
  routeValue,
} from "../../../server/http.js";

export function createChainManifestHandler(loadManifest = developerManifestV2) {
  return async function handler(req, res) {
    if (handleOptions(req, res)) return;
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      error(req, res, 405, "METHOD_NOT_ALLOWED", "Only GET is supported");
      return;
    }
    if (!queryParametersAllowed(req, ["chainId"])) {
      error(req, res, 400, "INVALID_QUERY", "Query parameters are invalid or repeated");
      return;
    }
    const chainId = parseEvmChainId(routeValue(req, "chainId"));
    if (chainId === undefined || chainId === null) {
      error(req, res, 400, "INVALID_CHAIN_ID", "chainId must be a positive EVM chain id");
      return;
    }
    try {
      const manifest = await loadManifest(chainId);
      json(req, res, 200, manifest, {
        cacheControl:
          "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
        apiStatus: manifest.customLaunchV4?.status === "live"
          ? "ready"
          : manifest.chainId === 1
            ? "ready"
            : "unavailable",
      });
    } catch (loadError) {
      if (loadError?.code === "CHAIN_NOT_SUPPORTED") {
        error(
          req,
          res,
          404,
          "CHAIN_NOT_SUPPORTED",
          "No Programmable manifest is published for this chain",
        );
        return;
      }
      error(
        req,
        res,
        503,
        "MANIFEST_UNAVAILABLE",
        "The chain integration manifest could not be produced",
      );
    }
  };
}

export default createChainManifestHandler();
