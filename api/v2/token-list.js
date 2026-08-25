import { API_V2_SCHEMA_VERSION } from "../../server/constants.js";
import {
  feedStatusV2,
  getV2Dataset,
} from "../../server/v2-dataset.js";
import {
  error,
  handleOptions,
  json,
  parseEvmChainId,
  parseCategory,
  queryParametersAllowed,
  queryValue,
} from "../../server/http.js";

function programmableFee(record) {
  return record.fees.find(
    (fee) =>
      fee.share === "programmable" || fee.kind === "programmable-platform",
  ) ?? null;
}

export function tokenListPayload(
  records,
  generatedAt,
  category = null,
  chainId = null,
  status = "ready",
) {
  const finalizedRecords = records.filter(
    (record) =>
      record.launch.finality === "finalized" &&
      record.lifecycle?.status !== "revoked" &&
      record.token?.identityStatus === "complete" &&
      (chainId === null || record.chainId === chainId),
  );
  const selectedRecords = category
    ? finalizedRecords.filter((record) => record.category === category)
    : finalizedRecords;
  const tokens = selectedRecords.map((record) => {
    const fee = programmableFee(record);
    const feePolicy = record.feePolicy ?? null;
    return {
      chainId: record.chainId,
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
          ...(fee
            ? {
                programmableFeeBps: fee.rateBps,
                programmableFeeChargeMode:
                  feePolicy?.chargeMode ?? fee.chargeMode,
              }
            : {}),
          ...(feePolicy
            ? {
                feePolicyMode: feePolicy.mode,
                totalFeeBps: feePolicy.totalFeeBps,
                partnerFeeBps: feePolicy.partnerShareBps,
                normalProgrammableTenBpsApplied:
                  feePolicy.normalProgrammableTenBpsApplied,
              }
            : {}),
        },
      },
    };
  });

  return {
    schemaVersion: API_V2_SCHEMA_VERSION,
    status,
    name: "Programmable",
    timestamp: generatedAt,
    version: { major: 2, minor: 0, patch: 0 },
    keywords: ["programmable", "uniswap-v4", "ethereum"],
    tokens,
  };
}

export function createTokenListHandler(loadDataset = getV2Dataset) {
  return async function handler(req, res) {
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
  const chainId = parseEvmChainId(queryValue(req, "chainId"));
  if (chainId === undefined) {
    error(req, res, 400, "INVALID_CHAIN_ID", "chainId must be a positive EVM chain id");
    return;
  }

  try {
    const dataset = await loadDataset();
    if (chainId !== null && !dataset.status.supportedChainIds?.includes(chainId)) {
      error(req, res, 400, "CHAIN_NOT_SUPPORTED", "chainId is not active in the manifest");
      return;
    }
    const status = feedStatusV2(dataset, category);
    json(
      req,
      res,
      200,
      tokenListPayload(
        dataset.records,
        dataset.status.generatedAt,
        category,
        chainId,
        status,
      ),
      { apiStatus: status },
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
  };
}

export default createTokenListHandler();
