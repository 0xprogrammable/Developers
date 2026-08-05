import {
  CHAIN_ID,
  LAUNCH_SCHEMA_VERSION,
  LEGACY_SOURCE_URL,
  PLATFORM_ID,
  PLATFORM_FEE,
  RELEASE_BY_ID,
  RELEASE_BY_LAUNCHER,
} from "./constants.js";
import { ethCall, parseQuantity } from "./rpc.js";

const HEX_32_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function safeText(value, maximumLength) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
      "",
    )
    .trim();
  return cleaned ? cleaned.slice(0, maximumLength) : null;
}

function safeAddress(value) {
  return typeof value === "string" && ADDRESS_PATTERN.test(value)
    ? value
    : null;
}

function safeHash(value) {
  return typeof value === "string" && HEX_32_PATTERN.test(value) ? value : null;
}

function safeUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function safeInteger(value) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function safeBps(value) {
  const parsed = safeInteger(value);
  return parsed !== null && parsed <= 10_000 ? parsed : null;
}

function safeRawAmount(value) {
  return typeof value === "string" &&
    value.length <= 78 &&
    /^(0|[1-9]\d*)$/.test(value)
    ? value
    : null;
}

function releaseForLegacy(token) {
  const hook = safeAddress(token?.canonicalPool?.hookAddress)?.toLowerCase();
  if (hook === RELEASE_BY_ID.get("classic-v2").hook.toLowerCase()) {
    return RELEASE_BY_ID.get("classic-v2");
  }
  if (hook === RELEASE_BY_ID.get("classic-v3").hook.toLowerCase()) {
    return RELEASE_BY_ID.get("classic-v3");
  }
  if (hook === RELEASE_BY_ID.get("stock-paired-v1").hook.toLowerCase()) {
    return RELEASE_BY_ID.get("stock-paired-v1");
  }
  if (hook === RELEASE_BY_ID.get("stock-paired-v3").hook.toLowerCase()) {
    const launchBlock = safeInteger(token?.launch?.blockNumber) ?? 0;
    if (launchBlock >= RELEASE_BY_ID.get("stock-paired-v3").startBlock) {
      return RELEASE_BY_ID.get("stock-paired-v3");
    }
    return RELEASE_BY_ID.get("stock-paired-v2");
  }
  return null;
}

function normalizedLinks(links) {
  if (!links || typeof links !== "object" || Array.isArray(links)) return {};
  const result = {};
  for (const key of ["website", "x", "telegram", "github"]) {
    const url = safeUrl(links[key]);
    if (url) result[key] = url;
  }
  const documentation = safeUrl(links.documentation ?? links.docs);
  if (documentation) result.documentation = documentation;
  return result;
}

function normalizeFeeDisclosure(fees, fallback) {
  const buyTotalFeeBps =
    safeBps(fees?.buyHookFeeBps) ?? fallback?.buyTotalFeeBps ?? null;
  const sellTotalFeeBps =
    safeBps(fees?.sellHookFeeBps) ?? fallback?.sellTotalFeeBps ?? null;
  const buyProjectFeeBps =
    safeBps(fees?.buyCreatorFeeBps) ??
    safeBps(fees?.creatorFeeBps) ??
    (buyTotalFeeBps === null ? null : Math.max(0, buyTotalFeeBps - PLATFORM_FEE.feeBps));
  const sellProjectFeeBps =
    safeBps(fees?.sellCreatorFeeBps) ??
    safeBps(fees?.creatorFeeBps) ??
    (sellTotalFeeBps === null ? null : Math.max(0, sellTotalFeeBps - PLATFORM_FEE.feeBps));

  return {
    currency: safeText(fees?.currency, 64) ?? fallback?.currency ?? null,
    currencyAddress:
      safeAddress(fees?.currencyAddress) ?? fallback?.currencyAddress ?? null,
    buyTotalFeeBps,
    sellTotalFeeBps,
    buyProjectFeeBps,
    sellProjectFeeBps,
    programmableFeeBps: PLATFORM_FEE.feeBps,
    chargeMode: PLATFORM_FEE.chargeMode,
    transferTaxBps: safeBps(fees?.transferTaxBps),
    lpFeePips: safeInteger(fees?.lpFeePips),
  };
}

function marketFromParts({ pool, tokenAddress, fees, fallbackFees }) {
  const poolId = safeHash(pool?.poolId);
  if (!poolId) return null;
  const quoteAddress = safeAddress(pool?.quoteAssetAddress);
  const feeDisclosure = normalizeFeeDisclosure(fees, fallbackFees);
  return {
    marketId: `uniswap-v4:${poolId.toLowerCase()}`,
    kind: "uniswap-v4",
    status: "active",
    baseTokenAddress: tokenAddress,
    quoteTokenAddress: quoteAddress,
    protocol: "uniswap-v4",
    poolId,
    poolAddress: null,
    hookAddress: safeAddress(pool?.hookAddress),
    support: {
      discovery: "available",
      charting: "unknown",
      quote: "unavailable",
      simulation: "unavailable",
      execution: "unavailable",
    },
    adapter: null,
    metrics: {
      price: { status: "unavailable", value: null },
      liquidity: { status: "unavailable", value: null },
      volume24h: { status: "unavailable", value: null },
      updatedAt: null,
    },
    _disclosure: {
      quoteAssetSymbol: safeText(pool?.quoteAssetSymbol, 64),
      quoteAssetName: safeText(pool?.quoteAssetName, 128),
      quoteIsCurrency0:
        typeof pool?.quoteIsCurrency0 === "boolean" ? pool.quoteIsCurrency0 : null,
      fees: feeDisclosure,
      liquidityPosition: {
        recipient: safeAddress(pool?.positionRecipient),
        tokenId: safeRawAmount(pool?.positionTokenId),
        tokenLiquidityAmountRaw: safeRawAmount(pool?.tokenLiquidityAmountRaw),
        lockedTokenDustRaw: safeRawAmount(pool?.lockedTokenDustRaw),
      },
    },
  };
}

function platformFeeForMarket(market) {
  return {
    kind: "programmable-platform",
    ratePpm: 1_000,
    rateBps: PLATFORM_FEE.feeBps,
    recipient: PLATFORM_FEE.beneficiary,
    chargeMode: PLATFORM_FEE.chargeMode,
    basis: PLATFORM_FEE.basis,
    assetAddress: market?.quoteTokenAddress ?? null,
    verificationStatus: "verified",
  };
}

function publicMarket(market) {
  if (!market) return null;
  const { _disclosure: _privateDisclosure, ...result } = market;
  return result;
}

function makeSortKey(record) {
  const block = String(record.launch.blockNumber ?? 0).padStart(16, "0");
  const transactionIndex = String(record.launch.transactionIndex ?? 0).padStart(10, "0");
  const logIndex = String(record.launch.logIndex ?? 0).padStart(10, "0");
  const identity = record.token?.address?.toLowerCase() ??
    String(record.launchId).replace(/^sha256:/, "").toLowerCase();
  return `${block}:${transactionIndex}:${logIndex}:${identity}`;
}

function finalizeRecord(record) {
  return { ...record, sortKey: makeSortKey(record) };
}

export function normalizeLegacyToken(token) {
  if (token?.chainId !== CHAIN_ID) return null;
  const tokenAddress = safeAddress(token.address);
  if (!tokenAddress) return null;
  const tokenName = safeText(token.name, 128);
  const tokenSymbol = safeText(token.symbol, 32);
  const tokenDecimals = safeInteger(token.decimals);
  if (!tokenName || !tokenSymbol || tokenDecimals === null || tokenDecimals > 255) {
    return null;
  }
  const release = releaseForLegacy(token);
  if (!release) return null;
  const declaredModel = safeText(token?.launch?.modelId ?? token?.launch?.model, 64);
  const modelId = release.modelId ?? declaredModel ?? "unknown";
  const category = release.category;
  const market = marketFromParts({
    pool: token.canonicalPool,
    tokenAddress,
    fees: token.fees,
    fallbackFees: null,
  });

  const record = {
    schemaVersion: LAUNCH_SCHEMA_VERSION,
    platformId: PLATFORM_ID,
    launchId: `eip155:${CHAIN_ID}:${tokenAddress.toLowerCase()}`,
    category,
    chainId: CHAIN_ID,
    token: {
      address: tokenAddress,
      identityStatus: "complete",
      name: tokenName,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      totalSupplyRaw: safeRawAmount(token.totalSupplyRaw),
      supplyStatus: safeRawAmount(token.totalSupplyRaw)
        ? "observed"
        : "unavailable",
      supplyAsOfBlock: safeRawAmount(token.totalSupplyRaw)
        ? safeRawAmount(token?.launch?.blockNumber)
        : null,
      metadata: {
        description: safeText(token.description, 2_000),
        imageUrl: safeUrl(token.imageUrl),
        links: normalizedLinks(token.links),
        trustStatus: "creator-declared",
      },
    },
    launch: {
      status: "live",
      origin: release?.origin ?? "first-party",
      modelId,
      modelVersion:
        release?.modelVersion ?? safeText(token?.launch?.modelVersion, 64),
      publicSubmission: false,
      creatorAddress: safeAddress(token?.launch?.creatorAddress),
      transactionHash: safeHash(token?.launch?.transactionHash),
      blockNumber: safeRawAmount(String(token?.launch?.blockNumber ?? "")),
      blockHash: null,
      transactionIndex: null,
      logIndex: null,
      timestamp: safeText(token?.launch?.launchedAt, 64),
      finality: null,
    },
    verification: {
      sourceId: release?.deploymentId ?? `unmatched-legacy:${modelId}`,
      launcherAddress: release?.launcher ?? null,
      registryAddress: null,
      provenanceStatus: "partial",
      sourceUrl: LEGACY_SOURCE_URL,
    },
    capabilities: market
      ? [
          {
            id: "uniswap-v4-pool",
            version: "1",
            status: "active",
            parameters: {},
          },
        ]
      : [],
    markets: market ? [publicMarket(market)] : [],
    fees: [platformFeeForMarket(market)],
    extensions: {
      "programmable/release": {
        deploymentId: release?.deploymentId ?? null,
        releaseId: release?.id ?? null,
        modelVersion: release?.modelVersion ?? null,
        legacyModelVersion: safeText(token?.launch?.modelVersion, 64),
      },
      "programmable/market-disclosure": market?._disclosure ?? null,
    },
  };
  return finalizeRecord(record);
}

function stripHexPrefix(value) {
  return typeof value === "string" && value.startsWith("0x")
    ? value.slice(2)
    : "";
}

function words(data) {
  const hex = stripHexPrefix(data);
  if (hex.length % 64 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return [];
  return hex.match(/.{64}/g) ?? [];
}

function wordAddress(word) {
  return typeof word === "string" && /^[0-9a-f]{64}$/i.test(word)
    ? `0x${word.slice(24)}`
    : null;
}

function topicAddress(topic) {
  return wordAddress(stripHexPrefix(topic));
}

function wordInteger(word) {
  if (typeof word !== "string" || !/^[0-9a-f]{64}$/i.test(word)) return null;
  const parsed = BigInt(`0x${word}`);
  return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null;
}

function wordAmount(word) {
  return typeof word === "string" && /^[0-9a-f]{64}$/i.test(word)
    ? BigInt(`0x${word}`).toString()
    : null;
}

function wordHash(word) {
  return typeof word === "string" && /^[0-9a-f]{64}$/i.test(word)
    ? `0x${word}`
    : null;
}

export function decodeLaunchLog(log) {
  if (!log || log.removed === true || !Array.isArray(log.topics)) return null;
  const release = RELEASE_BY_LAUNCHER.get(String(log.address).toLowerCase());
  if (!release || String(log.topics[0]).toLowerCase() !== release.launchTopic) {
    return null;
  }
  const data = words(log.data);
  const creatorAddress = topicAddress(log.topics[1]);
  const tokenAddress = topicAddress(log.topics[2]);
  if (!creatorAddress || !tokenAddress) return null;

  let poolId = null;
  let hookAddress = null;
  let quoteAssetAddress = null;
  let rewardVault = null;
  let positionRecipient = null;
  let positionTokenId = null;
  let launchHash = null;
  let fallbackFees = null;

  if (release.decoder === "classic-v2" && data.length >= 5) {
    poolId = safeHash(log.topics[3]);
    hookAddress = wordAddress(data[0]);
    positionRecipient = wordAddress(data[1]);
    positionTokenId = wordAmount(data[2]);
    const total = wordInteger(data[3]);
    fallbackFees = {
      currency: "ETH",
      currencyAddress: null,
      buyTotalFeeBps: total,
      sellTotalFeeBps: total,
    };
    launchHash = wordHash(data[4]);
  } else if (release.decoder === "classic-v3" && data.length >= 8) {
    poolId = safeHash(log.topics[3]);
    hookAddress = wordAddress(data[0]);
    rewardVault = wordAddress(data[1]);
    positionRecipient = wordAddress(data[2]);
    positionTokenId = wordAmount(data[3]);
    fallbackFees = {
      currency: "ETH",
      currencyAddress: null,
      buyTotalFeeBps: wordInteger(data[4]),
      sellTotalFeeBps: wordInteger(data[5]),
    };
    launchHash = wordHash(data[7]);
  } else if (release.decoder === "stock-paired" && data.length >= 5) {
    quoteAssetAddress = topicAddress(log.topics[3]);
    poolId = wordHash(data[0]);
    rewardVault = wordAddress(data[1]);
    positionRecipient = wordAddress(data[2]);
    positionTokenId = wordAmount(data[3]);
    fallbackFees = {
      currency: null,
      currencyAddress: quoteAssetAddress,
      buyTotalFeeBps: 100,
      sellTotalFeeBps: 100,
    };
    launchHash = wordHash(data[4]);
  } else {
    return null;
  }

  if (!poolId) return null;
  let blockTimestamp = null;
  try {
    blockTimestamp =
      log.blockTimestamp === undefined || log.blockTimestamp === null
        ? null
        : parseQuantity(log.blockTimestamp);
  } catch {
    blockTimestamp = null;
  }
  return {
    release,
    creatorAddress,
    tokenAddress,
    poolId,
    hookAddress,
    quoteAssetAddress,
    rewardVault,
    positionRecipient,
    positionTokenId,
    launchHash,
    fallbackFees,
    blockNumber: parseQuantity(log.blockNumber),
    blockHash: safeHash(log.blockHash),
    transactionHash: safeHash(log.transactionHash),
    transactionIndex: parseQuantity(log.transactionIndex),
    logIndex: parseQuantity(log.logIndex),
    blockTimestamp,
  };
}

function decodeAbiString(value) {
  const hex = stripHexPrefix(value);
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length < 64) return null;
  try {
    const offset = Number(BigInt(`0x${hex.slice(0, 64)}`));
    if (Number.isSafeInteger(offset) && offset >= 0 && (offset + 32) * 2 <= hex.length) {
      const lengthOffset = offset * 2;
      const length = Number(BigInt(`0x${hex.slice(lengthOffset, lengthOffset + 64)}`));
      const valueOffset = lengthOffset + 64;
      if (
        Number.isSafeInteger(length) &&
        length >= 0 &&
        length <= 512 &&
        valueOffset + length * 2 <= hex.length
      ) {
        return safeText(Buffer.from(hex.slice(valueOffset, valueOffset + length * 2), "hex").toString("utf8"), 512);
      }
    }
    return safeText(
      Buffer.from(hex.slice(0, 64), "hex").toString("utf8").replace(/\0+$/, ""),
      64,
    );
  } catch {
    return null;
  }
}

export async function readErc20Metadata(
  tokenAddress,
  preferredProvider,
  blockNumber,
) {
  const calls = await Promise.allSettled([
    ethCall(tokenAddress, "0x06fdde03", preferredProvider, blockNumber),
    ethCall(tokenAddress, "0x95d89b41", preferredProvider, blockNumber),
    ethCall(tokenAddress, "0x313ce567", preferredProvider, blockNumber),
    ethCall(tokenAddress, "0x18160ddd", preferredProvider, blockNumber),
  ]);
  const decimalsResult = calls[2].status === "fulfilled" ? calls[2].value : null;
  let decimals = null;
  try {
    if (
      typeof decimalsResult === "string" &&
      decimalsResult.length <= 66 &&
      /^0x[0-9a-f]{1,64}$/i.test(decimalsResult)
    ) {
      const parsed = Number(BigInt(decimalsResult));
      if (Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 255) decimals = parsed;
    }
  } catch {
    decimals = null;
  }
  let totalSupplyRaw = null;
  try {
    const supplyResult = calls[3].status === "fulfilled" ? calls[3].value : null;
    if (
      typeof supplyResult === "string" &&
      supplyResult.length <= 66 &&
      /^0x[0-9a-f]{1,64}$/i.test(supplyResult)
    ) {
      totalSupplyRaw = BigInt(supplyResult).toString();
    }
  } catch {
    totalSupplyRaw = null;
  }
  return {
    name: calls[0].status === "fulfilled" ? decodeAbiString(calls[0].value) : null,
    symbol: calls[1].status === "fulfilled" ? decodeAbiString(calls[1].value) : null,
    decimals,
    totalSupplyRaw,
  };
}

export function normalizeGapLaunch(decoded, metadata, block) {
  const name = safeText(metadata.name, 128);
  const symbol = safeText(metadata.symbol, 32);
  const identityComplete =
    name !== null && symbol !== null && metadata.decimals !== null;
  const supplyKnown = metadata.totalSupplyRaw !== null;
  const timestampSeconds = Number.isSafeInteger(block?.timestamp)
    ? block.timestamp
    : decoded.blockTimestamp;
  const timestamp =
    Number.isSafeInteger(timestampSeconds) &&
    timestampSeconds >= 0 &&
    timestampSeconds <= 8_640_000_000
      ? new Date(timestampSeconds * 1_000).toISOString()
      : null;
  const blockHash = decoded.blockHash ?? block?.blockHash ?? null;
  const exactProvenance = Boolean(
    decoded.transactionHash &&
      blockHash &&
      Number.isSafeInteger(decoded.logIndex),
  );
  const pool = {
    poolId: decoded.poolId,
    hookAddress: decoded.hookAddress ?? decoded.release.hook,
    quoteAssetAddress: decoded.quoteAssetAddress,
    quoteAssetSymbol: null,
    quoteAssetName: null,
    quoteIsCurrency0: null,
    positionRecipient: decoded.positionRecipient,
    positionTokenId: decoded.positionTokenId,
    tokenLiquidityAmountRaw: null,
    lockedTokenDustRaw: null,
  };
  const market = marketFromParts({
    pool,
    tokenAddress: decoded.tokenAddress,
    fees: null,
    fallbackFees: decoded.fallbackFees,
  });
  const record = {
    schemaVersion: LAUNCH_SCHEMA_VERSION,
    platformId: PLATFORM_ID,
    launchId: `eip155:${CHAIN_ID}:${decoded.tokenAddress.toLowerCase()}`,
    category: decoded.release.category,
    chainId: CHAIN_ID,
    token: {
      address: decoded.tokenAddress,
      identityStatus: identityComplete ? "complete" : "partial",
      name,
      symbol,
      decimals: metadata.decimals,
      totalSupplyRaw: metadata.totalSupplyRaw,
      supplyStatus: supplyKnown ? "observed" : "unavailable",
      supplyAsOfBlock: supplyKnown ? String(decoded.blockNumber) : null,
      metadata: {
        description: null,
        imageUrl: null,
        links: null,
        trustStatus: "unavailable",
      },
    },
    launch: {
      status: "live",
      origin: decoded.release.origin,
      modelId: decoded.release.modelId,
      modelVersion: decoded.release.modelVersion,
      publicSubmission: false,
      creatorAddress: decoded.creatorAddress,
      transactionHash: decoded.transactionHash,
      blockNumber: String(decoded.blockNumber),
      blockHash,
      transactionIndex: decoded.transactionIndex,
      logIndex: decoded.logIndex,
      timestamp,
      finality: null,
    },
    verification: {
      sourceId: decoded.release.deploymentId,
      launcherAddress: decoded.release.launcher,
      registryAddress: null,
      provenanceStatus: exactProvenance ? "verified" : "partial",
      sourceUrl: decoded.transactionHash
        ? `https://etherscan.io/tx/${decoded.transactionHash}`
        : null,
    },
    capabilities: market
      ? [
          {
            id: "uniswap-v4-pool",
            version: "1",
            status: "active",
            parameters: {},
          },
        ]
      : [],
    markets: market ? [publicMarket(market)] : [],
    fees: [platformFeeForMarket(market)],
    extensions: {
      "programmable/release": {
        deploymentId: decoded.release.deploymentId,
        releaseId: decoded.release.id,
        modelVersion: decoded.release.modelVersion,
        launchHash: decoded.launchHash,
        rewardVault: decoded.rewardVault,
      },
      "programmable/market-disclosure": market?._disclosure ?? null,
    },
  };
  return finalizeRecord(record);
}

export function publicLaunch(record) {
  const { sortKey: _sortKey, ...publicRecord } = record;
  const { transactionIndex: _transactionIndex, ...launch } = publicRecord.launch;
  return { ...publicRecord, launch };
}

export function compareLaunchesDescending(a, b) {
  const blockA = BigInt(a.launch.blockNumber ?? 0);
  const blockB = BigInt(b.launch.blockNumber ?? 0);
  if (blockA !== blockB) return blockA > blockB ? -1 : 1;
  const transactionDifference =
    (b.launch.transactionIndex ?? 0) - (a.launch.transactionIndex ?? 0);
  if (transactionDifference !== 0) return transactionDifference;
  const logDifference = (b.launch.logIndex ?? 0) - (a.launch.logIndex ?? 0);
  if (logDifference !== 0) return logDifference;
  const identityA = a.token?.address?.toLowerCase() ?? a.launchId.toLowerCase();
  const identityB = b.token?.address?.toLowerCase() ?? b.launchId.toLowerCase();
  return identityB.localeCompare(identityA);
}
