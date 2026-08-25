import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  API_SCHEMA_VERSION,
  API_V2_SCHEMA_VERSION,
  REQUEST_LIMITS,
} from "./constants.js";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const SORT_KEY_PATTERN = /^\d{16}:\d{10}:\d{10}:(?:0x[0-9a-f]{40}|[0-9a-f]{64})$/;
const OPAQUE_CURSOR_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const CURSOR_VERSION = 2;
const MAX_CURSOR_LENGTH = 1_024;
const LOCAL_CURSOR_SIGNING_KEY =
  "programmable-local-cursor-signing-key-not-for-production";

function hasExactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function header(req, name) {
  const value = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type, If-None-Match");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "ETag, Retry-After, X-Programmable-Status, X-Request-Id",
  );
}

export function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  applyCors(res);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(204).end();
  return true;
}

export function json(req, res, statusCode, payload, options = {}) {
  const body = JSON.stringify(payload);
  const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
  const requestId = options.requestId ?? randomUUID();

  applyCors(res);
  res.setHeader(
    "Content-Type",
    options.contentType ?? "application/json; charset=utf-8",
  );
  res.setHeader("ETag", etag);
  res.setHeader("X-Request-Id", requestId);
  res.setHeader(
    "Cache-Control",
    options.cacheControl ?? "public, max-age=0, s-maxage=15, stale-while-revalidate=45",
  );
  if (options.apiStatus) {
    res.setHeader("X-Programmable-Status", options.apiStatus);
  }
  if (options.retryAfter) {
    res.setHeader("Retry-After", options.retryAfter);
  }

  if (statusCode === 200 && header(req, "if-none-match") === etag) {
    res.status(304).end();
    return;
  }

  res.status(statusCode).send(body);
}

export function error(req, res, statusCode, code, message, details) {
  const requestId = randomUUID();
  const timestamp = new Date().toISOString();
  const normalizedCode = String(code)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9.-]/g, "-")
    .slice(0, 128);
  json(
    req,
    res,
    statusCode,
    {
      schemaVersion: String(req?.url ?? "").includes("/api/v2/")
        ? API_V2_SCHEMA_VERSION
        : API_SCHEMA_VERSION,
      type: `https://developers.programmable.family/problems/${normalizedCode}`,
      title: message,
      status: statusCode,
      detail: message,
      code: normalizedCode,
      requestId,
      timestamp,
      ...(details === undefined
        ? {}
        : { extensions: { "programmable/details": details } }),
    },
    {
      cacheControl: "no-store",
      apiStatus: "error",
      contentType: "application/problem+json; charset=utf-8",
      requestId,
      retryAfter: statusCode === 429 || statusCode === 503 ? "30" : null,
    },
  );
}

export function queryValue(req, name) {
  const direct = req?.query?.[name];
  if (Array.isArray(direct)) return direct[0] ?? null;
  if (typeof direct === "string") return direct;

  try {
    const base = `https://${header(req, "host") || "api.invalid"}`;
    return new URL(req.url || "/", base).searchParams.get(name);
  } catch {
    return null;
  }
}

export function routeValue(req, name) {
  const value = req?.query?.[name];
  return Array.isArray(value) ? value[0] : value;
}

export function queryParametersAllowed(req, allowedNames) {
  const allowed = new Set(allowedNames);
  if (req?.query && typeof req.query === "object") {
    for (const [name, value] of Object.entries(req.query)) {
      if (!allowed.has(name) || Array.isArray(value)) return false;
    }
  }
  try {
    const base = `https://${header(req, "host") || "api.invalid"}`;
    const seen = new Set();
    for (const name of new URL(req.url || "/", base).searchParams.keys()) {
      if (!allowed.has(name) || seen.has(name)) return false;
      seen.add(name);
    }
  } catch {
    return false;
  }
  return true;
}

export function parseAddress(value) {
  return typeof value === "string" && ADDRESS_PATTERN.test(value)
    ? value.toLowerCase()
    : null;
}

export function parseCategory(value) {
  if (value === null || value === undefined || value === "") return null;
  return value === "classic" || value === "custom" ? value : undefined;
}

export function parseChainId(value, supportedChainId) {
  if (value === null || value === undefined || value === "") {
    return supportedChainId;
  }
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed === supportedChainId
    ? parsed
    : null;
}

export function parseEvmChainId(value) {
  if (value === null || value === undefined || value === "") return null;
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseLimit(value) {
  if (value === null || value === undefined || value === "") {
    return REQUEST_LIMITS.defaultPageSize;
  }
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > REQUEST_LIMITS.maximumPageSize
  ) {
    return null;
  }
  return parsed;
}

function validScope(value) {
  return value === "all" || value === "classic" || value === "custom" ||
    /^v2:(?:all|classic|custom):(?:all|[1-9]\d*)$/.test(value);
}

function cursorSigningKey() {
  const configured = process.env.PROGRAMMABLE_CURSOR_SIGNING_KEY;
  if (
    typeof configured === "string" &&
    Buffer.byteLength(configured, "utf8") >= 32 &&
    Buffer.byteLength(configured, "utf8") <= 1_024
  ) {
    return Buffer.from(configured, "utf8");
  }
  if (
    process.env.NODE_ENV === "test" ||
    process.env.NODE_TEST_CONTEXT ||
    process.execArgv.includes("--test")
  ) {
    return Buffer.from(LOCAL_CURSOR_SIGNING_KEY, "utf8");
  }
  return null;
}

function cursorSignature(payload, key) {
  return createHmac("sha256", key).update(payload, "utf8").digest("base64url");
}

function encodeOpaqueCursor(payload) {
  const key = cursorSigningKey();
  if (!key) throw new Error("production cursor signing key is unavailable");
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const encoded = `${body}.${cursorSignature(body, key)}`;
  if (encoded.length > MAX_CURSOR_LENGTH) {
    throw new Error("cursor payload exceeds the public cursor limit");
  }
  return encoded;
}

function decodeOpaqueCursor(value) {
  if (value === null || value === undefined || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > MAX_CURSOR_LENGTH ||
    !OPAQUE_CURSOR_PATTERN.test(value)
  ) {
    return undefined;
  }
  try {
    const key = cursorSigningKey();
    if (!key) return undefined;
    const [body, suppliedSignature] = value.split(".");
    const bytes = Buffer.from(body, "base64url");
    if (bytes.toString("base64url") !== body) return undefined;
    const expected = Buffer.from(cursorSignature(body, key), "base64url");
    const supplied = Buffer.from(suppliedSignature, "base64url");
    if (
      supplied.toString("base64url") !== suppliedSignature ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return undefined;
    }
    const decoded = bytes.toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function validSnapshot(snapshot) {
  if (snapshot === null) return true;
  const legacyKeys = ["blockHash", "blockNumber", "finality", "indexedAt"];
  const registryAwareKeys = [
    "blockHash",
    "blockNumber",
    "customRegistryHighWaterGeneration",
    "finality",
    "indexedAt",
  ];
  return Boolean(
    (hasExactKeys(snapshot, legacyKeys) || hasExactKeys(snapshot, registryAwareKeys)) &&
      typeof snapshot.blockNumber === "string" &&
      snapshot.blockNumber.length <= 78 &&
      /^(0|[1-9]\d*)$/.test(snapshot.blockNumber) &&
      /^0x[0-9a-fA-F]{64}$/.test(snapshot.blockHash) &&
      typeof snapshot.indexedAt === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(
        snapshot.indexedAt,
      ) &&
      Number.isFinite(Date.parse(snapshot.indexedAt)) &&
      ["observed", "confirmed", "finalized"].includes(snapshot.finality) &&
      (!Object.hasOwn(snapshot, "customRegistryHighWaterGeneration") ||
        validRegistryGeneration(snapshot.customRegistryHighWaterGeneration)),
  );
}

function validRegistryGeneration(value) {
  return value === null || (
    typeof value === "string" &&
    value.length <= 78 &&
    /^(0|[1-9]\d*)$/.test(value)
  );
}

export function cursorScope(category) {
  return category ?? "all";
}

export function cursorScopeV2(category, chainId = null) {
  return `v2:${category ?? "all"}:${chainId ?? "all"}`;
}

export function encodeResumeCursor(
  highWater,
  scope = "all",
  registryHighWaterGeneration = scope === "classic" ? null : "0",
) {
  if (
    !SORT_KEY_PATTERN.test(highWater) ||
    !validScope(scope) ||
    !validRegistryGeneration(registryHighWaterGeneration)
  ) {
    throw new Error("invalid resume cursor components");
  }
  return encodeOpaqueCursor({
    v: CURSOR_VERSION,
    t: "r",
    h: highWater,
    c: scope,
    g: registryHighWaterGeneration,
  });
}

export function decodeResumeCursor(value) {
  const parsed = decodeOpaqueCursor(value);
  if (parsed === null || parsed === undefined) return parsed;
  if (
    !hasExactKeys(parsed, ["c", "g", "h", "t", "v"]) ||
    parsed.v !== CURSOR_VERSION ||
    parsed.t !== "r" ||
    !SORT_KEY_PATTERN.test(parsed.h) ||
    !validScope(parsed.c) ||
    !validRegistryGeneration(parsed.g) ||
    (parsed.c === "classic" ? parsed.g !== null : parsed.g === null)
  ) {
    return undefined;
  }
  return {
    highWater: parsed.h,
    scope: parsed.c,
    registryHighWaterGeneration: parsed.g,
  };
}

export function encodePageCursor(
  highWater,
  position,
  scope,
  snapshot,
  after = null,
  registryHighWaterGeneration = scope === "classic" ? null : "0",
  afterRegistryHighWaterGeneration = scope === "classic" ? null : "0",
) {
  if (
    !SORT_KEY_PATTERN.test(highWater) ||
    !SORT_KEY_PATTERN.test(position) ||
    !validScope(scope) ||
    !validSnapshot(snapshot) ||
    !validRegistryGeneration(registryHighWaterGeneration) ||
    !validRegistryGeneration(afterRegistryHighWaterGeneration) ||
    (scope === "classic"
      ? registryHighWaterGeneration !== null || afterRegistryHighWaterGeneration !== null
      : registryHighWaterGeneration === null || afterRegistryHighWaterGeneration === null) ||
    (registryHighWaterGeneration !== null &&
      afterRegistryHighWaterGeneration !== null &&
      BigInt(registryHighWaterGeneration) < BigInt(afterRegistryHighWaterGeneration)) ||
    (after !== null && !SORT_KEY_PATTERN.test(after)) ||
    (after !== null && position <= after)
  ) {
    throw new Error("invalid page cursor components");
  }
  return encodeOpaqueCursor({
    v: CURSOR_VERSION,
    t: "p",
    h: highWater,
    p: position,
    c: scope,
    s: snapshot,
    a: after,
    g: registryHighWaterGeneration,
    ag: afterRegistryHighWaterGeneration,
  });
}

export function decodePageCursor(value) {
  const parsed = decodeOpaqueCursor(value);
  if (parsed === null || parsed === undefined) return parsed;
  if (
    !hasExactKeys(parsed, ["a", "ag", "c", "g", "h", "p", "s", "t", "v"]) ||
    parsed.v !== CURSOR_VERSION ||
    parsed.t !== "p" ||
    !SORT_KEY_PATTERN.test(parsed.h) ||
    !SORT_KEY_PATTERN.test(parsed.p) ||
    parsed.h < parsed.p ||
    !validScope(parsed.c) ||
    !validSnapshot(parsed.s) ||
    !validRegistryGeneration(parsed.g) ||
    !validRegistryGeneration(parsed.ag) ||
    (parsed.c === "classic"
      ? parsed.g !== null || parsed.ag !== null
      : parsed.g === null || parsed.ag === null) ||
    (parsed.g !== null && parsed.ag !== null && BigInt(parsed.g) < BigInt(parsed.ag)) ||
    (parsed.a !== null && !SORT_KEY_PATTERN.test(parsed.a)) ||
    (parsed.a !== null && parsed.p <= parsed.a)
  ) {
    return undefined;
  }
  return {
    highWater: parsed.h,
    position: parsed.p,
    scope: parsed.c,
    snapshot: parsed.s,
    after: parsed.a,
    registryHighWaterGeneration: parsed.g,
    afterRegistryHighWaterGeneration: parsed.ag,
  };
}

// Kept as the compact public helper for durable high-water cursors.
export function encodeCursor(sortKey) {
  return encodeResumeCursor(sortKey);
}

export function decodeCursor(value) {
  const decoded = decodeResumeCursor(value);
  if (decoded === null || decoded === undefined) return decoded;
  return decoded.highWater;
}

export function paginate(records, { limit, cursor }) {
  // The cursor is an exclusive ordering boundary, not a database row pointer.
  // Serverless requests can legitimately observe different dataset subsets
  // when an upstream provider is temporarily unavailable. Requiring the
  // boundary record to still exist would make otherwise valid cursors fail.
  const eligible = cursor
    ? records.filter((record) => record.sortKey < cursor)
    : records;
  const selected = eligible.slice(0, limit);
  const hasMore = selected.length < eligible.length;
  return {
    selected,
    pagination: {
      limit,
      hasMore,
      nextPosition:
        hasMore && selected.length > 0
          ? selected[selected.length - 1].sortKey
          : null,
    },
  };
}

export function recordsAfter(records, after) {
  if (!after) return records;
  return records.filter((record) => record.sortKey > after);
}
