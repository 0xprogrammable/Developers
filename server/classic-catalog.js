import { createHash } from "node:crypto";

import {
  CHAIN_ID,
  CLASSIC_CATALOG_SOURCE,
  CLASSIC_CATALOG_SOURCE_URL,
  FINALITY_CONFIRMATIONS,
  RELEASE_BY_ID,
  REQUEST_LIMITS,
} from "./constants.js";
import { readBoundedText } from "./bounded-body.js";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const GIT_COMMIT = /^(?!0{40}$)[0-9a-f]{40}$/;
const SOURCE_DEPLOYMENT = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const MAXIMUM_PAGES = 10;
const MAXIMUM_TOKENS = 1_000;
const MAXIMUM_AGGREGATE_BYTES = 5_000_000;
const PAGE_SIZE = 100;
const RETRY_DELAYS_MS = Object.freeze([250, 750]);

function boundedInteger(value) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function decimal(value) {
  return typeof value === "string" && value.length <= 78 && DECIMAL.test(value)
    ? value
    : null;
}

function address(value) {
  return typeof value === "string" && ADDRESS.test(value) ? value : null;
}

function hash32(value) {
  return typeof value === "string" && HASH32.test(value) ? value : null;
}

function instant(value) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
    ? value
    : null;
}

function httpsUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

function normalizedLinks(value) {
  if (!Array.isArray(value) || value.length > 32) return {};
  const links = {};
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const key = entry.kind === "documentation" ? "documentation" : entry.kind;
    if (!["website", "documentation", "x", "telegram", "github"].includes(key)) {
      continue;
    }
    const url = httpsUrl(entry.url ?? entry.uri);
    if (url && !Object.hasOwn(links, key)) links[key] = url;
  }
  return links;
}

function stableCatalogBoundary(payload) {
  const catalog = payload?.catalog;
  const evidence = catalog?.evidence;
  const dataQuality = payload?.dataQuality;
  const included = catalog?.scope?.included;
  const excluded = catalog?.scope?.excluded;
  const asOfBlock = boundedInteger(catalog?.asOfBlock);
  const generatedAt = instant(catalog?.lastIndexedAt);
  if (
    payload?.status !== "ready" ||
    !catalog ||
    catalog.source !== CLASSIC_CATALOG_SOURCE.catalogSource ||
    catalog.launchSource !== CLASSIC_CATALOG_SOURCE.launchSource ||
    !["current", "last-known-good"].includes(catalog.status) ||
    catalog.completeness?.classic !== "current" ||
    !Array.isArray(included) ||
    CLASSIC_CATALOG_SOURCE.requiredScope.some((scope) => !included.includes(scope)) ||
    !Array.isArray(excluded) ||
    CLASSIC_CATALOG_SOURCE.requiredExcludedScope.some(
      (scope) => !excluded.includes(scope),
    ) ||
    !Array.isArray(catalog.scope?.publicCategories) ||
    catalog.scope.publicCategories.length !== 2 ||
    !catalog.scope.publicCategories.includes("classic") ||
    !catalog.scope.publicCategories.includes("custom") ||
    evidence?.kind !== CLASSIC_CATALOG_SOURCE.evidenceKind ||
    !SOURCE_DEPLOYMENT.test(evidence.deployment ?? "") ||
    !GIT_COMMIT.test(evidence.sourceCommit ?? "") ||
    !SHA256.test(evidence.commitment ?? "") ||
    !SHA256.test(catalog.identityCommitment ?? "") ||
    hash32(catalog.asOfBlockHash) === null ||
    asOfBlock === null ||
    generatedAt === null ||
    decimal(evidence.progressBlock) === null ||
    evidence.progressBlock !== catalog.asOfBlock ||
    !Number.isSafeInteger(catalog.identityCount) ||
    catalog.identityCount < 1 ||
    dataQuality?.schemaVersion !== CLASSIC_CATALOG_SOURCE.schemaVersion ||
    dataQuality?.launchIdentity?.status !== "current" ||
    dataQuality.launchIdentity.canonical !== "current" ||
    dataQuality.launchIdentity.asOfBlock !== catalog.asOfBlock
  ) {
    throw new Error("Classic catalog source binding is invalid");
  }
  return {
    blockNumber: asOfBlock,
    blockHash: catalog.asOfBlockHash,
    generatedAt,
    identityCount: catalog.identityCount,
    identityCommitment: catalog.identityCommitment,
    status: catalog.status,
    schemaVersion: dataQuality.schemaVersion,
    scope: JSON.stringify({
      included: [...new Set(included)].sort(),
      excluded: [...new Set(excluded)].sort(),
      publicCategories: [...new Set(catalog.scope.publicCategories)].sort(),
    }),
    deployment: evidence.deployment,
    sourceCommit: evidence.sourceCommit,
    evidenceCommitment: evidence.commitment,
  };
}

function sameCatalogIdentity(left, right) {
  return [
    "identityCount",
    "identityCommitment",
    "status",
    "schemaVersion",
    "scope",
    "deployment",
    "sourceCommit",
  ].every((key) => left[key] === right[key]);
}

function conservativePageBoundary(pageBoundaries) {
  const ordered = pageBoundaries
    .map(({ page, boundary }) => ({
      page,
      block: boundary.blockNumber,
      hash: boundary.blockHash.toLowerCase(),
      evidenceCommitment: boundary.evidenceCommitment,
    }))
    .sort((left, right) => left.page - right.page);
  const hashesByBlock = new Map();
  for (const entry of ordered) {
    const existing = hashesByBlock.get(entry.block);
    if (existing !== undefined && existing !== entry.hash) {
      throw new Error("Classic catalog changed during page traversal");
    }
    hashesByBlock.set(entry.block, entry.hash);
  }
  const anchor = [...pageBoundaries].sort(
    (left, right) =>
      left.boundary.blockNumber - right.boundary.blockNumber ||
      left.page - right.page,
  )[0].boundary;
  return {
    anchor,
    pageBoundaryCommitment: `sha256:${createHash("sha256")
      .update(`${JSON.stringify(ordered)}\n`)
      .digest("hex")}`,
    pageBoundaryCount: ordered.length,
  };
}

function expectedPageLength(page, total, totalPages) {
  return page < totalPages ? PAGE_SIZE : total - PAGE_SIZE * (totalPages - 1);
}

function normalizedClassicToken(token) {
  const release = RELEASE_BY_ID.get(token?.launchModelVersion);
  if (
    !token ||
    token.exploreKind !== "token" ||
    token.launchModel !== "classic" ||
    token.launchCategoryProvenance?.category !== "classic" ||
    token.launchCategoryProvenance?.source !== "canonical-launch-read-model" ||
    address(token.tokenAddress) === null ||
    address(token.hookAddress) === null ||
    hash32(token.poolId) === null ||
    decimal(token.launchBlockNumber) === null ||
    hash32(token.launchTransactionHash) === null ||
    hash32(token.launchHash) === null ||
    boundedInteger(token.launchTransactionIndex) === null ||
    boundedInteger(token.launchLogIndex) === null ||
    instant(token.launchedAt) === null ||
    !release || release.modelId !== "classic" ||
    address(release.hook) === null ||
    token.hookAddress.toLowerCase() !== release.hook.toLowerCase()
  ) {
    throw new Error("Classic catalog token binding is invalid");
  }
  const quoteAsset = address(token.quoteAssetAddress);
  const canonicalQuoteAsset = quoteAsset?.toLowerCase() ===
      "0x0000000000000000000000000000000000000000"
    ? null
    : quoteAsset;
  return {
    chainId: CHAIN_ID,
    address: token.tokenAddress,
    name: token.name,
    symbol: token.symbol,
    decimals: token.tokenDecimals,
    totalSupplyRaw: token.totalSupplyRaw,
    description: token.description ?? null,
    imageUrl: token.imageUrl ?? null,
    links: normalizedLinks(token.links),
    launch: {
      modelId: "classic",
      modelVersion: token.launchModelVersion,
      creatorAddress: token.creatorAddress,
      transactionHash: token.launchTransactionHash,
      blockNumber: token.launchBlockNumber,
      transactionIndex: token.launchTransactionIndex,
      logIndex: token.launchLogIndex,
      blockHash: null,
      launchedAt: token.launchedAt,
    },
    canonicalPool: {
      poolId: token.poolId,
      hookAddress: token.hookAddress,
      quoteAssetAddress: canonicalQuoteAsset,
      quoteAssetSymbol: token.quoteAssetSymbol ?? null,
      quoteAssetName: token.quoteAssetName ?? null,
      quoteIsCurrency0:
        typeof token.quoteIsCurrency0 === "boolean"
          ? token.quoteIsCurrency0
          : null,
      positionRecipient: token.positionRecipient ?? null,
      positionTokenId: token.positionTokenId ?? null,
      tokenLiquidityAmountRaw: token.tokenLiquidityAmountRaw ?? null,
      lockedTokenDustRaw: token.lockedTokenDustRaw ?? null,
    },
    fees: {
      currency: canonicalQuoteAsset === null ? "ETH" : token.quoteAssetSymbol ?? null,
      currencyAddress: canonicalQuoteAsset,
      buyHookFeeBps: token.buyHookFeeBps,
      sellHookFeeBps: token.sellHookFeeBps,
      buyCreatorFeeBps: token.buyCreatorFeeBps ?? null,
      sellCreatorFeeBps: token.sellCreatorFeeBps ?? null,
      creatorFeeBps: token.creatorFeeBps ?? null,
      transferTaxBps: token.transferTaxBps ?? null,
      lpFeePips: token.lpFeePips ?? null,
    },
    release: {
      launchHash: token.launchHash,
      rewardVault: token.rewardVaultAddress ?? null,
    },
  };
}

async function readPage(page, fetcher) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_LIMITS.classicCatalogTimeoutMs,
  );
  const url = new URL(CLASSIC_CATALOG_SOURCE_URL);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("model", "classic");
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "newest");
  try {
    const response = await fetcher(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "programmable-developer-api/2",
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Classic catalog returned HTTP ${response.status}`);
    }
    const source = await readBoundedText(
      response,
      REQUEST_LIMITS.classicCatalogResponseBytes,
      "Classic catalog response",
    );
    return {
      payload: JSON.parse(source),
      byteLength: Buffer.byteLength(source, "utf8"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function paginationShape(payload) {
  const total = boundedInteger(payload?.total);
  const totalPages = boundedInteger(payload?.totalPages);
  if (
    total === null || total > MAXIMUM_TOKENS || totalPages === null ||
    totalPages < 1 || totalPages > MAXIMUM_PAGES ||
    totalPages !== Math.max(1, Math.ceil(total / PAGE_SIZE))
  ) throw new Error("Classic catalog pagination is invalid");
  return { total, totalPages };
}

async function readClassicCatalogSnapshot(fetcher) {
  const firstPage = await readPage(1, fetcher);
  const first = firstPage.payload;
  const boundary = stableCatalogBoundary(first);
  const { total, totalPages } = paginationShape(first);
  if (
    first.page !== 1 ||
    first.pageSize !== PAGE_SIZE ||
    !Array.isArray(first.tokens) ||
    first.tokens.length !== expectedPageLength(1, total, totalPages)
  ) {
    throw new Error("Classic catalog pagination is invalid");
  }
  const pages = [
    firstPage,
    ...await Promise.all(
      Array.from(
        { length: totalPages - 1 },
        (_, index) => readPage(index + 2, fetcher),
      ),
    ),
  ];

  let aggregateBytes = firstPage.byteLength;
  let rawTokenCount = first.tokens.length;
  const seen = new Set();
  const tokens = [];
  const pageBoundaries = [{ page: 1, boundary }];
  function accumulate(rawTokens) {
    for (const raw of rawTokens) {
      if (!CLASSIC_CATALOG_SOURCE.activeReleases.includes(raw?.launchModelVersion)) {
        continue;
      }
      const token = normalizedClassicToken(raw);
      const key = token.address.toLowerCase();
      if (seen.has(key)) throw new Error("Classic catalog contains a duplicate token");
      seen.add(key);
      tokens.push(token);
    }
  }
  accumulate(first.tokens);
  for (let page = 2; page <= totalPages; page += 1) {
    const pageResult = pages[page - 1];
    const payload = pageResult.payload;
    const pageBoundary = stableCatalogBoundary(payload);
    if (
      !sameCatalogIdentity(boundary, pageBoundary) ||
      payload.total !== total ||
      payload.totalPages !== totalPages ||
      payload.page !== page ||
      payload.pageSize !== PAGE_SIZE ||
      !Array.isArray(payload.tokens) ||
      payload.tokens.length !== expectedPageLength(page, total, totalPages)
    ) {
      throw new Error("Classic catalog changed during page traversal");
    }
    pageBoundaries.push({ page, boundary: pageBoundary });
    aggregateBytes += pageResult.byteLength;
    if (aggregateBytes > MAXIMUM_AGGREGATE_BYTES) {
      throw new Error("Classic catalog exceeds the aggregate response limit");
    }
    rawTokenCount += payload.tokens.length;
    accumulate(payload.tokens);
  }

  if (rawTokenCount !== total) {
    throw new Error("Classic catalog pagination is invalid");
  }
  if (tokens.length === 0 || !tokens.some((token) =>
    token.launch.modelVersion === "classic-v4")) {
    throw new Error("Classic catalog identity set is incomplete");
  }
  const pagingBoundary = conservativePageBoundary(pageBoundaries);
  const anchor = pagingBoundary.anchor;
  return {
    reportedStatus: boundary.status,
    schemaVersion: CLASSIC_CATALOG_SOURCE.schemaVersion,
    source: {
      deployment: boundary.deployment,
      sourceCommit: boundary.sourceCommit,
      identityCount: boundary.identityCount,
      identityCommitment: boundary.identityCommitment,
      evidenceCommitment: anchor.evidenceCommitment,
      pageBoundaryCommitment: pagingBoundary.pageBoundaryCommitment,
      pageBoundaryCount: pagingBoundary.pageBoundaryCount,
      generatedAt: anchor.generatedAt,
    },
    snapshot: {
      blockNumber: anchor.blockNumber,
      blockHash: anchor.blockHash,
      confirmations: FINALITY_CONFIRMATIONS,
    },
    tokens,
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function readClassicCatalogFeed(fetcher = fetch, wait = delay) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await readClassicCatalogSnapshot(fetcher);
    } catch (error) {
      if (error?.message !== "Classic catalog changed during page traversal") {
        throw error;
      }
      lastError = error;
      if (attempt < RETRY_DELAYS_MS.length) {
        await wait(RETRY_DELAYS_MS[attempt]);
      }
    }
  }
  throw lastError;
}
