import { API_SCHEMA_VERSION, CHAIN_ID } from "../../server/constants.js";
import {
  feedStatus,
  getDataset,
  isDatasetPublishable,
} from "../../server/dataset.js";
import {
  error,
  handleOptions,
  json,
  parseChainId,
  parseCategory,
  queryParametersAllowed,
  queryValue,
} from "../../server/http.js";

export function tokenListPayload(records, generatedAt, category = null) {
  const finalizedRecords = records.filter(
    (record) =>
      record.launch.finality === "finalized" &&
      record.token.identityStatus === "complete",
  );
  const selectedRecords = category
    ? finalizedRecords.filter((record) => record.category === category)
    : finalizedRecords;
  const tokens = selectedRecords.map((record) => ({
    chainId: CHAIN_ID,
    address: record.token.address,
    name: record.token.name,
    symbol: record.token.symbol,
    decimals: record.token.decimals,
    logoURI: record.token.metadata.imageUrl,
    extensions: {
      programmable: {
        platformId: "programmable",
        launchId: record.launchId,
        category: record.category,
        provenanceStatus: record.verification.provenanceStatus,
        marketCount: record.markets.length,
        modelId: record.launch.modelId,
        modelVersion: record.launch.modelVersion,
        origin: record.launch.origin,
        launchTransactionHash: record.launch.transactionHash,
        launchBlockNumber: record.launch.blockNumber,
        finality: record.launch.finality,
        marketIds: record.markets.map((market) => market.marketId),
        programmableFeeBps: record.fees[0]?.rateBps ?? 10,
        programmableFeeChargeMode: record.fees[0]?.chargeMode ?? "included",
      },
    },
  }));

  return {
    schemaVersion: API_SCHEMA_VERSION,
    name: "Programmable",
    timestamp: generatedAt,
    version: { major: 1, minor: 0, patch: 0 },
    keywords: ["programmable", "uniswap-v4", "ethereum"],
    tokens,
  };
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    error(req, res, 405, "METHOD_NOT_ALLOWED", "Only GET is supported");
    return;
  }
  if (!queryParametersAllowed(req, ["category", "chainId"])) {
    error(req, res, 400, "INVALID_QUERY", "Query parameters are invalid or repeated");
    return;
  }

  const category = parseCategory(queryValue(req, "category"));
  if (category === undefined) {
    error(req, res, 400, "INVALID_CATEGORY", "category must be classic or custom");
    return;
  }
  if (parseChainId(queryValue(req, "chainId"), CHAIN_ID) === null) {
    error(req, res, 400, "CHAIN_NOT_SUPPORTED", "Only Ethereum Mainnet is supported");
    return;
  }

  try {
    const dataset = await getDataset();
    if (!isDatasetPublishable(dataset)) {
      error(
        req,
        res,
        503,
        "INDEX_COVERAGE_INCOMPLETE",
        "The token list is waiting for complete chain coverage",
      );
      return;
    }
    json(
      req,
      res,
      200,
      tokenListPayload(dataset.records, dataset.status.generatedAt, category),
      { apiStatus: feedStatus(dataset.status.status) },
    );
  } catch {
    error(
      req,
      res,
      503,
      "TOKEN_LIST_UNAVAILABLE",
      "The token list could not be produced",
    );
  }
}
