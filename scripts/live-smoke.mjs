import { createSchemaRegistry, assertValid } from "./lib/schema.mjs";
import {
  assertNoFindings,
  validateFeedSemantics,
  validateLaunchSemantics,
  validateManifestSemantics,
} from "./lib/semantics.mjs";
import { readBoundedBytes } from "../server/bounded-body.js";

const configuredBase = process.env.PROGRAMMABLE_API_BASE;
if (!configuredBase) {
  throw new Error(
    "PROGRAMMABLE_API_BASE is required, for example https://developers.programmable.family",
  );
}

function apiRoot(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("PROGRAMMABLE_API_BASE must be an absolute HTTPS URL");
  }
  const loopbackHttp =
    parsed.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !loopbackHttp) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !parsed.hostname
  ) {
    throw new Error(
      "PROGRAMMABLE_API_BASE must be a credential-free HTTPS origin or a local loopback URL",
    );
  }
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/" && path !== "/api/v2") {
    throw new Error("PROGRAMMABLE_API_BASE path must be / or /api/v2");
  }
  return `${parsed.origin}/api/v2`;
}

const apiBase = apiRoot(configuredBase);
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;
const registry = await createSchemaRegistry("v2");

async function boundedJson(path, schemaName) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}${path}`, {
        headers: { accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!/^application\/(?:problem\+)?json\b/i.test(contentType)) {
        throw new Error(`unexpected content-type ${contentType || "<missing>"}`);
      }
      const bytes = await readBoundedBytes(response, MAX_BYTES, `${path} response`);
      const value = JSON.parse(new TextDecoder().decode(bytes));
      assertValid(registry.validator(schemaName), value, path);
      return { response, value };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }
  throw new Error(`${path} failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`);
}

function assertRecent(value, label, maximumAgeMs) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} is not a timestamp`);
  const age = Date.now() - timestamp;
  if (age < -60_000 || age > maximumAgeMs) {
    throw new Error(`${label} is outside the allowed freshness window`);
  }
}

const statusResult = await boundedJson("/status", "status.schema.json");
assertRecent(statusResult.value.checkedAt, "status.checkedAt", 20 * 60_000);

const manifestResult = await boundedJson("/manifest", "manifest.schema.json");
assertNoFindings(
  validateManifestSemantics(manifestResult.value),
  "live manifest",
);

const feedResult = await boundedJson("/launches?limit=100", "launch-feed.schema.json");
assertNoFindings(validateFeedSemantics(feedResult.value), "live launch feed");
for (const [index, launch] of feedResult.value.items.entries()) {
  assertNoFindings(validateLaunchSemantics(launch), `live launch ${index}`);
}
if (feedResult.value.status === "ready" && feedResult.value.snapshot) {
  assertRecent(
    feedResult.value.snapshot.indexedAt,
    "launches.snapshot.indexedAt",
    30 * 60_000,
  );
}

if (feedResult.value.page.hasMore) {
  const nextCursor = encodeURIComponent(feedResult.value.page.nextCursor);
  const nextResult = await boundedJson(
    `/launches?limit=100&cursor=${nextCursor}`,
    "launch-feed.schema.json",
  );
  assertNoFindings(validateFeedSemantics(nextResult.value), "live launch page two");
  if (
    nextResult.value.page.resumeCursor !== feedResult.value.page.resumeCursor ||
    JSON.stringify(nextResult.value.snapshot) !== JSON.stringify(feedResult.value.snapshot)
  ) {
    throw new Error("page continuation changed its high-water snapshot");
  }
  const firstIds = new Set(feedResult.value.items.map((launch) => launch.launchId));
  if (nextResult.value.items.some((launch) => firstIds.has(launch.launchId))) {
    throw new Error("page continuation repeated a launch from page one");
  }
  for (const [index, launch] of nextResult.value.items.entries()) {
    assertNoFindings(validateLaunchSemantics(launch), `live launch page two item ${index}`);
  }
}

if (feedResult.value.items[0]) {
  const launch = feedResult.value.items[0];
  const detailResult = await boundedJson(
    `/launches/${launch.chainId}/${encodeURIComponent(launch.token.address)}`,
    "launch.schema.json",
  );
  if (detailResult.value.launchId !== launch.launchId) {
    throw new Error("launch detail does not match the feed record");
  }
  assertNoFindings(validateLaunchSemantics(detailResult.value), "live launch detail");
}

await boundedJson("/token-list", "token-list.schema.json");

for (const [name, result] of [
  ["status", statusResult],
  ["manifest", manifestResult],
  ["launches", feedResult],
]) {
  const cacheControl = result.response.headers.get("cache-control");
  if (!cacheControl) throw new Error(`${name} response is missing Cache-Control`);
  if (!result.response.headers.get("etag")) {
    throw new Error(`${name} response is missing ETag`);
  }
}

process.stdout.write(
  `Live smoke OK: ${apiBase}, ${feedResult.value.items.length} launch records, resume cursor ${feedResult.value.page.resumeCursor}\n`,
);
