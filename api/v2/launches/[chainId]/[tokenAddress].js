import {
  feedStatusV2,
  getV2Dataset,
  isV2DatasetPublishable,
  publicLaunchV2,
} from "../../../../server/v2-dataset.js";
import {
  error,
  handleOptions,
  json,
  parseAddress,
  parseEvmChainId,
  queryParametersAllowed,
  routeValue,
} from "../../../../server/http.js";

export function createLaunchDetailHandler(loadDataset = getV2Dataset) {
  return async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    error(req, res, 405, "METHOD_NOT_ALLOWED", "Only GET is supported");
    return;
  }
  if (!queryParametersAllowed(req, ["chainId", "tokenAddress"])) {
    error(req, res, 400, "INVALID_QUERY", "Query parameters are invalid or repeated");
    return;
  }

  const chainId = parseEvmChainId(routeValue(req, "chainId"));
  const address = parseAddress(routeValue(req, "tokenAddress"));
  if (chainId === undefined || chainId === null) {
    error(req, res, 400, "INVALID_CHAIN_ID", "chainId must be a positive EVM chain id");
    return;
  }
  if (!address) {
    error(req, res, 400, "INVALID_TOKEN_ADDRESS", "tokenAddress must be an EVM address");
    return;
  }

  try {
    const dataset = await loadDataset();
    if (!dataset.status.supportedChainIds?.includes(chainId)) {
      error(req, res, 404, "CHAIN_NOT_SUPPORTED", "chainId is not active in the manifest");
      return;
    }
    const launch = dataset.records.find(
      (record) =>
        record.chainId === chainId &&
        record.token?.address?.toLowerCase() === address,
    );
    if (!launch && !isV2DatasetPublishable(dataset, "custom")) {
      error(
        req,
        res,
        503,
        "INDEX_COVERAGE_INCOMPLETE",
        "Launch lookup is waiting for complete chain coverage",
      );
      return;
    }
    if (!launch) {
      error(req, res, 404, "LAUNCH_NOT_FOUND", "No Programmable launch was found for this token");
      return;
    }
    json(
      req,
      res,
      200,
      publicLaunchV2(launch),
      { apiStatus: feedStatusV2(dataset) },
    );
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

export default createLaunchDetailHandler();
