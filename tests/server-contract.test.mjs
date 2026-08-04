import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import {
  createLaunchesHandler,
  launchFeedPayload,
} from "../api/v1/launches.js";
import { createLaunchDetailHandler } from "../api/v1/launches/[chainId]/[tokenAddress].js";
import { tokenListPayload } from "../api/v1/token-list.js";
import {
  LAUNCH_DISCOVERY_FILTER,
  RELEASE_BY_ID,
} from "../server/constants.js";
import {
  developerManifest,
  isDatasetPublishable,
  serviceStatus,
} from "../server/dataset.js";
import {
  decodeCursor,
  decodePageCursor,
  decodeResumeCursor,
  encodeCursor,
  encodePageCursor,
  encodeResumeCursor,
  paginate,
  recordsAfter,
} from "../server/http.js";
import {
  compareLaunchesDescending,
  normalizeGapLaunch,
  normalizeLegacyToken,
  publicLaunch,
} from "../server/normalize.js";
import { createSchemaRegistry, assertValid } from "../scripts/lib/schema.mjs";
import { provenanceManifestMatch } from "../examples/lib/programmable-client.mjs";

function record(block, transaction, log, addressByte) {
  const sortKey = `${String(block).padStart(16, "0")}:${String(transaction).padStart(10, "0")}:${String(log).padStart(10, "0")}:0x${addressByte.repeat(40)}`;
  return { sortKey, id: `${block}:${transaction}:${log}`, launch: {} };
}

function dataset(records, block, hashByte, generatedAt) {
  return {
    records,
    status: {
      status: "ready",
      generatedAt,
      coverage: {
        status: "complete",
        checkpoint: {
          blockNumber: block,
          blockHash: `0x${hashByte.repeat(64)}`,
          finality: "confirmed",
        },
      },
    },
  };
}

function mockResponse() {
  return {
    headers: new Map(),
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), String(value));
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

async function callHandler(handler, query = {}) {
  const response = mockResponse();
  await handler(
    { method: "GET", query, headers: {}, url: "/api/v1/launches" },
    response,
  );
  return {
    status: response.statusCode,
    body: response.body ? JSON.parse(response.body) : null,
  };
}

describe("server cursor contract", () => {
  test("round-trips only opaque valid cursors", () => {
    const key = record(100, 2, 7, "a").sortKey;
    const encoded = encodeCursor(key);
    assert.equal(decodeCursor(encoded), key);
    assert.equal(decodeCursor("not-a-cursor"), undefined);
    const replacement = encoded.endsWith("A") ? "B" : "A";
    assert.equal(decodeCursor(`${encoded.slice(0, -1)}${replacement}`), undefined);
    assert.equal(
      decodeResumeCursor(
        Buffer.from(
          JSON.stringify({ v: 1, t: "r", h: key, c: "all", extra: true }),
        ).toString("base64url"),
      ),
      undefined,
    );
  });

  test("paginates without gaps or duplicates", () => {
    const records = [record(103, 0, 0, "d"), record(102, 0, 0, "c"), record(101, 0, 0, "b")];
    const first = paginate(records, { limit: 2, cursor: null });
    assert.deepEqual(first.selected.map((item) => item.id), ["103:0:0", "102:0:0"]);
    assert.equal(first.pagination.hasMore, true);
    const second = paginate(records, {
      limit: 2,
      cursor: first.pagination.nextPosition,
    });
    assert.deepEqual(second.selected.map((item) => item.id), ["101:0:0"]);
    assert.equal(second.pagination.hasMore, false);
    assert.equal(second.pagination.nextPosition, null);
  });

  test("rejects cache-busting or repeated query parameters before loading data", async () => {
    let loads = 0;
    const handler = createLaunchesHandler(async () => {
      loads += 1;
      return dataset([], 1, "1", "2026-08-04T08:00:00.000Z");
    });
    const unknown = await callHandler(handler, { nonce: "cache-bust" });
    assert.equal(unknown.status, 400);
    const repeated = await callHandler(handler, { limit: ["1", "2"] });
    assert.equal(repeated.status, 400);
    assert.equal(loads, 0);
  });

  test("treats a missing anchor record as an exclusive sort boundary", () => {
    const original = [
      record(105, 0, 0, "e"),
      record(104, 0, 0, "d"),
      record(103, 0, 0, "c"),
      record(102, 0, 0, "b"),
    ];
    const first = paginate(original, { limit: 2, cursor: null });
    const withoutAnchor = [original[0], original[2], original[3]];
    const second = paginate(withoutAnchor, {
      limit: 2,
      cursor: first.pagination.nextPosition,
    });
    assert.deepEqual(second.selected.map((item) => item.id), ["103:0:0", "102:0:0"]);
    assert.equal(second.pagination.hasMore, false);
  });

  test("after semantics return only records newer than the durable checkpoint", () => {
    const records = [record(103, 0, 0, "d"), record(102, 0, 0, "c"), record(101, 0, 0, "b")];
    assert.deepEqual(
      recordsAfter(records, records[1].sortKey).map((item) => item.id),
      ["103:0:0"],
    );
  });

  test("keeps the page-one high-water across a concurrent insert", () => {
    const original = [
      record(103, 0, 0, "d"),
      record(102, 0, 0, "c"),
      record(101, 0, 0, "b"),
    ];
    const highWater = original[0].sortKey;
    const snapshot = {
      blockNumber: "103",
      blockHash: `0x${"d".repeat(64)}`,
      indexedAt: "2026-08-04T08:00:00.000Z",
      finality: "confirmed",
    };
    const first = paginate(original, { limit: 2, cursor: null });
    const pageCursor = encodePageCursor(
      highWater,
      first.selected.at(-1).sortKey,
      "all",
      snapshot,
    );

    const inserted = record(104, 0, 0, "e");
    const changed = [inserted, ...original];
    const decodedPage = decodePageCursor(pageCursor);
    assert.equal(decodedPage.highWater, highWater);
    assert.deepEqual(decodedPage.snapshot, snapshot);

    const frozenView = changed.filter(
      (item) => item.sortKey <= decodedPage.highWater,
    );
    const second = paginate(frozenView, {
      limit: 2,
      cursor: decodedPage.position,
    });
    assert.deepEqual(second.selected.map((item) => item.id), ["101:0:0"]);

    const resumeCursor = encodeResumeCursor(decodedPage.highWater, "all");
    const decodedResume = decodeResumeCursor(resumeCursor);
    assert.deepEqual(
      recordsAfter(changed, decodedResume.highWater).map((item) => item.id),
      ["104:0:0"],
    );
  });

  test("freezes the real feed traversal across an insert and exposes the insert through after", () => {
    const original = [
      record(103, 0, 0, "d"),
      record(102, 0, 0, "c"),
      record(101, 0, 0, "b"),
    ];
    const firstDataset = dataset(
      original,
      103,
      "d",
      "2026-08-04T08:00:00.000Z",
    );
    const first = launchFeedPayload(firstDataset, {
      limit: 2,
    });
    assert.deepEqual(first.items.map((item) => item.id), ["103:0:0", "102:0:0"]);
    assert.equal(first.page.hasMore, true);
    assert.equal(first.snapshot.cursor, first.page.resumeCursor);

    const inserted = record(104, 0, 0, "e");
    const changedDataset = dataset(
      [inserted, ...original],
      104,
      "e",
      "2026-08-04T08:00:12.000Z",
    );
    const second = launchFeedPayload(changedDataset, {
      limit: 2,
      cursor: decodePageCursor(first.page.nextCursor),
    });
    assert.deepEqual(second.items.map((item) => item.id), ["101:0:0"]);
    assert.equal(second.page.resumeCursor, first.page.resumeCursor);
    assert.deepEqual(second.snapshot, first.snapshot);

    const polled = launchFeedPayload(changedDataset, {
      limit: 2,
      after: decodeResumeCursor(first.page.resumeCursor),
    });
    assert.deepEqual(polled.items.map((item) => item.id), ["104:0:0"]);
    assert.notEqual(polled.page.resumeCursor, first.page.resumeCursor);
    assert.equal(polled.snapshot.cursor, polled.page.resumeCursor);
  });

  test("traverses changing serverless dataset supersets and subsets without duplicates or cursor errors", () => {
    const records = Object.fromEntries(
      [110, 109, 108, 107, 106, 105, 104].map((block, index) => [
        block,
        record(block, 0, 0, (9 - index).toString(16)),
      ]),
    );
    const datasets = [
      [110, 109, 108, 107, 106, 105],
      [110, 108, 107, 105],
      [110, 109, 108, 107, 106, 105, 104],
      [110, 108, 106, 104],
    ].map((blocks, index) =>
      dataset(
        blocks.map((block) => records[block]),
        110 + index,
        (index + 1).toString(16),
        `2026-08-04T08:00:${String(index).padStart(2, "0")}.000Z`,
      ),
    );

    let cursor = null;
    let resumeCursor = null;
    const received = [];
    for (const current of datasets) {
      const page = launchFeedPayload(current, {
        limit: 2,
        cursor,
      });
      received.push(...page.items.map((item) => item.id));
      resumeCursor ??= page.page.resumeCursor;
      assert.equal(page.page.resumeCursor, resumeCursor);
      cursor = decodePageCursor(page.page.nextCursor);
    }

    assert.deepEqual(received, [
      "110:0:0",
      "109:0:0",
      "108:0:0",
      "107:0:0",
      "106:0:0",
      "105:0:0",
      "104:0:0",
    ]);
    assert.equal(new Set(received).size, received.length);
    assert.equal(cursor, null);
  });

  test("never moves a polling checkpoint backwards during a temporary source rollback", () => {
    const previouslySeen = record(103, 0, 0, "d").sortKey;
    const rolledBackDataset = dataset(
      [record(102, 0, 0, "c")],
      102,
      "c",
      "2026-08-04T08:00:12.000Z",
    );
    const payload = launchFeedPayload(rolledBackDataset, {
      limit: 2,
      after: decodeResumeCursor(encodeResumeCursor(previouslySeen, "all")),
    });
    assert.deepEqual(payload.items, []);
    assert.equal(
      decodeResumeCursor(payload.page.resumeCursor).highWater,
      previouslySeen,
    );
  });

  test("returns 503 instead of publishing an incomplete dataset between pages", async () => {
    const records = [
      record(103, 0, 0, "d"),
      record(102, 0, 0, "c"),
      record(101, 0, 0, "b"),
    ];
    const complete = dataset(
      records,
      103,
      "d",
      "2026-08-04T08:00:00.000Z",
    );
    const incomplete = dataset(
      records.slice(1),
      102,
      "c",
      "2026-08-04T08:00:12.000Z",
    );
    incomplete.status.status = "partial";
    incomplete.status.coverage.status = "partial";

    const sequence = [complete, incomplete, complete];
    const handler = createLaunchesHandler(async () => sequence.shift());
    const first = await callHandler(handler, { limit: "2" });
    assert.equal(first.status, 200);
    assert.ok(first.body.page.nextCursor);

    const unavailable = await callHandler(handler, {
      limit: "2",
      cursor: first.body.page.nextCursor,
    });
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.body.code, "index-coverage-incomplete");

    const retried = await callHandler(handler, {
      limit: "2",
      cursor: first.body.page.nextCursor,
    });
    assert.equal(retried.status, 200);
    assert.deepEqual(retried.body.items.map((item) => item.id), ["101:0:0"]);
    assert.equal(retried.body.page.resumeCursor, first.body.page.resumeCursor);
  });

  test("returns 200 when a publishable serverless subset no longer contains the page anchor", async () => {
    const records = [
      record(105, 0, 0, "e"),
      record(104, 0, 0, "d"),
      record(103, 0, 0, "c"),
      record(102, 0, 0, "b"),
    ];
    const sequence = [
      dataset(records, 105, "e", "2026-08-04T08:00:00.000Z"),
      dataset(
        [records[0], records[2], records[3]],
        105,
        "e",
        "2026-08-04T08:00:05.000Z",
      ),
    ];
    const handler = createLaunchesHandler(async () => sequence.shift());

    const first = await callHandler(handler, { limit: "2" });
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.items.map((item) => item.id), ["105:0:0", "104:0:0"]);

    const second = await callHandler(handler, {
      limit: "2",
      cursor: first.body.page.nextCursor,
    });
    assert.equal(second.status, 200);
    assert.deepEqual(second.body.items.map((item) => item.id), ["103:0:0", "102:0:0"]);
    assert.equal(second.body.page.resumeCursor, first.body.page.resumeCursor);
    assert.equal(second.body.page.hasMore, false);
    const received = [...first.body.items, ...second.body.items].map((item) => item.id);
    assert.equal(new Set(received).size, received.length);
  });

  test("local HTTP E2E keeps a cursor valid when the next invocation loses its anchor", async (context) => {
    const records = [
      record(205, 0, 0, "e"),
      record(204, 0, 0, "d"),
      record(203, 0, 0, "c"),
      record(202, 0, 0, "b"),
    ];
    const sequence = [
      dataset(records, 205, "e", "2026-08-04T08:01:00.000Z"),
      dataset(
        [records[0], records[2], records[3]],
        205,
        "e",
        "2026-08-04T08:01:05.000Z",
      ),
    ];
    const handler = createLaunchesHandler(async () => sequence.shift());
    const server = createServer((request, response) => {
      response.status = (statusCode) => {
        response.statusCode = statusCode;
        return response;
      };
      response.send = (body) => {
        response.end(body);
        return response;
      };
      handler(request, response).catch((error) => {
        response.statusCode = 500;
        response.end(String(error));
      });
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    context.after(
      () => new Promise((resolve) => server.close(resolve)),
    );
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/launches`;

    const firstResponse = await fetch(`${baseUrl}?limit=2`);
    assert.equal(firstResponse.status, 200);
    const first = await firstResponse.json();
    const secondResponse = await fetch(
      `${baseUrl}?limit=2&cursor=${encodeURIComponent(first.page.nextCursor)}`,
    );
    assert.equal(secondResponse.status, 200);
    const second = await secondResponse.json();
    assert.deepEqual(second.items.map((item) => item.id), ["203:0:0", "202:0:0"]);
    assert.equal(second.page.resumeCursor, first.page.resumeCursor);
    assert.equal(second.page.hasMore, false);
    const received = [...first.items, ...second.items].map((item) => item.id);
    assert.equal(new Set(received).size, received.length);
  });

  test("orders block, transaction, and log position descending", () => {
    const launches = [
      { launch: { blockNumber: 100, transactionIndex: 0, logIndex: 1 }, token: { address: `0x${"1".repeat(40)}` } },
      { launch: { blockNumber: 101, transactionIndex: 0, logIndex: 0 }, token: { address: `0x${"2".repeat(40)}` } },
      { launch: { blockNumber: 100, transactionIndex: 1, logIndex: 0 }, token: { address: `0x${"3".repeat(40)}` } },
    ];
    launches.sort(compareLaunchesDescending);
    assert.deepEqual(
      launches.map((item) => [item.launch.blockNumber, item.launch.transactionIndex, item.launch.logIndex]),
      [[101, 0, 0], [100, 1, 0], [100, 0, 1]],
    );
  });
});

describe("server normalization contract", () => {
  test("normalizes a legacy record to the strict public launch schema without executable payloads", async () => {
    const poolId = `0x${"c".repeat(64)}`;
    const legacy = {
      schemaVersion: "programmable-token-v1",
      chainId: 1,
      address: "0x1111111111111111111111111111111111111111",
      name: "Legacy Fixture",
      symbol: "LEGACY",
      decimals: 18,
      totalSupplyRaw: "1000000000000000000000",
      description: "Legacy metadata",
      imageUrl: "https://developers.programmable.family/fixture.png",
      links: { website: "https://developers.programmable.family" },
      canonicalPool: {
        poolId,
        hookAddress: "0x35Fe236EA82F7cF525c9719d7df8F49F94D720CC",
        quoteAssetAddress: null,
      },
      fees: {
        buyHookFeeBps: 100,
        sellHookFeeBps: 100,
        creatorFeeBps: 90,
        launcherFeeBps: 10,
        transferTaxBps: 0,
        lpFeePips: 0,
      },
      launch: {
        modelId: "classic",
        modelVersion: "classic-v3",
        creatorAddress: "0x7777777777777777777777777777777777777777",
        transactionHash: `0x${"a".repeat(64)}`,
        blockNumber: "25650000",
        launchedAt: "2026-08-04T08:00:00.000Z",
      },
    };
    const normalized = normalizeLegacyToken(legacy);
    assert.ok(normalized);
    const publicRecord = publicLaunch(normalized);
    const registry = await createSchemaRegistry();
    assertValid(registry.validator("launch.schema.json"), publicRecord, "normalized legacy launch");
    assert.equal("sortKey" in publicRecord, false);
    assert.equal("transactionIndex" in publicRecord.launch, false);
    assert.equal(publicRecord.token.identityStatus, "complete");
    assert.equal(publicRecord.token.supplyStatus, "observed");
    assert.equal(publicRecord.token.metadata.trustStatus, "creator-declared");
    assert.equal(publicRecord.verification.provenanceStatus, "partial");
    assert.equal(publicRecord.markets[0].support.execution, "unavailable");
    assert.equal(publicRecord.markets[0].adapter, null);
  });

  test("keeps a recognized launch discoverable when ERC-20 metadata is unavailable", async () => {
    const release = RELEASE_BY_ID.get("classic-v3");
    const normalized = normalizeGapLaunch(
      {
        release,
        creatorAddress: "0x7777777777777777777777777777777777777777",
        tokenAddress: "0x1212121212121212121212121212121212121212",
        poolId: `0x${"c".repeat(64)}`,
        hookAddress: release.hook,
        quoteAssetAddress: null,
        rewardVault: null,
        positionRecipient: null,
        positionTokenId: null,
        launchHash: null,
        fallbackFees: {
          currency: "ETH",
          currencyAddress: null,
          buyTotalFeeBps: 100,
          sellTotalFeeBps: 100,
        },
        blockNumber: 25_650_020,
        blockHash: `0x${"b".repeat(64)}`,
        transactionHash: `0x${"a".repeat(64)}`,
        transactionIndex: 1,
        logIndex: 4,
      },
      { name: null, symbol: null, decimals: null, totalSupplyRaw: null },
      {
        blockNumber: 25_650_020,
        blockHash: `0x${"b".repeat(64)}`,
        timestamp: 1_775_560_800,
      },
    );
    const publicRecord = publicLaunch(normalized);
    const registry = await createSchemaRegistry();
    assertValid(registry.validator("launch.schema.json"), publicRecord, "partial identity launch");
    assert.equal(publicRecord.token.identityStatus, "partial");
    assert.equal(publicRecord.token.name, null);
    assert.equal(publicRecord.token.supplyStatus, "unavailable");
    assert.equal(publicRecord.verification.provenanceStatus, "verified");
  });

  test("keeps complete identity with unavailable supply and block timestamp", async () => {
    const release = RELEASE_BY_ID.get("classic-v3");
    const normalized = normalizeGapLaunch(
      {
        release,
        creatorAddress: "0x7777777777777777777777777777777777777777",
        tokenAddress: "0x3434343434343434343434343434343434343434",
        poolId: `0x${"c".repeat(64)}`,
        hookAddress: release.hook,
        quoteAssetAddress: null,
        rewardVault: null,
        positionRecipient: null,
        positionTokenId: null,
        launchHash: null,
        fallbackFees: {
          currency: "ETH",
          currencyAddress: null,
          buyTotalFeeBps: 100,
          sellTotalFeeBps: 100,
        },
        blockNumber: 25_650_021,
        blockHash: `0x${"b".repeat(64)}`,
        transactionHash: `0x${"a".repeat(64)}`,
        transactionIndex: 1,
        logIndex: 5,
        blockTimestamp: null,
      },
      { name: "No Supply", symbol: "NOSUP", decimals: 18, totalSupplyRaw: null },
      { blockHash: `0x${"b".repeat(64)}`, timestamp: null },
    );
    const publicRecord = publicLaunch(normalized);
    const registry = await createSchemaRegistry();
    assertValid(registry.validator("launch.schema.json"), publicRecord, "missing enrichment fields");
    assert.equal(publicRecord.token.identityStatus, "complete");
    assert.equal(publicRecord.token.supplyStatus, "unavailable");
    assert.equal(publicRecord.token.supplyAsOfBlock, null);
    assert.equal(publicRecord.launch.timestamp, null);
    assert.equal(publicRecord.verification.provenanceStatus, "verified");
  });

  test("strips bidi controls and rejects non-HTTPS creator metadata", () => {
    const normalized = normalizeLegacyToken({
      chainId: 1,
      address: "0x1111111111111111111111111111111111111111",
      name: "Safe\u202EName",
      symbol: "TOK\u200BEN",
      decimals: 18,
      description: "Visible\u2066 metadata",
      imageUrl: "http://example.com/token.png",
      links: {
        website: "http://example.com",
        github: "https://github.com/example/project",
      },
      launch: {
        modelId: "classic",
        modelVersion: "classic-v3",
        transactionHash: `0x${"a".repeat(64)}`,
        blockNumber: "25650000",
        launchedAt: "2026-08-04T08:00:00.000Z",
      },
    });
    assert.equal(normalized.token.name, "SafeName");
    assert.equal(normalized.token.symbol, "TOKEN");
    assert.equal(normalized.token.metadata.description, "Visible metadata");
    assert.equal(normalized.token.metadata.imageUrl, null);
    assert.equal(normalized.token.metadata.links.website, undefined);
    assert.equal(
      normalized.token.metadata.links.github,
      "https://github.com/example/project",
    );
  });
});

describe("server projections", () => {
  test("publishes complete event coverage even when enrichment is degraded", () => {
    const degraded = dataset([], 100, "a", "2026-08-04T08:00:00.000Z");
    degraded.status.status = "degraded-enrichment";
    degraded.status.coverage.enrichment = {
      status: "degraded",
      diagnostics: 1,
    };
    assert.equal(isDatasetPublishable(degraded), true);
    const status = serviceStatus(degraded.status);
    assert.equal(status.feeds.launches, "degraded");
    assert.equal(status.feeds.tokenList, "degraded");

    const unavailable = structuredClone(degraded);
    unavailable.status.status = "partial";
    unavailable.status.coverage.status = "partial";
    assert.equal(isDatasetPublishable(unavailable), false);
    const unavailableStatus = serviceStatus(unavailable.status);
    assert.equal(unavailableStatus.feeds.launches, "unavailable");
    assert.equal(unavailableStatus.feeds.tokenList, "unavailable");
    assert.equal(unavailableStatus.service, "degraded");
  });

  test("keeps Classic v1 in the recognized onchain discovery surface", () => {
    const classicV1 = RELEASE_BY_ID.get("classic-v1");
    assert.equal(
      classicV1.launcher,
      "0x51d702731db281EE223904A4663E05BfCA26C775",
    );
    assert.equal(classicV1.startBlock, 25_622_048);
    assert.ok(LAUNCH_DISCOVERY_FILTER.addresses.includes(classicV1.launcher));
    assert.ok(LAUNCH_DISCOVERY_FILTER.topics.includes(classicV1.launchTopic));
  });

  test("serves the canonical deployment manifest without dynamic divergence", async () => {
    const canonical = JSON.parse(
      await readFile(
        new URL("../deployments/ethereum.json", import.meta.url),
        "utf8",
      ),
    );
    assert.deepEqual(await developerManifest(), canonical);
    assert.deepEqual(await developerManifest(), canonical);
  });

  test("matches normalized source IDs to the canonical deployment manifest", async () => {
    const manifest = await developerManifest();
    const normalized = normalizeLegacyToken({
      chainId: 1,
      address: "0x1111111111111111111111111111111111111111",
      name: "Manifest Match",
      symbol: "MATCH",
      decimals: 18,
      canonicalPool: {
        poolId: `0x${"c".repeat(64)}`,
        hookAddress: RELEASE_BY_ID.get("classic-v3").hook,
        quoteAssetAddress: null,
      },
      launch: {
        modelId: "classic",
        modelVersion: "classic-v3",
        transactionHash: `0x${"a".repeat(64)}`,
        blockNumber: "25650000",
        launchedAt: "2026-08-04T08:00:00.000Z",
      },
    });
    const match = provenanceManifestMatch(manifest, normalized.verification);
    assert.equal(normalized.verification.sourceId, "ethereum-classic-v3");
    assert.equal(normalized.launch.modelVersion, "3");
    assert.equal(match.sourceIdMatched, true);
    assert.equal(match.matched, true);
  });

  test("includes only finalized launches with complete identity in the token list", async () => {
    const source = {
      chainId: 1,
      address: "0x1111111111111111111111111111111111111111",
      name: "Final Token",
      symbol: "FINAL",
      decimals: 18,
      launch: {
        modelId: "classic",
        modelVersion: "classic-v3",
        transactionHash: `0x${"a".repeat(64)}`,
        blockNumber: "25650000",
        launchedAt: "2026-08-04T08:00:00.000Z",
      },
    };
    const finalized = normalizeLegacyToken(source);
    finalized.launch.finality = "finalized";
    const confirmed = structuredClone(finalized);
    confirmed.token.address = "0x2222222222222222222222222222222222222222";
    confirmed.launchId = "eip155:1:0x2222222222222222222222222222222222222222";
    confirmed.launch.finality = "confirmed";
    const partial = structuredClone(finalized);
    partial.token.address = "0x3333333333333333333333333333333333333333";
    partial.launchId = "eip155:1:0x3333333333333333333333333333333333333333";
    partial.token.identityStatus = "partial";
    partial.token.name = null;

    const payload = tokenListPayload(
      [confirmed, partial, finalized],
      "2026-08-04T08:00:00.000Z",
    );
    assert.deepEqual(
      payload.tokens.map((token) => token.address),
      [source.address],
    );
    const registry = await createSchemaRegistry();
    assertValid(
      registry.validator("token-list.schema.json"),
      payload,
      "finalized token list",
    );
  });

  test("returns a known detail during partial coverage but not a false 404", async () => {
    const known = normalizeLegacyToken({
      chainId: 1,
      address: "0x1111111111111111111111111111111111111111",
      name: "Known Token",
      symbol: "KNOWN",
      decimals: 18,
      launch: {
        modelId: "classic",
        modelVersion: "classic-v3",
        transactionHash: `0x${"a".repeat(64)}`,
        blockNumber: "25650000",
        launchedAt: "2026-08-04T08:00:00.000Z",
      },
    });
    known.launch.finality = "finalized";
    const partialDataset = dataset(
      [known],
      25_650_000,
      "a",
      "2026-08-04T08:00:00.000Z",
    );
    partialDataset.status.status = "partial";
    partialDataset.status.coverage.status = "partial";
    const handler = createLaunchDetailHandler(async () => partialDataset);

    const found = await callHandler(handler, {
      chainId: "1",
      tokenAddress: known.token.address,
    });
    assert.equal(found.status, 200);
    assert.equal(found.body.launchId, known.launchId);

    const unknown = await callHandler(handler, {
      chainId: "1",
      tokenAddress: "0x2222222222222222222222222222222222222222",
    });
    assert.equal(unknown.status, 503);
    assert.equal(unknown.body.code, "index-coverage-incomplete");
  });
});
