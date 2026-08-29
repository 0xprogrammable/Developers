import {
  developerManifestV2,
  feedStatusV2,
  getV2DatasetForChain,
  serviceStatusV2,
} from "../../server/v2-dataset.js";
import {
  error,
  handleOptions,
  json,
  parseEvmChainId,
  queryParametersAllowed,
  queryValue,
} from "../../server/http.js";

export default async function handler(req, res) {
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
  const chainId = parseEvmChainId(queryValue(req, "chainId"));
  if (chainId === undefined) {
    error(req, res, 400, "INVALID_CHAIN_ID", "chainId must be a positive EVM chain id");
    return;
  }

  try {
    const [dataset, manifest] = await Promise.all([
      getV2DatasetForChain(chainId ?? 1),
      developerManifestV2(chainId ?? 1),
    ]);
    json(
      req,
      res,
      200,
      serviceStatusV2(dataset.status, manifest),
      {
      cacheControl: "public, max-age=0, s-maxage=10, stale-while-revalidate=30",
      apiStatus: feedStatusV2(dataset),
      },
    );
  } catch (statusError) {
    if (statusError?.code === "CHAIN_NOT_SUPPORTED") {
      error(req, res, 404, "CHAIN_NOT_SUPPORTED", "No Programmable status is published for this chain");
      return;
    }
    error(
      req,
      res,
      503,
      "STATUS_UNAVAILABLE",
      "The developer API status could not be produced",
    );
  }
}
