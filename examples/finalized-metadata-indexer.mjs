import {
  assertExactLaunchPartnerAttribution,
} from "../server/partner-attribution.js";
import { readBoundedJson } from "../server/bounded-body.js";

const origin = new URL(
  process.env.PROGRAMMABLE_CUSTOM_LAUNCH_API_BASE ??
    "https://api.programmable.market",
);
if (!new Set(["https:", "http:"]).has(origin.protocol)) {
  throw new Error("Custom Launch API origin must use HTTP or HTTPS");
}

const seenCursors = new Set();
const records = [];
let cursor = null;

do {
  const url = new URL("/v3/finalized-custom-launches", origin);
  url.searchParams.set("limit", "25");
  if (cursor !== null) url.searchParams.set("cursor", cursor);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;
  let page;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Finalized metadata API returned HTTP ${response.status}`);
    }
    page = await readBoundedJson(
      response,
      8 * 1_024 * 1_024,
      "Finalized metadata page",
    );
  } finally {
    clearTimeout(timeout);
  }
  if (
    page?.schemaVersion !==
      "programmable.finalized-custom-launch-metadata-list.v1" ||
    !Array.isArray(page.launches) || page.launches.length > 25 ||
    !(page.nextCursor === null || typeof page.nextCursor === "string")
  ) {
    throw new Error("Finalized metadata page has an unexpected shape");
  }

  for (const item of page.launches) records.push(projectMetadata(item));
  cursor = page.nextCursor;
  if (cursor !== null) {
    if (seenCursors.has(cursor)) throw new Error("Pagination cursor repeated");
    seenCursors.add(cursor);
  }
  if (seenCursors.size > 10_000) {
    throw new Error("Pagination exceeds the bounded traversal limit");
  }
} while (cursor !== null);

process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);

function projectMetadata(item) {
  if (
    item?.schemaVersion !==
      "programmable.finalized-custom-launch-metadata.v1" ||
    item.finality?.state !== "finalized"
  ) {
    throw new Error("Only finalized Custom metadata records are accepted");
  }
  const metadata = item.projectMetadata;
  const presentation = metadata?.presentation;
  const website = link(presentation?.links, "website");
  const x = link(presentation?.links, "x");
  const image = presentation?.image ?? null;
  const declared = {
    name: textOrNull(metadata?.token?.name),
    symbol: textOrNull(metadata?.token?.symbol),
    description: textOrNull(presentation?.description),
    image: image === null
      ? null
      : {
          uri: textOrNull(image.uri),
          contentSha256: textOrNull(image.contentSha256),
          mediaType: textOrNull(image.mediaType),
          byteLength: Number.isSafeInteger(image.byteLength)
            ? image.byteLength
            : null,
          width: Number.isSafeInteger(image.width) ? image.width : null,
          height: Number.isSafeInteger(image.height) ? image.height : null,
        },
    website,
    x,
  };
  const missingCanonicalPresentationFields = [
    ["name", declared.name],
    ["symbol", declared.symbol],
    ["description", declared.description],
    ["image", declared.image],
    ["website", declared.website],
    ["x", declared.x],
  ].filter(([, value]) => value === null).map(([field]) => field);

  const readback = item.tokenMetadataReadback;
  const readbackMatches = readback?.status === "matching";
  const launchedVia = item.partnerAttribution === undefined ||
      item.partnerAttribution === null
    ? null
    : structuredClone(
        assertExactLaunchPartnerAttribution(item.partnerAttribution),
      );

  return {
    routerLaunchId: item.routerLaunchId,
    chainId: item.chainId,
    token: item.token,
    canonicalDisplayMetadata: declared,
    missingCanonicalPresentationFields,
    tokenMetadataReadback: {
      status: readback?.status ?? "unavailable",
      onchainName: readbackMatches ? readback.observed?.name ?? null : null,
      onchainSymbol: readbackMatches ? readback.observed?.symbol ?? null : null,
      observedAtBlockNumber: readback?.observedAtBlockNumber ?? null,
    },
    launchedVia,
    onchainEvidence: {
      router: item.router,
      hook: item.hook,
      poolManager: item.poolManager,
      poolId: item.poolId,
      transactionHash: item.finality.transactionHash,
      blockNumber: item.finality.blockNumber,
      blockHash: item.finality.blockHash,
      logIndex: item.finality.logIndex,
      finality: item.finality.state,
    },
  };
}

function link(links, kind) {
  if (!Array.isArray(links)) return null;
  const matches = links.filter((entry) => entry?.kind === kind);
  if (matches.length > 1) {
    throw new Error(`Presentation contains more than one ${kind} link`);
  }
  return textOrNull(matches[0]?.uri);
}

function textOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
