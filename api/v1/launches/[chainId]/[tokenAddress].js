import { CHAIN_ID } from "../../../../server/constants.js";
import {
  feedStatus,
  getDataset,
  isDatasetPublishable,
} from "../../../../server/dataset.js";
import {
  error,
  handleOptions,
  json,
  parseAddress,
  queryParametersAllowed,
  routeValue,
} from "../../../../server/http.js";
import { publicLaunch } from "../../../../server/normalize.js";

export function createLaunchDetailHandler(loadDataset = getDataset) {
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

  const chainId = routeValue(req, "chainId");
  const address = parseAddress(routeValue(req, "tokenAddress"));
  if (String(chainId) !== String(CHAIN_ID)) {
    error(req, res, 404, "CHAIN_NOT_SUPPORTED", "Only Ethereum Mainnet is supported");
    return;
  }
  if (!address) {
    error(req, res, 400, "INVALID_TOKEN_ADDRESS", "tokenAddress must be an EVM address");
    return;
  }

  try {
    const dataset = await loadDataset();
    const launch = dataset.records.find(
      (record) => record.token.address.toLowerCase() === address,
    );
    if (!launch && !isDatasetPublishable(dataset)) {
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
      publicLaunch(launch),
      { apiStatus: feedStatus(dataset.status.status) },
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
