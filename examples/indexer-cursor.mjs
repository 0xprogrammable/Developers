#!/usr/bin/env node

import { readFile, rename, writeFile } from "node:fs/promises";
import {
  advertisedDeploymentAddresses,
  checkpointCursor,
  fetchJson,
  formatSourceWarning,
  launchIdentity,
  launchRecords,
  nextCursor,
  sourceState,
} from "./lib/programmable-client.mjs";

const checkpointPath = process.env.PROGRAMMABLE_CURSOR_FILE || null;
const chainId = positiveInteger(process.env.PROGRAMMABLE_CHAIN_ID, 1);
const manifest = await fetchJson(`/api/v2/manifests/${chainId}`);
if (manifest.chainId !== chainId || manifest.caip2 !== `eip155:${chainId}`) {
  throw new Error("The manifest does not match PROGRAMMABLE_CHAIN_ID");
}
const checkpoint = await readCheckpoint(checkpointPath);
if (checkpoint.chainId !== null && checkpoint.chainId !== chainId) {
  throw new Error("The saved cursor belongs to a different chain");
}
const limit = process.env.PROGRAMMABLE_PAGE_SIZE || 100;
const maximumPages = positiveInteger(process.env.PROGRAMMABLE_MAX_PAGES, 1_000);
const traversedCursors = new Set();
let request = { after: checkpoint.cursor, chainId, limit };
let resumableCursor = null;
let schemaVersion = null;
let sourceWasSafe = true;
let pageCount = 0;
let recordCount = 0;

for (;;) {
  if (pageCount >= maximumPages) {
    throw new Error(`Stopped after ${maximumPages} pages without reaching the poll boundary`);
  }

  const feed = await fetchJson("/api/v2/launches", request);
  pageCount += 1;
  schemaVersion ??= feed.schemaVersion ?? null;

  const state = sourceState(feed);
  sourceWasSafe &&= state.safeToCheckpoint;
  const warning = formatSourceWarning(feed);
  if (warning) console.warn(`Warning: ${warning}`);

  const pageResumeCursor = checkpointCursor(feed);
  if (resumableCursor && pageResumeCursor && resumableCursor !== pageResumeCursor) {
    throw new Error("The resume cursor changed during one page traversal");
  }
  resumableCursor ??= pageResumeCursor;

  for (const launch of launchRecords(feed)) {
    const identity = launchIdentity(launch);
    recordCount += 1;

    // Persist the full record in a real indexer. Unknown optional fields are part
    // of the raw payload and can become useful without a client release. Upsert
    // by chain ID plus launchId so retries and finality changes are safe without
    // colliding with the same opaque launch ID on another chain. Reconcile
    // non-final records against later snapshots instead of assuming a complete
    // tombstone stream.
    const storageKey = `${identity.chainId}:${identity.launchId}`;
    console.log(
      JSON.stringify({
        operation: "upsert",
        key: storageKey,
        launchId: identity.launchId,
        projectId: identity.projectId,
        chainId: identity.chainId,
        tokenAddress: identity.token.address,
        assetCount: identity.assets.length,
        record: launch,
      }),
    );
  }

  const followingCursor = nextCursor(feed);
  const hasMore = feed?.page?.hasMore === true;
  if (!hasMore) {
    if (followingCursor) {
      throw new Error("Feed returned nextCursor while page.hasMore was false");
    }
    break;
  }
  if (!followingCursor) {
    throw new Error("Feed omitted nextCursor while page.hasMore was true");
  }
  if (traversedCursors.has(followingCursor)) {
    throw new Error("Feed repeated a page cursor during one traversal");
  }
  traversedCursors.add(followingCursor);
  request = { chainId, cursor: followingCursor, limit };
}

if (resumableCursor && sourceWasSafe) {
  await writeCheckpoint(checkpointPath, {
    chainId,
    cursor: resumableCursor,
    schemaVersion,
    savedAt: new Date().toISOString(),
  });
} else if (resumableCursor) {
  console.warn("Cursor was not advanced because the source is stale, degraded, or unknown.");
} else {
  console.warn("Cursor was not advanced because the completed poll had no resume cursor.");
}

console.error(
  JSON.stringify({
    pages: pageCount,
    records: recordCount,
    resumeCursor: resumableCursor,
    cursorPersisted: Boolean(resumableCursor && sourceWasSafe && checkpointPath),
    deploymentsDiscoveredFromManifest: advertisedDeploymentAddresses(manifest).size,
  }),
);

async function readCheckpoint(path) {
  if (!path) {
    return {
      chainId: null,
      cursor: process.env.PROGRAMMABLE_CURSOR || null,
    };
  }

  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return {
      chainId: Number.isSafeInteger(parsed.chainId) ? parsed.chainId : null,
      cursor: typeof parsed.cursor === "string" && parsed.cursor ? parsed.cursor : null,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { chainId: null, cursor: null };
    throw error;
  }
}

async function writeCheckpoint(path, value) {
  if (!path) {
    console.error(`Set PROGRAMMABLE_CURSOR_FILE to persist cursor ${value.cursor}`);
    return;
  }

  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
