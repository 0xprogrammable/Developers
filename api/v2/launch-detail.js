import {
  feedStatusV2,
  getV2Dataset,
  getV2DatasetForChain,
  isV2DatasetPublishable,
  publicLaunchV2,
} from "../../server/v2-dataset.js";
import {
  error,
  handleOptions,
  json,
  parseEvmChainId,
  queryParametersAllowed,
  routeValue,
} from "../../server/http.js";

const LAUNCH_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,255}$/;

export function createLaunchIdDetailHandler(
  loadDataset = getV2Dataset,
  { chainQualified = false, defaultChainId = 1 } = {},
) {
  return async function handler(req, res) {
    if (handleOptions(req, res)) return;
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      error(req, res, 405, "METHOD_NOT_ALLOWED", "Only GET is supported");
      return;
    }
    const allowedParameters = chainQualified
      ? ["chainId", "launchId"]
      : ["launchId"];
    if (!queryParametersAllowed(req, allowedParameters)) {
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
    const chainId = chainQualified
      ? parseEvmChainId(routeValue(req, "chainId"))
      : defaultChainId;
    if (chainId === undefined || chainId === null) {
      error(
        req,
        res,
        400,
        "INVALID_CHAIN_ID",
        "chainId must be a positive EVM chain id",
      );
      return;
    }
    if (typeof launchId !== "string" || !LAUNCH_ID.test(launchId)) {
      error(req, res, 400, "INVALID_LAUNCH_ID", "launchId is invalid");
      return;
    }

    try {
      const dataset = await loadDataset(chainId);
      if (!dataset.status.supportedChainIds?.includes(chainId)) {
        error(
          req,
          res,
          404,
          "CHAIN_NOT_SUPPORTED",
          "chainId is not active in the manifest",
        );
        return;
      }
      const launch = dataset.records.find(
        (record) => record.chainId === chainId && record.launchId === launchId,
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
        error(
          req,
          res,
          404,
          "LAUNCH_NOT_FOUND",
          "No Programmable launch was found for this chain and launchId",
        );
        return;
      }
      json(req, res, 200, publicLaunchV2(launch), {
        apiStatus: feedStatusV2(dataset, launch.category),
      });
    } catch (loadError) {
      if (loadError?.code === "CHAIN_NOT_SUPPORTED") {
        error(
          req,
          res,
          404,
          "CHAIN_NOT_SUPPORTED",
          "No Programmable launch lookup is published for this chain",
        );
        return;
      }
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

export function createChainLaunchIdDetailHandler(
  loadDataset = getV2DatasetForChain,
) {
  return createLaunchIdDetailHandler(loadDataset, { chainQualified: true });
}

export default createLaunchIdDetailHandler();
